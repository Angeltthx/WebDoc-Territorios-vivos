// Salpicón de agua en 3D, para cuando la ballena rompe la superficie al saltar y cuando cae.
// Como el del proyecto de realidad aumentada (WaterSplash), el agua se reconoce por tres cosas:
//   1. sube y CAE: cada gota sale disparada y la gravedad la devuelve (estirada en la dirección en que viaja);
//   2. es BLANCA donde se rompe: espuma opaca a ras del agua, que se abre y se deshace despacio;
//   3. deja ONDAS: anillos tumbados sobre el mar que se abren.
// Además, el mar mismo reacciona (anillos de espuma, una mancha blanca y olas que se abren): ver `uSplash` en
// el sombreador del mar de MapScene.ts. Todo se mide en "tamaños de animal" (`size`).

import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, Sprite, SpriteMaterial, type Texture, Vector3 } from 'three';

const LIFE = 3.2;
const GRAVITY = 1.15; // en tamaños de animal por segundo²

interface Particle {
  sprite: Sprite;
  v: Vector3;
  p0: Vector3;
  size: number;
  delay: number;
  life: number;
}

function disc(stops: [number, string][]) {
  const n = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  return new CanvasTexture(canvas);
}

let textures: { drop: Texture; foam: Texture } | null = null;
const sharedTextures = () =>
  (textures ??= {
    drop: disc([[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(236,250,255,0.95)'], [0.8, 'rgba(195,235,248,0.5)'], [1, 'rgba(195,235,248,0)']]),
    foam: disc([[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(250,254,255,0.65)'], [1, 'rgba(255,255,255,0)']]),
  });

class Splash {
  readonly group = new Group();
  private drops: Particle[] = [];
  private foam: Particle[] = [];
  private rings: Mesh<RingGeometry, MeshBasicMaterial>[] = [];
  private t = LIFE;
  private k = 1;
  private size = 1;

  constructor() {
    const { drop, foam } = sharedTextures();
    const sprite = (map: Texture) => {
      const s = new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      this.group.add(s);
      return s;
    };
    // Corona: gotas que salen hacia arriba y hacia afuera, en todas direcciones.
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + Math.random() * 0.2;
      const out = 0.25 + Math.random() * 0.3;
      this.drops.push({
        sprite: sprite(drop),
        p0: new Vector3(Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18),
        v: new Vector3(Math.cos(a) * out, 0.75 + Math.random() * 0.55, Math.sin(a) * out),
        size: 0.025 + Math.random() * 0.04,
        delay: Math.random() * 0.12,
        life: 1.5 + Math.random() * 0.5,
      });
    }
    // Columna: gotas grandes que suben casi rectas y más alto.
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      this.drops.push({
        sprite: sprite(drop),
        p0: new Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05),
        v: new Vector3(Math.cos(a) * 0.08, 1.25 + Math.random() * 0.45, Math.sin(a) * 0.08),
        size: 0.05 + Math.random() * 0.05,
        delay: 0.05 + Math.random() * 0.1,
        life: 1.9 + Math.random() * 0.4,
      });
    }
    // Espuma: se abre a ras del agua y se deshace despacio.
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      this.foam.push({
        sprite: sprite(foam),
        p0: new Vector3(Math.cos(a) * 0.1, 0.02, Math.sin(a) * 0.1),
        v: new Vector3(Math.cos(a) * (0.3 + Math.random() * 0.2), 0.05 + Math.random() * 0.08, Math.sin(a) * (0.3 + Math.random() * 0.2)),
        size: 0.22 + Math.random() * 0.14,
        delay: Math.random() * 0.08,
        life: 2.6 + Math.random() * 0.5,
      });
    }
    // Anillos tumbados sobre el agua.
    for (let i = 0; i < 3; i++) {
      const ring = new Mesh(
        new RingGeometry(0.9, 1, 64),
        new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.4;
      ring.visible = false;
      this.rings.push(ring);
      this.group.add(ring);
    }
    this.group.visible = false;
  }

  get busy() {
    return this.t < LIFE;
  }

  burst(at: Vector3, size: number, strength: number) {
    this.group.position.set(at.x, 0, at.z);
    this.size = size;
    this.k = strength;
    this.t = 0;
    this.group.visible = true;
  }

  update(dt: number) {
    if (!this.busy) return;
    this.t += dt;
    const { k, size } = this;
    const reach = size * Math.sqrt(k);
    for (const d of this.drops) {
      const t = this.t - d.delay;
      const u = t / d.life;
      d.sprite.visible = t > 0 && u < 1;
      if (!d.sprite.visible) continue;
      const vy = d.v.y * k - GRAVITY * k * t;
      const y = (d.v.y * t - 0.5 * GRAVITY * t * t) * k;
      if (y < -0.02) { d.sprite.visible = false; continue; }
      d.sprite.position.set((d.p0.x + d.v.x * t) * reach, y * size, (d.p0.z + d.v.z * t) * reach);
      // Una gota en vuelo es un trazo, no un punto.
      const speed = Math.hypot(Math.hypot(d.v.x, d.v.z), vy);
      d.sprite.scale.set(d.size * size, d.size * size * (1 + Math.min(speed, 1.5) * 0.9), 1);
      d.sprite.material.rotation = Math.atan2(vy, Math.hypot(d.v.x, d.v.z)) - Math.PI / 2;
      d.sprite.material.opacity = u < 0.6 ? 0.95 : 0.95 * (1 - (u - 0.6) / 0.4);
    }
    for (const f of this.foam) {
      const t = this.t - f.delay;
      const u = t / f.life;
      f.sprite.visible = t > 0 && u < 1;
      if (!f.sprite.visible) continue;
      const e = 1 - (1 - u) ** 2.2;
      f.sprite.position.set((f.p0.x + f.v.x * e) * reach, (f.p0.y + f.v.y * e) * size * k, (f.p0.z + f.v.z * e) * reach);
      const s = f.size * (0.6 + e * 1.1) * size * k;
      f.sprite.scale.set(s * 1.4, s, 1);
      f.sprite.material.opacity = u < 0.1 ? (u / 0.1) * 0.95 : 0.95 * (1 - u) ** 1.2;
    }
    this.rings.forEach((ring, i) => {
      const t = this.t - i * 0.35;
      const u = t / (LIFE - i * 0.35);
      ring.visible = t > 0 && u < 1;
      if (!ring.visible) return;
      const r = (0.2 + (1 - (1 - u) ** 2) * 1.1) * reach;
      ring.scale.set(r, r, 1);
      ring.material.opacity = 0.8 * (1 - u);
    });
    if (!this.busy) this.group.visible = false;
  }
}

/** Varios salpicones a la vez (cada ballena puede estar saltando por su lado). */
export class SplashPool {
  readonly group = new Group();
  private pool = Array.from({ length: 5 }, () => new Splash());
  constructor() {
    for (const s of this.pool) this.group.add(s.group);
  }
  burst(at: Vector3, size: number, strength: number) {
    (this.pool.find((s) => !s.busy) ?? this.pool[0]).burst(at, size, strength);
  }
  update(dt: number) {
    for (const s of this.pool) s.update(dt);
  }
}
