// /api/admin/historias — la revisión de las historias que manda la gente.
//   GET  ?estado=pendiente|aprobada|rechazada → la lista, con enlaces firmados para ver y oír los archivos.
//   POST { id, accion: 'aprobar' | 'rechazar' | 'borrar', lat?, lon?, titulo?, relato?, tipo?, nota? }
//        Aprobar pide coordenadas dentro del Chocó (sin ellas no sale en el mapa) y deja corregir título, relato y tipo.
//        Borrar la elimina del todo, con sus archivos (por ejemplo, si quien la contó pide retirarla).

import { del } from '@vercel/blob';
import { isAdmin, noSession } from '../_lib/admin.js';
import { type Historia, sql } from '../_lib/db.js';
import { clean, json, signed } from '../_lib/util.js';

type Conteo = { estado: string; n: number };

const ESTADOS = ['pendiente', 'aprobada', 'rechazada'];
const TIPOS = ['pueblo', 'selva', 'mar', 'rio', 'cultura', 'cocina'];
/** El Chocó, con margen. */
const CHOCO = { south: 3.5, north: 9.5, west: -79, east: -75.5 };

export async function GET(request: Request) {
  if (!isAdmin(request)) return noSession();
  const estado = new URL(request.url).searchParams.get('estado') ?? 'pendiente';
  if (!ESTADOS.includes(estado)) return json({ error: 'Estado no válido.' }, 400);
  const db = sql();
  const rows = (await db`
    select id, creada, estado, titulo, relato, cuando, tipo, municipio, lugar, lat, lon, autor, contacto, archivos, revisada, nota
    from historias where estado = ${estado} order by creada desc limit 200`) as Historia[];
  const conteo = (await db`select estado, count(*)::int as n from historias group by estado`) as Conteo[];
  const historias = await Promise.all(rows.map(async (h) => ({ ...h, archivos: await signed(h.archivos) })));
  return json({ historias, conteo: Object.fromEntries(conteo.map((r) => [r.estado, r.n])) });
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return noSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = clean(body.id, 40);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Historia no válida.' }, 400);
  const db = sql();
  const [h] = (await db`select id, archivos from historias where id = ${id}::uuid`) as Pick<Historia, 'id' | 'archivos'>[];
  if (!h) return json({ error: 'Esa historia ya no existe.' }, 404);
  const nota = clean(body.nota, 300);

  if (body.accion === 'aprobar') {
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < CHOCO.south || lat > CHOCO.north || lon < CHOCO.west || lon > CHOCO.east) {
      return json({ error: 'Para publicarla, ponle coordenadas dentro del Chocó.' }, 400);
    }
    const tipo = TIPOS.includes(String(body.tipo)) ? String(body.tipo) : null;
    const titulo = clean(body.titulo, 90) || null;
    const relato = clean(body.relato, 6000) || null;
    await db`
      update historias set estado = 'aprobada', revisada = now(), lat = ${lat}, lon = ${lon}, nota = ${nota},
        tipo = coalesce(${tipo}, tipo), titulo = coalesce(${titulo}, titulo), relato = coalesce(${relato}, relato)
      where id = ${id}::uuid`;
    return json({ ok: true });
  }
  if (body.accion === 'rechazar') {
    await db`update historias set estado = 'rechazada', revisada = now(), nota = ${nota} where id = ${id}::uuid`;
    return json({ ok: true });
  }
  if (body.accion === 'borrar') {
    if (h.archivos.length) await del(h.archivos.map((a) => a.pathname));
    await db`delete from historias where id = ${id}::uuid`;
    return json({ ok: true });
  }
  return json({ error: 'Acción no válida.' }, 400);
}
