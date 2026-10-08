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

type Phase = 'loading' | 'globe' | 'diving' | 'landing' | 'map' | 'leaving';

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

  useEffect(() => {
    // Armar las escenas toma un momento: primero se pinta el aviso de carga y luego se construyen.
    // La costa queda lista (en pausa) detrás del planeta, para que la llegada sea inmediata.
    let live = true;
    let map: MapSceneHandle | null = null;
    let earth: GlobeHandle | null = null;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!live) return;
      map = createMapScene(stage.current!, {
        paused: true,
        onSelect: (p) => {
          setPlace(p);
          if (p?.kind === 'town') setTown(p.id);
        },
        onInteract: () => setHint(false),
        onZoomOut: () => leave.current(),
        onPull: setPull,
      });
      earth = createGlobe(globeStage.current!, {
        onDive: () => setPhase('diving'),
        onHandoff: (handoff) => {
          // El mapa sigue bajando desde donde va el planeta; el planeta se desvanece encima y luego deja de dibujarse.
          map?.land(handoff, () => setPhase('map'));
          setPhase('landing');
          setTimeout(() => earth?.setActive(false), DIVE.fade * 1000 + 200);
        },
      });
      handle.current = map;
      globe.current = earth;
      setPhase('globe');
    }));
    return () => {
      live = false;
      map?.dispose();
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
    handle.current?.ascend(() => {
      globe.current?.setActive(true);
      globe.current?.ascend();
      setPhase('globe');
      setTimeout(() => handle.current?.setActive(false), DIVE.fade * 1000 + 400);
    });
  };

  const onMap = phase === 'map';

  return (
    <main className={`map-screen is-${phase}`}>
      <div ref={stage} className="map-stage" />
      <div ref={globeStage} className="globe-stage" aria-hidden={onMap} />
      <p className={`map-loading${phase !== 'loading' ? ' is-hidden' : ''}`}>Cargando el mapa…</p>

      {/* Título como el del afiche, sobre el planeta. */}
      <div className="globe-title" aria-hidden={onMap}>
        <p className="poster-title">
          <span className="poster-title__big">Nuquí</span>
          <span className="poster-title__script">Chocó</span>
        </p>
        <p className="globe-title__hint">Toca el Chocó o acércate para entrar</p>
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
