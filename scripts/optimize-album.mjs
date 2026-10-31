// La portada del disco y la foto del estudio (Contenido/drive-2026-10-30, 30/10/2026) → public/media/album, en WebP
// a dos tamaños, para la página «Álbum musical», y las canciones en MP3 (abajo). Como las demás imágenes, no se versionan en git.
// Uso: node scripts/optimize-album.mjs
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = path.resolve('..', 'Contenido', 'drive-2026-10-30');
const OUT = path.resolve('public', 'media', 'album');
mkdirSync(OUT, { recursive: true });

const JOBS = [
  { file: 'Portada Disco.jpg', id: 'portada', sizes: [640, 1280] },
  { file: 'Foto grabación canciones.jpeg', id: 'estudio', sizes: [1280, 2400] },
];

for (const { file, id, sizes } of JOBS) {
  for (const w of sizes) {
    const out = path.join(OUT, `${id}-${w}.webp`);
    const info = await sharp(path.join(SRC, file)).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
    console.log(`album/${id}-${w}.webp ${info.width}×${info.height} ${(info.size / 1024).toFixed(0)} KB`);
  }
}

// Las canciones (30/10/2026: la clienta pidió solo el audio, sin los videos), de los WAV del máster que mandó por
// Drive (Contenido/album-audio-2026-10-30) → public/media/album/<id>.mp3, a volumen parejo.
const SONGS_SRC = path.resolve('..', 'Contenido', 'album-audio-2026-10-30');
const SONGS = {
  'marea-alta': 'CHACHITA MTR1 44.1 16Bits.wav',
  'baile-de-las-olas': 'ORFELINA MTR1 44.1 16Bits.wav',
  'regalo-de-la-selva': 'VICHE MTR1 44.1 16Bits.wav',
};
for (const [id, file] of Object.entries(SONGS)) {
  const out = path.join(OUT, `${id}.mp3`);
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(SONGS_SRC, file), '-vn',
    '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', out,
  ], { stdio: 'inherit' });
  console.log(`album/${id}.mp3`);
}
