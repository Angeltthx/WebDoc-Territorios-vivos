// Convierte el video 360 del manglar a streaming HLS en tres calidades (public/media/360/manglar).
// Uso: npm run media:360  (lee ../Contenido/Manglar Video 360.mp4; tarda varios minutos)
// - 3840×1920 (~8 Mbps, pantallas grandes), 2880×1440 (~5 Mbps, computador), 1920×960 (~2.5 Mbps, celular).
// - Segmentos de 4 s con fotogramas clave alineados, para cambiar de calidad sin cortes.
// - Imagen de espera (poster.webp) para mostrar mientras carga.
// Los medios no se versionan en git: se generan localmente a partir de los originales.
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('..', 'Contenido', 'Manglar Video 360.mp4');
const OUT = path.resolve('public', 'media', '360', 'manglar');
rmSync(OUT, { recursive: true, force: true });

const RENDITIONS = [
  { name: '4k', w: 3840, h: 1920, maxrate: '8M', level: '5.1' },
  { name: '2880', w: 2880, h: 1440, maxrate: '5M', level: '5.0' },
  { name: '1920', w: 1920, h: 960, maxrate: '2500k', level: '4.1' },
];
RENDITIONS.forEach((r) => mkdirSync(path.join(OUT, r.name), { recursive: true }));

// El original es de rango completo (yuvj420p); se convierte a rango de TV, compatible con todos los navegadores.
const filter =
  `[0:v]split=${RENDITIONS.length}${RENDITIONS.map((_, i) => `[s${i}]`).join('')};` +
  RENDITIONS.map((r, i) => `[s${i}]scale=${r.w}:${r.h}:in_range=full:out_range=tv,format=yuv420p[o${i}]`).join(';');

const args = ['-hide_banner', '-loglevel', 'warning', '-stats', '-y', '-i', SRC, '-filter_complex', filter];
RENDITIONS.forEach((r, i) => {
  args.push(
    '-map', `[o${i}]`,
    `-c:v:${i}`, 'libx264', `-preset:v:${i}`, 'medium', `-crf:v:${i}`, '23',
    `-maxrate:v:${i}`, r.maxrate, `-bufsize:v:${i}`, `${parseInt(r.maxrate) * 2}${r.maxrate.replace(/\d+/, '')}`,
    `-profile:v:${i}`, 'high', `-level:v:${i}`, r.level,
  );
});
RENDITIONS.forEach(() => args.push('-map', 'a:0'));
args.push(
  '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
  '-r', '30', '-g', '120', '-keyint_min', '120', '-sc_threshold', '0',
  '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments',
  '-hls_segment_type', 'mpegts',
  // Rutas relativas con "/" (ffmpeg se ejecuta dentro de OUT): con path.join, en Windows la lista
  // maestra quedaría con barras invertidas, que no funcionan en la web.
  '-hls_segment_filename', '%v/seg%03d.ts',
  '-master_pl_name', 'master.m3u8',
  '-var_stream_map', RENDITIONS.map((r, i) => `v:${i},a:${i},name:${r.name}`).join(' '),
  '%v/index.m3u8',
);
execFileSync(ffmpeg, args, { stdio: 'inherit', cwd: OUT });

const frame = path.join(OUT, 'frame.jpg');
execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '2', '-i', SRC, '-frames:v', '1', '-vf', 'scale=2048:1024', '-q:v', '3', frame]);
await sharp(frame).webp({ quality: 72 }).toFile(path.join(OUT, 'poster.webp'));
rmSync(frame);
console.log('listo:', OUT);
