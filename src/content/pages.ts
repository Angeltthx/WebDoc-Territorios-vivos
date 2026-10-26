// Las páginas del webdoc, en el orden del PDF de wireframes (v3) con los ajustes del cliente
// (29/09/2026): "Cita" → "Pensamiento", "El corto" → "Historia" y sección "Video canción" en la estación 4;
// (30/09/2026): transición en video después del intro y galería en la estación 4;
// videos de HISTORIA de las estaciones 1 a 3 en streaming (public/media/historias);
// (05/10/2026): video del intro después de la portada, cierre en video y Video canción en streaming;
// (08/10/2026): "Historia" → "Tráiler historia" y sección "Video canción" en la estación 3;
// (13/10/2026): tráiler nuevo en la estación 3 (une el scrollytelling y el tráiler en una sola página), los Video canción de las estaciones 3 y 4 intercambiados y video del Viche;
// (19/10/2026): la portada y el intro son una sola página, y los nombres de la estación 4 son los del menú del cliente;
// (20/10/2026): la estación 4 abre con un Pensamiento (sin las escenas Marea alta y Marea baja) y los Video canción vuelven a su estación.
// El recorrido es un desplazamiento vertical: cada página ocupa la pantalla y sube sobre la anterior.

import type { StationId, VideoAsset } from '../domain/types';

/** Pestaña visible en una página. `to` es el id de la página a la que lleva (si existe). */
export interface TabSpec {
  label: string;
  to?: string;
  warm?: boolean;
}

export interface Tabs {
  items: TabSpec[];
  active: string;
}

// Pestañas por estación.
const chori = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Pensamiento', to: 'chori-pensamiento' },
    { label: 'Tráiler historia', to: 'chori-historia' },
    { label: 'Galería', to: 'chori-galeria' },
    { label: 'Receta', to: 'chori-receta' },
  ],
});
const atrato = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Pensamiento', to: 'atrato-pensamiento' },
    { label: 'Tráiler historia', to: 'atrato-historia' },
    { label: 'Galería', to: 'atrato-galeria' },
  ],
});
const nuqui = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Pensamiento', to: 'nuqui-pensamiento' },
    { label: 'Tráiler historia', to: 'nuqui-historia' },
    { label: 'Video canción', to: 'nuqui-video-cancion' },
    { label: 'Galería', to: 'nuqui-galeria' },
  ],
});
const pangui = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Pensamiento', to: 'pangui-pensamiento' },
    { label: 'Tráiler historia', to: 'pangui-historia' },
    { label: 'Galería', to: 'pangui-galeria' },
    { label: 'Manglar - Cantos', to: 'pangui-cantos' },
    { label: 'Video canción', to: 'pangui-video-cancion' },
    { label: 'Un regalo de la selva', to: 'pangui-viche', warm: true },
  ],
});

export type PageBody =
  | { kind: 'welcome' }
  | { kind: 'quote'; station: StationId; label: string; tabs: Tabs }
  | {
    kind: 'video'; label: string; video: VideoAsset; tabs?: Tabs; bar?: string; closeTo?: string;
    /** Tráiler historia: el video en un recuadro sobre el fondo de la galería de su estación, con el aviso del estreno. */
    trailer?: StationId;
  }
  | { kind: 'gallery'; station: StationId; label: string; tabs: Tabs }
  | { kind: 'recipe'; label: string; tabs: Tabs }
  | { kind: 'transition'; index: number }
  | { kind: 'songs'; label: string; tabs: Tabs }
  | { kind: 'closing' };

export type PageSpec = PageBody & { id: string };

