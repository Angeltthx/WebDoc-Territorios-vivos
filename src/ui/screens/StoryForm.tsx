// «Cuéntanos tu historia» (interfaz de prueba): el formulario completo, con fotos, audios y videos y el lugar de la
// historia. Todavía no envía nada: al final muestra cómo quedaría el envío. Cuando se conecte, cada historia llega
// «pendiente» a la revisión del equipo y, si se aprueba, aparece en el mapa en su lugar.
//
// No es una página que cuenta una historia: es el espacio para que alguien cuente la suya. Por eso es sobria (blanco,
// líneas finas, la letra del webdoc) y deja el protagonismo a lo que se escribe. La primera vez, un tutorial corto
// explica para qué es (ver StoryTutorial). Vivo sin ruido: pasos que se marcan, el tipo de historia con las figuritas
// del mapa (se elige solo según lo que se cuenta, y se puede cambiar), grabar la voz ahí mismo y, al lado, cómo se
// verá en el mapa.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHOCO_MUNICIPALITIES, MAX_FILE_MB } from '../../content/stories';
import { EMBLEM_LABEL, SUBREGION_OF, categorize, type Emblem } from '../../content/choco';
import { Sheet, type Origin } from '../components/Sheet';
import { EmblemIcon } from '../components/EmblemIcon';
import { StoryTutorial, TUTORIAL_SEEN } from '../components/StoryTutorial';

interface Attachment {
  file: File;
  kind: 'foto' | 'audio' | 'video';
  /** Vista previa local (solo en este navegador). */
  url: string;
}

const KINDS: Emblem[] = ['pueblo', 'selva', 'mar', 'rio', 'cultura', 'cocina'];
const kindOf = (f: File): Attachment['kind'] | null =>
  f.type.startsWith('image/') ? 'foto' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : null;
