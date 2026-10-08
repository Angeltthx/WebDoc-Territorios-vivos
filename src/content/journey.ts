// Catálogo del webdoc "Relatos del Pacífico".
// Textos tomados de los wireframes v3 (10/09/2026). Lo que falta se marca como pendiente;
// no se inventan recetas, créditos ni guiones.

import type { Photo, Station, Transition } from '../domain/types';
import galleries from './galleries.json';

const p = (id: string, alt: string, extra: Partial<Photo> = {}): Photo => ({ id, alt, ...extra });

// Galerías: la selección del cliente por estación (30/09/2026), en src/content/galleries.json,
// generado por `npm run media` desde ../Contenido/Galerias/estacion-N.
// Las fotos ya descritas conservan su texto; las demás llevan uno genérico hasta el inventario editorial.
const DESCRIBED: Record<string, Pick<Photo, 'alt' | 'caption' | 'tag'>> = {
  '6i3a3478': { alt: 'Orfelina Marmolejo abraza a una niña', caption: 'Orfelina Marmolejo' },
  '6i3a3497-mejorado-nr': { alt: 'El grupo de danza reunido', caption: 'El grupo de danza' },
  '6i3a3560': { alt: 'Una bailarina de amarillo sonríe', caption: 'Danza' },
  '6i3a3563': { alt: 'Bailarinas con flores rojas en el cabello', caption: 'Flores rojas' },
  '6i3a3782': { alt: 'Retrato de Lizandro Dumasa', caption: 'Lizandro Dumasa' },
  '6i3a3790': { alt: 'Un hombre y un niño pilan en un mortero de madera', caption: 'Pilar en familia' },
  '6i3a3815': { alt: 'Una mujer siembra en una huerta elevada de madera', caption: 'La huerta sobre el río' },
  '6i3a3993-mejorado-nr': { alt: 'Una mujer embera junto a racimos de plátano', caption: 'Plátano y fuego' },
  '6i3a4017': { alt: 'Una mujer prepara alimentos junto al fogón', caption: 'El fogón' },
  '6i3a4281': { alt: 'Una mujer toca las ramas del manglar', caption: 'El manglar' },
  '6i3a4376': { alt: 'Una cocinera en la playa', caption: 'Cocina de playa' },
  '6i3a4466': { alt: 'El mar abierto con una lancha a lo lejos', caption: 'Mar abierto' },
  '6i3a4535': { alt: 'Un pescador rema una canoa frente a una isla', caption: 'Nuquí' },
  '6i3a5048': { alt: 'Un hombre sonríe con un racimo al hombro', caption: 'Cosecha' },
  '6i3a5069': { alt: 'El manglar reflejado en el agua, con garzas', caption: 'Garzas en el manglar' },
  '6i3a5166': { alt: 'Dos mujeres preparan viche en una olla', caption: 'Viche curao' },
  '6i3a5513': { alt: 'Una mujer frente al mar al atardecer', caption: 'Atardecer' },
  '6i3a5623': { alt: 'Retrato de una mujer con turbante frente al mar', caption: 'Frente al mar' },
  '6i3a5631': { alt: 'Un niño abraza a su perro en la playa', caption: 'La playa' },
  '6i3a5673': { alt: 'Harold Vergara junto a las canoas', caption: 'Harold Vergara' },
  '6i3a5677': { alt: 'Harold Vergara sentado sobre una canoa azul', caption: 'Harold Vergara' },
  'dji-0181': { alt: 'Comunidad embera entre la selva, vista desde el aire', caption: 'Chorí desde el aire', tag: 'dron' },
  'dji-0498': { alt: 'El río Atrato bajo un cielo de nubes', caption: 'El río grande', tag: 'dron' },
  'dji-0504': { alt: 'El malecón de Quibdó sobre el Atrato', caption: 'Quibdó', tag: 'dron' },
  'humpback-whale-s-tail-peeking-out-of-the-sea-in-summer': { alt: 'La cola de una ballena jorobada sobre el mar', caption: 'Ballena jorobada' },
  'ovidio-hinestroza-choncai-la-marea': { alt: 'Ovidio Hinestroza en su tienda de frutas', caption: 'Ovidio Hinestroza · Choncai La Marea' },
};

const PLACES: Record<string, string> = {
  'estacion-1': 'Chorí', 'estacion-2': 'Atrato', 'estacion-3': 'Nuquí', 'estacion-4': 'Panguí',
};

const gallery = (key: keyof typeof galleries): Photo[] =>
  galleries[key].map((id, i) => {
    const d = DESCRIBED[id.replace(/-\d{1,2}$/, '')];
    const drone = id.startsWith('dji-');
    return { id, alt: d?.alt ?? `${PLACES[key]} · fotografía ${i + 1}${drone ? ', vista desde el aire' : ''}`, caption: d?.caption, tag: d?.tag ?? (drone ? 'dron' : undefined) };
  });

