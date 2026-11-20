// Los datos de envío de un pedido: las mismas reglas en la tienda (para avisar mientras se escribe) y en el servidor
// (que es el que decide; ver api/tienda/pedidos.ts). Pedido del equipo, 19/11/2026: la ciudad se elige de la lista de
// municipios de Colombia y el departamento sale solo; el nombre, el correo, el celular y la dirección se revisan.

import { MUNICIPIOS } from '../content/municipios.js';

export interface Comprador {
  nombre: string;
  correo: string;
  celular: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  notas: string;
}

/** Sin tildes ni mayúsculas, para comparar y buscar. */
export const plano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Un municipio con su departamento. */
export interface Municipio {
  ciudad: string;
  departamento: string;
  /** Para buscar: sin tildes ni mayúsculas. */
  clave: string;
}

export const LISTA_MUNICIPIOS: Municipio[] = Object.entries(MUNICIPIOS).flatMap(([departamento, ciudades]) =>
  ciudades.map((ciudad) => ({ ciudad, departamento, clave: plano(ciudad) })));

/** Los que coinciden con lo escrito: primero los que empiezan así, luego los que lo contienen. */
export function buscarMunicipios(texto: string, max = 8): Municipio[] {
  const q = plano(texto);
  if (!q) return [];
  const empiezan = LISTA_MUNICIPIOS.filter((m) => m.clave.startsWith(q) || m.clave.split(' ').some((w) => w.startsWith(q)));
  const contienen = LISTA_MUNICIPIOS.filter((m) => !empiezan.includes(m) && m.clave.includes(q));
  // Bogotá primero: es a donde más se envía.
  return [...empiezan, ...contienen].sort((a, b) => (b.ciudad === 'Bogotá' ? 1 : 0) - (a.ciudad === 'Bogotá' ? 1 : 0)).slice(0, max);
}

/** El municipio exacto (con su nombre bien escrito), si esa ciudad existe en ese departamento. */
export function municipio(ciudad: string, departamento: string): Municipio | null {
  const c = plano(ciudad);
  const d = plano(departamento);
  return LISTA_MUNICIPIOS.find((m) => m.clave === c && plano(m.departamento) === d) ?? null;
}

/** Qué está mal en cada campo (vacío si todo está bien). */
export function erroresComprador(c: Comprador): Partial<Record<keyof Comprador, string>> {
  const e: Partial<Record<keyof Comprador, string>> = {};
  const nombre = c.nombre.trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}][\p{L}' .-]*$/u.test(nombre) || nombre.split(' ').filter((w) => /\p{L}{2,}/u.test(w)).length < 2 || nombre.length > 80)
    e.nombre = 'Escribe tu nombre y apellido (solo letras).';
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c.correo.trim())) e.correo = 'Revisa tu correo (por ejemplo, nombre@gmail.com).';
  if (!/^3\d{9}$/.test(c.celular)) e.celular = 'Un celular de Colombia: 10 números que empiezan por 3.';
  const dir = c.direccion.trim();
  if (dir.length < 6 || dir.length > 160 || !/\d/.test(dir) || !/\p{L}/u.test(dir))
    e.direccion = 'Escribe la dirección con su número (por ejemplo, Calle 10 # 5-20).';
  if (!municipio(c.ciudad, c.departamento)) e.ciudad = 'Elige tu ciudad o municipio de la lista.';
  if (c.notas.length > 300) e.notas = 'Máximo 300 caracteres.';
  return e;
}
