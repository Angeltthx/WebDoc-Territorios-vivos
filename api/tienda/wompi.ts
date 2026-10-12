// /api/tienda/wompi — el aviso del servidor de Wompi cada vez que cambia una transacción (se configura en el panel de
// Wompi → Desarrolladores → URL de eventos). Se comprueba su firma con el secreto de eventos antes de creerle.

import { type WompiTx, applyTx, validEvent } from '../_lib/tienda.js';
import { json } from '../_lib/util.js';

export async function POST(request: Request) {
  let body: { event?: string; data?: { transaction?: WompiTx }; signature?: { properties?: string[]; checksum?: string }; timestamp?: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Aviso ilegible.' }, 400);
  }
  if (!validEvent(body)) return json({ error: 'Firma no válida.' }, 401);
  if (body.event === 'transaction.updated' && body.data?.transaction) await applyTx(body.data.transaction);
  // Un 200 le dice a Wompi que lo recibimos (si no, lo vuelve a enviar).
  return json({ ok: true });
}
