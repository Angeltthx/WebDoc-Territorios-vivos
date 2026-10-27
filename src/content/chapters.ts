// Las páginas El proyecto y Visita Nuquí, del Canva del cliente (SLIDES COMPLETAS.pdf, 27/10/2026). Van fuera del
// recorrido, cada una con sus pestañas y «Volver al recorrido». Los textos son los del Canva; lo que aún no llegó
// (las entradas completas del blog, a dónde escribir o reservar) queda marcado como pendiente, sin inventarlo.
// Las imágenes nuevas del Canva están en ../Contenido/Proyecto (npm run media); las demás ya estaban en las galerías.

import type { Photo, VideoAsset } from '../domain/types';

const p = (id: string, alt: string, extra: Partial<Photo> = {}): Photo => ({ id, alt, ...extra });

/** Un botón de la página: a otra dirección de la web, a una página del recorrido o, si falta el dato, pendiente. */
export interface ChapterAction {
  label: string;
  href?: string;
  /** Id de una página del recorrido. */
  page?: string;
  /** Aún sin destino: al presionarlo se avisa que viene pronto. */
  pending?: boolean;
  primary?: boolean;
}

export type ChapterBody =
  | {
    kind: 'story';
    eyebrow: string;
    title: string;
    paragraphs: string[];
    photo: Photo;
    aside: { eyebrow: string; paragraphs: string[] };
  }
  | { kind: 'team'; eyebrow: string; people: { name: string; role: string }[]; thanks: { eyebrow: string; photos: Photo[] } }
  | { kind: 'video'; video: VideoAsset }
  | {
    kind: 'blog';
    eyebrow: string;
    title: string;
    meta: string;
    photo: Photo;
    paragraphs: string[];
    quote: string;
    more: { title: string; sub: string }[];
  }
  | { kind: 'feature'; eyebrow: string; title: string; text: string; actions: ChapterAction[] }
  | { kind: 'experiences'; eyebrow: string; items: { title: string; sub: string; action: ChapterAction }[] }
  | {
    kind: 'take';
    eyebrow: string;
    items: { title: string; text: string; image: { src: string; alt: string }; action: ChapterAction }[];
    note: string;
  };

export interface ChapterTab {
  slug: string;
  label: string;
  /** Fondo a pantalla completa; sin foto, `color`. */
  background?: Photo;
  color?: string;
  body: ChapterBody;
}

export interface Chapter {
  path: string;
  label: string;
  tabs: ChapterTab[];
}

