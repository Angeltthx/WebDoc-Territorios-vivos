// Genera src/content/map-region.ts: el relieve del Chocó alrededor de Nuquí, con la costa hacia el norte y el sur,
// la serranía del Baudó, el valle del Atrato y la cordillera Occidental (SRTM 90 m, vía opentopodata.org).
// Es una grilla gruesa de 0,025° (≈ 2,8 km): se ve de fondo, detrás del relieve fino de map-relief.ts, para
// que la costa no parezca una isla. Son solo números (texto), no imágenes.
//
// Uso: node scripts/map-region.mjs [carpeta-caché]
// La API permite 100 puntos por consulta, una consulta por segundo y 1000 consultas al día (aquí son unas 250).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE = path.resolve(process.argv[2] ?? '.cache/map-region');
const API = 'https://api.opentopodata.org/v1/srtm90m?locations=';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NORTH = 8.2;
const SOUTH = 3.8;
const WEST = -78.4;
const EAST = -75.0;
const STEP = 0.025;
const METERS_PER_UNIT = 16;

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

const lats = range(NORTH, SOUTH, STEP);
const lons = range(WEST, EAST, STEP);
const file = path.join(CACHE, 'region.json');
let h;
try {
  ({ h } = JSON.parse(await readFile(file, 'utf8')));
} catch {
  console.log(`Descargando ${lats.length * lons.length} puntos…`);
  h = await fetchHeights(lats.flatMap((la) => lons.map((lo) => [la, lo])));
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify({ lats, lons, h }));
}

// Un byte por punto: 0 = mar; 1–255 = tierra, en pasos de 16 m (hasta 4080 m).
const bytes = new Uint8Array(h.map((m) => (m <= 0 ? 0 : Math.min(255, Math.max(1, Math.round(m / METERS_PER_UNIT))))));
const ts = `// Generado por scripts/map-region.mjs — no editar a mano.
// Relieve del Chocó alrededor de Nuquí (SRTM 90 m, opentopodata.org), grilla de ${STEP}° de norte a sur y de oeste a este.
// Cada byte es la altura en pasos de ${METERS_PER_UNIT} m (0 = mar).
export const REGION_RELIEF = {
  north: ${NORTH},
  west: ${WEST},
  step: ${STEP},
  rows: ${lats.length},
  cols: ${lons.length},
  metersPerUnit: ${METERS_PER_UNIT},
  data: '${Buffer.from(bytes).toString('base64')}',
};
`;
await writeFile(path.resolve('src', 'content', 'map-region.ts'), ts);
console.log(`${lats.length} × ${lons.length} puntos, altura máxima ${Math.round(Math.max(...h))} m`);
