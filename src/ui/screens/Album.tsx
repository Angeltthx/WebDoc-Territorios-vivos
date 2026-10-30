// /album-musical: el disco de Territorios Vivos (pedido del cliente, 27/10/2026), fuera del recorrido, como El proyecto.
// La portada grande sobre la foto del estudio y, al lado, el nombre, el artista y las canciones: cada una abre su video
// encima de la página. Spotify, cuando llegue el enlace.

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { album, type AlbumTrack } from '../../content/album';
import { CreditMark, SiteMenu, SocialLinks } from '../components/Chrome';

export default function AlbumScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [playing, setPlaying] = useState<AlbumTrack | null>(null);
  const [notice, setNotice] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    document.title = 'Territorios Vivos · Álbum musical';
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (playing && !d.open) d.showModal();
    if (!playing && d.open) d.close();
  }, [playing]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(false), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  // Se llegó desde otra página de la web: se vuelve a ella. Si se entró directo, a la bienvenida.
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));

  return (
    <div className="album-page">
      <img className="album-page__bg" src={album.background.src} srcSet={album.background.srcSet} sizes="100vw" alt="" aria-hidden="true" />
      <div className="topbar">
        <span className="chip">Álbum musical</span>
        <div className="topbar__right">
          <button type="button" className="ghost-link" onClick={back}><span aria-hidden="true">◇</span> Volver<span className="chapter__back-more"> al recorrido</span></button>
        </div>
      </div>

      <main className="album reveal">
        <img className="album__cover" src={album.cover.src} srcSet={album.cover.srcSet} sizes="(max-width: 900px) 72vw, 40vh" alt={album.cover.alt} />
        <div className="album__info">
          <h1 className="album__title">{album.title}<span>{album.subtitle}</span></h1>
          <p className="album__artist">{album.artist}</p>
          <ol className="album__tracks">
            {album.tracks.map((t, i) => (
              <li key={t.title}>
                <button type="button" className="album__track" disabled={!t.youtube} onClick={() => setPlaying(t)} aria-label={`Ver el video de ${t.title}`}>
                  <span className="album__num">{i + 1}</span>
                  <span className="album__name">{t.title}</span>
                  <span className="album__time">{t.duration}</span>
                  <svg className="album__play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
                </button>
              </li>
            ))}
          </ol>
          <div className="album__listen">
            {album.spotify ? (
              <a className="chapter-btn chapter-btn--primary" href={album.spotify} target="_blank" rel="noopener noreferrer">Escúchalo en Spotify</a>
            ) : (
              <button type="button" className="chapter-btn chapter-btn--primary" onClick={() => setNotice(true)}>Escúchalo en Spotify</button>
            )}
          </div>
        </div>
      </main>

      <dialog ref={dialog} className="lightbox album-video" aria-label={playing ? `Video: ${playing.title}` : 'Video'} onClose={() => setPlaying(null)} onClick={(e) => e.target === dialog.current && setPlaying(null)}>
        {playing?.youtube && (
          <div className="album-video__frame">
            <iframe
              src={`https://www.youtube.com/embed/${playing.youtube}?autoplay=1&rel=0&playsinline=1`}
              title={playing.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        )}
        <button type="button" className="icon-btn lightbox__close" onClick={() => setPlaying(null)} aria-label="Cerrar">✕</button>
      </dialog>

      {notice && <p className="notice notice--float" role="status">Muy pronto en Spotify.</p>}
      <SiteMenu open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} />
      <div className="dock"><SocialLinks /></div>
      <CreditMark />
    </div>
  );
}
