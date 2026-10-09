// Arte del afiche dibujado con código sobre lienzos (canvas): mar turquesa con remolinos, selva verde oscuro con
// hojas y flores, Colombia con sus departamentos y el Chocó resaltado. Lo usan el planeta de la entrada y el mapa de
// la costa (al llegar desde el planeta). Todo sale de los contornos de map-world.ts; no hay imágenes.

import { CanvasTexture, SRGBColorSpace } from 'three';
import { COUNTRIES, DEPARTMENTS, LAND } from '../../../content/map-world';
import { textureScale } from './quality';

/** Paleta del afiche. */
export const POSTER = {
  sea: '#1f8f97',
  seaDeep: '#177c88',
  seaLight: '#35aeac',
  swirl: '#156f7b',
  foam: '#d9f2ee',
  jungle: '#23533a',
  jungleDark: '#1a4330',
  leaf: '#2f6b45',
  blob: '#6aa84a',
  colombia: '#2c6442',
  choco: '#4f9a52',
  cream: '#fdf6e3',
  pink: '#e2456f',
  orange: '#f39a5a',
  yellow: '#f7cf3d',
};

const unpack = (ring: number[]) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < ring.length; i += 2) pts.push([ring[i] / 100, ring[i + 1] / 100]);
  return pts;
};

