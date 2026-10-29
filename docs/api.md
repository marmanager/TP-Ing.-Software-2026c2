# Cómo habla el front con la API

El contrato completo —endpoints, campos, códigos de error, idempotencia, paginado— vive en el repo de la API:

- **`MIGRACION.md`** del repo `TP-IngeSoft-API`: las reglas de la casa y el plan de migración.
- Un documento por recurso en ese mismo repo, a medida que se construyen.

Acá queda sólo lo que el front implementa, para que quien toque [src/lib/api.js](../src/lib/api.js) sepa qué está cumpliendo sin cambiar de repositorio.

## Las cinco reglas que implementa `api.js`

1. **Toda respuesta tiene la misma forma.** `{ ok: true, datos }` —con `siguiente` si es una lista— o `{ ok: false, error: { codigo, mensaje, campo } }`. El `mensaje` lo escribe la API y se muestra tal cual; el `codigo` es lo único sobre lo que se puede ramificar.
2. **La sesión viaja en la cabecera**: `Authorization: Bearer <access_token de Supabase>`. Ante un 401, `api.js` avisa una vez para que la aplicación cierre la sesión.
3. **Los `POST` que crean algo o mueven plata llevan `Idempotency-Key`.** Reintentar con la misma clave devuelve la misma respuesta en vez de cobrar dos veces. La clave la genera `nuevaClave()`.
4. **Las listas se paginan por cursor**: se manda `limite` y el `siguiente` de la respuesta anterior. El cursor es opaco; el front no lo interpreta.
5. **Los campos desconocidos se ignoran.** La API puede agregar campos sin romper nada; sacarlos o renombrarlos es `v2`.

Cuando la API no contesta —se cayó, no hay internet o se acabó el tiempo de espera—, `api.js` devuelve un error con el mismo formato y la frase *"No pudimos conectarnos. Fijate que tengas internet y volvé a probar."*

## El reparto

```
Pantalla  →  acción de datos.js  →  api.js  →  API  →  base
```

| Capa | De qué se encarga |
|---|---|
| **Pantalla** | Mostrar, y no ofrecer botones que van a fallar. No hace `fetch` ni habla con Supabase |
| **Acción de `datos.js`** | Llamar, actualizar la lista en memoria y devolver `{ ok, error }` |
| **`api.js`** | Todo lo de la red: cabeceras, tiempos de espera, reintentos, traducción de errores |
| **API** | La regla de negocio, en un solo lugar |
| **Base** | `check`, índices únicos y RLS como última línea |

Esas fronteras no son una recomendación: las verifica [pruebas/fronteras.test.js](../pruebas/fronteras.test.js), que lee el código fuente y falla si una pantalla habla con la base o llama a la API por su cuenta. Las excepciones que hay hoy están en ese archivo, cada una con su motivo.

## Cómo se usa

```js
import { traer, mandar, parchar, nuevaClave } from "@/lib/api";

// En una acción de datos.js, no en una pantalla:
const r = await mandar("/insumos", producto, token, { idempotencia: nuevaClave() });
if (!r.ok) return { ok: false, error: r.error.mensaje };
setDatos((d) => ponerInsumo(d, r.datos.insumo));
return { ok: true };
```

## Dos personas editando lo mismo

Las ediciones de un caso, un cliente, la ficha del negocio, el rol de una ficha, un producto y el estado de un turno mandan el `actualizado_en` que se ve en pantalla. Si otro cambió esa fila mientras tanto, la API contesta 409 `choque` y no pisa lo del otro: `datos.js` muestra el aviso y vuelve a leer todo.

Para que un cambio propio no choque contra el anterior, cada acción guarda la fila que devuelve la API (con su `actualizado_en` nuevo). Lo que cambia el negocio sin devolverlo entero (compartir la agenda o el calendario, los horarios) deja su versión vacía: el próximo cambio va sin ella, y la API escribe como siempre.

## La dirección

Sale de `NEXT_PUBLIC_API_URL`. `api.js` acepta la raíz, la dirección anterior terminada en `/payments` y la nueva terminada en `/v1`; normaliza cualquiera de las tres antes de armar las rutas.

