// /api/admin/sesion
//   GET    → ¿hay sesión? (la página la pregunta al abrir)
//   POST   { clave } → entrar
//   DELETE → salir

import { isAdmin, login, logout } from '../_lib/admin.js';
import { json } from '../_lib/util.js';

export function GET(request: Request) {
  return json({ ok: isAdmin(request) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { clave?: unknown };
  return login(request, typeof body.clave === 'string' ? body.clave.slice(0, 200) : '');
}

export function DELETE(request: Request) {
  return logout(request);
}
