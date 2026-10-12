// Casas de los pueblos del Chocó para las figuritas del mapa, armadas con piezas de colores (como el resto del mapa),
// pero con los detalles que hacen reconocible un pueblo del Pacífico:
//
// - El palafito de madera: sobre pilotes (por las crecientes del río y la marea), paredes de tabla pintadas de colores
//   vivos, techo de zinc a dos aguas con sus láminas (y algo de óxido), corredor al frente con baranda, escalera,
//   ventanas con postigos de madera y, al lado, el tanque negro para el agua de lluvia.
// - La casa de material de las cabeceras: dos o tres pisos, el primero con la tienda (cortina metálica y su letrero),
//   balcón con baranda, la losa entre pisos y, arriba, el piso sin terminar en ladrillo con las varillas a la vista.
// - La capilla del pueblo y la catedral de la ciudad, blancas, con su torre.
// - Alrededor, plataneras y árboles de patio.
//
// Cada casa mira a +z (al frente, hacia el río o el mar) y se apoya en y = 0; los pilotes y el cimiento bajan un poco
// más para no quedar flotando cuando el terreno es inclinado.

import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BALL, BLADE, BOX, CONE, CONE4, CYL, part, pole } from './kit';
import { TIER } from './quality';

/** Los detalles finos (tablas, juntas del zinc, palitos de las barandas, postigos) solo en equipos con margen. */
const FINE = TIER === 'alta' || TIER === 'media';

type Parts = BufferGeometry[];

/** Prisma triangular (techo a dos aguas): base de 1 × 1 en y = 0 y la cumbrera, a lo largo de x, en y = 1. */
const PRISM = (() => {
  const a = [-0.5, 0, -0.5], b = [0.5, 0, -0.5], c = [0.5, 0, 0.5], d = [-0.5, 0, 0.5], e = [-0.5, 1, 0], f = [0.5, 1, 0];
  const tris = [[a, e, f], [a, f, b], [d, c, f], [d, f, e], [a, d, e], [b, f, c], [a, b, c], [a, c, d]];
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(tris.flat(2), 3));
  g.computeVertexNormals();
  return g;
})();

const DARK = '#2b241e';
const STILT = '#5e4632';
const FLOOR = '#7d5f42';
const CEMENT = '#a9a59c';
const BRICK = '#b0603f';

/** El mismo color, más oscuro (líneas de las tablas, sombras). */
const shade = (color: string, k = 0.8) => '#' + new Color(color).multiplyScalar(k).getHexString();

/** Gira un grupo de piezas alrededor del eje vertical (las piezas memorizadas no se tocan: se funden primero). */
export function turned(parts: Parts, angle: number, dx = 0, dz = 0): Parts {
  const g = mergeGeometries(parts)!;
  g.rotateY(angle);
  g.translate(dx, 0, dz);
  return [g];
}

/** Ventana con marco, alféizar y (si hay) postigos abiertos, en una pared que mira a +z en z = `z`. */
function windowAt(x: number, y: number, z: number, trim: string, shutter?: string, w = 1.5, h = 1.7): Parts {
  const out = [
    part(BOX, trim, { p: [x, y, z + 0.05], s: [w + 0.45, h + 0.45, 0.1] }),
    part(BOX, DARK, { p: [x, y, z + 0.11], s: [w, h, 0.08] }),
    part(BOX, trim, { p: [x, y - h / 2 - 0.25, z + 0.25], s: [w + 0.7, 0.2, 0.45] }),
  ];
  if (shutter && FINE) for (const s of [-1, 1]) out.push(part(BOX, shutter, { p: [x + s * (w * 0.75 + 0.3), y, z + 0.14], s: [w / 2, h, 0.12] }));
  return out;
}

/** Puerta con su marco. */
const doorAt = (x: number, y0: number, z: number, trim: string, leaf = DARK, w = 1.4, h = 2.8): Parts => [
  part(BOX, trim, { p: [x, y0 + h / 2 + 0.1, z + 0.05], s: [w + 0.4, h + 0.3, 0.1] }),
  part(BOX, leaf, { p: [x, y0 + h / 2, z + 0.11], s: [w, h, 0.08] }),
];

/**
 * Techo a dos aguas de zinc: el volumen, la cumbrera y las juntas de las láminas bajando por cada agua; algunas láminas
 * con óxido. `w` a lo largo de la cumbrera (x), `d` de fondo (z).
 */
