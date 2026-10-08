import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getStation, stations, transitions, voices } from '../../content/journey';
import { pages, type PageSpec, type Tabs } from '../../content/pages';
import { useScrollJourney } from '../../application/journey';
import { initAudioUnlock, isMuted, playTransition, setAmbient, setMuted, setVoice } from '../../application/sound';
import { Backdrop } from '../components/Media';
import {
  Arrow, ChachitaTag, GuideButton, JourneyNav, PageTabs, STATION_PAGE, SiteMenu, SocialLinks,
  StationGuide, TopBar, TransitionSymbol, useJourneyNav,
} from '../components/Chrome';
import { GalleryPanel, QuotePanel, RecipePanel, SilencePanel, SongsPanel, VideoPanel } from '../components/Sections';

/**
 * El webdoc como un recorrido vertical: cada página ocupa la pantalla y, al desplazarse,
 * la siguiente sube sobre la anterior con un borde de ola que se aplana al llegar.
 */
export function Webdoc() {
  const scroller = useRef<HTMLDivElement>(null);
  const { active, scrollToIndex, scrollToPage } = useScrollJourney(scroller);
  const [guideOpen, setGuideOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Páginas ya vistas: sus animaciones de entrada corren una vez, al llegar a ellas.
  const [seen, setSeen] = useState(() => new Set([active]));

  const [muted, setMutedState] = useState(isMuted);
  const first = useRef(true);

  useEffect(() => initAudioUnlock(), []);

  useEffect(() => {
    setSeen((s) => (s.has(active) ? s : new Set(s).add(active)));
    document.title = `Territorios Vivos · ${active + 1} / ${pages.length}`;
    // Ola corta al cambiar de página (no al cargar), salvo al entrar a una transición con video,
    // que trae su propio sonido (con la voz de Chachita). Ambiente de marea en su escena y voz de
    // Chachita antes del Viche.
    const spec = pages[active];
    if (first.current) first.current = false;
    else if (!(spec.kind === 'transition' && transitions[spec.index].video)) playTransition();
    setAmbient(spec.kind === 'silence' ? spec.tide : null);
    setVoice(voiceOf(spec));
  }, [active]);

  useEffect(() => () => { setAmbient(null); setVoice(null); }, []);

  const toggleSound = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const nav = useMemo(() => ({ scrollToPage, scrollToIndex }), [scrollToPage, scrollToIndex]);

  return (
    <JourneyNav.Provider value={nav}>
      <main className="scroller" ref={scroller}>
        {pages.map((spec, i) => {
          const state = i === active ? ' is-active' : i === active + 1 ? ' is-next' : i < active - 1 ? ' is-covered' : '';
          return (
            <section
              key={spec.id}
              id={spec.id}
              className={`stack-page${state}${seen.has(i) ? ' is-seen' : ''}${i === 0 ? ' stack-page--first' : ''}`}
              style={{ zIndex: i + 1 }}
              aria-hidden={i !== active ? true : undefined}
              inert={i !== active ? true : undefined}
            >
              <PageView spec={spec} next={pages[i + 1]?.id} playing={i === active} near={Math.abs(i - active) <= 1} muted={muted} openGuide={() => setGuideOpen(true)} />
            </section>
          );
        })}
      </main>
      <SiteMenu open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} />
      <div className="dock">
        <button
          type="button"
          className="dock__sound"
          onClick={toggleSound}
          aria-pressed={!muted}
          aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
          title={muted ? 'Activar sonido' : 'Silenciar sonido'}
        >
          {muted ? <SoundOff /> : <SoundOn />}
        </button>
        <SocialLinks />
      </div>
      <StationGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </JourneyNav.Provider>
  );
}

function voiceOf(spec: PageSpec): string | null {
  if (spec.kind === 'transition') return transitions[spec.index].voice ?? null;
  if (spec.id === 'pangui-viche') return voices.viche;
  return null;
}

