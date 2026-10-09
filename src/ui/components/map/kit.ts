// Piezas para armar las figuras del mapa (low-poly, colores planos como el afiche).
// Cada figura se arma con varias formas simples, cada una con su color, y se funde en una sola malla.

import {
  BoxGeometry, type BufferGeometry, Color, type ColorRepresentation, ConeGeometry, CylinderGeometry, Euler, Float32BufferAttribute,
  BackSide, BufferGeometry as Geometry, type EulerOrder, BatchedMesh, Group, IcosahedronGeometry, InstancedMesh, type Material, MeshBasicMaterial, type Object3D, Matrix4, Mesh, Quaternion, SkinnedMesh, SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { QUALITY, litMaterial } from './quality';

type V3 = [number, number, number];

export interface PartOpts {
  p?: V3;
  r?: V3;
  s?: V3 | number;
  /** Orden de los giros: 'YXZ' inclina primero y luego reparte alrededor del eje vertical. */
  o?: EulerOrder;
}

// Las figuras se repiten mucho (15 fragatas, 46 mariposas, decenas de canoas…): la misma pieza con el mismo color y
// la misma pose se calcula una sola vez, y lo mismo la fusión de las mismas piezas. Las geometrías que salen de aquí
// no se modifican después (quien necesite cambiarlas, las clona primero, como `bake`).
const partCache = new Map<string, BufferGeometry>();
const mergeCache = new Map<string, BufferGeometry>();
/** Suelta lo memorizado (al cerrar el mapa). */
export function clearKitCache() {
  partCache.clear();
  mergeCache.clear();
  cylinders.clear();
}

/**
 * Para armar la escena sin congelar la página: `await pace()` dentro de un trabajo largo cede el turno al navegador
 * cada ~12 ms (así el planeta de la entrada sigue girando y respondiendo mientras la costa se arma por detrás).
 */
export type Pace = () => Promise<void>;
export function pacer(budget = 12): Pace {
  let last = performance.now();
  return async () => {
    if (performance.now() - last < budget) return;
    await new Promise<void>((r) => setTimeout(r, 0));
    last = performance.now();
  };
}

/** Una forma con su color y su posición, lista para fundirse con otras. */
export function part(geo: BufferGeometry, color: ColorRepresentation, { p = [0, 0, 0], r = [0, 0, 0], s = 1, o = 'XYZ' }: PartOpts = {}) {
  const key = `${geo.uuid}|${new Color(color).getHexString()}|${p}|${r}|${s}|${o}`;
  const hit = partCache.get(key);
  if (hit) return hit;
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  const scale = typeof s === 'number' ? new Vector3(s, s, s) : new Vector3(...s);
  g.applyMatrix4(new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...r, o)), scale));
  const c = new Color(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  partCache.set(key, g);
  return g;
}

export const merge = (parts: BufferGeometry[]) => {
  const key = parts.map((g) => g.uuid).join(',');
  let g = mergeCache.get(key);
  if (!g) mergeCache.set(key, (g = mergeGeometries(parts)!));
  return g;
};

/**
 * Muchas figuras en movimiento (aves, mariposas, canoas, personas) en una llamada de dibujo por material. Cada figura
 * se sigue armando y animando como un grupo normal, pero fuera de la escena; en cada cuadro la pose de cada pieza
 * (cuerpo, alas, remo…) se copia a una malla por lotes (BatchedMesh), que además deja de dibujar las piezas que no
 * están a la vista. Los bordes de calcomanía van en su propio lote.
 */
export class Instancer {
  readonly group = new Group();
  private pieces: { m: Mesh; id: number; figure: Object3D; batch: BatchedMesh }[] = [];
  private frame = 0;
  private stale = new Set<Object3D>();
  private hidden = new Set<Object3D>();
  /**
   * `viewer`: dónde está la cámara. Las figuras a más de `far` se actualizan uno de cada tres cuadros (de lejos no se
   * nota) y las que pasan de `hideBeyond` no se dibujan (las mariposas, de lejos, miden menos de un píxel).
   */
  constructor(private figures: Object3D[], private opts: { viewer?: Vector3; far?: number; hideBeyond?: number } = {}) {
    const byMaterial = new Map<Material, { m: Mesh; figure: Object3D }[]>();
    for (const figure of figures) {
      figure.traverse((c) => {
        const m = c as Mesh;
        if (!m.isMesh) return;
        const list = byMaterial.get(m.material as Material) ?? [];
        list.push({ m, figure });
        byMaterial.set(m.material as Material, list);
      });
    }
    for (const [material, list] of byMaterial) {
      const geos = [...new Set(list.map(({ m }) => m.geometry))];
      const vertices = geos.reduce((n, g) => n + g.attributes.position.count, 0);
      const indices = geos.reduce((n, g) => n + (g.index?.count ?? 0), 0);
      // Copia del material solo para los lotes (mezclar mallas por lotes y normales en un material obliga a three.js a
      // recalcular su programa en cada cambio).
      const batch = new BatchedMesh(list.length, vertices, indices, batchMaterial(material));
      batch.sortObjects = false;
      batch.frustumCulled = false; // se mueven: se recorta pieza por pieza
      const ids = new Map(geos.map((g) => [g, batch.addGeometry(g)]));
      for (const { m, figure } of list) this.pieces.push({ m, figure, batch, id: batch.addInstance(ids.get(m.geometry)!) });
      this.group.add(batch);
    }
  }
  /** Copia la pose de cada figura (en coordenadas del mundo) a las mallas por lotes. */
  sync() {
    const { viewer, far = Infinity, hideBeyond = Infinity } = this.opts;
    const tick = this.frame++ % 3 === 0;
    this.stale.clear();
    const hidden = this.hidden;
    hidden.clear();
    for (const f of this.figures) {
      const d = viewer ? f.position.distanceTo(viewer) : 0;
      if (d > hideBeyond) hidden.add(f);
      else if (d > far && !tick) this.stale.add(f);
      else f.updateMatrixWorld(true);
    }
    for (const { m, id, figure, batch } of this.pieces) {
      if (this.stale.has(figure)) continue;
      const show = figure.visible && m.visible && !hidden.has(figure);
      batch.setVisibleAt(id, show);
      if (show) batch.setMatrixAt(id, m.matrixWorld);
    }
  }
}
const batchMaterials = new Map<Material, Material>();
const batchMaterial = (m: Material) => {
  let copy = batchMaterials.get(m);
  if (!copy) {
    copy = m === paint ? paintFlock : m.clone();
    // clone() no copia el sombreador modificado (el grosor del borde de calcomanía).
    copy.onBeforeCompile = m.onBeforeCompile;
    copy.customProgramCacheKey = m.customProgramCacheKey;
    batchMaterials.set(m, copy);
  }
  return copy;
};

