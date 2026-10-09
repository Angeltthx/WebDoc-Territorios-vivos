// Piezas para armar las figuras del mapa (low-poly, colores planos como el afiche).
// Cada figura se arma con varias formas simples, cada una con su color, y se funde en una sola malla.

import {
  BoxGeometry, type BufferGeometry, Color, type ColorRepresentation, ConeGeometry, CylinderGeometry, Euler, Float32BufferAttribute,
  BackSide, BufferGeometry as Geometry, type EulerOrder, Group, IcosahedronGeometry, MeshBasicMaterial, type Object3D, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SkinnedMesh, SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

type V3 = [number, number, number];

export interface PartOpts {
  p?: V3;
  r?: V3;
  s?: V3 | number;
  /** Orden de los giros: 'YXZ' inclina primero y luego reparte alrededor del eje vertical. */
  o?: EulerOrder;
}

/** Una forma con su color y su posición, lista para fundirse con otras. */
export function part(geo: BufferGeometry, color: ColorRepresentation, { p = [0, 0, 0], r = [0, 0, 0], s = 1, o = 'XYZ' }: PartOpts = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  const scale = typeof s === 'number' ? new Vector3(s, s, s) : new Vector3(...s);
  g.applyMatrix4(new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...r, o)), scale));
  const c = new Color(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

export const merge = (parts: BufferGeometry[]) => mergeGeometries(parts)!;

/** Material común: los colores vienen de cada pieza. */
export const paint = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });

export const solid = (parts: BufferGeometry[]) => new Mesh(merge(parts), paint);

// ───────── Borde blanco tipo calcomanía ─────────
// Las ilustraciones del afiche tienen un contorno blanco. Se imita con una copia de la figura, un poco
// más gruesa, pintada de blanco y vista por dentro (técnica de "casco invertido").

