// Hoja a pantalla completa sobre el mapa (la tienda, «Cuéntanos tu historia»): papel claro como la guía del webdoc.
// Dentro del mapa se cierra y vuelve a la costa tal como estaba; abierta por su propia dirección, vuelve al recorrido.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Arrow } from './Chrome';

/** Íconos de línea de la costa (mismo trazo que las flechas del recorrido). */
export function LineIcon({ name, size = 20 }: { name: 'help' | 'story' | 'shop'; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === 'help' && (
        <>
          <circle {...common} cx="12" cy="12" r="9" />
          <path {...common} d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7" />
          <circle cx="12" cy="17" r="1" fill="currentColor" />
        </>
      )}
      {name === 'story' && (
        <>
          <path {...common} d="M4 5.5h16v10H10l-4.5 3.5V15.5H4z" />
          <path {...common} d="M8 9h8M8 12h5" />
        </>
      )}
      {name === 'shop' && (
        <>
          <path {...common} d="M5 8h14l-1.2 11.5H6.2z" />
          <path {...common} d="M9 10V6.5a3 3 0 0 1 6 0V10" />
        </>
      )}
    </svg>
  );
}

/** Punto de la pantalla desde donde se abre la hoja (el botón que se tocó), en píxeles. */
export type Origin = { x: number; y: number };
/** Lo que dura la salida (ver `.sheet.is-leaving` en los estilos). */
const LEAVE_MS = 480;

export function Sheet({ eyebrow, title, intro, aside, onClose, children, origin, still, tone }: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  /** Lo que acompaña al título en el panel del atardecer (por ejemplo, los pasos de una historia). */
  aside?: ReactNode;
  /** Dentro del mapa: vuelve a la costa. Sin esto (dirección propia), un enlace al cierre del recorrido. */
  onClose?: () => void;
  children: ReactNode;
  /** Se abre como un círculo que crece desde aquí (y al cerrar se encoge hacia aquí). Sin esto, desde abajo al centro. */
  origin?: Origin;
  /** Sin la animación de entrada (al cambiar de una hoja a otra, como el formulario y su agradecimiento). */
  still?: boolean;
  /** Oscura, con letra blanca (como las páginas del recorrido), en vez de papel claro. */
  tone?: 'dark';
}) {
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onClose?.(), LEAVE_MS);
  };
  const at = { '--ox': origin ? `${origin.x}px` : '50%', '--oy': origin ? `${origin.y}px` : '100%' } as CSSProperties;
  // Mientras está abierta, los botones flotantes del webdoc (menú, sonido y redes) se esconden: tapaban el formulario.
  useEffect(() => {
    document.body.classList.add('has-sheet');
    return () => document.body.classList.remove('has-sheet');
  }, []);
  const back = (
    <>
      <Arrow dir="left" /> Volver al mapa
    </>
  );
  // A pantalla completa: a un lado el atardecer del mapa con el título (como la llegada a la costa), al otro el
  // contenido sobre papel claro. En el celular, el atardecer queda arriba.
  return (
    <div
      className={`sheet${tone ? ` sheet--${tone}` : ''}${leaving ? ' is-leaving' : ''}${still ? ' is-still' : ''}`}
      style={at}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      data-no-arrows
    >
      <header className="sheet__hero">
        {onClose ? (
          <button type="button" className="sheet__back" onClick={close}>{back}</button>
        ) : (
          <Link className="sheet__back" to="/27">{back}</Link>
        )}
        <div className="sheet__heading">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="sheet-title" className="sheet__title">{title}</h2>
          {intro && <p className="sheet__intro">{intro}</p>}
          {aside}
        </div>
      </header>
      <div className="sheet__body">{children}</div>
    </div>
  );
}
