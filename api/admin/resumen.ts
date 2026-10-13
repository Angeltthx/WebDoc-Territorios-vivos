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
  // Visitas (contador propio, en días de Colombia): personas distintas por día, sumadas; páginas vistas; las más vistas.
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const [visitas] = (await db`
    select
      count(*) filter (where dia = ${hoy}::date)::int as hoy,
      count(*) filter (where dia > ${hoy}::date - 7)::int as semana,
      count(*)::int as mes,
      coalesce(round(100.0 * count(*) filter (where movil) / nullif(count(*), 0)), 0)::int as movil
    from visitas_personas where dia > ${hoy}::date - 30`) as { hoy: number; semana: number; mes: number; movil: number }[];
  const [{ vistas }] = (await db`select coalesce(sum(vistas), 0)::int as vistas from visitas_pagina where dia > ${hoy}::date - 30`) as { vistas: number }[];
  const porDia = await db`
    select to_char(d, 'YYYY-MM-DD') as dia, coalesce(count(p.huella), 0)::int as visitas
    from generate_series(${hoy}::date - 13, ${hoy}::date, interval '1 day') d
    left join visitas_personas p on p.dia = d::date
    group by d order by d`;
  const paginas = await db`
    select ruta, sum(vistas)::int as vistas from visitas_pagina where dia > ${hoy}::date - 30
    group by ruta order by vistas desc limit 10`;
  const count = (rows: Conteo[]) => Object.fromEntries(rows.map((r) => [r.estado, r.n]));
  return json({ historias: count(historias), pedidos: count(pedidos), ventas, productos, ultimos, porRevisar, visitas: { ...visitas, vistas, porDia, paginas } });
}