export const pages: PageSpec[] = [
  { id: 'inicio', kind: 'welcome' },
  { id: 'transicion-inicio', kind: 'transition', index: 0 },

  { id: 'chori-pensamiento', kind: 'quote', station: 'chori', label: 'Estación 1 · El latido', tabs: chori('Pensamiento') },
  {
    id: 'chori-historia',
    kind: 'video',
    label: 'Estación 1 · Tráiler historia',
    video: { title: 'El latido', stream: 'estacion-1' },
    tabs: chori('Tráiler historia'),
    trailer: 'chori',
  },
  { id: 'chori-galeria', kind: 'gallery', station: 'chori', label: 'Estación 1 · Galería', tabs: chori('Galería') },
  { id: 'chori-receta', kind: 'recipe', label: 'Estación 1 · Receta', tabs: chori('Receta') },
  { id: 'transicion-1', kind: 'transition', index: 1 },

  { id: 'atrato-pensamiento', kind: 'quote', station: 'atrato', label: 'Estación 2 · Gente del Río', tabs: atrato('Pensamiento') },
  {
    id: 'atrato-historia',
    kind: 'video',
    label: 'Estación 2 · Tráiler historia',
    video: { title: 'Gente del Río', stream: 'estacion-2' },
    tabs: atrato('Tráiler historia'),
    trailer: 'atrato',
  },
  { id: 'atrato-galeria', kind: 'gallery', station: 'atrato', label: 'Estación 2 · Galería', tabs: atrato('Galería') },
  { id: 'transicion-2', kind: 'transition', index: 2 },

  { id: 'nuqui-pensamiento', kind: 'quote', station: 'nuqui', label: 'Estación 3 · El baile de las olas', tabs: nuqui('Pensamiento') },
  {
    id: 'nuqui-historia',
    kind: 'video',
    label: 'Estación 3 · Tráiler historia',
    // Tráiler nuevo, con Orfelina (13/10/2026). Es también el scrollytelling: la página aparte sin video se quitó (13/10/2026).
    video: { title: 'El baile de las olas', stream: 'nuqui-trailer' },
    tabs: nuqui('Tráiler historia'),
    trailer: 'nuqui',
  },
  {
    id: 'nuqui-video-cancion',
    kind: 'video',
    label: 'Estación 3 · Video canción',
    // El video musical de El baile de las olas (20/10/2026: vuelve de la estación 4, donde estaba desde el 13/10).
    video: { title: 'El baile de las olas · Video canción', stream: 'estacion-3' },
    tabs: nuqui('Video canción'),
  },
  { id: 'nuqui-galeria', kind: 'gallery', station: 'nuqui', label: 'Estación 3 · Galería', tabs: nuqui('Galería') },
  { id: 'transicion-3', kind: 'transition', index: 3 },

  { id: 'pangui-pensamiento', kind: 'quote', station: 'pangui', label: 'Estación 4 · Marea alta, marea baja', tabs: pangui('Pensamiento') },
  {
    id: 'pangui-historia',
    kind: 'video',
    label: 'Estación 4 · Tráiler historia',
    video: { title: 'Marea alta, marea baja', duration: '12:30', tint: '#58509a' },
    tabs: pangui('Tráiler historia'),
    trailer: 'pangui',
  },
  { id: 'pangui-galeria', kind: 'gallery', station: 'pangui', label: 'Estación 4 · Galería', tabs: pangui('Galería') },
  { id: 'pangui-cantos', kind: 'songs', label: 'Estación 4 · Manglar - Cantos', tabs: pangui('Manglar - Cantos') },
  {
    id: 'pangui-video-cancion',
    kind: 'video',
    label: 'Estación 4 · Video canción',
    // El video largo de Marea alta, marea baja (20/10/2026: vuelve de la estación 3).
    video: { title: 'Marea alta, marea baja · Video canción', stream: 'cancion-marea' },
    tabs: pangui('Video canción'),
  },
  {
    id: 'pangui-viche',
    kind: 'video',
    label: 'Estación 4 · Un regalo de la selva',
    video: { title: 'Viche curao, un regalo de la selva', stream: 'viche' },
    tabs: pangui('Un regalo de la selva'),
  },
  { id: 'transicion-4', kind: 'transition', index: 4 },

  { id: 'cierre', kind: 'closing' },
];

export const pageIndex = (id: string) => pages.findIndex((pg) => pg.id === id);
