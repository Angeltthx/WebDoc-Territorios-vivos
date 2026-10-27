import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getStation, transitions } from '../../content/journey';
import { pages, type PageSpec, type Tabs } from '../../content/pages';
import { useScrollJourney } from '../../application/journey';
import { initAudioUnlock, isMuted, playTransition, setMuted, setVoice } from '../../application/sound';
import { Backdrop } from '../components/Media';
import {
  Arrow, ChachitaTag, GuideButton, JourneyNav, PageTabs, SiteMenu, SocialLinks,
  StationGuide, TopBar, TransitionSymbol, useJourneyNav,
} from '../components/Chrome';
import { FramedVideo, GalleryPanel, QuotePanel, RecipePanel, SongsPanel, VideoPanel } from '../components/Sections';
import { ScrollCue } from '../components/ScrollCue';
import { StationLocator } from '../components/StationLocator';

/**
 * El webdoc como un recorrido vertical: cada página ocupa la pantalla y, al desplazarse,
 * la siguiente sube sobre la anterior como una hoja que se desliza encima (ver «Al pasar de página» en los estilos).
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
    // que trae su propio sonido (con la voz de Chachita).
    const spec = pages[active];
    if (first.current) first.current = false;
    else if (!(spec.kind === 'transition' && transitions[spec.index].video)) playTransition();
    setVoice(voiceOf(spec));
  }, [active]);

  useEffect(() => () => setVoice(null), []);

  const toggleSound = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const nav = useMemo(() => ({ scrollToPage, scrollToIndex, inJourney: true }), [scrollToPage, scrollToIndex]);

  return (
    <JourneyNav.Provider value={nav}>
      <main className="scroller" ref={scroller}>
        {pages.map((spec, i) => {
          const state = i === active ? ' is-active' : i === active + 1 ? ' is-next' : i < active - 1 ? ' is-covered' : '';
          return (
            <section
              key={spec.id}
              id={spec.id}
              className={`stack-page${state}${seen.has(i) ? ' is-seen' : ''}${i === 0 ? ' stack-page--first' : ''}${spec.kind === 'closing' ? ' stack-page--closing' : ''}`}
              style={{ zIndex: i + 1 }}
              aria-hidden={i !== active ? true : undefined}
              inert={i !== active ? true : undefined}
            >
              <PageView
                spec={spec}
                next={pages[i + 1]?.id}
                playing={i === active}
                near={Math.abs(i - active) <= 1}
                muted={muted}
                unmute={() => muted && toggleSound()}
                openGuide={() => setGuideOpen(true)}
              />
            </section>
          );
        })}
      </main>
      <ScrollCue page={active} off={pages[active].kind === 'closing'} onNext={() => scrollToIndex(active + 1)} />
      <SiteMenu open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} current={pages[active].id} />
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
  // El Tráiler historia de la estación 4 ya no lleva voz: la que sonaba ahí era la del Viche (20/10/2026).
  return spec.kind === 'transition' ? transitions[spec.index].voice ?? null : null;
}

function PageView({ spec, next, playing, near, muted, unmute, openGuide }: {
  spec: PageSpec;
  /** Página siguiente del recorrido (para la invitación a seguir bajando). */
  next?: string;
  playing: boolean;
  /** Página visible o vecina: sus videos se precargan. */
  near: boolean;
  muted: boolean;
  /** Activa el sonido del webdoc (si estaba silenciado): la persona pidió escuchar. */
  unmute: () => void;
  openGuide: () => void;
}) {
  const { scrollToIndex, scrollToPage } = useJourneyNav();
  switch (spec.kind) {
    case 'welcome':
      return (
        <div className="screen screen--welcome" aria-labelledby="wt">
          <Welcome playing={playing} muted={muted} unmute={unmute} />
          <TopBar plain label="Bienvenida" right={<GuideButton onOpen={() => scrollToPage('cierre')}>Ver mapa interactivo</GuideButton>} />
          <div className="welcome__start">
            <button type="button" className="start-btn" onClick={() => scrollToIndex(1)}>
              Comenzar el viaje
              <Arrow dir="down" />
            </button>
            {/* Crédito de la productora (pedido del cliente, 20/10/2026). */}
            <p className="credit">
              Una producción de <a href="https://www.doinmedia.com" target="_blank" rel="noopener">Doinmedia</a>
            </p>
          </div>
        </div>
      );

    case 'quote':
      return (
        <div className="screen" aria-label={spec.label}>
          <div className="screen__content"><QuotePanel station={getStation(spec.station)!} /></div>
          <StationLocator station={getStation(spec.station)!} />
          <TopBar label={spec.label} right={<GuideButton onOpen={openGuide} />} />
          <StationFoot tabs={spec.tabs} next={next} />
        </div>
      );

    case 'video':
      return (
        <div className="screen" aria-label={spec.label}>
          <div className="screen__content">
            {spec.frame ? (
              <FramedVideo video={spec.video} background={getStation(spec.frame)!.gallery!.background} note={spec.note} active={playing} />
            ) : (
              <VideoPanel video={spec.video} bar={spec.bar} active={playing} />
            )}
          </div>
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
          {t.video && <TransitionVideo id={t.video} playing={playing} near={near} muted={muted} shade={t.lines.length > 0} fit={t.fit} />}
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
          {t.number > 0 && <RouteMap index={spec.index} />}
          {!onPhoto && (
            <ol className="t-dots" aria-hidden="true">
              {transitions.map((_, i) => <li key={i} className={i === spec.index ? 'is-active' : ''} />)}
            </ol>
          )}
        </div>
      );
    }

    case 'songs':
      return (
        <div className="screen" aria-label={spec.label}>
          <div className="screen__content"><SongsPanel songs={getStation('pangui')!.songs!} /></div>
          <TopBar plain label={spec.label} />
          <StationFoot tabs={spec.tabs} next={next} />
        </div>
      );

    case 'closing':
      // «Volver al recorrido» lleva a la bienvenida (pedido del cliente, 19/10/2026).
      return <ClosingMap playing={playing} near={near} onBack={() => scrollToIndex(0)} />;
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

type Listen = 'idle' | 'listening' | 'heard';

/**
 * La bienvenida: el logo sobre el video del intro, que trae la voz de Chachita (19/10/2026: antes eran dos páginas, la
 * portada y el intro, con la misma toma). El navegador no deja que un video suene sin un gesto de la persona, así que
 * arranca en silencio y en bucle, y un botón claro bajo el logo invita a escucharla: al tocarlo empieza desde el
 * principio, con sonido. Al terminar sigue en bucle, en silencio, y el botón ofrece escucharla otra vez.
 */
function Welcome({ playing, muted, unmute }: { playing: boolean; muted: boolean; unmute: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const small = useMemo(() => window.matchMedia('(max-width: 900px)').matches, []);
  const [listen, setListen] = useState<Listen>('idle');
  // De fondo: en silencio y en bucle.
  const quiet = (v: HTMLVideoElement) => {
    v.muted = true;
    v.loop = true;
  };
  // Al salir de la página se pausa (y si estaba hablando, se calla); al volver sigue de fondo.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) {
      void v.play().catch(() => {});
      return;
    }
    v.pause();
    if (!v.loop) {
      quiet(v);
      setListen((l) => (l === 'listening' ? 'idle' : l));
    }
  }, [playing]);
  // El botón de sonido del webdoc también la calla (o la deja sonar otra vez).
  useEffect(() => {
    const v = ref.current;
    if (v && listen === 'listening') v.muted = muted;
  }, [muted, listen]);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (listen === 'listening') {
      quiet(v);
      setListen('idle');
      return;
    }
    unmute();
    v.loop = false;
    v.muted = false;
    v.currentTime = 0;
    void v.play().catch(() => {});
    setListen('listening');
  };
  const onEnded = () => {
    const v = ref.current;
    if (!v) return;
    quiet(v);
    void v.play().catch(() => {});
    setListen('heard');
  };
  const poster = `/media/transiciones/intro-poster.webp?v=${TRANSITIONS_VERSION}`;
  return (
    <>
      <div className="backdrop" aria-hidden="true" style={{ backgroundImage: `url(${poster})` }}>
        <video
          ref={ref}
          className="backdrop__video"
          src={`/media/transiciones/intro-${small ? 720 : 1080}.mp4?v=${TRANSITIONS_VERSION}`}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onEnded={onEnded}
        />
        <div className="backdrop__tint" style={{ background: 'radial-gradient(ellipse at center, rgba(6,18,14,.08), rgba(6,18,14,.42))' }} />
      </div>
      <div className="welcome">
        <h1 id="wt" className="wordmark">
          <span className="wordmark__top">Territorios</span>
          <span className="wordmark__bottom">Vivos</span>
          <span className="wordmark__sub">Relatos del Pacífico</span>
        </h1>
        <button type="button" className={`listen listen--${listen}`} onClick={toggle} aria-pressed={listen === 'listening'}>
          <span className="listen__icon" aria-hidden="true">
            {listen === 'listening' ? <span className="listen__bars"><i /><i /><i /><i /></span> : <SoundOn />}
          </span>
          <span className="listen__text">
            <strong>
              {listen === 'listening' ? 'Chachita te da la bienvenida' : listen === 'heard' ? 'Escuchar otra vez la bienvenida' : 'Escucha la bienvenida de Chachita'}
            </strong>
            <small>
              {listen === 'listening' ? (
                'Toca para pausar'
              ) : (
                <>
                  <span className="listen__desk">Haz clic para activar el sonido</span>
                  <span className="listen__touch">Toca para activar el sonido</span>
                </>
              )}
            </small>
          </span>
        </button>
      </div>
    </>
  );
}

