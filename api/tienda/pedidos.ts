// /api/tienda/pedidos
//   POST → crea el pedido («pendiente»), aparta sus existencias y devuelve el enlace al checkout de Wompi.
//   GET  ?ref=…&id=… → cómo va un pedido (la página a la que vuelve la persona después de pagar). Con el número de la
//        transacción que agrega Wompi (`id`), la consulta en Wompi y actualiza el pedido si el aviso aún no llegó.

import { randomBytes } from 'node:crypto';
import { sql } from '../_lib/db.js';
import { ENVIO, PLAZO_MIN, applyTx, checkoutUrl, expireOld, fetchTx, wompi } from '../_lib/tienda.js';
import { clean, ipHash, json } from '../_lib/util.js';

/**
 * A dónde vuelve la persona después de pagar: el mismo sitio desde donde pidió (o TIENDA_URL, si está). Wompi rechaza
 * el pago si la dirección de vuelta es localhost o 127.0.0.1: en local se usa lvh.me, un nombre público que siempre
 * apunta a este mismo computador (por eso, para probar pagos en local, la tienda se abre en http://lvh.me:3000/tienda).
 */
function returnBase(request: Request) {
  if (process.env.TIENDA_URL) return process.env.TIENDA_URL.replace(/\/$/, '');
  const u = new URL(request.url);
  if (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) u.hostname = 'lvh.me';
  return u.origin;
}