/**
 * Muchas piezas con la misma forma y el mismo material (bocanadas de nubes y de neblina) en UNA llamada de dibujo.
 * Las piezas siguen colgando de sus grupos (fuera de la escena), que se mueven como siempre; `sync` copia la posición.
 */
export class Batch {
  readonly group = new Group();
  private mesh: InstancedMesh;
  private pieces: Mesh[] = [];
  constructor(private holders: Object3D[]) {
    for (const h of holders) h.traverse((c) => (c as Mesh).isMesh && this.pieces.push(c as Mesh));
    this.mesh = new InstancedMesh(this.pieces[0].geometry, this.pieces[0].material, this.pieces.length);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.sync();
  }
  sync() {
    for (const h of this.holders) h.updateMatrixWorld(true);
    this.pieces.forEach((m, i) => this.mesh.setMatrixAt(i, m.matrixWorld));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Funde en una malla por material todo lo que cuelga de `root` y no se mueve (casas, muelles, botes varados): cada
 * pieza suelta era una llamada de dibujo. Queda en coordenadas del mundo, bajo un grupo nuevo en el origen. Si hay
 * contornos de calcomanía (dependen de la escala de su pieza) se deja tal cual.
 */
export function bake(root: Object3D): Object3D {
  root.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  let outlined = false;
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    if (m.userData.outline || Array.isArray(m.material) || (m as unknown as InstancedMesh).isInstancedMesh) outlined = true;
    meshes.push(m);
  });
  if (outlined || meshes.length < 2) return root;
  const byKey = new Map<string, { material: Mesh['material']; geos: BufferGeometry[] }>();
  for (const m of meshes) {
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g = g.applyMatrix4(m.matrixWorld);
    const key = `${(m.material as MeshBasicMaterial).uuid}|${Object.keys(g.attributes).sort().join(',')}`;
    const entry = byKey.get(key) ?? { material: m.material, geos: [] };
    entry.geos.push(g);
    byKey.set(key, entry);
  }
  const out = new Group();
  for (const { material, geos } of byKey.values()) out.add(new Mesh(mergeGeometries(geos)!, material));
  return out;
}

/** Material común: los colores vienen de cada pieza. */
export const paint = litMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
/**
 * El mismo material para las mallas por lotes: la vegetación (con tono por planta) y las aves y mariposas (sin tono).
 * Si un mismo material se usa en mallas de distinto tipo, three.js recalcula su programa en cada cambio, cientos de
 * veces por cuadro; por eso cada uso tiene su copia.
 */
export const paintBatched = paint.clone();
export const paintFlock = paint.clone();

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
  // En equipos modestos no hay borde: cada contorno es otra figura entera que dibujar.
  if (!QUALITY.outlines) return root;
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
  if (!QUALITY.outlines) return;
  const meshes: SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh && !o.userData.outline) meshes.push(o as SkinnedMesh);
  });
  for (const m of meshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const size = m.geometry.boundingBox!.getSize(new Vector3());
    const hull = new SkinnedMesh(m.geometry, outlineMat(Number((Math.max(size.x, size.y, size.z) * ratio).toPrecision(3))));
    hull.userData.outline = true;
    hull.boundingSphere = m.boundingSphere?.clone() ?? null;
    hull.frustumCulled = !!hull.boundingSphere;
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
const cylinders = new Map<string, BufferGeometry>();
export function pole(color: ColorRepresentation, from: V3, to: V3, radius: number) {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const len = a.distanceTo(b);
  // El mismo cilindro (largo y grosor) se reutiliza: así la pieza también queda memorizada.
  const ck = `${radius}|${len.toFixed(4)}`;
  let geo = cylinders.get(ck);
  if (!geo) {
    geo = new CylinderGeometry(radius * 0.8, radius, len, 6).translate(0, len / 2, 0);
    cylinders.set(ck, geo);
  }
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
