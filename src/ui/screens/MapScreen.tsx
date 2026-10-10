// Mapa 3D: el cierre del recorrido (última página del webdoc) y, aparte, la dirección de prueba. Empieza con el planeta Tierra (arte del afiche): solo el Chocó se puede tocar.
// Al tocarlo o acercarse, el planeta gira hasta Nuquí y baja; a mitad de camino el mapa de la costa sigue la misma
// bajada con el mismo encuadre y las dos escenas se funden, hasta quedar frente a la costa, desde el mar.
// Se carga bajo demanda para que three.js no pese en el resto del recorrido.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MapPlace } from '../../content/map';
import { EMBLEM_LABEL, type ChocoPoint } from '../../content/choco';
import { Arrow, TopBar } from '../components/Chrome';
import { LineIcon, type Origin } from '../components/Sheet';
import Shop from './Shop';
import StoryForm from './StoryForm';
import { createGlobe, type GlobeHandle } from '../components/map/GlobeScene';
import { createFlatGlobe } from '../components/map/FlatGlobe';
import { DIVE } from '../components/map/dive';
import { MAP_TOWNS, createMapScene, type MapSceneHandle } from '../components/map/MapScene';
import { QUALITY, TIER, TIER_LABEL, rememberCrash } from '../components/map/quality';
import { SOLO, lastSteps, step } from '../components/map/diag';

type Phase = 'loading' | 'globe' | 'diving' | 'landing' | 'map' | 'leaving';

const INVITE_SEEN = 'mapa-invitacion-vista';
const SPOT_KIND: Record<ChocoPoint['kind'], string> = {
  municipio: 'Municipio', corregimiento: 'Corregimiento', parque: 'Parque nacional', cerro: 'Cerro', playa: 'Playa', cabo: 'Cabo',
};
/** En equipos modestos, el planeta se suelta al llegar a la costa (y se vuelve a armar al regresar): así nunca están
 * las dos escenas 3D en memoria más que durante el cambio. */
const RELEASE_GLOBE = TIER === 'baja' || TIER === 'minima' || TIER === 'segura';

