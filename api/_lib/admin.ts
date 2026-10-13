// El panel del equipo (/admin): la clave y la sesión.
//
// - La clave vive en ADMIN_PASSWORD (Vercel → Environment Variables; en local, .env.local). Nunca en el código.
// - Al entrar, el servidor da una galleta (cookie) firmada que vence en SESION_HORAS: el navegador la manda sola, el
//   JavaScript de la página no la puede leer (HttpOnly) y no viaja a otros sitios (SameSite=Strict).
// - Las acciones (POST) además piden el encabezado `x-admin: 1`: un formulario de otro sitio no lo puede poner.
// - Más de INTENTOS claves erradas en 15 minutos desde la misma conexión: se frena un rato.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { sql } from './db.js';
import { ipHash, json } from './util.js';

const COOKIE = 'tv_admin';
const SESION_HORAS = 12;
const INTENTOS = 8;

const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_TOKEN || '';
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');
const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** ¿La petición trae una sesión válida (y, si cambia algo, el encabezado del panel)? */
export function isAdmin(request: Request) {
  if (!secret()) return false;
  if (request.method !== 'GET' && request.headers.get('x-admin') !== '1') return false;
  const raw = request.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return false;
  const [exp, mac] = raw.split('.');
  return !!exp && !!mac && Number(exp) > Date.now() && same(mac, sign(exp));
}

/** Respuesta 401 para cuando no hay sesión. */
export const noSession = () => json({ error: 'Tu sesión venció. Vuelve a entrar.' }, 401);

const cookie = (request: Request, value: string, maxAge: number) => {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
};

/** Entrar con la clave. */
export async function login(request: Request, clave: string) {
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!password || !secret()) return json({ error: 'El panel todavía no tiene clave configurada.' }, 503);
  const huella = ipHash(request);
  const db = sql();
  const [{ n }] = (await db`
    select count(*)::int as n from admin_intentos where ip_hash = ${huella} and not ok and creada > now() - interval '15 minutes'`) as { n: number }[];
  if (n >= INTENTOS) return json({ error: 'Demasiados intentos. Espera unos minutos.' }, 429);
  const ok = same(clave, password);
  await db`insert into admin_intentos (ip_hash, ok) values (${huella}, ${ok})`;
  if (!ok) return json({ error: 'Esa no es la clave.' }, 401);
  const exp = String(Date.now() + SESION_HORAS * 3600 * 1000);
  return json({ ok: true }, 200, { 'set-cookie': cookie(request, `${exp}.${sign(exp)}`, SESION_HORAS * 3600) });
}

/** Salir. */
export const logout = (request: Request) => json({ ok: true }, 200, { 'set-cookie': cookie(request, '', 0) });
