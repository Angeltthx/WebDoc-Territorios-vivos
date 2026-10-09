// Mapa 3D de prueba (/mapa). Empieza con el planeta Tierra (arte del afiche): solo el Chocó se puede tocar.
// Al tocarlo o acercarse, el planeta gira hasta Nuquí y baja; a mitad de camino el mapa de la costa sigue la misma
// bajada con el mismo encuadre y las dos escenas se funden, hasta quedar frente a la costa, desde el mar.
// Se carga bajo demanda para que three.js no pese en el resto del recorrido.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MapPlace } from '../../content/map';
import { TopBar } from '../components/Chrome';
import { createGlobe, type GlobeHandle } from '../components/map/GlobeScene';
import { DIVE } from '../components/map/dive';
import { MAP_TOWNS, createMapScene, type MapSceneHandle } from '../components/map/MapScene';
import { TIER, TIER_REASONS, rememberCrash } from '../components/map/quality';

type Phase = 'loading' | 'globe' | 'diving' | 'landing' | 'map' | 'leaving';

const INVITE_SEEN = 'mapa-invitacion-vista';
/** En equipos modestos, el planeta se suelta al llegar a la costa (y se vuelve a armar al regresar): así nunca están
 * las dos escenas 3D en memoria más que durante el cambio. */
const RELEASE_GLOBE = TIER === 'baja' || TIER === 'minima';

