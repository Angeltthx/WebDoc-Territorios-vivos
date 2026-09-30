// Convierte los videos de transición (4K, ../Contenido/Transiciones) a versiones web en
// public/media/transiciones: t1…t4 en 1080p y 720p, con su sonido original, y una imagen de espera.
// Uso: npm run media:transiciones
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

// "Transición 1 Webdoc.mp4" → t1 (el nombre puede venir con tildes en NFD desde el zip).
const files = readdirSync(SRC).filter((f) => /\.mp4$/i.test(f));
for (const file of files) {
  const n = file.match(/(\d+)\s*Webdoc/i)?.[1];
  if (!n) continue;
  const src = path.join(SRC, file);
  for (const [height, crf] of [[1080, 26], [720, 28]]) {
    const out = path.join(OUT, `t${n}-${height}.mp4`);
    console.log(path.basename(out));
    run(['-i', src, '-vf', `scale=-2:${height},fps=30`, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf),
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', out]);
  }
  const frame = path.join(OUT, `t${n}.jpg`);
  run(['-ss', '0.5', '-i', src, '-frames:v', '1', '-vf', 'scale=1920:-2', '-q:v', '3', frame]);
  await sharp(frame).webp({ quality: 70 }).toFile(path.join(OUT, `t${n}-poster.webp`));
  rmSync(frame);
  console.log(`t${n}-poster.webp`);
}
