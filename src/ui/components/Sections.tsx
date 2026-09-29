import { useEffect, useRef, useState, type TouchEvent } from 'react';
import type { Photo, Station, VideoAsset } from '../../domain/types';
import { aspectOf, Backdrop, Img } from './Media';
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
        // Sin filtro de color: el video (o su portada) se ve con sus colores originales.
        <Backdrop photo={video.poster} tint="transparent" />
      ) : (
        <div className="backdrop" style={{ background: video.tint ?? '#2d3a33' }} aria-hidden="true" />
      )}
      <div className="video reveal">
        <button type="button" className={`play${video.poster ? ' play--on-image' : ''}`} onClick={() => setAsked(true)} aria-label={`Reproducir ${video.title}`}>
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
  const [grid, setGrid] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  // Flechas ← → del teclado: pasan de foto en foto en la franja (solo en la página visible).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const el = track.current;
      if (!el || !el.closest('.stack-page.is-active') || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      const cards = Array.from(el.children) as HTMLElement[];
      const center = el.scrollLeft + el.clientWidth / 2;
      const current = cards.reduce((best, c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
        return d < best.d ? { i, d } : best;
      }, { i: 0, d: Infinity }).i;
      const next = cards[Math.max(0, Math.min(cards.length - 1, current + (e.key === 'ArrowRight' ? 1 : -1)))];
      el.scrollTo({ left: next.offsetLeft + next.offsetWidth / 2 - el.clientWidth / 2, behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Backdrop photo={gallery.background} tint="rgba(8,16,14,.55)" blur />
      <div className="gallery reveal">
        <div className="gallery__track" ref={track} data-no-arrows>
          {gallery.photos.map((ph, i) => (
            <button
              key={ph.id + i}
              type="button"
              className="gallery__card"
              style={{ aspectRatio: String(aspectOf(ph.id)) }}
              onClick={() => setOpen(i)}
              aria-label={`Ampliar: ${ph.alt}`}
            >
              {ph.tag === 'dron' && <span className="gallery__tag">◈ dron</span>}
              <Img photo={ph} sizes="(max-width: 700px) 80vw, 40vw" />
            </button>
          ))}
        </div>
        <button type="button" className="gallery__all" onClick={() => setGrid(true)}>
          <GridIcon size="small" /> Ver galería completa <span>· {gallery.photos.length} fotos</span>
        </button>
      </div>
      <GalleryGrid
        photos={gallery.photos}
        title={gallery.intro}
        background={gallery.background}
        open={grid}
        onClose={() => setGrid(false)}
        onPick={setOpen}
      />
      <Lightbox photos={gallery.photos} index={open} onChange={setOpen} />
    </>
  );
}

/** Ícono de cuadrícula: "small" (muchas fotos pequeñas) o "large" (pocas fotos grandes). */
function GridIcon({ size }: { size: 'small' | 'large' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      {size === 'small' ? (
        <>
          <rect x="1" y="1" width="4" height="4" rx=".8" /><rect x="6" y="1" width="4" height="4" rx=".8" /><rect x="11" y="1" width="4" height="4" rx=".8" />
          <rect x="1" y="6" width="4" height="4" rx=".8" /><rect x="6" y="6" width="4" height="4" rx=".8" /><rect x="11" y="6" width="4" height="4" rx=".8" />
          <rect x="1" y="11" width="4" height="4" rx=".8" /><rect x="6" y="11" width="4" height="4" rx=".8" /><rect x="11" y="11" width="4" height="4" rx=".8" />
        </>
      ) : (
        <>
          <rect x="1" y="1" width="6.5" height="6.5" rx="1" /><rect x="8.5" y="1" width="6.5" height="6.5" rx="1" />
          <rect x="1" y="8.5" width="6.5" height="6.5" rx="1" /><rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1" />
        </>
      )}
    </svg>
  );
}

/** Tamaños de la cuadrícula (ancho de columna en px), del más pequeño al más grande. */
const GRID_STEPS = [120, 170, 240, 330, 460, 640];

/**
 * Galería completa: todas las fotos en columnas sobre el fondo difuminado de la estación,
 * con el mismo rótulo del resto del sitio y un control flotante para agrandar o achicar las fotos.
 */
function GalleryGrid({ photos, title, background, open, onClose, onPick }: {
  photos: Photo[];
  title: string;
  background: Photo;
  open: boolean;
  onClose: () => void;
  onPick: (i: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(() => (window.innerWidth < 640 ? 1 : 2));
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const zoom = (dir: number) => setStep((s) => Math.max(0, Math.min(GRID_STEPS.length - 1, s + dir)));
  return (
    <dialog
      ref={ref}
      className="grid-view"
      aria-label={`Galería completa: ${title}`}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === '+' || e.key === '=') zoom(1);
        if (e.key === '-') zoom(-1);
      }}
    >
      <Backdrop photo={background} tint="rgba(6,14,12,.78)" blur />
      <div className="grid-view__body">
        <div className="grid-view__head">
          <span className="chip chip--plain">Galería · {title}</span>
          <span className="grid-view__count">{photos.length} fotos</span>
        </div>
        <div className="grid-view__cols" style={{ ['--col' as string]: `${GRID_STEPS[step]}px` }}>
          {photos.map((ph, i) => (
            <button key={ph.id + i} type="button" className="grid-view__item" onClick={() => onPick(i)} aria-label={`Ampliar: ${ph.alt}`}>
              <Img photo={ph} sizes={`${GRID_STEPS[step] * 1.5}px`} />
              {ph.caption && <span className="grid-view__caption">{ph.caption}</span>}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="icon-btn grid-view__close" onClick={onClose} aria-label="Cerrar galería">✕</button>
      <div className="grid-view__zoom" role="group" aria-label="Tamaño de las fotos">
        <button type="button" onClick={() => zoom(-1)} disabled={step === 0} aria-label="Ver más fotos, más pequeñas" title="Más fotos">
          <GridIcon size="small" />
        </button>
        <span className="grid-view__dots" aria-hidden="true">
          {GRID_STEPS.map((_, i) => <i key={i} className={i === step ? 'is-on' : ''} />)}
        </span>
        <button type="button" onClick={() => zoom(1)} disabled={step === GRID_STEPS.length - 1} aria-label="Ver fotos más grandes" title="Fotos más grandes">
          <GridIcon size="large" />
        </button>
      </div>
    </dialog>
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
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          go(e.key === 'ArrowRight' ? 1 : -1);
        }
      }}
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

/** Escena de silencio (marea alta / marea baja): sin voz, el título aparece despacio. */
export function SilencePanel({ tide, title, hint, photo }: { tide: 'alta' | 'baja'; title: string; hint: string; photo: Photo }) {
  return (
    <>
      <Backdrop photo={photo} tint={tide === 'alta' ? 'rgba(20,110,80,.5)' : 'rgba(30,90,110,.42)'} />
      <div className={`silence silence--${tide}`}>
        <h2 className="silence__title">{title}</h2>
        <p className="silence__hint"><span aria-hidden="true">≋</span> {hint}</p>
      </div>
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
