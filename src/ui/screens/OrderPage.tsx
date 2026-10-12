// /tienda/pedido/<referencia>: a donde vuelve la persona después de pagar en Wompi (que agrega ?id=<transacción>).
// Pregunta al servidor cómo va el pedido (y el servidor le pregunta a Wompi); mientras siga pendiente, vuelve a
// preguntar unas veces, porque un pago con PSE o Nequi puede tardar un poco en confirmarse.

import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { pesos } from '../../content/stories';
import { type OrderStatus, fetchOrder, saveBag } from '../../application/shop-api';
import { Sheet } from '../components/Sheet';

const EVERY_MS = 3000;
const TRIES = 20;

const TEXT: Record<OrderStatus['estado'] | 'cargando' | 'error', { title: string; intro: string }> = {
  cargando: { title: 'Revisando tu pago', intro: 'Un momento, estamos confirmando con Wompi.' },
  pendiente: { title: 'Tu pago está en proceso', intro: 'Algunos pagos, como PSE, tardan unos minutos en confirmarse.' },
  pagado: { title: '¡Gracias por tu compra!', intro: 'Tu pago fue aprobado. Ya estamos preparando tu póster.' },
  enviado: { title: 'Tu pedido va en camino', intro: 'Ya salió hacia tu dirección.' },
  entregado: { title: 'Tu pedido fue entregado', intro: 'Esperamos que lo disfrutes.' },
  rechazado: { title: 'El pago no se aprobó', intro: 'No se hizo ningún cobro. Puedes intentarlo otra vez con otro medio de pago.' },
  expirado: { title: 'Se acabó el tiempo para pagar', intro: 'El pedido venció sin pagarse. Puedes hacerlo de nuevo desde la tienda.' },
  error: { title: 'No encontramos tu pedido', intro: 'Revisa el enlace o escríbenos.' },
};

export default function OrderPage() {
  const { ref = '' } = useParams();
  const [search] = useSearchParams();
  const txId = search.get('id');
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [state, setState] = useState<OrderStatus['estado'] | 'cargando' | 'error'>('cargando');
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    let timer = 0;
    const ask = async (n: number) => {
      try {
        const o = await fetchOrder(ref, txId);
        if (!live) return;
        setOrder(o);
        setState(o.estado);
        setTries(n);
        // Pagado: la bolsa ya se compró.
        if (o.estado === 'pagado') saveBag({});
        if (o.estado === 'pendiente' && n < TRIES) timer = window.setTimeout(() => void ask(n + 1), EVERY_MS);
      } catch {
        if (live) setState('error');
      }
    };
    void ask(1);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [ref, txId]);

  const text = TEXT[state];
  const ok = state === 'pagado' || state === 'enviado' || state === 'entregado';
  return (
    <Sheet className="sheet--story sheet--shop" eyebrow="Tienda" title={text.title} intro={text.intro} still>
      <div className={`shop-order is-${state}`}>
        <p className="shop-order__badge">
          <span className="shop-order__icon" aria-hidden="true">
            {state === 'cargando' || state === 'pendiente' ? <span className="shop-order__spin" /> : ok ? '✓' : '!'}
          </span>
          {state === 'cargando' ? 'Confirmando…' : state === 'pendiente' ? (tries >= TRIES ? 'Aún en proceso' : 'Esperando la confirmación…') : ok ? 'Pago aprobado' : text.title}
        </p>

        {order && (
          <div className="shop-summary shop-order__summary">
            <p className="shop-order__ref">Referencia <strong>{order.referencia}</strong></p>
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
              <div><dt>Envío</dt><dd>{pesos(order.envio)}</dd></div>
              <div className="is-total"><dt>Total</dt><dd>{pesos(order.total)}</dd></div>
            </dl>
            {ok && order.metodo && <p className="shop-order__meta">Pagado con {METODO[order.metodo] ?? order.metodo}.</p>}
          </div>
        )}

        {ok && (
          <p className="shop-order__next">
            {order?.nombre ? `${order.nombre}, guarda` : 'Guarda'} la referencia por si necesitas escribirnos. Te avisaremos cuando
            el pedido salga hacia tu casa.
          </p>
        )}
        {state === 'pendiente' && tries >= TRIES && (
          <button type="button" className="shop-cta shop-cta--line" onClick={() => location.reload()}>Volver a revisar</button>
        )}
        <div className="shop-order__links">
          <Link className="shop-cta" to="/tienda">{ok ? 'Volver a la tienda' : 'Ir a la tienda'}</Link>
        </div>
      </div>
    </Sheet>
  );
}

const METODO: Record<string, string> = {
  CARD: 'tarjeta', PSE: 'PSE', NEQUI: 'Nequi', BANCOLOMBIA_TRANSFER: 'Botón Bancolombia', BANCOLOMBIA_QR: 'QR Bancolombia',
  DAVIPLATA: 'Daviplata', BANCOLOMBIA_COLLECT: 'corresponsal Bancolombia', PCOL: 'Puntos Colombia',
};
