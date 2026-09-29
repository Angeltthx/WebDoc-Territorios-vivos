// Convierte los originales de ../Contenido a versiones web (WebP) en public/media.
// Los originales nunca se publican: solo las salidas optimizadas.
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve('..', 'Contenido');
const OUT = path.resolve('public', 'media');
const PREVIEW = process.env.PREVIEW_DIR; // opcional: miniaturas JPG para revisión

export const slug = (name) =>
  name
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

await mkdir(OUT, { recursive: true });
if (PREVIEW) await mkdir(PREVIEW, { recursive: true });

// Duplicados exactos y material interno que no forma parte del webdoc.
const SKIP = new Set(['6i3a3563-1', '6i3a3815-3', 'dji-0504-1', 'flujo-trabajo-diapositiva-3']);

const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f) && !SKIP.has(slug(f)));
for (const file of files) {
  const src = path.join(SRC, file);
  const id = slug(file);
  const isPng = /\.png$/i.test(file);
  const base = sharp(src, { failOn: 'none' }).rotate();
  const meta = await base.metadata();
  const sizes = isPng ? [{ w: 1200, suffix: '' }] : [{ w: 2200, suffix: '' }, { w: 900, suffix: '-sm' }];
  for (const { w, suffix } of sizes) {
    const out = path.join(OUT, `${id}${suffix}.webp`);
    await base
      .clone()
      .resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: isPng ? 90 : 78, alphaQuality: 90 })
      .toFile(out);
  }
  if (PREVIEW) {
    await base.clone().resize({ width: 480 }).flatten({ background: '#888' }).jpeg({ quality: 70 }).toFile(path.join(PREVIEW, `${id}.jpg`));
  }
  const kb = Math.round((await stat(path.join(OUT, `${id}.webp`))).size / 1024);
  console.log(`${id}\t${meta.width}x${meta.height}\t${kb} KB`);
}
