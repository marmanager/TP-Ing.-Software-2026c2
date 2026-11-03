# Bienvenida: los módulos y Remi — diseño

Estado: **diseño aprobado; falta el plan de trabajo.**
Fecha: 2 de noviembre de 2026. Rama: `bienvenida-modulos-y-remi` (sale de
`development`). Sólo front: la API no se toca.

## Qué se quiere

`/bienvenida` es la landing de MarManager para quien todavía no tiene cuenta
(no es la landing de cada negocio, `/n/<código>`). Hoy cuenta el problema, los
cinco estados y el día a día, pero no dice qué más trae la aplicación. Se suman
dos secciones, antes del cierre:

- **04 · Módulos.** Una lista de módulos y, al lado, una pantalla de ejemplo del
  que se elige: el visitante ve cómo es cada uno por dentro.
- **05 · Remi.** El asistente, mostrado como se ve adentro de la app: una charla
  que se escribe sola, como si fuera en vivo, pero el visitante no puede
  escribir.

## Qué queda afuera

- **Remi en vivo.** `POST /v1/asistente` pide sesión y negocio, y abrir uno
  público gastaría la misma cuota de IA que usan los clientes, se podría abusar
  y cada respuesta tarda de 5 a 25 segundos. La charla es un guion.
- **Las instrucciones de Remi.** No saben que se llama Remi, dicen que vive en
  la barra lateral y fijan el castellano aunque la app esté en inglés. Es una
  tarea aparte, en la API.
- **Respuestas por WhatsApp.** Está a medio terminar y fuera de la barra lateral.
- **Precios y planes.** La landing no los muestra (comentario de cabecera de
  `page.js`), y los dos planes dan los mismos módulos.
- **Pendientes de aprobación, Equipo e Historial con pantalla propia.** Se
  nombran al pie de la 04.

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Lugar | **04 Módulos y 05 Remi, después de la 03 y antes del cierre.** | El argumento queda problema → modelo → día a día → lo que podés sumar → la ayuda. 01-03 no se renumeran. |
| Forma de la 04 | **Lista angosta a la izquierda** (ícono, nombre y una línea) **y la pantalla del elegido a la derecha.** En el celular la lista pasa a una fila de botones arriba. | Se lee aunque no se toque nada. La lista es angosta (~200 px) para que la pantalla mande. |
| Qué módulos | **Los 6 más visuales:** Agenda, Clientes, Inventario, Ecuaciones, Lienzo y Estadísticas. Al pie: "Y además: Pendientes de aprobación, Equipo e Historial". | Son los que tienen una pantalla que se entiende de un vistazo. |
| Movimiento de la 04 | **Cambia sólo al tocar.** Arranca en Agenda. | Lo que se mueve solo es la charla de Remi; dos cosas moviéndose a la vez distraen. Tampoco necesita botón de pausa. |
| Forma de la 05 | **Remi como aparece en la app:** la pantalla de Casos atenuada de fondo y el panel de Remi al costado. En el celular, sólo el panel. | Cuenta que Remi está en todas las pantallas, no en una sección aparte. |
| La charla | **Tres charlas que rotan:** qué módulos le sirven a un taller, una ecuación para el precio final y "no me aparece el inventario". Cada una termina con la persona tocando el botón de la tarjeta. | Son las tres cosas que Remi sabe hacer, y el toque muestra que nada cambia sin que la persona decida. |
| Cómo está armado | **Componentes aparte** y la lógica pura en `src/lib/bienvenida.js`, con pruebas. Copian el estilo del panel real de Remi, sin depender de él. | Las piezas del panel real piden sesión y negocio; un cambio adentro de la app no tiene que romper la landing. `page.js` ya tiene 900 líneas. |
| Datos de ejemplo | **Del mismo taller que el resto de la página** (Marcela Suárez, AB 123 CD). | La página cuenta un solo negocio de punta a punta. |
| Textos | Los nombres y la línea de cada módulo salen de `modulos.<clave>.nombre` y `.descripcion`; los de la tarjeta de Remi, de `asistente.*`. Lo nuevo va bajo `acceso.landing.modulos.*` y `acceso.landing.remi.*`, en castellano y en inglés. | Si un módulo cambia de nombre adentro, la landing lo acompaña: no queda texto que mienta. |

