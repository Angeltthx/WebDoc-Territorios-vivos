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
  SphereGeometry, Timer, UniformsLib, UniformsUtils, Vector2, Vector3, Vector4, WebGLRenderer, type Texture, type WebGLProgramParametersWithUniforms,
} from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { MapPlace } from '../../../content/map';
import { buildFauna, NATURE_LABEL_HEIGHT } from './fauna';
import { sticker } from './kit';
import { buildFlora, buildMist } from './flora';
import { buildPlaces } from './places';
import { loadAnimals } from './animals';
import { ASCENT, DIVE, diveProgress, fovs, mapUnitsPerKm, type Handoff } from './dive';
import { REGION, posterTexture, regionCanvas } from './posterArt';
import {
  ARRIVAL, BOUNDS, FAR_GRID, FAR_SHORE_FIELD, GRID, HEIGHTS, RAIL, SHORE_FIELD, farVertex, nature, placeNear, placed, railAt, rng,
  shore, smoothstep, toScene, valueNoise, type PlacedPlace,
} from './terrain';

const DIST = { min: 300, max: 1700, start: DIVE.mapDist };
const PITCH = { min: 5, max: 38, start: 10 };

const SUN_DIR = new Vector3(1, 0.21, 0.26).normalize();
const HORIZON = new Color('#dcf1ec');
const ZENITH = new Color('#4aa6c8');
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
    uRegion: { value: posterTexture(regionCanvas()) },
    uRegionBox: { value: new Vector4(nw.x, nw.z, se.x - nw.x, se.z - nw.z) },
    uRegionMix: { value: 0 },
  };
}

const REGION_GLSL = `uniform sampler2D uRegion;
  uniform vec4 uRegionBox;
  uniform float uRegionMix;
  vec3 regionArt(vec3 w) {
    return texture2D(uRegion, vec2((w.x - uRegionBox.x) / uRegionBox.z, 1.0 - (w.z - uRegionBox.y) / uRegionBox.w)).rgb;
  }`;

/**
 * Material de la tierra: colores por vértice, el dibujo de hojas del afiche y, desde lo alto, el dibujo del planeta.
 * `hole` (x0, z0, x1, z1) deja un hueco donde ya está el relieve fino.
 */
function landMaterial(region: RegionUniforms, flatShading: boolean, hole?: Vector4) {
  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading, roughness: 1 });
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

function buildLand(region: RegionUniforms) {
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
  return new Mesh(geo, landMaterial(region, true));
}

/**
 * El resto del Chocó, de fondo: la costa sigue al norte y al sur, y tierra adentro vienen el valle del Atrato y la
 * cordillera Occidental. Es una grilla gruesa (≈ 2,8 km) con un hueco donde está el relieve fino de la costa.
 */
