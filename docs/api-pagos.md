# API de pagos: lo que el front espera

El front ya está preparado para cobrar por **link** (se le manda al cliente) y por **QR** (se muestra en el mostrador). Lo único que falta es la API que habla con el medio de pago. Este documento es el contrato: si la API cumple con esto, no hace falta tocar ninguna pantalla.

Todo lo que habla con la API está en un solo archivo: [`src/lib/pagos.js`](../src/lib/pagos.js). Los tests de ese contrato están en [`pruebas/pagos.test.js`](../pruebas/pagos.test.js).

## Configuración

En `.env.local` del front:

```
NEXT_PUBLIC_API_URL=https://la-api.ejemplo
```

Es pública, como la URL de Supabase. Mientras esté vacía, con Supabase el botón "Pedir un pago por link o QR" aparece apagado con el motivo, y en el modo de ejemplo el pago se simula.

**Las claves del medio de pago y la `service_role` de Supabase viven sólo en el servidor de la API.** Nunca en el repo del front ni en el navegador.

## Autenticación

Cada llamada del front trae la sesión de Supabase de la persona:

```
Authorization: Bearer <access_token de Supabase>
```

La API tiene que:

1. Validar ese JWT con Supabase.
2. Comprobar que la persona es **dueño o encargado** del negocio del caso (la misma regla que `puedo_cargar()` en `008_permisos.sql`). Si no lo es, contesta `403`.

## Respuestas

Siempre JSON, con `ok`:

- Bien: `{ "ok": true, "cobro": { ...la fila de la tabla cobro... } }`
- Mal: `{ "ok": false, "motivo": "Frase para mostrarle a la persona." }`

El `motivo` se muestra tal cual en pantalla, así que va en castellano, sin códigos ni palabras técnicas. Si no hay `motivo`, el front usa una frase propia según el código (`401` → sesión vencida, `403` → sin permiso, otro → "no contestó").

## `POST /cobros` — pedir un pago

```json
{ "caso_id": "uuid", "monto": 60000, "medio": "link" }
```

`medio` es `"link"` o `"qr"`.

La API:

1. Valida el monto (mayor que cero) y que el caso sea del negocio de la persona. **No confía en el monto del navegador sin mirarlo.** Como mínimo tiene que ser positivo y no pasarse de lo que falta cobrar, salvo que se decida otra cosa.
2. Crea el pago en el medio de pago (preferencia, orden, lo que corresponda).
3. Inserta la fila en `cobro` con `estado = 'pendiente'`, `medio`, `monto`, `proveedor` (por ejemplo `"mercadopago"`), `proveedor_id` (el id del pago en el proveedor), `link` (la URL para pagar) y `vence_en` si el link vence. `creado_por` es el `empleado.id` de la persona.
4. Devuelve la fila.

Para **QR**, el front muestra la imagen de `cobro.qr_imagen` (una URL o un `data:` URI). Esa columna todavía **no existe**: cuando se defina el proveedor, se agrega en una migración nueva (`alter table cobro add column if not exists qr_imagen text;`). Mientras no esté, el front dice "El QR todavía no llegó".

## `POST /cobros/:id/anular` — cancelar un pedido que no se pagó

```json
{ "motivo": "Pagó en efectivo" }
```

La API da de baja el link en el medio de pago (para que el cliente ya no pueda pagarlo) y pone la fila en `estado = 'anulado'`, con `anulado_en`, `anulado_por` y `motivo_anulacion`. Devuelve la fila.

Un pago que **ya entró** no se anula: se devuelve desde el medio de pago, y la fila pasa a `devuelto`.

## `POST /seguimiento/:codigo/pagos` — el cliente paga desde su link (sin sesión)

Es la única ruta **sin autenticación**: la usa el cliente desde la página de seguimiento, que no tiene cuenta. El `:codigo` es el código del link de seguimiento (`caso.seguimiento_codigo`), y es lo único que identifica el caso.

El cuerpo va vacío (`{}`): **el cliente no elige cuánto paga**. La API:

1. Busca el caso por `seguimiento_codigo`. Si no existe, contesta `{ "ok": false, "motivo": "Este link ya no sirve." }`.
2. Calcula lo que falta con la misma cuenta que `ver_seguimiento()` (`026_pago_en_el_seguimiento.sql`): aprobado − pagado − pendiente − descuento. Si no falta nada, contesta con un `motivo`.
3. Si ya hay un cobro `pendiente` por `link` para ese caso, devuelve ese link en vez de crear otro.
4. Si no, crea el pago en el medio de pago y la fila en `cobro` (`estado = 'pendiente'`, `medio = 'link'`, `creado_por` vacío).
5. Contesta `{ "ok": true, "link": "https://..." }`. El front manda al cliente a ese link.

Conviene limitar cuántas veces se puede llamar por código (por ejemplo, una vez por minuto), porque no hay sesión.

El botón "Pagar $X ahora" sólo aparece si `NEXT_PUBLIC_API_URL` está configurada y el negocio no le mandó ya un link. Pagar desde ahí es opcional: la página también dice que puede pagar en el local.

## Webhook del medio de pago

Cuando el medio de pago avisa (la ruta la elige la API, por ejemplo `POST /webhooks/mercadopago`):

1. **Verificar la firma** del aviso. Sin esto, cualquiera podría marcar un cobro como pagado.
2. Buscar la fila por `(proveedor, proveedor_id)`: hay un índice único para eso.
3. Pasarla a `pagado` (con `pagado_en`), `rechazado` o `vencido`.
4. Ser **idempotente**: el mismo aviso puede llegar dos veces.
5. Anotar un evento en `evento` para el historial del caso: `tipo = 'plata'`, `titulo = 'Entró un pago'`, `detalle = '$60.000 · Link de pago'`, `monto`, `icono = 'listo'`.

No hace falta tocar `caso.cobrado`: lo mantiene el trigger `cobro_mantiene_caso` de `025_cobros.sql`.

## Cómo se entera el front

Mientras un caso tiene un pago por link o QR esperando, la pantalla vuelve a leer sus cobros de Supabase cada 10 segundos y cada vez que la pestaña vuelve a tener el foco. Cuando uno pasa a `pagado`, muestra "Entró el pago de $X". La API no tiene que avisarle nada al front.

## Estados de un cobro

| Estado | Quién lo pone | Cuenta como cobrado |
|---|---|---|
| `pendiente` | la API al pedir el pago | no |
| `pagado` | el negocio (efectivo, transferencia o tarjeta, con `registrar_cobro()`) o la API (webhook) | **sí** |
| `rechazado` | la API (webhook) | no |
| `vencido` | la API (webhook o una tarea que revise `vence_en`) | no |
| `anulado` | el negocio (`anular_cobro()`) o la API (`/anular`) | no |
| `devuelto` | la API | no |
