import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject, type TouchEvent } from 'react';
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

/** «Presiona para…»: debajo de lo que hay que presionar (un video, el 360, una canción), a los pocos segundos de
 * llegar a la página, con la flecha del recorrido apuntando arriba y el mismo palpitar de «Sigue bajando». */
export function PressHint({ desk, touch }: { desk: string; touch: string }) {
  return (
    <p className="play-hint" aria-hidden="true">
      <span className="play-hint__arrow"><Arrow dir="up" /></span>
      <span className="play-hint__desk">{desk}</span>
      <span className="play-hint__touch">{touch}</span>
    </p>
  );
}

/** Pestañas Tráiler historia y Video canción: el video en streaming si ya existe; si no, el estado pendiente. */
export function VideoPanel({ video, bar, active = false }: { video: VideoAsset; bar?: string; active?: boolean }) {
  if (video.youtube) return <YouTubePlayer id={video.youtube} title={video.title} poster={video.stream && `/media/historias/${video.stream}/poster.webp`} active={active} />;
  if (video.stream) return <StoryPlayer id={video.stream} title={video.title} active={active} />;
  return <PendingVideo video={video} bar={bar} />;
}

/** Aviso bajo los tráileres (pedido del cliente, 20/10/2026). */
const TRAILER_NOTE =
  'Muy pronto podrás disfrutar de la historia completa en cines, eventos especiales y televisión. Síguenos en nuestras redes sociales para conocer las próximas fechas, horarios y lugares de proyección. ¡Mantente conectado para no perderte ningún detalle!';

/** El video en un recuadro (no a pantalla completa) sobre el fondo de la galería de la estación; en los tráileres, con
 * el aviso del estreno debajo. */
export function FramedVideo({ video, background, note, active = false }: { video: VideoAsset; background: Photo; note?: boolean; active?: boolean }) {
  return (
    <>
      <Backdrop photo={background} tint="rgba(8,16,14,.55)" blur />
      <div className="trailer reveal">
        <div className="trailer__frame"><VideoPanel video={video} active={active} /></div>
        {note && <p className="trailer__note">{TRAILER_NOTE}</p>}
      </div>
    </>
  );
}

interface YTPlayer { pauseVideo(): void; destroy(): void }
interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    videoId: string;
    playerVars: Record<string, number | string>;
    events: { onStateChange?: (e: { data: number }) => void; onError?: () => void };
  }) => YTPlayer;
}

