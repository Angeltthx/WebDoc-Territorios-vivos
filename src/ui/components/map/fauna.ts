// Fauna y flora del afiche, animadas: ballena jorobada (salta y sopla, con su cría), tortuga golfina,
// cangrejo fantasma rojo, pava del Baudó, rana arlequín y cacao; además fragatas, pelícanos y mariposas.
// Las figuras son más grandes que en la realidad, como las ilustraciones del afiche, para que se distingan.

import { type BufferGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { BALL, BLADE, CONE, ORB, merge, paint, part, pole, solid } from './kit';
import { Z_LIMIT, coastX, heightAt, nature, placed } from './terrain';

const TAU = Math.PI * 2;

export interface Living {
  group: Object3D;
  update: (t: number, dt: number) => void;
}

const byId = (id: string) => nature.find((n) => n.id === id)!;

// ───────── Salpicaduras y soplos ─────────

class Spray {
  private drops: { m: Mesh; v: Vector3; life: number; size: number }[] = [];
  readonly group = new Group();
  constructor(count: number) {
    const mat = new MeshStandardMaterial({ color: '#f4fbff', emissive: '#cfe8f2', emissiveIntensity: 0.4, flatShading: true, roughness: 1 });
    for (let i = 0; i < count; i++) {
      const m = new Mesh(BALL, mat);
      m.visible = false;
      this.group.add(m);
      this.drops.push({ m, v: new Vector3(), life: 0, size: 1 });
    }
  }
  emit(at: Vector3, n: number, { spread = 14, up = 30, size = 3 } = {}) {
    let k = 0;
    for (const d of this.drops) {
      if (d.life > 0) continue;
      const a = Math.random() * TAU;
      const s = Math.random() * spread;
      d.m.position.copy(at);
      d.v.set(Math.cos(a) * s, up * (0.6 + Math.random() * 0.6), Math.sin(a) * s);
      d.life = 1;
      d.size = size * (0.6 + Math.random() * 0.8);
      d.m.visible = true;
      if (++k >= n) break;
    }
  }
  update(dt: number) {
    for (const d of this.drops) {
      if (d.life <= 0) continue;
      d.life -= dt * 0.75;
      d.v.y -= 32 * dt;
      d.m.position.addScaledVector(d.v, dt);
      d.m.scale.setScalar(Math.max(d.life, 0) * d.size);
      if (d.life <= 0 || d.m.position.y < -2) { d.life = 0; d.m.visible = false; }
    }
  }
}

// ───────── Ballena jorobada ─────────

function whaleBody() {
  const dark = '#2c3d5c';
  const g: BufferGeometry[] = [
    part(ORB, dark, { s: [7.5, 6.5, 28] }),
    part(ORB, '#dfe8ef', { p: [0, -2.6, 1.5], s: [6.4, 4.6, 25] }),
    part(CONE, dark, { p: [0, 0.6, -31], r: [-Math.PI / 2, 0, 0], s: [4.2, 18, 3.4] }),
  ];
  // tubérculos de la cabeza
  for (let i = 0; i < 6; i++) g.push(part(ORB, '#1f2c45', { p: [(i % 2 ? 1 : -1) * 1.6, 5.4, 15 + i * 2], s: 0.8 }));
  // aletas pectorales largas y claras, y la cola
  for (const side of [-1, 1]) {
    g.push(part(BLADE, '#c9d6e2', { p: [side * 6, -2, 11], r: [0.35, side * (Math.PI / 2 + 0.55), 0], s: [2.2, 0.5, 9.5], o: 'YXZ' }));
    g.push(part(BLADE, dark, { p: [0, 0.6, -39], r: [0, side * (Math.PI - 0.95), 0], s: [3.2, 0.7, 7.5], o: 'YXZ' }));
  }
  return solid(g);
}

function buildWhales(spray: Spray): Living {
  const base = byId('ballena').pos.clone();
  const group = new Group();
  const mother = new Group();
  mother.add(whaleBody());
  const calf = new Group();
  calf.add(whaleBody());
  calf.scale.setScalar(0.5);
  group.add(mother, calf);
  // Lancha de avistamiento, a distancia respetuosa.
  let lastSplash = -1;
  let lastBlow = -1;
  const update = (t: number) => {
    const period = 14;
    const c = t % period;
    const cycle = Math.floor(t / period);
    // Salto (breach): sale casi entera, gira y cae de lado.
    if (c < 3.6) {
      const u = c / 3.6;
      mother.position.set(base.x, -32 + 78 * Math.sin(Math.PI * u), base.z);
      mother.rotation.set(-1.25 + 1.9 * u, 0.3, u * 1.5);
      if (u > 0.82 && lastSplash !== cycle) {
        lastSplash = cycle;
        spray.emit(new Vector3(base.x, 2, base.z), 40, { spread: 30, up: 45, size: 4 });
      }
    } else {
      // Nada cerca de la superficie: se le ve el lomo y sopla.
      const v = (c - 3.6) / (period - 3.6);
      mother.position.set(base.x - 30 * Math.sin(v * Math.PI), -6.5 + 3 * Math.sin(v * TAU * 2), base.z + 60 * v);
      mother.rotation.set(-0.05 * Math.cos(v * TAU * 2), 0.3, 0);
      const blow = Math.floor((c - 3.6) / 3.5);
      if (blow !== lastBlow) {
        lastBlow = blow;
        spray.emit(mother.localToWorld(new Vector3(0, 7, 16)), 16, { spread: 3, up: 42, size: 2.2 });
      }
    }
    // La cría acompaña a la madre, siempre cerca de la superficie.
    calf.position.set(base.x - 26 + 6 * Math.sin(t * 0.3), -4.5 + 2.2 * Math.sin(t * 0.9), base.z + 30 + 20 * Math.sin(t * 0.12));
    calf.rotation.set(-0.08 * Math.cos(t * 0.9), 0.35, 0);
  };
  return { group, update };
}

// ───────── Tortuga golfina ─────────

function buildTurtle(): Living {
  const base = byId('tortuga').pos;
  const turtle = new Group();
  const g: BufferGeometry[] = [
    part(ORB, '#8f9a4c', { s: [7.5, 2.8, 9.5] }),
    part(ORB, '#d8cf98', { p: [0, -1, 0], s: [7, 1.6, 9] }),
    part(ORB, '#9aa063', { p: [0, 0.2, 11], s: [2.2, 2, 3.2] }),
    part(ORB, '#1d1d1d', { p: [1.2, 1, 12.6], s: 0.35 }),
    part(ORB, '#1d1d1d', { p: [-1.2, 1, 12.6], s: 0.35 }),
  ];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    g.push(part(ORB, i % 2 ? '#a7ad5e' : '#77813e', { p: [Math.cos(a) * 3.6, 2.2, Math.sin(a) * 4.6], s: [2.3, 0.7, 2.3] }));
  }
  g.push(part(ORB, '#a7ad5e', { p: [0, 2.8, 0], s: [2.6, 0.8, 2.6] }));
  turtle.add(solid(g));
  const flippers: Object3D[] = [];
  for (const [side, front] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
    const f = new Group();
    f.position.set(side * (front ? 6 : 5), -0.5, front ? 5 : -7);
    f.add(new Mesh(merge([part(BLADE, '#8c925a', { r: [0, side * (Math.PI / 2 + (front ? 0.5 : 0.9)), 0], s: front ? [2.2, 0.4, 6.5] : [1.6, 0.4, 3.5], o: 'YXZ' })]), paint));
    f.userData.side = side;
    f.userData.front = front;
    turtle.add(f);
    flippers.push(f);
  }
  turtle.scale.setScalar(1.4);
  const update = (t: number) => {
    const a = t * 0.12;
    turtle.position.set(base.x + Math.cos(a) * 55, 1.6 + Math.sin(t * 1.3) * 0.5, base.z + Math.sin(a) * 55);
    turtle.rotation.y = -a + Math.PI;
    for (const f of flippers) f.rotation.z = f.userData.side * Math.sin(t * (f.userData.front ? 2.2 : 2.2) + (f.userData.front ? 0 : 1)) * 0.45;
  };
  return { group: turtle, update };
}

