// Escena 3D del mapa de prueba: la costa de Nuquí vista desde un barco, a unos 250 m de altura.
// Todo se genera con código (relieve, mar, cielo, casas y árboles), sin imágenes ni modelos:
// cuando llegue el GLB del diseñador, se reemplaza `buildLand` y se conservan mar, cielo, cámara y marcadores.
//
// Coordenadas: x apunta tierra adentro (este), z hacia el sur. La cámara mira desde el mar hacia la costa,
// así que el norte (Jurubidá) queda a la izquierda y el sur (Coquí) a la derecha, como en el afiche.

import {
  BackSide, Color, ConeGeometry, CylinderGeometry, DataTexture, DirectionalLight, DodecahedronGeometry,
  Float32BufferAttribute, FloatType, Fog, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, MathUtils,
  Mesh, MeshStandardMaterial, NearestFilter, Object3D, PerspectiveCamera, PlaneGeometry, Quaternion, Raycaster,
  RedFormat, SRGBColorSpace, Scene, ShaderMaterial, SphereGeometry, Timer, Vector2, Vector3, WebGLRenderer, BoxGeometry,
} from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { COAST, MAP_PLACES, type MapPlace } from '../../content/map';

/** Unidades de la escena por píxel del afiche (≈ metros a escala libre). */
const K = 2.6;
/** Altura del afiche que queda en z = 0 (Nuquí). */
const PY0 = 880;
const PX0 = 600;

const Z_LIMIT = { min: (40 - PY0) * K, max: (1330 - PY0) * K };
const DIST = { min: 380, max: 1700, start: 950 };
const PITCH = { min: 5, max: 38, start: 10 };

const SUN_DIR = new Vector3(1, 0.21, 0.26).normalize();
const HORIZON = new Color('#d4ecf2');
/** Punto de vista inicial aproximado (frente a Nuquí), para dejar el sol despejado. */
const START_VIEW = new Vector3(-1300, 200, -500);
const ZENITH = new Color('#3d8ed8');

const smoothstep = MathUtils.smoothstep;
const zOf = (py: number) => (py - PY0) * K;

// ───────── Línea de costa ─────────

const PY_MIN = -600;
const PY_MAX = 1900;

/** Interpolación lineal de la costa del afiche, suavizada con una media móvil de `radius` píxeles. */
function coastTable(radius: number) {
  const raw = new Float32Array(PY_MAX - PY_MIN + 1);
  for (let i = 0; i < raw.length; i++) {
    const py = PY_MIN + i;
    let j = 0;
    while (j < COAST.length - 2 && COAST[j + 1][0] < py) j++;
    const [y0, x0] = COAST[j];
    const [y1, x1] = COAST[j + 1];
    raw[i] = x0 + (x1 - x0) * MathUtils.clamp((py - y0) / (y1 - y0), 0, 1);
  }
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k++) {
      const v = raw[i + k];
      if (v !== undefined) { sum += v; n++; }
    }
    out[i] = sum / n;
  }
  return out;
}

const COAST_FINE = coastTable(18);
const COAST_SOFT = coastTable(140);

/** x de la costa (unidades de escena) para una z dada. */
function coastAt(table: Float32Array, z: number) {
  const f = MathUtils.clamp(z / K + PY0 - PY_MIN, 0, table.length - 1);
  const i = Math.floor(f);
  const a = table[i];
  const b = table[Math.min(i + 1, table.length - 1)];
  return (a + (b - a) * (f - i) - PX0) * K;
}
const coastX = (z: number) => coastAt(COAST_FINE, z);

