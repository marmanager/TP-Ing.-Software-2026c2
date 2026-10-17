# Landing por negocio — diseño

Estado: **acordado en la charla del 17/10; falta revisar este documento**.
Tareas: SCRUM-195 (épica), SCRUM-196 a SCRUM-199.
Fecha: 17 de octubre de 2026.

## Qué se quiere

Hoy el negocio le manda a cada cliente links sueltos: uno para pedir turno
(`/turnos/<código>`) y uno por cada caso para seguirlo (`/seguimiento/<código>`),
que además hay que compartir caso por caso. La landing es una mini página
pública por negocio que junta todo en **un solo link**: el negocio la pone en su
Instagram o la manda por WhatsApp, y desde ahí el cliente ve los datos del
negocio, saca turno, sigue sus casos y ve sus turnos.

El negocio no arma la página. Hay un **modelo fijo** con cuatro secciones, y el
negocio sólo elige **el orden, los colores y la fuente**.

No es `/bienvenida`: esa es la landing de MarManager para quien todavía no tiene
cuenta. Esta es la de cada negocio, para sus clientes.

## Qué queda afuera

- **Secciones propias o textos libres.** El negocio no crea, borra ni redacta
  secciones. Sumar una sección nueva es trabajo nuestro (ver "El catálogo").
- **Cancelar un turno desde "Mis turnos".** Se ven; cancelarlos queda para
  después.
- **Un código por mensaje (WhatsApp o mail) para entrar.** Sería más seguro,
  pero no hay envío de mensajes todavía (Kapso no está conectado y la API no
  manda mails).
- **Casos completados en "Mis casos".** Sólo los abiertos.
- **Un dominio o una dirección con el nombre del negocio.** El link lleva un
  código, como la agenda.

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Cómo entra el cliente | El identificador del rubro (patente, DNI, número de serie…) **más los últimos 4 dígitos del teléfono** que el negocio tiene cargado. | El identificador solo no es secreto: la patente está pegada en el auto y el DNI lo sabe mucha gente. Y aprobar un paso es aceptar gastar plata. |
| Clientes nuevos | Se registran en la landing (nombre, teléfono e identificador) y quedan **"por confirmar"**, como hoy en el link de turnos. | La landing también sirve para conseguir clientes. |
| Secciones | **El negocio, Sacar turno, Mis casos, Mis turnos.** | Las que cubren los links de hoy más los datos del negocio. El catálogo se puede ampliar. |
| Sin identificarse | Se ven **"El negocio" y el calendario de "Sacar turno"**. Los datos se piden al confirmar el turno o al abrir "Mis casos" o "Mis turnos". | Es la decisión que ya tomó la pantalla de turnos: mostrar si hay lugar antes de pedir datos. |
| Colores | Cuatro: **fondo, cajas, botones y acento**, cada uno con el color de su texto. El editor recomienda el texto que mejor contrasta y avisa si no alcanza, pero deja elegir. | Libertad para el negocio sin que la página quede ilegible sin que nadie se entere. |
| Fuente | Una de una **lista cerrada**. La de fábrica es la de la app (Figtree en los títulos y Source Sans 3 en el texto); las otras van en toda la página. | Cada fuente se carga en la app de antemano; no puede ser cualquiera. |
| Qué casos se ven | **Todos los abiertos** del cliente (los que no están `completado`, como `estaAbierto()` de `lib/estados.js`). El que no tiene link lo recibe al entrar. | Es el sentido de centralizar: el negocio no tiene que compartir caso por caso. Consecuencia: "dejar de compartir" un caso ya no lo saca de la landing. |
| Qué es la landing | **La puerta.** Cada caso abre la pantalla de seguimiento que ya existe, con los colores de la landing. | Aprobar y pagar ya andan y tienen pruebas: no se reescriben. |
| Quién verifica | **La base**, con funciones `security definer`, como el seguimiento y la agenda. | Así la base sigue siendo la última línea de defensa. Descartado: que la API firme su propio token para el cliente y use la clave de servicio (MIGRACION.md de la API, sección 8, lo marca como lo que no hay que hacer). |

