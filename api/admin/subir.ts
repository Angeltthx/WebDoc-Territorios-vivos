// /api/admin/subir — permiso para que el panel suba una foto de producto directo al almacén (carpeta productos/).
// Solo con la sesión del equipo; solo imágenes, hasta 15 MB.

import { type HandleUploadBody, handleUpload } from '@vercel/blob/client';
import { isAdmin, noSession } from '../_lib/admin.js';
import { json } from '../_lib/util.js';

const MAX_MB = 15;

export async function POST(request: Request) {
  if (!isAdmin(request, { header: false })) return noSession();
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('productos/') || pathname.includes('..')) throw new Error('Ruta no válida.');
        return { allowedContentTypes: ['image/*'], maximumSizeInBytes: MAX_MB * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo subir.' }, 400);
  }
}
