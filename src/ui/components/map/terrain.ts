// Geografía del mapa: costa, llanura y lomas reales de Nuquí (relieve SRTM), con los pueblos en sus coordenadas.
// Coordenadas de la escena: x hacia el este, z hacia el sur, y la altura; el origen es el pueblo de Nuquí.
// Escala horizontal: S unidades por kilómetro. Las alturas se exageran (×EXAGGERATION) para que las lomas se lean.

import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { MAP_NATURE, MAP_PLACES, MAP_RIVERS, TOWNS, type MapPlace, type TownId } from '../../../content/map';
import { REGION_RELIEF } from '../../../content/map-region';
import { RELIEF } from '../../../content/map-relief';

/** Unidades de la escena por kilómetro. */
export const S = 110;
const EXAGGERATION = 4;
const UNITS_PER_METER = (S / 1000) * EXAGGERATION;

const LAT0 = 5.7125;
const LON0 = -77.270833;
const KM_PER_LAT = 110.6;
const KM_PER_LON = 110.77; // a 5,7° de latitud

export const smoothstep = MathUtils.smoothstep;

export const toScene = (lat: number, lon: number) => new Vector3((lon - LON0) * KM_PER_LON * S, 0, (LAT0 - lat) * KM_PER_LAT * S);
export const sceneToLatLon = (x: number, z: number) => ({ lat: LAT0 - z / (KM_PER_LAT * S), lon: LON0 + x / (KM_PER_LON * S) });

// ───────── Relieve real ─────────

const bytes = Uint8Array.from(atob(RELIEF.data), (c) => c.charCodeAt(0));
const R_X0 = (RELIEF.west - LON0) * KM_PER_LON * S;
const R_Z0 = (LAT0 - RELIEF.north) * KM_PER_LAT * S;
const R_DX = RELIEF.step * KM_PER_LON * S;
const R_DZ = RELIEF.step * KM_PER_LAT * S;

/** Límites del relieve medido, en unidades de la escena. */
export const BOUNDS = { x0: R_X0, z0: R_Z0, x1: R_X0 + (RELIEF.cols - 1) * R_DX, z1: R_Z0 + (RELIEF.rows - 1) * R_DZ };

/** Altura real en metros (negativa en el mar), interpolada. Fuera de la zona medida se repite el borde. */
function meters(x: number, z: number) {
  const fx = MathUtils.clamp((x - R_X0) / R_DX, 0, RELIEF.cols - 1.001);
  const fz = MathUtils.clamp((z - R_Z0) / R_DZ, 0, RELIEF.rows - 1.001);
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const v = (r: number, c: number) => {
    const b = bytes[r * RELIEF.cols + c];
    return b === 0 ? -8 : b * RELIEF.metersPerUnit;
  };
  const top = v(iz, ix) + (v(iz, ix + 1) - v(iz, ix)) * tx;
  const bottom = v(iz + 1, ix) + (v(iz + 1, ix + 1) - v(iz + 1, ix)) * tx;
  return top + (bottom - top) * tz;
}

// ───────── Distancia a la orilla ─────────
// Campo con la distancia a la línea de costa: positivo tierra adentro, negativo mar adentro.

const D_CELL = 12;
const D_COLS = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / D_CELL) + 1;
const D_ROWS = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / D_CELL) + 1;
/** Distancia con signo (chaflán) a la orilla en una grilla: positiva en tierra, negativa en el mar. */
function signedField(cols: number, rows: number, cell: number, isLand: (c: number, r: number) => boolean) {
  const n = cols * rows;
  const land = new Uint8Array(n);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) land[r * cols + c] = isLand(c, r) ? 1 : 0;
  // Distancia desde cada celda hasta la celda más cercana del otro lado de la orilla.
  const dist = (inside: number) => {
    const d = new Float32Array(n).fill(1e9);
    for (let i = 0; i < n; i++) if (land[i] !== inside) d[i] = 0;
    const a = cell;
    const b = cell * 1.4142;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c > 0) d[i] = Math.min(d[i], d[i - 1] + a);
      if (r > 0) {
        d[i] = Math.min(d[i], d[i - cols] + a);
        if (c > 0) d[i] = Math.min(d[i], d[i - cols - 1] + b);
        if (c < cols - 1) d[i] = Math.min(d[i], d[i - cols + 1] + b);
      }
    }
    for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (c < cols - 1) d[i] = Math.min(d[i], d[i + 1] + a);
      if (r < rows - 1) {
        d[i] = Math.min(d[i], d[i + cols] + a);
        if (c < cols - 1) d[i] = Math.min(d[i], d[i + cols + 1] + b);
        if (c > 0) d[i] = Math.min(d[i], d[i + cols - 1] + b);
      }
    }
    return d;
  };
  const inLand = dist(1);
  const inSea = dist(0);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = land[i] ? inLand[i] - cell / 2 : -(inSea[i] - cell / 2);
  return out;
}

