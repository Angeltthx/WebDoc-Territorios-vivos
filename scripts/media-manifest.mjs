// Genera src/content/media-manifest.json con el ancho y alto de cada imagen de public/media.
// Solo guarda medidas (texto), nunca las imágenes: permite reservar el espacio correcto
// antes de que carguen y mostrar las fotos completas, sin recortes.
import sharp from 'sharp';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('public', 'media');
const files = (await readdir(DIR)).filter((f) => f.endsWith('.webp') && !f.endsWith('-sm.webp'));
const manifest = {};
for (const f of files.sort()) {
  const { width, height } = await sharp(path.join(DIR, f)).metadata();
  manifest[f.replace(/\.webp$/, '')] = [width, height];
}
const lines = Object.entries(manifest).map(([k, v]) => `  ${JSON.stringify(k)}: [${v.join(', ')}]`);
await writeFile(path.resolve('src', 'content', 'media-manifest.json'), `{\n${lines.join(',\n')}\n}\n`);
console.log(`${files.length} imágenes`);
