// Videos que arrancan solos al llegar a su página (la portada y las transiciones).
// En el iPhone (sobre todo con ahorro de batería) un video no arranca solo, ni en silencio, si no lo autoriza un
// toque, y la autorización es de cada video: al llegar deslizando (que no es un toque) el video se quedaba quieto, y
// solo arrancaba si antes se había tocado la flecha de seguir. Por eso, con cada toque de la visita, cada video que
// aún no está autorizado se reproduce y se pausa al instante: queda autorizado y, al llegar a su página, arranca solo
// (29/10/2026). En los demás navegadores un video en silencio siempre arranca: esto no cambia nada.

const videos = new Set<HTMLVideoElement>();
const allowed = new WeakSet<HTMLVideoElement>();
/** El video de la página visible: ese no se pausa (si estaba quieto, el toque lo arranca). */
let current: HTMLVideoElement | null = null;
const GESTURES = ['touchend', 'click', 'keydown'] as const;
let listening = false;

function allowAll() {
  for (const v of videos) {
    if (allowed.has(v)) continue;
    const wasPaused = v.paused;
    v.muted = true;
    v.play().catch(() => {}); // al pausarlo enseguida, la promesa se rechaza: no es un error
    // Si el navegador lo dejó correr (paused cambia al instante), quedó autorizado; si no (un deslizamiento no es un
    // toque), se intenta con el siguiente toque.
    if (v.paused) continue;
    allowed.add(v);
    if (v !== current && wasPaused) v.pause();
  }
}

/** Anota un video que arranca solo. Devuelve la función que lo quita (al desmontarse). */
export function registerAutoplay(v: HTMLVideoElement): () => void {
  videos.add(v);
  if (!listening) {
    listening = true;
    for (const type of GESTURES) window.addEventListener(type, allowAll, true);
  }
  return () => {
    videos.delete(v);
    if (current === v) current = null;
  };
}

/** El video de la página visible. */
export function setCurrentVideo(v: HTMLVideoElement) {
  current = v;
}

/** Se salió de la página de ese video (si otra página ya puso el suyo, se deja). */
export function leaveVideo(v: HTMLVideoElement) {
  if (current === v) current = null;
}
