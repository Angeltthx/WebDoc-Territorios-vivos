// «Álbum musical» (pedido del cliente, 27/10/2026): el disco de Territorios Vivos, como su página de HearNow (la
// portada, el nombre, el artista y las canciones). Desde el 30/10/2026 cada canción suena aquí mismo, solo el audio
// (la clienta no quiere los videos); el enlace a Spotify llega después (mientras tanto, «muy pronto»). Las imágenes y
// las canciones salen de npm run media:album.

export interface AlbumTrack {
  title: string;
  duration: string;
  /** El MP3 de la canción (public/media/album). */
  audio: string;
}

export const album = {
  title: 'Territorios Vivos',
  subtitle: 'Relatos del Pacífico',
  artist: 'Pazifican Beats',
  cover: { src: '/media/album/portada-640.webp', srcSet: '/media/album/portada-640.webp 640w, /media/album/portada-1280.webp 1280w', alt: 'Portada del disco: Chachita y el equipo cantando en el estudio de grabación' },
  background: { src: '/media/album/estudio-1280.webp', srcSet: '/media/album/estudio-1280.webp 1280w, /media/album/estudio-2400.webp 2400w', alt: '' },
  // Los nombres, como los mandó la clienta con los audios (30/10/2026); la duración, la del máster.
  tracks: [
    { title: 'Marea alta, marea baja', duration: '6:25', audio: '/media/album/marea-alta.mp3' },
    { title: 'El baile de las olas', duration: '3:58', audio: '/media/album/baile-de-las-olas.mp3' },
    { title: 'Un regalo de la selva', duration: '3:23', audio: '/media/album/regalo-de-la-selva.mp3' },
  ] as AlbumTrack[],
  /** Spotify: pendiente del enlace (pedido del cliente). */
  spotify: undefined as string | undefined,
};
