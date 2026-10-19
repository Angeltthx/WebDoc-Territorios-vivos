// Mapa de ubicación de la estación (pedido del cliente, 19/10/2026): en línea blanca y fondo transparente, el Chocó
// grande con sus municipios, Nuquí resaltado y, en una esquina, Colombia con el Chocó. Encima, un punto por estación:
// la de la página, grande y con su nombre; las demás, pequeñas. Es un muestrario mientras llega el mapa del cliente
// (los trazos salen de scripts/map-locator.mjs).

import { LOCATOR } from '../../content/map-locator';
import { stations } from '../../content/journey';
import type { Station } from '../../domain/types';

/** Dónde va la caja de Colombia, arriba a la derecha (unidades del mapa). */
const INSET_X = LOCATOR.width - LOCATOR.inset.width - 2;
const INSET_Y = 2;

export function StationLocator({ station }: { station: Station }) {
  const [x, y] = LOCATOR.at(station.where.lat, station.where.lon);
  // El nombre va al lado de la tierra (al este), salvo que se salga del mapa.
  const left = x > LOCATOR.width - 70;
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
        <g className="locator__here" transform={`translate(${x} ${y})`}>
          <circle className="locator__pulse" r={6} />
          <circle className="locator__dot" r={4.2} />
          <text className="locator__label" x={left ? -10 : 10} y={-4} textAnchor={left ? 'end' : 'start'}>
            <tspan x={left ? -10 : 10}>Estación {station.number}</tspan>
            <tspan x={left ? -10 : 10} dy="1.25em">{station.place}</tspan>
          </text>
        </g>
      </svg>
    </figure>
  );
}
