// Infografías «Cómo llegar» de cada estación (pedido del cliente, 09/11/2026). Lee ../Contenido/Infografias/estacion-N.png
// (1080 × 4169, del Drive del cliente) y escribe public/media/infografias/estacion-N.webp.
// Uso: npm run media:infografias
import { mkdirSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = '../Contenido/Infografias';
const OUT = 'public/media/infografias';
mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(SRC).filter((f) => /^estacion-\d\.png$/.test(f))) {
  const name = file.replace('.png', '');
  // Con letra pequeña: calidad alta para que se lea al acercarla.
  await sharp(`${SRC}/${file}`).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 86 }).toFile(`${OUT}/${name}.webp`);
  console.log(`${OUT}/${name}.webp`);
}
