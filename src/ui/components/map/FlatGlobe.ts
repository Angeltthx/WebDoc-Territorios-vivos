// El planeta de la entrada en 2D, para los teléfonos más modestos (la versión 5). Es el mismo dibujo del afiche y la
// misma luz de la tarde que el planeta 3D (GlobeScene.ts), pero pintado con el lienzo 2D del navegador: así en la
// página hay una sola escena 3D (la costa) y la tarjeta gráfica no tiene que sostener dos.
//
// Cumple el mismo contrato que el planeta 3D (GlobeHandle): se arrastra para girarlo, se toca el Chocó o se acerca
// para bajar, y baja por la misma curva compartida (dive.ts) hasta la altura en que la costa toma la posta.

import { MathUtils } from 'three';
import { ASCENT, DIVE, diveAltitude } from './dive';
import type { GlobeHandle, GlobeOptions } from './GlobeScene';
import { step } from './diag';
import { REGION, isChoco, regionCanvas, worldCanvas } from './posterArt';
import { ARRIVAL } from './terrain';

const DEG = Math.PI / 180;
const EARTH_KM = 6371;
/** Distancia de reposo de la cámara (en radios del planeta), la misma del planeta 3D. */
const REST_DIST = 3.4;
/** Vista de reposo: las Américas, con el Chocó cerca del centro. */
const REST = { lat: 6, lon: -68 };
/** Lado mayor del lienzo (píxeles): se pinta chico y el navegador lo agranda; así es liviano de calcular. */
const RES = 520;
/** Radio del planeta en reposo, como fracción del lado menor de la pantalla. */
const RADIUS = 0.43;

/** Píxeles de un lienzo, para leerlos rápido. */
function pixels(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, w: canvas.width, h: canvas.height };
}

/** Punto donde el sol de la tarde está justo encima: a 85,5° de Nuquí hacia el oeste (allá se pone a 4,5°). */
const SUN = (() => {
  const d = (90 - 4.5) * DEG;
  const th = 264 * DEG;
  const p1 = ARRIVAL.lat * DEG;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th));
  const l2 = ARRIVAL.lon * DEG + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { x: Math.cos(p2) * Math.cos(l2), y: Math.cos(p2) * Math.sin(l2), z: Math.sin(p2) };
})();

const smooth = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Cuánto se agranda el planeta a la altura `km` respecto a la vista de reposo (radio aparente). */
const zoomAt = (km: number) => {
  const d = 1 + km / EARTH_KM;
  return Math.sqrt(REST_DIST ** 2 - 1) / Math.sqrt(d * d - 1);
};

