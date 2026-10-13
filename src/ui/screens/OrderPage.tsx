// /tienda/pedido/<código>: a donde vuelve la persona después de pagar en Wompi (que agrega ?id=<transacción>), y el
// enlace directo para seguir un pedido. El seguimiento en sí está en OrderTracker.

import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { OrderTracker, TRACK_TEXT, type TrackState } from '../components/OrderTracker';
import { Sheet } from '../components/Sheet';

export default function OrderPage() {
  const { ref = '' } = useParams();
  const [search] = useSearchParams();
  const [state, setState] = useState<TrackState>('cargando');
  const text = TRACK_TEXT[state];
  return (
    <Sheet className="sheet--story sheet--shop" eyebrow="Tienda · Tu pedido" title={text.title} intro={text.intro} still>
      <OrderTracker code={ref} txId={search.get('id')} onState={setState} />
      <div className="shop-order__links">
        <Link className="shop-cta" to="/tienda">Ir a la tienda</Link>
      </div>
    </Sheet>
  );
}
