# Textos en tono formal

Aprobado el 2026-10-18, con las decisiones D1 a D5 como están propuestas.
Todavía no se editó código.

El equipo decidió, durante el diseño de roles (`docs/roles.md`, "Textos"), que
los textos de la aplicación dejan de usar voseo y giros coloquiales: tienen que
ser serios y entendibles, en tono formal e impersonal. La funcionalidad de roles
ya usa el tono nuevo. Este documento cubre el resto: la regla nueva, el
inventario de lo que hay que cambiar y el orden para hacerlo.

## 1. La regla

### Dónde vive hoy

- **`Cartilla de diseño.pdf`, versión 1.** Es la regla que pide hablarle al
  usuario de vos y en registro coloquial. El PDF no está en el repositorio ni
  en esta máquina: el README lo nombra (`README.md:11`) pero no lo versiona.
  Como la cartilla es normativa ("si una decisión de diseño choca con la
  cartilla, gana la cartilla"), su regla de tono sigue vigente hasta que algo
  escrito diga lo contrario.
- **`README.md`.** "Reglas de la cartilla que el código ya hace cumplir"
  (`README.md:160`) no menciona el tono. La sección "Decisiones que se apartan
  de la cartilla" (`README.md:192`) es el lugar donde el equipo deja escrito
  qué reglas de la cartilla no se cumplen a propósito. Ahí tiene que ir la
  decisión.
- **Comentarios del código.** `src/lib/presets.js:41-43` dice que el link de
  seguimiento "le habla de vos como el resto de esa pantalla".
- **Un texto de la pantalla.** `src/app/bienvenida/page.js:771-772` le promete
  al visitante que el sistema "pasa a hablar como vos".

### Texto nuevo para el README

Se agrega como tercer punto de "Decisiones que se apartan de la cartilla":

> - **Los textos son formales e impersonales, sin voseo.** La cartilla pide
>   hablarle al usuario de vos y en registro coloquial; esa regla deja de
>   aplicarse. Los textos tienen que ser serios y entendibles para cualquier
>   persona:
>   - Se prefiere la forma impersonal o nominal: «Este rol no incluye ese
>     permiso», «Sólo lectura», «Cambios guardados», «No se pudo guardar».
>   - Cuando hay que pedirle algo a quien usa la aplicación, se lo trata de
>     usted: «Escriba el nombre del negocio», «Revise el teléfono».
>   - Nunca vos ni tú: nada de «podés», «tenés», «elegí», «tu negocio».
>   - Sin giros coloquiales: «Listo, …», «Justo te lo ganaron», «plata»,
>     «prender un módulo».
>   - Vale para todo lo que se lee: pantallas internas, lo que ve el cliente
>     del negocio (link de seguimiento, pedir turno, mails, mensajes de
>     WhatsApp que arma el sistema) y los mensajes de error de la API y de
>     las funciones SQL.
>   - Los comentarios del código no son textos de la aplicación y quedan como
>     están.

En el mismo cambio:

- `src/lib/presets.js:41-43`: el comentario pasa a decir que el seguimiento
  habla el negocio, en primera persona del plural, y trata al cliente de usted
  («su vehículo»).
- Cuando exista la prueba del punto 10 del plan, la regla se suma también a
  "Reglas de la cartilla que el código ya hace cumplir", como «Sin voseo».

## 2. Inventario

### Cómo se contó

Un script recorrió cada archivo sin sus comentarios y marcó las palabras con
forma de segunda persona: presente de vos (`podés`, `tenés`, `elegís`),
imperativo (`elegí`, `tocá`, `probá`), imperativo con pronombre (`escribilo`,
`pedile`, `fijate`), pretérito (`aprobaste`, `configuraste`), subjuntivo
(`quieras`, `tengas`) y pronombres (`vos`, `te`, `tu`, `tus`, `tuyo`).
Después se revisó a mano la lista de palabras para sacar lo que no es voseo
(`más`, `está`, `className`, `parte`…).

- **Líneas**: líneas con al menos una marca. Es la medida de trabajo.
- **Marcas**: palabras marcadas.
- Es un piso: los giros coloquiales sin voseo («Listo, …», «plata», «sumar
  gente») no entran en la cuenta. Sólo «Listo,» aparece 81 veces y «No
  pudimos», 15.
- Entra la ruta `/confirma-tu-mail` (`Guardia.js`, `crear-cuenta`): es una URL,
  no un texto. Ver decisión D4.

### Resumen

| Grupo | Archivos | Líneas | Marcas |
|---|---:|---:|---:|
| `src/app/` | 35 | 370 | 513 |
| `src/componentes/` | 20 | 77 | 99 |
| `src/lib/` | 17 | 89 | 133 |
| `supabase/plantillas/` (mail) | 1 | 5 | 13 |
| `supabase/*.sql` | 15 | 58 | 73 |
| API: `src/modulos/*/errores.ts` | 8 | 24 | 31 |
| API: resto de `src/` (agregado el 2026-10-19) | 26 | 76 | 109 |
| **Total** | **122** | **699** | **971** |

Además, las pruebas comparan varios de estos textos y hay que cambiarlas junto
con cada paso: unas 119 líneas en 37 archivos de `pruebas/` del front, 7 en
`supabase/pruebas/` y 75 en 28 archivos de `pruebas/` de la API.

`src/lib/permisos.js` no tiene voseo, pero sí registro coloquial («Sumar y
sacar gente lo hace el dueño del negocio»). El plan de roles lo reemplaza por
un catálogo con textos nuevos, así que no entra en este inventario.

### `src/app/`

| Archivo | Líneas | Marcas |
|---|---:|---:|
| `seguimiento/[codigo]/page.js` | 41 | 56 |
| `perfil/page.js` | 29 | 41 |
| `negocio/horarios/page.js` | 27 | 35 |
| `casos/[id]/page.js` | 26 | 36 |
| `negocio/page.js` | 25 | 33 |
| `casos/[id]/pasos/page.js` | 23 | 29 |
| `turnos/[codigo]/page.js` | 18 | 24 |
| `crear-negocio/page.js` | 17 | 26 |
| `bienvenida/page.js` | 16 | 25 |
| `crear-cuenta/page.js` | 12 | 14 |
| `inventario/page.js` | 12 | 18 |
| `page.js` (Inicio) | 12 | 22 |
| `ecuaciones/page.js` | 11 | 13 |
| `confirma-tu-mail/page.js` | 10 | 17 |
| `unirme/[codigo]/page.js` | 10 | 19 |
| `casos/nuevo/page.js` | 8 | 10 |
| `negocio/landing/page.js` | 8 | 10 |
| `recuperar-contrasena/page.js` | 8 | 11 |
| `inventario/en-camino/page.js` | 7 | 8 |
| `negocio/recordatorios/page.js` | 6 | 11 |
| `iniciar-sesion/page.js` | 5 | 6 |
| `negocios/page.js` | 5 | 7 |
| `nueva-contrasena/page.js` | 5 | 6 |
| `negocio/modulos/page.js` | 4 | 7 |
| `agenda/page.js` | 3 | 4 |
| `api/google-calendar/route.js` | 3 | 3 |
| `clientes/[id]/page.js` | 3 | 3 |
| `equipo/page.js` | 3 | 4 |
| `inventario/sedes/page.js` | 3 | 4 |
| `perfil/TusNegocios.js` | 3 | 3 |
| `agenda/calendario/page.js` | 2 | 2 |
| `casos/page.js` | 2 | 3 |
| `aprobar/page.js` | 1 | 1 |
| `clientes/page.js` | 1 | 1 |
| `historial/page.js` | 1 | 1 |

### `src/componentes/`

| Archivo | Líneas | Marcas |
|---|---:|---:|
| `Cobros.js` | 19 | 23 |
| `VincularGoogleCalendar.js` | 11 | 19 |
| `Producto.js` | 8 | 13 |
| `SumarAlEquipo.js` | 8 | 10 |
| `Guardia.js` | 5 | 5 |
| `SedesVinculadas.js` | 4 | 6 |
| `SeguimientoWhatsApp.js` | 3 | 3 |
| `landing/VistaPrevia.js` | 3 | 3 |
| `Aviso.js` | 2 | 2 |
| `ConfiguracionEstados.js` | 2 | 2 |
| `CuandoVuelve.js` | 2 | 2 |
| `inicio/cuerpos.js` | 2 | 2 |
| `AltaDeTurno.js` | 1 | 1 |
| `BotonGoogle.js` | 1 | 1 |
| `ConexionMercadoPago.js` | 1 | 1 |
| `inicio/Modulo.js` | 1 | 2 |
| `MoverTurno.js` | 1 | 1 |
| `PantallaEntrada.js` | 1 | 1 |
| `ResumenRecordatorios.js` | 1 | 1 |
| `SelectorEstado.js` | 1 | 1 |

### `src/lib/`

| Archivo | Líneas | Marcas | Qué hay |
|---|---:|---:|---|
| `presets.js` | 20 | 23 | Frases del seguimiento por rubro («Ya anotamos tu vehículo») |
| `modulos.js` | 12 | 23 | Descripción de cada módulo |
| `datos.js` | 11 | 24 | Errores locales («Tu sesión venció. Volvé a entrar y probá de nuevo.») |
| `seguimiento.js` | 10 | 14 | Mensajes de WhatsApp al cliente |
| `api.js` | 8 | 12 | Mensaje por código HTTP (401, 403, 409, 422, 429, sin conexión) |
| `recordatorios.js` | 7 | 7 | Validaciones y explicación del plazo |
| `inicio.js` | 4 | 4 | Qué muestra cada módulo del Inicio |
| `ingreso-google.js` | 3 | 8 | Errores del ingreso con Google |
| `landing.js` | 3 | 6 | Secciones de la landing |
| `horarios.js` | 2 | 3 | Validaciones |
| `cobros.js` | 2 | 2 | Mensaje de cobro por link |
| `seguimiento-whatsapp.js` | 2 | 2 | Validaciones |
| `auth.js` | 1 | 1 | «Este link no existe. Fijate que esté completo.» |
| `ecuaciones.js` | 1 | 1 | «Ingresá un valor para…» |
| `equipo.js` | 1 | 1 | «Sumate al equipo de…» |
| `pagos.js` | 1 | 1 | Motivo técnico para quien configura (`corregí NEXT_PUBLIC_API_URL`) |
| `validaciones.js` | 1 | 1 | «repetila igual abajo» |

### Mail: `supabase/plantillas/restablecer-contrasena.html`

5 líneas, 13 marcas: el asunto y el cuerpo («Restablecé tu contraseña», «Si no
lo pediste vos, ignorá este mail»). Se copia a mano en Supabase → Auth → Email
Templates, así que cambiar el archivo no alcanza.

### Funciones SQL: `supabase/*.sql`

Las migraciones ya corridas no se editan: los mensajes se cambian con una
migración nueva que redefine cada función. Sólo importa la **última**
definición de cada una; las anteriores quedan como historia.

| Función | Última definición | Líneas | Aparece en `roles-plan.md` |
|---|---|---:|---|
| `reservar_turno` | `024_pedir_turno.sql` | 9 | no |
| `responder_paso_desde_el_link` | `022_el_cliente_destraba.sql` | 5 | no |
| `aceptar_invitacion` | `038_multinegocio.sql` | 4 | sí |
| `guardar_preferencias_de_entrada` | `038_multinegocio.sql` | 3 | no |
| `pedir_entrar` | `051_equipo_por_link.sql` | 3 | sí |
| `ver_invitacion` | `051_equipo_por_link.sql` | 3 | sí |
| `aprobar_solicitud` | `051_equipo_por_link.sql` | 2 | sí |
| `entrar_al_negocio` | `038_multinegocio.sql` | 2 | sí |
| `guardar_mi_perfil` | `034_mi_perfil.sql` | 2 | no |
| `marcar_paso_hecho` | `021_paso_hecho.sql` | 2 | sí |
| `vincular_sede` | `047_red_de_sedes.sql` | 2 | sí |
| `compartir_caso` | `018_seguimiento.sql` | 1 | sí |
| `dejar_de_compartir_caso` | `018_seguimiento.sql` | 1 | no |
| `quitar_acceso_al_sacar` | `038_multinegocio.sql` | 1 | sí |
| `registrar_cobro` | `025_cobros.sql` | 1 | sí |
| `registrar_cobro_en_linea_api` | `041_cobro_en_linea_atomico.sql` | 1 | no |
| `rol_de_la_ficha_da_permisos` | `038_multinegocio.sql` | 1 | sí |
| **Vigentes** | | **43** | 22 en funciones que nombra roles |

Las otras 15 líneas están en definiciones ya reemplazadas (`007`, `019`, `036`,
`037`) o en un aviso de migración para quien la corre (`023`, `raise warning`).
No se tocan.

### API: `TP-IngeSoft-API/src/modulos/*/errores.ts`

| Archivo | Líneas | Marcas |
|---|---:|---:|
| `auth/errores.ts` | 7 | 10 |
| `publico/errores.ts` | 7 | 9 |
| `casos/errores.ts` | 3 | 4 |
| `presupuesto/errores.ts` | 2 | 3 |
| `turnos/errores.ts` | 2 | 2 |
| `cobros/errores.ts` | 1 | 1 |
| `ecuaciones/errores.ts` | 1 | 1 |
| `negocio/errores.ts` | 1 | 1 |

### API: el resto de `src/`

Agregado el 2026-10-19: la primera cuenta sólo miraba `errores.ts`. Hay voseo
también en los mensajes de validación de los esquemas (zod), en los
middlewares y en los mensajes de WhatsApp por defecto del seguimiento.

| Archivo | Líneas | Marcas | Qué hay |
|---|---:|---:|---|
| `modulos/seguimiento/configuracion.ts` | 13 | 33 | Mensajes de WhatsApp por defecto al cliente («cómo fue tu experiencia») |
| `modulos/publico/esquemas.ts` | 8 | 12 | Validaciones del link público |
| `modulos/casos/esquemas.ts` | 7 | 8 | Validaciones |
| `modules/payments/case-payments.ts` | 6 | 6 | «Iniciá sesión como dueño o encargado.» |
| `modulos/cobros/esquemas.ts` | 5 | 5 | Validaciones |
| `modulos/seguimiento/estado.ts` | 4 | 6 | «Tu caso» |
| `modulos/cuenta/esquemas.ts` | 3 | 3 | Validaciones |
| `modulos/negocio/esquemas.ts` | 3 | 3 | Validaciones |
| `modulos/seguimiento/configuracion-repositorio.ts` | 3 | 3 | «No tenés permiso…» |
| `compartido/version.ts` | 2 | 4 | «Volvé a abrir la pantalla y probá de nuevo.» |
| `modules/payments/payments.controller.ts` | 2 | 2 | «Iniciá sesión…» |
| `modulos/auth/esquemas.ts` | 2 | 2 | «Falta tu nombre.» |
| `modulos/equipo/esquemas.ts` | 2 | 2 | «Elegí un rol válido.» |
| `modulos/presupuesto/esquemas.ts` | 2 | 2 | «Escribí el monto…» |
| `modulos/publico/casos-de-uso.ts` | 2 | 4 | «No pudimos anotarte. Probá de nuevo.» |
| `compartido/quien-soy.ts` | 1 | 1 | «Todavía no estás en ningún negocio.» |
| `http/middlewares/idempotencia.ts` | 1 | 2 | «Esperá un momento…» |
| `http/middlewares/limite.ts` | 1 | 1 | «Probá de nuevo en un minuto.» |
| `http/middlewares/limite-token.ts` | 1 | 1 | Ídem |
| `http/middlewares/sesion.ts` | 1 | 1 | «Tenés que iniciar sesión.» |
| `modulos/seguimiento/respuestas-repositorio.ts` | 1 | 1 | «No pudimos guardar…» |
| `modulos/seguimiento/webhook.ts` | 1 | 1 | «Configurá el webhook…» (para quien configura) |
| `modulos/semilla/esquemas.ts` | 1 | 1 | «Mandá los datos…» (para quien configura) |
| `index.ts`, `config.ts`, `modulos/seguimiento/procesador.ts` | 4 | 5 | Mensajes de consola para quien corre el servidor |

Los mensajes de consola no son textos de la aplicación; se pueden dejar como
están. Los esquemas y middlewares se suman al paso 1 (la API); los mensajes de
WhatsApp de `seguimiento/` van con el paso 3. Además, el doble de Supabase de
las pruebas (`pruebas/apoyo/supabase-falso.ts`) copia mensajes del SQL y se
cambia con el paso 9.

### Mensajes repetidos en varios lugares

El mismo texto está escrito en el front, en la API y en el SQL. Hay que
cambiarlos juntos para que la persona no vea dos versiones del mismo error:

| Mensaje de hoy | Dónde |
|---|---|
| «Tu sesión venció. Volvé a entrar (y probá de nuevo).» | `lib/api.js`, `lib/datos.js` (×5), `VincularGoogleCalendar.js` (×2), `auth/errores.ts` |
| «El caso ya se entregó. Volvé a abrirlo si hay algo que corregir.» | `lib/datos.js`, `021_paso_hecho.sql`, `presupuesto/errores.ts` |
| «Este trabajo ya se entregó. Si querés agregar algo, hablá con el negocio.» | `022_el_cliente_destraba.sql`, `publico/errores.ts` |
| «Justo te lo ganaron. Elegí otro horario.» y los otros de reservar turno | `024_pedir_turno.sql`, `publico/errores.ts` |
| «Este link no existe. Fijate que esté completo.» / «Pedí uno nuevo.» | `lib/auth.js`, `051_equipo_por_link.sql` |
| «Elegí link o QR.» | `lib/datos.js`, `041_cobro_en_linea_atomico.sql` |
| «El teléfono no es válido. Escribilo con característica…» | 6 pantallas: `casos/nuevo`, `clientes`, `clientes/[id]`, `crear-cuenta`, `negocio`, `perfil` |
| «Elegí una cantidad de días enteros entre 0 y 3650.» / «Escribí el mensaje…» | `lib/recordatorios.js`, `lib/seguimiento-whatsapp.js` |

## 3. Plan

### Decisiones antes de empezar

- **D1. Usted o impersonal.** Se propone: impersonal o nominal por defecto
  («Cambios guardados», «Falta el teléfono»); usted sólo cuando hay que pedir
  una acción («Escriba», «Revise»). Es lo que ya hace roles.
- **D2. El cliente del negocio también.** El link de seguimiento, pedir turno,
  el mail y los mensajes de WhatsApp los lee el cliente del taller o del
  consultorio, no el usuario del sistema. Se propone que vayan en el mismo
  tono, tratando de usted («Su vehículo está listo y entregado»). Los textos
  que el negocio escribe a mano (por ejemplo, el mensaje de un recordatorio
  ya guardado) no se tocan: son suyos.
- **D3. Mensajes de éxito.** Hoy casi todos empiezan con «Listo, …». Se propone
  la forma nominal sin «Listo»: «Horarios guardados», «Contraseña cambiada».
- **D4. La ruta `/confirma-tu-mail`.** Es una URL interna (la usan
  `crear-cuenta` y `Guardia.js`) y sólo se ve en la barra de direcciones. Se
  propone dejarla como está; sólo cambia el título de la pantalla.
- **D5. «sólo» con tilde.** El repositorio y `docs/roles.md` escriben «sólo»;
  se mantiene así para no mezclar dos cambios.

### Orden

Cada paso es un PR chico por pantalla o por flujo, con sus pruebas. El orden va
de lo que se ve en todas partes a lo particular, y deja para el final lo que
choca con el trabajo de roles.

| # | Paso | Archivos | Líneas |
|---|---|---|---:|
| 0 | **La regla.** README, comentario de `presets.js`, texto de `bienvenida` que promete «hablar como vos». | 3 | — |
| 1 | **Mensajes compartidos.** Los que aparecen en cualquier pantalla: `lib/api.js`, `lib/datos.js`, `ingreso-google.js`, `validaciones.js`, `horarios.js`, `recordatorios.js`, `seguimiento-whatsapp.js`. En la API, todos los `errores.ts` (PR aparte en la API, en el mismo momento). | 7 + 8 | 34 + 24 |
| 2 | **Entrada y cuenta.** `bienvenida`, `iniciar-sesion`, `crear-cuenta`, `confirma-tu-mail`, `recuperar-contrasena`, `nueva-contrasena`, `crear-negocio`, `negocios`, `unirme/[codigo]`, `PantallaEntrada`, `BotonGoogle`, `lib/auth.js` y la plantilla del mail (que además se pega en Supabase). | 13 | 96 |
| 3 | **Lo que ve el cliente del negocio** (según D2). `seguimiento/[codigo]`, `turnos/[codigo]`, `aprobar`, frases de `presets.js`, `lib/seguimiento.js`, `lib/cobros.js`, `landing/VistaPrevia.js`. | 7 | 95 |
| 4 | **Casos e Inicio.** `casos`, `casos/nuevo`, `casos/[id]`, `casos/[id]/pasos`, `Cobros`, `SelectorEstado`, `SeguimientoWhatsApp`, `CuandoVuelve`, `page.js`, `inicio/cuerpos.js`, `inicio/Modulo.js`, `lib/inicio.js`. | 12 | 103 |
| 5 | **Agenda y clientes.** `agenda`, `agenda/calendario`, `AltaDeTurno`, `MoverTurno`, `clientes`, `clientes/[id]`, `VincularGoogleCalendar`, `api/google-calendar/route.js`. | 8 | 25 |
| 6 | **Inventario y sedes.** `inventario`, `inventario/en-camino`, `inventario/sedes`, `Producto`, `SedesVinculadas`. | 5 | 34 |
| 7 | **Mi negocio y configuración.** `negocio`, `negocio/horarios` (incluye el mensaje para invitar a pedir turno), `negocio/modulos`, `negocio/landing`, `negocio/recordatorios`, `ecuaciones`, `ConfiguracionEstados`, `ConexionMercadoPago`, `ResumenRecordatorios`, `Guardia`, `Aviso`, `lib/modulos.js`, `lib/landing.js`, `lib/ecuaciones.js`, `lib/pagos.js`. | 15 | 109 |
| 8 | **Equipo y perfil.** `equipo`, `SumarAlEquipo`, `lib/equipo.js`, `perfil`, `perfil/TusNegocios.js`, `historial`. Va después de que se integre roles, que cambia estas pantallas. | 6 | 45 |
| 9 | **Funciones SQL.** Una migración nueva, numerada después de las de roles, que redefine las 6 funciones vigentes que roles no nombra (21 líneas). Para las 11 que roles sí nombra (22 líneas): si roles las reescribe, que cambie los mensajes en su propia reescritura; si no, entran en esta migración. Se actualizan `supabase/pruebas/` y las pruebas de la API que comparan esos textos. | 1 | 43 |
| 10 | **La prueba que lo cuida** (opcional). Una prueba en `pruebas/` que recorra `src/` sin comentarios y falle si encuentra formas de voseo, como hace `vocabulario.test.js` con la concordancia. Con eso la regla pasa a "Reglas que el código ya hace cumplir". | 1 | — |

Los pasos 2 a 7 son independientes entre sí y se pueden repartir. El 1 conviene
primero porque fija las frases que después se repiten («No se pudo…», «Vuelva a
iniciar sesión»).

### Avance

- **2026-10-19. Pasos 0 y 1 hechos, sin commit.** Front: README, `presets.js`,
  `bienvenida` y los siete archivos de `src/lib/` del paso 1, con sus pruebas
  (`npm run test:unit`: 647 pasan). API: los ocho `errores.ts`,
  `middlewares/sesion.ts`, `turnos/horarios.ts` y `publico/casos-de-uso.ts`
  (`npm test`: 577 pasan). Quedan del paso 1 los esquemas y middlewares de la
  API listados arriba.
- `publico/casos-de-uso.ts` reconoce que un turno ya se ocupó buscando
  `/ganaron|acaba de ocuparse/` en el motivo de `reservar_turno()`. Así, el paso
  9 puede cambiar el mensaje del SQL sin romper nada. Cuando el SQL cambie, se
  saca `ganaron`.

Frases fijadas en el paso 1, que se usan igual en los siguientes:

| Situación | Frase |
|---|---|
| Sesión vencida (front) | «La sesión venció. Vuelva a iniciar sesión e inténtelo de nuevo.» |
| Sesión vencida (API) | «La sesión venció. Vuelva a iniciar sesión.» |
| Caso entregado | «El caso ya se entregó. Vuelva a abrirlo si hay algo que corregir.» |
| Trabajo entregado (cliente) | «Este trabajo ya se entregó. Para agregar algo, comuníquese con el negocio.» |
| Link que ya no sirve | «Este link ya no es válido. Pida uno nuevo al negocio.» |
| Turno ocupado | «Ese horario acaba de ocuparse. Elija otro.» |
| Medio de cobro | «Elija link o QR.» |
| Falla genérica | «No se pudo …» / «Vuelva a intentarlo …» / «Verifique …» |
| Dirección de mail | «correo» |

### Glosario de reemplazos frecuentes

| En lugar de | Va |
|---|---|
| podés, vas a poder | puede, se puede |
| no podés | no es posible, no está permitido |
| tenés | tiene, hay |
| ¿Ya tenés cuenta? / ¿No tenés cuenta? | ¿Ya tiene una cuenta? / ¿No tiene una cuenta? |
| Iniciá sesión (enlace) | Iniciar sesión |
| Creá una (enlace) | Crear una cuenta |
| elegí, elegilo | Elija, Seleccione |
| escribí, escribilo | Escriba, Escríbalo |
| tocá | Toque |
| revisá, fijate | Revise, Verifique |
| probá de nuevo | Vuelva a intentarlo |
| volvé a entrar | Vuelva a iniciar sesión |
| Tu sesión venció. | La sesión venció. |
| Tu nombre, Tu mail, Tu teléfono (etiquetas) | Nombre, Correo, Teléfono |
| tu negocio | el negocio, su negocio |
| Tus negocios | Mis negocios (como «Mi negocio», que ya existe) |
| Vos (la propia persona en la lista del equipo) | Usted |
| Listo, X quedó guardado. | X guardado. / Cambios guardados. |
| No pudimos X. | No se pudo X. |
| Te mandamos un mail. | Se envió un correo. |
| te avisamos | se le avisará |
| mandar, mandale | enviar, Envíele |
| prender / apagar (módulos, recordatorios) | activar / desactivar |
| sumar a alguien al equipo | agregar al equipo |
| sacar (del equipo, un paso, un filtro) | quitar |
| armar (presupuesto, landing) | preparar, crear |
| plata | dinero, importe |
| ¿Querés eliminar X? | ¿Eliminar X? |
| (si querés) | (opcional) |
| ya estás anotando uno (motivo de botón apagado) | hay uno en curso |
| revisá el monto (motivo de botón apagado) | el monto no es válido |
| Cuándo atendés / Abrís a las / Cerrás a las | Horario de atención / Apertura / Cierre |
| ¿Cuánto te pagó? | Importe cobrado |
| Cómo viene lo tuyo (seguimiento) | Estado de su trabajo |
| Justo te lo ganaron. Elegí otro horario. | Ese horario acaba de ocuparse. Elija otro. |
| Hola, te escribimos de X. | Hola, le escribimos de X. |
| Podés seguir mirándolo acá: | Puede seguir el estado aquí: |

### Ejemplos del inventario

| Hoy | Propuesto |
|---|---|
| «No tenés permiso para hacer eso.» (`lib/api.js`) | «No tiene permiso para realizar esta acción.» |
| «Probá con otra palabra o sacá el filtro de estado.» (`casos/page.js`) | «No hay resultados. Pruebe con otra palabra o quite el filtro de estado.» |
| «Si todavía no sabés, dejalo sin asignar y lo elegís después.» (`casos/nuevo`) | «Puede quedar sin asignar y elegirse más adelante.» |
| «Agregá lo que más usás y te avisamos cuando esté por acabarse.» (`inventario`) | «Agregue los productos de uso frecuente. Se avisará cuando estén por acabarse.» |
| «Ya anotamos tu vehículo. Todavía no empezamos a trabajar en él.» (`presets.js`) | «Su vehículo quedó registrado. Todavía no comenzó el trabajo.» |
| «No te podés sacar a vos del equipo.» (`038`) | «No es posible quitarse a uno mismo del equipo.» |
| «Restablecé tu contraseña» (mail) | «Restablecer la contraseña» |
| «Los prendés y apagás cuando quieras desde Mi negocio.» (`crear-negocio`) | «Se activan y desactivan desde Mi negocio.» |

### Qué queda afuera

- Los comentarios del código.
- `docs/roles.md` y `docs/roles-plan.md`: ya están en el tono nuevo.
- Los textos que cada negocio escribió y guardó (mensajes de recordatorio,
  descripción de la landing).
- Cambiar rutas o nombres de componentes (`/confirma-tu-mail`,
  `TusNegocios.js`).
- Reescribir el PDF de la cartilla: no está versionado. La decisión queda
  escrita en el README, que es donde el equipo registra lo que se aparta de
  ella. Si se versiona una cartilla 2, su regla de tono debería decir lo mismo.
