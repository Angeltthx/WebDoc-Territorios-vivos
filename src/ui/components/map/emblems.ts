// Figuritas 3D de los puntos del Chocó y de las historias, armadas con piezas de colores (como el resto del mapa).
//
// Cada punto lleva una escena chiquita según lo que es: una ciudad (muchas casas, edificios y la iglesia), un pueblo
// cabecera, un caserío de casas de madera en zancos con techo de palma, una playa, selva, un cerro o un cabo. Encima,
// detalles de lo que lo distingue: la canoa del río, la lancha del mar, la ballena, el cununo de la fiesta, la nube
// de los pueblos más lluviosos, el vapor de las aguas termales.
//
// No llevan base: cada pieza (una casa, una palma, una roca, la lancha) se apoya por separado en el terreno real, en
// su sitio, para que la figurita se integre con el mapa. Por eso cada figurita es una lista de piezas sueltas con su
// lugar y con dónde va: en el suelo, en el mar (la lancha, la ballena: el agua más cercana) o en el aire (la nube).
// Las historias usan seis figuritas (ver `Emblem` en content/choco.ts), hechas con las mismas piezas.

import { type BufferGeometry, Matrix4 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Emblem, Figure, FigureExtra } from '../../../content/choco';
import { type PalafitoOpts, arbol, capilla, casaMaterial, catedral, palafito, platano, tendedero, turned } from './houses';
import { BALL, BLADE, BOX, CONE, CONE4, CYL, ROCK, part, pole } from './kit';

/** Alto aproximado de una figurita, en unidades de la escena (≈ 1 km: se distinguen al acercarse a cada punto). */
export const EMBLEM_SIZE = 110;
/** Las piezas se dibujan en una escala propia (unas 18 unidades de alto). */
const UNIT = EMBLEM_SIZE / 18;

type Parts = BufferGeometry[];
/** Una pieza suelta de una figurita: su forma (centrada en su lugar), dónde va y en qué se apoya. */
export interface Chunk {
  geo: BufferGeometry;
  /** Lugar respecto al punto, en unidades de la escena (+z hacia el mar, antes de girar la figurita). */
  x: number;
  z: number;
  /**
   * En el suelo; en el agua más cercana (si no hay, se omite: `seaOrGround` cae al suelo); o en el aire.
   */
  on: 'ground' | 'sea' | 'seaOrGround' | 'air';
  /** Radio que ocupa (para abrir el claro en la vegetación). */
  r: number;
}

const piece = (parts: Parts, x: number, z: number, on: Chunk['on'] = 'ground', r = 5, s = 1): Chunk => {
  const geo = mergeGeometries(parts)!;
  geo.applyMatrix4(new Matrix4().makeScale(UNIT * s, UNIT * s, UNIT * s));
  return { geo, x: x * UNIT, z: z * UNIT, on, r: r * UNIT * s };
};

const tree = (h: number, leaf: string, k = 1) => [
  part(CYL, '#6d5238', { p: [0, (h * k) / 2 - 0.5, 0], s: [0.9 * k, h * k + 1, 0.9 * k] }),
  part(BALL, leaf, { p: [0, h * k + 3 * k, 0], s: [4.6 * k, 4.2 * k, 4.6 * k] }),
];

function palm(h = 15, lean = 0.2) {
  const top: [number, number, number] = [lean * h, h, 0];
  return [
    pole('#8a6a48', [0, -0.5, 0], top, 0.7),
    ...[0, 1.25, 2.5, 3.75, 5].map((a) => part(BLADE, '#4f9a3c', { p: top, s: [1.3, 0.5, 6.5], r: [-0.45, a, 0] })),
  ];
}

