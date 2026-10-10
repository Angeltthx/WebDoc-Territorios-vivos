// Registro de pasos del mapa, para diagnosticar en un teléfono que no tenemos a mano: si el 3D se cae, el aviso
// muestra qué escena se cayó y en qué iba (armando, compilando, bajando…). Una captura basta.
//
// Para aislar el problema en ese teléfono, `?solo=planeta` arma solo el planeta (nunca la costa) y `?solo=costa` va
// directo a la costa (sin planeta). Se combinan con `?v=`.

const steps: string[] = [];
const t0 = performance.now();

/** Anota un paso (se guardan los últimos). */
export function step(what: string) {
  steps.push(`${what} ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  if (steps.length > 6) steps.shift();
  console.info(`[mapa] ${what}`);
}

/** Lo último que pasó, en una línea (para el aviso de error). */
export const lastSteps = () => steps.join(' → ');

/** `?solo=planeta` o `?solo=costa`: probar una sola escena. */
export const SOLO = new URLSearchParams(location.search).get('solo') as 'planeta' | 'costa' | null;
