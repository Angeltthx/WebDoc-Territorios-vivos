// Escena 3D del mapa de prueba: la costa de Nuquí vista desde un barco, a unos 250 m de altura.
// Todo se genera con código (relieve, mar, cielo, selva, fauna, casas y lanchas), sin imágenes ni modelos:
// cuando llegue el GLB del diseñador, se reemplaza `buildLand` y se conservan mar, cielo, cámara y marcadores.
//
// La cámara mira desde el mar hacia la costa, así que el norte (Jurubidá) queda a la izquierda
// y el sur (Coquí) a la derecha, como en el afiche. Ver `terrain.ts` para las coordenadas.

import {
  BackSide, BufferGeometry, Color, ConeGeometry, DataTexture, DirectionalLight, DodecahedronGeometry, Float32BufferAttribute,
  Fog, Group, HemisphereLight, Matrix4, IcosahedronGeometry, MathUtils, Mesh, LinearFilter, Object3D, UnsignedByteType,
  PerspectiveCamera, PlaneGeometry, Quaternion, Raycaster, RedFormat, SRGBColorSpace, Scene, ShaderMaterial,
  SphereGeometry, Timer, UniformsLib, UniformsUtils, Vector2, Vector3, Vector4, WebGLRenderer, type Texture, type WebGLProgramParametersWithUniforms,
} from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MapPlace } from '../../../content/map';
import { CHOCO_POINTS, SUBREGION_LABELS, categorize, type ChocoPoint } from '../../../content/choco';
import { EMBLEM_SIZE, figureChunks, storyChunks } from './emblems';
import { buildFauna, NATURE_LABEL_HEIGHT, VIEWER } from './fauna';
import { BALL, BLADE, Batch, type Pace, ROCK, clearKitCache, pacer, paint, part, sticker } from './kit';
import { buildFlora, buildMist, clearPlants } from './flora';
import { buildPlaces } from './places';
import { loadAnimals } from './animals';
import { ASCENT, DIVE, diveProgress, fovs, mapUnitsPerKm, type Handoff } from './dive';
import { DUSK_AT_NUQUI, DUSK_GLSL, REGION, posterTexture, regionCanvas } from './posterArt';
import {
  ARRIVAL, BOUNDS, FAR_GRID, FAR_SHORE_FIELD, GRID, HEIGHTS, RAIL, SHORE_FIELD, farVertex, nature, placeNear, placed, railAt, rng, SUN_DIR,
  farHeight, heightAt, shore, smoothstep, toScene, valueNoise, type PlacedPlace,
} from './terrain';
import { QUALITY, litMaterial, pixelRatioCap } from './quality';
import { step } from './diag';

const DIST = { min: 300, max: 1700, start: DIVE.mapDist };
const PITCH = { min: 5, max: 38, start: 10 };

// Atardecer: el sol bajo sobre el Pacífico, a espaldas de la cámara (que mira la costa de frente desde el mar), alumbra
// la costa con luz naranja. El cielo que se ve es el del lado contrario al sol: durazno en el horizonte, una franja
// rosada encima y azul violeta arriba. En el agua brilla el rayo de sol del final del recorrido (ver PATH_DIR).
const KEY_DIR = new Vector3(SUN_DIR.x, 0, SUN_DIR.z).normalize().setY(0.45).normalize();
/**
 * Rayo de sol en el agua: con el sol a espaldas, el mar no lo reflejaría hacia la cámara, así que el camino de luz se
 * pinta como si el sol estuviera delante, sobre la costa (licencia artística: el sol no se dibuja en el cielo). Su altura
 * deja el reflejo en el agua que se ve entre la cámara y la playa, un poco a la derecha del centro.
 */
const PATH_DIR = (() => {
  const toCoast = railAt(placed.find((p) => p.id === 'nuqui')!.s).sea.clone().negate().applyAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(-8));
  const elev = MathUtils.degToRad(13);
  return new Vector3(toCoast.x * Math.cos(elev), Math.sin(elev), toCoast.z * Math.cos(elev)).normalize();
})();
const HORIZON = new Color('#f7a46c');
const GLOW = new Color('#ffb14e');
const BELT = new Color('#f4a296');
const ZENITH = new Color('#7a73a8');
const HAZE = new Color('#eea27c');
const SUN_LIGHT = new Color('#ff9f5a');
const ARRIVAL_POS = toScene(ARRIVAL.lat, ARRIVAL.lon);

/** Neblina a ras del mar: lo lejano (la cordillera, la costa al norte y al sur) se pierde en el azul del horizonte. */
const FOG = { near: 2500, far: 30000 };
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

/**
 * Dibujo del afiche visto desde muy alto (el mismo del planeta). Al llegar desde el planeta, la tierra y el mar lo
 * muestran y lo van soltando mientras la cámara baja (`uRegionMix` de 1 a 0).
 */
interface RegionUniforms {
  uRegion: { value: Texture };
  uRegionBox: { value: Vector4 };
  uRegionMix: { value: number };
}

function regionUniforms(): RegionUniforms {
  const nw = toScene(REGION.latMax, REGION.lonMin);
  const se = toScene(REGION.latMin, REGION.lonMax);
  return {
    uRegion: { value: posterTexture(regionCanvas(), 2) },
    uRegionBox: { value: new Vector4(nw.x, nw.z, se.x - nw.x, se.z - nw.z) },
    uRegionMix: { value: 0 },
  };
}

const REGION_GLSL = `uniform sampler2D uRegion;
  uniform vec4 uRegionBox;
  uniform float uRegionMix;
  ${DUSK_GLSL}
  vec3 regionArt(vec3 w) {
    vec3 art = texture2D(uRegion, vec2((w.x - uRegionBox.x) / uRegionBox.z, 1.0 - (w.z - uRegionBox.y) / uRegionBox.w)).rgb;
    return dusk(art, ${DUSK_AT_NUQUI.toFixed(2)});
  }`;

/**
 * Material de la tierra: colores por vértice, el dibujo de hojas del afiche y, desde lo alto, el dibujo del planeta.
 * `hole` (x0, z0, x1, z1) deja un hueco donde ya está el relieve fino.
 */
function landMaterial(region: RegionUniforms, flatShading: boolean, hole?: Vector4) {
  const mat = litMaterial({ vertexColors: true, flatShading, roughness: 1 });
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, region, { uHole: { value: hole ?? new Vector4(0, 0, 0, 0) } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLand;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLand = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLand;\nuniform vec4 uHole;${LAND_GLSL}${REGION_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vLand.x > uHole.x && vLand.x < uHole.z && vLand.z > uHole.y && vLand.z < uHole.w) discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float jungle = smoothstep(0.004, 0.02, vColor.g - vColor.r * 1.3);
        diffuseColor.rgb = posterJungle(diffuseColor.rgb, vLand.xz, jungle);`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, regionArt(vLand), uRegionMix);`);
  };
  return mat;
}

/** Color de la selva según la altura (unidades de la escena), con algo de variación. */
function jungleColor(c: Color, h: number, x: number, z: number, top: number) {
  const t = MathUtils.clamp(h / top, 0, 1);
  if (t < 0.12) c.lerpColors(LAND_COLORS.low, LAND_COLORS.mid, t / 0.12);
  else if (t < 0.7) c.lerpColors(LAND_COLORS.mid, LAND_COLORS.high, (t - 0.12) / 0.58);
  else c.lerpColors(LAND_COLORS.high, LAND_COLORS.peak, (t - 0.7) / 0.3);
  return c.offsetHSL(0, 0, valueNoise(x * 0.01, z * 0.01) * 0.035);
}

/**
 * El mar es opaco: el fondo que queda del todo bajo el agua nunca se ve. Se sacan del índice los triángulos con los
 * tres vértices sumergidos (la mitad de la grilla es mar), así la tarjeta gráfica no los procesa.
 */
function dropSubmerged(geo: BufferGeometry, hole?: Vector4, below = -0.6) {
  const index = geo.index!;
  const p = geo.attributes.position;
  const inHole = (i: number) => !!hole && p.getX(i) > hole.x && p.getX(i) < hole.z && p.getZ(i) > hole.y && p.getZ(i) < hole.w;
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    // En el relieve de fondo, además, lo que cae entero dentro del hueco del relieve fino (ya lo tapa la otra malla).
    if (Math.max(p.getY(a), p.getY(b), p.getY(c)) > below && !(inHole(a) && inHole(b) && inHole(c))) kept.push(a, b, c);
  }
  geo.setIndex(kept);
}

