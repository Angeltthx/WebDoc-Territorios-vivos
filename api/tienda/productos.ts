// /api/tienda/productos — precio y existencias de cada producto, y el valor del envío (lo que la tienda muestra; las
// fotos y los textos están en el código).

import { sql } from '../_lib/db.js';
import { ENVIO, expireOld } from '../_lib/tienda.js';
import { json } from '../_lib/util.js';

export async function GET() {
  await expireOld();
  const productos = await sql()`select sku, precio, existencias, activo from productos`;
  return json({ productos, envio: ENVIO });
}
