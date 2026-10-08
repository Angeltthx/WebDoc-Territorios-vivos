// Entrada del mapa: el planeta Tierra dibujado con el arte del afiche (mar turquesa con remolinos, selva verde
// oscuro con hojas, flores). Solo el Chocó se puede tocar: al tocarlo o al acercarse, el planeta gira hacia
// Colombia, se acerca al Chocó y da paso al mapa de la costa.
//
// Todo se dibuja con código sobre lienzos (canvas) a partir de los contornos de map-world.ts; no hay imágenes.

import {
  AdditiveBlending, BackSide, CanvasTexture, Group, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion,
  Raycaster, SRGBColorSpace, Scene, ShaderMaterial, SphereGeometry, Timer, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { COUNTRIES, DEPARTMENTS, LAND } from '../../../content/map-world';

const R = 1;
const DEG = Math.PI / 180;
const NUQUI = { lat: 5.71, lon: -77.27 };

/** Paleta del afiche. */
export const POSTER = {
  sea: '#1f8f97',
  seaDeep: '#177c88',
  seaLight: '#35aeac',
  swirl: '#156f7b',
  foam: '#d9f2ee',
  jungle: '#23533a',
  jungleDark: '#1a4330',
  leaf: '#2f6b45',
  blob: '#6aa84a',
  colombia: '#2c6442',
  choco: '#4f9a52',
  cream: '#fdf6e3',
  pink: '#e2456f',
  orange: '#f39a5a',
  yellow: '#f7cf3d',
};

/** Latitud/longitud → punto de la esfera (misma convención que SphereGeometry y su textura equirrectangular). */
export function latLonToVec(lat: number, lon: number, r = R) {
  const phi = (lon + 180) * DEG;
  const theta = (90 - lat) * DEG;
  return new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(r);
}
function vecToLatLon(v: Vector3) {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(MathUtils.clamp(n.y, -1, 1)) / DEG;
  let lon = Math.atan2(n.z, -n.x) / DEG - 180;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

const unpack = (ring: number[]) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < ring.length; i += 2) pts.push([ring[i] / 100, ring[i + 1] / 100]);
  return pts;
};

