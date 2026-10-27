# Copia de seguridad del negocio

Propuesto el 2026-10-27. Todavía no se editó código.

Una opción de Mi negocio para guardar el estado del negocio y volver a él.
La idea nace del chatbot (otro plan): si alguien le pide algo que rompe los
datos, que haya un punto al que volver sin perder semanas de trabajo. Lo que
se hizo entre la copia y el restablecimiento se pierde, y se acepta así.

La copia no reemplaza la protección principal contra el chatbot: que actúe
por la API con el token y los permisos de quien lo usa, sin SQL directo, y que
pida confirmación antes de borrar. La copia es la red para lo que se escape
igual.

## 1. Qué ve el dueño

**Mi negocio → Copia de seguridad.** Sólo la ve quien tiene el permiso nuevo
`copia_de_seguridad` (de fábrica, sólo el dueño).

- **Copia automática:** activada o desactivada. Desactivada por defecto.
- **Horario:** una hora del día. Por defecto 04:00. Se
  sugiere un horario en que no se trabaje.
- **Hacer una copia ahora.**
- **Las copias guardadas** (las últimas 3), cada una con su fecha, si fue
  automática o a mano, y el botón **Restablecer**.

Restablecer pide confirmar con una ventana que dice:

- de qué fecha es la copia;
- que se pierde todo lo hecho después, también lo que hicieron los clientes
  desde afuera (un turno pedido por el link público, una respuesta por
  WhatsApp), y que el cliente no se entera;
- qué no cambia (sección 3).

## 2. Cómo funciona

### Por negocio, no la base entera

Todos los negocios viven en la misma base de Supabase. La copia de Supabase
(PITR) vuelve atrás la base entera, así que si un negocio restablece, los
demás pierden su trabajo; además es paga. La copia es **sólo de las filas de
ese negocio**, guardada dentro de la misma base.

### La tabla

```sql
create table copia_de_seguridad (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references negocio(id) on delete cascade,
  creada_en   timestamptz not null default now(),
  origen      text not null check (origen in ('automatica', 'manual', 'antes_de_restablecer')),
  migracion   text not null,   -- la última migración corrida al hacerla
  datos       jsonb not null   -- { "caso": [...], "cliente": [...], ... }
);
```

Y en `negocio`: `copia_automatica boolean default false` y
`copia_hora smallint default 4` (0 a 23).

Las copias no se leen desde el front: RLS cerrada y sólo las funciones
`security definer` las tocan.

### Las funciones

- **`hacer_copia(p_negocio, p_origen)`**: arma el JSON con las tablas de la
  sección 3, lo guarda y borra las más viejas hasta dejar 3 (las
  `antes_de_restablecer` cuentan aparte: se guarda sólo la última).
- **`restablecer_copia(p_copia)`**: todo en una transacción; o se restablece
  entero o no cambia nada:
  1. Comprueba que quien llama tiene `copia_de_seguridad` en ese negocio.
  2. Comprueba que `migracion` sea la actual. Si la estructura cambió desde la
     copia, no se restablece (sección 4).
  3. Hace una copia `antes_de_restablecer`, para poder deshacer.
  4. Por cada tabla: borra las filas del negocio que no están en la copia,
     actualiza las que cambiaron e inserta las que faltan, en orden de
     dependencias (clientes antes que casos, casos antes que pasos).
  5. Vuelve a calcular los WhatsApp pendientes (sección 3).

### La copia automática: pg_cron

Hoy no hay nada programado en la base. La API en Render duerme sin tráfico,
así que no sirve de reloj. Se usa **pg_cron** de Supabase (viene en el plan
gratis), una vez por hora:

```sql
select cron.schedule('copias', '0 * * * *', $$ select hacer_copias_de_esta_hora() $$);
```

`hacer_copias_de_esta_hora()` copia los negocios con `copia_automatica` y cuya
`copia_hora` coincide con la hora actual. `negocio` no tiene zona horaria,
sólo `pais`: la hora se toma en la zona de su país (de entrada,
`America/Argentina/Buenos_Aires` para todos). Si un negocio no cambió
nada desde su última copia, no hace otra: así una semana sin uso no se lleva
las 3 copias buenas.

## 3. Qué entra y qué queda afuera

### Entra (se copia y se restablece)

| Tabla | Nota |
|---|---|
| `negocio` | Menos `id`, `red`, `creado_por`, `agenda_codigo`, `landing_codigo`, `ics_codigo` y los dos campos de la copia: los links públicos ya compartidos siguen andando. |
| `cliente`, `cliente_evento` | |
| `caso`, `paso`, `evento` | Ver "Casos con cobro". |
| `turno` | |
| `insumo`, `categorias_del_negocio` | |
| `ecuacion`, `ecuacion_dependencia` | |
| `negocio_seguimiento` | La configuración de los avisos. |
| `landing_intento`, `landing_sesion` | Revisar en el paso 1 si vale la pena; son registros de visitas. |

