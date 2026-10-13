// La tienda contra la API (ver api/tienda): precio y existencias, crear el pedido (devuelve el enlace al checkout de
// Wompi) y ver cómo va un pedido al volver de pagar. La bolsa vive en este navegador (sobrevive al ir y volver de Wompi).

export interface Catalog {
  /** Por SKU: lo que manda la base de datos. */
  productos: Record<string, { precio: number; existencias: number; activo: boolean }>;
  envio: number;
}

/** Precio y existencias. Sin servidor (por ejemplo, con `vite` solo), null: la tienda muestra los precios del código. */
export async function fetchCatalog(): Promise<Catalog | null> {
  try {
    const res = await fetch('/api/tienda/productos');
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
    const data = (await res.json()) as { productos: { sku: string; precio: number; existencias: number; activo: boolean }[]; envio: number };
    return { envio: data.envio, productos: Object.fromEntries(data.productos.map(({ sku, ...p }) => [sku, p])) };
  } catch {
    return null;
  }
}

export interface Buyer {
  nombre: string;
  correo: string;
  celular: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  notas: string;
}

export class OrderError extends Error {
  constructor(message: string, readonly sku?: string, readonly quedan?: number) {
    super(message);
  }
}

/** Crea el pedido y devuelve el enlace para pagar en Wompi. */
export async function createOrder(items: { sku: string; cantidad: number }[], comprador: Buyer, consentimiento: boolean, web: string) {
  let res: Response;
  try {
    res = await fetch('/api/tienda/pedidos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items, comprador, consentimiento, web }),
    });
  } catch {
    throw new OrderError('No hay conexión. Revisa tu internet e intenta otra vez.');
  }
  const data = (await res.json().catch(() => ({}))) as { url?: string; referencia?: string; error?: string; sku?: string; quedan?: number };
  if (!res.ok || !data.url) throw new OrderError(data.error ?? 'No se pudo crear el pedido. Intenta otra vez.', data.sku, data.quedan);
  return { url: data.url, referencia: data.referencia! };
}

export interface OrderStatus {
  referencia: string;
  estado: 'pendiente' | 'pagado' | 'rechazado' | 'expirado' | 'empacando' | 'enviado' | 'entregado';
  subtotal: number;
  envio: number;
  total: number;
  metodo: string | null;
  nombre: string;
  ciudad: string;
  items: { nombre: string; cantidad: number; precio: number }[];
  /** Número de guía y transportadora, cuando el pedido ya salió. */
  guia: string;
  transportadora: string;
  /** Cuándo pasó cada paso (null si todavía no). */
  fechas: { creado: string; pagado: string | null; empacado: string | null; enviado: string | null; entregado: string | null };
}

/** Cómo va un pedido. Con el número de transacción que agrega Wompi, el servidor la consulta allá. */
export async function fetchOrder(ref: string, txId?: string | null): Promise<OrderStatus> {
  const q = new URLSearchParams({ ref });
  if (txId) q.set('id', txId);
  const res = await fetch(`/api/tienda/pedidos?${q}`);
  const data = (await res.json().catch(() => ({}))) as OrderStatus & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'No pudimos consultar tu pedido.');
  return data;
}

/** La bolsa, guardada en este navegador: SKU → cantidad. */
const BAG_KEY = 'tienda-bolsa';
export function loadBag(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(BAG_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
export function saveBag(bag: Record<string, number>) {
  try {
    if (Object.keys(bag).length) localStorage.setItem(BAG_KEY, JSON.stringify(bag));
    else localStorage.removeItem(BAG_KEY);
  } catch {
    // Sin almacenamiento: la bolsa dura mientras la página esté abierta.
  }
}

/** Los departamentos de Colombia (para la dirección de envío). */
export const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D. C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca',
  'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
  'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
];