## Cómo está hoy

- `caso.identificador` (009) guarda la patente, el DNI o lo que use el rubro;
  `comoSeIdentifica()` de `lib/presets.js` dice cómo se llama en cada uno. Es del
  **caso**, no del cliente: un cliente puede tener dos autos.
- `cliente.telefono` puede estar vacío. `cliente.confirmado = false` marca al que
  se anotó solo pidiendo turno (011).
- `caso.seguimiento_codigo` (018) existe sólo si el negocio compartió el caso.
- `negocio.agenda_codigo` (024) es el link de la agenda. `compartir_agenda()`
  devuelve siempre el mismo código, para no matar el link que ya está en
  Instagram. `reservar_turno()` crea el cliente "por confirmar" y el turno.
- Los colores de la app son variables de CSS (`--color-fondo`,
  `--color-tarjeta`, `--color-azul`, `--color-tinta`…, en `globals.css`) y las
  fuentes, `--fuente-titulo` y `--fuente-cuerpo` (`layout.js`).
- Los módulos se prenden por negocio (`lib/modulos.js`, SCRUM-88); "Turnos" es
  submódulo de "Agenda".

## Lo que se guarda

### `negocio.landing` (jsonb, puede ser null)

La personalización. **Null quiere decir "la de fábrica"**: un negocio que nunca
entró al editor ya tiene una landing que se ve bien.

```json
{
  "orden": ["negocio", "sacar_turno", "mis_casos", "mis_turnos"],
  "colores": {
    "fondo":   { "color": "#fbf8f4", "texto": "#241f1b" },
    "cajas":   { "color": "#ffffff", "texto": "#241f1b" },
    "botones": { "color": "#1f4e8c", "texto": "#ffffff" },
    "acento":  { "color": "#9a3d1e", "texto": "#ffffff" }
  },
  "fuente": "fabrica"
}
```

Ese es también **el preset de fábrica** (SCRUM-199): los colores y las
fuentes actuales de la app.

- Al **guardar**, la API exige que `orden` tenga cada sección del catálogo una
  sola vez, que cada color sea `#rrggbb` y que la fuente esté en la lista.
- Al **leer**, el front tolera un orden viejo: si el catálogo sumó una sección
  que el negocio todavía no ordenó, va al final.

### `negocio.landing_codigo` (text, único, puede ser null)

El link de la landing. Null quiere decir "no publicada". Es aparte de
`agenda_codigo`: si el negocio apaga el link de turnos, la landing no se cae.
Igual que la agenda, compartir **devuelve siempre el mismo código**; para
cambiarlo hay que dejar de compartir y volver a compartir.

Llega con la 053, junto con la página pública, y no antes: un botón de
"publicar" sin la página haría repartir un link que no anda.

### `turno.identificador` (text, puede ser null)

Un cliente nuevo todavía no tiene casos, así que su identificador queda en el
turno que saca al registrarse. Cuando el negocio le abre el caso desde ese
turno, el identificador pasa al caso.

### `landing_sesion`

| Columna | Qué es |
|---|---|
| `huella` (pk) | `sha256` de la llave. La llave nunca se guarda. |
| `negocio_id` | De qué negocio es. |
| `identificador` | Normalizado. |
| `ultimos4` | Los 4 dígitos con los que entró. |
| `vence_en` | 12 horas después de entrar. |

Con RLS prendida y sin políticas: sólo la leen las funciones. Las vencidas se
borran cada vez que alguien entra; no hace falta un cron.

### `landing_intento`