// ───────── Cangrejo fantasma rojo ─────────

function buildCrab(): Living {
  const base = byId('cangrejo').pos;
  const g: BufferGeometry[] = [
    part(ORB, '#e2522c', { p: [0, 5, 0], s: [7, 3, 5.5] }),
    part(ORB, '#f07a48', { p: [0, 6.4, 0], s: [5, 1.6, 4] }),
  ];
  for (const side of [-1, 1]) {
    g.push(pole('#d24a28', [side * 2, 6.5, 4], [side * 2.6, 10, 4.6], 0.4), part(ORB, '#1c1c1c', { p: [side * 2.6, 10.2, 4.6], s: 0.9 }));
    g.push(pole('#e2522c', [side * 5.5, 5, 3], [side * 6.5, 5.5, 6.5], 0.8));
    g.push(part(ORB, '#ef6a3a', { p: [side * 6.5, 5.5, 7.5], s: [2.6, 2, 3] }), part(ORB, '#f7d6c4', { p: [side * 6.5, 5.5, 10], s: [1.2, 0.9, 1.6] }));
    for (let i = 0; i < 4; i++) {
      const z = -3 + i * 2;
      g.push(pole('#f08a50', [side * 5.5, 5, z], [side * 9.5, 3.5, z * 1.3], 0.5), pole('#f08a50', [side * 9.5, 3.5, z * 1.3], [side * 11, 0, z * 1.5], 0.4));
    }
  }
  const crab = new Group();
  crab.add(solid(g));
  crab.scale.setScalar(1.5);
  const update = (t: number) => {
    const s = Math.sin(t * 0.5);
    const z = base.z + s * 28;
    const x = coastX(z) + 14;
    crab.position.set(x, heightAt(x, z) + Math.abs(Math.sin(t * 9)) * 0.6, z);
    // Camina de lado, mirando al mar.
    crab.rotation.set(0, -Math.PI / 2, Math.sin(t * 9) * 0.04);
  };
  return { group: crab, update };
}

