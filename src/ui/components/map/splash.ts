// Salpicón de agua en 3D, para cuando la ballena rompe la superficie al saltar y cuando cae.
// Como el del proyecto de realidad aumentada (WaterSplash), el agua se reconoce por tres cosas:
//   1. sube y CAE: cada gota sale disparada y la gravedad la devuelve (estirada en la dirección en que viaja);
//   2. es BLANCA donde se rompe: espuma opaca a ras del agua, que se abre y se deshace despacio;
//   3. deja ONDAS: anillos tumbados sobre el mar que se abren.
// Además, el mar mismo reacciona (anillos de espuma, una mancha blanca y olas que se abren): ver `uSplash` en
// el sombreador del mar de MapScene.ts. Todo se mide en "tamaños de animal" (`size`).
//
// Rendimiento: las gotas y la espuma de cada salpicón son UNA sola nube de puntos (un solo dibujo). El sombreador
// estira y gira cada punto para que la gota siga siendo un trazo en la dirección en que viaja.

import {
  BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, NormalBlending, Points, RingGeometry,
  ShaderMaterial, Vector2, Vector3, type WebGLRenderer,
} from 'three';

const LIFE = 3.2;
const GRAVITY = 1.15; // en tamaños de animal por segundo²
const DROPS = 108; // 90 de la corona y 18 de la columna
const FOAM = 22;
const N = DROPS + FOAM;

interface Particle {
  v: Vector3;
  p0: Vector3;
  size: number;
  delay: number;
  life: number;
}

/** Material compartido: cada punto es un disco (gota) o una mancha suave (espuma), estirado y girado. */
let shared: ShaderMaterial | null = null;
const material = () =>
  (shared ??= new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: { uHalfH: { value: 400 } },
    vertexShader: `attribute vec2 aScale; attribute float aAlpha; attribute float aAngle; attribute float aFoam;
      uniform float uHalfH;
      varying vec2 vShape; varying float vAlpha; varying float vAngle; varying float vFoam;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float side = max(aScale.x, aScale.y);
        gl_PointSize = aAlpha > 0.0 ? side * projectionMatrix[1][1] * uHalfH / -mv.z : 0.0;
        vShape = side / aScale;
        vAlpha = aAlpha; vAngle = aAngle; vFoam = aFoam;
      }`,
    fragmentShader: `varying vec2 vShape; varying float vAlpha; varying float vAngle; varying float vFoam;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float c = cos(vAngle), s = sin(vAngle);
        p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * vShape;
        float d = length(p) * 2.0;
        if (d > 1.0) discard;
        // Gota: blanca al centro y celeste translúcida al borde. Espuma: blanca y suave.
        vec3 drop = mix(vec3(1.0), vec3(0.76, 0.92, 0.97), smoothstep(0.55, 1.0, d));
        float dropA = 1.0 - smoothstep(0.55, 1.0, d) * 0.9 - smoothstep(0.8, 1.0, d) * 0.1;
        vec3 foam = mix(vec3(1.0), vec3(0.98, 0.995, 1.0), d);
        float foamA = 0.95 - 0.3 * smoothstep(0.0, 0.5, d) - 0.65 * smoothstep(0.5, 1.0, d);
        gl_FragColor = vec4(mix(drop, foam, vFoam), vAlpha * mix(dropA, foamA, vFoam));
        #include <colorspace_fragment>
      }`,
  }));

class Splash {
  readonly group = new Group();
  private parts: Particle[] = [];
  private geo = new BufferGeometry();
  private pos = new Float32Array(N * 3);
  private scale = new Float32Array(N * 2);
  private alpha = new Float32Array(N);
  private angle = new Float32Array(N);
  private rings: Mesh<RingGeometry, MeshBasicMaterial>[] = [];
  private t = LIFE;
  private k = 1;
  private size = 1;

