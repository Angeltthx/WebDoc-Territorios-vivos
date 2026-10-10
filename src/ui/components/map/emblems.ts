// Figuritas 3D de los puntos del Chocó y de las historias, armadas con piezas de colores (como el resto del mapa).
//
// Cada punto lleva una escena chiquita según lo que es: una ciudad (muchas casas, edificios y la iglesia), un pueblo
// cabecera, un caserío de casas de madera en zancos con techo de palma, una playa, selva, un cerro o un cabo. Encima,
// detalles de lo que lo distingue: la canoa del río, la lancha del mar, la ballena, el cununo de la fiesta, la nube
// de los pueblos más lluviosos, el vapor de las aguas termales.
//
// Las historias usan seis figuritas (ver `Emblem` en content/choco.ts), hechas con las mismas piezas.
// Todas las del mapa se funden en una sola malla: un solo dibujo para todas.

import { type BufferGeometry, Matrix4 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Emblem, Figure, FigureExtra } from '../../../content/choco';
import { BALL, BLADE, BOX, CONE, CONE4, CYL, ORB, ROCK, part, pole } from './kit';

/** Alto aproximado de una figurita, en unidades de la escena (≈ 1 km: se distinguen al acercarse a cada punto). */
export const EMBLEM_SIZE = 110;
/** Las piezas se dibujan en una escala propia (una base de radio 8, unas 18 unidades de alto). */
const UNIT = EMBLEM_SIZE / 18;

type Parts = BufferGeometry[];
/** Junta piezas y las corre (x, z), las escala y las gira: para poner un detalle al lado de la escena principal. */
const at = (parts: Parts, x: number, z: number, s = 1, turn = 0) => {
  const g = mergeGeometries(parts)!;
  g.applyMatrix4(new Matrix4().makeTranslation(x, 0, z).multiply(new Matrix4().makeScale(s, s, s)).multiply(new Matrix4().makeRotationY(turn)));
  return g;
};

const base = (color: string, r = 8) => part(CYL, color, { p: [0, 0.6, 0], s: [r * 2, 1.2, r * 2] });
const water = (r: number, x = 0, z = 0) => part(CYL, '#3f8fb0', { p: [x, 1.25, z], s: [r * 2, 0.2, r * 2] });

function house(x: number, z: number, wall: string, roof: string, k = 1, floors = 1) {
  const h = 8 * k * floors;
  return [
    part(BOX, wall, { p: [x, h / 2 + 1.2, z], s: [7 * k, h, 6 * k] }),
    part(CONE4, roof, { p: [x, h + 2.4 * k + 1.2, z], s: [6.4 * k, 4.8 * k, 5.6 * k], r: [0, Math.PI / 4, 0] }),
    part(BOX, '#3b2c22', { p: [x, 2.6 * k + 1.2, z + 3.05 * k], s: [1.8 * k, 3.4 * k, 0.2] }),
    ...(floors > 1 ? [part(BOX, '#3b2c22', { p: [x, h * 0.75 + 1.2, z + 3.05 * k], s: [3 * k, 2 * k, 0.2] })] : []),
  ];
}

/** Casa de madera en zancos con techo de palma (los caseríos de la costa y de los ríos). */
function rancho(x: number, z: number, k = 1, turn = 0) {
  const parts: Parts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(pole('#5a4330', [sx * 2.6, 0, sz * 2.1], [sx * 2.6, 3.2, sz * 2.1], 0.35));
  parts.push(part(BOX, '#8a6a48', { p: [0, 3.3, 0], s: [7, 0.5, 6] }));
  parts.push(part(BOX, '#a8825a', { p: [0, 5.6, 0], s: [6, 4.2, 5] }));
  parts.push(part(BOX, '#3b2c22', { p: [0, 5, 2.55], s: [1.4, 2.8, 0.2] }));
  parts.push(part(CONE4, '#c9a85a', { p: [0, 10, 0], s: [6.6, 4.8, 5.8], r: [0, Math.PI / 4, 0] }));
  return at(parts, x, z, k, turn);
}

