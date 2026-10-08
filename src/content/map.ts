// Mapa de prueba de la costa de Nuquí (mientras llega el GLB del diseñador).
// Los lugares, la fauna y la flora salen del afiche "Nuquí, Chocó" (map.jpg del cliente).
//
// Geografía real: los cinco pueblos van en sus coordenadas (GeoNames) y la costa, la llanura y las lomas
// salen del relieve SRTM (ver map-relief.ts). De Jurubidá a Coquí hay unos 30 km de costa:
//   Jurubidá → Tribugá 9,1 km · Tribugá → Nuquí 6,4 km · Nuquí → Panguí 6,9 km · Panguí → Coquí 8,5 km (en línea recta).
// Detrás de la playa hay una llanura de 2 a 4 km (hasta 7 km en el estero de Tribugá) y luego lomas de 150 a 470 m.
//
// Los sitios turísticos y las especies no tienen coordenadas publicadas: se ubican cerca de su pueblo,
// en el orden y el lado del afiche, con `along` (km por la costa, + hacia el sur) e `inland` (km desde
// la orilla, + tierra adentro, − mar adentro).

export type TownId = 'jurubida' | 'tribuga' | 'nuqui' | 'pangui' | 'coqui';

export interface MapPlace {
  id: string;
  name: string;
  /** Pueblo, sitio turístico o especie (fauna y flora) del afiche. */
  kind: 'town' | 'site' | 'nature';
  /** Posición: pueblo de referencia y desplazamiento en km. */
  at: { town: TownId; along: number; inland: number };
  /** Cuenta de Instagram que aparece en el afiche. */
  handle?: string;
  /** Pueblo más cercano. */
  near?: string;
  /** Nombre científico, tal como aparece en el afiche. */
  scientific?: string;
}

/** Coordenadas de los pueblos (GeoNames), de norte a sur. */
export const TOWNS: { id: TownId; name: string; lat: number; lon: number }[] = [
  { id: 'jurubida', name: 'Jurubidá', lat: 5.844327, lon: -77.277424 },
  { id: 'tribuga', name: 'Tribugá', lat: 5.76653, lon: -77.250511 },
  { id: 'nuqui', name: 'Nuquí', lat: 5.7125, lon: -77.270833 },
  { id: 'pangui', name: 'Panguí', lat: 5.663055, lon: -77.30907 },
  { id: 'coqui', name: 'Coquí', lat: 5.607215, lon: -77.361882 },
];

const town = (id: TownId, name: string): MapPlace => ({ id, name, kind: 'town', at: { town: id, along: 0, inland: 0.05 } });

export const MAP_PLACES: MapPlace[] = [
  town('jurubida', 'Jurubidá'),
  { id: 'kipara-te', name: 'Etnoaldea Kipara Té', kind: 'site', at: { town: 'jurubida', along: 0.6, inland: 2.2 }, handle: 'kiparatenuqui', near: 'Jurubidá' },
  { id: 'lobos-del-manglar', name: 'Lobos del Manglar', kind: 'site', at: { town: 'tribuga', along: -0.9, inland: 0.5 }, handle: 'lobosdelmanglar', near: 'Tribugá' },
  town('tribuga', 'Tribugá'),
  { id: 'vientos-de-yubarta', name: 'Vientos de Yubarta', kind: 'site', at: { town: 'nuqui', along: -1.3, inland: 0.45 }, handle: 'vientosdeyubarta', near: 'Nuquí' },
  { id: 'carlitours', name: 'Carlitours Nuquí', kind: 'site', at: { town: 'nuqui', along: -0.85, inland: 0.25 }, handle: 'carlitours.nuqui', near: 'Nuquí' },
  { id: 'museo-melele', name: 'Museo Melelé', kind: 'site', at: { town: 'nuqui', along: -0.4, inland: 0.35 }, handle: 'museo_melele', near: 'Nuquí' },
  town('nuqui', 'Nuquí'),
  { id: 'escombros-nuqui', name: 'Escombros del Mar', kind: 'site', at: { town: 'nuqui', along: 0.35, inland: 0.2 }, handle: 'escombrosdelmarhostal', near: 'Nuquí' },
  { id: 'las-serranias', name: 'Danza tradicional Las Serranías', kind: 'site', at: { town: 'nuqui', along: 1.0, inland: 0.15 }, handle: 'orfelinamarmolejo', near: 'Nuquí' },
  { id: 'posada-chachita', name: 'Posada ecoturística Chachita', kind: 'site', at: { town: 'pangui', along: -0.45, inland: 0.06 }, handle: 'posadaecoturisticachachita', near: 'Panguí' },
  town('pangui', 'Panguí'),
  { id: 'escombros-coqui', name: 'Escombros del Mar', kind: 'site', at: { town: 'coqui', along: -1.0, inland: 0.15 }, handle: 'escombrosdelmarhostal', near: 'Coquí' },
  { id: 'posada-sonona', name: 'Posada Sonona', kind: 'site', at: { town: 'coqui', along: -0.5, inland: 0.45 }, handle: 'sononaecolodge', near: 'Coquí' },
  town('coqui', 'Coquí'),
];