function zincRoof(w: number, d: number, rise: number, y: number, zc: number, color: string, rust: number, thatch = false): Parts {
  const out: Parts = [part(PRISM, color, { p: [0, y, zc], s: [w, rise, d] })];
  if (!FINE) return out;
  if (thatch) {
    // Palma: un segundo manto un poco más abajo y más ancho, más oscuro, que hace el borde desflecado.
    out.push(part(PRISM, shade(color, 0.82), { p: [0, y - 0.5, zc], s: [w + 0.5, rise * 0.82, d + 0.7] }));
    return out;
  }
  out.push(part(BOX, shade(color, 0.75), { p: [0, y + rise + 0.02, zc], s: [w + 0.1, 0.22, 0.5] }));
  const half = d / 2;
  const slope = Math.hypot(half, rise);
  const tilt = Math.atan2(rise, half);
  const seam = shade(color, 1.12);
  const sheets = Math.max(3, Math.round(w / 1.3));
  for (const side of [-1, 1]) {
    for (let k = 1; k < sheets; k++) {
      const x = -w / 2 + (k * w) / sheets;
      out.push(part(BOX, seam, { p: [x, y + rise / 2 + 0.06, zc + (side * half) / 2], s: [0.14, 0.08, slope], r: [side * tilt, 0, 0] }));
    }
    // Láminas oxidadas: unas pocas, en distinto lugar según la casa.
    for (let k = 0; k < rust; k++) {
      const x = -w / 2 + ((((k * 2 + (side > 0 ? 1 : 0)) * 0.37 + rust * 0.21) % 1) * (sheets - 1) + 0.5) * (w / sheets);
      out.push(part(BOX, k % 2 ? '#9a5a36' : '#b0703f', { p: [x, y + rise / 2 + 0.05, zc + (side * half) / 2], s: [w / sheets - 0.1, 0.06, slope * 0.96], r: [side * tilt, 0, 0] }));
    }
  }
  return out;
}

export interface PalafitoOpts {
  wall: string;
  trim: string;
  roof: string;
  /** Postigos de las ventanas (por defecto, el color del marco). */
  shutter?: string;
  w?: number;
  d?: number;
  /** Alto de cada piso. */
  h?: number;
  stilts?: number;
  floors?: number;
  porch?: boolean;
  /** Techo de palma en vez de zinc. */
  thatch?: boolean;
  /** Tanque negro de agua al lado. */
  tank?: boolean;
  /** Láminas de zinc oxidadas por agua del techo. */
  rust?: number;
}