Los intentos fallidos: `negocio_id`, identificador normalizado y hora. **Con 5
fallidos en 15 minutos para el mismo identificador en el mismo negocio, se
bloquea** hasta que pasen los 15 minutos. Entrar bien borra los fallidos de ese
identificador. Junto con el límite por IP de la API, probar las 10.000
combinaciones de 4 dígitos deja de ser viable.

## Cómo se reconoce al cliente

- **Normalizar el identificador**: mayúsculas y sin espacios, puntos ni guiones
  (`"ab 123-cd"` → `"AB123CD"`). Una función `normalizar_identificador()`
  inmutable, con índices por expresión en `caso` y `turno`.
- **Los 4 dígitos**: los últimos 4 dígitos de `cliente.telefono`, sacando todo lo
  que no sea número.
- **Quién coincide**: los clientes del negocio que tienen **un caso o un turno**
  con ese identificador **y** un teléfono que termina en esos 4 dígitos. Pueden
  ser varios (la misma persona cargada "por confirmar" y después de verdad); se
  ve lo de todos.
- **Si una patente cambió de dueño**, el teléfono separa los casos de cada uno.
- **Si alguien se registra con la patente de otro**, queda guardado con *su*
  teléfono y al entrar sólo coincide con lo suyo.
- **El error es siempre el mismo** (`datos_incorrectos`), falle el identificador
  o el teléfono, para no dar pistas. Por lo mismo, el registro no avisa si el
  identificador ya existe.
- **Un cliente sin teléfono cargado no puede entrar.** La página le dice que se
  lo pida al negocio.

## La base

Dos migraciones, para que el editor no espere al ingreso:

**`052_landing.sql`**, lo que usa el editor:

- `negocio.landing`, con un check que sólo exige que sea un objeto (como
  `estados` en la 046). La forma la valida la API al guardar, y el front tolera
  al leer, como el Inicio (006).

**`053_landing_ingreso.sql`**, el link, la página pública y el ingreso del
cliente:

- `negocio.landing_codigo` con su índice único, y `compartir_landing()` y
  `dejar_de_compartir_landing()`: sólo el dueño, copia de las de la agenda
  (024).
- `ver_landing(p_codigo)`: lo que se ve sin entrar (nombre, logo, teléfono,
  horarios, personalización, qué secciones aparecen según los módulos y si el
  negocio publicó horarios).
- `turno.identificador`, `normalizar_identificador()` y sus índices.
- `landing_sesion` y `landing_intento`.
- `ingresar_landing(p_codigo, p_identificador, p_ultimos4)` → `{ ok, llave,
  vence_en }` o `{ ok: false, motivo }`.
- `mis_casos_landing(p_codigo, p_llave)`: los casos abiertos, cada uno con su
  `seguimiento_codigo`, creándolo si falta.
- `mis_turnos_landing(p_codigo, p_llave)`: los próximos turnos.
- `ver_agenda_landing(p_codigo)` y `reservar_turno_landing(p_codigo, p_llave,
  p_cuando, p_motivo, p_nombre, p_telefono, p_identificador)`: con llave, los
  últimos cuatro van null y el turno queda a nombre del cliente de la sesión;
  sin llave, son el registro. La lógica de
  `ver_agenda_publica()` y `reservar_turno()` se pasa a funciones internas que
  usan las dos. **Las de 024 no cambian ni de firma ni de comportamiento.**
- `ver_seguimiento()` suma `landing` y `landing_codigo` del negocio, para pintar
  el seguimiento y mostrar el "Volver". Se parte de su última versión (026). Sólo
  agrega datos.

La llave sale de `gen_random_uuid()` dos veces, como los otros códigos, y la
huella de `sha256()`, que viene con Postgres. No hace falta `pgcrypto`.

## La API

Mismas convenciones de siempre: rutas finas, reglas en los casos de uso, zod para
la forma del pedido y la base para la verificación final.

**Para el negocio**, con sesión y sólo el dueño (como `PUT /negocio/modulos`):

