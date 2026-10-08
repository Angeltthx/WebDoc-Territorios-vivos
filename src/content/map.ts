// Mapa de prueba de la costa de Nuquí (mientras llega el GLB del diseñador).
// Los lugares salen del afiche "Nuquí, Chocó" (map.jpg del cliente), en su orden de norte a sur.
// La costa se describe en píxeles del afiche (1000 × 1430): `py` es la altura en el afiche
// (norte arriba) y `inland` cuánto se mete el lugar tierra adentro desde la línea de costa.

export interface MapPlace {
  id: string;
  name: string;
  kind: 'town' | 'site';
  /** Altura en el afiche (norte → sur). */
  py: number;
  /** Distancia tierra adentro, en píxeles del afiche. */
  inland: number;
  /** Cuenta de Instagram que aparece en el afiche. */
  handle?: string;
  /** Pueblo más cercano. */
  near?: string;
}

/** Línea de costa del afiche: pares [py, px] (px = borde entre mar y tierra). */
export const COAST: [number, number][] = [
  [-600, 560],
  [30, 565],
  [150, 610],
  [300, 645],
  [450, 690],
  [520, 700],
  [600, 690],
  [700, 645],
  [780, 605],
  [860, 578],
  [950, 525],
  [1000, 478],
  [1060, 440],
  [1120, 360],
  [1180, 140],
  [1230, 60],
  [1900, 40],
];

export const MAP_PLACES: MapPlace[] = [
  { id: 'jurubida', name: 'Jurubidá', kind: 'town', py: 75, inland: 12 },
  { id: 'kipara-te', name: 'Etnoaldea Kipara Té', kind: 'site', py: 135, inland: 210, handle: 'kiparatenuqui', near: 'Jurubidá' },
  { id: 'lobos-del-manglar', name: 'Lobos del Manglar', kind: 'site', py: 445, inland: 55, handle: 'lobosdelmanglar', near: 'Tribugá' },
  { id: 'tribuga', name: 'Tribugá', kind: 'town', py: 535, inland: 12 },
  { id: 'vientos-de-yubarta', name: 'Vientos de Yubarta', kind: 'site', py: 745, inland: 105, handle: 'vientosdeyubarta', near: 'Nuquí' },
  { id: 'carlitours', name: 'Carlitours Nuquí', kind: 'site', py: 790, inland: 80, handle: 'carlitours.nuqui', near: 'Nuquí' },
  { id: 'museo-melele', name: 'Museo Melelé', kind: 'site', py: 835, inland: 58, handle: 'museo_melele', near: 'Nuquí' },
  { id: 'nuqui', name: 'Nuquí', kind: 'town', py: 866, inland: 12 },
  { id: 'escombros-nuqui', name: 'Escombros del Mar', kind: 'site', py: 925, inland: 44, handle: 'escombrosdelmarhostal', near: 'Nuquí' },
  { id: 'las-serranias', name: 'Danza tradicional Las Serranías', kind: 'site', py: 975, inland: 28, handle: 'orfelinamarmolejo', near: 'Nuquí' },
  { id: 'posada-chachita', name: 'Posada ecoturística Chachita', kind: 'site', py: 1030, inland: 16, handle: 'posadaecoturisticachachita', near: 'Panguí' },
  { id: 'pangui', name: 'Panguí', kind: 'town', py: 1070, inland: 12 },
  { id: 'escombros-coqui', name: 'Escombros del Mar', kind: 'site', py: 1205, inland: 34, handle: 'escombrosdelmarhostal', near: 'Coquí' },
  { id: 'posada-sonona', name: 'Posada Sonona', kind: 'site', py: 1260, inland: 70, handle: 'sononaecolodge', near: 'Coquí' },
  { id: 'coqui', name: 'Coquí', kind: 'town', py: 1310, inland: 12 },
];
