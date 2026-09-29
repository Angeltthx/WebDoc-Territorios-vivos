// Catálogo del webdoc "Relatos del Pacífico".
// Textos tomados de los wireframes v3 (10/09/2026). Lo que falta se marca como pendiente;
// no se inventan recetas, créditos ni guiones.

import type { Photo, Station, Transition } from '../domain/types';

const p = (id: string, alt: string, extra: Partial<Photo> = {}): Photo => ({ id, alt, ...extra });

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
      { kind: 'cita', label: 'Cita' },
      { kind: 'corto', label: 'El corto' },
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
      // Prueba: todas las fotografías de Contenido/ (29/09/2026). Se reemplazará por la selección final.
      photos: [
        p('6i3a3790-1', 'Un hombre y un niño pilan en un mortero de madera', { caption: 'Pilar en familia' }),
        p('6i3a3815-2', 'Una mujer siembra en una huerta elevada de madera', { caption: 'La huerta sobre el río' }),
        p('6i3a4017-1', 'Una mujer prepara alimentos junto al fogón', { caption: 'El fogón' }),
        p('6i3a3993-mejorado-nr-4', 'Una mujer embera junto a racimos de plátano', { caption: 'Plátano y fuego' }),
        p('6i3a3782', 'Retrato de Lizandro Dumasa', { caption: 'Lizandro Dumasa' }),
        p('dji-0181-2', 'Comunidad embera entre la selva, vista desde el aire', { caption: 'Chorí desde el aire', tag: 'dron' }),
        p('dji-0498', 'El río Atrato bajo un cielo de nubes', { caption: 'El río grande', tag: 'dron' }),
        p('dji-0504', 'El malecón de Quibdó sobre el Atrato', { caption: 'Quibdó', tag: 'dron' }),
        p('6i3a5673', 'Harold Vergara junto a las canoas', { caption: 'Harold Vergara' }),
        p('6i3a5677', 'Harold Vergara sentado sobre una canoa azul', { caption: 'Harold Vergara' }),
        p('ovidio-hinestroza-choncai-la-marea', 'Ovidio Hinestroza en su tienda de frutas', { caption: 'Ovidio Hinestroza · Choncai La Marea' }),
        p('6i3a3478', 'Orfelina Marmolejo abraza a una niña', { caption: 'Orfelina Marmolejo' }),
        p('6i3a3497-mejorado-nr', 'El grupo de danza reunido', { caption: 'El grupo de danza' }),
        p('6i3a3560', 'Una bailarina de amarillo sonríe', { caption: 'Danza' }),
        p('6i3a3563', 'Bailarinas con flores rojas en el cabello', { caption: 'Flores rojas' }),
        p('6i3a4376-1', 'Una cocinera en la playa', { caption: 'Cocina de playa' }),
        p('6i3a4535', 'Un pescador rema una canoa frente a una isla', { caption: 'Nuquí' }),
        p('6i3a4466-1', 'El mar abierto con una lancha a lo lejos', { caption: 'Mar abierto' }),
        p('6i3a5631-1', 'Un niño abraza a su perro en la playa', { caption: 'La playa' }),
        p('6i3a5048', 'Un hombre sonríe con un racimo al hombro', { caption: 'Cosecha' }),
        p('humpback-whale-s-tail-peeking-out-of-the-sea-in-summer', 'La cola de una ballena jorobada sobre el mar', { caption: 'Ballena jorobada' }),
        p('6i3a4281', 'Una mujer toca las ramas del manglar', { caption: 'El manglar' }),
        p('6i3a5069', 'El manglar reflejado en el agua, con garzas', { caption: 'Garzas en el manglar' }),
        p('6i3a5166-2', 'Dos mujeres preparan viche en una olla', { caption: 'Viche curao' }),
        p('6i3a5513', 'Una mujer frente al mar al atardecer', { caption: 'Atardecer' }),
        p('6i3a5623-1', 'Retrato de una mujer con turbante frente al mar', { caption: 'Frente al mar' }),
      ],
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
      { kind: 'cita', label: 'Cita' },
      { kind: 'corto', label: 'El corto' },
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
      photos: [
        p('6i3a5677', 'Harold Vergara sentado sobre una canoa azul', { caption: 'Harold Vergara' }),
        p('dji-0498', 'El Atrato bajo un cielo de nubes', { caption: 'El río grande', tag: 'dron' }),
        p('dji-0504', 'El malecón de Quibdó sobre el Atrato', { caption: 'Quibdó', tag: 'dron' }),
        p('ovidio-hinestroza-choncai-la-marea', 'Ovidio Hinestroza en su tienda de frutas', { caption: 'Ovidio Hinestroza · Choncai La Marea' }),
      ],
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
      { kind: 'cita', label: 'Cita' },
      { kind: 'corto', label: 'El corto' },
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
      photos: [
        p('6i3a3560', 'Una bailarina de amarillo sonríe', { caption: 'Danza' }),
        p('6i3a3563', 'Bailarinas con flores rojas en el cabello', { caption: 'Flores rojas' }),
        p('6i3a3497-mejorado-nr', 'El grupo de danza reunido', { caption: 'El grupo' }),
        p('6i3a4376-1', 'Una cocinera en la playa', { caption: 'Cocina de playa' }),
        p('6i3a5631-1', 'Un niño abraza a su perro en la playa', { caption: 'La playa' }),
        p('6i3a5048', 'Un hombre sonríe con un racimo al hombro', { caption: 'Cosecha' }),
      ],
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
      { kind: 'corto', label: 'El corto' },
      { kind: 'cantos', label: '360 · Cantos' },
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
    songs: {
      background: p('6i3a5069', 'El manglar reflejado en el agua, con garzas'),
      panorama: { title: 'Entrar al manglar 360°', sub: 'el que ella limpió' },
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

export const transitions: Transition[] = [
  {
    number: 1,
    from: 'Chorí',
    to: 'Atrato',
    symbol: 'wave',
    lines: ['…y otras aguas imponentes bajan por el río grande, el Atrato'],
    background: p('dji-0504', 'El malecón de Quibdó y el Atrato'),
    tint: 'rgba(10,25,30,.45)',
  },
  {
    number: 2,
    from: 'Atrato',
    to: 'Nuquí',
    symbol: 'rain',
    lines: ['…el agua sube al cielo y vuelve a caer, en Nuquí', 'bajo la lluvia, los pies descalzos aprenden a bailar'],
    hint: 'sigue bajando',
    color: '#3a8ade',
  },
  {
    number: 3,
    from: 'Nuquí',
    to: 'Panguí',
    symbol: 'meet',
    lines: ['…donde el agua dulce y la salada se encuentran, mi manglar'],
    color: '#3a8ade',
  },
  {
    number: 4,
    from: 'Panguí',
    to: 'Mar',
    symbol: 'sea',
    lines: ['…volver a las raíces. El agua se eleva y vuelve a empezar'],
    background: p('6i3a5513', 'Una mujer frente al mar al atardecer', { focus: '60% 60%' }),
    tint: 'rgba(22,70,48,.45)',
  },
];

export const welcome = {
  background: p('6i3a4535', 'Un pescador rema una canoa frente a una isla del Pacífico', { focus: '50% 60%' }),
};

export const closing = {
  background: p('6i3a4466-1', 'El mar abierto con una lancha a lo lejos'),
};

export const getStation = (id: string) => stations.find((s) => s.id === id);
