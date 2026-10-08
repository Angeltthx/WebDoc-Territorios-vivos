// Entrada del mapa: el planeta Tierra dibujado con el arte del afiche (ver posterArt.ts). Solo el Chocó se puede
// tocar: al tocarlo o al acercarse, el planeta gira hasta dejar Nuquí de frente, baja y, sin corte, le pasa el
// viaje al mapa de la costa (ver dive.ts).

import {
  AdditiveBlending, BackSide, Group, MathUtils, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion,
  Raycaster, SRGBColorSpace, Scene, ShaderMaterial, SphereGeometry, Timer, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { ASCENT, DIVE, diveAltitude, fovs, type Handoff } from './dive';
import { ARRIVAL } from './terrain';
import { REGION, isChoco, posterTexture, regionCanvas, worldCanvas } from './posterArt';

const R = 1;
const DEG = Math.PI / 180;
/** Radio de la Tierra (km): la altura de la cámara se cuenta en kilómetros. */
const EARTH_KM = 6371;

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

// ───────── Escena ─────────

export interface GlobeHandle {
  /** Sigue la subida que empezó el mapa: desde la altura de la posta hasta la vista de reposo. */
  ascend: () => void;
  setActive: (active: boolean) => void;
  dispose: () => void;
}

export interface GlobeOptions {
  /** Empezó el viaje hacia el Chocó. */
  onDive: () => void;
  /** El planeta llegó a la altura de la posta: el mapa sigue el viaje desde aquí, con el mismo encuadre. */
  onHandoff: (handoff: Handoff) => void;
}

/**
 * Giro que deja el punto (lat, lon) de frente a la cámara, con el rumbo `bearing` (radianes desde el norte, hacia el
 * este) apuntando hacia arriba en la pantalla.
 */
function faceQ(lat: number, lon: number, bearing: number) {
  const out = latLonToVec(lat, lon).normalize();
  const north = latLonToVec(lat + 0.01, lon).normalize().sub(out).normalize();
  const east = latLonToVec(lat, lon + 0.01).normalize().sub(out).normalize();
  const up = north.multiplyScalar(Math.cos(bearing)).addScaledVector(east, Math.sin(bearing));
  const right = up.clone().cross(out).normalize();
  up.crossVectors(out, right).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, out)).invert();
}