/** Palafito de madera del Pacífico. */
export function palafito({ wall, trim, roof, shutter = trim, w = 7, d = 5.6, h = 4.2, stilts = 2.4, floors = 1, porch = true, thatch = false, tank = false, rust = 1 }: PalafitoOpts): Parts {
  const p: Parts = [];
  const pd = porch ? 2.4 : 0;
  const front = d / 2 + pd;
  // Pilotes (bajan bajo el suelo para alcanzarlo si la loma baja).
  for (const x of [-w / 2 + 0.4, 0, w / 2 - 0.4]) {
    for (const z of [-d / 2 + 0.4, d / 2 - 0.3, ...(porch ? [front - 0.3] : [])]) p.push(pole(STILT, [x, -3, z], [x, stilts, z], 0.26));
  }
  // El piso de tablas.
  p.push(part(BOX, FLOOR, { p: [0, stilts, pd / 2], s: [w + 0.3, 0.4, d + pd + 0.2] }));
  const y0 = stilts + 0.2;
  const H = h * floors;
  // Paredes de tabla: el color y, encima, las líneas de las tablas (apenas salidas), y los esquineros.
  p.push(part(BOX, wall, { p: [0, y0 + H / 2, 0], s: [w, H, d] }));
  const line = shade(wall, 0.84);
  if (FINE) for (let y = 0.9; y < H - 0.3; y += 0.9) p.push(part(BOX, line, { p: [0, y0 + y, 0], s: [w + 0.06, 0.09, d + 0.06] }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(part(BOX, trim, { p: [sx * (w / 2), y0 + H / 2, sz * (d / 2)], s: [0.35, H, 0.35] }));
  for (let f = 0; f < floors; f++) {
    const fy = y0 + f * h;
    // Al frente: la puerta (abajo) o un balcón (arriba), y una ventana con postigos.
    if (f === 0) p.push(...doorAt(-w * 0.24, fy, d / 2, trim, shade(shutter, 0.7)));
    else p.push(...windowAt(-w * 0.24, fy + h * 0.5, d / 2, trim, shutter));
    p.push(...windowAt(w * 0.22, fy + h * 0.55, d / 2, trim, shutter));
    // A los lados, una ventana.
    if (FINE) for (const side of [-1, 1]) p.push(...turned(windowAt(0, fy + h * 0.55, 0, trim, undefined, 1.3, 1.4), (side * Math.PI) / 2, side * (w / 2), 0));
    if (f > 0) p.push(part(BOX, trim, { p: [0, fy, d / 2 + 0.1], s: [w + 0.2, 0.25, 0.2] }));
  }
  if (porch) {
    // Corredor: columnas que sostienen el alero, baranda con sus palitos y la escalera que baja al frente.
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) p.push(part(BOX, trim, { p: [x, y0 + h / 2, front - 0.3], s: [0.3, h, 0.3] }));
    p.push(part(BOX, trim, { p: [-0.9, y0 + 1.1, front - 0.3], s: [w - 2.4, 0.18, 0.18] }));
    if (FINE) for (let x = -w / 2 + 0.9; x < w / 2 - 2; x += 0.75) p.push(part(BOX, trim, { p: [x, y0 + 0.55, front - 0.3], s: [0.1, 1.1, 0.1] }));
    for (let k = 0; k < 4; k++) p.push(part(BOX, FLOOR, { p: [w / 2 - 1.1, stilts - (k + 1) * (stilts / 4.4), front + 0.5 + k * 0.7], s: [1.5, 0.22, 0.75] }));
  }
  const ry = y0 + H;
  p.push(...zincRoof(w + 1.1, d + pd + 1, thatch ? 3.6 : 2.2, ry, pd / 2, roof, thatch ? 0 : rust, thatch));
  if (tank) {
    // Tanque de agua lluvia sobre su base de madera, al costado.
    const tx = -w / 2 - 1.5;
    p.push(pole(STILT, [tx - 0.6, -2, -0.6], [tx - 0.6, 2.2, -0.6], 0.16), pole(STILT, [tx + 0.6, -2, 0.6], [tx + 0.6, 2.2, 0.6], 0.16));
    p.push(part(BOX, FLOOR, { p: [tx, 2.2, 0], s: [2, 0.25, 2] }));
    p.push(part(CYL, '#25282a', { p: [tx, 3.6, 0], s: [0.95, 2.6, 0.95] }), part(CYL, '#33373a', { p: [tx, 5, 0], s: [0.75, 0.3, 0.75] }));
  }
  return p;
}

export interface MaterialOpts {
  wall: string;
  accent: string;
  /** Pisos terminados (pintados). */
  floors?: number;
  /** Un piso más arriba, sin terminar: ladrillo y varillas. */
  unfinished?: boolean;
  w?: number;
  d?: number;
  /** Tienda en el primer piso (cortina metálica y letrero). */
  shop?: boolean;
  /** Techo de zinc de una sola agua en vez de terraza. */
  shed?: boolean;
}

/** Casa de material (bloque y concreto) de las cabeceras y las ciudades. */
export function casaMaterial({ wall, accent, floors = 2, unfinished = false, w = 7, d = 6.4, shop = true, shed = false }: MaterialOpts): Parts {
  const p: Parts = [];
  const h = 4;
  // Cimiento (baja bajo el suelo).
  p.push(part(BOX, CEMENT, { p: [0, -1.2, 0], s: [w + 0.3, 3, d + 0.3] }));
  for (let f = 0; f < floors; f++) {
    const fy = 0.3 + f * h;
    p.push(part(BOX, wall, { p: [0, fy + h / 2, 0], s: [w, h, d] }));
    // La losa: una franja de cemento entre pisos.
    p.push(part(BOX, CEMENT, { p: [0, fy + h, 0], s: [w + 0.25, 0.4, d + 0.25] }));
    if (f === 0 && shop) {
      // La tienda: cortina metálica (con sus franjas), la puerta de la casa y el letrero de color encima.
      p.push(part(BOX, '#8d9396', { p: [w * 0.12, fy + 1.45, d / 2 + 0.06], s: [w * 0.55, 2.9, 0.1] }));
      if (FINE) for (let y = 0.4; y < 2.8; y += 0.45) p.push(part(BOX, '#757b7e', { p: [w * 0.12, fy + y, d / 2 + 0.12], s: [w * 0.55, 0.06, 0.06] }));
      p.push(part(BOX, accent, { p: [w * 0.12, fy + 3.35, d / 2 + 0.12], s: [w * 0.6, 0.8, 0.12] }));
      p.push(part(BOX, '#f6f2e8', { p: [w * 0.12, fy + 3.35, d / 2 + 0.2], s: [w * 0.4, 0.22, 0.05] }));
      p.push(...doorAt(-w * 0.34, fy, d / 2, '#e9e4d8', '#6b4a32', 1.2, 2.7));
    } else if (f === 0) {
      p.push(...doorAt(-w * 0.22, fy, d / 2, '#e9e4d8', '#6b4a32', 1.3, 2.8));
      p.push(...windowAt(w * 0.22, fy + 2.2, d / 2, '#e9e4d8', undefined, 1.8, 1.4));
    } else {
      // Balcón con baranda (a veces de vidrio oscuro, a veces de reja de color) y dos ventanas.
      p.push(part(BOX, CEMENT, { p: [0, fy + 0.1, d / 2 + 0.7], s: [w * 0.8, 0.3, 1.4] }));
      p.push(part(BOX, accent, { p: [0, fy + 1.1, d / 2 + 1.35], s: [w * 0.8, 0.12, 0.12] }));
      if (FINE) for (let x = -w * 0.38; x <= w * 0.38; x += 0.6) p.push(part(BOX, accent, { p: [x, fy + 0.65, d / 2 + 1.35], s: [0.08, 0.9, 0.08] }));
      p.push(...doorAt(-w * 0.18, fy, d / 2, '#e9e4d8', '#3a4a52', 1.3, 2.7));
      p.push(...windowAt(w * 0.24, fy + 2, d / 2, '#e9e4d8', undefined, 1.6, 1.5));
    }
    // A los lados, una ventana por piso.
    if (FINE) for (const side of [-1, 1]) p.push(...turned(windowAt(0, fy + 2, 0, '#e9e4d8', undefined, 1.3, 1.3), (side * Math.PI) / 2, side * (w / 2), 0));
  }
  const top = 0.3 + floors * h + 0.2;
  if (unfinished) {
    // El piso que falta: muros de ladrillo a medio subir, columnas con las varillas saliendo y el tanque negro.
    p.push(part(BOX, BRICK, { p: [0, top + 1, -d * 0.15], s: [w, 2, d * 0.7] }));
    if (FINE) for (let y = 0.5; y < 2; y += 0.5) p.push(part(BOX, shade(BRICK, 0.85), { p: [0, top + y, -d * 0.15], s: [w + 0.05, 0.06, d * 0.7 + 0.05] }));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        p.push(part(BOX, CEMENT, { p: [sx * (w / 2 - 0.2), top + 1.4, sz * (d / 2 - 0.2)], s: [0.45, 2.8, 0.45] }));
        for (const o of [-0.12, 0.12]) p.push(pole('#5a4a40', [sx * (w / 2 - 0.2) + o, top + 2.7, sz * (d / 2 - 0.2)], [sx * (w / 2 - 0.2) + o * 1.6, top + 4, sz * (d / 2 - 0.2)], 0.05));
      }
    }
    p.push(part(CYL, '#25282a', { p: [w * 0.25, top + 3.2, -d * 0.2], s: [0.9, 2.2, 0.9] }));
  } else if (shed) {
    // Techo de zinc de una sola agua, cayendo hacia atrás.
    p.push(part(BOX, '#9aa2a4', { p: [0, top + 0.6, 0], s: [w + 0.8, 0.2, d + 0.8], r: [-0.14, 0, 0] }));
    for (let x = -w / 2; x <= w / 2; x += 1.2) p.push(part(BOX, '#b2b9ba', { p: [x, top + 0.72, 0], s: [0.12, 0.08, d + 0.8], r: [-0.14, 0, 0] }));
  } else {
    // Terraza: el muro bajo alrededor y el tanque negro.
    for (const [x, z, sx, sz] of [[0, d / 2, w, 0.25], [0, -d / 2, w, 0.25], [w / 2, 0, 0.25, d], [-w / 2, 0, 0.25, d]]) p.push(part(BOX, wall, { p: [x, top + 0.45, z], s: [sx + 0.2, 0.9, sz + 0.2] }));
    p.push(part(CYL, '#25282a', { p: [-w * 0.25, top + 1.1, -d * 0.2], s: [0.9, 2.2, 0.9] }), part(CYL, '#33373a', { p: [-w * 0.25, top + 2.3, -d * 0.2], s: [0.7, 0.25, 0.7] }));
  }
  return p;
}

