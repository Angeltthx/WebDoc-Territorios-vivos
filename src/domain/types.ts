// Modelo del recorrido. El contenido vive en src/content; aquí solo están las formas.

export type StationId = 'chori' | 'atrato' | 'nuqui' | 'pangui';

export type SectionKind =
  | 'pensamiento'
  | 'historia'
  | 'galeria'
  | 'receta'
  | 'scrolly'
  | 'silencio'
  | 'cantos'
  | 'viche';

/** Referencia a una imagen optimizada en public/media (sin extensión). */
export interface Photo {
  id: string;
  alt: string;
  /** Crédito o pie; se muestra "por confirmar" hasta tener el inventario editorial. */
  caption?: string;
  tag?: 'dron';
  /** Punto focal para object-position, p. ej. "60% 30%". */
  focus?: string;
}

export interface VideoAsset {
  title: string;
  /** Duración de referencia del wireframe. */
  duration?: string;
  poster?: Photo;
  /** URL del stream cuando exista. Mientras falte, el reproductor muestra el estado pendiente. */
  src?: string;
  tint?: string;
}

export interface Section {
  kind: SectionKind;
  label: string;
}

export interface Station {
  id: StationId;
  number: number;
  name: string;
  place: string;
  accent: string;
  illustration: string;
  background: Photo;
  quote: { text: string; author: string; portrait: Photo };
  sections: Section[];
  video?: VideoAsset;
  gallery?: { intro: string; background: Photo; photos: Photo[] };
  recipe?: { eyebrow: string; title: string; hero: Photo; steps: Photo[] };
  scrolly?: { scenes: { photo: Photo; text: string }[] };
  silence?: { title: string; hint: string; photo: Photo };
  songs?: {
    background: Photo;
    /** Experiencia 360: lista HLS y imagen equirrectangular de espera. */
    panorama: { title: string; sub: string; src: string; poster: string; label: string };
    songs: { title: string; sub: string }[];
  };
  viche?: VideoAsset;
}

export interface Transition {
  number: number;
  from: string;
  to: string;
  symbol: 'wave' | 'rain' | 'meet' | 'sea';
  lines: string[];
  hint?: string;
  background?: Photo;
  color?: string;
  tint?: string;
  /** Video de fondo (id en public/media/transiciones) con su propio sonido. */
  video?: string;
  /** Voz de Chachita (id en public/media/audio/chachita). */
  voice?: string;
}

