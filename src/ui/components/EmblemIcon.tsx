// Los seis tipos de historia, dibujados con el lenguaje del afiche y de las figuritas del mapa: tintas planas de
// colores con el contorno verde oscuro, como calcomanías. Cosas del Pacífico: el palafito con techo de zinc, la selva,
// la cola de la ballena, la canoa en el río, el cununo y la olla con plátano.

import type { Emblem } from '../../content/choco';

const LINE = '#173628';
const WATER = '#6b97cd';

export function EmblemIcon({ kind, size = 36 }: { kind: Emblem; size?: number }) {
  const s = { stroke: LINE, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {kind === 'pueblo' && (
        <>
          <path {...s} fill={WATER} d="M2 32c3-1.6 6-1.6 9 0s6 1.6 9 0 6-1.6 9 0 6 1.6 9 0V38H2z" />
          <path {...s} fill="none" d="M10 26v8M16 26v7M24 26v7M30 26v8" />
          <path {...s} fill="#e98a3c" d="M6 25.5h28v2H6z" />
          <path {...s} fill="#3fa7a0" d="M9 15h22v10.5H9z" />
          <path {...s} fill="#c4ccd0" d="M5 16 20 6l15 10z" />
          <path {...s} fill="none" strokeWidth={1} d="M14 12.6 17 16M20 9.5 20 16M26 12.6 23 16" />
          <path {...s} fill="#f2c14e" d="M17.5 18.5h5v7h-5z" />
          <path {...s} fill="#fdf6e3" d="M11.5 18.5h3.5v3h-3.5zM25 18.5h3.5v3H25z" />
        </>
      )}
      {kind === 'selva' && (
        <>
          <path {...s} fill="#7cc47a" d="M2 33c6-2.5 12-2.5 18-1s12 1.5 18-1V38H2z" />
          <path {...s} fill="none" stroke="#8a6a48" strokeWidth={2.6} d="M10 33c-.4-5 .4-10 2-15" />
          <path {...s} fill="#2f7a4a" d="M12 18c-4-1-7 0-9 2 3-.4 5 0 7 1zM12 18c-1-4-4-6-7-6 2 1.6 3.4 3.4 4 6zM12 18c2-3 5-4 8-3.4-2.4.6-4.4 2-5.6 4zM12 18c3 0 6 2 7 5-2-1.4-4.4-2.2-6.6-2.4z" />
          <path {...s} fill="#8a5a3a" d="M24.5 24h3.5v9.5h-3.5z" />
          <path {...s} fill="#4f9a3c" d="M18 20c-2-4 1-8 5-8 1-4 7-5 9-1 4 0 6 4 4 7 2 3-1 7-5 6-2 2-6 2-8 0-3 1-6-1-5-4z" />
          <path {...s} fill="none" strokeWidth={1} d="M24 17c1.4-1 3-1 4 0M29 21c1-.6 2-.6 3 0" />
        </>
      )}
      {kind === 'mar' && (
        <>
          <circle {...s} fill="#f2c14e" cx="31" cy="9" r="4" />
          <path {...s} fill="#3e6197" d="M17.4 31c0-4.4.4-8.4 1.2-11.6C14.6 19 9.6 17 5.6 12.6c4.4-.8 9.8.4 13.4 3.2l1 1.6 1-1.6c3.6-2.8 9-4 13.4-3.2-4 4.4-9 6.4-13 6.8.8 3.2 1.2 7.2 1.2 11.6z" />
          <path {...s} fill="none" strokeWidth={1} d="M11 15.6c2.4.6 4.6 1.6 6.4 2.8M29 15.6c-2.4.6-4.6 1.6-6.4 2.8" />
          <path {...s} fill={WATER} d="M2 29c3-2 6-2 9 0s6 2 9 0 6-2 9 0 6 2 9 0V38H2z" />
          <path {...s} fill="#fdf6e3" d="M14 28.5c1.4-1.6 3-2 4.4-1.2M24.6 28.5c-1.4-1.6-3-2-4.4-1.2" />
          <circle {...s} fill="#fdf6e3" strokeWidth={1.2} cx="13" cy="24.5" r="1" />
          <circle {...s} fill="#fdf6e3" strokeWidth={1.2} cx="26.5" cy="23.5" r="1.2" />
        </>
      )}
      {kind === 'rio' && (
        <>
          <path {...s} fill="#7cc47a" d="M2 22c4-1.4 8-1.4 12-.4V26H2z" />
          <path {...s} fill="#4f9a3c" d="M27 21.6c3-1.4 7-1.6 11-.6V26H27z" />
          <path {...s} fill={WATER} d="M2 25.5c3-1.4 6-1.4 9 0s6 1.4 9 0 6-1.4 9 0 6 1.4 9 0V38H2z" />
          <path {...s} fill="none" stroke="#fdf6e3" strokeWidth={1.2} d="M6 33h5M27 34h6" />
          <path {...s} fill="none" strokeWidth={2} d="M27 7 18.5 30" />
          <path {...s} fill="#e2a33a" d="M18.5 30c-1.6.4-2.6 2-2.4 3.4 1.4.4 3-.4 3.6-1.8z" />
          <path {...s} fill="#a0623a" d="M4 23.5h32c-2 5-7 6.5-16 6.5S6 28.5 4 23.5z" />
          <path {...s} fill="none" strokeWidth={1} d="M8 25.6c4 1.2 8 1.6 12 1.6s8-.4 12-1.6" />
        </>
      )}
      {kind === 'cultura' && (
        <>
          <path {...s} fill="#e2456f" d="M11.5 10h17l-3 23h-11z" />
          <path {...s} fill="none" stroke="#fdf6e3" strokeWidth={1.2} d="M13 13.6 19 29.5M18.4 12.8 24.6 29.5M21.6 12.8 15.4 29.5M27 13.6 21 29.5" />
          <path {...s} fill="#f2c14e" d="M14.6 29.5h10.8l-.5 3.5H15.1z" />
          <path {...s} fill="#a0623a" strokeWidth={1.2} d="M16.4 29.5l1 -2.6 1 2.6zM19.5 29.5l1-2.6 1 2.6zM22.6 29.5l1-2.6 1 2.6z" />
          <ellipse {...s} fill="#fdf6e3" cx="20" cy="10" rx="8.5" ry="2.8" />
          <path {...s} fill="none" d="M33 6v7" />
          <ellipse {...s} fill="#f2c14e" cx="31.4" cy="13.4" rx="2" ry="1.5" />
          <path {...s} fill="none" d="M6 16v6" />
          <ellipse {...s} fill="#3fa7a0" cx="4.6" cy="22.4" rx="1.8" ry="1.4" />
        </>
      )}
      {kind === 'cocina' && (
        <>
          <path {...s} fill="none" d="M14 11c-1.4-1.6 1-3 0-5M20 10c-1.4-1.6 1-3 0-5M26 11c-1.4-1.6 1-3 0-5" />
          <path {...s} fill="#f2c14e" d="M20.6 18c-.4-5.4 3.4-9.6 9-10.4l1.2 1.4c-4.2 1.4-6.8 5-6.4 9z" />
          <path {...s} fill="#8a5a3a" strokeWidth={1.2} d="M29.6 7.6l1.6-1.2.6 1.2-1 1.4z" />
          <path {...s} fill="#3b4a45" d="M7 18h26v7c0 5-5 8-13 8s-13-3-13-8z" />
          <path {...s} fill="#e98a3c" d="M5 16.4h30v3H5z" />
          <path {...s} fill="none" d="M7 21.5H4.5M33 21.5h2.5" />
          <path {...s} fill="none" stroke="#fdf6e3" strokeWidth={1.2} d="M11 24c1 3 4 5 8 5.4" />
        </>
      )}
    </svg>
  );
}
