// Tienda: la lista de productos; al tocar uno, su ficha como en una tienda en línea (galería con sus detalles y lupa,
// precio, existencias, cantidad, descripción y características); la bolsa; y el pago: los datos de envío y el resumen,
// y de ahí al checkout de Wompi. Al volver de pagar, la persona llega a /tienda/pedido/<referencia> (ver OrderPage).
// El precio y las existencias los manda la base de datos (ver api/tienda); las fotos y los textos, el código.

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { SHOP_ITEMS, pesos, type ShopItem } from '../../content/stories';
import { type Buyer, type Catalog, DEPARTAMENTOS, OrderError, createOrder, fetchCatalog, loadBag, saveBag } from '../../application/shop-api';
import { LineIcon, Sheet, type Origin } from '../components/Sheet';
import { OrderTracker } from '../components/OrderTracker';

type Size = ShopItem['sizes'][number];
/** Una línea de la bolsa: el producto en un tamaño. */
type Line = { item: ShopItem; size: Size; qty: number; price: number };
/** Más de esto por producto no se puede pedir de una vez. */
const MAX_QTY = 10;
const ENVIO_RESPALDO = 15000;

/** Galería: la foto grande con lupa (sigue al mouse) y, al lado, las miniaturas de los detalles. */
function Gallery({ item }: { item: ShopItem }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const photo = item.photos[i];
  return (
    <div className="shop-gallery">
      <ul className="shop-gallery__thumbs" aria-label="Fotos del producto">
        {item.photos.map((p, k) => (
          <li key={p.src}>
            <button
              type="button"
              className={k === i ? 'is-on' : ''}
              aria-label={p.alt}
              aria-pressed={k === i}
              onClick={() => setI(k)}
              onMouseEnter={() => setI(k)}
            >
              <img src={p.thumb ?? p.src} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      <figure
        className={`shop-gallery__main${zoom ? ' is-zoom' : ''}`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
        style={zoom ? ({ '--zx': `${zoom.x}%`, '--zy': `${zoom.y}%` } as CSSProperties) : undefined}
      >
        <img key={photo.src} src={photo.src} alt={photo.alt} />
        <figcaption>{photo.alt}</figcaption>
      </figure>
    </div>
  );
}

/** Lo que se ve de las existencias. */
function Stock({ left }: { left: number | null }) {
  if (left === null) return null;
  if (left <= 0) return <p className="shop-stock is-out">Agotado por ahora</p>;
  return <p className={`shop-stock${left <= 3 ? ' is-low' : ''}`}>{left === 1 ? 'Queda 1' : `Quedan ${left}`} en existencia</p>;
}

/** La ficha del producto. */
function Product({ item, catalog, inBag, onBack, onAdd, onBuy }: {
  item: ShopItem;
  catalog: Catalog | null;
  inBag: (sku: string) => number;
  onBack: () => void;
  onAdd: (sku: string, qty: number) => void;
  onBuy: (sku: string, qty: number) => void;
}) {
  const [size, setSize] = useState(item.sizes[1]?.id ?? item.sizes[0].id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const chosen = item.sizes.find((s) => s.id === size)!;
  const db = catalog?.productos[chosen.sku];
  const price = db?.precio ?? chosen.price;
  /** Lo que todavía se puede agregar (lo que hay, menos lo que ya está en la bolsa). Sin servidor, no se sabe. */
  const left = db ? (db.activo ? db.existencias : 0) : null;
  const room = left === null ? MAX_QTY : Math.max(0, Math.min(MAX_QTY, left) - inBag(chosen.sku));
  const top = useRef<HTMLDivElement>(null);
  // Al abrirla, arriba del todo (la lista pudo quedar desplazada).
  useEffect(() => {
    top.current?.closest('.sheet__body')?.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    if (room > 0 && qty > room) setQty(room);
  }, [room, qty]);
  return (
    <div className="shop-product" ref={top}>
      <button type="button" className="shop-back" onClick={onBack}>
        <span aria-hidden="true">←</span> Volver a la tienda
      </button>
      <div className="shop-product__grid">
        <Gallery item={item} />
        <div className="shop-buy">
          <p className="shop-buy__kind">{item.kind}</p>
          <h3 className="shop-buy__name">{item.name}</h3>
          <p className="shop-buy__summary">{item.summary}</p>

          <p className="shop-buy__price">{pesos(price * qty)}</p>
          <p className="shop-buy__sample">Precio de prueba · el envío se suma al pagar</p>
          <Stock left={left} />

          {item.sizes.length > 1 ? (
            <div className="shop-buy__block">
              <p className="shop-buy__label">Tamaño</p>
              <div className="shop-sizes" role="radiogroup" aria-label="Tamaño">
                {item.sizes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={s.id === size}
                    className={`shop-size${s.id === size ? ' is-on' : ''}`}
                    onClick={() => { setSize(s.id); setAdded(false); }}
                  >
                    <span className="shop-size__dot" aria-hidden="true" />
                    <span className="shop-size__name">{s.label}<small>{s.detail}</small></span>
                    <span className="shop-size__price">{pesos(catalog?.productos[s.sku]?.precio ?? s.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Un solo tamaño: se dice, sin elegir.
            <p className="shop-buy__block shop-buy__row shop-buy__row--first">
              <span className="shop-buy__label">Tamaño</span>
              <span className="shop-size__name">{chosen.label}<small>{chosen.detail}</small></span>
            </p>
          )}

          <div className="shop-buy__block shop-buy__row">
            <p className="shop-buy__label">Cantidad</p>
            <span className="shop-qty shop-qty--lg">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Uno menos" disabled={qty <= 1}>−</button>
              <span aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(room, q + 1))} aria-label="Uno más" disabled={qty >= room}>+</button>
            </span>
          </div>

          <div className="shop-buy__actions">
            <button type="button" className="shop-cta" disabled={room <= 0} onClick={() => onBuy(chosen.sku, qty)}>Comprar ahora</button>
            <button
              type="button"
              className="shop-cta shop-cta--line"
              disabled={room <= 0 && !added}
              onClick={() => { onAdd(chosen.sku, qty); setAdded(true); setQty(1); }}
            >
              {added ? '✓ En tu bolsa' : 'Agregar a la bolsa'}
            </button>
          </div>
          {room <= 0 && left !== null && left > 0 && <p className="shop-notice" role="status">Ya tienes en tu bolsa todos los que hay.</p>}

          <ul className="shop-perks">
            <li><PerkIcon name="truck" />Envío a toda Colombia por {pesos(catalog?.envio ?? ENVIO_RESPALDO)}</li>
            <li><PerkIcon name="tube" />Llega enrollado en un tubo, sin dobleces</li>
            <li><PerkIcon name="leaf" />La ilustración original del mapa del recorrido</li>
          </ul>
        </div>
      </div>

      <div className="shop-info">
        <section>
          <h4 className="shop-info__title">Descripción</h4>
          {item.description.map((p, k) => <p key={k} className="shop-info__text">{p}</p>)}
        </section>
        <section>
          <h4 className="shop-info__title">Características</h4>
          <dl className="shop-specs">
            {[['Tamaño', `${chosen.label} (${chosen.detail})`] as [string, string], ...item.specs].map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

function PerkIcon({ name }: { name: 'truck' | 'tube' | 'leaf' | 'lock' }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'truck' && <><path {...c} d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle {...c} cx="7" cy="17.5" r="1.8" /><circle {...c} cx="17" cy="17.5" r="1.8" /></>}
      {name === 'tube' && <><ellipse {...c} cx="6" cy="12" rx="2.5" ry="5" /><path {...c} d="M6 7h12M6 17h12M18 7c1.4 0 2.5 2.2 2.5 5s-1.1 5-2.5 5" /></>}
      {name === 'leaf' && <><path {...c} d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><path {...c} d="M5 19l7-7" /></>}
      {name === 'lock' && <><rect {...c} x="5" y="10.5" width="14" height="10" rx="2" /><path {...c} d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>}
    </svg>
  );
}

const EMPTY_BUYER: Buyer = { nombre: '', correo: '', celular: '', direccion: '', ciudad: '', departamento: '', notas: '' };

/** El pago: datos de envío a la izquierda, resumen a la derecha; al confirmar, el pedido se crea y se va a Wompi. */
function Checkout({ lines, envio, onBack, onStock }: {
  lines: Line[];
  envio: number;
  onBack: () => void;
  /** Si al crear el pedido ya no había suficientes, se ajusta la bolsa a lo que queda. */
  onStock: (sku: string, quedan: number) => void;
}) {
  const [buyer, setBuyer] = useState<Buyer>(EMPTY_BUYER);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof Buyer) => (e: { target: { value: string } }) => setBuyer((b) => ({ ...b, [k]: e.target.value }));
  const subtotal = lines.reduce((n, l) => n + l.qty * l.price, 0);
  const top = useRef<HTMLFormElement>(null);
  useEffect(() => {
    top.current?.closest('.sheet__body')?.scrollTo({ top: 0 });
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const web = String(new FormData(e.currentTarget).get('web') ?? '');
      const { url } = await createOrder(lines.map((l) => ({ sku: l.size.sku, cantidad: l.qty })), buyer, consent, web);
      window.location.assign(url);
    } catch (err) {
      if (err instanceof OrderError && err.sku !== undefined && err.quedan !== undefined) onStock(err.sku, err.quedan);
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido.');
      setBusy(false);
    }
  };

  return (
    <form className="shop-checkout" ref={top} onSubmit={submit}>
      <button type="button" className="shop-back" onClick={onBack}>
        <span aria-hidden="true">←</span> Seguir viendo la tienda
      </button>
      <div className="shop-checkout__grid">
        <div className="shop-checkout__form">
          <h3 className="shop-checkout__title">¿A dónde te lo enviamos?</h3>
          <div className="story-row">
            <label className="story-field">
              <span className="story-field__label">Nombre completo</span>
              <input required minLength={3} maxLength={80} autoComplete="name" value={buyer.nombre} onChange={set('nombre')} />
            </label>
            <label className="story-field">
              <span className="story-field__label">Celular</span>
              <input required type="tel" inputMode="numeric" pattern="3[0-9]{9}" maxLength={10} autoComplete="tel-national"
                placeholder="3001234567" value={buyer.celular} onChange={(e) => setBuyer((b) => ({ ...b, celular: e.target.value.replace(/\D/g, '') }))} />
            </label>
          </div>
          <label className="story-field">
            <span className="story-field__label">Correo <em>ahí te llega la confirmación</em></span>
            <input required type="email" maxLength={120} autoComplete="email" value={buyer.correo} onChange={set('correo')} />
          </label>
          <label className="story-field">
            <span className="story-field__label">Dirección</span>
            <input required minLength={5} maxLength={160} autoComplete="street-address" placeholder="Calle, número, barrio, apartamento" value={buyer.direccion} onChange={set('direccion')} />
          </label>
          <div className="story-row">
            <label className="story-field">
              <span className="story-field__label">Ciudad o municipio</span>
              <input required minLength={2} maxLength={60} autoComplete="address-level2" value={buyer.ciudad} onChange={set('ciudad')} />
            </label>
            <label className="story-field">
              <span className="story-field__label">Departamento</span>
              <select required value={buyer.departamento} onChange={set('departamento')}>
                <option value="" disabled>Elige el departamento</option>
                {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <label className="story-field">
            <span className="story-field__label">Algo que debamos saber <em>opcional</em></span>
            <input maxLength={300} placeholder="Por ejemplo, a qué hora hay alguien en la casa" value={buyer.notas} onChange={set('notas')} />
          </label>
          <label className="story-check">
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Autorizo a Territorios Vivos a usar estos datos solo para enviarme mi pedido y escribirme sobre él (Ley 1581 de
              2012).
            </span>
          </label>
          <input className="story-trap" name="web" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        </div>

        <aside className="shop-summary" aria-label="Resumen de tu pedido">
          <h3 className="shop-summary__title">Tu pedido</h3>
          <ul className="shop-summary__lines">
            {lines.map((l) => (
              <li key={l.size.sku}>
                <img src={l.item.photos[0].thumb ?? l.item.photos[0].src} alt="" />
                <span className="shop-summary__name">{l.item.name}<small>{l.size.label} · {l.qty} {l.qty === 1 ? 'unidad' : 'unidades'}</small></span>
                <span>{pesos(l.qty * l.price)}</span>
              </li>
            ))}
          </ul>
          <dl className="shop-summary__sums">
            <div><dt>Productos</dt><dd>{pesos(subtotal)}</dd></div>
            <div><dt>Envío</dt><dd>{pesos(envio)}</dd></div>
            <div className="is-total"><dt>Total</dt><dd>{pesos(subtotal + envio)}</dd></div>
          </dl>
          {error && <p className="story-error" role="alert">{error}</p>}
          <button type="submit" className="shop-cta" disabled={busy || !lines.length}>
            {busy ? 'Preparando el pago…' : `Pagar ${pesos(subtotal + envio)}`}
          </button>
          <p className="shop-summary__secure"><PerkIcon name="lock" />Pagas en Wompi, de Bancolombia: tarjeta, PSE o Nequi. Nosotros no vemos los datos de tu tarjeta.</p>
          <p className="shop-summary__test">Tienda en modo de prueba: no se cobra dinero real.</p>
        </aside>
      </div>
    </form>
  );
}

/** «Consultar mi pedido»: con el código que le salió al pagar, la persona ve en qué va su pedido. */
function Lookup({ onBack }: { onBack: () => void }) {
  const [draft, setDraft] = useState('');
  const [code, setCode] = useState('');
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    top.current?.closest('.sheet__body')?.scrollTo({ top: 0 });
  }, []);
  return (
    <div className="shop-lookup" ref={top}>
      <button type="button" className="shop-back" onClick={onBack}>
        <span aria-hidden="true">←</span> Volver a la tienda
      </button>
      <form
        className="shop-lookup__form"
        onSubmit={(e) => {
          e.preventDefault();
          setCode(draft.trim().toUpperCase());
        }}
      >
        <label className="story-field">
          <span className="story-field__label">Código del pedido <em>empieza por TV-, te salió al pagar</em></span>
          <input
            required
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="TV-MV5V0U53-FFF7E0A1"
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
          />
        </label>
        <button type="submit" className="shop-cta">Consultar</button>
      </form>
      {code && <OrderTracker key={code} code={code} />}
    </div>
  );
}

export default function Shop({ onClose, origin }: { onClose?: () => void; origin?: Origin }) {
  const [view, setView] = useState<ShopItem | 'lista' | 'pago' | 'consulta'>('lista');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [bag, setBagState] = useState<Record<string, number>>(loadBag);
  const [bagOpen, setBagOpen] = useState(false);
  useEffect(() => {
    void fetchCatalog().then(setCatalog);
  }, []);
  const setBag = (fn: (b: Record<string, number>) => Record<string, number>) => setBagState((b) => {
    const next = fn(b);
    saveBag(next);
    return next;
  });
  const priceOf = (s: Size) => catalog?.productos[s.sku]?.precio ?? s.price;
  /** Los del código y los creados desde el panel (estos llegan con el catálogo). */
  const items = [...SHOP_ITEMS, ...(catalog?.extras ?? [])];
  const lines: Line[] = items.flatMap((item) =>
    item.sizes.filter((s) => bag[s.sku]).map((size) => ({ item, size, qty: bag[size.sku], price: priceOf(size) })));
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.qty * l.price, 0);
  const add = (sku: string, d: number) => setBag((b) => {
    const n = Math.min(MAX_QTY, (b[sku] ?? 0) + d);
    const next = { ...b };
    if (n > 0) next[sku] = n;
    else delete next[sku];
    return next;
  });
  const envio = catalog?.envio ?? ENVIO_RESPALDO;
  const from = (item: ShopItem) => Math.min(...item.sizes.map(priceOf));
  const leftOf = (item: ShopItem) => (catalog ? item.sizes.reduce((n, s) => n + (catalog.productos[s.sku]?.existencias ?? 0), 0) : null);

  return (
    <Sheet
      className="sheet--story sheet--shop"
      origin={origin}
      eyebrow="Tienda"
      title={view === 'pago' ? 'Ya casi es tuyo' : view === 'consulta' ? '¿Cómo va tu pedido?' : 'Lleva un pedazo del Pacífico'}
      intro={view === 'pago' ? 'Déjanos tus datos de envío y paga seguro con Wompi.'
        : view === 'consulta' ? 'Escribe el código de tu pedido y te contamos en qué va: pago, empaque, en camino o entregado.'
          : 'Cosas del recorrido para tener en la casa. Por ahora la tienda está en modo de prueba.'}
      onClose={onClose}
      aside={
        // En el atardecer, el póster colgado, un poco ladeado.
        <figure className="shop-hang" aria-hidden="true">
          <img src="/media/tienda/poster-mapa-sm.webp" alt="" />
        </figure>
      }
    >
      {view !== 'pago' && (
        <div className="shop-bar">
          <p className="shop-bar__count">{view === 'lista' ? `${items.length} ${items.length === 1 ? 'producto' : 'productos'}` : ''}</p>
          <div className="shop-bar__actions">
            {view !== 'consulta' && (
              <button type="button" className="shop-track-btn" onClick={() => { setBagOpen(false); setView('consulta'); }}>
                <PerkIcon name="truck" /> Consultar mi pedido
              </button>
            )}
            <button type="button" className="shop-bag-btn" onClick={() => setBagOpen((o) => !o)} aria-expanded={bagOpen}>
              <LineIcon name="shop" size={18} /> Tu bolsa{count > 0 && <span className="shop-bag-btn__count">{count}</span>}
            </button>
          </div>
        </div>
      )}

      {bagOpen && view !== 'pago' && (
        <section className="shop-bag" aria-label="Tu bolsa">
          {lines.length === 0 ? (
            <p className="shop-bag__empty">Tu bolsa está vacía.</p>
          ) : (
            <>
              <ul>
                {lines.map(({ item, size, qty, price }) => {
                  const left = catalog?.productos[size.sku]?.existencias;
                  return (
                    <li key={size.sku}>
                      <img src={item.photos[0].thumb ?? item.photos[0].src} alt="" />
                      <span className="shop-bag__name">{item.name}<small>{size.label}, {size.detail}</small></span>
                      <span className="shop-qty">
                        <button type="button" onClick={() => add(size.sku, -1)} aria-label={`Quitar uno: ${item.name}`}>−</button>
                        {qty}
                        <button type="button" onClick={() => add(size.sku, 1)} aria-label={`Agregar uno: ${item.name}`}
                          disabled={qty >= MAX_QTY || (left !== undefined && qty >= left)}>+</button>
                      </span>
                      <span>{pesos(qty * price)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="shop-bag__total"><span>Productos</span><strong>{pesos(total)}</strong></p>
              <p className="shop-bag__ship">El envío ({pesos(envio)}) se suma al pagar.</p>
              <button type="button" className="shop-cta" onClick={() => { setBagOpen(false); setView('pago'); }}>Continuar con el pago</button>
            </>
          )}
        </section>
      )}

      {view === 'consulta' ? (
        <Lookup onBack={() => setView('lista')} />
      ) : view === 'pago' ? (
        <Checkout
          lines={lines}
          envio={envio}
          onBack={() => setView('lista')}
          onStock={(sku, quedan) => {
            setBag((b) => {
              const next = { ...b };
              if (quedan > 0) next[sku] = quedan;
              else delete next[sku];
              return next;
            });
            void fetchCatalog().then(setCatalog);
          }}
        />
      ) : view !== 'lista' ? (
        <Product
          key={view.id}
          item={view}
          catalog={catalog}
          inBag={(sku) => bag[sku] ?? 0}
          onBack={() => setView('lista')}
          onAdd={(sku, qty) => add(sku, qty)}
          onBuy={(sku, qty) => { add(sku, qty); setView('pago'); }}
        />
      ) : (
        <ul className="shop-grid">
          {items.map((item) => {
            const left = leftOf(item);
            return (
              <li key={item.id}>
                <button type="button" className="shop-card" onClick={() => setView(item)}>
                  <span className="shop-card__pic"><img src={item.photos[0].thumb ?? item.photos[0].src} alt={item.photos[0].alt} /></span>
                  <span className="shop-card__body">
                    <span className="shop-card__kind">{item.kind}{left !== null && (left > 0 ? ` · quedan ${left}` : ' · agotado')}</span>
                    <span className="shop-card__name">{item.name}</span>
                    <span className="shop-card__summary">{item.summary}</span>
                    <span className="shop-card__foot">
                      <span className="shop-card__price">{item.sizes.length > 1 && <small>Desde</small>}{pesos(from(item))}</span>
                      <span className="shop-card__more">Ver detalles <span aria-hidden="true">→</span></span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