| Ruta | Paso | Qué hace |
|---|---|---|
| `PUT /v1/negocio/landing` | 1 | `{ valor }` con la personalización entera, o `null` para volver al preset. |
| `POST /v1/negocio/landing/compartir` | 3 | Se suma a la lista `LINKS` de `modulos/negocio/rutas.ts`. |
| `POST /v1/negocio/landing/dejar-de-compartir` | 3 | Ídem. |

**Para el cliente**, en un módulo nuevo `src/modulos/landing/` montado en
`/v1/publico/landing`, antes de `sesion`:

| Ruta | Límite por IP | Qué hace |
|---|---|---|
| `GET /:codigo` | 60/min | `ver_landing`. |
| `GET /:codigo/agenda` | 60/min | `ver_agenda_landing`. |
| `POST /:codigo/ingresar` | 10/min | `ingresar_landing`. |
| `GET /:codigo/mis-casos` | 60/min | Con llave. |
| `GET /:codigo/mis-turnos` | 60/min | Con llave. |
| `POST /:codigo/turnos` | 5/min | Con llave: reserva a su nombre. Sin llave: registro (nombre, teléfono, identificador) y devuelve la llave. |

La llave viaja en el encabezado `Authorization: Llave <llave>`, no en la
dirección, para que no quede en los registros.

Errores nuevos:

| Código | HTTP | Cuándo |
|---|---|---|
| `landing_no_encontrada` | 404 | El código no existe o la landing no está publicada. |
| `datos_incorrectos` | 401 | El identificador y los 4 dígitos no coinciden. |
| `muchos_intentos` | 429 | El bloqueo por identificador o el límite por IP. |
| `llave_vencida` | 401 | La llave no existe o venció: el front vuelve a pedir los datos. |

## El front

### La landing pública: `/n/[codigo]`

- **Mismas reglas que las otras pantallas públicas**: sin menú, sin nada que
  lleve adentro del sistema, pensada para el celular. Se suma a las rutas
  públicas de `Guardia.js`, junto a `/seguimiento` y `/turnos`.
- **Una sección, un componente**, en `src/componentes/landing/`:
  `SeccionNegocio`, `SeccionSacarTurno`, `SeccionMisCasos` y
  `SeccionMisTurnos`. La página los dibuja en el orden guardado y saltea los que
  no aparecen.
- **"Sacar turno" y "Mis turnos"** aparecen sólo si el módulo Agenda está
  prendido y el negocio publicó horarios. **"El negocio" y "Mis casos"**
  siempre.
- **`Ingreso`**: la cajita de identificador y 4 dígitos. Aparece en lugar de
  "Mis casos" o "Mis turnos" mientras el cliente no entró, y al confirmar un
  turno sin llave aparece el registro.
- **La llave va en `sessionStorage`**: se borra al cerrar la pestaña, así nadie
  queda adentro en un celular prestado. Con `llave_vencida`, se borra y se
  vuelve a pedir.
- **"Sacar turno"** usa el calendario de `/turnos/[codigo]`, que hoy está escrito
  adentro de esa página. Se saca a `src/componentes/CalendarioDeTurnos.js` y lo
  usan las dos. La página de turnos queda igual.
- **El seguimiento** (`/seguimiento/[codigo]`): si el negocio tiene landing, se
  pinta con sus colores y suma "← Volver a [negocio]".

### Colores y fuente

- **`Lienzo`** (`src/componentes/landing/Lienzo.js`), el contenedor de la
  landing, pisa en su `style` las variables de color de `globals.css` con los
  valores del negocio. Funciona porque el tema es `@theme` y no `@theme
  inline`: las utilidades usan `var(--color-…)` (verificado en el CSS
  compilado). Así los componentes reutilizados, como el calendario y el
  seguimiento, se pintan sin tocarlos.
