// Sonido del recorrido con grabaciones reales (public/media/audio, generadas desde Contenido/):
// - playTransition(): una ola corta al cambiar de página (ola-1/2/3.mp3, alternándose).
//   Con ?ola=1, ?ola=2 u ?ola=3 en la dirección se fija una para compararlas.
// - setAmbient('alta' | 'baja' | null): ambiente de marea en bucle solo en su escena
//   (marea-alta.mp3 / marea-baja.mp3). Si el archivo no existe, la escena queda en silencio.
// Los navegadores solo permiten audio tras un gesto del visitante (clic, toque o tecla);
// si se pide antes, queda pendiente y empieza con el primer gesto.

export type Tide = 'alta' | 'baja';

const KEY = 'tv:sound';
const WAVES = ['/media/audio/ola-1.mp3', '/media/audio/ola-2.mp3', '/media/audio/ola-3.mp3'];
const TIDES: Record<Tide, string> = { alta: '/media/audio/marea-alta.mp3', baja: '/media/audio/marea-baja.mp3' };
const TRANSITION_VOLUME = 0.55;
const AMBIENT_VOLUME: Record<Tide, number> = { alta: 0.5, baja: 0.45 };
/** Gestos que los navegadores aceptan para permitir audio. */
const GESTURES = ['pointerdown', 'click', 'touchend', 'keydown'] as const;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let lastTransition = 0;
let nextWave = 0;
let wanted: Tide | null = null;
let ambient: { tide: Tide; out: GainNode; src: AudioBufferSourceNode | null } | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

export function isMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(KEY, muted ? 'off' : 'on');
  } catch {
    /* sin almacenamiento: la preferencia dura solo esta visita */
  }
  if (muted) stopAmbient();
  else if (wanted) void startAmbient(wanted);
}

function audio(): AudioContext | null {
  if (!unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Descarga y decodifica un audio una sola vez; null si no existe o falla. */
function load(url: string): Promise<AudioBuffer | null> {
  const ac = audio();
  if (!ac) return Promise.resolve(null);
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ac.decodeAudioData(data))
      .catch(() => null);
    buffers.set(url, p);
  }
  return p;
}

/** Activa el audio con el primer gesto del visitante y precarga las olas. */
export function initAudioUnlock() {
  const unlock = () => {
    unlocked = true;
    audio();
    WAVES.forEach((url) => void load(url));
    if (wanted && !isMuted()) void startAmbient(wanted);
    for (const type of GESTURES) window.removeEventListener(type, unlock, true);
  };
  for (const type of GESTURES) window.addEventListener(type, unlock, true);
}

/** Ola elegida con ?ola=N, o la siguiente de la rotación. */
function pickWave(): string {
  const fixed = Number(new URLSearchParams(window.location.search).get('ola'));
  if (fixed >= 1 && fixed <= WAVES.length) return WAVES[fixed - 1];
  const url = WAVES[nextWave];
  nextWave = (nextWave + 1) % WAVES.length;
  return url;
}

/** Una ola corta al cambiar de página. */
export function playTransition() {
  if (isMuted()) return;
  const ac = audio();
  if (!ac || !master) return;
  const now = performance.now();
  if (now - lastTransition < 1200) return; // desplazamientos rápidos: una sola ola
  lastTransition = now;
  void load(pickWave()).then((buffer) => {
    if (!buffer || !master) return;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const g = ac.createGain();
    g.gain.value = TRANSITION_VOLUME;
    src.connect(g).connect(master);
    src.start();
  });
}

async function startAmbient(tide: Tide) {
  const ac = audio();
  if (!ac || !master || isMuted()) return;
  if (ambient?.tide === tide) return;
  stopAmbient();
  const out = ac.createGain();
  out.gain.value = 0.0001;
  out.connect(master);
  const current = { tide, out, src: null as AudioBufferSourceNode | null };
  ambient = current;

  const buffer = await load(TIDES[tide]);
  if (!buffer || ambient !== current) return; // sin archivo, o el visitante ya salió de la escena
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(out);
  src.start();
  current.src = src;
  const t = ac.currentTime;
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(AMBIENT_VOLUME[tide], t + 2);
}

function stopAmbient() {
  if (!ambient || !ctx) return;
  const { out, src } = ambient;
  ambient = null;
  const t = ctx.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  src?.stop(t + 1.3);
  window.setTimeout(() => out.disconnect(), 1400);
}

/** Ambiente de marea de la escena visible; null lo apaga suavemente. */
export function setAmbient(tide: Tide | null) {
  wanted = tide;
  if (tide) void startAmbient(tide);
  else stopAmbient();
}
