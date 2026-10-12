// Seguimiento de un pedido por su código: en qué va (pago, empaque, en camino, entregado), con la fecha de cada paso,
// la guía de la transportadora y el resumen. Lo usan la página de vuelta de Wompi y «Consultar mi pedido» de la tienda.
// Con el número de transacción que agrega Wompi al volver, el servidor la consulta allá; mientras el pago siga en
// proceso, vuelve a preguntar unas veces (un pago con PSE o Nequi puede tardar un poco).

import { useEffect, useState } from 'react';
import { pesos } from '../../content/stories';
import { type OrderStatus, fetchOrder, saveBag } from '../../application/shop-api';

const EVERY_MS = 3000;
const TRIES = 20;

export type TrackState = OrderStatus['estado'] | 'cargando' | 'error';

/** Lo que se dice de cada estado: el título grande y una frase. */
export const TRACK_TEXT: Record<TrackState, { title: string; intro: string }> = {
  cargando: { title: 'Buscando tu pedido', intro: 'Un momento.' },
  pendiente: { title: 'Esperando el pago', intro: 'Algunos pagos, como PSE, tardan unos minutos en confirmarse.' },
  pagado: { title: '¡Gracias por tu compra!', intro: 'Tu pago fue aprobado. Pronto empezamos a empacar tu pedido.' },
  empacando: { title: 'Estamos empacando tu pedido', intro: 'Lo estamos preparando con cuidado para que llegue perfecto.' },
  enviado: { title: 'Tu pedido va en camino', intro: 'Ya salió hacia tu dirección.' },
  entregado: { title: 'Tu pedido fue entregado', intro: 'Esperamos que lo disfrutes.' },
  rechazado: { title: 'El pago no se aprobó', intro: 'No se hizo ningún cobro. Puedes intentarlo otra vez con otro medio de pago.' },
  expirado: { title: 'Se acabó el tiempo para pagar', intro: 'El pedido venció sin pagarse. Puedes hacerlo de nuevo desde la tienda.' },
  error: { title: 'No encontramos ese pedido', intro: 'Revisa el código. Lo encuentras en la página que te salió al pagar.' },
};

/** Los pasos del camino de un pedido pagado. */
const STEPS = [
  { estado: 'pagado', label: 'Pago aprobado', fecha: 'pagado' },
  { estado: 'empacando', label: 'En empaque', fecha: 'empacado' },
  { estado: 'enviado', label: 'En camino', fecha: 'enviado' },
  { estado: 'entregado', label: 'Entregado', fecha: 'entregado' },
] as const;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : '';

const METODO: Record<string, string> = {
  CARD: 'tarjeta', PSE: 'PSE', NEQUI: 'Nequi', BANCOLOMBIA_TRANSFER: 'Botón Bancolombia', BANCOLOMBIA_QR: 'QR Bancolombia',
  DAVIPLATA: 'Daviplata', BANCOLOMBIA_COLLECT: 'corresponsal Bancolombia', PCOL: 'Puntos Colombia',
};

export function OrderTracker({ code, txId, onState }: {
  code: string;
  /** El número de la transacción que agrega Wompi al volver (solo en la página de vuelta). */
  txId?: string | null;
  /** Para que quien lo usa cambie su título con el estado. */
  onState?: (s: TrackState) => void;
}) {
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [state, setState] = useState<TrackState>('cargando');
  const [tries, setTries] = useState(0);
  useEffect(() => {
    onState?.(state);
  }, [state, onState]);

  useEffect(() => {
    let live = true;
    let timer = 0;
    const ask = async (n: number) => {
      try {
        const o = await fetchOrder(code, txId);
        if (!live) return;
        setOrder(o);
        setState(o.estado);
        setTries(n);
        // Ya pagado: lo que había en la bolsa se compró.
        if (txId && o.estado === 'pagado') saveBag({});
        if (o.estado === 'pendiente' && n < TRIES) timer = window.setTimeout(() => void ask(n + 1), EVERY_MS);
      } catch {
        if (live) setState('error');
      }
    };
    setState('cargando');
    void ask(1);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [code, txId]);

  const paid = order && STEPS.some((s) => s.estado === order.estado);
  const at = order ? STEPS.findIndex((s) => s.estado === order.estado) : -1;

  return (
    <div className={`shop-order is-${state}`} aria-live="polite">
      <p className="shop-order__badge">
        <span className="shop-order__icon" aria-hidden="true">
          {state === 'cargando' || state === 'pendiente' ? <span className="shop-order__spin" /> : paid ? '✓' : '!'}
        </span>
        {state === 'pendiente' && tries >= TRIES ? 'El pago sigue en proceso' : TRACK_TEXT[state].title}
      </p>
      {state === 'error' && <p className="shop-order__next">{TRACK_TEXT.error.intro}</p>}

      {/* El camino del pedido: cada paso con su fecha; el de ahora, resaltado. */}
      {order && paid && (
        <ol className="shop-track">
          {STEPS.map((s, i) => (
            <li key={s.estado} className={i < at ? 'is-done' : i === at ? 'is-now' : ''}>
              <span className="shop-track__dot" aria-hidden="true">{i <= at ? '✓' : ''}</span>
              <span className="shop-track__text">
                <strong>{s.label}</strong>
                {order.fechas[s.fecha] && <small>{when(order.fechas[s.fecha])}</small>}
                {s.estado === 'enviado' && i <= at && (order.transportadora || order.guia) && (
                  <small className="shop-track__guia">
                    {order.transportadora}{order.transportadora && order.guia ? ' · ' : ''}{order.guia && <>guía <b>{order.guia}</b></>}
                  </small>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {order && (
        <div className="shop-summary shop-order__summary">
          <p className="shop-order__ref">Código del pedido <strong>{order.referencia}</strong></p>
          <ul className="shop-summary__lines">
            {order.items.map((i) => (
              <li key={i.nombre}>
                <span className="shop-summary__name">{i.nombre}<small>{i.cantidad} {i.cantidad === 1 ? 'unidad' : 'unidades'}</small></span>
                <span>{pesos(i.cantidad * i.precio)}</span>
              </li>
            ))}
          </ul>
          <dl className="shop-summary__sums">
            <div><dt>Productos</dt><dd>{pesos(order.subtotal)}</dd></div>
            <div><dt>Envío{order.ciudad ? ` a ${order.ciudad}` : ''}</dt><dd>{pesos(order.envio)}</dd></div>
            <div className="is-total"><dt>Total</dt><dd>{pesos(order.total)}</dd></div>
          </dl>
          {paid && order.metodo && <p className="shop-order__meta">Pagado con {METODO[order.metodo] ?? order.metodo} el {when(order.fechas.pagado)}.</p>}
        </div>
      )}

      {paid && order?.estado === 'pagado' && (
        <p className="shop-order__next">
          {order.nombre ? `${order.nombre}, guarda` : 'Guarda'} el código <strong>{order.referencia}</strong>. Con él puedes ver cómo
          va tu pedido cuando quieras, en la tienda, en «Consultar mi pedido».
        </p>
      )}
      {state === 'pendiente' && tries >= TRIES && (
        <button type="button" className="shop-cta shop-cta--line" onClick={() => location.reload()}>Volver a revisar</button>
      )}
    </div>
  );
}
