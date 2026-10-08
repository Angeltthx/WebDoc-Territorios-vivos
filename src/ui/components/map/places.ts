// Lo que se ve en cada lugar del afiche: casas de pilotes en los pueblos, tambos emberá en Kipara Té,
// las posadas y hostales, el museo, la pareja que baila en Las Serranías y Chachita en su posada.
// También las embarcaciones: lanchas que van y vienen entre pueblos y champas (canoas) de pescadores.

import { type BufferGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { BOX, CONE, CYL, ORB, merge, paint, part, person, pole, solid, stiltHouse } from './kit';
import type { Living } from './fauna';
import { coastX, heightAt, placed, riverReach } from './terrain';

const TAU = Math.PI * 2;
/** Mirando al mar (−x). */
const FACE_SEA = -Math.PI / 2;

const WALLS = ['#f4e6c8', '#efb7a0', '#a9d8cc', '#f6d58d', '#e0957a', '#c8d7ef', '#9fd0a8', '#f2c6d6'];
const ROOFS = ['#9aa3a6', '#b4523b', '#3d6f9e', '#c96f45', '#8d979a'];

// ───────── Embarcaciones ─────────

/** Lancha de fibra con franja de color, motor fuera de borda y pasajeros con chaleco naranja. */
export function lancha(stripe: string, { canopy = false, people = 3 } = {}) {
  const g: BufferGeometry[] = [
    part(BOX, '#f4f4ef', { p: [0, 1.2, 0], s: [6, 2.4, 16] }),
    part(CONE, '#f4f4ef', { p: [0, 1.2, 10.4], r: [Math.PI / 2, 0, 0], s: [3, 5, 1.2] }),
    part(BOX, stripe, { p: [0, 1.7, 0], s: [6.1, 0.7, 16.05] }),
    part(BOX, '#9fb3c0', { p: [0, 2.2, 0], s: [5, 0.3, 14] }),
    part(BOX, '#2b2b2b', { p: [0, 2.6, -8.7], s: [1.6, 3.2, 1.6] }),
  ];
  for (let i = 0; i < people; i++) {
    const z = 4 - i * 4.5;
    g.push(part(ORB, '#f47b20', { p: [0, 3.8, z], s: [1.2, 1.5, 1] }), part(ORB, '#6b3f29', { p: [0, 5.7, z], s: 0.75 }));
  }
  if (canopy) {
    for (const sx of [-2.8, 2.8]) for (const sz of [-4, 4]) g.push(pole('#d8d8d8', [sx, 2.4, sz], [sx, 8, sz], 0.2));
    g.push(part(BOX, stripe, { p: [0, 8.2, 0], s: [6.4, 0.4, 9.5] }));
  }
  return solid(g);
}

/** Champa: canoa de madera tallada de un solo tronco, con su remero. */
export function champa(shirt = '#e2456f') {
  const boat = new Group();
  boat.add(solid([
    part(ORB, '#6b4a2e', { p: [0, 0.8, 0], s: [2.3, 1.4, 11] }),
    part(ORB, '#3d2a1a', { p: [0, 1.5, 0], s: [1.8, 1, 10] }),
  ]));
  const rower = person({ top: shirt, legs: '#3a4a5a' });
  rower.group.scale.setScalar(0.5);
  rower.group.position.set(0, 0.4, -3);
  const paddle = new Group();
  paddle.add(new Mesh(merge([pole('#8a6a48', [0, 3, 0], [0, -4, 0], 0.25), part(ORB, '#8a6a48', { p: [0, -4.5, 0], s: [0.9, 1.6, 0.25] })]), paint));
  paddle.position.set(2.2, 5, -2.4);
  boat.add(rower.group, paddle);
  return { boat, paddle, rower };
}

// ───────── Lugares ─────────

interface Built {
  object: Object3D;
  height: number;
  update?: (t: number) => void;
}

const at = (o: Object3D, x: number, z: number, ry = 0) => {
  o.position.set(x, heightAt(x, z) - 0.3, z);
  o.rotation.y = ry;
  return o;
};

/** Tambo emberá: casa redonda elevada, con techo cónico de palma. */
function tambo(scale = 1) {
  const g: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    g.push(pole('#6d5238', [Math.cos(a) * 6, 0, Math.sin(a) * 6], [Math.cos(a) * 6, 5, Math.sin(a) * 6], 0.5));
  }
  g.push(part(CYL, '#9a7a52', { p: [0, 5, 0], s: [7.5, 0.8, 7.5] }));
  g.push(part(CYL, '#cfa66a', { p: [0, 7, 0], s: [6, 3.2, 6] }));
  g.push(part(CONE, '#b08a4a', { p: [0, 13.5, 0], s: [10.5, 10, 10.5] }));
  g.push(part(CONE, '#8f6c35', { p: [0, 18.8, 0], s: [1.5, 2, 1.5] }));
  g.push(pole('#6d5238', [-8, 0, 0], [-6, 5, 0], 0.5));
  const m = solid(g);
  m.scale.setScalar(scale);
  return m;
}

