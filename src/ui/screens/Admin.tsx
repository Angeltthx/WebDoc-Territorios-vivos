// Panel del equipo: /admin (sin indexar), con su clave. Con el estilo de las hojas del webdoc: a la izquierda el
// atardecer con el título y el menú; a la derecha, el trabajo.
//   - Resumen: lo que hay por hacer (historias por revisar, pedidos por despachar), las ventas y las existencias.
//   - Historias: leer, ver y oír lo que mandó la gente; ponerle coordenadas y publicarla, rechazarla o borrarla.
//   - Pedidos: los datos de envío y lo que lleva cada uno; avanzarlo (en empaque → enviado con guía → entregado), que
//     el cliente ve en «Consultar mi pedido»; nota interna.
//   - Productos: precio, existencias y si está a la venta.
// Todo pasa por la API (api/admin), que revisa la sesión en cada paso.

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CHOCO_POINTS, EMBLEM_LABEL, type Emblem } from '../../content/choco';
import { pesos } from '../../content/stories';
import * as api from '../../application/admin-api';
import { Sheet } from '../components/Sheet';

type Seccion = 'resumen' | 'historias' | 'pedidos' | 'productos';
const SECCIONES: { id: Seccion; label: string; title: string; intro: string }[] = [
  { id: 'resumen', label: 'Resumen', title: 'Hola, equipo', intro: 'Lo que hay por hacer hoy en Territorios Vivos.' },
  { id: 'historias', label: 'Historias', title: 'Historias de la gente', intro: 'Léelas, ubícalas en el mapa y publícalas, o recházalas.' },
  { id: 'pedidos', label: 'Pedidos', title: 'Pedidos de la tienda', intro: 'Empácalos, envíalos con su guía y márcalos entregados. El cliente ve cada paso.' },
  { id: 'productos', label: 'Productos', title: 'Productos', intro: 'El precio, las existencias y si está a la venta.' },
];

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

const METODO: Record<string, string> = {
  CARD: 'tarjeta', PSE: 'PSE', NEQUI: 'Nequi', BANCOLOMBIA_TRANSFER: 'Botón Bancolombia', BANCOLOMBIA_QR: 'QR Bancolombia',
  DAVIPLATA: 'Daviplata', BANCOLOMBIA_COLLECT: 'corresponsal Bancolombia',
};

const ESTADO_PEDIDO: Record<string, string> = {
  pendiente: 'Esperando pago', pagado: 'Pagado, por empacar', empacando: 'En empaque', enviado: 'En camino', entregado: 'Entregado',
  rechazado: 'Pago rechazado', expirado: 'Venció sin pagar',
};

/** Un error de la API: si la sesión venció, se vuelve a la entrada. */
function useAdminCall(onExpired: () => void) {
  return useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof api.AdminError && e.status === 401) onExpired();
      else throw e;
      return null;
    }
  }, [onExpired]);
}

export default function Admin() {
  const [state, setState] = useState<'cargando' | 'fuera' | 'dentro'>('cargando');
  const [seccion, setSeccion] = useState<Seccion>('resumen');
  const [pendientes, setPendientes] = useState({ historias: 0, pedidos: 0 });

  // El panel no se indexa.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.title = 'Panel del equipo · Territorios Vivos';
    return () => meta.remove();
  }, []);
  useEffect(() => {
    api.session().then((s) => setState(s.ok ? 'dentro' : 'fuera')).catch(() => setState('fuera'));
  }, []);
  const expired = useCallback(() => setState('fuera'), []);
  const run = useAdminCall(expired);
  const refreshCounts = useCallback(() => {
    void run(api.resumen).then((r) => r && setPendientes({
      historias: r.historias.pendiente ?? 0,
      pedidos: (r.pedidos.pagado ?? 0) + (r.pedidos.empacando ?? 0),
    })).catch(() => {});
  }, [run]);
  useEffect(() => {
    if (state === 'dentro') refreshCounts();
  }, [state, seccion, refreshCounts]);

  if (state !== 'dentro') {
    return (
      <Sheet className="sheet--story sheet--admin" eyebrow="Equipo · Territorios Vivos" title="Panel del equipo"
        intro="Para revisar las historias y despachar los pedidos de la tienda." back={{ to: '/', label: 'Ver la web' }} still>
        {state === 'cargando' ? <p className="adm-muted">Un momento…</p> : <Login onIn={() => setState('dentro')} />}
      </Sheet>
    );
  }

  const s = SECCIONES.find((x) => x.id === seccion)!;
  const count: Partial<Record<Seccion, number>> = { historias: pendientes.historias, pedidos: pendientes.pedidos };
  return (
    <Sheet
      className="sheet--story sheet--admin"
      eyebrow="Equipo · Territorios Vivos"
      title={s.title}
      intro={s.intro}
      back={{ to: '/', label: 'Ver la web' }}
      still
      aside={
        <nav className="adm-nav" aria-label="Secciones del panel">
          {SECCIONES.map((x) => (
            <button key={x.id} type="button" className={`adm-nav__item${x.id === seccion ? ' is-on' : ''}`} onClick={() => setSeccion(x.id)} aria-current={x.id === seccion}>
              {x.label}
              {!!count[x.id] && <span className="adm-nav__badge" title="Por hacer">{count[x.id]}</span>}
            </button>
          ))}
          <button type="button" className="adm-nav__out" onClick={() => void api.logout().finally(() => setState('fuera'))}>Salir</button>
        </nav>
      }
    >
      {seccion === 'resumen' && <ResumenView run={run} go={setSeccion} />}
      {seccion === 'historias' && <HistoriasView run={run} onChange={refreshCounts} />}
      {seccion === 'pedidos' && <PedidosView run={run} onChange={refreshCounts} />}
      {seccion === 'productos' && <ProductosView run={run} />}
    </Sheet>
  );
}

