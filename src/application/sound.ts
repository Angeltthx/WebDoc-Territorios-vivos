// Sonido del recorrido, sintetizado con Web Audio (sin archivos de audio):
// - playTransition(): un vaivén de agua suave y lento al cambiar de página.
// - setAmbient('alta' | 'baja' | null): ambiente de marea continuo mientras se está en esa escena.
// Los navegadores solo permiten audio tras un gesto del visitante (clic, toque o tecla);
// si se pide antes, queda pendiente y empieza con el primer gesto.

export type Tide = 'alta' | 'baja';

const KEY = 'tv:sound';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let unlocked = false;
let lastTransition = 0;
let wanted: Tide | null = null;
let ambient: { tide: Tide; out: GainNode; bed: AudioBufferSourceNode; timer: number } | null = null;

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
  else if (wanted) startAmbient(wanted);
}

function audio(): AudioContext | null {
  if (!unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 2600;
    master.connect(soften).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Gestos que los navegadores aceptan para permitir audio. */
const GESTURES = ['pointerdown', 'click', 'touchend', 'keydown'] as const;

/** Activa el audio con el primer gesto del visitante. */
export function initAudioUnlock() {
  const unlock = () => {
    unlocked = true;
    audio();
    if (wanted && !isMuted()) startAmbient(wanted);
    for (const type of GESTURES) window.removeEventListener(type, unlock, true);
  };
  for (const type of GESTURES) window.addEventListener(type, unlock, true);
}

/** Ruido "marrón": grave y suave, la base de todos los sonidos de agua. */
function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = ac.sampleRate * 4;
  noise = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = noise.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return noise;
}

function noiseSource(ac: AudioContext, loop = false) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.loop = loop;
  return src;
}

/** Gota lejana: tono breve y muy suave. */
function droplet(ac: AudioContext, at: number, out: AudioNode, level = 0.025) {
  const f = 700 + Math.random() * 600;
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(f, at);
  osc.frequency.exponentialRampToValueAtTime(f * 1.8, at + 0.08);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + 0.2);
}

/** Vaivén de agua al cambiar de página: entra y sale despacio, sin golpes. */
export function playTransition() {
  if (isMuted()) return;
  const ac = audio();
  if (!ac || !master) return;
  const now = performance.now();
  if (now - lastTransition < 900) return; // desplazamientos rápidos: un solo sonido
  lastTransition = now;

  const t = ac.currentTime + 0.02;
  const src = noiseSource(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.6;
  filter.frequency.setValueAtTime(260, t);
  filter.frequency.exponentialRampToValueAtTime(950, t + 0.9);
  filter.frequency.exponentialRampToValueAtTime(240, t + 2.6);
  const pan = ac.createStereoPanner();
  pan.pan.setValueAtTime(-0.35, t);
  pan.pan.linearRampToValueAtTime(0.35, t + 2.6);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
  src.connect(filter).connect(g).connect(pan).connect(master);
  src.start(t, Math.random() * 2);
  src.stop(t + 3);

  for (let i = 0; i < 2; i++) droplet(ac, t + 0.9 + Math.random() * 1.2, master);
}

/** Programa olas sucesivas del ambiente de marea mientras siga activo. */
function scheduleWave(ac: AudioContext, tide: Tide, out: GainNode) {
  const high = tide === 'alta';
  const t = ac.currentTime + 0.05;
  const rise = high ? 2.2 + Math.random() : 0.9 + Math.random() * 0.5;
  const fall = high ? 3.6 + Math.random() * 1.5 : 1.4 + Math.random() * 0.8;
  const peak = high ? 0.42 + Math.random() * 0.15 : 0.16 + Math.random() * 0.06;

  const src = noiseSource(ac);
  const filter = ac.createBiquadFilter();
  filter.type = high ? 'lowpass' : 'bandpass';
  filter.Q.value = high ? 0.5 : 0.9;
  const base = high ? 320 : 520;
  filter.frequency.setValueAtTime(base, t);
  filter.frequency.exponentialRampToValueAtTime(high ? 1500 : 1100, t + rise);
  filter.frequency.exponentialRampToValueAtTime(base, t + rise + fall);
  const pan = ac.createStereoPanner();
  pan.pan.value = (Math.random() * 2 - 1) * 0.5;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + rise);
  g.gain.exponentialRampToValueAtTime(0.0001, t + rise + fall);
  src.connect(filter).connect(g).connect(pan).connect(out);
  src.start(t, Math.random() * 3);
  src.stop(t + rise + fall + 0.1);

  if (!high && Math.random() < 0.6) droplet(ac, t + rise + Math.random() * fall, out, 0.018);

  // La siguiente ola llega antes de que termine esta, para que el sonido no se corte.
  const gap = high ? rise + fall * 0.55 : rise + fall * 0.7 + Math.random() * 0.8;
  return window.setTimeout(() => {
    if (ambient && ambient.out === out) ambient.timer = scheduleWave(ac, tide, out);
  }, gap * 1000);
}

function startAmbient(tide: Tide) {
  const ac = audio();
  if (!ac || !master || isMuted()) return;
  if (ambient?.tide === tide) return;
  stopAmbient();
  const out = ac.createGain();
  const t = ac.currentTime;
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + 2);

  // Fondo continuo muy bajo, para que entre ola y ola no haya silencio total.
  const bed = noiseSource(ac, true);
  const bedFilter = ac.createBiquadFilter();
  bedFilter.type = 'lowpass';
  bedFilter.frequency.value = tide === 'alta' ? 380 : 600;
  const bedGain = ac.createGain();
  bedGain.gain.value = tide === 'alta' ? 0.07 : 0.035;
  bed.connect(bedFilter).connect(bedGain).connect(out);
  bed.start();

  out.connect(master);
  ambient = { tide, out, bed, timer: 0 };
  ambient.timer = scheduleWave(ac, tide, out);
}

function stopAmbient() {
  if (!ambient || !ctx) return;
  const { out, bed, timer } = ambient;
  ambient = null;
  window.clearTimeout(timer);
  const t = ctx.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  bed.stop(t + 1.3);
  window.setTimeout(() => out.disconnect(), 1400);
}

/** Ambiente de marea de la escena visible; null lo apaga suavemente. */
export function setAmbient(tide: Tide | null) {
  wanted = tide;
  if (tide) startAmbient(tide);
  else stopAmbient();
}
