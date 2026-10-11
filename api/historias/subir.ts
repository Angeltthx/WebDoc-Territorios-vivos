// /api/historias/subir — permiso para que el navegador suba un archivo directo a Vercel Blob (voz, fotos, video).
// El archivo no pasa por esta función (sería muy pesado): aquí solo se revisa qué es, cuánto pesa y quién lo pide.

import { type HandleUploadBody, handleUpload } from '@vercel/blob/client';
import { sql } from '../_lib/db';
import { ipHash, json } from '../_lib/util';

const MAX_MB = 50;
/** Permisos por persona (huella de IP) en una hora: una historia lleva hasta 8 archivos. */
const POR_HORA = 24;
/** Fotos, audios y videos de cualquier formato (los del celular varían: HEIC, 3GP, M4A…). */
const TIPOS = ['image/*', 'audio/*', 'video/*'];

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('historias/') || pathname.includes('..')) throw new Error('Ruta no válida.');
        const huella = ipHash(request);
        const db = sql();
        const [{ n }] = (await db`select count(*)::int as n from subidas where ip_hash = ${huella} and creada > now() - interval '1 hour'`) as { n: number }[];
        if (n >= POR_HORA) throw new Error('Demasiados archivos seguidos. Intenta en un rato.');
        await db`insert into subidas (ip_hash) values (${huella})`;
        return { allowedContentTypes: TIPOS, maximumSizeInBytes: MAX_MB * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo subir.' }, 400);
  }
}