function town(id: string, rand: () => number): Built {
  const p = placed.find((q) => q.id === id)!;
  const group = new Group();
  const count = id === 'nuqui' ? 22 : 13;
  let made = 0;
  for (let tries = 0; made < count && tries < 200; tries++) {
    const z = p.pos.z + (rand() - 0.5) * (id === 'nuqui' ? 230 : 170);
    const x = coastX(z) + 16 + rand() * (id === 'nuqui' ? 120 : 80);
    if (riverReach(x, z) < 1.7) continue;
    const { mesh } = stiltHouse(WALLS[Math.floor(rand() * WALLS.length)], ROOFS[Math.floor(rand() * ROOFS.length)], {
      w: 10 + rand() * 5, d: 8 + rand() * 4, stilts: 2 + rand() * 2.5, floors: rand() < 0.2 ? 2 : 1, thatch: rand() < 0.15,
    });
    group.add(at(mesh, x, z, (rand() - 0.5) * 0.4));
    made++;
  }
  // Champas varadas en la playa.
  for (let i = 0; i < 3; i++) {
    const z = p.pos.z + (rand() - 0.5) * 160;
    const { boat } = champa();
    boat.remove(boat.children[1], boat.children[2]);
    group.add(at(boat, coastX(z) + 5, z, 0.2 + rand() * 0.4));
  }
  // Nuquí: muelle con lanchas amarradas.
  if (id === 'nuqui') {
    const z = p.pos.z - 70;
    const x0 = coastX(z) + 10;
    const g: BufferGeometry[] = [part(BOX, '#8a6a48', { p: [-35, 3.6, 0], s: [80, 0.8, 7] })];
    for (let i = 0; i < 9; i++) for (const sz of [-3, 3]) g.push(pole('#5d4630', [-i * 9.5, -6, sz], [-i * 9.5, 3.4, sz], 0.5));
    const pier = solid(g);
    pier.position.set(x0, 0, z);
    group.add(pier);
    for (const [dx, dz, c] of [[-50, 10, '#2f56a6'], [-66, -10, '#e2456f'], [-30, 10, '#2c9a6a']] as const) {
      const l = lancha(c, { people: 0 });
      l.position.set(x0 + dx, 0.4, z + dz);
      l.rotation.y = FACE_SEA;
      group.add(l);
    }
  }
  return { object: group, height: 20 };
}

