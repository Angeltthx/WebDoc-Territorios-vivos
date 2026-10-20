// Genera src/content/map-locator.ts: el mapa de ubicación de las estaciones (pedido del cliente, 19/10/2026).
//   · El Chocó grande, con sus municipios en línea fina y Nuquí resaltado.
//   · En una esquina, Colombia con sus departamentos y el Chocó resaltado.
// Fuente: geoBoundaries (de OpenStreetMap, ODbL). Sale ya proyectado como trazos SVG (texto, no imágenes), para
// dibujarlo en línea blanca sobre fondo transparente; las estaciones se ubican encima con `LOCATOR.at(lat, lon)`.
//
// Uso: node scripts/map-locator.mjs [carpeta-caché]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE = path.resolve(process.argv[2] ?? '.cache/map-locator');
const BASE = 'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/COL';
const SOURCES = {
  'col_adm1.json': `${BASE}/ADM1/geoBoundaries-COL-ADM1_simplified.geojson`,
  'col_adm2.json': `${BASE}/ADM2/geoBoundaries-COL-ADM2_simplified.geojson`,
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

/** Douglas-Peucker sobre [lon, lat]. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > worst) [worst, at] = [d, i];
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const rings = (g) => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat());
/** El anillo exterior más grande de una figura (sin islotes). */
const mainRing = (g) => rings(g).reduce((a, r) => (r.length > a.length ? r : a), []);

function inside([x, y], ring) {
  let ok = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}
/** Centro de área (no el promedio de los puntos: la costa tiene muchos más y lo corría hacia el mar). */
function centroid(ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Proyección plana (equirectangular, corregida por la latitud media) dentro de una caja. */
function projector(bbox, width) {
  const [w, s, e, n] = bbox;
  const cos = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const k = width / ((e - w) * cos);
  return { k, cos, w, n, height: (n - s) * k, xy: ([lon, lat]) => [(lon - w) * cos * k, (n - lat) * k] };
}
const r1 = (v) => Math.round(v * 10) / 10;
/** Un anillo cerrado empieza y termina en el mismo punto (Douglas-Peucker lo dejaría en nada): se simplifica en dos
 * mitades, partiendo en el punto más lejano del primero. */
function simplifyRing(ring, tol) {
  const pts = ring.slice(0, -1);
  let far = 0;
  pts.forEach(([x, y], i) => {
    if (Math.hypot(x - pts[0][0], y - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
  });
  if (far === 0) return pts;
  return [...simplify(pts.slice(0, far + 1), tol).slice(0, -1), ...simplify([...pts.slice(far), pts[0]], tol).slice(0, -1)];
}
/** Trazo SVG de varios anillos. */
const d = (rs, xy, tol) =>
  rs.map((r) => simplifyRing(r, tol).map((p, i) => `${i ? 'L' : 'M'}${xy(p).map(r1).join(' ')}`).join('') + 'Z').join('');
const bboxOf = (rs) => {
  const all = rs.flat();
  return [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))];
};

const adm1 = await load('col_adm1.json');
const adm2 = await load('col_adm2.json');
const chocoF = adm1.features.find((f) => f.properties.shapeName === 'Chocó');
const chocoRing = mainRing(chocoF.geometry);
// Municipios del Chocó: los que tienen su centro dentro del departamento, o la mayoría de sus puntos (los de la costa,
// como Nuquí, tienen el centro casi en la orilla y el contorno del departamento es más grueso).
const share = (ring) => ring.filter((p) => inside(p, chocoRing)).length / ring.length;
const municipios = adm2.features.filter((f) => {
  const r = mainRing(f.geometry);
  return inside(centroid(r), chocoRing) || share(r) > 0.5;
});
const nuqui = municipios.find((f) => /nuqu/i.test(f.properties.shapeName));
if (!nuqui) throw new Error('No encontré Nuquí entre los municipios del Chocó');

// El Chocó, grande.
const W = 200;
const [cw, cs, ce, cn] = bboxOf(rings(chocoF.geometry));
const pad = 0.04;
const big = projector([cw - pad, cs - pad, ce + pad, cn + pad], W);
const choco = d(rings(chocoF.geometry), big.xy, 0.008);
const lines = d(municipios.flatMap((f) => rings(f.geometry)), big.xy, 0.012);
const nuquiD = d(rings(nuqui.geometry), big.xy, 0.006);
const nuquiLabel = big.xy(centroid(mainRing(nuqui.geometry))).map(r1);

// Colombia en la esquina: todos los departamentos, y el Chocó relleno.
const colRings = adm1.features.flatMap((f) => rings(f.geometry)).filter((r) => r.length > 20);
const [lw, ls, le, ln] = bboxOf(colRings);
const INSET = 64;
const small = projector([lw, ls, le, ln], INSET);
const colombia = d(colRings, small.xy, 0.15);
const insetChoco = d(rings(chocoF.geometry), small.xy, 0.1);

const ts = `// Generado por scripts/map-locator.mjs — no editar a mano.
// Mapa de ubicación de las estaciones, ya proyectado como trazos SVG. Fuente: geoBoundaries / OpenStreetMap (ODbL).
export const LOCATOR = {
  width: ${W},
  height: ${r1(big.height)},
  /** Contorno del Chocó, sus municipios y Nuquí. */
  choco: '${choco}',
  municipios: '${lines}',
  nuqui: '${nuquiD}',
  nuquiLabel: [${nuquiLabel.join(', ')}] as const,
  /** Colombia (con sus departamentos) y el Chocó en ella, en una caja de ${INSET} de ancho. */
  inset: { width: ${INSET}, height: ${r1(small.height)}, colombia: '${colombia}', choco: '${insetChoco}' },
  /** Proyección del Chocó grande: lat, lon → x, y. */
  at: (lat: number, lon: number): [number, number] => [(lon - ${big.w}) * ${big.cos} * ${big.k}, (${big.n} - lat) * ${big.k}],
};
`;
await writeFile(path.resolve('src', 'content', 'map-locator.ts'), ts);
console.log(municipios.map((f) => f.properties.shapeName).join(', '));
console.log(`Chocó ${W}×${r1(big.height)} · ${municipios.length} municipios · Nuquí: ${nuqui.properties.shapeName} · ${(ts.length / 1024).toFixed(0)} KB`);
