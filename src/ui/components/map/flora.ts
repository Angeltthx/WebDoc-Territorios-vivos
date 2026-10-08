// Vegetación del Pacífico chocoano: palmas de coco en la playa, plataneras, manglares en las desembocaduras,
// ceibas que sobresalen de la selva, árboles en las lomas y matas con flores rosadas y naranjas (como el afiche).
// Cada especie es una sola malla repetida (InstancedMesh), así cientos de plantas cuestan poco.

import { type BufferGeometry, Color, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { BALL, BLADE, ORB, merge, paint, part, pole } from './kit';
import { RIVER_MOUTHS, heightAt, isFree, nature, placed, randomPoint, riverReach, shore } from './terrain';

const TAU = Math.PI * 2;

function palmGeo() {
  const g: BufferGeometry[] = [
    pole('#9c7b55', [0, 0, 0], [0.9, 7, 0], 1),
    pole('#a3825b', [0.9, 7, 0], [2.4, 13, 0], 0.85),
    pole('#9c7b55', [2.4, 13, 0], [4.2, 18, 0], 0.75),
  ];
  const top: [number, number, number] = [4.2, 18.2, 0];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.push(part(BLADE, i % 2 ? '#3f8f45' : '#4f9f4a', { p: top, r: [0.35 + (i % 3) * 0.12, a, 0], s: [1.3, 0.22, 6.5], o: 'YXZ' }));
  }
  for (let i = 0; i < 3; i++) g.push(part(ORB, '#7a5a2e', { p: [4.2 + Math.cos(i * 2.1) * 0.9, 17.2, Math.sin(i * 2.1) * 0.9], s: 0.9 }));
  return merge(g);
}

function bananaGeo() {
  const g: BufferGeometry[] = [pole('#7fa84a', [0, 0, 0], [0, 6.5, 0], 1.1)];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + i * 0.3;
    g.push(part(BLADE, i % 2 ? '#6cbf5a' : '#5aae4c', { p: [0, 6.5, 0], r: [-0.55 + (i % 3) * 0.45, a, 0], s: [2.1, 0.25, 4.6], o: 'YXZ' }));
  }
  return merge(g);
}

function roundTreeGeo() {
  return merge([
    pole('#7a5a3c', [0, 0, 0], [0, 11, 0], 1.6),
    part(BALL, '#5aa653', { p: [0, 16, 0], s: [9, 8, 9] }),
    part(BALL, '#66b25a', { p: [4, 13, 3], s: [5.5, 5, 5.5] }),
  ]);
}

function ceibaGeo() {
  const g: BufferGeometry[] = [pole('#8f7a63', [0, 0, 0], [0, 34, 0], 2.6)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    g.push(pole('#86705a', [Math.cos(a) * 5, 0, Math.sin(a) * 5], [0, 7, 0], 1));
  }
  g.push(part(BALL, '#3f8b4c', { p: [0, 36, 0], s: [19, 5.5, 19] }), part(BALL, '#4a9852', { p: [3, 40, -2], s: [12, 4.5, 12] }));
  return merge(g);
}

function mangroveGeo() {
  const g: BufferGeometry[] = [pole('#6a5643', [0, 6, 0], [0, 11, 0], 1.1)];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    g.push(pole('#6a5643', [Math.cos(a) * 6, -1, Math.sin(a) * 6], [Math.cos(a) * 1.5, 7, Math.sin(a) * 1.5], 0.45));
  }
  g.push(part(BALL, '#2f7048', { p: [0, 13, 0], s: [8.5, 4.5, 8.5] }), part(BALL, '#3a7d4e', { p: [3, 15, -2], s: [6, 4, 6] }));
  return merge(g);
}

function flowerShrubGeo(flower: string) {
  const g: BufferGeometry[] = [part(BALL, '#4d9a4a', { p: [0, 2.2, 0], s: [3.8, 2.8, 3.8] })];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const up = 0.3 + (i % 3) * 0.25;
    g.push(part(ORB, flower, { p: [Math.cos(a) * 3.2, 2.4 + up * 2.6, Math.sin(a) * 3.2], s: [1.2, 0.5, 1.2] }));
    g.push(part(ORB, '#f7e27a', { p: [Math.cos(a) * 3.4, 2.7 + up * 2.6, Math.sin(a) * 3.4], s: 0.35 }));
  }
  return merge(g);
}

type Sampler = () => { x: number; z: number; s: number } | null;

/** Siembra hasta `count` copias de una planta donde el muestreador encuentre sitio. */
function scatter(geo: BufferGeometry, count: number, rand: () => number, sample: Sampler, tint = 0.18) {
  const mesh = new InstancedMesh(geo, paint, count);
  const dummy = new Object3D();
  const c = new Color();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 200; tries++) {
    const at = sample();
    if (!at) continue;
    dummy.position.set(at.x, heightAt(at.x, at.z) - 0.6, at.z);
    dummy.rotation.set(0, rand() * TAU, 0);
    dummy.scale.setScalar(at.s);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    const v = 1 - tint + rand() * tint;
    mesh.setColorAt(n, c.setRGB(v, v * (0.97 + rand() * 0.06), v * (0.9 + rand() * 0.1)));
    n++;
  }
  mesh.count = n;
  return mesh;
}

