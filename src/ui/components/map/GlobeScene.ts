// Entrada del mapa: el planeta Tierra dibujado con el arte del afiche (ver posterArt.ts). Solo el Chocó se puede
// tocar: al tocarlo o al acercarse, el planeta gira hasta dejar Nuquí de frente, baja y, sin corte, le pasa el
// viaje al mapa de la costa (ver dive.ts).

import {
  AdditiveBlending, BackSide, BufferGeometry, CanvasTexture, Sprite, SpriteMaterial, Float32BufferAttribute, Group, MathUtils, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, Quaternion,
  Raycaster, SRGBColorSpace, Scene, ShaderMaterial, SphereGeometry, Timer, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { ASCENT, DIVE, diveAltitude, fovs, type Handoff } from './dive';
import { ARRIVAL } from './terrain';
import { DUSK_GLSL, REGION, isChoco, posterTexture, regionCanvas, worldCanvas } from './posterArt';

const R = 1;
const DEG = Math.PI / 180;
/** Radio de la Tierra (km): la altura de la cámara se cuenta en kilómetros. */
const EARTH_KM = 6371;

/** Latitud/longitud → punto de la esfera (misma convención que SphereGeometry y su textura equirrectangular). */
export function latLonToVec(lat: number, lon: number, r = R) {
  const phi = (lon + 180) * DEG;
  const theta = (90 - lat) * DEG;
  return new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(r);
}
function vecToLatLon(v: Vector3) {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(MathUtils.clamp(n.y, -1, 1)) / DEG;
  let lon = Math.atan2(n.z, -n.x) / DEG - 180;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

// ───────── El espacio ─────────

const NOISE3 = `
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm3(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise3(p); p *= 2.03; a *= 0.5; }
    return s;
  }`;

/** Plano de la Vía Láctea (su normal): la franja cruza el cielo en diagonal detrás del planeta. */
const GALAXY = new Vector3(0.35, 1, 0.2).normalize();

/**
 * La Vía Láctea y nebulosas muy tenues, pintadas por dentro de una esfera lejana: una franja de luz lechosa con
 * nubes de polvo oscuras en el medio y manchas de color apenas visibles en el resto del cielo.
 */
function buildGalaxy() {
  return new Mesh(
    new SphereGeometry(60, 64, 32),
    new ShaderMaterial({
      side: BackSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uBand: { value: GALAXY } },
      vertexShader: `varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uBand; varying vec3 vDir;
        ${NOISE3}
        void main() {
          vec3 d = normalize(vDir);
          float b = dot(d, uBand);
          float n = fbm3(d * 4.0);
          float wide = exp(-b * b / 0.05) * (0.35 + 0.65 * n);
          float core = exp(-b * b / 0.008) * smoothstep(0.35, 0.8, fbm3(d * 6.0 + 2.0));
          float dust = smoothstep(0.45, 0.72, fbm3(d * 7.0 + 10.0)) * exp(-b * b / 0.004);
          vec3 col = mix(vec3(0.16, 0.2, 0.34), vec3(0.62, 0.58, 0.66), fbm3(d * 9.0 + 3.0)) * wide * 0.3;
          col += vec3(0.85, 0.8, 0.72) * core * 0.18;
          col *= 1.0 - dust * 0.85;
          col += vec3(0.32, 0.12, 0.42) * smoothstep(0.58, 0.95, fbm3(d * 2.2 + 7.0)) * 0.07;
          col += vec3(0.06, 0.22, 0.28) * smoothstep(0.6, 0.95, fbm3(d * 2.8 + 21.0)) * 0.07;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
}

/**
 * Estrellas: muchas débiles y pocas brillantes (como en el cielo de verdad), con su color según la temperatura
 * —azuladas, blancas, amarillas, naranjas—, más apretadas a lo largo de la Vía Láctea. Las más brillantes tienen
 * un destello en cruz. Titilan apenas.
 */
function buildStars(pixelRatio: number) {
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pos: number[] = [];
  const size: number[] = [];
  const color: number[] = [];
  const phase: number[] = [];
  const v = new Vector3();
  const tint = (t: number): [number, number, number] =>
    t < 0.08 ? [0.66, 0.78, 1] : t < 0.3 ? [0.86, 0.91, 1] : t < 0.75 ? [1, 1, 1] : t < 0.92 ? [1, 0.93, 0.8] : [1, 0.8, 0.62];
  const add = (dir: Vector3, s: number) => {
    v.copy(dir).normalize().multiplyScalar(50);
    pos.push(v.x, v.y, v.z);
    size.push(s);
    color.push(...tint(rand()));
    phase.push(rand() * 100);
  };
  // Brillo: casi todas tenues y unas pocas muy brillantes.
  const magnitude = () => 0.45 + 4.2 * rand() ** 9 + 0.6 * rand() ** 2;
  for (let i = 0; i < 7000; i++) add(v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).clone(), magnitude());
  const a = new Vector3(1, 0, 0).cross(GALAXY).normalize();
  const b = GALAXY.clone().cross(a).normalize();
  for (let i = 0; i < 6000; i++) {
    const t = rand() * Math.PI * 2;
    const off = (rand() + rand() + rand() + rand() - 2) * 0.16;
    const dir = a.clone().multiplyScalar(Math.cos(t)).addScaledVector(b, Math.sin(t)).addScaledVector(GALAXY, off);
    add(dir, 0.35 + 0.9 * rand() ** 4);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('size', new Float32BufferAttribute(size, 1));
  geo.setAttribute('color', new Float32BufferAttribute(color, 3));
  geo.setAttribute('phase', new Float32BufferAttribute(phase, 1));
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: pixelRatio } },
    vertexShader: `attribute float size; attribute float phase; attribute vec3 color;
      uniform float uTime; uniform float uPixel;
      varying vec3 vColor; varying float vSize;
      void main() {
        float twinkle = 0.82 + 0.18 * sin(uTime * (0.7 + fract(phase) * 2.5) + phase);
        vColor = color * twinkle * min(1.0, 0.35 + size * 0.45);
        vSize = size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (size > 2.4 ? size * 4.0 : size * 2.0 + 1.0) * uPixel;
      }`,
    fragmentShader: `varying vec3 vColor; varying float vSize;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float big = step(2.4, vSize);
        // Núcleo nítido con un halo suave; las brillantes, además, un destello en cruz.
        float core = smoothstep(mix(0.5, 0.16, big), 0.0, d);
        float halo = big * exp(-d * 9.0) * 0.5;
        float spikes = big * (exp(-abs(p.x) * 60.0) + exp(-abs(p.y) * 60.0)) * smoothstep(0.5, 0.0, d) * 0.55;
        gl_FragColor = vec4(vColor * (core * core + halo + spikes), 1.0);
      }`,
  });
  return { points: new Points(geo, mat), uniforms: mat.uniforms };
}

// ───────── Sol ─────────

/**
 * El sol de la tarde visto desde el espacio: se está poniendo en Nuquí, bajo (4,5°) sobre el Pacífico hacia el
 * oeste (algo al sur), como el ocaso real de allí en octubre. Nuquí queda justo en la franja del atardecer, con la misma luz naranja
 * que en la costa (allá el sol queda a espaldas de la cámara), y al girar el planeta se ve el sol escondiéndose detrás.
 */
const SUN_GLOBE = (() => {
  const out = latLonToVec(ARRIVAL.lat, ARRIVAL.lon).normalize();
  const north = latLonToVec(ARRIVAL.lat + 0.01, ARRIVAL.lon).normalize().sub(out).normalize();
  const east = latLonToVec(ARRIVAL.lat, ARRIVAL.lon + 0.01).normalize().sub(out).normalize();
  const bearing = 264 * DEG;
  const elev = 4.5 * DEG;
  return out.multiplyScalar(Math.sin(elev))
    .addScaledVector(north, Math.cos(bearing) * Math.cos(elev))
    .addScaledVector(east, Math.sin(bearing) * Math.cos(elev))
    .normalize();
})();

/**
 * Luz del sol sobre el dibujo del planeta: el lado de día con su color, la franja del atardecer entibiada de naranja
 * y la noche en penumbra azulada (se sigue viendo el dibujo).
 */
function sunlit(mat: MeshBasicMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSun = { value: SUN_GLOBE };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSunN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSunN = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSunN;\nuniform vec3 uSun;\n${DUSK_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float sunD = dot(normalize(vSunN), uSun);
        vec3 c = diffuseColor.rgb;
        vec3 lit = c * (0.9 + 0.22 * smoothstep(0.0, 0.8, sunD));
        vec3 night = c * vec3(0.26, 0.3, 0.46);
        vec3 col = mix(night, lit, smoothstep(-0.28, 0.02, sunD));
        diffuseColor.rgb = dusk(col, exp(-pow((sunD - 0.02) / 0.16, 2.0)) * 0.7);`);
  };
  return mat;
}

/** El sol: un disco brillante con su resplandor, lejos, en la dirección del sol (gira con el planeta y el cielo). */
function buildSun() {
  const sprite = (stops: [number, string][], size: number) => {
    const n = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const s = new Sprite(new SpriteMaterial({ map: tex, blending: AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(size);
    return s;
  };
  const sun = new Group();
  sun.add(
    sprite([[0, 'rgba(255,190,120,0.55)'], [0.25, 'rgba(255,140,70,0.22)'], [0.6, 'rgba(255,110,60,0.06)'], [1, 'rgba(255,100,60,0)']], 26),
    sprite([[0, 'rgba(255,250,235,1)'], [0.35, 'rgba(255,236,190,1)'], [0.5, 'rgba(255,200,130,0.6)'], [1, 'rgba(255,170,90,0)']], 2.6),
  );
  sun.position.copy(SUN_GLOBE).multiplyScalar(40);
  return sun;
}

// ───────── Escena ─────────

export interface GlobeHandle {
  /** Sigue la subida que empezó el mapa: desde la altura de la posta hasta la vista de reposo. */
  ascend: () => void;
  setActive: (active: boolean) => void;
  dispose: () => void;
}

export interface GlobeOptions {
  /** Empezó el viaje hacia el Chocó. */
  onDive: () => void;
  /** El planeta llegó a la altura de la posta: el mapa sigue el viaje desde aquí, con el mismo encuadre. */
  onHandoff: (handoff: Handoff) => void;
}

/**
 * Giro que deja el punto (lat, lon) de frente a la cámara, con el rumbo `bearing` (radianes desde el norte, hacia el
 * este) apuntando hacia arriba en la pantalla.
 */
function faceQ(lat: number, lon: number, bearing: number) {
  const out = latLonToVec(lat, lon).normalize();
  const north = latLonToVec(lat + 0.01, lon).normalize().sub(out).normalize();
  const east = latLonToVec(lat, lon + 0.01).normalize().sub(out).normalize();
  const up = north.multiplyScalar(Math.cos(bearing)).addScaledVector(east, Math.sin(bearing));
  const right = up.clone().cross(out).normalize();
  up.crossVectors(out, right).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, out)).invert();
}

export function createGlobe(host: HTMLElement, { onDive, onHandoff }: GlobeOptions): GlobeHandle {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'globe-labels';
  host.appendChild(labels.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.001, 200);
  const globe = new Group();
  scene.add(globe);

  const world = new Mesh(new SphereGeometry(R, 128, 96), sunlit(new MeshBasicMaterial({ map: posterTexture(worldCanvas()) })));
  globe.add(world);
  const patchGeo = new SphereGeometry(
    R * 1.0008, 96, 96,
    (REGION.lonMin + 180) * DEG, (REGION.lonMax - REGION.lonMin) * DEG,
    (90 - REGION.latMax) * DEG, (REGION.latMax - REGION.latMin) * DEG,
  );
  const patchMat = sunlit(new MeshBasicMaterial({ map: posterTexture(regionCanvas()), transparent: true, opacity: 0 }));
  const patch = new Mesh(patchGeo, patchMat);
  globe.add(patch);

  // Halo de atmósfera turquesa.
  const halo = new Mesh(
    new SphereGeometry(R * 1.1, 64, 48),
    new ShaderMaterial({
      side: BackSide,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      uniforms: { uSun: { value: new Vector3() } },
      fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vV;
        void main() {
          // Brilla pegado al borde del planeta y se desvanece hacia afuera. Del lado de noche casi no se ve; en la franja
          // del atardecer se tiñe de naranja, y con el sol detrás del planeta el borde se enciende.
          float f = 1.0 - smoothstep(-0.42, 0.0, dot(vN, vV));
          float s = dot(vN, uSun);
          vec3 col = mix(vec3(0.45, 0.85, 0.9), vec3(1.0, 0.58, 0.32), exp(-pow(s / 0.3, 2.0)) * 0.85);
          float light = 0.12 + 0.88 * smoothstep(-0.35, 0.2, s) + 1.2 * pow(max(dot(-vV, uSun), 0.0), 6.0);
          gl_FragColor = vec4(col * f * 0.9 * light, f);
        }`,
    }),
  );
  scene.add(halo);
  // El cielo gira con el planeta al arrastrarlo, como si la cámara le diera la vuelta.
  const stars = buildStars(renderer.getPixelRatio());
  const galaxy = buildGalaxy();
  galaxy.renderOrder = -2;
  stars.points.renderOrder = -1;
  globe.add(galaxy, stars.points, buildSun());
  const haloSun = (halo.material as ShaderMaterial).uniforms.uSun.value as Vector3;

  // Marcador del Chocó: el alfiler rosado del afiche, clavado justo en la costa de Nuquí (la punta del alfiler es el
  // punto de anclaje), con el rótulo encima. No cambia de tamaño: solo late un aro alrededor de la punta.
  const mkLabel = (cls: string, text: string) => {
    const el = document.createElement('div');
    el.className = `globe-label ${cls}`;
    el.textContent = text;
    return el;
  };
  const chocoAnchor = latLonToVec(ARRIVAL.lat, ARRIVAL.lon, R * 1.001);
  const chocoEl = document.createElement('button');
  chocoEl.type = 'button';
  chocoEl.className = 'globe-choco';
  chocoEl.setAttribute('aria-label', 'Entrar al Chocó');
  chocoEl.innerHTML = `<span class="globe-choco__tag">Chocó</span>
    <svg class="globe-choco__pin" viewBox="0 0 20 28" aria-hidden="true">
      <path d="M10 27C10 27 2 17.5 2 10a8 8 0 0 1 16 0c0 7.5-8 17-8 17Z" />
      <circle cx="10" cy="10" r="3.2" />
    </svg>
    <span class="globe-choco__ring" aria-hidden="true"></span>`;
  chocoEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  chocoEl.addEventListener('click', () => dive());
  const chocoLabel = new CSS2DObject(chocoEl);
  chocoLabel.center.set(0.5, 1);
  chocoLabel.position.copy(chocoAnchor);
  globe.add(chocoLabel);

  const extra = [
    { el: mkLabel('globe-label--country', 'Colombia'), at: latLonToVec(3.5, -73, R * 1.002) },
    { el: mkLabel('globe-label--sea', 'Océano Pacífico'), at: latLonToVec(2, -81.5, R * 1.002) },
    { el: mkLabel('globe-label--sea', 'Mar Caribe'), at: latLonToVec(12.3, -76.5, R * 1.002) },
  ];
  for (const x of extra) {
    const o = new CSS2DObject(x.el);
    o.position.copy(x.at);
    globe.add(o);
  }

  // ───────── Movimiento ─────────
  /** Vista de reposo: América de frente, con el norte arriba. El planeta no gira solo, así el alfiler se queda quieto. */
  const restQ = faceQ(6, -68, 0);
  /** Final del giro: la costa de Nuquí de frente y tierra adentro hacia arriba, como la primera vista del mapa. */
  const arrivalQ = faceQ(ARRIVAL.lat, ARRIVAL.lon, ARRIVAL.bearing);
  /** Distancia de reposo de la cámara y lo más lejos que se puede alejar (en radios del planeta). */
  const REST_DIST = 3.4;
  const FAR_DIST = 7.5;
  const state = {
    dist: REST_DIST,
    /** Distancia a la que va la cámara (rueda o pellizco). */
    goalDist: REST_DIST,
    /** Arrastre aún por aplicar (px): el planeta lo sigue con un poco de suavidad. */
    pending: new Vector2(0, 0),
    /** Velocidad del arrastre (px/s), para la inercia al soltar. */
    spin: new Vector2(0, 0),
    lastMove: 0,
    diving: false,
    diveStart: 0,
    fromQ: new Quaternion(),
    fromKm: 0,
    handedOff: false,
    /** Volviendo a la vista de reposo tras arrastrarlo: segundos desde que empezó. */
    returning: -1,
    /** Subida desde el mapa en curso (momento en que empezó), o 0. */
    ascent: 0,
    active: true,
    hover: false,
  };
  globe.quaternion.copy(restQ);

  const dive = () => {
    if (state.diving || state.ascent) return;
    state.diving = true;
    state.handedOff = false;
    state.diveStart = performance.now();
    state.fromQ.copy(globe.quaternion);
    state.fromKm = (state.dist - R) * EARTH_KM;
    state.returning = -1;
    host.classList.add('is-diving');
    chocoEl.classList.remove('is-hover');
    onDive();
  };

  // Arrastrar gira el planeta; la rueda o el pellizco acercan (y al acercarse se viaja al Chocó).
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  let downAt: { x: number; y: number } | null = null;
  const canvas = renderer.domElement;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const pickChoco = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(world)[0];
    if (!hit) return false;
    const local = globe.worldToLocal(hit.point.clone());
    const { lat, lon } = vecToLatLon(local);
    return isChoco(lat, lon);
  };
  const onDown = (e: PointerEvent) => {
    if (state.diving) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt = pointers.size === 1 ? { x: e.clientX, y: e.clientY } : null;
    state.returning = -1;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
      pinchDist = state.goalDist;
    }
    state.spin.set(0, 0);
  };
  let pinchDist = REST_DIST;
  const atRest = () => state.goalDist <= REST_DIST * 1.01;
  // Giro por píxel arrastrado: como si se agarrara la superficie (un píxel = lo que mide un píxel sobre el planeta
  // en la pantalla), un poco menos para que se sienta delicado. Así es igual de suave cerca o lejos.
  const rotateBy = (dx: number, dy: number) => {
    const radiusPx = (host.clientHeight / 2 / Math.tan(MathUtils.degToRad(camera.fov / 2))) * (R / Math.sqrt(state.dist ** 2 - R ** 2));
    const k = 0.7 / Math.max(radiusPx, 50);
    const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), dx * k);
    const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), dy * k);
    globe.quaternion.premultiply(qy).premultiply(qx);
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (!state.diving) {
        state.hover = pickChoco(e.clientX, e.clientY);
        canvas.style.cursor = state.hover ? 'pointer' : 'grab';
        chocoEl.classList.toggle('is-hover', state.hover);
      }
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinch) return;
      // Pellizcar acerca o aleja el planeta; al abrir los dedos ya de cerca, se viaja al Chocó.
      if (d > pinch * 1.15 && atRest()) dive();
      else state.goalDist = MathUtils.clamp(pinchDist * (pinch / d), REST_DIST, FAR_DIST);
      return;
    }
    state.pending.x += dx;
    state.pending.y += dy;
    const now = performance.now();
    const gap = Math.max((now - state.lastMove) / 1000, 0.008);
    state.lastMove = now;
    state.spin.lerp(new Vector2(dx / gap, dy / gap), 0.35);
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    // Si se quedó quieto antes de soltar, no sigue girando.
    if (performance.now() - state.lastMove > 90) state.spin.set(0, 0);
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && pickChoco(e.clientX, e.clientY)) dive();
    downAt = null;
  };
  // La rueda (o el pellizco del panel táctil) aleja el planeta; al acercarlo hasta su distancia de siempre y
  // seguir, se viaja al Chocó.
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (state.diving || state.ascent) return;
    if (e.deltaY < 0 && atRest()) {
      dive();
      return;
    }
    state.goalDist = MathUtils.clamp(state.goalDist * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), REST_DIST, FAR_DIST);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  let aspect = 1;
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    aspect = w / Math.max(h, 1);
    camera.aspect = aspect;
    camera.fov = fovs(aspect).globe;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const timer = new Timer();
  let frame = 0;
  const camDir = new Vector3();
  const tmp = new Vector3();
  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (!state.active) return;
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    stars.uniforms.uTime.value = timer.getElapsed();

    if (state.diving) {
      // Gira hasta Nuquí y baja por la curva compartida con el mapa (ver dive.ts).
      const t = (performance.now() - state.diveStart) / 1000;
      globe.quaternion.slerpQuaternions(state.fromQ, arrivalQ, MathUtils.smootherstep(t, 0, DIVE.turnEnd));
      const km = diveAltitude(t, state.fromKm, aspect);
      state.dist = R + km / EARTH_KM;
      if (!state.handedOff && km <= DIVE.handoffKm) {
        state.handedOff = true;
        onHandoff({ startedAt: state.diveStart, fromKm: state.fromKm });
      }
    } else if (state.ascent) {
      // Desde la posta hasta la vista de reposo: sube frenando y vuelve a poner el norte arriba.
      const t = (performance.now() - state.ascent) / 1000;
      const u = Math.min(t / ASCENT.globe, 1);
      const restKm = (REST_DIST - R) * EARTH_KM;
      state.dist = R + (DIVE.handoffKm * (restKm / DIVE.handoffKm) ** (1 - (1 - u) ** 2)) / EARTH_KM;
      globe.quaternion.slerpQuaternions(arrivalQ, restQ, MathUtils.smootherstep(t, 0.2, ASCENT.globe + 0.5));
      if (t > ASCENT.globe + 0.5) state.ascent = 0;
    } else {
      // Solo se mueve si lo arrastran: sigue al dedo con suavidad y, al soltarlo, se desliza un poco y se detiene.
      const follow = 1 - Math.exp(-dt * 12);
      rotateBy(state.pending.x * follow, state.pending.y * follow);
      state.pending.multiplyScalar(1 - follow);
      if (pointers.size === 0 && state.spin.lengthSq() > 1) {
        rotateBy(state.spin.x * dt * 0.2, state.spin.y * dt * 0.2);
        state.spin.multiplyScalar(Math.exp(-dt * 2.6));
      }
      if (state.returning >= 0) {
        state.returning += dt;
        globe.quaternion.slerp(restQ, 1 - Math.exp(-dt * 2.2));
        if (state.returning > 4) state.returning = -1;
      }
      state.dist += (state.goalDist - state.dist) * (1 - Math.exp(-dt * 3));
    }
    camera.position.set(0, 0, state.dist);
    camera.lookAt(0, 0, 0);

    // Al acercarse aparece el detalle de Colombia y los rótulos cercanos.
    const near = 1 - MathUtils.smoothstep(state.dist, R * 1.25, R * 1.9);
    patchMat.opacity = MathUtils.smoothstep(state.dist, R * 3.6, R * 2.0) * 0.4 + near * 0.6;
    patch.visible = patchMat.opacity > 0.01;
    for (const x of extra) x.el.style.opacity = String(near);

    // Los rótulos del lado de atrás del planeta no se ven.
    camDir.copy(camera.position).normalize();
    const facing = tmp.copy(chocoAnchor).applyQuaternion(globe.quaternion).normalize().dot(camDir);
    chocoEl.style.visibility = facing > 0.15 ? 'visible' : 'hidden';
    for (const x of extra) if (tmp.copy(x.at).applyQuaternion(globe.quaternion).normalize().dot(camDir) < 0.2) x.el.style.opacity = '0';

    // La cámara no gira (mira al planeta desde +z): la dirección del sol en la vista es la del planeta girado.
    haloSun.copy(SUN_GLOBE).applyQuaternion(globe.quaternion);
    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  loop();

  return {
    ascend: () => {
      state.diving = false;
      state.handedOff = false;
      state.returning = -1;
      state.spin.set(0, 0);
      state.ascent = performance.now();
      state.goalDist = REST_DIST;
      state.pending.set(0, 0);
      state.dist = R + DIVE.handoffKm / EARTH_KM;
      globe.quaternion.copy(arrivalQ);
      host.classList.remove('is-diving');
    },
    setActive: (active) => {
      state.active = active;
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        const mat = m.material as MeshBasicMaterial | undefined;
        mat?.map?.dispose();
        mat?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}