function PageView({ spec, next, playing, near, muted, openGuide }: {
  spec: PageSpec;
  /** Página siguiente del recorrido (para la invitación a seguir bajando). */
  next?: string;
  playing: boolean;
  /** Página visible o vecina: sus videos se precargan. */
  near: boolean;
  muted: boolean;
  openGuide: () => void;
}) {
  const { scrollToIndex, scrollToPage } = useJourneyNav();
  switch (spec.kind) {
    case 'welcome':
      return (
        <div className="screen screen--welcome" aria-labelledby="wt">
          <PortadaVideo playing={playing} />
          <TopBar plain label="Portada" right={<GuideButton onOpen={openGuide}>Ver mapa interactivo</GuideButton>} />
          <div className="welcome">
            <h1 id="wt" className="wordmark">
              <span className="wordmark__top">Territorios</span>
              <span className="wordmark__bottom">Vivos</span>
              <span className="wordmark__sub">Relatos del Pacífico</span>
            </h1>
            <p className="welcome__voice">Chachita te recibe en voz</p>
          </div>
          <div className="welcome__start">
            <button type="button" className="start-btn" onClick={() => scrollToIndex(1)}>
              Comenzar el viaje
              <Arrow dir="down" />
            </button>
          </div>
        </div>
      );

    case 'quote':
      return (
        <div className="screen" aria-label={spec.label}>
          <div className="screen__content"><QuotePanel station={getStation(spec.station)!} /></div>
          <TopBar label={spec.label} right={<GuideButton onOpen={openGuide} />} />
          <StationFoot tabs={spec.tabs} next={next} />
        </div>
      );

    case 'video':
      return (
        <div className="screen" aria-label={spec.label}>
          <div className="screen__content"><VideoPanel video={spec.video} bar={spec.bar} active={playing} /></div>
          <TopBar label={spec.label} />
          {spec.tabs && <StationFoot tabs={spec.tabs} next={next} />}
        </div>
      );

    case 'gallery': {
      const gallery = getStation(spec.station)!.gallery!;
      return (
        <div className="screen" aria-label={spec.label}>
          <div className="screen__content"><GalleryPanel gallery={gallery} /></div>
          <TopBar plain label={spec.label} />
          <StationFoot tabs={spec.tabs} next={next}>
            <p className="page-foot__note">{gallery.intro.toLowerCase()} · deslizar →</p>
          </StationFoot>
        </div>
      );
    }

    case 'recipe':
      return (
        <div className="screen" aria-label={spec.label}>
          <div className="screen__content"><RecipePanel recipe={getStation('chori')!.recipe!} /></div>
          <TopBar label={spec.label} />
          <StationFoot tabs={spec.tabs} next={next} />
        </div>
      );

    case 'transition': {
      const t = transitions[spec.index];
      const onPhoto = !!(t.background || t.video);
      return (
        <div className="screen screen--transition" style={{ background: t.color }} aria-label={t.label ?? `Transición ${t.number}: de ${t.from} a ${t.to}`}>
          {t.video && <TransitionVideo id={t.video} playing={playing} near={near} muted={muted} shade={t.lines.length > 0} />}
          {t.background && <Backdrop photo={t.background} tint={t.tint} />}
          {t.color && <div className="rain" aria-hidden="true" />}
          <TopBar plain={onPhoto} label={t.label ?? <>Transición {t.number} · {t.from} → {t.to}</>} right={<ChachitaTag plain={onPhoto} />} />
          <div className="transition">
            {!t.video && <TransitionSymbol kind={t.symbol} />}
            {t.lines.map((line, i) => (
              <p key={i} className={i === 0 ? 'transition__quote' : 'transition__line'} style={{ animationDelay: `${0.4 + i * 0.9}s` }}>
                {i === 0 ? `"${line}"` : line}
              </p>
            ))}
            {t.hint && <p className="transition__hint">{t.hint}</p>}
          </div>
          {!onPhoto && (
            <ol className="t-dots" aria-hidden="true">
              {transitions.map((_, i) => <li key={i} className={i === spec.index ? 'is-active' : ''} />)}
            </ol>
          )}
        </div>
      );
    }

    case 'silence':
      return (
        <div className="screen" aria-label={`${spec.label}: ${spec.title}`}>
          <div className="screen__content"><SilencePanel tide={spec.tide} title={spec.title} hint={spec.hint} photo={spec.photo} /></div>
          <TopBar label={spec.label} />
          <StationFoot tabs={spec.tabs} next={next} />
        </div>
      );

    case 'songs':
      return (
        <div className="screen" aria-label={spec.label}>
          <div className="screen__content"><SongsPanel songs={getStation('pangui')!.songs!} /></div>
          <TopBar plain label={spec.label} />
          <StationFoot tabs={spec.tabs} next={next} />
        </div>
      );

    case 'closing':
      return <ClosingPage onRestart={() => scrollToIndex(0)} onStation={(id) => scrollToPage(STATION_PAGE[id])} />;
  }
}

/** Pie de las páginas de estación: invitación a seguir bajando y pestañas. */
function StationFoot({ tabs, next, children }: { tabs: Tabs; next?: string; children?: ReactNode }) {
  const { scrollToPage } = useJourneyNav();
  return (
    <footer className="page-foot">
      {next && (
        <button type="button" className="scroll-hint" onClick={() => scrollToPage(next)} aria-label="Seguir bajando">
          Sigue bajando
          <Arrow dir="down" />
        </button>
      )}
      <PageTabs tabs={tabs} />
      {children}
    </footer>
  );
}