// ───────── Pava del Baudó, posada en una rama ─────────

function buildPava(): Living {
  const p = byId('pava').pos;
  const group = new Group();
  group.position.set(p.x, heightAt(p.x, p.z) - 1, p.z);
  group.add(
    solid([
      pole('#8f7a63', [0, 0, 0], [0, 40, 0], 2.6),
      pole('#8f7a63', [0, 24, 0], [-16, 30, 2], 1.1),
      part(BALL, '#3f8b4c', { p: [0, 44, 0], s: [17, 6, 17] }),
      part(BALL, '#4a9852', { p: [-8, 36, 2], s: [8, 4, 8] }),
    ]),
  );
  const bird = new Group();
  const body: BufferGeometry[] = [
    part(ORB, '#4b342a', { p: [0, 5, 0], s: [4.2, 4.6, 7.5], r: [-0.3, 0, 0] }),
    part(ORB, '#3a2a22', { p: [0, 4, -9], s: [2.4, 1, 8.5], r: [-0.45, 0, 0] }),
    pole('#b9473a', [-1, 1, 0], [-1, -0.5, 0], 0.4),
    pole('#b9473a', [1, 1, 0], [1, -0.5, 0], 0.4),
    pole('#4b342a', [0, 7.5, 4], [0, 10.5, 5.6], 1.2),
  ];
  for (let i = 0; i < 12; i++) body.push(part(ORB, '#efe6dc', { p: [((i % 4) - 1.5) * 1.6, 3.5 + Math.floor(i / 4) * 1.6, 5.8 - Math.floor(i / 4) * 0.4], s: 0.45 }));
  bird.add(solid(body));
  const head = new Group();
  head.position.set(0, 11, 6);
  head.add(solid([
    part(ORB, '#3a2a22', { s: [1.9, 1.9, 2.4] }),
    part(CONE, '#cfc6b8', { p: [0, -0.2, 2.6], r: [Math.PI / 2, 0, 0], s: [0.6, 1.6, 0.6] }),
    part(ORB, '#d0332c', { p: [0, -1.8, 1.2], s: [0.8, 1.5, 0.8] }),
    part(ORB, '#f0e6d8', { p: [1.2, 0.4, 1], s: 0.45 }),
    part(ORB, '#f0e6d8', { p: [-1.2, 0.4, 1], s: 0.45 }),
  ]));
  bird.add(head);
  bird.position.set(-13, 29.5, 1.6);
  bird.rotation.y = -Math.PI / 2 + 0.4;
  bird.scale.setScalar(1.25);
  group.add(bird);
  const update = (t: number) => {
    head.rotation.x = Math.sin(t * 1.7) * 0.12;
    head.rotation.y = Math.sin(t * 0.6) * 0.5;
  };
  return { group, update };
}

