// Genera src/content/map-relief.ts: el relieve real de la costa de Nuquí (alturas SRTM de 30 m, vía opentopodata.org)
// en una grilla de 0,002° (≈ 220 m), empaquetada en base64. De ahí salen la línea de costa, la llanura costera
// y las lomas de la serranía del Baudó del mapa 3D. Son solo números (texto), no imágenes.
//
// Uso: node scripts/map-relief.mjs [carpeta-caché]
// La carpeta guarda las descargas (grid.json gruesa y fine.json fina) para no repetirlas: la API permite
// 100 puntos por consulta, una consulta por segundo y 1000 consultas al día.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE = path.resolve(process.argv[2] ?? '.cache/map-relief');
const API = 'https://api.opentopodata.org/v1/srtm30m?locations=';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Zona: de Punta Jurubidá a la ensenada de Coquí y hacia el interior hasta la serranía.
const NORTH = 5.92;
const SOUTH = 5.55;
const WEST = -77.5;
const EAST = -77.04;
const STEP = 0.002;
// La franja costera se descarga fina; el interior (lomas) basta con una grilla gruesa.
const FINE_EAST = -77.2;
const COARSE = { north: 5.92, south: 5.54, west: -77.46, east: -77.06, step: 0.008 };

const range = (a, b, step) => Array.from({ length: Math.round(Math.abs(b - a) / step) + 1 }, (_, i) => +(a + Math.sign(b - a) * i * step).toFixed(4));

async function fetchHeights(points) {
  const out = [];
  for (let i = 0; i < points.length; i += 100) {
    const url = API + points.slice(i, i + 100).map(([la, lo]) => `${la.toFixed(4)},${lo.toFixed(4)}`).join('|');
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'territorios-vivos-map' } });
        const json = await res.json();
        out.push(...json.results.map((r) => r.elevation ?? 0));
        break;
      } catch (e) {
        if (attempt > 5) throw e;
        await sleep(4000);
      }
    }
    await sleep(1050);
    if (i % 5000 === 0) console.log(`  ${i}/${points.length}`);
  }
  return out;
}

async function cached(name, build) {
  const file = path.join(CACHE, name);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    const data = await build();
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, JSON.stringify(data));
    return data;
  }
}

const coarse = await cached('grid.json', async () => {
  const lats = range(COARSE.north, COARSE.south, COARSE.step);
  const lons = range(COARSE.west, COARSE.east, COARSE.step);
  console.log('Grilla gruesa…');
  return { lats, lons, h: await fetchHeights(lats.flatMap((la) => lons.map((lo) => [la, lo]))) };
});
const fine = await cached('fine.json', async () => {
  const lats = range(NORTH, SOUTH, STEP);
  const lons = range(WEST, FINE_EAST, STEP);
  console.log('Grilla fina de la costa…');
  return { lats, lons, h: await fetchHeights(lats.flatMap((la) => lons.map((lo) => [la, lo]))) };
});

/** Altura bilineal en una grilla {lats (de norte a sur), lons, h}. */
function sample(g, la, lo) {
  const fy = (g.lats[0] - la) / (g.lats[0] - g.lats[1]);
  const fx = (lo - g.lons[0]) / (g.lons[1] - g.lons[0]);
  const y0 = Math.max(0, Math.min(g.lats.length - 2, Math.floor(fy)));
  const x0 = Math.max(0, Math.min(g.lons.length - 2, Math.floor(fx)));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const tx = Math.max(0, Math.min(1, fx - x0));
  const at = (y, x) => g.h[y * g.lons.length + x];
  const a = at(y0, x0) + (at(y0, x0 + 1) - at(y0, x0)) * tx;
  const b = at(y0 + 1, x0) + (at(y0 + 1, x0 + 1) - at(y0 + 1, x0)) * tx;
  return a + (b - a) * ty;
}

const lats = range(NORTH, SOUTH, STEP);
const lons = range(WEST, EAST, STEP);
// Un byte por punto: 0 = mar; 1–255 = tierra, en pasos de 3 m (hasta 762 m).
const bytes = new Uint8Array(lats.length * lons.length);
let max = 0;
lats.forEach((la, i) => lons.forEach((lo, j) => {
  const h = lo <= FINE_EAST + 1e-9 ? fine.h[i * fine.lons.length + j] : Math.max(sample(coarse, la, lo), 1);
  max = Math.max(max, h);
  bytes[i * lons.length + j] = h <= 0 ? 0 : Math.min(255, Math.max(1, Math.round(h / 3)));
}));

const ts = `// Generado por scripts/map-relief.mjs — no editar a mano.
// Relieve real de la costa de Nuquí (SRTM 30 m, opentopodata.org), grilla de ${STEP}° de norte a sur y de oeste a este.
// Cada byte es la altura en pasos de 3 m (0 = mar).
export const RELIEF = {
  north: ${NORTH},
  west: ${WEST},
  step: ${STEP},
  rows: ${lats.length},
  cols: ${lons.length},
  metersPerUnit: 3,
  data: '${Buffer.from(bytes).toString('base64')}',
};
`;
await writeFile(path.resolve('src', 'content', 'map-relief.ts'), ts);
console.log(`${lats.length} × ${lons.length} puntos, altura máxima ${Math.round(max)} m`);