## Cómo está hoy

- `src/app/bienvenida/page.js` (un solo archivo, `"use client"`): header, franja,
  banner, hero con el recorte de Casos, 01 El problema, 02 El recorrido (clavada
  con `usarPasos`), 03 El día a día (único cambio de fondo, `bg-superficie`),
  cierre y pie.
- **El hilo del margen:** cada sección lleva un tramo del color del estado que
  cuenta (01 `bg-nuevo`, 02 los cinco, 03 `bg-completo`).
- **El movimiento** (`globals.css`, todo bajo `.landing`): el reposo es el estado
  final; lo escondido vive sólo bajo `.mov`. `usarMovimiento` pone `.mov` y busca
  los `.landing .rv` **una sola vez, al montar**, y les agrega `.vi` al entrar en
  pantalla. Con `prefers-reduced-motion` no pone `.mov`.
- `/bienvenida` no se dibuja en el servidor: la Guardia espera la sesión y recién
  después la muestra. Está fuera de `ProveedorAsistente`, así que el panel real
  de Remi no se puede montar ahí.
- El catálogo de módulos es `MODULOS` en `src/lib/modulos.js` (nombre, ícono,
  descripción y "qué hace"). Las imágenes de Remi: `public/asistente.png` (la
  cara, 192 px, fondo transparente) y `public/remi.jpg` (cuerpo entero).
- **Pruebas:** no hay e2e ni unitarias de `/bienvenida`.
  `pruebas/idioma-claves.test.js` revisa sólo las llamadas literales `t("…")`:
  las claves que pide `L(…)` en la landing no se verifican.

## La sección 04 · Módulos

**Encabezado.** Rótulo "04 · Módulos", título **"SUMÁ LO QUE TU NEGOCIO USA"** y
bajada "Cada negocio prende los módulos que necesita y apaga los que no. Apagar
uno no borra nada."

**La lista.** Seis renglones con el ícono de `MODULOS[clave].icono`, el nombre
(Ecuaciones con su nombre corto, el de la barra lateral:
`navegacion.ecuaciones`) y
`modulos.<clave>.descripcion`. El elegido lleva el estilo de chip elegido de la
app (`border-2 border-azul bg-azul-claro text-azul`).

**La pantalla.** Dibujada como el recorte de Casos: tarjeta con borde, controles
que se ven pero no se tocan (`CONTORNO`), acciones en azul plano. Abajo, una
frase escrita para la landing (`acceso.landing.modulos.frase.<clave>`): el "qué
hace" de la app habla de prender y apagar desde el menú.

| Módulo | Qué muestra |
|---|---|
| Agenda | Pestañas Turnos/Calendario; "Hoy · martes 4" con tres turnos (hora, motivo, cliente o "pidió por link", estado y la acción que sigue). |
| Clientes | Dos fichas (nombre, teléfono, cantidad de trabajos, WhatsApp y Llamar) y una punteada de "Todavía no vinieron". |
| Inventario | Pestañas En stock/En camino; un repuesto bajo el mínimo, uno con stock y unos amortiguadores en camino para AB 123 CD. |
| Ecuaciones | "Precio final": `(horas * tarifa + repuestos) * (1 + iva)`, sus valores (3 h, $25.000, $48.000, 21 %) y el resultado, $148.830; abajo, "38 fórmulas listas para usar". |
| Lienzo | La barra de herramientas y un dibujo con una flecha: "acá pierde aceite"; "Bajar como imagen". |
| Estadísticas | Pestañas Resumen/Casos/Cobros; casos del mes, lo cobrado y barras por semana dibujadas con CSS (sin `recharts` en la landing). |

