// Sonido del recorrido con grabaciones reales (public/media/audio, generadas desde Contenido/):
// - Al cambiar de página ya no suena ninguna ola: cada video de transición trae su propio sonido
//   (ajustes del cliente, 30/09/2026).
// - setVoice(id | null): la voz de Chachita de la página visible (chachita/<id>.mp3), una vez;
//   al salir de la página se desvanece.
// - setAmbient('alta' | 'baja' | null): ambiente de marea en bucle solo en su escena
//   (marea-alta.mp3 / marea-baja.mp3). Si el archivo no existe, la escena queda en silencio.
// Los navegadores solo permiten audio tras un gesto del visitante (clic, toque o tecla);
// si se pide antes, queda pendiente y empieza con el primer gesto.

export type Tide = 'alta' | 'baja';

const KEY = 'tv:sound';
const TIDES: Record<Tide, string> = { alta: '/media/audio/marea-alta.mp3', baja: '/media/audio/marea-baja.mp3' };
const VOICE_VOLUME = 1;
const AMBIENT_VOLUME: Record<Tide, number> = { alta: 0.5, baja: 0.45 };
/** Gestos que los navegadores aceptan para permitir audio. */
const GESTURES = ['pointerdown', 'click', 'touchend', 'keydown'] as const;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let wanted: Tide | null = null;
let wantedVoice: string | null = null;
let voice: { id: string; out: GainNode; src: AudioBufferSourceNode | null } | null = null;
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
  if (muted) {
    stopAmbient();
    stopVoice();
  } else {
    if (wanted) void startAmbient(wanted);
    if (wantedVoice) void startVoice(wantedVoice);
  }
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

/** Activa el audio con el primer gesto del visitante. */
export function initAudioUnlock() {
  const unlock = () => {
    unlocked = true;
    audio();
    if (wanted && !isMuted()) void startAmbient(wanted);
    if (wantedVoice && !isMuted()) void startVoice(wantedVoice);
    for (const type of GESTURES) window.removeEventListener(type, unlock, true);
  };
  for (const type of GESTURES) window.addEventListener(type, unlock, true);
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
  fadeOut(out, src, 1.2);
}

/** Ambiente de marea de la escena visible; null lo apaga suavemente. */
export function setAmbient(tide: Tide | null) {
  wanted = tide;
  if (tide) void startAmbient(tide);
  else stopAmbient();
}

const voiceUrl = (id: string) => `/media/audio/chachita/${id}.mp3`;

/** Suaviza la salida de un sonido y lo detiene. */
function fadeOut(out: GainNode, src: AudioBufferSourceNode | null, seconds: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  src?.stop(t + seconds + 0.1);
  window.setTimeout(() => out.disconnect(), (seconds + 0.2) * 1000);
}

async function startVoice(id: string) {
  const ac = audio();
  if (!ac || !master || isMuted()) return;
  if (voice?.id === id) return;
  stopVoice();
  const out = ac.createGain();
  out.gain.value = VOICE_VOLUME;
  out.connect(master);
  const current = { id, out, src: null as AudioBufferSourceNode | null };
  voice = current;

  const buffer = await load(voiceUrl(id));
  if (!buffer || voice !== current) return;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.connect(out);
  src.onended = () => { if (voice === current) voice = null; };
  src.start();
  current.src = src;
}

function stopVoice() {
  if (!voice) return;
  const { out, src } = voice;
  voice = null;
  fadeOut(out, src, 0.8);
}

/** Voz de Chachita de la página visible; null la desvanece. Suena una vez por visita a la página. */
export function setVoice(id: string | null) {
  if (id === wantedVoice) return;
  wantedVoice = id;
  if (id) void startVoice(id);
  else stopVoice();
}
