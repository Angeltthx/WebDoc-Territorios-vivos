// El resto del Chocó en el mapa: pueblos de la costa al norte y al sur de Nuquí y, detrás de la serranía del Baudó,
// los del Atrato y el San Juan. Son puntos discretos: al pasar el mouse (o tocarlos) aparece su nombre.
//
// Coordenadas: OpenStreetMap (Nominatim), consultadas en octubre de 2026; de los municipios, el punto del pueblo
// cabecera (no el centro del territorio). Las subregiones son las cinco oficiales del Chocó, y con ellas se ubicarán
// las historias que mande la gente (cada municipio pertenece a una).

export type Subregion = 'Pacífico Norte' | 'Pacífico Sur' | 'Atrato' | 'San Juan' | 'Darién';

export interface ChocoPoint {
  id: string;
  name: string;
  kind: 'municipio' | 'corregimiento' | 'parque' | 'cerro' | 'playa' | 'cabo';
  lat: number;
  lon: number;
  subregion: Subregion;
  /** Municipio al que pertenece (en los municipios, es el mismo). */
  municipio?: string;
}

const m = (id: string, name: string, lat: number, lon: number, subregion: Subregion): ChocoPoint =>
  ({ id, name, kind: 'municipio', lat, lon, subregion, municipio: name });

export const CHOCO_POINTS: ChocoPoint[] = [
  // Costa norte (Pacífico Norte), de norte a sur.
  m('jurado', 'Juradó', 7.103169, -77.76232, 'Pacífico Norte'),
  m('bahia-solano', 'Bahía Solano', 6.224564, -77.40343, 'Pacífico Norte'),
  { id: 'el-valle', name: 'El Valle', kind: 'corregimiento', lat: 6.104202, lon: -77.42656, subregion: 'Pacífico Norte', municipio: 'Bahía Solano' },
  { id: 'utria', name: 'Parque Nacional Natural Utría', kind: 'parque', lat: 5.994606, lon: -77.34117, subregion: 'Pacífico Norte' },
  { id: 'morromico', name: 'Morromico', kind: 'playa', lat: 5.873466, lon: -77.2953, subregion: 'Pacífico Norte', municipio: 'Nuquí' },
  // Costa al sur de Coquí (Nuquí) y Baudó (Pacífico Sur).
  { id: 'jovi', name: 'Joví', kind: 'corregimiento', lat: 5.615605, lon: -77.38296, subregion: 'Pacífico Norte', municipio: 'Nuquí' },
  { id: 'guachalito', name: 'Guachalito', kind: 'playa', lat: 5.628702, lon: -77.40592, subregion: 'Pacífico Norte', municipio: 'Nuquí' },
  { id: 'termales', name: 'Termales', kind: 'corregimiento', lat: 5.606169, lon: -77.44128, subregion: 'Pacífico Norte', municipio: 'Nuquí' },
  { id: 'partado', name: 'Partadó', kind: 'corregimiento', lat: 5.596871, lon: -77.4552, subregion: 'Pacífico Norte', municipio: 'Nuquí' },
  { id: 'arusi', name: 'Arusí', kind: 'corregimiento', lat: 5.595341, lon: -77.47415, subregion: 'Pacífico Norte', municipio: 'Nuquí' },
  { id: 'cabo-corrientes', name: 'Cabo Corrientes', kind: 'cabo', lat: 5.480395, lon: -77.53943, subregion: 'Pacífico Sur' },
  { id: 'virudo', name: 'Virudó', kind: 'corregimiento', lat: 5.399466, lon: -77.40189, subregion: 'Pacífico Sur', municipio: 'Bajo Baudó' },
  { ...m('pizarro', 'Pizarro', 4.953752, -77.36678, 'Pacífico Sur'), municipio: 'Bajo Baudó' },
  { id: 'siviru', name: 'Sivirú', kind: 'corregimiento', lat: 4.8056, lon: -77.34244, subregion: 'Pacífico Sur', municipio: 'Bajo Baudó' },
  { ...m('docordo', 'Docordó', 4.258038, -77.36467, 'Pacífico Sur'), municipio: 'El Litoral del San Juan' },
  // Serranía y valle del Baudó.
  { id: 'alto-del-buey', name: 'Alto del Buey', kind: 'cerro', lat: 6.081154, lon: -77.28832, subregion: 'Atrato' },
  { ...m('pie-de-pato', 'Pie de Pató', 5.516015, -76.97428, 'Pacífico Sur'), municipio: 'Alto Baudó' },
  { ...m('puerto-meluk', 'Puerto Meluk', 5.192699, -76.95127, 'Pacífico Sur'), municipio: 'Medio Baudó' },
  // Atrato.
  m('quibdo', 'Quibdó', 5.691283, -76.65313, 'Atrato'),
  { id: 'tutunendo', name: 'Tutunendo', kind: 'corregimiento', lat: 5.744297, lon: -76.54077, subregion: 'Atrato', municipio: 'Quibdó' },
  { ...m('bete', 'Beté', 5.994886, -76.78227, 'Atrato'), municipio: 'Medio Atrato' },
  { ...m('bellavista', 'Bellavista', 6.557252, -76.88358, 'Atrato'), municipio: 'Bojayá' },
  { ...m('paimado', 'Paimadó', 5.483774, -76.73957, 'Atrato'), municipio: 'Río Quito' },
  m('lloro', 'Lloró', 5.499783, -76.54263, 'Atrato'),
  m('carmen-de-atrato', 'El Carmen de Atrato', 5.899266, -76.14245, 'Atrato'),
  // San Juan.
  m('certegui', 'Cértegui', 5.371904, -76.60857, 'San Juan'),
  m('tado', 'Tadó', 5.263378, -76.56212, 'San Juan'),
  m('istmina', 'Istmina', 5.159309, -76.68552, 'San Juan'),
  { ...m('andagoya', 'Andagoya', 5.096587, -76.69479, 'San Juan'), municipio: 'Medio San Juan' },
  m('condoto', 'Condoto', 5.092196, -76.65135, 'San Juan'),
  // Darién.
  m('riosucio', 'Riosucio', 7.436557, -77.11225, 'Darién'),
];

