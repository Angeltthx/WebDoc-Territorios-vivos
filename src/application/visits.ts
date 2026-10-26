// Visitas: dos cuentas a la vez.
// - Vercel Web Analytics (el detalle: de dónde llega la gente, países, dispositivos…; se ve en el tablero de Vercel).
// - Un contador propio en la base (/api/visita): visitas por día y páginas vistas, para el resumen del panel.
// Ninguna usa cookies ni guarda datos personales. El panel del equipo (/admin) no se cuenta.
// Las páginas del recorrido cambian sin recargar (history.replaceState), así que se avisan a mano; una página cuenta
// si la persona se queda en ella al menos STAY_MS (las que se pasan de largo, no).

import { inject, pageview } from '@vercel/analytics';
import { appPath } from './base';

const STAY_MS = 1500;
const skip = (path: string) => path.startsWith('/admin');

/** Una vez, al arrancar la web. */
export function startAnalytics() {
  inject({ beforeSend: (e) => (skip(new URL(e.url).pathname) ? null : e) });
}

/** Suma al contador propio (sin esperar respuesta; si falla, no pasa nada). */
function countOwn(path: string) {
  try {
    const body = new Blob([JSON.stringify({ ruta: path })], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/visita', body)) void fetch('/api/visita', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // Sin conexión o sin servidor (p. ej. con `vite` solo): no se cuenta.
  }
}

let timer = 0;
/**
 * Cuenta una página vista. `vercel`: si también hay que avisarle a Vercel (los cambios del recorrido; los de las
 * direcciones normales los ve solo). `at`: la dirección real, si se cuenta con otro nombre (las vueltas de un pedido).
 */
export function countPage(path: string, { vercel = false, at = path } = {}) {
  if (skip(path)) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (appPath(location.pathname) !== at) return;
    if (vercel) pageview({ path });
    countOwn(path);
  }, STAY_MS);
}
