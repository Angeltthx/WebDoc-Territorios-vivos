// Fotos de la tienda: el cuadro del mapa, enmarcado (lo mandó la clienta el 15/11/2026, en lugar del póster suelto y sus
// recortes de detalle). Lee ../Contenido/Tienda/cuadro-mapa-nuqui.png y escribe public/media/tienda/cuadro-mapa*.webp.
// Con nombre nuevo, no poster-mapa: /media se guarda un año en el navegador y se seguiría viendo el póster viejo.
// Uso: npm run media:tienda
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = '../Contenido/Tienda/cuadro-mapa-nuqui.png';
const OUT = 'public/media/tienda';
mkdirSync(OUT, { recursive: true });

await sharp(SRC).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 88 }).toFile(`${OUT}/cuadro-mapa.webp`);
await sharp(SRC).resize({ width: 420 }).webp({ quality: 82 }).toFile(`${OUT}/cuadro-mapa-sm.webp`);
console.log('Listo: public/media/tienda');
