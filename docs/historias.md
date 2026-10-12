# «Tu historia»: cómo se guardan las historias

## En una línea

El formulario sube los archivos a un almacén privado (Vercel Blob), luego guarda la historia en la base de datos
(Neon Postgres) como **pendiente**. Las que el equipo marque como **aprobadas** aparecen en el mapa, en su lugar.

```
Navegador (formulario)
  │ 1. pide permiso para subir cada archivo ──► /api/historias/subir ──► (revisa ruta, tipo, peso, límite por hora)
  │ 2. sube el archivo DIRECTO al almacén ────► Vercel Blob (privado), carpeta historias/<id-del-envío>/
  │ 3. envía la historia (texto + lista) ─────► /api/historias (POST) ──► Neon: tabla historias, estado 'pendiente'
  ▼
Mapa
  └── pide las aprobadas ─────────────────────► /api/historias (GET) ──► historias aprobadas + enlaces firmados
```

## Servicios

| Qué | Servicio | Dónde se ve | Variables |
|-----|----------|-------------|-----------|
| Base de datos | Neon Postgres (`territorios-historias`), conectado por el Marketplace de Vercel | Vercel → proyecto `web` → Storage → `territorios-historias` → «Open in Neon» | `DATABASE_URL` (y las `PG*` / `POSTGRES_*` que agrega Neon) |
| Archivos | Vercel Blob, almacén privado `territorios-historias` | Vercel → proyecto `web` → Storage → Blob → `territorios-historias` → Browser | `BLOB_READ_WRITE_TOKEN` |
| Sal de la huella | — | Vercel → Settings → Environment Variables | `ADMIN_TOKEN` (también será la clave de la revisión) |

Ninguna clave está en el repositorio: viven en Vercel y se bajan con `vercel env pull .env.local --yes`.

## Tablas

### `historias` — una fila por historia enviada

| Columna | Tipo | Qué es |
|---------|------|--------|
| `id` | uuid | Identificador (lo genera la base de datos) |
| `creada` | timestamptz | Cuándo llegó |
| `estado` | text | `pendiente` (al llegar), `aprobada` (sale en el mapa) o `rechazada` |
| `titulo` | text | Título (hasta 90 letras) |
| `relato` | text | La historia (40 a 6000 letras) |
| `cuando` | text | «¿Cuándo pasó?» (opcional, texto libre) |
| `tipo` | text | `pueblo`, `selva`, `mar`, `rio`, `cultura` o `cocina`: decide la figurita del mapa |
| `municipio` | text | Uno de los 31 municipios del Chocó |
| `lugar` | text | Corregimiento, vereda, playa… (opcional) |
| `lat`, `lon` | double | Coordenadas si la persona compartió su ubicación y cae en el Chocó; si no, vacías (el equipo las pone al aprobar) |
| `autor` | text | Nombre con el que quiere aparecer (se publica) |
| `contacto` | text | Correo o WhatsApp (opcional, **nunca se publica**) |
| `archivos` | jsonb | Lista de archivos: `[{ pathname, tipo: foto/video/audio, nombre, bytes }]` |
| `ip_hash` | text | Huella anónima de quien envió (IP + sal secreta, cifrada): solo para el límite de envíos |
| `revisada` | timestamptz | Cuándo se aprobó o rechazó |
| `nota` | text | Nota interna del equipo |

Índices: por `estado` y fecha (la lista del mapa y de la revisión) y por `ip_hash` y fecha (el límite por hora).

### `subidas` — un registro por permiso de subida entregado

`ip_hash`, `creada`. Solo sirve para frenar a quien quiera llenar el almacén (máximo 24 archivos por hora por persona).

El esquema está en `api/_lib/db.ts` y se crea con `npm run db:setup` (se puede correr cuantas veces se quiera).

## API (funciones de Vercel en `api/`)

| Ruta | Método | Qué hace |
|------|--------|----------|
| `/api/historias/subir` | POST | Entrega el permiso para subir un archivo directo al almacén. Solo rutas `historias/…`, solo fotos, audios y videos, máximo 50 MB, máximo 24 por hora por persona. |
| `/api/historias` | POST | Guarda una historia nueva como `pendiente`. Valida todo en el servidor (no confía en el navegador). Máximo 4 por hora por persona. Un campo trampa invisible descarta a los robots. |
| `/api/historias` | GET | Las historias aprobadas con coordenadas, con enlaces firmados (válidos ~6 h) a sus archivos. La CDN la guarda 5 minutos. |

Los archivos del almacén son **privados**: su dirección sola da 403. Solo se ven con un enlace firmado que entrega el
servidor, y solo para historias aprobadas.

## Ver y manejar los datos

- **Las historias**: Vercel → `web` → Storage → `territorios-historias` → «Open in Neon» → **Tables** → `historias`
  (se ven como una hoja de cálculo; se pueden editar celdas). O **SQL Editor**:

  ```sql
  -- Las que esperan revisión
  select creada, titulo, municipio, lugar, autor, jsonb_array_length(archivos) as archivos
  from historias where estado = 'pendiente' order by creada desc;

  -- Aprobar una (con coordenadas: sin ellas no sale en el mapa)
  update historias set estado = 'aprobada', revisada = now(), lat = 5.6287, lon = -77.4059 where id = '…';

  -- Quitarla del mapa
  update historias set estado = 'rechazada', revisada = now() where id = '…';
  ```

- **Los archivos**: Vercel → `web` → Storage → Blob `territorios-historias` → Browser. Cada envío tiene su carpeta
  `historias/<id>/`; el `pathname` de cada archivo está en la columna `archivos` de su historia.
- **Los registros de las funciones** (errores, tiempos): Vercel → `web` → Logs (filtrar por `/api/historias`).

Borrar una historia del todo = borrar su fila **y** sus archivos (la revisión de la rama `revision-historias` lo hace
con un botón).

## Probar en local

`npm run dev` (Vite solo) no corre la API: el mapa funciona, pero sin historias, y el formulario no puede enviar.
Para todo junto: `npm run dev:api` (es `vercel dev`) → http://localhost:3000.

## Si se deja Vercel

- **Neon** es Postgres normal: se puede seguir usando desde cualquier servidor (o mover los datos con `pg_dump`).
- **Vercel Blob** sí es de Vercel. Lo natural sería Cloudflare R2 (el proyecto ya lo usa para el multimedia): cambia
  `api/historias/subir.ts` (permiso de subida → URL prefirmada de R2), `api/_lib/util.ts` (enlaces firmados de R2) y
  `uploadFile` en `src/application/stories-api.ts`. Las tablas no cambian.
- Las funciones de `api/` son `Request → Response` estándar: se adaptan a otro servidor (Node, Cloudflare Workers…)
  con pocos cambios.

## Pendiente (siguientes ramas)

- Revisión del equipo en la web (`/admin-historias`): ya escrita en la rama `revision-historias`.
- Limpiar archivos de envíos que nunca se terminaron (subieron archivos pero no enviaron la historia).
- Avisar al equipo cuando llega una historia (correo).
