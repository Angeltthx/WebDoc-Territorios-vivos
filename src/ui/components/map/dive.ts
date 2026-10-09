// El viaje del planeta a la costa, compartido por las dos escenas para que el cambio de una a otra no se note.
//
// El planeta gira hasta dejar Nuquí de frente y baja; a cierta altura le pasa la posta al mapa de la costa, que
// sigue bajando por la misma curva desde una vista cenital con el mismo encuadre (mismo centro, misma orientación y
// el mismo ancho visible). Los dos se funden mientras bajan y el mapa termina inclinándose hasta la vista desde el mar.

import { MathUtils } from 'three';
import { S } from './terrain';

export const DIVE = {
  /** Giro del planeta hasta Nuquí (s). */
  turnEnd: 1.8,
  /** La bajada empieza y termina (s). */
  start: 0.5,
  end: 6.2,
  /** Altura (km) a la que el mapa toma la posta. */
  handoffKm: 650,
  /** Duración del fundido entre las dos escenas (s). */
  fade: 0.9,
  /** Distancia final de la cámara del mapa (unidades de la escena). */
  mapDist: 950,
};

/**
 * La vuelta al planeta (al alejarse mucho del mapa o con «Ver el planeta»): el mapa sube acelerando hasta la altura
 * de la posta y el planeta sigue subiendo desde ahí, frenando, con el mismo ritmo en el empalme.
 */
export const ASCENT = {
  /** Subida del mapa hasta la posta (s). */
  map: 2.4,
  /** Subida del planeta desde la posta hasta su vista de reposo (s). */
  globe: 2.0,
};

/** Campo de visión vertical de cada escena según la forma de la pantalla. */
export const fovs = (aspect: number) => (aspect < 0.8 ? { globe: 52, map: 64 } : { globe: 36, map: 52 });

/** Avance de la bajada (0 → 1), suave al empezar y al llegar. */
export function diveProgress(t: number) {
  const u = MathUtils.clamp((t - DIVE.start) / (DIVE.end - DIVE.start), 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
}

/** Unidades del mapa por kilómetro de altura del planeta, para que las dos cámaras vean el mismo ancho. */
export function mapUnitsPerKm(aspect: number) {
  const f = fovs(aspect);
  return (S * Math.tan(MathUtils.degToRad(f.globe / 2))) / Math.tan(MathUtils.degToRad(f.map / 2));
}

/** Altura (km) de la cámara del planeta en el segundo `t`, partiendo de `fromKm`. Baja a ritmo exponencial. */
export function diveAltitude(t: number, fromKm: number, aspect: number) {
  const toKm = DIVE.mapDist / mapUnitsPerKm(aspect);
  return fromKm * (toKm / fromKm) ** diveProgress(t);
}

/** Datos que el planeta le pasa al mapa al darle la posta. */
export interface Handoff {
  /** Momento (performance.now) en que empezó el viaje. */
  startedAt: number;
  /** Altura inicial (km) de la cámara del planeta. */
  fromKm: number;
}
