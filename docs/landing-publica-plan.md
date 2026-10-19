# Landing por negocio, pasos 3 a 5 — plan de implementación

> **Para quien lo ejecute:** usar superpowers:subagent-driven-development,
> tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que el negocio publique su landing y que sus clientes la usen: ver
los datos del negocio, entrar con su identificador y los últimos 4 dígitos del
teléfono, ver sus casos abiertos, sacar turno (registrándose si son nuevos), ver
sus turnos, y abrir el seguimiento de un caso con los colores de la landing.

**Arquitectura:** la base verifica todo con funciones `security definer` que
piden el código de la landing (y la llave del cliente cuando hace falta), como
el seguimiento y la agenda. La API suma un módulo público
`src/modulos/landing/` con límite por IP y códigos de error propios. El front
suma la página pública `/n/[codigo]`, sus secciones, el bloque del link en el
editor, y pinta el seguimiento con `Lienzo`.

**Diseño (autoridad):** [`docs/landing-por-negocio.md`](landing-por-negocio.md),
secciones de los pasos 3 a 5. Los pasos 1 y 2 ya están en `development` y
`master` (columna `negocio.landing`, `PUT /v1/negocio/landing`,
`src/lib/landing.js`, `Lienzo`, `VistaPrevia`, el editor).

**Este plan fija el contrato entre las tres capas** (firmas, formas y errores)
y los casos de prueba de cada tarea. El código lo escribe cada implementador
contra ese contrato, con TDD. Lo que el contrato fija no se cambia sin avisar.

## Reglas para todas las tareas

- Castellano rioplatense en código, comentarios, pruebas y commits; comentarios
  que explican el porqué, como el resto del repo.
- TDD de la cátedra: commit `Test en rojo: …` con la prueba fallando, después el
  cambio. En las tareas de SQL y de pantallas, donde no hay prueba automática que
  corra acá, se dice qué la reemplaza.
- `git add` por nombre. Sin push. No tocar `.env` ni `.env.local`. No matar
  procesos por nombre.
- Cartilla: un solo botón principal por pantalla; `min-h-12`; un botón apagado
  dice por qué (`motivo`); nada de botones de sólo ícono; errores con el ícono
  `alerta` y `text-rojo`; textos para alguien que nunca vio la app, desde el
  celular.
- Next 16: antes de usar una API de Next que no esté ya en el repo, leer
  `node_modules/next/dist/docs/` (AGENTS.md).
- Front: pantallas y componentes nunca importan `@/lib/api` ni nombran la URL de
  la API (`pruebas/fronteras.test.js`): todo pasa por funciones de
  `src/lib/datos.js`.
- Si el build del front falla con `EPERM` en `.next`, es OneDrive: avisar, no
  borrar nada.

Repos y ramas (ya creadas desde `origin/development` y `origin/master`):
- Front: `C:\Users\bauti\OneDrive\Desktop\TP-Ing.-Software-2026c2`, rama `landing-publica`.
- API: `C:\Users\bauti\OneDrive\Desktop\TP-IngeSoft-API`, rama `landing-publica`.

## Decisiones que este plan agrega al diseño

1. **La llave no viaja por `token` en el front.** `api.js` cambia el `token` por el
   de la sesión del dueño (`prepararToken`) y lo manda como `Bearer`. Se suma una
   opción `autorizacion` (el encabezado tal cual, sin pasar por la sesión).
2. **Todas las llamadas de la landing van con `avisarSiVence: false`.** Si no, un
   401 (`datos_incorrectos`, `llave_vencida`) cierra la sesión del dueño que
   tenga la app abierta en el mismo navegador.
3. **"Publicó horarios" lo decide la API** con `horariosListos` (la regla más
   estricta, la misma que la agenda pública), y `GET /landing/:codigo` devuelve
   `horarios` normalizados o `null`. `estadoDeSecciones` suma un tercer
   parámetro `horariosListos` (por defecto `true`, para no romper lo que ya hay).
4. **Con llave, el turno se anota al cliente de la sesión:** si la persona tiene
   varias fichas (una "por confirmar" y otra de verdad), la confirmada más
   reciente; si no hay confirmada, la más reciente.
5. **Las funciones de la base contestan JSON con `ok` y `motivo`, no tiran
   excepciones**, como las de la 024: la API no traduce códigos de Postgres en
   lo público (todo error crudo es 500).
6. **El calendario de turnos se saca a `CalendarioDeTurnos`** y lo usan
   `/turnos/[codigo]` y la landing. `/turnos` no tiene e2e: el cambio tiene que
   ser mecánico y se revisa con lupa.
7. **La vista previa del editor queda con datos de ejemplo.** Las secciones
   reales necesitan datos y llave; no se reemplazan.