/** Nombre de cada subregión en el mapa: un rótulo tenue en su centro aproximado. */
export const SUBREGION_LABELS: { name: Subregion; lat: number; lon: number }[] = [
  { name: 'Pacífico Norte', lat: 6.45, lon: -77.3 },
  { name: 'Pacífico Sur', lat: 5.05, lon: -77.15 },
  { name: 'Atrato', lat: 6.05, lon: -76.6 },
  { name: 'San Juan', lat: 5.0, lon: -76.5 },
  { name: 'Darién', lat: 7.35, lon: -76.95 },
];

/** A qué subregión pertenece cada municipio (para ubicar las historias que lleguen). */
export const SUBREGION_OF: Record<string, Subregion> = {
  'Juradó': 'Pacífico Norte', 'Bahía Solano': 'Pacífico Norte', 'Nuquí': 'Pacífico Norte',
  'Bajo Baudó': 'Pacífico Sur', 'Alto Baudó': 'Pacífico Sur', 'Medio Baudó': 'Pacífico Sur', 'El Litoral del San Juan': 'Pacífico Sur',
  'Quibdó': 'Atrato', 'Atrato': 'Atrato', 'Lloró': 'Atrato', 'Bagadó': 'Atrato', 'Medio Atrato': 'Atrato', 'Bojayá': 'Atrato',
  'Río Quito': 'Atrato', 'El Carmen de Atrato': 'Atrato',
  'Istmina': 'San Juan', 'Tadó': 'San Juan', 'Condoto': 'San Juan', 'Cértegui': 'San Juan', 'Nóvita': 'San Juan',
  'Medio San Juan': 'San Juan', 'Río Iró': 'San Juan', 'Sipí': 'San Juan', 'San José del Palmar': 'San Juan',
  'Unión Panamericana': 'San Juan', 'El Cantón del San Pablo': 'San Juan',
  'Riosucio': 'Darién', 'Carmen del Darién': 'Darién', 'Belén de Bajirá': 'Darién', 'Unguía': 'Darién', 'Acandí': 'Darién',
};