let youtubeApi: Promise<YTNamespace> | null = null;
/** La API de YouTube (una sola vez, la primera vez que se llega a una página con un video de YouTube). */
function loadYouTube(): Promise<YTNamespace> {
  youtubeApi ??= new Promise((resolve, reject) => {
    const w = window as unknown as { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };
    if (w.YT?.Player) return resolve(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(w.YT!); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { youtubeApi = null; reject(new Error('YouTube')); };
    document.head.appendChild(s);
  });
  return youtubeApi;
}

/**
 * Video de YouTube (27/10/2026: el cliente quiere que las visitas del webdoc cuenten en su canal). Antes de reproducir se
 * ve nuestra imagen de espera y el botón de siempre; al presionarlo aparece el reproductor de YouTube y arranca. Se pausa
 * al salir de la página. Si YouTube no carga (sin conexión, bloqueado), queda el enlace para verlo allá.
 */
function YouTubePlayer({ id, title, poster, active }: { id: string; title: string; poster?: string; active: boolean }) {
  const slot = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);

  // La API se pide al llegar a la página, para que al presionar el video arranque enseguida.
  useEffect(() => {
    if (active) loadYouTube().catch(() => {});
    else player.current?.pauseVideo();
  }, [active]);

  useEffect(() => () => player.current?.destroy(), []);

  const start = () => {
    setStarted(true);
    setError(false);
    loadYouTube().then((YT) => {
      if (!slot.current || player.current) return;
      player.current = new YT.Player(slot.current, {
        videoId: id,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: { onError: () => setError(true) },
      });
    }, () => setError(true));
  };

  return (
    <div className={`story yt${started ? ' is-started' : ''}`} data-no-arrows="x">
      {poster && <img className="story__video" src={poster} alt="" aria-hidden="true" />}
      <div className="yt__slot"><div ref={slot} /></div>
      {!started && (
        <div className="video reveal">
          <button type="button" className="play play--on-image" onClick={start} aria-label={`Reproducir ${title}`}>
            <PlayGlyph />
          </button>
          <p className="video__title story__title">{title}</p>
        </div>
      )}
      {error && (
        <p className="notice notice--float" role="alert">
          No se pudo cargar el video. <a href={`https://youtu.be/${id}`} target="_blank" rel="noopener noreferrer">Verlo en YouTube ↗</a>
        </p>
      )}
    </div>
  );
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
      data-no-arrows="x"
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
          {/* Si a los pocos segundos no lo ha puesto: cómo verlo. */}
          <PressHint desk="Presiona para ver el video" touch="Toca para ver el video" />
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

/**
 * Mueve una franja horizontal (la galería, los pasos de la receta) una tarjeta hacia `dir` (1 o -1). `align`: dónde
 * queda la tarjeta, como en su scroll-snap (al centro de la franja o al comienzo).
 */
function stepTrack(el: HTMLElement, dir: number, align: 'center' | 'start') {
  const box = el.getBoundingClientRect();
  const ref = align === 'center' ? box.left + box.width / 2 : box.left + (parseFloat(getComputedStyle(el).paddingLeft) || 0);
  const pos = (c: Element) => {
    const r = c.getBoundingClientRect();
    return align === 'center' ? r.left + r.width / 2 : r.left;
  };
  const cards = Array.from(el.children);
  const current = cards.reduce((best, c, i) => {
    const d = Math.abs(pos(c) - ref);
    return d < best.d ? { i, d } : best;
  }, { i: 0, d: Infinity }).i;
  const next = cards[Math.max(0, Math.min(cards.length - 1, current + dir))];
  el.scrollBy({ left: pos(next) - ref, behavior: 'smooth' });
}

/** Flechas ← → del teclado: pasan de tarjeta en tarjeta en la franja (solo en la página visible). Sin esto, con la
 * navegación con cursor de Chrome (F7) las flechas mueven el cursor por las letras y la franja no avanza. */
function useSideArrows(track: RefObject<HTMLElement | null>, align: 'center' | 'start') {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = track.current;
      if (!el || !el.closest('.stack-page.is-active') || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      stepTrack(el, e.key === 'ArrowRight' ? 1 : -1, align);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [track, align]);
}

export function GalleryPanel({ gallery }: { gallery: NonNullable<Station['gallery']> }) {
  const [open, setOpen] = useState<number | null>(null);
  const [grid, setGrid] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  useSideArrows(track, 'center');

  return (
    <>
      <Backdrop photo={gallery.background} tint="rgba(8,16,14,.55)" blur />
      <div className="gallery reveal">
        <div className="gallery__track" ref={track} data-no-arrows="x">
          {gallery.photos.map((ph, i) => (
            <button
              key={ph.id + i}
              type="button"
              className="gallery__card"
              style={{ aspectRatio: String(aspectOf(ph.id)), ['--ar' as string]: aspectOf(ph.id) }}
              onClick={() => setOpen(i)}
              aria-label={`Ampliar: ${ph.alt}`}
            >
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

/** El texto de un paso: si no cabe en la pantalla se desplaza, y se desvanece abajo mientras quede texto por leer. */
function StepText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [clipped, setClipped] = useState(false);
  const check = () => {
    const el = ref.current;
    if (el) setClipped(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    const resize = new ResizeObserver(check);
    resize.observe(el);
    return () => resize.disconnect();
  }, []);
  return <p ref={ref} className={`recipe__body${clipped ? ' is-clipped' : ''}`} onScroll={check}>{text}</p>;
}

/**
 * La receta (27/10/2026): el título y la introducción a un lado y los pasos en una franja que se desliza, cada uno con
 * su texto y sus fotos. Cualquier foto se amplía y desde ahí se recorren todas, en orden. Los pasos se recorren
 * deslizando, con las flechas ← → del teclado o con los botones a los lados de la franja (28/10/2026). Como página de
 * libro de cocina (30/10/2026): sin tarjetas ni etiquetas, y un riel que marca el paso y lleva a cualquiera.
 */
export function RecipePanel({ recipe }: { recipe: NonNullable<Station['recipe']> }) {
  const [open, setOpen] = useState<number | null>(null);
  const track = useRef<HTMLOListElement>(null);
  // Hasta dónde se puede mover la franja: el botón de ese lado se apaga.
  const [ends, setEnds] = useState({ start: true, end: false });
  // El paso que está al comienzo de la franja (lo marca el riel).
  const [current, setCurrent] = useState(0);
  const measure = () => {
    const el = track.current;
    if (!el) return;
    setEnds({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    const items = [...el.children] as HTMLElement[];
    const first = items[0]?.offsetLeft ?? 0;
    // Al final de la franja los últimos pasos no llegan al comienzo: se marca el último.
    const at = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      ? items.length - 1
      : items.reduce((best, it, i) => (Math.abs(it.offsetLeft - first - el.scrollLeft) < Math.abs(items[best].offsetLeft - first - el.scrollLeft) ? i : best), 0);
    setCurrent(at);
  };
  useEffect(measure, []);
  useSideArrows(track, 'start');
  const step = (dir: number) => track.current && stepTrack(track.current, dir, 'start');
  const goTo = (n: number) => {
    const el = track.current;
    const items = el && ([...el.children] as HTMLElement[]);
    if (el && items?.[n]) el.scrollTo({ left: items[n].offsetLeft - items[0].offsetLeft, behavior: 'smooth' });
  };
  const photos = recipe.steps.flatMap((s) => s.photos);
  let at = 0;
  return (
    <>
      <Backdrop photo={recipe.hero} tint="linear-gradient(90deg, rgba(7,15,12,.86), rgba(7,15,12,.62))" blur />
      <div className="recipe reveal">
        <div className="recipe__text">
          <h2>{recipe.title}</h2>
          <p className="recipe__dek">{recipe.eyebrow}</p>
          <p className="recipe__intro">{recipe.intro}</p>
          <nav className="recipe__rail" aria-label="Pasos de la receta">
            {recipe.steps.map((_, n) => (
              <button
                key={n}
                type="button"
                className={n === current ? 'is-current' : undefined}
                aria-current={n === current ? 'step' : undefined}
                aria-label={`Paso ${n + 1} de ${recipe.steps.length}`}
                onClick={() => goTo(n)}
              />
            ))}
          </nav>
        </div>
        <div className="recipe__track">
        <ol className="recipe__steps" data-no-arrows="x" ref={track} onScroll={measure}>
          {recipe.steps.map((step, n) => {
            const first = at;
            at += step.photos.length;
            return (
              <li key={n} className="recipe__step">
                <div className={`recipe__photos recipe__photos--${Math.min(step.photos.length, 4)}`}>
                  {step.photos.map((ph, i) => (
                    <button key={ph.id} type="button" onClick={() => setOpen(first + i)} aria-label={`Ampliar: ${ph.alt}`}>
                      <Img photo={ph} sizes="(max-width: 700px) 80vw, 380px" />
                    </button>
                  ))}
                </div>
                <p className="recipe__num" aria-label={`Paso ${n + 1}`}>{n + 1}</p>
                <StepText text={step.text} />
              </li>
            );
          })}
        </ol>
        <button type="button" className="round-btn recipe__prev" onClick={() => step(-1)} disabled={ends.start} aria-label="Paso anterior"><Arrow dir="left" /></button>
        <button type="button" className="round-btn recipe__next" onClick={() => step(1)} disabled={ends.end} aria-label="Paso siguiente"><Arrow dir="right" /></button>
        </div>
      </div>
      <Portal>
        <Lightbox photos={photos} index={open} onChange={setOpen} />
      </Portal>
    </>
  );
}

/**
 * Los cantos de Chachita, dentro de su tarjeta (30/10/2026): se ve el canto de turno con su botón; al terminar suena
 * el siguiente, y con las flechas se pasa de uno a otro.
 */
function useSongs(list: { src?: string }[], active: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const load = (i: number, autoplay: boolean) => {
    const src = list[i]?.src;
    if (!src) return;
    // Se crea dentro del toque: así el iPhone deja que suene.
    const a = (audio.current ??= new Audio());
    a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.onended = () => (i + 1 < list.length ? load(i + 1, true) : (setIndex(0), setProgress(0)));
    if (!a.src.endsWith(src)) a.src = src;
    setIndex(i);
    setProgress(0);
    if (autoplay) void a.play().catch(() => setPlaying(false));
  };
  const toggle = () => {
    const a = audio.current;
    if (a && a.src && !a.paused) a.pause();
    else if (a?.src) void a.play().catch(() => setPlaying(false));
    else load(index, true);
  };
  const go = (dir: number) => load((index + dir + list.length) % list.length, playing || !audio.current);
  // Al salir de la página, los cantos se callan.
  useEffect(() => {
    if (!active) audio.current?.pause();
  }, [active]);
  useEffect(() => () => audio.current?.pause(), []);
  return { index, playing, progress, toggle, go };
}

export function SongsPanel({ songs, active = false }: { songs: NonNullable<Station['songs']>; active?: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [video360, setVideo360] = useState<HTMLVideoElement | null>(null);
  const { panorama } = songs;
  const recorded = songs.songs.some((s) => s.src);
  const player = useSongs(songs.songs, active);

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
        <div className="songs__item">
          <button type="button" className="glass-card glass-card--360" onClick={open360}>
            <span className="glass-card__icon" aria-hidden="true">◉</span>
            <strong>{songs.panorama.title}</strong>
            <span>{songs.panorama.sub}</span>
          </button>
          <PressHint desk="Presiona para ver el video 360" touch="Toca para ver el video 360" />
          {/* El 360 se queda con nuestro visor; el enlace suma visitas en el canal del cliente (27/10/2026). */}
          {panorama.youtube && (
            <a className="songs__yt" href={panorama.youtube} target="_blank" rel="noopener noreferrer">También en YouTube ↗</a>
          )}
        </div>
        <div className="songs__item">
          {recorded ? (
            <div className={`glass-card glass-card--song song-card${player.playing ? ' is-playing' : ''}`}>
              <span className="glass-card__icon" aria-hidden="true">♪</span>
              <strong>Chachita canta</strong>
              <span className="song-card__now" aria-live="polite">{songs.songs[player.index].title}</span>
              <div className="song-card__controls">
                <button type="button" className="song-card__skip" onClick={() => player.go(-1)} aria-label="Canto anterior"><Arrow dir="left" /></button>
                <button type="button" className="song-card__play" onClick={player.toggle} aria-label={`${player.playing ? 'Pausar' : 'Escuchar'} ${songs.songs[player.index].title}`}>
                  {/* El anillo se llena mientras suena el canto. */}
                  <svg className="song-card__ring" viewBox="0 0 40 40" aria-hidden="true">
                    <circle cx="20" cy="20" r="19" />
                    <circle cx="20" cy="20" r="19" pathLength={1} strokeDasharray={`${player.progress} 1`} />
                  </svg>
                  <svg className="song-card__glyph" viewBox="0 0 16 16" aria-hidden="true">{player.playing ? <path d="M4.5 3h2.4v10H4.5zM9.1 3h2.4v10H9.1z" /> : <path d="M5 2.8v10.4l8.5-5.2z" />}</svg>
                </button>
                <button type="button" className="song-card__skip" onClick={() => player.go(1)} aria-label="Canto siguiente"><Arrow dir="right" /></button>
              </div>
            </div>
          ) : (
            <button type="button" className="glass-card glass-card--song" onClick={() => setMsg('Los cantos se reproducirán cuando se entreguen las grabaciones.')}>
              <span className="glass-card__icon" aria-hidden="true">♪</span>
              <strong>Chachita canta</strong>
              <span>{songs.songs.map((s) => s.title).join(' · ')}</span>
            </button>
          )}
          <PressHint desk="Presiona para escuchar la canción" touch="Toca para escuchar la canción" />
        </div>
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
