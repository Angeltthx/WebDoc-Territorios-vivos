// Invitación a seguir: abajo, con la letra del webdoc, «Sigue bajando» (en el celular, «Desliza para seguir») y la
// flecha del recorrido, que se mece y palpita suave. Tocarla pasa de página; se va apenas se usa la rueda, el dedo o
// el teclado, y vuelve si la persona se queda quieta otra vez.
// Cuándo aparece depende de la página (ver CueMode): no interrumpe un video ni una galería sin ver.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Arrow } from './Chrome';

/**
 * - `timer`: a los IDLE_MS quieta (la portada, las citas, las recetas…).
 * - `video`: cuando termina el video de la página (si ya había terminado, como `timer`). Los de las transiciones van en
 *   bucle (con la voz de Chachita): para ellos, «terminar» es completar la primera vuelta.
 * - `gallery`: después de abrir las fotos y cerrarlas, o a los GALLERY_MS de empezar a pasarlas.
 * - `songs`: después de ver el 360 (al cerrarlo) o de tocar una canción.
 * - `off`: nunca (el planeta, la última página).
 */
export type CueMode = 'timer' | 'video' | 'gallery' | 'songs' | 'off';

const IDLE_MS = 10000;
/** En la galería, después de empezar a pasar las fotos (y de cada movimiento), un poco más: se están mirando. */
const GALLERY_MS = 15000;
/** Después de que termina el video o se cierra la galería: un respiro antes de invitar. */
const AFTER_MS = 2500;
/** Si en ese momento no conviene (un video corriendo, una ventana abierta), se vuelve a mirar cada tanto. */
const RETRY_MS = 2000;

/** Los videos de la página visible (sin los que van en bucle, que son de fondo). */
const pageVideos = () =>
  [...document.querySelectorAll<HTMLVideoElement>('.stack-page.is-active video')].filter((v) => !v.loop);
/** Cada cuánto se mira si un video en bucle ya dio la vuelta. */
const LOOP_CHECK_MS = 500;

/** Lo que la página ya tiene para seguir («Sigue bajando», «Comenzar el viaje»): la invitación toma su lugar. */
const ANCHOR = '.stack-page.is-active .scroll-hint, .stack-page.is-active .start-btn';

/** ¿Algo está en primer plano? Un video corriendo o una ventana abierta (el menú, la guía, la galería, la tienda). */
function busy() {
  return pageVideos().some((v) => !v.paused && !v.ended) || !!document.querySelector('dialog[open], [aria-modal="true"]');
}

export function IdleCue({ page, mode, onNext }: { page: number; mode: CueMode; onNext: () => void }) {
  const [shown, setShown] = useState(false);
  /** Dónde va (sobre el «Sigue bajando» de la página, si lo tiene) y qué dice. */
  const [place, setPlace] = useState<{ bottom: number | null; label: string }>({ bottom: null, label: 'Sigue bajando' });
  const timer = useRef(0);

  useEffect(() => {
    setShown(false);
    if (mode === 'off') return;
    // Lista para invitar: de una (timer), o cuando termine el video / se vea la galería. Una página de video sin video
    // todavía (pendiente de entrega) cuenta como timer.
    const noVideo = !document.querySelector('.stack-page.is-active video');
    let ready = mode === 'timer' || (mode === 'video' && (noVideo || pageVideos().some((v) => v.ended)));
    const idle = mode === 'gallery' ? GALLERY_MS : IDLE_MS;
    const arm = (ms = idle) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (busy()) return arm(RETRY_MS);
        const a = document.querySelector<HTMLElement>(ANCHOR);
        const r = a?.getBoundingClientRect();
        setPlace({ bottom: r && r.height ? window.innerHeight - r.bottom : null, label: a?.textContent?.trim() || 'Sigue bajando' });
        setShown(true);
      }, ms);
    };
    if (ready) arm();

    const inPage = (t: EventTarget | null) => t instanceof Element && !!t.closest('.stack-page.is-active');
    const done = () => {
      if (ready) return;
      ready = true;
      arm(AFTER_MS);
    };
    const onEnded = (e: Event) => {
      if (mode === 'video' && e.target instanceof HTMLVideoElement && !e.target.loop && inPage(e.target)) done();
    };
    // Un video en bucle no avisa que terminó: se nota porque vuelve a empezar (su tiempo salta hacia atrás).
    const last = new Map<HTMLVideoElement, number>();
    const loops = mode === 'video' ? window.setInterval(() => {
      for (const v of document.querySelectorAll<HTMLVideoElement>('.stack-page.is-active video[loop]')) {
        const before = last.get(v) ?? 0;
        if (v.duration && before > 1 && v.currentTime < before - 1) done();
        last.set(v, v.currentTime);
      }
    }, LOOP_CHECK_MS) : 0;
    // Galería: empezar a pasar las fotos (con las flechas o deslizando) también cuenta como verla. Solo si fue la
    // persona (no un acomodo de la galería al cargar).
    let acted = false;
    const onScrollIn = (e: Event) => {
      if (mode !== 'gallery' || ready || !acted || !(e.target instanceof Element) || !e.target.matches('.gallery__track') || !inPage(e.target)) return;
      ready = true;
      arm(GALLERY_MS);
    };
    const onClose = (e: Event) => {
      // (En una página de galería solo hay una a la vista: basta que se cierre la suya. El 360 es un diálogo aparte.)
      if (!(e.target instanceof Element)) return;
      if ((mode === 'gallery' && e.target.matches('.grid-view, .lightbox')) || (mode === 'songs' && e.target.matches('.pano'))) {
        ready = true;
        arm(AFTER_MS);
      }
    };
    // Canciones: tocar una ya cuenta (mientras no estén las grabaciones, sale un aviso).
    const onSong = (e: Event) => {
      if (mode !== 'songs' || !(e.target instanceof Element) || !e.target.closest('.glass-card--song')) return false;
      ready = true;
      arm(AFTER_MS + 2000);
      return true;
    };
    // Cualquier intento de moverse cuenta: se esconde y, si ya estaba lista, vuelve a contar.
    const reset = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('.cue')) return; // su propio clic pasa de página
      acted = true;
      setShown(false);
      if (onSong(e)) return;
      if (ready) arm();
    };
    // Los eventos de los videos y de los diálogos no suben: se escuchan en la captura.
    document.addEventListener('ended', onEnded, true);
    document.addEventListener('close', onClose, true);
    document.addEventListener('scroll', onScrollIn, true);
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    return () => {
      window.clearTimeout(timer.current);
      window.clearInterval(loops);
      document.removeEventListener('ended', onEnded, true);
      document.removeEventListener('close', onClose, true);
      document.removeEventListener('scroll', onScrollIn, true);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [page, mode]);

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
