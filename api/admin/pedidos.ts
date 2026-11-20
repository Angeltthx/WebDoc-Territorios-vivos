// /api/admin/pedidos — los pedidos de la tienda, para despacharlos.
//   GET  ?vista=despachar|camino|entregados|pendientes|todos&q=… → la lista (con los datos de envío y lo que lleva).
//   GET  ?vista=eliminados → el historial de pedidos eliminados (solo lectura).
//   POST { referencia, estado?, transportadora?, guia?, nota? } → poner el pedido en cualquier paso (pagado, en empaque,
//        en camino, entregado: directo, adelante o atrás; 19/11/2026, antes iba de uno en uno) o guardar sus datos. Las
//        fechas de cada paso las anota la base sola (disparador pedidos_fechas) y las de los pasos que se saltan, aquí;
//        al ir atrás se borran las de los pasos deshechos. El cliente lo ve en «Consultar mi pedido».
//   POST { accion: 'eliminar', referencia, motivo, devolver } → lo borra, dejando antes una copia completa en el
//        historial (pedidos_eliminados, que la base no deja cambiar ni borrar). Si estaba apartando existencias (sin
//        pagar), vuelven solas; si estaba pagado, vuelven solo si `devolver`.

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
  if (q.get('vista') === 'eliminados') {
    const eliminados = await sql()`
      select eliminado, referencia, estado, motivo, devuelto, datos from pedidos_eliminados order by eliminado desc limit 300`;
    return json({ eliminados });
  }
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
  if (body.accion === 'eliminar') return eliminar(ref, clean(body.motivo, 300), body.devolver === true);
  const [p] = (await db`select estado, transportadora, guia from pedidos where referencia = ${ref}`) as { estado: string; transportadora: string; guia: string }[];
  if (!p) return json({ error: 'Ese pedido no existe.' }, 404);

  const nota = typeof body.nota === 'string' ? clean(body.nota, 500) : null;
  const transportadora = typeof body.transportadora === 'string' ? clean(body.transportadora, 60) : null;
  const guia = typeof body.guia === 'string' ? clean(body.guia, 60) : null;
  const estado = typeof body.estado === 'string' ? body.estado : null;

  // Solo los pedidos pagados se despachan; uno pendiente, rechazado o vencido no.
  if (estado && estado !== p.estado && (!PASOS.includes(p.estado) || !PASOS.includes(estado)))
    return json({ error: 'Ese pedido no está pagado: no se puede despachar.' }, 400);
  // Hasta qué paso llega: los de antes quedan con fecha (si se saltaron, la de ahora) y los de después, sin fecha (el
  // cliente no ve «entregado» en algo que va en camino).
  const hasta = estado ? PASOS.indexOf(estado) : -1;
  await db`
    update pedidos set
      estado = coalesce(${estado}, estado),
      nota = coalesce(${nota}, nota),
      transportadora = coalesce(${transportadora}, transportadora),
      guia = coalesce(${guia}, guia),
      empacado = case when ${hasta}::int < 0 then empacado when ${hasta}::int >= 1 then coalesce(empacado, now()) else null end,
      enviado = case when ${hasta}::int < 0 then enviado when ${hasta}::int >= 2 then coalesce(enviado, now()) else null end,
      entregado = case when ${hasta}::int < 0 then entregado when ${hasta}::int >= 3 then coalesce(entregado, now()) else null end
    where referencia = ${ref}`;
  return json({ ok: true });
}

/** Elimina un pedido dejando su copia en el historial (y devuelve sus existencias si corresponde). */
async function eliminar(ref: string, motivo: string, devolver: boolean) {
  const db = sql();
  if (motivo.length < 3) return json({ error: 'Escribe por qué se elimina (queda en el historial).' }, 400);
  const [p] = (await db`
    select p.*, coalesce((select json_agg(json_build_object('sku', i.sku, 'nombre', i.nombre, 'cantidad', i.cantidad, 'precio', i.precio))
      from pedido_items i where i.pedido_id = p.id), '[]') as items
    from pedidos p where p.referencia = ${ref}`) as { id: string; estado: string; items: { sku: string; cantidad: number }[] }[];
  if (!p) return json({ error: 'Ese pedido no existe.' }, 404);
  // Sin pagar, sus existencias están apartadas: vuelven siempre. Rechazado o vencido ya las devolvió. Pagado (o más
  // adelante): solo si el equipo lo pide (por ejemplo, un pedido de prueba o uno que no salió).
  const vuelven = p.estado === 'pendiente' || (PASOS.includes(p.estado) && devolver);
  const { id, ...datos } = p;
  void id;
  await db`insert into pedidos_eliminados (referencia, estado, motivo, devuelto, datos)
    values (${ref}, ${p.estado}, ${motivo}, ${vuelven}, ${JSON.stringify(datos)}::jsonb)`;
  if (vuelven) {
    await db`update productos pr set existencias = pr.existencias + i.cantidad, actualizado = now()
      from pedido_items i where i.pedido_id = ${p.id} and i.sku = pr.sku`;
  }
  await db`delete from pedidos where id = ${p.id}`;
  return json({ ok: true });
}
