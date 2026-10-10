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
  /** En el suelo; en el agua más cercana (si no hay, se omite: `seaOrGround` cae al suelo); o en el aire. */
  on: 'ground' | 'sea' | 'seaOrGround' | 'air';
  /** Radio que ocupa (para abrir el claro en la vegetación). */
  r: number;
}

const piece = (parts: Parts, x: number, z: number, on: Chunk['on'] = 'ground', r = 5, s = 1): Chunk => {
  const geo = mergeGeometries(parts)!;
  geo.applyMatrix4(new Matrix4().makeScale(UNIT * s, UNIT * s, UNIT * s));
  return { geo, x: x * UNIT, z: z * UNIT, on, r: r * UNIT * s };
};

function house(wall: string, roof: string, k = 1, floors = 1) {
  const h = 8 * k * floors;
  return [
    part(BOX, wall, { p: [0, h / 2, 0], s: [7 * k, h, 6 * k] }),
    part(CONE4, roof, { p: [0, h + 2.4 * k, 0], s: [6.4 * k, 4.8 * k, 5.6 * k], r: [0, Math.PI / 4, 0] }),
    part(BOX, '#3b2c22', { p: [0, 2.2 * k, 3.05 * k], s: [1.8 * k, 3.4 * k, 0.2] }),
    ...(floors > 1 ? [part(BOX, '#3b2c22', { p: [0, h * 0.75, 3.05 * k], s: [3 * k, 2 * k, 0.2] })] : []),
  ];
}

/** Casa de madera en zancos con techo de palma (los caseríos de la costa y de los ríos). */
function rancho(turn = 0) {
  const parts: Parts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(pole('#5a4330', [sx * 2.6, -1, sz * 2.1], [sx * 2.6, 3.2, sz * 2.1], 0.35));
  parts.push(part(BOX, '#8a6a48', { p: [0, 3.3, 0], s: [7, 0.5, 6] }));
  parts.push(part(BOX, '#a8825a', { p: [0, 5.6, 0], s: [6, 4.2, 5] }));
  parts.push(part(BOX, '#3b2c22', { p: [0, 5, 2.55], s: [1.4, 2.8, 0.2] }));
  parts.push(part(CONE4, '#c9a85a', { p: [0, 10, 0], s: [6.6, 4.8, 5.8], r: [0, Math.PI / 4, 0] }));
  const g = mergeGeometries(parts)!;
  g.rotateY(turn);
  return [g];
}

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

// ───────── Escenas principales ─────────

const MAIN: Record<Figure['main'], () => Chunk[]> = {
  // Muchas casas de colores, edificios de dos y tres pisos y la iglesia con su torre.
  ciudad: () => [
    // La iglesia en la plaza y, alrededor, las casas separadas por calles.
    piece([
      part(BOX, '#f6f1e6', { p: [0, 4.5, -2], s: [6, 9, 8] }),
      part(CONE4, '#8a4a3a', { p: [0, 11, -2], s: [5.4, 3.5, 7.4], r: [0, Math.PI / 4, 0] }),
      part(BOX, '#f6f1e6', { p: [0, 10, 2.5], s: [3, 20, 3] }),
      part(CONE4, '#8a4a3a', { p: [0, 22, 2.5], s: [2.6, 4.5, 2.6], r: [0, Math.PI / 4, 0] }),
    ], 0, 0, 'ground', 6),
    piece(house('#f2e3c6', '#c4553a', 0.85, 2), -14, 12),
    piece(house('#9fc7d6', '#7a4a32', 0.8), 1, 18),
    piece(house('#f4c8a0', '#b84a4a', 0.85, 3), 17, 6),
    piece(house('#e8d5a0', '#8a4a3a', 0.8), -18, -6),
    piece(house('#c9e0c0', '#b84a4a', 0.8, 2), 14, -13),
    piece(house('#f2d0b8', '#8a4a3a', 0.75), -4, -20),
    piece(house('#f6e0a8', '#c4553a', 0.75), 20, 20),
    piece(house('#d8c8e8', '#7a4a32', 0.8, 2), -21, 21),
    piece(house('#f0c0b0', '#8a4a3a', 0.7), -23, 5),
  ],
  // Pueblo cabecera: algunas casas de material, una de dos pisos.
  cabecera: () => [
    piece(house('#f2e3c6', '#c4553a', 1.0), -4.5, 2),
    piece(house('#9fc7d6', '#7a4a32', 0.85, 2), 4, 3),
    piece(house('#f4c8a0', '#b84a4a', 1.05), 0.5, -4.5),
  ],
  // Caserío: casas de madera en zancos con techo de palma.
  rancho: () => [piece(rancho(0.3), -3.5, 1.5, 'ground', 5, 0.95), piece(rancho(-0.4), 3.5, -2.5, 'ground', 5, 0.85), piece(tree(8, '#3f8a3a', 0.8), 4.5, 5, 'ground', 3)],
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
  // Cabo: rocas que salen del agua, con una palma.
  cabo: () => [
    piece([part(ROCK, '#8a8478', { p: [0, 1.5, 0], s: [6, 7, 5] }), part(ROCK, '#7a7468', { p: [4.5, 0, -2.5], s: [2.4, 3, 2.4] })], 0, 0, 'ground', 7),
    piece([part(ROCK, '#a09a8c', { p: [0, 0.5, 0], s: [3.5, 4.5, 3.5] })], 5, 5, 'seaOrGround', 4),
    piece(palm(12, 0.3), -3, -3, 'ground', 3),
  ],
};

// ───────── Detalles ─────────

const EXTRA: Record<FigureExtra, () => Chunk> = {
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
  ], -7, 7, 'ground', 3),
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
export function figureChunks(fig: Figure): Chunk[] {
  const extras = (fig.extra ?? []).map((e) => {
    const c = EXTRA[e]();
    // En la ciudad, el cununo va en la plaza, frente a la iglesia, y la canoa más allá de las casas.
    const spot = fig.main === 'ciudad' ? CITY_SLOT[e] : undefined;
    return spot ? { ...c, x: spot[0] * UNIT, z: spot[1] * UNIT } : c;
  });
  return [...MAIN[fig.main](), ...extras];
}
const CITY_SLOT: Partial<Record<FigureExtra, [number, number]>> = { cununo: [5, 7], canoa: [8, 30], lancha: [-6, 32] };

/** Las seis figuritas de las historias: las mismas piezas. */
const STORY: Record<Emblem, () => Chunk[]> = {
  pueblo: MAIN.cabecera,
  selva: MAIN.selva,
  mar: MAIN.playa,
  rio: () => [{ ...EXTRA.canoa(), x: 0, z: 0 }, piece(tree(9, '#3f8a3a'), -5, -3, 'ground', 4)],
  cultura: () => [{ ...EXTRA.cununo(), x: 0, z: 0 }, piece(rancho(0.2), -6, -4, 'ground', 5, 0.8)],
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
