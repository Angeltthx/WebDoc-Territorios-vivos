// Escena 3D del mapa de prueba: la costa de Nuquí vista desde un barco, a unos 250 m de altura.
// Todo se genera con código (relieve, mar, cielo, selva, fauna, casas y lanchas), sin imágenes ni modelos:
// cuando llegue el GLB del diseñador, se reemplaza `buildLand` y se conservan mar, cielo, cámara y marcadores.
//
// La cámara mira desde el mar hacia la costa, así que el norte (Jurubidá) queda a la izquierda
// y el sur (Coquí) a la derecha, como en el afiche. Ver `terrain.ts` para las coordenadas.

import {
  BackSide, Color, ConeGeometry, DataTexture, DirectionalLight, DodecahedronGeometry, Float32BufferAttribute,
  Fog, Group, HemisphereLight, IcosahedronGeometry, MathUtils, Mesh, MeshStandardMaterial, LinearFilter, Object3D, UnsignedByteType,
  PerspectiveCamera, PlaneGeometry, Quaternion, Raycaster, RedFormat, SRGBColorSpace, Scene, ShaderMaterial,
  SphereGeometry, Timer, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { MapPlace } from '../../../content/map';
import { buildFauna, NATURE_LABEL_HEIGHT } from './fauna';
import { sticker } from './kit';
import { buildFlora, buildMist } from './flora';
import { buildPlaces } from './places';
import {
  GRID, HEIGHTS, RAIL, SHORE_FIELD, nature, placeNear, placed, railAt, rng, shore, smoothstep, valueNoise, type PlacedPlace,
} from './terrain';

const DIST = { min: 300, max: 1700, start: 950 };
const PITCH = { min: 5, max: 38, start: 10 };

const SUN_DIR = new Vector3(1, 0.21, 0.26).normalize();
const HORIZON = new Color('#dcf1ec');
const ZENITH = new Color('#4aa6c8');
/** Punto de vista inicial aproximado (frente a Nuquí), para dejar el sol despejado. */
const START_VIEW = (() => {
  const nuqui = placed.find((p) => p.id === 'nuqui')!;
  return nuqui.pos.clone().addScaledVector(nuqui.sea, 900).setY(170);
})();

// ───────── Construcción de la escena ─────────

const GLSL_COMMON = `
    vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
    float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
    }`;

/** Patrón de hojas del afiche, dibujado en el suelo según la posición (se apaga de lejos para no titilar). */
const LAND_GLSL = `${GLSL_COMMON}
  float leafAt(vec2 p, float sx, float sy, float seed) {
    vec2 cell = floor(p);
    vec2 f = fract(p) - 0.5;
    float a = hash2(cell + seed) * 6.2831;
    vec2 j = (vec2(hash2(cell + seed + 3.1), hash2(cell + seed + 7.7)) - 0.5) * 0.45;
    vec2 d = mat2(cos(a), -sin(a), sin(a), cos(a)) * (f + j);
    return 1.0 - smoothstep(0.85, 1.0, length(d / vec2(sx, sy)));
  }
  vec3 posterJungle(vec3 base, vec2 xz, float jungle) {
    vec2 p = xz / 7.0;
    float fade = 1.0 - smoothstep(0.12, 0.35, max(fwidth(p.x), fwidth(p.y)));
    float dark = leafAt(p, 0.42, 0.12, 0.0);
    float light = leafAt(xz / 10.0 + 0.37, 0.38, 0.1, 11.0);
    vec2 pb = xz / 60.0;
    float blob = step(0.86, hash2(floor(pb) + 41.0)) * leafAt(pb, 0.32, 0.18, 23.0);
    float fadeB = 1.0 - smoothstep(0.2, 0.5, max(fwidth(pb.x), fwidth(pb.y)));
    vec3 c = base;
    c = mix(c, c * 0.62, dark * jungle * fade);
    c = mix(c, srgb(vec3(0.20, 0.45, 0.29)), light * jungle * fade * 0.85);
    c = mix(c, srgb(vec3(0.42, 0.66, 0.29)), blob * jungle * fadeB);
    return c;
  }`;

const LAND_COLORS = {
  sand: new Color('#ead9aa'),
  bank: new Color('#cdbb86'),
  rock: new Color('#7d8a6e'),
  // Verdes de la selva del afiche.
  low: new Color('#356f45'),
  mid: new Color('#2a5f3d'),
  high: new Color('#235236'),
  peak: new Color('#1f4a32'),
  seabed: new Color('#6fc7bd'),
};

function buildLand() {
  // La malla usa la misma grilla que `heightAt` (vértice i = fila * (nx + 1) + columna, de norte a sur).
  const geo = new PlaneGeometry(GRID.w, GRID.d, GRID.nx, GRID.nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate(GRID.x0 + GRID.w / 2, 0, GRID.z0 + GRID.d / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = HEIGHTS[i];
    pos.setY(i, h);
    const d = shore(x, z);
    if (d < 0 || h < -0.5) c.copy(LAND_COLORS.seabed);
    else if (h < 2.2 && d > 60) c.copy(LAND_COLORS.bank);
    else if (d < 34 + valueNoise(z * 0.02, 3) * 10 && h < 6) c.copy(LAND_COLORS.sand);
    else if (d < 70 && h > 8) c.lerpColors(LAND_COLORS.rock, LAND_COLORS.mid, smoothstep(d, 20, 70)); // acantilados de las puntas
    else {
      const t = MathUtils.clamp(h / 300, 0, 1);
      if (t < 0.12) c.lerpColors(LAND_COLORS.low, LAND_COLORS.mid, t / 0.12);
      else if (t < 0.7) c.lerpColors(LAND_COLORS.mid, LAND_COLORS.high, (t - 0.12) / 0.58);
      else c.lerpColors(LAND_COLORS.high, LAND_COLORS.peak, (t - 0.7) / 0.3);
      c.offsetHSL(0, 0, valueNoise(x * 0.01, z * 0.01) * 0.035);
    }
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  // Dibujo del afiche sobre la selva: hojas oscuras, hojas claras y manchas verde claro.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLand;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLand = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLand;${LAND_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float jungle = smoothstep(0.004, 0.02, vColor.g - vColor.r * 1.3);
        diffuseColor.rgb = posterJungle(diffuseColor.rgb, vLand.xz, jungle);`);
  };
  return new Mesh(geo, mat);
}

/** Mar con olas suaves, agua clara cerca de la orilla, espuma en la playa y ríos en calma. */
function buildSea() {
  // Distancia a la orilla en una textura (un byte por celda), para que el sombreador sepa dónde hay
  // agua clara, espuma o río. 0 = 100 unidades tierra adentro; 255 = 920 mar adentro.
  const { data, cols, rows, cell, x0, z0 } = SHORE_FIELD;
  const bytes = new Uint8Array(cols * rows);
  for (let i = 0; i < bytes.length; i++) bytes[i] = MathUtils.clamp(Math.round(((-data[i] + 100) / 1020) * 255), 0, 255);
  const shoreTex = new DataTexture(bytes, cols, rows, RedFormat, UnsignedByteType);
  shoreTex.minFilter = shoreTex.magFilter = LinearFilter;
  shoreTex.needsUpdate = true;

  const uniforms = {
    uTime: { value: 0 },
    uShore: { value: shoreTex },
    uOrigin: { value: new Vector2(x0, z0) },
    uSize: { value: new Vector2(cols * cell, rows * cell) },
  };
  // Distancia mar adentro desde la orilla (negativa tierra adentro, es decir, en los ríos).
  const coastGlsl = `uniform float uTime;
    uniform sampler2D uShore;
    uniform vec2 uOrigin;
    uniform vec2 uSize;
    varying vec3 vSea;
    float seaOff(vec3 w) {
      vec2 uv = (w.xz - uOrigin) / uSize;
      float d = texture2D(uShore, clamp(uv, 0.0, 1.0)).r * 1020.0 - 100.0;
      return uv.x < 0.0 ? d - uv.x * uSize.x : d;
    }`;
  const mat = new MeshStandardMaterial({ color: '#1b6f8a', flatShading: true, roughness: 0.75, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${coastGlsl}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 seaW = modelMatrix * vec4(transformed, 1.0);
        float calm = mix(0.15, 1.0, smoothstep(-40.0, 30.0, seaOff(seaW.xyz)));
        transformed.z += calm * (sin(seaW.x * 0.011 + uTime * 0.8) * 1.8 + sin(seaW.z * 0.016 - uTime * 0.6) * 1.3
          + sin((seaW.x + seaW.z) * 0.031 + uTime * 1.4) * 0.6);
        vSea = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${coastGlsl}${GLSL_COMMON}`)
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `float off = seaOff(vSea);
        // Turquesa del afiche: más claro junto a la orilla.
        float near = 1.0 - smoothstep(0.0, 420.0, off);
        vec3 sea = mix(srgb(vec3(0.090, 0.486, 0.533)), srgb(vec3(0.122, 0.561, 0.592)), smoothstep(2600.0, 700.0, off));
        sea = mix(sea, srgb(vec3(0.208, 0.682, 0.675)), near);
        // Remolinos: trazos curvos oscuros (y algunos claros), como los del afiche.
        vec2 q = vSea.xz * 0.0032;
        vec2 warp = vec2(vnoise(q * 1.7 + uTime * 0.015), vnoise(q * 1.7 + 5.2 - uTime * 0.015));
        float n = vnoise(q + warp * 1.7) * 7.0;
        float stroke = (1.0 - smoothstep(0.06, 0.06 + fwidth(n) * 1.5, abs(fract(n) - 0.5))) * step(0.35, fract(n * 0.37 + 0.2));
        float n2 = vnoise(q * 2.4 + warp * 2.2 + 9.0) * 9.0;
        float lightStroke = (1.0 - smoothstep(0.02, 0.02 + fwidth(n2) * 1.5, abs(fract(n2) - 0.5))) * step(0.55, fract(n2 * 0.11));
        sea = mix(sea, srgb(vec3(0.07, 0.40, 0.45)), stroke * 0.7 * (1.0 - near * 0.4));
        sea = mix(sea, srgb(vec3(0.42, 0.80, 0.78)), lightStroke * 0.12);
        float foam = (1.0 - smoothstep(0.0, 22.0, off + sin(vSea.z * 0.06 + uTime * 1.6) * 5.0)) * smoothstep(-12.0, 0.0, off);
        sea = mix(sea, srgb(vec3(0.85, 0.95, 0.93)), foam * 0.9);
        // Ríos: agua verde turquesa y quieta.
        sea = mix(sea, srgb(vec3(0.25, 0.58, 0.55)), smoothstep(-10.0, -60.0, off));
        vec4 diffuseColor = vec4(sea, opacity);`,
      );
  };
  const geo = new PlaneGeometry(16000, 16000, 320, 320);
  const sea = new Mesh(geo, mat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-1500, 0, -300);
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

/** Nubes redondeadas que se mueven despacio. */
function buildClouds(rand: () => number) {
  const group = new Group();
  const mat = new MeshStandardMaterial({ color: '#ffffff', emissive: '#dfeefa', emissiveIntensity: 0.55, flatShading: true, roughness: 1 });
  const geo = new IcosahedronGeometry(1, 1);
  for (let i = 0; i < 10; i++) {
    const cloud = new Group();
    const puffs = 4 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j++) {
      const m = new Mesh(geo, mat);
      const r = 60 + rand() * 70;
      m.scale.set(r * 1.4, r * 0.75, r);
      m.position.set((j - puffs / 2) * 90 + rand() * 30, rand() * 25, rand() * 60);
      cloud.add(m);
    }
    cloud.position.set(-2500 + rand() * 6500, 650 + rand() * 450, -3500 + rand() * 6000);
    // Ninguna nube delante del sol.
    const fromView = cloud.position.clone().sub(START_VIEW).normalize();
    if (fromView.dot(SUN_DIR) > 0.96) cloud.position.z += 2400;
    cloud.userData.z = cloud.position.z;
    group.add(cloud);
  }
  const update = (t: number) => {
    for (const c of group.children) c.position.z = c.userData.z + Math.sin(t * 0.01 + c.userData.z) * 300;
  };
  return { group, update };
}