function tree(x: number, z: number, h: number, leaf: string, k = 1) {
  return [
    part(CYL, '#6d5238', { p: [x, (h * k) / 2 + 1.2, z], s: [0.9 * k, h * k, 0.9 * k] }),
    part(BALL, leaf, { p: [x, h * k + 3 * k, z], s: [4.6 * k, 4.2 * k, 4.6 * k] }),
  ];
}

function palm(x: number, z: number, h = 15, lean = 0.2) {
  const top: [number, number, number] = [x + lean * h, h, z];
  return [
    pole('#8a6a48', [x, 1.2, z], top, 0.7),
    ...[0, 1.25, 2.5, 3.75, 5].map((a) => part(BLADE, '#4f9a3c', { p: top, s: [1.3, 0.5, 6.5], r: [-0.45, a, 0] })),
  ];
}

// ───────── Escenas principales ─────────

const MAIN: Record<Figure['main'], () => Parts> = {
  // Muchas casas de colores, edificios de dos y tres pisos y la iglesia con su torre.
  ciudad: () => [
    base('#bfae8a', 10),
    ...house(-5, 4, '#f2e3c6', '#c4553a', 0.85, 2),
    ...house(1, 6, '#9fc7d6', '#7a4a32', 0.8),
    ...house(6, 2, '#f4c8a0', '#b84a4a', 0.85, 3),
    ...house(-7, -3, '#e8d5a0', '#8a4a3a', 0.8),
    ...house(5, -5, '#c9e0c0', '#b84a4a', 0.8, 2),
    // Iglesia
    part(BOX, '#f6f1e6', { p: [-1, 5.5, -3], s: [6, 9, 8] }),
    part(CONE4, '#8a4a3a', { p: [-1, 12, -3], s: [5.4, 3.5, 7.4], r: [0, Math.PI / 4, 0] }),
    part(BOX, '#f6f1e6', { p: [-1, 11, 1.5], s: [3, 20, 3] }),
    part(CONE4, '#8a4a3a', { p: [-1, 23, 1.5], s: [2.6, 4.5, 2.6], r: [0, Math.PI / 4, 0] }),
  ],
  // Pueblo cabecera: algunas casas de material, una de dos pisos.
  cabecera: () => [
    base('#c9b27c'),
    ...house(-4.5, 2, '#f2e3c6', '#c4553a', 1.0),
    ...house(4, 3, '#9fc7d6', '#7a4a32', 0.85, 2),
    ...house(0.5, -4.5, '#f4c8a0', '#b84a4a', 1.05),
  ],
  // Caserío: casas de madera en zancos con techo de palma.
  rancho: () => [base('#c9b27c'), rancho(-3.5, 1.5, 0.95, 0.3), rancho(3.5, -2.5, 0.85, -0.4), ...tree(4, 5, 8, '#3f8a3a', 0.8)],
  playa: () => [
    base('#e9d6a6'), water(4.2, 3.2, 3.8), ...palm(-3, -1.5, 15, 0.25), ...palm(1, -4.5, 12, -0.2),
    part(BOX, '#f2f6f4', { p: [4.5, 1.5, 5.8], s: [4, 0.4, 0.8] }),
  ],
  selva: () => [
    base('#5d8a3e'),
    part(ORB, '#4f7a35', { p: [0, 0.8, 0], s: [12, 4, 12] }),
    ...tree(-4, 1, 11, '#2f6b2c'),
    ...tree(3.5, -2.5, 14, '#3f8a3a'),
    ...tree(2.5, 4.5, 9, '#5aa244'),
    ...tree(-1.5, -5, 8, '#4a8a36', 0.8),
  ],
  cerro: () => [
    base('#5d8a3e'),
    part(CONE, '#5e7f45', { p: [0, 10, 0], s: [8, 18, 8] }),
    part(CONE, '#78965a', { p: [0, 15.5, 0], s: [3.2, 7, 3.2] }),
    ...tree(-5.5, 3, 6, '#2f6b2c', 0.8),
    ...tree(5, -3, 6, '#3f8a3a', 0.8),
  ],
  cabo: () => [
    base('#3f8fb0'),
    part(ROCK, '#8a8478', { p: [-2, 3, -1], s: [6, 6, 5] }),
    part(ROCK, '#a09a8c', { p: [2.5, 2, 1.5], s: [3.5, 4, 3.5] }),
    part(ROCK, '#7a7468', { p: [5, 1.4, -2.5], s: [2, 2, 2] }),
    ...palm(-2.5, -2, 13, 0.3),
    part(BOX, '#f2f6f4', { p: [0, 1.4, 6], s: [6, 0.4, 0.9] }),
  ],
};

