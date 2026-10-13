// Panel del equipo: /admin (sin indexar), con usuario y clave. A pantalla completa y sobrio (IBM Plex Sans, cifras en
// columnas), con un toque del webdoc: el verde oscuro del menú y el dorado de lo pendiente.
//   - Resumen: las cifras de hoy y, en tablas, los últimos pedidos y las historias por revisar.
//   - Pedidos, Historias, Productos: en tablas; al tocar una fila, su detalle se abre a la derecha con sus acciones.
// El nombre del panel (arriba en el menú) y la ruta «Panel / …» llevan siempre al resumen.
// Todo pasa por la API (api/admin), que revisa la sesión en cada paso.

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CHOCO_POINTS, EMBLEM_LABEL, type Emblem } from '../../content/choco';
import { pesos } from '../../content/stories';
import * as api from '../../application/admin-api';

type Seccion = 'resumen' | 'pedidos' | 'historias' | 'productos';
const SECCIONES: { id: Seccion; label: string; icon: IconName }[] = [
  { id: 'resumen', label: 'Resumen', icon: 'home' },
  { id: 'pedidos', label: 'Pedidos', icon: 'box' },
  { id: 'historias', label: 'Historias', icon: 'chat' },
  { id: 'productos', label: 'Productos', icon: 'tag' },
];

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

const ESTADO_PEDIDO: Record<string, string> = {
  pendiente: 'Esperando pago', pagado: 'Por empacar', empacando: 'En empaque', enviado: 'En camino', entregado: 'Entregado',
  rechazado: 'Pago rechazado', expirado: 'Vencido',
};
const ESTADO_HISTORIA: Record<string, string> = { pendiente: 'Por revisar', aprobada: 'En el mapa', rechazada: 'Rechazada' };
const METODO: Record<string, string> = {
  CARD: 'Tarjeta', PSE: 'PSE', NEQUI: 'Nequi', BANCOLOMBIA_TRANSFER: 'Botón Bancolombia', BANCOLOMBIA_QR: 'QR Bancolombia',
  DAVIPLATA: 'Daviplata', BANCOLOMBIA_COLLECT: 'Corresponsal Bancolombia',
};

/* ───────── Íconos de línea (mismo trazo que los del webdoc) ───────── */
type IconName = 'home' | 'box' | 'chat' | 'tag' | 'out' | 'web' | 'refresh' | 'close' | 'search';
function Icon({ name }: { name: IconName }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'home' && <path {...c} d="M4 11l8-6 8 6v8h-5v-5H9v5H4z" />}
      {name === 'box' && <><path {...c} d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path {...c} d="M4 8l8 4 8-4M12 12v8" /></>}
      {name === 'chat' && <><path {...c} d="M4 5.5h16v10H10l-4.5 3.5V15.5H4z" /><path {...c} d="M8 9h8M8 12h5" /></>}
      {name === 'tag' && <><path {...c} d="M4 12V4h8l8 8-8 8z" /><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" /></>}
      {name === 'out' && <path {...c} d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />}
      {name === 'web' && <><circle {...c} cx="12" cy="12" r="8" /><path {...c} d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16" /></>}
      {name === 'refresh' && <path {...c} d="M19 8a7.5 7.5 0 1 0 1 6M19 4v4h-4" />}
      {name === 'close' && <path {...c} d="M6 6l12 12M18 6L6 18" />}
      {name === 'search' && <><circle {...c} cx="11" cy="11" r="6" /><path {...c} d="M20 20l-4.5-4.5" /></>}
    </svg>
  );
}

/** Llama a la API; si la sesión venció, vuelve a la entrada. */
type Run = <T>(fn: () => Promise<T>) => Promise<T | null>;
function useRun(onExpired: () => void): Run {
  return useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof api.AdminError && e.status === 401) {
        onExpired();
        return null;
      }
      throw e;
    }
  }, [onExpired]);
}