function site(id: string): Built {
  const p = placed.find((q) => q.id === id)!;
  const { x, z } = p.pos;
  const group = new Group();
  let height = 16;
  let update: ((t: number) => void) | undefined;
  switch (id) {
    case 'kipara-te': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        group.add(at(tambo(1.3), x + Math.cos(a) * 44, z + Math.sin(a) * 44));
      }
      group.add(at(tambo(1.7), x, z));
      height = 36;
      break;
    }
    case 'lobos-del-manglar': {
      group.add(at(stiltHouse('#c8a26a', '#b08a4a', { thatch: true, stilts: 4 }).mesh, x + 10, z - 8, 0.3));
      const g: BufferGeometry[] = [part(BOX, '#8a6a48', { p: [-14, 3.2, 0], s: [30, 0.7, 5] })];
      for (let i = 0; i < 4; i++) for (const sz of [-2.2, 2.2]) g.push(pole('#5d4630', [-i * 9, -5, sz], [-i * 9, 3, sz], 0.45));
      const dock = solid(g);
      dock.position.set(x - 4, 0, z + 14);
      group.add(dock);
      const { boat } = champa();
      boat.position.set(x - 26, 0.3, z + 22);
      group.add(boat);
      height = 22;
      break;
    }
    case 'vientos-de-yubarta': {
      group.add(at(stiltHouse('#d9b98a', '#b08a4a', { thatch: true, stilts: 4, w: 14 }).mesh, x, z - 10, 0.2));
      group.add(at(stiltHouse('#e8cfa0', '#a8803e', { thatch: true, stilts: 4 }).mesh, x + 14, z + 16, -0.3));
      height = 24;
      break;
    }
    case 'carlitours': {
      group.add(at(stiltHouse('#f6d58d', '#3d6f9e', { stilts: 2.5 }).mesh, x, z));
      const zz = z + 6;
      const boat = lancha('#3d6f9e', { canopy: true, people: 0 });
      boat.position.set(coastX(zz) - 8, 0.5, zz);
      boat.rotation.y = FACE_SEA;
      group.add(boat);
      height = 18;
      break;
    }
    case 'museo-melele': {
      const g: BufferGeometry[] = [
        part(BOX, '#f6f1e6', { p: [0, 6, 0], s: [14, 12, 18] }),
        part(CONE, '#c96f45', { p: [0, 15, 0], r: [0, Math.PI / 4, 0], s: [13, 6, 15] }),
      ];
      // Fachada pintada con franjas de colores del afiche.
      ['#f39a2c', '#2c9a6a', '#e2456f', '#2f56a6', '#f7cf3d'].forEach((c, i) => g.push(part(BOX, c, { p: [-7.1, 2 + i * 1.9, 0], s: [0.3, 1.6, 17] })));
      g.push(part(BOX, '#3b2c22', { p: [-7.3, 3, 0], s: [0.3, 6, 3.4] }));
      group.add(at(solid(g), x, z));
      height = 22;
      break;
    }
    case 'escombros-nuqui':
    case 'escombros-coqui': {
      group.add(at(stiltHouse('#5aa3c8', '#9aa3a6', { floors: 2, stilts: 3, w: 13 }).mesh, x, z, 0.15));
      height = 24;
      break;
    }
    case 'las-serranias': {
      const stage = solid([
        part(BOX, '#8a6a48', { p: [0, 1, 0], s: [22, 2, 18] }),
        // Postes con banderines, sin techo, para que se vea el baile desde arriba.
        ...[-10, 10].flatMap((sx) => [-8, 8].map((sz) => pole('#6d5238', [sx, 2, sz], [sx, 12, sz], 0.5))),
        ...[-8, -4, 0, 4, 8].map((bz, i) => part(CONE, ['#f39a2c', '#e2456f', '#f7cf3d', '#2c9a6a', '#2f56a6'][i], { p: [-10, 11, bz], r: [Math.PI, 0, 0], s: [0.9, 2, 0.9] })),
        ...[-8, -4, 0, 4, 8].map((bz, i) => part(CONE, ['#2f56a6', '#f7cf3d', '#e2456f', '#f39a2c', '#2c9a6a'][i], { p: [10, 11, bz], r: [Math.PI, 0, 0], s: [0.9, 2, 0.9] })),
      ]);
      group.add(at(stage, x, z));
      const woman = person({ skin: '#5a3424', top: '#f7f3ea', skirt: { color: '#f7f3ea', flare: 6, trim: '#e2456f' }, head: { kind: 'hair', color: '#1d1611' } });
      const man = person({ skin: '#5a3424', top: '#f7f3ea', legs: '#f7f3ea', head: { kind: 'hat', color: '#d9b25a' } });
      const drummer = person({ skin: '#4a2a1c', top: '#2f56a6', legs: '#3a3a3a' });
      const drum = solid([part(CYL, '#8a5a34', { p: [0, 3, 0], s: [2.2, 6, 2.2] }), part(CYL, '#e9dcc0', { p: [0, 6.1, 0], s: [2.3, 0.3, 2.3] })]);
      const base = new Group();
      at(base, x, z);
      base.position.y += 2;
      drummer.group.position.set(6, 0, -6);
      drum.position.set(3.6, 0, -6);
      base.add(woman.group, man.group, drummer.group, drum);
      group.add(base);
      update = (t) => {
        const a = t * 0.9;
        woman.group.position.set(Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5);
        woman.group.rotation.y = -t * 3;
        woman.armL.rotation.z = -2.3 + Math.sin(t * 3) * 0.3;
        woman.armR.rotation.z = 2.3 + Math.sin(t * 3 + 1) * 0.3;
        man.group.position.set(-Math.cos(a) * 4.5, Math.abs(Math.sin(t * 4)) * 0.6, -Math.sin(a) * 4.5);
        man.group.lookAt(woman.group.getWorldPosition(new Vector3()));
        man.armR.rotation.z = 2 + Math.sin(t * 4) * 0.5;
        drummer.armL.rotation.x = -0.8 + Math.sin(t * 9) * 0.4;
        drummer.armR.rotation.x = -0.8 + Math.sin(t * 9 + Math.PI) * 0.4;
      };
      height = 22;
      break;
    }
    case 'posada-chachita': {
      group.add(at(stiltHouse('#f6c04a', '#c95b3c', { stilts: 3, w: 14 }).mesh, x + 8, z));
      const chachita = person({
        skin: '#5a3424',
        top: '#2f56a6',
        skirt: { color: '#2f56a6', flare: 3.4, trim: '#f3efe6' },
        head: { kind: 'wrap', colors: ['#f39a2c', '#f7c548', '#e2456f'] },
      });
      chachita.group.scale.setScalar(1.3);
      at(chachita.group, x - 10, z - 4, FACE_SEA);
      group.add(chachita.group);
      update = (t) => {
        chachita.armR.rotation.z = 2.4 + Math.sin(t * 5) * 0.45;
        chachita.armL.rotation.z = -0.15;
      };
      height = 22;
      break;
    }
    case 'posada-sonona': {
      for (let i = 0; i < 3; i++) {
        const a = -0.8 + i * 0.8;
        group.add(at(stiltHouse(['#d9b98a', '#c8a26a', '#e8cfa0'][i], '#b08a4a', { thatch: true, stilts: 3, w: 10, d: 9 }).mesh, x + Math.cos(a) * 18, z + Math.sin(a) * 22, a));
      }
      height = 20;
      break;
    }
  }
  return { object: group, height, update };
}