export const stations: Station[] = [
  {
    id: 'chori',
    number: 1,
    name: 'El latido',
    place: 'Chorí',
    accent: '#7fb77e',
    illustration: 'bosque-circulo',
    background: p('dji-0181-2', 'Comunidad embera entre la selva, vista desde el aire'),
    quote: {
      text: 'Embera dóbida significa gente de río, gente que vive a la orilla del río',
      author: 'Lizandro Dumasa',
      portrait: p('6i3a3782', 'Retrato de Lizandro Dumasa', { focus: '62% 35%' }),
    },
    sections: [
      { kind: 'pensamiento', label: 'Pensamiento' },
      { kind: 'historia', label: 'Tráiler historia' },
      { kind: 'galeria', label: 'Galería' },
      { kind: 'receta', label: 'Receta' },
    ],
    video: {
      title: 'El latido',
      duration: '08:24',
      poster: p('6i3a3790-1', 'Un hombre y un niño pilan en un mortero de madera'),
    },
    gallery: {
      intro: 'La comunidad embera dóbida',
      background: p('dji-0181-2', 'Comunidad embera entre la selva, vista desde el aire'),
      photos: gallery('estacion-1'),
    },
    recipe: {
      eyebrow: 'Gastronomía embera',
      title: 'Un plato del territorio, paso a paso — con los productos del río',
      hero: p('6i3a3993-mejorado-nr-4', 'Una mujer embera sentada junto a racimos de plátano y un fogón', { focus: '40% 40%' }),
      steps: [
        p('6i3a4017-1', 'Preparación junto al fogón'),
        p('6i3a3790-1', 'Pilar el grano en el mortero'),
      ],
    },
  },
  {
    id: 'atrato',
    number: 2,
    name: 'Gente del río',
    place: 'Atrato',
    accent: '#8fb6d9',
    illustration: 'rana-con-circulo',
    background: p('dji-0504', 'Quibdó y el río Atrato desde el aire'),
    quote: {
      text: 'El Río Atrato fue declarado sujeto de derecho, para que este río tenga vida',
      author: 'Harold Vergara',
      portrait: p('6i3a5673', 'Retrato de Harold Vergara junto a las canoas', { focus: '50% 35%' }),
    },
    sections: [
      { kind: 'pensamiento', label: 'Pensamiento' },
      { kind: 'historia', label: 'Tráiler historia' },
      { kind: 'galeria', label: 'Galería' },
    ],
    video: {
      title: 'Gente del río',
      duration: '11:20',
      poster: p('dji-0498', 'El río Atrato bajo un cielo abierto'),
    },
    gallery: {
      intro: 'Quibdó desde el aire y las calles',
      background: p('dji-0504', 'Quibdó y el río Atrato desde el aire'),
      photos: gallery('estacion-2'),
    },
  },
  {
    id: 'nuqui',
    number: 3,
    name: 'El baile de las olas',
    place: 'Nuquí',
    accent: '#e8bb52',
    illustration: 'pava-circulo',
    background: p('6i3a4535', 'Un pescador rema una canoa frente a una isla'),
    quote: {
      text: 'La danza es un arte muy sano, hace que la cultura reviva',
      author: 'Orfelina Marmolejo',
      portrait: p('6i3a3478', 'Orfelina Marmolejo abraza a una niña', { focus: '45% 30%' }),
    },
    sections: [
      { kind: 'scrolly', label: 'Scrolly' },
      { kind: 'pensamiento', label: 'Pensamiento' },
      { kind: 'historia', label: 'Tráiler historia' },
      { kind: 'video-cancion', label: 'Video canción' },
      { kind: 'galeria', label: 'Galería' },
    ],
    video: {
      title: 'El baile de las olas',
      poster: p('6i3a3497-mejorado-nr', 'El grupo de danza posa con sus trajes'),
    },
    scrolly: {
      scenes: [
        { photo: p('6i3a4535', 'Un pescador rema frente a una isla en Nuquí'), text: 'El agua sube al cielo y vuelve a caer, en Nuquí.' },
        { photo: p('6i3a3560', 'Una bailarina de amarillo sonríe'), text: 'Bajo la lluvia, los pies descalzos aprenden a bailar.' },
        { photo: p('6i3a3563', 'Bailarinas con flores rojas en el cabello'), text: 'La danza es un arte muy sano, hace que la cultura reviva.' },
        { photo: p('6i3a3497-mejorado-nr', 'El grupo de danza reunido'), text: 'Texto de la escena pendiente del guion.' },
      ],
    },
    gallery: {
      intro: 'Danza y comunidad',
      background: p('6i3a3563', 'Bailarinas con flores rojas en el cabello'),
      photos: gallery('estacion-3'),
    },
  },
  {
    id: 'pangui',
    number: 4,
    name: 'El silencio',
    place: 'Panguí',
    accent: '#9d93dc',
    illustration: 'manglar-con-circulo',
    background: p('6i3a4281', 'Una mujer toca las ramas del manglar'),
    quote: {
      text: 'Marea alta, marea baja',
      author: 'Panguí',
      portrait: p('6i3a4281', 'Una mujer toca las ramas del manglar'),
    },
    sections: [
      { kind: 'silencio', label: 'Silencio' },
      { kind: 'historia', label: 'Tráiler historia' },
      { kind: 'galeria', label: 'Galería' },
      { kind: 'cantos', label: '360 · Cantos' },
      { kind: 'video-cancion', label: 'Video canción' },
      { kind: 'viche', label: 'Viche' },
    ],
    silence: {
      title: 'Marea alta, marea baja',
      hint: 'el sonido baja · solo la marea',
      photo: p('6i3a4281', 'Una mujer toca las ramas del manglar', { focus: '55% 30%' }),
    },
    video: {
      title: 'Marea alta, marea baja',
      duration: '12:30',
      tint: '#58509a',
    },
    gallery: {
      intro: 'Marea alta, marea baja',
      background: p('6i3a5069', 'El manglar reflejado en el agua, con garzas'),
      photos: gallery('estacion-4'),
    },
    songs: {
      background: p('6i3a5069', 'El manglar reflejado en el agua, con garzas'),
      panorama: {
        title: 'Entrar al manglar 360°',
        sub: 'el que ella limpió',
        src: '/media/360/manglar/master.m3u8',
        poster: '/media/360/manglar/poster.webp',
        label: 'Estación 4 · Manglar 360°',
      },
      songs: [
        { title: 'Llorilé', sub: 'Chachita canta' },
        { title: 'morenitanuquiseña', sub: 'Chachita canta' },
      ],
    },
    viche: {
      title: 'Viche curao, un regalo de la selva',
      poster: p('6i3a5166-2', 'Dos mujeres preparan viche en una olla'),
      tint: '#58509a',
    },
  },
];