Los rótulos que ya existen en la app (estados de turno, pestañas, "bajo el
mínimo") salen de sus claves; los nombres propios y los números van escritos,
como en el recorte.

**Al pie:** "Y además: Pendientes de aprobación, Equipo e Historial", con los
nombres de `modulos.<clave>.nombre`.

**Interacción.**
- Pestañas de verdad: `role="tablist"` (vertical en la lista, horizontal en el
  celular), `role="tab"` con `aria-selected` y `aria-controls`, y un
  `role="tabpanel"`. Flechas, Inicio y Fin mueven el foco y eligen
  (`siguientePestana`); sólo la elegida está en el orden de tabulación.
- En el celular, botones de 48 px de alto en una fila que se desliza de costado.
- La pantalla nueva entra con un fundido corto. Con movimiento reducido el cambio
  es instantáneo (la regla de `.landing` ya apaga las transiciones).
- `rv` va en el contenedor que no cambia; la pantalla que se intercambia no lo
  lleva. Si no, una pantalla montada después nunca recibe `.vi` y queda
  invisible.

## La sección 05 · Remi

**Encabezado.** Rótulo "05 · Remi", la cara de Remi (`asistente.png`) al lado del
título **"PREGUNTALE A REMI"** y, de bajada, `asistente.apoyo` ("Hola, soy Remi.
Preguntame cómo usar la app… te lo muestro y vos decidís.").

**La maqueta.** En computadora, la pantalla de Casos atenuada a la izquierda y el
panel de Remi a la derecha (~60 % del ancho). En el celular, sólo el panel. El
panel copia el real: cabecera con la cara y "Remi", mensajes de "Vos" en globos
azules a la derecha, los de Remi en tarjetas con borde, "Pensando…" con el punto
que pulsa. En la cabecera, un botón **Pausar / Seguir** (`aria-pressed`). Donde
iría el campo para escribir: "Esto es un ejemplo · Probalo adentro de la app".

**Las tres charlas** (con los textos y las tarjetas de la app):

1. **Vos:** "Tengo un taller mecánico, ¿qué módulos me sirven?"
   **Remi:** "Para un taller te sirven la **Agenda** para los turnos, el
   **Inventario** para los repuestos y el **Equipo** si trabajás con más gente.
   Si te sirve, tocá «Aplicar los cambios»."
   Tarjeta `asistente.propuestaTitulo` con `asistente.cambios.prender` (Agenda,
   Inventario y Equipo). Se toca `asistente.aplicar` → `asistente.aplicando` →
   `asistente.aplicada`.
2. **Vos:** "Armame una ecuación para el precio final de un trabajo"
   **Remi:** "Te armé esta ecuación. Revisá lo que interpreté y, si te sirve,
   agregala." (la respuesta fija de la API).
   Tarjeta "Precio final" con la fórmula, `asistente.ecuaciones.interpreto` y
   las variables (horas, tarifa, repuestos; iva = 21 % como valor fijo). Se toca
   `asistente.ecuaciones.agregar` → `asistente.ecuaciones.agregada`.
3. **Vos:** "No me aparece el inventario en el menú"
   **Remi:** "Es que el módulo **Inventario** está apagado. Apagarlo no borra
   nada: si lo prendés, vuelve todo lo que tenías."
   Tarjeta con "Prender: Inventario." Se toca `asistente.aplicar` →
   `asistente.aplicada`.

Las preguntas y las respuestas son claves nuevas
(`acceso.landing.remi.charlas.*`), en castellano y en inglés. Las negritas usan
`partirTexto` de `src/lib/asistente.js`, como el panel real.

**El reproductor.** Cada charla es una lista de pasos con su espera: el mensaje
de Vos (0), "Pensando…" (0,6 s), la respuesta (1 s después), la tarjeta (0,5 s),
el toque al botón (1,5 s), el resultado (0,7 s) y una pausa de 4 s antes de la
siguiente; unos 8 s cada una, y de la tercera vuelve a la primera.
`estadoDeLaCharla(ms)` dice, para el tiempo transcurrido, qué charla va y
cuántos pasos se ven; el componente sólo suma el tiempo con
`requestAnimationFrame` mientras corre.
- Corre sólo mientras la sección está en pantalla (IntersectionObserver) y no
  está en pausa. **Pausar congela el tiempo**: al seguir, retoma donde estaba.
- El botón de pausa es por WCAG 2.2.2 (algo que se actualiza solo más de 5 s).
- Con movimiento reducido no hay fundidos: los pasos aparecen de una vez y las
  charlas siguen rotando, con la misma pausa.
- **Lectores de pantalla:** la animación va `aria-hidden` (un chat que cambia
  solo, leído en voz alta, es un caos). Las tres charlas van como texto
  `sr-only` debajo. El botón de pausa sí es accesible.

## Archivos

- `src/lib/bienvenida.js` (nuevo): `MODULOS_DE_LA_BIENVENIDA` (las 6 claves y las
  3 del pie), `CHARLAS_DE_REMI` (el guion: claves y esperas),
  `estadoDeLaCharla(ms)` y `siguientePestana(actual, tecla, cuantas)`. Sin React.
- `src/componentes/bienvenida/SeccionModulos.js` (nuevo): la 04, con la lista y
  las pestañas.
- `src/componentes/bienvenida/PantallasDeModulos.js` (nuevo): las 6 pantallas de
  ejemplo, una función por módulo.
- `src/componentes/bienvenida/SeccionRemi.js` (nuevo): la 05, el panel y el
  reproductor.
- `src/app/bienvenida/page.js`: ubica las dos secciones y actualiza dos
  comentarios (los colores del hilo; "la única invención de la página").
- `src/app/globals.css`: el escalonado de entrada de las dos secciones, bajo
  `.landing`.
- `src/lib/idiomas/es.js` y `en.js`: las claves nuevas.

El hilo y los tramos de la 04 y la 05 van en **terracota** (`bg-terracota`), el
color de los rótulos "EJEMPLO": no cuentan un estado. El comentario de cabecera
de `page.js` pasa a decirlo.

## Pruebas

- `pruebas/bienvenida.test.js` (Jest), primero en rojo:
  - Las 6 claves y las 3 del pie existen en `MODULOS` y tienen ícono.
  - `siguientePestana`: abajo/derecha avanzan y del último vuelven al primero;
    arriba/izquierda retroceden; Inicio y Fin van a los extremos; otra tecla
    devuelve `null`.
  - `estadoDeLaCharla`: los bordes de cada paso, el cambio de charla y la vuelta
    a la primera.
  - Todas las claves nuevas (`acceso.landing.modulos.*`, `acceso.landing.remi.*`)
    y las que usa el guion existen en los dos idiomas.
- `pruebas/e2e/historias/bienvenida.e2e.js` (WebdriverIO, sin sesión ni
  siembra): tocar "Inventario" muestra su pantalla y la marca de elegido;
  "Pausar" queda apretado.
- A mano: computadora y celular, modo oscuro, movimiento reducido, castellano e
  inglés.

## Orden de trabajo

1. `src/lib/bienvenida.js` con sus pruebas (catálogo, teclado, reproductor).
2. La 04: `SeccionModulos` y `PantallasDeModulos`, con los textos.
3. La 05: `SeccionRemi` con el reproductor, la pausa y la transcripción.
4. `page.js`, `globals.css` y comentarios; el e2e; la revisión a mano.

## Riesgos

- **Remi en inglés.** La landing en inglés muestra a Remi hablando inglés, pero
  hoy contesta en castellano. Se arregla con la tarea de las instrucciones.
- **Más código en la landing**, unas 600 líneas, repartidas en los componentes
  nuevos. Las barras de Estadísticas van con CSS para no sumar `recharts`.
- **Las pantallas de ejemplo se pueden desactualizar** si cambia la app. Los
  textos que se repiten salen de sus claves, y la prueba del catálogo avisa si
  un módulo desaparece; el dibujo de cada pantalla hay que mirarlo cuando cambie
  la de verdad.
