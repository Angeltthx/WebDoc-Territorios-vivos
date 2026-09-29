// Recorrido por desplazamiento vertical: cada página ocupa una pantalla y el navegador
// se detiene en cada una (scroll snap). La URL refleja la página visible (/, /2 … /N)
// para poder compartir un punto exacto del recorrido.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { pageIndex, pages } from '../content/pages';

export const TOTAL_PAGES = pages.length;

const pathFor = (index: number) => (index <= 0 ? '/' : `/${index + 1}`);

function indexFromPath(pathname: string): number {
  const n = Number(pathname.replace(/^\//, '') || '1');
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_PAGES ? n - 1 : 0;
}

export function useScrollJourney(scroller: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(() => indexFromPath(window.location.pathname));
  const activeRef = useRef(active);

  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    const target = Math.max(0, Math.min(TOTAL_PAGES - 1, i));
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

  // Página activa = la que ocupa la mayor parte de la pantalla.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const i = Math.round(el.scrollTop / el.clientHeight);
        if (i !== activeRef.current && i >= 0 && i < TOTAL_PAGES) {
          activeRef.current = i;
          setActive(i);
          window.history.replaceState(null, '', pathFor(i));
        }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scroller]);

  return { active, scrollToIndex, scrollToPage };
}
