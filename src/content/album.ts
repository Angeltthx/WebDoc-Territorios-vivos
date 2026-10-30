// «Álbum musical» (pedido del cliente, 27/10/2026): el disco de Territorios Vivos, como su página de HearNow (la
// portada, el nombre, el artista y las canciones). Cada canción abre su video del webdoc; el enlace a Spotify llega
// después (mientras tanto, «muy pronto»). Las imágenes salen de npm run media:album.

export interface AlbumTrack {
  title: string;
  duration: string;
  /** Su video en YouTube (el mismo de la página del recorrido), si lo tiene. */
  youtube?: string;
}

export const album = {
  title: 'Territorios Vivos',
  subtitle: 'Relatos del Pacífico',
  artist: 'Pazifican Beats',
  cover: { src: '/media/album/portada-640.webp', srcSet: '/media/album/portada-640.webp 640w, /media/album/portada-1280.webp 1280w', alt: 'Portada del disco: Chachita y el equipo cantando en el estudio de grabación' },
  background: { src: '/media/album/estudio-1280.webp', srcSet: '/media/album/estudio-1280.webp 1280w, /media/album/estudio-2400.webp 2400w', alt: '' },
  // Las canciones y su duración, de la página de HearNow del cliente (30/10/2026).
  tracks: [
    { title: 'Marea alta, marea baja', duration: '6:25', youtube: 'RGco0eNnYv0' },
    { title: 'El baile de las olas', duration: '3:58', youtube: 'VlKEZqIWuUM' },
    { title: 'Un trago ’e viche', duration: '3:23', youtube: 'y3h28Hk0uk8' },
  ] as AlbumTrack[],
  /** Spotify: pendiente del enlace (pedido del cliente). */
  spotify: undefined as string | undefined,
};
