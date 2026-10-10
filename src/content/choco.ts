// El resto del Chocó en el mapa: pueblos de la costa al norte y al sur de Nuquí y, detrás de la serranía del Baudó,
// los del Atrato y el San Juan. Son puntos discretos: al pasar el mouse (o tocarlos) aparece su nombre.
//
// Coordenadas: OpenStreetMap (Nominatim), consultadas en octubre de 2026; de los municipios, el punto del pueblo
// cabecera (no el centro del territorio). Las subregiones son las cinco oficiales del Chocó, y con ellas se ubicarán
// las historias que mande la gente (cada municipio pertenece a una).

export type Subregion = 'Pacífico Norte' | 'Pacífico Sur' | 'Atrato' | 'San Juan' | 'Darién';

/**
 * Los seis tipos de figurita del mapa (ver map/emblems.ts). Los puntos del Chocó usan pueblo, selva o mar; las
 * historias que manden las personas se clasifican solas en uno de los seis según lo que cuentan (ver `categorize`).
 */
export type Emblem = 'pueblo' | 'selva' | 'mar' | 'rio' | 'cultura' | 'cocina';
export const EMBLEM_LABEL: Record<Emblem, string> = {
  pueblo: 'Pueblo', selva: 'Selva y monte', mar: 'Mar y playa', rio: 'Río', cultura: 'Música y fiesta', cocina: 'Cocina',
};

export interface ChocoPoint {
  id: string;
  name: string;
  kind: 'municipio' | 'corregimiento' | 'parque' | 'cerro' | 'playa' | 'cabo';
  lat: number;
  lon: number;
  subregion: Subregion;
  /** Municipio al que pertenece (en los municipios, es el mismo). */
  municipio?: string;
  /** Una línea para la ficha (solo datos generales y comprobables). */
  info?: string;
  /** Si es una historia (no un lugar): su tipo, que decide su figurita. */
  story?: Emblem;
  /** Su figurita en el mapa (los lugares; las historias usan la de su tipo). */
  figure?: Figure;
}

/**
 * La figurita de un punto: su escena principal (una ciudad, un pueblo cabecera, un caserío de casas en zancos, una
 * playa, selva, un cerro o un cabo) y detalles de lo que lo distingue (ver map/emblems.ts).
 */
export type FigureExtra = 'canoa' | 'lancha' | 'ballena' | 'cununo' | 'lluvia' | 'termal';
export interface Figure {
  main: 'ciudad' | 'cabecera' | 'rancho' | 'playa' | 'selva' | 'cerro' | 'cabo' | 'montana';
  extra?: FigureExtra[];
}

const m = (id: string, name: string, lat: number, lon: number, subregion: Subregion): ChocoPoint =>
  ({ id, name, kind: 'municipio', lat, lon, subregion, municipio: name });