/** Versión de los videos de transición: los archivos conservan su nombre y /media se guarda en caché
 *  un año, así que al recibir videos nuevos se cambia este valor para que el navegador los vuelva a pedir. */
const TRANSITIONS_VERSION = '2026-10-13';

/**
 * El mapa del recorrido en cada transición, para que la gente sepa dónde va: una línea fina con las paradas
 * (Inicio, Chorí, Atrato, Nuquí, Panguí, Mar). Lo ya andado se ve entero, el tramo de esta transición se recorre con un
 * punto que avanza, y lo que falta queda punteado.
 */
function RouteMap({ index }: { index: number }) {
  const route = transitions.filter((t) => t.number > 0);
  const stops = [route[0].from, ...route.map((t) => t.to)];
  const at = route.indexOf(transitions[index]);
  const gap = 46;
  const x = (i: number) => 8 + i * gap;
  const y = (i: number) => (i % 2 ? 22 : 12);
  const w = x(stops.length - 1) + 8;
  return (
    <figure className="route" aria-label={`Vas de ${stops[at]} a ${stops[at + 1]}`}>
      <svg width={w} height={34} viewBox={`0 0 ${w} 34`} aria-hidden="true">
        {stops.slice(1).map((_, i) => {
          const d = `M ${x(i)} ${y(i)} C ${x(i) + gap / 2} ${y(i)}, ${x(i + 1) - gap / 2} ${y(i + 1)}, ${x(i + 1)} ${y(i + 1)}`;
          return <path key={i} d={d} pathLength={1} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} />;
        })}
        {stops.map((_, i) => (
          <circle key={i} cx={x(i)} cy={y(i)} r={i === at + 1 ? 3.6 : 2.4} className={i <= at ? 'is-done' : i === at + 1 ? 'is-next' : ''} />
        ))}
      </svg>
      <figcaption>
        {stops[at]} <span aria-hidden="true">→</span> <strong>{stops[at + 1]}</strong>
      </figcaption>
    </figure>
  );
}

