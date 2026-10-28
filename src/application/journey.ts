// Recorrido por desplazamiento vertical: cada página ocupa una pantalla, y se pasa de una en una.
// - Rueda del mouse o trackpad: un giro (o un deslizamiento) = una página. El resto del gesto (la inercia del
//   trackpad) no cuenta, para no saltarse varias.
// - Pantallas táctiles (celular, tableta): como los videos de Instagram, con el ajuste propio del navegador (scroll
//   snap, una página por gesto; ver NATIVE_SNAP). Las pantallas táctiles con mouse o lápiz usan el dedo a mano:
//   pasa si el dedo recorre lo suficiente (SWIPE_DISTANCE) o si el gesto es rápido y decidido (SWIPE_VELOCITY).
// - Teclado: flechas, Av Pág / Re Pág y espacio, una página por pulsación.
// Lo que se desplaza por su cuenta (galerías, paneles con su propio scroll, el mapa 3D) se respeta.
// La URL refleja la página visible (/, /2 … /N).

import { startTransition, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { pageIndex, pages } from '../content/pages';
import { appPath, BASE } from './base';
import { countPage } from './visits';

export const TOTAL_PAGES = pages.length;

/** Si el desplazamiento quedó a medias (barra de desplazamiento, algo raro), fracción que hay que pasar para seguir. */
const ADVANCE_THRESHOLD = 0.25;
/** Tiempo sin movimiento que se considera "el visitante se detuvo" (si no hay evento scrollend). */
const IDLE_MS = 140;
/** Celular: fracción de la pantalla que hay que arrastrar el dedo para pasar de página. */
const SWIPE_DISTANCE = 0.2;
/** Celular: un gesto así de rápido (px/ms) pasa con menos recorrido… */
const SWIPE_VELOCITY = 0.55;
/** …pero al menos esta fracción (un toque no es un gesto). */
const SWIPE_FLICK_MIN = 0.07;
/** Rueda o trackpad: lo que hay que girar (px) para pasar de página (un giro de la rueda basta). */
const WHEEL_STEP = 30;
/** Tras pasar de página con la rueda, el gesto sigue contando como el mismo hasta una pausa así de larga (ms)… */
const WHEEL_QUIET_MS = 200;
/** …y nunca antes de esto (lo que tarda en llegar la página). */
const WHEEL_LOCK_MS = 650;

/**
 * En las pantallas táctiles el navegador ajusta la página solo (scroll snap en los estilos): sigue al dedo y a su
 * inercia sin cortes. Antes, al soltar se frenaba la inercia y se lanzaba un desplazamiento propio, y en el iPhone
 * los dos movimientos chocaban: temblaba o dejaba de sentirse suave (29/10/2026).
 */
const NATIVE_SNAP = typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/** Sin scrollend, un desplazamiento programado que todavía no llega se sigue esperando hasta este tiempo (ms). */
const SETTLE_MAX_MS = 1500;

/** Navegadores sin evento scrollend (p. ej. Safari del iPhone) usan un temporizador. */
const HAS_SCROLLEND = typeof window !== 'undefined' && 'onscrollend' in window;

export const pathFor = (index: number) => (index <= 0 ? '/' : `/${index + 1}`);

function indexFromPath(pathname: string): number {
  const n = Number(appPath(pathname).replace(/^\//, '') || '1');
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_PAGES ? n - 1 : 0;
}

const clamp = (i: number) => Math.max(0, Math.min(TOTAL_PAGES - 1, i));

/** Un campo donde se escribe: ahí las teclas son del campo. */
const editable = (t: Element | null) => !!t?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');

export function useScrollJourney(scroller: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(() => indexFromPath(window.location.pathname));
  const activeRef = useRef(active);
  const anchor = useRef(active); // página en la que empezó el gesto actual
  const settling = useRef(false); // desplazamiento programado en curso
  const goal = useRef(active); // a dónde va ese desplazamiento…
  const goalSince = useRef(0); // …y desde cuándo

  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    const target = clamp(i);
    anchor.current = target;
    const top = target * el.clientHeight;
    // Ya está ahí: no hay desplazamiento (ni su scrollend), así que no se espera ninguno.
    if (Math.abs(el.scrollTop - top) <= 1) {
      settling.current = false;
      return;
    }
    settling.current = smooth;
    goal.current = target;
    goalSince.current = performance.now();
    el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }, [scroller]);

  // A una página lejana (desde el menú) se llega de una, sin pasar por todas las de en medio (y sus videos).
  const scrollToPage = useCallback((id: string) => {
    const i = pageIndex(id);
    if (i >= 0) scrollToIndex(i, Math.abs(i - activeRef.current) <= 1);
  }, [scrollToIndex]);

  // Posición inicial según la URL (enlace directo a una página).
  useEffect(() => {
    scrollToIndex(indexFromPath(window.location.pathname), false);
  }, [scrollToIndex]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let idle = 0;
    // Un dedo sobre la pantalla: mientras esté puesto, la página no se mueve sola (aunque el dedo se quede quieto).
    let touching = false;
    // Mientras la pantalla cambia de tamaño (zoom del navegador, rotar el celular, la barra que aparece o se oculta),
    // el desplazamiento cambia solo, sin que el visitante se mueva: no cuenta como pasar de página.
    let resizingUntil = 0;
    let realign = 0;
    const resizing = () => performance.now() < resizingUntil;

    /** Algo dentro de la página se desplaza por su cuenta en esa dirección (un panel con scroll): se le deja. */
    const scrollsInside = (target: EventTarget | null, dy: number) => {
      for (let n = target instanceof Element ? target : null; n && n !== el; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
          if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
        }
      }
      return false;
    };

    /** Encima de la página hay una hoja o un diálogo (la tienda, el formulario, el 360): lo suyo es suyo. */
    const inOverlay = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest('[aria-modal="true"], dialog, .sheet');
    /** Algo usa el dedo para sí mismo (el mapa 3D, el 360): lo dice con touch-action (sin desplazamiento vertical). */
    const ownsTouch = (target: EventTarget | null) => {
      for (let n = target instanceof Element ? target : null; n && n !== el; n = n.parentElement) {
        const ta = getComputedStyle(n).touchAction;
        if (ta !== 'auto' && ta !== 'manipulation' && !ta.includes('pan-y')) return true;
      }
      return false;
    };

    const settle = () => {
      // Con el dedo puesto no se decide nada: sin scrollend, el temporizador vencía en cuanto el dedo se quedaba quieto
      // un instante, y la página volvía sola a su sitio debajo del dedo (temblaba, o devolvía a la anterior).
      if (resizing() || touching) return;
      // El navegador ya dejó la página en su sitio: solo se toma nota de dónde quedó.
      if (NATIVE_SNAP) {
        settling.current = false;
        anchor.current = clamp(Math.round(el.scrollTop / el.clientHeight));
        return;
      }
      if (settling.current) {
        // Sin scrollend, una pausa del navegador (p. ej. mientras carga el planeta) no es la llegada: se sigue esperando.
        const away = Math.abs(el.scrollTop - goal.current * el.clientHeight) > 2;
        if (!HAS_SCROLLEND && away && performance.now() - goalSince.current < SETTLE_MAX_MS) {
          window.clearTimeout(idle);
          idle = window.setTimeout(settle, IDLE_MS);
          return;
        }
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
      scrollToIndex(target);
    };

    const onScroll = () => {
      if (resizing()) return;
      const i = clamp(Math.round(el.scrollTop / el.clientHeight));
      if (i !== activeRef.current) {
        activeRef.current = i;
        // Sin prisa: el desplazamiento (el dedo) va primero; las páginas se actualizan cuando haya tiempo.
        startTransition(() => setActive(i));
        window.history.replaceState(null, '', BASE + pathFor(i));
        countPage(pathFor(i), { vercel: true });
      }
      if (!HAS_SCROLLEND) {
        window.clearTimeout(idle);
        idle = window.setTimeout(settle, IDLE_MS);
      }
    };

    // ── Rueda y trackpad: un giro, una página ──
    let wheelSum = 0;
    let lastWheel = 0;
    let wheelLocked = false;
    let wheelLockUntil = 0;
    const onWheel = (e: WheelEvent) => {
      // El mapa 3D (o lo que sea) ya usó la rueda; el zoom del navegador (Ctrl); los gestos de lado.
      if (e.defaultPrevented || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (inOverlay(e.target) || scrollsInside(e.target, e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      const gap = now - lastWheel;
      lastWheel = now;
      // Lo que queda del gesto que ya pasó de página (la inercia del trackpad) no cuenta.
      if (wheelLocked) {
        if (now < wheelLockUntil || gap < WHEEL_QUIET_MS) return;
        wheelLocked = false;
      }
      if (gap > WHEEL_QUIET_MS) wheelSum = 0;
      wheelSum += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
      if (Math.abs(wheelSum) < WHEEL_STEP) return;
      const target = clamp(anchor.current + Math.sign(wheelSum));
      wheelSum = 0;
      if (target === anchor.current) return;
      scrollToIndex(target);
      wheelLocked = true;
      wheelLockUntil = now + WHEEL_LOCK_MS;
    };

    // ── Celular: arrastrar lo suficiente, o un gesto rápido ──
    let touch: { x0: number; y0: number; t0: number; y: number; t: number; v: number; target: EventTarget | null } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touching = true;
      window.clearTimeout(idle);
      if (e.touches.length !== 1) {
        touch = null;
        return;
      }
      if (inOverlay(e.target) || ownsTouch(e.target)) {
        touch = null;
        return;
      }
      const p = e.touches[0];
      const now = performance.now();
      touch = { x0: p.clientX, y0: p.clientY, t0: now, y: p.clientY, t: now, v: 0, target: e.target };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touch || e.touches.length !== 1) return;
      const p = e.touches[0];
      const now = performance.now();
      const dt = Math.max(1, now - touch.t);
      // Velocidad de los últimos movimientos (suavizada): la del final es la que cuenta para un gesto rápido.
      touch.v = 0.7 * ((touch.y - p.clientY) / dt) + 0.3 * touch.v;
      touch.y = p.clientY;
      touch.t = now;
    };
    /** El último dedo se levantó: ahora sí, si la página quedó a medias, se acomoda. */
    const release = (e: TouchEvent) => {
      if (e.touches.length) return;
      touching = false;
      if (!HAS_SCROLLEND) {
        window.clearTimeout(idle);
        idle = window.setTimeout(settle, IDLE_MS);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      release(e);
      if (NATIVE_SNAP) return;
      const t = touch;
      touch = null;
      if (!t || e.touches.length) return;
      const p = e.changedTouches[0];
      const dy = t.y0 - p.clientY; // positivo: el dedo subió (siguiente página)
      const dx = t.x0 - p.clientX;
      if (Math.abs(dy) < 8 || Math.abs(dx) > Math.abs(dy)) return; // un toque, o un gesto de lado (galerías)
      if (scrollsInside(t.target, dy)) return;
      // La velocidad del final del gesto (si el dedo se quedó quieto antes de soltar, no hay gesto rápido) o, en un
      // gesto corto, la del gesto entero (en uno muy rápido el navegador casi no alcanza a avisar los movimientos).
      const now = performance.now();
      const recent = now - t.t > 80 ? 0 : t.v;
      const whole = now - t.t0 < 300 ? dy / Math.max(16, now - t.t0) : 0;
      const v = Math.abs(recent) >= Math.abs(whole) ? recent : whole;
      const h = el.clientHeight;
      const far = Math.abs(dy) >= SWIPE_DISTANCE * h;
      const flick = Math.abs(v) >= SWIPE_VELOCITY && Math.sign(v) === Math.sign(dy) && Math.abs(dy) >= SWIPE_FLICK_MIN * h;
      const target = clamp(anchor.current + (far || flick ? Math.sign(dy) : 0));
      // Se frena la inercia del navegador (no decide ella) y se va a la página elegida.
      settling.current = true;
      el.style.overflowY = 'hidden';
      requestAnimationFrame(() => {
        el.style.overflowY = '';
        scrollToIndex(target);
      });
    };

    // ── Teclado: una página por pulsación ──
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target instanceof Element ? e.target : null;
      // En un campo, las teclas son del campo; un diálogo abierto (el 360) las usa; y lo que usa todas las flechas
      // para sí mismo (el mapa 3D). Las galerías solo usan las de lado (data-no-arrows="x").
      if (editable(t) || document.querySelector('dialog[open]')) return;
      if (t?.closest('[data-no-arrows]:not([data-no-arrows="x"])') || el.querySelector('.is-active [data-no-arrows]:not([data-no-arrows="x"])')) return;
      // El espacio sobre un botón o un enlace lo activa: no pasa de página.
      if (e.key === ' ' && t?.closest('button, a, [role="button"]')) return;
      const step = ['ArrowDown', 'PageDown', ' '].includes(e.key) ? 1 : ['ArrowUp', 'PageUp'].includes(e.key) ? -1 : 0;
      const to = step ? anchor.current + step : e.key === 'Home' ? 0 : e.key === 'End' ? TOTAL_PAGES - 1 : null;
      if (to === null) return;
      e.preventDefault();
      // Mantener la tecla apretada no salta páginas de seguido.
      if (e.repeat) return;
      // Si antes se hizo clic en un texto, se suelta: que la flecha no ande por las letras.
      window.getSelection()?.removeAllRanges();
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body && el.contains(focused)) focused.blur();
      scrollToIndex(to);
    };

    // Si cambia el tamaño de la pantalla, se mantiene la misma página alineada arriba: al instante y otra vez cuando
    // el cambio termina (el zoom y la rotación llegan en varios pasos).
    let size = `${el.clientWidth}x${el.clientHeight}`;
    const onResize = () => {
      const now = `${el.clientWidth}x${el.clientHeight}`;
      if (now === size) return;
      size = now;
      resizingUntil = performance.now() + 350;
      settling.current = false;
      // Con el dedo puesto (en el iPhone la barra del navegador cambia de tamaño mientras se desliza) no se salta la
      // página bajo el dedo: al soltar se acomoda.
      if (!touching) el.scrollTop = anchor.current * el.clientHeight;
      window.clearTimeout(realign);
      realign = window.setTimeout(() => {
        if (!touching) el.scrollTop = anchor.current * el.clientHeight;
        resizingUntil = 0;
      }, 360);
    };
    const resize = new ResizeObserver(onResize);
    resize.observe(el);
    window.addEventListener('resize', onResize);

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', settle);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    const onTouchCancel = (e: TouchEvent) => {
      touch = null;
      release(e);
    };
    el.addEventListener('touchcancel', onTouchCancel);
    window.addEventListener('keydown', onKey);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', onResize);
      window.clearTimeout(realign);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scrollend', settle);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(idle);
    };
  }, [scroller, scrollToIndex]);

  return { active, scrollToIndex, scrollToPage };
}