// ───────── Rana arlequín sobre una hoja ─────────

function buildFrog(): Living {
  const p = byId('rana').pos;
  const group = new Group();
  group.position.set(p.x, heightAt(p.x, p.z) - 0.5, p.z);
  // Hoja grande de platanillo donde se posa.
  group.add(solid([
    pole('#7fa84a', [0, 0, 0], [0, 8, 0], 1),
    part(BLADE, '#5fb04f', { p: [0, 8, 0], r: [-0.12, -Math.PI / 2, 0], s: [5.5, 0.5, 9], o: 'YXZ' }),
    part(BLADE, '#6cbf5a', { p: [0, 7, 0], r: [-0.6, 0.6, 0], s: [3.5, 0.4, 7], o: 'YXZ' }),
    part(BLADE, '#5aae4c', { p: [0, 6, 0], r: [-0.7, 2.4, 0], s: [3.5, 0.4, 7], o: 'YXZ' }),
  ]));
  const frog = new Group();
  const g: BufferGeometry[] = [
    part(ORB, '#e8452c', { p: [0, 3, 0], s: [4, 3, 5] }),
    part(ORB, '#e8452c', { p: [0, 4.4, 3.4], s: [3, 2.2, 2.6] }),
    part(ORB, '#151515', { p: [2, 5.6, 3.8], s: 1.1 }),
    part(ORB, '#151515', { p: [-2, 5.6, 3.8], s: 1.1 }),
  ];
  const spots: [number, number, number][] = [[1.5, 5.3, 0.5], [-1.8, 5.1, -0.6], [0.2, 5.8, -1.8], [2.6, 4.2, -2], [-2.8, 4, 1.4], [0.6, 5.2, 2], [-0.8, 4.6, -3.6], [3.4, 3.2, 1.6]];
  for (const s of spots) g.push(part(ORB, '#151515', { p: s, s: [0.9, 0.45, 0.9] }));
  for (const side of [-1, 1]) {
    g.push(part(ORB, '#2a1a14', { p: [side * 3.6, 1.6, -1.8], s: [1.6, 1.3, 3.6] }), part(ORB, '#e8452c', { p: [side * 3.9, 2.4, -1.4], s: 0.7 }));
    g.push(pole('#2a1a14', [side * 2.6, 2.2, 3], [side * 3.2, 0, 4.4], 0.6));
  }
  frog.add(solid(g));
  frog.scale.setScalar(1.6);
  frog.position.set(-6, 8.2, 0);
  frog.rotation.y = -Math.PI / 2;
  group.add(frog);
  const update = (t: number) => {
    const c = t % 6;
    const hop = c < 0.6 ? Math.sin((c / 0.6) * Math.PI) : 0;
    frog.position.y = 8.2 + hop * 6;
    frog.rotation.x = -hop * 0.3;
    frog.scale.y = 1.6 * (1 + Math.sin(t * 6) * 0.03 * (1 - hop)); // respira
  };
  return { group, update };
}

// ───────── Cacao ─────────

