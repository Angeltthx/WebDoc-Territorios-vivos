// Convierte los videos de transición (4K, ../Contenido/Transiciones) a versiones web en
// public/media/transiciones: t1…t4, intro y cierre en 1080p y 720p, con su sonido original (desde el
// 05/10/2026 la voz de Chachita viene integrada en cada video) y una imagen de espera.
// Además, el sonido de cada video aparte (<id>-audio.m4a): en el recorrido el video corre en silencio y su sonido suena
// por el audio del webdoc, que se desbloquea con un solo toque (en el iPhone cada video pedía su propio toque).
// Uso: npm run media:transiciones [id…]  (sin ids convierte todos)
//      npm run media:transiciones -- --audio [id…]  (solo saca el sonido de los videos ya convertidos)
// Los medios no se versionan en git: se generan localmente a partir de los originales.
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('..', 'Contenido', 'Transiciones');
const OUT = path.resolve('public', 'media', 'transiciones');
mkdirSync(OUT, { recursive: true });

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

// "Transición 1 Webdoc.mp4" → t1, "Intro Webdoc.mp4" → intro, "Cierre.mp4" → cierre
// (el nombre puede venir con tildes en NFD desde el zip).
const idOf = (file) => {
  const n = file.match(/(\d+)\s*Webdoc/i)?.[1];
  if (n) return `t${n}`;
  if (/^intro/i.test(file)) return 'intro';
  if (/^cierre/i.test(file)) return 'cierre';
  return null;
};
/** El sonido del video ya convertido, tal cual (sin volver a comprimirlo). */
const extractAudio = (id) => {
  const out = path.join(OUT, `${id}-audio.m4a`);
  run(['-i', path.join(OUT, `${id}-720.mp4`), '-vn', '-c:a', 'copy', '-movflags', '+faststart', out]);
  console.log(path.basename(out));
};

const args = process.argv.slice(2);
const audioOnly = args.includes('--audio');
const only = args.filter((a) => a !== '--audio');
if (audioOnly) {
  const ids = readdirSync(OUT).map((f) => f.match(/^(.+)-720\.mp4$/)?.[1]).filter(Boolean);
  for (const id of ids) if (!only.length || only.includes(id)) extractAudio(id);
  process.exit(0);
}
const files = readdirSync(SRC).filter((f) => /\.mp4$/i.test(f));
for (const file of files) {
  const id = idOf(file);
  if (!id || (only.length && !only.includes(id))) continue;
  const src = path.join(SRC, file);
  for (const [height, crf] of [[1080, 26], [720, 28]]) {
    const out = path.join(OUT, `${id}-${height}.mp4`);
    console.log(path.basename(out));
    run(['-i', src, '-vf', `scale=-2:${height},fps=30`, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf),
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', out]);
  }
  const frame = path.join(OUT, `${id}.jpg`);
  run(['-ss', '0.5', '-i', src, '-frames:v', '1', '-vf', 'scale=1920:-2', '-q:v', '3', frame]);
  await sharp(frame).webp({ quality: 70 }).toFile(path.join(OUT, `${id}-poster.webp`));
  rmSync(frame);
  console.log(`${id}-poster.webp`);
  extractAudio(id);
}
