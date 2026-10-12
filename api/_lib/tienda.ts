// La tienda en el servidor: el envío, la pasarela (Wompi) y los cambios de estado de un pedido.
//
// Un pedido nace «pendiente» y aparta sus existencias (para no vender lo que no hay). Vence en una hora: Wompi no
// deja pagarlo después (va en la firma), y si no se pagó, vuelve a sus existencias. Solo pasa a «pagado» cuando lo
// confirma Wompi (por el aviso del servidor de Wompi o consultando la transacción), nunca por lo que diga el navegador.
// Ver docs/tienda.md.

import { createHash } from 'node:crypto';
import { sql } from './db.js';

/** Envío a cualquier parte de Colombia (pesos). */
export const ENVIO = 15000;
/** Minutos que tiene la persona para pagar. */
export const PLAZO_MIN = 60;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Las llaves de Wompi (de prueba o reales: lo dice el prefijo de la pública). */
export function wompi() {
  const pub = process.env.WOMPI_PUBLIC_KEY ?? '';
  const integrity = process.env.WOMPI_INTEGRITY_SECRET ?? '';
  const events = process.env.WOMPI_EVENTS_SECRET ?? '';
  if (!pub || !integrity) throw new Error('Faltan las llaves de Wompi (WOMPI_PUBLIC_KEY y WOMPI_INTEGRITY_SECRET).');
  const test = pub.startsWith('pub_test_');
  return { pub, integrity, events, test, api: test ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1' };
}

/** Firma de integridad del checkout: así nadie puede cambiar el valor ni la referencia en el camino. */
export const integritySignature = (reference: string, amountInCents: number, expiration: string, secret: string) =>
  sha256(`${reference}${amountInCents}COP${expiration}${secret}`);

/** El enlace al checkout de Wompi para un pedido. */
export function checkoutUrl(p: { referencia: string; total: number; expira: Date; correo: string; nombre: string; celular: string;
  direccion: string; ciudad: string; departamento: string }, redirect: string) {
  const w = wompi();
  const cents = p.total * 100;
  const expiration = p.expira.toISOString();
  const q = new URLSearchParams({
    'public-key': w.pub,
    currency: 'COP',
    'amount-in-cents': String(cents),
    reference: p.referencia,
    'signature:integrity': integritySignature(p.referencia, cents, expiration, w.integrity),
    'expiration-time': expiration,
    'redirect-url': redirect,
    'customer-data:email': p.correo,
    'customer-data:full-name': p.nombre,
    'customer-data:phone-number': p.celular,
    'customer-data:phone-number-prefix': '+57',
    'shipping-address:address-line-1': p.direccion,
    'shipping-address:city': p.ciudad,
    'shipping-address:region': p.departamento,
    'shipping-address:country': 'CO',
    'shipping-address:phone-number': p.celular,
  });
  return `https://checkout.wompi.co/p/?${q}`;
}

/** Una transacción, como la cuenta Wompi (en su aviso o en su API). */
export interface WompiTx {
  id: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
}

/** Consulta una transacción en Wompi (es pública: basta su número). */
export async function fetchTx(id: string): Promise<WompiTx | null> {
  const res = await fetch(`${wompi().api}/transactions/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return ((await res.json()) as { data: WompiTx }).data;
}

/** El aviso de Wompi es auténtico: su firma se rehace con el secreto de eventos. */
export function validEvent(body: { signature?: { properties?: string[]; checksum?: string }; timestamp?: number; data?: unknown }) {
  const { events } = wompi();
  const props = body.signature?.properties;
  if (!events || !props?.length || !body.signature?.checksum || body.timestamp === undefined) return false;
  const value = (path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], body.data);
  const expected = sha256(props.map((p) => String(value(p) ?? '')).join('') + body.timestamp + events);
  return expected === body.signature.checksum.toLowerCase();
}

/** Devuelve a las existencias lo que apartaba un pedido. */
async function release(pedidoId: string) {
  await sql()`
    update productos p set existencias = p.existencias + i.cantidad, actualizado = now()
    from pedido_items i where i.pedido_id = ${pedidoId} and i.sku = p.sku`;
}

/**
 * Aplica a su pedido lo que dice Wompi de una transacción. Se puede llamar varias veces con la misma (el aviso y la
 * consulta pueden llegar los dos): solo cambia un pedido que sigue pendiente.
 */
export async function applyTx(tx: WompiTx) {
  const db = sql();
  const [p] = (await db`select id, estado, total from pedidos where referencia = ${tx.reference}`) as { id: string; estado: string; total: number }[];
  if (!p) return null;
  // El valor tiene que ser exactamente el del pedido (si no, algo raro pasó: no se da por pagado).
  const ok = tx.status === 'APPROVED' && tx.currency === 'COP' && tx.amount_in_cents === p.total * 100;
  if (ok) {
    const [paid] = (await db`
      update pedidos set estado = 'pagado', pagado = now(), wompi_id = ${tx.id}, wompi_estado = ${tx.status}, metodo = ${tx.payment_method_type ?? null}
      where id = ${p.id} and estado in ('pendiente', 'expirado', 'rechazado') returning estado`) as { estado: string }[];
    // Si ya había vencido o se había rechazado, sus existencias se habían devuelto: se vuelven a apartar (y se avisa).
    if (paid && p.estado !== 'pendiente') {
      await db`update productos pr set existencias = pr.existencias - i.cantidad, actualizado = now()
        from pedido_items i where i.pedido_id = ${p.id} and i.sku = pr.sku`;
      await db`update pedidos set nota = trim(nota || ' Pagado después de vencer: revisar existencias.') where id = ${p.id}`;
    }
  } else if (tx.status === 'DECLINED' || tx.status === 'VOIDED' || tx.status === 'ERROR' || tx.status === 'APPROVED') {
    const extra = tx.status === 'APPROVED' ? ' Aprobado por otro valor: revisar en Wompi.' : '';
    const [gone] = (await db`
      update pedidos set estado = 'rechazado', wompi_id = ${tx.id}, wompi_estado = ${tx.status}, metodo = ${tx.payment_method_type ?? null},
        nota = trim(nota || ${extra})
      where id = ${p.id} and estado = 'pendiente' returning id`) as { id: string }[];
    if (gone) await release(p.id);
  }
  return p.id;
}

/** Los pedidos pendientes que ya vencieron devuelven sus existencias. */
export async function expireOld() {
  const gone = (await sql()`
    update pedidos set estado = 'expirado' where estado = 'pendiente' and expira < now() returning id`) as { id: string }[];
  for (const g of gone) await release(g.id);
}