export function createGlobe(host: HTMLElement, { onDive, onHandoff }: GlobeOptions): GlobeHandle {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'globe-labels';
  host.appendChild(labels.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.001, 100);
  const globe = new Group();
  scene.add(globe);

  const world = new Mesh(new SphereGeometry(R, 128, 96), new MeshBasicMaterial({ map: posterTexture(worldCanvas()) }));
  globe.add(world);
  const patchGeo = new SphereGeometry(
    R * 1.0008, 96, 96,
    (REGION.lonMin + 180) * DEG, (REGION.lonMax - REGION.lonMin) * DEG,
    (90 - REGION.latMax) * DEG, (REGION.latMax - REGION.latMin) * DEG,
  );
  const patchMat = new MeshBasicMaterial({ map: posterTexture(regionCanvas()), transparent: true, opacity: 0 });
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

  // Marcador del Chocó: el alfiler rosado del afiche, clavado justo en la costa de Nuquí (la punta del alfiler es el
  // punto de anclaje), con el rótulo encima. No cambia de tamaño: solo late un aro alrededor de la punta.
  const mkLabel = (cls: string, text: string) => {
    const el = document.createElement('div');
    el.className = `globe-label ${cls}`;
    el.textContent = text;
    return el;
  };
  const chocoAnchor = latLonToVec(ARRIVAL.lat, ARRIVAL.lon, R * 1.001);
  const chocoEl = document.createElement('button');
  chocoEl.type = 'button';
  chocoEl.className = 'globe-choco';
  chocoEl.setAttribute('aria-label', 'Entrar al Chocó');
  chocoEl.innerHTML = `<span class="globe-choco__tag">Chocó</span>
    <svg class="globe-choco__pin" viewBox="0 0 20 28" aria-hidden="true">
      <path d="M10 27C10 27 2 17.5 2 10a8 8 0 0 1 16 0c0 7.5-8 17-8 17Z" />
      <circle cx="10" cy="10" r="3.2" />
    </svg>
    <span class="globe-choco__ring" aria-hidden="true"></span>`;
  chocoEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  chocoEl.addEventListener('click', () => dive());
  const chocoLabel = new CSS2DObject(chocoEl);
  chocoLabel.center.set(0.5, 1);
  chocoLabel.position.copy(chocoAnchor);
  globe.add(chocoLabel);

  const extra = [
    { el: mkLabel('globe-label--country', 'Colombia'), at: latLonToVec(3.5, -73, R * 1.002) },
    { el: mkLabel('globe-label--sea', 'Océano Pacífico'), at: latLonToVec(2, -81.5, R * 1.002) },
    { el: mkLabel('globe-label--sea', 'Mar Caribe'), at: latLonToVec(12.3, -76.5, R * 1.002) },
  ];
  for (const x of extra) {
    const o = new CSS2DObject(x.el);
    o.position.copy(x.at);
    globe.add(o);
  }

  // ───────── Movimiento ─────────
  /** Vista de reposo: América de frente, con el norte arriba. El planeta no gira solo, así el alfiler se queda quieto. */
  const restQ = faceQ(6, -68, 0);
  /** Final del giro: la costa de Nuquí de frente y tierra adentro hacia arriba, como la primera vista del mapa. */
  const arrivalQ = faceQ(ARRIVAL.lat, ARRIVAL.lon, ARRIVAL.bearing);
  const REST_DIST = 3.4;
  const state = {
    dist: 3.4,
    spin: new Vector2(0, 0),
    diving: false,
    diveStart: 0,
    fromQ: new Quaternion(),
    fromKm: 0,
    handedOff: false,
    /** Volviendo a la vista de reposo tras arrastrarlo: segundos desde que empezó. */
    returning: -1,
    /** Subida desde el mapa en curso (momento en que empezó), o 0. */
    ascent: 0,
    active: true,
    hover: false,
  };
  globe.quaternion.copy(restQ);

  const dive = () => {
    if (state.diving || state.ascent) return;
    state.diving = true;
    state.handedOff = false;
    state.diveStart = performance.now();
    state.fromQ.copy(globe.quaternion);
    state.fromKm = (state.dist - R) * EARTH_KM;
    state.returning = -1;
    host.classList.add('is-diving');
    chocoEl.classList.remove('is-hover');
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
    state.returning = -1;
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
    state.spin.set(dx, dy);
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

  let aspect = 1;
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    aspect = w / Math.max(h, 1);
    camera.aspect = aspect;
    camera.fov = fovs(aspect).globe;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const timer = new Timer();
  let frame = 0;
  const camDir = new Vector3();
  const tmp = new Vector3();
  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (!state.active) return;
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);

    if (state.diving) {
      // Gira hasta Nuquí y baja por la curva compartida con el mapa (ver dive.ts).
      const t = (performance.now() - state.diveStart) / 1000;
      globe.quaternion.slerpQuaternions(state.fromQ, arrivalQ, MathUtils.smootherstep(t, 0, DIVE.turnEnd));
      const km = diveAltitude(t, state.fromKm, aspect);
      state.dist = R + km / EARTH_KM;
      if (!state.handedOff && km <= DIVE.handoffKm) {
        state.handedOff = true;
        onHandoff({ startedAt: state.diveStart, fromKm: state.fromKm });
      }
    } else if (state.ascent) {
      // Desde la posta hasta la vista de reposo: sube frenando y vuelve a poner el norte arriba.
      const t = (performance.now() - state.ascent) / 1000;
      const u = Math.min(t / ASCENT.globe, 1);
      const restKm = (REST_DIST - R) * EARTH_KM;
      state.dist = R + (DIVE.handoffKm * (restKm / DIVE.handoffKm) ** (1 - (1 - u) ** 2)) / EARTH_KM;
      globe.quaternion.slerpQuaternions(arrivalQ, restQ, MathUtils.smootherstep(t, 0.2, ASCENT.globe + 0.5));
      if (t > ASCENT.globe + 0.5) state.ascent = 0;
    } else {
      // Solo se mueve si lo arrastran (con algo de inercia); al volver del mapa regresa a la vista de reposo.
      if (pointers.size === 0 && state.spin.lengthSq() > 0.01) {
        state.spin.multiplyScalar(Math.exp(-dt * 4));
        rotateBy(state.spin.x * dt * 6, state.spin.y * dt * 6);
      }
      if (state.returning >= 0) {
        state.returning += dt;
        globe.quaternion.slerp(restQ, 1 - Math.exp(-dt * 2.2));
        if (state.returning > 4) state.returning = -1;
      }
      state.dist += (REST_DIST - state.dist) * (1 - Math.exp(-dt * 1.4));
    }
    camera.position.set(0, 0, state.dist);
    camera.lookAt(0, 0, 0);

    // Al acercarse aparece el detalle de Colombia y los rótulos cercanos.
    const near = 1 - MathUtils.smoothstep(state.dist, R * 1.25, R * 1.9);
    patchMat.opacity = MathUtils.smoothstep(state.dist, R * 3.6, R * 2.0) * 0.4 + near * 0.6;
    patch.visible = patchMat.opacity > 0.01;
    for (const x of extra) x.el.style.opacity = String(near);

    // Los rótulos del lado de atrás del planeta no se ven.
    camDir.copy(camera.position).normalize();
    const facing = tmp.copy(chocoAnchor).applyQuaternion(globe.quaternion).normalize().dot(camDir);
    chocoEl.style.visibility = facing > 0.15 ? 'visible' : 'hidden';
    for (const x of extra) if (tmp.copy(x.at).applyQuaternion(globe.quaternion).normalize().dot(camDir) < 0.2) x.el.style.opacity = '0';

    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  loop();

  return {
    ascend: () => {
      state.diving = false;
      state.handedOff = false;
      state.returning = -1;
      state.spin.set(0, 0);
      state.ascent = performance.now();
      state.dist = R + DIVE.handoffKm / EARTH_KM;
      globe.quaternion.copy(arrivalQ);
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
