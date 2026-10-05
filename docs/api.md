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

## La dirección

Sale de `NEXT_PUBLIC_API_URL`. `api.js` acepta la raíz, la dirección anterior terminada en `/payments` y la nueva terminada en `/v1`; normaliza cualquiera de las tres antes de armar las rutas.

- `api.js` → raíz + `/v1`: las rutas se escriben `"/insumos"`, no `"/v1/insumos"`.
- `pagos.js` → raíz + `/v1`: cobros, Mercado Pago y seguimiento usan el contrato nuevo.

Así anda igual con el valor de hoy y con la raíz sola. Cuando se decida, se cambia en Vercel a `https://tp-ingesoft-api.onrender.com` sin tocar código.

Mientras esté vacía, cualquier llamada devuelve un error con código `sin_api` y no sale ningún pedido.

## Estado de la migración

Las cuentas reales usan siempre `/v1`: sesión, carga inicial y los ocho recursos de la aplicación pasan por la API. Ya no existe un interruptor por recurso ni un camino alternativo desde el navegador hacia Supabase.

El modo de ejemplo sigue siendo local y no usa servidor. Se conserva hasta que producto decida retirarlo y se reemplacen las pruebas de recorrido que lo usan.

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
- Después de confirmar un cierre con seguimiento, si el mensaje utilizado cambió
  respecto del texto cargado, se guarda con `PATCH /negocio/seguimiento` enviando
  sólo `mensaje`. Se comparan los textos sin espacios en los extremos. Si ese
  guardado falla, se muestra un aviso y el cierre sigue confirmado.
- Si el negocio tiene el seguimiento desactivado, el formulario permite activarlo
  con `PATCH /negocio/seguimiento` antes de solicitarlo para un caso.
- Un fallo del envío se muestra aparte del cambio de estado o cierre confirmado.
