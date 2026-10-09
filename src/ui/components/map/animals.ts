// Los animales animados de la diseñadora (los mismos del proyecto de realidad aumentada): ballena jorobada,
// tortuga golfina, cangrejo fantasma rojo, pava del Baudó y rana arlequín. Se copian a public/media/modelos con
// `npm run map:models` (no se versionan) y se cargan después de armar el mapa: mientras llegan, o si faltan, se
// ven las figuras dibujadas con código.
//
// Los cinco miran hacia +z, con la base en y = 0 y el lomo hacia +y. Cada uno trae dos animaciones:
//   ballena: Swin (nadar, 3,3 s) y Jump (salto, 10 s) · tortuga: Swin y Idle · cangrejo: Idle y Walk
//   pava: Idle y Sing (canta) · rana: Walk y Jump (salto, 5,4 s)
// El salto de la ballena y el de la rana se adaptan como en el proyecto de realidad aumentada (ver tameBreach).

import { type AnimationAction, AnimationClip, AnimationMixer, Box3, Group, type KeyframeTrack, LoopOnce, LoopRepeat, type Object3D, type SkinnedMesh, Vector3 } from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { stickerSkinned } from './kit';

export type Species = 'ballena' | 'tortuga' | 'cangrejo' | 'pava' | 'rana';

const FILES: Record<Species, { file: string; ambient: string }> = {
  ballena: { file: 'Ballena_Ani.glb', ambient: 'Swin' },
  tortuga: { file: 'Tortuga_Ani.glb', ambient: 'Swin' },
  cangrejo: { file: 'Cangrejo_Ani.glb', ambient: 'Idle' },
  pava: { file: 'Pava_Ani.glb', ambient: 'Idle' },
  rana: { file: 'Rana_Ani.glb', ambient: 'Walk' },
};
const BASE = '/media/modelos/';

/** Un instante del salto en que el animal rompe el agua, y con qué fuerza salpica (0–1). */
export interface Splash {
  at: number;
  strength: number;
}

interface Template {
  scene: Object3D;
  clips: AnimationClip[];
  /** Escala para que el largo (lado horizontal mayor) mida 1, y desplazamiento para centrarlo con la base en 0. */
  unit: number;
  offset: Vector3;
  /** Alto / largo, ya en la medida normalizada. */
  height: number;
  splashes: Splash[];
}

/** Un animal listo para poner en la escena, con su mezclador de animaciones. */
export interface Animal {
  root: Group;
  mixer: AnimationMixer;
  /** Acción de cada clip, por nombre. */
  actions: Record<string, AnimationAction>;
  /** Alto del animal (unidades de la escena). */
  height: number;
  /** Momentos del salto en que salpica (solo la ballena). */
  splashes: Splash[];
  /** Cambia de animación con un fundido corto. `once`: se reproduce una vez y queda en la última pose. */
  play: (name: string, opts?: { once?: boolean; fade?: number; speed?: number }) => AnimationAction;
}

export type AnimalKit = Partial<Record<Species, (length: number) => Animal>>;

// ───────── Ajustes de los saltos (del proyecto de realidad aumentada) ─────────

/** Altura y avance del salto de la ballena respecto al del archivo (en el mapa se ve de lejos: más alto que en RA). */
const BREACH_SCALE = 0.6;
/** Cuánto se hunde tras caer, en proporción a la altura del salto. */
const BREACH_SINK = 1;
/** Dónde está la superficie, en fracción de la altura del salto sobre la cadera en reposo. */
const BREACH_SURFACE = 0.3;
/** El salto de la rana: más bajo y sin los dos segundos en que mira a los lados antes de agacharse. */
const HOP_SCALE = 0.45;
const HOP_LEAD_IN = 2.1;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * Adapta el `Jump` de la ballena: conserva todos los giros y la subida (a BREACH_SCALE), y reescribe la caída como un
 * arco que dura lo mismo que la subida, con una entrada al agua que frena poco a poco y vuelve a flote. Devuelve los
 * dos salpicones: al romper la superficie subiendo (suave) y al volver a cruzarla cayendo (fuerte).
 */
