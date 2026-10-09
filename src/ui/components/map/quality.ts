// Nivel de calidad del mapa según el equipo. Un teléfono de gama baja (poca memoria, pocos núcleos) recibe una
// versión más liviana: menos resolución, menos plantas y aves, sin bordes en los animales y un mar más simple. El
// resto se ve igual. Para probar a mano: ?calidad=alta | media | baja en la dirección.

import { MeshLambertMaterial, MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';

export type Tier = 'alta' | 'media' | 'baja';

function detect(): Tier {
  const forced = new URLSearchParams(location.search).get('calidad');
  if (forced === 'alta' || forced === 'media' || forced === 'baja') return forced;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 8; // GB (Chrome lo redondea y lo limita a 8; Safari no lo informa)
  const cores = nav.hardwareConcurrency ?? 8;
  const phone = Math.min(screen.width, screen.height) < 600;
  if (memory <= 3 || cores <= 4) return 'baja';
  if (memory <= 4 || phone) return 'media';
  return 'alta';
}

export const TIER: Tier = detect();

const LEVELS = {
  alta: { pixelRatio: 2, antialias: true, plants: 1, birds: 1, outlines: true, waves: 5, stars: 1, fewAnimals: false, landStep: 1 },
  media: { pixelRatio: 1.5, antialias: true, plants: 0.75, birds: 0.75, outlines: true, waves: 5, stars: 0.7, fewAnimals: false, landStep: 1 },
  baja: { pixelRatio: 1, antialias: false, plants: 0.45, birds: 0.45, outlines: false, waves: 3, stars: 0.45, fewAnimals: true, landStep: 2 },
} as const;

export const QUALITY = LEVELS[TIER];

/** Densidad de píxeles a usar: la del equipo, con el tope del nivel. */
export const pixelRatioCap = () => Math.min(window.devicePixelRatio || 1, QUALITY.pixelRatio);

/**
 * Escala de las texturas grandes del afiche (el planeta y la región). El planeta ocupa más o menos el lado corto de la
 * pantalla y se ve la mitad de su vuelta: si eso cabe en ~1400 píxeles reales, la textura a la mitad (2048) ya da un
 * píxel de dibujo por píxel de pantalla, y pesa la cuarta parte en memoria.
 */
export const textureScale = () => (TIER === 'baja' || Math.min(screen.width, screen.height) * pixelRatioCap() * 2 <= 1400 ? 0.5 : 1);

/**
 * Material con luz. En equipos modestos, Lambert en vez del físico (PBR): en figuras de caras planas se ve casi igual
 * y a la tarjeta gráfica de un teléfono le cuesta bastante menos.
 */
export function litMaterial(params: MeshStandardMaterialParameters) {
  if (TIER !== 'baja') return new MeshStandardMaterial(params);
  const { roughness: _r, metalness: _m, ...rest } = params;
  return new MeshLambertMaterial(rest);
}