function buildCacao(rand: () => number) {
  const p = byId('cacao').pos;
  const group = new Group();
  for (let k = 0; k < 4; k++) {
    const x = p.x + (k % 2 ? 1 : -1) * (14 + rand() * 10);
    const z = p.z + (k < 2 ? -1 : 1) * (12 + rand() * 10);
    const g: BufferGeometry[] = [pole('#6e5038', [0, 0, 0], [0, 10, 0], 1.2), part(BALL, '#3f8a45', { p: [0, 14, 0], s: [7.5, 6, 7.5] })];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rand();
      g.push(part(ORB, ['#c4572c', '#e0912f', '#9c3e24'][i % 3], { p: [Math.cos(a) * 1.9, 3 + (i % 4) * 1.8, Math.sin(a) * 1.9], s: [1.1, 2.3, 1.1] }));
    }
    const tree = solid(g);
    tree.position.set(x, heightAt(x, z) - 0.5, z);
    tree.scale.setScalar(1.3);
    group.add(tree);
  }
  return group;
}

// ───────── Aves ─────────

function frigatebird() {
  const bird = new Group();
  bird.add(solid([
    part(ORB, '#1d1d22', { s: [0.9, 0.9, 4] }),
    part(ORB, '#c8352c', { p: [0, -0.5, 2.2], s: [0.6, 0.6, 0.9] }),
    part(CONE, '#9a9a9a', { p: [0, 0, 4.6], r: [Math.PI / 2, 0, 0], s: [0.25, 1.8, 0.25] }),
    part(BLADE, '#1d1d22', { p: [0, 0, -3], r: [0, Math.PI - 0.25, 0], s: [0.35, 0.1, 2.4], o: 'YXZ' }),
    part(BLADE, '#1d1d22', { p: [0, 0, -3], r: [0, Math.PI + 0.25, 0], s: [0.35, 0.1, 2.4], o: 'YXZ' }),
  ]));
  const wings = [-1, 1].map((side) => {
    const w = new Group();
    w.add(new Mesh(merge([part(BLADE, '#25252b', { r: [0, side * (Math.PI / 2 + 0.25), 0], s: [1.3, 0.15, 4.2], o: 'YXZ' })]), paint));
    w.userData.side = side;
    bird.add(w);
    return w;
  });
  bird.scale.setScalar(2.4);
  return { bird, wings };
}

function pelican() {
  const bird = new Group();
  bird.add(solid([
    part(ORB, '#a1968a', { s: [1.4, 1.2, 4.2] }),
    part(ORB, '#f1ece2', { p: [0, 0.8, 3.8], s: [0.9, 0.9, 1.2] }),
    part(CONE, '#d9b25a', { p: [0, 0.4, 6.4], r: [Math.PI / 2, 0, 0], s: [0.45, 4, 0.6] }),
  ]));
  const wings = [-1, 1].map((side) => {
    const w = new Group();
    w.add(new Mesh(merge([part(BLADE, '#7d746b', { r: [0, side * (Math.PI / 2), 0], s: [1.6, 0.18, 5], o: 'YXZ' })]), paint));
    w.userData.side = side;
    bird.add(w);
    return w;
  });
  bird.scale.setScalar(2.2);
  return { bird, wings };
}

function buildBirds(rand: () => number): Living {
  const group = new Group();
  const flocks = [-1700, -350, 600].map((z) => ({ cx: coastX(z) - 60, cz: z, birds: [] as ReturnType<typeof frigatebird>[] }));
  for (const f of flocks) for (let i = 0; i < 5; i++) {
    const b = frigatebird();
    b.bird.userData = { r: 90 + rand() * 120, y: 130 + rand() * 90, w: 0.12 + rand() * 0.1, a0: rand() * TAU };
    group.add(b.bird);
    f.birds.push(b);
  }
  const pelicans = Array.from({ length: 6 }, (_, i) => {
    const b = pelican();
    b.bird.userData.i = i;
    group.add(b.bird);
    return b;
  });
  const span = Z_LIMIT.max - Z_LIMIT.min + 1200;
  const update = (t: number) => {
    for (const f of flocks) for (const { bird, wings } of f.birds) {
      const { r, y, w, a0 } = bird.userData as { r: number; y: number; w: number; a0: number };
      const a = a0 + t * w;
      bird.position.set(f.cx + Math.cos(a) * r, y + Math.sin(t * 0.4 + a0) * 10, f.cz + Math.sin(a) * r);
      bird.rotation.set(0, -a, 0.35);
      for (const wing of wings) wing.rotation.z = wing.userData.side * (0.15 + Math.sin(t * 1.2 + a0) * 0.12);
    }
    // Pelícanos en fila, rozando el agua a lo largo de la costa.
    const lead = Z_LIMIT.min - 600 + ((t * 26) % span);
    for (const { bird, wings } of pelicans) {
      const i = bird.userData.i as number;
      const z = lead - i * 22;
      bird.position.set(coastX(z) - 140 - i * 9, 16 + Math.sin(t * 0.8 + i) * 2, z);
      bird.rotation.set(0, 0, 0);
      const flap = Math.sin(t * 5 - i * 0.6);
      for (const wing of wings) wing.rotation.z = wing.userData.side * (flap > 0.6 ? flap * 0.5 : 0.05);
    }
  };
  return { group, update };
}

