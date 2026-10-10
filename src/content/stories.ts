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

/** Tienda: productos y precios de muestra, solo para ver la interfaz (los reales los define el cliente). */
export interface ShopItem {
  id: string;
  name: string;
  kind: 'Afiches' | 'Ropa' | 'Papelería' | 'Hogar';
  price: number;
  /** Ícono del producto (dibujo de línea) y color de su tarjeta. */
  icon: 'poster' | 'shirt' | 'bag' | 'notebook' | 'postcard' | 'cup';
  color: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'afiche', name: 'Afiche Nuquí, Chocó', kind: 'Afiches', price: 45000, icon: 'poster', color: '#f2ae8a' },
  { id: 'postales', name: 'Postales del recorrido', kind: 'Papelería', price: 18000, icon: 'postcard', color: '#8cb8ee' },
  { id: 'camiseta', name: 'Camiseta Territorios Vivos', kind: 'Ropa', price: 60000, icon: 'shirt', color: '#5fc7a2' },
  { id: 'bolso', name: 'Bolso de tela', kind: 'Ropa', price: 38000, icon: 'bag', color: '#e2456f' },
  { id: 'libreta', name: 'Libreta de viaje', kind: 'Papelería', price: 25000, icon: 'notebook', color: '#e8bb52' },
  { id: 'taza', name: 'Taza del atardecer', kind: 'Hogar', price: 32000, icon: 'cup', color: '#6b97cd' },
];

export const pesos = (n: number) => `$ ${n.toLocaleString('es-CO')}`;
