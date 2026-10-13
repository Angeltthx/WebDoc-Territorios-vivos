// /api/admin/pedidos — los pedidos de la tienda, para despacharlos.
//   GET  ?vista=despachar|camino|entregados|pendientes|todos&q=… → la lista (con los datos de envío y lo que lleva).
//   POST { referencia, estado?, transportadora?, guia?, nota? } → avanzar el pedido (pagado → empacando → enviado →
//        entregado; se puede devolver un paso si hubo un error) o guardar la nota. Las fechas de cada paso las anota
//        la base sola (disparador pedidos_fechas); el cliente lo ve en «Consultar mi pedido».

import { isAdmin, noSession } from '../_lib/admin.js';
import { sql } from '../_lib/db.js';
import { expireOld } from '../_lib/tienda.js';
import { clean, json } from '../_lib/util.js';

type Conteo = { estado: string; n: number };

const VISTAS: Record<string, string[]> = {
  despachar: ['pagado', 'empacando'],
  camino: ['enviado'],
  entregados: ['entregado'],
  pendientes: ['pendiente', 'rechazado', 'expirado'],
  todos: ['pendiente', 'pagado', 'rechazado', 'expirado', 'empacando', 'enviado', 'entregado'],
};
/** El camino de un pedido pagado. */
const PASOS = ['pagado', 'empacando', 'enviado', 'entregado'];

export async function GET(request: Request) {
  if (!isAdmin(request)) return noSession();
  await expireOld();
  const q = new URL(request.url).searchParams;
  const estados = VISTAS[q.get('vista') ?? 'despachar'] ?? VISTAS.despachar;
  const buscar = clean(q.get('q'), 60);
  const like = `%${buscar}%`;
  const db = sql();
  const pedidos = await db`
    select p.referencia, p.creado, p.estado, p.expira, p.nombre, p.correo, p.celular, p.direccion, p.ciudad, p.departamento, p.notas,
      p.subtotal, p.envio, p.total, p.metodo, p.wompi_id, p.pagado, p.empacado, p.enviado, p.entregado, p.transportadora, p.guia, p.nota,
      coalesce((select json_agg(json_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'precio', i.precio))
        from pedido_items i where i.pedido_id = p.id), '[]') as items
    from pedidos p
    where p.estado = any(${estados}::text[])
      and (${buscar}::text = '' or p.referencia ilike ${like} or p.nombre ilike ${like} or p.correo ilike ${like} or p.celular ilike ${like})
    order by p.creado desc limit 200`;
  const conteo = (await db`select estado, count(*)::int as n from pedidos group by estado`) as Conteo[];
  return json({ pedidos, conteo: Object.fromEntries(conteo.map((r) => [r.estado, r.n])) });
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return noSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ref = clean(body.referencia, 40);
  const db = sql();
  const [p] = (await db`select estado, transportadora, guia from pedidos where referencia = ${ref}`) as { estado: string; transportadora: string; guia: string }[];
  if (!p) return json({ error: 'Ese pedido no existe.' }, 404);

  const nota = typeof body.nota === 'string' ? clean(body.nota, 500) : null;
  const transportadora = typeof body.transportadora === 'string' ? clean(body.transportadora, 60) : null;
  const guia = typeof body.guia === 'string' ? clean(body.guia, 60) : null;
  const estado = typeof body.estado === 'string' ? body.estado : null;

  if (estado && estado !== p.estado) {
    // Solo los pedidos pagados avanzan; uno pendiente, rechazado o vencido no se puede despachar.
    if (!PASOS.includes(p.estado) || !PASOS.includes(estado)) return json({ error: 'Ese pedido no está pagado: no se puede despachar.' }, 400);
    // Un paso adelante, o uno atrás para corregir.
    if (Math.abs(PASOS.indexOf(estado) - PASOS.indexOf(p.estado)) !== 1) return json({ error: 'Los pasos van de uno en uno.' }, 400);
    if (estado === 'enviado' && !(guia || transportadora || p.guia || p.transportadora)) {
      return json({ error: 'Para marcarlo enviado, pon la transportadora y la guía.' }, 400);
    }
  }
  // Al devolver un paso, se borra la fecha del paso que se deshizo (el cliente no ve «entregado» en algo que va en camino).
  const undone = estado && PASOS.indexOf(estado) < PASOS.indexOf(p.estado) ? p.estado : null;
  await db`
    update pedidos set
      estado = coalesce(${estado}, estado),
      nota = coalesce(${nota}, nota),
      transportadora = coalesce(${transportadora}, transportadora),
      guia = coalesce(${guia}, guia),
      empacado = case when ${undone}::text = 'empacando' then null else empacado end,
      enviado = case when ${undone}::text = 'enviado' then null else enviado end,
      entregado = case when ${undone}::text = 'entregado' then null else entregado end
    where referencia = ${ref}`;
  return json({ ok: true });
}
