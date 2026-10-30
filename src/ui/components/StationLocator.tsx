// Mapa de ubicación de la estación (pedido del cliente, 19/10/2026): en línea blanca y fondo transparente, con un punto
// por estación: la de la página, grande y con su nombre; las demás, pequeñas.
// - Las estaciones de Nuquí (Chorí, Nuquí, Panguí): el mapa de Nuquí del cliente (30/10/2026, scripts/map-nuqui.mjs) y,
//   en la esquina libre, el Chocó con Nuquí en dorado.
// - Quibdó (el Atrato) queda fuera de Nuquí: el Chocó grande con sus municipios y, en una esquina, Colombia
//   (scripts/map-locator.mjs).

import { LOCATOR } from '../../content/map-locator';
import { NUQUI } from '../../content/map-nuqui';
import { stations } from '../../content/journey';
import type { Station } from '../../domain/types';

/** Dónde va la caja de Colombia, arriba a la derecha (unidades del mapa). */
const INSET_X = LOCATOR.width - LOCATOR.inset.width - 2;
const INSET_Y = 2;

/** ¿Queda dentro del mapa de Nuquí? */
const inNuqui = (s: Station) => {
  const [x, y] = NUQUI.at(s.where.lat, s.where.lon);
  return x >= 0 && y >= 0 && x <= NUQUI.width && y <= NUQUI.height;
};

/** El Chocó pequeño junto al mapa de Nuquí: escala sobre las unidades de LOCATOR. */
const CHOCO_SCALE = 0.17;

export function StationLocator({ station }: { station: Station }) {
  return inNuqui(station) ? <NuquiLocator station={station} /> : <ChocoLocator station={station} />;
}

function Here({ station, at, width }: { station: Station; at: [number, number]; width: number }) {
  const [x, y] = at;
  // El nombre va al lado de la tierra (al este), salvo que se salga del mapa.
  const left = x > width - 70;
  return (
    <g className="locator__here" transform={`translate(${x} ${y})`}>
      <circle className="locator__pulse" r={6} />
      <circle className="locator__dot" r={4.2} />
      <text className="locator__label" x={left ? -10 : 10} y={-4} textAnchor={left ? 'end' : 'start'}>
        <tspan x={left ? -10 : 10}>Estación {station.number}</tspan>
        <tspan x={left ? -10 : 10} dy="1.25em">{station.place}</tspan>
      </text>
    </g>
  );
}

function NuquiLocator({ station }: { station: Station }) {
  return (
    <figure className="locator locator--nuqui" aria-label={`Mapa: la estación ${station.number} queda en ${station.place}, Nuquí, Chocó`}>
      <svg viewBox={`-4 -4 ${NUQUI.width + 8} ${NUQUI.height + 32}`} aria-hidden="true">
        <path className="locator__choco" d={NUQUI.outline} />
        {/* El nombre, debajo de la tierra: dentro chocaba con el de la estación. */}
        <text className="locator__name" x={NUQUI.width * 0.4} y={NUQUI.height + 22} textAnchor="middle">Nuquí</text>

        <g transform={`translate(2 2) scale(${CHOCO_SCALE})`}>
          <path className="locator__inset-outline" d={LOCATOR.choco} />
          <path className="locator__inset-choco" d={LOCATOR.nuqui} />
        </g>
        <text className="locator__small" x={2 + (LOCATOR.width * CHOCO_SCALE) / 2} y={LOCATOR.height * CHOCO_SCALE + 14} textAnchor="middle">Chocó</text>

        {stations.filter((s) => s.id !== station.id && inNuqui(s)).map((s) => {
          const [sx, sy] = NUQUI.at(s.where.lat, s.where.lon);
          return <circle key={s.id} className="locator__other" cx={sx} cy={sy} r={2.6} />;
        })}
        <Here station={station} at={NUQUI.at(station.where.lat, station.where.lon)} width={NUQUI.width} />
      </svg>
    </figure>
  );
}

function ChocoLocator({ station }: { station: Station }) {
  return (
    <figure className="locator" aria-label={`Mapa: la estación ${station.number} queda en ${station.place}, Chocó, Colombia`}>
      <svg viewBox={`-4 -4 ${LOCATOR.width + 8} ${LOCATOR.height + 8}`} aria-hidden="true">
        <path className="locator__municipios" d={LOCATOR.municipios} />
        <path className="locator__nuqui" d={LOCATOR.nuqui} />
        <path className="locator__choco" d={LOCATOR.choco} />
        <text className="locator__name" x={LOCATOR.width * 0.62} y={LOCATOR.height * 0.47}>Chocó</text>
        <text className="locator__small" x={LOCATOR.nuquiLabel[0] - 8} y={LOCATOR.nuquiLabel[1] - 22} textAnchor="end">Nuquí</text>

        <g transform={`translate(${INSET_X} ${INSET_Y})`}>
          <rect className="locator__box" x={-3} y={-3} width={LOCATOR.inset.width + 6} height={LOCATOR.inset.height + 6} rx={2} />
          <path className="locator__colombia" d={LOCATOR.inset.colombia} />
          <path className="locator__inset-choco" d={LOCATOR.inset.choco} />
          <text className="locator__small" x={LOCATOR.inset.width / 2} y={LOCATOR.inset.height + 12} textAnchor="middle">Colombia</text>
        </g>

        {stations.filter((s) => s.id !== station.id).map((s) => {
          const [sx, sy] = LOCATOR.at(s.where.lat, s.where.lon);
          return <circle key={s.id} className="locator__other" cx={sx} cy={sy} r={2.6} />;
        })}
        <Here station={station} at={LOCATOR.at(station.where.lat, station.where.lon)} width={LOCATOR.width} />
      </svg>
    </figure>
  );
}
