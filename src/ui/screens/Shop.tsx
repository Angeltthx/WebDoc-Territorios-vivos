// Tienda (interfaz de prueba): productos de muestra, filtro por tipo y una bolsa que suma. Todavía no vende: el pago
// se conecta cuando el cliente defina productos, precios y cómo cobrar.

import { useState } from 'react';
import { SHOP_ITEMS, pesos, type ShopItem } from '../../content/stories';
import { LineIcon, Sheet, type Origin } from '../components/Sheet';

const KINDS = ['Todo', ...new Set(SHOP_ITEMS.map((i) => i.kind))] as const;

function ProductArt({ icon }: { icon: ShopItem['icon'] }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="shop-item__art" viewBox="0 0 64 64" aria-hidden="true">
      {icon === 'poster' && <><rect {...c} x="16" y="10" width="32" height="44" rx="2" /><path {...c} d="M20 42c6-8 10-8 14-3s8 4 10-2M24 22a4 4 0 1 0 8 0 4 4 0 1 0-8 0" /></>}
      {icon === 'postcard' && <><rect {...c} x="10" y="18" width="44" height="30" rx="2" /><path {...c} d="M34 22v22M38 26h10M38 31h10M40 38h6" /></>}
      {icon === 'shirt' && <path {...c} d="M24 12l-12 7 5 9 5-3v27h20V25l5 3 5-9-12-7c-1 4-4 6-8 6s-7-2-8-6z" />}
      {icon === 'bag' && <><path {...c} d="M16 24h32l-3 30H19z" /><path {...c} d="M24 24c0-12 16-12 16 0" /></>}
      {icon === 'notebook' && <><rect {...c} x="18" y="10" width="30" height="44" rx="3" /><path {...c} d="M18 18h-4M18 26h-4M18 34h-4M18 42h-4M26 20h14M26 26h10" /></>}
      {icon === 'cup' && <><path {...c} d="M16 22h28v20a10 10 0 0 1-10 10h-8a10 10 0 0 1-10-10z" /><path {...c} d="M44 27h4a5 5 0 0 1 0 10h-4M24 10c-2 3 2 5 0 8M32 10c-2 3 2 5 0 8" /></>}
    </svg>
  );
}

export default function Shop({ onClose, origin }: { onClose?: () => void; origin?: Origin }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('Todo');
  const [bag, setBag] = useState<Record<string, number>>({});
  const [bagOpen, setBagOpen] = useState(false);
  const [soon, setSoon] = useState(false);
  const items = SHOP_ITEMS.filter((i) => kind === 'Todo' || i.kind === kind);
  const lines = SHOP_ITEMS.filter((i) => bag[i.id]);
  const count = lines.reduce((n, i) => n + bag[i.id], 0);
  const total = lines.reduce((n, i) => n + bag[i.id] * i.price, 0);
  const add = (id: string, d = 1) => setBag((b) => {
    const n = (b[id] ?? 0) + d;
    const next = { ...b };
    if (n > 0) next[id] = n;
    else delete next[id];
    return next;
  });

  return (
    <Sheet
      origin={origin}
      eyebrow="Tienda"
      title="Lleva un pedazo del Pacífico"
      intro="Productos y precios de muestra: así se verá la tienda cuando abra."
      onClose={onClose}
    >
      <div className="shop-bar">
        <div className="shop-kinds" role="tablist" aria-label="Tipo de producto">
          {KINDS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={k === kind} className={`shop-kind${k === kind ? ' is-active' : ''}`} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
        <button type="button" className="shop-bag-btn" onClick={() => setBagOpen((o) => !o)} aria-expanded={bagOpen}>
          <LineIcon name="shop" size={18} /> Bolsa{count > 0 && <span className="shop-bag-btn__count">{count}</span>}
        </button>
      </div>

      {bagOpen && (
        <section className="shop-bag" aria-label="Tu bolsa">
          {lines.length === 0 ? (
            <p className="muted">Tu bolsa está vacía.</p>
          ) : (
            <>
              <ul>
                {lines.map((i) => (
                  <li key={i.id}>
                    <span>{i.name}</span>
                    <span className="shop-qty">
                      <button type="button" onClick={() => add(i.id, -1)} aria-label={`Quitar uno: ${i.name}`}>−</button>
                      {bag[i.id]}
                      <button type="button" onClick={() => add(i.id)} aria-label={`Agregar uno: ${i.name}`}>+</button>
                    </span>
                    <span>{pesos(bag[i.id] * i.price)}</span>
                  </li>
                ))}
              </ul>
              <p className="shop-bag__total"><span>Total</span><strong>{pesos(total)}</strong></p>
              <button type="button" className="btn btn--dark" onClick={() => setSoon(true)}>Pagar</button>
              {soon && <p className="notice" role="status">La tienda abre pronto: todavía no se puede pagar.</p>}
            </>
          )}
        </section>
      )}

      <ul className="shop-grid">
        {items.map((i) => (
          <li key={i.id} className="shop-item">
            <div className="shop-item__pic" style={{ background: i.color }}><ProductArt icon={i.icon} /></div>
            <p className="shop-item__kind">{i.kind}</p>
            <h3 className="shop-item__name">{i.name}</h3>
            <div className="shop-item__foot">
              <span className="shop-item__price">{pesos(i.price)}</span>
              <button type="button" className="shop-item__add" onClick={() => add(i.id)}>
                {bag[i.id] ? `En la bolsa · ${bag[i.id]}` : 'Agregar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
