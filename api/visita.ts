// /api/visita — el contador propio de visitas (lo manda la web al ver una página; ver src/application/visits.ts).
//   POST { ruta } → suma una página vista y, si es la primera vez del día de esa persona, una visita.
// Sin cookies ni datos personales: la «persona» es una huella de su conexión y su navegador mezclada con una sal
// secreta y la fecha, así que cambia cada día y no sirve para saber quién es ni para seguirla. Los robots no cuentan.
// Los días van en hora de Colombia.

import { createHash } from 'node:crypto';
import { sql } from './_lib/db.js';
import { clean } from './_lib/util.js';

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|node-fetch/i;
const done = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  const ua = request.headers.get('user-agent') ?? '';
  if (!ua || BOT.test(ua)) return done();
  const body = (await request.json().catch(() => ({}))) as { ruta?: unknown };
  // Solo direcciones de la web (sin parámetros), y nunca el panel.
  const ruta = clean(body.ruta, 80).split(/[?#]/)[0];
  if (!/^\/[\w\-/]*$/.test(ruta) || ruta.startsWith('/admin') || ruta.startsWith('/api')) return done();

  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const dia = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10); // Colombia: UTC−5, sin horario de verano
  const huella = createHash('sha256').update(`${process.env.HASH_SALT ?? process.env.ADMIN_SESSION_SECRET ?? ''}|${dia}|${ip}|${ua}`).digest('hex').slice(0, 32);
  const movil = /Mobi|Android|iPhone|iPad/i.test(ua);
  const db = sql();
  await db`
    insert into visitas_pagina (dia, ruta, vistas) values (${dia}::date, ${ruta}, 1)
    on conflict (dia, ruta) do update set vistas = visitas_pagina.vistas + 1`;
  await db`insert into visitas_personas (dia, huella, movil) values (${dia}::date, ${huella}, ${movil}) on conflict do nothing`;
  return done();
}