const size = (bytes: number) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.ceil(bytes / 1e3)} KB`);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** Lo mínimo que pide el relato. */
const MIN_STORY = 40;
/** Una grabación dura como mucho esto (segundos). */
const MAX_RECORDING = 300;

/** Grabar un audio con el micrófono del celular o del computador. */
function useRecorder(onDone: (file: File) => void) {
  const [state, setState] = useState<'idle' | 'recording' | 'denied'>('idle');
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const tick = useRef(0);
  const stop = () => rec.current?.state === 'recording' && rec.current.stop();
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(tick.current);
        setState('idle');
        const type = r.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        onDone(new File(chunks, `grabacion-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${ext}`, { type }));
      };
      rec.current = r;
      r.start();
      setSeconds(0);
      setState('recording');
      const t0 = performance.now();
      tick.current = window.setInterval(() => {
        const s = (performance.now() - t0) / 1000;
        setSeconds(s);
        if (s >= MAX_RECORDING) stop();
      }, 250);
    } catch {
      setState('denied');
    }
  };
  useEffect(() => () => {
    window.clearInterval(tick.current);
    if (rec.current?.state === 'recording') rec.current.stop();
  }, []);
  return { state, seconds, start, stop };
}

export default function StoryForm({ onClose, origin }: { onClose?: () => void; origin?: Origin }) {
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [town, setTown] = useState('');
  const [spot, setSpot] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  /** El tipo que eligió la persona; sin elegir, el que sale de lo que cuenta. */
  const [picked, setPicked] = useState<Emblem | null>(null);
  const guessed = categorize(`${title} ${story}`);
  const kind = picked ?? guessed;
  const [files, setFiles] = useState<Attachment[]>([]);
  const [fileNote, setFileNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'error'>('idle');
  /** Ya se mostró una vez (al volver del agradecimiento, el formulario no repite la entrada). */
  const [visited, setVisited] = useState(false);
  const [sent, setSent] = useState(false);
  // El tutorial: solo la primera vez (y cuando se pide con «¿Cómo funciona?»).
  const [tutorial, setTutorial] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_SEEN);
    } catch {
      return true;
    }
  });

  // Las vistas previas se sueltan al quitarlas o al salir.
  const current = useRef(files);
  current.current = files;
  useEffect(() => () => current.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  const addFiles = (list: Iterable<File> | null) => {
    if (!list) return;
    const skipped: string[] = [];
    const next: Attachment[] = [];
    for (const file of list) {
      const k = kindOf(file);
      if (!k) skipped.push(`${file.name} (no es foto, audio ni video)`);
      else if (file.size > MAX_FILE_MB * 1e6) skipped.push(`${file.name} (pesa más de ${MAX_FILE_MB} MB)`);
      else next.push({ file, kind: k, url: URL.createObjectURL(file) });
    }
    setFiles((f) => [...f, ...next]);
    setFileNote(skipped.length ? `No se agregaron: ${skipped.join(', ')}.` : '');
  };
  const removeFile = (i: number) => {
    URL.revokeObjectURL(files[i].url);
    setFiles((f) => f.filter((_, k) => k !== i));
  };
  const recorder = useRecorder((file) => addFiles([file]));

  const locate = () => {
    if (!navigator.geolocation) return setLocating('error');
    setLocating('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5) });
        setLocating('idle');
      },
      () => setLocating('error'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  // Cómo va: cada paso se marca al completarse (los archivos son opcionales: cuentan si se agregó alguno).
  const steps = [
    { label: 'Cuéntala', done: title.trim().length > 2 && story.trim().length >= MIN_STORY },
    { label: 'Dónde', done: !!town },
    { label: 'Voz y fotos', done: files.length > 0 },
    { label: 'Tú', done: name.trim().length > 1 && consent },
  ];
  const progress = steps.filter((s) => s.done).length / steps.length;
  /** Lo obligatorio está completo (los archivos son opcionales). */
  const ready = steps[0].done && steps[1].done && steps[3].done;
  const region = town ? SUBREGION_OF[town] : undefined;
  const place = [spot, town].filter(Boolean).join(', ');

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSent(true);
  };

  /** Cómo se verá en el mapa: el punto dorado con su nombre, su figurita y su ficha. Se arma mientras se escribe. */
  const preview = (
    <div className="story-preview" aria-label="Así se verá en el mapa">
      <p className="story-preview__eyebrow">Así se verá en el mapa</p>
      <div className="story-preview__pin">
        <span className="story-preview__name">{title.trim() || 'Tu historia'}</span>
        <span className="story-preview__dot" />
        <span className="story-preview__fig"><EmblemIcon kind={kind} size={34} /></span>
      </div>
      <p className="story-preview__kind">Historia · {EMBLEM_LABEL[kind]}{region ? ` · ${region}` : ''}</p>
      <p className="story-preview__title">{title.trim() || 'Tu historia'}</p>
      {place && <p className="story-preview__place">{place}</p>}
      {story.trim() && <p className="story-preview__text">{story.trim().slice(0, 140)}{story.trim().length > 140 ? '…' : ''}</p>}
    </div>
  );

  if (sent) {
    return (
      <Sheet eyebrow="Tu historia" title="Gracias por contarla" onClose={onClose} aside={preview} origin={origin} still>
        <div className="story-sent">
          <p className="story-sent__lead">
            «{title}», en {place}, llegaría al equipo de Territorios Vivos. Después de revisarla, aparecería en el mapa,
            en su lugar, con la figurita de <strong>{EMBLEM_LABEL[kind]}</strong>.
          </p>
          <p className="story-help">Versión de prueba: todavía no se envía ni se guarda nada.</p>
          <button type="button" className="story-send" onClick={() => { setVisited(true); setSent(false); }}>Volver al formulario</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      origin={origin}
      still={visited}
      eyebrow="Tu historia"
      title="Este espacio es tuyo"
      intro="Para que lo que viviste en el Chocó —un recuerdo, una receta, un canto— tenga su lugar en el mapa."
      onClose={onClose}
      aside={preview}
      overlay={tutorial && <StoryTutorial onDone={() => setTutorial(false)} />}
    >
      <button type="button" className="story-how" onClick={() => setTutorial(true)}>¿Cómo funciona?</button>
      {/* Cómo va: cuatro pasos que se llenan. */}
      <ol className="story-progress" aria-label="Pasos">
        {steps.map((s, i) => (
          <li key={s.label} className={s.done ? 'is-done' : ''}>
            <span className="story-progress__n">{s.done ? '✓' : i + 1}</span>
            <span className="story-progress__label">{s.label}</span>
          </li>
        ))}
        <span className="story-progress__bar" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      </ol>

      <form className="story-form" onSubmit={submit}>
        <section className="story-step">
          <h3 className="story-step__title"><span className="story-step__n">01</span>Cuéntala</h3>
          <label className="story-field">
            <span className="story-field__label">Título</span>
            <input name="title" required maxLength={90} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="La noche que llegaron las ballenas" />
          </label>
          <label className="story-field">
            <span className="story-field__label">
              Cuéntanos qué pasó
              <em className={story.trim().length >= MIN_STORY ? 'is-ok' : ''}>
                {story.trim().length >= MIN_STORY ? '¡Así va bien!' : `${MIN_STORY - story.trim().length} letras más, mínimo`}
              </em>
            </span>
            <textarea name="story" required minLength={MIN_STORY} rows={6} value={story} onChange={(e) => setStory(e.target.value)} placeholder="Escríbela como si se la contaras a alguien en la playa." />
          </label>
          <div className="story-field">
            <span className="story-field__label">
              ¿De qué trata? <em>{picked ? 'elegido por ti' : 'lo elegimos por lo que cuentas; cámbialo si quieres'}</em>
            </span>
            <div className="story-kinds" role="radiogroup" aria-label="Tipo de historia">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={k === kind}
                  className={`story-kind${k === kind ? ' is-on' : ''}`}
                  onClick={() => setPicked(k === picked ? null : k)}
                >
                  <EmblemIcon kind={k} />
                  <span>{EMBLEM_LABEL[k]}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="story-field">
            <span className="story-field__label">¿Cuándo pasó? <em>opcional</em></span>
            <input name="when" maxLength={60} placeholder="Un año o una época: en los 90, de niña…" />
          </label>
        </section>

        <section className="story-step">
          <h3 className="story-step__title"><span className="story-step__n">02</span>¿Dónde pasó?</h3>
          <div className="story-row">
            <label className="story-field">
              <span className="story-field__label">Municipio</span>
              <select name="town" required value={town} onChange={(e) => setTown(e.target.value)}>
                <option value="" disabled>Elige el municipio</option>
                {CHOCO_MUNICIPALITIES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="story-field">
              <span className="story-field__label">Lugar <em>corregimiento, vereda, playa, río…</em></span>
              <input name="spot" maxLength={90} value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="Playa de Guachalito" />
            </label>
          </div>
          {region && <p className="story-help story-help--live">Queda en la subregión <strong>{region}</strong>.</p>}
          <div className="story-geo">
            <button type="button" className="story-chip" onClick={locate} disabled={locating === 'busy'}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              {locating === 'busy' ? 'Buscando…' : coords ? `${coords.lat}, ${coords.lon}` : 'Usar mi ubicación'}
            </button>
            <p className="story-help">
              {coords
                ? <>Listo: la historia queda en ese punto. <button type="button" className="story-link" onClick={() => setCoords(null)}>Quitar</button></>
                : locating === 'error'
                  ? 'No se pudo leer la ubicación. No pasa nada: con el municipio y el lugar el equipo la ubica.'
                  : 'Solo si estás donde pasó. Si no, con el municipio y el lugar el equipo la ubica en el mapa.'}
            </p>
            {coords && (
              <>
                <input type="hidden" name="lat" value={coords.lat} />
                <input type="hidden" name="lon" value={coords.lon} />
              </>
            )}
          </div>
        </section>

        <section className="story-step">
          <h3 className="story-step__title"><span className="story-step__n">03</span>Tu voz, fotos o video <em>opcional</em></h3>
          <div className="story-media">
            <label className="story-drop">
              <input type="file" multiple accept="image/*,audio/*,video/*" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              <span className="story-drop__icons" aria-hidden="true">
                <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></svg>
                <svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>
              </span>
              <span className="story-drop__text">Agrega fotos o videos</span>
              <span className="story-help">Hasta {MAX_FILE_MB} MB cada uno</span>
            </label>
            {recorder.state === 'recording' ? (
              <button type="button" className="story-record is-on" onClick={recorder.stop}>
                <span className="story-record__dot" />
                <span className="story-drop__text">Grabando {clock(recorder.seconds)}</span>
                <span className="story-help">Toca para terminar</span>
              </button>
            ) : (
              <button type="button" className="story-record" onClick={() => void recorder.start()}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                <span className="story-drop__text">Grábala con tu voz</span>
                <span className="story-help">{recorder.state === 'denied' ? 'No se pudo usar el micrófono' : `Hasta ${MAX_RECORDING / 60} minutos`}</span>
              </button>
            )}
          </div>
          {fileNote && <p className="story-help" role="status">{fileNote}</p>}
          {files.length > 0 && (
            <ul className="story-files">
              {files.map((a, i) => (
                <li key={a.url}>
                  {a.kind === 'foto' && <img src={a.url} alt="" />}
                  {a.kind === 'video' && <video src={a.url} muted playsInline preload="metadata" />}
                  {a.kind === 'audio' && <audio src={a.url} controls preload="none" />}
                  <span className="story-files__name">{a.file.name}<small>{a.kind} · {size(a.file.size)}</small></span>
                  <button type="button" className="story-files__x" onClick={() => removeFile(i)} aria-label={`Quitar ${a.file.name}`}>×</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="story-step">
          <h3 className="story-step__title"><span className="story-step__n">04</span>Tú</h3>
          <div className="story-row">
            <label className="story-field">
              <span className="story-field__label">Tu nombre <em>o cómo quieres aparecer</em></span>
              <input name="name" required maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="story-field">
              <span className="story-field__label">Correo o WhatsApp <em>opcional · no se publica</em></span>
              <input name="contact" maxLength={90} autoComplete="email" />
            </label>
          </div>
          <label className="story-check">
            <input type="checkbox" name="consent" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Autorizo a Territorios Vivos a revisar mi historia y, si se aprueba, publicarla en el mapa con los archivos que adjunté.</span>
          </label>
        </section>

        {/* En el celular, la vista previa va aquí (en el computador está al lado, sobre el atardecer). */}
        <div className="story-preview-mobile">{preview}</div>

        <button type="submit" className={`story-send${ready ? ' is-ready' : ''}`}>
          Enviar mi historia
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </form>
    </Sheet>
  );
}
