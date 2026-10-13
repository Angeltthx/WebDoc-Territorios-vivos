// /api/admin/productos — los productos de la tienda.
//   GET → la lista, con cuántos se han vendido, cuántos hay apartados en pedidos sin pagar y sus fotos (enlaces firmados).
//   POST { sku, precio?, existencias?, activo? } → cambio rápido desde la tabla.
//   POST { accion: 'crear', nombre, categoria, resumen, descripcion, tamano, medidas, precio, existencias, activo,
//          caracteristicas: [[nombre, valor]…], fotos: [{ pathname, alt }…] } → un producto nuevo (sus fotos se suben
//          antes con /api/admin/subir).
//   POST { accion: 'editar', sku, …lo mismo } → cambiar todo lo de un producto.
// El póster original toma sus fotos y textos del código (src/content/stories.ts); los nuevos, de aquí.

import { randomBytes } from 'node:crypto';
import { isAdmin, noSession } from '../_lib/admin.js';
import { type Archivo, sql } from '../_lib/db.js';
import { expireOld } from '../_lib/tienda.js';
import { clean, json, signed } from '../_lib/util.js';

type Foto = { pathname: string; alt: string };

export async function GET(request: Request) {
  if (!isAdmin(request)) return noSession();
  await expireOld();
  const rows = (await sql()`
    select pr.sku, pr.nombre, pr.precio, pr.existencias, pr.activo, pr.actualizado, pr.categoria, pr.resumen, pr.descripcion,
      pr.tamano, pr.medidas, pr.caracteristicas, pr.fotos, pr.creado,
      coalesce((select sum(i.cantidad) from pedido_items i join pedidos p on p.id = i.pedido_id
        where i.sku = pr.sku and p.estado = 'pendiente'), 0)::int as apartados,
      coalesce((select sum(i.cantidad) from pedido_items i join pedidos p on p.id = i.pedido_id
        where i.sku = pr.sku and p.estado in ('pagado', 'empacando', 'enviado', 'entregado')), 0)::int as vendidos
    from productos pr order by pr.creado, pr.sku`) as { fotos: Foto[] }[];
  const productos = await Promise.all(rows.map(async (p) => ({ ...p, fotos: await signed(p.fotos as unknown as Archivo[]) })));
  return json({ productos });
}

/** Lo que manda el formulario, revisado (no se confía en el navegador). */
function fields(body: Record<string, unknown>) {
  const precio = Math.round(Number(body.precio));
  const existencias = Math.round(Number(body.existencias));
  const caracteristicas = (Array.isArray(body.caracteristicas) ? body.caracteristicas : []).slice(0, 12).flatMap((c): [string, string][] => {
    const k = clean(Array.isArray(c) ? c[0] : '', 60);
    const v = clean(Array.isArray(c) ? c[1] : '', 200);
    return k && v ? [[k, v]] : [];
  });
  const fotos = (Array.isArray(body.fotos) ? body.fotos : []).slice(0, 8).flatMap((f): Foto[] => {
    const pathname = clean(f?.pathname, 300);
    return pathname.startsWith('productos/') && !pathname.includes('..') ? [{ pathname, alt: clean(f?.alt, 140) }] : [];
  });
  const f = {
    nombre: clean(body.nombre, 90),
    categoria: clean(body.categoria, 40),
    resumen: clean(body.resumen, 220),
    descripcion: clean(body.descripcion, 4000),
    tamano: clean(body.tamano, 40),
    medidas: clean(body.medidas, 60),
    precio,
    existencias,
    activo: body.activo !== false,
    caracteristicas,
    fotos,
  };
  const error =
    f.nombre.length < 3 ? 'Ponle un nombre al producto.'
      : !f.categoria ? 'Elige o escribe la categoría (por ejemplo, Póster).'
        : !(precio >= 1000 && precio <= 50_000_000) ? 'El precio debe estar entre $ 1.000 y $ 50.000.000.'
          : !(existencias >= 0 && existencias <= 100_000) ? 'Las existencias deben ser un número de 0 en adelante.'
            : !fotos.length ? 'Sube al menos una foto.'
              : null;
  return { f, error };
}

/** Un código corto y legible para el producto: su nombre sin tildes ni espacios, y unas letras al azar. */
const skuFor = (nombre: string) =>
  `${nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${randomBytes(2).toString('hex')}`;

export async function POST(request: Request) {
  if (!isAdmin(request)) return noSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const db = sql();

  if (body.accion === 'crear' || body.accion === 'editar') {
    const { f, error } = fields(body);
    if (error) return json({ error }, 400);
    const caracteristicas = JSON.stringify(f.caracteristicas);
    const fotos = JSON.stringify(f.fotos);
    if (body.accion === 'crear') {
      const sku = skuFor(f.nombre);
      await db`
        insert into productos (sku, nombre, precio, existencias, activo, categoria, resumen, descripcion, tamano, medidas, caracteristicas, fotos)
        values (${sku}, ${f.nombre}, ${f.precio}, ${f.existencias}, ${f.activo}, ${f.categoria}, ${f.resumen}, ${f.descripcion},
          ${f.tamano}, ${f.medidas}, ${caracteristicas}::jsonb, ${fotos}::jsonb)`;
      return json({ ok: true, sku }, 201);
    }
    const sku = clean(body.sku, 60);
    const [r] = (await db`
      update productos set nombre = ${f.nombre}, precio = ${f.precio}, existencias = ${f.existencias}, activo = ${f.activo},
        categoria = ${f.categoria}, resumen = ${f.resumen}, descripcion = ${f.descripcion}, tamano = ${f.tamano}, medidas = ${f.medidas},
        caracteristicas = ${caracteristicas}::jsonb, fotos = ${fotos}::jsonb, actualizado = now()
      where sku = ${sku} returning sku`) as { sku: string }[];
    if (!r) return json({ error: 'Ese producto no existe.' }, 404);
    return json({ ok: true, sku });
  }

  // Cambio rápido desde la tabla.
  const sku = clean(body.sku, 60);
  const precio = body.precio === undefined ? null : Math.round(Number(body.precio));
  const existencias = body.existencias === undefined ? null : Math.round(Number(body.existencias));
  const activo = typeof body.activo === 'boolean' ? body.activo : null;
  if (precio !== null && !(precio >= 1000 && precio <= 50_000_000)) return json({ error: 'El precio debe estar entre $ 1.000 y $ 50.000.000.' }, 400);
  if (existencias !== null && !(existencias >= 0 && existencias <= 100_000)) return json({ error: 'Las existencias deben ser un número de 0 en adelante.' }, 400);
  const [r] = (await db`
    update productos set precio = coalesce(${precio}, precio), existencias = coalesce(${existencias}, existencias),
      activo = coalesce(${activo}, activo), actualizado = now()
    where sku = ${sku} returning sku`) as { sku: string }[];
  if (!r) return json({ error: 'Ese producto no existe.' }, 404);
  return json({ ok: true });
}
