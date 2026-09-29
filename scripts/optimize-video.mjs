// Convierte el video original de la portada a versiones web en public/media/video.
// Uso: npm run media:video  (lee ../Contenido/panguí_v1 (2160p).mp4)
// Los medios no se versionan en git: se generan localmente a partir de los originales.
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('..', 'Contenido', 'panguí_v1 (2160p).mp4');
const OUT = path.resolve('public', 'media', 'video');
mkdirSync(OUT, { recursive: true });

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

for (const [height, crf] of [[1080, 27], [720, 28]]) {
  console.log(`portada-${height}.mp4`);
  run(['-i', SRC, '-an', '-vf', `scale=-2:${height},fps=30`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, `portada-${height}.mp4`)]);
}

const frame = path.join(OUT, 'frame.jpg');
run(['-ss', '2', '-i', SRC, '-frames:v', '1', '-vf', 'scale=1920:-2', '-q:v', '3', frame]);
await sharp(frame).webp({ quality: 70 }).toFile(path.join(OUT, 'portada-poster.webp'));
rmSync(frame);
console.log('portada-poster.webp');