export default function MapScreen({ embedded = false, active = true, onBack }: {
  /** Dentro del recorrido (última página): ocupa su página y «Volver al recorrido» sube a la anterior. */
  embedded?: boolean;
  /** Dentro del recorrido, si su página es la visible. El planeta se arma desde la página anterior (para que la
   * llegada sea suave) pero la costa, que es lo pesado, solo cuando se llega. */
  active?: boolean;
  onBack?: () => void;
} = {}) {
  const stage = useRef<HTMLDivElement>(null);
  const globeStage = useRef<HTMLDivElement>(null);
  const handle = useRef<MapSceneHandle | null>(null);
  const globe = useRef<GlobeHandle | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [place, setPlace] = useState<MapPlace | null>(null);
  const [spot, setSpot] = useState<ChocoPoint | null>(null);
  const [town, setTown] = useState('nuqui');
  const [hint, setHint] = useState(true);
  const [pull, setPull] = useState(0);
  /** Lo que se abrió desde los íconos de la costa. La tienda y el formulario tapan el mapa: mientras tanto, se pausa. */
  const [panel, setPanel] = useState<'ayuda' | 'historia' | 'tienda' | null>(null);
  /** Dónde está el botón que abrió la tienda o el formulario: la hoja crece desde ahí. */
  const [origin, setOrigin] = useState<Origin | undefined>();
  useEffect(() => {
    const cover = panel === 'historia' || panel === 'tienda';
    handle.current?.setActive(!cover);
  }, [panel]);
  /** Dentro del recorrido: el visitante ya está jugando con el planeta (lo tocó o lo giró). Antes de eso, la rueda y
   * deslizar el dedo hacia abajo mueven la página, para poder volver a la historia; después, la rueda acerca el
   * planeta y baja al Chocó. */
  const [engaged, setEngagedState] = useState(!embedded);
  const engagedRef = useRef(!embedded);
  const setEngaged = (on: boolean) => {
    engagedRef.current = on || !embedded;
    setEngagedState(on || !embedded);
  };
  const activeRef = useRef(active);
  /** La costa se arma cuando la página es la visible (ver `active`). */
  const wantMap = useRef<(() => void) | null>(null);
  useEffect(() => {
    activeRef.current = active;
    if (!active) setEngaged(false);
    if (active && wantMap.current) {
      wantMap.current();
      wantMap.current = null;
    }
  }, [active]);
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

  // Dirección de prueba: que los buscadores no la indexen.
  useEffect(() => {
    if (embedded) return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [embedded]);

  useEffect(() => {
    // Primero el planeta (lo que se ve al entrar) y, cuando ya está listo, la costa se arma por detrás, en pausa, sin
    // congelar la página: así se puede girar el planeta mientras tanto y la llegada es inmediata.
    let live = true;
    let map: Promise<MapSceneHandle> | null = null;
    let earth: GlobeHandle | null = null;
    const buildMap = () =>
      createMapScene(stage.current!, {
        // Probando solo la costa (?solo=costa): arranca andando, sin esperar al planeta.
        paused: SOLO !== 'costa',
        onSelect: (p) => {
          setPlace(p);
          if (p?.kind === 'town') setTown(p.id);
        },
        onInteract: () => setHint(false),
        onZoomOut: () => leave.current(),
        onPull: setPull,
        onSpot: setSpot,
        onLost,
      }).then((m) => {
        handle.current = m;
        return m;
      });
    makeGlobe.current = () =>
      new Promise<GlobeHandle>((resolve) => {
        // En la versión 5 el planeta es un dibujo plano: una sola escena 3D en la página (la costa).
        const g = (QUALITY.flatGlobe ? createFlatGlobe : createGlobe)(globeStage.current!, {
          onReady: () => {
            if (!live) return;
            resolve(g);
            // La primera vez: se muestra el planeta y se empieza a armar la costa (salvo si se prueba solo el planeta),
            // en cuanto su página sea la visible.
            if (!map && !wantMap.current) {
              setPhase('globe');
              if (SOLO === 'planeta') return;
              const start = () => {
                if (live) map ??= buildMap();
              };
              if (activeRef.current) start();
              else wantMap.current = start;
            }
          },
          onLost,
          wheelGate: () => engagedRef.current,
          onDive: () => {
            step('bajando');
            setPhase('diving');
          },
          onHandoff: (handoff) => {
            // El mapa sigue bajando desde donde va el planeta; el planeta se desvanece encima y luego deja de dibujarse
            // (o se suelta del todo, en equipos modestos). Si la costa aún se está armando, la llegada la espera.
            if (SOLO === 'planeta') return step('planeta: llegó (sin costa)');
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
      if (!live) return;
      if (SOLO !== 'costa') {
        globeReady.current = makeGlobe.current();
        return;
      }
      // Probando solo la costa: sin planeta.
      map = buildMap();
      void map.then(() => live && setPhase('map'));
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
        setEngaged(false);
        setTimeout(() => handle.current?.setActive(false), DIVE.fade * 1000 + 400);
      });
    });
  };

  const onMap = phase === 'map';
  const closePanel = () => setPanel(null);

  return (
    // En el recorrido, la costa usa las flechas del teclado (no pasan de página: ver `data-no-arrows`); en el planeta,
    // las flechas siguen moviendo el recorrido.
    <div
      className={`map-screen is-${phase}${embedded ? ' map-screen--embedded' : ''}${engaged ? ' is-engaged' : ''}`}
      data-no-arrows={(embedded && phase !== 'globe' && phase !== 'loading') || undefined}
    >
      <div ref={stage} className="map-stage" />
      {/* Tocar o girar el planeta (sin deslizar la página) es la señal de que se quiere explorar. */}
      <div ref={globeStage} className="globe-stage" aria-hidden={onMap} onPointerUp={() => phase === 'globe' && setEngaged(true)} />
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
          <p className="map-lost__diag">{TIER_LABEL}</p>
          <p className="map-lost__diag">{lastSteps()}</p>
        </div>
      )}

      {/* Título como el del afiche, sobre el planeta. */}
      <div className="globe-title" aria-hidden={onMap}>
        <p className="poster-title">
          <span className="poster-title__big">Nuquí</span>
          <span className="poster-title__script">Chocó</span>
        </p>
        {invite && <p className="globe-title__hint">El sol se está poniendo sobre Nuquí. Toca el Chocó y baja a la costa.</p>}
        {embedded && (
          <p className="globe-title__gate">
            {engaged ? 'Acércate con la rueda o pellizca para bajar a Nuquí' : 'Toca el planeta para explorarlo · sube para volver a la historia'}
          </p>
        )}
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
            {onBack ? (
              // La misma flecha de «Sigue bajando» del recorrido, hacia arriba.
              <button type="button" className="ghost-link ghost-link--back" onClick={onBack}>
                <Arrow dir="up" /> Volver al recorrido
              </button>
            ) : (
              <Link className="ghost-link" to="/">
                <span aria-hidden="true">←</span> Volver al recorrido
              </Link>
            )}
          </>
        }
      />

      {onMap && spot && !place && (
        <aside className="map-card map-card--spot" aria-live="polite">
          <div className="map-card__head">
            <p className="eyebrow">{spot.story ? `Historia · ${EMBLEM_LABEL[spot.story]}` : `${spot.subregion} · ${SPOT_KIND[spot.kind]}`}</p>
            <h2 className="map-card__title">{spot.name}</h2>
          </div>
          {!spot.story && spot.municipio && spot.municipio !== spot.name && (
            <p className="map-card__sci">{spot.kind === 'municipio' ? 'Cabecera de' : 'Municipio de'} {spot.municipio}</p>
          )}
          {spot.info && <p className="map-card__info">{spot.info}</p>}
          <button type="button" className="map-card__back" onClick={() => handle.current?.select(null)}>
            <Arrow dir="left" /> Volver a la costa
          </button>
          <button type="button" className="map-card__close" aria-label="Cerrar" onClick={() => handle.current?.select(null)}>
            ×
          </button>
        </aside>
      )}
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
          <button type="button" className="map-card__back" onClick={() => handle.current?.select(null)}>
            <Arrow dir="left" /> Volver a la costa
          </button>
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
          <p className={`map-hint${hint && !place ? '' : ' is-hidden'}`}>Arrastra para recorrer la costa · rueda o pellizca para acercarte · toca un lugar</p>
          {/* Ayuda, contar una historia y la tienda: en la barra de abajo, con la letra de los pueblos. */}
          <nav className="map-tools" aria-label="Más del mapa">
            {([
              ['ayuda', 'help', 'Ayuda', 'Cómo moverte por el mapa y qué hay en cada lugar.'],
              ['historia', 'story', 'Tu historia', 'Un espacio para contar algo que viviste en el Chocó —escrito o con tu voz— y que aparezca en el mapa, en su lugar.'],
              ['tienda', 'shop', 'Tienda', 'Afiches, postales y objetos del recorrido para llevarte un pedazo del Pacífico.'],
            ] as const).map(([id, icon, label, tip]) => (
              <button
                key={id}
                type="button"
                className={`tab map-tool${panel === id ? ' is-active' : ''}`}
                onClick={(e) => {
                  const b = e.currentTarget.getBoundingClientRect();
                  const host = e.currentTarget.closest('.map-screen')!.getBoundingClientRect();
                  setOrigin({ x: b.left + b.width / 2 - host.left, y: b.top + b.height / 2 - host.top });
                  setPanel(panel === id ? null : id);
                }}
                aria-pressed={panel === id}
              >
                <LineIcon name={icon} size={16} />
                <span>{label}</span>
                <span className="map-tool__tip" aria-hidden="true"><strong>{label}</strong>{tip}</span>
              </button>
            ))}
          </nav>
          {panel === 'ayuda' && (
            <aside className="map-help" aria-label="Ayuda">
              <p className="eyebrow">Cómo moverse</p>
              <ul>
                <li><strong>Arrastra</strong> para recorrer la costa, de Jurubidá a Coquí.</li>
                <li><strong>Rueda o pellizca</strong> para acercarte; sigue alejándote para volver al planeta.</li>
                <li><strong>Toca un lugar</strong> o un animal para saber qué es.</li>
                <li>Abajo, <strong>los pueblos</strong> te llevan directo a cada uno.</li>
              </ul>
              <p className="eyebrow">También</p>
              <ul>
                <li><strong>Tu historia:</strong> cuéntanos algo que viviste en el Chocó y aparecerá en el mapa.</li>
                <li><strong>Tienda:</strong> lleva un pedazo del Pacífico.</li>
              </ul>
              <button type="button" className="map-card__close" aria-label="Cerrar ayuda" onClick={closePanel}>×</button>
            </aside>
          )}
          <nav className="map-towns tabs" aria-label="Pueblos de la costa, de norte a sur">
            {MAP_TOWNS.map((t) => (
              <button key={t.id} type="button" className={`tab${t.id === town ? ' is-active' : ''}`} onClick={() => goTown(t.id)}>
                {t.name}
              </button>
            ))}
          </nav>
        </>
      )}
      {onMap && panel === 'historia' && <StoryForm onClose={closePanel} origin={origin} />}
      {onMap && panel === 'tienda' && <Shop onClose={closePanel} origin={origin} />}
    </div>
  );
}