/** Pedidos por persona (huella de IP) en una hora. */
const POR_HORA = 8;
const MAX_POR_PRODUCTO = 10;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'No se pudo leer el pedido.' }, 400);
  }
  if (clean(body.web, 200)) return json({ error: 'No se pudo crear el pedido.' }, 400); // campo trampa
  try {
    wompi();
  } catch {
    return json({ error: 'La tienda todavía no está lista para recibir pagos.' }, 503);
  }

  const c = (body.comprador ?? {}) as Record<string, unknown>;
  const comprador = {
    nombre: clean(c.nombre, 80),
    correo: clean(c.correo, 120).toLowerCase(),
    celular: clean(c.celular, 20).replace(/[^\d]/g, ''),
    direccion: clean(c.direccion, 160),
    ciudad: clean(c.ciudad, 60),
    departamento: clean(c.departamento, 60),
    notas: clean(c.notas, 300),
  };
  if (comprador.nombre.length < 3) return json({ error: 'Escribe tu nombre completo.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(comprador.correo)) return json({ error: 'Revisa tu correo.' }, 400);
  if (!/^3\d{9}$/.test(comprador.celular)) return json({ error: 'Escribe un celular de Colombia (10 números, empieza por 3).' }, 400);
  if (comprador.direccion.length < 5 || comprador.ciudad.length < 2 || comprador.departamento.length < 3)
    return json({ error: 'Falta la dirección de envío.' }, 400);
  if (body.consentimiento !== true) return json({ error: 'Falta tu autorización para usar tus datos en el envío.' }, 400);

  // Lo que pide: un producto por línea, sin repetir, con cantidades razonables.
  const pedidos = new Map<string, number>();
  for (const it of (Array.isArray(body.items) ? body.items : []).slice(0, 10)) {
    const sku = clean(it?.sku, 60);
    const n = Math.floor(Number(it?.cantidad));
    if (sku && n > 0) pedidos.set(sku, Math.min(MAX_POR_PRODUCTO, (pedidos.get(sku) ?? 0) + n));
  }
  if (!pedidos.size) return json({ error: 'Tu bolsa está vacía.' }, 400);

  const db = sql();
  const huella = ipHash(request);
  const [{ n }] = (await db`select count(*)::int as n from pedidos where ip_hash = ${huella} and creado > now() - interval '1 hour'`) as { n: number }[];
  if (n >= POR_HORA) return json({ error: 'Hiciste varios pedidos seguidos. Intenta de nuevo en un rato.' }, 429);

  await expireOld();
  // Aparta las existencias (si falta de alguno, se devuelve lo ya apartado y se avisa cuántos quedan).
  const apartados: { sku: string; nombre: string; precio: number; cantidad: number }[] = [];
  const devolver = async () => {
    for (const a of apartados) await db`update productos set existencias = existencias + ${a.cantidad} where sku = ${a.sku}`;
  };
  for (const [sku, cantidad] of pedidos) {
    const [r] = (await db`
      update productos set existencias = existencias - ${cantidad}, actualizado = now()
      where sku = ${sku} and activo and existencias >= ${cantidad}
      returning sku, nombre, precio`) as { sku: string; nombre: string; precio: number }[];
    if (!r) {
      await devolver();
      const [p] = (await db`select nombre, existencias from productos where sku = ${sku} and activo`) as { nombre: string; existencias: number }[];
      return json({
        error: p ? (p.existencias > 0 ? `Solo quedan ${p.existencias} de «${p.nombre}».` : `«${p.nombre}» se agotó.`) : 'Ese producto ya no está disponible.',
        sku,
        quedan: p?.existencias ?? 0,
      }, 409);
    }
    apartados.push({ ...r, cantidad });
  }

  const subtotal = apartados.reduce((t, a) => t + a.precio * a.cantidad, 0);
  const total = subtotal + ENVIO;
  const referencia = `TV-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const expira = new Date(Date.now() + PLAZO_MIN * 60 * 1000);
  expira.setMilliseconds(0);
  try {
    const [p] = (await db`
      insert into pedidos (referencia, expira, nombre, correo, celular, direccion, ciudad, departamento, notas, subtotal, envio, total, ip_hash)
      values (${referencia}, ${expira.toISOString()}, ${comprador.nombre}, ${comprador.correo}, ${comprador.celular}, ${comprador.direccion},
        ${comprador.ciudad}, ${comprador.departamento}, ${comprador.notas}, ${subtotal}, ${ENVIO}, ${total}, ${huella})
      returning id`) as { id: string }[];
    for (const a of apartados) {
      await db`insert into pedido_items (pedido_id, sku, nombre, cantidad, precio) values (${p.id}, ${a.sku}, ${a.nombre}, ${a.cantidad}, ${a.precio})`;
    }
  } catch (e) {
    await devolver();
    throw e;
  }
  // Vuelve a /tienda/pedido/<referencia> (Wompi le agrega ?id=<transacción>).
  const url = checkoutUrl({ referencia, total, expira, ...comprador }, `${returnBase(request)}/tienda/pedido/${referencia}`);
  return json({ referencia, total, url }, 201);
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const ref = clean(q.get('ref'), 40);
  const txId = clean(q.get('id'), 60);
  if (!ref) return json({ error: 'Falta la referencia.' }, 400);
  const db = sql();
  const find = async () => {
    const [p] = (await db`select id, estado, total, subtotal, envio, nombre, expira, metodo, pagado from pedidos where referencia = ${ref}`) as {
      id: string; estado: string; total: number; subtotal: number; envio: number; nombre: string; expira: string; metodo: string | null; pagado: string | null;
    }[];
    return p;
  };
  let p = await find();
  if (!p) return json({ error: 'No encontramos ese pedido.' }, 404);
  if (p.estado === 'pendiente' && txId) {
    const tx = await fetchTx(txId);
    if (tx && tx.reference === ref) {
      await applyTx(tx);
      p = await find();
    }
  }
  if (p.estado === 'pendiente' && new Date(p.expira) < new Date()) {
    await expireOld();
    p = await find();
  }
  const items = await db`select nombre, cantidad, precio from pedido_items where pedido_id = ${p.id}`;
  // Solo lo necesario para la página de vuelta (sin correo, celular ni dirección).
  return json({
    referencia: ref, estado: p.estado, subtotal: p.subtotal, envio: p.envio, total: p.total, metodo: p.metodo, pagado: p.pagado,
    nombre: p.nombre.split(/\s+/)[0], items,
  });
}