/**
 * Video de fondo de la portada (Panguí), silenciado para permitir la reproducción automática.
 * Se pausa cuando la portada queda cubierta, y al volver continúa desde el mismo punto (no se reinicia).
 */
function PortadaVideo({ playing }: { playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const small = useMemo(() => window.matchMedia('(max-width: 900px)').matches, []);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [playing]);
  return (
    <div className="backdrop" aria-hidden="true" style={{ backgroundImage: 'url(/media/video/portada-poster.webp)' }}>
      <video
        ref={ref}
        className="backdrop__video"
        src={`/media/video/portada-${small ? 720 : 1080}.mp4`}
        poster="/media/video/portada-poster.webp"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="backdrop__tint" style={{ background: 'radial-gradient(ellipse at center, rgba(6,18,14,.08), rgba(6,18,14,.42))' }} />
    </div>
  );
}

/** Versión de los videos de transición: los archivos conservan su nombre y /media se guarda en caché
 *  un año, así que al recibir videos nuevos se cambia este valor para que el navegador los vuelva a pedir. */
const TRANSITIONS_VERSION = '2026-10-05';

/**
 * Video de una transición, con su propio sonido. Empieza desde el inicio cada vez que se llega
 * a la transición y se pausa al salir. Si el navegador no permite sonido todavía (sin gesto del
 * visitante), se reproduce en silencio. Solo se descarga cuando la transición está cerca.
 */
function TransitionVideo({ id, playing, near, muted, shade }: { id: string; playing: boolean; near: boolean; muted: boolean; shade: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const small = useMemo(() => window.matchMedia('(max-width: 900px)').matches, []);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!playing) {
      v.pause();
      return;
    }
    v.currentTime = 0;
    v.muted = muted;
    v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => {});
    });
  }, [playing]);
  useEffect(() => {
    const v = ref.current;
    if (v && playing) v.muted = muted;
  }, [muted, playing]);
  const poster = `/media/transiciones/${id}-poster.webp?v=${TRANSITIONS_VERSION}`;
  return (
    <div className="backdrop" aria-hidden="true" style={{ backgroundImage: `url(${poster})` }}>
      <video
        ref={ref}
        className="backdrop__video"
        src={`/media/transiciones/${id}-${small ? 720 : 1080}.mp4?v=${TRANSITIONS_VERSION}`}
        poster={poster}
        muted
        loop
        playsInline
        preload={near ? 'auto' : 'none'}
      />
      {shade && <div className="backdrop__tint" style={{ background: 'radial-gradient(ellipse at center, rgba(6,18,14,.28), rgba(6,18,14,.05) 70%)' }} />}
    </div>
  );
}

function SoundOn() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8v4h3l4 3V5L6 8Z" />
      <path d="M13 7.5c1.2 1.4 1.2 3.6 0 5M15.5 5.5c2.3 2.6 2.3 6.4 0 9" />
    </svg>
  );
}

function SoundOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8v4h3l4 3V5L6 8Z" />
      <path d="m13 8 4 4m0-4-4 4" />
    </svg>
  );
}

const PIN_COLORS = ['#ffffff', '#5fc7a2', '#8fbf5a', '#8cb8ee'];

function ClosingPage({ onRestart, onStation }: { onRestart: () => void; onStation: (id: string) => void }) {
  const [soon, setSoon] = useState(false);
  return (
    <div className="screen screen--closing" aria-labelledby="closing-title">
      <TopBar label="Cierre · Mapa 3D" right={<ChachitaTag />} />
      <div className="closing">
        <p className="closing__quote">volver a las raíces</p>
        <p className="closing__by">— Chachita</p>
        <h2 id="closing-title">¿cuál es tu río?</h2>
        <div className="closing__map">
          <div className="closing__lake" aria-hidden="true" />
          {stations.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`closing__pin closing__pin--${i + 1}`}
              style={{ background: PIN_COLORS[i] }}
              aria-label={`Estación ${s.number}: ${s.name}, ${s.place}`}
              onClick={() => onStation(s.id)}
            >
              <span />
            </button>
          ))}
        </div>
      </div>
      <div className="closing__actions">
        {soon && <p className="notice" role="status">Aportar historias llegará en una fase posterior.</p>}
        <button type="button" className="btn btn--dark" onClick={onRestart}>↻ volver a empezar</button>
        <button type="button" className="btn btn--light" onClick={() => setSoon(true)}>+ aportar tu historia</button>
      </div>
    </div>
  );
}