const SHORE = signedField(D_COLS, D_ROWS, D_CELL, (c, r) => meters(BOUNDS.x0 + c * D_CELL, BOUNDS.z0 + r * D_CELL) > 0);

/** Datos del campo de distancia, para pasarlo al sombreador del mar. */
export const SHORE_FIELD = { data: SHORE, cols: D_COLS, rows: D_ROWS, cell: D_CELL, x0: BOUNDS.x0, z0: BOUNDS.z0 };

// ───────── Relieve de fondo: el resto del Chocó ─────────
// Grilla gruesa (≈ 2,8 km) con la costa hacia el norte y el sur, el valle del Atrato y la cordillera Occidental.
// Se ve detrás del relieve fino para que la costa siga tierra adentro y no parezca una isla.

const regionBytes = Uint8Array.from(atob(REGION_RELIEF.data), (c) => c.charCodeAt(0));
const F_X0 = (REGION_RELIEF.west - LON0) * KM_PER_LON * S;
const F_Z0 = (LAT0 - REGION_RELIEF.north) * KM_PER_LAT * S;
const F_DX = REGION_RELIEF.step * KM_PER_LON * S;
const F_DZ = REGION_RELIEF.step * KM_PER_LAT * S;
/** Hondura del fondo marino en el relieve de fondo (queda tapado por el mar). */
const FAR_SEA = -60;

/** Grilla del relieve de fondo, en unidades de la escena (de norte a sur y de oeste a este). */
export const FAR_GRID = { x0: F_X0, z0: F_Z0, dx: F_DX, dz: F_DZ, cols: REGION_RELIEF.cols, rows: REGION_RELIEF.rows };

/** Altura del relieve de fondo en un vértice de su grilla (unidades de la escena, exagerada como el resto). */
export function farVertex(c: number, r: number) {
  const b = regionBytes[r * REGION_RELIEF.cols + c];
  return b === 0 ? FAR_SEA : b * REGION_RELIEF.metersPerUnit * UNITS_PER_METER;
}

/** Altura del relieve de fondo en cualquier punto (interpolada como la malla que se ve). */
export function farHeight(x: number, z: number) {
  const fx = MathUtils.clamp((x - F_X0) / F_DX, 0, REGION_RELIEF.cols - 1.001);
  const fz = MathUtils.clamp((z - F_Z0) / F_DZ, 0, REGION_RELIEF.rows - 1.001);
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const top = farVertex(ix, iz) + (farVertex(ix + 1, iz) - farVertex(ix, iz)) * tx;
  const bottom = farVertex(ix, iz + 1) + (farVertex(ix + 1, iz + 1) - farVertex(ix, iz + 1)) * tx;
  return top + (bottom - top) * tz;
}

const FAR_CELL = (F_DX + F_DZ) / 2;
/** Distancia a la orilla en la grilla de fondo (para el color del agua frente al resto de la costa). */
export const FAR_SHORE_FIELD = {
  data: signedField(REGION_RELIEF.cols, REGION_RELIEF.rows, FAR_CELL, (c, r) => regionBytes[r * REGION_RELIEF.cols + c] > 0),
  cols: REGION_RELIEF.cols,
  rows: REGION_RELIEF.rows,
  cell: FAR_CELL,
  x0: F_X0,
  z0: F_Z0,
};

/** Distancia a la orilla (unidades): positiva en tierra, negativa en el mar. */
export function shore(x: number, z: number) {
  const fx = (x - BOUNDS.x0) / D_CELL;
  if (fx < 0) return SHORE[0] + fx * D_CELL; // mar abierto al oeste
  const cx = Math.min(fx, D_COLS - 1.001);
  const fz = MathUtils.clamp((z - BOUNDS.z0) / D_CELL, 0, D_ROWS - 1.001);
  const ix = Math.floor(cx);
  const iz = Math.floor(fz);
  const tx = cx - ix;
  const tz = fz - iz;
  const i = iz * D_COLS + ix;
  const top = SHORE[i] + (SHORE[i + 1] - SHORE[i]) * tx;
  const bottom = SHORE[i + D_COLS] + (SHORE[i + D_COLS + 1] - SHORE[i + D_COLS]) * tx;
  return top + (bottom - top) * tz + (fx - cx) * D_CELL;
}

