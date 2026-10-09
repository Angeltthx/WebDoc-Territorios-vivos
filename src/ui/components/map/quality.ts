// Nivel de calidad del mapa según el equipo, elegido en el propio navegador al abrir la página (el sitio es estático:
// el servidor no puede saber qué tarjeta gráfica tiene el teléfono, el navegador sí).
//
//   alta    computadores y teléfonos potentes (un iPhone reciente): todo.
//   media   la mayoría de los teléfonos: un poco menos de vegetación y aves, resolución con tope.
//   baja    teléfonos sencillos: menos de todo, sin bordes, mar y relieve más simples, sin cielo pintado en 3D.
//   minima  lo justo para que corra en cualquier teléfono o con mala señal: lo básico del mapa, figuras dibujadas en
//           lugar de los modelos animados (no se descargan), muy pocas aves, texturas pequeñas.
//
// Se mira: la tarjeta gráfica (su nombre), la memoria, los núcleos, la pantalla y la conexión. Y la página aprende: si
// en este equipo el 3D se cayó, la próxima vez entra un nivel más abajo (ver `rememberCrash`).
// Para probar a mano: ?calidad=alta | media | baja | minima en la dirección.

import { MeshLambertMaterial, MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';

export type Tier = 'alta' | 'media' | 'baja' | 'minima';
const ORDER: Tier[] = ['minima', 'baja', 'media', 'alta'];
const below = (a: Tier, b: Tier) => ORDER.indexOf(a) < ORDER.indexOf(b);
const STORE = 'mapa-calidad-tope';

/** Nombre de la tarjeta gráfica (p. ej. «Mali-G52», «Adreno (TM) 610», «Apple GPU»); null si no hay 3D. */
function gpuInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // se suelta este contexto de prueba de inmediato
    return { name, maxTexture };
  } catch {
    return { name: '', maxTexture: 4096 };
  }
}

/** Tope según la tarjeta gráfica de los teléfonos (las de computador y las de Apple no ponen tope). */
function gpuCap(name: string): Tier {
  const n = name.toLowerCase();
  // Muy modestas: Mali de la serie T y G31–G52; Adreno 3xx–5xx y 610; PowerVR (GE8xxx).
  if (/mali-(t\d|g31|g51|g52)|adreno\D*([345]\d\d|610)\b|powervr|ge8\d{3}/.test(n)) return 'minima';
  // Sencillas: Mali-G57/G68, Adreno 612–619, IMG BXM.
  if (/mali-(g57|g68)|adreno\D*61[2-9]\b|bxm/.test(n)) return 'baja';
  // Gama media de teléfono: el resto de Mali y Adreno 6xx.
  if (/mali|adreno\D*6\d\d/.test(n)) return 'media';
  return 'alta';
}

function detect(): { tier: Tier; why: string[] } {
  const forced = new URLSearchParams(location.search).get('calidad') as Tier | null;
  if (forced && ORDER.includes(forced)) return { tier: forced, why: ['elegida a mano'] };

  const why: string[] = [];
  let tier: Tier = 'alta';
  /** Baja el nivel a `t` (si es más bajo que el actual) y anota por qué. */
  const cap = (t: Tier, reason: string) => {
    if (!below(t, tier)) return;
    tier = t;
    why.push(reason);
  };
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; saveData?: boolean };
  };

  const gpu = gpuInfo();
  if (!gpu) return { tier: 'minima', why: ['sin 3D'] };
  const apple = /apple/i.test(gpu.name);
  cap(gpuCap(gpu.name), gpu.name);
  if (gpu.maxTexture < 4096) cap('minima', `texturas de ${gpu.maxTexture}`);

  // Memoria (Chrome la informa redondeada, hasta 8 GB; Safari no la informa).
  const memory = nav.deviceMemory;
  if (memory !== undefined && memory <= 2) cap('minima', `${memory} GB`);
  else if (memory !== undefined && memory <= 4) cap('baja', `${memory} GB`);
  const cores = nav.hardwareConcurrency ?? 8;
  if (cores <= 4) cap('baja', `${cores} núcleos`);

  // Teléfono: como mucho «media», salvo los de Apple (los iPhone recientes van sobrados).
  if (Math.min(screen.width, screen.height) < 600 && !apple) cap('media', 'teléfono');

  // Mala señal o ahorro de datos: lo más liviano también para descargar.
  const net = nav.connection;
  if (net?.saveData) cap('minima', 'ahorro de datos');
  else if (net?.effectiveType && /2g/.test(net.effectiveType)) cap('minima', `red ${net.effectiveType}`);
  else if (net?.effectiveType === '3g') cap('baja', 'red 3g');

  // Lo aprendido en este equipo (si el 3D se le cayó antes).
  try {
    const stored = localStorage.getItem(STORE) as Tier | null;
    if (stored && ORDER.includes(stored)) cap(stored, 'se cayó antes');
  } catch {
    // sin almacenamiento: nada aprendido
  }
  return { tier, why };
}

