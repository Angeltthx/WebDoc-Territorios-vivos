/**
 * De dónde salen los videos pesados (historias, 360, transiciones y portada). Con `VITE_MEDIA_URL` (la dirección pública
 * del bucket de Cloudflare R2) salen de allá; sin ella, de la misma web (public/media), como en desarrollo.
 * El bucket guarda los archivos con la misma ruta: `<VITE_MEDIA_URL>/media/historias/...`.
 */
const BASE = String(import.meta.env.VITE_MEDIA_URL ?? '').replace(/\/+$/, '');

/** `path` empieza por `/media/…`. */
export const videoUrl = (path: string) => `${BASE}${path}`;
