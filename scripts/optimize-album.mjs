// La portada del disco y la foto del estudio (Contenido/drive-2026-10-30, 30/10/2026) → public/media/album, en WebP
// a dos tamaños, para la página «Álbum musical». Como las demás imágenes, no se versionan en git.
// Uso: node scripts/optimize-album.mjs
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