function inRing(lon: number, lat: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const CHOCO = DEPARTMENTS.find((d) => d.name === 'Chocó')!.rings.map(unpack);
const COLOMBIA = COUNTRIES.find((c) => c.name === 'Colombia')!.rings.map(unpack);
const isChoco = (lat: number, lon: number) => CHOCO.some((r) => inRing(lon, lat, r));

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ───────── Dibujo con el arte del afiche ─────────

interface View { lon0: number; lat1: number; lonSpan: number; latSpan: number; w: number; h: number }
const px = (v: View, lon: number, lat: number): [number, number] => [((lon - v.lon0) / v.lonSpan) * v.w, ((v.lat1 - lat) / v.latSpan) * v.h];

function tracePath(ctx: CanvasRenderingContext2D, v: View, rings: [number, number][][]) {
  ctx.beginPath();
  for (const ring of rings) {
    ring.forEach(([lo, la], i) => {
      const [x, y] = px(v, lo, la);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
}

/** Remolinos del mar: trazos curvos que siguen un campo de flujo, como los del afiche. */
function drawSea(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number, seed: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, POSTER.seaDeep);
  g.addColorStop(0.5, POSTER.sea);
  g.addColorStop(1, POSTER.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rand = rng(seed);
  const flow = (x: number, y: number) => Math.sin(x * 0.006 / scale + Math.cos(y * 0.008 / scale) * 2) * 2 + Math.cos(y * 0.005 / scale) * 1.4;
  ctx.lineCap = 'round';
  const strokes = Math.round((w * h) / (5200 * scale * scale));
  for (let i = 0; i < strokes; i++) {
    let x = rand() * w;
    let y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const len = 14 + rand() * 30;
    for (let k = 0; k < len; k++) {
      const a = flow(x, y);
      x += Math.cos(a) * 4 * scale;
      y += Math.sin(a) * 4 * scale;
      ctx.lineTo(x, y);
    }
    const light = rand() < 0.25;
    ctx.strokeStyle = light ? 'rgba(80, 190, 190, 0.35)' : 'rgba(18, 100, 112, 0.55)';
    ctx.lineWidth = (light ? 1.4 : 2.4 + rand() * 2.4) * scale;
    ctx.stroke();
  }
}

/** Selva: verde oscuro con hojas, helechos, manchas claras y algunas flores. */
function drawJungle(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number, seed: number, flowers: boolean) {
  const rand = rng(seed);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = POSTER.jungle;
  ctx.fillRect(0, 0, w, h);
  const leaves = Math.round((w * h) / (260 * scale * scale));
  for (let i = 0; i < leaves; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * Math.PI * 2;
    const l = (4 + rand() * 7) * scale;
    ctx.fillStyle = rand() < 0.6 ? POSTER.jungleDark : POSTER.leaf;
    ctx.beginPath();
    ctx.ellipse(x, y, l, l * 0.32, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // Helechos: un tallo con hojitas a los lados.
  const ferns = Math.round((w * h) / (9000 * scale * scale));
  ctx.strokeStyle = POSTER.leaf;
  ctx.lineWidth = 1.2 * scale;
  for (let i = 0; i < ferns; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * Math.PI * 2;
    const l = (10 + rand() * 14) * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const cx = x + Math.cos(a) * l * t;
      const cy = y + Math.sin(a) * l * t;
      for (const s of [-1, 1]) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a + s * 1.1) * l * 0.28 * (1 - t * 0.6), cy + Math.sin(a + s * 1.1) * l * 0.28 * (1 - t * 0.6));
      }
    }
    ctx.stroke();
  }
  // Manchas verde claro (hojas grandes vistas desde arriba).
  const blobs = Math.round((w * h) / (40000 * scale * scale));
  ctx.fillStyle = POSTER.blob;
  for (let i = 0; i < blobs; i++) {
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, (7 + rand() * 6) * scale, (4 + rand() * 3) * scale, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  if (flowers) {
    const n = Math.round((w * h) / (30000 * scale * scale));
    for (let i = 0; i < n; i++) flower(ctx, rand() * w, rand() * h, (3 + rand() * 3) * scale, rand() < 0.6 ? '#ef86bd' : POSTER.orange);
  }
  ctx.restore();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.6, r * 0.4, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = POSTER.yellow;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Orilla: franja turquesa clara en el agua y un borde claro, como en el afiche. */
function drawShore(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(70, 190, 185, 0.65)';
  ctx.lineWidth = 9 * scale;
  ctx.stroke();
  ctx.strokeStyle = POSTER.foam;
  ctx.lineWidth = 1.6 * scale;
  ctx.stroke();
  ctx.restore();
}

function worldTexture() {
  const w = 4096;
  const h = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const v: View = { lon0: -180, lat1: 90, lonSpan: 360, latSpan: 180, w, h };
  drawSea(ctx, w, h, 1, 7);
  const land = LAND.map(unpack);
  tracePath(ctx, v, land);
  drawShore(ctx, 1);
  tracePath(ctx, v, land);
  drawJungle(ctx, w, h, 1, 11, false);
  // Colombia un poco más clara y con borde crema.
  tracePath(ctx, v, COLOMBIA);
  ctx.fillStyle = POSTER.colombia;
  ctx.fill();
  ctx.strokeStyle = POSTER.cream;
  ctx.lineWidth = 2;
  ctx.stroke();
  tracePath(ctx, v, CHOCO);
  ctx.fillStyle = POSTER.choco;
  ctx.fill();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Región de Colombia con detalle (para cuando la cámara se acerca). */
const REGION = { lonMin: -84, lonMax: -66, latMin: -5, latMax: 13 };

function regionTexture() {
  const w = 2560;
  const h = 2560;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const v: View = { lon0: REGION.lonMin, lat1: REGION.latMax, lonSpan: REGION.lonMax - REGION.lonMin, latSpan: REGION.latMax - REGION.latMin, w, h };
  const scale = 2.2;
  drawSea(ctx, w, h, scale, 3);
  const all = COUNTRIES.flatMap((c) => c.rings.map(unpack));
  tracePath(ctx, v, all);
  drawShore(ctx, scale);
  tracePath(ctx, v, all);
  drawJungle(ctx, w, h, scale, 5, false);
  // Colombia con sus departamentos.
  tracePath(ctx, v, COLOMBIA);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = POSTER.colombia;
  ctx.fillRect(0, 0, w, h);
  tracePath(ctx, v, COLOMBIA);
  drawJungle(ctx, w, h, scale * 0.8, 9, true);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#7fc06a';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(253, 246, 227, 0.35)';
  ctx.lineWidth = 2;
  for (const d of DEPARTMENTS) {
    if (d.name === 'Chocó') continue;
    tracePath(ctx, v, d.rings.map(unpack));
    ctx.stroke();
  }
  // El Chocó: verde vivo con flores y borde rosado.
  tracePath(ctx, v, CHOCO);
  ctx.save();
  ctx.clip();
  tracePath(ctx, v, CHOCO);
  drawJungle(ctx, w, h, 1.2, 21, true);
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#8fd06a';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  tracePath(ctx, v, CHOCO);
  ctx.strokeStyle = POSTER.pink;
  ctx.lineWidth = 3;
  ctx.stroke();
  tracePath(ctx, v, COLOMBIA);
  ctx.strokeStyle = POSTER.cream;
  ctx.lineWidth = 4;
  ctx.stroke();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ───────── Escena ─────────

export interface GlobeHandle {
  /** Vuelve a la vista del planeta (al salir del mapa). */
  reset: () => void;
  setActive: (active: boolean) => void;
  dispose: () => void;
}

export interface GlobeOptions {
  /** El visitante eligió el Chocó: termina el acercamiento y hay que mostrar el mapa. */
  onArrive: () => void;
  /** Empezó el viaje hacia el Chocó (para ir preparando la transición). */
  onDive: () => void;
}

export function createGlobe(host: HTMLElement, { onArrive, onDive }: GlobeOptions): GlobeHandle {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'globe-labels';
  host.appendChild(labels.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.01, 100);
  const globe = new Group();
  scene.add(globe);

  const world = new Mesh(new SphereGeometry(R, 128, 96), new MeshBasicMaterial({ map: worldTexture() }));
  globe.add(world);
  const patchGeo = new SphereGeometry(
    R * 1.0008, 96, 96,
    (REGION.lonMin + 180) * DEG, (REGION.lonMax - REGION.lonMin) * DEG,
    (90 - REGION.latMax) * DEG, (REGION.latMax - REGION.latMin) * DEG,
  );
  const patchMat = new MeshBasicMaterial({ map: regionTexture(), transparent: true, opacity: 0 });
  const patch = new Mesh(patchGeo, patchMat);
  globe.add(patch);

  // Halo de atmósfera turquesa.
  const halo = new Mesh(
    new SphereGeometry(R * 1.1, 64, 48),
    new ShaderMaterial({
      side: BackSide,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV;
        void main() {
          // Brilla pegado al borde del planeta y se desvanece hacia afuera.
          float f = 1.0 - smoothstep(-0.42, 0.0, dot(vN, vV));
          gl_FragColor = vec4(vec3(0.45, 0.85, 0.9) * f * 0.9, f);
        }`,
    }),
  );
  scene.add(halo);

  // Marcador del Chocó (rosado, como los del afiche) y rótulos.
  const mkLabel = (cls: string, text: string, sub?: string) => {
    const el = document.createElement('div');
    el.className = `globe-label ${cls}`;
    el.textContent = text;
    if (sub) {
      const s = document.createElement('em');
      s.textContent = sub;
      el.append(s);
    }
    return el;
  };
  const chocoAnchor = latLonToVec(6, -76.9, R * 1.002);
  /** Punto al que baja la cámara: la costa de Nuquí, en el Chocó. */
  const arrival = latLonToVec(5.85, -77.2, R);
  const chocoEl = document.createElement('button');
  chocoEl.type = 'button';
  chocoEl.className = 'globe-label globe-label--choco';
  chocoEl.innerHTML = '<span class="globe-pin" aria-hidden="true"></span>Chocó';
  chocoEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  chocoEl.addEventListener('click', () => dive());
  const chocoLabel = new CSS2DObject(chocoEl);
  chocoLabel.center.set(0.5, 1);
  chocoLabel.position.copy(chocoAnchor);
  globe.add(chocoLabel);

  const extra = [
    { el: mkLabel('globe-label--country', 'Colombia'), at: latLonToVec(3.5, -73, R * 1.002), near: true },
    { el: mkLabel('globe-label--sea', 'Océano Pacífico'), at: latLonToVec(2, -81.5, R * 1.002), near: true },
    { el: mkLabel('globe-label--sea', 'Mar Caribe'), at: latLonToVec(12.3, -76.5, R * 1.002), near: true },
    { el: mkLabel('globe-label--town', 'Nuquí'), at: latLonToVec(NUQUI.lat, NUQUI.lon, R * 1.002), near: true },
  ];
  for (const x of extra) {
    const o = new CSS2DObject(x.el);
    o.position.copy(x.at);
    globe.add(o);
  }

  // ───────── Movimiento ─────────
  const facingChoco = new Quaternion().setFromUnitVectors(arrival.clone().normalize(), new Vector3(0, 0, 1));
  // Vista inicial: América de frente, con el planeta un poco girado.
  const startQ = new Quaternion().setFromUnitVectors(latLonToVec(8, -60).normalize(), new Vector3(0, 0, 1));
  const state = {
    q: startQ.clone(),
    spin: new Vector2(0.06, 0),
    dist: 4.2,
    goalDist: 3.4,
    diving: false,
    diveT: 0,
    fromQ: new Quaternion(),
    fromDist: 3.4,
    arrived: false,
    active: true,
    hover: false,
  };
  globe.quaternion.copy(state.q);

  const dive = () => {
    if (state.diving) return;
    state.diving = true;
    state.diveT = 0;
    state.fromQ.copy(globe.quaternion);
    state.fromDist = state.dist;
    host.classList.add('is-diving');
    onDive();
  };

  // Arrastrar gira el planeta; la rueda o el pellizco acercan (y al acercarse se viaja al Chocó).
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  let downAt: { x: number; y: number } | null = null;
  const canvas = renderer.domElement;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const pickChoco = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(world)[0];
    if (!hit) return false;
    const local = globe.worldToLocal(hit.point.clone());
    const { lat, lon } = vecToLatLon(local);
    return isChoco(lat, lon);
  };
  const onDown = (e: PointerEvent) => {
    if (state.diving) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt = pointers.size === 1 ? { x: e.clientX, y: e.clientY } : null;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const rotateBy = (dx: number, dy: number) => {
    const k = 0.005 * (state.dist - R * 0.9);
    const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), dx * k);
    const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), dy * k);
    globe.quaternion.premultiply(qy).premultiply(qx);
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (!state.diving) {
        state.hover = pickChoco(e.clientX, e.clientY);
        canvas.style.cursor = state.hover ? 'pointer' : 'grab';
        chocoEl.classList.toggle('is-hover', state.hover);
      }
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch && d > pinch * 1.15) dive();
      return;
    }
    rotateBy(dx, dy);
    state.spin.set(dx * 0.02, dy * 0.02);
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && pickChoco(e.clientX, e.clientY)) dive();
    downAt = null;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) dive();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 52 : 36;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const timer = new Timer();
  let frame = 0;
  const tmpQ = new Quaternion();
  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (!state.active) return;
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();

    if (state.diving) {
      // 0–1,6 s: gira hasta Colombia; 1,2–3,6 s: baja hasta el Chocó.
      state.diveT += dt;
      const turn = MathUtils.smootherstep(state.diveT, 0, 1.8);
      tmpQ.copy(state.fromQ).slerp(facingChoco, turn);
      globe.quaternion.copy(tmpQ);
      const zoom = MathUtils.smootherstep(state.diveT, 1.0, 3.8);
      state.dist = MathUtils.lerp(state.fromDist, R * 1.075, zoom);
      if (state.diveT > 3.9 && !state.arrived) {
        state.arrived = true;
        onArrive();
      }
    } else {
      // Giro lento por inercia; con el tiempo vuelve a quedar América de frente.
      state.spin.multiplyScalar(Math.exp(-dt * 1.5));
      if (pointers.size === 0) rotateBy(state.spin.x + 0.12 * dt * 60 * 0.05, state.spin.y);
      state.dist += (state.goalDist - state.dist) * (1 - Math.exp(-dt * 1.2));
    }
    camera.position.set(0, 0, state.dist);
    camera.lookAt(0, 0, 0);

    // Al acercarse aparece el detalle de Colombia y los rótulos cercanos.
    const near = 1 - MathUtils.smoothstep(state.dist, R * 1.25, R * 1.9);
    patchMat.opacity = MathUtils.smoothstep(state.dist, R * 3.6, R * 2.0) * 0.4 + near * 0.6;
    patch.visible = patchMat.opacity > 0.01;
    for (const x of extra) x.el.style.opacity = String(x.el.classList.contains('globe-label--town') ? MathUtils.smoothstep(near, 0.6, 1) : near);
    chocoEl.style.setProperty('--pulse', String(1 + Math.sin(t * 3) * 0.08));

    // Los rótulos del lado de atrás del planeta no se ven.
    const camDir = camera.position.clone().normalize();
    const facing = chocoAnchor.clone().applyQuaternion(globe.quaternion).normalize().dot(camDir);
    chocoEl.style.visibility = facing > 0.15 ? 'visible' : 'hidden';
    for (const x of extra) if (x.at.clone().applyQuaternion(globe.quaternion).normalize().dot(camDir) < 0.2) x.el.style.opacity = '0';

    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  loop();

  return {
    reset: () => {
      state.diving = false;
      state.arrived = false;
      state.dist = R * 1.6;
      state.goalDist = 3.4;
      host.classList.remove('is-diving');
    },
    setActive: (active) => {
      state.active = active;
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        const mat = m.material as MeshBasicMaterial | undefined;
        mat?.map?.dispose();
        mat?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}
