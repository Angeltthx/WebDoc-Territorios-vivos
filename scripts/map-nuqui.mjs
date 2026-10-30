// Genera src/content/map-nuqui.ts: el mapa de Nuquí del cliente (Contenido/drive-2026-10-30/Mapa-nuqui.png, 30/10/2026)
// como un trazo SVG, para dibujarlo en línea blanca sobre fondo transparente, como el mapa de ubicación.
// La imagen no trae coordenadas: es el municipio de Nuquí, así que se calza sobre el Nuquí de geoBoundaries que ya está
// en map-locator.ts (mismo contorno, con más detalle). Así las estaciones se ubican encima con LOCATOR.at(lat, lon).
//
// Uso: node scripts/map-nuqui.mjs [imagen]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = path.resolve(process.argv[2] ?? '../Contenido/drive-2026-10-30/Mapa-nuqui.png');

// La tierra es blanca y opaca; la sombra que trae alrededor es gris o semitransparente y no cuenta.
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const land = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
  land[i] = a > 200 && r > 235 && g > 235 && b > 235 ? 1 : 0;
}
const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? land[y * W + x] : 0);

/** Contorno exterior (vecindad de Moore), empezando en el primer píxel de tierra (arriba a la izquierda). */
function trace() {
  let start = -1;
  for (let i = 0; i < W * H && start < 0; i++) if (land[i]) start = i;
  if (start < 0) throw new Error('La imagen no tiene tierra blanca');
  // Las ocho vecinas, en el sentido de las agujas del reloj, empezando por la de la izquierda.
  const ring8 = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const sx = start % W;
  const sy = Math.floor(start / W);
  const pts = [[sx, sy]];
  let [x, y] = [sx, sy];
  let from = 0; // se llegó al primer píxel desde la izquierda (vacía)
  for (let guard = 0; guard < W * H * 4; guard++) {
    let found = false;
    for (let j = 1; j <= 8; j++) {
      const k = (from + j) % 8;
      const nx = x + ring8[k][0];
      const ny = y + ring8[k][1];
      if (at(nx, ny)) {
        // La próxima búsqueda arranca en la vecina vacía anterior, vista desde el píxel nuevo.
        const back = (from + j - 1) % 8;
        const bx = x + ring8[back][0] - nx;
        const by = y + ring8[back][1] - ny;
        from = ring8.findIndex(([dx, dy]) => dx === bx && dy === by);
        [x, y] = [nx, ny];
        found = true;
        break;
      }
    }
    if (!found || (x === sx && y === sy)) break;
    pts.push([x, y]);
  }
  return pts;
}

/** Douglas-Peucker. */
function simplify(pts, tol) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-9;
    let worst = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / len;
      if (d > worst) [worst, idx] = [d, i];
    }
    if (worst > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const ring = simplify(trace(), 1.2);

// Calce: la caja del contorno de la imagen sobre la caja del Nuquí de map-locator.ts.
const locator = await readFile(path.resolve('src', 'content', 'map-locator.ts'), 'utf8');
const geo = [...locator.match(/nuqui: '([^']+)'/)[1].matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
const box = (ps) => {
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const [px0, py0, px1, py1] = box(ring);
const [gx0, gy0, gx1, gy1] = box(geo);

// El trazo queda en unidades propias: 0…WIDTH a lo ancho, con la proporción de la imagen.
const WIDTH = 200;
const k = WIDTH / (px1 - px0);
const r1 = (v) => Math.round(v * 10) / 10;
const outline = ring.map(([x, y]) => [(x - px0) * k, (y - py0) * k]);
const d = `M${outline.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}Z`;
const height = r1((py1 - py0) * k);

/** Puntos cada `step` a lo largo de un contorno cerrado. */
const dense = (ps, step) => ps.flatMap(([ax, ay], i) => {
  const [bx, by] = ps[(i + 1) % ps.length];
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
  return Array.from({ length: n }, (_, j) => [ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
});

// Calce de geo (unidades de LOCATOR) a este mapa: u = a·x + b, v = c·y + e. Empieza por las cajas y se afina
// acercando cada punto del borde geográfico al borde más cercano del mapa del cliente (ICP), para que la costa caiga
// sobre la costa: las cajas solas corrían los pueblos de la costa hacia adentro.
let [a, b, c, e] = [WIDTH / (gx1 - gx0), 0, height / (gy1 - gy0), 0];
b = -gx0 * a;
e = -gy0 * c;
const gp = dense(geo, 0.15);
const tp = dense(outline, 0.6);
for (let it = 0; it < 40; it++) {
  const pairs = gp.map(([x, y]) => {
    const u = a * x + b;
    const v = c * y + e;
    let best = tp[0];
    let bd = Infinity;
    for (const q of tp) {
      const dd = (q[0] - u) ** 2 + (q[1] - v) ** 2;
      if (dd < bd) [bd, best] = [dd, q];
    }
    return [x, y, best[0], best[1]];
  });
  // Regresión lineal por eje.
  const fit = (xs, ys) => {
    const n = xs.length;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) ** 2;
    }
    const slope = sxy / sxx;
    return [slope, my - slope * mx];
  };
  [a, b] = fit(pairs.map((p) => p[0]), pairs.map((p) => p[2]));
  [c, e] = fit(pairs.map((p) => p[1]), pairs.map((p) => p[3]));
}
const r4 = (v) => Math.round(v * 10000) / 10000;

const ts = `// Generado por scripts/map-nuqui.mjs — no editar a mano.
// El mapa de Nuquí del cliente (30/10/2026) como trazo SVG, calzado sobre el Nuquí de map-locator.ts.
import { LOCATOR } from './map-locator';

export const NUQUI = {
  width: ${WIDTH},
  height: ${height},
  outline: '${d}',
  /** Lo mismo que LOCATOR.at, en las unidades de este mapa: lat, lon → x, y. */
  at: (lat: number, lon: number): [number, number] => {
    const [x, y] = LOCATOR.at(lat, lon);
    return [${r4(a)} * x + ${r4(b)}, ${r4(c)} * y + ${r4(e)}];
  },
};
`;
await writeFile(path.resolve('src', 'content', 'map-nuqui.ts'), ts);
console.log(`Calce: x·${r4(a)}${b>=0?'+':''}${r4(b)}, y·${r4(c)}${e>=0?'+':''}${r4(e)} · Nuquí ${WIDTH}×${height} · ${ring.length} puntos · imagen ${W}×${H} · proporción imagen ${r1((px1 - px0) / (py1 - py0) * 100) / 100} / geo ${r1((gx1 - gx0) / (gy1 - gy0) * 100) / 100}`);