/** Iglesia blanca de pueblo de montaña, con su torre y su reloj. */
function church() {
  return [
    part(BOX, '#f6f1e6', { p: [0, 4.5, -2], s: [6, 9, 9] }),
    part(CONE4, '#9a3f2f', { p: [0, 11, -2], s: [5.4, 3.5, 8.4], r: [0, Math.PI / 4, 0] }),
    part(BOX, '#f6f1e6', { p: [0, 9, 3.2], s: [3.4, 18, 3.4] }),
    part(CYL, '#3b2c22', { p: [0, 14, 4.95], s: [1.6, 0.2, 1.6], r: [Math.PI / 2, 0, 0] }),
    part(CONE4, '#9a3f2f', { p: [0, 20.4, 3.2], s: [3, 5, 3], r: [0, Math.PI / 4, 0] }),
    part(BOX, '#3b2c22', { p: [0, 2.4, 4.95], s: [1.8, 4, 0.2] }),
  ];
}

/** Casa de pueblo de montaña: paredes claras, techo de teja y balcón de madera de color. */
function balconyHouse(wall: string, roof: string, trim: string) {
  return [
    part(BOX, wall, { p: [0, 4.5, 0], s: [7, 9, 6] }),
    part(CONE4, roof, { p: [0, 11, 0], s: [6.6, 4, 5.8], r: [0, Math.PI / 4, 0] }),
    part(BOX, trim, { p: [0, 5.2, 3.5], s: [6, 0.4, 1.4] }),
    part(BOX, trim, { p: [0, 6.1, 4.15], s: [6, 1.4, 0.2] }),
    part(BOX, '#3b2c22', { p: [-1.6, 7.2, 3.05], s: [1.4, 2.2, 0.2] }),
    part(BOX, '#3b2c22', { p: [1.6, 7.2, 3.05], s: [1.4, 2.2, 0.2] }),
    part(BOX, trim, { p: [0, 2, 3.05], s: [1.8, 3.6, 0.2] }),
  ];
}

/** Ciprés: árbol alto y angosto de tierra fría. */
const cypress = (h: number) => [
  part(CYL, '#5a4330', { p: [0, 1, 0], s: [0.7, 2.4, 0.7] }),
  part(CONE, '#2d5a3a', { p: [0, h / 2 + 1.5, 0], s: [2.6, h, 2.6] }),
];

/** Una quebrada que baja en saltos por la ladera, con espuma al caer. */
function stream() {
  const parts: Parts = [];
  for (let k = 0; k < 4; k++) {
    parts.push(part(BOX, '#7ec8e0', { p: [k * 1.2, 6 - k * 2, -k * 3.2], s: [2.2, 0.3, 3.4] }));
    parts.push(part(BOX, '#bfe6f2', { p: [k * 1.2, 5 - k * 2, -k * 3.2 + 1.7], s: [2.2, 2, 0.3] }));
    parts.push(part(BALL, '#ffffff', { p: [k * 1.2, 4.2 - k * 2, -k * 3.2 + 2.3], s: [1.1, 0.6, 0.8] }));
    parts.push(part(ROCK, '#8a8478', { p: [k * 1.2 + 1.8, 5.4 - k * 2, -k * 3.2], s: [1.2, 1.2, 1.2] }));
  }
  return parts;
}

