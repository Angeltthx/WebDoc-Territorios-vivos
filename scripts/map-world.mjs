// Genera src/content/map-world.ts: los contornos con los que se dibuja el planeta de la entrada del mapa.
//   · Tierra del mundo (Natural Earth 1:110m).
//   · Países alrededor de Colombia (Natural Earth 1:50m).
//   · Departamentos de Colombia (geoBoundaries, de OpenStreetMap, ODbL), para resaltar el Chocó.
// Se simplifican y se redondean a centésimas de grado. Son solo coordenadas (texto), no imágenes.
//
// Uso: node scripts/map-world.mjs [carpeta-caché]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE = path.resolve(process.argv[2] ?? '.cache/map-world');
const SOURCES = {
  'land110.json': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson',
  'countries50.json': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
  'col_adm1.json': 'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/COL/ADM1/geoBoundaries-COL-ADM1_simplified.geojson',
};

async function load(name) {
  const file = path.join(CACHE, name);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    console.log(`Descargando ${name}…`);
    const text = await (await fetch(SOURCES[name])).text();
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, text);
    return JSON.parse(text);
  }
}

/** Douglas–Peucker sobre un anillo [[lon, lat], …]. */
function simplify(points, tol) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      // Anillo cerrado (a y b en el mismo punto): distancia al punto.
      const d = len < 1e-9
        ? Math.hypot(points[i][0] - ax, points[i][1] - ay)
        : Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len;
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const rings = (geometry) => (geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat()).map((r) => r);
/** Anillo simplificado y aplanado: [lon, lat, lon, lat, …] en centésimas de grado. */
const pack = (ring, tol) => simplify(ring, tol).flatMap(([lo, la]) => [Math.round(lo * 100), Math.round(la * 100)]);
const keepRing = (r) => r.length >= 8;

const land = await load('land110.json');
const countries = await load('countries50.json');
const depts = await load('col_adm1.json');

const LAND = land.features.flatMap((f) => rings(f.geometry)).map((r) => pack(r, 0.12)).filter(keepRing);

const NEAR = ['Colombia', 'Panama', 'Venezuela', 'Ecuador', 'Peru', 'Brazil', 'Costa Rica', 'Nicaragua'];
const COUNTRIES = countries.features
  .filter((f) => NEAR.includes(f.properties.NAME))
  .map((f) => ({ name: f.properties.NAME === 'Colombia' ? 'Colombia' : f.properties.NAME, rings: rings(f.geometry).map((r) => pack(r, 0.025)).filter(keepRing) }));

const DEPARTMENTS = depts.features.map((f) => ({
  name: f.properties.shapeName,
  rings: rings(f.geometry).map((r) => pack(r, f.properties.shapeName === 'Chocó' ? 0.006 : 0.02)).filter(keepRing),
}));

const json = (v) => JSON.stringify(v);
const ts = `// Generado por scripts/map-world.mjs — no editar a mano.
// Contornos para el planeta de la entrada del mapa, en centésimas de grado: [lon, lat, lon, lat, …].
// Fuentes: Natural Earth (dominio público) y geoBoundaries / OpenStreetMap (ODbL).
export const LAND: number[][] = ${json(LAND)};
export const COUNTRIES: { name: string; rings: number[][] }[] = ${json(COUNTRIES)};
export const DEPARTMENTS: { name: string; rings: number[][] }[] = ${json(DEPARTMENTS)};
`;
await writeFile(path.resolve('src', 'content', 'map-world.ts'), ts);
const count = (rs) => rs.reduce((n, r) => n + r.length / 2, 0);
console.log(`Tierra ${count(LAND)} puntos · países ${COUNTRIES.reduce((n, c) => n + count(c.rings), 0)} · departamentos ${DEPARTMENTS.reduce((n, d) => n + count(d.rings), 0)}`);
console.log(`${(ts.length / 1024).toFixed(0)} KB`);