function tameBreach(clip: AnimationClip) {
  const tamed = clip.clone();
  let splashes: Splash[] = [];
  for (const track of tamed.tracks) {
    if (!/Hips\.position$/.test(track.name)) continue;
    const { times, values } = track;
    const count = times.length;
    const y0 = values[1];
    const z0 = values[2];
    let peak = 0;
    for (let i = 1; i < count; i++) if (values[i * 3 + 1] > values[peak * 3 + 1]) peak = i;
    const rise = values[peak * 3 + 1] - y0;
    if (rise <= 0) continue;
    let takeoff = 0;
    for (let i = 0; i <= peak; i++) {
      if (values[i * 3 + 1] >= y0 + rise * 0.1) { takeoff = i; break; }
    }
    const tPeak = times[peak];
    const tEnd = times[count - 1];
    const fall = Math.max(tPeak - times[takeoff], 1e-3);
    const impact = Math.min(tPeak + fall, tEnd - 1e-3);
    const height = rise * BREACH_SCALE;
    const sink = height * BREACH_SINK;
    const tau = sink / ((2 * height) / fall);
    const surfacing = Math.min(impact + 2 * tau, tEnd);
    for (let i = 0; i < count; i++) {
      const t = times[i];
      let y: number;
      if (i <= peak) y = y0 + (values[i * 3 + 1] - y0) * BREACH_SCALE;
      else if (t <= impact) {
        const x = (t - tPeak) / fall;
        y = y0 + height * (1 - x * x);
      } else {
        const back = smooth((t - surfacing) / Math.max(tEnd - surfacing, 1e-3));
        y = y0 - sink * (1 - Math.exp(-(t - impact) / tau)) * (1 - back);
      }
      values[i * 3 + 1] = y;
      values[i * 3 + 2] = z0 + (values[i * 3 + 2] - z0) * BREACH_SCALE;
    }
    const surface = y0 + height * BREACH_SURFACE;
    let exit = times[takeoff];
    for (let i = 1; i <= peak; i++) {
      const a = values[(i - 1) * 3 + 1];
      const b = values[i * 3 + 1];
      if (a < surface && b >= surface) {
        exit = times[i - 1] + ((surface - a) / (b - a)) * (times[i] - times[i - 1]);
        break;
      }
    }
    splashes = [{ at: exit, strength: 0.5 }, { at: tPeak + fall * Math.sqrt(1 - BREACH_SURFACE), strength: 1 }];
  }
  return { clip: tamed, splashes };
}

/** Quita los primeros `cut` segundos de una pista, sin salto en el primer fotograma. */
function trimStart(track: KeyframeTrack, cut: number) {
  const size = track.getValueSize();
  // `createInterpolant` existe en todas las pistas, pero los tipos de three no lo declaran.
  const interp = (track as unknown as { createInterpolant: () => { evaluate: (t: number) => ArrayLike<number> } }).createInterpolant();
  const first = Array.from(interp.evaluate(cut));
  const times: number[] = [0];
  const values: number[] = [...first];
  for (let i = 0; i < track.times.length; i++) {
    const t = track.times[i];
    if (t <= cut + 1e-6) continue;
    times.push(t - cut);
    for (let k = 0; k < size; k++) values.push(track.values[i * size + k]);
  }
  track.times = new Float32Array(times);
  track.values = new Float32Array(values);
}

/** Adapta el `Jump` de la rana: empieza justo antes de agacharse y salta más bajo, con la misma forma. */
function tameHop(clip: AnimationClip) {
  const tamed = clip.clone();
  const cut = Math.min(HOP_LEAD_IN, clip.duration);
  for (const track of tamed.tracks) trimStart(track, cut);
  tamed.duration = clip.duration - cut;
  for (const track of tamed.tracks) {
    if (!/Hips\.position$/.test(track.name)) continue;
    const v = track.values;
    const [x0, y0, z0] = [v[0], v[1], v[2]];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0 + (v[i] - x0) * HOP_SCALE;
      v[i + 1] = y0 + (v[i + 1] - y0) * HOP_SCALE;
      v[i + 2] = z0 + (v[i + 2] - z0) * HOP_SCALE;
    }
  }
  return tamed;
}

