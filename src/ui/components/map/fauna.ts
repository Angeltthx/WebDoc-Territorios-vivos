// Fauna y flora del afiche, animadas: ballena jorobada (salta y sopla, con su cría), tortuga golfina,
// cangrejo fantasma rojo, pava del Baudó, rana arlequín y cacao; además fragatas, pelícanos y mariposas.
// Las figuras son más grandes que en la realidad, como las ilustraciones del afiche, para que se distingan.
//
// Ballenas, tortugas, cangrejos, pava y ranas empiezan con figuras dibujadas con código y, cuando llegan los modelos
// animados de la diseñadora (ver animals.ts), cada una se cambia por su modelo (`swap`).

import { type BufferGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import type { Animal, AnimalKit } from './animals';
import { SplashPool } from './splash';
import { BALL, BLADE, CONE, ORB, merge, paint, part, pole, solid, sticker } from './kit';
import {
  RAIL, RIVER_MOUTHS, S, doorTo, facing, heightAt, nature, offshore, offshoreRaw, placeNear, placed, railAt, riverReach, shore, smoothstep,
} from './terrain';

const TAU = Math.PI * 2;

/** Avisa al mar que algo cayó al agua en (x, z): tamaño del salpicón (unidades) y fuerza (0–1). */
export type OnSplash = (x: number, z: number, size: number, strength: number) => void;

export interface Living {
  group: Object3D;
  update: (t: number, dt: number) => void;
  /** Cambia las figuras dibujadas por los modelos animados que hayan llegado. */
  swap?: (kit: AnimalKit) => void;
}

/** Un `Living` cuyo comportamiento se puede reemplazar (al llegar los modelos). */
function swappable(group: Group, first: Living['update'], swap: (kit: AnimalKit) => Living | null): Living {
  let step = first;
  return {
    group,
    update: (t, dt) => step(t, dt),
    swap: (kit) => {
      const next = swap(kit);
      if (!next) return;
      group.clear();
      group.add(next.group);
      step = next.update;
    },
  };
}

/** Dirección de avance en una órbita elíptica (radio `r` × `r * flat`) en el ángulo `a`, girando en sentido `dir`. */
const orbit = (c: Vector3, r: number, flat: number, a: number, dir: number) => ({
  pos: new Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r * flat),
  heading: new Vector3(-Math.sin(a) * r * dir, 0, Math.cos(a) * r * flat * dir),
});

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
  // manchas claras del costado, como en la ilustración del afiche
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    g.push(part(ORB, '#e8eef4', { p: [side * (5.6 + (i % 3) * 0.6), -1 + (i % 4) * 0.9, -6 + i * 1.6], s: 0.55 }));
  }
  // tubérculos de la cabeza
  for (let i = 0; i < 6; i++) g.push(part(ORB, '#1f2c45', { p: [(i % 2 ? 1 : -1) * 1.6, 5.4, 15 + i * 2], s: 0.8 }));
  // aletas pectorales largas y claras, y la cola
  for (const side of [-1, 1]) {
    g.push(part(BLADE, '#c9d6e2', { p: [side * 6, -2, 11], r: [0.35, side * (Math.PI / 2 + 0.55), 0], s: [2.2, 0.5, 9.5], o: 'YXZ' }));
    g.push(part(BLADE, dark, { p: [0, 0.6, -39], r: [0, side * (Math.PI - 0.95), 0], s: [3.2, 0.7, 7.5], o: 'YXZ' }));
  }
  return solid(g);
}

function buildWhales(spray: Spray, splashes: SplashPool, onSplash: OnSplash, rand: () => number): Living {
  const base = byId('ballena').pos.clone();
  const group = new Group();
  const mother = new Group();
  mother.add(sticker(whaleBody(), 0.6));
  const calf = new Group();
  calf.add(sticker(whaleBody(), 0.6));
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
  return swappable(group, update, (kit) => (kit.ballena ? whalePod(kit.ballena, spray, splashes, onSplash, rand) : null));
}

/**
 * Ballenas con el modelo animado: una madre con su cría frente a Jurubidá (donde está la del afiche) y otras dos
 * más al sur. Nadan en círculos amplios con el lomo afuera, soplan y, cada tanto, una salta con el salto del
 * animador: sale casi entera, gira en el aire y cae de espaldas, con un salpicón al salir y otro al caer.
 */
