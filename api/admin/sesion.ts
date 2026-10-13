// /api/admin/sesion
//   GET    → ¿hay sesión? (la página la pregunta al abrir)
//   POST   { usuario, clave } → entrar
//   DELETE → salir

import { isAdmin, login, logout } from '../_lib/admin.js';
import { json } from '../_lib/util.js';

export function GET(request: Request) {
  return json({ ok: isAdmin(request) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { usuario?: unknown; clave?: unknown };
  const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : '');
  return login(request, text(body.usuario), text(body.clave));
}

export function DELETE(request: Request) {
  return logout(request);
}