- `api.js` → raíz + `/v1`: las rutas se escriben `"/insumos"`, no `"/v1/insumos"`.
- `pagos.js` → raíz + `/v1`: cobros, Mercado Pago y seguimiento usan el contrato nuevo.

Así anda igual con el valor de hoy y con la raíz sola. Cuando se decida, se cambia en Vercel a `https://tp-ingesoft-api.onrender.com` sin tocar código.

Mientras esté vacía, cualquier llamada devuelve un error con código `sin_api` y no sale ningún pedido.

## Estado de la migración

Las cuentas reales usan siempre `/v1`: sesión, carga inicial y los ocho recursos de la aplicación pasan por la API. Ya no existe un interruptor por recurso ni un camino alternativo desde el navegador hacia Supabase.

El modo de ejemplo ("Probá sin cuenta", todo en el navegador) se sacó: obligaba a tener una copia de las reglas en el front. Las e2e entran con una cuenta sembrada por la API (`POST /v1/pruebas/semilla`), y para mostrar el sistema se usa `npm run sembrar` en la API.

Las únicas conexiones directas a Supabase que quedan en este repositorio se ejecutan del lado del servidor de Next:

- la ruta que arma el calendario `.ics` público;
- la integración de Google Calendar, que guarda y recupera sus credenciales en el servidor.

Los tests del contrato de red están en [pruebas/api.test.js](../pruebas/api.test.js). Las fronteras arquitectónicas están en [pruebas/fronteras.test.js](../pruebas/fronteras.test.js).


## WhatsApp desde la vista de un caso

- El cambio de estado manda `notificar_cliente` sólo al endpoint `/casos/:id/estado`.
  La opción es independiente del seguimiento posterior al cierre y requiere un teléfono válido.
- Al abrir el cierre, se consulta `GET /negocio/seguimiento` y se muestra el texto y la
  demora actuales. El consentimiento arranca desmarcado en cada entrega.
- Si se pide seguimiento, el cierre envía `seguimiento: true`, `seguimiento_dias` y
  `seguimiento_mensaje`. Los días se aplican sólo a ese caso. Desmarcado manda
  `seguimiento: false`, sin días ni mensaje.
- El posventa es también el resumen de lo hecho: al mandarlo, la API le suma al texto
  configurado los pasos aprobados (✓ hecho, • no) y el link del caso. Si el caso nunca se
  compartió, entregar con seguimiento lo comparte, y la respuesta trae el
  `seguimiento_codigo`. El front ya no arma ese resumen ni lo manda por wa.me.
- Después de confirmar un cierre con seguimiento, si el mensaje utilizado cambió
  respecto del texto cargado, se guarda con `PATCH /negocio/seguimiento` enviando
  sólo `mensaje`. Se comparan los textos sin espacios en los extremos. Si ese
  guardado falla, se muestra un aviso y el cierre sigue confirmado.
- Si el negocio tiene el seguimiento desactivado, el formulario permite activarlo
  con `PATCH /negocio/seguimiento` antes de solicitarlo para un caso.
- Un fallo del envío se muestra aparte del cambio de estado o cierre confirmado.

## Recordatorios por WhatsApp (R-4b)

- `/negocio/recordatorios` edita los dos con el mismo `GET` y `PATCH /negocio/seguimiento`:
  arriba el de después de entregar (`activo`, `dias`, `mensaje`) y en `turno` el de antes
  del turno (`activo`, `horas` de 1 a 168, `mensaje`). El `PATCH` lleva sólo lo que cambió
  (`cambiosDeRecordatorios()`), así que tocar uno no escribe el otro. El texto sugerido
  según el rubro lo arma la API; el front no tiene copia.
- Mover un turno es `PATCH /turnos/:id` con `empieza_en` (y `actualizado_en`). `POST /turnos`
  devuelve `recordatorio` al lado del turno, y `PATCH`, `/atender` y `/desatender` dentro del
  turno: `{ programado, motivo, mensaje, aviso }`. `datos.js` lo guarda con el turno.
