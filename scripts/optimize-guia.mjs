// Guía pedagógica: el PDF del cliente → una imagen por página para el visor de /guia (el PDF no se publica, para que
// no haya archivo que descargar). Los pliegos dobles se parten en dos páginas, para leerlas bien en el celular.
// Lee ../Contenido/Guia/guia-pedagogica.pdf y escribe public/media/guia/<huella>/NN.webp (y NN-sm.webp) más
// public/media/guia/paginas.json, que dice al visor en qué carpeta está y cuántas páginas son. La carpeta cambia con
// el PDF: /media se guarda un año en caché, y así una versión nueva nunca se confunde con la anterior.
// Necesita Python con PyMuPDF (pip install pymupdf) para dibujar el PDF.
// Uso: npm run media:guia
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = '../Contenido/Guia/guia-pedagogica.pdf';
const ROOT = 'public/media/guia';
const TMP = '.cache/guia';
/** Ancho de cada página: grande para poder ampliar el texto, y una versión liviana para celular. */
const WIDTH = 1600;
const WIDTH_SM = 800;

const hash = createHash('sha1').update(readFileSync(SRC)).digest('hex').slice(0, 8);
const OUT = `${ROOT}/${hash}`;
rmSync(ROOT, { recursive: true, force: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

// Cada página del PDF a PNG, a una resolución que deje ~WIDTH px por página sencilla.
execFileSync('python', ['-c', `
import sys, pymupdf
doc = pymupdf.open(sys.argv[1])
for i, page in enumerate(doc):
    single = page.rect.width / 2 if page.rect.width > page.rect.height else page.rect.width
    page.get_pixmap(matrix=pymupdf.Matrix(${WIDTH} / single, ${WIDTH} / single)).save(f"{sys.argv[2]}/{i:03d}.png")
`, SRC, TMP], { stdio: 'inherit' });

let n = 0;
let ratio = 0;
for (const file of readdirSync(TMP).sort()) {
  const img = sharp(`${TMP}/${file}`);
  const { width, height } = await img.metadata();
  const halves = width > height ? [0, Math.floor(width / 2)] : [0];
  const w = width > height ? Math.floor(width / 2) : width;
  for (const left of halves) {
    n += 1;
    ratio ||= w / height;
    const name = String(n).padStart(2, '0');
    const page = sharp(`${TMP}/${file}`).extract({ left, top: 0, width: w, height });
    await page.clone().resize({ width: WIDTH }).webp({ quality: 82 }).toFile(`${OUT}/${name}.webp`);
    await page.clone().resize({ width: WIDTH_SM }).webp({ quality: 78 }).toFile(`${OUT}/${name}-sm.webp`);
  }
}
rmSync(TMP, { recursive: true, force: true });

writeFileSync(`${ROOT}/paginas.json`, JSON.stringify({ carpeta: hash, paginas: n, proporcion: +ratio.toFixed(4) }) + '\n');
console.log(`Listo: ${n} páginas en ${OUT}`);
