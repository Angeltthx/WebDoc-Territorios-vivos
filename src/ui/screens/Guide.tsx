// /guia — la guía pedagógica del proyecto, para leerla aquí (a esta dirección lleva su QR). No se publica el PDF: cada
// página es una imagen (npm run media:guia) y el visor no ofrece descargarla ni guardarla. No es infalible —lo que se
// ve en pantalla siempre se puede capturar—, pero no deja un archivo a la mano para circular.
// Celular: una página debajo de otra, con pellizco para ampliar. Pantalla ancha: abierta como libro, en pliegos.

import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';

interface Manifest {
  carpeta: string;
  paginas: number;
  /** Ancho / alto de cada página. */
  proporcion: number;
}

const ROOT = '/media/guia';
const block = (e: SyntheticEvent) => e.preventDefault();

export default function Guide() {
  const [guide, setGuide] = useState<Manifest | null>(null);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // /media se guarda un año en caché: el índice se revalida siempre, para que una guía nueva aparezca de una vez.
    fetch(`${ROOT}/paginas.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setGuide, () => setFailed(true));
  }, []);

  // El número de página que se está leyendo: la que cruza la mitad de la pantalla.
  useEffect(() => {
    const root = scroller.current;
    if (!guide || !root) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setCurrent(Number((e.target as HTMLElement).dataset.page))),
      { root, rootMargin: '-50% 0px -50% 0px' },
    );
    root.querySelectorAll('[data-page]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [guide]);

  return (
    <div className="reader" ref={scroller} onContextMenu={block} onDragStart={block}>
      <header className="reader__bar">
        <Link className="reader__back" to="/">Inicio</Link>
        <p className="reader__title">Guía pedagógica</p>
        <p className="reader__count" aria-live="polite">{guide ? `${current} / ${guide.paginas}` : ''}</p>
      </header>

      {failed && <p className="reader__status">La guía no está disponible en este momento.</p>}
      {!guide && !failed && <p className="reader__status">Cargando la guía…</p>}

      {guide && (
        <div className="reader__pages" style={{ '--ratio': guide.proporcion } as CSSProperties}>
          {Array.from({ length: guide.paginas }, (_, i) => {
            const n = String(i + 1).padStart(2, '0');
            const base = `${ROOT}/${guide.carpeta}/${n}`;
            return (
              <figure key={n} className="reader__page" data-page={i + 1}>
                <img
                  src={`${base}.webp`}
                  srcSet={`${base}-sm.webp 800w, ${base}.webp 1600w`}
                  sizes="(min-width: 900px) min(44vw, 640px), 100vw"
                  alt={`Página ${i + 1} de la guía`}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  draggable={false}
                />
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
