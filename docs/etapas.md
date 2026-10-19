# Etapas propias de cada negocio — diseño

Estado: **aprobado en el chat; falta revisar este documento y armar el plan**.
Fecha: 5 de octubre de 2026. Para el sprint 4.

## Qué se quiere

Que cada negocio arme la lista de etapas por las que pasan sus casos: agregar,
borrar, reordenar arrastrando y renombrar, desde Mi negocio. Hoy son los cinco
estados fijos del núcleo (cartilla, sección 02), con el nombre que les da el
rubro, y no se pueden tocar.

## Qué queda afuera

- **Cambiar el tipo de una etapa que ya existe.** Si cambiara con casos
  adentro, esos casos quedarían en un tipo que no es el suyo. Se borra y se
  crea de nuevo; sus casos pasan solos (ver "La regla").
- **Una descripción propia por etapa.** Cada etapa muestra la de su tipo.
- **Colores o íconos nuevos.** Siguen siendo los cinco de la cartilla.
- **Filtrar Inicio por etapa.** Los paneles de Inicio que filtran por estado
  siguen filtrando por tipo.
- **La bienvenida** (el recorrido de entrada): explica los cinco tipos con un
  taller de ejemplo, y eso sigue siendo cierto.

## Cómo está hoy

- `caso.estado` es uno de cinco: `nuevo`, `en_proceso`, `esperando`,
  `revision_final`, `completado`. Lo exige una restricción de la tabla
  (`001_schema.sql`) y lo valida la API.
- Cada clave tiene un comportamiento, no sólo un nombre: `nuevo` pide asignar,
  `esperando` lo tiene el proveedor y lo destraba el cliente, `revision_final`
  tiene su "qué falta", y `completado` sólo se alcanza entregando, con el cobro.
- El nombre que se ve sale del preset del rubro (`etiquetaEstado(rubro, estado)`
  en `src/lib/presets.js`, espejado en la API en `src/compartido/presets.ts`).
- El sistema mueve casos solo: compartir el link lo pasa a `esperando`, el
  cliente que aprueba lo vuelve a `en_proceso`, entregar lo pasa a
  `completado`, reabrir lo vuelve a `en_proceso`.
