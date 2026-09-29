import { useEffect, useRef, useState, type TouchEvent } from 'react';
import type { Photo, Station, VideoAsset } from '../../domain/types';
import { Backdrop, Img } from './Media';
import { Arrow } from './Chrome';

export function QuotePanel({ station }: { station: Station }) {
  const { quote } = station;
  return (
    <>
      <Backdrop photo={quote.portrait} tint="linear-gradient(90deg, rgba(6,14,11,.7) 0%, rgba(6,14,11,.35) 55%, rgba(6,14,11,.15) 100%)" />
      <div className="quote reveal">
        <blockquote>
          <p>“{quote.text}”</p>
        </blockquote>
        <p className="quote__author">{quote.author}</p>
      </div>
    </>
  );
}

const toSeconds = (t: string) => t.split(':').reduce((acc, n) => acc * 60 + Number(n), 0);

/** Reproductor del corto. Mientras no exista el archivo de streaming, muestra el estado pendiente. */
export function VideoPanel({ video, bar }: { video: VideoAsset; bar?: string }) {
  const [asked, setAsked] = useState(false);
  const [now, total] = bar ? bar.split('/').map((s) => toSeconds(s.trim())) : [0, 1];
  return (
    <>
      {video.poster ? (
        <Backdrop photo={video.poster} tint={video.tint ? `${video.tint}c7` : 'rgba(70,80,70,.62)'} />
      ) : (
        <div className="backdrop" style={{ background: video.tint ?? '#2d3a33' }} aria-hidden="true" />
      )}
      <div className="video reveal">
        <button type="button" className={`play${video.poster ? ' play--bare' : ''}`} onClick={() => setAsked(true)} aria-label={`Reproducir ${video.title}`}>
          <svg width="34" height="34" viewBox="0 0 30 30" aria-hidden="true"><path d="M10 6v18l14-9Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        </button>
        {!video.poster && <p className="video__title">{video.title}{video.duration && <span> · {video.duration}</span>}</p>}
        {asked && <p className="notice" role="status">El video se integrará cuando se entregue el archivo final.</p>}
      </div>
      {bar && (
        <div className="video__bar" aria-hidden="true">
          <span className="video__pause">❚❚</span>
          <span className="video__track"><span style={{ width: `${(now / total) * 100}%` }} /></span>
          <span className="video__time">{bar}</span>
        </div>
      )}
    </>
  );
}

export function GalleryPanel({ gallery }: { gallery: NonNullable<Station['gallery']> }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <Backdrop photo={gallery.background} tint="rgba(8,16,14,.55)" blur />
      <div className="gallery reveal">
        <div className="gallery__track" data-no-arrows>
          {gallery.photos.map((ph, i) => (
            <button key={ph.id + i} type="button" className="gallery__card" onClick={() => setOpen(i)} aria-label={`Ampliar: ${ph.alt}`}>
              {ph.tag === 'dron' && <span className="gallery__tag">◈ dron</span>}
              <Img photo={ph} sizes="(max-width: 700px) 80vw, 30vw" />
            </button>
          ))}
        </div>
      </div>
      <Lightbox photos={gallery.photos} index={open} onChange={setOpen} />
    </>
  );
}

function Lightbox({ photos, index, onChange }: { photos: Photo[]; index: number | null; onChange: (i: number | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal();
    if (index === null && d.open) d.close();
  }, [index]);
  const go = (dir: number) => index !== null && onChange((index + dir + photos.length) % photos.length);
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };
  const ph = index !== null ? photos[index] : null;
  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label="Fotografía ampliada"
      onClose={() => onChange(null)}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
      onClick={(e) => e.target === ref.current && onChange(null)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={onTouchEnd}
    >
      {ph && (
        <figure key={ph.id + index}>
          <Img photo={ph} priority className="lightbox__img" />
          <figcaption>
            <span>{ph.caption ?? ph.alt}</span>
            <span className="muted">{index! + 1} / {photos.length}</span>
          </figcaption>
        </figure>
      )}
      <button type="button" className="icon-btn lightbox__close" onClick={() => onChange(null)} aria-label="Cerrar">✕</button>
      <button type="button" className="round-btn lightbox__prev" onClick={() => go(-1)} aria-label="Foto anterior"><Arrow dir="left" /></button>
      <button type="button" className="round-btn lightbox__next" onClick={() => go(1)} aria-label="Foto siguiente"><Arrow dir="right" /></button>
    </dialog>
  );
}

export function RecipePanel({ recipe }: { recipe: NonNullable<Station['recipe']> }) {
  return (
    <>
      <Backdrop photo={recipe.hero} tint="linear-gradient(90deg, rgba(6,14,11,.62), rgba(6,14,11,.3))" />
      <div className="recipe reveal">
        <div className="recipe__text">
          <p className="eyebrow">{recipe.eyebrow}</p>
          <h2>{recipe.title}</h2>
        </div>
        <div className="recipe__steps">
          {recipe.steps.map((s) => (
            <figure key={s.id}><Img photo={s} sizes="(max-width: 700px) 45vw, 22vw" /></figure>
          ))}
          <figure className="recipe__pending" aria-label="Video de la receta pendiente" />
        </div>
      </div>
    </>
  );
}

export function SilencePanel({ silence }: { silence: NonNullable<Station['silence']> }) {
  return (
    <>
      <Backdrop photo={silence.photo} tint="rgba(20,110,80,.5)" />
      <div className="silence">
        <h2 className="silence__title">{silence.title}</h2>
        <p className="silence__hint"><span aria-hidden="true">🔇</span> {silence.hint}</p>
      </div>
      <p className="page-note">un respiro antes del clímax · sin voz · el título aparece despacio</p>
    </>
  );
}

export function SongsPanel({ songs }: { songs: NonNullable<Station['songs']> }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <Backdrop photo={songs.background} tint="rgba(10,24,18,.25)" />
      <div className="songs reveal">
        <button type="button" className="glass-card" onClick={() => setMsg('El recorrido 360° se integrará cuando se entregue el material.')}>
          <span className="glass-card__icon" aria-hidden="true">◉</span>
          <strong>{songs.panorama.title}</strong>
          <span>{songs.panorama.sub}</span>
        </button>
        <button type="button" className="glass-card" onClick={() => setMsg('Los cantos se reproducirán cuando se entreguen las grabaciones.')}>
          <span className="glass-card__icon" aria-hidden="true">♪</span>
          <strong>Chachita canta</strong>
          <span>{songs.songs.map((s) => s.title).join(' · ')}</span>
        </button>
      </div>
      {msg && <p className="notice notice--float" role="status">{msg}</p>}
    </>
  );
}
