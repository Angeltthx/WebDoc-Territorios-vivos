// Las páginas del webdoc, en el orden del PDF de wireframes (v3) con los ajustes del cliente
// (29/09/2026): "Cita" → "Pensamiento", "El corto" → "Historia" y sección "Video canción" en la estación 4.
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
    { label: 'Historia', to: 'chori-historia' },
    { label: 'Galería', to: 'chori-galeria' },
    { label: 'Receta', to: 'chori-receta' },
  ],
});
const atrato = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Pensamiento', to: 'atrato-pensamiento' },
    { label: 'Historia', to: 'atrato-historia' },
    { label: 'Galería', to: 'atrato-galeria' },
  ],
});
const nuqui = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Scrolly', to: 'nuqui-scrolly' },
    { label: 'Pensamiento', to: 'nuqui-pensamiento' },
    { label: 'Historia', to: 'nuqui-historia' },
    { label: 'Galería', to: 'nuqui-galeria' },
  ],
});
const pangui = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Silencio', to: 'pangui-silencio' },
    { label: 'Historia', to: 'pangui-historia' },
    { label: '360 · Cantos', to: 'pangui-cantos' },
    { label: 'Video canción', to: 'pangui-video-cancion' },
    { label: 'Viche', to: 'pangui-viche', warm: true },
  ],
});

export type PageBody =
  | { kind: 'welcome' }
  | { kind: 'quote'; station: StationId; label: string; tabs: Tabs }
  | { kind: 'video'; label: string; video: VideoAsset; tabs?: Tabs; bar?: string; closeTo?: string }
  | { kind: 'gallery'; station: StationId; label: string; tabs: Tabs }
  | { kind: 'recipe'; label: string; tabs: Tabs }
  | { kind: 'transition'; index: number }
  | { kind: 'silence'; label: string }
  | { kind: 'songs'; label: string; tabs: Tabs }
  | { kind: 'closing' };

export type PageSpec = PageBody & { id: string };

export const pages: PageSpec[] = [
  { id: 'inicio', kind: 'welcome' },

  { id: 'chori-pensamiento', kind: 'quote', station: 'chori', label: 'Estación 1 · El latido', tabs: chori('Pensamiento') },
  {
    id: 'chori-historia',
    kind: 'video',
    label: 'Estación 1 · Historia',
    video: { title: 'El latido', duration: '08:24', poster: p('6i3a4535', 'Un hombre navega en canoa', { focus: '55% 50%' }) },
    bar: '00:00 / 08:24',
    tabs: chori('Historia'),
  },
  { id: 'chori-galeria', kind: 'gallery', station: 'chori', label: 'Estación 1 · Galería', tabs: chori('Galería') },
  { id: 'chori-receta', kind: 'recipe', label: 'Estación 1 · Receta', tabs: chori('Receta') },
  { id: 'transicion-1', kind: 'transition', index: 0 },

  { id: 'atrato-pensamiento', kind: 'quote', station: 'atrato', label: 'Estación 2 · Gente del río', tabs: atrato('Pensamiento') },
  {
    id: 'atrato-historia',
    kind: 'video',
    label: 'Estación 2 · Historia',
    video: { title: 'Gente del río', duration: '11:20', poster: p('dji-0504', 'El malecón de Quibdó') },
    bar: '00:00 / 11:20',
    tabs: atrato('Historia'),
  },
  { id: 'atrato-galeria', kind: 'gallery', station: 'atrato', label: 'Estación 2 · Galería', tabs: atrato('Galería') },
  { id: 'transicion-2', kind: 'transition', index: 1 },

  { id: 'nuqui-pensamiento', kind: 'quote', station: 'nuqui', label: 'Estación 3 · El baile de las olas', tabs: nuqui('Pensamiento') },
  {
    id: 'nuqui-scrolly',
    kind: 'video',
    label: 'Estación 3 · Scrollytelling',
    video: { title: 'El baile de las olas', poster: p('6i3a3560', 'Una bailarina de amarillo sonríe', { focus: '50% 30%' }) },
  },
  {
    id: 'nuqui-historia',
    kind: 'video',
    label: 'Estación 3 · Historia',
    video: { title: 'El baile de las olas', poster: p('6i3a3497-mejorado-nr', 'El grupo de danza reunido', { focus: '50% 40%' }) },
    tabs: nuqui('Historia'),
  },
  { id: 'nuqui-galeria', kind: 'gallery', station: 'nuqui', label: 'Estación 3 · Galería', tabs: nuqui('Galería') },
  { id: 'transicion-3', kind: 'transition', index: 2 },

  { id: 'pangui-silencio', kind: 'silence', label: 'Estación 4 · El silencio' },
  {
    id: 'pangui-historia',
    kind: 'video',
    label: 'Estación 4 · Historia',
    video: { title: 'Marea alta, marea baja', duration: '12:30', tint: '#58509a' },
    tabs: pangui('Historia'),
  },
  { id: 'pangui-cantos', kind: 'songs', label: 'Estación 4 · 360 · Cantos', tabs: pangui('360 · Cantos') },
  {
    id: 'pangui-video-cancion',
    kind: 'video',
    label: 'Estación 4 · Video canción',
    video: { title: 'Video canción', tint: '#3f6b5c' },
    tabs: pangui('Video canción'),
  },
  {
    id: 'pangui-viche',
    kind: 'video',
    label: 'Estación 4 · Viche',
    video: { title: 'Viche curao, un regalo de la selva', tint: '#58509a' },
    tabs: pangui('Viche'),
  },
  { id: 'transicion-4', kind: 'transition', index: 3 },

  { id: 'cierre', kind: 'closing' },
];

export const pageIndex = (id: string) => pages.findIndex((pg) => pg.id === id);