- El aviso por WhatsApp de cambio de estado (Lucas, API PR #23) dice
  "pasó al estado En proceso", con un nombre genérico que ni siquiera es el del
  rubro. Guarda estado, historial y aviso en una transacción con la función
  `cambiar_estado_con_notificacion`, que se aplicó directo en Supabase y **no
  está en ningún repo**.

## Decisiones

1. **Cada etapa es de uno de los cinco tipos.** El tipo le da el color, el
   ícono y el comportamiento. `caso.estado` sigue siendo el tipo, así que la
   restricción de la base, el cobro al entregar, "qué falta" y los movimientos
   automáticos no cambian.
2. **Anotado va siempre primera y Terminado siempre última.** Se pueden
   renombrar, no mover ni borrar. Son las únicas de tipo `nuevo` y
   `completado`: una abre el caso y la otra lo cierra con el cobro.
3. **Las etapas que se agregan son de un tipo del medio**: `en_proceso`,
   `esperando` o `revision_final`.
4. **Siempre queda al menos una etapa de cada tipo.** Cuando el sistema mueve un
   caso solo, tiene adónde ponerlo.
5. **Los casos de una etapa borrada pasan a la primera que queda de su tipo.**
   Antes de borrar, se avisa cuántos son y adónde van.
6. **El cliente ve el nombre de la etapa**, en su link y en el WhatsApp.
7. **Se guarda como una lista dentro del negocio** (`negocio.etapas`), igual
   que los módulos prendidos, y no en una tabla aparte: se guarda entera de una
   vez, y reordenar es guardar la lista en otro orden.

## La regla

> La etapa de un caso es la guardada (`caso.etapa`), si existe en la lista y es
> del mismo tipo que su estado. Si no, es la primera etapa de su tipo.

De esa regla salen solas:

- **Los casos que ya existen** no tienen etapa guardada: muestran la primera de
  su tipo. No hay que migrar casos.
- **Los movimientos automáticos** cambian el tipo; la etapa guardada deja de
  coincidir y el caso cae en la primera de su tipo. No se toca ninguna función
  de la base para eso.
- **Volver a donde estaba:** un caso en Pintura (`en_proceso`) que quedó
  esperando al cliente conserva `caso.etapa = Pintura`; cuando el cliente
  aprueba vuelve a `en_proceso`, la etapa guardada vuelve a coincidir, y el caso
  vuelve a Pintura.
- **Borrar una etapa** deja a sus casos con una etapa que no existe: caen en la
  primera de su tipo.

## La forma de una etapa

```js
{ id: "en_proceso", nombre: "En el taller", tipo: "en_proceso" }
{ id: "7c0e…",      nombre: "Pintura",      tipo: "en_proceso" }
```

- `negocio.etapas` en `null` quiere decir "las del rubro": las cinco, con los
  nombres del preset. Un negocio nuevo no necesita nada.
- **Las cinco de siempre tienen como id la clave de su tipo** (`"nuevo"`,
  `"en_proceso"`…). Al personalizar, conservan ese id; las que se agregan llevan
  uno generado con `crypto.randomUUID()` en el navegador.
- Validación (la misma en el front y en la API):
  - entre 5 y 20 etapas;
  - la primera es la única de tipo `nuevo`; la última, la única de tipo
    `completado`;
  - las del medio son `en_proceso`, `esperando` o `revision_final`, con al
    menos una de cada uno;
  - nombre de 1 a 40 caracteres, sin espacios de más, sin repetirse (sin
    importar mayúsculas);
  - ids de 1 a 64 caracteres, sin repetirse.

## La base: `046_etapas.sql`

La corre el usuario en el SQL Editor, antes de publicar la API.

- `alter table negocio add column etapas jsonb` (null = las del rubro), con
  `check (etapas is null or jsonb_typeof(etapas) = 'array')`. El resto lo valida
  la API.
- `alter table caso add column etapa text`.
- `alter table evento add column etapa text`: en qué etapa quedó el caso con ese
  evento. Los eventos viejos quedan en null y cuentan para la primera de su tipo.
- `ver_seguimiento(p_codigo)`: se reescribe **a partir de la última versión, la
  de `033_nombre_del_caso.sql`**, agregando `etapas` (las del negocio, o null),
  `etapa` (la del caso) y `etapa` en cada evento de la línea.
- `cambiar_estado_con_notificacion`: se reemplaza agregando `p_etapa text` y
  guardándola en el caso y en el evento, en la misma transacción. **Paso previo:**
  traer su definición actual al repo (que la pase Lucas, o sacarla del SQL Editor
  con `select pg_get_functiondef(p.oid) from pg_proc p where p.proname =
  'cambiar_estado_con_notificacion';`) y confirmar qué hace cuando el tipo no
  cambia: moverse entre dos etapas del mismo tipo tiene que guardar y avisar.

## La API (rama + PR)

### `src/compartido/etapas.ts`, con pruebas

`etapasDe(negocio)`, `etapaDelCaso(etapas, caso)` y `validarEtapas(lista)`,
espejo de `src/lib/etapas.js` del front, como ya pasa con los presets.

### `PUT /v1/negocio/etapas`

- Sólo el dueño (`soloDuenio`), como `PUT /v1/negocio/modulos`.
- Recibe `{ valor: [etapas en orden] }` y la valida con `validarEtapas`. Si no
  pasa, 422 con el motivo en castellano.
- Guarda `negocio.etapas` y, en el mismo pedido, pone en null `caso.etapa` de los
  casos del negocio cuya etapa ya no está en la lista.
- Responde `{ negocio }`.
- `PATCH /v1/negocio` con `rubro` (que sólo se puede sin casos) también vuelve
  `etapas` a null: la lista pasa a ser la del rubro nuevo.

### `POST /v1/casos/:id/estado`

- Acepta `{ etapa, notificar_cliente? }`. `{ estado }` sigue andando mientras se
  migra el front.
- Busca la etapa en `etapasDe(negocio)`. No existe, o es de tipo `completado`:
  422 ("Esa etapa ya no está" / "Para entregarlo, usá Entregar").
- Si es la etapa en la que ya está (según la regla): no hace nada, sin historial
  ni aviso, como hoy con el mismo estado.
- Si no: guarda `estado = tipo`, `etapa = id`, recalcula `que_falta` con el
  tipo, y anota en el historial **"Pasó a Pintura"**, con el detalle y el ícono
  de `AL_PASAR_A[tipo]`, y `etapa` en el evento.
- Moverse entre dos etapas del mismo tipo es un cambio de verdad: historial y,
  si se pidió, aviso.
- Con `notificar_cliente`, el mensaje dice "pasó a Pintura": `prepararAvisoEstado`
  recibe el nombre de la etapa en vez de usar `NOMBRE_ESTADO`.

### Lo que no cambia

Compartir, el cliente que destraba, entregar y reabrir siguen cambiando sólo
`estado`. La regla ubica la etapa.

## La aplicación

### Lógica pura: `src/lib/etapas.js`, con pruebas

- `etapasDe(negocio)`: `negocio.etapas` o las cinco del rubro.
- `etapaDelCaso(etapas, caso)`: la regla.
- `primeraDelTipo(etapas, tipo)`.
- `validarEtapas(lista)`: el motivo para el botón apagado, o null.
- `moverEtapa(lista, desde, hasta)`: nunca antes de la primera ni después de la
  última.
- `casosEnLaEtapa(etapas, casos, id)` y `adondeVanAlBorrar(lista, id)`: para el
  aviso de borrar.
- `lineaDeEtapas(etapas, etapaActual, linea, { abiertoEn })`: la línea de tiempo
  del cliente. Reemplaza a `lineaDeEstados` de `src/lib/seguimiento.js`.

### `src/lib/datos.js`

- `cambiarEtapa(casoId, etapaId)`: el desplegable del caso.
- `guardarEtapas(lista)`: el editor.
- En el modo de ejemplo, las dos funcionan en el navegador, como los módulos.
- Si la API publicada todavía no tiene etapas, la app usa las cinco de siempre.
  Guardar avisa "Falta actualizar la API para editar las etapas" sin romper nada.

### Mi negocio: el editor

- La sección "Cómo se llaman los estados en tu rubro" pasa a llamarse **"Las
  etapas de tus casos"**. Fuera de edición se ve como hoy: el chip y la
  descripción de su tipo, una fila por etapa.
- **Editar las etapas**: botón con borde y el ícono `pincel`, sólo si
  `puede(rol, "configurarNegocio")`.
- En edición, cada fila tiene, de izquierda a derecha:
  1. **el tacho** (`tacho`, en rojo), para borrar;
  2. **el nombre**, en el chip de su tipo, y debajo "Tipo: En proceso";
  3. **los 6 puntos** (ícono nuevo `arrastrar`: dos columnas de tres), para
     arrastrar.

  Anotado y Terminado no tienen tacho ni puntos, y dicen "Siempre va primera" y
  "Siempre va última".
- **Arrastrar**: desde los 6 puntos, con Pointer Events (mouse, dedo y lápiz;
  sin librerías nuevas: el arrastre nativo del navegador no anda con el dedo).
  `touch-action: none` en los puntos para que el dedo no haga scroll. Mientras se
  arrastra, la fila va levantada y se ve el hueco donde cae. Con teclado: foco en
  los puntos y flechas arriba/abajo; una región `aria-live` dice "Pintura, lugar 3
  de 7".
- **Renombrar**: doble click sobre el nombre lo vuelve un campo. Enter o click
  afuera lo deja; Escape lo deshace. Con teclado: foco en el nombre y Enter. Si
  en el celular el doble toque no dispara (en iPhone no está garantizado), en
  edición alcanza un toque: el nombre no tiene otra acción ahí.
- **Agregar etapa**: botón con borde y el ícono `mas`, abajo de la lista. Suma una
  fila antes de Terminado con el campo del nombre abierto y la elección del tipo:
  tres botones con color, ícono y palabra (En proceso, Esperando, Revisión
  final); por defecto, En proceso. El tipo se cambia mientras la etapa no se
  guardó; después, no.
- **Borrar**: sin casos, se va. Con casos, la fila pregunta "Tiene 3 casos: pasan
  a Desarme. ¿La borrás?", con Sí y No. Si es la única de su tipo, el tacho queda
  apagado y la fila dice "Es la única de tipo Esperando: no se puede borrar".
- **Guardar las etapas** (el azul) y **Cancelar** (plano). Nada se guarda antes.
  Apagado con el motivo de `validarEtapas`: "· falta el nombre de una etapa",
  "· hay dos que se llaman Pintura".
- El tacho y los 6 puntos son botones sólo de ícono: llevan `aria-label` y
  `title` ("Borrar la etapa Pintura", "Mover la etapa Pintura") y se anotan como
  excepciones en `src/componentes/Icono.js`, como el de la barra y el ojo.
- Celular (375 px): tacho y puntos de 48 px a los costados, el nombre en el
  medio.

### El resto de las pantallas

- **`ChipEstado`** recibe el caso y muestra el nombre de su etapa, con el color y
  el ícono del tipo. Con eso quedan la lista de casos, la ficha del cliente,
  Equipo, aprobar y los pasos del caso.
- **`SelectorEstado`** (el desplegable del caso) ofrece las etapas del negocio,
  en orden, menos la actual y Terminado, y llama a `cambiarEtapa`.
- **Lista de casos**: un filtro por etapa, en el orden del negocio ("Pintura
  (3)"); el orden "por estado" pasa a ser por etapa.
- **Pantalla del caso**: las frases que nombran un estado ("pasalo a Revisión
  final", "Volverlo a En proceso") usan `primeraDelTipo`, que es adonde va el
  caso.
- **Link del cliente** (`/seguimiento/[codigo]`): la línea de tiempo muestra las
  etapas del negocio en orden (`lineaDeEtapas`), y el chip, la etapa del caso.

## Pruebas

- **Front, Jest** (`pruebas/etapas.test.js`): las cinco por defecto de cada rubro;
  la regla (guardada, borrada, de otro tipo, sin etapa); cada regla de
  `validarEtapas` con su motivo; `moverEtapa` sin pasar a las fijas; adónde van y
  cuántos son al borrar; la línea de tiempo con eventos viejos (sin etapa) y
  nuevos.
- **API, contrato** (con la base de mentira): `PUT /negocio/etapas` (sólo el
  dueño, cada validación, los casos de una etapa borrada); `POST
  /casos/:id/estado` con etapa (otra del mismo tipo, la misma, una que no existe,
  Terminado); el aviso con el nombre de la etapa.
- **Vista previa, modo de ejemplo**: editar, arrastrar con mouse y con flechas,
  renombrar con doble click, agregar, borrar con y sin casos, guardar, cancelar;
  el ancho de 375 px.
- **No se puede probar desde acá**: el arrastre con el dedo y el doble toque en
  iPhone. Se prueban en un celular de verdad.

## Orden de publicación

1. Traer al repo el SQL de `cambiar_estado_con_notificacion`.
2. `046_etapas.sql`, en el SQL Editor.
3. PR de la API. Se mergea y Render lo publica (`/v1/salud` dice el commit).
4. El front, recién con la API publicada.

## Prueba a mano, con una cuenta real

1. Mi negocio → Editar las etapas: agregar "Pintura" (En proceso) y "Esperando
   repuesto" (Esperando), arrastrarlas, renombrar Anotado, guardar.
2. Mover un caso a Pintura desde el desplegable, con aviso al cliente: el
   historial dice "Pasó a Pintura" y el WhatsApp también.
3. Compartir el link: el caso pasa a la primera de Esperando. Aprobar desde el
   link: vuelve a Pintura.
4. Borrar Pintura con ese caso adentro: avisa adónde va, y el caso queda en la
   primera de En proceso.
5. En el celular: arrastrar con el dedo y renombrar con doble toque.
