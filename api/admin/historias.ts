// /api/admin/historias — para el equipo (con su clave: Authorization: Bearer ADMIN_TOKEN).
//   GET  ?estado=pendiente|aprobada|rechazada → la lista, con enlaces firmados para ver/oír los archivos.
//   POST { id, accion: 'aprobar' | 'rechazar' | 'borrar', lat?, lon?, titulo?, relato?, tipo?, nota? }

import { del } from '@vercel/blob';
import { type Historia, sql } from '../_lib/db';
import { clean, isAdmin, json, signed } from '../_lib/util';

const ESTADOS = ['pendiente', 'aprobada', 'rechazada'];
const TIPOS = ['pueblo', 'selva', 'mar', 'rio', 'cultura', 'cocina'];

export async function GET(request: Request) {
  if (!isAdmin(request)) return json({ error: 'Clave incorrecta.' }, 401);
  const estado = new URL(request.url).searchParams.get('estado') ?? 'pendiente';
  if (!ESTADOS.includes(estado)) return json({ error: 'Estado no válido.' }, 400);
  const rows = (await sql()`
    select id, creada, estado, titulo, relato, cuando, tipo, municipio, lugar, lat, lon, autor, contacto, archivos, revisada, nota
    from historias where estado = ${estado} order by creada desc limit 200`) as Historia[];
  const [{ pendientes }] = (await sql()`select count(*)::int as pendientes from historias where estado = 'pendiente'`) as { pendientes: number }[];
  const historias = await Promise.all(rows.map(async (h) => ({ ...h, archivos: await signed(h.archivos) })));
  return json({ historias, pendientes });
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return json({ error: 'Clave incorrecta.' }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = clean(body.id, 40);
  const db = sql();
  const [h] = (await db`select id, archivos from historias where id = ${id}::uuid`.catch(() => [])) as Pick<Historia, 'id' | 'archivos'>[];
  if (!h) return json({ error: 'No existe esa historia.' }, 404);

  if (body.accion === 'aprobar') {
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 3.5 || lat > 9.5 || lon < -79 || lon > -75.5) {
      return json({ error: 'Para aprobarla, ponle coordenadas dentro del Chocó.' }, 400);
    }
    const tipo = TIPOS.includes(String(body.tipo)) ? String(body.tipo) : null;
    const titulo = clean(body.titulo, 90) || null;
    const relato = clean(body.relato, 6000) || null;
    await db`
      update historias set estado = 'aprobada', revisada = now(), lat = ${lat}, lon = ${lon},
        tipo = coalesce(${tipo}, tipo), titulo = coalesce(${titulo}, titulo), relato = coalesce(${relato}, relato), nota = ${clean(body.nota, 300)}
      where id = ${id}::uuid`;
    return json({ ok: true });
  }
  if (body.accion === 'rechazar') {
    await db`update historias set estado = 'rechazada', revisada = now(), nota = ${clean(body.nota, 300)} where id = ${id}::uuid`;
    return json({ ok: true });
  }
  if (body.accion === 'borrar') {
    // Borrado definitivo (p. ej., si la persona lo pide): la historia y sus archivos.
    if (h.archivos.length) await del(h.archivos.map((a) => a.pathname));
    await db`delete from historias where id = ${id}::uuid`;
    return json({ ok: true });
  }
  return json({ error: 'Acción no válida.' }, 400);
}