/** Fauna y flora ilustradas en el afiche. */
export const MAP_NATURE: MapPlace[] = [
  { id: 'ballena', name: 'Ballena jorobada', kind: 'nature', at: { town: 'jurubida', along: 3.2, inland: -2.4 }, scientific: 'Megaptera novaeangliae' },
  { id: 'cangrejo', name: 'Cangrejo fantasma rojo', kind: 'nature', at: { town: 'tribuga', along: 0.9, inland: 0.04 }, scientific: 'Ocypode gaudichaudii' },
  { id: 'tortuga', name: 'Tortuga golfina', kind: 'nature', at: { town: 'nuqui', along: -0.9, inland: -1.6 }, scientific: 'Lepidochelys olivacea' },
  { id: 'pava', name: 'Pava del Baudó', kind: 'nature', at: { town: 'nuqui', along: -1.9, inland: 0.3 }, scientific: 'Penelope ortoni' },
  { id: 'rana', name: 'Rana arlequín', kind: 'nature', at: { town: 'pangui', along: 0.7, inland: 0.3 }, scientific: 'Oophaga solanensis' },
  { id: 'manglar', name: 'Manglar', kind: 'nature', at: { town: 'coqui', along: -1.6, inland: 0.1 } },
  { id: 'cacao', name: 'Cacao', kind: 'nature', at: { town: 'coqui', along: 0.2, inland: 1.1 } },
];

/** Ríos: puntos [along, inland] en km desde la desembocadura, cerca de su pueblo; `width` en unidades de la escena. */
export const MAP_RIVERS: { id: string; town: TownId; width: number; path: [number, number][] }[] = [
  { id: 'jurubida', town: 'jurubida', width: 26, path: [[0.25, -0.08], [0.3, 0.4], [0.15, 0.9], [0.1, 1.6], [-0.1, 2.4]] },
  { id: 'tribuga', town: 'tribuga', width: 48, path: [[-0.3, -0.08], [-0.35, 0.5], [-0.2, 1.2], [-0.35, 2.0], [-0.2, 3.0], [-0.4, 4.0]] },
  { id: 'nuqui', town: 'nuqui', width: 34, path: [[0.65, -0.08], [0.7, 0.5], [0.55, 1.1], [0.75, 1.8], [0.6, 2.6]] },
  { id: 'pangui', town: 'pangui', width: 26, path: [[-0.9, -0.08], [-0.85, 0.5], [-1.0, 1.1], [-0.9, 1.8]] },
  { id: 'coqui', town: 'coqui', width: 26, path: [[0.3, -0.08], [0.35, 0.5], [0.25, 1.2], [0.4, 2.0]] },
];
