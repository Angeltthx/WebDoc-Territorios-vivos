// Base de datos de las historias (Neon Postgres, conectada desde el Marketplace de Vercel: DATABASE_URL).
//
// Una historia llega «pendiente»; el equipo la revisa y la aprueba (entonces sale en el mapa) o la rechaza. La
// revisión (/admin-historias) está en la rama revision-historias; mientras tanto, se puede aprobar desde la consola
// de Neon (ver docs/historias.md). Los archivos (voz, fotos, video) van a Vercel Blob, en un almacén privado: solo se
// ven con un enlace firmado que da el servidor, y solo los de historias aprobadas.

import { neon } from '@neondatabase/serverless';

let client: ReturnType<typeof neon> | null = null;
/** La conexión se abre la primera vez que se usa (no al cargar el módulo). */
export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL (conecta la base de datos Neon al proyecto en Vercel).');
    client = neon(url);
  }
  return client;
}

/** Tablas e índices (idempotente: se puede correr cuantas veces se quiera). Ver scripts/db-setup.mjs. */
export const SCHEMA = [
  `create table if not exists historias (
    id uuid primary key default gen_random_uuid(),
    creada timestamptz not null default now(),
    estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
    titulo text not null,
    relato text not null,
    cuando text not null default '',
    tipo text not null,
    municipio text not null,
    lugar text not null default '',
    lat double precision,
    lon double precision,
    autor text not null,
    contacto text not null default '',
    archivos jsonb not null default '[]',
    ip_hash text not null,
    revisada timestamptz,
    nota text not null default ''
  )`,
  `create index if not exists historias_estado on historias (estado, creada desc)`,
  `create index if not exists historias_ip on historias (ip_hash, creada desc)`,
  // Permisos de subida entregados (para frenar a quien quiera llenar el almacén).
  `create table if not exists subidas (ip_hash text not null, creada timestamptz not null default now())`,
  `create index if not exists subidas_ip on subidas (ip_hash, creada desc)`,

  // ── Tienda ── El catálogo (precio y existencias: lo que manda al cobrar; las fotos y textos van en el código),
  // los pedidos y lo que lleva cada uno. Ver docs/tienda.md.
  `create table if not exists productos (
    sku text primary key,
    nombre text not null,
    precio integer not null check (precio > 0),
    existencias integer not null default 0,
    activo boolean not null default true,
    actualizado timestamptz not null default now()
  )`,
  `create table if not exists pedidos (
    id uuid primary key default gen_random_uuid(),
    referencia text not null unique,
    creado timestamptz not null default now(),
    estado text not null default 'pendiente'
      check (estado in ('pendiente', 'pagado', 'rechazado', 'expirado', 'empacando', 'enviado', 'entregado')),
    expira timestamptz not null,
    nombre text not null,
    correo text not null,
    celular text not null,
    direccion text not null,
    ciudad text not null,
    departamento text not null,
    notas text not null default '',
    subtotal integer not null,
    envio integer not null,
    total integer not null,
    wompi_id text,
    wompi_estado text,
    metodo text,
    pagado timestamptz,
    guia text not null default '',
    nota text not null default '',
    ip_hash text not null
  )`,
  `create index if not exists pedidos_estado on pedidos (estado, creado desc)`,
  `create index if not exists pedidos_ip on pedidos (ip_hash, creado desc)`,
  `create table if not exists pedido_items (
    pedido_id uuid not null references pedidos (id) on delete cascade,
    sku text not null references productos (sku),
    nombre text not null,
    cantidad integer not null check (cantidad > 0),
    precio integer not null
  )`,
  `create index if not exists pedido_items_pedido on pedido_items (pedido_id)`,
  // Seguimiento: el estado «empacando» y la fecha de cada paso, que se anota sola cuando el equipo cambia el estado
  // (pagado → empacando → enviado → entregado), más la transportadora y la guía para que la persona rastree el envío.
  `alter table pedidos add column if not exists transportadora text not null default ''`,
  `alter table pedidos add column if not exists empacado timestamptz`,
  `alter table pedidos add column if not exists enviado timestamptz`,
  `alter table pedidos add column if not exists entregado timestamptz`,
  `alter table pedidos drop constraint if exists pedidos_estado_check`,
  `alter table pedidos add constraint pedidos_estado_check
    check (estado in ('pendiente', 'pagado', 'rechazado', 'expirado', 'empacando', 'enviado', 'entregado'))`,
  `create or replace function pedidos_fechas() returns trigger language plpgsql as $$
    begin
      if new.estado is distinct from old.estado then
        if new.estado = 'pagado' then new.pagado := coalesce(new.pagado, now()); end if;
        if new.estado = 'empacando' then new.empacado := coalesce(new.empacado, now()); end if;
        if new.estado = 'enviado' then new.enviado := coalesce(new.enviado, now()); end if;
        if new.estado = 'entregado' then new.entregado := coalesce(new.entregado, now()); end if;
      end if;
      return new;
    end $$`,
  `drop trigger if exists pedidos_fechas on pedidos`,
  `create trigger pedidos_fechas before update of estado on pedidos for each row execute function pedidos_fechas()`,
  // ── Panel del equipo ── Intentos de entrar (para frenar a quien quiera adivinar la clave). Ver api/_lib/admin.ts.
  `create table if not exists admin_intentos (ip_hash text not null, creada timestamptz not null default now(), ok boolean not null)`,
  `create index if not exists admin_intentos_ip on admin_intentos (ip_hash, creada desc)`,
  // El póster (datos de prueba): solo la primera vez; después el precio y las existencias se cambian en la base.
  `insert into productos (sku, nombre, precio, existencias)
    values ('poster-mapa-pliego', 'Póster del mapa de Territorios Vivos (pliego)', 85000, 10)
    on conflict (sku) do nothing`,
];

/** Un archivo adjunto, como se guarda en la historia. */
export interface Archivo {
  pathname: string;
  tipo: 'foto' | 'video' | 'audio';
  nombre: string;
  bytes: number;
}

export interface Historia {
  id: string;
  creada: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
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
  archivos: Archivo[];
  revisada: string | null;
  nota: string;
}