/** Morros: islotes de roca con copete verde frente a la costa. */
function buildRocks(rand: () => number) {
  const group = new Group();
  const rockMat = new MeshStandardMaterial({ color: '#7c8a80', flatShading: true, roughness: 1 });
  const topMat = new MeshStandardMaterial({ color: '#4f9a52', flatShading: true });
  // Frente al golfo de Tribugá, a Nuquí, a Panguí y a la entrada de la ensenada de Coquí.
  const spots = [['tribuga', 0.6, -0.9], ['tribuga', 1.6, -0.6], ['nuqui', -1.7, -0.8], ['nuqui', 1.8, -0.7], ['pangui', 0.7, -0.6], ['coqui', -2.4, -0.4]] as const;
  for (const [town, along, inland] of spots) {
    const { x, z } = placeNear(town, along + (rand() - 0.5) * 0.3, inland).pos;
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
  /** Pausa o reanuda la escena; al reanudar, la cámara entra desde lo alto, como si bajara del planeta. */
  setActive: (active: boolean) => void;
  dispose: () => void;
}

export interface MapSceneOptions {
  onSelect: (place: MapPlace | null) => void;
  onInteract: () => void;
  /** Empieza en pausa (detrás del planeta de la entrada). */
  paused?: boolean;
}

export function createMapScene(host: HTMLElement, { onSelect, onInteract, paused = false }: MapSceneOptions): MapSceneHandle {
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
  const clouds = buildClouds(rand);
  const mist = buildMist(rand);
  const places = buildPlaces(rand);
  const fauna = buildFauna(rand);
  scene.add(sky, sea, buildLand(), buildRocks(rand), buildFlora(rand), clouds.group, mist.group, places.group, fauna.group);

  // Luz de ilustración: pareja y suave, con poca sombra.
  scene.add(new HemisphereLight('#eaf7f3', '#3a5a40', 2.1));
  const key = new DirectionalLight('#fff4de', 1.25);
  key.position.set(-0.55, 1, 0.3).multiplyScalar(1000);
  scene.add(key);

  // Marcadores: alfiler rosado para los sitios, rótulo blanco para los pueblos.
  const pinMat = new MeshStandardMaterial({ color: '#e2456f', emissive: '#7a1630', emissiveIntensity: 0.35, roughness: 0.5 });
  const pinHead = new SphereGeometry(5.5, 16, 12);
  const pinTip = new ConeGeometry(3.6, 10, 12);
  pinTip.rotateX(Math.PI);
  pinTip.translate(0, -6.6, 0);
  const pins: { place: PlacedPlace; pin: Group; label: CSS2DObject; el: HTMLButtonElement }[] = [];
  /** Altura del alfiler: encima de lo que haya construido en el sitio. */
  const pinBase = (place: PlacedPlace) => place.pos.y + (places.heights.get(place.id) ?? 10) + 16;

  for (const place of [...placed, ...nature]) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `map-label map-label--${place.kind}`;
    if (place.kind === 'nature') {
      const name = document.createElement('span');
      name.textContent = place.name;
      el.append(name);
      if (place.scientific) {
        const sci = document.createElement('em');
        sci.textContent = place.scientific;
        el.append(sci);
      }
    } else el.textContent = place.name;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', () => select(place.id));
    const label = new CSS2DObject(el);
    label.center.set(0.5, 1);

    const pin = new Group();
    if (place.kind === 'site') {
      pin.add(new Mesh(pinHead, pinMat), new Mesh(pinTip, pinMat));
      sticker(pin, 1.1);
      pin.position.copy(place.pos).setY(pinBase(place));
      label.position.set(0, 12, 0);
    } else if (place.kind === 'town') {
      pin.position.copy(place.pos).setY(place.pos.y + (places.heights.get(place.id) ?? 20) + 40);
    } else {
      pin.position.copy(place.pos).setY(place.pos.y + (NATURE_LABEL_HEIGHT[place.id] ?? 30));
    }
    pin.userData.id = place.id;
    pin.add(label);
    scene.add(pin);
    pins.push({ place, pin, label, el });
  }

  // ───────── Cámara: siempre en el mar, mirando hacia la costa ─────────
  const startS = placed.find((p) => p.id === 'nuqui')!.s;
  const view = { s: startS, dist: 1500, pitch: 22 };
  const goal = { s: startS, dist: DIST.start, pitch: PITCH.start };
  const target = new Vector3();

  const placeCamera = () => {
    const r = railAt(view.s);
    target.copy(r.pos).addScaledVector(r.sea, -170).setY(25);
    const p = MathUtils.degToRad(view.pitch);
    camera.position.copy(target).addScaledVector(r.sea, view.dist * Math.cos(p));
    camera.position.y += view.dist * Math.sin(p);
    camera.lookAt(target);
    sky.position.copy(camera.position);
  };

  const clampGoal = () => {
    goal.s = MathUtils.clamp(goal.s, RAIL.min, RAIL.max);
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
      goal.s -= dx * worldPerPixel() * 1.15;
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
      goal.s += step[0];
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
    const place = [...placed, ...nature].find((p) => p.id === id) ?? null;
    if (place) {
      goal.s = place.s;
      goal.dist = Math.min(goal.dist, place.kind === 'town' ? 760 : 560);
      clampGoal();
    }
    onSelect(place);
  }
  function focus(id: string) {
    const place = placed.find((p) => p.id === id);
    if (!place) return;
    goal.s = place.s;
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
  let active = !paused;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (!active) return;
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();
    const ease = 1 - Math.exp(-dt * 3.2);
    view.s += (goal.s - view.s) * ease;
    view.dist += (goal.dist - view.dist) * ease;
    view.pitch += (goal.pitch - view.pitch) * ease;
    placeCamera();
    uniforms.uTime.value = t;
    clouds.update(t);
    mist.update(t);
    places.update(t, dt);
    fauna.update(t, dt);

    for (const { place, pin, el } of pins) {
      if (place.kind === 'site') {
        pin.position.y = pinBase(place) + Math.sin(t * 2 + place.pos.z * 0.01) * 2.5;
        pin.quaternion.multiply(bob.setFromAxisAngle(tmp.set(0, 1, 0), dt * 0.8));
        pin.scale.setScalar(place.id === selected ? 1.45 : 1);
      }
      // Los rótulos de los sitios lejanos se desvanecen para no amontonarse.
      const far = place.kind === 'town' ? 1 : 1 - smoothstep(pin.position.distanceTo(camera.position), 1500, 2300);
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
    p.place.kind === 'town' ? 0 : p.place.id === selected ? 1 : (p.place.kind === 'site' ? 2 : 3) + p.pin.position.distanceTo(camera.position) / 1e4;
  loop();
  // En pausa no se dibuja, pero se dejan listos los sombreadores para que la entrada no se trabe.
  if (paused) {
    placeCamera();
    renderer.compile(scene, camera);
  }

  return {
    focus,
    select,
    setActive: (on) => {
      if (on && !active) {
        view.dist = 2600;
        view.pitch = 42;
        timer.reset();
      }
      active = on;
    },
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
      uniforms.uShore.value.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}

export const MAP_TOWNS = placed.filter((p) => p.kind === 'town').map(({ id, name }) => ({ id, name }));
