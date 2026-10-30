// Sonido del recorrido con grabaciones reales (public/media/audio, generadas desde Contenido/):
// - playTransition(): una ola corta al cambiar de página (ola-1/2/3.mp3, alternándose).
//   No suena al entrar a una transición con video: ese video trae su propio sonido (30/09/2026).
//   Con ?ola=1, ?ola=2 u ?ola=3 en la dirección se fija una para compararlas.
// - setVoice(id | null): la voz de Chachita de la página visible (chachita/<id>.mp3), una vez;
//   al salir de la página se desvanece.
// - setAmbient('alta' | 'baja' | null): ambiente de marea en bucle solo en su escena
//   (marea-alta.mp3 / marea-baja.mp3). Si el archivo no existe, la escena queda en silencio.
// - setTrack(url, at) / clearTrack(url): el sonido de un video de transición (la voz de Chachita integrada), sacado
//   aparte (<id>-audio.m4a). El video corre en silencio y este sonido va a la par, desde `at()` (29/10/2026): en el
//   iPhone cada video pedía su propio toque para sonar y, al llegar deslizando, no sonaba; este audio queda
//   desbloqueado con el primer toque de la visita y suena en todos los videos que siguen.
// Los navegadores solo permiten audio tras un gesto del visitante (clic, toque o tecla);
// si se pide antes, queda pendiente y empieza con el primer gesto.
// En el iPhone, el audio del webdoc suena aunque el celular esté en silencio (como un video o la música): ver
// audioSession más abajo.

export type Tide = 'alta' | 'baja';

const KEY = 'tv:sound';
const TIDES: Record<Tide, string> = { alta: '/media/audio/marea-alta.mp3', baja: '/media/audio/marea-baja.mp3' };
const WAVES = ['/media/audio/ola-1.mp3', '/media/audio/ola-2.mp3', '/media/audio/ola-3.mp3'];
const TRANSITION_VOLUME = 0.55;
const VOICE_VOLUME = 1;
const TRACK_VOLUME = 1;
const AMBIENT_VOLUME: Record<Tide, number> = { alta: 0.5, baja: 0.45 };
/** Gestos que los navegadores aceptan para permitir audio. */
const GESTURES = ['pointerdown', 'click', 'touchend', 'keydown'] as const;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let lastTransition = 0;
let nextWave = 0;
let wanted: Tide | null = null;
let wantedVoice: string | null = null;
let voice: { id: string; out: GainNode; src: AudioBufferSourceNode | null } | null = null;
let ambient: { tide: Tide; out: GainNode; src: AudioBufferSourceNode | null } | null = null;
let wantedTrack: { url: string; at: () => number } | null = null;
let track: { url: string; out: GainNode; src: AudioBufferSourceNode | null } | null = null;

// iPhone (Safari 16.4+): el audio del webdoc es reproducción, como un video; sin esto, con el interruptor de silencio
// puesto no se oye nada.
try {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
} catch {
  /* sin audioSession: como siempre */
}
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
    stopTrack();
  } else {
    if (wanted) void startAmbient(wanted);
    if (wantedVoice) void startVoice(wantedVoice);
    if (wantedTrack) void startTrack();
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

/** Activa el audio con el primer gesto del visitante y precarga las olas. */
export function initAudioUnlock() {
  let started = false;
  const unlock = () => {
    unlocked = true;
    const ac = audio();
    if (!ac) return;
    // Solo cuenta cuando el audio de verdad quedó activo: en el iPhone un deslizamiento no lo activa (no es un toque),
    // y se sigue esperando el primer toque en vez de darlo por desbloqueado.
    const go = () => {
      if (started || ac.state !== 'running') return;
      started = true;
      for (const type of GESTURES) window.removeEventListener(type, unlock, true);
      WAVES.forEach((url) => void load(url));
      if (wanted && !isMuted()) void startAmbient(wanted);
      if (wantedVoice && !isMuted()) void startVoice(wantedVoice);
      if (wantedTrack && !isMuted()) void startTrack();
    };
    if (ac.state === 'running') go();
    else void ac.resume().then(go, () => {});
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

/**
 * Sonido de un video de transición: suena desde `at()` (el punto del video, que sigue corriendo en silencio) y en
 * bucle, como el video. Si el audio aún no está desbloqueado, empieza con el primer toque, en el punto en que vaya.
 */
export function setTrack(url: string, at: () => number) {
  wantedTrack = { url, at };
  void startTrack();
}

/** Apaga el sonido del video `url` (si es el que suena; el de la página siguiente puede haber empezado ya). */
export function clearTrack(url: string) {
  if (wantedTrack?.url !== url) return;
  wantedTrack = null;
  stopTrack();
}

/** Descarga el sonido de un video antes de llegar a él (si el audio ya está desbloqueado). */
export function preloadTrack(url: string) {
  if (unlocked) void load(url);
}

async function startTrack() {
  const want = wantedTrack;
  const ac = audio();
  if (!want || !ac || !master || isMuted()) return;
  stopTrack();
  const out = ac.createGain();
  out.gain.value = TRACK_VOLUME;
  out.connect(master);
  const current = { url: want.url, out, src: null as AudioBufferSourceNode | null };
  track = current;

  const buffer = await load(want.url);
  if (!buffer || track !== current || wantedTrack !== want) return;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(out);
  // El punto del video al momento de sonar (la descarga pudo tardar): así la voz va con la imagen.
  src.start(0, Math.max(0, want.at()) % buffer.duration);
  current.src = src;
}

function stopTrack() {
  if (!track) return;
  const { out, src } = track;
  track = null;
  fadeOut(out, src, 0.6);
}
