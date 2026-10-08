// Mapa 3D de prueba (/mapa): la costa de Nuquí desde el mar, con los pueblos y sitios del afiche.
// Se carga bajo demanda para que three.js no pese en el resto del recorrido.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MapPlace } from '../../content/map';
import { TopBar } from '../components/Chrome';
import { MAP_TOWNS, createMapScene, type MapSceneHandle } from '../components/map/MapScene';

export default function MapScreen() {
  const stage = useRef<HTMLDivElement>(null);
  const handle = useRef<MapSceneHandle | null>(null);
  const [place, setPlace] = useState<MapPlace | null>(null);
  const [town, setTown] = useState('nuqui');
  const [hint, setHint] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Armar la escena toma un momento: primero se pinta el aviso de carga y luego se construye.
    let h: MapSceneHandle | null = null;
    let live = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!live) return;
      h = createMapScene(stage.current!, {
        onSelect: (p) => {
          setPlace(p);
          if (p?.kind === 'town') setTown(p.id);
        },
        onInteract: () => setHint(false),
      });
      handle.current = h;
      setReady(true);
    }));
    return () => {
      live = false;
      h?.dispose();
    };
  }, []);

  const goTown = (id: string) => {
    setTown(id);
    setHint(false);
    handle.current?.select(null);
    handle.current?.focus(id);
  };

  return (
    <main className="map-screen">
      <div ref={stage} className="map-stage" />
      <p className={`map-loading${ready ? ' is-hidden' : ''}`}>Cargando el mapa…</p>

      <TopBar
        label="Mapa · Nuquí, Chocó"
        right={
          <Link className="ghost-link" to="/">
            <span aria-hidden="true">←</span> Volver al recorrido
          </Link>
        }
      />

      {place && (
        <aside className="map-card" aria-live="polite">
          <button type="button" className="map-card__close" aria-label="Cerrar" onClick={() => handle.current?.select(null)}>
            ×
          </button>
          <p className="eyebrow">{place.kind === 'town' ? 'Pueblo' : place.kind === 'nature' ? 'Naturaleza del Pacífico' : `Cerca de ${place.near}`}</p>
          <h2 className="map-card__title">{place.name}</h2>
          {place.scientific && <p className="map-card__sci">{place.scientific}</p>}
          {place.handle && (
            <a className="map-card__handle" href={`https://www.instagram.com/${place.handle}/`} target="_blank" rel="noopener noreferrer">
              @{place.handle}
            </a>
          )}
        </aside>
      )}

      <p className={`map-hint${hint ? '' : ' is-hidden'}`}>Arrastra para recorrer la costa · rueda o pellizca para acercarte · toca un lugar</p>

      <nav className="map-towns tabs" aria-label="Pueblos de la costa, de norte a sur">
        {MAP_TOWNS.map((t) => (
          <button key={t.id} type="button" className={`tab${t.id === town ? ' is-active' : ''}`} onClick={() => goTown(t.id)}>
            {t.name}
          </button>
        ))}
      </nav>
    </main>
  );
}
