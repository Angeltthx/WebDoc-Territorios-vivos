// Las 20 páginas del webdoc, en el mismo orden del PDF de wireframes (v3, 10/09/2026).
// Cada página es una pantalla completa; se avanza con la flecha derecha.

import type { Photo, StationId, VideoAsset } from '../domain/types';

/** Pestaña visible en una página. `page` es el número de página al que lleva (si existe en el PDF). */
export interface TabSpec {
  label: string;
  page?: number;
  warm?: boolean;
}

export interface Tabs {
  items: TabSpec[];
  active: string;
}

const p = (id: string, alt: string, extra: Partial<Photo> = {}): Photo => ({ id, alt, ...extra });

// Pestañas por estación, tal como aparecen en el PDF.
const chori = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Cita', page: 2 },
    { label: 'El corto', page: 3 },
    { label: 'Galería', page: 4 },
    { label: 'Receta', page: 5 },
  ],
});
const atrato = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Cita', page: 7 },
    { label: 'El corto', page: 8 },
    { label: 'Galería', page: 9 },
  ],
});
const nuqui = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Scrolly', page: 12 },
    { label: 'Cita', page: 11 },
    { label: 'El corto' },
    { label: 'Galería', page: 13 },
  ],
});
const pangui = (active: string): Tabs => ({
  active,
  items: [
    { label: 'Silencio', page: 15 },
    { label: 'El corto', page: 16 },
    { label: '360', page: 17 },
    { label: 'Cantos', page: 17 },
    { label: 'Viche', page: 18, warm: true },
  ],
});

export type PageSpec =
  | { kind: 'welcome' }
  | { kind: 'quote'; station: StationId; label: string; tabs: Tabs }
  | { kind: 'video'; label: string; video: VideoAsset; tabs?: Tabs; bar?: string; closeTo?: number }
  | { kind: 'gallery'; station: StationId; label: string; tabs: Tabs }
  | { kind: 'recipe'; label: string; tabs: Tabs }
  | { kind: 'transition'; index: number }
  | { kind: 'silence'; label: string }
  | { kind: 'songs'; label: string; tabs: Tabs }
  | { kind: 'closing' };

export const pages: PageSpec[] = [
  /* 1 */ { kind: 'welcome' },
  /* 2 */ { kind: 'quote', station: 'chori', label: 'Estación 1 · El latido', tabs: chori('Cita') },
  /* 3 */ {
    kind: 'video',
    label: 'Estación 1 · El corto',
    video: { title: 'El latido', duration: '08:24', poster: p('6i3a4535', 'Un hombre navega en canoa', { focus: '55% 50%' }), tint: '#5d6b62' },
    bar: '03:07 / 08:24',
    tabs: chori('El corto'),
    closeTo: 2,
  },
  /* 4 */ { kind: 'gallery', station: 'chori', label: 'Estación 1 · Galería', tabs: chori('Galería') },
  /* 5 */ { kind: 'recipe', label: 'Estación 1 · Receta', tabs: chori('Receta') },
  /* 6 */ { kind: 'transition', index: 0 },
  /* 7 */ { kind: 'quote', station: 'atrato', label: 'Estación 2 · Gente del río', tabs: atrato('Cita') },
  /* 8 */ {
    kind: 'video',
    label: 'Estación 2 · El corto',
    video: { title: 'Gente del río', duration: '11:20', poster: p('dji-0504', 'El malecón de Quibdó'), tint: '#1f7a68' },
    bar: '04:56 / 11:20',
    tabs: atrato('El corto'),
    closeTo: 7,
  },
  /* 9 */ { kind: 'gallery', station: 'atrato', label: 'Estación 2 · Galería', tabs: atrato('Galería') },
  /* 10 */ { kind: 'transition', index: 1 },
  /* 11 */ { kind: 'quote', station: 'nuqui', label: 'Estación 3 · El baile de las olas', tabs: nuqui('Cita') },
  /* 12 */ {
    kind: 'video',
    label: 'Estación 3 · Scrollytelling',
    video: { title: 'El baile de las olas', poster: p('6i3a3560', 'Una bailarina de amarillo sonríe', { focus: '50% 30%' }), tint: '#5d6b52' },
  },
  /* 13 */ {
    kind: 'gallery',
    station: 'nuqui',
    label: 'Estación 3 · Galería',
    tabs: { active: 'Galería', items: [{ label: 'Cita', page: 11 }, { label: 'El corto' }, { label: 'Galería', page: 13 }] },
  },
  /* 14 */ { kind: 'transition', index: 2 },
  /* 15 */ { kind: 'silence', label: 'Estación 4 · El silencio' },
  /* 16 */ {
    kind: 'video',
    label: 'Estación 4 · El corto',
    video: { title: 'Marea alta, marea baja', duration: '12:30', tint: '#58509a' },
    tabs: pangui('El corto'),
    closeTo: 15,
  },
  /* 17 */ {
    kind: 'songs',
    label: 'Estación 4 · 360 · Cantos',
    tabs: { active: '360 · Cantos', items: [{ label: 'El corto', page: 16 }, { label: '360 · Cantos', page: 17 }, { label: 'Viche', page: 18 }] },
  },
  /* 18 */ {
    kind: 'video',
    label: 'Estación 4 · El corto',
    video: { title: 'Viche curao, un regalo de la selva', tint: '#58509a' },
    tabs: pangui('Viche'),
    closeTo: 15,
  },
  /* 19 */ { kind: 'transition', index: 3 },
  /* 20 */ { kind: 'closing' },
];
