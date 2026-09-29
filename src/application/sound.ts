// Sonido del recorrido, sintetizado con Web Audio (sin archivos de audio):
// - playTransition(): una ola corta y lejana al cambiar de página.
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
    master.gain.value = 0.8;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 11000;
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

/** Ruido rosa estéreo (dos canales distintos): la base más natural para el sonido del mar. */
function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = ac.sampleRate * 6;
  noise = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = noise.getChannelData(ch);
    // Filtro de Paul Kellet: aproxima ruido rosa a partir de ruido blanco.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
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

interface WaveShape {
  /** Segundos que tarda la ola en crecer y en retirarse. */
  rise: number;
  fall: number;
  /** Volumen del cuerpo de la ola y de la espuma. */
  body: number;
  foam: number;
  /** Frecuencia máxima del cuerpo al romper (más alta = ola más fuerte). */
  crest: number;
}

/**
 * Una ola de mar: el cuerpo (rumor grave que crece y se abre al romper) y la espuma
 * (siseo agudo que aparece al romper y se retira despacio sobre la arena).
 */
function seaWave(ac: AudioContext, t: number, out: AudioNode, w: WaveShape) {
  const end = t + w.rise + w.fall;
  const pan = ac.createStereoPanner();
  pan.pan.value = (Math.random() * 2 - 1) * 0.35;
  pan.connect(out);

  const body = noiseSource(ac);
  const bodyFilter = ac.createBiquadFilter();
  bodyFilter.type = 'lowpass';
  bodyFilter.Q.value = 0.4;
  bodyFilter.frequency.setValueAtTime(300, t);
  bodyFilter.frequency.exponentialRampToValueAtTime(w.crest, t + w.rise);
  bodyFilter.frequency.exponentialRampToValueAtTime(380, end);
  const bodyGain = ac.createGain();
  bodyGain.gain.setValueAtTime(0.0001, t);
  bodyGain.gain.exponentialRampToValueAtTime(w.body, t + w.rise);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, end);
  body.connect(bodyFilter).connect(bodyGain).connect(pan);
  body.start(t, Math.random() * 4);
  body.stop(end + 0.05);

  const foam = noiseSource(ac);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2200;
  const air = ac.createBiquadFilter();
  air.type = 'lowpass';
  air.frequency.setValueAtTime(9000, t + w.rise * 0.8);
  air.frequency.exponentialRampToValueAtTime(3500, end);
  const foamGain = ac.createGain();
  foamGain.gain.setValueAtTime(0.0001, t);
  foamGain.gain.setValueAtTime(0.0001, t + w.rise * 0.6);
  foamGain.gain.exponentialRampToValueAtTime(w.foam, t + w.rise * 1.05);
  foamGain.gain.exponentialRampToValueAtTime(0.0001, end + 0.3);
  foam.connect(hp).connect(air).connect(foamGain).connect(pan);
  foam.start(t, Math.random() * 4);
  foam.stop(end + 0.4);

  window.setTimeout(() => pan.disconnect(), (end - ac.currentTime + 0.6) * 1000);
}

/** Una ola corta y lejana al cambiar de página: suave, sin golpes. */
export function playTransition() {
  if (isMuted()) return;
  const ac = audio();
  if (!ac || !master) return;
  const now = performance.now();
  if (now - lastTransition < 1200) return; // desplazamientos rápidos: una sola ola
  lastTransition = now;
  seaWave(ac, ac.currentTime + 0.02, master, { rise: 0.75, fall: 1.5, body: 0.13, foam: 0.05, crest: 1600 });
}

/** Programa olas sucesivas del ambiente de marea mientras siga activo. */
function scheduleWave(ac: AudioContext, tide: Tide, out: GainNode) {
  const high = tide === 'alta';
  const shape: WaveShape = high
    ? { rise: 2.2 + Math.random(), fall: 3.4 + Math.random() * 1.6, body: 0.32 + Math.random() * 0.1, foam: 0.1 + Math.random() * 0.04, crest: 2400 + Math.random() * 600 }
    : { rise: 1 + Math.random() * 0.5, fall: 1.6 + Math.random() * 0.8, body: 0.1 + Math.random() * 0.04, foam: 0.045 + Math.random() * 0.02, crest: 1200 + Math.random() * 300 };
  seaWave(ac, ac.currentTime + 0.05, out, shape);

  // La siguiente ola llega antes de que termine esta, para que el sonido no se corte.
  const gap = high ? shape.rise + shape.fall * 0.5 : shape.rise + shape.fall * 0.6 + Math.random() * 0.6;
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
  bedFilter.frequency.value = tide === 'alta' ? 420 : 700;
  const bedGain = ac.createGain();
  bedGain.gain.value = tide === 'alta' ? 0.09 : 0.04;
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