type Run = <T>(fn: () => Promise<T>) => Promise<T | null>;

/* ───────── Entrada ───────── */
function Login({ onIn }: { onIn: () => void }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(clave);
      onIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar.');
      setBusy(false);
    }
  };
  return (
    <form className="adm-login" onSubmit={submit}>
      <h3 className="adm-h">Entra con la clave del equipo</h3>
      <label className="story-field">
        <span className="story-field__label">Clave</span>
        <input type="password" required autoFocus autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
      </label>
      {error && <p className="story-error" role="alert">{error}</p>}
      <button type="submit" className="shop-cta" disabled={busy || !clave}>{busy ? 'Entrando…' : 'Entrar'}</button>
      <p className="adm-muted">La sesión dura 12 horas en este navegador.</p>
    </form>
  );
}

/* ───────── Piezas comunes ───────── */
function Tabs<T extends string>({ items, value, onChange }: { items: { id: T; label: string; n?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="adm-tabs" role="tablist">
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} className={`adm-tab${t.id === value ? ' is-on' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}{t.n !== undefined && <span className="adm-tab__n">{t.n}</span>}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="adm-empty">{children}</p>;
}

/** Botón con confirmación en el mismo lugar (sin ventanas del navegador). */
function Confirm({ label, sure, onYes, busy, danger }: { label: string; sure: string; onYes: () => void; busy?: boolean; danger?: boolean }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span className="adm-confirm">
      <button type="button" className={`adm-btn${danger ? ' is-danger' : ' is-primary'}`} disabled={busy} onClick={onYes}>{sure}</button>
      <button type="button" className="adm-btn is-quiet" onClick={() => setAsk(false)}>Cancelar</button>
    </span>
  ) : (
    <button type="button" className={`adm-btn${danger ? ' is-quiet' : ''}`} onClick={() => setAsk(true)}>{label}</button>
  );
}

/* ───────── Resumen ───────── */
function ResumenView({ run, go }: { run: Run; go: (s: Seccion) => void }) {
  const [r, setR] = useState<api.Resumen | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    run(api.resumen).then(setR).catch((e) => setError(e.message));
  }, [run]);
  if (error) return <p className="story-error">{error}</p>;
  if (!r) return <p className="adm-muted">Cargando…</p>;
  const despachar = (r.pedidos.pagado ?? 0) + (r.pedidos.empacando ?? 0);
  return (
    <div className="adm-stack">
      <div className="adm-stats">
        <button type="button" className="adm-stat" onClick={() => go('historias')}>
          <span className="adm-stat__n">{r.historias.pendiente ?? 0}</span>
          <span className="adm-stat__l">historias por revisar</span>
          <span className="adm-stat__s">{r.historias.aprobada ?? 0} publicadas en el mapa</span>
        </button>
        <button type="button" className="adm-stat" onClick={() => go('pedidos')}>
          <span className="adm-stat__n">{despachar}</span>
          <span className="adm-stat__l">pedidos por despachar</span>
          <span className="adm-stat__s">{r.pedidos.enviado ?? 0} en camino · {r.pedidos.entregado ?? 0} entregados</span>
        </button>
        <div className="adm-stat">
          <span className="adm-stat__n adm-stat__n--money">{pesos(r.ventas.mes)}</span>
          <span className="adm-stat__l">vendido en los últimos 30 días</span>
          <span className="adm-stat__s">{pesos(r.ventas.total)} en total · {r.ventas.pedidos} pedidos</span>
        </div>
        {r.productos.map((p) => (
          <button key={p.sku} type="button" className={`adm-stat${p.existencias <= 3 ? ' is-warn' : ''}`} onClick={() => go('productos')}>
            <span className="adm-stat__n">{p.existencias}</span>
            <span className="adm-stat__l">en existencia</span>
            <span className="adm-stat__s">{p.nombre}{!p.activo && ' · no está a la venta'}</span>
          </button>
        ))}
      </div>
      <section>
        <h3 className="adm-h">Últimas ventas</h3>
        {r.ultimos.length === 0 ? <Empty>Todavía no hay ventas.</Empty> : (
          <ul className="adm-list">
            {r.ultimos.map((o) => (
              <li key={o.referencia}>
                <span><strong>{o.nombre}</strong> · {o.ciudad}<small>{o.referencia} · {fecha(o.creado)}</small></span>
                <span className={`adm-pill is-${o.estado}`}>{ESTADO_PEDIDO[o.estado]}</span>
                <span className="adm-money">{pesos(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ───────── Historias ───────── */
const KINDS = Object.keys(EMBLEM_LABEL) as Emblem[];

const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Coordenadas de partida: las que mandó la persona; si no, las del lugar que escribió (si es un punto del mapa, como
 * «Playa de Guachalito» → Guachalito); si no, las de la cabecera del municipio o de algún punto suyo.
 */
function startCoords(h: api.AdminHistoria) {
  if (h.lat !== null && h.lon !== null) return { lat: String(h.lat), lon: String(h.lon), from: 'persona' as const };
  const lugar = plain(h.lugar);
  const inTown = CHOCO_POINTS.filter((q) => q.municipio === h.municipio || q.name === h.municipio);
  const exact = lugar ? inTown.find((q) => lugar.includes(plain(q.name))) : undefined;
  const p = exact ?? inTown.find((q) => q.name === h.municipio) ?? inTown.find((q) => q.kind === 'municipio') ?? inTown[0];
  if (!p) return { lat: '', lon: '', from: null };
  return { lat: String(p.lat), lon: String(p.lon), from: exact ? ('lugar' as const) : ('municipio' as const), name: p.name };
}

function HistoriasView({ run, onChange }: { run: Run; onChange: () => void }) {
  const [estado, setEstado] = useState<api.EstadoHistoria>('pendiente');
  const [data, setData] = useState<{ historias: api.AdminHistoria[]; conteo: api.Conteo } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    run(() => api.historias(estado)).then((d) => d && setData(d)).catch((e) => setError(e.message));
  }, [run, estado]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  const act = async (body: Record<string, unknown>) => {
    await run(() => api.accionHistoria(body));
    load();
    onChange();
  };
  const c = data?.conteo ?? {};
  return (
    <div className="adm-stack">
      <Tabs
        value={estado}
        onChange={setEstado}
        items={[
          { id: 'pendiente', label: 'Por revisar', n: c.pendiente ?? 0 },
          { id: 'aprobada', label: 'En el mapa', n: c.aprobada ?? 0 },
          { id: 'rechazada', label: 'Rechazadas', n: c.rechazada ?? 0 },
        ]}
      />
      {error && <p className="story-error" role="alert">{error}</p>}
      {!data ? <p className="adm-muted">Cargando…</p> : data.historias.length === 0 ? (
        <Empty>{estado === 'pendiente' ? 'No hay historias por revisar. ¡Al día!' : 'No hay historias aquí.'}</Empty>
      ) : data.historias.map((h) => <HistoriaCard key={h.id} h={h} onAction={act} />)}
    </div>
  );
}

function HistoriaCard({ h, onAction }: { h: api.AdminHistoria; onAction: (body: Record<string, unknown>) => Promise<void> }) {
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
    <article className="adm-card">
      <header className="adm-card__head">
        <p className="adm-card__meta">{fecha(h.creada)} · {[h.lugar, h.municipio].filter(Boolean).join(', ')}{h.cuando && ` · ${h.cuando}`}</p>
        {editing
          ? <input className="adm-input adm-input--title" value={titulo} maxLength={90} onChange={(e) => setTitulo(e.target.value)} />
          : <h3 className="adm-card__title">{h.titulo}</h3>}
        <p className="adm-card__meta">Contada por <strong>{h.autor}</strong>{h.contacto && <> · contacto: {h.contacto}</>}</p>
      </header>
      {editing
        ? <textarea className="adm-input adm-input--text" value={relato} maxLength={6000} rows={8} onChange={(e) => setRelato(e.target.value)} />
        : <div className="adm-card__text">{h.relato.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>}
      {h.archivos.length > 0 && (
        <div className="adm-media">
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
      <div className="adm-fields">
        <label className="story-field"><span className="story-field__label">Latitud</span>
          <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="5.71" />
        </label>
        <label className="story-field"><span className="story-field__label">Longitud</span>
          <input value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" placeholder="-77.27" />
        </label>
        <label className="story-field"><span className="story-field__label">Categoría</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Emblem)}>
            {KINDS.map((k) => <option key={k} value={k}>{EMBLEM_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="story-field adm-fields__wide"><span className="story-field__label">Nota interna <em>solo la ve el equipo</em></span>
          <input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
        </label>
        <p className="adm-hint adm-fields__wide">
          {start.from === 'persona' ? 'La persona compartió su ubicación. '
            : start.from === 'lugar' ? `Puse las coordenadas de ${start.name}, el lugar que escribió: revísalas. `
              : start.from === 'municipio' ? `Puse las coordenadas de ${start.name}, en su municipio: ajústalas al lugar exacto. `
                : 'Sin ubicación: búscala y pon las coordenadas. '}
          <a href={`https://www.google.com/maps/search/${search}`} target="_blank" rel="noreferrer">Buscar el lugar en Google Maps</a>
          {lat && lon && <> · <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noreferrer">ver estas coordenadas</a></>}
          {' '}(en Google Maps, clic derecho sobre el sitio → copia las coordenadas)
        </p>
      </div>
      {error && <p className="story-error" role="alert">{error}</p>}
      <div className="adm-actions">
        <button type="button" className="adm-btn is-primary" disabled={busy} onClick={() => act('aprobar')}>
          {h.estado === 'aprobada' ? 'Guardar cambios' : 'Publicar en el mapa'}
        </button>
        <button type="button" className="adm-btn" onClick={() => setEditing((v) => !v)}>{editing ? 'Dejar el texto como estaba' : 'Corregir el texto'}</button>
        {h.estado !== 'rechazada' && (
          <Confirm label={h.estado === 'aprobada' ? 'Quitar del mapa' : 'Rechazar'} sure={h.estado === 'aprobada' ? 'Sí, quitarla' : 'Sí, rechazar'} busy={busy} onYes={() => act('rechazar')} />
        )}
        <Confirm label="Borrar" sure="Sí, borrar para siempre (con sus archivos)" danger busy={busy} onYes={() => act('borrar')} />
      </div>
    </article>
  );
}

/* ───────── Pedidos ───────── */
function PedidosView({ run, onChange }: { run: Run; onChange: () => void }) {
  const [vista, setVista] = useState<api.VistaPedidos>('despachar');
  const [q, setQ] = useState('');
  const [buscar, setBuscar] = useState('');
  const [data, setData] = useState<{ pedidos: api.AdminPedido[]; conteo: api.Conteo } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    run(() => api.pedidos(vista, buscar)).then((d) => d && setData(d)).catch((e) => setError(e.message));
  }, [run, vista, buscar]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  const act = async (body: Record<string, unknown>) => {
    await run(() => api.accionPedido(body));
    load();
    onChange();
  };
  const c = data?.conteo ?? {};
  return (
    <div className="adm-stack">
      <Tabs
        value={vista}
        onChange={setVista}
        items={[
          { id: 'despachar', label: 'Por despachar', n: (c.pagado ?? 0) + (c.empacando ?? 0) },
          { id: 'camino', label: 'En camino', n: c.enviado ?? 0 },
          { id: 'entregados', label: 'Entregados', n: c.entregado ?? 0 },
          { id: 'pendientes', label: 'Sin pagar', n: (c.pendiente ?? 0) + (c.rechazado ?? 0) + (c.expirado ?? 0) },
          { id: 'todos', label: 'Todos' },
        ]}
      />
      <form className="adm-search" onSubmit={(e) => { e.preventDefault(); setBuscar(q.trim()); }}>
        <input className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, nombre, correo o celular" />
        <button type="submit" className="adm-btn">Buscar</button>
        {buscar && <button type="button" className="adm-btn is-quiet" onClick={() => { setQ(''); setBuscar(''); }}>Limpiar</button>}
      </form>
      {error && <p className="story-error" role="alert">{error}</p>}
      {!data ? <p className="adm-muted">Cargando…</p> : data.pedidos.length === 0 ? (
        <Empty>{vista === 'despachar' && !buscar ? 'No hay pedidos por despachar. ¡Al día!' : 'No hay pedidos aquí.'}</Empty>
      ) : data.pedidos.map((p) => <PedidoCard key={p.referencia} p={p} onAction={act} />)}
    </div>
  );
}

const PASOS = ['pagado', 'empacando', 'enviado', 'entregado'];

function PedidoCard({ p, onAction }: { p: api.AdminPedido; onAction: (body: Record<string, unknown>) => Promise<void> }) {
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
  const wa = `https://wa.me/57${p.celular}`;
  return (
    <article className="adm-card">
      <header className="adm-card__head adm-card__head--row">
        <div>
          <p className="adm-card__meta">{p.referencia} · {fecha(p.creado)}</p>
          <h3 className="adm-card__title">{p.nombre}</h3>
        </div>
        <span className={`adm-pill is-${p.estado}`}>{ESTADO_PEDIDO[p.estado] ?? p.estado}</span>
      </header>

      <div className="adm-order">
        <div>
          <p className="adm-label">Enviar a</p>
          <p className="adm-address">{p.direccion}<br />{p.ciudad}, {p.departamento}</p>
          {p.notas && <p className="adm-hint">Nota del cliente: {p.notas}</p>}
          <p className="adm-contact">
            <a href={wa} target="_blank" rel="noreferrer">WhatsApp {p.celular}</a> · <a href={`mailto:${p.correo}`}>{p.correo}</a>
          </p>
        </div>
        <div>
          <p className="adm-label">Lleva</p>
          <ul className="adm-items">
            {p.items.map((i) => <li key={i.nombre}><span>{i.cantidad} × {i.nombre}</span><span>{pesos(i.cantidad * i.precio)}</span></li>)}
            <li className="adm-items__sub"><span>Envío</span><span>{pesos(p.envio)}</span></li>
            <li className="adm-items__total"><span>Total</span><span>{pesos(p.total)}</span></li>
          </ul>
          {p.metodo && <p className="adm-hint">Pagado con {METODO[p.metodo] ?? p.metodo.toLowerCase()} el {fecha(p.pagado)}{p.wompi_id && ` · Wompi ${p.wompi_id}`}</p>}
        </div>
      </div>

      {paso >= 0 && (
        <ol className="adm-steps">
          {['Pagado', 'En empaque', 'En camino', 'Entregado'].map((l, i) => (
            <li key={l} className={i < paso ? 'is-done' : i === paso ? 'is-now' : ''}>
              <span>{l}</span>
              <small>{fecha([p.pagado, p.empacado, p.enviado, p.entregado][i])}</small>
            </li>
          ))}
        </ol>
      )}

      {paso >= 0 && (
        <div className="adm-fields">
          <label className="story-field"><span className="story-field__label">Transportadora</span>
            <input value={transportadora} maxLength={60} placeholder="Servientrega, Interrapidísimo…" onChange={(e) => { setTransportadora(e.target.value); setSaved(false); }} />
          </label>
          <label className="story-field"><span className="story-field__label">Número de guía</span>
            <input value={guia} maxLength={60} onChange={(e) => { setGuia(e.target.value); setSaved(false); }} />
          </label>
          <label className="story-field adm-fields__wide"><span className="story-field__label">Nota interna <em>solo la ve el equipo</em></span>
            <input value={nota} maxLength={500} onChange={(e) => { setNota(e.target.value); setSaved(false); }} />
          </label>
        </div>
      )}
      {paso < 0 && (
        <p className="adm-hint">
          {p.estado === 'pendiente' ? `Esperando que pague (vence ${fecha(p.expira)}).` : 'Este pedido no se pagó: no hay nada que despachar.'}
        </p>
      )}
      {error && <p className="story-error" role="alert">{error}</p>}
      <div className="adm-actions">
        {p.estado === 'pagado' && <button type="button" className="adm-btn is-primary" disabled={busy} onClick={() => act({ estado: 'empacando', nota })}>Empezar a empacar</button>}
        {p.estado === 'empacando' && (
          <button type="button" className="adm-btn is-primary" disabled={busy || !(guia.trim() || transportadora.trim())} onClick={() => act({ estado: 'enviado', transportadora, guia, nota })}
            title={guia.trim() || transportadora.trim() ? '' : 'Pon la transportadora y la guía'}>
            Marcar como enviado
          </button>
        )}
        {p.estado === 'enviado' && <button type="button" className="adm-btn is-primary" disabled={busy} onClick={() => act({ estado: 'entregado', nota })}>Marcar como entregado</button>}
        {paso >= 0 && <button type="button" className="adm-btn" disabled={busy} onClick={() => act({ transportadora, guia, nota })}>{saved ? '✓ Guardado' : 'Guardar datos'}</button>}
        {paso > 0 && (
          <Confirm label="Devolver un paso" sure={`Sí, volver a «${['Pagado', 'En empaque', 'En camino'][paso - 1]}»`} busy={busy} onYes={() => act({ estado: PASOS[paso - 1] })} />
        )}
        <a className="adm-btn is-quiet" href={`/tienda/pedido/${p.referencia}`} target="_blank" rel="noreferrer">Ver como el cliente</a>
      </div>
    </article>
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
  if (error) return <p className="story-error">{error}</p>;
  if (!list) return <p className="adm-muted">Cargando…</p>;
  return (
    <div className="adm-stack">
      {list.map((p) => <ProductoRow key={p.sku} p={p} run={run} onSaved={load} />)}
      <p className="adm-hint">Las fotos y los textos del producto están en el código (src/content/stories.ts); aquí se cambia lo que cobra la tienda.</p>
    </div>
  );
}

function ProductoRow({ p, run, onSaved }: { p: api.AdminProducto; run: Run; onSaved: () => void }) {
  const [precio, setPrecio] = useState(String(p.precio));
  const [existencias, setExistencias] = useState(String(p.existencias));
  const [activo, setActivo] = useState(p.activo);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const changed = precio !== String(p.precio) || existencias !== String(p.existencias) || activo !== p.activo;
  const save = async () => {
    setError('');
    try {
      await run(() => api.guardarProducto({ sku: p.sku, precio: Number(precio), existencias: Number(existencias), activo }));
      setMsg('✓ Guardado');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo.');
    }
  };
  return (
    <article className="adm-card">
      <header className="adm-card__head adm-card__head--row">
        <div>
          <p className="adm-card__meta">{p.sku} · actualizado {fecha(p.actualizado)}</p>
          <h3 className="adm-card__title">{p.nombre}</h3>
        </div>
        <span className={`adm-pill ${activo ? 'is-entregado' : 'is-expirado'}`}>{activo ? 'A la venta' : 'Oculto'}</span>
      </header>
      <div className="adm-fields">
        <label className="story-field"><span className="story-field__label">Precio <em>en pesos, sin puntos</em></span>
          <input value={precio} inputMode="numeric" onChange={(e) => { setPrecio(e.target.value.replace(/\D/g, '')); setMsg(''); }} />
        </label>
        <label className="story-field"><span className="story-field__label">Existencias <em>disponibles para vender</em></span>
          <input value={existencias} inputMode="numeric" onChange={(e) => { setExistencias(e.target.value.replace(/\D/g, '')); setMsg(''); }} />
        </label>
        <label className="story-check adm-fields__wide">
          <input type="checkbox" checked={activo} onChange={(e) => { setActivo(e.target.checked); setMsg(''); }} />
          <span>A la venta en la tienda</span>
        </label>
        <p className="adm-hint adm-fields__wide">
          {p.vendidos} vendidos{p.apartados > 0 && ` · ${p.apartados} apartados en pedidos que esperan pago (vuelven si no se pagan)`}.
          {Number(precio) > 0 && ` Se ve como ${pesos(Number(precio))}.`}
        </p>
      </div>
      {error && <p className="story-error" role="alert">{error}</p>}
      <div className="adm-actions">
        <button type="button" className="adm-btn is-primary" disabled={!changed} onClick={() => void save()}>Guardar</button>
        {msg && !changed && <span className="adm-ok">{msg}</span>}
      </div>
    </article>
  );
}
