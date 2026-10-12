// /api/historias
//   GET  → las historias aprobadas, para el mapa (con enlaces firmados a sus archivos).
//   POST → una historia nueva, que queda pendiente hasta que el equipo la revise.

import { CHOCO_MUNICIPALITIES } from '../../src/content/stories.js';
import { type Archivo, type Historia, sql } from '../_lib/db.js';
import { clean, ipHash, json, signed } from '../_lib/util.js';

const TIPOS = ['pueblo', 'selva', 'mar', 'rio', 'cultura', 'cocina'];
const MIN_RELATO = 40;
/** Historias por persona (huella de IP) en una hora. */
const POR_HORA = 4;
/** El Chocó, con margen (la ubicación exacta la revisa el equipo). */
const CHOCO = { south: 3.8, north: 8.9, west: -78.1, east: -75.8 };

export async function GET() {
  const rows = (await sql()`
    select id, titulo, relato, cuando, tipo, municipio, lugar, lat, lon, autor, archivos, revisada
    from historias where estado = 'aprobada' and lat is not null and lon is not null
    order by revisada desc limit 500`) as Historia[];
  const historias = await Promise.all(rows.map(async (h) => ({ ...h, archivos: await signed(h.archivos) })));
  // En la CDN unos minutos: el mapa no consulta la base de datos en cada visita.
  return json({ historias }, 200, { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=900' });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'No se pudo leer el envío.' }, 400);
  }
  // Campo trampa: invisible para las personas; los robots lo llenan.
  if (clean(body.web, 200)) return json({ ok: true });

  const titulo = clean(body.titulo, 90);
  const relato = clean(body.relato, 6000);
  const municipio = clean(body.municipio, 60);
  const tipo = clean(body.tipo, 20);
  const autor = clean(body.autor, 60);
  if (titulo.length < 3 || relato.length < MIN_RELATO || autor.length < 2) return json({ error: 'Faltan el título, la historia o tu nombre.' }, 400);
  if (!CHOCO_MUNICIPALITIES.includes(municipio)) return json({ error: 'Elige un municipio del Chocó.' }, 400);
  if (!TIPOS.includes(tipo)) return json({ error: 'Tipo de historia no válido.' }, 400);
  if (body.consentimiento !== true) return json({ error: 'Falta tu autorización para publicarla.' }, 400);

  let lat = typeof body.lat === 'number' ? body.lat : null;
  let lon = typeof body.lon === 'number' ? body.lon : null;
  // Fuera del Chocó: se guarda sin coordenadas (el equipo la ubica por el municipio y el lugar).
  if (lat === null || lon === null || lat < CHOCO.south || lat > CHOCO.north || lon < CHOCO.west || lon > CHOCO.east) lat = lon = null;

  // Solo archivos que se subieron por nuestra ruta (carpeta de pendientes) y con datos razonables.
  const archivos: Archivo[] = (Array.isArray(body.archivos) ? body.archivos : []).slice(0, 8).flatMap((a): Archivo[] => {
    const pathname = clean(a?.pathname, 300);
    const tipo = a?.tipo;
    if (!pathname.startsWith('historias/') || pathname.includes('..') || !['foto', 'video', 'audio'].includes(tipo)) return [];
    return [{ pathname, tipo, nombre: clean(a?.nombre, 120), bytes: Math.max(0, Math.round(Number(a?.bytes) || 0)) }];
  });

  const huella = ipHash(request);
  const db = sql();
  const [{ n }] = (await db`select count(*)::int as n from historias where ip_hash = ${huella} and creada > now() - interval '1 hour'`) as { n: number }[];
  if (n >= POR_HORA) return json({ error: 'Ya recibimos varias historias tuyas. Intenta de nuevo en un rato.' }, 429);

  const [row] = (await db`
    insert into historias (titulo, relato, cuando, tipo, municipio, lugar, lat, lon, autor, contacto, archivos, ip_hash)
    values (${titulo}, ${relato}, ${clean(body.cuando, 60)}, ${tipo}, ${municipio}, ${clean(body.lugar, 90)}, ${lat}, ${lon},
      ${autor}, ${clean(body.contacto, 90)}, ${JSON.stringify(archivos)}::jsonb, ${huella})
    returning id`) as { id: string }[];
  return json({ ok: true, id: row.id }, 201);
}
