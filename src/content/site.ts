// Menú principal y redes sociales (ajustes del cliente, 29/09/2026).
// `to` lleva a una página del recorrido; sin `to` la opción se muestra como "próximamente".

export interface MenuItem {
  label: string;
  to?: string;
}

export const menu: MenuItem[] = [
  { label: 'Nuestra historia', to: 'inicio' },
  { label: 'Equipo' },
  { label: 'Making of' },
  { label: 'Blog' },
  { label: 'Llévate Nuquí' },
  { label: 'El Viche', to: 'pangui-viche' },
  { label: 'Vive y Reserva' },
  { label: 'Cuéntanos tu historia' },
];

export type SocialNetwork = 'youtube' | 'instagram' | 'tiktok';

/** Enlaces de prueba (no son las cuentas oficiales definitivas). */
export const social: { network: SocialNetwork; label: string; url?: string }[] = [
  { network: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@territoriosvivos' },
  { network: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/territorios_vivos/' },
  { network: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/tag/territoriosvivo' },
];
