// Ventanas pequeñas de información (pedido del cliente, 09/11/2026): qué es Territorios Vivos, la sinopsis de cada
// documental y la infografía «Cómo llegar» de cada estación. Se montan en <body> (ver Portal) y se cierran con la ✕,
// con Escape o tocando fuera.

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import type { Station } from '../../domain/types';
import { Portal } from './Portal';

export function InfoDialog({ open, onClose, label, className = '', rail = false, children }: {
  open: boolean;
  onClose: () => void;
  /** Nombre de la ventana para los lectores de pantalla. */
  label: string;
  className?: string;
  /** Barra de desplazamiento siempre visible (para contenidos largos como las infografías). */
  rail?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
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
        {open && <div ref={body} className="info__body">{children}</div>}
        {open && rail && <ScrollRail target={body} />}
        <button type="button" className="icon-btn info__close" onClick={onClose} aria-label="Cerrar">✕</button>
      </dialog>
    </Portal>
  );
}

/**
 * Barra de desplazamiento propia, siempre a la vista (pedido de la clienta, 17/11/2026: con la barra del sistema,
 * que en celulares y Mac se esconde, la gente creía que la infografía no se podía bajar). Se arrastra o se toca.
 */
function ScrollRail({ target }: { target: RefObject<HTMLDivElement | null> }) {
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ top: 0, size: 1 });

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const update = () => {
      const size = el.scrollHeight > 0 ? Math.min(1, el.clientHeight / el.scrollHeight) : 1;
      const room = el.scrollHeight - el.clientHeight;
      setThumb({ size, top: room > 0 ? (el.scrollTop / room) * (1 - size) : 0 });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    // La infografía llega después: el alto cambia cuando carga la imagen.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [target]);

  /** Lleva el contenido a la posición del puntero sobre la barra (centrando el indicador ahí). */
  const scrollTo = (clientY: number, grabOffset: number) => {
    const el = target.current, t = track.current;
    if (!el || !t) return;
    const r = t.getBoundingClientRect();
    const thumbPx = thumb.size * r.height;
    const ratio = (clientY - r.top - grabOffset) / Math.max(1, r.height - thumbPx);
    el.scrollTop = Math.max(0, Math.min(1, ratio)) * (el.scrollHeight - el.clientHeight);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = track.current;
    if (!t) return;
    e.preventDefault();
    const r = t.getBoundingClientRect();
    const thumbTop = r.top + thumb.top * r.height, thumbPx = thumb.size * r.height;
    const onThumb = e.clientY >= thumbTop && e.clientY <= thumbTop + thumbPx;
    const grab = onThumb ? e.clientY - thumbTop : thumbPx / 2;
    scrollTo(e.clientY, grab);
    t.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => scrollTo(ev.clientY, grab);
    const up = () => { t.removeEventListener('pointermove', move); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); };
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
  };

  if (thumb.size >= 1) return null;
  return (
    <div ref={track} className="info__rail" onPointerDown={onPointerDown} aria-hidden="true">
      <span className="info__rail-thumb" style={{ top: `${thumb.top * 100}%`, height: `${thumb.size * 100}%` }} />
    </div>
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

/** Versión de las infografías: /media se guarda un año en el navegador, así que al cambiarlas se sube este número
 * para que se pidan de nuevo (13/11/2026: rediseño de la clienta). */
const HOWTO_VERSION = 2;

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
      <InfoDialog open={open} onClose={() => setOpen(false)} label={title} className="info--poster" rail>
        <img src={`/media/infografias/${station.howTo.image}.webp?v=${HOWTO_VERSION}`} alt={`Infografía: ${title}, Nuquí, Chocó`} width={1080} height={5480} />
      </InfoDialog>
    </>
  );
}

/** Qué es Territorios Vivos (texto del cliente, 09/11/2026). */
const ABOUT =
  'Territorios Vivos, relatos del Pacífico, es una invitación del territorio para vivir un turismo consciente, responsable y comunitario a través de las historias de personas que por años han conservado sus tradiciones, cultura y biodiversidad en Nuquí, Chocó.';

const ABOUT_SEEN = 'tv-que-es-visto';

/**
 * El ícono del botón: un globo de diálogo con tres personas recortadas (el que mandó la clienta el 14/11/2026, en lugar
 * de la «i»), dibujado aquí para que se vea nítido y tome el color del botón (blanco, o dorado mientras llama).
 * Cada botón lleva su propia máscara: el botón se repite en todas las páginas.
 */
function PeopleIcon() {
  const mask = `tv-people-${useId().replace(/:/g, '')}`;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" />
          <g fill="#000">
            <circle cx="8.3" cy="10.1" r="2.1" />
            <circle cx="16.7" cy="10.1" r="2.1" />
            <path d="M4.9 16.3a3.4 3.4 0 0 1 6.8 0z" />
            <path d="M12.3 16.3a3.4 3.4 0 0 1 6.8 0z" />
          </g>
          {/* La del medio, delante: un filo la separa de las de los lados. */}
          <g fill="#000" stroke="#fff" strokeWidth="0.7">
            <circle cx="12.5" cy="8.9" r="2.5" />
            <path d="M8.4 16.3a4.1 4.1 0 0 1 8.2 0z" />
          </g>
        </mask>
      </defs>
      <g fill="currentColor" mask={`url(#${mask})`}>
        <circle cx="12.5" cy="11.5" r="10" />
        <path d="M2.5 13.2V22l7-2.2z" />
      </g>
    </svg>
  );
}

/**
 * El ícono de información, en todas las páginas del recorrido: abre un cuadro que cuenta qué es Territorios Vivos.
 * Más llamativo (pedido del 09/11/2026): hasta que se abra la primera vez, dorado y con un halo que palpita
 * alrededor; después queda como los demás (se recuerda en este navegador). El ícono es el globo con personas de la
 * clienta (14/11/2026; antes una «i»).
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
        <PeopleIcon />
      </button>
      <InfoDialog open={open} onClose={() => setOpen(false)} label="¿Qué es Territorios Vivos?" className="info--card">
        <p className="eyebrow">¿Qué es?</p>
        {/* El logo del sitio en lugar del título escrito (pedido de la clienta, 15/11/2026). */}
        <h2 className="info__logo">
          <img src="/media/logo-territorios-vivos.webp" alt="Territorios Vivos · Relatos del Pacífico" width={1200} height={675} />
        </h2>
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