// ───────── Ruido para el relieve ─────────

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x: number, y: number) {
  let sum = 0;
  let amp = 0.55;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(x * f, y * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/** Pseudoaleatorio con semilla: el mapa sale igual en cada visita. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ───────── Lugares ─────────

interface PlacedPlace extends MapPlace {
  pos: Vector3;
}

const placed: PlacedPlace[] = MAP_PLACES.map((p) => {
  const z = zOf(p.py);
  return { ...p, pos: new Vector3(coastX(z) + p.inland * K, 0, z) };
});

/** Relieve sin aplanar: playa, llanura costera y la serranía del Baudó al fondo. */
function rawHeight(x: number, z: number) {
  const d = x - coastX(z);
  if (d < 0) return Math.max(d * 0.06, -30);
  const beach = 1.5 + Math.min(d, 50) * 0.15;
  const ridge = Math.pow(smoothstep(d, 120, 2300), 1.2) * 300;
  const n = fbm(x * 0.0024, z * 0.0024);
  const amp = (14 + smoothstep(d, 150, 1100) * 110) * smoothstep(d, 40, 260);
  return Math.max(beach + ridge + n * amp, beach);
}

const flats = placed.map((p) => ({ x: p.pos.x, z: p.pos.z, h: rawHeight(p.pos.x, p.pos.z), r: p.id === 'kipara-te' ? 80 : 50 }));

/** Relieve final: se aplana un poco alrededor de cada lugar para que se lea con claridad. */
function heightAt(x: number, z: number) {
  let h = rawHeight(x, z);
  for (const f of flats) {
    const dist = Math.hypot(x - f.x, z - f.z);
    if (dist < f.r * 2) h = MathUtils.lerp(f.h, h, smoothstep(dist, f.r * 0.6, f.r * 2));
  }
  return h;
}

for (const p of placed) p.pos.y = heightAt(p.pos.x, p.pos.z);

// ───────── Construcción de la escena ─────────

const LAND_COLORS = {
  sand: new Color('#efdcab'),
  low: new Color('#96c96b'),
  mid: new Color('#5ea95a'),
  high: new Color('#2f7b4c'),
  peak: new Color('#3b6f57'),
  seabed: new Color('#6fc7bd'),
};

function buildLand() {
  const geo = new PlaneGeometry(7200, 7600, 300, 316);
  geo.rotateX(-Math.PI / 2);
  geo.translate(400, 0, -400);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const d = x - coastX(z);
    if (d < 0) c.copy(LAND_COLORS.seabed);
    else if (d < 34 + valueNoise(z * 0.02, 3) * 10) c.copy(LAND_COLORS.sand);
    else {
      const t = MathUtils.clamp(h / 300, 0, 1);
      if (t < 0.25) c.lerpColors(LAND_COLORS.low, LAND_COLORS.mid, t / 0.25);
      else if (t < 0.7) c.lerpColors(LAND_COLORS.mid, LAND_COLORS.high, (t - 0.25) / 0.45);
      else c.lerpColors(LAND_COLORS.high, LAND_COLORS.peak, (t - 0.7) / 0.3);
      c.offsetHSL(0, 0, valueNoise(x * 0.01, z * 0.01) * 0.035);
    }
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
}

/** Mar con olas suaves, agua clara cerca de la orilla y espuma en la línea de playa. */
function buildSea() {
  // Tabla de la costa por z, para que el sombreador sepa a qué distancia de la orilla está cada punto.
  const W = 4096;
  const zMin = -6000;
  const zMax = 6000;
  const data = new Float32Array(W);
  for (let i = 0; i < W; i++) data[i] = coastX(zMin + ((zMax - zMin) * i) / (W - 1));
  const coastTex = new DataTexture(data, W, 1, RedFormat, FloatType);
  coastTex.minFilter = coastTex.magFilter = NearestFilter;
  coastTex.needsUpdate = true;

  const uniforms = {
    uTime: { value: 0 },
    uCoast: { value: coastTex },
    uZRange: { value: new Vector2(zMin, zMax) },
  };
  const mat = new MeshStandardMaterial({ color: '#1b6f8a', flatShading: true, roughness: 0.32, metalness: 0.05 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vSea;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 seaW = modelMatrix * vec4(transformed, 1.0);
        transformed.z += sin(seaW.x * 0.011 + uTime * 0.8) * 1.8 + sin(seaW.z * 0.016 - uTime * 0.6) * 1.3
          + sin((seaW.x + seaW.z) * 0.031 + uTime * 1.4) * 0.6;
        vSea = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform sampler2D uCoast;\nuniform vec2 uZRange;\nvarying vec3 vSea;')
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `float coastX = texture2D(uCoast, vec2((vSea.z - uZRange.x) / (uZRange.y - uZRange.x), 0.5)).r;
        float off = coastX - vSea.x;
        vec3 sea = mix(vec3(0.07, 0.36, 0.50), vec3(0.20, 0.66, 0.68), 1.0 - smoothstep(0.0, 520.0, off));
        float swirl = sin(vSea.x * 0.018 + sin(vSea.z * 0.009 + uTime * 0.15) * 3.0 + uTime * 0.25);
        sea += smoothstep(0.9, 1.0, swirl) * 0.03;
        float foam = (1.0 - smoothstep(0.0, 24.0, off + sin(vSea.z * 0.06 + uTime * 1.6) * 5.0)) * smoothstep(-12.0, 0.0, off);
        sea = mix(sea, vec3(0.93, 0.97, 0.95), foam * 0.85);
        vec4 diffuseColor = vec4(sea, opacity);`,
      );
  };
  const geo = new PlaneGeometry(14000, 14000, 280, 280);
  const sea = new Mesh(geo, mat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-1800, 0, -400);
  return { sea, uniforms };
}

/** Cielo azul en degradado con el sol y su halo. Sigue a la cámara, así nunca se ve su borde. */
function buildSky() {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSun: { value: SUN_DIR },
      uHorizon: { value: HORIZON },
      uZenith: { value: ZENITH },
    },
    vertexShader: `varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform vec3 uSun; uniform vec3 uHorizon; uniform vec3 uZenith; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(uHorizon, uZenith, pow(clamp(d.y, 0.0, 1.0), 0.5));
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.93, 0.75) * (pow(s, 12.0) * 0.22 + pow(s, 160.0) * 0.7);
        col = mix(col, vec3(1.0, 0.99, 0.92), smoothstep(0.9988, 0.9991, s));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new Mesh(new SphereGeometry(16000, 32, 16), mat);
  sky.renderOrder = -1;
  return sky;
}

/** Pocas nubes bajas y redondeadas. */
function buildClouds(rand: () => number) {
  const group = new Group();
  const mat = new MeshStandardMaterial({ color: '#ffffff', emissive: '#dfeefa', emissiveIntensity: 0.55, flatShading: true, roughness: 1 });
  const geo = new IcosahedronGeometry(1, 1);
  for (let i = 0; i < 9; i++) {
    const cloud = new Group();
    const puffs = 4 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j++) {
      const m = new Mesh(geo, mat);
      const r = 60 + rand() * 70;
      m.scale.set(r * 1.4, r * 0.75, r);
      m.position.set((j - puffs / 2) * 90 + rand() * 30, rand() * 25, rand() * 60);
      cloud.add(m);
    }
    cloud.position.set(-1500 + rand() * 5500, 650 + rand() * 450, -3800 + rand() * 6000);
    // Ninguna nube delante del sol.
    const fromView = cloud.position.clone().sub(START_VIEW).normalize();
    if (fromView.dot(SUN_DIR) > 0.96) cloud.position.z += 2400;
    group.add(cloud);
  }
  return group;
}

const WALLS = ['#f4e6c8', '#efb7a0', '#a9d8cc', '#f6d58d', '#e0957a', '#c8d7ef'];
const ROOFS = ['#b4523b', '#7a4c3a', '#c96f45'];

/** Caseríos de los pueblos y las chozas de la etnoaldea. */
function buildSettlements(rand: () => number) {
  const group = new Group();
  const box = new BoxGeometry(12, 8, 10);
  const roof = new ConeGeometry(9.5, 6, 4);
  roof.rotateY(Math.PI / 4);
  const hutWall = new CylinderGeometry(6, 6.5, 6, 10);
  const hutRoof = new ConeGeometry(10, 9, 10);
  const mats = new Map<string, MeshStandardMaterial>();
  const mat = (color: string) => {
    if (!mats.has(color)) mats.set(color, new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }));
    return mats.get(color)!;
  };

  for (const p of placed) {
    if (p.kind === 'town') {
      for (let i = 0; i < 11; i++) {
        const z = p.pos.z + (rand() - 0.5) * 170;
        const x = coastX(z) + 22 + rand() * 70;
        const y = heightAt(x, z);
        const house = new Group();
        const walls = new Mesh(box, mat(WALLS[Math.floor(rand() * WALLS.length)]));
        walls.position.y = 4;
        const top = new Mesh(roof, mat(ROOFS[Math.floor(rand() * ROOFS.length)]));
        top.position.y = 11;
        top.scale.set(1, 1, 0.85);
        house.add(walls, top);
        house.position.set(x, y, z);
        house.rotation.y = (rand() - 0.5) * 0.5;
        const s = 0.85 + rand() * 0.4;
        house.scale.setScalar(s);
        group.add(house);
      }
    } else if (p.id === 'kipara-te') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const x = p.pos.x + Math.cos(a) * 34;
        const z = p.pos.z + Math.sin(a) * 34;
        const y = heightAt(x, z);
        const w = new Mesh(hutWall, mat('#cfa66a'));
        w.position.set(x, y + 3, z);
        const r = new Mesh(hutRoof, mat('#a8803e'));
        r.position.set(x, y + 10.5, z);
        group.add(w, r);
      }
    }
  }
  return group;
}

/** Árboles dispersos (pocos, a propósito) y algunas palmas en la playa. */
function buildTrees(rand: () => number) {
  const free = (x: number, z: number) => placed.every((p) => Math.hypot(x - p.pos.x, z - p.pos.z) > (p.kind === 'town' ? 140 : 70));
  const dummy = new Object3D();
  const group = new Group();

  const trunkGeo = new CylinderGeometry(1.2, 1.9, 10, 5);
  trunkGeo.translate(0, 5, 0);
  const crownGeo = new IcosahedronGeometry(9, 0);
  const trunks = new InstancedMesh(trunkGeo, new MeshStandardMaterial({ color: '#7a5a3c', flatShading: true }), 120);
  const crowns = new InstancedMesh(crownGeo, new MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), 120);
  const greens = ['#3f8f4f', '#4f9e52', '#2e7a46', '#6aae58'].map((c) => new Color(c));
  let n = 0;
  for (let tries = 0; n < 120 && tries < 2000; tries++) {
    const z = Z_LIMIT.min - 600 + rand() * (Z_LIMIT.max - Z_LIMIT.min + 1200);
    const x = coastX(z) + 60 + Math.pow(rand(), 1.6) * 1100;
    if (!free(x, z)) continue;
    const y = heightAt(x, z);
    const s = 1 + rand() * 0.9;
    dummy.position.set(x, y - 1, z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunks.setMatrixAt(n, dummy.matrix);
    dummy.position.y = y - 1 + 15 * s;
    dummy.scale.set(s, s * (0.9 + rand() * 0.4), s);
    dummy.updateMatrix();
    crowns.setMatrixAt(n, dummy.matrix);
    crowns.setColorAt(n, greens[Math.floor(rand() * greens.length)]);
    n++;
  }
  trunks.count = crowns.count = n;

  const palmTrunk = new CylinderGeometry(0.8, 1.3, 16, 5);
  palmTrunk.translate(0, 8, 0);
  const palmLeaves = new ConeGeometry(11, 4, 7);
  const pTrunks = new InstancedMesh(palmTrunk, trunks.material, 50);
  const pLeaves = new InstancedMesh(palmLeaves, new MeshStandardMaterial({ color: '#3e8d47', flatShading: true }), 50);
  let m = 0;
  for (let tries = 0; m < 50 && tries < 1000; tries++) {
    const z = Z_LIMIT.min - 400 + rand() * (Z_LIMIT.max - Z_LIMIT.min + 800);
    const x = coastX(z) + 14 + rand() * 40;
    if (!free(x, z)) continue;
    const y = heightAt(x, z);
    const lean = (rand() - 0.5) * 0.35;
    dummy.position.set(x, y - 0.5, z);
    dummy.rotation.set(lean, rand() * Math.PI, -0.15 - rand() * 0.15);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    pTrunks.setMatrixAt(m, dummy.matrix);
    const tip = new Vector3(0, 16, 0).applyEuler(dummy.rotation).add(dummy.position);
    dummy.position.copy(tip);
    dummy.updateMatrix();
    pLeaves.setMatrixAt(m, dummy.matrix);
    m++;
  }
  pTrunks.count = pLeaves.count = m;

  group.add(trunks, crowns, pTrunks, pLeaves);
  return group;
}

/** Morros: islotes de roca con copete verde frente a la costa. */
function buildRocks(rand: () => number) {
  const group = new Group();
  const rockMat = new MeshStandardMaterial({ color: '#7c8a80', flatShading: true, roughness: 1 });
  const topMat = new MeshStandardMaterial({ color: '#4f9a52', flatShading: true });
  const spots = [[560, 120], [610, 90], [700, 160], [820, 140], [985, 110], [1150, 150]];
  for (const [py, off] of spots) {
    const z = zOf(py) + (rand() - 0.5) * 60;
    const x = coastX(z) - off * K * 0.6;
    const s = 10 + rand() * 12;
    const rock = new Mesh(new DodecahedronGeometry(s, 0), rockMat);
    rock.scale.set(1, 1.3 + rand() * 0.5, 1);
    rock.position.set(x, s * 0.45, z);
    const top = new Mesh(new IcosahedronGeometry(s * 0.7, 0), topMat);
    top.scale.set(1, 0.45, 1);
    top.position.set(x, s * 0.45 + s * 1.25, z);
    group.add(rock, top);
  }
  return group;
}

// ───────── Escena completa ─────────

export interface MapSceneHandle {
  focus: (id: string) => void;
  select: (id: string | null) => void;
  dispose: () => void;
}

export interface MapSceneOptions {
  onSelect: (place: MapPlace | null) => void;
  onInteract: () => void;
}

export function createMapScene(host: HTMLElement, { onSelect, onInteract }: MapSceneOptions): MapSceneHandle {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'map-labels';
  host.appendChild(labels.domElement);

  const scene = new Scene();
  scene.fog = new Fog(HORIZON, 1400, 7200);
  const camera = new PerspectiveCamera(52, 1, 5, 20000);

  const rand = rng(20261008);
  const sky = buildSky();
  const { sea, uniforms } = buildSea();
  scene.add(sky, sea, buildLand(), buildSettlements(rand), buildTrees(rand), buildRocks(rand), buildClouds(rand));

  scene.add(new HemisphereLight('#d2ecff', '#4a6a44', 1.25));
  const key = new DirectionalLight('#fff1d6', 2.3);
  key.position.set(-0.55, 1, 0.3).multiplyScalar(1000);
  scene.add(key);

  // Marcadores: alfiler rosado para los sitios, rótulo blanco para los pueblos.
  const pinMat = new MeshStandardMaterial({ color: '#e2456f', emissive: '#7a1630', emissiveIntensity: 0.35, roughness: 0.5 });
  const pinHead = new SphereGeometry(7, 16, 12);
  const pinTip = new ConeGeometry(4.6, 13, 12);
  pinTip.rotateX(Math.PI);
  pinTip.translate(0, -8.5, 0);
  const pins: { place: PlacedPlace; pin: Group; label: CSS2DObject; el: HTMLButtonElement }[] = [];

  for (const place of placed) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `map-label map-label--${place.kind}`;
    el.textContent = place.name;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', () => select(place.id));
    const label = new CSS2DObject(el);
    label.center.set(0.5, 1);

    const pin = new Group();
    if (place.kind === 'site') {
      pin.add(new Mesh(pinHead, pinMat), new Mesh(pinTip, pinMat));
      pin.position.copy(place.pos).setY(place.pos.y + 24);
      label.position.set(0, 12, 0);
    } else {
      pin.position.copy(place.pos).setY(place.pos.y + 62);
    }
    pin.userData.id = place.id;
    pin.add(label);
    scene.add(pin);
    pins.push({ place, pin, label, el });
  }

  // ───────── Cámara: siempre en el mar, mirando hacia la costa ─────────
  const view = { z: 0, dist: 1500, pitch: 22 };
  const goal = { z: 0, dist: DIST.start, pitch: PITCH.start };
  const target = new Vector3();
  const normal = new Vector3();

  const placeCamera = () => {
    const tx = coastAt(COAST_SOFT, view.z) + 160;
    target.set(tx, 30, view.z);
    const slope = (coastAt(COAST_SOFT, view.z + 160) - coastAt(COAST_SOFT, view.z - 160)) / 320;
    const yaw = MathUtils.clamp(Math.atan(slope), -0.55, 0.55);
    normal.set(-Math.cos(yaw), 0, Math.sin(yaw));
    const p = MathUtils.degToRad(view.pitch);
    camera.position.copy(target).addScaledVector(normal, view.dist * Math.cos(p));
    camera.position.y += view.dist * Math.sin(p);
    camera.lookAt(target);
    sky.position.copy(camera.position);
  };

  const clampGoal = () => {
    goal.z = MathUtils.clamp(goal.z, Z_LIMIT.min, Z_LIMIT.max);
    goal.dist = MathUtils.clamp(goal.dist, DIST.min, DIST.max);
    goal.pitch = MathUtils.clamp(goal.pitch, PITCH.min, PITCH.max);
  };

  // ───────── Interacción ─────────
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number; t: number } | null = null;
  let pinchStart = 0;
  let pinchDist = 0;
  const canvas = renderer.domElement;

  const worldPerPixel = () => (2 * view.dist * Math.tan(MathUtils.degToRad(camera.fov / 2))) / Math.max(host.clientHeight, 1);

  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      pinchDist = goal.dist;
      downAt = null;
    }
    onInteract();
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart > 0) goal.dist = pinchDist * (pinchStart / d);
    } else {
      // Arrastrar a los lados recorre la costa; arriba y abajo cambia la inclinación de la mirada.
      goal.z -= dx * worldPerPixel() * 1.15;
      goal.pitch += dy * 0.12;
    }
    clampGoal();
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && performance.now() - downAt.t < 500) pick(e);
    downAt = null;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    goal.dist *= Math.exp(e.deltaY * 0.0012);
    clampGoal();
    onInteract();
  };
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: [-260, 1], ArrowRight: [260, 1], ArrowUp: [0, 0.85], ArrowDown: [0, 1.18] }[e.key];
    if (step) {
      e.preventDefault();
      goal.z += step[0];
      goal.dist *= step[1];
      clampGoal();
      onInteract();
    } else if (e.key === 'Escape') select(null);
  };

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pins.filter((p) => p.place.kind === 'site').map((p) => p.pin), true)[0];
    let o: Object3D | null = hit?.object ?? null;
    while (o && !o.userData.id) o = o.parent;
    select(o ? (o.userData.id as string) : null);
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);

  let selected: string | null = null;
  function select(id: string | null) {
    selected = id;
    for (const p of pins) p.el.classList.toggle('is-selected', p.place.id === id);
    const place = placed.find((p) => p.id === id) ?? null;
    if (place) {
      goal.z = place.pos.z;
      goal.dist = Math.min(goal.dist, place.kind === 'town' ? 760 : 620);
      clampGoal();
    }
    onSelect(place);
  }
  function focus(id: string) {
    const place = placed.find((p) => p.id === id);
    if (!place) return;
    goal.z = place.pos.z;
    goal.dist = 820;
    clampGoal();
  }

  // ───────── Tamaño y bucle ─────────
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    // En pantallas verticales se abre el campo de visión para que quepa más costa.
    camera.fov = w / h < 0.8 ? 64 : 52;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const timer = new Timer();
  const tmp = new Vector3();
  const bob = new Quaternion();
  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();
    const ease = 1 - Math.exp(-dt * 3.2);
    view.z += (goal.z - view.z) * ease;
    view.dist += (goal.dist - view.dist) * ease;
    view.pitch += (goal.pitch - view.pitch) * ease;
    placeCamera();
    uniforms.uTime.value = t;

    for (const { place, pin, el } of pins) {
      if (place.kind === 'site') {
        pin.position.y = place.pos.y + 24 + Math.sin(t * 2 + place.pos.z * 0.01) * 2.5;
        pin.quaternion.multiply(bob.setFromAxisAngle(tmp.set(0, 1, 0), dt * 0.8));
        pin.scale.setScalar(place.id === selected ? 1.45 : 1);
      }
      // Los rótulos de los sitios lejanos se desvanecen para no amontonarse.
      const far = place.kind === 'site' ? 1 - smoothstep(pin.position.distanceTo(camera.position), 1500, 2300) : 1;
      el.dataset.far = String(far);
    }

    renderer.render(scene, camera);
    labels.render(scene, camera);
    if (frame % 8 === 0) declutter();
  };

  /**
   * Evita que los rótulos se pisen: si uno choca con otro más importante (pueblos, luego el elegido,
   * luego los cercanos), sube un escalón unido a su alfiler por una línea; si no cabe, se oculta.
   */
  const declutter = () => {
    const order = [...pins].sort((a, b) => rank(a) - rank(b));
    const taken: { l: number; r: number; t: number; b: number }[] = [];
    for (const { el } of order) {
      const far = Number(el.dataset.far ?? 1);
      const lift = Number(el.dataset.lift ?? 0);
      const box = el.getBoundingClientRect();
      const step = box.height + 6;
      let placedAt = -1;
      for (let k = 0; far > 0.2 && k < 4 && placedAt < 0; k++) {
        const t = box.top + lift - k * step;
        const hit = taken.some((o) => box.left < o.r + 4 && box.right > o.l - 4 && t < o.b + 2 && t + box.height > o.t - 2);
        if (!hit) {
          placedAt = k;
          taken.push({ l: box.left, r: box.right, t, b: t + box.height });
        }
      }
      const show = placedAt >= 0;
      const newLift = show ? placedAt * step : 0;
      el.dataset.lift = String(newLift);
      el.style.setProperty('--lift', `${newLift}px`);
      el.style.opacity = show ? String(far) : '0';
      el.style.pointerEvents = show ? '' : 'none';
    }
  };
  const rank = (p: (typeof pins)[number]) =>
    p.place.kind === 'town' ? 0 : p.place.id === selected ? 1 : 2 + p.pin.position.distanceTo(camera.position) / 1e4;
  loop();

  return {
    focus,
    select,
    dispose: () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      scene.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      uniforms.uCoast.value.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}

export const MAP_TOWNS = placed.filter((p) => p.kind === 'town').map(({ id, name }) => ({ id, name }));
