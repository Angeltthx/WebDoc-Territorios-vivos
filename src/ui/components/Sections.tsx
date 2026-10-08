import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent } from 'react';
import type { Photo, Station, VideoAsset } from '../../domain/types';
import { aspectOf, Backdrop, Img } from './Media';
import { Arrow } from './Chrome';
import { Portal } from './Portal';

// La experiencia 360 (three.js + hls.js) solo se descarga cuando alguien la abre.
const Panorama360 = lazy(() => import('./Panorama360'));

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

/** Pestañas Tráiler historia y Video canción: el video en streaming si ya existe; si no, el estado pendiente. */
export function VideoPanel({ video, bar, active = false }: { video: VideoAsset; bar?: string; active?: boolean }) {
  if (video.stream) return <StoryPlayer id={video.stream} title={video.title} active={active} />;
  return <PendingVideo video={video} bar={bar} />;
}

/** Reproductor pendiente: portada y botón, hasta que se entregue el archivo final. */
function PendingVideo({ video, bar }: { video: VideoAsset; bar?: string }) {
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
          <PlayGlyph />
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

function PlayGlyph() {
  return <svg width="34" height="34" viewBox="0 0 30 30" aria-hidden="true"><path d="M10 6v18l14-9Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/**
 * Video de HISTORIA en streaming (HLS en 1080p, 720p y 480p según la conexión), a pantalla completa
 * y con sus colores originales. Empieza con el botón de reproducir. Mientras el video corre, las
 * pestañas y el rótulo de la estación salen de la pantalla y los controles ocupan su lugar; tras unos
 * segundos sin movimiento se oculta todo (modo cine). Al pausar, las pestañas regresan. Si el visitante sigue bajando, el video se pausa y al volver continúa
 * donde iba. hls.js solo se descarga al reproducir (Safari usa su reproductor nativo).
 */
function StoryPlayer({ id, title, active }: { id: string; title: string; active: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const hls = useRef<{ destroy: () => void } | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState({ now: 0, total: 0 });
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef(0);
  const base = `/media/historias/${id}`;
  const src = `${base}/master.m3u8`;

  // Al salir de la página, el video se pausa (sin reiniciarse).
  useEffect(() => {
    if (!active) ref.current?.pause();
  }, [active]);

  useEffect(() => () => {
    hls.current?.destroy();
    window.clearTimeout(idleTimer.current);
  }, []);

  // Los controles se ocultan tras unos segundos sin movimiento mientras el video corre.
  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 2600);
  };

  const start = async () => {
    const v = ref.current;
    if (!v) return;
    setStarted(true);
    setError(false);
    wake();
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari: HLS nativo, asignado y reproducido dentro del mismo clic.
      if (!v.src) v.src = src;
      void v.play().catch(() => {}); // interrumpido (pausa, salir de la página): no es un error
      return;
    }
    const { default: Hls } = await import('hls.js/light');
    if (!Hls.isSupported()) {
      setError(true);
      return;
    }
    if (!hls.current) {
      const h = new Hls({ maxBufferLength: 30, capLevelToPlayerSize: true });
      h.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) setError(true); });
      h.loadSource(src);
      h.attachMedia(v);
      hls.current = h;
    }
    void v.play().catch(() => {}); // interrumpido (pausa, salir de la página): no es un error
  };

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (!started) void start();
    else if (v.paused) void v.play();
    else v.pause();
    wake();
  };

  const seek = (e: ReactPointerEvent<HTMLDivElement>) => {
    const v = ref.current;
    if (!v || !time.total) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * time.total;
    wake();
  };

  const fullscreen = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (box.current?.requestFullscreen) void box.current.requestFullscreen().catch(() => {});
    else v?.webkitEnterFullscreen?.(); // iPhone
  };

  const progress = time.total ? (time.now / time.total) * 100 : 0;
  const hide = started && playing && idle;

  return (
    <div
      ref={box}
      className={`story${started ? ' is-started' : ''}${started && playing ? ' is-playing' : ''}${hide ? ' is-idle' : ''}`}
      data-no-arrows
      onPointerMove={started ? wake : undefined}
    >
      <video
        ref={ref}
        className="story__video"
        poster={`${base}/poster.webp`}
        playsInline
        preload="none"
        onClick={started ? toggle : undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => { setWaiting(false); setError(false); }}
        onError={() => setError(true)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onLoadedMetadata={(e) => setTime({ now: e.currentTarget.currentTime, total: e.currentTarget.duration })}
        onTimeUpdate={(e) => setTime({ now: e.currentTarget.currentTime, total: e.currentTarget.duration })}
        onEnded={() => setIdle(false)}
      />

      {!started && (
        <div className="video reveal">
          <button type="button" className="play play--on-image" onClick={toggle} aria-label={`Reproducir ${title}`}>
            <PlayGlyph />
          </button>
          <p className="video__title story__title">{title}</p>
        </div>
      )}

      {started && waiting && !error && <span className="pano__spinner story__spinner" role="status" aria-label="Cargando" />}
      {error && <p className="notice notice--float" role="alert">No se pudo cargar el video. Revisa la conexión e inténtalo de nuevo.</p>}

      {started && (
        <div className="pano__controls story__controls" onPointerMove={wake}>
          <button type="button" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}>
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M4 2.5v11l9-5.5Z" /></svg>
            )}
          </button>
          <span className="pano__time">{fmt(time.now)}</span>
          <div
            className="pano__track"
            role="slider"
            aria-label="Posición del video"
            aria-valuemin={0}
            aria-valuemax={Math.round(time.total) || 0}
            aria-valuenow={Math.round(time.now)}
            aria-valuetext={`${fmt(time.now)} de ${fmt(time.total)}`}
            onPointerDown={seek}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="pano__time">{fmt(time.total)}</span>
          <button type="button" onClick={() => { if (ref.current) ref.current.muted = !muted; wake(); }} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8v4h3l4 3V5L6 8Z" />
              {muted ? <path d="m13 8 4 4m0-4-4 4" /> : <path d="M13 7.5c1.2 1.4 1.2 3.6 0 5M15.5 5.5c2.3 2.6 2.3 6.4 0 9" />}
            </svg>
          </button>
          <button type="button" onClick={fullscreen} aria-label="Pantalla completa">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg>
          </button>
        </div>
      )}
    </div>
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
      <Portal>
        <GalleryGrid
          photos={gallery.photos}
          title={gallery.intro}
          background={gallery.background}
          open={grid}
          onClose={() => setGrid(false)}
          onPick={setOpen}
        />
        <Lightbox photos={gallery.photos} index={open} onChange={setOpen} />
      </Portal>
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
  const [video360, setVideo360] = useState<HTMLVideoElement | null>(null);
  const { panorama } = songs;

  // El video se crea y se activa dentro del clic: así iPhone/Safari permiten reproducir con sonido.
  const open360 = () => {
    const v = document.createElement('video');
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.crossOrigin = 'anonymous';
    v.preload = 'auto';
    // Safari reproduce HLS de forma nativa: se asigna y reproduce aquí mismo, dentro del gesto.
    // Los demás navegadores usan hls.js al abrir la experiencia (ya cuentan con el gesto del visitante).
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = panorama.src;
      void v.play().catch(() => {});
    }
    setVideo360(v);
  };

  return (
    <>
      <Backdrop photo={songs.background} tint="rgba(10,24,18,.25)" />
      <div className="songs reveal">
        <button type="button" className="glass-card glass-card--360" onClick={open360}>
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
      {video360 && (
        <Portal>
          <Suspense fallback={<div className="pano-boot" role="status">Entrando al manglar…</div>}>
            <Panorama360 src={panorama.src} poster={panorama.poster} label={panorama.label} video={video360} onClose={() => setVideo360(null)} />
          </Suspense>
        </Portal>
      )}
    </>
  );
}