export const CHOCO_POINTS: ChocoPoint[] = [
  // Costa norte (Pacífico Norte), de norte a sur.
  { ...m('jurado', 'Juradó', 7.103169, -77.76232, 'Pacífico Norte'), info: 'El municipio más al norte de la costa pacífica del Chocó, cerca de la frontera con Panamá.', figure: { main: 'cabecera', extra: ['lancha'] } },
  { ...m('bahia-solano', 'Bahía Solano', 6.224564, -77.40343, 'Pacífico Norte'), info: 'Su cabecera es Ciudad Mutis. Con Nuquí, uno de los lugares para ver las ballenas jorobadas entre julio y octubre.', figure: { main: 'cabecera', extra: ['ballena', 'lancha'] } },
  { id: 'el-valle', name: 'El Valle', kind: 'corregimiento', lat: 6.104202, lon: -77.42656, subregion: 'Pacífico Norte', municipio: 'Bahía Solano', info: 'Corregimiento de Bahía Solano, junto a la playa El Almejal.', figure: { main: 'rancho', extra: ['lancha'] } },
  { id: 'utria', name: 'Parque Nacional Natural Utría', kind: 'parque', lat: 5.994606, lon: -77.34117, subregion: 'Pacífico Norte', info: 'Parque nacional entre Bahía Solano y Nuquí: una ensenada rodeada de manglar y selva.', figure: { main: 'selva', extra: ['ballena'] } },
  { id: 'morromico', name: 'Morromico', kind: 'playa', lat: 5.873466, lon: -77.2953, subregion: 'Pacífico Norte', municipio: 'Nuquí', info: 'Playa al norte de Jurubidá, entre la selva y el mar.', figure: { main: 'playa' } },
  // Costa al sur de Coquí (Nuquí) y Baudó (Pacífico Sur).
  { id: 'jovi', name: 'Joví', kind: 'corregimiento', lat: 5.615605, lon: -77.38296, subregion: 'Pacífico Norte', municipio: 'Nuquí', info: 'Corregimiento de Nuquí, en la desembocadura del río Joví.', figure: { main: 'rancho', extra: ['canoa'] } },
  { id: 'guachalito', name: 'Guachalito', kind: 'playa', lat: 5.628702, lon: -77.40592, subregion: 'Pacífico Norte', municipio: 'Nuquí', info: 'Playa larga entre Coquí y Termales.', figure: { main: 'playa' } },
  { id: 'termales', name: 'Termales', kind: 'corregimiento', lat: 5.606169, lon: -77.44128, subregion: 'Pacífico Norte', municipio: 'Nuquí', info: 'Corregimiento de Nuquí que debe su nombre a sus aguas termales.', figure: { main: 'rancho', extra: ['termal'] } },
  { id: 'partado', name: 'Partadó', kind: 'corregimiento', lat: 5.596871, lon: -77.4552, subregion: 'Pacífico Norte', municipio: 'Nuquí', info: 'Corregimiento de Nuquí, camino a Cabo Corrientes.', figure: { main: 'rancho' } },
  { id: 'arusi', name: 'Arusí', kind: 'corregimiento', lat: 5.595341, lon: -77.47415, subregion: 'Pacífico Norte', municipio: 'Nuquí', info: 'Corregimiento de Nuquí, cerca de Cabo Corrientes.', figure: { main: 'rancho', extra: ['lancha'] } },
  { id: 'cabo-corrientes', name: 'Cabo Corrientes', kind: 'cabo', lat: 5.480395, lon: -77.53943, subregion: 'Pacífico Sur', info: 'La punta que cierra por el sur el golfo de Tribugá.', figure: { main: 'cabo' } },
  { id: 'virudo', name: 'Virudó', kind: 'corregimiento', lat: 5.399466, lon: -77.40189, subregion: 'Pacífico Sur', municipio: 'Bajo Baudó', info: 'Corregimiento de la costa de Bajo Baudó.', figure: { main: 'rancho', extra: ['lancha'] } },
  { ...m('pizarro', 'Pizarro', 4.953752, -77.36678, 'Pacífico Sur'), municipio: 'Bajo Baudó', info: 'Cabecera de Bajo Baudó, cerca de la desembocadura del río Baudó.', figure: { main: 'cabecera', extra: ['canoa'] } },
  { id: 'siviru', name: 'Sivirú', kind: 'corregimiento', lat: 4.8056, lon: -77.34244, subregion: 'Pacífico Sur', municipio: 'Bajo Baudó', info: 'Corregimiento de la costa de Bajo Baudó.', figure: { main: 'rancho' } },
  { ...m('docordo', 'Docordó', 4.258038, -77.36467, 'Pacífico Sur'), municipio: 'El Litoral del San Juan', info: 'Cabecera del Litoral del San Juan, en el delta del río San Juan.', figure: { main: 'cabecera', extra: ['canoa'] } },
  // Serranía y valle del Baudó.
  { id: 'alto-del-buey', name: 'Alto del Buey', kind: 'cerro', lat: 6.081154, lon: -77.28832, subregion: 'Atrato', info: 'Uno de los cerros más altos de la serranía del Baudó.', figure: { main: 'cerro' } },
  { ...m('pie-de-pato', 'Pie de Pató', 5.516015, -76.97428, 'Pacífico Sur'), municipio: 'Alto Baudó', info: 'Cabecera de Alto Baudó, a orillas del río Baudó.', figure: { main: 'cabecera', extra: ['canoa'] } },
  { ...m('puerto-meluk', 'Puerto Meluk', 5.192699, -76.95127, 'Pacífico Sur'), municipio: 'Medio Baudó', info: 'Cabecera de Medio Baudó, a orillas del río Baudó.', figure: { main: 'cabecera', extra: ['canoa'] } },
  // Atrato.
  { ...m('quibdo', 'Quibdó', 5.691283, -76.65313, 'Atrato'), info: 'La capital del Chocó, a orillas del río Atrato. Sus fiestas de San Pacho son Patrimonio Cultural Inmaterial de la Humanidad.', figure: { main: 'ciudad', extra: ['canoa', 'cununo'] } },
  { id: 'tutunendo', name: 'Tutunendo', kind: 'corregimiento', lat: 5.744297, lon: -76.54077, subregion: 'Atrato', municipio: 'Quibdó', info: 'Corregimiento de Quibdó, famoso por ser uno de los lugares más lluviosos del mundo.', figure: { main: 'rancho', extra: ['lluvia'] } },
  { ...m('bete', 'Beté', 5.994886, -76.78227, 'Atrato'), municipio: 'Medio Atrato', info: 'Cabecera de Medio Atrato, a orillas del río Atrato.', figure: { main: 'cabecera', extra: ['canoa'] } },
  { ...m('bellavista', 'Bellavista', 6.557252, -76.88358, 'Atrato'), municipio: 'Bojayá', info: 'Cabecera de Bojayá, a orillas del río Atrato.', figure: { main: 'cabecera', extra: ['canoa'] } },
  { ...m('paimado', 'Paimadó', 5.483774, -76.73957, 'Atrato'), municipio: 'Río Quito', info: 'Cabecera de Río Quito.', figure: { main: 'cabecera', extra: ['canoa'] } },
  { ...m('lloro', 'Lloró', 5.499783, -76.54263, 'Atrato'), info: 'Municipio del Atrato, entre los lugares más lluviosos del planeta.', figure: { main: 'cabecera', extra: ['lluvia'] } },
  { ...m('carmen-de-atrato', 'El Carmen de Atrato', 5.899266, -76.14245, 'Atrato'), info: 'Municipio en la cordillera Occidental, cerca del límite con Antioquia: un pueblo de montaña y clima frío.', figure: { main: 'montana' } },
  // San Juan.
  { ...m('certegui', 'Cértegui', 5.371904, -76.60857, 'San Juan'), info: 'Municipio de la subregión del San Juan.', figure: { main: 'cabecera' } },
  { ...m('tado', 'Tadó', 5.263378, -76.56212, 'San Juan'), info: 'Municipio a orillas del río San Juan.', figure: { main: 'cabecera', extra: ['canoa'] } },
  { ...m('istmina', 'Istmina', 5.159309, -76.68552, 'San Juan'), info: 'Municipio a orillas del río San Juan, el centro de su subregión.', figure: { main: 'ciudad', extra: ['canoa'] } },
  { ...m('andagoya', 'Andagoya', 5.096587, -76.69479, 'San Juan'), municipio: 'Medio San Juan', info: 'Cabecera de Medio San Juan, donde el río Condoto llega al San Juan.', figure: { main: 'cabecera', extra: ['canoa'] } },
  { ...m('condoto', 'Condoto', 5.092196, -76.65135, 'San Juan'), info: 'Municipio del San Juan, de larga tradición minera.', figure: { main: 'cabecera' } },
  // Darién.
  { ...m('riosucio', 'Riosucio', 7.436557, -77.11225, 'Darién'), info: 'Municipio del Darién, a orillas del río Atrato.', figure: { main: 'cabecera', extra: ['canoa'] } },
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

/**
 * Clasifica una historia en uno de los seis tipos según lo que cuenta (título y relato), para ponerle su figurita en
 * el mapa. Gana el tipo con más palabras encontradas; si no hay ninguna, «pueblo». El equipo puede cambiarlo al revisar.
 */
const WORDS: Record<Exclude<Emblem, 'pueblo'>, string[]> = {
  cocina: ['receta', 'cocin*', 'comida', 'comer', 'sabor', 'viche', 'arroz', 'pescado', 'coco', 'plátano', 'platano', 'sancocho', 'fogón', 'fogon', 'olla', 'dulce', 'borojó', 'borojo'],
  cultura: ['música', 'musica', 'canto', 'cantar', 'canción', 'cancion', 'baile', 'bail*', 'danza', 'fiesta', 'tambor', 'cununo', 'marimba', 'chirimía', 'chirimia', 'alabao', 'arrullo', 'tradición', 'tradicion', 'fiestas patronales', 'carnaval'],
  mar: ['mar', 'playa', 'ballena', 'pesc*', 'lancha', 'ola', 'tortuga', 'marea', 'bahía', 'bahia', 'golfo', 'arena'],
  rio: ['río', 'rio', 'quebrada', 'canoa', 'potrillo', 'champa', 'remo', 'atrato', 'san juan', 'baudó', 'baudo', 'corriente'],
  selva: ['selva', 'monte', 'árbol', 'arbol', 'bosque', 'pájaro', 'pajaro', 'rana', 'cerro', 'montaña', 'montana', 'lluvia', 'manglar', 'cacao', 'planta', 'mono', 'jaguar'],
};
export function categorize(text: string): Emblem {
  const t = ` ${text.toLowerCase()} `;
  let best: Emblem = 'pueblo';
  let most = 0;
  for (const [kind, words] of Object.entries(WORDS) as [Emblem, string[]][]) {
    // Palabra completa (con su plural); las que terminan en * valen como raíz (cocinar, cocinaba…).
    const n = words.filter((w) => new RegExp(w.endsWith('*') ? `[^a-záéíóúñü]${w.slice(0, -1)}` : `[^a-záéíóúñü]${w}(e?s)?[^a-záéíóúñü]`).test(t)).length;
    if (n > most) {
      most = n;
      best = kind;
    }
  }
  return best;
}
