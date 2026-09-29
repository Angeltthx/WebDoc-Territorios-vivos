import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { closing, getStation, stations, transitions, welcome } from '../../content/journey';
import { pages, type PageSpec } from '../../content/pages';
import { pagePath, TOTAL_PAGES, usePageGestures, usePages } from '../../application/journey';
import { isMuted, playWater, setMuted } from '../../application/sound';
import { Backdrop } from '../components/Media';
import { Arrow, ChachitaTag, GuideButton, PageArrows, PageTabs, STATION_PAGE, StationGuide, TopBar, TransitionSymbol } from '../components/Chrome';
import { GalleryPanel, QuotePanel, RecipePanel, SilencePanel, SongsPanel, VideoPanel } from '../components/Sections';

/** El webdoc: una página del PDF a la vez, a pantalla completa. */
export function Webdoc() {
  const { page, next, prev, goTo } = usePages();
  const [guideOpen, setGuideOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  // Página que sale: se mantiene debajo mientras la nueva entra con el borde de ola.
  const [leaving, setLeaving] = useState<{ page: number; dir: 'next' | 'prev' } | null>(null);
  const shown = useRef(page);

  usePageGestures(next, prev);

  useEffect(() => {
    const before = shown.current;
    shown.current = page;
    if (!page || !before || before === page) return;
    setLeaving({ page: before, dir: page > before ? 'next' : 'prev' });
    playWater();
    const t = window.setTimeout(() => setLeaving(null), 1300);
    return () => window.clearTimeout(t);
  }, [page]);

  const toggleSound = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  useEffect(() => {
    if (page) document.title = `Territorios Vivos · ${page} / ${TOTAL_PAGES}`;
  }, [page]);

  // Precarga ligera de la página siguiente para que el paso sea inmediato.
  useEffect(() => {
    if (!page || page >= TOTAL_PAGES) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `/media/${nextImage(pages[page])}-sm.webp`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [page]);

  if (page === null) return <Navigate to="/" replace />;

  const view = (n: number) => <PageView spec={pages[n - 1]} onStart={next} goTo={goTo} openGuide={() => setGuideOpen(true)} />;
  return (
    <main className="webdoc">
      {leaving && (
        <div className="page page--leaving" key={`out-${leaving.page}`} aria-hidden="true" inert>
          {view(leaving.page)}
        </div>
      )}
      <div className={`page${leaving ? ` page--enter page--enter-${leaving.dir}` : ''}`} key={page}>
        {view(page)}
        {leaving && <div className={`water-veil water-veil--${leaving.dir}`} aria-hidden="true" />}
      </div>
      <PageArrows page={page} total={TOTAL_PAGES} onPrev={prev} onNext={next} />
      <button
        type="button"
        className="sound-toggle"
        onClick={toggleSound}
        aria-pressed={!muted}
        aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
        title={muted ? 'Activar sonido' : 'Silenciar sonido'}
      >
        {muted ? <SoundOff /> : <SoundOn />}
      </button>
      <StationGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </main>
  );
}

function nextImage(spec: PageSpec): string {
  switch (spec.kind) {
    case 'quote': return getStation(spec.station)!.quote.portrait.id;
    case 'gallery': return getStation(spec.station)!.gallery!.background.id;
    case 'video': return spec.video.poster?.id ?? welcome.background.id;
    case 'transition': return transitions[spec.index].background?.id ?? welcome.background.id;
    case 'silence': return getStation('pangui')!.silence!.photo.id;
    case 'songs': return getStation('pangui')!.songs!.background.id;
    case 'recipe': return getStation('chori')!.recipe!.hero.id;
    default: return closing.background.id;
  }
}

function PageView({ spec, onStart, goTo, openGuide }: {
  spec: PageSpec;
  onStart: () => void;
  goTo: (n: number) => void;
  openGuide: () => void;
}) {
  switch (spec.kind) {
    case 'welcome':
      return (
        <section className="screen screen--welcome" aria-labelledby="wt">
          <PortadaVideo />
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
            <button type="button" className="start-btn" onClick={onStart}>
              Comenzar el viaje
              <Arrow dir="down" />
            </button>
          </div>
        </section>
      );

    case 'quote': {
      const st = getStation(spec.station)!;
      return (
        <section className="screen" aria-label={spec.label}>
          <div className="screen__content"><QuotePanel station={st} /></div>
          <TopBar label={spec.label} right={<GuideButton onOpen={openGuide} />} />
          <footer className="page-foot"><PageTabs tabs={spec.tabs} /></footer>
        </section>
      );
    }

    case 'video':
      return (
        <section className="screen" aria-label={spec.label}>
          <div className="screen__content"><VideoPanel video={spec.video} bar={spec.bar} /></div>
          <TopBar
            label={spec.label}
            right={spec.closeTo && (
              <button type="button" className="icon-btn icon-btn--bare" aria-label="Cerrar video" onClick={() => goTo(spec.closeTo!)}>✕</button>
            )}
          />
          {spec.tabs && <footer className="page-foot"><PageTabs tabs={spec.tabs} /></footer>}
        </section>
      );

    case 'gallery': {
      const gallery = getStation(spec.station)!.gallery!;
      return (
        <section className="screen" aria-label={spec.label}>
          <div className="screen__content"><GalleryPanel gallery={gallery} /></div>
          <TopBar plain label={spec.label} />
          <footer className="page-foot">
            <PageTabs tabs={spec.tabs} />
            <p className="page-foot__note">{gallery.intro.toLowerCase()} · deslizar →</p>
          </footer>
        </section>
      );
    }

    case 'recipe':
      return (
        <section className="screen" aria-label={spec.label}>
          <div className="screen__content"><RecipePanel recipe={getStation('chori')!.recipe!} /></div>
          <TopBar label={spec.label} />
          <footer className="page-foot"><PageTabs tabs={spec.tabs} /></footer>
        </section>
      );

    case 'transition': {
      const t = transitions[spec.index];
      const onPhoto = !!t.background;
      return (
        <section className="screen screen--transition" style={{ background: t.color }} aria-label={`Transición ${t.number}: de ${t.from} a ${t.to}`}>
          {t.background && <Backdrop photo={t.background} tint={t.tint} />}
          {t.color && <div className="rain" aria-hidden="true" />}
          <TopBar plain={onPhoto} label={<>Transición {t.number} · {t.from} → {t.to}</>} right={<ChachitaTag plain={onPhoto} />} />
          <div className="transition">
            <TransitionSymbol kind={t.symbol} />
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
        </section>
      );
    }

    case 'silence':
      return (
        <section className="screen" aria-label={spec.label}>
          <div className="screen__content"><SilencePanel silence={getStation('pangui')!.silence!} /></div>
          <TopBar label={spec.label} />
        </section>
      );

    case 'songs':
      return (
        <section className="screen" aria-label={spec.label}>
          <div className="screen__content"><SongsPanel songs={getStation('pangui')!.songs!} /></div>
          <TopBar plain label={spec.label} />
          <footer className="page-foot"><PageTabs tabs={spec.tabs} /></footer>
        </section>
      );

    case 'closing':
      return <ClosingPage goTo={goTo} />;
  }
}

/** Video de fondo de la portada (Panguí). Silenciado para que el navegador permita la reproducción automática. */
function PortadaVideo() {
  const small = window.matchMedia('(max-width: 900px)').matches;
  return (
    <div className="backdrop" aria-hidden="true" style={{ backgroundImage: 'url(/media/video/portada-poster.webp)' }}>
      <video
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

function SoundOn() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8v4h3l4 3V5L6 8Z" />
      <path d="M13 7.5c1.2 1.4 1.2 3.6 0 5M15.5 5.5c2.3 2.6 2.3 6.4 0 9" />
    </svg>
  );
}

function SoundOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8v4h3l4 3V5L6 8Z" />
      <path d="m13 8 4 4m0-4-4 4" />
    </svg>
  );
}

