// Fotos de la tienda: el póster completo y sus detalles (para la galería de la ficha del producto, como en una tienda
// en línea). Lee ../Contenido/Tienda/poster-mapa-nuqui.jpg y escribe public/media/tienda/*.webp.
// Uso: npm run media:tienda
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = '../Contenido/Tienda/poster-mapa-nuqui.jpg';
const OUT = 'public/media/tienda';
mkdirSync(OUT, { recursive: true });

/** Recortes del afiche (en píxeles del original, 1000 × 1432). */
const DETAILS = {
  'poster-ballena': { left: 120, top: 40, width: 350, height: 280 },
  'poster-titulo': { left: 60, top: 295, width: 470, height: 215 },
  'poster-chachita': { left: 410, top: 975, width: 290, height: 250 },
  'poster-rana': { left: 690, top: 1035, width: 290, height: 230 },
};

await sharp(SRC).resize({ width: 1000 }).webp({ quality: 84 }).toFile(`${OUT}/poster-mapa.webp`);
await sharp(SRC).resize({ width: 420 }).webp({ quality: 80 }).toFile(`${OUT}/poster-mapa-sm.webp`);
for (const [name, box] of Object.entries(DETAILS)) {
  await sharp(SRC).extract(box).resize({ width: 800, withoutEnlargement: false }).webp({ quality: 84 }).toFile(`${OUT}/${name}.webp`);
}
console.log('Listo: public/media/tienda');