/** Carretera en zigzag por la montaña, con una chiva de colores subiendo. */
function road() {
  const parts: Parts = [];
  const pts: [number, number][] = [[-8, 6], [6, 3], [-6, -1], [7, -5], [-4, -9]];
  for (let k = 0; k < pts.length - 1; k++) {
    const [x0, z0] = pts[k];
    const [x1, z1] = pts[k + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    parts.push(part(BOX, '#9a8a70', { p: [(x0 + x1) / 2, 0.15, (z0 + z1) / 2], s: [len + 1.6, 0.3, 1.6], r: [0, -Math.atan2(z1 - z0, x1 - x0), 0] }));
  }
  // La chiva: cuerpo de madera pintado de colores, techo con carga.
  const chiva = [
    part(BOX, '#e2a33a', { p: [0, 1.6, 0], s: [4.6, 2, 2.2] }),
    part(BOX, '#e2456f', { p: [0, 1, 0], s: [4.7, 0.6, 2.3] }),
    part(BOX, '#3e6197', { p: [0, 2.2, 0], s: [4.7, 0.4, 2.3] }),
    part(BOX, '#f2f2ee', { p: [0, 2.8, 0], s: [4.4, 0.3, 2.1] }),
    part(BOX, '#8a5a3a', { p: [-0.6, 3.3, 0], s: [2.2, 0.8, 1.6] }),
    part(BOX, '#e2a33a', { p: [2.9, 1.4, 0], s: [1.2, 1.6, 2] }),
    part(CYL, '#2a2a2a', { p: [1.6, 0.5, 1.1], s: [1, 0.4, 1], r: [Math.PI / 2, 0, 0] }),
    part(CYL, '#2a2a2a', { p: [-1.6, 0.5, 1.1], s: [1, 0.4, 1], r: [Math.PI / 2, 0, 0] }),
  ];
  const g = mergeGeometries(chiva)!;
  g.rotateY(-Math.atan2(-4, 13));
  g.translate(0, 0.3, 1.5);
  parts.push(g);
  return parts;
}

/** Jirones de neblina alrededor del pueblo. */
const mist = () =>
  [[-12, 10, 3], [10, 12, -6], [0, 9, -14], [-16, 8, -8], [15, 11, 8]].flatMap(([x, y, z], k) => [
    part(BALL, '#f4f2f2', { p: [x, y, z], s: [5 + (k % 2) * 2, 1.2, 2.6] }),
    part(BALL, '#ecebef', { p: [x + 3.5, y + 0.4, z + 0.8], s: [3.4, 1, 2] }),
  ]);

// ───────── Colores de los pueblos ─────────

/** Azar con semilla: cada pueblo arma sus casas a su manera, pero siempre igual. */
interface Rand {
  (): number;
  jitter: (a: number) => number;
}
function rand(seed: number): Rand {
  let t = seed >>> 0 || 1;
  const r = (() => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }) as Rand;
  r.jitter = (a) => (r() * 2 - 1) * a;
  return r;
}
const pick = <T,>(r: Rand, list: readonly T[]) => list[Math.floor(r() * list.length)];

/** Los colores con que se pintan las casas de madera y de material en el Pacífico: vivos y algo gastados. */
const WALLS = ['#3fa7a0', '#f2c14e', '#e8737f', '#5b8fd1', '#7cc47a', '#f1ebdd', '#e98a3c', '#9b7fc4', '#4fb3c9', '#d94f4f'];
const TRIMS = ['#f4efe4', '#f4efe4', '#2f6f8f', '#c8423a', '#2f7a4a', '#f2c14e'];
const ACCENTS = ['#c8423a', '#2f6f8f', '#2f7a4a', '#e2a33a', '#7a2f5a'];
const ZINC = ['#9ea6a8', '#8d9597', '#a7adae', '#7f8789'];

/** Una casa de madera al azar: pintada (o de tabla sin pintar, si `plain`), con su techo de zinc. */
function woodHouse(r: Rand, plain = false): PalafitoOpts {
  const bare = plain || r() < 0.2;
  const wall = bare ? pick(r, ['#a8825a', '#9a7a58', '#b8946a']) : pick(r, WALLS);
  const trim = bare ? pick(r, ['#f4efe4', '#3fa7a0', '#e8737f']) : pick(r, TRIMS.filter((c) => c !== wall));
  return { wall, trim, roof: pick(r, ZINC), shutter: r() < 0.5 ? trim : pick(r, WALLS), rust: Math.floor(r() * 3), tank: r() < 0.45, w: 6.6 + r() * 1.2 };
}

// ───────── Escenas principales ─────────

