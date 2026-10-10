// «Cuéntanos tu historia» (interfaz de prueba): el formulario completo, con fotos, audios y videos y el lugar de la
// historia. Todavía no envía nada: al final muestra cómo quedaría el envío. Cuando se conecte, cada historia llega
// «pendiente» a la revisión del equipo y, si se aprueba, aparece en el mapa en su lugar.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHOCO_MUNICIPALITIES, MAX_FILE_MB } from '../../content/stories';
import { EMBLEM_LABEL, SUBREGION_OF, categorize, type Emblem } from '../../content/choco';
import { Sheet } from '../components/Sheet';

interface Attachment {
  file: File;
  kind: 'foto' | 'audio' | 'video';
  /** Vista previa local (solo en este navegador). */
  url: string;
}

const kindOf = (f: File): Attachment['kind'] | null =>
  f.type.startsWith('image/') ? 'foto' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : null;
const size = (bytes: number) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.ceil(bytes / 1e3)} KB`);

export default function StoryForm({ onClose }: { onClose?: () => void }) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [fileNote, setFileNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'error'>('idle');
  const [sent, setSent] = useState<{ title: string; place: string; kind: Emblem; region?: string } | null>(null);

  // Las vistas previas se sueltan al quitarlas o al salir.
  const current = useRef(files);
  current.current = files;
  useEffect(() => () => current.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const skipped: string[] = [];
    const next: Attachment[] = [];
    for (const file of list) {
      const kind = kindOf(file);
      if (!kind) skipped.push(`${file.name} (no es foto, audio ni video)`);
      else if (file.size > MAX_FILE_MB * 1e6) skipped.push(`${file.name} (pesa más de ${MAX_FILE_MB} MB)`);
      else next.push({ file, kind, url: URL.createObjectURL(file) });
    }
    setFiles((f) => [...f, ...next]);
    setFileNote(skipped.length ? `No se agregaron: ${skipped.join(', ')}.` : '');
  };
  const removeFile = (i: number) => {
    URL.revokeObjectURL(files[i].url);
    setFiles((f) => f.filter((_, k) => k !== i));
  };

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

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const town = String(data.get('town'));
    setSent({
      title: String(data.get('title')),
      place: [data.get('spot'), town].filter(Boolean).join(', '),
      // Se clasifica sola por lo que cuenta (el equipo puede cambiarla al revisar) y queda en su subregión.
      kind: categorize(`${data.get('title')} ${data.get('story')}`),
      region: SUBREGION_OF[town],
    });
  };

  const aside = (
    <ol className="sheet-steps">
      <li><span><strong>Cuéntala</strong> con tus palabras, y si quieres con fotos, audios o videos.</span></li>
      <li><span><strong>La revisamos</strong> en el equipo de Territorios Vivos.</span></li>
      <li><span><strong>Aparece en el mapa,</strong> en el lugar donde pasó.</span></li>
    </ol>
  );

  if (sent) {
    return (
      <Sheet eyebrow="Cuéntanos tu historia" title="¡Gracias por contarla!" onClose={onClose} aside={aside}>
        <div className="story-sent">
          <p className="story-sent__lead">
            «{sent.title}», en {sent.place}, llegaría al equipo de Territorios Vivos. Después de revisarla, aparecería en el
            mapa, en su lugar.
          </p>
          <p className="story-help">
            Aparecería en {sent.region ? `la subregión ${sent.region}` : 'el mapa'} con la figurita de <strong>{EMBLEM_LABEL[sent.kind]}</strong>.
          </p>
          <p className="notice">Versión de prueba: todavía no se envía ni se guarda nada.</p>
          <button type="button" className="story-send" onClick={() => setSent(null)}>Volver al formulario</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      eyebrow="Cuéntanos tu historia"
      title="¿Qué viviste en el Chocó?"
      intro="Una historia, un recuerdo, una receta, un canto… Cuéntanos qué pasó y dónde."
      onClose={onClose}
      aside={aside}
    >
      <form className="story-form" onSubmit={submit}>
        <section className="story-step">
          <h3 className="story-step__title"><span>01</span> Tu historia</h3>
          <label className="story-field">
            <span className="story-field__label">Título</span>
            <input name="title" required maxLength={90} placeholder="La noche que llegaron las ballenas" />
          </label>
          <label className="story-field">
            <span className="story-field__label">Cuéntanos qué pasó</span>
            <textarea name="story" required minLength={40} rows={6} placeholder="Escríbela como si se la contaras a alguien en la playa." />
          </label>
          <label className="story-field">
            <span className="story-field__label">¿Cuándo pasó? <em>opcional</em></span>
            <input name="when" maxLength={60} placeholder="Un año o una época: en los 90, de niña…" />
          </label>
        </section>

        <section className="story-step">
          <h3 className="story-step__title"><span>02</span> ¿Dónde pasó?</h3>
          <div className="story-row">
            <label className="story-field">
              <span className="story-field__label">Municipio</span>
              <select name="town" required defaultValue="">
                <option value="" disabled>Elige el municipio</option>
                {CHOCO_MUNICIPALITIES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="story-field">
              <span className="story-field__label">Lugar <em>corregimiento, vereda, playa, río…</em></span>
              <input name="spot" maxLength={90} placeholder="Playa de Guachalito" />
            </label>
          </div>
          <div className="story-geo">
            <button type="button" className="story-geo__btn" onClick={locate} disabled={locating === 'busy'}>
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
          <h3 className="story-step__title"><span>03</span> Fotos, audios y videos <em>opcional</em></h3>
          <label className="story-drop">
            <input type="file" multiple accept="image/*,audio/*,video/*" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <span className="story-drop__text">Agrega fotos, audios o videos</span>
            <span className="story-help">Hasta {MAX_FILE_MB} MB cada uno</span>
          </label>
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
          <h3 className="story-step__title"><span>04</span> Sobre ti</h3>
          <div className="story-row">
            <label className="story-field">
              <span className="story-field__label">Tu nombre <em>o cómo quieres aparecer</em></span>
              <input name="name" required maxLength={60} autoComplete="name" />
            </label>
            <label className="story-field">
              <span className="story-field__label">Correo o WhatsApp <em>opcional · no se publica</em></span>
              <input name="contact" maxLength={90} autoComplete="email" />
            </label>
          </div>
          <label className="story-check">
            <input type="checkbox" name="consent" required />
            <span>Autorizo a Territorios Vivos a revisar mi historia y, si se aprueba, publicarla en el mapa con los archivos que adjunté.</span>
          </label>
        </section>

        <button type="submit" className="story-send">
          Enviar mi historia
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </form>
    </Sheet>
  );
}