/**
 * Video de una transición, con su propio sonido. Empieza desde el inicio cada vez que se llega
 * a la transición y se pausa al salir. Si el navegador no permite sonido todavía (sin gesto del
 * visitante), se reproduce en silencio. Solo se descarga cuando la transición está cerca.
 */
function TransitionVideo({ id, playing, near, muted, shade, fit = 'cover' }: {
  id: string; playing: boolean; near: boolean; muted: boolean; shade: boolean;
  /** `contain`: el video completo, sin recortar, con su imagen de espera desenfocada llenando los bordes. */
  fit?: 'cover' | 'contain';
}) {
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
    <div className={`backdrop${fit === 'contain' ? ' backdrop--contain' : ''}`} aria-hidden="true" style={{ backgroundImage: `url(${poster})` }}>
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

const MapScreen = lazy(() => import('./MapScreen'));

/**
 * Cierre del recorrido: el mapa 3D, desde el planeta. El planeta se arma desde la página anterior (así, al bajar, ya
 * está ahí y la llegada es suave); la costa, solo al llegar. Todo se suelta al alejarse más de una página.
 */
function ClosingMap({ playing, near, onBack }: { playing: boolean; near: boolean; onBack: () => void }) {
  const [mounted, setMounted] = useState(near);
  useEffect(() => {
    if (!near) return setMounted(false);
    // Desde la página anterior, con un respiro: que primero arranque su video.
    const t = setTimeout(() => setMounted(true), playing ? 0 : 1500);
    return () => clearTimeout(t);
  }, [playing, near]);
  return (
    <div className="screen screen--closing" aria-label="Cierre · Mapa 3D">
      {mounted ? (
        <Suspense fallback={<p className="map-loading">Cargando el mapa…</p>}>
          <MapScreen embedded active={playing} onBack={onBack} />
        </Suspense>
      ) : (
        <p className="map-loading">Cargando el mapa…</p>
      )}
    </div>
  );
}
