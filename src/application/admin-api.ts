// El panel del equipo contra la API (ver api/admin). La sesión va en una galleta que el navegador manda solo; las
// acciones llevan además el encabezado `x-admin` (lo pide el servidor).

export class AdminError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/admin/${path}`, {
      method: init?.method ?? (init?.body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', 'x-admin': '1' },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new AdminError('No hay conexión con el servidor.', 0);
  }
  const data = (await res.json().catch(() => ({ error: 'El servidor no respondió (¿corre con `npm run dev:api`?).' }))) as T & { error?: string };
  if (!res.ok) throw new AdminError(data.error ?? 'Algo salió mal.', res.status);
  return data;
}

export const session = () => call<{ ok: boolean }>('sesion');
export const login = (usuario: string, clave: string) => call<{ ok: true }>('sesion', { body: { usuario, clave } });
export const logout = () => call<{ ok: true }>('sesion', { method: 'DELETE' });

export type Conteo = Record<string, number>;

export interface Resumen {
  historias: Conteo;
  pedidos: Conteo;
  ventas: { total: number; pedidos: number; mes: number };
  productos: { sku: string; nombre: string; precio: number; existencias: number; activo: boolean }[];
  ultimos: { referencia: string; creado: string; estado: string; nombre: string; ciudad: string; total: number }[];
  porRevisar: { id: string; creada: string; titulo: string; autor: string; municipio: string; lugar: string; archivos: number }[];
}
export const resumen = () => call<Resumen>('resumen');

export type EstadoHistoria = 'pendiente' | 'aprobada' | 'rechazada';
export interface AdminHistoria {
  id: string;
  creada: string;
  estado: EstadoHistoria;
  titulo: string;
  relato: string;
  cuando: string;
  tipo: string;
  municipio: string;
  lugar: string;
  lat: number | null;
  lon: number | null;
  autor: string;
  contacto: string;
  archivos: { pathname: string; tipo: 'foto' | 'video' | 'audio'; nombre: string; bytes: number; url?: string }[];
  revisada: string | null;
  nota: string;
}
export const historias = (estado: EstadoHistoria) => call<{ historias: AdminHistoria[]; conteo: Conteo }>(`historias?estado=${estado}`);
export const accionHistoria = (body: Record<string, unknown>) => call<{ ok: true }>('historias', { body });

export type VistaPedidos = 'despachar' | 'camino' | 'entregados' | 'pendientes' | 'todos';
export interface AdminPedido {
  referencia: string;
  creado: string;
  estado: string;
  expira: string;
  nombre: string;
  correo: string;
  celular: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  notas: string;
  subtotal: number;
  envio: number;
  total: number;
  metodo: string | null;
  wompi_id: string | null;
  pagado: string | null;
  empacado: string | null;
  enviado: string | null;
  entregado: string | null;
  transportadora: string;
  guia: string;
  nota: string;
  items: { nombre: string; cantidad: number; precio: number }[];
}
export const pedidos = (vista: VistaPedidos, q = '') =>
  call<{ pedidos: AdminPedido[]; conteo: Conteo }>(`pedidos?vista=${vista}&q=${encodeURIComponent(q)}`);
export const accionPedido = (body: Record<string, unknown>) => call<{ ok: true }>('pedidos', { body });

export interface FotoProducto { pathname: string; alt: string; url?: string }
export interface AdminProducto {
  sku: string;
  nombre: string;
  precio: number;
  existencias: number;
  activo: boolean;
  actualizado: string;
  creado: string;
  apartados: number;
  vendidos: number;
  categoria: string;
  resumen: string;
  descripcion: string;
  tamano: string;
  medidas: string;
  caracteristicas: [string, string][];
  /** Vacío en los productos del código (el póster original): sus fotos están en src/content. */
  fotos: FotoProducto[];
}
export const productos = () => call<{ productos: AdminProducto[] }>('productos');
export const guardarProducto = (body: Record<string, unknown>) => call<{ ok: true }>('productos', { body });
export const crearProducto = (body: Record<string, unknown>) => call<{ ok: true; sku: string }>('productos', { body: { ...body, accion: 'crear' } });
export const editarProducto = (body: Record<string, unknown>) => call<{ ok: true; sku: string }>('productos', { body: { ...body, accion: 'editar' } });

/** Sube una foto de producto directo al almacén (con permiso de /api/admin/subir). `onProgress` va de 0 a 1. */
export async function subirFoto(file: File, folder: string, onProgress: (p: number) => void): Promise<FotoProducto> {
  const { upload } = await import('@vercel/blob/client');
  const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-60) || 'foto';
  try {
    const blob = await upload(`productos/${folder}/${safe}`, file, {
      access: 'private',
      handleUploadUrl: '/api/admin/subir',
      contentType: file.type || undefined,
      onUploadProgress: (e) => onProgress(e.percentage / 100),
    });
    return { pathname: blob.pathname, alt: '', url: URL.createObjectURL(file) };
  } catch (e) {
    throw new AdminError(e instanceof Error ? e.message : 'No se pudo subir la foto.', 0);
  }
}