/** Capilla de pueblo: blanca, con frontón, una torre corta con su campana y la cruz. */
export function capilla(trim = '#3f6e9a'): Parts {
  const p: Parts = [];
  p.push(part(BOX, CEMENT, { p: [0, -1.2, -1], s: [7.4, 3, 11.4] }));
  p.push(part(BOX, '#f5f1e8', { p: [0, 3.2, -1], s: [7, 6.4, 11] }));
  p.push(part(PRISM, '#8e9698', { p: [0, 6.4, -1], s: [11.6, 3, 7.8], r: [0, Math.PI / 2, 0] }));
  // Frontón y torre al frente.
  p.push(part(PRISM, '#f5f1e8', { p: [0, 6.4, 4.4], s: [0.4, 3, 7], r: [0, Math.PI / 2, 0] }));
  p.push(part(BOX, '#f5f1e8', { p: [0, 6.5, 5.2], s: [2.6, 13, 2.6] }));
  p.push(part(BOX, DARK, { p: [0, 11, 6.52], s: [1.2, 1.8, 0.08] }), part(BALL, '#c9a24a', { p: [0, 10.8, 6.1], s: [0.5, 0.6, 0.5] }));
  p.push(part(CONE4, trim, { p: [0, 14.6, 5.2], s: [2.2, 3.2, 2.2], r: [0, Math.PI / 4, 0] }));
  p.push(part(BOX, '#f5f1e8', { p: [0, 17, 5.2], s: [0.18, 1.8, 0.18] }), part(BOX, '#f5f1e8', { p: [0, 17.3, 5.2], s: [1, 0.18, 0.18] }));
  p.push(...doorAt(0, 0, 6.5, trim, '#6b4a32', 1.4, 3));
  for (const z of [-4.5, -1.5]) for (const side of [-1, 1]) p.push(...turned(windowAt(0, 3.6, 0, trim, undefined, 1, 2.2), (side * Math.PI) / 2, side * 3.5, z));
  return p;
}

