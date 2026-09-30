# Territorios Vivos · Relatos del Pacífico

Webdoc sobre el recorrido del agua en el Pacífico colombiano: Chorí, el Atrato, Nuquí y
Panguí, con Chachita como guía. **Demo 1 (28/09/2026)**: estructura completa del recorrido,
imágenes reales y animaciones de interfaz.

## Cómo correrlo

```bash
npm install
npm run media        # fotos e ilustraciones → public/media/*.webp + índice de medidas (desde ../Contenido)
npm run media:video  # video de portada → public/media/video/ (desde ../Contenido)
npm run media:audio  # olas de transición → public/media/audio/ (desde ../Contenido)
npm run media:360    # video 360 del manglar → HLS en 3 calidades en public/media/360/ (varios minutos)
npm run media:transiciones  # videos de transición (Contenido/Transiciones) → 1080p y 720p en public/media/transiciones/
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

El webdoc es un **recorrido vertical**: las páginas de los wireframes van en orden, cada una
ocupa la pantalla y, al desplazarse hacia abajo, la siguiente sube sobre la anterior con un
borde de dos olas, espuma y un velo de agua que se disuelve al asentarse (animación ligada al
scroll; donde el navegador no la admite, entra con borde recto). Al soltar, la página se acomoda
con suavidad: si solo te pasaste un poco vuelve a su lugar; desde un 25 % de pantalla avanza.
Flechas, AvPág y espacio avanzan una página.

- Menú fijo (arriba a la derecha) y redes sociales siempre visibles. Opciones y enlaces en
  `src/content/site.ts`; las que aún no tienen destino se muestran como "Próximamente".
- Pestañas de cada estación: Pensamiento, Historia, Galería… llevan a su página.
- La URL refleja la página visible (`/`, `/2` … `/22`) para compartir un punto exacto.
- Sonido con grabaciones reales (`src/application/sound.ts`, botón para silenciar junto a las
  redes): una ola corta en cada cambio de página (`ola-1/2/3.mp3`, alternándose; `?ola=N` fija
  una) y ambiente de marea en bucle solo en Marea alta y Marea baja (`marea-alta.mp3`,
  `marea-baja.mp3`). Empieza tras el primer clic, toque o tecla.
- Galerías con las fotos completas (proporciones reales en `src/content/media-manifest.json`,
  generado con `npm run media:manifest`), flechas ← → para pasar de foto y botón "Ver galería
  completa" con control de tamaño.
- **Experiencia 360 del manglar** (página 360 · Cantos → "Entrar al manglar 360°"): video 360 en
  una esfera (three.js) con streaming HLS en 3 calidades (4K, 2880 y 1920; en celular hasta 2880).
  Arrastrar para mirar, rueda o pellizco para acercar, flechas del teclado y, en celular, mover el
  teléfono (giroscopio). Corre en bucle con su sonido. Se carga solo al abrirla
  (`src/ui/components/Panorama360.tsx`).
- La portada es el video
  `panguí_v1` (1080p/720p sin audio en `public/media/video/`), que se pausa al quedar
  cubierto y continúa desde el mismo punto al volver.

## Estructura

```
src/
  content/pages.ts         Las páginas en orden (qué se muestra en cada una)
  content/journey.ts       Textos y fotos de cada estación y transición
  content/site.ts          Menú y redes sociales
  application/journey.ts   Recorrido vertical: página activa, URL y desplazamiento a una página
  ui/components/           Media (imágenes), Chrome (rótulos, pestañas, guía, menú, redes),
                           Sections (cita, corto, galería, receta, silencio, cantos)
  ui/screens/Webdoc.tsx    Dibuja la página actual
  ui/styles/global.css     Estilos, animaciones y versión móvil
scripts/optimize-media.mjs Convierte los originales (465 MB) a WebP (~12 MB)
docs/                      Ampliación de arquitectura a plataforma
```

## Pendiente (no incluido en Demo 1)

- Videos de las secciones Historia, Video canción y Viche (siguiente rama; el reproductor
  muestra estado "pendiente").
- Transición después de la portada y nueva frase de la transición 1 (del Canva del cliente).
- Enlaces de YouTube, Instagram y TikTok; destinos de Equipo, Making of, Blog, Llévate Nuquí,
  Vive y Reserva y Cuéntanos tu historia.
- Voz de Chachita, ambientes y cantos (coordinador de medios en el hito M02).
- Receta: ingredientes y pasos (no se inventan; se esperan de la comunidad).
- Textos finales del scrolly, créditos fotográficos, visor 360° (condicionado).
- Usuarios, historias y administración (ver `docs/arquitectura-plataforma.md`).
- Scrolly real de la página 12 (por ahora se muestra como en el PDF).
- Mapa 3D: fase posterior.
