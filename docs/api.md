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

## El interruptor: qué recursos pasan por la API

El front migra de a un recurso por vez. Qué recursos ya hablan con la API lo dice **`NEXT_PUBLIC_API_RECURSOS`**, una lista separada por comas:

```text
NEXT_PUBLIC_API_RECURSOS=inventario
```

Hasta que un recurso está en la lista, sus acciones de `datos.js` siguen hablando con Supabase como siempre. Prenderlo o apagarlo es cambiar la variable en Vercel y volver a desplegar: no hay que tocar código, y si algo anda mal se vuelve atrás igual de rápido. En el modo de ejemplo no aplica (no hay sesión ni servidor).

| Recurso | Qué pasa por la API cuando está prendido | Qué sigue por Supabase |
|---|---|---|
| `inventario` | Agregar (`POST /insumos`), escribir la cantidad (`PATCH /insumos/:id`), sumar o restar (`POST /insumos/:id/ajustar`) y borrar (`DELETE /insumos/:id`) | La lectura, que llega con todo lo demás hasta que exista `GET /v1/datos`. Pedir un insumo y marcar que llegó, que van con casos |
| `turnos` | La agenda: anotar un turno (`POST /turnos`), confirmar, cancelar y deshacer (`PATCH /turnos/:id`), "ya vino" y deshacerlo (`POST /turnos/:id/atender` y `/desatender`), los horarios (`PUT /negocio/horarios`). **Y la página pública de pedir turno** (`GET /publico/agenda/:codigo` y `POST /publico/agenda/:codigo/turnos`): los huecos los calcula la API | La lectura de la agenda del negocio. Compartir o dejar de compartir el link y el calendario (siguen por las funciones de la base) |
| `casos` | Abrir, editar, asignar, mover, reabrir, notas, compartir, presupuesto, pedidos, cobros, entrega y pago desde seguimiento | La carga inicial de listas, hasta que exista `GET /v1/datos` |

Cómo se comporta cada acción:

- **Anotar un turno** espera la respuesta de la API, como agregar un producto: si el horario ya está tomado, el aviso lo dice ("Ya hay un turno a esa hora") y el formulario queda con lo escrito, para cambiar la hora. El botón queda apagado mientras tanto.
- **Confirmar, cancelar, "ya vino" y los horarios** se ven al instante y van por atrás; si la API dice que no (por ejemplo, deshacer una cancelación cuando otro tomó el lugar), avisa y se vuelve a leer todo.
- **La página pública** recibe los días y los huecos ya armados por la API y no calcula nada. Si la API no conoce el código, se busca en el navegador (los links del modo de ejemplo siguen andando). Si la API no contesta, la página dice "No pudimos abrir la agenda" y no "este link ya no sirve".
- **Agregar** espera la respuesta de la API, porque es la API la que decide si se suma a uno igual. Mientras espera, el botón queda apagado ("se está guardando"): un segundo toque sería otro pedido y sumaría dos veces. Si la API dice que no, el aviso muestra su mensaje y el formulario queda abierto con lo escrito.
- **Sumar, restar, escribir la cantidad y borrar** se ven al instante y se mandan por atrás. Si la API dice que no, el aviso muestra su mensaje y se vuelven a leer los datos, para que la pantalla no muestre algo que no pasó. Sumar y restar mandan cuánto (`delta`), no el número final: dos personas tocando "+" a la vez suman las dos.

Los tests de todo esto están en [pruebas/api.test.js](../pruebas/api.test.js), contra una API de mentira.
