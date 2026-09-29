import type { CSSProperties } from 'react';
import type { Photo } from '../../domain/types';
import manifest from '../../content/media-manifest.json';

const SIZES: Record<string, number[]> = manifest;

/** Proporción ancho/alto real de una imagen (1.5 si aún no está en el índice). */
export const aspectOf = (id: string) => {
  const d = SIZES[id];
  return d ? d[0] / d[1] : 1.5;
};

// Las ilustraciones (PNG con transparencia) se publican en un solo tamaño;
// las fotografías tienen versión grande y pequeña (-sm). Ver scripts/optimize-media.mjs.
const SINGLE_SIZE = /(circulo|ballena|tortuga|casas-embera|cascadas|mariposas|logo|cobranding|nuqui-choco|titulo)/;

export const mediaUrl = (id: string, small = false) =>
  `/media/${id}${small && !SINGLE_SIZE.test(id) ? '-sm' : ''}.webp`;

interface ImgProps {
  photo: Photo;
  className?: string;
  /** Para imágenes de fondo o héroes: carga prioritaria y versión grande. */
  priority?: boolean;
  sizes?: string;
  style?: CSSProperties;
}

export function Img({ photo, className, priority, sizes = '100vw', style }: ImgProps) {
  const single = SINGLE_SIZE.test(photo.id);
  return (
    <img
      className={className}
      src={mediaUrl(photo.id, !priority)}
      srcSet={single ? undefined : `${mediaUrl(photo.id, true)} 900w, ${mediaUrl(photo.id)} 2200w`}
      sizes={single ? undefined : sizes}
      alt={photo.alt}
      width={SIZES[photo.id]?.[0]}
      height={SIZES[photo.id]?.[1]}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      style={{ objectPosition: photo.focus, ...style }}
      draggable={false}
    />
  );
}

/** Fondo a pantalla completa con un zoom lento y una capa de color para asegurar contraste. */
export function Backdrop({ photo, tint = 'rgba(8,20,16,.45)', blur = false }: { photo: Photo; tint?: string; blur?: boolean }) {
  return (
    <div
      className={`backdrop${blur ? ' backdrop--blur' : ''}`}
      aria-hidden="true"
      style={{ backgroundImage: `url(${mediaUrl(photo.id, true)})`, backgroundPosition: photo.focus ?? 'center' }}
    >
      <Img photo={photo} priority className="backdrop__img" />
      <div className="backdrop__tint" style={{ background: tint }} />
    </div>
  );
}

export function Illustration({ id, className, alt = '' }: { id: string; className?: string; alt?: string }) {
  return <img className={className} src={mediaUrl(id)} alt={alt} loading="lazy" decoding="async" draggable={false} />;
}