async function buildLand(region: RegionUniforms, pace: Pace) {
  // La malla usa la misma grilla que `heightAt` (vértice i = fila * (nx + 1) + columna, de norte a sur). En equipos
  // modestos, uno de cada dos puntos (la cuarta parte de los triángulos; a la distancia de la cámara no se nota).
  const step = QUALITY.landStep;
  const cols = GRID.nx / step + 1;
  const geo = new PlaneGeometry(GRID.w, GRID.d, GRID.nx / step, GRID.nz / step);
  geo.rotateX(-Math.PI / 2);
  geo.translate(GRID.x0 + GRID.w / 2, 0, GRID.z0 + GRID.d / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    if ((i & 4095) === 0) await pace();
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = HEIGHTS[Math.floor(i / cols) * step * (GRID.nx + 1) + (i % cols) * step];
    pos.setY(i, h);
    const d = shore(x, z);
    if (h < 0.2) c.copy(LAND_COLORS.seabed);
    else if (d < 0) c.copy(LAND_COLORS.sand); // bajos de arena que asoman (alrededor de los pueblos)
    else if (h < 2.2 && d > 60) c.copy(LAND_COLORS.bank);
    else if (d < 34 + valueNoise(z * 0.02, 3) * 10 && h < 6) c.copy(LAND_COLORS.sand);
    else if (d < 70 && h > 8) c.lerpColors(LAND_COLORS.rock, LAND_COLORS.mid, smoothstep(d, 20, 70)); // acantilados de las puntas
    else jungleColor(c, h, x, z, 300);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  dropSubmerged(geo);
  return new Mesh(geo, landMaterial(region, true));
}

/**
 * El resto del Chocó, de fondo: la costa sigue al norte y al sur, y tierra adentro vienen el valle del Atrato y la
 * cordillera Occidental. Es una grilla gruesa (≈ 2,8 km) con un hueco donde está el relieve fino de la costa.
 */
async function buildFarLand(region: RegionUniforms, pace: Pace) {
  const { x0, z0, dx, dz, cols, rows } = FAR_GRID;
  const geo = new PlaneGeometry((cols - 1) * dx, (rows - 1) * dz, cols - 1, rows - 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(x0 + ((cols - 1) * dx) / 2, 0, z0 + ((rows - 1) * dz) / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    if ((i & 4095) === 0) await pace();
    const h = farVertex(i % cols, Math.floor(i / cols));
    pos.setY(i, h);
    if (h < 0) c.copy(LAND_COLORS.sand);
    else jungleColor(c, h, pos.getX(i), pos.getZ(i), 700);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = 150;
  const hole = new Vector4(BOUNDS.x0 + m, BOUNDS.z0 + m, BOUNDS.x1 - m, BOUNDS.z1 - m);
  dropSubmerged(geo, hole);
  return new Mesh(geo, landMaterial(region, false, hole));
}

/** Distancia a la orilla en una textura (un byte por celda): 0 = 100 unidades tierra adentro; 255 = 920 mar adentro. */
function shoreTexture({ data, cols, rows }: { data: Float32Array; cols: number; rows: number }) {
  const bytes = new Uint8Array(cols * rows);
  for (let i = 0; i < bytes.length; i++) bytes[i] = MathUtils.clamp(Math.round(((-data[i] + 100) / 1020) * 255), 0, 255);
  const tex = new DataTexture(bytes, cols, rows, RedFormat, UnsignedByteType);
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Mar: olas pequeñas que se mueven (dibujadas en el sombreador, no en la malla), reflejo del cielo según el ángulo,
 * el brillo del sol, agua turquesa junto a la orilla, espuma que llega a la playa y ríos en calma.
 */
function buildSea(region: RegionUniforms) {
  const near = SHORE_FIELD;
  const far = FAR_SHORE_FIELD;
  const uniforms = {
    ...UniformsUtils.clone(UniformsLib.fog),
    ...region,
    uTime: { value: 0 },
    uShore: { value: shoreTexture(near) },
    uOrigin: { value: new Vector2(near.x0, near.z0) },
    uSize: { value: new Vector2(near.cols * near.cell, near.rows * near.cell) },
    uShoreFar: { value: shoreTexture(far) },
    uOriginFar: { value: new Vector2(far.x0, far.z0) },
    uSizeFar: { value: new Vector2(far.cols * far.cell, far.rows * far.cell) },
    // Los últimos salpicones grandes (x, z, momento, tamaño), para que el mar reaccione donde cae la ballena.
    uSplash: { value: Array.from({ length: 4 }, () => new Vector4(0, 0, -100, 0)) },
    uSun: { value: SUN_DIR },
    uPath: { value: PATH_DIR },
    uHorizon: { value: HORIZON },
    uZenith: { value: ZENITH },
  };
  // Distancia mar adentro desde la orilla (negativa tierra adentro, es decir, en los ríos): fina junto a Nuquí y
  // gruesa en el resto de la costa.
  const coastGlsl = `uniform float uTime;
    uniform sampler2D uShore;
    uniform vec2 uOrigin;
    uniform vec2 uSize;
    uniform sampler2D uShoreFar;
    uniform vec2 uOriginFar;
    uniform vec2 uSizeFar;
    varying vec3 vSea;
    float seaOff(vec3 w) {
      vec2 uvF = (w.xz - uOriginFar) / uSizeFar;
      if (uvF.x < 0.0 || uvF.y < 0.0 || uvF.x > 1.0 || uvF.y > 1.0) return 920.0;
      float far = texture2D(uShoreFar, uvF).r * 1020.0 - 100.0;
      vec2 uv = (w.xz - uOrigin) / uSize;
      vec2 e = min(uv, 1.0 - uv);
      float inside = smoothstep(0.0, 0.03, min(e.x, e.y));
      if (inside <= 0.0) return far;
      return mix(far, texture2D(uShore, uv).r * 1020.0 - 100.0, inside);
    }`;
  const mat = new ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      varying vec3 vSea;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vSea = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      ${coastGlsl}${GLSL_COMMON}${REGION_GLSL}
      uniform vec4 uSplash[4];
      uniform vec3 uSun;
      uniform vec3 uPath;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;

      // Olas: un mar de fondo largo que avanza hacia la costa (+x) y, encima, capas de olas irregulares (ruido girado
      // y desplazado en direcciones distintas, para que no se forme una cuadrícula). Cada capa se apaga cuando es más
      // fina que un píxel, para que no titile. Devuelve la pendiente del agua (1 unidad = 9,1 m).
      vec3 noiseD(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        vec2 du = 6.0 * f * (1.0 - f);
        float a = hash2(i);
        float b = hash2(i + vec2(1.0, 0.0));
        float c = hash2(i + vec2(0.0, 1.0));
        float d = hash2(i + vec2(1.0, 1.0));
        float k = a - b - c + d;
        return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * vec2(b - a + k * u.y, c - a + k * u.x));
      }
      vec2 waveSlope(vec2 p, float t, float foot) {
        vec2 g = vec2(0.0);
        // Mar de fondo: tres ondas largas y suaves.
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float lambda = 44.0 - fi * 11.0;
          float ang = 0.15 + (fi - 1.0) * 0.35;
          vec2 d = vec2(cos(ang), sin(ang));
          float k = 6.2831 / lambda;
          float fade = 1.0 - smoothstep(0.15, 0.5, foot / lambda);
          g += d * 0.05 * cos(k * dot(d, p) - sqrt(9.8 * k / 9.1) * t + fi * 2.1) * fade;
        }
        // Olas de viento: capas de ruido, cada una más fina, girada y moviéndose a su ritmo.
        float scale = 14.0;
        float amp = 0.11;
        float ang = 0.4;
        // En equipos modestos, menos capas (las más finas casi no se ven desde lejos).
        for (int i = 0; i < ${QUALITY.waves}; i++) {
          mat2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
          vec2 dir = vec2(cos(ang * 1.7), sin(ang * 1.7));
          vec2 q = r * p / scale + dir * t * (1.4 / sqrt(scale));
          float fade = 1.0 - smoothstep(0.2, 0.7, foot / scale);
          g += (transpose(r) * noiseD(q).yz) * amp * fade;
          scale *= 0.55;
          amp *= 0.8;
          ang += 1.37;
        }
        float gust = 0.6 + 0.8 * vnoise(p * 0.0021 + vec2(t * 0.012, -t * 0.008));
        return g * gust;
      }

      void main() {
        float off = seaOff(vSea);
        float foot = length(fwidth(vSea.xz));
        // Más calma en los ríos y al fondo de las ensenadas.
        vec2 g = waveSlope(vSea.xz, uTime, foot) * mix(0.3, 1.0, smoothstep(-20.0, 200.0, off));
        // Donde cayó algo grande: tres frentes de ola que se abren en anillo (inclinan el agua y la blanquean) y una
        // mancha de espuma en el centro que se deshace despacio.
        float splashFoam = 0.0;
        for (int i = 0; i < 4; i++) {
          vec4 sp = uSplash[i];
          float age = uTime - sp.z;
          if (sp.w <= 0.0 || age < 0.0 || age > 10.0) continue;
          vec2 dv = vSea.xz - sp.xy;
          float d = length(dv);
          float R = sp.w;
          for (int j = 0; j < 3; j++) {
            float fj = float(j);
            float a = age - fj * 0.55;
            if (a < 0.0) continue;
            float w = R * 0.05 + a * 1.4;
            float x = (d - R * (0.25 + a * 0.42)) / w;
            float k = exp(-x * x) * exp(-a * 0.45) * (1.0 - fj * 0.25);
            g += (dv / max(d, 0.001)) * k * 0.5 * sin(x * 2.5);
            splashFoam += k * 0.8;
          }
          splashFoam += (1.0 - smoothstep(R * 0.12, R * (0.5 + age * 0.14), d)) * exp(-age * 0.38);
        }
        splashFoam = clamp(splashFoam, 0.0, 1.0) * (0.55 + 0.45 * vnoise(vSea.xz * 0.22 + uTime * 0.3));
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vSea);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        float sd = max(dot(R, uSun), 0.0);
        vec3 sky = mix(uHorizon, uZenith, pow(R.y, 0.5)) + vec3(1.0, 0.62, 0.3) * pow(sd, 12.0) * 0.3;

        // Color del agua: azul verdoso mar adentro, turquesa cerca de la orilla, claro sobre la arena, verdoso en los ríos.
        float nearShore = 1.0 - smoothstep(0.0, 500.0, off);
        vec3 body = mix(srgb(vec3(0.05, 0.34, 0.42)), srgb(vec3(0.035, 0.27, 0.36)), smoothstep(1500.0, 7000.0, off));
        body *= 0.88 + 0.24 * vnoise(vSea.xz * 0.0009 + 3.0);
        body = mix(body, srgb(vec3(0.12, 0.55, 0.56)), nearShore);
        body = mix(body, srgb(vec3(0.34, 0.72, 0.65)), 1.0 - smoothstep(0.0, 70.0, off));
        body = mix(body, srgb(vec3(0.19, 0.44, 0.38)), smoothstep(-8.0, -50.0, off));
        // La luz atraviesa las olas que dan al sol.
        body += srgb(vec3(0.10, 0.32, 0.28)) * max(dot(N.xz, uSun.xz), 0.0) * 0.6;
        // Luz de la tarde: el agua se entibia un poco.
        body *= vec3(1.0, 0.9, 0.84);

        vec3 col = mix(body, sky, fres);
        // Brillo del sol sobre las olas.
        col += vec3(1.0, 0.7, 0.4) * (pow(sd, 500.0) * 2.2 + pow(sd, 50.0) * 0.12);
        // Rayo de sol en el agua (ver PATH_DIR): cada ola que devuelve la luz hacia la cámara centellea, y juntas forman
        // un camino dorado sobre el mar. Suave y ancho alrededor, chispeante en el centro.
        // Solo en mar abierto: en los ríos y junto a la orilla el agua quieta haría de espejo y se quemaría a blanco.
        float pd = max(dot(R, uPath), 0.0) * smoothstep(15.0, 130.0, off);
        float sparkle = smoothstep(0.3, 0.75, vnoise(vSea.xz * 0.45 + vec2(uTime * 1.1, -uTime * 0.7)));
        col += vec3(1.0, 0.55, 0.25) * pow(pd, 14.0) * 0.38;
        col += vec3(1.0, 0.7, 0.36) * pow(pd, 70.0) * 1.05;
        col += vec3(1.0, 0.84, 0.58) * pow(pd, 320.0) * (1.4 + 4.0 * sparkle);

        // Espuma: la orilla y las olas que llegan a la playa.
        float n = vnoise(vSea.xz * 0.11 + vec2(uTime * 0.06, 0.0));
        float swash = sin(off * 0.11 + uTime * 1.25 + n * 3.0);
        float band = smoothstep(0.82, 0.98, swash) * (1.0 - smoothstep(8.0, 75.0, off));
        float edge = 1.0 - smoothstep(0.0, 7.0 + n * 7.0, off);
        float foam = max(band * 0.75, edge) * smoothstep(-6.0, 0.0, off);
        foam *= 0.55 + 0.45 * smoothstep(0.3, 0.7, vnoise(vSea.xz * 0.35 - uTime * 0.1));
        foam *= 1.0 - smoothstep(4.0, 16.0, foot);
        col = mix(col, srgb(vec3(1.0, 0.9, 0.82)), foam * 0.9);
        col = mix(col, srgb(vec3(1.0, 0.92, 0.85)), splashFoam * 0.92);

        // Desde muy alto: el dibujo del planeta.
        col = mix(col, regionArt(vSea), uRegionMix);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  // Un solo plano enorme: el mar llega hasta el horizonte (y hasta los bordes de la vista desde lo alto).
  const geo = new PlaneGeometry(500000, 500000, 4, 4);
  geo.rotateX(-Math.PI / 2);
  const sea = new Mesh(geo, mat);
  sea.position.set(ARRIVAL_POS.x, 0, ARRIVAL_POS.z);
  return { sea, uniforms };
}

/**
 * Cielo de atardecer: hacia el sol, el horizonte arde en naranja; del lado contrario es durazno, con la franja rosada
 * que queda encima del horizonte al ponerse el sol, y arriba azul violeta. Sigue a la cámara, así nunca se ve su borde.
 */
function buildSky() {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSun: { value: SUN_DIR },
      uHorizon: { value: HORIZON },
      uGlow: { value: GLOW },
      uBelt: { value: BELT },
      uZenith: { value: ZENITH },
    },
    vertexShader: `varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform vec3 uSun; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uBelt; uniform vec3 uZenith;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        float toward = dot(normalize(d.xz + 1e-5), normalize(uSun.xz)) * 0.5 + 0.5;
        vec3 horizon = mix(uHorizon, uGlow, pow(toward, 3.0));
        vec3 col = mix(horizon, uZenith, pow(h, 0.45));
        col = mix(col, uBelt, exp(-pow((h - 0.13) / 0.09, 2.0)) * (1.0 - toward) * 0.3);
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.55, 0.22) * (pow(s, 8.0) * 0.4 + pow(s, 60.0) * 0.35);
        col += vec3(1.0, 0.72, 0.38) * pow(s, 700.0) * 0.9;
        // Disco: blanco amarillento al centro y naranja hacia el borde.
        float disc = smoothstep(0.99935, 0.99945, s);
        col = mix(col, mix(vec3(1.0, 0.62, 0.25), vec3(1.0, 0.95, 0.78), smoothstep(0.99945, 0.99985, s)), disc);
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
  const clouds: Group[] = [];
  const mat = litMaterial({ color: '#ffe2cc', emissive: '#f0957c', emissiveIntensity: 0.5, flatShading: true, roughness: 1, transparent: true });
  const geo = new IcosahedronGeometry(1, 1);
  for (let i = 0; i < Math.max(2, Math.round(10 * QUALITY.clouds)); i++) {
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
    clouds.push(cloud);
  }
  // Todas las bocanadas en una sola llamada de dibujo.
  const batch = new Batch(clouds);
  const group = batch.group;
  let frame = 0;
  const update = (t: number) => {
    for (const c of clouds) c.position.z = c.userData.z + Math.sin(t * 0.01 + c.userData.z) * 300;
    // Se mueven unas pocas unidades por segundo: basta actualizarlas uno de cada tres cuadros.
    if (group.visible && frame++ % 3 === 0) batch.sync();
  };
  /** Se desvanecen cuando la cámara está muy alta (al llegar desde el planeta). */
  const setOpacity = (o: number) => {
    mat.opacity = o;
    group.visible = o > 0.01;
  };
  return { group, update, setOpacity };
}

/** Morros: islotes de roca con copete verde frente a la costa. */
function buildRocks(rand: () => number) {
  const group = new Group();
  const rockMat = litMaterial({ color: '#7c8a80', flatShading: true, roughness: 1 });
  const topMat = litMaterial({ color: '#4f9a52', flatShading: true });
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
  /** Sigue el viaje que empezó el planeta: baja desde la vista cenital y se inclina hasta la vista desde el mar. */
  land: (handoff: Handoff, onLanded: () => void) => void;
  /** Sube hasta la altura de la posta (camino inverso a `land`) y avisa para que el planeta siga desde ahí. */
  ascend: (onHandoff: () => void) => void;
  /** Pausa o reanuda la escena. */
  setActive: (active: boolean) => void;
  dispose: () => void;
}

export interface MapSceneOptions {
  onSelect: (place: MapPlace | null) => void;
  onInteract: () => void;
  /** Empieza en pausa (detrás del planeta de la entrada). */
  paused?: boolean;
  /** El visitante se alejó mucho más allá del máximo: quiere volver al planeta. */
  onZoomOut?: () => void;
  /** Cuánto se ha estirado el alejamiento más allá del máximo (0–1), para avisarle que siga si quiere ir al planeta. */
  onPull?: (amount: number) => void;
  /** El navegador quitó el 3D (por ejemplo, el equipo se quedó sin memoria). */
  onLost?: () => void;
  /** Se eligió (o se soltó) uno de los puntos del resto del Chocó. */
  onSpot?: (point: ChocoPoint | null) => void;
}

/** Cede el turno a la página entre las etapas pesadas: en un teléfono modesto, armar todo de corrido la congela. */
const breathe = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Arma la costa por etapas (cediendo el turno entre una y otra, así el planeta de la entrada sigue respondiendo) y
 * compila sus sombreadores sin congelar la página. Se resuelve cuando ya se puede llegar a ella.
 */
export async function createMapScene(host: HTMLElement, { onSelect, onInteract, paused = false, onZoomOut, onPull, onLost, onSpot }: MapSceneOptions): Promise<MapSceneHandle> {
  const renderer = new WebGLRenderer({ antialias: QUALITY.antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatioCap());
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    step('SE CAYÓ: costa');
    onLost?.();
  });

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'map-labels';
  host.appendChild(labels.domElement);

  const scene = new Scene();
  // Solo en desarrollo: para medir el rendimiento desde la consola.
  const fog = new Fog(HAZE, FOG.near, FOG.far);
  scene.fog = fog;
  const camera = new PerspectiveCamera(52, 1, 5, 60000);
  if (import.meta.env.DEV) Object.assign(window, { __map: { renderer, scene, camera } });

  const rand = rng(20261008);
  const sky = buildSky();
  const region = regionUniforms();
  const { sea, uniforms } = buildSea(region);
  const clouds = buildClouds(rand);
  const mist = buildMist(rand);
  // Cada etapa cede el turno a la página a menudo (ver `pacer`).
  const pace = pacer();
  await pace();
  step('costa: lugares');
  const places = await buildPlaces(rand, pace);
  // Cuando la ballena rompe el agua, el mar lo registra (ver `uSplash`).
  let splashSlot = 0;
  step('costa: fauna');
  const fauna = await buildFauna(rand, pace, (x, z, size, strength) => {
    uniforms.uSplash.value[splashSlot++ % 4].set(x, z, uniforms.uTime.value, size * (0.55 + 0.45 * strength));
  });
  await pace();
  const rocks = buildRocks(rand);
  step('costa: selva');
  const flora = await buildFlora(rand, pace);
  step('costa: relieve');
  const land = await buildLand(region, pace);
  await breathe();
  step('costa: relieve de fondo');
  const farLand = await buildFarLand(region, pace);
  // Ya se armó todo lo que repite piezas: se suelta lo memorizado (ver kit.ts).
  clearKitCache();
  await breathe();
  scene.add(sky, sea, land, farLand, rocks, flora, clouds.group, mist.group, places.group, fauna.group);
  // Lo que nunca se mueve se ubica una vez y three.js deja de recorrerlo en cada cuadro.
  for (const still of [sea, land, farLand, rocks, flora]) {
    still.updateMatrixWorld(true);
    still.matrixAutoUpdate = false;
    still.matrixWorldAutoUpdate = false;
  }
  /** Lo que solo se ve de cerca: desde muy alto se esconde (no se alcanza a ver y ensuciaría el dibujo del planeta). */
  const details = [rocks, flora, places.group, fauna.group];

  // Luz de la tarde: el sol naranja de frente sobre la costa y, en las caras que no le dan, el cielo rosado y violeta.
  scene.add(new HemisphereLight('#ffcfa8', '#55405a', 1.8));
  const key = new DirectionalLight(SUN_LIGHT, 2.9);
  key.position.copy(KEY_DIR).multiplyScalar(1000);
  scene.add(key);

  // Marcadores: alfiler rosado para los sitios, rótulo blanco para los pueblos.
  const pinMat = litMaterial({ color: '#e2456f', emissive: '#7a1630', emissiveIntensity: 0.35, roughness: 0.5 });
  const pinTip = new ConeGeometry(3.6, 10, 12);
  pinTip.rotateX(Math.PI);
  pinTip.translate(0, -6.6, 0);
  // Cabeza y punta en una sola pieza: un dibujo por alfiler (y otro para su borde).
  const pinGeo = mergeGeometries([new SphereGeometry(5.5, 16, 12), pinTip])!;
  const pins: { place: PlacedPlace; pin: Group; label: CSS2DObject; el: HTMLButtonElement }[] = [];
  // Todos los marcadores en un grupo: el renderizador de rótulos recorre solo este grupo, no la escena entera.
  const pinGroup = new Group();
  scene.add(pinGroup);
  /** Altura del alfiler: encima de lo que haya construido en el sitio. */
  const pinBase = (place: PlacedPlace) => place.pos.y + (places.heights.get(place.id) ?? 10) + 16;

  // La fauna no lleva rótulo: se toca el animal mismo (ver `pick`) y la cámara lo sigue.
  for (const place of placed) {
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
      pin.add(new Mesh(pinGeo, pinMat));
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
    pinGroup.add(pin);
    pins.push({ place, pin, label, el });
  }

  // ───────── El resto del Chocó ─────────
  // Puntos en su lugar real (la costa al norte y al sur, y detrás de la serranía el Atrato y el San Juan), cada uno con
  // su figurita 3D (casitas, árboles, palma…). Solo aparecen al alejarse (de cerca, la costa es la protagonista); el
  // nombre sale al pasar el mouse y, al tocarlos, la cámara viaja hasta allá. Las historias que manden las personas
  // usarán el mismo camino: latitud y longitud → lugar en la escena (ver `addSpot`).
  const spots: { point: ChocoPoint; el: HTMLButtonElement; at: Vector3; behind?: boolean }[] = [];
  // La malla fina (con su vegetación) llega un poco más allá del relieve medido, hacia el este.
  const inFine = (x: number, z: number) => x > GRID.x0 && x < GRID.x0 + GRID.w && z > GRID.z0 && z < GRID.z0 + GRID.d;
  /** Altura del suelo en cualquier punto del Chocó (relieve fino cerca de Nuquí; el de fondo en el resto). */
  const groundAt = (x: number, z: number) => Math.max(inFine(x, z) ? heightAt(x, z) : farHeight(x, z), 0);
  let openSpot: string | null = null;
  function selectSpot(id: string | null) {
    if (selected) {
      selected = null;
      for (const p of pins) p.el.classList.remove('is-selected');
      onSelect(null);
    }
    openSpot = id;
    for (const s of spots) s.el.classList.toggle('is-open', s.point.id === id);
    const spot = spots.find((s) => s.point.id === id);
    if (spot) visit(spot.at.clone().setY(spot.at.y - EMBLEM_SIZE * 0.4), spot.point.figure?.main === 'montana' ? 1300 : 900);
    else if (tour) leaveTour();
    onSpot?.(spot?.point ?? null);
  }
  const emblemParts: BufferGeometry[] = [];
  /** El punto de tierra más empinado cerca de (x, z), con la dirección cuesta abajo (dx, dz, unitaria). */
  const steepest = (x: number, z: number, max: number) => {
    let best = { x, z, dx: 0, dz: 1, slope: -1 };
    const e = 25;
    for (let r = 0; r <= max; r += 40) {
      for (let k = 0; k < (r ? 16 : 1); k++) {
        const a = (k / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (isSea(px, pz)) continue;
        const gx = groundAt(px + e, pz) - groundAt(px - e, pz);
        const gz = groundAt(px, pz + e) - groundAt(px, pz - e);
        const slope = Math.hypot(gx, gz) - r * 0.0004;
        if (slope > best.slope && slope > 0.01) best = { x: px, z: pz, dx: -gx / Math.hypot(gx, gz), dz: -gz / Math.hypot(gx, gz), slope };
      }
    }
    return best;
  };
  /**
   * Una cascada pegada a la ladera: desde la pendiente más empinada cerca del lugar se sube por la loma (siguiendo la
   * pendiente) y se baja hasta donde se calma; por ese camino corre una cinta de agua que copia la forma del terreno,
   * blanca donde la caída es fuerte y azul donde el agua se calma, y al pie, un pozo con su borde de espuma. Así no es un
   * objeto encima del paisaje: es parte de él.
   */
  const buildFall = (x0: number, z0: number) => {
    const start = steepest(x0, z0, 260);
    if (start.slope < 0.25) return null;
    const step = 18;
    const grad = (x: number, z: number) => {
      const e = 12;
      const gx = groundAt(x + e, z) - groundAt(x - e, z);
      const gz = groundAt(x, z + e) - groundAt(x, z - e);
      const l = Math.hypot(gx, gz) || 1;
      return { x: gx / l, z: gz / l, steep: Math.hypot(gx, gz) / (2 * e) };
    };
    // Camino: subir por la loma desde el punto más empinado y bajar hasta que se aplana.
    const up: [number, number][] = [];
    let p: [number, number] = [start.x, start.z];
    for (let k = 0; k < 9; k++) {
      const g = grad(p[0], p[1]);
      if (g.steep < 0.1) break;
      p = [p[0] + g.x * step, p[1] + g.z * step];
      up.push(p);
    }
    const down: [number, number][] = [];
    p = [start.x, start.z];
    for (let k = 0; k < 8; k++) {
      const g = grad(p[0], p[1]);
      p = [p[0] - g.x * step, p[1] - g.z * step];
      if (isSea(p[0], p[1])) break;
      down.push(p);
      if (g.steep < 0.12) break;
    }
    const path = [...up.reverse(), [start.x, start.z] as [number, number], ...down];
    if (path.length < 3) return null;
    const pos: number[] = [];
    const col: number[] = [];
    const white = new Color('#f4fcff');
    const light = new Color('#b8ecfb');
    const blue = new Color('#5cc6e6');
    const tri = (a: Vector3, b: Vector3, c: Vector3, ca: Color, cb: Color, cc: Color) => {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    };
    // Tres hilos por tramo (orilla, centro, orilla): el centro más claro; más ancha abajo.
    const rows = path.map(([x, z], k) => {
      const [nx, nz] = path[Math.min(k + 1, path.length - 1)];
      const [px, pz] = path[Math.max(k - 1, 0)];
      const dx = nx - px;
      const dz = nz - pz;
      const l = Math.hypot(dx, dz) || 1;
      const w = 10 + (k / path.length) * 12;
      const sx = (-dz / l) * w;
      const sz = (dx / l) * w;
      // Un poco sobre el terreno (la malla de fondo es más gruesa que la altura medida: que no quede por debajo).
      const at = (f: number) => new Vector3(x + sx * f, groundAt(x + sx * f, z + sz * f) + (inFine(x, z) ? 2 : 6), z + sz * f);
      const fall = grad(x, z).steep;
      const c = fall > 0.6 ? white : fall > 0.3 ? light : blue;
      return { l: at(-1), m: at(0), r: at(1), c, edge: fall > 0.6 ? light : blue };
    });
    for (let k = 0; k < rows.length - 1; k++) {
      const a = rows[k];
      const b = rows[k + 1];
      // (en este orden miran hacia arriba)
      tri(a.l, a.m, b.l, a.edge, a.c, b.edge);
      tri(a.m, b.m, b.l, a.c, b.c, b.edge);
      tri(a.m, a.r, b.m, a.c, a.edge, b.c);
      tri(a.r, b.r, b.m, a.edge, b.edge, b.c);
    }
    // El pozo al pie: agua quieta a la altura más baja de su borde, con piedras alrededor.
    const [fx, fz] = path[path.length - 1];
    const R = 20;
    let low = Infinity;
    for (let k = 0; k < 12; k++) low = Math.min(low, groundAt(fx + Math.cos((k / 12) * Math.PI * 2) * R, fz + Math.sin((k / 12) * Math.PI * 2) * R));
    const py = Math.max(low, groundAt(fx, fz) - 3) + 1.4;
    const center = new Vector3(fx, py, fz);
    for (let k = 0; k < 14; k++) {
      const a0 = (k / 14) * Math.PI * 2;
      const a1 = ((k + 1) / 14) * Math.PI * 2;
      const r0 = R * (0.85 + 0.15 * Math.sin(k * 2.3));
      const r1 = R * (0.85 + 0.15 * Math.sin((k + 1) * 2.3));
      tri(center, new Vector3(fx + Math.cos(a1) * r1, py, fz + Math.sin(a1) * r1), new Vector3(fx + Math.cos(a0) * r0, py, fz + Math.sin(a0) * r0), blue, blue, blue);
    }
    // Piedras, espuma y helechos: en el borde del pozo, en las orillas de la caída y a los lados.
    const extras: BufferGeometry[] = [];
    const rock = (x: number, z: number, r: number, c: string) =>
      extras.push(part(ROCK, c, { p: [x, groundAt(x, z) + r * 0.25, z], s: [r, r * 0.8, r], r: [0, x * 0.1, 0] }));
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.3;
      rock(fx + Math.cos(a) * (R + 2), fz + Math.sin(a) * (R + 2), 3.5 + (k % 3) * 1.5, k % 2 ? '#7c8a80' : '#6f7d73');
    }
    rows.forEach((r, k) => {
      if (k % 2) return;
      rock(r.l.x, r.l.z, 3 + (k % 3), '#7c8a80');
      rock(r.r.x, r.r.z, 2.5 + ((k + 1) % 3), '#869488');
      for (const side of [r.l, r.r]) {
        const out = side.clone().sub(r.m).setY(0).normalize().multiplyScalar(9).add(side);
        for (const a of [0, 1.6, 3.2, 4.8]) extras.push(part(BLADE, k % 4 ? '#3d7f4c' : '#2f6b45', { p: [out.x, groundAt(out.x, out.z) + 0.6, out.z], r: [-0.45, a + k, 0], s: [1.6, 0.2, 6], o: 'YXZ' }));
      }
      // Espuma donde cae fuerte.
      if (r.c === white) extras.push(part(BALL, '#ffffff', { p: [r.m.x, r.m.y + 0.6, r.m.z], s: [5, 1.2, 4] }));
    });
    extras.push(part(BALL, '#ffffff', { p: [fx, py + 0.5, fz], s: [8, 1.4, 6] }));
    if (inFine(fx, fz)) {
      clearPlants(flora, fx, fz, R + 10);
      for (const r of rows) clearPlants(flora, r.m.x, r.m.z, 14);
    }
    // Que todos los triángulos miren hacia arriba (el material solo dibuja la cara de adelante).
    for (let i = 0; i < pos.length; i += 9) {
      const ux = pos[i + 3] - pos[i], uz = pos[i + 5] - pos[i + 2];
      const vx = pos[i + 6] - pos[i], vz = pos[i + 8] - pos[i + 2];
      if (uz * vx - ux * vz < 0) {
        for (const k of [0, 1, 2]) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
        for (const k of [0, 1, 2]) [col[i + 3 + k], col[i + 6 + k]] = [col[i + 6 + k], col[i + 3 + k]];
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return mergeGeometries([geo, ...extras])!;
  };
  /** ¿Es mar? (el relieve sin recortar en cero: negativo en el agua). */
  const isSea = (x: number, z: number) => (inFine(x, z) ? heightAt(x, z) : farHeight(x, z)) < 0;
  /** El punto de mar más cercano a (x, z), hasta `max` unidades; un poco mar adentro para que no toque la orilla. */
  const nearestSea = (x: number, z: number, max: number): [number, number] | null => {
    if (isSea(x, z) && isSea(x + 40, z) && isSea(x - 40, z)) return [x, z];
    for (let r = 60; r <= max; r += 60) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (isSea(px, pz) && isSea(px + Math.cos(a) * 50, pz + Math.sin(a) * 50)) return [px + Math.cos(a) * 30, pz + Math.sin(a) * 30];
      }
    }
    return null;
  };
  function addSpot(point: ChocoPoint, kind: string = point.kind) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `map-spot map-spot--${kind}`;
    el.setAttribute('aria-label', point.name);
    const name = document.createElement('span');
    name.className = 'map-spot__name';
    name.textContent = point.name;
    el.append(name);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', () => selectSpot(openSpot === point.id ? null : point.id));
    const label = new CSS2DObject(el);
    const at = toScene(point.lat, point.lon);
    // El relieve de fondo es grueso (≈ 2,8 km): una punta o un pueblo de la orilla pueden caer en el agua. Se corren a
    // la tierra más cercana (como mucho 2,5 km).
    if (isSea(at.x, at.z)) {
      search: for (let r = 40; r <= 2500; r += 40) {
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          const x = at.x + Math.cos(a) * r;
          const z = at.z + Math.sin(a) * r;
          if (!isSea(x, z) && !isSea(x + Math.cos(a) * 60, z + Math.sin(a) * 60)) {
            at.set(x + Math.cos(a) * 40, 0, z + Math.sin(a) * 40);
            break search;
          }
        }
      }
    }
    // Cada pieza de la figurita (una casa, una palma, una roca, la lancha) se apoya por separado en el terreno real.
    // El frente de la figurita (+z) mira al oeste, al mar: (x, z) local → (−z, x) en la escena.
    const chunks = point.story ? storyChunks(point.story) : figureChunks(point.figure ?? { main: 'cabecera' }, [...point.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261));
    let top = groundAt(at.x, at.z);
    for (const c of chunks) {
      let x = at.x - c.z;
      let z = at.z + c.x;
      let y: number;
      if (c.on === 'air') y = groundAt(at.x, at.z);
      else {
        const water = c.on === 'ground' ? null : nearestSea(x, z, c.on === 'sea' ? 3000 : 700);
        if (water) {
          [x, z] = water;
          y = -0.5;
        } else if (c.on === 'sea') continue; // sin mar cerca: sin lancha ni ballena
        else y = groundAt(x, z) - 1;
        top = Math.max(top, y);
        // En la selva de la costa, un claro para que los árboles no la tapen.
        if (inFine(x, z) && c.r > 0) clearPlants(flora, x, z, c.r * 1.4 + 12);
      }
      const g = c.geo.clone();
      g.rotateY(-Math.PI / 2);
      g.translate(x, y, z);
      emblemParts.push(g);
    }
    // La cascada (en pocos lugares): no es una pieza, es agua sobre la ladera misma.
    if (point.figure?.extra?.includes('cascada')) {
      const fall = buildFall(at.x, at.z);
      if (fall) emblemParts.push(fall);
    }
    // El punto flota sobre su figurita.
    label.position.set(at.x, top + EMBLEM_SIZE + 22, at.z);
    pinGroup.add(label);
    spots.push({ point, el, at: label.position });
  }
  for (const point of CHOCO_POINTS) addSpot(point);
  // Prueba: ?punto=lat,lon,Nombre pone una historia de ejemplo en el mapa (así llegarán las aprobadas).
  const test = new URLSearchParams(location.search).get('punto')?.split(',');
  if (test && test.length >= 2 && test.slice(0, 2).every((v) => Number.isFinite(+v))) {
    const name = test.slice(2).join(',').trim() || 'Historia de prueba';
    // Se clasifica sola por lo que dice (aquí, por su nombre): ver `categorize`.
    const story = categorize(name);
    addSpot({ id: 'historia-prueba', name, kind: 'corregimiento', lat: +test[0], lon: +test[1], subregion: 'Pacífico Norte', story }, 'historia');
  }
  // Todas las figuritas en una sola malla: un solo dibujo. Aparecen (y se desvanecen) junto con los puntos.
  const emblemMat = paint.clone();
  emblemMat.transparent = true;
  const emblems = new Mesh(mergeGeometries(emblemParts)!, emblemMat);
  emblems.matrixAutoUpdate = false;
  emblems.visible = false;
  scene.add(emblems);
  /** Los que quedan detrás de la serranía (vistos desde la cámara) se atenúan: así se leen en segundo plano. */
  const ray = new Vector3();
  const updateBehind = () => {
    for (const s of spots) {
      let behind = false;
      for (let k = 1; k < 28 && !behind; k++) {
        ray.lerpVectors(camera.position, s.at, k / 28);
        behind = groundAt(ray.x, ray.z) > ray.y + 4;
      }
      if (behind !== s.behind) s.el.classList.toggle('is-behind', (s.behind = behind));
    }
  };
  // Las cinco subregiones: su nombre, tenue, sobre su territorio (solo con la cámara lejos, para no estorbar de cerca).
  const regionEls: HTMLElement[] = [];
  for (const r of SUBREGION_LABELS) {
    const el = document.createElement('div');
    el.className = 'map-region';
    el.textContent = r.name;
    regionEls.push(el);
    const label = new CSS2DObject(el);
    const at = toScene(r.lat, r.lon);
    label.position.set(at.x, groundAt(at.x, at.z) + 400, at.z);
    pinGroup.add(label);
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
    look.copy(target);
    sky.position.copy(camera.position);
  };

  // ───────── Viaje a un punto del Chocó ─────────
  // Al tocar un punto, la cámara deja la costa y vuela hasta él (subiendo un poco en el camino); allá se queda quieta y
  // se mueve a mano. Al cerrar la ficha (o con Escape) vuelve por el mismo aire a la costa, donde estaba.
  /** La visita: el punto que se mira y desde dónde. Con `follow`, la cámara acompaña a ese animal mientras se mueve. */
  let tour: { at: Vector3; yaw: number; pitch: number; dist: number; follow?: Object3D; lift: number } | null = null;
  let flight: { start: number; pos: Vector3; look: Vector3; back: boolean } | null = null;
  const FLIGHT = 2.4;
  const look = new Vector3();
  const tourPos = new Vector3();
  const tourLook = new Vector3();
  function visit(at: Vector3, dist = 900, follow?: Object3D, lift = 0) {
    const yaw = Math.atan2(camera.position.x - at.x, camera.position.z - at.z);
    tour = { at: at.clone(), yaw, pitch: dist < 600 ? 20 : 24, dist, follow, lift };
    flight = { start: performance.now(), pos: camera.position.clone(), look: look.clone(), back: false };
  }
  const TOUR_DIST = { min: 140, max: 2600 };
  const followAt = new Vector3();
  /** Acerca o aleja la visita; si ya estaba en el máximo y sigue alejándose, vuelve a la costa. */
  function zoomTour(factor: number) {
    if (!tour) return;
    if (factor > 1 && tour.dist >= TOUR_DIST.max * 0.99) return selectSpot(null);
    tour.dist = MathUtils.clamp(tour.dist * factor, TOUR_DIST.min, TOUR_DIST.max);
  }
  function leaveTour() {
    flight = { start: performance.now(), pos: camera.position.clone(), look: look.clone(), back: true };
  }
  const posePoint = () => {
    const t = tour!;
    const p = MathUtils.degToRad(t.pitch);
    tourLook.copy(t.at);
    tourPos.set(Math.sin(t.yaw) * Math.cos(p), Math.sin(p), Math.cos(t.yaw) * Math.cos(p)).multiplyScalar(t.dist).add(t.at);
  };
  /** Después de `placeCamera` (que deja la cámara en la costa): si hay viaje, la lleva al punto o de vuelta. */
  const applyTour = (dt: number) => {
    if (!tour) return;
    // Siguiendo a un animal: el centro de la visita va tras él, suave. Si su figura se cambió por el modelo animado
    // (ya no está en la escena), se queda donde estaba.
    if (tour.follow) {
      let root: Object3D = tour.follow;
      while (root.parent) root = root.parent;
      if (root !== scene) tour.follow = undefined;
      else {
        tour.follow.getWorldPosition(followAt);
        followAt.y = Math.max(followAt.y, 0) + tour.lift;
        tour.at.lerp(followAt, Math.min(1, dt * 3));
      }
    }
    posePoint();
    if (flight) {
      const u = Math.min(1, (performance.now() - flight.start) / 1000 / FLIGHT);
      const e = MathUtils.smootherstep(u, 0, 1);
      const [toPos, toLook] = flight.back ? [camera.position.clone(), look.clone()] : [tourPos, tourLook];
      const span = flight.pos.distanceTo(toPos);
      camera.position.lerpVectors(flight.pos, toPos, e);
      camera.position.y += Math.sin(Math.PI * e) * MathUtils.clamp(span * 0.18, 200, 2500);
      look.lerpVectors(flight.look, toLook, e);
      if (u >= 1) {
        if (flight.back) tour = null;
        flight = null;
      }
    } else {
      camera.position.copy(tourPos);
      look.copy(tourLook);
    }
    camera.lookAt(look);
    sky.position.copy(camera.position);
  };

  const clampGoal = () => {
    goal.s = MathUtils.clamp(goal.s, RAIL.min, RAIL.max);
    // Al seguir alejándose en el máximo, la vista cede un poco (como un elástico) antes de volver al planeta.
    goal.dist = MathUtils.clamp(goal.dist, DIST.min, DIST.max * (1 + 0.35 * pull));
    goal.pitch = MathUtils.clamp(goal.pitch, PITCH.min, PITCH.max);
  };

  // ───────── Interacción ─────────
  /** Alejamiento acumulado más allá del máximo (0–1); al llegar a 1 se vuelve al planeta. */
  let pull = 0;
  let pullAt = 0;
  const pullOut = (amount: number) => {
    pull = Math.min(1, pull + amount);
    pullAt = performance.now();
    if (pull >= 1) onZoomOut?.();
  };
  const atMax = () => goal.dist >= DIST.max * 0.98;
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number; t: number } | null = null;
  let pinchStart = 0;
  let pinchDist = 0;
  let lastPinch = 0;
  const canvas = renderer.domElement;

  const worldPerPixel = () => (2 * view.dist * Math.tan(MathUtils.degToRad(camera.fov / 2))) / Math.max(host.clientHeight, 1);

  const onDown = (e: PointerEvent) => {
    if (intro || outro) return;
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
      if (pinchStart > 0 && tour) {
        // En una visita: pellizcar acerca o aleja el punto (y al límite, vuelve a la costa).
        if (!flight) zoomTour(pinchStart / d / (lastPinch || 1));
        lastPinch = pinchStart / d;
      } else if (pinchStart > 0) {
        goal.dist = pinchDist * (pinchStart / d);
        // Pellizcar hacia adentro más allá del máximo también lleva al planeta.
        if (goal.dist > DIST.max) {
          pull = Math.min(1, (goal.dist / DIST.max - 1) / 0.7);
          pullAt = performance.now();
          if (pull >= 1) onZoomOut?.();
        }
      }
    } else if (tour) {
      // En un punto: arrastrar gira alrededor de él.
      if (!flight) {
        tour.yaw -= dx * 0.006;
        tour.pitch = MathUtils.clamp(tour.pitch + dy * 0.12, 8, 60);
      }
      return;
    } else {
      // Arrastrar a los lados recorre la costa; arriba y abajo cambia la inclinación de la mirada.
      goal.s -= dx * worldPerPixel() * 1.15;
      goal.pitch += dy * 0.12;
    }
    clampGoal();
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      pinchStart = 0;
      lastPinch = 0;
    }
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && performance.now() - downAt.t < 500) pick(e);
    downAt = null;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (intro || outro) return;
    if (tour) {
      // Alejarse hasta el límite cierra la visita y vuelve a la costa.
      if (!flight) zoomTour(Math.exp(e.deltaY * (e.ctrlKey ? 0.006 : 0.0012)));
      return;
    }
    // Con el panel táctil (pellizco = rueda con Ctrl) llegan pasos pequeños: cuentan más.
    if (e.deltaY > 0 && atMax()) pullOut(e.deltaY / (e.ctrlKey ? 250 : 1000));
    else if (e.deltaY < 0) pull = 0;
    goal.dist *= Math.exp(e.deltaY * (e.ctrlKey ? 0.006 : 0.0012));
    clampGoal();
    onInteract();
  };
  const onKey = (e: KeyboardEvent) => {
    if (intro || outro || !active) return;
    if (e.key === 'ArrowDown' && atMax()) pullOut(0.34);
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
  const probe = new Vector3();
  /** El animal (una de sus piezas) más cercano en pantalla al punto tocado, si está a menos de 40 px. */
  const nearestAnimal = (px: number, py: number, w: number, h: number) => {
    let best: { id: string; mesh: Object3D; d: number } | null = null;
    for (const species of fauna.group.children) {
      const id = species.userData.natureId as string | undefined;
      if (!id) continue;
      species.traverseVisible((m) => {
        if (!(m as Mesh).isMesh) return;
        m.getWorldPosition(probe).project(camera);
        if (probe.z > 1) return;
        const d = Math.hypot(((probe.x + 1) / 2) * w - px, ((1 - probe.y) / 2) * h - py);
        if (d < 40 && (!best || d < best.d)) best = { id, mesh: m, d };
      });
    }
    return best as { id: string; mesh: Object3D; d: number } | null;
  };
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    // Los alfileres de los sitios y los animales (y el cacao y el manglar): el que esté más cerca de la cámara.
    const targets = [...pins.filter((p) => p.place.kind === 'site').map((p) => p.pin), ...fauna.group.children.filter((c) => c.userData.natureId)];
    const hit = raycaster.intersectObjects(targets, true)[0];
    let o: Object3D | null = hit?.object ?? null;
    while (o && !o.userData.id && !o.userData.natureId) o = o.parent;
    if (o?.userData.natureId) return select(o.userData.natureId as string, hit!.object);
    if (o) return select(o.userData.id as string);
    // Los animales son chicos y se mueven: tocar cerca (a unos 40 px) también vale.
    const near = nearestAnimal(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (near) return select(near.id, near.mesh);
    // Tocar el vacío durante una visita no la cierra (se cierra con la ficha, Escape o alejándose).
    if (!tour) select(null);
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);

  let selected: string | null = null;
  /**
   * Elige un pueblo, un sitio o una especie: la cámara viaja hasta allá (como con los puntos del Chocó) y se abre su
   * ficha. Con `follow` (el animal que se tocó), la cámara lo acompaña. Sin nada, vuelve a la costa.
   */
  function select(id: string | null, follow?: Object3D) {
    if (openSpot) {
      openSpot = null;
      for (const s of spots) s.el.classList.remove('is-open');
      onSpot?.(null);
    }
    selected = id;
    for (const p of pins) p.el.classList.toggle('is-selected', p.place.id === id);
    const place = [...placed, ...nature].find((p) => p.id === id) ?? null;
    if (place) {
      const top = place.kind === 'nature' ? (NATURE_LABEL_HEIGHT[place.id] ?? 30) * 0.4 : (places.heights.get(place.id) ?? 20) * 0.5;
      // Más cerca de los animales chicos (la rana, el cangrejo, la pava) que de la ballena o el manglar.
      const dist = place.kind === 'town' ? 620 : place.kind === 'site' ? 380 : ({ ballena: 480, manglar: 420, cacao: 260, tortuga: 200 } as Record<string, number>)[place.id] ?? 150;
      visit(place.pos.clone().setY(Math.max(place.pos.y, 0) + top), dist, follow, top);
    } else if (tour) leaveTour();
    onSelect(place);
  }
  function focus(id: string) {
    const place = placed.find((p) => p.id === id);
    if (!place) return;
    if (selected || openSpot) select(null);
    goal.s = place.s;
    goal.dist = 820;
    clampGoal();
  }

  // ───────── Tamaño y bucle ─────────
  let aspect = 1;
  /** Tamaño de cada rótulo (se mide una vez; se vuelve a medir al cambiar el tamaño de la pantalla). */
  const sizeOf = new Map<HTMLElement, { w: number; h: number }>();
  // Si se midieron con la letra de reemplazo, se vuelven a medir cuando llega la del sitio (es más ancha).
  void document.fonts?.ready.then(() => sizeOf.clear());
  const onFonts = () => sizeOf.clear();
  document.fonts?.addEventListener('loadingdone', onFonts);
  /** Tamaño de la vista (leerlo de la página en cada cuadro la obliga a recalcular el diseño). */
  const viewSize = { w: 1, h: 1 };
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    viewSize.w = w;
    viewSize.h = h;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    sizeOf.clear();
    aspect = w / Math.max(h, 1);
    camera.aspect = aspect;
    // En pantallas verticales se abre el campo de visión para que quepa más costa.
    camera.fov = fovs(aspect).map;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const timer = new Timer();
  const tmp = new Vector3();
  const bob = new Quaternion();
  let frame = 0;
  // Contador propio: el id de requestAnimationFrame lo comparten todos los bucles de la página.
  let ticks = 0;
  let drawn = false;
  // Resolución que se adapta al equipo: si no alcanza ~38 cuadros por segundo, se dibuja con menos píxeles (hasta el
  // 60 % del tope); si le sobra, vuelve a subir. La diferencia casi no se nota y la fluidez sí.
  const prCap = pixelRatioCap();
  let pr = prCap;
  let spent = 0;
  let frames = 0;
  const adaptResolution = (dt: number) => {
    spent += dt;
    frames++;
    if (spent < 1.5) return;
    const avg = spent / frames;
    spent = 0;
    frames = 0;
    const next = avg > 1 / 38 ? Math.max(prCap * QUALITY.minPixelRatio, pr * 0.85) : avg < 1 / 55 ? Math.min(prCap, pr * 1.1) : pr;
    if (Math.abs(next - pr) > 0.01) renderer.setPixelRatio((pr = next));
  };
  const lastCam = new Matrix4();
  /** Qué tan visible es cada rótulo según la distancia (1 cerca, 0 lejos). */
  const farOf = new Map<HTMLElement, number>();
  let active = !paused;
  /** Llegada desde el planeta en curso. */
  let intro: { handoff: Handoff; fromDist: number; onLanded: () => void } | null = null;
  /** Vuelta al planeta en curso. Sigue subiendo un poco después de la posta, mientras el planeta aparece encima. */
  let outro: { start: number; from: { s: number; dist: number; pitch: number }; toDist: number; onHandoff: (() => void) | null } | null = null;
  let lastPull = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (!active) return;
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    adaptResolution(dt);
    const t = timer.getElapsed();
    if (intro) {
      // La misma curva de bajada del planeta (ver dive.ts): primero mirando hacia abajo, al final se inclina hacia la costa.
      const it = (performance.now() - intro.handoff.startedAt) / 1000;
      const e = diveProgress(it);
      view.s = ARRIVAL.s;
      view.dist = intro.fromDist * (DIST.start / intro.fromDist) ** e;
      view.pitch = MathUtils.lerp(89.6, PITCH.start, MathUtils.smootherstep(e, 0.7, 1));
      if (it >= DIVE.end) {
        const done = intro.onLanded;
        intro = null;
        Object.assign(goal, { s: view.s, dist: view.dist, pitch: view.pitch });
        done();
      }
    } else if (outro) {
      // Camino inverso a la llegada: se endereza mirando hacia abajo, vuelve frente a Nuquí y sube acelerando.
      const u = (performance.now() - outro.start) / 1000 / ASCENT.map;
      view.dist = outro.from.dist * (outro.toDist / outro.from.dist) ** (u * u);
      view.pitch = MathUtils.lerp(outro.from.pitch, 89.6, MathUtils.smootherstep(u, 0, 0.45));
      view.s = MathUtils.lerp(outro.from.s, ARRIVAL.s, MathUtils.smootherstep(u, 0, 0.6));
      if (u >= 1 && outro.onHandoff) {
        outro.onHandoff();
        outro.onHandoff = null;
      }
      if (u > 1 + (DIVE.fade + 0.3) / ASCENT.map) outro = null;
    } else {
      // Si deja de alejarse, el elástico vuelve.
      if (pull > 0 && performance.now() - pullAt > 600) {
        pull = Math.max(0, pull - dt * 1.2);
        clampGoal();
      }
      const ease = 1 - Math.exp(-dt * 3.2);
      view.s += (goal.s - view.s) * ease;
      view.dist += (goal.dist - view.dist) * ease;
      view.pitch += (goal.pitch - view.pitch) * ease;
    }
    // Desde lo alto: planos de recorte y neblina a la medida de la altura, y el dibujo del planeta.
    camera.near = Math.max(5, view.dist * 0.01);
    camera.far = Math.max(60000, view.dist * 4);
    camera.updateProjectionMatrix();
    fog.near = Math.max(FOG.near, view.dist * 1.3);
    fog.far = Math.max(FOG.far, view.dist * 5);
    region.uRegionMix.value = smoothstep(view.dist, 4000, 20000);
    if (Math.abs(pull - lastPull) > 0.02 || (pull === 0 && lastPull !== 0)) {
      lastPull = pull;
      onPull?.(pull);
    }
    const low = 1 - smoothstep(view.dist, 2500, 6500);
    clouds.setOpacity(low);
    mist.setOpacity(low);
    const showDetails = view.dist < 8000;
    for (const g of details) g.visible = showDetails;
    for (const p of pins) p.pin.visible = showDetails;
    placeCamera();
    applyTour(dt);
    // Los puntos del resto del Chocó (y sus figuritas) solo de lejos, o mientras se visita uno.
    // (visitando algo de la costa no se muestran, aunque la vista de la costa haya quedado alejada).
    const reveal = openSpot ? 1 : tour ? 0 : smoothstep(view.dist, 1250, 1600);
    if ((reveal > 0.5) !== host.classList.contains('show-spots')) host.classList.toggle('show-spots', reveal > 0.5);
    emblems.visible = reveal > 0.01;
    emblemMat.opacity = reveal;
    emblemMat.depthWrite = reveal > 0.99;
    uniforms.uTime.value = t;
    clouds.update(t);
    mist.update(t);
    places.update(t, dt);
    VIEWER.copy(camera.position);
    fauna.update(t, dt);

    for (const { place, pin, el } of pins) {
      if (place.kind === 'site') {
        pin.position.y = pinBase(place) + Math.sin(t * 2 + place.pos.z * 0.01) * 2.5;
        pin.quaternion.multiply(bob.setFromAxisAngle(tmp.set(0, 1, 0), dt * 0.8));
        pin.scale.setScalar(place.id === selected ? 1.45 : 1);
      }
      // Los rótulos de los sitios lejanos se desvanecen para no amontonarse.
      farOf.set(el, place.kind === 'town' ? 1 : 1 - smoothstep(pin.position.distanceTo(camera.position), 1300, 1900));
    }

    renderer.render(scene, camera);
    if (!drawn) {
      drawn = true;
      step('costa: primer cuadro');
    }
    // Los rótulos son elementos de la página: moverlos cuesta. Con la cámara quieta basta uno de cada tres cuadros.
    const moved = !lastCam.equals(camera.matrixWorld);
    if (moved || ticks % 3 === 0) {
      labels.render(pinGroup as unknown as Scene, camera); // basta un grupo: solo recorre lo que se le da
      lastCam.copy(camera.matrixWorld);
    }
    if (ticks % 10 === 0) {
      updateBehind();
      const op = (openSpot ? 0.7 : tour ? 0 : smoothstep(view.dist, 1250, 1600)).toFixed(2);
      for (const el of regionEls) if (el.style.opacity !== op) el.style.opacity = op;
    }
    if (ticks++ % 6 === 0) declutter();
  };

  /**
   * Evita que los rótulos se pisen: si uno choca con otro más importante (pueblos, luego el elegido, luego los
   * cercanos), se desvanece y queda solo su alfiler. Los rótulos no saltan de sitio: el que ya está a la vista
   * conserva su lugar frente a uno nuevo, así no parpadean al mover la cámara.
   */
  const GAP = { x: 12, y: 6 };
  const shown = new Set<HTMLElement>();
  const lastStyle = new Map<HTMLElement, string>();
  const anchor = new Vector3();
  const declutter = () => {
    const order = [...pins].sort((a, b) => rank(a) - rank(b));
    const taken: { l: number; r: number; t: number; b: number }[] = [];
    const { w: W, h: H } = viewSize;
    for (const { el, label } of order) {
      const far = farOf.get(el) ?? 1;
      // El renderizador de rótulos esconde (display: none) los que quedan detrás de la cámara: ni se miden.
      if (el.style.display === 'none') {
        shown.delete(el);
        continue;
      }
      // La caja se calcula proyectando el alfiler a la pantalla, sin preguntarle a la página (eso la obliga a
      // recalcular el diseño en cada consulta).
      let size = sizeOf.get(el);
      if (!size) {
        size = { w: el.offsetWidth, h: el.offsetHeight };
        // Todavía sin dibujar (ancho 0): se vuelve a medir la próxima vez.
        if (size.w > 0) sizeOf.set(el, size);
      }
      label.getWorldPosition(anchor).project(camera);
      const x = ((anchor.x + 1) / 2) * W;
      const y = ((1 - anchor.y) / 2) * H;
      const box = { l: x - size.w / 2, r: x + size.w / 2, t: y - size.h, b: y };
      const show = far > 0.2 && anchor.z < 1 && !taken.some((o) => box.l < o.r + GAP.x && box.r > o.l - GAP.x && box.t < o.b + GAP.y && box.b > o.t - GAP.y);
      if (show) {
        taken.push(box);
        shown.add(el);
      } else shown.delete(el);
      const style = show ? far.toFixed(2) : '0';
      if (lastStyle.get(el) !== style) {
        lastStyle.set(el, style);
        el.style.opacity = style;
        el.style.pointerEvents = show ? '' : 'none';
      }
    }
  };
  const rank = (p: (typeof pins)[number]) =>
    p.place.kind === 'town'
      ? 0
      : p.place.id === selected
        ? 1
        : (p.place.kind === 'site' ? 2 : 3) - (shown.has(p.el) ? 0.5 : 0) + p.pin.position.distanceTo(camera.position) / 1e4;
  loop();
  // En pausa no se dibuja, pero se dejan listos los sombreadores para que la entrada no se trabe.
  if (paused) {
    placeCamera();
    step('costa: compilando');
    await renderer.compileAsync(scene, camera).catch(() => {});
    step('costa: lista');
  }

  // Los animales de la diseñadora llegan después: cada uno reemplaza a su figura dibujada. En el nivel mínimo no se
  // descargan (casi 1,5 MB con su decodificador): se quedan las figuras dibujadas, que además pesan menos.
  let disposed = false;
  if (QUALITY.models) loadAnimals().then((kit) => {
    if (disposed) return;
    fauna.swap?.(kit);
    if (!active) void renderer.compileAsync(scene, camera).catch(() => {});
  });

  return {
    focus,
    select,
    land: (handoff, onLanded) => {
      step('costa: llegando');
      select(null);
      intro = { handoff, fromDist: handoff.fromKm * mapUnitsPerKm(aspect), onLanded };
      if (!active) timer.reset();
      active = true;
    },
    ascend: (onHandoff) => {
      select(null);
      tour = null;
      flight = null;
      pull = 0;
      outro = {
        start: performance.now(),
        from: { s: view.s, dist: view.dist, pitch: view.pitch },
        toDist: DIVE.handoffKm * mapUnitsPerKm(aspect),
        onHandoff,
      };
      active = true;
    },
    setActive: (on) => {
      if (on && !active) timer.reset();
      active = on;
    },
    dispose: () => {
      disposed = true;
      document.fonts?.removeEventListener('loadingdone', onFonts);
      clearKitCache();
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
      uniforms.uShoreFar.value.dispose();
      region.uRegion.value.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}

export const MAP_TOWNS = placed.filter((p) => p.kind === 'town').map(({ id, name }) => ({ id, name }));