const detected = detect();
export const TIER: Tier = detected.tier;
/** Por qué se eligió este nivel (se muestra en el aviso de error, para diagnosticar). */
export const TIER_REASONS = detected.why;
console.info(`[mapa] calidad ${TIER}${TIER_REASONS.length ? ` (${TIER_REASONS.join(', ')})` : ''}`);

/**
 * El 3D se cayó en este equipo: la próxima vez se entra un nivel más abajo. Devuelve si todavía queda un nivel más
 * liviano para probar (si ya era el mínimo, no).
 */
export function rememberCrash(): boolean {
  const i = ORDER.indexOf(TIER);
  if (i <= 0) return false;
  try {
    localStorage.setItem(STORE, ORDER[i - 1]);
    return true;
  } catch {
    return false;
  }
}

const LEVELS = {
  alta: {
    pixelRatio: 2, minPixelRatio: 0.6, antialias: true, plants: 1, birds: 1, butterflies: 1, clouds: 1, mist: true,
    outlines: true, waves: 5, stars: 1, galaxy: true, fewAnimals: false, models: true, landStep: 1, world: 1, region: 1,
  },
  media: {
    pixelRatio: 1.5, minPixelRatio: 0.6, antialias: true, plants: 0.75, birds: 0.75, butterflies: 0.75, clouds: 1, mist: true,
    outlines: true, waves: 5, stars: 0.7, galaxy: true, fewAnimals: false, models: true, landStep: 1, world: 0.5, region: 0.8,
  },
  baja: {
    pixelRatio: 1, minPixelRatio: 0.6, antialias: false, plants: 0.45, birds: 0.45, butterflies: 0.45, clouds: 0.7, mist: true,
    outlines: false, waves: 3, stars: 0.45, galaxy: false, fewAnimals: true, models: true, landStep: 2, world: 0.5, region: 0.6,
  },
  minima: {
    pixelRatio: 1, minPixelRatio: 0.5, antialias: false, plants: 0.25, birds: 0.2, butterflies: 0, clouds: 0.4, mist: false,
    outlines: false, waves: 2, stars: 0.15, galaxy: false, fewAnimals: true, models: false, landStep: 3, world: 0.25, region: 0.4,
  },
} as const;

export const QUALITY = LEVELS[TIER];

/** Densidad de píxeles a usar: la del equipo, con el tope del nivel. */
export const pixelRatioCap = () => Math.min(window.devicePixelRatio || 1, QUALITY.pixelRatio);

/**
 * Escala de la textura del planeta (4096 × 2048 en la calidad alta). En la alta, si el planeta cabe en ~1400 píxeles
 * reales, la mitad ya da un píxel de dibujo por píxel de pantalla (y pesa la cuarta parte en memoria).
 */
export const worldScale = () =>
  QUALITY.world < 1 ? QUALITY.world : Math.min(screen.width, screen.height) * pixelRatioCap() * 2 <= 1400 ? 0.5 : 1;

/**
 * Material con luz. En equipos modestos, Lambert en vez del físico (PBR): en figuras de caras planas se ve casi igual
 * y a la tarjeta gráfica de un teléfono le cuesta bastante menos.
 */
export function litMaterial(params: MeshStandardMaterialParameters) {
  if (TIER === 'alta' || TIER === 'media') return new MeshStandardMaterial(params);
  const { roughness: _r, metalness: _m, ...rest } = params;
  return new MeshLambertMaterial(rest);
}