export function buildFlora(rand: () => number) {
  const group = new Group();
  const anchors = [...placed.map((p) => p.pos), ...nature.filter((p) => p.at.inland > 0).map((p) => p.pos)];
  const nearAnchor = (min: number, max: number) => {
    const a = anchors[Math.floor(rand() * anchors.length)];
    const ang = rand() * TAU;
    const r = min + rand() * (max - min);
    return { x: a.x + Math.cos(ang) * r, z: a.z + Math.sin(ang) * r };
  };
  /** Punto al azar a una distancia de la orilla entre `min` y `max`. */
  const inBand = (min: number, max: number) => {
    const p = randomPoint(rand);
    const d = shore(p.x, p.z);
    return d >= min && d <= max ? { ...p, d } : null;
  };

  // Palmas de coco a lo largo de toda la playa.
  group.add(scatter(palmGeo(), 420, rand, () => {
    const p = inBand(8, 70);
    return p && isFree(p.x, p.z) ? { x: p.x, z: p.z, s: 0.85 + rand() * 0.45 } : null;
  }));

  // Plataneras alrededor de los pueblos, las posadas y en la llanura.
  group.add(scatter(bananaGeo(), 240, rand, () => {
    const p = rand() < 0.7 ? nearAnchor(40, 220) : inBand(30, 520);
    if (!p) return null;
    const d = shore(p.x, p.z);
    return d > 25 && d < 600 && isFree(p.x, p.z) ? { x: p.x, z: p.z, s: 0.9 + rand() * 0.5 } : null;
  }));

  // Selva: árboles en la llanura y en las lomas; crecen tierra adentro para que la serranía se lea tupida.
  group.add(scatter(roundTreeGeo(), 4200, rand, () => {
    const p = inBand(60, 4000);
    return p && isFree(p.x, p.z) ? { x: p.x, z: p.z, s: 1 + Math.min(p.d, 2400) / 900 + rand() * 0.6 } : null;
  }, 0.35));

  // Ceibas que sobresalen del dosel.
  group.add(scatter(ceibaGeo(), 170, rand, () => {
    const p = inBand(160, 3000);
    return p && isFree(p.x, p.z) ? { x: p.x, z: p.z, s: 1 + rand() * 0.6 } : null;
  }));

  // Manglares en las desembocaduras de los ríos, en el estero de Tribugá y en el manglar del afiche.
  const mangroveSpots = [
    ...RIVER_MOUTHS,
    ...nature.filter((n) => n.id === 'manglar').map((n) => n.pos),
    ...placed.filter((p) => p.id === 'lobos-del-manglar').map((p) => p.pos),
  ];
  group.add(scatter(mangroveGeo(), 200, rand, () => {
    const a = mangroveSpots[Math.floor(rand() * mangroveSpots.length)];
    const ang = rand() * TAU;
    const r = 25 + rand() * 170;
    const x = a.x + Math.cos(ang) * r;
    const z = a.z + Math.sin(ang) * r;
    const d = shore(x, z);
    const free = d > -4 && d < 260 && riverReach(x, z) > 0.9 && placed.every((p) => p.pos.distanceTo(new Vector3(x, p.pos.y, z)) > 45);
    return free ? { x, z, s: 0.8 + rand() * 0.5 } : null;
  }));

  // Matas con flores rosadas y naranjas cerca de la costa.
  for (const color of ['#ef86bd', '#f6a03c', '#e9547f']) {
    group.add(scatter(flowerShrubGeo(color), 130, rand, () => {
      const p = rand() < 0.6 ? nearAnchor(30, 180) : inBand(20, 320);
      return p && isFree(p.x, p.z, 14) ? { x: p.x, z: p.z, s: 0.9 + rand() * 0.6 } : null;
    }, 0.1));
  }

  return group;
}

/** Bruma que se enreda en la serranía, típica de la selva húmeda del Chocó. */
export function buildMist(rand: () => number) {
  const group = new Group();
  const mat = new MeshBasicMaterial({ color: '#f4fafc', transparent: true, opacity: 0.3, depthWrite: false });
  const mist: { m: Group; speed: number; base: number }[] = [];
  for (let tries = 0; mist.length < 18 && tries < 2000; tries++) {
    const { x, z } = randomPoint(rand);
    if (shore(x, z) < 500) continue;
    const m = new Group();
    for (let j = 0; j < 4; j++) {
      const puff = new Mesh(ORB, mat);
      puff.scale.set(70 + rand() * 60, 18 + rand() * 12, 60 + rand() * 50);
      puff.position.set((rand() - 0.5) * 60, rand() * 10, (j - 1.5) * 70);
      m.add(puff);
    }
    m.position.set(x, heightAt(x, z) + 40 + rand() * 30, z);
    group.add(m);
    mist.push({ m, speed: 4 + rand() * 6, base: z });
  }
  const update = (t: number) => {
    for (const { m, speed, base } of mist) m.position.z = base + Math.sin(t * 0.02 * speed) * 120;
  };
  return { group, update };
}