function whalePod(make: (length: number) => Animal, spray: Spray, splashes: SplashPool, onSplash: OnSplash, rand: () => number): Living {
  const group = new Group();
  const town = (id: string) => placed.find((p) => p.id === id)!;
  const main = byId('ballena').pos;
  type Whale = {
    a: Animal; length: number; c: Vector3; r: number; flat: number; ang: number; dir: number; speed: number;
    follow?: Whale; breaching: number; elapsed: number; nextBreach: number; nextBlow: number;
  };
  // La de Nuquí salta justo después de llegar del planeta, frente a la cámara.
  const spots = [
    { c: main.clone(), r: 160, len: 96, first: 16 },
    { c: offshore(town('nuqui').s + 0.1 * S, 330), r: 120, len: 88, first: 6.5 },
    { c: offshore(town('pangui').s + 0.4 * S, 800), r: 200, len: 90, first: 28 },
  ];
  const whales: Whale[] = spots.map((sp, i) => ({
    a: make(sp.len), length: sp.len, c: sp.c, r: sp.r, flat: 0.55, ang: rand() * TAU, dir: i % 2 ? -1 : 1, speed: 9 + rand() * 3,
    breaching: -1, elapsed: 0, nextBreach: sp.first + rand() * 2, nextBlow: 1 + rand() * 4,
  }));
  // La cría nada pegada a la madre y salta de vez en cuando, más bajito.
  whales.push({
    a: make(46), length: 46, c: main, r: 0, flat: 1, ang: 0, dir: 1, speed: 0, follow: whales[0],
    breaching: -1, elapsed: 0, nextBreach: 40 + rand() * 20, nextBlow: 3,
  });
  // La cadera de cada ballena: ahí rompe el agua (el salto la lleva hacia adelante).
  const hipsOf = (a: Animal) => {
    let hips: Object3D = a.root;
    a.root.traverse((o) => { if (/Hips$/.test(o.name)) hips = o; });
    return hips;
  };
  const hips = new Map(whales.map((w) => [w, hipsOf(w.a)]));
  for (const w of whales) {
    w.a.play('Swin', { speed: 0.8 + rand() * 0.3 });
    w.a.mixer.setTime(rand() * 3);
    group.add(w.a.root);
  }
  const jump = whales[0].a.actions.Jump.getClip().duration;
  const head = new Vector3();
  const update = (t: number, dt: number) => {
    for (const w of whales) {
      w.a.mixer.update(dt);
      if (w.breaching >= 0) {
        const before = w.elapsed;
        w.elapsed += dt;
        for (const sp of w.a.splashes) {
          if (before < sp.at && w.elapsed >= sp.at) {
            // Salpicón grande donde cae (o donde sale), y el mar reacciona: anillos, espuma y olas que se abren.
            hips.get(w)!.getWorldPosition(head);
            splashes.burst(head, w.length * (0.75 + 0.55 * sp.strength), sp.strength);
            onSplash(head.x, head.z, w.length, sp.strength);
            spray.emit(head.setY(2), Math.round(10 + 20 * sp.strength), { spread: w.length * 0.3, up: 40 + 25 * sp.strength, size: 2 + 2 * sp.strength });
          }
        }
        if (w.elapsed > jump) {
          w.breaching = -1;
          w.a.play('Swin', { fade: 0.6 });
          w.nextBreach = t + (w.follow ? 45 : 22) + rand() * 30;
        }
      } else if (t > w.nextBreach) {
        w.breaching = t;
        w.elapsed = 0;
        w.a.play('Jump', { once: true, fade: 0.4 });
      }
      // Mientras salta casi no avanza.
      const pace = w.breaching >= 0 ? 0.2 : 1;
      let heading: Vector3;
      if (w.follow) {
        const m = w.follow.a.root;
        const fwd = new Vector3(Math.sin(m.rotation.y), 0, Math.cos(m.rotation.y));
        const side = new Vector3(fwd.z, 0, -fwd.x);
        const target = m.position.clone().addScaledVector(side, 34).addScaledVector(fwd, -14 + 6 * Math.sin(t * 0.2));
        w.a.root.position.x += (target.x - w.a.root.position.x) * Math.min(1, dt * 2);
        w.a.root.position.z += (target.z - w.a.root.position.z) * Math.min(1, dt * 2);
        heading = fwd;
      } else {
        w.ang += (w.dir * dt * w.speed * pace) / w.r;
        const o = orbit(w.c, w.r, w.flat, w.ang, w.dir);
        w.a.root.position.x = o.pos.x;
        w.a.root.position.z = o.pos.z;
        heading = o.heading;
      }
      // Nada con el lomo afuera (el mar tapa el resto).
      w.a.root.position.y = -w.a.height * 0.62 + Math.sin(t * 0.7 + w.r) * 0.6;
      w.a.root.rotation.y = facing(heading);
      // Soplo: un chorro alto y fino sobre la cabeza.
      if (w.breaching < 0 && t > w.nextBlow) {
        w.nextBlow = t + 6 + rand() * 6;
        head.set(0, w.a.height * 0.95, w.length * 0.28).applyEuler(w.a.root.rotation).add(w.a.root.position);
        spray.emit(head, w.follow ? 8 : 16, { spread: 2.5, up: w.follow ? 28 : 44, size: w.follow ? 1.5 : 2.2 });
      }
    }
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
  sticker(turtle, 0.4);
  turtle.scale.setScalar(1.4);
  const update = (t: number) => {
    const a = t * 0.12;
    turtle.position.set(base.x + Math.cos(a) * 55, 1.6 + Math.sin(t * 1.3) * 0.5, base.z + Math.sin(a) * 55);
    turtle.rotation.y = -a + Math.PI;
    for (const f of flippers) f.rotation.z = f.userData.side * Math.sin(t * (f.userData.front ? 2.2 : 2.2) + (f.userData.front ? 0 : 1)) * 0.45;
  };
  const group = new Group();
  group.add(turtle);
  return swappable(group, update, (kit) => (kit.tortuga ? turtles(kit.tortuga) : null));
}

/** Tortugas golfinas con el modelo animado: nadan a flor de agua y, a ratos, se quedan flotando. */
function turtles(make: (length: number) => Animal): Living {
  const group = new Group();
  const town = (id: string) => placed.find((p) => p.id === id)!;
  const spots = [
    { c: byId('tortuga').pos.clone(), r: 55 },
    { c: offshore(town('nuqui').s + 0.9 * S, 260), r: 70 },
    { c: offshore(town('tribuga').s + 0.3 * S, 300), r: 60 },
  ];
  const list = spots.map((sp, i) => {
    const a = make(i === 0 ? 26 : 22);
    a.play('Swin');
    a.mixer.setTime(i * 0.7);
    group.add(a.root);
    return { a, ...sp, ang: i * 2.1, dir: i % 2 ? -1 : 1, floating: false, until: 8 + i * 5 };
  });
  const update = (t: number, dt: number) => {
    for (const u of list) {
      u.a.mixer.update(dt);
      if (t > u.until) {
        u.floating = !u.floating;
        u.a.play(u.floating ? 'Idle' : 'Swin', { fade: 0.8 });
        u.until = t + (u.floating ? 4 + Math.random() * 3 : 12 + Math.random() * 10);
      }
      u.ang += (u.dir * dt * (u.floating ? 1 : 7)) / u.r;
      const o = orbit(u.c, u.r, 1, u.ang, u.dir);
      u.a.root.position.set(o.pos.x, -u.a.height * 0.45 + Math.sin(t * 1.1 + u.r) * 0.3, o.pos.z);
      u.a.root.rotation.y = facing(o.heading);
    }
  };
  return { group, update };
}

// ───────── Cangrejo fantasma rojo ─────────

function buildCrab(): Living {
  const { pos: base, s: at, sea } = byId('cangrejo');
  const along = railAt(at).tangent;
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
  crab.add(sticker(solid(g), 0.35));
  crab.scale.setScalar(1.5);
  const update = (t: number) => {
    const k = Math.sin(t * 0.5) * 28;
    const x = base.x + along.x * k;
    const z = base.z + along.z * k;
    crab.position.set(x, heightAt(x, z) + Math.abs(Math.sin(t * 9)) * 0.6, z);
    // Camina de lado, mirando al mar.
    crab.rotation.set(0, facing(sea), Math.sin(t * 9) * 0.04);
  };
  const group = new Group();
  group.add(crab);
  return swappable(group, update, (kit) => (kit.cangrejo ? crabs(kit.cangrejo) : null));
}

/**
 * Cangrejos fantasma con el modelo animado, en la playa del afiche y en otras playas: se quedan quietos un rato
 * (moviendo las tenazas) y salen corriendo de lado, como los de verdad.
 */
function crabs(make: (length: number) => Animal): Living {
  const group = new Group();
  const home = byId('cangrejo');
  const beach = (town: 'nuqui' | 'coqui' | 'tribuga', along: number, offs: number[]) => {
    const { pos, s: at } = placeNear(town, along, 0.02);
    return { base: pos, sea: railAt(at).sea, offs };
  };
  const spots = [
    { base: home.pos, sea: home.sea, offs: [-34, 0, 30] },
    beach('nuqui', 0.55, [-15, 20]),
    beach('coqui', -0.35, [0]),
    beach('tribuga', -0.45, [-10, 18]),
  ];
  const list = spots.flatMap((sp) => sp.offs.map((off, i) => {
    const a = make(20 + (i % 2) * 3);
    a.play('Idle', { speed: 0.9 + Math.random() * 0.2 });
    a.mixer.setTime(Math.random() * 1.3);
    const yaw = facing(sp.sea);
    a.root.rotation.y = yaw;
    group.add(a.root);
    // De lado: el eje x del cangrejo, a lo largo de la playa.
    const side = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    return { a, base: sp.base.clone().addScaledVector(side, off), side, off: 0, dir: 1, walking: false, until: 2 + Math.random() * 6 };
  }));
  const update = (t: number, dt: number) => {
    for (const c of list) {
      c.a.mixer.update(dt);
      if (t > c.until) {
        c.walking = !c.walking;
        if (c.walking) c.dir = c.off > 22 ? -1 : c.off < -22 ? 1 : Math.random() < 0.5 ? -1 : 1;
        c.a.play(c.walking ? 'Walk' : 'Idle', { fade: 0.2 });
        c.until = t + (c.walking ? 1.3 * (1 + Math.floor(Math.random() * 3)) : 3 + Math.random() * 6);
      }
      if (c.walking) c.off += c.dir * 11 * dt;
      const x = c.base.x + c.side.x * c.off;
      const z = c.base.z + c.side.z * c.off;
      c.a.root.position.set(x, heightAt(x, z) - 0.3, z);
    }
  };
  return { group, update };
}

// ───────── Pava del Baudó, posada en una rama ─────────

function buildPava(): Living {
  const { pos: p, sea } = byId('pava');
  const group = new Group();
  group.position.set(p.x, heightAt(p.x, p.z) - 1, p.z);
  group.rotation.y = doorTo(sea); // la rama apunta al mar
  // Un árbol alto que sobresale de la selva, con la pava grande en la rama que da al mar: se ve desde la lancha.
  group.scale.setScalar(1.5);
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
  sticker(bird, 0.3);
  bird.position.set(-13, 29.5, 1.6);
  bird.rotation.y = -Math.PI / 2 + 0.4;
  bird.scale.setScalar(1.25);
  group.add(bird);
  const update = (t: number) => {
    head.rotation.x = Math.sin(t * 1.7) * 0.12;
    head.rotation.y = Math.sin(t * 0.6) * 0.5;
  };
  const living = swappable(new Group(), update, (kit) => {
    if (!kit.pava) return null;
    // La pava del modelo, en la misma rama: casi siempre quieta mirando alrededor y, cada tanto, canta.
    const a = kit.pava(12);
    a.root.position.copy(bird.position);
    a.root.rotation.y = bird.rotation.y;
    bird.visible = false;
    a.play('Idle');
    a.mixer.addEventListener('finished', () => a.play('Idle', { fade: 0.6 }));
    let next = 6;
    const inner = new Group();
    inner.add(a.root);
    group.add(inner);
    return {
      group: new Group(),
      update: (t: number, dt: number) => {
        a.mixer.update(dt);
        if (t > next) {
          a.play('Sing', { once: true, fade: 0.4 });
          next = t + 4.7 + 14 + Math.random() * 10;
        }
      },
    };
  });
  group.add(living.group);
  return { ...living, group };
}

// ───────── Rana arlequín sobre una hoja ─────────

/** Hoja grande de platanillo donde se posa una rana. */
const frogLeaf = () => solid([
  pole('#7fa84a', [0, 0, 0], [0, 8, 0], 1),
  part(BLADE, '#5fb04f', { p: [0, 8, 0], r: [-0.12, -Math.PI / 2, 0], s: [5.5, 0.5, 9], o: 'YXZ' }),
  part(BLADE, '#6cbf5a', { p: [0, 7, 0], r: [-0.6, 0.6, 0], s: [3.5, 0.4, 7], o: 'YXZ' }),
  part(BLADE, '#5aae4c', { p: [0, 6, 0], r: [-0.7, 2.4, 0], s: [3.5, 0.4, 7], o: 'YXZ' }),
]);

function buildFrog(): Living {
  const { pos: p, sea } = byId('rana');
  const group = new Group();
  group.position.set(p.x, heightAt(p.x, p.z) - 0.5, p.z);
  group.rotation.y = doorTo(sea);
  // Un parche de platanillo en el borde de la selva, como en el afiche, con las ranas pequeñas sobre sus hojas.
  group.scale.setScalar(1.6);
  group.add(frogLeaf());
  for (const [x, z, yaw, k] of [[3, -10, 0.9, 1.15], [10, -4, -1.4, 1.05], [7, 8, 2.8, 0.95], [1, 13, 1.9, 1.2]]) {
    const leaf = frogLeaf(); // detrás (+x es tierra adentro), para no tapar a las ranas desde el mar
    leaf.position.set(x, -0.6, z);
    leaf.rotation.y = yaw;
    leaf.scale.setScalar(k);
    group.add(leaf);
  }
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
  frog.add(sticker(solid(g), 0.3));
  frog.scale.setScalar(0.7);
  frog.position.set(-6, 9.6, 0); // sobre la cara de la hoja
  frog.rotation.y = -Math.PI / 2;
  group.add(frog);
  const update = (t: number) => {
    const c = t % 6;
    const hop = c < 0.6 ? Math.sin((c / 0.6) * Math.PI) : 0;
    frog.position.y = 9.6 + hop * 3;
    frog.rotation.x = -hop * 0.3;
    frog.scale.y = 0.7 * (1 + Math.sin(t * 6) * 0.03 * (1 - hop)); // respira
  };
  const living = swappable(new Group(), update, (kit) => {
    const make = kit.rana;
    if (!make) return null;
    frog.visible = false;
    // Dos ranas del modelo: la del afiche en su hoja y otra en una hoja vecina. Caminan un poco y saltan.
    const second = frogLeaf();
    second.position.set(9, -1.5, 13);
    second.rotation.y = 2.2;
    second.scale.setScalar(0.85);
    group.add(second);
    const frogs = [
      { at: frog.position.clone(), yaw: frog.rotation.y, holder: group },
      { at: new Vector3(-5.1, 9.6, 0), yaw: -Math.PI / 2, holder: second },
    ].map(({ at, yaw, holder }, i) => {
      const a = make(5.5);
      a.root.position.copy(at);
      a.root.rotation.y = yaw;
      holder.add(a.root);
      return { a, step: i, wait: 1 + i * 2.5, busy: false };
    });
    const steps = ['Walk', 'Walk', 'Jump'];
    for (const f of frogs) {
      f.a.mixer.addEventListener('finished', () => {
        f.busy = false;
        f.wait = 1.5 + Math.random() * 3;
      });
      // Quieta en la primera pose del paso hasta que le toque moverse.
      f.a.play('Walk', { once: true }).paused = true;
    }
    return {
      group: new Group(),
      update: (_t: number, dt: number) => {
        for (const f of frogs) {
          f.a.mixer.update(dt);
          if (f.busy) continue;
          f.wait -= dt;
          if (f.wait > 0) continue;
          f.busy = true;
          f.a.play(steps[f.step % steps.length], { once: true, fade: 0.25 });
          f.step++;
        }
      },
    };
  });
  group.add(living.group);
  return { ...living, group };
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

// ───────── Manglar del afiche ─────────

/** El manglar del afiche: ramas coral anaranjadas que se abren como un abanico. */
function buildPosterMangrove() {
  const p = byId('manglar').pos;
  const g: BufferGeometry[] = [];
  const branch = (from: Vector3, dir: Vector3, len: number, r: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    g.push(pole(depth % 2 ? '#e0603a' : '#ea7448', [from.x, from.y, from.z], [to.x, to.y, to.z], r));
    if (depth === 0) {
      g.push(part(ORB, '#f08a5a', { p: [to.x, to.y, to.z], s: r * 1.6 }));
      return;
    }
    for (const turn of [-0.55, 0.5]) {
      const d = dir.clone().applyAxisAngle(new Vector3(0, 0, 1), turn).applyAxisAngle(new Vector3(0, 1, 0), turn * 0.8).normalize();
      branch(to, d, len * 0.72, r * 0.7, depth - 1);
    }
  };
  branch(new Vector3(0, 0, 0), new Vector3(0, 1, 0), 9, 1.3, 4);
  const tree = solid(g);
  tree.position.set(p.x, Math.max(heightAt(p.x, p.z), 0) - 0.5, p.z);
  tree.scale.setScalar(1.4);
  return tree;
}

// ───────── Aves ─────────
// Vuelos con física sencilla: cada ave lleva su rumbo, gira con suavidad, se inclina en las curvas,
// sube y baja con el viento y alterna aleteos con planeos, como en la costa de verdad.

/** Ala de dos tramos (brazo y mano) para poder doblarla en forma de M y aletear. */
function wing(side: number, color: string, under: string, { arm = [1.2, 2.2], hand = [1, 2.8], sweep = 0.45 } = {}) {
  const inner = new Group();
  inner.add(new Mesh(merge([
    part(BLADE, color, { r: [0, side * (Math.PI / 2), 0], s: [arm[0], 0.14, arm[1]], o: 'YXZ' }),
    part(BLADE, under, { p: [0, -0.06, 0], r: [0, side * (Math.PI / 2), 0], s: [arm[0] * 0.9, 0.1, arm[1] * 0.95], o: 'YXZ' }),
  ]), paint));
  const outer = new Group();
  outer.position.set(side * arm[1] * 1.9, 0, 0);
  outer.add(new Mesh(merge([part(BLADE, color, { r: [0, side * (Math.PI / 2 + sweep), 0], s: [hand[0], 0.12, hand[1]], o: 'YXZ' })]), paint));
  inner.add(outer);
  return { inner, outer, side };
}
type Wing = ReturnType<typeof wing>;

/** Pose de las alas: `lift` sube el brazo, `droop` baja la mano (forma de M), `fold` las recoge hacia atrás. */
function poseWings(wings: Wing[], lift: number, droop: number, fold = 0) {
  for (const w of wings) {
    w.inner.rotation.set(0, w.side * fold * 1.1, w.side * lift);
    w.outer.rotation.set(0, w.side * fold * 0.6, -w.side * droop);
    w.inner.scale.x = 1 - fold * 0.55;
  }
}

/**
 * Golpe de ala (−1 abajo … 1 arriba): baja rápido (el golpe que empuja) y sube más despacio, como las aves de verdad.
 */
const flapStroke = (phase: number) => Math.sin(phase + 0.45 * Math.sin(phase));

/** Orienta un ave según su velocidad: rumbo, cabeceo y alabeo (inclinación en las curvas). */
function orient(o: Object3D, vel: Vector3, bank: number) {
  const flat = Math.hypot(vel.x, vel.z);
  o.rotation.order = 'YXZ';
  o.rotation.set(-Math.atan2(vel.y, Math.max(flat, 0.001)), Math.atan2(vel.x, vel.z), bank);
}

function frigatebird() {
  const bird = new Group();
  bird.add(solid([
    part(ORB, '#1d1d22', { s: [0.8, 0.8, 3.6] }),
    part(ORB, '#c8352c', { p: [0, -0.45, 2], s: [0.55, 0.55, 0.8] }),
    part(CONE, '#9a9a9a', { p: [0, 0, 4.2], r: [Math.PI / 2, 0, 0], s: [0.22, 1.6, 0.22] }),
    // Cola larga en tijera.
    part(BLADE, '#1d1d22', { p: [0, 0, -2.8], r: [0, Math.PI - 0.22, 0], s: [0.3, 0.08, 2.6], o: 'YXZ' }),
    part(BLADE, '#1d1d22', { p: [0, 0, -2.8], r: [0, Math.PI + 0.22, 0], s: [0.3, 0.08, 2.6], o: 'YXZ' }),
  ]));
  const wings = [-1, 1].map((side) => wing(side, '#222228', '#2e2e35', { arm: [1.1, 2.3], hand: [0.9, 3.4], sweep: 0.55 }));
  for (const w of wings) bird.add(w.inner);
  bird.scale.setScalar(2);
  return { bird, wings };
}

function pelican() {
  const bird = new Group();
  bird.add(solid([
    part(ORB, '#a1968a', { s: [1.3, 1.1, 4] }),
    part(ORB, '#f1ece2', { p: [0, 0.6, 3.4], s: [0.8, 0.8, 1.1] }),
    part(CONE, '#d9b25a', { p: [0, 0.2, 5.8], r: [Math.PI / 2 + 0.15, 0, 0], s: [0.4, 3.6, 0.55] }),
  ]));
  const wings = [-1, 1].map((side) => wing(side, '#7d746b', '#9a9086', { arm: [1.5, 2.4], hand: [1.2, 2.6], sweep: 0.2 }));
  for (const w of wings) bird.add(w.inner);
  bird.scale.setScalar(1.8);
  return { bird, wings };
}

/** Piquero pardo: lomo café, vientre blanco y pico amarillo; pesca lanzándose en picada. */
function booby() {
  const bird = new Group();
  bird.add(solid([
    part(ORB, '#5a4636', { s: [0.85, 0.85, 3] }),
    part(ORB, '#f4f1ea', { p: [0, -0.3, -0.2], s: [0.75, 0.6, 2.3] }),
    part(CONE, '#e6c45a', { p: [0, 0, 3.6], r: [Math.PI / 2, 0, 0], s: [0.3, 1.6, 0.3] }),
  ]));
  const wings = [-1, 1].map((side) => wing(side, '#5a4636', '#e9e4da', { arm: [0.9, 2], hand: [0.75, 2.3], sweep: 0.3 }));
  for (const w of wings) bird.add(w.inner);
  bird.scale.setScalar(1.5);
  return { bird, wings };
}

/** Garza blanca parada en el agua bajita, con el cuello en S. */
function egret() {
  const bird = new Group();
  bird.add(solid([
    pole('#1d1d1d', [-0.4, 0, 0], [-0.3, 6, 0], 0.15),
    pole('#1d1d1d', [0.4, 0, 0.3], [0.3, 6, 0], 0.15),
    part(ORB, '#fbfbf8', { p: [0, 7, 0], s: [1, 1.2, 2.2], r: [-0.4, 0, 0] }),
    pole('#fbfbf8', [0, 7.6, 1.2], [0, 9.2, 1.9], 0.35),
    pole('#fbfbf8', [0, 9.2, 1.9], [0, 10.6, 1.4], 0.3),
  ]));
  const head = new Group();
  head.position.set(0, 10.8, 1.5);
  head.add(solid([part(ORB, '#fbfbf8', { s: [0.45, 0.45, 0.7] }), part(CONE, '#e6c45a', { p: [0, -0.1, 1.3], r: [Math.PI / 2, 0, 0], s: [0.15, 1.6, 0.15] })]));
  bird.add(head);
  bird.scale.setScalar(1.4);
  return { bird, head };
}

function buildBirds(rand: () => number, spray: Spray): Living {
  const group = new Group();
  const v = new Vector3();

  // Fragatas: planean alto sobre la costa, casi sin aletear.
  const homes = ['jurubida', 'nuqui', 'pangui'].map((id) => {
    const t = placed.find((p) => p.id === id)!;
    return t.pos.clone().addScaledVector(t.sea, 120);
  });
  const frigates = Array.from({ length: 15 }, (_, i) => {
    const b = frigatebird();
    const home = homes[i % homes.length];
    const state = {
      home,
      pos: home.clone().add(new Vector3((rand() - 0.5) * 300, 0, (rand() - 0.5) * 300)),
      heading: rand() * TAU,
      speed: 11 + rand() * 6,
      alt: 130 + rand() * 120,
      ph: rand() * 100,
    };
    group.add(b.bird);
    return { ...b, state };
  });

  // Pelícanos: fila escalonada que bordea la costa a ras del agua y regresa mar adentro.
  const R = 300;
  const lane = 150;
  const span = RAIL.max - RAIL.min;
  const loopLen = 2 * span + 2 * Math.PI * R;
  const loopAt = (d: number) => {
    let u = ((d % loopLen) + loopLen) % loopLen;
    if (u < span) return offshoreRaw(RAIL.min + u, lane);
    u -= span;
    const turn = Math.PI * R;
    if (u < turn) { const a = u / R; return offshoreRaw(RAIL.max + Math.sin(a) * R * 0.6, lane + R * (1 - Math.cos(a))); }
    u -= turn;
    if (u < span) return offshoreRaw(RAIL.max - u, lane + 2 * R);
    u -= span;
    const a = u / R;
    return offshoreRaw(RAIL.min - Math.sin(a) * R * 0.6, lane + 2 * R - R * (1 - Math.cos(a)));
  };
  const pelicanStart = placed.find((p) => p.id === 'tribuga')!.s - RAIL.min;
  const pelicans = Array.from({ length: 7 }, (_, i) => {
    const b = pelican();
    group.add(b.bird);
    return { ...b, i };
  });

  // Piqueros: dan vueltas sobre el agua y cada tanto se lanzan en picada.
  const spots = [['tribuga', 0.6, 300], ['nuqui', -1.2, 380], ['pangui', 0.4, 320]] as const;
  const boobies = spots.flatMap(([id, along, off]) => {
    const t = placed.find((p) => p.id === id)!;
    const c = offshoreRaw(t.s + along * 110, off);
    return Array.from({ length: 3 }, () => {
      const b = booby();
      group.add(b.bird);
      return { ...b, c, r: 35 + rand() * 35, ph: rand() * 30, w: (rand() < 0.5 ? -1 : 1) * (0.3 + rand() * 0.15), dived: -1 };
    });
  });

  // Garzas en las desembocaduras.
  const egrets = RIVER_MOUTHS.flatMap((m) => Array.from({ length: 2 }, () => {
    const e = egret();
    for (let k = 0; k < 40; k++) {
      const x = m.x + (rand() - 0.5) * 120;
      const z = m.z + (rand() - 0.5) * 120;
      const d = shore(x, z);
      if (d > -10 && d < 25 && riverReach(x, z) > 0.8) {
        e.bird.position.set(x, Math.max(heightAt(x, z), -0.8), z);
        break;
      }
    }
    e.bird.rotation.y = rand() * TAU;
    e.bird.userData.ph = rand() * 20;
    group.add(e.bird);
    return e;
  }));

  const update = (t: number, dt: number) => {
    for (const f of frigates) {
      const s = f.state;
      // Giro suave y cambiante, con una leve atracción hacia su zona de la costa.
      let turn = 0.16 * Math.sin(t * 0.11 + s.ph) + 0.1 * Math.sin(t * 0.27 + s.ph * 2);
      const toHome = Math.atan2(s.home.x - s.pos.x, s.home.z - s.pos.z);
      let diff = toHome - s.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const far = smoothstep(Math.hypot(s.home.x - s.pos.x, s.home.z - s.pos.z), 250, 600);
      turn += diff * 0.35 * far;
      s.heading += turn * dt;
      const y = s.alt + 28 * Math.sin(t * 0.07 + s.ph) + 9 * Math.sin(t * 0.21 + s.ph);
      v.set(Math.sin(s.heading) * s.speed, (y - f.bird.position.y) / Math.max(dt, 0.001), Math.cos(s.heading) * s.speed);
      s.pos.x += v.x * dt;
      s.pos.z += v.z * dt;
      // Planea largo rato y, cada tanto, da una tanda de aletazos amplios: el ala baja rápido y sube despacio, y el
      // cuerpo sube un poco con cada golpe hacia abajo.
      const flapping = smoothstep(Math.sin(t * 0.23 + s.ph * 3), 0.35, 0.6);
      const beat = flapStroke(t * 6.5 + s.ph) * 0.8 * flapping;
      f.bird.position.set(s.pos.x, y - beat * 1.4, s.pos.z);
      orient(f.bird, v.setY(MathUtils.clamp(v.y, -3, 3)), MathUtils.clamp(-turn * 2.2, -0.7, 0.7));
      poseWings(f.wings, 0.14 + beat + 0.04 * Math.sin(t * 1.3 + s.ph), 0.3 - beat * 0.55);
    }

    const lead = pelicanStart + t * 19;
    for (const p of pelicans) {
      const d = lead - p.i * 15;
      const a = loopAt(d);
      const b = loopAt(d + 4);
      const side = new Vector3(b.z - a.z, 0, a.x - b.x).normalize();
      a.addScaledVector(side, p.i * 7);
      // Aletean en cadena (del primero al último) y luego planean juntos, casi rozando el agua.
      const c = (t - p.i * 0.28) % 7;
      const flap = c > 0 && c < 2.4 ? flapStroke((c / 2.4) * TAU * 3) * 0.75 * Math.sin((c / 2.4) * Math.PI) ** 0.3 : 0;
      p.bird.position.set(a.x, 12 + 3 * Math.sin(t * 0.45 + p.i * 0.4) - flap * 1.2, a.z);
      orient(p.bird, v.set(b.x - a.x, 0, b.z - a.z), 0);
      poseWings(p.wings, 0.05 + flap, 0.1 - flap * 0.45);
    }

    for (const b of boobies) {
      const c = (t + b.ph) % 13;
      const ang = b.w * (t + b.ph);
      const x = b.c.x + Math.cos(ang) * b.r;
      const z = b.c.z + Math.sin(ang) * b.r;
      const cruise = 48 + 6 * Math.sin(t * 0.5 + b.ph);
      let y = cruise;
      let fold = 0;
      b.bird.visible = true;
      if (c > 8 && c < 9.1) {
        const k = (c - 8) / 1.1;
        y = cruise * (1 - k * k);
        fold = 1;
      } else if (c >= 9.1 && c < 10) {
        b.bird.visible = false;
        y = -2;
        const cycle = Math.floor((t + b.ph) / 13);
        if (b.dived !== cycle) {
          b.dived = cycle;
          spray.emit(new Vector3(x, 1, z), 10, { spread: 6, up: 22, size: 1.6 });
        }
      } else if (c >= 10) {
        y = cruise * smoothstep(c, 10, 13);
      }
      const prevY = b.bird.position.y;
      b.bird.position.set(x, y, z);
      v.set(-Math.sin(ang) * b.w * b.r, (y - prevY) / Math.max(dt, 0.001), Math.cos(ang) * b.w * b.r);
      if (fold) v.set(v.x * 0.15, -40, v.z * 0.15);
      orient(b.bird, v, fold ? 0 : -0.4 * Math.sign(b.w));
      const beat = c >= 10 ? Math.sin(t * 9) * 0.6 : Math.sin(t * 5 + b.ph) * 0.35 * smoothstep(Math.sin(t * 0.6 + b.ph), 0.3, 0.8);
      poseWings(b.wings, 0.08 + beat, 0.12, fold);
    }

    for (const e of egrets) {
      const c = (t + (e.bird.userData.ph as number)) % 9;
      e.head.rotation.x = c > 7 && c < 7.8 ? Math.sin(((c - 7) / 0.8) * Math.PI) * 1.1 : Math.sin(t * 0.8) * 0.05;
    }
  };
  return { group, update };
}

// ───────── Mariposas ─────────

function buildButterflies(rand: () => number): Living {
  const group = new Group();
  const anchors = [...placed.filter((p) => p.kind !== 'town').map((p) => p.pos), ...nature.filter((n) => n.at.inland > 0).map((n) => n.pos)];
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
  ballena: 70, tortuga: 22, cangrejo: 26, pava: 84, rana: 30, manglar: 30, cacao: 34,
};

export function buildFauna(rand: () => number, onSplash: OnSplash = () => {}): Living {
  const spray = new Spray(200);
  const splashes = new SplashPool();
  const parts: Living[] = [buildWhales(spray, splashes, onSplash, rand), buildTurtle(), buildCrab(), buildPava(), buildFrog(), buildBirds(rand, spray), buildButterflies(rand)];
  const group = new Group();
  group.add(spray.group, splashes.group, buildCacao(rand), buildPosterMangrove(), ...parts.map((p) => p.group));
  return {
    group,
    update: (t, dt) => {
      for (const p of parts) p.update(t, dt);
      spray.update(dt);
      splashes.update(dt);
    },
    swap: (kit) => {
      for (const p of parts) p.swap?.(kit);
    },
  };
}