/** Estrellas de fondo (una imagen que se repite y se corre un poco al girar el planeta). */
function starTile() {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 512;
  const ctx = tile.getContext('2d')!;
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = `rgba(255, ${235 + rand() * 20}, ${215 + rand() * 40}, ${0.3 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(rand() * 512, rand() * 512, 0.4 + rand() ** 6 * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return tile.toDataURL();
}

export function createFlatGlobe(host: HTMLElement, { onDive, onHandoff, onReady }: GlobeOptions): GlobeHandle {
  step('planeta plano: armando');
  const world = pixels(worldCanvas());
  const region = pixels(regionCanvas());

  const sky = document.createElement('div');
  sky.className = 'flat-globe__sky';
  sky.style.backgroundImage = `url(${starTile()})`;
  const canvas = document.createElement('canvas');
  canvas.className = 'flat-globe';
  const ctx = canvas.getContext('2d')!;
  let image = ctx.createImageData(1, 1);
  host.append(sky, canvas);

  const chocoEl = document.createElement('button');
  chocoEl.type = 'button';
  chocoEl.className = 'globe-choco flat-globe__choco';
  chocoEl.setAttribute('aria-label', 'Entrar al Chocó');
  chocoEl.innerHTML = `<span class="globe-choco__tag">Chocó</span>
    <svg class="globe-choco__pin" viewBox="0 0 20 28" aria-hidden="true">
      <path d="M10 27C10 27 2 17.5 2 10a8 8 0 0 1 16 0c0 7.5-8 17-8 17Z" />
      <circle cx="10" cy="10" r="3.2" />
    </svg>
    <span class="globe-choco__ring" aria-hidden="true"></span>`;
  host.appendChild(chocoEl);

  const view = { lat: REST.lat, lon: REST.lon, zoom: 1, spin: 0 };
  let dirty = true;
  let active = true;
  let dive: { start: number; from: { lat: number; lon: number }; fromKm: number; handed: boolean } | null = null;
  let ascent: number | null = null;
  /** Tamaño del lienzo (píxeles reales) y escala a la pantalla. */
  let W = 1;
  let H = 1;
  let toCss = 1;

  /** Pantalla (relativa al lienzo, en píxeles del lienzo) → coordenadas de la vista (radio del planeta = 1). */
  const radiusPx = () => Math.min(W, H) * RADIUS * view.zoom;

  /** Pinta el planeta: proyección ortográfica, centrada en (lat, lon), girada `spin` y agrandada `zoom`. */
  const draw = () => {
    const out = image.data;
    const p0 = view.lat * DEG;
    const sp0 = Math.sin(p0);
    const cp0 = Math.cos(p0);
    const cs = Math.cos(view.spin);
    const sn = Math.sin(view.spin);
    const r = radiusPx();
    const cx = W / 2;
    const cy = H / 2;
    const regionW = REGION.lonMax - REGION.lonMin;
    const regionH = REGION.latMax - REGION.latMin;
    const detail = view.zoom > 2.2;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const o = (py * W + px) * 4;
        const sx = (px + 0.5 - cx) / r;
        const sy = (cy - py - 0.5) / r;
        const rho2 = sx * sx + sy * sy;
        if (rho2 >= 1) {
          // Fuera del planeta: el brillo turquesa de la atmósfera, pegado al borde.
          const rho = Math.sqrt(rho2);
          const glow = rho < 1.14 ? (1 - (rho - 1) / 0.14) ** 2 * 0.55 : 0;
          out[o] = 115;
          out[o + 1] = 215;
          out[o + 2] = 230;
          out[o + 3] = 255 * glow;
          continue;
        }
        // Giro de la vista (para empalmar con la orientación de la costa al bajar).
        const x = sx * cs - sy * sn;
        const y = sx * sn + sy * cs;
        const z = Math.sqrt(1 - rho2);
        const lat = Math.asin(Math.min(1, z * sp0 + y * cp0));
        const lon = view.lon * DEG + Math.atan2(x, z * cp0 - y * sp0);
        const latD = lat / DEG;
        const lonD = ((((lon / DEG + 180) % 360) + 360) % 360) - 180;
        // De cerca, el dibujo detallado de la región; si no, el del planeta.
        let src: Uint8ClampedArray;
        let i: number;
        if (detail && lonD > REGION.lonMin && lonD < REGION.lonMax && latD > REGION.latMin && latD < REGION.latMax) {
          const u = Math.floor(((lonD - REGION.lonMin) / regionW) * region.w);
          const v = Math.floor(((REGION.latMax - latD) / regionH) * region.h);
          src = region.data;
          i = (v * region.w + u) * 4;
        } else {
          const u = Math.floor(((lonD + 180) / 360) * world.w) % world.w;
          const v = Math.min(world.h - 1, Math.floor(((90 - latD) / 180) * world.h));
          src = world.data;
          i = (v * world.w + u) * 4;
        }
        // Luz de la tarde (la misma del planeta 3D): día, franja del atardecer en naranja, noche en penumbra.
        const cl = Math.cos(lat);
        const d = cl * Math.cos(lon) * SUN.x + cl * Math.sin(lon) * SUN.y + Math.sin(lat) * SUN.z;
        const day = smooth(d, -0.28, 0.02);
        const lit = 0.9 + 0.22 * smooth(d, 0, 0.8);
        const dusk = Math.exp(-(((d - 0.02) / 0.16) ** 2)) * 0.7;
        let red = src[i] * (day * lit + (1 - day) * 0.42);
        let green = src[i + 1] * (day * lit + (1 - day) * 0.46);
        let blue = src[i + 2] * (day * lit + (1 - day) * 0.6);
        red += (red * 0.35 + 8) * dusk;
        green -= green * 0.18 * dusk;
        blue -= blue * 0.45 * dusk;
        out[o] = red;
        out[o + 1] = green;
        out[o + 2] = blue;
        out[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(rho2)) * r * 0.9); // borde suave
      }
    }
    ctx.putImageData(image, 0, 0);
    placeMarker();
    sky.style.backgroundPosition = `${(-view.lon * 6) % 512}px ${(view.lat * 6) % 512}px`;
  };

  /** Lugar del alfiler del Chocó sobre el dibujo (o escondido si queda detrás). */
  const placeMarker = () => {
    const p = ARRIVAL.lat * DEG;
    const dl = (ARRIVAL.lon - view.lon) * DEG;
    const p0 = view.lat * DEG;
    const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl);
    const x = Math.cos(p) * Math.sin(dl);
    const y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl);
    // El giro de la vista, al revés (de la esfera a la pantalla).
    const sx = x * Math.cos(view.spin) + y * Math.sin(view.spin);
    const sy = -x * Math.sin(view.spin) + y * Math.cos(view.spin);
    const r = radiusPx();
    chocoEl.style.left = `${(W / 2 + sx * r) * toCss}px`;
    chocoEl.style.top = `${(H / 2 - sy * r) * toCss}px`;
    chocoEl.style.visibility = cosc > 0.15 && !dive ? 'visible' : 'hidden';
  };

  /** Punto de la esfera bajo un punto de la pantalla (o null si cae fuera). */
  const pick = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const r = radiusPx();
    const sx = ((clientX - rect.left) / toCss - W / 2) / r;
    const sy = (H / 2 - (clientY - rect.top) / toCss) / r;
    if (sx * sx + sy * sy >= 1) return null;
    const z = Math.sqrt(1 - sx * sx - sy * sy);
    const p0 = view.lat * DEG;
    return {
      lat: Math.asin(z * Math.sin(p0) + sy * Math.cos(p0)) / DEG,
      lon: view.lon + Math.atan2(sx, z * Math.cos(p0) - sy * Math.sin(p0)) / DEG,
    };
  };

  const startDive = () => {
    if (dive) return;
    dive = { start: performance.now(), from: { lat: view.lat, lon: view.lon }, fromKm: (REST_DIST - 1) * EARTH_KM, handed: false };
    host.classList.add('is-diving');
    onDive();
  };
  chocoEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  chocoEl.addEventListener('click', startDive);

  // Arrastrar gira el planeta; tocar el Chocó (o acercarse con la rueda o los dedos) baja.
  const pointers = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinch = 0;
  const onDown = (e: PointerEvent) => {
    if (dive) return;
    host.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev || dive) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (pinch && Math.hypot(a.x - b.x, a.y - b.y) > pinch * 1.25) startDive();
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    moved += Math.abs(dx) + Math.abs(dy);
    // Como si se agarrara la superficie: un píxel arrastrado ≈ lo que mide un píxel sobre el planeta.
    const radius = radiusPx() * toCss;
    view.lon -= ((dx / radius) * 0.8) / DEG;
    view.lat = MathUtils.clamp(view.lat + ((dy / radius) * 0.8) / DEG, -70, 70);
    dirty = true;
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    // Un toque (sin arrastrar) sobre el Chocó también baja.
    if (moved < 6 && !dive) {
      const at = pick(e.clientX, e.clientY);
      if (at && isChoco(at.lat, at.lon)) startDive();
    }
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) startDive();
  };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  host.addEventListener('wheel', onWheel, { passive: false });

  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (!active) return;
    const now = performance.now();
    if (dive) {
      // Gira hasta Nuquí, endereza la vista con la orientación de la costa y baja por la curva compartida.
      const t = (now - dive.start) / 1000;
      const turn = MathUtils.smootherstep(t, 0, DIVE.turnEnd);
      view.lat = MathUtils.lerp(dive.from.lat, ARRIVAL.lat, turn);
      view.lon = MathUtils.lerp(dive.from.lon, ARRIVAL.lon, turn);
      view.spin = ARRIVAL.bearing * turn;
      const km = diveAltitude(t, dive.fromKm, host.clientWidth / Math.max(host.clientHeight, 1));
      view.zoom = zoomAt(km);
      if (!dive.handed && km <= DIVE.handoffKm) {
        dive.handed = true;
        onHandoff({ startedAt: dive.start, fromKm: dive.fromKm });
      }
      dirty = true;
    } else if (ascent !== null) {
      // Vuelta desde la costa: de la altura de la posta a la vista de reposo, frenando.
      const u = MathUtils.clamp((now - ascent) / 1000 / ASCENT.globe, 0, 1);
      const e = 1 - (1 - u) ** 3;
      view.zoom = MathUtils.lerp(zoomAt(DIVE.handoffKm), 1, e);
      view.lat = MathUtils.lerp(ARRIVAL.lat, REST.lat, e);
      view.lon = MathUtils.lerp(ARRIVAL.lon, REST.lon, e);
      view.spin = ARRIVAL.bearing * (1 - e);
      if (u >= 1) ascent = null;
      dirty = true;
    }
    if (dirty) {
      dirty = false;
      draw();
    }
  };

  const resize = () => {
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    toCss = Math.max(w, h) / RES;
    W = Math.max(1, Math.round(w / toCss));
    H = Math.max(1, Math.round(h / toCss));
    canvas.width = W;
    canvas.height = H;
    image = ctx.createImageData(W, H);
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  draw();
  loop();
  step('planeta plano: listo');
  requestAnimationFrame(() => onReady?.());

  return {
    ascend: () => {
      dive = null;
      host.classList.remove('is-diving');
      ascent = performance.now();
    },
    setActive: (on) => {
      active = on;
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      host.removeEventListener('wheel', onWheel);
      sky.remove();
      canvas.remove();
      chocoEl.remove();
    },
  };
}