/**
 * Catedral de ciudad (como la de San Francisco de Asís en Quibdó, frente al Atrato): una nave larga y alta, la torre
 * alta al frente con su reloj y su remate, y el atrio.
 */
export function catedral(): Parts {
  const p: Parts = [];
  const white = '#f3efe6';
  p.push(part(BOX, CEMENT, { p: [0, -1.4, -2], s: [9.6, 3, 16] }));
  p.push(part(BOX, '#d9d4c8', { p: [0, 0.15, 7.6], s: [10, 0.3, 4] }));
  p.push(part(BOX, white, { p: [0, 4.6, -2], s: [9, 9.2, 15] }));
  p.push(part(PRISM, '#8a4a3a', { p: [0, 9.2, -2], s: [15.6, 3.6, 9.8], r: [0, Math.PI / 2, 0] }));
  // Naves laterales, más bajas.
  for (const side of [-1, 1]) {
    p.push(part(BOX, white, { p: [side * 5.4, 3, -2.5], s: [2.4, 6, 13] }));
    p.push(part(BOX, '#8a4a3a', { p: [side * 5.5, 6.2, -2.5], s: [2.8, 0.35, 13.4], r: [0, 0, side * -0.25] }));
    for (const z of [-7, -3.5, 0, 3]) p.push(...turned(windowAt(0, 3.2, 0, '#c9c2b0', undefined, 0.9, 2.4), (side * Math.PI) / 2, side * 6.6, z));
  }
  // La torre: cuerpo, campanario abierto, reloj y remate en punta.
  p.push(part(BOX, white, { p: [0, 8.5, 5.4], s: [4, 17, 4] }));
  p.push(part(BOX, '#e6e0d2', { p: [0, 17.3, 5.4], s: [4.4, 0.5, 4.4] }));
  p.push(part(BOX, white, { p: [0, 19.2, 5.4], s: [3.4, 3.4, 3.4] }));
  for (const side of [-1, 1]) p.push(part(BOX, DARK, { p: [side * 1.72, 19.3, 5.4], s: [0.08, 2, 1.2] }));
  p.push(part(BOX, DARK, { p: [0, 19.3, 7.12], s: [1.2, 2, 0.08] }));
  p.push(part(CYL, '#f8f6f0', { p: [0, 14.5, 7.45], s: [1.1, 0.12, 1.1], r: [Math.PI / 2, 0, 0] }), part(CYL, DARK, { p: [0, 14.5, 7.52], s: [0.9, 0.06, 0.9], r: [Math.PI / 2, 0, 0] }));
  p.push(part(CONE4, '#8a4a3a', { p: [0, 23.4, 5.4], s: [2.6, 5, 2.6], r: [0, Math.PI / 4, 0] }));
  p.push(part(BOX, '#e6e0d2', { p: [0, 26.6, 5.4], s: [0.18, 1.8, 0.18] }), part(BOX, '#e6e0d2', { p: [0, 26.9, 5.4], s: [1, 0.18, 0.18] }));
  p.push(...doorAt(0, 0.3, 7.4, '#c9c2b0', '#6b4a32', 1.8, 3.8));
  for (const side of [-1, 1]) p.push(...doorAt(side * 3.2, 0.3, 5.5, '#c9c2b0', '#6b4a32', 1.1, 2.8));
  return p;
}

