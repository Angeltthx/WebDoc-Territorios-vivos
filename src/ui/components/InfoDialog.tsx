// Ventanas pequeñas de información (pedido del cliente, 09/11/2026): qué es Territorios Vivos, la sinopsis de cada
// documental y la infografía «Cómo llegar» de cada estación. Se montan en <body> (ver Portal) y se cierran con la ✕,
// con Escape o tocando fuera.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Station } from '../../domain/types';
import { Portal } from './Portal';

export function InfoDialog({ open, onClose, label, className = '', children }: {
  open: boolean;
  onClose: () => void;
  /** Nombre de la ventana para los lectores de pantalla. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <Portal>
      <dialog ref={ref} className={`info ${className}`} aria-label={label} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
        {/* Solo con la ventana abierta: la infografía no se descarga hasta que alguien la pide. */}
        {open && <div className="info__body">{children}</div>}
        <button type="button" className="icon-btn info__close" onClick={onClose} aria-label="Cerrar">✕</button>
      </dialog>
    </Portal>
  );
}

/** Ícono de ubicación (el alfiler de los mapas). */
function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 18s5.5-5.2 5.5-9.6A5.5 5.5 0 0 0 4.5 8.4C4.5 12.8 10 18 10 18Z" />
      <circle cx="10" cy="8.3" r="2" />
    </svg>
  );
}

/** «Cómo llegar»: un círculo con el alfiler que abre la infografía de la estación. */
export function HowToArrive({ station }: { station: Station }) {
  const [open, setOpen] = useState(false);
  if (!station.howTo) return null;
  const title = `Cómo llegar a ${station.howTo.place}`;
  return (
    <>
      <button type="button" className="howto" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="howto__icon"><PinIcon /></span>
        <span className="howto__text">Cómo llegar <small>a {station.howTo.place}</small></span>
      </button>
      <InfoDialog open={open} onClose={() => setOpen(false)} label={title} className="info--poster">
        <img src={`/media/infografias/${station.howTo.image}.webp`} alt={`Infografía: ${title}, Nuquí, Chocó`} width={1080} height={5480} />
      </InfoDialog>
    </>
  );
}

/** Qué es Territorios Vivos (texto del cliente, 09/11/2026). */
const ABOUT =
  'Territorios Vivos, relatos del Pacífico, es una invitación del territorio para vivir un turismo consciente, responsable y comunitario a través de las historias de personas que por años han conservado sus tradiciones, cultura y biodiversidad en Nuquí, Chocó.';

const ABOUT_SEEN = 'tv-que-es-visto';

/**
 * El ícono de información, en todas las páginas del recorrido: abre un cuadro que cuenta qué es Territorios Vivos.
 * Más llamativo (pedido del 09/11/2026), con el mismo botón: la «i» más gruesa y, hasta que se abra la
 * primera vez, dorada y con un halo que palpita alrededor. Después queda como los demás (se recuerda en este navegador).
 */
export function AboutButton() {
  const [open, setOpen] = useState(false);
  const [calling, setCalling] = useState(() => {
    try {
      return !localStorage.getItem(ABOUT_SEEN);
    } catch {
      return true;
    }
  });
  const show = () => {
    setOpen(true);
    setCalling(false);
    try {
      localStorage.setItem(ABOUT_SEEN, '1');
    } catch {
      // Sin almacenamiento: el halo vuelve la próxima vez.
    }
  };
  return (
    <>
      <button type="button" className={`dock__sound dock__about${calling ? ' is-calling' : ''}`} onClick={show} aria-haspopup="dialog" aria-label="¿Qué es Territorios Vivos?" title="¿Qué es Territorios Vivos?">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M10 9v5.8" />
          <circle cx="10" cy="5.4" r="0.9" fill="currentColor" />
        </svg>
      </button>
      <InfoDialog open={open} onClose={() => setOpen(false)} label="¿Qué es Territorios Vivos?" className="info--card">
        <p className="eyebrow">¿Qué es?</p>
        <h2>Territorios <em>Vivos</em></h2>
        <p>{ABOUT}</p>
      </InfoDialog>
    </>
  );
}

/** Sinopsis de un documental: las primeras líneas bajo el video y, completa, en su ventana. */
export function Synopsis({ title, text }: { title: string; text: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="synopsis">
      <p className="synopsis__eyebrow">Sinopsis</p>
      <h3 className="synopsis__title">{title}</h3>
      <p className="synopsis__lead">{text.join(' ')}</p>
      <button type="button" className="synopsis__more" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Leer la sinopsis completa <span aria-hidden="true">→</span>
      </button>
      <InfoDialog open={open} onClose={() => setOpen(false)} label={`Sinopsis de ${title}`} className="info--card">
        <p className="eyebrow">Sinopsis</p>
        <h2>{title}</h2>
        {text.map((t, i) => <p key={i}>{t}</p>)}
      </InfoDialog>
    </div>
  );
}