- **Se marca con el atributo `data-lienzo`**, no con la clase `landing`, que es
  de `/bienvenida`. En `globals.css`, dentro de `@layer base` para que las
  utilidades sigan ganando, `[data-lienzo]` vuelve a declarar el fondo, el
  color y la fuente, que `body` ya resolvió con los de la app.
- **El texto de las cajas** sale de una regla `[data-lienzo] .bg-tarjeta`,
  porque las tarjetas no fijan su color de texto: lo heredan del fondo.
- **Los botones** pisan `--color-azul` y, para su texto, `--color-white`. Los
  links (`text-azul`) también toman el color de los botones.
- **Los tonos derivados** (texto suave, borde, botón apretado) se calculan con
  `color-mix()` a partir de los elegidos, para que sigan leyéndose sobre
  cualquier fondo.
- **Las fuentes** se declaran con `next/font` en
  `src/componentes/landing/fuentes.js`, con `preload: false`, así el navegador
  baja sólo la que algún texto usa. Todas declaran la variable
  `--fuente-landing`, y Lienzo pisa `--font-titulo` y `--font-cuerpo` con ella.
  **La lista**: la de la app (Figtree y Source Sans 3, que ya carga
  `layout.js`), Nunito, Montserrat, Lora y Merriweather. Lora no pasa de 700,
  así que sus títulos extra negritas se ven en 700.

### El editor: `/negocio/landing` (SCRUM-196)

Se llega desde "Mi negocio", como "Módulos". Lo ve y lo usa sólo el dueño
(`QUIEN_PUEDE` en `lib/permisos.js`). De arriba abajo:

1. **El link**: publicar, copiar, mandar por WhatsApp, dejar de compartir.
   Llega en el paso 4, con la página pública. El bloque de la agenda en
   `/negocio/horarios` se saca a un componente `LinkCompartido` que usan las
   dos pantallas.
2. **Orden** (SCRUM-197): las secciones con botones ↑↓. No se arrastran: los
   botones andan en el celular y con teclado, y no suman una librería. La
   sección de un módulo apagado se ve gris, con el porqué.
3. **Colores** (SCRUM-198): fondo, cajas, botones y acento. Cada uno con su
   color, el color de su texto y la marca "Recomendado" en el que mejor
   contrasta. Si el contraste del texto elegido es menor a 4,5:1, aparece un
   aviso. Como los links van con el color de los botones, también avisa si
   ese color no se lee sobre las cajas.
4. **Fuente** (SCRUM-198): la lista, cada opción escrita con su fuente.
5. **Vista previa**: la landing en chico, con datos de ejemplo, que cambia
   mientras se edita, sin guardar.
6. **"Volver al de fábrica"** (SCRUM-199) y **Guardar**.

### `src/lib/landing.js`

La lógica pura, con sus pruebas en Jest:

- **El catálogo** (`SECCIONES`): clave, nombre y de qué módulo depende cada
  sección. Sumar una sección es una entrada acá y su componente.
- **`PARTES`**, **`FUENTES`** y **`PRESET`**.
- **`normalizarLanding(guardada)`**: lo guardado, completado con la de fábrica
  donde falte o no se entienda; el orden viejo suma al final las secciones
  nuevas. **`esDeFabrica(landing)`**.
- **`moverSeccion(orden, clave, paso)`** y **`estadoDeSecciones(orden,
  modulosActivos)`**: cada sección con si aparece y, si no, por qué. En el
  paso 4 se le suma la condición de los horarios publicados.
- **`contraste(a, b)`**, la razón de contraste de WCAG; **`seLee(color,
  texto)`**, si llega a 4,5:1; y **`textoRecomendado(color)`**, entre la tinta
  de la app (`#241f1b`) y el blanco, el que más contrasta.
- **`cambiarColor(landing, parte, color)`**: si el texto era el recomendado,
  pasa al recomendado del color nuevo; si el dueño eligió otro, se respeta.
  **`cambiarTexto(landing, parte, texto)`**.