// ───────── Detalles ─────────

const EXTRA: Record<FigureExtra, () => Parts> = {
  // Potrillo con su remo, en un pedazo de río.
  canoa: () => [
    water(4.5),
    part(BOX, '#7a4a2a', { p: [0, 1.9, 0], s: [7, 1.2, 1.8] }),
    part(CONE, '#7a4a2a', { p: [4.3, 1.9, 0], s: [0.9, 1.6, 0.6], r: [0, 0, -Math.PI / 2] }),
    part(CONE, '#7a4a2a', { p: [-4.3, 1.9, 0], s: [0.9, 1.6, 0.6], r: [0, 0, Math.PI / 2] }),
    pole('#c9a26a', [1, 1.5, 1.6], [-1.5, 7, -0.6], 0.22),
  ],
  // Lancha de la costa.
  lancha: () => [
    water(4.5),
    part(BOX, '#f2f2ee', { p: [0, 2, 0], s: [7, 1.6, 2.6] }),
    part(BOX, '#3e6197', { p: [0, 1.5, 0], s: [7.1, 0.5, 2.7] }),
    part(CONE, '#f2f2ee', { p: [4.4, 2, 0], s: [1.3, 1.8, 0.8], r: [0, 0, -Math.PI / 2] }),
    part(BOX, '#3a3a3a', { p: [-3.8, 2.6, 0], s: [0.9, 1.6, 0.8] }),
  ],
  // Cola de ballena saliendo del agua.
  ballena: () => [
    water(4.8),
    part(ORB, '#4a4f5a', { p: [-1.5, 1.3, 0], s: [4, 1.2, 2] }),
    pole('#4a4f5a', [1, 1.3, 0], [2.5, 5.5, 0], 0.6),
    part(CONE, '#4a4f5a', { p: [1.4, 6.6, 0], s: [0.8, 3.6, 0.5], r: [0, 0, 1.15] }),
    part(CONE, '#4a4f5a', { p: [3.6, 6.6, 0], s: [0.8, 3.6, 0.5], r: [0, 0, -1.15] }),
  ],
  // Cununo: el tambor de la música del Pacífico.
  cununo: () => [
    part(CYL, '#8a4a2a', { p: [0, 4.2, 0], s: [3.4, 6.6, 3.4] }),
    part(CYL, '#f2e3c6', { p: [0, 7.6, 0], s: [3.7, 0.4, 3.7] }),
    part(CYL, '#e2456f', { p: [0, 1.6, 0], s: [3.6, 0.8, 3.6] }),
    ...[0, 1, 2, 3].map((k) => pole('#e2c38a', [Math.cos(k * 1.57) * 1.75, 1.8, Math.sin(k * 1.57) * 1.75], [Math.cos(k * 1.57 + 0.5) * 1.85, 7.4, Math.sin(k * 1.57 + 0.5) * 1.85], 0.18)),
  ],
  // Nube con lluvia (los pueblos más lluviosos del mundo).
  lluvia: () => [
    part(BALL, '#e4e6ec', { p: [0, 22, 0], s: [4.5, 3, 4] }),
    part(BALL, '#d6d9e2', { p: [3.6, 21.5, 0.5], s: [3.4, 2.4, 3.2] }),
    part(BALL, '#eceef2', { p: [-3.4, 21.6, -0.5], s: [3.2, 2.3, 3] }),
    ...[-3, -1, 1, 3].map((x, k) => pole('#8fb6e0', [x, 19 - (k % 2) * 2, (k % 2) - 0.5], [x - 0.5, 15 - (k % 2) * 2, (k % 2) - 0.5], 0.18)),
  ],
  // Pozo de agua caliente con su vapor.
  termal: () => [
    part(CYL, '#9a9088', { p: [0, 1.3, 0], s: [6.4, 0.6, 6.4] }),
    part(CYL, '#7ec8d0', { p: [0, 1.65, 0], s: [5.4, 0.2, 5.4] }),
    part(BALL, '#f4f4f0', { p: [0.4, 4.5, 0], s: [1.6, 1.4, 1.6] }),
    part(BALL, '#f4f4f0', { p: [-0.6, 7, 0.3], s: [1.3, 1.1, 1.3] }),
    part(BALL, '#f4f4f0', { p: [0.3, 9.2, -0.2], s: [1, 0.9, 1] }),
  ],
};