// ───────── Lanchas en movimiento y champas pescando ─────────

function traffic(rand: () => number): Living {
  const group = new Group();
  const wakeMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
  const routes = [
    { from: 'nuqui', to: 'jurubida', off: 150, period: 90, stripe: '#2f56a6', canopy: true },
    { from: 'nuqui', to: 'coqui', off: 190, period: 75, stripe: '#e2456f', canopy: false },
    { from: 'tribuga', to: 'pangui', off: 260, period: 110, stripe: '#2c9a6a', canopy: true },
  ].map((r) => {
    const boat = new Group();
    boat.add(lancha(r.stripe, { canopy: r.canopy }));
    const wake = new Mesh(merge([part(CONE, '#ffffff', { p: [0, 0.4, -15], r: [-Math.PI / 2, 0, 0], s: [4, 14, 0.4] })]), wakeMat);
    boat.add(wake);
    group.add(boat);
    const za = placed.find((p) => p.id === r.from)!.pos.z;
    const zb = placed.find((p) => p.id === r.to)!.pos.z;
    return { ...r, boat, za, zb, prev: new Vector3() };
  });
  const fishers = Array.from({ length: 7 }, (_, i) => {
    const c = champa(['#e2456f', '#f6d58d', '#2f56a6', '#f3efe6'][i % 4]);
    const z = -1900 + i * 480 + rand() * 120;
    c.boat.userData = { x: coastX(z) - 60 - rand() * 140, z, ph: rand() * TAU, ry: rand() * TAU };
    group.add(c.boat);
    return c;
  });
  const pos = (r: (typeof routes)[number], t: number) => {
    const u = (t / r.period) % 1;
    const k = u < 0.5 ? u * 2 : 2 - u * 2;
    const s = k * k * (3 - 2 * k);
    const z = r.za + (r.zb - r.za) * s;
    return new Vector3(coastX(z) - r.off, 0.6, z);
  };
  const update = (t: number) => {
    for (const r of routes) {
      const p = pos(r, t);
      const ahead = pos(r, t + 0.5);
      r.boat.position.set(p.x, 0.6 + Math.sin(t * 2.2) * 0.5, p.z);
      if (ahead.distanceToSquared(p) > 0.01) r.boat.rotation.y = Math.atan2(ahead.x - p.x, ahead.z - p.z);
      r.boat.rotation.z = Math.sin(t * 1.7) * 0.05;
      r.boat.children[1].visible = ahead.distanceTo(p) > 2;
    }
    for (const { boat, paddle } of fishers) {
      const { x, z, ph, ry } = boat.userData as Record<string, number>;
      boat.position.set(x + Math.sin(t * 0.05 + ph) * 20, 0.2 + Math.sin(t * 1.6 + ph) * 0.5, z);
      boat.rotation.set(0, ry + Math.sin(t * 0.05 + ph) * 0.3, Math.sin(t * 1.3 + ph) * 0.06);
      paddle.rotation.x = Math.sin(t * 1.8 + ph) * 0.7;
    }
  };
  return { group, update };
}

// ───────── Todo junto ─────────

export function buildPlaces(rand: () => number) {
  const group = new Group();
  const heights = new Map<string, number>();
  const updates: ((t: number) => void)[] = [];
  for (const p of placed) {
    const built = p.kind === 'town' ? town(p.id, rand) : site(p.id);
    group.add(built.object);
    heights.set(p.id, built.height);
    if (built.update) updates.push(built.update);
  }
  const boats = traffic(rand);
  group.add(boats.group);
  return {
    group,
    heights,
    update: (t: number, dt: number) => {
      for (const u of updates) u(t);
      boats.update(t, dt);
    },
  };
}

