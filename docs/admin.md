# Panel del equipo (`/admin`)

## Entrar

- Dirección: `/admin` (en local, http://localhost:3000/admin). No se indexa en buscadores.
- Usuario: `admin` (se puede cambiar con la variable `ADMIN_USER`).
- Clave: la variable `ADMIN_PASSWORD` (Vercel → `web` → Settings → Environment Variables; en este computador también
  está en `.env.local`). Para cambiarla, se cambia ahí y se vuelve a publicar.
- La sesión dura 12 horas. «Salir» la cierra.

## Cómo se ve

A pantalla completa: el menú a la izquierda (Resumen, Pedidos, Historias, Productos, con lo pendiente en dorado) y el
trabajo a la derecha, en tablas. Al tocar una fila, su detalle se abre en un panel a la derecha con sus acciones.
El nombre del panel y la ruta «Panel / …» llevan siempre al resumen.

## Qué tiene

| Sección | Qué se hace |
|---------|-------------|
| Resumen | Historias por revisar, pedidos por despachar, ventas (30 días y total), existencias y las últimas ventas. Cada cifra lleva a su sección. |
| Historias | Leer, ver y oír lo que mandó la gente. Las coordenadas vienen puestas (las que compartió la persona, o las del lugar o el municipio que escribió) y se ajustan. «Publicar en el mapa», «Corregir el texto», «Rechazar» / «Quitar del mapa» y «Borrar» (para siempre, con sus archivos). |
| Pedidos | Por despachar · En camino · Entregados · Sin pagar · Todos, y búsqueda por código, nombre, correo o celular. Cada pedido: a dónde va, WhatsApp y correo del cliente, lo que lleva y el total. «Empezar a empacar» → «Marcar como enviado» (pide transportadora y guía) → «Marcar como entregado»; «Devolver un paso» para corregir. Nota interna. El cliente ve cada paso, con su fecha, en «Consultar mi pedido». |
| Productos | Precio, existencias y si está a la venta. Muestra cuántos se han vendido y cuántos están apartados en pedidos sin pagar. |

## Cómo está hecho

```
Navegador (/admin)                      Servidor (api/admin)                  Neon
  │ POST /api/admin/sesion {usuario, clave} ► compara con ADMIN_USER y ADMIN_PASSWORD
  │ ◄── galleta tv_admin (firmada) ──────── (HttpOnly, SameSite=Strict, 12 h)
  │ GET  /api/admin/resumen | historias | pedidos | productos ──► revisa la galleta ──► consulta
  │ POST (con encabezado x-admin: 1) ──────────────────────────► revisa galleta y encabezado ──► cambia
```

- **La clave nunca está en el código.** La galleta va firmada con `ADMIN_SESSION_SECRET`; el JavaScript de la página no
  la puede leer y no se manda desde otros sitios. Las acciones piden además el encabezado `x-admin`, que un formulario
  de otro sitio no puede poner.
- **Intentos:** más de 8 claves erradas en 15 minutos desde la misma conexión, y se frena un rato (tabla `admin_intentos`).
- **Reglas en el servidor** (no solo en la pantalla): publicar una historia exige coordenadas dentro del Chocó; un pedido
  solo avanza si está pagado y de un paso en uno; «enviado» exige transportadora o guía; al devolver un paso se borra la
  fecha del paso deshecho; el precio va de $ 1.000 a $ 50.000.000.
- Las fechas de cada paso de un pedido las anota la base sola (disparador `pedidos_fechas`).

Archivos: `api/_lib/admin.ts` (clave y sesión), `api/admin/*.ts` (las rutas), `src/application/admin-api.ts` y
`src/ui/screens/Admin.tsx` (la pantalla).
