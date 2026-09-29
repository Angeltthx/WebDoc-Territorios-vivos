// Recorrido por desplazamiento vertical: cada página ocupa una pantalla.
// El desplazamiento es libre y, cuando el visitante se detiene, la página se acomoda con suavidad:
// si solo se pasó un poco, vuelve a la página en la que estaba; si bajó (o subió) al menos
// una cuarta parte, continúa a la siguiente. La URL refleja la página visible (/, /2 … /N).

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { pageIndex, pages } from '../content/pages';

export const TOTAL_PAGES = pages.length;

/** Fracción de pantalla que hay que recorrer para pasar a la página siguiente. */
const ADVANCE_THRESHOLD = 0.25;
/** Tiempo sin movimiento que se considera "el visitante se detuvo" (si no hay evento scrollend). */
const IDLE_MS = 140;

/** Navegadores sin evento scrollend (p. ej. Safari antiguo) usan un temporizador. */
const HAS_SCROLLEND = typeof window !== 'undefined' && 'onscrollend' in window;

const pathFor = (index: number) => (index <= 0 ? '/' : `/${index + 1}`);

function indexFromPath(pathname: string): number {
  const n = Number(pathname.replace(/^\//, '') || '1');
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_PAGES ? n - 1 : 0;
}

const clamp = (i: number) => Math.max(0, Math.min(TOTAL_PAGES - 1, i));

export function useScrollJourney(scroller: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(() => indexFromPath(window.location.pathname));
  const activeRef = useRef(active);
  const anchor = useRef(active); // página en la que empezó el gesto actual
  const settling = useRef(false); // desplazamiento programado en curso

  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    const target = clamp(i);
    anchor.current = target;
    settling.current = smooth;
    el.scrollTo({ top: target * el.clientHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, [scroller]);

  const scrollToPage = useCallback((id: string) => {
    const i = pageIndex(id);
    if (i >= 0) scrollToIndex(i);
  }, [scrollToIndex]);

  // Posición inicial según la URL (enlace directo a una página).
  useEffect(() => {
    scrollToIndex(indexFromPath(window.location.pathname), false);
  }, [scrollToIndex]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let idle = 0;

    const settle = () => {
      if (settling.current) {
        settling.current = false;
        anchor.current = Math.round(el.scrollTop / el.clientHeight);
        return;
      }
      const pos = el.scrollTop / el.clientHeight;
      const delta = pos - anchor.current;
      let target = anchor.current;
      if (Math.abs(delta) >= 1) target = Math.round(pos);
      else if (delta >= ADVANCE_THRESHOLD) target = anchor.current + 1;
      else if (delta <= -ADVANCE_THRESHOLD) target = anchor.current - 1;
      target = clamp(target);
      if (Math.abs(el.scrollTop - target * el.clientHeight) > 1) scrollToIndex(target);
      else anchor.current = target;
    };

    const onScroll = () => {
      const i = clamp(Math.round(el.scrollTop / el.clientHeight));
      if (i !== activeRef.current) {
        activeRef.current = i;
        setActive(i);
        window.history.replaceState(null, '', pathFor(i));
      }
      if (!HAS_SCROLLEND) {
        window.clearTimeout(idle);
        idle = window.setTimeout(settle, IDLE_MS);
      }
    };

    // Teclado: una página por pulsación, sin interferir con campos, menús ni galerías.
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [data-no-arrows]') || document.querySelector('dialog[open]')) return;
      const current = anchor.current;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); scrollToIndex(current + 1); }
      else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); scrollToIndex(current - 1); }
      else if (e.key === 'Home') { e.preventDefault(); scrollToIndex(0); }
      else if (e.key === 'End') { e.preventDefault(); scrollToIndex(TOTAL_PAGES - 1); }
    };

    // Si cambia el alto de la pantalla (rotar el celular, barra del navegador que aparece o se
    // oculta), se mantiene la misma página alineada arriba.
    let lastHeight = el.clientHeight;
    const resize = new ResizeObserver(() => {
      if (el.clientHeight === lastHeight) return;
      lastHeight = el.clientHeight;
      el.scrollTop = anchor.current * el.clientHeight;
    });
    resize.observe(el);

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', settle);
    window.addEventListener('keydown', onKey);
    return () => {
      resize.disconnect();
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scrollend', settle);
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(idle);
    };
  }, [scroller, scrollToIndex]);

  return { active, scrollToIndex, scrollToPage };
}