const MAIN: Record<Figure['main'], (r: Rand) => Chunk[]> = {
  // Ciudad (Quibdó, Istmina): la catedral con su plaza y sus árboles, edificios de material de dos a cuatro pisos (con
  // tiendas, balcones y algún piso sin terminar) y, hacia el río, una hilera de palafitos de madera.
  ciudad: (r) => [
    piece(catedral(), 0, -6, 'ground', 9, 0.85),
    ...[[-5, 9], [5, 10]].map(([x, z], k) => piece(arbol(6 + k, k ? '#3f8a3a' : '#4f9a52'), x, z, 'ground', 3, 0.8)),
    ...[[-16, 8, 3], [16, 7, 2], [-18, -9, 4], [17, -8, 3], [-8, -22, 2], [8, -23, 3], [-27, -1, 2], [27, 0, 2]].map(([x, z, floors], k) =>
      piece(turned(casaMaterial({ wall: pick(r, WALLS), accent: pick(r, ACCENTS), floors, unfinished: k % 3 === 1, shed: k % 4 === 3, shop: k % 2 === 0, w: 8.4, d: 7 }), r.jitter(0.08)), x, z, 'ground', 6, 0.85)),
    ...[-21, -8, 7, 20].map((x) => piece(turned(palafito(woodHouse(r)), r.jitter(0.15)), x, 22 + r.jitter(2), 'ground', 6, 0.8)),
    piece(platano(6), -27, 14, 'ground', 2.5, 0.8),
    piece(platano(5, 1), 27, 13, 'ground', 2.5, 0.8),
  ],
  // Cabecera de municipio: al frente (hacia el río o el mar), palafitos de colores; atrás, casas de material con su
  // tienda y la capilla; entre las casas, plataneras, un árbol de patio y ropa tendida.
  cabecera: (r) => [
    ...[-17, -6, 5, 16].map((x) => piece(turned(palafito(woodHouse(r)), r.jitter(0.18)), x, 11 + r.jitter(1.5), 'ground', 6, 0.85)),
    piece(turned(casaMaterial({ wall: pick(r, WALLS), accent: pick(r, ACCENTS), floors: 2 }), r.jitter(0.1)), -11, -3, 'ground', 6, 0.85),
    piece(turned(casaMaterial({ wall: pick(r, WALLS), accent: pick(r, ACCENTS), floors: 1, unfinished: true, shop: false }), r.jitter(0.1)), 1, -2, 'ground', 6, 0.85),
    piece(turned(palafito({ ...woodHouse(r), floors: 2, porch: false }), r.jitter(0.1)), 13, -3, 'ground', 6, 0.85),
    piece(capilla(pick(r, ['#3f6e9a', '#2f7a5a', '#8a4a3a'])), -1, -16, 'ground', 7, 0.85),
    piece(platano(6), -22, 2, 'ground', 2.5, 0.85),
    piece(platano(5, 1.4), 21, 1, 'ground', 2.5, 0.85),
    piece(platano(6.5, 0.6), 9, -14, 'ground', 2.5, 0.85),
    piece(arbol(7), 14, -15, 'ground', 4, 0.85),
    piece(tendedero(['#e2456f', '#f2c14e', '#3e6197', '#f4efe4']), -6, 3, 'ground', 2, 0.85),
  ],
  // Caserío (corregimiento): pocas casas de madera en pilotes, unas pintadas y otras de tabla sin pintar, una con
  // techo de palma; plataneras, una palma y ropa tendida.
  rancho: (r) => [
    piece(turned(palafito({ ...woodHouse(r), rust: 2 }), 0.25), -7, 3, 'ground', 6, 0.85),
    piece(turned(palafito(woodHouse(r, true)), -0.3), 6, -2, 'ground', 6, 0.85),
    piece(turned(palafito({ wall: '#a8825a', trim: '#8f6d4c', roof: '#c9a85a', thatch: true, porch: false, w: 6, d: 5 }), 0.1), -2, -12, 'ground', 5, 0.85),
    piece(turned(palafito({ ...woodHouse(r), w: 6, porch: false }), -0.5), 13, 9, 'ground', 5, 0.8),
    piece(platano(6), -14, -4, 'ground', 2.5, 0.85),
    piece(platano(5, 1.2), 1, 9, 'ground', 2.5, 0.85),
    piece(platano(5.5, 2.2), 10, -11, 'ground', 2.5, 0.85),
    piece(palm(14, 0.2), -13, 8, 'ground', 3, 0.85),
    piece(tendedero(['#f4efe4', '#e2456f', '#3fa7a0']), 0, 4, 'ground', 2, 0.8),
  ],
  playa: () => [piece(palm(15, 0.25), -2, -1, 'ground', 3), piece(palm(12, -0.2), 2, -4, 'ground', 3), piece(palm(13, 0.15), 5, 2, 'ground', 3)],
  selva: () => [
    piece(tree(11, '#2f6b2c'), -4, 1, 'ground', 4),
    piece(tree(14, '#3f8a3a'), 3.5, -2.5, 'ground', 4),
    piece(tree(9, '#5aa244'), 2.5, 4.5, 'ground', 4),
    piece(tree(8, '#4a8a36', 0.8), -1.5, -5, 'ground', 4),
  ],
  // Cerro: árboles y, arriba, una bandera de cumbre.
  cerro: () => [
    piece([pole('#e8e2d4', [0, -0.5, 0], [0, 14, 0], 0.35), part(BOX, '#e2456f', { p: [2.2, 12.6, 0], s: [4.4, 2.6, 0.2] })], 0, 0, 'ground', 2),
    piece(tree(9, '#2f6b2c'), -5, 2, 'ground', 4),
    piece(tree(11, '#3f8a3a'), 4.5, -2.5, 'ground', 4),
    piece(tree(7, '#5aa244', 0.8), 1.5, 5, 'ground', 4),
  ],
  // Pueblo de montaña (El Carmen de Atrato, en la cordillera): casas de balcón en terrazas por la ladera, la iglesia
  // blanca en la plaza, cipreses de clima frío, una quebrada que baja en saltos, la carretera en zigzag con una chiva
  // subiendo y la neblina enredada en el pueblo.
  montana: () => [
    piece(church(), 0, 0, 'ground', 6),
    // La plaza: un piso de piedra con su árbol.
    piece([part(BOX, '#b8ae9c', { p: [0, 0.1, 0], s: [9, 0.6, 7] }), ...tree(5, '#3f8a3a', 0.7).map((g) => g.clone().translate(3, 0, 2))], 0, 7, 'ground', 5),
    ...[[-9, 5, '#f4efe4', '#b84a3a', '#2f7a5a'], [9, 6, '#f2e8d0', '#a8452f', '#c4553a'], [-12, -5, '#efe6d6', '#b84a3a', '#3e6197'],
      [11, -6, '#f6f1e6', '#9a3f2f', '#e2a33a'], [-4, -11, '#f2e3c6', '#b84a3a', '#7a2f5a'], [5, -13, '#f4efe4', '#a8452f', '#2f7a5a'],
      [-15, 12, '#f2e8d0', '#9a3f2f', '#c4553a']].map(([x, z, wall, roof, trim]) =>
      piece(balconyHouse(wall as string, roof as string, trim as string), x as number, z as number, 'ground', 5)),
    // Cipreses alrededor (clima frío).
    ...[[-18, -2], [17, 1], [-8, -18], [14, -16], [19, 12], [-20, 6], [2, -20]].map(([x, z], k) => piece(cypress(9 + (k % 3) * 2.5), x, z, 'ground', 2.5)),
    // La quebrada: baja en saltos a un lado del pueblo.
    piece(stream(), -22, -12, 'ground', 6),
    // La carretera en zigzag, con una chiva.
    piece(road(), 20, 18, 'ground', 9),
    // Neblina: jirones blancos a media altura, alrededor.
    piece(mist(), 0, 0, 'air', 0),
  ],
  // Cabo: rocas que salen del agua, con una palma.
  cabo: () => [
    piece([part(ROCK, '#8a8478', { p: [0, 1.5, 0], s: [6, 7, 5] }), part(ROCK, '#7a7468', { p: [4.5, 0, -2.5], s: [2.4, 3, 2.4] })], 0, 0, 'ground', 7),
    piece([part(ROCK, '#a09a8c', { p: [0, 0.5, 0], s: [3.5, 4.5, 3.5] })], 5, 5, 'seaOrGround', 4),
    piece(palm(12, 0.3), -3, -3, 'ground', 3),
  ],
};

