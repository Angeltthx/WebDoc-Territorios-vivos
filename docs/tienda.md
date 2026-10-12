# La tienda: pedidos, existencias y pagos con Wompi

## En una línea

La bolsa vive en el navegador. Al pagar, el servidor crea el pedido en la base de datos (Neon) como **pendiente**,
aparta las existencias y manda a la persona al checkout de **Wompi**. El pedido solo pasa a **pagado** cuando Wompi lo
confirma (nunca por lo que diga el navegador).

```
Navegador                                   Servidor (api/tienda)                       Wompi
  │ 1. «Pagar» con sus datos de envío ───────► POST /api/tienda/pedidos
  │                                             · valida datos, aparta existencias
  │                                             · crea el pedido «pendiente» (vence en 1 h)
  │ ◄── enlace al checkout (con firma) ─────── · firma de integridad (valor + referencia)
  │ 2. paga ───────────────────────────────────────────────────────────────────────────► checkout.wompi.co
  │                                                                                       │
  │                                            POST /api/tienda/wompi ◄──── 3. aviso ─────┤ (firmado con el
  │                                             · comprueba la firma                       │  secreto de eventos)
  │                                             · pagado / rechazado (devuelve existencias)│
  │ ◄──── 4. vuelve a /tienda/pedido/<referencia>?id=<transacción> ────────────────────────┘
  │ 5. pregunta cómo va ─────────────────────► GET /api/tienda/pedidos?ref=…&id=…
  │                                             · si sigue pendiente, consulta la transacción en Wompi
  │ ◄── pagado / rechazado / en proceso ────── (así funciona aunque el aviso no llegue, p. ej. en local)
```

## Reglas

| Qué | Cómo |
|-----|------|
| Precio y existencias | Los manda la tabla `productos` (las fotos y los textos están en `src/content/stories.ts`, unidos por el SKU). |
| Envío | $ 15.000 a todo el país (`ENVIO` en `api/_lib/tienda.ts`). |
| Existencias | Se apartan al crear el pedido. Si se rechaza o vence, vuelven. Pagado no las toca (ya estaban apartadas). |
| Vencimiento | 1 hora (`PLAZO_MIN`). Wompi no deja pagar después: la fecha va en la firma. |
| Pagado | Solo si Wompi dice `APPROVED` **y** el valor es exactamente el del pedido. Si no, queda rechazado con una nota. |
| Avisos repetidos | No pasa nada: solo cambia un pedido que sigue pendiente. |
| Límites | 10 por producto en un pedido, 8 pedidos por hora por persona, campo trampa contra robots. |

## Tablas (en la misma base que las historias; esquema en `api/_lib/db.ts`, se crea con `npm run db:setup`)

- **`productos`**: `sku`, `nombre`, `precio` (pesos), `existencias`, `activo`.
- **`pedidos`**: `referencia` (la que ve la persona y Wompi), `estado` (`pendiente`, `pagado`, `rechazado`, `expirado`,
  `enviado`, `entregado`), datos de envío, `subtotal`, `envio`, `total`, `wompi_id`, `wompi_estado`, `metodo`,
  `pagado`, `guia` (número de la transportadora), `nota` (interna).
- **`pedido_items`**: lo que lleva cada pedido, con el precio al que se vendió.

```sql
-- Los pedidos pagados que hay que despachar
select creado, referencia, nombre, celular, direccion, ciudad, departamento, total
from pedidos where estado = 'pagado' order by creado;

-- Marcar uno como enviado
update pedidos set estado = 'enviado', guia = '123456789' where referencia = 'TV-…';

-- Cambiar las existencias o el precio
update productos set existencias = 20, precio = 90000 where sku = 'poster-mapa-pliego';
```

## Wompi

Llaves (Wompi → panel de comercios → Desarrolladores). En Vercel → `web` → Settings → Environment Variables:

| Variable | Qué es | De prueba empieza por |
|----------|--------|-----------------------|
| `WOMPI_PUBLIC_KEY` | Llave pública (va en el enlace al checkout) | `pub_test_` |
| `WOMPI_INTEGRITY_SECRET` | Secreto de integridad (firma el valor y la referencia) | `test_integrity_` |
| `WOMPI_EVENTS_SECRET` | Secreto de eventos (para creerle a los avisos) | `test_events_` |

La llave privada no se usa. Con llaves de prueba todo va al ambiente de pruebas de Wompi (no se cobra dinero); para
cobrar de verdad basta cambiar las tres por las de producción.

**URL de eventos** (Wompi → Desarrolladores, en cada ambiente): `https://<dominio>/api/tienda/wompi`. En local no
llega (Wompi no ve `localhost`), pero no hace falta: la página de vuelta consulta la transacción.

### Datos de prueba de Wompi (ambiente de pruebas)

- Tarjeta aprobada: `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.
- Tarjeta rechazada: `4111 1111 1111 1111`.
- Nequi: celular `3991111111` (aprobado) o `3992222222` (rechazado).
- PSE: en el banco de prueba se elige si aprobar o rechazar.

## Probar en local

`npm run dev:api` (es `vercel dev`) y abrir la tienda en **http://lvh.me:3000/tienda** (no en localhost). Wompi no
deja pagar si la dirección de vuelta es `localhost` o `127.0.0.1` (responde 403), y `lvh.me` es un nombre público que
siempre apunta a este mismo computador. Si se pide desde localhost, el servidor igual cambia la vuelta a `lvh.me`, pero
la bolsa del navegador no se vacía al volver (son sitios distintos para el navegador). Con `npm run dev` (Vite solo) se
ve la tienda, pero no se puede pagar. Si algún día hace falta, `TIENDA_URL` fija a dónde vuelve la persona.

## Pendiente (siguientes pasos)

- Correos: a la persona (confirmación) y al equipo (pedido nuevo).
- Pantalla para el equipo: ver pedidos, marcarlos enviados con la guía.
- Lo que decide el cliente: quién vende, facturación electrónica, políticas de cambios y retracto.