- **`variablesDeColor(landing)`** y **`variablesDeFuente(landing)`**: las
  variables de CSS para `Lienzo`.

## Pruebas

TDD de la cátedra: commit "Test en rojo: …" y el arreglo aparte.

| Nivel | Qué |
|---|---|
| Base: `supabase/pruebas/landing.sql` | <ul><li>Entrar con datos buenos y malos, siempre con el mismo error.</li><li>El bloqueo al 5.º fallido, y que entrar bien lo limpie.</li><li>La llave vencida.</li><li>Dos clientes con la misma patente y teléfonos distintos: cada uno ve lo suyo.</li><li>Registrarse con la patente de otro no muestra nada ajeno.</li><li>Los casos sin link reciben código.</li><li>Las funciones de 024 contestan igual que antes.</li></ul> Se corre en el SQL Editor y deshace todo, como las otras de esa carpeta. |
| API: casos de uso y contrato | Los códigos de error, los límites por IP, que sólo el dueño guarde, y que zod rechace un orden con secciones repetidas o faltantes, un color inválido o una fuente fuera de la lista. El Supabase falso aprende las funciones nuevas, como ya imita `reservar_turno` y `ver_seguimiento`. |
| Front: Jest | Todo `lib/landing.js`. |
| Front: e2e | El editor con una cuenta sembrada por la API (`pruebas/e2e/siembra.js`), como las demás: cambiar el orden, los colores y la fuente, ver la vista previa, volver al de fábrica y que quede después de refrescar. |

## Orden de trabajo

Cada paso es un PR y ninguno rompe lo que anda:

| # | Qué | Repo | Tareas |
|---|---|---|---|
| 1 | `052_landing.sql` y `PUT /v1/negocio/landing`. | front (SQL) y API | 196 |
| 2 | `lib/landing.js`, Lienzo, las fuentes, el editor y la vista previa. Plan: `docs/landing-por-negocio-plan.md`. | front | 196, 197, 198, 199 |
| 3 | `053_landing_ingreso.sql` (con el link), `supabase/pruebas/landing.sql`, compartir y las rutas públicas. | front (SQL) y API | nueva |
| 4 | `/n/[codigo]` con "El negocio", "Mis casos" e ingreso, y el bloque del link en el editor. La pantalla del caso avisa, junto a "dejar de compartir", que el cliente lo sigue viendo por la landing. | front | nueva |
| 5 | "Sacar turno" con el calendario reutilizado, registro, "Mis turnos", y el seguimiento con colores y "Volver". | front | nueva |

- Las migraciones las corre una persona del equipo en el SQL Editor de Supabase,
  y pueden ir antes que el código. La 052 sólo agrega. La 053 además redefine
  `ver_seguimiento()` y las funciones de 024, sin cambiar lo que contestan: por
  eso su prueba se corre antes de dar el paso por terminado.
- Los pasos 1 y 2 cubren las cuatro tareas del Sprint 4. Los pasos 3 a 5 necesitan
  tareas nuevas en Jira, para el sprint que viene.
- El paso 3 necesitaba en la API el arreglo para que, después de que alguien
  entra al sistema, las consultas públicas no salgan con su token. Ya está en
  `master` (`c566e3c`).

## Riesgos

- **4 dígitos son pocos.** El bloqueo por identificador y el límite por IP lo
  cubren contra un ataque a ciegas, pero no contra alguien que conoce la patente
  y el teléfono de la persona. Para eso está el código por mensaje, que queda
  afuera.
- **"Dejar de compartir" pierde efecto** para los casos de un cliente que entra
  por la landing. La pantalla del caso lo avisa (paso 4).
- **La lógica de la agenda se mueve a funciones internas** (paso 3). La prueba de
  la base tiene que mostrar que las de 024 contestan igual.
- **Colores libres**: el aviso de contraste no impide guardar. Una landing fea es
  responsabilidad del negocio; una ilegible sin aviso sería nuestra.
