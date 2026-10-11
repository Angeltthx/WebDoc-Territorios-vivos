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
