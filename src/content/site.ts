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

/** Enlaces de las cuentas oficiales. Pendientes: el cliente debe enviar las direcciones. */
export const social: { network: SocialNetwork; label: string; url?: string }[] = [
  { network: 'youtube', label: 'YouTube' },
  { network: 'instagram', label: 'Instagram' },
  { network: 'tiktok', label: 'TikTok' },
];
