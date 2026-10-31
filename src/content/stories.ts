// «Cuéntanos tu historia»: lo que el formulario necesita saber del territorio.

/** Municipios del Chocó (para ubicar la historia; el lugar exacto va aparte, con texto o coordenadas). */
export const CHOCO_MUNICIPALITIES = [
  'Acandí', 'Alto Baudó', 'Atrato', 'Bagadó', 'Bahía Solano', 'Bajo Baudó', 'Belén de Bajirá', 'Bojayá',
  'Carmen del Darién', 'Cértegui', 'Condoto', 'El Cantón del San Pablo', 'El Carmen de Atrato', 'El Litoral del San Juan',
  'Istmina', 'Juradó', 'Lloró', 'Medio Atrato', 'Medio Baudó', 'Medio San Juan', 'Nóvita', 'Nuquí', 'Quibdó', 'Río Iró',
  'Río Quito', 'Riosucio', 'San José del Palmar', 'Sipí', 'Tadó', 'Unguía', 'Unión Panamericana',
];

/** Tope por archivo adjunto en la versión de prueba (el definitivo depende del almacenamiento que se elija). */
export const MAX_FILE_MB = 50;

/** Tienda: productos y precios de muestra, solo para ver la interfaz (los reales los define el cliente). Las fotos
 * salen de ../Contenido/Tienda con `npm run media:tienda`. */
export interface ShopItem {
  id: string;
  name: string;
  kind: string;
  /** Una frase para la tarjeta de la lista. */
  summary: string;
  /** La primera es la principal (la de la tarjeta); las demás, detalles para la galería. */
  photos: { src: string; thumb?: string; alt: string }[];
  /** Tamaños, cada uno con su precio. */
  /** Tamaños, cada uno con su precio y su SKU (el código con el que está en la base de datos: `productos`). El precio de
   * aquí es de respaldo: el que cobra es el de la base. */
  sizes: { id: string; sku: string; label: string; detail: string; price: number }[];
  description: string[];
  specs: [string, string][];
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'poster-mapa',
    name: 'Póster del mapa de Territorios Vivos',
    kind: 'Póster',
    summary: 'El mapa ilustrado de Nuquí, de Jurubidá a Coquí, con sus animales, su gente y sus lugares.',
    photos: [
      { src: '/media/tienda/poster-mapa.webp', thumb: '/media/tienda/poster-mapa-sm.webp', alt: 'El póster completo' },
      { src: '/media/tienda/poster-titulo.webp', alt: 'Detalle del título: Nuquí, Chocó' },
      { src: '/media/tienda/poster-ballena.webp', alt: 'Detalle: la ballena jorobada' },
      { src: '/media/tienda/poster-chachita.webp', alt: 'Detalle: Chachita, en Pangui' },
      { src: '/media/tienda/poster-rana.webp', alt: 'Detalle: la rana arlequín' },
    ],
    sizes: [
      { id: 'pliego', sku: 'poster-mapa-pliego', label: 'Pliego', detail: '70 × 100 cm', price: 50000 },
    ],
    description: [
      'El mismo mapa que acompaña el recorrido de Territorios Vivos, para tenerlo en la pared de la casa. La costa de Nuquí de norte a sur, con Jurubidá, Tribugá, Nuquí, Pangui y Coquí, y lo que vive en ella: la ballena jorobada, la tortuga golfina, el cangrejo fantasma, la pava del Baudó y la rana arlequín.',
      'Trae también los lugares y la gente que hacen turismo responsable en la zona, para que quien lo vea sepa a quién visitar.',
    ],
    specs: [
      ['Papel', 'Mate de 200 g'],
      ['Impresión', 'A todo color'],
      ['Empaque', 'En tubo de cartón, para que llegue sin dobleces'],
      ['Marco', 'No incluido'],
      ['Hecho en', 'Colombia'],
    ],
  },
];

export const pesos = (n: number) => `$ ${n.toLocaleString('es-CO')}`;
