// «Cuéntanos tu historia» (interfaz de prueba): el formulario completo, con fotos, audios y videos y el lugar de la
// historia. Todavía no envía nada: al final muestra cómo quedaría el envío. Cuando se conecte, cada historia llega
// «pendiente» a la revisión del equipo y, si se aprueba, aparece en el mapa en su lugar.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHOCO_MUNICIPALITIES, MAX_FILE_MB } from '../../content/stories';
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
  const [sent, setSent] = useState<{ title: string; place: string } | null>(null);

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
    setSent({ title: String(data.get('title')), place: [data.get('spot'), data.get('town')].filter(Boolean).join(', ') });
  };

  if (sent) {
    return (
      <Sheet eyebrow="Cuéntanos tu historia" title="¡Gracias por contarla!" onClose={onClose}>
        <div className="story-sent">
          <p>
            Tu historia <strong>«{sent.title}»</strong>, en {sent.place}, llegaría al equipo de Territorios Vivos. Después de
            revisarla, aparecería en el mapa, en su lugar.
          </p>
          <p className="notice">Versión de prueba: todavía no se envía ni se guarda nada.</p>
          <button type="button" className="btn btn--dark" onClick={() => setSent(null)}>Volver al formulario</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      eyebrow="Cuéntanos tu historia"
      title="¿Qué viviste en el Chocó?"
      intro="Una historia, un recuerdo, una receta, un canto… Cuéntanos qué pasó y dónde. El equipo la revisa y, si se aprueba, aparece en el mapa."
      onClose={onClose}
    >
      <form className="story-form" onSubmit={submit}>
        <fieldset>
          <legend>Tu historia</legend>
          <label>
            Título
            <input name="title" required maxLength={90} placeholder="Por ejemplo: La noche que llegaron las ballenas" />
          </label>
          <label>
            Cuéntanos qué pasó
            <textarea name="story" required minLength={40} rows={7} placeholder="Escríbela como si se la contaras a alguien en la playa." />
          </label>
          <label>
            <span>¿Cuándo pasó? <span className="story-form__opt">(opcional)</span></span>
            <input name="when" maxLength={60} placeholder="Un año o una época: «en los 90», «de niña»…" />
          </label>
        </fieldset>

        <fieldset>
          <legend>¿Dónde pasó?</legend>
          <label>
            Municipio
            <select name="town" required defaultValue="">
              <option value="" disabled>Elige el municipio</option>
              {CHOCO_MUNICIPALITIES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label>
            <span>Lugar <span className="story-form__opt">(corregimiento, vereda, playa, río…)</span></span>
            <input name="spot" maxLength={90} placeholder="Por ejemplo: playa de Guachalito" />
          </label>
          <div className="story-form__geo">
            <button type="button" className="btn btn--light" onClick={locate} disabled={locating === 'busy'}>
              {locating === 'busy' ? 'Buscando…' : 'Usar mi ubicación'}
            </button>
            <p className="story-form__help">
              {coords
                ? <>Ubicación: {coords.lat}, {coords.lon} <button type="button" className="story-form__link" onClick={() => setCoords(null)}>quitar</button></>
                : locating === 'error'
                  ? 'No se pudo leer la ubicación. No pasa nada: con el municipio y el lugar el equipo la ubica.'
                  : 'Solo si estás en el lugar de la historia. Si no, con el municipio y el lugar el equipo la ubica en el mapa.'}
            </p>
            {coords && (
              <>
                <input type="hidden" name="lat" value={coords.lat} />
                <input type="hidden" name="lon" value={coords.lon} />
              </>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Fotos, audios y videos <span className="story-form__opt">(opcional)</span></legend>
          <label className="story-drop">
            <input type="file" multiple accept="image/*,audio/*,video/*" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <span><strong>Agregar archivos</strong> · hasta {MAX_FILE_MB} MB cada uno</span>
          </label>
          {fileNote && <p className="story-form__help" role="status">{fileNote}</p>}
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
        </fieldset>

        <fieldset>
          <legend>Sobre ti</legend>
          <label>
            <span>Tu nombre <span className="story-form__opt">(o cómo quieres aparecer en el mapa)</span></span>
            <input name="name" required maxLength={60} autoComplete="name" />
          </label>
          <label>
            <span>Correo o WhatsApp <span className="story-form__opt">(opcional, solo para el equipo: no se publica)</span></span>
            <input name="contact" maxLength={90} autoComplete="email" />
          </label>
        </fieldset>

        <label className="story-form__check">
          <input type="checkbox" name="consent" required />
          <span>Autorizo a Territorios Vivos a revisar mi historia y, si se aprueba, publicarla en el mapa con los archivos que adjunté.</span>
        </label>

        <button type="submit" className="btn btn--dark story-form__send">Enviar mi historia</button>
      </form>
    </Sheet>
  );
}
