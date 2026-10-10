// Figuritas 3D de los puntos del Chocó y de las historias: seis tipos sencillos que se leen de lejos.
//   pueblo   tres casitas            selva   tres árboles en una loma      mar      palma sobre el agua
//   río      un potrillo con su remo  cultura un cununo (tambor)            cocina   una olla sobre el fogón
// Cada una se arma con piezas de colores (como el resto del mapa) sobre una base redonda, y todas las del mapa se
// funden en una sola malla: un solo dibujo para todas.

import { type BufferGeometry, Matrix4 } from 'three';
import type { Emblem } from '../../../content/choco';
import { BALL, BLADE, BOX, CONE, CONE4, CYL, ORB, merge, part, pole } from './kit';

/** Alto aproximado de una figurita, en unidades de la escena (≈ 600 m: se distinguen al acercarse a cada punto). */
export const EMBLEM_SIZE = 110;

const base = (color: string) => part(CYL, color, { p: [0, 0.6, 0], s: [16, 1.2, 16] });

function house(x: number, z: number, wall: string, roof: string, k = 1) {
  return [
    part(BOX, wall, { p: [x, 4 * k + 1.2, z], s: [7 * k, 8 * k, 6 * k] }),
    part(CONE4, roof, { p: [x, 10.4 * k + 1.2, z], s: [6.4 * k, 4.8 * k, 5.6 * k], r: [0, Math.PI / 4, 0] }),
    part(BOX, '#3b2c22', { p: [x, 2.6 * k + 1.2, z + 3.05 * k], s: [1.8 * k, 3.4 * k, 0.2] }),
  ];
}

function tree(x: number, z: number, h: number, leaf: string) {
  return [
    part(CYL, '#6d5238', { p: [x, h / 2 + 1.2, z], s: [0.9, h, 0.9] }),
    part(BALL, leaf, { p: [x, h + 3, z], s: [4.6, 4.2, 4.6] }),
  ];
}

const BUILD: Record<Emblem, () => BufferGeometry[]> = {
  pueblo: () => [
    base('#c9b27c'),
    ...house(-4.5, 2, '#f2e3c6', '#c4553a', 1.05),
    ...house(4.5, 3, '#9fc7d6', '#7a4a32', 0.9),
    ...house(0.5, -4.5, '#f4c8a0', '#b84a4a', 1.15),
  ],
  selva: () => [
    base('#5d8a3e'),
    part(ORB, '#4f7a35', { p: [0, 0.8, 0], s: [12, 4, 12] }),
    ...tree(-4, 1, 11, '#2f6b2c'),
    ...tree(3.5, -2.5, 14, '#3f8a3a'),
    ...tree(2.5, 4.5, 9, '#5aa244'),
  ],
  mar: () => [
    base('#3f8fb0'),
    part(CYL, '#e9d6a6', { p: [-2, 1.6, -1], s: [8, 0.8, 7] }),
    pole('#8a6a48', [-2, 1.6, -1], [1.5, 17, 0.5], 0.8),
    ...[0, 1.2, 2.4, 3.6, 4.8].map((a) => part(BLADE, '#4f9a3c', { p: [1.5, 17, 0.5], s: [1.4, 0.5, 7], r: [-0.45, a, 0] })),
    part(BOX, '#f2f6f4', { p: [5, 1.5, 4], s: [5, 0.5, 1] }),
  ],
  rio: () => [
    base('#4a8fa0'),
    part(BOX, '#7a4a2a', { p: [0, 2.4, 0], s: [14, 2.2, 3.4] }),
    part(CONE, '#7a4a2a', { p: [8.4, 2.4, 0], s: [1.7, 3.2, 1.1], r: [0, 0, -Math.PI / 2] }),
    part(CONE, '#7a4a2a', { p: [-8.4, 2.4, 0], s: [1.7, 3.2, 1.1], r: [0, 0, Math.PI / 2] }),
    part(BOX, '#3b2c22', { p: [0, 3.3, 0], s: [12, 0.4, 2.4] }),
    pole('#c9a26a', [2, 2, 3], [-3, 13, -1], 0.4),
    part(BOX, '#c9a26a', { p: [2.3, 1.6, 3.3], s: [1.6, 3, 0.4], r: [0.35, 0, 0.4] }),
  ],
  cultura: () => [
    base('#c97b4a'),
    part(CYL, '#8a4a2a', { p: [0, 8, 0], s: [4.4, 13, 4.4] }),
    part(CYL, '#f2e3c6', { p: [0, 14.7, 0], s: [4.8, 0.5, 4.8] }),
    ...[0, 1, 2, 3, 4, 5].map((k) => pole('#e2c38a', [Math.cos(k * 1.05) * 4.5, 2.5, Math.sin(k * 1.05) * 4.5], [Math.cos(k * 1.05 + 0.5) * 4.7, 14.2, Math.sin(k * 1.05 + 0.5) * 4.7], 0.25)),
    part(CYL, '#e2456f', { p: [0, 3.2, 0], s: [4.6, 1.2, 4.6] }),
  ],
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

const cache = new Map<Emblem, BufferGeometry>();
/** Figurita de un tipo, del tamaño del mapa (`EMBLEM_SIZE` de alto), con su base en y = 0. */
export function emblemGeometry(kind: Emblem) {
  let g = cache.get(kind);
  if (!g) {
    g = merge(BUILD[kind]()).clone();
    g.applyMatrix4(new Matrix4().makeScale(EMBLEM_SIZE / 18, EMBLEM_SIZE / 18, EMBLEM_SIZE / 18));
    cache.set(kind, g);
  }
  return g;
}