- Cada turno muestra su aviso con `avisoDelTurno()`: `turno.aviso` si viene, si no
  `turno.recordatorio.aviso`. **Pendiente en la API** (seguimiento de R-4a): que `GET /turnos`
  y `GET /datos` traigan en cada turno `aviso: { id, estado, enviar_en, procesado_en } | null`,
  el último de la cola. Sin eso, "enviado" y "fallido" —que los marca el procesador después—
  no llegan al front, y lo programado se deja de ver al recargar.
- El texto de error de un envío fallido no se muestra nunca: la frase dice qué hacer.
- Sin el número de WhatsApp configurado en la API (`KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`),
  los turnos se anotan igual y la respuesta trae `motivo: "whatsapp_no_configurado"`: el
  alta lo avisa.

## Baja de avisos (R-8b)

- El cliente pide la baja contestando BAJA por WhatsApp (R-8a, migración 054). La API la
  registra en `cliente.avisos_baja_en`, que viaja en `GET /datos` y en las respuestas de
  clientes: con eso la ficha dice cuándo la pidió y la lista lo marca. La fecha no se
  escribe desde el front: la 054 no deja.
- Revertirla es `POST /clientes/:id/revertir-baja` (dueño o encargado), con la acción
  `revertirBajaDeAvisos()` de `datos.js`. Devuelve `{ cliente, evento }`; el cliente
  reemplaza al que había. La API no le vuelve a programar el recordatorio a un turno que
  ya estaba anotado: se programa si se mueve.
- Entregar y cambiar de estado traen `sin_aviso: { motivo, mensaje }` cuando no se
  programó el mensaje. El turno trae `recordatorio.motivo: "baja_de_avisos"`, y
  `porQueNoHayAviso()` pone ese motivo antes que el teléfono, como la API.
- Ni el `mensaje` de `sin_aviso` ni el de un error al revertir se muestran: las frases
  salen de `porQueNoSeAviso()` y `errorAlRevertirBaja()` (`lib/recordatorios.js`), por
  código, como pide la sección 07 de la cartilla.

## Vista maestra

Todos bajo `/v1`, con sesión. Los que cambian algo devuelven lo mismo que el `GET`.

| Método | Ruta | Qué hace | Devuelve |
|---|---|---|---|
| `GET` | `/vista-maestra` | Negocios con ficha, grupos y urgencias | `{ negocios, grupos, urgencias: [{ negocio_id, casos_atrasados, stock_bajo }] }` |
| `POST` | `/vista-maestra` | Entrar (hacen falta 2 o más negocios) | `{ negocio_id }` |
| `POST` | `/vista-maestra/negocio` | Mirar otro negocio. Body `{ negocio_id }` | `{ negocio_id }` |
| `DELETE` | `/vista-maestra` | Salir | `{ negocio_id: string \| null }` |
| `PUT` | `/vista-maestra/negocios` | Prender o apagar negocios. Body `{ negocios: [{ id, prendido }] }` | igual que el `GET` |
| `POST` | `/vista-maestra/grupos` | Crear un grupo. Body `{ nombre, negocios: [uuid] }` | igual que el `GET` |
| `PUT` | `/vista-maestra/grupos/:id` | Cambiar un grupo. Body `{ nombre, negocios }` | igual que el `GET` |
| `DELETE` | `/vista-maestra/grupos/:id` | Borrar un grupo | igual que el `GET` |

Errores de la base: `P0001` da 422 `vista_maestra_regla` con el mensaje de la base;
`42501` da 403 `sin_permiso`.

En vista maestra, todo pedido que no sea GET, fuera de estos y de `/cuenta/negocio`,
`/cuenta/preferencias` y `/sesiones`, da 403 `vista_maestra`.

## Respuestas del cliente por WhatsApp (R-10b)

Lo que el cliente contesta a un aviso lo recibe el webhook de Kapso (R-10a, migraciones 069
y 070). La API decide qué quiere decir (`seguimiento/interpretar.ts`) y lo guarda en dos
lugares: el mensaje, en `seguimiento_whatsapp_respuesta`, y lo que cambió, en la fila que
corresponde. El front sólo lee; las tres lecturas están en `datos.js`.

### `GET /seguimiento/respuestas`: la bandeja del negocio