/** Dónde va cada detalle, alrededor de la escena (el frente, +z, mira al mar). */
const SLOTS: [number, number][] = [[6.5, 8], [-7, 7], [9, -3]];

const cache = new Map<string, BufferGeometry>();
const scaled = (g: BufferGeometry, k = 1) => g.applyMatrix4(new Matrix4().makeScale(UNIT * k, UNIT * k, UNIT * k));

/** La figurita de un punto del mapa: su escena y sus detalles, del tamaño del mapa, con la base en y = 0. */
export function figureGeometry(fig: Figure) {
  const key = `${fig.main}|${(fig.extra ?? []).join(',')}`;
  let g = cache.get(key);
  if (!g) {
    const parts: Parts = [...MAIN[fig.main]()];
    // La nube va encima de todo, en el centro; el resto, a los lados.
    let slot = 0;
    for (const e of fig.extra ?? []) {
      if (e === 'lluvia') parts.push(at(EXTRA[e](), 0, 0));
      else {
        const [x, z] = SLOTS[slot++ % SLOTS.length];
        parts.push(at(EXTRA[e](), x, z, 0.9));
      }
    }
    g = scaled(mergeGeometries(parts)!, fig.main === 'ciudad' ? 1.2 : 1);
    cache.set(key, g);
  }
  return g;
}

/** Las seis figuritas de las historias: las mismas piezas, cada una sola sobre su base. */
const STORY: Record<Emblem, () => Parts> = {
  pueblo: MAIN.cabecera,
  selva: MAIN.selva,
  mar: MAIN.playa,
  rio: () => [base('#4a8fa0'), at(EXTRA.canoa(), 0, 0, 1.5)],
  cultura: () => [base('#c97b4a'), at(EXTRA.cununo(), 0, 0, 1.6)],
  cocina: () => [
    base('#d8c49a'),
    ...[0, 2.1, 4.2].map((a) => part(BOX, '#9a9088', { p: [Math.cos(a) * 4, 2.2, Math.sin(a) * 4], s: [3, 2.4, 2.4], r: [0, -a, 0] })),
    part(CONE, '#f29a3a', { p: [0, 3.6, 0], s: [2.6, 4.5, 2.6] }),
    part(ORB, '#b5653a', { p: [0, 8, 0], s: [5.8, 4.6, 5.8] }),
    part(CYL, '#8a4526', { p: [0, 11.9, 0], s: [4.6, 0.9, 4.6] }),
    part(BALL, '#f2f2ee', { p: [0.8, 14.5, 0], s: [1.6, 1.5, 1.6] }),
    part(BALL, '#f2f2ee', { p: [-0.6, 17, 0.4], s: [1.2, 1.1, 1.2] }),
  ],
};

/** Figurita de una historia según su tipo. */
export function emblemGeometry(kind: Emblem) {
  const key = `historia|${kind}`;
  let g = cache.get(key);
  if (!g) {
    g = scaled(mergeGeometries(STORY[kind]())!);
    cache.set(key, g);
  }
  return g;
}