function inRing(lon: number, lat: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const CHOCO = DEPARTMENTS.find((d) => d.name === 'Chocó')!.rings.map(unpack);
const COLOMBIA = COUNTRIES.find((c) => c.name === 'Colombia')!.rings.map(unpack);
export const isChoco = (lat: number, lon: number) => CHOCO.some((r) => inRing(lon, lat, r));

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ───────── Dibujo con el arte del afiche ─────────

interface View { lon0: number; lat1: number; lonSpan: number; latSpan: number; w: number; h: number }
const px = (v: View, lon: number, lat: number): [number, number] => [((lon - v.lon0) / v.lonSpan) * v.w, ((v.lat1 - lat) / v.latSpan) * v.h];

function tracePath(ctx: CanvasRenderingContext2D, v: View, rings: [number, number][][]) {
  ctx.beginPath();
  for (const ring of rings) {
    ring.forEach(([lo, la], i) => {
      const [x, y] = px(v, lo, la);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
}

/** Remolinos del mar: trazos curvos que siguen un campo de flujo, como los del afiche. */
function drawSea(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number, seed: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, POSTER.seaDeep);
  g.addColorStop(0.5, POSTER.sea);
  g.addColorStop(1, POSTER.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rand = rng(seed);
  const flow = (x: number, y: number) => Math.sin(x * 0.006 / scale + Math.cos(y * 0.008 / scale) * 2) * 2 + Math.cos(y * 0.005 / scale) * 1.4;
  ctx.lineCap = 'round';
  const strokes = Math.round((w * h) / (5200 * scale * scale));
  for (let i = 0; i < strokes; i++) {
    let x = rand() * w;
    let y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const len = 14 + rand() * 30;
    for (let k = 0; k < len; k++) {
      const a = flow(x, y);
      x += Math.cos(a) * 4 * scale;
      y += Math.sin(a) * 4 * scale;
      ctx.lineTo(x, y);
    }
    const light = rand() < 0.25;
    ctx.strokeStyle = light ? 'rgba(80, 190, 190, 0.35)' : 'rgba(18, 100, 112, 0.55)';
    ctx.lineWidth = (light ? 1.4 : 2.4 + rand() * 2.4) * scale;
    ctx.stroke();
  }
}

/** Lado (px) de la baldosa de selva: se dibuja una vez y se repite, sin costuras. */
const TILE = 512;
const tiles = new Map<string, HTMLCanvasElement>();

/**
 * Baldosa de selva: verde oscuro con hojas, helechos, manchas claras y, si se pide, flores. Cada figura que toca un
 * borde se repite del lado opuesto, así la baldosa empata consigo misma al repetirse.
 */
function jungleTile(scale: number, seed: number, flowers: boolean) {
  const key = `${scale}|${seed}|${flowers}`;
  const cached = tiles.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  const rand = rng(seed);
  const area = TILE * TILE;
  /** Dibuja en (x, y) y en las copias del otro lado de los bordes que alcance a tocar. */
  const wrap = (x: number, y: number, r: number, draw: (x: number, y: number) => void) => {
    for (const dx of [-TILE, 0, TILE]) for (const dy of [-TILE, 0, TILE]) {
      const px = x + dx;
      const py = y + dy;
      if (px > -r && px < TILE + r && py > -r && py < TILE + r) draw(px, py);
    }
  };
  ctx.fillStyle = POSTER.jungle;
  ctx.fillRect(0, 0, TILE, TILE);
  const leaves = Math.round(area / (260 * scale * scale));
  for (let i = 0; i < leaves; i++) {
    const a = rand() * Math.PI * 2;
    const l = (4 + rand() * 7) * scale;
    ctx.fillStyle = rand() < 0.6 ? POSTER.jungleDark : POSTER.leaf;
    wrap(rand() * TILE, rand() * TILE, l, (x, y) => {
      ctx.beginPath();
      ctx.ellipse(x, y, l, l * 0.32, a, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // Helechos: un tallo con hojitas a los lados.
  const ferns = Math.round(area / (9000 * scale * scale));
  ctx.strokeStyle = POSTER.leaf;
  ctx.lineWidth = 1.2 * scale;
  for (let i = 0; i < ferns; i++) {
    const a = rand() * Math.PI * 2;
    const l = (10 + rand() * 14) * scale;
    wrap(rand() * TILE, rand() * TILE, l, (x, y) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        const cx = x + Math.cos(a) * l * t;
        const cy = y + Math.sin(a) * l * t;
        for (const sd of [-1, 1]) {
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a + sd * 1.1) * l * 0.28 * (1 - t * 0.6), cy + Math.sin(a + sd * 1.1) * l * 0.28 * (1 - t * 0.6));
        }
      }
      ctx.stroke();
    });
  }
  // Manchas verde claro (hojas grandes vistas desde arriba).
  const blobs = Math.max(1, Math.round(area / (40000 * scale * scale)));
  ctx.fillStyle = POSTER.blob;
  for (let i = 0; i < blobs; i++) {
    const rx = (7 + rand() * 6) * scale;
    const ry = (4 + rand() * 3) * scale;
    const a = rand() * Math.PI;
    wrap(rand() * TILE, rand() * TILE, rx, (x, y) => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  if (flowers) {
    const n = Math.max(1, Math.round(area / (30000 * scale * scale)));
    for (let i = 0; i < n; i++) {
      const r = (3 + rand() * 3) * scale;
      const color = rand() < 0.6 ? '#ef86bd' : POSTER.orange;
      wrap(rand() * TILE, rand() * TILE, r * 1.4, (x, y) => flower(ctx, x, y, r, color));
    }
  }
  tiles.set(key, canvas);
  return canvas;
}

/** Rellena el contorno trazado con la selva del afiche (una baldosa repetida). */
function drawJungle(ctx: CanvasRenderingContext2D, scale: number, seed: number, flowers: boolean) {
  ctx.save();
  ctx.fillStyle = ctx.createPattern(jungleTile(scale, seed, flowers), 'repeat')!;
  ctx.fill();
  ctx.restore();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.6, r * 0.4, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = POSTER.yellow;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Orilla: franja turquesa clara en el agua y un borde claro, como en el afiche. */
function drawShore(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(70, 190, 185, 0.65)';
  ctx.lineWidth = 9 * scale;
  ctx.stroke();
  ctx.strokeStyle = POSTER.foam;
  ctx.lineWidth = 1.6 * scale;
  ctx.stroke();
  ctx.restore();
}

let world: HTMLCanvasElement | null = null;
/** El planeta entero (equirrectangular). Se dibuja una sola vez. */
export function worldCanvas() {
  if (world) return world;
  const w = 4096;
  const h = 2048;
  // Se dibuja siempre en 4096 × 2048 "lógicos"; en pantallas chicas el lienzo real es la mitad (ver textureScale).
  const k = textureScale();
  const canvas = document.createElement('canvas');
  canvas.width = w * k;
  canvas.height = h * k;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  const v: View = { lon0: -180, lat1: 90, lonSpan: 360, latSpan: 180, w, h };
  drawSea(ctx, w, h, 1, 7);
  const land = LAND.map(unpack);
  tracePath(ctx, v, land);
  drawShore(ctx, 1);
  tracePath(ctx, v, land);
  drawJungle(ctx, 1, 11, false);
  // Colombia un poco más clara y con borde crema.
  tracePath(ctx, v, COLOMBIA);
  ctx.fillStyle = POSTER.colombia;
  ctx.fill();
  ctx.strokeStyle = POSTER.cream;
  ctx.lineWidth = 2;
  ctx.stroke();
  tracePath(ctx, v, CHOCO);
  ctx.fillStyle = POSTER.choco;
  ctx.fill();
  world = canvas;
  return canvas;
}

/** Región de Colombia con detalle (para cuando la cámara se acerca), en grados. */
export const REGION = { lonMin: -84, lonMax: -66, latMin: -5, latMax: 13 };

let region: HTMLCanvasElement | null = null;
/**
 * Colombia y sus vecinos con detalle. La usan el planeta al acercarse y el mapa de la costa al llegar (vista desde
 * arriba), así las dos escenas muestran el mismo dibujo en el momento del cambio. Se dibuja una sola vez.
 */
export function regionCanvas() {
  if (region) return region;
  const w = 2560;
  const h = 2560;
  // La región se ve de cerca al cambiar de escena: se reduce menos que el planeta (2048 en vez de 2560).
  const k = textureScale() < 1 ? 0.8 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = w * k;
  canvas.height = h * k;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  const v: View = { lon0: REGION.lonMin, lat1: REGION.latMax, lonSpan: REGION.lonMax - REGION.lonMin, latSpan: REGION.latMax - REGION.latMin, w, h };
  const scale = 2.2;
  drawSea(ctx, w, h, scale, 3);
  const all = COUNTRIES.flatMap((c) => c.rings.map(unpack));
  tracePath(ctx, v, all);
  drawShore(ctx, scale);
  tracePath(ctx, v, all);
  drawJungle(ctx, scale, 5, false);
  // Colombia con sus departamentos.
  tracePath(ctx, v, COLOMBIA);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = POSTER.colombia;
  ctx.fillRect(0, 0, w, h);
  tracePath(ctx, v, COLOMBIA);
  drawJungle(ctx, scale * 0.8, 9, true);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#7fc06a';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(253, 246, 227, 0.35)';
  ctx.lineWidth = 2;
  for (const d of DEPARTMENTS) {
    if (d.name === 'Chocó') continue;
    tracePath(ctx, v, d.rings.map(unpack));
    ctx.stroke();
  }
  // El Chocó: verde vivo con flores y borde rosado.
  tracePath(ctx, v, CHOCO);
  ctx.save();
  ctx.clip();
  tracePath(ctx, v, CHOCO);
  drawJungle(ctx, 1.2, 21, true);
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#8fd06a';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  tracePath(ctx, v, CHOCO);
  ctx.strokeStyle = POSTER.pink;
  ctx.lineWidth = 3;
  ctx.stroke();
  tracePath(ctx, v, COLOMBIA);
  ctx.strokeStyle = POSTER.cream;
  ctx.lineWidth = 4;
  ctx.stroke();
  region = canvas;
  return canvas;
}

/**
 * Luz de la tarde sobre el dibujo del afiche (en espacio lineal): lo entibia hacia el naranja. El planeta la aplica en la
 * franja donde está atardeciendo (Nuquí cae ahí) y el mapa, sobre el mismo dibujo, al llegar desde lo alto.
 */
export const DUSK_GLSL = `vec3 dusk(vec3 c, float k) { return mix(c, c * vec3(1.35, 0.82, 0.55) + vec3(0.03, 0.01, 0.0), k); }`;
/** Cuánto atardecer recibe el dibujo en Nuquí (el planeta y el mapa coinciden ahí). */
export const DUSK_AT_NUQUI = 0.62;

/** Textura (sRGB) de un lienzo del afiche. */
export function posterTexture(canvas: HTMLCanvasElement) {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