// Transiciones con los videos del cliente (Contenido/Transiciones). Desde el 05/10/2026 cada video trae
// la voz de Chachita integrada y sincronizada, por eso ya no se superpone `voice` (salvo en la
// transición 2, que no se actualizó); tampoco se agregan olas.
// `video: 'tN'` → public/media/transiciones/tN-{1080,720}.mp4 (también 'intro' y 'cierre').
export const transitions: Transition[] = [
  {
    number: 0,
    label: 'Intro · Chachita te recibe',
    from: 'Portada',
    to: 'Panguí',
    symbol: 'wave',
    lines: [],
    video: 'intro',
  },
  {
    number: 1,
    from: 'Inicio',
    to: 'Chorí',
    symbol: 'wave',
    // Texto de la transición del intro: pendiente (está en el Canva del cliente).
    lines: [],
    video: 't1',
  },
  {
    number: 2,
    from: 'Chorí',
    to: 'Atrato',
    symbol: 'wave',
    lines: ['…y otras aguas imponentes bajan por el río grande, el Atrato'],
    video: 't2',
    // El video de la transición 2 llegó sin cambios el 05/10/2026 (sin voz integrada): se conserva la voz aparte.
    voice: 'y',
  },
  {
    number: 3,
    from: 'Atrato',
    to: 'Nuquí',
    symbol: 'rain',
    lines: ['…el agua sube al cielo y vuelve a caer, en Nuquí', 'bajo la lluvia, los pies descalzos aprenden a bailar'],
    video: 't3',
  },
  {
    number: 4,
    from: 'Nuquí',
    to: 'Panguí',
    symbol: 'meet',
    lines: ['…donde el agua dulce y la salada se encuentran, mi manglar'],
    video: 't4',
  },
  {
    number: 5,
    from: 'Panguí',
    to: 'Mar',
    symbol: 'sea',
    lines: ['…volver a las raíces. El agua se eleva y vuelve a empezar'],
    video: 'cierre',
  },
];

/** Voz de Chachita antes del Viche (la del intro ya viene en su video). */
export const voices = { viche: 'x' };

export const welcome = {
  background: p('6i3a4535', 'Un pescador rema una canoa frente a una isla del Pacífico', { focus: '50% 60%' }),
};

export const closing = {
  background: p('6i3a4466-1', 'El mar abierto con una lancha a lo lejos'),
};

export const getStation = (id: string) => stations.find((s) => s.id === id);