export default function MapScreen() {
  const stage = useRef<HTMLDivElement>(null);
  const globeStage = useRef<HTMLDivElement>(null);
  const handle = useRef<MapSceneHandle | null>(null);
  const globe = useRef<GlobeHandle | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [place, setPlace] = useState<MapPlace | null>(null);
  const [town, setTown] = useState('nuqui');
  const [hint, setHint] = useState(true);
  const [pull, setPull] = useState(0);
  /** El navegador quitó el 3D: se reintenta un nivel más liviano o, si ya era el mínimo, se avisa. */
  const [lost, setLost] = useState<'retry' | 'final' | null>(null);
  const onLost = () => {
    if (rememberCrash()) {
      setLost('retry');
      setTimeout(() => location.reload(), 1200);
    } else setLost('final');
  };
  /** El planeta listo para usar (se vuelve a armar si se soltó, ver RELEASE_GLOBE). */
  const globeReady = useRef<Promise<GlobeHandle> | null>(null);
  const makeGlobe = useRef<() => Promise<GlobeHandle>>(() => Promise.reject(new Error('sin planeta')));
  // La invitación a bajar solo aparece la primera vez: después de entrar una vez, ya no se repite.
  const [invite, setInvite] = useState(() => {
    try {
      return !localStorage.getItem(INVITE_SEEN);
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (phase !== 'diving' || !invite) return;
    setInvite(false);
    try {
      localStorage.setItem(INVITE_SEEN, '1');
    } catch {
      // Sin almacenamiento: se volverá a ver la próxima vez, no pasa nada.
    }
  }, [phase, invite]);

  // Página de prueba: que los buscadores no la indexen.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    // Primero el planeta (lo que se ve al entrar) y, cuando ya está listo, la costa se arma por detrás, en pausa, sin
    // congelar la página: así se puede girar el planeta mientras tanto y la llegada es inmediata.
    let live = true;
    let map: Promise<MapSceneHandle> | null = null;
    let earth: GlobeHandle | null = null;
    const buildMap = () =>
      createMapScene(stage.current!, {
        paused: true,
        onSelect: (p) => {
          setPlace(p);
          if (p?.kind === 'town') setTown(p.id);
        },
        onInteract: () => setHint(false),
        onZoomOut: () => leave.current(),
        onPull: setPull,
        onLost,
      }).then((m) => {
        handle.current = m;
        return m;
      });
    makeGlobe.current = () =>
      new Promise<GlobeHandle>((resolve) => {
        const g = createGlobe(globeStage.current!, {
          onReady: () => {
            if (!live) return;
            resolve(g);
            // La primera vez: se muestra el planeta y se empieza a armar la costa.
            if (!map) {
              setPhase('globe');
              map = buildMap();
            }
          },
          onLost,
          onDive: () => setPhase('diving'),
          onHandoff: (handoff) => {
            // El mapa sigue bajando desde donde va el planeta; el planeta se desvanece encima y luego deja de dibujarse
            // (o se suelta del todo, en equipos modestos). Si la costa aún se está armando, la llegada la espera.
            void (map ??= buildMap()).then((m) => {
              if (!live) return;
              m.land(handoff, () => setPhase('map'));
              setPhase('landing');
              setTimeout(() => {
                if (!RELEASE_GLOBE) return g.setActive(false);
                g.dispose();
                if (earth === g) earth = globe.current = globeReady.current = null;
              }, DIVE.fade * 1000 + 200);
            });
          },
        });
        earth = g;
        globe.current = g;
      });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (live) globeReady.current = makeGlobe.current();
    }));
    return () => {
      live = false;
      void map?.then((m) => m.dispose());
      earth?.dispose();
    };
  }, []);

  const goTown = (id: string) => {
    setTown(id);
    setHint(false);
    handle.current?.select(null);
    handle.current?.focus(id);
  };

  // Vuelta al planeta (con «Ver el planeta» o al alejarse mucho): el mapa sube y, a la altura de la posta, el planeta
  // aparece encima y sigue subiendo. Va en una referencia porque el mapa la llama desde su propio bucle.
  const leave = useRef(() => {});
  leave.current = () => {
    if (phase !== 'map') return;
    setPull(0);
    setPhase('leaving');
    // Si el planeta se soltó al llegar, se vuelve a armar mientras la costa sube.
    const ready = (globeReady.current ??= makeGlobe.current());
    handle.current?.ascend(() => {
      void ready.then((g) => {
        g.setActive(true);
        g.ascend();
        setPhase('globe');
        setTimeout(() => handle.current?.setActive(false), DIVE.fade * 1000 + 400);
      });
    });
  };

  const onMap = phase === 'map';

  return (
    <main className={`map-screen is-${phase}`}>
      <div ref={stage} className="map-stage" />
      <div ref={globeStage} className="globe-stage" aria-hidden={onMap} />
      <p className={`map-loading${phase !== 'loading' ? ' is-hidden' : ''}`}>Cargando el mapa…</p>
      {lost === 'retry' && (
        <div className="map-lost" role="status">
          <p>Ajustando el mapa a tu teléfono…</p>
        </div>
      )}
      {lost === 'final' && (
        <div className="map-lost" role="alert">
          <p>Este equipo se quedó sin memoria para el mapa 3D.</p>
          <p className="map-lost__hint">Cierra otras pestañas o aplicaciones y vuelve a intentarlo.</p>
          <button type="button" className="btn btn--dark" onClick={() => location.reload()}>↻ Volver a intentar</button>
          <Link className="ghost-link" to="/">← Volver al recorrido</Link>
          {/* Para diagnosticar: qué nivel se usó y por qué (una captura de esto basta). */}
          <p className="map-lost__diag">{[TIER, ...TIER_REASONS].join(' · ')}</p>
        </div>
      )}

      {/* Título como el del afiche, sobre el planeta. */}
      <div className="globe-title" aria-hidden={onMap}>
        <p className="poster-title">
          <span className="poster-title__big">Nuquí</span>
          <span className="poster-title__script">Chocó</span>
        </p>
        {invite && <p className="globe-title__hint">El sol se está poniendo sobre Nuquí. Toca el Chocó y baja a la costa.</p>}
      </div>

      <TopBar
        plain
        label={onMap ? 'Mapa · Nuquí, Chocó' : 'Mapa · Pacífico colombiano'}
        right={
          <>
            {onMap && (
              <button type="button" className="ghost-link" onClick={() => leave.current()}>
                <span aria-hidden="true">◍</span> Ver el planeta
              </button>
            )}
            <Link className="ghost-link" to="/">
              <span aria-hidden="true">←</span> Volver al recorrido
            </Link>
          </>
        }
      />

      {onMap && place && (
        <aside className={`map-card map-card--${place.kind}`} aria-live="polite">
          <div className="map-card__head">
            <p className="eyebrow">{place.kind === 'town' ? 'Pueblo' : place.kind === 'nature' ? 'Naturaleza del Pacífico' : `Cerca de ${place.near}`}</p>
            <h2 className="map-card__title">{place.name}</h2>
          </div>
          {place.scientific && <p className="map-card__sci">{place.scientific}</p>}
          {place.handle && (
            <p className="map-card__body">
              <a className="map-card__handle" href={`https://www.instagram.com/${place.handle}/`} target="_blank" rel="noopener noreferrer">
                @{place.handle}
              </a>
            </p>
          )}
          <button type="button" className="map-card__close" aria-label="Cerrar" onClick={() => handle.current?.select(null)}>
            ×
          </button>
        </aside>
      )}

      {onMap && (
        <>
          <p className="map-pull" style={{ opacity: Math.min(1, pull * 3) }} aria-hidden={pull === 0}>
            Sigue alejándote para ver el planeta
            <span className="map-pull__bar" style={{ transform: `scaleX(${pull})` }} />
          </p>
          <p className={`map-hint${hint ? '' : ' is-hidden'}`}>Arrastra para recorrer la costa · rueda o pellizca para acercarte · toca un lugar</p>
          <nav className="map-towns tabs" aria-label="Pueblos de la costa, de norte a sur">
            {MAP_TOWNS.map((t) => (
              <button key={t.id} type="button" className={`tab${t.id === town ? ' is-active' : ''}`} onClick={() => goTown(t.id)}>
                {t.name}
              </button>
            ))}
          </nav>
        </>
      )}
    </main>
  );
}
