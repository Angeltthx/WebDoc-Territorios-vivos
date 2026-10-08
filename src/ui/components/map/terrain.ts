// Geografía del mapa de prueba: línea de costa del afiche, relieve, ríos y posición de cada lugar.
// Coordenadas: x apunta tierra adentro (este), z hacia el sur; y es la altura. 1 unidad ≈ 1 m a escala libre.

import { MathUtils, Vector3 } from 'three';
import { COAST, MAP_NATURE, MAP_PLACES, MAP_RIVERS, type MapPlace } from '../../../content/map';

/** Unidades de la escena por píxel del afiche. */
export const K = 2.6;
/** Altura del afiche que queda en z = 0 (Nuquí). */
const PY0 = 880;
const PX0 = 600;

export const Z_LIMIT = { min: (40 - PY0) * K, max: (1330 - PY0) * K };

export const smoothstep = MathUtils.smoothstep;
export const zOf = (py: number) => (py - PY0) * K;

// ───────── Línea de costa ─────────

const PY_MIN = -600;
const PY_MAX = 1900;

/** Interpolación lineal de la costa del afiche, suavizada con una media móvil de `radius` píxeles. */
function coastTable(radius: number) {
  const raw = new Float32Array(PY_MAX - PY_MIN + 1);
  for (let i = 0; i < raw.length; i++) {
    const py = PY_MIN + i;
    let j = 0;
    while (j < COAST.length - 2 && COAST[j + 1][0] < py) j++;
    const [y0, x0] = COAST[j];
    const [y1, x1] = COAST[j + 1];
    raw[i] = x0 + (x1 - x0) * MathUtils.clamp((py - y0) / (y1 - y0), 0, 1);
  }
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k++) {
      const v = raw[i + k];
      if (v !== undefined) { sum += v; n++; }
    }
    out[i] = sum / n;
  }
  return out;
}

const COAST_FINE = coastTable(18);
export const COAST_SOFT = coastTable(140);

/** x de la costa (unidades de escena) para una z dada. */
export function coastAt(table: Float32Array, z: number) {
  const f = MathUtils.clamp(z / K + PY0 - PY_MIN, 0, table.length - 1);
  const i = Math.floor(f);
  const a = table[i];
  const b = table[Math.min(i + 1, table.length - 1)];
  return (a + (b - a) * (f - i) - PX0) * K;
}
export const coastX = (z: number) => coastAt(COAST_FINE, z);

/** Punto de la escena a partir de una altura del afiche y una distancia tierra adentro (en píxeles). */
export function fromPoster(py: number, inland: number) {
  const z = zOf(py);
  return new Vector3(coastX(z) + inland * K, 0, z);
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

// ───────── Ríos ─────────

interface RiverSeg { ax: number; az: number; bx: number; bz: number; wa: number; wb: number; minX: number; maxX: number; minZ: number; maxZ: number }

const riverSegs: RiverSeg[] = MAP_RIVERS.flatMap((r) => {
  const pts = r.path.map(([py, inland]) => fromPoster(py, inland));
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

/** Distancia al río más cercano, medida en anchos de río (0 = centro del cauce, 1 = orilla). */
export function riverReach(x: number, z: number) {
  let best = Infinity;
  for (const s of riverSegs) {
    // Descarte rápido: el río no pasa cerca.
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

// ───────── Relieve ─────────

/** Relieve sin retoques: playa, llanura costera y la serranía del Baudó al fondo. */
function rawHeight(x: number, z: number) {
  const d = x - coastX(z);
  if (d < 0) return Math.max(d * 0.06, -30);
  const beach = 1.5 + Math.min(d, 50) * 0.15;
  const ridge = Math.pow(smoothstep(d, 120, 2300), 1.2) * 300;
  const n = fbm(x * 0.0024, z * 0.0024);
  const amp = (14 + smoothstep(d, 150, 1100) * 110) * smoothstep(d, 40, 260);
  return Math.max(beach + ridge + n * amp, beach);
}

// ───────── Lugares ─────────

export interface PlacedPlace extends MapPlace {
  pos: Vector3;
}

const toPlaced = (p: MapPlace): PlacedPlace => ({ ...p, pos: fromPoster(p.py, p.inland) });

/** Pueblos y sitios del afiche. */
export const placed = MAP_PLACES.map(toPlaced);
/** Fauna y flora del afiche. */
export const nature = MAP_NATURE.map(toPlaced);

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
export const GRID = { x0: -3200, z0: -4200, w: 7200, d: 7600, nx: 460, nz: 486 };
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

/** ¿Hay espacio libre para sembrar algo aquí? (lejos de lugares, ríos y del agua). */
export function isFree(x: number, z: number, minInland = 8) {
  if (x - coastX(z) < minInland) return false;
  if (riverReach(x, z) < 1.8) return false;
  for (const p of placed) {
    const r = p.kind === 'town' ? 125 : p.id === 'kipara-te' ? 110 : 50;
    if (Math.hypot(x - p.pos.x, z - p.pos.z) < r) return false;
  }
  for (const p of nature) if (Math.hypot(x - p.pos.x, z - p.pos.z) < 30) return false;
  return true;
}