export default function Admin() {
  const [state, setState] = useState<'cargando' | 'fuera' | 'dentro'>('cargando');
  const [seccion, setSeccion] = useState<Seccion>('resumen');
  /** Al ir desde el resumen a una fila concreta: la sección la abre. */
  const [abrir, setAbrir] = useState<string | null>(null);
  const [pend, setPend] = useState({ historias: 0, pedidos: 0 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.title = 'Panel · Territorios Vivos';
    return () => meta.remove();
  }, []);
  useEffect(() => {
    api.session().then((s) => setState(s.ok ? 'dentro' : 'fuera')).catch(() => setState('fuera'));
  }, []);
  const expired = useCallback(() => setState('fuera'), []);
  const run = useRun(expired);
  const refresh = useCallback(() => {
    void run(api.resumen).then((r) => r && setPend({
      historias: r.historias.pendiente ?? 0,
      pedidos: (r.pedidos.pagado ?? 0) + (r.pedidos.empacando ?? 0),
    })).catch(() => {});
  }, [run]);
  useEffect(() => {
    if (state === 'dentro') refresh();
  }, [state, seccion, tick, refresh]);

  const go = (s: Seccion, id: string | null = null) => {
    setAbrir(id);
    setSeccion(s);
  };

  if (state !== 'dentro') return <LoginScreen loading={state === 'cargando'} onIn={() => setState('dentro')} />;

  const badge: Partial<Record<Seccion, number>> = { pedidos: pend.pedidos, historias: pend.historias };
  const title = SECCIONES.find((s) => s.id === seccion)!.label;
  return (
    <div className="ap">
      <aside className="ap-side">
        <button type="button" className="ap-brand" onClick={() => go('resumen')} title="Ir al resumen">
          <span className="ap-brand__mark" aria-hidden="true">TV</span>
          <span><strong>Territorios Vivos</strong><small>Panel del equipo</small></span>
        </button>
        <nav className="ap-nav" aria-label="Secciones">
          {SECCIONES.map((s) => (
            <button key={s.id} type="button" className={`ap-nav__item${s.id === seccion ? ' is-on' : ''}`} aria-current={s.id === seccion} onClick={() => go(s.id)}>
              <Icon name={s.icon} />
              <span>{s.label}</span>
              {!!badge[s.id] && <span className="ap-nav__badge" title="Pendientes">{badge[s.id]}</span>}
            </button>
          ))}
        </nav>
        <div className="ap-side__foot">
          <Link className="ap-nav__item" to="/"><Icon name="web" /><span>Ver la web</span></Link>
          <button type="button" className="ap-nav__item" onClick={() => void api.logout().finally(() => setState('fuera'))}><Icon name="out" /><span>Salir</span></button>
        </div>
      </aside>

      <main className="ap-main">
        <header className="ap-top">
          <div>
            <p className="ap-crumbs">
              <button type="button" onClick={() => go('resumen')}>Panel</button>
              {seccion !== 'resumen' && <><span aria-hidden="true">/</span><span>{title}</span></>}
            </p>
            <h1 className="ap-title">{title}</h1>
          </div>
          <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setTick((t) => t + 1)}><Icon name="refresh" /> Actualizar</button>
        </header>
        <div className="ap-content" key={`${seccion}-${tick}`}>
          {seccion === 'resumen' && <ResumenView run={run} go={go} />}
          {seccion === 'pedidos' && <PedidosView run={run} open={abrir} onChange={refresh} />}
          {seccion === 'historias' && <HistoriasView run={run} open={abrir} onChange={refresh} />}
          {seccion === 'productos' && <ProductosView run={run} />}
        </div>
      </main>
    </div>
  );
}

/* ───────── Entrada ───────── */
function LoginScreen({ loading, onIn }: { loading: boolean; onIn: () => void }) {
  const [usuario, setUsuario] = useState('admin');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(usuario, clave);
      onIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar.');
      setBusy(false);
    }
  };
  return (
    <div className="ap-login">
      <div className="ap-login__brand">
        <span className="ap-brand__mark" aria-hidden="true">TV</span>
        <p><strong>Territorios Vivos</strong><span>Panel del equipo</span></p>
      </div>
      {loading ? <p className="ap-muted">Un momento…</p> : (
        <form className="ap-login__card" onSubmit={submit}>
          <h1>Entrar al panel</h1>
          <p className="ap-muted">Pedidos de la tienda, historias de la gente y productos.</p>
          <label className="ap-field">
            <span>Usuario</span>
            <input required autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </label>
          <label className="ap-field">
            <span>Clave</span>
            <input type="password" required autoFocus autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
          </label>
          {error && <p className="ap-error" role="alert">{error}</p>}
          <button type="submit" className="ap-btn ap-btn--primary ap-btn--block" disabled={busy || !clave || !usuario}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <Link className="ap-login__back" to="/">← Volver a la web</Link>
        </form>
      )}
    </div>
  );
}

/* ───────── Piezas comunes ───────── */
function Pill({ estado, label }: { estado: string; label: string }) {
  return <span className={`ap-pill is-${estado}`}>{label}</span>;
}

