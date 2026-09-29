// Sonido de agua al pasar de página, sintetizado con Web Audio (sin archivos que descargar).
// Un "oleaje" de ruido filtrado más unas burbujas. Solo suena después de un gesto del visitante.

const KEY = 'tv:sound';
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

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
}

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = ac.sampleRate * 2;
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const data = noise.getChannelData(0);
  // Ruido "marrón": más grave y suave que el blanco, parecido al agua.
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return noise;
}

/** Oleaje que sube y baja, con el filtro barriendo como una ola que pasa. */
function wave(ac: AudioContext, t: number, out: AudioNode) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(350, t);
  filter.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
  filter.frequency.exponentialRampToValueAtTime(280, t + 1.4);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  src.connect(filter).connect(gain).connect(out);
  src.start(t, Math.random());
  src.stop(t + 1.6);
}

/** Burbujas: tonos cortos que suben de frecuencia. */
function bubbles(ac: AudioContext, t: number, out: AudioNode) {
  const count = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const start = t + 0.15 + Math.random() * 0.7;
    const f = 380 + Math.random() * 520;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, start);
    osc.frequency.exponentialRampToValueAtTime(f * (2 + Math.random()), start + 0.07);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + 0.1);
  }
}

export function playWater() {
  if (isMuted()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  const master = ac.createGain();
  master.gain.value = 0.6;
  const soften = ac.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 3500;
  master.connect(soften).connect(ac.destination);
  wave(ac, t, master);
  bubbles(ac, t, master);
}