  constructor() {
    // Corona: gotas que salen hacia arriba y hacia afuera, en todas direcciones.
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + Math.random() * 0.2;
      const out = 0.25 + Math.random() * 0.3;
      this.parts.push({
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
      this.parts.push({
        p0: new Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05),
        v: new Vector3(Math.cos(a) * 0.08, 1.25 + Math.random() * 0.45, Math.sin(a) * 0.08),
        size: 0.05 + Math.random() * 0.05,
        delay: 0.05 + Math.random() * 0.1,
        life: 1.9 + Math.random() * 0.4,
      });
    }
    // Espuma: se abre a ras del agua y se deshace despacio.
    for (let i = 0; i < FOAM; i++) {
      const a = (i / FOAM) * Math.PI * 2;
      this.parts.push({
        p0: new Vector3(Math.cos(a) * 0.1, 0.02, Math.sin(a) * 0.1),
        v: new Vector3(Math.cos(a) * (0.3 + Math.random() * 0.2), 0.05 + Math.random() * 0.08, Math.sin(a) * (0.3 + Math.random() * 0.2)),
        size: 0.22 + Math.random() * 0.14,
        delay: Math.random() * 0.08,
        life: 2.6 + Math.random() * 0.5,
      });
    }
    const foam = new Float32Array(N);
    foam.fill(1, DROPS);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aScale', new BufferAttribute(this.scale, 2));
    this.geo.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('aAngle', new BufferAttribute(this.angle, 1));
    this.geo.setAttribute('aFoam', new BufferAttribute(foam, 1));
    const points = new Points(this.geo, material());
    points.frustumCulled = false;
    points.onBeforeRender = (renderer: WebGLRenderer) => {
      material().uniforms.uHalfH.value = renderer.getDrawingBufferSize(halfH).y / 2;
    };
    this.group.add(points);
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
    const { k, size, pos, scale, alpha, angle } = this;
    const reach = size * Math.sqrt(k);
    for (let i = 0; i < DROPS; i++) {
      const d = this.parts[i];
      const t = this.t - d.delay;
      const u = t / d.life;
      alpha[i] = 0;
      if (t <= 0 || u >= 1) continue;
      const vy = d.v.y * k - GRAVITY * k * t;
      const y = (d.v.y * t - 0.5 * GRAVITY * t * t) * k;
      if (y < -0.02) continue;
      pos.set([(d.p0.x + d.v.x * t) * reach, y * size, (d.p0.z + d.v.z * t) * reach], i * 3);
      // Una gota en vuelo es un trazo, no un punto.
      const speed = Math.hypot(Math.hypot(d.v.x, d.v.z), vy);
      scale[i * 2] = d.size * size;
      scale[i * 2 + 1] = d.size * size * (1 + Math.min(speed, 1.5) * 0.9);
      angle[i] = Math.atan2(vy, Math.hypot(d.v.x, d.v.z)) - Math.PI / 2;
      alpha[i] = u < 0.6 ? 0.95 : 0.95 * (1 - (u - 0.6) / 0.4);
    }
    for (let i = DROPS; i < N; i++) {
      const f = this.parts[i];
      const t = this.t - f.delay;
      const u = t / f.life;
      alpha[i] = 0;
      if (t <= 0 || u >= 1) continue;
      const e = 1 - (1 - u) ** 2.2;
      pos.set([(f.p0.x + f.v.x * e) * reach, (f.p0.y + f.v.y * e) * size * k, (f.p0.z + f.v.z * e) * reach], i * 3);
      const s = f.size * (0.6 + e * 1.1) * size * k;
      scale[i * 2] = s * 1.4;
      scale[i * 2 + 1] = s;
      angle[i] = 0;
      alpha[i] = u < 0.1 ? (u / 0.1) * 0.95 : 0.95 * (1 - u) ** 1.2;
    }
    for (const name of ['position', 'aScale', 'aAlpha', 'aAngle']) this.geo.getAttribute(name).needsUpdate = true;
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
const halfH = new Vector2();

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
