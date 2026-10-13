// /api/tienda/productos — lo que la tienda muestra de cada producto: precio y existencias (de todos) y, de los creados
// desde el panel, también sus textos y sus fotos (con enlaces firmados: el almacén es privado). El póster original toma
// sus fotos y textos del código. Más el valor del envío.

import { type Archivo, sql } from '../_lib/db.js';
import { ENVIO, expireOld } from '../_lib/tienda.js';
import { json, signed } from '../_lib/util.js';

export async function GET() {
  await expireOld();
  const rows = (await sql()`
    select sku, nombre, precio, existencias, activo, categoria, resumen, descripcion, tamano, medidas, caracteristicas, fotos
    from productos order by creado, sku`) as { fotos: Archivo[] }[];
  const productos = await Promise.all(rows.map(async (p) => ({ ...p, fotos: await signed(p.fotos) })));
  return json({ productos, envio: ENVIO });
}
