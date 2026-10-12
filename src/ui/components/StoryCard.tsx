// La ficha de una historia del mapa: flota encima de su figurita (sigue al punto en pantalla, ver `track` en
// MapScene). Arriba lo que se ve (video o foto), debajo el papel blanco con quién la cuenta, la historia, su voz, más
// fotos y los comentarios. En el celular sube desde abajo, como una hoja.
// Los comentarios todavía son solo la interfaz: no se envían ni se guardan.

import { useEffect, useRef, useState } from 'react';
import { EMBLEM_LABEL, type ChocoPoint } from '../../content/choco';

type Tale = NonNullable<ChocoPoint['tale']>;

/** Comentarios de ejemplo, para ver cómo se verá la sección (todavía no hay comentarios de verdad). */
const SAMPLE_COMMENTS = [
  { author: 'Yuliana M.', when: 'hace 2 días', text: 'Yo también las vi desde la playa en septiembre. Es algo que no se olvida.' },
  { author: 'Don Arcesio', when: 'hace 1 semana', text: 'Así eran las noches cuando yo era pelao. Gracias por contarla.' },
];

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '·';

export default function StoryCard({ spot, track, onClose }: {
  spot: ChocoPoint & { tale: Tale };
  /** Registra el elemento que debe seguir al punto en pantalla (o lo suelta con null). */
  track: (el: HTMLElement | null) => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    track(root.current);
    return () => track(null);
  }, [track]);
  // Cerrar con Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { tale } = spot;
  const visual = tale.media.filter((m) => m.kind !== 'audio');
  const hero = visual.find((m) => m.kind === 'video') ?? visual[0];
  const more = visual.filter((m) => m !== hero);
  const voices = tale.media.filter((m) => m.kind === 'audio');

  return (
    <article ref={root} className={`tale${hero ? '' : ' tale--plain'}`} aria-label={`Historia: ${spot.name}`}>
      <div className="tale__float">
        {hero && (
          <figure className="tale__hero">
            {hero.kind === 'video'
              ? <video src={hero.url} controls playsInline preload="metadata" />
              : <img src={hero.url} alt={hero.name} />}
          </figure>
        )}

        <div className="tale__paper">
          <button type="button" className="tale__close" aria-label="Cerrar la historia" onClick={onClose}>×</button>

          <header className="tale__head">
            <p className="tale__kind">
              <span className="tale__dot" aria-hidden="true" />
              Historia · {spot.story ? EMBLEM_LABEL[spot.story] : 'Chocó'}
            </p>
            <h2 className="tale__title">{spot.name}</h2>
            <div className="tale__by">
              <span className="tale__avatar" aria-hidden="true">{initials(tale.author)}</span>
              <div>
                <p className="tale__author">Contada por {tale.author}</p>
                <p className="tale__meta">{[tale.place, tale.when].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          </header>

          <section className="tale__section">
            <h3 className="tale__label">La historia</h3>
            <div className="tale__text">
              {tale.text.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
            </div>
          </section>

          {voices.length > 0 && (
            <section className="tale__section">
              <h3 className="tale__label">Escúchala</h3>
              {voices.map((m) => <audio key={m.url} src={m.url} controls preload="none" />)}
            </section>
          )}

          {more.length > 0 && (
            <section className="tale__section">
              <h3 className="tale__label">Fotos y videos</h3>
              <div className="tale__gallery">
                {more.map((m) => m.kind === 'video'
                  ? <video key={m.url} src={m.url} controls playsInline preload="metadata" />
                  : <img key={m.url} src={m.url} alt={m.name} loading="lazy" />)}
              </div>
            </section>
          )}

          <section className="tale__section tale__comments">
            <h3 className="tale__label">
              Comentarios <span className="tale__count">{SAMPLE_COMMENTS.length}</span>
              <em className="tale__soon">Próximamente</em>
            </h3>
            <ul className="tale__thread">
              {SAMPLE_COMMENTS.map((c) => (
                <li key={c.author} className="tale__comment">
                  <span className="tale__avatar tale__avatar--sm" aria-hidden="true">{initials(c.author)}</span>
                  <div>
                    <p className="tale__comment-head"><strong>{c.author}</strong> · {c.when}</p>
                    <p className="tale__comment-text">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <form className="tale__compose" onSubmit={(e) => e.preventDefault()}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribe un comentario…"
                aria-label="Escribe un comentario"
                maxLength={400}
              />
              <button type="submit" disabled title="Muy pronto podrás comentar">Enviar</button>
            </form>
            <p className="tale__note">Muy pronto podrás comentar las historias. Estos comentarios son de ejemplo.</p>
          </section>
        </div>
      </div>
      <span className="tale__tail" aria-hidden="true" />
    </article>
  );
}
