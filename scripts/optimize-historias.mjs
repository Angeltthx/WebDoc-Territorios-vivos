// Convierte los videos de HISTORIA de cada estación a streaming HLS (public/media/historias/<id>).
// Uso: npm run media:historias [id…]  (sin ids convierte todos; tarda varios minutos por video)
// - 1080p (~5 Mbps), 720p (~2.8 Mbps) y 480p (~1.2 Mbps); el reproductor elige según la conexión.
// - Segmentos de 4 s con fotogramas clave alineados, para cambiar de calidad sin cortes.
// - Imagen de espera (poster.webp) para mostrar antes de reproducir.
// Los medios no se versionan en git: se generan localmente a partir de los originales.
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const CONTENIDO = path.resolve('..', 'Contenido');

/** id publicado → archivo original en ../Contenido (y segundo del que se toma la imagen de espera). */
const VIDEOS = {
  'estacion-1': { file: 'ESTACION1.mp4', poster: 8 },
  'estacion-2': { file: 'Tráiler Gente de río.mp4', poster: 8 },
  'estacion-3': { file: 'El baile de las olas.mp4', poster: 8 },
};

const RENDITIONS = [
  { name: '1080', h: 1080, maxrate: '5M', level: '4.1' },
  { name: '720', h: 720, maxrate: '2800k', level: '4.0' },
  { name: '480', h: 480, maxrate: '1200k', level: '3.1' },
];

// Los nombres pueden venir con tildes descompuestas (NFD).
const onDisk = readdirSync(CONTENIDO);
const find = (name) => onDisk.find((f) => f.normalize('NFC') === name.normalize('NFC'));

const only = process.argv.slice(2);
for (const [id, { file, poster }] of Object.entries(VIDEOS)) {
  if (only.length && !only.includes(id)) continue;
  const name = find(file);
  if (!name) { console.warn(`falta ${file}`); continue; }
  const src = path.join(CONTENIDO, name);
  const out = path.resolve('public', 'media', 'historias', id);
  rmSync(out, { recursive: true, force: true });
  RENDITIONS.forEach((r) => mkdirSync(path.join(out, r.name), { recursive: true }));
  console.log(`${id} ← ${file}`);

  const filter =
    `[0:v]split=${RENDITIONS.length}${RENDITIONS.map((_, i) => `[s${i}]`).join('')};` +
    RENDITIONS.map((r, i) => `[s${i}]scale=-2:${r.h},format=yuv420p[o${i}]`).join(';');

  const args = ['-hide_banner', '-loglevel', 'warning', '-stats', '-y', '-i', src, '-filter_complex', filter];
  RENDITIONS.forEach((r, i) => {
    args.push(
      '-map', `[o${i}]`,
      `-c:v:${i}`, 'libx264', `-preset:v:${i}`, 'medium', `-crf:v:${i}`, '22',
      `-maxrate:v:${i}`, r.maxrate, `-bufsize:v:${i}`, `${parseInt(r.maxrate) * 2}${r.maxrate.replace(/\d+/, '')}`,
      `-profile:v:${i}`, 'high', `-level:v:${i}`, r.level,
    );
  });
  RENDITIONS.forEach(() => args.push('-map', 'a:0'));
  args.push(
    '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
    '-r', '24', '-g', '96', '-keyint_min', '96', '-sc_threshold', '0',
    '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments',
    '-hls_segment_type', 'mpegts',
    // Rutas relativas con "/" (ffmpeg se ejecuta dentro de la carpeta de salida).
    '-hls_segment_filename', '%v/seg%03d.ts',
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', RENDITIONS.map((r, i) => `v:${i},a:${i},name:${r.name}`).join(' '),
    '%v/index.m3u8',
  );
  execFileSync(ffmpeg, args, { stdio: 'inherit', cwd: out });

  const frame = path.join(out, 'frame.jpg');
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(poster), '-i', src, '-frames:v', '1', '-vf', 'scale=1920:-2', '-q:v', '3', frame]);
  await sharp(frame).webp({ quality: 74 }).toFile(path.join(out, 'poster.webp'));
  rmSync(frame);
  console.log(`listo: ${id}`);
}