```
GET /v1/seguimiento/respuestas?limite=50&cursor=<siguiente>
→ { ok: true, datos: Respuesta[], siguiente: string | null }

Respuesta = {
  id, negocio_id, cliente_id, caso_id, seguimiento_id,
  contexto_mensaje_id,   // el mensaje que citó en WhatsApp, o null
  mensaje_id, telefono,  // el número que escribió, internacional, o null
  tipo,                  // "text", "audio", "image"…
  texto,                 // lo que escribió, tal cual; null si no es texto
  enviado_en,            // cuándo lo escribió (la hora de WhatsApp)
  creado_en              // cuándo llegó
}
```

- Pagina como todas las listas: de la más vieja a la más nueva por `(creado_en, id)`;
  `limite` hasta 200 (50 si no viene).
- **No trae `contexto`.** Tampoco `contenido`, `contacto_id` ni `numero_emisor_id`: los
  recorta la API.
- **No filtra por cliente.** La ficha lee la bandeja página por página
  (`leerTodasLasRespuestas()`, hasta 10 páginas de 200) y se queda con las de ese cliente.
- Trae todo, también lo que ya resolvió algo. Qué va a la pantalla de la bandeja lo decide
  `respuestasPendientes()` (`lib/recordatorios.js`): sale el mensaje cuyo `enviado_en` es
  el `respuesta_cliente_en` de un turno del mismo cliente (confirmó o avisó que no puede)
  o el `avisos_baja_en` del cliente (la baja). La API guarda esa misma hora en las dos
  filas. Un segundo «sí» que repite lo ya dicho no se anota en el turno, así que queda en
  la bandeja.
- La API no guarda cuáles se leyeron: no hay «marcar como leída».

### `GET /casos/:casoId/seguimiento/respuestas`: las de un caso

```
GET /v1/casos/:casoId/seguimiento/respuestas?limite=50&cursor=<siguiente>
→ { ok: true, datos: (Respuesta & { contexto })[], siguiente }

contexto = {
  seguimiento_id, mensaje_id,
  texto,        // el aviso que le mandamos
  tipo,         // "cierre" | "estado" | "turno" | "volver" | "presupuesto"
  enviado_en,   // cuándo salió el aviso (procesado_en)
  asociacion    // "citada" | "ultimo_aviso"
} | null
```

- `asociacion: "citada"` es que el cliente respondió ese mensaje en WhatsApp; con
  `"ultimo_aviso"`, la API lo asoció al último que le mandamos. `aQueContesto()` afirma lo
  primero y dice lo segundo como deducción («Parece contestar a…»). El aviso se nombra por
  su `tipo`; `contexto.texto` no se muestra.
- 404 `caso_no_encontrado` si el caso no es del negocio.
- **Ojo:** esta lectura hace `select("*")` y **sí** trae `contenido` (lo que mandó Kapso
  tal cual), `contacto_id` y `numero_emisor_id`. `datos.js` los descarta antes de guardar
  nada. Conviene que la API los recorte como en la bandeja.
- Lo que contestan a un recordatorio de turno no tiene caso (`caso_id: null`): sólo está
  en la bandeja, y por eso nunca trae contexto.

### `turno.respuesta_cliente`

`GET /datos` y `GET /turnos` traen el turno entero, con `respuesta_cliente`
(`"confirmo"` | `"no_puede"` | `null`) y `respuesta_cliente_en`. La API sólo lo anota si
el «sí» o el «no» contestan el recordatorio de un turno en pie que todavía no pasó. «No
puede» no cancela el turno: lo marca, y el negocio decide. `respuestaDelTurno()` lo dice en
la agenda, y «todavía no contestó» sólo si el recordatorio ya salió.

### Pendiente en la base

- **La 070** (`supabase/migrations/20261025230000_070_respuesta_a_recordatorio.sql`, en la
  rama `pruebas-locales`) tiene que estar aplicada. Sin ella, lo que contestan a un
  recordatorio de turno no entra (el check de la 069 pedía caso), y si entrara la bandeja
  no lo mostraría.
- Una respuesta que la API identifica sólo por el teléfono (sin aviso) llega con
  `negocio_id` y sin `seguimiento_id`, y el check de la 070 la rechaza. Hoy esas no se
  guardan.
