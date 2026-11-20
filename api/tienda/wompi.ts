// /api/tienda/wompi — el aviso del servidor de Wompi cada vez que cambia una transacción (se configura en el panel de
// Wompi → Desarrolladores → URL de eventos). Se comprueba su firma con el secreto de eventos antes de creerle.

import { type WompiTx, applyTx, validEvent } from '../_lib/tienda.js';
import { json } from '../_lib/util.js';

// Al guardar la URL en el panel, Wompi la prueba y la da por «inválida» si no responde 200 (19/11/2026). Así que a todo
// se responde 200, pero solo se le cree a un aviso con la firma correcta: lo demás se ignora sin tocar nada.
export function GET() {
  return json({ ok: true });
}

export async function POST(request: Request) {
  let body: { event?: string; data?: { transaction?: WompiTx }; signature?: { properties?: string[]; checksum?: string }; timestamp?: number };
  try {
    body = await request.json();
  } catch {
    return json({ ok: true, ignorado: 'Aviso ilegible.' });
  }
  if (!validEvent(body)) return json({ ok: true, ignorado: 'Firma no válida.' });
  if (body.event === 'transaction.updated' && body.data?.transaction) await applyTx(body.data.transaction);
  // Un 200 le dice a Wompi que lo recibimos (si no, lo vuelve a enviar).
  return json({ ok: true });
}