/** Platanera: el seudotallo y sus hojas anchas, caídas. */
export function platano(h = 6, turn = 0): Parts {
  const p: Parts = [pole('#7c8a4a', [0, -0.5, 0], [0, h, 0], 0.35)];
  for (let k = 0; k < 6; k++) p.push(part(BLADE, k % 2 ? '#5fa83e' : '#6fb848', { p: [0, h, 0], s: [1.1, 0.25, 3.6], r: [-0.25 - (k % 3) * 0.2, turn + k * 1.05, 0], o: 'YXZ' }));
  p.push(part(BALL, '#4f7a2e', { p: [0.4, h - 1.2, 0.3], s: [0.5, 0.9, 0.5] }));
  return p;
}

/** Árbol de patio (mango, almendro): tronco y una copa ancha de varias bolas. */
export function arbol(h = 7, leaf = '#3f8a3a'): Parts {
  return [
    pole('#6d5238', [0, -0.5, 0], [0.3, h, 0], 0.5),
    part(BALL, leaf, { p: [0.3, h + 1.6, 0], s: [3.6, 2.6, 3.4] }),
    part(BALL, shade(leaf, 0.86), { p: [-1.8, h + 0.8, 1], s: [2.4, 2, 2.4] }),
    part(BALL, shade(leaf, 1.1), { p: [2, h + 1, -0.8], s: [2.5, 2.1, 2.4] }),
  ];
}

/** Ropa tendida entre dos palos (detalle de patio). */
export function tendedero(colors: string[]): Parts {
  const p: Parts = [pole(STILT, [-2.2, -0.5, 0], [-2.2, 3, 0], 0.1), pole(STILT, [2.2, -0.5, 0], [2.2, 3, 0], 0.1), part(BOX, '#e8e4dc', { p: [0, 2.9, 0], s: [4.4, 0.05, 0.05] })];
  colors.forEach((c, k) => p.push(part(BOX, c, { p: [-1.5 + k * 1, 2.3, 0], s: [0.8, 1.1, 0.06] })));
  return p;
}

/** Tambo emberá: plataforma redonda en pilotes, sin paredes, con su techo cónico de palma y la escalera de tronco. */
export function tambo(): Parts {
  const p: Parts = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    p.push(pole(STILT, [Math.cos(a) * 3, -3, Math.sin(a) * 3], [Math.cos(a) * 3, 6.4, Math.sin(a) * 3], 0.22));
  }
  p.push(part(CYL, FLOOR, { p: [0, 2.8, 0], s: [3.6, 0.4, 3.6] }));
  p.push(part(CONE, '#c9a85a', { p: [0, 8.6, 0], s: [5.2, 5, 5.2] }), part(CONE, '#b08f48', { p: [0, 7, 0], s: [5.6, 1.6, 5.6] }));
  // La escalera: un tronco inclinado con muescas.
  p.push(pole('#7a5a3a', [0.5, -0.4, 5.6], [0.3, 2.8, 3.4], 0.3));
  for (let k = 1; k < 4; k++) p.push(part(BOX, shade('#7a5a3a', 0.7), { p: [0.4, -0.4 + k * 0.8, 5.6 - k * 0.55], s: [0.7, 0.1, 0.2] }));
  return p;
}
