// Las páginas del webdoc, en el orden del PDF de wireframes (v3) con los ajustes del cliente
// (29/09/2026): "Cita" → "Pensamiento", "El corto" → "Historia" y sección "Video canción" en la estación 4;
// (30/09/2026): transición en video después del intro y galería en la estación 4;
// videos de HISTORIA de las estaciones 1 a 3 en streaming (public/media/historias);
// (05/10/2026): video del intro después de la portada, cierre en video y Video canción en streaming;
// (08/10/2026): "Historia" → "Tráiler historia" y sección "Video canción" en la estación 3;
// (13/10/2026): tráiler nuevo en la estación 3 (une el scrollytelling y el tráiler en una sola página), los Video canción de las estaciones 3 y 4 intercambiados y video del Viche;
// (19/10/2026): la portada y el intro son una sola página, y los nombres de la estación 4 son los del menú del cliente.
// El recorrido es un desplazamiento vertical: cada página ocupa la pantalla y sube sobre la anterior.

import type { Photo, StationId, VideoAsset } from '../domain/types';

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

const p = (id: string, alt: string, extra: Partial<Photo> = {}): Photo => ({ id, alt, ...extra });

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
    { label: 'Marea alta', to: 'pangui-marea-alta' },
    { label: 'Marea baja', to: 'pangui-marea-baja' },
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
  | { kind: 'video'; label: string; video: VideoAsset; tabs?: Tabs; bar?: string; closeTo?: string }
  | { kind: 'gallery'; station: StationId; label: string; tabs: Tabs }
  | { kind: 'recipe'; label: string; tabs: Tabs }
  | { kind: 'transition'; index: number }
  | { kind: 'silence'; label: string; tide: 'alta' | 'baja'; title: string; hint: string; photo: Photo; tabs: Tabs }
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
  },
  {
    id: 'nuqui-video-cancion',
    kind: 'video',
    label: 'Estación 3 · Video canción',
    // Por ahora, el video largo de Marea alta, marea baja (13/10/2026): el cliente aún define cuál va aquí.
    video: { title: 'Marea alta, marea baja · Video canción', stream: 'cancion-marea' },
    tabs: nuqui('Video canción'),
  },
  { id: 'nuqui-galeria', kind: 'gallery', station: 'nuqui', label: 'Estación 3 · Galería', tabs: nuqui('Galería') },
  { id: 'transicion-3', kind: 'transition', index: 3 },

  // El silencio se divide en dos escenas, cada una con su propio sonido de marea.
  {
    id: 'pangui-marea-alta',
    kind: 'silence',
    tide: 'alta',
    label: 'Estación 4 · Marea alta, marea baja',
    title: 'Marea alta',
    hint: 'sin voz · solo la marea que sube',
    photo: p('6i3a4281', 'Una mujer toca las ramas del manglar', { focus: '55% 30%' }),
    tabs: pangui('Marea alta'),
  },
  {
    id: 'pangui-marea-baja',
    kind: 'silence',
    tide: 'baja',
    label: 'Estación 4 · Marea alta, marea baja',
    title: 'marea baja',
    hint: 'sin voz · solo la marea que baja',
    photo: p('6i3a5069', 'El manglar reflejado en el agua, con garzas', { focus: '50% 60%' }),
    tabs: pangui('Marea baja'),
  },
  {
    id: 'pangui-historia',
    kind: 'video',
    label: 'Estación 4 · Tráiler historia',
    video: { title: 'Marea alta, marea baja', duration: '12:30', tint: '#58509a' },
    tabs: pangui('Tráiler historia'),
  },
  { id: 'pangui-galeria', kind: 'gallery', station: 'pangui', label: 'Estación 4 · Galería', tabs: pangui('Galería') },
  { id: 'pangui-cantos', kind: 'songs', label: 'Estación 4 · Manglar - Cantos', tabs: pangui('Manglar - Cantos') },
  {
    id: 'pangui-video-cancion',
    kind: 'video',
    label: 'Estación 4 · Video canción',
    // El video musical que estaba en la estación 3 (13/10/2026).
    video: { title: 'El baile de las olas · Video canción', stream: 'estacion-3' },
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
