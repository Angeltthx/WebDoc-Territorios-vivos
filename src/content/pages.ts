// Las páginas del webdoc, en el orden del PDF de wireframes (v3) con los ajustes del cliente
// (29/09/2026): "Cita" → "Pensamiento", "El corto" → "Historia" y sección "Video canción" en la estación 4;
// (30/09/2026): transición en video después del intro y galería en la estación 4;
// videos de HISTORIA de las estaciones 1 a 3 en streaming (public/media/historias).
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
    { label: 'Marea alta', to: 'pangui-marea-alta' },
    { label: 'Marea baja', to: 'pangui-marea-baja' },
    { label: 'Historia', to: 'pangui-historia' },
    { label: 'Galería', to: 'pangui-galeria' },
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
    label: 'Estación 1 · Historia',
    video: { title: 'El latido', stream: 'estacion-1' },
    tabs: chori('Historia'),
  },
  { id: 'chori-galeria', kind: 'gallery', station: 'chori', label: 'Estación 1 · Galería', tabs: chori('Galería') },
  { id: 'chori-receta', kind: 'recipe', label: 'Estación 1 · Receta', tabs: chori('Receta') },
  { id: 'transicion-1', kind: 'transition', index: 1 },

  { id: 'atrato-pensamiento', kind: 'quote', station: 'atrato', label: 'Estación 2 · Gente del río', tabs: atrato('Pensamiento') },
  {
    id: 'atrato-historia',
    kind: 'video',
    label: 'Estación 2 · Historia',
    video: { title: 'Gente del río', stream: 'estacion-2' },
    tabs: atrato('Historia'),
  },
  { id: 'atrato-galeria', kind: 'gallery', station: 'atrato', label: 'Estación 2 · Galería', tabs: atrato('Galería') },
  { id: 'transicion-2', kind: 'transition', index: 2 },

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
    video: { title: 'El baile de las olas', stream: 'estacion-3' },
    tabs: nuqui('Historia'),
  },
  { id: 'nuqui-galeria', kind: 'gallery', station: 'nuqui', label: 'Estación 3 · Galería', tabs: nuqui('Galería') },
  { id: 'transicion-3', kind: 'transition', index: 3 },

  // El silencio se divide en dos escenas, cada una con su propio sonido de marea.
  {
    id: 'pangui-marea-alta',
    kind: 'silence',
    tide: 'alta',
    label: 'Estación 4 · El silencio',
    title: 'Marea alta',
    hint: 'sin voz · solo la marea que sube',
    photo: p('6i3a4281', 'Una mujer toca las ramas del manglar', { focus: '55% 30%' }),
    tabs: pangui('Marea alta'),
  },
  {
    id: 'pangui-marea-baja',
    kind: 'silence',
    tide: 'baja',
    label: 'Estación 4 · El silencio',
    title: 'marea baja',
    hint: 'sin voz · solo la marea que baja',
    photo: p('6i3a5069', 'El manglar reflejado en el agua, con garzas', { focus: '50% 60%' }),
    tabs: pangui('Marea baja'),
  },
  {
    id: 'pangui-historia',
    kind: 'video',
    label: 'Estación 4 · Historia',
    video: { title: 'Marea alta, marea baja', duration: '12:30', tint: '#58509a' },
    tabs: pangui('Historia'),
  },
  { id: 'pangui-galeria', kind: 'gallery', station: 'pangui', label: 'Estación 4 · Galería', tabs: pangui('Galería') },
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
  { id: 'transicion-4', kind: 'transition', index: 4 },

  { id: 'cierre', kind: 'closing' },
];

export const pageIndex = (id: string) => pages.findIndex((pg) => pg.id === id);