function buildFarLand(region: RegionUniforms) {
  const { x0, z0, dx, dz, cols, rows } = FAR_GRID;
  const geo = new PlaneGeometry((cols - 1) * dx, (rows - 1) * dz, cols - 1, rows - 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(x0 + ((cols - 1) * dx) / 2, 0, z0 + ((rows - 1) * dz) / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
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
        for (int i = 0; i < 5; i++) {
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
        vec3 sky = mix(uHorizon, uZenith, pow(R.y, 0.5)) + vec3(1.0, 0.93, 0.75) * pow(sd, 12.0) * 0.22;

        // Color del agua: azul verdoso mar adentro, turquesa cerca de la orilla, claro sobre la arena, verdoso en los ríos.
        float nearShore = 1.0 - smoothstep(0.0, 500.0, off);
        vec3 body = mix(srgb(vec3(0.05, 0.34, 0.42)), srgb(vec3(0.035, 0.27, 0.36)), smoothstep(1500.0, 7000.0, off));
        body *= 0.88 + 0.24 * vnoise(vSea.xz * 0.0009 + 3.0);
        body = mix(body, srgb(vec3(0.12, 0.55, 0.56)), nearShore);
        body = mix(body, srgb(vec3(0.34, 0.72, 0.65)), 1.0 - smoothstep(0.0, 70.0, off));
        body = mix(body, srgb(vec3(0.19, 0.44, 0.38)), smoothstep(-8.0, -50.0, off));
        // La luz atraviesa las olas que dan al sol.
        body += srgb(vec3(0.10, 0.32, 0.28)) * max(dot(N.xz, uSun.xz), 0.0) * 0.6;

        vec3 col = mix(body, sky, fres);
        // Brillo del sol sobre las olas.
        col += vec3(1.0, 0.95, 0.82) * (pow(sd, 500.0) * 2.2 + pow(sd, 50.0) * 0.12);

        // Espuma: la orilla y las olas que llegan a la playa.
        float n = vnoise(vSea.xz * 0.11 + vec2(uTime * 0.06, 0.0));
        float swash = sin(off * 0.11 + uTime * 1.25 + n * 3.0);
        float band = smoothstep(0.82, 0.98, swash) * (1.0 - smoothstep(8.0, 75.0, off));
        float edge = 1.0 - smoothstep(0.0, 7.0 + n * 7.0, off);
        float foam = max(band * 0.75, edge) * smoothstep(-6.0, 0.0, off);
        foam *= 0.55 + 0.45 * smoothstep(0.3, 0.7, vnoise(vSea.xz * 0.35 - uTime * 0.1));
        foam *= 1.0 - smoothstep(4.0, 16.0, foot);
        col = mix(col, srgb(vec3(0.94, 0.98, 0.96)), foam * 0.9);
        col = mix(col, srgb(vec3(0.95, 0.985, 0.98)), splashFoam * 0.92);

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
  const mat = new MeshStandardMaterial({ color: '#ffffff', emissive: '#dfeefa', emissiveIntensity: 0.55, flatShading: true, roughness: 1, transparent: true });
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
}

export function createMapScene(host: HTMLElement, { onSelect, onInteract, paused = false, onZoomOut, onPull }: MapSceneOptions): MapSceneHandle {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'map-labels';
  host.appendChild(labels.domElement);

  const scene = new Scene();
  const fog = new Fog(HORIZON, FOG.near, FOG.far);
  scene.fog = fog;
  const camera = new PerspectiveCamera(52, 1, 5, 60000);

  const rand = rng(20261008);
  const sky = buildSky();
  const region = regionUniforms();
  const { sea, uniforms } = buildSea(region);
  const clouds = buildClouds(rand);
  const mist = buildMist(rand);
  const places = buildPlaces(rand);
  // Cuando la ballena rompe el agua, el mar lo registra (ver `uSplash`).
  let splashSlot = 0;
  const fauna = buildFauna(rand, (x, z, size, strength) => {
    uniforms.uSplash.value[splashSlot++ % 4].set(x, z, uniforms.uTime.value, size * (0.55 + 0.45 * strength));
  });
  const rocks = buildRocks(rand);
  const flora = buildFlora(rand);
  scene.add(sky, sea, buildLand(region), buildFarLand(region), rocks, flora, clouds.group, mist.group, places.group, fauna.group);
  /** Lo que solo se ve de cerca: desde muy alto se esconde (no se alcanza a ver y ensuciaría el dibujo del planeta). */
  const details = [rocks, flora, places.group, fauna.group];

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
      if (pinchStart > 0) {
        goal.dist = pinchDist * (pinchStart / d);
        // Pellizcar hacia adentro más allá del máximo también lleva al planeta.
        if (goal.dist > DIST.max) {
          pull = Math.min(1, (goal.dist / DIST.max - 1) / 0.7);
          pullAt = performance.now();
          if (pull >= 1) onZoomOut?.();
        }
      }
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
    if (intro || outro) return;
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
      // La fauna es pequeña: al elegirla, la cámara se acerca más.
      goal.dist = Math.min(goal.dist, place.kind === 'town' ? 760 : place.kind === 'nature' ? 380 : 560);
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
  let aspect = 1;
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
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
      const far = place.kind === 'town' ? 1 : 1 - smoothstep(pin.position.distanceTo(camera.position), 1300, 1900);
      el.dataset.far = String(far);
    }

    renderer.render(scene, camera);
    labels.render(scene, camera);
    if (ticks++ % 6 === 0) declutter();
  };

  /**
   * Evita que los rótulos se pisen: si uno choca con otro más importante (pueblos, luego el elegido,
   * luego los cercanos), sube un escalón unido a su alfiler por una línea; si no cabe, se oculta.
   */
  const GAP = { x: 14, y: 8 };
  const declutter = () => {
    const order = [...pins].sort((a, b) => rank(a) - rank(b));
    const taken: { l: number; r: number; t: number; b: number }[] = [];
    for (const { el } of order) {
      const far = Number(el.dataset.far ?? 1);
      const lift = Number(el.dataset.lift ?? 0);
      const box = el.getBoundingClientRect();
      const step = box.height + 10;
      let placedAt = -1;
      // A lo sumo dos pisos: una torre de rótulos se ve revuelta; si no cabe, queda solo su alfiler.
      for (let k = 0; far > 0.2 && k < 2 && placedAt < 0; k++) {
        const t = box.top + lift - k * step;
        const hit = taken.some((o) => box.left < o.r + GAP.x && box.right > o.l - GAP.x && t < o.b + GAP.y && t + box.height > o.t - GAP.y);
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

  // Los animales de la diseñadora llegan después: cada uno reemplaza a su figura dibujada.
  let disposed = false;
  loadAnimals().then((kit) => {
    if (disposed) return;
    fauna.swap?.(kit);
    if (!active) renderer.compile(scene, camera);
  });

  return {
    focus,
    select,
    land: (handoff, onLanded) => {
      select(null);
      intro = { handoff, fromDist: handoff.fromKm * mapUnitsPerKm(aspect), onLanded };
      if (!active) timer.reset();
      active = true;
    },
    ascend: (onHandoff) => {
      select(null);
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