// ───────── Detalles ─────────

/** Los detalles que son una pieza (la cascada no: se dibuja sobre la ladera misma, ver `buildFall` en MapScene). */
const EXTRA: Record<Exclude<FigureExtra, 'cascada'>, () => Chunk> = {
  // Potrillo con su remo: en el agua si hay cerca; si no, en tierra junto a las casas.
  canoa: () => piece([
    part(BOX, '#7a4a2a', { p: [0, 0.5, 0], s: [7, 1.2, 1.8] }),
    part(CONE, '#7a4a2a', { p: [4.3, 0.5, 0], s: [0.9, 1.6, 0.6], r: [0, 0, -Math.PI / 2] }),
    part(CONE, '#7a4a2a', { p: [-4.3, 0.5, 0], s: [0.9, 1.6, 0.6], r: [0, 0, Math.PI / 2] }),
    pole('#c9a26a', [1, 0, 1.6], [-1.5, 5.5, -0.6], 0.22),
  ], 7, 8, 'seaOrGround', 5),
  // Lancha de la costa, en el mar.
  lancha: () => piece([
    part(BOX, '#f2f2ee', { p: [0, 0.6, 0], s: [7, 1.6, 2.6] }),
    part(BOX, '#3e6197', { p: [0, 0.1, 0], s: [7.1, 0.5, 2.7] }),
    part(CONE, '#f2f2ee', { p: [4.4, 0.6, 0], s: [1.3, 1.8, 0.8], r: [0, 0, -Math.PI / 2] }),
    part(BOX, '#3a3a3a', { p: [-3.8, 1.2, 0], s: [0.9, 1.6, 0.8] }),
  ], -6, 9, 'sea', 5),
  // Cola de ballena saliendo del mar.
  ballena: () => piece([
    part(BALL, '#4a4f5a', { p: [-2.5, 0, 0], s: [4, 1.2, 2] }),
    pole('#4a4f5a', [0, 0, 0], [1.5, 4.5, 0], 0.6),
    part(CONE, '#4a4f5a', { p: [0.4, 5.6, 0], s: [0.8, 3.6, 0.5], r: [0, 0, 1.15] }),
    part(CONE, '#4a4f5a', { p: [2.6, 5.6, 0], s: [0.8, 3.6, 0.5], r: [0, 0, -1.15] }),
  ], 4, 16, 'sea', 5),
  // Cununo: el tambor de la música del Pacífico.
  cununo: () => piece([
    part(CYL, '#8a4a2a', { p: [0, 3.3, 0], s: [3.4, 6.6, 3.4] }),
    part(CYL, '#f2e3c6', { p: [0, 6.7, 0], s: [3.7, 0.4, 3.7] }),
    part(CYL, '#e2456f', { p: [0, 0.6, 0], s: [3.6, 0.8, 3.6] }),
    ...[0, 1, 2, 3].map((k) => pole('#e2c38a', [Math.cos(k * 1.57) * 1.75, 0.8, Math.sin(k * 1.57) * 1.75], [Math.cos(k * 1.57 + 0.5) * 1.85, 6.5, Math.sin(k * 1.57 + 0.5) * 1.85], 0.18)),
  ], -7, 7, 'ground', 2, 0.55),
  // Nube con lluvia (los pueblos más lluviosos del mundo), sobre el pueblo.
  lluvia: () => piece([
    part(BALL, '#e4e6ec', { p: [0, 22, 0], s: [4.5, 3, 4] }),
    part(BALL, '#d6d9e2', { p: [3.6, 21.5, 0.5], s: [3.4, 2.4, 3.2] }),
    part(BALL, '#eceef2', { p: [-3.4, 21.6, -0.5], s: [3.2, 2.3, 3] }),
    ...[-3, -1, 1, 3].map((x, k) => pole('#8fb6e0', [x, 19 - (k % 2) * 2, (k % 2) - 0.5], [x - 0.5, 15 - (k % 2) * 2, (k % 2) - 0.5], 0.18)),
  ], 0, 0, 'air', 0),
  // Pozo de agua caliente con su vapor, junto a las casas.
  termal: () => piece([
    part(CYL, '#9a9088', { p: [0, 0.2, 0], s: [6.4, 0.8, 6.4] }),
    part(CYL, '#7ec8d0', { p: [0, 0.65, 0], s: [5.4, 0.2, 5.4] }),
    part(BALL, '#f4f4f0', { p: [0.4, 3.5, 0], s: [1.6, 1.4, 1.6] }),
    part(BALL, '#f4f4f0', { p: [-0.6, 6, 0.3], s: [1.3, 1.1, 1.3] }),
    part(BALL, '#f4f4f0', { p: [0.3, 8.2, -0.2], s: [1, 0.9, 1] }),
  ], 3, -8, 'ground', 4),
};