export const chapters: Chapter[] = [
  {
    path: '/el-proyecto',
    label: 'El proyecto',
    tabs: [
      {
        slug: 'historia',
        label: 'Historia',
        background: p('proyecto-nuqui-aereo', 'Nuquí desde el aire, con la playa y las lanchas'),
        body: {
          kind: 'story',
          eyebrow: 'Cómo nació Territorios Vivos',
          title: 'La historia del proyecto y nuestro compromiso',
          paragraphs: [
            'Territorios Vivos nació de un viaje al Pacífico chocoano y de una convicción: que las historias de estos territorios debían contarse desde adentro, con las voces de quienes los habitan. Durante meses acompañamos a Chachita, Lizandro, Orfelina y Harold en Nuquí, Panguí, Bocas de Jagua y Quibdó, y entendimos que el agua —el río, la lluvia, la marea— era el hilo que unía todas sus historias.',
            'Este webdoc es el resultado de ese encuentro. No es un producto turístico ni un documental tradicional: es un puente entre quien mira desde lejos y un territorio vivo que respira, resiste y cuida.',
          ],
          photo: p('proyecto-playa-canoa', 'Una canoa verde en la playa, frente a las casas de madera y el muelle'),
          aside: {
            eyebrow: 'Nuestro compromiso',
            paragraphs: [
              'Nos comprometemos con un turismo responsable que retorne a las comunidades, respete sus tiempos y saberes, y no las convierta en paisaje. Cada visita, cada compra de viche, cada reserva llega directo a quien sostiene el territorio.',
              'Viajar con respeto es el corazón de este proyecto — y la invitación que dejamos en la guía.',
            ],
          },
        },
      },
      {
        slug: 'equipo',
        label: 'Equipo',
        background: p('proyecto-camara', 'Una cámara de cine graba una entrevista bajo un techo de madera'),
        body: {
          kind: 'team',
          eyebrow: 'El equipo de Doinmedia',
          people: [
            { name: 'Carolina Guerrero', role: 'Dirección' },
            { name: 'David García', role: 'Investigador - Guionista' },
            { name: 'Andrés Vitola', role: 'Producción de Campo' },
            { name: 'Cristian Alfonso', role: 'Director de fotografía' },
            { name: 'Julián Duarte', role: 'Editor' },
            { name: 'Ángel García', role: 'Desarrollador web y AR' },
            { name: 'Jorge Correa', role: 'Artista 3D' },
            { name: 'Oscar Pinilla', role: 'Ingeniero de Sonido' },
            { name: 'Julia Cubides', role: 'Ingeniera de Sonido' },
            { name: 'Nancy Quiroga “Nia”', role: 'Ilustradora' },
            { name: 'Cristian Garzón', role: 'Rigger 3D' },
            { name: 'Alonso', role: 'Animador 3D' },
            { name: 'Heydi Barbosa', role: 'Editora' },
            { name: 'José Hernando Guerrero', role: 'Director Financiero' },
            { name: 'Rosalba Durán', role: 'Asistente Contable' },
          ],
          thanks: {
            eyebrow: 'Quienes hicieron posible este proyecto',
            photos: [
              p('orfelina-y-familia-con-grupo-de-danza', 'Orfelina y su familia con el grupo de danza'),
              p('6i3a5193', 'Las mujeres de Panguí reunidas en el manglar'),
              p('6i3a3911', 'La comunidad embera del Chorí reunida'),
            ],
          },
        },
      },
      {
        slug: 'making-of',
        label: 'Making-of',
        background: p('proyecto-rio-aereo', 'Un río que serpentea entre la selva, visto desde el aire'),
        body: { kind: 'video', video: { title: 'Detrás de cámaras · Doinmedia en territorio', stream: 'making-of' } },
      },
      {
        slug: 'blog',
        label: 'Blog y créditos',
        background: p('dji-0460', 'La costa de Nuquí y la selva vistas desde el aire'),
        body: {
          kind: 'blog',
          eyebrow: 'Archivo vivo · Entrada de blog',
          title: 'El manglar que Chachita devolvió a la vida',
          meta: '12 de junio · por el equipo de Doinmedia · 4 min de lectura',
          photo: p('6i3a4308', 'Chachita entre las raíces del manglar', { focus: '50% 30%' }),
          paragraphs: [
            'Cuando llegamos a Panguí, el manglar era un basurero. Chachita llevaba años limpiándolo sola, convencida de que el agua salada y la dulce podían volver a encontrarse sin plástico de por medio. Este es el relato de cómo una mujer y un grupo de mayoras reconstruyeron, palmo a palmo, un ecosistema que el abandono había dado por perdido.',
          ],
          quote: '“El manglar es la casa de todo”, nos dijo. “Si él vive, nosotras vivimos.”',
          more: [
            { title: 'La danza como refugio', sub: 'Orfelina y las niñas de Nuquí' },
            { title: 'El río que tiene derechos', sub: 'el Atrato, sujeto de derechos' },
            { title: 'Gente de río', sub: 'los embera dóbida del Chorí' },
          ],
        },
      },
    ],
  },
  {
    path: '/visita-nuqui',
    label: 'Visita Nuquí',
    tabs: [
      {
        slug: 'llevate-nuqui',
        label: 'Llévate Nuquí',
        color: '#3b2c1c',
        body: {
          kind: 'take',
          eyebrow: 'Lo que te llevas a casa',
          items: [
            {
              title: 'El afiche-mapa con AR',
              text: 'Un objeto que cobra vida: apunta el móvil y aparece el video, la voz de Chachita, el 360.',
              image: { src: '/media/tienda/poster-mapa-sm.webp', alt: 'El afiche-mapa ilustrado de Nuquí' },
              action: { label: 'Comprar el afiche', href: '/tienda', primary: true },
            },
            {
              title: 'La guía de turismo sostenible',
              text: 'Preguntas de introspección, consejos para viajar con respeto y “tu propio Nuquí”.',
              image: { src: '/media/proyecto-guia-portada.webp', alt: 'La portada de la guía pedagógica' },
              // En el Canva dice «Descargar la guía»; la guía se lee en /guia, sin ofrecer el PDF (23/10/2026).
              action: { label: 'Ver la guía', href: '/guia', primary: true },
            },
          ],
          note: 'El afiche (papel) y la guía son los dos objetos que extienden el webdoc al mundo físico.',
        },
      },
      {
        slug: 'el-viche',
        label: 'El viche',
        background: p('6i3a5289', 'Chachita y una mujer en la playa de Panguí, junto a la casa de madera'),
        body: {
          kind: 'feature',
          eyebrow: 'El viche curao de Chachita',
          title: 'La experiencia del viche y su compra directa',
          text: 'Conoce el proceso, la medicina ancestral de las mayoras y adquiere el viche directamente de Chachita. El ingreso vuelve completo a la comunidad, sin intermediarios. Es la historia que Chachita nombra en su corto, hecha experiencia.',
          actions: [
            { label: 'Escríbele a Chachita', pending: true, primary: true },
            { label: 'Ver el proceso', page: 'pangui-viche' },
          ],
        },
      },
      {
        slug: 'vive-y-reserva',
        label: 'Vive y reserva',
        background: p('6i3a4466', 'El mar abierto al atardecer, con una lancha a lo lejos'),
        body: {
          kind: 'experiences',
          eyebrow: 'Experiencias en el territorio · Reserva directa',
          items: [
            { title: 'Manglares con Chachita · Panguí', sub: 'guianza, gastronomía y viche con las mujeres', action: { label: 'Reservar', pending: true } },
            { title: 'Río Chorí con Lizandro · Etnoaldea Kipará Té', sub: 'comunidad Embera, sendero y cascada', action: { label: 'Reservar', pending: true } },
            { title: 'Danza con Orfelina · Grupo Serranías del Porvenir', sub: 'muestra cultural y danza tradicional', action: { label: 'Reservar', pending: true } },
          ],
        },
      },
    ],
  },
];

export const chapterByPath = (path: string) => chapters.find((c) => c.path === path);
