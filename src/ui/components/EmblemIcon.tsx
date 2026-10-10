// Íconos de línea de los seis tipos de historia (los mismos de las figuritas del mapa: ver map/emblems.ts).

import type { Emblem } from '../../content/choco';

export function EmblemIcon({ kind, size = 26 }: { kind: Emblem; size?: number }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {kind === 'pueblo' && <><path {...c} d="M4 27V16l6-5 6 5v11M16 27V13l6-5 6 5v14M3 27h26" /><path {...c} d="M9 27v-5h2v5M21 27v-5h2v5" /></>}
      {kind === 'selva' && <><path {...c} d="M10 27v-7M22 27v-9M3 27h26" /><circle {...c} cx="10" cy="15" r="5" /><circle {...c} cx="22" cy="12" r="6" /></>}
      {kind === 'mar' && <><path {...c} d="M9 25c1-6 3-11 7-15M16 10c-4-2-8-1-10 2M16 10c3-3 7-3 10-1M16 10c-1 3 0 6 2 8" /><path {...c} d="M3 27c3-2 5-2 8 0s5 2 8 0 5-2 8 0" /></>}
      {kind === 'rio' && <><path {...c} d="M4 18h24l-3 4H7z" /><path {...c} d="M19 9l-6 13" /><path {...c} d="M3 26c3-1.5 5-1.5 8 0s5 1.5 8 0 5-1.5 8 0" /></>}
      {kind === 'cultura' && <><path {...c} d="M10 8h12l-2 19h-8z" /><ellipse {...c} cx="16" cy="8" rx="6" ry="2" /><path {...c} d="M11 13l10 4M11 19l9 4" /></>}
      {kind === 'cocina' && <><path {...c} d="M6 14h20c0 6-4 10-10 10S6 20 6 14z" /><path {...c} d="M4 14h24M12 8c-1 1.5 1 2.5 0 4M17 6c-1 2 1 3 0 5M22 8c-1 1.5 1 2.5 0 4M10 28l2-3M22 28l-2-3" /></>}
    </svg>
  );
}
