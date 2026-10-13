// /api/admin/resumen — lo que el equipo ve al entrar: historias por revisar, pedidos por despachar, ventas y existencias.

import { isAdmin, noSession } from '../_lib/admin.js';
import { sql } from '../_lib/db.js';
import { expireOld } from '../_lib/tienda.js';
import { json } from '../_lib/util.js';

type Conteo = { estado: string; n: number };

export async function GET(request: Request) {
  if (!isAdmin(request)) return noSession();
  await expireOld();
  const db = sql();
  const historias = (await db`select estado, count(*)::int as n from historias group by estado`) as Conteo[];
  const pedidos = (await db`select estado, count(*)::int as n from pedidos group by estado`) as Conteo[];
  const [ventas] = (await db`
    select coalesce(sum(total), 0)::int as total, count(*)::int as pedidos,
      coalesce(sum(total) filter (where pagado > now() - interval '30 days'), 0)::int as mes
    from pedidos where estado in ('pagado', 'empacando', 'enviado', 'entregado')`) as { total: number; pedidos: number; mes: number }[];
  const productos = await db`select sku, nombre, precio, existencias, activo from productos order by sku`;
  const ultimos = await db`
    select referencia, creado, estado, nombre, ciudad, total from pedidos
    where estado in ('pagado', 'empacando', 'enviado', 'entregado') order by creado desc limit 8`;
  const porRevisar = await db`
    select id, creada, titulo, autor, municipio, lugar, jsonb_array_length(archivos)::int as archivos
    from historias where estado = 'pendiente' order by creada desc limit 8`;
  const count = (rows: Conteo[]) => Object.fromEntries(rows.map((r) => [r.estado, r.n]));
  return json({ historias: count(historias), pedidos: count(pedidos), ventas, productos, ultimos, porRevisar });
}
