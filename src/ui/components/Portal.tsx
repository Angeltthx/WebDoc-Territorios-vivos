import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Monta ventanas (visor de fotos, galería completa, experiencia 360) directamente en <body>,
 * fuera del recorrido: así no se desplazan con él ni quedan bloqueadas cuando su página
 * deja de ser la visible.
 */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
