// Navegación página a página, igual que el PDF: cada página tiene su URL (/1 … /20)
// y se avanza o retrocede con flechas (pantalla, teclado o deslizamiento en móvil).

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pages } from '../content/pages';

export const TOTAL_PAGES = pages.length;

export const pagePath = (n: number) => (n <= 1 ? '/' : `/${n}`);

export function usePages() {
  const params = useParams();
  const navigate = useNavigate();
  const raw = params.page === undefined ? 1 : Number(params.page);
  const page = Number.isInteger(raw) && raw >= 1 && raw <= TOTAL_PAGES ? raw : null;

  const goTo = useCallback((n: number) => {
    navigate(pagePath(Math.max(1, Math.min(TOTAL_PAGES, n))));
  }, [navigate]);

  const next = useCallback(() => page && page < TOTAL_PAGES && goTo(page + 1), [goTo, page]);
  const prev = useCallback(() => page && page > 1 && goTo(page - 1), [goTo, page]);

  return { page, goTo, next, prev };
}

/**
 * Flechas del teclado y deslizamiento horizontal para pasar de página.
 * Se ignoran dentro de elementos con desplazamiento propio (galerías) y con diálogos abiertos.
 */
export function usePageGestures(next: () => void, prev: () => void) {
  const start = useRef<{ x: number; y: number; ignore: boolean } | null>(null);

  useEffect(() => {
    const blocked = (t: EventTarget | null) =>
      !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [data-no-arrows]') || !!document.querySelector('dialog[open]');

    const onKey = (e: KeyboardEvent) => {
      if (blocked(e.target)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    };
    const onStart = (e: TouchEvent) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ignore: blocked(e.target) };
    };
    const onEnd = (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || s.ignore) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [next, prev]);
}