/** Las piezas de la figurita de un punto del mapa. */
export function figureChunks(fig: Figure, seed = 1): Chunk[] {
  const r = rand(seed);
  const extras = (fig.extra ?? []).filter((e): e is Exclude<FigureExtra, 'cascada'> => e !== 'cascada').map((e) => {
    const c = EXTRA[e]();
    // En la ciudad, el cununo va en la plaza, frente a la iglesia, y la canoa más allá de las casas.
    const spot = fig.main === 'ciudad' ? CITY_SLOT[e] : undefined;
    return spot ? { ...c, x: spot[0] * UNIT, z: spot[1] * UNIT } : c;
  });
  // El pueblo de montaña se extiende por la ladera: sus piezas más separadas.
  const main = fig.main === 'montana' ? MAIN.montana(r).map((c) => ({ ...c, x: c.x * 1.45, z: c.z * 1.45 })) : MAIN[fig.main](r);
  return [...main, ...extras];
}
const CITY_SLOT: Partial<Record<Exclude<FigureExtra, 'cascada'>, [number, number]>> = { cununo: [0, 15], canoa: [8, 30], lancha: [-6, 32] };

/** Las seis figuritas de las historias: las mismas piezas. */
const STORY: Record<Emblem, () => Chunk[]> = {
  pueblo: () => [
    piece(turned(palafito({ wall: '#3fa7a0', trim: '#f4efe4', roof: '#9ea6a8', tank: true }), 0.2), -4, 2, 'ground', 6, 0.8),
    piece(turned(palafito({ wall: '#f2c14e', trim: '#2f6f8f', roof: '#8d9597', porch: false }), -0.3), 6, -4, 'ground', 6, 0.75),
    piece(platano(6), 7, 7, 'ground', 2.5, 0.8),
  ],
  selva: () => MAIN.selva(rand(1)),
  mar: () => MAIN.playa(rand(1)),
  rio: () => [{ ...EXTRA.canoa(), x: 0, z: 0 }, piece(tree(9, '#3f8a3a'), -5, -3, 'ground', 4)],
  cultura: () => [{ ...EXTRA.cununo(), x: 0, z: 0 }, piece(turned(palafito({ wall: '#e8737f', trim: '#f4efe4', roof: '#9ea6a8' }), 0.2), -7, -5, 'ground', 6, 0.75)],
  cocina: () => [piece([
    ...[0, 2.1, 4.2].map((a) => part(BOX, '#9a9088', { p: [Math.cos(a) * 4, 1, Math.sin(a) * 4], s: [3, 2.4, 2.4], r: [0, -a, 0] })),
    part(CONE, '#f29a3a', { p: [0, 2.4, 0], s: [2.6, 4.5, 2.6] }),
    part(BALL, '#b5653a', { p: [0, 6.8, 0], s: [5.8, 4.6, 5.8] }),
    part(CYL, '#8a4526', { p: [0, 10.7, 0], s: [4.6, 0.9, 4.6] }),
    part(BALL, '#f2f2ee', { p: [0.8, 13.3, 0], s: [1.6, 1.5, 1.6] }),
    part(BALL, '#f2f2ee', { p: [-0.6, 15.8, 0.4], s: [1.2, 1.1, 1.2] }),
  ], 0, 0, 'ground', 6)],
};

/** Las piezas de la figurita de una historia, según su tipo. */
export const storyChunks = (kind: Emblem) => STORY[kind]();