// ───────── Carga ─────────

/** Caja del modelo durante su animación de siempre (la pose de reposo del archivo puede ser otra). */
function measure(scene: Object3D, clip: AnimationClip | undefined) {
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene, true);
  if (!clip) return box;
  const mixer = new AnimationMixer(scene);
  const action = mixer.clipAction(clip).play();
  for (let k = 0; k <= 8; k++) {
    mixer.update(k === 0 ? 0 : clip.duration / 8);
    scene.updateMatrixWorld(true);
    box.union(new Box3().setFromObject(scene, true));
  }
  action.stop();
  mixer.uncacheRoot(scene);
  return box;
}

async function loadOne(loader: GLTFLoader, species: Species): Promise<Template> {
  const { file, ambient } = FILES[species];
  const gltf = await loader.loadAsync(BASE + file);
  let clips = gltf.animations;
  let splashes: Splash[] = [];
  if (species === 'ballena') {
    clips = clips.map((c) => {
      if (c.name !== 'Jump') return c;
      const t = tameBreach(c);
      splashes = t.splashes;
      return t.clip;
    });
  }
  if (species === 'rana') clips = clips.map((c) => (c.name === 'Jump' ? tameHop(c) : c));
  const box = measure(gltf.scene, clips.find((c) => c.name === ambient));
  const size = box.getSize(new Vector3());
  const length = Math.max(size.x, size.z) || 1;
  const center = box.getCenter(new Vector3());
  return {
    scene: gltf.scene,
    clips,
    unit: 1 / length,
    offset: new Vector3(-center.x, -box.min.y, -center.z),
    height: size.y / length,
    splashes,
  };
}

function maker(t: Template) {
  return (length: number): Animal => {
    const model = cloneSkinned(t.scene);
    // Con esqueleto, three recorta con la esfera de la pose de reposo: en pleno salto la ballena desaparecería. Se le da
    // una esfera holgada (cuatro veces la figura): así se sigue recortando cuando el animal no está a la vista, y su
    // esqueleto no se recalcula ni se sube a la tarjeta gráfica en vano.
    model.traverse((o) => {
      const m = o as SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      m.geometry.computeBoundingSphere();
      m.boundingSphere = m.geometry.boundingSphere!.clone();
      m.boundingSphere.radius *= 4;
    });
    stickerSkinned(model, 0.012);
    model.position.copy(t.offset);
    const fit = new Group();
    fit.scale.setScalar(t.unit * length);
    fit.add(model);
    const root = new Group();
    root.add(fit);
    const mixer = new AnimationMixer(model);
    const actions: Record<string, AnimationAction> = {};
    for (const c of t.clips) actions[c.name] = mixer.clipAction(c);
    let current: AnimationAction | null = null;
    const play: Animal['play'] = (name, { once = false, fade = 0.35, speed = 1 } = {}) => {
      const next = actions[name];
      next.reset();
      next.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      next.timeScale = speed;
      next.play();
      if (current && current !== next) current.crossFadeTo(next, fade, false);
      current = next;
      return next;
    };
    return { root, mixer, actions, height: t.height * length, splashes: t.splashes, play };
  };
}

/** Carga los cinco animales. Los que falten (o no abran) quedan fuera y el mapa sigue con su figura dibujada. */
export async function loadAnimals(): Promise<AnimalKit> {
  const draco = new DRACOLoader().setDecoderPath('/draco/').setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const kit: AnimalKit = {};
  const species = Object.keys(FILES) as Species[];
  const results = await Promise.allSettled(species.map((s) => loadOne(loader, s)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') kit[species[i]] = maker(r.value);
    else console.warn(`[mapa] No se pudo cargar el modelo de ${species[i]}; se usa la figura dibujada.`, r.reason);
  });
  draco.dispose();
  return kit;
}
