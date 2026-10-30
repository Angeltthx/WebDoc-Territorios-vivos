// Menú principal y redes sociales.
// El menú es la lista del cliente (19/10/2026): cada parada del recorrido y, dentro de cada estación, sus secciones.
// `to` lleva a una página del recorrido; `href`, a una dirección propia (la tienda, «Tu historia»).

export interface MenuItem {
  label: string;
  to?: string;
  href?: string;
  /** Secciones de una estación: se despliegan debajo de ella. */
  children?: MenuItem[];
}

export const menu: MenuItem[] = [
  { label: 'Bienvenida', to: 'inicio' },
  { label: 'Río Chorí', to: 'transicion-inicio' },
  {
    label: 'Estación 1 · El latido',
    to: 'chori-pensamiento',
    children: [
      { label: 'Tráiler historia', to: 'chori-historia' },
      { label: 'Galería', to: 'chori-galeria' },
      { label: 'Receta', to: 'chori-receta' },
    ],
  },
  { label: 'Río Atrato', to: 'transicion-1' },
  {
    label: 'Estación 2 · Gente del Río',
    to: 'atrato-pensamiento',
    children: [
      { label: 'Tráiler historia', to: 'atrato-historia' },
      { label: 'Galería', to: 'atrato-galeria' },
    ],
  },
  { label: 'Nuquí', to: 'transicion-2' },
  {
    label: 'Estación 3 · El baile de las olas',
    to: 'nuqui-pensamiento',
    children: [
      { label: 'Tráiler historia', to: 'nuqui-historia' },
      { label: 'Video canción', to: 'nuqui-video-cancion' },
      { label: 'Galería', to: 'nuqui-galeria' },
    ],
  },
  { label: 'Panguí', to: 'transicion-3' },
  {
    label: 'Estación 4 · Marea alta, marea baja',
    to: 'pangui-pensamiento',
    children: [
      { label: 'Tráiler historia', to: 'pangui-historia' },
      { label: 'Galería', to: 'pangui-galeria' },
      { label: 'Manglar - Cantos', to: 'pangui-cantos' },
      { label: 'Video canción', to: 'pangui-video-cancion' },
      { label: 'Un regalo de la selva', to: 'pangui-viche' },
    ],
  },
  { label: 'Volver a las raíces', to: 'transicion-4' },
  { label: 'Mapa interactivo', to: 'cierre' },
  // Las páginas del Canva del cliente (27/10/2026), fuera del recorrido.
  {
    label: 'El proyecto',
    href: '/el-proyecto',
    children: [
      { label: 'Equipo', href: '/el-proyecto/equipo' },
      { label: 'Making-of', href: '/el-proyecto/making-of' },
      { label: 'Blog', href: '/el-proyecto/blog' },
    ],
  },
  {
    label: 'Visita Nuquí',
    href: '/visita-nuqui',
    children: [
      { label: 'El viche', href: '/visita-nuqui/el-viche' },
      { label: 'Vive y reserva', href: '/visita-nuqui/vive-y-reserva' },
    ],
  },
  // El disco (pedido del cliente, 27/10/2026).
  { label: 'Álbum musical', href: '/album-musical' },
  { label: 'Tu historia', href: '/cuenta-tu-historia' },
  { label: 'Tienda', href: '/tienda' },
];

export type SocialNetwork = 'youtube' | 'instagram' | 'tiktok';

/** YouTube es el canal oficial (30/09/2026) y TikTok, la cuenta del cliente (27/10/2026); Instagram sigue siendo de prueba. */
export const social: { network: SocialNetwork; label: string; url?: string }[] = [
  { network: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/channel/UCOIVYoUtKmyV9HW7j-QgUfg' },
  { network: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/territorios_vivos/' },
  { network: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@territoriosvivos' },
];