function Tabs<T extends string>({ items, value, onChange }: { items: { id: T; label: string; n?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="ap-tabs" role="tablist">
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} className={`ap-tab${t.id === value ? ' is-on' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}{t.n !== undefined && <span className="ap-tab__n">{t.n}</span>}
        </button>
      ))}
    </div>
  );
}

/** Tabla con cabeceras; si no hay filas, un aviso. */
function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{has ? children : <tr><td colSpan={head.length} className="ap-table__empty">{empty ?? 'No hay nada aquí.'}</td></tr>}</tbody>
      </table>
    </div>
  );
}

/** Panel lateral con el detalle de una fila (se cierra con Escape o tocando afuera). */
function Drawer({ title, sub, onClose, children }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="ap-drawer" role="dialog" aria-modal="true">
      <button type="button" className="ap-drawer__veil" aria-label="Cerrar" onClick={onClose} />
      <section className="ap-drawer__panel">
        <header className="ap-drawer__head">
          <div><h2>{title}</h2>{sub && <p className="ap-muted">{sub}</p>}</div>
          <button type="button" className="ap-icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </header>
        <div className="ap-drawer__body">{children}</div>
      </section>
    </div>
  );
}

/** Botón con confirmación en el mismo lugar. */
function Confirm({ label, sure, onYes, busy, danger }: { label: string; sure: string; onYes: () => void; busy?: boolean; danger?: boolean }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span className="ap-confirm">
      <button type="button" className={`ap-btn ${danger ? 'ap-btn--danger' : 'ap-btn--primary'}`} disabled={busy} onClick={onYes}>{sure}</button>
      <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setAsk(false)}>Cancelar</button>
    </span>
  ) : (
    <button type="button" className={`ap-btn${danger ? ' ap-btn--ghost ap-btn--warn' : ''}`} onClick={() => setAsk(true)}>{label}</button>
  );
}

const Loading = () => <p className="ap-muted ap-pad">Cargando…</p>;

/* ───────── Resumen ───────── */
function ResumenView({ run, go }: { run: Run; go: (s: Seccion, id?: string | null) => void }) {
  const [r, setR] = useState<api.Resumen | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    run(api.resumen).then(setR).catch((e) => setError(e.message));
  }, [run]);
  if (error) return <p className="ap-error">{error}</p>;
  if (!r) return <Loading />;
  const despachar = (r.pedidos.pagado ?? 0) + (r.pedidos.empacando ?? 0);
  const promedio = r.ventas.pedidos ? Math.round(r.ventas.total / r.ventas.pedidos) : 0;
  return (
    <div className="ap-stack">
      <div className="ap-kpis">
        <div className="ap-kpi">
          <p className="ap-kpi__l">Ventas · últimos 30 días</p>
          <p className="ap-kpi__n">{pesos(r.ventas.mes)}</p>
          <p className="ap-kpi__s">{pesos(r.ventas.total)} en total · {r.ventas.pedidos} pedidos · promedio {pesos(promedio)}</p>
        </div>
        <button type="button" className={`ap-kpi${despachar ? ' is-todo' : ''}`} onClick={() => go('pedidos')}>
          <p className="ap-kpi__l">Pedidos por despachar</p>
          <p className="ap-kpi__n">{despachar}</p>
          <p className="ap-kpi__s">{r.pedidos.pagado ?? 0} por empacar · {r.pedidos.empacando ?? 0} en empaque · {r.pedidos.enviado ?? 0} en camino</p>
        </button>
        <button type="button" className={`ap-kpi${r.historias.pendiente ? ' is-todo' : ''}`} onClick={() => go('historias')}>
          <p className="ap-kpi__l">Historias por revisar</p>
          <p className="ap-kpi__n">{r.historias.pendiente ?? 0}</p>
          <p className="ap-kpi__s">{r.historias.aprobada ?? 0} en el mapa · {r.historias.rechazada ?? 0} rechazadas</p>
        </button>
        {r.productos.map((p) => (
          <button key={p.sku} type="button" className={`ap-kpi${p.existencias <= 3 ? ' is-warn' : ''}`} onClick={() => go('productos')}>
            <p className="ap-kpi__l">Existencias</p>
            <p className="ap-kpi__n">{p.existencias}</p>
            <p className="ap-kpi__s">{p.nombre}{!p.activo ? ' · no está a la venta' : p.existencias <= 3 ? ' · quedan pocos' : ''}</p>
          </button>
        ))}
      </div>

      <div className="ap-grid2">
        <section className="ap-card">
          <header className="ap-card__head"><h2>Últimos pedidos</h2><button type="button" className="ap-link" onClick={() => go('pedidos')}>Ver todos →</button></header>
          <Table head={['Código', 'Cliente', 'Estado', <span className="ap-num" key="t">Total</span>]} empty="Todavía no hay ventas.">
            {r.ultimos.map((o) => (
              <tr key={o.referencia} className="is-click" onClick={() => go('pedidos', o.referencia)}>
                <td className="ap-mono">{o.referencia}<small>{fecha(o.creado)}</small></td>
                <td>{o.nombre}<small>{o.ciudad}</small></td>
                <td><Pill estado={o.estado} label={ESTADO_PEDIDO[o.estado] ?? o.estado} /></td>
                <td className="ap-num">{pesos(o.total)}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section className="ap-card">
          <header className="ap-card__head"><h2>Historias por revisar</h2><button type="button" className="ap-link" onClick={() => go('historias')}>Ver todas →</button></header>
          <Table head={['Título', 'Contada por', 'Lugar']} empty="No hay historias por revisar.">
            {r.porRevisar.map((h) => (
              <tr key={h.id} className="is-click" onClick={() => go('historias', h.id)}>
                <td className="ap-strong">{h.titulo}<small>{fecha(h.creada)}{h.archivos ? ` · ${h.archivos} archivo${h.archivos > 1 ? 's' : ''}` : ''}</small></td>
                <td>{h.autor}</td>
                <td>{h.municipio}<small>{h.lugar}</small></td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    </div>
  );
}

/* ───────── Pedidos ───────── */
const PASOS = ['pagado', 'empacando', 'enviado', 'entregado'];
const PASO_LABEL = ['Pagado', 'En empaque', 'En camino', 'Entregado'];

function PedidosView({ run, open, onChange }: { run: Run; open: string | null; onChange: () => void }) {
  const [vista, setVista] = useState<api.VistaPedidos>(open ? 'todos' : 'despachar');
  const [q, setQ] = useState('');
  const [buscar, setBuscar] = useState('');
  const [data, setData] = useState<{ pedidos: api.AdminPedido[]; conteo: api.Conteo } | null>(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState<string | null>(open);
  const load = useCallback(() => {
    setError('');
    run(() => api.pedidos(vista, buscar)).then((d) => d && setData(d)).catch((e) => setError(e.message));
  }, [run, vista, buscar]);
  useEffect(load, [load]);
  const act = async (body: Record<string, unknown>) => {
    await run(() => api.accionPedido(body));
    load();
    onChange();
  };
  const close = useCallback(() => setSel(null), []);
  const c = data?.conteo ?? {};
  const current = data?.pedidos.find((p) => p.referencia === sel) ?? null;
  return (
    <div className="ap-stack">
      <div className="ap-toolbar">
        <Tabs value={vista} onChange={(v) => { setVista(v); setData(null); }} items={[
          { id: 'despachar', label: 'Por despachar', n: (c.pagado ?? 0) + (c.empacando ?? 0) },
          { id: 'camino', label: 'En camino', n: c.enviado ?? 0 },
          { id: 'entregados', label: 'Entregados', n: c.entregado ?? 0 },
          { id: 'pendientes', label: 'Sin pagar', n: (c.pendiente ?? 0) + (c.rechazado ?? 0) + (c.expirado ?? 0) },
          { id: 'todos', label: 'Todos' },
        ]} />
        <form className="ap-search" onSubmit={(e) => { e.preventDefault(); setBuscar(q.trim()); }}>
          <Icon name="search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, nombre, correo o celular" aria-label="Buscar pedidos" />
          {buscar && <button type="button" className="ap-link" onClick={() => { setQ(''); setBuscar(''); }}>Limpiar</button>}
        </form>
      </div>
      {error && <p className="ap-error" role="alert">{error}</p>}
      <section className="ap-card ap-card--flush">
        {!data ? <Loading /> : (
          <Table head={['Código', 'Fecha', 'Cliente', 'Destino', <span className="ap-num" key="c">Cant.</span>, <span className="ap-num" key="t">Total</span>, 'Pago', 'Estado']}
            empty={vista === 'despachar' && !buscar ? 'No hay pedidos por despachar. ¡Al día!' : 'No hay pedidos aquí.'}>
            {data.pedidos.map((p) => (
              <tr key={p.referencia} className={`is-click${p.referencia === sel ? ' is-sel' : ''}`} onClick={() => setSel(p.referencia)}>
                <td className="ap-mono">{p.referencia}</td>
                <td>{fecha(p.creado)}</td>
                <td className="ap-strong">{p.nombre}<small>{p.celular}</small></td>
                <td>{p.ciudad}<small>{p.departamento}</small></td>
                <td className="ap-num">{p.items.reduce((n, i) => n + i.cantidad, 0)}</td>
                <td className="ap-num">{pesos(p.total)}</td>
                <td>{p.metodo ? METODO[p.metodo] ?? p.metodo : '—'}</td>
                <td><Pill estado={p.estado} label={ESTADO_PEDIDO[p.estado] ?? p.estado} /></td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      {current && <PedidoDetalle key={current.referencia} p={current} onAction={act} onClose={close} />}
    </div>
  );
}

function PedidoDetalle({ p, onAction, onClose }: { p: api.AdminPedido; onAction: (body: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  const [transportadora, setTransportadora] = useState(p.transportadora);
  const [guia, setGuia] = useState(p.guia);
  const [nota, setNota] = useState(p.nota);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const paso = PASOS.indexOf(p.estado);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      await onAction({ referencia: p.referencia, ...body });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo.');
    } finally {
      setBusy(false);
    }
  };
  const fechas = [p.pagado, p.empacado, p.enviado, p.entregado];
  const touch = () => setSaved(false);
  return (
    <Drawer title={<span className="ap-mono">{p.referencia}</span>} sub={<>Creado el {fecha(p.creado)} · <Pill estado={p.estado} label={ESTADO_PEDIDO[p.estado] ?? p.estado} /></>} onClose={onClose}>
      {paso >= 0 && (
        <ol className="ap-steps">
          {PASO_LABEL.map((l, i) => (
            <li key={l} className={i < paso ? 'is-done' : i === paso ? 'is-now' : ''}><span>{l}</span><small>{fechas[i] ? fecha(fechas[i]) : ''}</small></li>
          ))}
        </ol>
      )}

      <dl className="ap-dl">
        <dt>Cliente</dt><dd>{p.nombre}</dd>
        <dt>Celular</dt><dd><a href={`https://wa.me/57${p.celular}`} target="_blank" rel="noreferrer">{p.celular} · escribir por WhatsApp ↗</a></dd>
        <dt>Correo</dt><dd><a href={`mailto:${p.correo}`}>{p.correo}</a></dd>
        <dt>Dirección</dt><dd>{p.direccion}<br />{p.ciudad}, {p.departamento}</dd>
        {p.notas && <><dt>Nota del cliente</dt><dd>{p.notas}</dd></>}
        <dt>Pago</dt><dd>{p.metodo ? `${METODO[p.metodo] ?? p.metodo} · ${fecha(p.pagado)}` : '—'}{p.wompi_id && <small>Wompi {p.wompi_id}</small>}</dd>
      </dl>

      <table className="ap-table ap-table--compact">
        <thead><tr><th>Producto</th><th className="ap-num">Cant.</th><th className="ap-num">Valor</th></tr></thead>
        <tbody>
          {p.items.map((i) => <tr key={i.nombre}><td>{i.nombre}</td><td className="ap-num">{i.cantidad}</td><td className="ap-num">{pesos(i.cantidad * i.precio)}</td></tr>)}
          <tr className="is-sub"><td>Envío</td><td /><td className="ap-num">{pesos(p.envio)}</td></tr>
          <tr className="is-total"><td>Total</td><td /><td className="ap-num">{pesos(p.total)}</td></tr>
        </tbody>
      </table>

      {paso >= 0 ? (
        <div className="ap-form">
          <label className="ap-field"><span>Transportadora</span>
            <input value={transportadora} maxLength={60} placeholder="Servientrega, Interrapidísimo…" onChange={(e) => { setTransportadora(e.target.value); touch(); }} />
          </label>
          <label className="ap-field"><span>Número de guía</span>
            <input value={guia} maxLength={60} onChange={(e) => { setGuia(e.target.value); touch(); }} />
          </label>
          <label className="ap-field ap-field--wide"><span>Nota interna <em>solo la ve el equipo</em></span>
            <textarea rows={2} value={nota} maxLength={500} onChange={(e) => { setNota(e.target.value); touch(); }} />
          </label>
        </div>
      ) : (
        <p className="ap-note">{p.estado === 'pendiente' ? `Esperando que pague (vence ${fecha(p.expira)}).` : 'Este pedido no se pagó: no hay nada que despachar.'}</p>
      )}
      {error && <p className="ap-error" role="alert">{error}</p>}

      <div className="ap-actions">
        {p.estado === 'pagado' && <button type="button" className="ap-btn ap-btn--primary" disabled={busy} onClick={() => act({ estado: 'empacando', nota })}>Empezar a empacar</button>}
        {p.estado === 'empacando' && (
          <button type="button" className="ap-btn ap-btn--primary" disabled={busy || !(guia.trim() || transportadora.trim())} onClick={() => act({ estado: 'enviado', transportadora, guia, nota })}>
            Marcar como enviado
          </button>
        )}
        {p.estado === 'enviado' && <button type="button" className="ap-btn ap-btn--primary" disabled={busy} onClick={() => act({ estado: 'entregado', nota })}>Marcar como entregado</button>}
        {paso >= 0 && <button type="button" className="ap-btn" disabled={busy} onClick={() => act({ transportadora, guia, nota })}>{saved ? '✓ Guardado' : 'Guardar datos'}</button>}
        {paso > 0 && <Confirm label="Devolver un paso" sure={`Volver a «${PASO_LABEL[paso - 1]}»`} busy={busy} onYes={() => act({ estado: PASOS[paso - 1] })} />}
        <a className="ap-btn ap-btn--ghost" href={`/tienda/pedido/${p.referencia}`} target="_blank" rel="noreferrer">Ver como el cliente ↗</a>
      </div>
      {p.estado === 'empacando' && !(guia.trim() || transportadora.trim()) && <p className="ap-muted">Para marcarlo enviado, pon la transportadora y la guía.</p>}
    </Drawer>
  );
}

/* ───────── Historias ───────── */
const KINDS = Object.keys(EMBLEM_LABEL) as Emblem[];
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Coordenadas de partida: las que mandó la persona; si no, las del lugar que escribió (si es un punto del mapa, como
 * «Playa de Guachalito» → Guachalito); si no, las de la cabecera del municipio o de algún punto suyo.
 */
function startCoords(h: api.AdminHistoria) {
  if (h.lat !== null && h.lon !== null) return { lat: String(h.lat), lon: String(h.lon), from: 'persona' as const, name: '' };
  const lugar = plain(h.lugar);
  const inTown = CHOCO_POINTS.filter((q) => q.municipio === h.municipio || q.name === h.municipio);
  const exact = lugar ? inTown.find((q) => lugar.includes(plain(q.name))) : undefined;
  const p = exact ?? inTown.find((q) => q.name === h.municipio) ?? inTown.find((q) => q.kind === 'municipio') ?? inTown[0];
  if (!p) return { lat: '', lon: '', from: null, name: '' };
  return { lat: String(p.lat), lon: String(p.lon), from: exact ? ('lugar' as const) : ('municipio' as const), name: p.name };
}

function HistoriasView({ run, open, onChange }: { run: Run; open: string | null; onChange: () => void }) {
  const [estado, setEstado] = useState<api.EstadoHistoria>('pendiente');
  const [data, setData] = useState<{ historias: api.AdminHistoria[]; conteo: api.Conteo } | null>(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState<string | null>(open);
  const load = useCallback(() => {
    setError('');
    run(() => api.historias(estado)).then((d) => d && setData(d)).catch((e) => setError(e.message));
  }, [run, estado]);
  useEffect(load, [load]);
  const act = async (body: Record<string, unknown>) => {
    await run(() => api.accionHistoria(body));
    setSel(null);
    load();
    onChange();
  };
  const close = useCallback(() => setSel(null), []);
  const c = data?.conteo ?? {};
  const current = data?.historias.find((h) => h.id === sel) ?? null;
  return (
    <div className="ap-stack">
      <div className="ap-toolbar">
        <Tabs value={estado} onChange={(v) => { setEstado(v); setData(null); }} items={[
          { id: 'pendiente', label: 'Por revisar', n: c.pendiente ?? 0 },
          { id: 'aprobada', label: 'En el mapa', n: c.aprobada ?? 0 },
          { id: 'rechazada', label: 'Rechazadas', n: c.rechazada ?? 0 },
        ]} />
      </div>
      {error && <p className="ap-error" role="alert">{error}</p>}
      <section className="ap-card ap-card--flush">
        {!data ? <Loading /> : (
          <Table head={['Recibida', 'Título', 'Contada por', 'Lugar', 'Categoría', 'Archivos', 'Estado']}
            empty={estado === 'pendiente' ? 'No hay historias por revisar. ¡Al día!' : 'No hay historias aquí.'}>
            {data.historias.map((h) => (
              <tr key={h.id} className={`is-click${h.id === sel ? ' is-sel' : ''}`} onClick={() => setSel(h.id)}>
                <td>{fecha(h.creada)}</td>
                <td className="ap-strong">{h.titulo}</td>
                <td>{h.autor}{h.contacto && <small>{h.contacto}</small>}</td>
                <td>{h.municipio}<small>{h.lugar}</small></td>
                <td>{EMBLEM_LABEL[h.tipo as Emblem] ?? h.tipo}</td>
                <td>{h.archivos.length ? h.archivos.map((a) => a.tipo).join(', ') : '—'}</td>
                <td><Pill estado={h.estado} label={ESTADO_HISTORIA[h.estado]} /></td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      {current && <HistoriaDetalle key={current.id} h={current} onAction={act} onClose={close} />}
    </div>
  );
}

function HistoriaDetalle({ h, onAction, onClose }: { h: api.AdminHistoria; onAction: (body: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  const start = startCoords(h);
  const [lat, setLat] = useState(start.lat);
  const [lon, setLon] = useState(start.lon);
  const [tipo, setTipo] = useState(h.tipo as Emblem);
  const [titulo, setTitulo] = useState(h.titulo);
  const [relato, setRelato] = useState(h.relato);
  const [nota, setNota] = useState(h.nota);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = async (accion: string) => {
    setBusy(true);
    setError('');
    try {
      await onAction({ id: h.id, accion, lat: Number(lat), lon: Number(lon), tipo, nota, ...(editing ? { titulo, relato } : {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo.');
      setBusy(false);
    }
  };
  const search = encodeURIComponent([h.lugar, h.municipio, 'Chocó, Colombia'].filter(Boolean).join(', '));
  return (
    <Drawer title={editing ? 'Corregir la historia' : h.titulo} sub={<>Recibida el {fecha(h.creada)} · <Pill estado={h.estado} label={ESTADO_HISTORIA[h.estado]} /></>} onClose={onClose}>
      <dl className="ap-dl">
        <dt>Contada por</dt><dd>{h.autor}</dd>
        {h.contacto && <><dt>Contacto</dt><dd>{h.contacto} <small>no se publica</small></dd></>}
        <dt>Lugar</dt><dd>{[h.lugar, h.municipio].filter(Boolean).join(', ')}</dd>
        {h.cuando && <><dt>Cuándo pasó</dt><dd>{h.cuando}</dd></>}
      </dl>

      {editing ? (
        <div className="ap-form">
          <label className="ap-field ap-field--wide"><span>Título</span><input value={titulo} maxLength={90} onChange={(e) => setTitulo(e.target.value)} /></label>
          <label className="ap-field ap-field--wide"><span>Relato</span><textarea rows={9} value={relato} maxLength={6000} onChange={(e) => setRelato(e.target.value)} /></label>
        </div>
      ) : (
        <div className="ap-text">{h.relato.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
      )}

      {h.archivos.length > 0 && (
        <div className="ap-media">
          {h.archivos.map((a) => (
            <figure key={a.pathname}>
              {a.tipo === 'foto' && <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.nombre} /></a>}
              {a.tipo === 'video' && <video src={a.url} controls preload="metadata" />}
              {a.tipo === 'audio' && <audio src={a.url} controls preload="none" />}
              <figcaption>{a.nombre}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <h3 className="ap-h3">Publicación en el mapa</h3>
      <div className="ap-form">
        <label className="ap-field"><span>Latitud</span><input value={lat} inputMode="decimal" placeholder="5.71" onChange={(e) => setLat(e.target.value)} /></label>
        <label className="ap-field"><span>Longitud</span><input value={lon} inputMode="decimal" placeholder="-77.27" onChange={(e) => setLon(e.target.value)} /></label>
        <label className="ap-field"><span>Categoría</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Emblem)}>{KINDS.map((k) => <option key={k} value={k}>{EMBLEM_LABEL[k]}</option>)}</select>
        </label>
        <label className="ap-field ap-field--wide"><span>Nota interna <em>solo la ve el equipo</em></span><input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} /></label>
      </div>
      <p className="ap-note">
        {start.from === 'persona' ? 'La persona compartió su ubicación. '
          : start.from === 'lugar' ? `Coordenadas de ${start.name}, el lugar que escribió: revísalas. `
            : start.from === 'municipio' ? `Coordenadas de ${start.name}, en su municipio: ajústalas al lugar exacto. `
              : 'Sin ubicación: búscala y pon las coordenadas. '}
        <a href={`https://www.google.com/maps/search/${search}`} target="_blank" rel="noreferrer">Buscar en Google Maps ↗</a>
        {lat && lon && <> · <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noreferrer">ver estas coordenadas ↗</a></>}
      </p>
      {error && <p className="ap-error" role="alert">{error}</p>}
      <div className="ap-actions">
        <button type="button" className="ap-btn ap-btn--primary" disabled={busy} onClick={() => act('aprobar')}>{h.estado === 'aprobada' ? 'Guardar cambios' : 'Publicar en el mapa'}</button>
        <button type="button" className="ap-btn" onClick={() => setEditing((v) => !v)}>{editing ? 'Dejar el texto como estaba' : 'Corregir el texto'}</button>
        {h.estado !== 'rechazada' && <Confirm label={h.estado === 'aprobada' ? 'Quitar del mapa' : 'Rechazar'} sure={h.estado === 'aprobada' ? 'Sí, quitarla' : 'Sí, rechazar'} busy={busy} onYes={() => act('rechazar')} />}
        <Confirm label="Borrar" sure="Borrar para siempre" danger busy={busy} onYes={() => act('borrar')} />
      </div>
    </Drawer>
  );
}

/* ───────── Productos ───────── */
function ProductosView({ run }: { run: Run }) {
  const [list, setList] = useState<api.AdminProducto[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    run(api.productos).then((d) => d && setList(d.productos)).catch((e) => setError(e.message));
  }, [run]);
  useEffect(load, [load]);
  if (error) return <p className="ap-error">{error}</p>;
  return (
    <div className="ap-stack">
      <section className="ap-card ap-card--flush">
        {!list ? <Loading /> : (
          <Table head={['Producto', <span className="ap-num" key="p">Precio</span>, <span className="ap-num" key="e">Existencias</span>, <span className="ap-num" key="v">Vendidos</span>, <span className="ap-num" key="a">Apartados</span>, 'A la venta', '']}>
            {list.map((p) => <ProductoFila key={p.sku} p={p} run={run} onSaved={load} />)}
          </Table>
        )}
      </section>
      <p className="ap-muted">Apartados: en pedidos que esperan pago (vuelven a las existencias si no se pagan). Las fotos y los textos del producto están en el código (src/content/stories.ts).</p>
    </div>
  );
}

function ProductoFila({ p, run, onSaved }: { p: api.AdminProducto; run: Run; onSaved: () => void }) {
  const [precio, setPrecio] = useState(String(p.precio));
  const [existencias, setExistencias] = useState(String(p.existencias));
  const [activo, setActivo] = useState(p.activo);
  const [msg, setMsg] = useState('');
  const changed = precio !== String(p.precio) || existencias !== String(p.existencias) || activo !== p.activo;
  const save = async () => {
    try {
      await run(() => api.guardarProducto({ sku: p.sku, precio: Number(precio), existencias: Number(existencias), activo }));
      setMsg('ok');
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo.');
    }
  };
  return (
    <tr>
      <td className="ap-strong">{p.nombre}<small className="ap-mono">{p.sku} · actualizado {fecha(p.actualizado)}</small></td>
      <td className="ap-num">
        <input className="ap-cell-input" value={precio} inputMode="numeric" aria-label="Precio" onChange={(e) => { setPrecio(e.target.value.replace(/\D/g, '')); setMsg(''); }} />
        <small>{Number(precio) ? pesos(Number(precio)) : ''}</small>
      </td>
      <td className="ap-num"><input className="ap-cell-input ap-cell-input--sm" value={existencias} inputMode="numeric" aria-label="Existencias" onChange={(e) => { setExistencias(e.target.value.replace(/\D/g, '')); setMsg(''); }} /></td>
      <td className="ap-num">{p.vendidos}</td>
      <td className="ap-num">{p.apartados}</td>
      <td><label className="ap-switch"><input type="checkbox" checked={activo} onChange={(e) => { setActivo(e.target.checked); setMsg(''); }} /><span>{activo ? 'Sí' : 'No'}</span></label></td>
      <td>
        <button type="button" className="ap-btn ap-btn--primary ap-btn--sm" disabled={!changed} onClick={() => void save()}>Guardar</button>
        {msg === 'ok' && !changed && <small className="ap-ok">✓ Guardado</small>}
        {msg && msg !== 'ok' && <small className="ap-error">{msg}</small>}
      </td>
    </tr>
  );
}