/** Dirección hacia el mar en un punto, promediada en un radio. */
function seaward(p: Vector3, radius = 300) {
  const dir = new Vector3();
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const s = MathUtils.clamp(shore(p.x + dx * radius, p.z + dz * radius), -400, 400);
    dir.x -= dx * s;
    dir.z -= dz * s;
  }
  return dir.normalize();
}

// ───────── Recorrido por la costa ─────────
// La cámara, las lanchas y la ubicación de los lugares siguen una línea suave que pasa por los cinco pueblos.

/** Lleva un punto a `inland` unidades de la orilla, avanzando desde el mar en la dirección contraria a `sea`. */
function toShore(from: Vector3, sea: Vector3, inland: number) {
  const p = from.clone().addScaledVector(sea, 2500);
  for (let i = 0; i < 1500; i++) {
    if (shore(p.x, p.z) >= inland) break;
    p.addScaledVector(sea, -5);
  }
  return p;
}

const townRaw = TOWNS.map((t) => toScene(t.lat, t.lon));
const townSea = townRaw.map((p) => seaward(p));
const townPos = townRaw.map((p, i) => toShore(p, townSea[i], 6));

const headPt = townPos[0].clone().add(townPos[0].clone().sub(townPos[1]).setLength(1400));
const tailPt = townPos[4].clone().add(townPos[4].clone().sub(townPos[3]).setLength(700));
const curve = new CatmullRomCurve3([headPt, ...townPos, tailPt], false, 'centripetal');
const SAMPLES = 800;
const railPts = curve.getSpacedPoints(SAMPLES);
const railLen = curve.getLength();
const sOfPoint = (p: Vector3) => {
  let best = 0;
  let bestD = Infinity;
  railPts.forEach((q, i) => {
    const d = q.distanceToSquared(p);
    if (d < bestD) { bestD = d; best = i; }
  });
  return (best / SAMPLES) * railLen;
};
const townS = townPos.map(sOfPoint);
const townAngle = townSea.map((d) => Math.atan2(d.z, d.x));
// Ángulos sin saltos de ±π entre pueblos vecinos.
for (let i = 1; i < townAngle.length; i++) {
  while (townAngle[i] - townAngle[i - 1] > Math.PI) townAngle[i] -= Math.PI * 2;
  while (townAngle[i] - townAngle[i - 1] < -Math.PI) townAngle[i] += Math.PI * 2;
}

export const RAIL = {
  length: railLen,
  /** Tramo que se puede recorrer: un poco al norte de Jurubidá y hasta Coquí. */
  min: townS[0] - 0.8 * S,
  max: townS[4] + 0.3 * S,
};

export interface RailPoint { pos: Vector3; sea: Vector3; tangent: Vector3 }

/** Punto del recorrido a `s` unidades desde el norte, con la dirección hacia el mar y la de avance. */
export function railAt(s: number): RailPoint {
  const u = MathUtils.clamp(s / railLen, 0, 1);
  const pos = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u).setY(0).normalize();
  let a: number;
  if (s <= townS[0]) a = townAngle[0];
  else if (s >= townS[4]) a = townAngle[4];
  else {
    let i = 0;
    while (s > townS[i + 1]) i++;
    const t = smoothstep(s, townS[i], townS[i + 1]);
    a = townAngle[i] + (townAngle[i + 1] - townAngle[i]) * t;
  }
  return { pos, sea: new Vector3(Math.cos(a), 0, Math.sin(a)), tangent };
}

const townIndex = (id: TownId) => TOWNS.findIndex((t) => t.id === id);

/** Punto a `along` km por la costa desde un pueblo (+ sur) y a `inland` km de la orilla (− mar adentro). */
export function placeNear(town: TownId, along: number, inland: number) {
  const s = MathUtils.clamp(townS[townIndex(town)] + along * S, 0, railLen);
  const r = railAt(s);
  return { pos: toShore(r.pos, r.sea, inland * S), s };
}

/** Ángulo (rotation.y) para que el frente de un objeto (+z) mire hacia `dir`. */
export const facing = (dir: Vector3) => Math.atan2(dir.x, dir.z);

