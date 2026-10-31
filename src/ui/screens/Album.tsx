// /album-musical: el disco de Territorios Vivos (pedido del cliente, 27/10/2026), fuera del recorrido, como El proyecto.
// La portada grande sobre la foto del estudio y, al lado, el nombre, el artista y las canciones: cada una suena aquí
// mismo (solo el audio, 30/10/2026), con su barra para adelantar, y al terminar sigue la siguiente. Sin controles del
// navegador ni menú del clic derecho, para que no se ofrezca descargarla. Spotify, cuando llegue el enlace.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { album } from '../../content/album';
import { CreditMark, SiteMenu, SocialLinks } from '../components/Chrome';

export default function AlbumScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [notice, setNotice] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    document.title = 'Territorios Vivos · Álbum musical';
  }, []);

  // La canción elegida: se carga y suena (el cambio de `src` lo hace React; aquí solo se le da play).
  useEffect(() => {
    if (current !== null) audio.current?.play().catch(() => setPaused(true));
  }, [current]);

  // Tocar la que suena la pausa o la sigue; tocar otra la empieza.
  const toggle = (i: number) => {
    const a = audio.current;
    if (!a) return;
    if (i !== current) {
      setTime(0);
      setLength(0);
      setCurrent(i);
    } else if (a.paused) a.play().catch(() => setPaused(true));
    else a.pause();
  };

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
            {album.tracks.map((t, i) => {
              const on = i === current;
              const sounding = on && !paused;
              return (
                <li key={t.title} className={on ? 'is-current' : undefined}>
                  <button type="button" className="album__track" onClick={() => toggle(i)} aria-pressed={sounding} aria-label={`${sounding ? 'Pausar' : 'Escuchar'} ${t.title}`}>
                    <span className="album__num">{i + 1}</span>
                    <span className="album__name">{t.title}</span>
                    <span className="album__time">{on && time > 0 ? `${clock(time)} / ${t.duration}` : t.duration}</span>
                    <svg className="album__play" viewBox="0 0 16 16" aria-hidden="true">{sounding ? <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /> : <path d="M4 2.5v11l9-5.5z" />}</svg>
                  </button>
                  {on && (
                    <input
                      className="album__seek"
                      type="range"
                      min={0}
                      max={length || 1}
                      step={0.1}
                      value={time}
                      onChange={(e) => {
                        if (audio.current) audio.current.currentTime = Number(e.target.value);
                      }}
                      style={{ '--done': `${length ? (time / length) * 100 : 0}%` } as CSSProperties}
                      aria-label={`Avanzar en ${t.title}`}
                      aria-valuetext={`${clock(time)} de ${t.duration}`}
                    />
                  )}
                </li>
              );
            })}
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

      <audio
        ref={audio}
        src={current !== null ? album.tracks[current].audio : undefined}
        preload="none"
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
        onEnded={() => (current !== null && current < album.tracks.length - 1 ? toggle(current + 1) : setCurrent(null))}
      />

      {notice && <p className="notice notice--float" role="status">Muy pronto en Spotify.</p>}
      <SiteMenu open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} />
      <div className="dock"><SocialLinks /></div>
      <CreditMark />
    </div>
  );
}

/** 125 → «2:05». */
function clock(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