const outlineMats = new Map<number, MeshBasicMaterial>();
function outlineMat(width: number) {
  let m = outlineMats.get(width);
  if (!m) {
    m = new MeshBasicMaterial({ color: '#fffdf6', side: BackSide });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
transformed += normalize(normal) * ${width.toPrecision(4)};`);
    };
    // Cada grosor es un programa distinto (el código de arriba es el mismo texto para todos).
    m.customProgramCacheKey = () => `sticker-${width}`;
    outlineMats.set(width, m);
  }
  return m;
}

/** Agrega el borde blanco a todas las mallas de una figura (incluidas las partes que se mueven). */
export function sticker(root: Object3D, width = 0.45) {
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh && !o.userData.outline) meshes.push(o as Mesh);
  });
  for (const mesh of meshes) {
    const g = new Geometry();
    g.setAttribute('position', mesh.geometry.attributes.position);
    const smooth = mergeVertices(g, 1e-3);
    smooth.computeVertexNormals();
    const hull = new Mesh(smooth, outlineMat(width));
    hull.userData.outline = true;
    mesh.add(hull);
  }
  return root;
}

/**
 * Borde blanco para los modelos con esqueleto (los animales de la diseñadora). La copia de cada malla comparte el
 * esqueleto del original, así el borde se dobla con la animación. `ratio`: grosor respecto al tamaño de la malla.
 */
export function stickerSkinned(root: Object3D, ratio = 0.015) {
  const meshes: SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh && !o.userData.outline) meshes.push(o as SkinnedMesh);
  });
  for (const m of meshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const size = m.geometry.boundingBox!.getSize(new Vector3());
    const hull = new SkinnedMesh(m.geometry, outlineMat(Number((Math.max(size.x, size.y, size.z) * ratio).toPrecision(3))));
    hull.userData.outline = true;
    hull.frustumCulled = false;
    hull.position.copy(m.position);
    hull.quaternion.copy(m.quaternion);
    hull.scale.copy(m.scale);
    hull.bind(m.skeleton, m.bindMatrix);
    m.parent!.add(hull);
  }
  return root;
}

// Formas base reutilizables.
export const BALL = new IcosahedronGeometry(1, 1);
export const ROCK = new IcosahedronGeometry(1, 0);
export const ORB = new SphereGeometry(1, 10, 8);
export const CYL = new CylinderGeometry(1, 1, 1, 7);
export const BOX = new BoxGeometry(1, 1, 1);
/** Hoja alargada que nace en el origen y crece hacia +z (palmas, plátano). */
export const BLADE = new SphereGeometry(1, 6, 4).translate(0, 0, 1);
export const CONE = new ConeGeometry(1, 1, 7);
export const CONE4 = new ConeGeometry(1, 1, 4);

/** Cilindro entre dos alturas (para troncos, patas y postes). */
export function pole(color: ColorRepresentation, from: V3, to: V3, radius: number) {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const len = a.distanceTo(b);
  const geo = new CylinderGeometry(radius * 0.8, radius, len, 6);
  geo.translate(0, len / 2, 0);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  const e = new Euler().setFromQuaternion(q);
  return part(geo, color, { p: from, r: [e.x, e.y, e.z] });
}

// ───────── Personas ─────────

export interface PersonOpts {
  skin?: string;
  top: string;
  /** Falda o pollera (si no hay, pantalón). */
  skirt?: { color: string; flare: number; trim?: string };
  legs?: string;
  head?: { kind: 'wrap'; colors: string[] } | { kind: 'hat'; color: string } | { kind: 'hair'; color: string };
}

/**
 * Figura humana de unas 14 unidades de alto (más grande que la escala real, como las ilustraciones del afiche).
 * Devuelve los brazos aparte para poder animarlos.
 */
export function person({ skin = '#6b3f29', top, skirt, legs = '#f3efe6', head }: PersonOpts) {
  const body: BufferGeometry[] = [];
  if (skirt) {
    body.push(part(CONE, skirt.color, { p: [0, 4.2, 0], s: [skirt.flare, 7.4, skirt.flare] }));
    if (skirt.trim) body.push(part(CYL, skirt.trim, { p: [0, 0.9, 0], s: [skirt.flare * 0.86, 0.6, skirt.flare * 0.86] }));
    body.push(part(CYL, skin, { p: [-0.6, 0.4, 0], s: [0.35, 0.8, 0.35] }), part(CYL, skin, { p: [0.6, 0.4, 0], s: [0.35, 0.8, 0.35] }));
  } else {
    body.push(part(CYL, legs, { p: [-0.6, 2.8, 0], s: [0.55, 5.6, 0.55] }), part(CYL, legs, { p: [0.6, 2.8, 0], s: [0.55, 5.6, 0.55] }));
  }
  body.push(part(CYL, top, { p: [0, 8.4, 0], s: [1.55, 3.6, 1.1] }));
  body.push(part(ORB, skin, { p: [0, 11.6, 0], s: [1.35, 1.5, 1.35] }));
  if (head?.kind === 'wrap') {
    head.colors.forEach((c, i) => body.push(part(ORB, c, { p: [0, 12.7 + i * 0.9, -0.2], s: [1.6 - i * 0.2, 0.9, 1.6 - i * 0.2] })));
  } else if (head?.kind === 'hat') {
    body.push(part(CYL, head.color, { p: [0, 12.6, 0], s: [3, 0.15, 3] }), part(CYL, head.color, { p: [0, 13.2, 0], s: [1.3, 1.2, 1.3] }));
  } else if (head?.kind === 'hair') {
    body.push(part(ORB, head.color, { p: [0, 12.2, -0.3], s: [1.45, 1.3, 1.4] }));
  }
  const g = new Group();
  g.add(solid(body));
  const arm = (side: number) => {
    const a = new Group();
    a.position.set(side * 1.75, 9.8, 0);
    const geo = merge([part(CYL, top, { p: [0, -1.1, 0], s: [0.45, 2.2, 0.45] }), part(CYL, skin, { p: [0, -3.2, 0], s: [0.38, 2.2, 0.38] })]);
    a.add(new Mesh(geo, paint));
    g.add(a);
    return a;
  };
  return { group: g, armL: arm(-1), armR: arm(1) };
}

// ───────── Casas ─────────

/** Casa de madera sobre pilotes (palafito), con techo de zinc o de palma. */
export function stiltHouse(wall: string, roof: string, { w = 12, d = 10, h = 7, stilts = 3, thatch = false, floors = 1 } = {}) {
  const parts: BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(pole('#6d5238', [sx * (w / 2 - 0.8), 0, sz * (d / 2 - 0.8)], [sx * (w / 2 - 0.8), stilts, sz * (d / 2 - 0.8)], 0.5));
  parts.push(part(BOX, '#8a6a48', { p: [0, stilts, 0], s: [w + 2, 0.6, d + 2] }));
  for (let f = 0; f < floors; f++) {
    parts.push(part(BOX, wall, { p: [0, stilts + h / 2 + f * h, 0], s: [w, h, d] }));
    // ventana hacia el mar
    parts.push(part(BOX, '#3b2c22', { p: [-w / 2 - 0.1, stilts + h * 0.6 + f * h, d * 0.2], s: [0.3, 2.2, 2] }));
  }
  // puerta hacia el mar
  parts.push(part(BOX, '#3b2c22', { p: [-w / 2 - 0.1, stilts + 2.2, -d * 0.2], s: [0.3, 4.2, 1.8] }));
  const top = stilts + h * floors;
  if (thatch) parts.push(part(CONE4, roof, { p: [0, top + 3.6, 0], s: [w * 0.95, 7.5, d * 0.95], r: [0, Math.PI / 4, 0] }));
  else parts.push(part(CONE4, roof, { p: [0, top + 2.6, 0], s: [w * 0.85, 5.2, d * 0.85], r: [0, Math.PI / 4, 0] }));
  return { mesh: solid(parts), height: top + (thatch ? 7.5 : 5.2) };
}