/** Ángulo (rotation.y) para que el lado −x de un objeto (puertas, ramas, el frente de las figuras de lado) mire al mar. */
export const doorTo = (sea: Vector3) => Math.atan2(sea.z, -sea.x);

/** Punto frente a la costa: `off` unidades mar adentro desde el recorrido. */
export function offshoreRaw(s: number, off: number) {
  const r = railAt(s);
  return r.pos.clone().addScaledVector(r.sea, off);
}

/** Como `offshoreRaw`, pero se aleja más si cae cerca de tierra (bahías, puntas). */
export function offshore(s: number, off: number) {
  const r = railAt(s);
  const p = r.pos.clone().addScaledVector(r.sea, off);
  for (let i = 0; i < 80 && shore(p.x, p.z) > -off * 0.6; i++) p.addScaledVector(r.sea, 15);
  return p;
}

// ───────── Ruido ─────────

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x: number, y: number) {
  let sum = 0;
  let amp = 0.55;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(x * f, y * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/** Pseudoaleatorio con semilla: el mapa sale igual en cada visita. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ───────── Lugares ─────────

export interface PlacedPlace extends MapPlace {
  pos: Vector3;
  /** Posición en el recorrido de la costa. */
  s: number;
  /** Dirección hacia el mar en ese punto. */
  sea: Vector3;
}

const toPlaced = (p: MapPlace): PlacedPlace => {
  const { pos, s } = placeNear(p.at.town, p.at.along, p.at.inland);
  return { ...p, pos, s, sea: railAt(s).sea };
};

/** Pueblos y sitios del afiche. */
export const placed = MAP_PLACES.map(toPlaced);
/** Fauna y flora del afiche. */
export const nature = MAP_NATURE.map(toPlaced);

/**
 * Llegada desde el planeta: el punto frente a Nuquí al que mira la cámara al entrar, y el rumbo hacia tierra adentro
 * (radianes desde el norte, hacia el este). El planeta termina su viaje mirando ese punto desde arriba, con ese rumbo
 * hacia arriba en la pantalla, igual que la primera imagen del mapa.
 */
export const ARRIVAL = (() => {
  const s = placed.find((p) => p.id === 'nuqui')!.s;
  const r = railAt(s);
  const t = r.pos.clone().addScaledVector(r.sea, -170);
  return { s, ...sceneToLatLon(t.x, t.z), bearing: Math.atan2(-r.sea.x, r.sea.z) };
})();

// ───────── Ríos ─────────

interface RiverSeg { ax: number; az: number; bx: number; bz: number; wa: number; wb: number; minX: number; maxX: number; minZ: number; maxZ: number }

const riverSegs: RiverSeg[] = MAP_RIVERS.flatMap((r) => {
  const pts = r.path.map(([along, inland]) => placeNear(r.town, along, inland).pos);
  return pts.slice(1).map((b, i) => {
    const a = pts[i];
    const wOf = (k: number) => r.width * (1 - (0.5 * k) / (pts.length - 1));
    const m = r.width * 2.2;
    return {
      ax: a.x, az: a.z, bx: b.x, bz: b.z, wa: wOf(i), wb: wOf(i + 1),
      minX: Math.min(a.x, b.x) - m, maxX: Math.max(a.x, b.x) + m, minZ: Math.min(a.z, b.z) - m, maxZ: Math.max(a.z, b.z) + m,
    };
  });
});

/** Desembocaduras de los ríos (para los manglares). */
export const RIVER_MOUTHS = MAP_RIVERS.map((r) => placeNear(r.town, r.path[0][0], 0.1).pos);

/** Distancia al río más cercano, medida en anchos de río (0 = centro del cauce, 1 = orilla). */
export function riverReach(x: number, z: number) {
  let best = Infinity;
  for (const s of riverSegs) {
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
    const dx = s.bx - s.ax;
    const dz = s.bz - s.az;
    const t = MathUtils.clamp(((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
    const w = s.wa + (s.wb - s.wa) * t;
    best = Math.min(best, d / w);
  }
  return best;
}

// ───────── Relieve de la escena ─────────

/** Relieve sin retoques: fondo marino, playa, llanura costera y las lomas reales (exageradas). */
function rawHeight(x: number, z: number) {
  const h = closeHeight(x, z);
  // En los bordes norte, sur y este se funde con el relieve de fondo (un poco por debajo, para que este lo tape).
  const edge = Math.min(BOUNDS.x1 - x, z - BOUNDS.z0, BOUNDS.z1 - z);
  return edge < EDGE_BLEND ? MathUtils.lerp(farHeight(x, z) - 6, h, smoothstep(edge, 0, EDGE_BLEND)) : h;
}

/** Ancho de la franja donde el relieve fino se funde con el de fondo. */
export const EDGE_BLEND = 450;

function closeHeight(x: number, z: number) {
  const d = shore(x, z);
  if (d < 0) return Math.max(d * 0.05, -30) - 0.5;
  const beach = 1.5 + Math.min(d, 40) * 0.12;
  const real = Math.max(meters(x, z), 0) * UNITS_PER_METER;
  const detail = fbm(x * 0.006, z * 0.006) * (1.5 + real * 0.18) * smoothstep(d, 30, 220);
  return Math.max(real + detail, beach);
}

const flats = placed.map((p) => ({ x: p.pos.x, z: p.pos.z, h: rawHeight(p.pos.x, p.pos.z), r: p.id === 'kipara-te' ? 90 : 55 }));

/** Relieve exacto: se aplana alrededor de cada lugar y se abren los cauces de los ríos. */
function exactHeight(x: number, z: number) {
  let h = rawHeight(x, z);
  for (const f of flats) {
    if (Math.abs(z - f.z) > f.r * 2 || Math.abs(x - f.x) > f.r * 2) continue;
    const dist = Math.hypot(x - f.x, z - f.z);
    if (dist < f.r * 2) h = MathUtils.lerp(f.h, h, smoothstep(dist, f.r * 0.6, f.r * 2));
  }
  const r = riverReach(x, z);
  if (r < 2) h = MathUtils.lerp(-2.5, h, smoothstep(r, 0.55, 1.7));
  return h;
}

/** Grilla del relieve: se calcula una vez y la usan la malla del terreno y todo lo que se siembra encima. */
export const GRID = { x0: BOUNDS.x0, z0: BOUNDS.z0, w: BOUNDS.x1 - BOUNDS.x0 + 900, d: BOUNDS.z1 - BOUNDS.z0, nx: 540, nz: 372 };
const STEP_X = GRID.w / GRID.nx;
const STEP_Z = GRID.d / GRID.nz;
export const HEIGHTS = new Float32Array((GRID.nx + 1) * (GRID.nz + 1));
for (let iz = 0; iz <= GRID.nz; iz++) {
  for (let ix = 0; ix <= GRID.nx; ix++) HEIGHTS[iz * (GRID.nx + 1) + ix] = exactHeight(GRID.x0 + ix * STEP_X, GRID.z0 + iz * STEP_Z);
}

/** Altura del terreno en cualquier punto (interpolada de la grilla, igual que la malla que se ve). */
export function heightAt(x: number, z: number) {
  const fx = (x - GRID.x0) / STEP_X;
  const fz = (z - GRID.z0) / STEP_Z;
  if (fx < 0 || fz < 0 || fx >= GRID.nx || fz >= GRID.nz) return exactHeight(x, z);
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const row = GRID.nx + 1;
  const i = iz * row + ix;
  const top = HEIGHTS[i] + (HEIGHTS[i + 1] - HEIGHTS[i]) * tx;
  const bottom = HEIGHTS[i + row] + (HEIGHTS[i + row + 1] - HEIGHTS[i + row]) * tx;
  return top + (bottom - top) * tz;
}

for (const p of [...placed, ...nature]) p.pos.y = Math.max(heightAt(p.pos.x, p.pos.z), 0);

/** ¿Hay espacio libre para sembrar algo aquí? (en tierra, lejos de lugares y de los ríos). */
export function isFree(x: number, z: number, minInland = 8) {
  if (shore(x, z) < minInland) return false;
  if (riverReach(x, z) < 1.8) return false;
  for (const p of placed) {
    const r = p.kind === 'town' ? 125 : p.id === 'kipara-te' ? 110 : 50;
    if (Math.abs(x - p.pos.x) < r && Math.abs(z - p.pos.z) < r && Math.hypot(x - p.pos.x, z - p.pos.z) < r) return false;
  }
  for (const p of nature) if (Math.hypot(x - p.pos.x, z - p.pos.z) < 30) return false;
  return true;
}

/** Punto al azar dentro de la zona del mapa (para sembrar). */
export function randomPoint(rand: () => number) {
  return { x: GRID.x0 + rand() * GRID.w, z: GRID.z0 + rand() * GRID.d };
}