### Queda afuera (no cambia al restablecer)

| Tabla | Por qué |
|---|---|
| `suscripcion`, `usuario_suscripcion`, `prueba_gratis`, `suscripcion_precio` | Se movió plata de verdad en Mercado Pago. Volver atrás podría devolver un mes de prueba ya usado. |
| `cobro` | Mismo motivo: borrar un cobro esconde un pago que existió. |
| `negocio_conexionMP`, `MP_oauth_state` | Credenciales de Mercado Pago. |
| `empleado`, `rol`, `invitacion`, `solicitud_de_ingreso` | Si se echó a alguien después de la copia, restablecer le devolvería el acceso. |
| `negocio.red` | El vínculo de sedes también es del otro negocio. |
| `usuario`, `google_calendar_conexion`, `google_calendar_evento` | Son de la cuenta de la persona, no del negocio. |
| `seguimiento_whatsapp`, `seguimiento_whatsapp_respuesta` | Lo enviado ya salió y no se desenvía. Los pendientes se recalculan al final, con las mismas funciones que los programan hoy (`sincronizar…` de la API). |
| `pedido_idempotente` | Técnica, de corta vida. |

### Casos con cobro

`cobro.caso_id` es `ON DELETE CASCADE`: borrar un caso borra sus cobros. Como
los cobros quedan afuera, **un caso que tiene cobros no se borra al
restablecer**, aunque no esté en la copia. Si está en la copia, se restablece
como estaba; si no, queda como está hoy. La ventana de confirmación lo dice
("Los casos con cobros registrados se conservan").

Lo mismo con `turno`: `google_calendar_evento` y `seguimiento_whatsapp` lo
referencian con `ON DELETE CASCADE`. Borrar un turno nuevo borra su evento del
calendario y su aviso pendiente, que es lo esperado.

## 4. Riesgos y decisiones

- **D1. Una copia de antes de una migración no se restablece.** Las columnas
  pueden haber cambiado, y meter un JSON viejo en una tabla nueva rompe o, peor,
  deja datos a medias. La lista muestra esas copias con "No se puede
  restablecer: el sistema se actualizó después de esta copia".
- **D2. El chatbot no puede hacer ni restablecer copias.** Sus herramientas no
  incluyen estos endpoints, y la API los rechaza si el pedido viene del
  chatbot. Restablecer una copia vieja sería justo el daño que se quiere evitar.
- **D3. 3 copias.** Con una diaria, alcanza para volver hasta 3 días atrás. Si
  el negocio no cambió, no se hace copia nueva (sección 2), así que las 3
  pueden cubrir más tiempo.
- **D4. Tamaño.** Un negocio chico pesa pocos cientos de KB en JSON. Si algún
  negocio crece mucho (miles de casos), se revisa; hoy no hace falta.
- **D5. Borrar el negocio borra sus copias** (`on delete cascade`). Es lo
  esperado: quien borra el negocio quiere que no quede nada.

## 5. Plan

Cada paso es un PR, con sus pruebas.

| # | Paso | Dónde |
|---|---|---|
| 1 | **La base.** Migración 071: tabla `copia_de_seguridad`, columnas en `negocio`, permiso `copia_de_seguridad` en el catálogo de roles, `hacer_copia()` y `restablecer_copia()`. Prueba en `supabase/pruebas/copia_de_seguridad.sql`: copiar, cambiar, restablecer y comparar; que lo de la sección 3 "afuera" no cambie; que un caso con cobro sobreviva; que una copia con otra `migracion` se rechace; que sin el permiso dé 42501. | front, `supabase/` |
| 2 | **La copia automática.** `hacer_copias_de_esta_hora()` y el `cron.schedule`. Prueba de la función con la hora fija; no del cron. | front, `supabase/` |
| 3 | **La API.** `GET /v1/copias` (lista y configuración), `PUT /v1/copias/configuracion`, `POST /v1/copias` (copia ahora), `POST /v1/copias/:id/restablecer`. Después de restablecer, recalcula los WhatsApp pendientes. Pruebas de contrato. | API |
| 4 | **La pantalla.** Mi negocio → Copia de seguridad, con la ventana de confirmación. Textos en `idiomas/es.js` y `en.js`. Prueba e2e: activar, copiar, cambiar algo, restablecer y ver el cambio deshecho. | front |
| 5 | **El chatbot** (cuando exista). Dejar fuera de sus herramientas los endpoints de copias, con una prueba que lo cuide. | API |

## Qué queda afuera de este plan

- Descargar la copia como archivo o subir una.
- Restablecer sólo una parte (sólo los clientes, sólo un caso).
- Copias de toda la base: eso lo cubre Supabase.