const PIN_COLORS = ['#ffffff', '#5fc7a2', '#8fbf5a', '#8cb8ee'];

function ClosingPage({ goTo }: { goTo: (n: number) => void }) {
  const [soon, setSoon] = useState(false);
  return (
    <section className="screen screen--closing" aria-labelledby="closing-title">
      <TopBar label="Cierre · Mapa 3D" right={<ChachitaTag />} />
      <div className="closing">
        <p className="closing__quote">volver a las raíces</p>
        <p className="closing__by">— Chachita</p>
        <h2 id="closing-title">¿cuál es tu río?</h2>
        <div className="closing__map">
          <div className="closing__lake" aria-hidden="true" />
          {stations.map((s, i) => (
            <Link
              key={s.id}
              to={pagePath(STATION_PAGE[s.id])}
              className={`closing__pin closing__pin--${i + 1}`}
              style={{ background: PIN_COLORS[i] }}
              aria-label={`Estación ${s.number}: ${s.name}, ${s.place}`}
            >
              <span />
            </Link>
          ))}
        </div>
      </div>
      <div className="closing__actions">
        {soon && <p className="notice" role="status">Aportar historias llegará en una fase posterior.</p>}
        <button type="button" className="btn btn--dark" onClick={() => goTo(1)}>↻ volver a empezar</button>
        <button type="button" className="btn btn--light" onClick={() => setSoon(true)}>+ aportar tu historia</button>
      </div>
    </section>
  );
}
