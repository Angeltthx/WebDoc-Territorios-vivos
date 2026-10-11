// Revisión de historias (para el equipo): /admin-historias, con la clave del equipo (ADMIN_TOKEN en Vercel).
//
// Cada historia llega pendiente. Aquí se lee, se oyen y se ven sus archivos, se le ponen (o corrigen) las coordenadas
// y el tipo, y se aprueba —entonces sale en el mapa, en su lugar— o se rechaza. «Borrar» la elimina del todo con sus
// archivos (por ejemplo, si quien la contó pide retirarla).

import { useCallback, useEffect, useState } from 'react';
import { CHOCO_POINTS, EMBLEM_LABEL, type Emblem } from '../../content/choco';
import type { StoryFile } from '../../application/stories-api';

type Estado = 'pendiente' | 'aprobada' | 'rechazada';
interface Row {
  id: string;
  creada: string;
  estado: Estado;
  titulo: string;
  relato: string;
  cuando: string;
  tipo: Emblem;
  municipio: string;
  lugar: string;
  lat: number | null;
  lon: number | null;
  autor: string;
  contacto: string;
  archivos: StoryFile[];
  nota: string;
}

const KEY = 'admin-historias-clave';
const TABS: { id: Estado; label: string }[] = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'aprobada', label: 'Aprobadas' },
  { id: 'rechazada', label: 'Rechazadas' },
];
const KINDS = Object.keys(EMBLEM_LABEL) as Emblem[];

/** Coordenadas de partida: las que mandó la persona o, si no, las del municipio (si está entre los puntos del mapa). */
function startCoords(h: Row) {
  if (h.lat !== null && h.lon !== null) return { lat: String(h.lat), lon: String(h.lon) };
  const p = CHOCO_POINTS.find((q) => q.name === h.municipio) ?? CHOCO_POINTS.find((q) => q.municipio === h.municipio && q.kind === 'municipio');
  return p ? { lat: String(p.lat), lon: String(p.lon) } : { lat: '', lon: '' };
}

async function call(key: string, init?: { estado?: Estado; body?: unknown }) {
  const url = init?.body ? '/api/admin/historias' : `/api/admin/historias?estado=${init?.estado ?? 'pendiente'}`;
  const res = await fetch(url, {
    method: init?.body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: 'El servidor no respondió (¿corre con `vercel dev`?).' }));
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Error'), { status: res.status });
  return data;
}

function Story({ h, onAction }: { h: Row; onAction: (body: Record<string, unknown>) => Promise<void> }) {
  const start = startCoords(h);
  const [lat, setLat] = useState(start.lat);
  const [lon, setLon] = useState(start.lon);
  const [tipo, setTipo] = useState<Emblem>(h.tipo);
  const [nota, setNota] = useState(h.nota);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const act = async (accion: string) => {
    setBusy(true);
    try {
      await onAction({ id: h.id, accion, lat: Number(lat), lon: Number(lon), tipo, nota });
    } finally {
      setBusy(false);
      setSure(false);
    }
  };
  const search = encodeURIComponent([h.lugar, h.municipio, 'Chocó, Colombia'].filter(Boolean).join(', '));
  return (
    <article className="admin-story">
      <header>
        <p className="admin-story__meta">{new Date(h.creada).toLocaleString('es-CO')} · {EMBLEM_LABEL[h.tipo]} · {[h.lugar, h.municipio].filter(Boolean).join(', ')}{h.cuando && ` · ${h.cuando}`}</p>
        <h2>{h.titulo}</h2>
        <p className="admin-story__meta">Por <strong>{h.autor}</strong>{h.contacto && <> · contacto: {h.contacto}</>}</p>
      </header>
      <div className="admin-story__text">{h.relato.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
      {h.archivos.length > 0 && (
        <div className="admin-story__media">
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
      <div className="admin-story__form">
        <label>Latitud<input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="5.71" /></label>
        <label>Longitud<input value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" placeholder="-77.27" /></label>
        <label>Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Emblem)}>
            {KINDS.map((k) => <option key={k} value={k}>{EMBLEM_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="admin-story__wide">Nota interna<input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} /></label>
        <p className="admin-story__hint">
          {h.lat === null ? 'La persona no compartió su ubicación: ' : 'Ubicación compartida por la persona. '}
          <a href={`https://www.google.com/maps/search/${search}`} target="_blank" rel="noreferrer">buscar el lugar en Google Maps</a>
          {lat && lon && <> · <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noreferrer">ver estas coordenadas</a></>}
        </p>
      </div>
      <div className="admin-story__actions">
        {h.estado !== 'aprobada' && <button type="button" className="is-primary" disabled={busy} onClick={() => act('aprobar')}>Aprobar y publicar</button>}
        {h.estado === 'aprobada' && <button type="button" disabled={busy} onClick={() => act('aprobar')}>Guardar cambios</button>}
        {h.estado !== 'rechazada' && <button type="button" disabled={busy} onClick={() => act('rechazar')}>{h.estado === 'aprobada' ? 'Quitar del mapa' : 'Rechazar'}</button>}
        {sure
          ? <button type="button" className="is-danger" disabled={busy} onClick={() => act('borrar')}>Sí, borrar para siempre</button>
          : <button type="button" className="is-quiet" onClick={() => setSure(true)}>Borrar</button>}
      </div>
    </article>
  );
}

export default function AdminStories() {
  const [key, setKey] = useState(() => sessionStorage.getItem(KEY) ?? '');
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<Estado>('pendiente');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!key) return;
    setError('');
    try {
      const data = await call(key, { estado: tab });
      setRows(data.historias);
      setPending(data.pendientes);
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        sessionStorage.removeItem(KEY);
        setKey('');
      }
      setError((e as Error).message);
    }
  }, [key, tab]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!key) {
    return (
      <main className="admin">
        <form className="admin-login" onSubmit={(e) => { e.preventDefault(); sessionStorage.setItem(KEY, draft); setKey(draft); }}>
          <p className="eyebrow">Territorios Vivos</p>
          <h1>Revisión de historias</h1>
          <label>Clave del equipo<input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus autoComplete="current-password" /></label>
          {error && <p className="admin-error">{error}</p>}
          <button type="submit" className="is-primary">Entrar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <header className="admin-head">
        <div>
          <p className="eyebrow">Territorios Vivos</p>
          <h1>Revisión de historias</h1>
        </div>
        <button type="button" className="is-quiet" onClick={() => { sessionStorage.removeItem(KEY); setKey(''); }}>Salir</button>
      </header>
      <nav className="admin-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={t.id === tab ? 'is-on' : ''} onClick={() => { setRows(null); setTab(t.id); }}>
            {t.label}{t.id === 'pendiente' && pending > 0 && <span>{pending}</span>}
          </button>
        ))}
      </nav>
      {error && <p className="admin-error">{error}</p>}
      {rows === null ? <p className="admin-empty">Cargando…</p>
        : rows.length === 0 ? <p className="admin-empty">No hay historias aquí.</p>
          : rows.map((h) => (
            <Story
              key={h.id}
              h={h}
              onAction={async (body) => {
                try {
                  await call(key, { body });
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          ))}
    </main>
  );
}
