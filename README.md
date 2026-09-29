# Territorios Vivos · Relatos del Pacífico

Webdoc sobre el recorrido del agua en el Pacífico colombiano: Chorí, el Atrato, Nuquí y
Panguí, con Chachita como guía. **Demo 1 (28/09/2026)**: estructura completa del recorrido,
imágenes reales y animaciones de interfaz.

## Cómo correrlo

```bash
npm install
npm run media        # fotos e ilustraciones → public/media/*.webp (desde ../Contenido)
npm run media:video  # video de portada → public/media/video/ (desde ../Contenido)
npm run dev     # http://localhost:5173
npm run build   # verificación de tipos + build de producción en dist/
```

Despliegue: Vercel (configuración en `vercel.json`). `vercel` crea un despliegue de vista
previa y `vercel --prod` publica a producción.

**Los medios no se versionan.** Fotos, ilustraciones, logos y videos no están en el repositorio:
`public/media/` se genera localmente con los dos comandos anteriores a partir de la carpeta
`Contenido/` (entregada aparte, al lado de este proyecto). Para publicar, el despliegue se hace
desde un equipo que tenga esos medios generados (`vercel --prod`) hasta que se conecte un
almacenamiento externo (R2 u otro).

## Cómo funciona

El webdoc son las **20 páginas del PDF de wireframes, en el mismo orden**, cada una a pantalla
completa y sin encabezado ni pie. Se pasa de página con las flechas laterales, las flechas ←/→
del teclado o deslizando en el celular. Las pestañas de cada estación llevan a su página.

Cada paso de página suena a agua (sintetizado con Web Audio, `src/application/sound.ts`; botón
de silencio abajo a la izquierda) y la página nueva entra con un borde de ola (máscara SVG en
`global.css`). La portada es el video `panguí_v1`, convertido a 1080p/720p sin audio en
`public/media/video/` (ffmpeg-static).

| Ruta | Página |
|---|---|
| `/` | 1 · Portada |
| `/2` … `/20` | Página N del PDF |

## Estructura

```
src/
  content/pages.ts         Las 20 páginas en orden del PDF (qué se muestra en cada una)
  content/journey.ts       Textos y fotos de cada estación y transición
  application/journey.ts   Paso de página: URL, flechas, teclado y deslizamiento
  ui/components/           Media (imágenes), Chrome (rótulos, pestañas, flechas, guía),
                           Sections (cita, corto, galería, receta, silencio, cantos)
  ui/screens/Webdoc.tsx    Dibuja la página actual
  ui/styles/global.css     Estilos, animaciones y versión móvil
scripts/optimize-media.mjs Convierte los originales (465 MB) a WebP (~12 MB)
docs/                      Ampliación de arquitectura a plataforma
```

## Pendiente (no incluido en Demo 1)

- Videos de los cortos y del viche (el reproductor muestra estado "pendiente").
- Voz de Chachita, ambientes y cantos (coordinador de medios en el hito M02).
- Receta: ingredientes y pasos (no se inventan; se esperan de la comunidad).
- Textos finales del scrolly, créditos fotográficos, visor 360° (condicionado).
- Usuarios, historias y administración (ver `docs/arquitectura-plataforma.md`).
- Scrolly real de la página 12 (por ahora se muestra como en el PDF).
- Mapa 3D: fase posterior.
