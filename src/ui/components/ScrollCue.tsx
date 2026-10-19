// Señal de seguir bajando: abajo, con la letra del webdoc, «Sigue bajando» (en el celular, «Desliza para seguir») y la
// flecha del recorrido, que se mece y palpita suave. Tocarla pasa de página.
// Está en todas las páginas menos en la última, el mapa (pedido del cliente, 19/10/2026: antes solo aparecía al
// terminar el video o tras un rato quieta, y la gente no sabía que había que seguir). Solo se aparta mientras corre el
// video de la página (para no tapar sus controles) o hay una ventana abierta, y vuelve apenas se pausa o se cierra.

import { useEffect, useState, type CSSProperties } from 'react';
import { Arrow } from './Chrome';

/** Lo que tarda en aparecer al llegar a una página (que primero se vea la página). */
const ENTER_MS = 1200;
/** Cada cuánto se mira si hay un video corriendo o una ventana abierta, y dónde queda el «Sigue bajando» de la página. */
const CHECK_MS = 400;

/** Lo que la página ya tiene para seguir («Sigue bajando», «Comenzar el viaje»): la señal toma su lugar y su texto. */
const ANCHOR = '.stack-page.is-active .scroll-hint, .stack-page.is-active .start-btn';

/** ¿Algo está en primer plano? Un video de la página corriendo (los de fondo van en bucle) o una ventana abierta. */
function busy() {
  const playing = [...document.querySelectorAll<HTMLVideoElement>('.stack-page.is-active video')]
    .some((v) => !v.loop && !v.paused && !v.ended);
  return playing || !!document.querySelector('dialog[open], [aria-modal="true"]');
}

export function ScrollCue({ page, off, onNext }: { page: number; off: boolean; onNext: () => void }) {
  const [shown, setShown] = useState(false);
  /** Dónde va (sobre el «Sigue bajando» de la página, si lo tiene) y qué dice. */
  const [place, setPlace] = useState<{ bottom: number | null; label: string }>({ bottom: null, label: 'Sigue bajando' });

  useEffect(() => {
    setShown(false);
    if (off) return;
    const check = () => {
      const a = document.querySelector<HTMLElement>(ANCHOR);
      const r = a?.getBoundingClientRect();
      const bottom = r && r.height ? window.innerHeight - r.bottom : null;
      const label = a?.textContent?.trim() || 'Sigue bajando';
      setPlace((p) => (p.bottom === bottom && p.label === label ? p : { bottom, label }));
      setShown(!busy());
    };
    let every = 0;
    const start = window.setTimeout(() => {
      check();
      every = window.setInterval(check, CHECK_MS);
    }, ENTER_MS);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(every);
    };
  }, [page, off]);

  return (
    <button
      type="button"
      className={`cue${shown ? ' is-shown' : ''}`}
      style={place.bottom !== null ? ({ '--cue-bottom': `${place.bottom}px` } as CSSProperties) : undefined}
      onClick={onNext}
      aria-label="Seguir a la página siguiente"
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
    >
      <span className="cue__label cue__label--desk" aria-hidden="true">{place.label}</span>
      <span className="cue__label cue__label--touch" aria-hidden="true">Desliza para seguir</span>
      <span className="cue__arrow" aria-hidden="true"><Arrow dir="down" /></span>
    </button>
  );
}
