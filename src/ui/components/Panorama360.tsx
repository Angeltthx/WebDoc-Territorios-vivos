// Experiencia 360: el video del manglar envuelto en una esfera que el visitante recorre con la mirada.
// Se carga bajo demanda (three.js + hls.js solo cuando se abre) para no pesar en el resto del sitio.
//
// Interacción: arrastrar (mouse o dedo) para mirar, rueda o pellizco para acercar, flechas del teclado,
// y en celular "mover el teléfono" (giroscopio). El video corre en bucle con su sonido ambiente.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Hls from 'hls.js/light';
import {
  Euler, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion, SRGBColorSpace, Scene,
  SphereGeometry, TextureLoader, Vector3, VideoTexture, WebGLRenderer, LinearFilter,
} from 'three';

export interface Panorama360Props {
  /** Lista maestra HLS (varias calidades). */
  src: string;
  /** Imagen equirrectangular que se muestra mientras carga el video. */
  poster: string;
  label: string;
  /** Elemento de video creado en el clic que abrió la experiencia (permite sonido en iPhone). */
  video: HTMLVideoElement;
  onClose: () => void;
}

const FOV = { min: 35, max: 100, start: 75 };
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const HAS_GYRO = IS_TOUCH && typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export default function Panorama360({ src, poster, label, video, onClose }: Panorama360Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState({ now: 0, total: 0 });
  const [hint, setHint] = useState(true);
  const [gyro, setGyro] = useState(false);
  const [error, setError] = useState(false);

  // Estado de la mirada (fuera de React: cambia en cada cuadro).
  const view = useRef({ lon: 0, lat: 0, fov: FOV.start, vLon: 0, vLat: 0 });
  const gyroRef = useRef<{ alpha: number; beta: number; gamma: number; yaw: number } | null>(null);
  const gyroOn = useRef(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // Escena, video y bucle de dibujo.
  useEffect(() => {
    const host = stage.current!;
    const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(FOV.start, 1, 1, 1100);
    const geometry = new SphereGeometry(500, 64, 32);
    geometry.scale(-1, 1, 1); // se mira la esfera desde dentro

    const posterTex = new TextureLoader().load(poster);
    posterTex.colorSpace = SRGBColorSpace;
    const material = new MeshBasicMaterial({ map: posterTex });
    scene.add(new Mesh(geometry, material));

    const videoTex = new VideoTexture(video);
    videoTex.colorSpace = SRGBColorSpace;
    videoTex.minFilter = LinearFilter;
    videoTex.generateMipmaps = false;

    // Fuente: Safari reproduce HLS de forma nativa (ya asignada en el clic); el resto usa hls.js.
    let hls: Hls | null = null;
    if (!video.src) {
      if (Hls.isSupported()) {
        hls = new Hls({ maxBufferLength: 20, capLevelToPlayerSize: false });
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          // En celular, máximo la calidad intermedia (2880): la 4K es para computador.
          if (IS_TOUCH && hls) {
            const cap = data.levels.reduce((best, l, i) => (l.height <= 1440 && (best < 0 || l.height > data.levels[best].height) ? i : best), -1);
            if (cap >= 0) hls.autoLevelCapping = cap;
          }
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError(true);
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        video.src = src;
      }
    }
    video.loop = true;
    video.play().catch(() => {
      // Si el navegador no permite sonido sin otro gesto, empieza en silencio.
      video.muted = true;
      setMuted(true);
      void video.play().catch(() => setPlaying(false));
    });

    // El estado de la interfaz se lee siempre del video real (los eventos sueltos no son fiables
    // con cambios de calidad): reproducción, carga, tiempo y cuándo pasar de la imagen al video.
    const sync = () => {
      setPlaying(!video.paused);
      setLoading(!video.paused && video.readyState < 3);
      setTime({ now: video.currentTime, total: video.duration });
      if (video.readyState >= 2 && material.map !== videoTex) {
        material.map = videoTex;
        material.needsUpdate = true;
      }
    };
    const onVolume = () => setMuted(video.muted);
    const onError = () => setError(true);
    const EVENTS = ['playing', 'pause', 'waiting', 'canplay', 'timeupdate', 'durationchange', 'seeked'] as const;
    EVENTS.forEach((type) => video.addEventListener(type, sync));
    video.addEventListener('volumechange', onVolume);
    video.addEventListener('error', onError);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // Orientación del teléfono → cuaternión de la cámara (mismo método que DeviceOrientationControls).
    const zee = new Vector3(0, 0, 1);
    const euler = new Euler();
    const q0 = new Quaternion();
    const q1 = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const yawQ = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const target = new Vector3();

    let frame = 0;
    const draw = () => {
      const v = view.current;
      const g = gyroRef.current;
      if (gyroOn.current && g) {
        const orient = MathUtils.degToRad((screen.orientation?.angle ?? 0) as number);
        euler.set(MathUtils.degToRad(g.beta), MathUtils.degToRad(g.alpha), -MathUtils.degToRad(g.gamma), 'YXZ');
        camera.quaternion.setFromEuler(euler);
        camera.quaternion.multiply(q1);
        camera.quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
        camera.quaternion.premultiply(yawQ.setFromAxisAngle(up, MathUtils.degToRad(g.yaw + v.lon)));
      } else {
        // Inercia suave al soltar.
        v.lon += v.vLon;
        v.lat += v.vLat;
        v.vLon *= 0.92;
        v.vLat *= 0.92;
        v.lat = Math.max(-85, Math.min(85, v.lat));
        const phi = MathUtils.degToRad(90 - v.lat);
        const theta = MathUtils.degToRad(v.lon);
        target.set(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
        camera.lookAt(target);
      }
      if (camera.fov !== v.fov) {
        camera.fov = v.fov;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      EVENTS.forEach((type) => video.removeEventListener(type, sync));
      video.removeEventListener('volumechange', onVolume);
      video.removeEventListener('error', onError);
      video.pause();
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
      geometry.dispose();
      material.dispose();
      posterTex.dispose();
      videoTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [src, poster, video]);

  // Giroscopio: lecturas del teléfono mientras esté activo.
  useEffect(() => {
    gyroOn.current = gyro;
    if (!gyro) {
      gyroRef.current = null;
      return;
    }
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.alpha == null) return;
      const prev = gyroRef.current;
      // Al activar, se conserva la dirección en la que se estaba mirando.
      const yaw = prev ? prev.yaw : 0;
      gyroRef.current = { alpha: e.alpha, beta: e.beta ?? 90, gamma: e.gamma ?? 0, yaw };
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [gyro]);

  const toggleGyro = async () => {
    if (!gyro) {
      const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof DOE.requestPermission === 'function') {
        const answer = await DOE.requestPermission().catch(() => 'denied');
        if (answer !== 'granted') return;
      }
      view.current.lon = 0;
    }
    setGyro(!gyro);
  };

  // Arrastrar y pellizcar.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const onPointerDown = (e: ReactPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    view.current.vLon = 0;
    view.current.vLat = 0;
    setHint(false);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const v = view.current;
    if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) v.fov = Math.max(FOV.min, Math.min(FOV.max, v.fov * (pinch.current / dist)));
      pinch.current = dist;
      return;
    }
    const k = 0.12 * (v.fov / FOV.start);
    const dx = (e.clientX - prev.x) * k;
    const dy = (e.clientY - prev.y) * k;
    v.lon -= dx;
    if (!gyroOn.current) v.lat += dy;
    v.vLon = -dx * 0.5;
    v.vLat = gyroOn.current ? 0 : dy * 0.5;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = 0;
  };

  // Rueda para acercar (listener no pasivo para evitar que la página se desplace).
  useEffect(() => {
    const host = stage.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      v.fov = Math.max(FOV.min, Math.min(FOV.max, v.fov + e.deltaY * 0.04));
      setHint(false);
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 6000);
    return () => window.clearTimeout(t);
  }, []);

  const togglePlay = useCallback(() => {
    if (video.paused) void video.play();
    else video.pause();
  }, [video]);

  const toggleMute = () => {
    video.muted = !video.muted;
    if (!video.muted && video.paused) void video.play();
  };

  const seek = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!time.total) return;
    const r = e.currentTarget.getBoundingClientRect();
    video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * time.total;
  };

  const fullscreen = () => {
    const el = dialog.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = view.current;
    const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (step) {
      e.preventDefault();
      v.lon += step[0];
      v.lat += step[1];
      setHint(false);
    } else if (e.key === ' ' && e.target === stage.current) {
      e.preventDefault();
      togglePlay();
    } else if (e.key === '+' || e.key === '=') {
      v.fov = Math.max(FOV.min, v.fov - 5);
    } else if (e.key === '-') {
      v.fov = Math.min(FOV.max, v.fov + 5);
    }
  };

  const progress = time.total ? (time.now / time.total) * 100 : 0;

  return (
    <dialog ref={dialog} className="pano" aria-label={`Experiencia 360: ${label}`} onClose={onClose} onKeyDown={onKeyDown}>
      <div
        ref={stage}
        className="pano__stage"
        tabIndex={0}
        role="application"
        aria-label="Vista 360. Arrastra o usa las flechas para mirar alrededor; más y menos para acercar."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={togglePlay}
      />

      <div className="pano__top">
        <span className="chip">{label}</span>
        <button type="button" className="icon-btn" onClick={() => dialog.current?.close()} aria-label="Salir de la experiencia 360">✕</button>
      </div>

      {loading && !error && (
        <div className="pano__loading" role="status">
          <span className="pano__spinner" aria-hidden="true" /> Entrando al manglar…
        </div>
      )}
      {error && <p className="notice pano__error" role="alert">No se pudo cargar el video 360. Revisa la conexión e inténtalo de nuevo.</p>}

      {hint && !loading && (
        <div className="pano__hint" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5v-2a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v1m0 0a1.5 1.5 0 0 1 3 0v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-4.7-2.3L4.4 16a1.6 1.6 0 0 1 2.5-2L8 15" />
          </svg>
          {IS_TOUCH ? 'Desliza o mueve el teléfono para mirar alrededor' : 'Arrastra para mirar alrededor'}
        </div>
      )}

      <div className="pano__controls">
        <button type="button" onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M4 2.5v11l9-5.5Z" /></svg>
          )}
        </button>
        <span className="pano__time">{fmt(time.now)}</span>
        <div
          className="pano__track"
          role="slider"
          aria-label="Posición del video"
          aria-valuemin={0}
          aria-valuemax={Math.round(time.total) || 0}
          aria-valuenow={Math.round(time.now)}
          aria-valuetext={`${fmt(time.now)} de ${fmt(time.total)}`}
          onPointerDown={seek}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="pano__time">{fmt(time.total)}</span>
        <button type="button" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8v4h3l4 3V5L6 8Z" />
            {muted ? <path d="m13 8 4 4m0-4-4 4" /> : <path d="M13 7.5c1.2 1.4 1.2 3.6 0 5M15.5 5.5c2.3 2.6 2.3 6.4 0 9" />}
          </svg>
        </button>
        {HAS_GYRO && (
          <button type="button" onClick={toggleGyro} aria-pressed={gyro} aria-label={gyro ? 'Dejar de mover con el teléfono' : 'Mirar moviendo el teléfono'} className={gyro ? 'is-on' : ''}>
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="6" y="2.5" width="8" height="15" rx="2" /><path d="M2.5 7.5a8 8 0 0 0 0 5M17.5 7.5a8 8 0 0 1 0 5" />
            </svg>
          </button>
        )}
        {document.fullscreenEnabled && (
          <button type="button" onClick={fullscreen} aria-label="Pantalla completa">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg>
          </button>
        )}
      </div>
    </dialog>
  );
}
