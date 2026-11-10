# CLAUDE.md

Guía para Claude Code en el webdoc **Territorios Vivos · Relatos del Pacífico** (territoriosvivos.com.co). Lee también
`README.md` (cómo correrlo y cómo funciona) y `docs/` (admin, historias, tienda, arquitectura).

## Proyecto

- `C:\dev\webdoc` NO es repositorio: guarda el material de la clienta (`Contenido/`, fotos, videos, PDF). El código está
  en `web/`: React 19, Vite, react-router, three. API en `api/` con Neon y Vercel Blob.
- Proyecto hermano: `C:\dev\webar` (repo `WebApp-Territorios-vivos-AR`, Netlify, `ar.territoriosvivos.com.co`). Desde
  noviembre de 2026 usa las letras, el dorado, los botones, el menú y el ícono de este webdoc: si cambian aquí, conviene
  llevarlos allá (ver su `CLAUDE.md`).
- Todo en español: textos, comentarios, commits, títulos y descripciones de PR.

## Reglas de trabajo

- Cada ronda en su rama desde `main`; se sube y se le da al usuario el enlace del PR
  (`https://github.com/Angeltthx/WebDoc-Territorios-vivos/pull/new/<rama>`) con título y descripción en español. El
  usuario crea el PR y hace el merge (`gh` usa una cuenta sin permisos; `git push` sí funciona).
- **Nunca desplegar a producción ni hacer merge sin que el usuario lo pida.** El despliegue es manual: `vercel --prod`
  desde `web/` (proyecto `web`). El primer intento a veces falla con «Not authorized»; reintentar funciona.
- Para desplegar solo una parte, se arma una rama temporal desde el commit que está en producción y se le aplica
  (cherry-pick) solo lo pedido (así se publicó el ícono el 09/11/2026).
- No borrar despliegues viejos con `vercel rm`: se le da el comando al usuario.
- **Los medios no se versionan** (`public/media/` se genera desde `../Contenido` con los `npm run media:*`). Producción
  solo los tiene si se despliega desde un equipo que los generó.
- No subir `.agents/`, `.claude/`, `.codex/` ni `skills-lock.json`.
- El equipo tiene poca memoria: no dejar el servidor de desarrollo corriendo sin necesidad y apagarlo al terminar.

## Probar sin teléfono

- El sitio pide clave (`src/ui/screens/Gate.tsx`); se salta con `localStorage['tv-acceso']` = el `HASH` de ese archivo.
- La dirección refleja la página: `/` es la bienvenida y `/N` la página N (por ejemplo, `/18` es el tráiler de la
  estación 4 y `/24` el mapa). `/costa-k7q4x` abre el mapa suelto; `/cuenta-tu-historia` y `/tienda`, sus hojas.
- No hay Playwright ni Puppeteer: las capturas se toman con Chrome sin ventana por CDP con un script propio (Node 22 trae
  `WebSocket`). En Git Bash, `MSYS_NO_PATHCONV=1` para que no convierta las rutas que empiezan por `/`.
- La laptop del usuario tiene «reducir movimiento» activado: una regla global acorta todas las animaciones; lo que debe
  moverse igual lleva su excepción en `@media (prefers-reduced-motion: reduce)`.
- Con el zoom del navegador distinto de 100 %, las páginas miden fracciones de píxel: el recorrido usa el alto exacto
  (`pageHeight` en `src/application/journey.ts`), no `clientHeight`, o se asoma una franja de la página anterior.

## Piezas que conviene conocer

- **Menú** (`SiteMenu` en `src/ui/components/Chrome.tsx`, contenido en `src/content/site.ts`): una columna con un río
  que pasa por todas las paradas (bolitas con foto, partes plegables como afluentes). El agua corre con el scroll y, al
  escoger algo, viaja hasta esa parada antes de navegar. Lo de fuera del recorrido lleva una línea (`hint`) que dice para
  qué sirve.
- **Paso a paso con luz** (`src/ui/components/Coach.tsx`): alumbra partes reales de una vista con una tarjeta al lado.
  Lo usan el mapa (planeta → el Chocó; costa → filtro, pueblos, herramientas, «Ver el planeta») y «Cuenta tu historia».
  Se ve una vez por navegador (`mapa-tutorial-planeta`, `mapa-tutorial-costa`, `historia-recorrido-visto`).
- **Hojas** (`src/ui/components/Sheet.tsx`): la tienda y «Cuenta tu historia». Abiertas por su dirección, «Volver al
  recorrido» regresa a la página de donde se vino; abiertas desde el mapa, «Volver al mapa».
- **Tráileres con sinopsis** (`FramedVideo` en `Sections.tsx`, `Synopsis` en `InfoDialog.tsx`): en pantallas anchas el
  video grande a la izquierda y la sinopsis en una columna al lado; apilado en las angostas. Un video de YouTube puede
  llevar su `poster` (el tráiler de Panguí usa la miniatura de YouTube).
- **Ícono**: `public/favicon.ico`, `icon-192/512.png` y `apple-touch-icon.png`, hechos con el logo de
  `../Contenido/Icono` sobre un cuadro claro. webar usa el mismo.