// ───────── Mariposas ─────────

function buildButterflies(rand: () => number): Living {
  const group = new Group();
  const anchors = [...placed.filter((p) => p.kind !== 'town').map((p) => p.pos), ...nature.filter((n) => n.inland > 0).map((n) => n.pos)];
  const wingGeo = (side: number, color: string) => merge([
    part(ORB, color, { p: [side * 2.1, 0, 0.6], s: [2.1, 0.12, 1.7] }),
    part(ORB, color, { p: [side * 1.6, 0, -1.4], s: [1.5, 0.12, 1.2] }),
    part(ORB, '#1d1a17', { p: [side * 3.8, 0.05, 1.2], s: [0.5, 0.14, 0.5] }),
  ]);
  const flies = Array.from({ length: 46 }, () => {
    const color = rand() < 0.75 ? '#f39a2c' : '#f7cf3d';
    const fly = new Group();
    fly.add(new Mesh(merge([part(ORB, '#2a2420', { s: [0.35, 0.35, 1.6] })]), paint));
    const wings = [-1, 1].map((side) => {
      const w = new Mesh(wingGeo(side, color), paint);
      fly.add(w);
      w.userData.side = side;
      return w;
    });
    const a = anchors[Math.floor(rand() * anchors.length)];
    fly.userData = { ax: a.x + (rand() - 0.5) * 120, az: a.z + (rand() - 0.5) * 120, r: 10 + rand() * 25, ph: rand() * TAU, sp: 0.4 + rand() * 0.5 };
    fly.scale.setScalar(1.3);
    group.add(fly);
    return { fly, wings };
  });
  const update = (t: number) => {
    for (const { fly, wings } of flies) {
      const { ax, az, r, ph, sp } = fly.userData as Record<string, number>;
      const a = ph + t * sp;
      const x = ax + Math.cos(a) * r;
      const z = az + Math.sin(a * 1.3) * r;
      fly.position.set(x, Math.max(heightAt(x, z), 1) + 8 + Math.sin(t * 2 + ph) * 3, z);
      fly.rotation.y = -a;
      for (const w of wings) w.rotation.z = w.userData.side * Math.sin(t * 16 + ph) * 0.9;
    }
  };
  return { group, update };
}

// ───────── Todo junto ─────────

/** Altura de cada rótulo de naturaleza sobre el terreno o el agua. */
export const NATURE_LABEL_HEIGHT: Record<string, number> = {
  ballena: 70, tortuga: 22, cangrejo: 26, pava: 58, rana: 30, manglar: 30, cacao: 34,
};

export function buildFauna(rand: () => number): Living {
  const spray = new Spray(90);
  const parts: Living[] = [buildWhales(spray), buildTurtle(), buildCrab(), buildPava(), buildFrog(), buildBirds(rand), buildButterflies(rand)];
  const group = new Group();
  group.add(spray.group, buildCacao(rand), ...parts.map((p) => p.group));
  return {
    group,
    update: (t, dt) => {
      for (const p of parts) p.update(t, dt);
      spray.update(dt);
    },
  };
}