8. **El seguimiento se pinta con la landing sólo si está publicada**
   (`landing_codigo` no nulo); ahí suma "← Volver a [negocio]".
9. **El aviso de "dejar de compartir" va en `src/app/casos/[id]/pasos/page.js`**
   (`MandarleElLink`), que es donde está ese botón, no en la pantalla del caso.

## El contrato

### Base — `supabase/053_landing_ingreso.sql`

Idempotente, encabezado como la 052 ("Correr entero… después de la 052").

**Columnas e índices**
- `negocio.landing_codigo text` + `create unique index if not exists negocio_landing_codigo_idx on negocio (landing_codigo)`.
- `turno.identificador text`.
- `normalizar_identificador(p text) returns text`, `language sql immutable`:
  `upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))`.
  (`"ab 123-cd"` → `"AB123CD"`, `null` → `''`.)
- `ultimos_cuatro(p text) returns text`, `language sql immutable`:
  `right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 4)`.
- Índices de expresión: `caso (negocio_id, normalizar_identificador(identificador))`
  y `turno (negocio_id, normalizar_identificador(identificador))`.

**Tablas** (RLS prendida, sin políticas, `revoke all … from anon, authenticated`,
como `solicitud_de_ingreso` en la 051)
- `landing_sesion (huella text primary key, negocio_id uuid not null references negocio on delete cascade, identificador text not null, ultimos4 text not null, vence_en timestamptz not null, creada_en timestamptz not null default now())`.
- `landing_intento (id uuid primary key default gen_random_uuid(), negocio_id uuid not null references negocio on delete cascade, identificador text not null, creado_en timestamptz not null default now())` + índice `(negocio_id, identificador, creado_en)`.

**Compartir** (sólo el dueño, copia de `compartir_agenda`/`dejar_de_compartir_agenda`
de la 024 con `landing_codigo`; mismos grants: `authenticated`)
- `compartir_landing() returns text` — devuelve siempre el mismo código.
- `dejar_de_compartir_landing() returns void`.

**Internas** (`revoke all … from public, anon, authenticated`; sólo las llaman
las de abajo)
- `landing_del_codigo(p_codigo text) returns negocio` — `null` si el código es
  nulo, mide menos de 8, o no es de ningún negocio.
- `clientes_de_la_landing(p_negocio uuid, p_identificador text, p_ultimos4 text) returns setof uuid`
  — los `cliente.id` del negocio con `ultimos_cuatro(telefono) = p_ultimos4`
  (y `length(p_ultimos4) = 4`) que tienen **un caso o un turno** del negocio con
  `normalizar_identificador(identificador) = p_identificador` (que no sea `''`).
- `sesion_de_la_llave(p_negocio uuid, p_llave text) returns landing_sesion` —
  la sesión con `huella = encode(sha256(convert_to(p_llave, 'UTF8')), 'hex')`,
  de ese negocio y con `vence_en > now()`; `null` si no.
- `agenda_del_negocio(n negocio) returns jsonb` — el cuerpo de
  `ver_agenda_publica` después de encontrar el negocio (misma forma).
- `por_que_no_se_reserva(n negocio, p_cuando timestamptz, p_motivo text) returns text`
  — `null` si se puede; si no, el mismo mensaje y el mismo orden que la 024
  (horarios nulos, motivo vacío, anticipación, tope, `hueco_ofrecido`, ocupado).
- `anotar_turno(n negocio, p_cliente uuid, p_cuando timestamptz, p_motivo text, p_identificador text) returns jsonb`
  — inserta el turno (`estado 'agendado'`, `origen 'cliente'`,
  `minutos_reservados`, `identificador`); ante `unique_violation` devuelve
  `{ok:false, motivo:'Justo te lo ganaron. Elegí otro horario.'}`; si no,
  `{ok:true, cuando, minutos}`.

**Las de la 024, por dentro** (misma firma, mismas respuestas)
- `ver_agenda_publica(p_codigo)` → busca por `agenda_codigo` y llama a
  `agenda_del_negocio`.
- `reservar_turno(p_codigo, p_cuando, p_motivo, p_nombre, p_telefono)` → mismo
  orden de chequeos que hoy (código, horarios nulos, nombre, después
  `por_que_no_se_reserva`), crea el cliente "por confirmar", `anotar_turno` con
  `p_identificador = null`, y si no sale borra el cliente.

**Públicas** (`security definer`, `set search_path = public`,
`revoke all … from public; grant execute … to anon, authenticated`)

