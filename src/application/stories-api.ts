// Enviar una historia y leer las aprobadas (ver api/historias). Los archivos suben directo del navegador a Vercel Blob
// (almacén privado), con permiso de /api/historias/subir; la historia se envía después, con la lista de archivos.

import type { Emblem } from '../content/choco';

export interface StoryFile {
  pathname: string;
  tipo: 'foto' | 'video' | 'audio';
  nombre: string;
  bytes: number;
  /** Enlace firmado (solo en las historias que vienen del servidor; vence en unas horas). */
  url?: string;
}

export interface PublishedStory {
  id: string;
  titulo: string;
  relato: string;
  cuando: string;
  tipo: Emblem;
  municipio: string;
  lugar: string;
  lat: number;
  lon: number;
  autor: string;
  archivos: StoryFile[];
}

/** Nombre de archivo sin tildes, espacios ni símbolos (la ruta en el almacén). */
const safe = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'archivo';

/** Sube un archivo; `onProgress` va de 0 a 1. */
export async function uploadFile(file: File, tipo: StoryFile['tipo'], folder: string, onProgress: (p: number) => void): Promise<StoryFile> {
  const { upload } = await import('@vercel/blob/client');
  const blob = await upload(`historias/${folder}/${safe(file.name)}`, file, {
    access: 'private',
    handleUploadUrl: '/api/historias/subir',
    contentType: file.type.split(';')[0] || undefined,
    multipart: file.size > 8e6,
    onUploadProgress: (e) => onProgress(e.percentage / 100),
  });
  return { pathname: blob.pathname, tipo, nombre: file.name, bytes: file.size };
}

export interface NewStory {
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
  consentimiento: boolean;
  archivos: StoryFile[];
  /** Campo trampa (vacío para las personas). */
  web: string;
}

export async function sendStory(story: NewStory) {
  const res = await fetch('/api/historias', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(story) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar. Revisa tu conexión e intenta otra vez.');
}

/** Las historias aprobadas (para el mapa). Sin conexión o sin servidor (p. ej. con `vite` solo), ninguna. */
export async function fetchStories(): Promise<PublishedStory[]> {
  try {
    const res = await fetch('/api/historias');
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return [];
    return ((await res.json()) as { historias: PublishedStory[] }).historias;
  } catch {
    return [];
  }
}
