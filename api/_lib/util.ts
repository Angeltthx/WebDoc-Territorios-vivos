// Utilidades de las funciones de la API: respuestas JSON, la huella anónima de quien envía y los enlaces firmados a
// los archivos privados.

import { createHash } from 'node:crypto';
import { issueSignedToken, presignUrl } from '@vercel/blob';
import type { Archivo } from './db';

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

/**
 * Huella de quien envía, para limitar envíos seguidos: la IP mezclada con una sal secreta (no se guarda la IP, y la
 * huella no sirve para saber cuál era).
 */
export function ipHash(request: Request) {
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  return createHash('sha256').update(`${process.env.HASH_SALT ?? process.env.ADMIN_TOKEN ?? ''}|${ip}`).digest('hex').slice(0, 32);
}

// Un permiso de lectura para todo el almacén, renovado antes de vencer; con él se firma cada enlace (sin más llamadas).
let token: { delegationToken: string; clientSigningToken: string; validUntil: number } | null = null;
const HOURS = 6;

/** Enlaces firmados (válidos unas horas) para ver los archivos de una historia. */
export async function signed(archivos: Archivo[]) {
  if (!archivos.length) return [];
  if (!token || token.validUntil - Date.now() < 60 * 60 * 1000) {
    token = await issueSignedToken({ pathname: '*', operations: ['get'], validUntil: Date.now() + HOURS * 60 * 60 * 1000 });
  }
  const t = token;
  return Promise.all(archivos.map(async (a) => ({
    ...a,
    url: (await presignUrl(t, { operation: 'get', pathname: a.pathname, access: 'private', validUntil: t.validUntil })).presignedUrl,
  })));
}

/** Texto limpio: sin espacios de más ni caracteres de control, y con un tope. */
export const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';