| Función | Devuelve |
|---|---|
| `ver_landing(p_codigo text)` | `{sirve:false}` o `{sirve:true, negocio:{nombre, telefono, foto, descripcion, rubro, estados}, landing, modulos_activos, horarios}` |
| `ver_agenda_landing(p_codigo text)` | `{sirve:false}` o lo mismo que `ver_agenda_publica` |
| `ingresar_landing(p_codigo text, p_identificador text, p_ultimos4 text)` | `{ok:true, llave, vence_en}` o `{ok:false, motivo}` con motivo `landing_no_encontrada` \| `muchos_intentos` \| `datos_incorrectos` |
| `mis_casos_landing(p_codigo text, p_llave text)` | `{ok:true, casos:[{numero, servicio, identificador, estado, seguimiento_codigo, abierto_en}]}` (abiertos = `estado <> 'completado'`, más nuevos primero) o `{ok:false, motivo}` con `landing_no_encontrada` \| `llave_vencida` |
| `mis_turnos_landing(p_codigo text, p_llave text)` | `{ok:true, turnos:[{empieza_en, minutos_reservados, motivo, estado}]}` (desde ahora, sin cancelados, por fecha) o `{ok:false, motivo}` como arriba |
| `reservar_turno_landing(p_codigo text, p_llave text, p_cuando timestamptz, p_motivo text, p_nombre text, p_telefono text, p_identificador text)` | `{ok:true, cuando, minutos}` (+ `llave, vence_en` si fue registro) o `{ok:false, existe:false, motivo}` (link malo) o `{ok:false, llave_vencida:true}` o `{ok:false, motivo}` |

Reglas de `ingresar_landing`, en este orden:
1. Negocio por código; si no, `landing_no_encontrada`.
2. `id := normalizar_identificador(p_identificador)`, `u4 := regexp_replace(coalesce(p_ultimos4,''), '[^0-9]', '', 'g')`.
3. Borrar intentos de más de un día y sesiones vencidas (limpieza barata, sin cron).
4. Si `id = ''` o tiene más de 40 caracteres: `datos_incorrectos`, sin anotar
   intento (no es de nadie).
5. Si hay **5 o más** intentos de `(negocio, id)` en los últimos **15 minutos**,
   o **20 o más** en el último **día**: `muchos_intentos` (sin anotar otro).
6. Si `length(u4) <> 4` o `clientes_de_la_landing` no trae nada: anotar el intento y `datos_incorrectos`.
7. Si coincide: crear la llave
   (`replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')`,
   64 caracteres), guardar **sólo la huella** con `vence_en = now() + interval '12 hours'`,
   y devolver la llave. Los fallidos no se borran: vencen solos, porque el
   contador lo comparten todos los que tienen ese identificador.

Reglas de `mis_casos_landing`: cada caso abierto de los clientes de la sesión
que no tenga `seguimiento_codigo` lo recibe en ese momento, generado igual que
`compartir_caso` (018: `replace(gen_random_uuid()::text,'-','')` en un loop
contra choques, con `for update`). No se devuelve `caso.nombre` (es interno, 033).

Reglas de `reservar_turno_landing`:
- Con `p_llave`: sesión válida o `{ok:false, llave_vencida:true}`; el cliente es
  el de la decisión 4; el identificador del turno, el de la sesión; ignora
  nombre, teléfono e identificador que vengan.
