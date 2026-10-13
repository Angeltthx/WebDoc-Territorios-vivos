// /api/admin/productos — precio, existencias y si está a la venta (lo que cobra la tienda; las fotos y los textos van en
// el código, unidos por el SKU).
//   GET → la lista, con cuántos hay apartados en pedidos sin pagar.
//   POST { sku, precio?, existencias?, activo? }

import { isAdmin, noSession } from '../_lib/admin.js';
import { sql } from '../_lib/db.js';
import { expireOld } from '../_lib/tienda.js';
import { clean, json } from '../_lib/util.js';

export async function GET(request: Request) {
  if (!isAdmin(request)) return noSession();
  await expireOld();
  const productos = await sql()`
    select pr.sku, pr.nombre, pr.precio, pr.existencias, pr.activo, pr.actualizado,
      coalesce((select sum(i.cantidad) from pedido_items i join pedidos p on p.id = i.pedido_id
        where i.sku = pr.sku and p.estado = 'pendiente'), 0)::int as apartados,
      coalesce((select sum(i.cantidad) from pedido_items i join pedidos p on p.id = i.pedido_id
        where i.sku = pr.sku and p.estado in ('pagado', 'empacando', 'enviado', 'entregado')), 0)::int as vendidos
    from productos pr order by pr.sku`;
  return json({ productos });
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return noSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sku = clean(body.sku, 60);
  const precio = body.precio === undefined ? null : Math.round(Number(body.precio));
  const existencias = body.existencias === undefined ? null : Math.round(Number(body.existencias));
  const activo = typeof body.activo === 'boolean' ? body.activo : null;
  if (precio !== null && !(precio >= 1000 && precio <= 50_000_000)) return json({ error: 'El precio debe estar entre $ 1.000 y $ 50.000.000.' }, 400);
  if (existencias !== null && !(existencias >= 0 && existencias <= 100_000)) return json({ error: 'Las existencias deben ser un número de 0 en adelante.' }, 400);
  const [r] = (await sql()`
    update productos set precio = coalesce(${precio}, precio), existencias = coalesce(${existencias}, existencias),
      activo = coalesce(${activo}, activo), actualizado = now()
    where sku = ${sku} returning sku`) as { sku: string }[];
  if (!r) return json({ error: 'Ese producto no existe.' }, 404);
  return json({ ok: true });
}
