// Paso a paso con luz (09/11/2026): la primera vez que alguien llega a una vista, una luz alumbra cada parte y una
// tarjeta al lado cuenta para qué sirve. Lo usan el mapa (en el planeta señala el Chocó y espera a que lo toquen; en la
// costa recorre el filtro, los pueblos, la ayuda y la vuelta al planeta) y «Cuenta tu historia» (cada paso del
// formulario: ahí la página baja sola hasta lo que se alumbra). Se puede saltar y volver a ver.

import { useEffect, useRef, useState, type RefObject } from 'react';

export interface CoachStep {
  /** Lo que se alumbra: un selector dentro de la vista (si hay varios, el primero que se vea). Sin él, la tarjeta va
   * al centro. */
  target?: string;
  title: string;
  text: string;
  /** El paso espera a que se haga algo (tocar el Chocó): sin «Siguiente». */
  waits?: boolean;
}

type Box = { x: number; y: number; w: number; h: number };
const PAD = 8;
const GAP = 16;
const MARGIN = 16;

const visible = (el: HTMLElement) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';

/** Lleva lo alumbrado al centro de su caja con desplazamiento (el cuerpo de la hoja), sin mover nada por fuera de la
 * vista: `scrollIntoView` movía también el recorrido cuando la hoja se abre desde el mapa. */
function bringIntoView(el: HTMLElement, root: HTMLElement) {
  // En el celular la que se desplaza es la hoja misma (la vista); en el computador, su cuerpo.
  for (let box = el.parentElement; box; box = box === root ? null : box.parentElement) {
    const oy = getComputedStyle(box).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight) {
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const top = box.scrollTop + (r.top - b.top) - Math.max(16, (b.height - r.height) / 2);
      box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      return;
    }
  }
}

export function Coach({ steps, host, onDone, follow = false, finish = 'Empezar' }: {
  steps: CoachStep[];
  /** La vista: la luz y la tarjeta se ubican dentro de ella. Sin esto, el elemento donde está puesto el paso a paso. */
  host?: RefObject<HTMLElement | null>;
  onDone: () => void;
  /** Bajar (o subir) solo hasta lo que se alumbra en cada paso. */
  follow?: boolean;
  /** El botón del último paso. */
  finish?: string;
}) {
  const [i, setI] = useState(0);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  const [box, setBox] = useState<Box | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const self = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(180);
  const rootOf = () => host?.current ?? self.current?.parentElement ?? null;
  const find = (root: HTMLElement) =>
    step.target ? [...root.querySelectorAll<HTMLElement>(step.target)].find(visible) ?? null : null;

  useEffect(() => {
    const root = rootOf();
    const el = root && find(root);
    if (follow && root && el) bringIntoView(el, root);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, follow]);

  // Se sigue el lugar de lo alumbrado en cada cuadro: el alfiler del Chocó se mueve cuando el planeta gira, y en la
  // hoja la página va bajando.
  useEffect(() => {
    let frame = 0;
    let prev = '';
    const tick = () => {
      const root = rootOf();
      if (root) {
        const r = root.getBoundingClientRect();
        const el = find(root);
        const t = el?.getBoundingClientRect();
        // Lo alumbrado se recorta a lo que se ve de la vista (en la hoja, una sección larga sale por abajo).
        const top = t ? Math.max(t.top, r.top) : 0;
        const bottom = t ? Math.min(t.bottom, r.bottom) : 0;
        const next: Box | null = t && t.width > 0 && bottom > top ? { x: t.left - r.left, y: top - r.top, w: t.width, h: bottom - top } : null;
        const key = `${r.width}x${r.height}|${next ? `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.w)},${Math.round(next.h)}` : '-'}`;
        if (key !== prev) {
          prev = key;
          setBox(next);
          setSize({ w: r.width, h: r.height });
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, step.target]);

  useEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      if (e.key === 'ArrowRight' && !step.waits) (last ? onDone() : setI((n) => n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onDone, step.waits]);

  // La tarjeta va debajo de lo alumbrado o, si no cabe, encima; si tampoco (algo muy alto), a su lado o abajo de la
  // pantalla. Centrada con ello y sin salirse por los lados.
  const cardW = Math.min(340, size.w - MARGIN * 2);
  let place: { left: number; top: number } = { left: (size.w - cardW) / 2, top: (size.h - cardH) / 2 };
  if (box) {
    const below = box.y + box.h + PAD + GAP;
    const above = box.y - PAD - GAP - cardH;
    const fitsBelow = below + cardH <= size.h - MARGIN;
    const fitsAbove = above >= MARGIN;
    let left = box.x + box.w / 2 - cardW / 2;
    let top = fitsBelow ? below : fitsAbove ? above : size.h - cardH - MARGIN;
    if (!fitsBelow && !fitsAbove) {
      // Al lado, si hay espacio; si no, abajo encima de lo alumbrado.
      const right = box.x + box.w + PAD + GAP;
      if (right + cardW <= size.w - MARGIN) [left, top] = [right, box.y + box.h / 2 - cardH / 2];
      else if (box.x - PAD - GAP - cardW >= MARGIN) [left, top] = [box.x - PAD - GAP - cardW, box.y + box.h / 2 - cardH / 2];
    }
    place = {
      left: Math.max(MARGIN, Math.min(size.w - cardW - MARGIN, left)),
      top: Math.max(MARGIN, Math.min(size.h - cardH - MARGIN, top)),
    };
  }
  const round = box && Math.max(box.w, box.h) < 90;

  return (
    <div ref={self} className="coach" role="dialog" aria-modal="false" aria-labelledby="coach-title">
      {box ? (
        <div
          className={`coach__light${round ? ' is-round' : ''}`}
          style={{ left: box.x - PAD, top: box.y - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 }}
          aria-hidden="true"
        />
      ) : (
        <div className="coach__veil" aria-hidden="true" />
      )}
      <div ref={card} className="coach__card" style={{ left: place.left, top: place.top, width: cardW }} key={i}>
        {steps.length > 1 && <p className="coach__count">{i + 1} de {steps.length}</p>}
        <h3 id="coach-title" className="coach__title">{step.title}</h3>
        <p className="coach__text">{step.text}</p>
        <div className="coach__nav">
          <button type="button" className="coach__skip" onClick={onDone}>{step.waits ? 'Ahora no' : 'Saltar'}</button>
          <div className="coach__buttons">
            {i > 0 && <button type="button" className="coach__back" onClick={() => setI(i - 1)}>Atrás</button>}
            {!step.waits && (
              <button type="button" className="coach__next" onClick={() => (last ? onDone() : setI(i + 1))}>
                {last ? finish : 'Siguiente'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