- Sin `p_llave` (registro): exige nombre no vacío, teléfono con al menos 4
  dígitos ("Necesitamos tu teléfono para que puedas volver a entrar.") e
  identificador que normalizado no sea vacío ni pase de 40 caracteres ("Falta
  con qué te identificamos."). Respeta el bloqueo de `ingresar_landing`
  (bloqueado: `muchos_intentos`) y, si no coincide con nadie, anota un intento.
  Crea el cliente "por confirmar", anota el turno con el identificador tal como
  vino (recortado), y si sale, crea la sesión como `ingresar_landing` y devuelve
  la llave. Si no sale, borra el cliente.
- En los dos, antes de escribir: `por_que_no_se_reserva`. Sin la Agenda prendida
  (`modulos_activos ? 'agenda'`), contesta como sin horarios; lo mismo
  `ver_agenda_landing` (`horarios` nulo).

`ver_seguimiento(p_codigo)`: se reescribe **desde la versión de la 026** sumando
`'landing', n.landing, 'landing_codigo', n.landing_codigo` del negocio del caso.
Nada más cambia.

**Prueba:** `supabase/pruebas/landing.sql`, con el estilo de
`supabase/pruebas/equipo_por_link.sql` (crea, simula sesión o anon con
`set_config`, verifica con `raise exception 'FALLÓ n: …'`, y deshace todo con un
error `deshacer` que se atrapa). Casos:
1. `ver_landing` con código malo → `sirve:false`; con el bueno → nombre y landing.
2. Entrar con identificador + 4 dígitos buenos (con espacios y minúsculas en el identificador) → `ok` y llave de 64.
3. Datos malos → `datos_incorrectos`, siempre el mismo motivo (identificador malo y dígitos malos).
4. Al 5.º fallido → `muchos_intentos`, aunque después vengan los datos buenos; y entrar bien en el medio (4 fallidos, entra, 1 fallido más) no borra los fallidos: el siguiente ya da `muchos_intentos`.
5. Llave vencida (actualizar `vence_en` a pasado como postgres) → `llave_vencida`.
6. Dos clientes con la misma patente y teléfonos distintos: cada uno ve sólo sus casos.
7. Registrarse con la patente de otro y otro teléfono: con esa llave no se ve ningún caso ajeno; el registro cuenta como intento, y bloqueado contesta `muchos_intentos`.
8. Un caso sin link recibe `seguimiento_codigo` al pedir `mis_casos_landing`; un caso completado no aparece.
9. `reservar_turno` y `ver_agenda_publica` de la 024 contestan igual: código malo (`existe:false`), sin horarios, sin nombre, y una reserva buena.
10. Como `anon`, no se puede leer `landing_sesion` ni `landing_intento`, ni llamar a las internas; están los índices de la limpieza (`landing_intento (creado_en)`, `landing_sesion (vence_en)`).
11. `compartir_landing` como encargado → error; como dueño → el mismo código dos veces.
12. Entrar con un registro propio (la patente de otro y el teléfono propio) no desarma el bloqueo; un identificador vacío no suma intentos.
13. Otro cliente confirmado con la misma patente tampoco reinicia el bloqueo.
14. Un identificador de más de 40 caracteres → `datos_incorrectos` (en el registro, "Falta con qué te identificamos.") sin anotar intento; 40 justos sí cuentan.
15. 20 fallidos en el día, espaciados para no caer en los 15 minutos → `muchos_intentos` con los datos buenos (con 19 todavía entra); pasado el día, vencen.
16. Sin la Agenda prendida: `ver_agenda_landing` con `horarios` nulo y `reservar_turno_landing` (con llave y sin) → "El negocio todavía no publicó sus horarios."

### API — `src/modulos/landing/` (rama `landing-publica`)

Se monta con `app.use("/v1/publico/landing", rutasLanding)` en `src/servidor.ts`,
**antes** de `app.use("/v1/publico", rutasPublicas)` y de `sesion`. Usa el
cliente `anonimo`, como `publico`.

| Ruta | Límite por IP | Respuesta |
|---|---|---|
| `GET /:codigo` | 60/60 s | `200 {negocio:{nombre, telefono, foto, descripcion, rubro, estados}, landing, modulos_activos, horarios}` — `horarios` normalizados si `horariosListos`, si no `null` |
| `GET /:codigo/agenda` | 60/60 s | `200` lo mismo que `GET /v1/publico/agenda/:codigo` (`{negocio, horarios, dias}`) |
| `POST /:codigo/ingresar` | 10/60 s | `{identificador, ultimos4}` → `200 {llave, vence_en}` |
| `GET /:codigo/mis-casos` | 60/60 s | con llave → `200 {casos}` |
| `GET /:codigo/mis-turnos` | 60/60 s | con llave → `200 {turnos}` |
| `POST /:codigo/turnos` | 5/60 s | con llave `{empieza_en, motivo}`; sin llave `{empieza_en, motivo, nombre, telefono, identificador}` → `201 {cuando, minutos}` (+ `{llave, vence_en}` si fue registro) |

- La llave: encabezado `Authorization: Llave <llave>`, leído con
  `/^Llave\s+([A-Za-z0-9]{16,128})$/i`. Sin llave en mis-casos o mis-turnos →
  `llave_vencida`.
- Un código que no cumple `/^[A-Za-z0-9]{8,64}$/` → 404 sin ir a la base.
- Errores nuevos (`src/modulos/landing/errores.ts`):

| Código | HTTP | Mensaje |
|---|---|---|
| `landing_no_encontrada` | 404 | "Este link ya no sirve. Pedile uno nuevo al negocio." |
| `datos_incorrectos` | 401 | "Esos datos no coinciden. Revisalos y probá de nuevo." |
| `muchos_intentos` | 429 | "Se hicieron muchos intentos seguidos. Probá de nuevo en unos minutos." (con `Retry-After: 900` cuando viene de la base) |
| `llave_vencida` | 401 | "Pasó un rato desde que entraste. Volvé a poner tus datos." |

- La reserva: antes de escribir, la misma revisión que `publico.reservar`
  (`porQueNoSePuede` con la agenda de la landing → `NoSePuedeReservar`); la
  respuesta "ganaron" → `turno_ocupado`; `muchos_intentos` (el registro
  bloqueado) → 429 `muchos_intentos`; otro `motivo` → `ReservaRechazada`.
- Para no duplicar el armado de la agenda: `src/modulos/publico/casos-de-uso.ts`
  exporta `armarAgenda(agenda, ahora)` (lo que hoy hace `verAgenda` después de
  buscarla) y `verAgenda` lo usa; la landing también.
- Esquemas (zod 4, mensajes en castellano, entran solos en
  `pruebas/casos-de-uso/mensajes.test.ts`): `ingreso` (identificador 1..40,
  `ultimos4` `/^\d{4}$/`), `reservaConLlave` (`empieza_en` fecha ISO, `motivo`
  1..200) y `registro` (lo anterior + `nombre` 1..200, `telefono` con al menos 4
  dígitos, `identificador` 1..40).
- Tipos a mano en `src/lib/database.types.ts`: `negocio.landing_codigo`
  (Row/Insert/Update), `turno.identificador` (Row/Insert/Update) y las funciones
  `compartir_landing`, `dejar_de_compartir_landing` (`Args: never`),
  `ver_landing`, `ver_agenda_landing`, `ingresar_landing`, `mis_casos_landing`,
  `mis_turnos_landing` y `reservar_turno_landing`. Los argumentos que aceptan
  `null` (`p_llave`, `p_nombre`, `p_telefono`, `p_identificador`) se corrigen con
  `ConNulos` en `src/compartido/supabase.ts`, como las otras.
- Compartir desde el editor: `["landing/compartir", "compartir_landing"]` y
  `["landing/dejar-de-compartir", "dejar_de_compartir_landing"]` en `LINKS` de
  `src/modulos/negocio/rutas.ts`, `QueSeComparte` extendido, y el Supabase falso
  elige la columna `landing_codigo` para esas dos.
- En las pruebas, las RPC de la landing se contestan con `mundo.funciones`
  (pruebas/apoyo/supabase-falso.ts): las reglas de verdad están en el SQL y su
  prueba.
- `MIGRACION.md`: la 053 va antes de desplegar esta API.

### Front

**`src/lib/api.js`** — opción `autorizacion`: si viene, el encabezado
`Authorization` es ese texto tal cual y no se toca `token` ni `prepararToken`.
Prueba en `pruebas/api.test.js` con `apiFalsa` (manda `Llave abc…`, no llama a
`prepararToken`, y un 401 con `avisarSiVence:false` no llama a `avisarQueVencio`).

**`src/lib/llave-landing.js`** (puro; se suma a `PUROS` en `pruebas/fronteras.test.js`)
- `leerLlave(codigo, { storage, ahora } = {}) → string | null` — `null` si no hay,
  si venció (`vence_en <= ahora`) o si el storage tira.
- `guardarLlave(codigo, { llave, vence_en }, { storage } = {})`.
- `borrarLlave(codigo, { storage } = {})`.
- Clave `marmanager.landing.<codigo>`; `storage` por defecto
  `globalThis.sessionStorage`, todo envuelto en try/catch, como
  `src/lib/sesion.js`. Pruebas con un storage falso, como `pruebas/sesion.test.js`.

**`src/lib/landing.js`** — `estadoDeSecciones(orden, modulosActivos, horariosListos = true)`:
`sacar_turno` y `mis_turnos` aparecen sólo con Agenda prendida **y**
`horariosListos`; con Agenda prendida y sin horarios, el motivo es
"Aparece cuando publicás tus horarios." Las pruebas de hoy no cambian; se suman
las del caso nuevo. Actualizar los comentarios que dicen que la página pública
llega "más adelante".

**`src/lib/datos.js`** — funciones sueltas exportadas (junto a `buscarAgenda`), todas
sin token y con `avisarSiVence: false`:
- `buscarLanding(codigo)` → `{sirve:true, negocio, landing: normalizarLanding(landing), modulos_activos, horarios}` | `{sirve:false}` (404) | `{sirve:false, problema}` (otro error).
- `agendaDeLanding(codigo)` → igual que `buscarAgenda` (con `agendaDeLaApi`).
- `entrarALanding(codigo, { identificador, ultimos4 })` → guarda la llave y `{ok:true}` | `{ok:false, codigo, mensaje}`.
- `misCasosEnLanding(codigo)` / `misTurnosEnLanding(codigo)` → sin llave guardada, `{ok:false, codigo:'llave_vencida'}` sin pedir nada; con `llave_vencida` de la API, borra la llave.
- `reservarEnLanding(codigo, { cuando, motivo, nombre, telefono, identificador })` → con llave si hay; si la respuesta trae llave (registro), la guarda. Devuelve `{ok:true, cuando, minutos}` | `{ok:false, codigo, mensaje}`.
- `salirDeLanding(codigo)` → borra la llave.
En el proveedor: `compartirLanding()` / `dejarDeCompartirLanding()`, copia de
`compartirAgenda` con `landing_codigo` y `/negocio/landing/compartir` /
`/negocio/landing/dejar-de-compartir`.

**Pantallas y componentes**
- `src/componentes/LinkCompartido.js`: el bloque del link de
  `src/app/negocio/horarios/page.js` (armar, copiar, WhatsApp, dejar de compartir
  con confirmación), con los textos por props. Horarios lo usa con **los mismos
  textos de hoy**; el editor de la landing, con: armar "Publicar la landing",
  `id` `link-landing`, etiqueta "El link de tu landing", explicación "Un link
  para poner en tu Instagram o mandar por WhatsApp. Ahí tus clientes ven tus
  datos, sacan turno y siguen sus casos.", WhatsApp "Hola, te escribimos de
  [negocio]. Acá podés sacar turno y ver cómo viene lo tuyo: [link]", dejar
  "Dejar de compartir la landing" / "¿Dejar de compartir la landing?" / "El link
  deja de funcionar ahora mismo. Tus clientes no pierden nada: sus casos y turnos
  siguen como están." / "Sí, dejar de compartirla" / "Seguir compartiéndola".
- Editor (`src/app/negocio/landing/page.js`): `<TituloSeccion>El link</TituloSeccion>`
  + `LinkCompartido` antes de "Orden"; `estadoDeSecciones` recibe
  `horariosListos(normalizarHorarios(negocio?.horarios))`.
- `src/componentes/Guardia.js`: `esLanding = (ruta) => ruta.startsWith("/n/")`
  (con la barra: `/n` solo agarraría `/negocio`) y se suma a `publica`.
- `src/componentes/CalendarioDeTurnos.js`: sale de `src/app/turnos/[codigo]/page.js`
  (estado `dia`/`cualMes`, el cálculo de días y meses, "Qué día", el calendario,
  y la tarjeta del día con los huecos en franjas). Props: `{ dias, elegido, onElegir }`;
  cambiar de mes o de día llama `onElegir(null)`. `/turnos/[codigo]` lo usa y
  queda igual.
- `src/app/n/[codigo]/page.js`: carga `buscarLanding`; estados cargando / no
  pudimos conectarnos (con `problema`) / link que no sirve; si sirve, `Lienzo`
  con la landing normalizada, encabezado con foto y nombre, y las secciones
  visibles en orden (`estadoDeSecciones(landing.orden, modulos_activos, Boolean(horarios))`).
  Lleva el estado `entrado` (`leerLlave` al montar) y un "Salir" cuando entró.
- `src/componentes/landing/secciones/`: `SeccionNegocio` (nombre, descripción,
  teléfono, botón de WhatsApp al teléfono del negocio, y los horarios si hay),
  `Ingreso` (identificador con el nombre del rubro —`comoSeIdentifica(rubro)`—
  y "Los últimos 4 números de tu teléfono", `inputMode="numeric"`), `SeccionMisCasos`
  (lista con `ChipEstado` y "Ver cómo viene" a `/seguimiento/<código>`),
  `SeccionMisTurnos` y `SeccionSacarTurno` (CalendarioDeTurnos + motivo; si no
  entró, también nombre, teléfono e identificador, y al reservar queda adentro).
- `src/app/seguimiento/[codigo]/page.js`: si `caso.landing_codigo`, la pantalla
  principal va dentro de `Lienzo` (`normalizarLanding(caso.landing)`) y suma un
  enlace "← Volver a [negocio]" a `/n/<landing_codigo>`.
- `src/app/casos/[id]/pasos/page.js` (`MandarleElLink`): en la confirmación de
  "Dejar de compartirlo", si el negocio tiene `landing_codigo`, una línea: "Si tu
  cliente entra por tu landing, va a seguir viendo este caso." Sin cambiar los
  textos de los botones (los usa una e2e).
- `src/componentes/landing/VistaPrevia.js`: sólo actualizar el comentario.

**e2e** — `pruebas/e2e/historias/landing-publica.e2e.js` (la siembra no trae
agenda ni horarios: se prenden por la UI, como `recordatorio-turno.e2e.js`).
Escenario `taller-completo`: Marcela (`341 456 7890`) tiene k248 `AB123CD`
"Revisión general", k239 `AA000AA` "Reparación de motor" y k210 `ZZ999ZZ`
"Frenos" (completado); Lucía (`341 555 1111`) tiene k253 `AC456EF`.

---

### Tarea 1: la base — `053_landing_ingreso.sql` y su prueba

**Archivos (front):** crear `supabase/053_landing_ingreso.sql` y
`supabase/pruebas/landing.sql`.

- [ ] Leer enteras, en `origin/development`: `supabase/024_pedir_turno.sql`,
  `supabase/026_pago_en_el_seguimiento.sql` (la última `ver_seguimiento`),
  `supabase/018_seguimiento.sql` (`compartir_caso`), `supabase/051_equipo_por_link.sql`
  (tablas sin políticas, grants), `supabase/052_landing.sql` (encabezado) y
  `supabase/pruebas/equipo_por_link.sql` y `pedido_idempotente.sql` (cómo se
  prueba, cómo se simula anon).
- [ ] Escribir `supabase/pruebas/landing.sql` con los 11 casos del contrato.
  Commit `Test en rojo: no hay ingreso de clientes a la landing` (antes de la
  053, la prueba falla porque las funciones no existen).
- [ ] Escribir `supabase/053_landing_ingreso.sql` según el contrato. Cada función
  con su comentario del porqué. Commit.
- No se puede correr acá (no hay base). La revisión la lee contra el contrato; la
  persona corre la 053 y después la prueba en el SQL Editor (antes de la 053
  tiene que fallar; después, "Success").

### Tarea 2: la API — compartir la landing

**Archivos (API):** `src/modulos/negocio/{rutas,repositorio}.ts`,
`src/lib/database.types.ts` (`landing_codigo` y las dos funciones de compartir),
`pruebas/apoyo/supabase-falso.ts` (columna `landing_codigo`),
`pruebas/contrato/recursos-restantes.test.ts`.

- [ ] Rojo: en `recursos-restantes.test.ts`, `POST /v1/negocio/landing/compartir`
  como dueña da 200 con un código, el mismo la segunda vez, sin tocar
  `agenda_codigo`; `dejar-de-compartir` da `codigo: null` y deja
  `landing_codigo` en null; como técnico, 403.
- [ ] Verde: LINKS, `QueSeComparte`, tipos y el falso. `npm run tipos` y `npm test`.

### Tarea 3: la API — el módulo público de la landing

**Archivos (API):** crear `src/modulos/landing/{rutas,casos-de-uso,repositorio,esquemas,errores}.ts`,
`pruebas/casos-de-uso/landing.test.ts`, `pruebas/contrato/landing.test.ts`;
modificar `src/servidor.ts`, `src/modulos/publico/casos-de-uso.ts` (`armarAgenda`),
`src/lib/database.types.ts`, `src/compartido/supabase.ts` (`ConNulos`), `MIGRACION.md`.

- [ ] Rojo — casos de uso (repo falso tipado, `AHORA` fijo, como
  `pruebas/casos-de-uso/publico.test.ts`):
  - código con forma inválida → 404 `landing_no_encontrada` sin llamar al repo;
  - `verLanding` devuelve `horarios: null` si los horarios no están listos y normalizados si sí;
  - `ingresar`: motivos de la base → 404 / 401 `datos_incorrectos` / 429 `muchos_intentos`; ok → `{llave, vence_en}`; `ultimos4` que no son 4 dígitos → ZodError;
  - `misCasos`/`misTurnos`: sin llave → 401 `llave_vencida` sin llamar al repo; motivo `llave_vencida` → 401;
  - `reservar` con llave: horario no ofrecido → 422 `horario_no_disponible` sin llamar al repo; `{llave_vencida:true}` → 401; "ganaron" → 409 `turno_ocupado`; ok → `{cuando, minutos}`;
  - `reservar` sin llave: falta nombre/teléfono/identificador → ZodError; ok trae `llave`.
- [ ] Rojo — contrato (`mundo.funciones` para las RPC, código al azar por test
  para el límite, como `pruebas/contrato/publico.test.ts`):
  - `GET /v1/publico/landing/:codigo` 200 / 404; `POST …/ingresar` 200 con llave, 401, 429 por la base y 429 por IP al 11.º;
  - `GET …/mis-casos` con `Authorization: Llave <llave>` pasa la llave a la RPC; sin encabezado → 401 `llave_vencida`; con `Bearer x` → 401;
  - `POST …/turnos` 201 (con y sin llave);
  - las RPC salen con la anon key (`mundo.autorizaciones`, como `auth.test.ts:195-203`), nunca con la llave.
- [ ] Verde según el contrato. `armarAgenda` sin cambiar lo que contesta
  `GET /v1/publico/agenda/:codigo` (sus pruebas siguen verdes). `npm run tipos`
  y `npm test`.

### Tarea 4: el front — lo que no se ve

**Archivos (front):** `src/lib/api.js`, crear `src/lib/llave-landing.js`,
`src/lib/landing.js`, `src/lib/datos.js`, `pruebas/api.test.js`, crear
`pruebas/llave-landing.test.js`, `pruebas/landing.test.js`, `pruebas/fronteras.test.js`.

- [ ] Rojo: las pruebas de `autorizacion` en `api.test.js`; las de
  `llave-landing.test.js` (guardar/leer/borrar; vencida → null; storage que tira
  → null y no explota; clave por código); las de `estadoDeSecciones` con
  `horariosListos=false` (Agenda prendida → no visible con el motivo nuevo;
  Agenda apagada → el motivo de siempre). Commit en rojo.
- [ ] Verde: implementar. Las funciones de `datos.js` no tienen prueba unitaria
  (datos.js queda fuera de Jest): las cubre la e2e de la Tarea 8.
  `npm run test:unit` (sin fallas nuevas) y `npm run build`.

### Tarea 5: el front — el link en el editor

**Archivos (front):** crear `src/componentes/LinkCompartido.js`; modificar
`src/app/negocio/horarios/page.js`, `src/app/negocio/landing/page.js`,
`src/componentes/Guardia.js`.

- [ ] Sacar el bloque a `LinkCompartido` sin cambiar nada de lo que se ve en
  `/negocio/horarios` (mismos textos, mismo `id="link-agenda"`, misma
  confirmación). Usarlo en el editor con los textos del contrato, con
  `datos.compartirLanding` / `datos.dejarDeCompartirLanding`.
- [ ] Guardia con `/n/`. El editor pasa `horariosListos` a `estadoDeSecciones`.
- [ ] Sumar a `pruebas/e2e/historias/landing-editor.e2e.js` un test
  "SCRUM-196: publica el link de la landing y lo deja de compartir" (Publicar →
  `#link-landing` contiene `/n/` → Dejar de compartir → confirmar → vuelve el
  botón de publicar). `node --check`.
- [ ] `npm run test:unit` y `npm run build`.

### Tarea 6: el front — `CalendarioDeTurnos`

**Archivos (front):** crear `src/componentes/CalendarioDeTurnos.js`; modificar
`src/app/turnos/[codigo]/page.js`.

- [ ] Mover, no reescribir: el estado del calendario, el cálculo y el render
  pasan al componente con props `{ dias, elegido, onElegir }`. La página de
  turnos conserva la carga, el formulario y los estados. El diff de la página
  tiene que leerse como un recorte. `npm run build` (y que `/turnos/[codigo]`
  siga en la lista de rutas).

### Tarea 7: el front — la página pública, el ingreso y Mis casos

**Archivos (front):** crear `src/app/n/[codigo]/page.js`,
`src/componentes/landing/secciones/{SeccionNegocio,Ingreso,SeccionMisCasos}.js`;
modificar `src/app/seguimiento/[codigo]/page.js`,
`src/app/casos/[id]/pasos/page.js`, `src/componentes/landing/VistaPrevia.js`
(comentario).

- [ ] La página según el contrato, con "Sacar turno" y "Mis turnos" como
  secciones que todavía no se dibujan (la Tarea 8 las suma: dejar el mapa de
  componentes listo para sumarlas).
- [ ] El seguimiento con Lienzo y "Volver"; el aviso en `MandarleElLink`.
- [ ] `npm run test:unit` y `npm run build` (con `/n/[codigo]` en las rutas).

### Tarea 8: el front — Sacar turno, Mis turnos y la e2e

**Archivos (front):** crear `src/componentes/landing/secciones/{SeccionSacarTurno,SeccionMisTurnos}.js`
y `pruebas/e2e/historias/landing-publica.e2e.js`; modificar `src/app/n/[codigo]/page.js`.

- [ ] Las dos secciones según el contrato. Al reservar sin estar adentro, queda
  adentro (la llave del registro) y "Mis turnos" muestra el turno.
- [ ] La e2e (no se puede correr acá: `node --check` y cruzar los selectores
  con el código). Casos:
  1. El dueño publica la landing desde el editor y abre el link: ve el nombre del negocio y "Mis casos" pide los datos.
  2. Marcela entra con `ab 123-cd` + `7890`: ve "Revisión general" y "Reparación de motor", no "Frenos".
  3. Con `AB123CD` + `0000`: "Esos datos no coinciden"; no ve casos.
  4. Desde "Mis casos" abre un caso: el seguimiento muestra "Volver a Taller Sur".
  5. Con Agenda prendida y los horarios de fábrica guardados, alguien nuevo saca turno desde la landing (nombre, teléfono `341 999 0000`, identificador `AD111AA`): ve la confirmación y el turno en "Mis turnos".
  Commit en rojo de la e2e antes de las secciones.
- [ ] `npm run test:unit` y `npm run build`.
- [ ] `docs/landing-por-negocio.md`: el estado (pasos 3 a 5 hechos; falta correr
  la 053, su prueba y las e2e) y las decisiones de este plan donde el diseño
  decía otra cosa.
