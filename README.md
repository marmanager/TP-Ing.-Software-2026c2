# TP Ingeniería de Software 2026c2 — Grupo 6

Sistema de gestión de casos para negocios chicos de servicio: taller mecánico,
medicina, service técnico. Un caso entra, avanza por cinco estados, se le arma
un presupuesto que el cliente aprueba paso por paso, y se entrega.

La idea de arquitectura es **un núcleo común más presets por rubro**: las pantallas
y los estados son siempre los mismos, y el preset del rubro sólo renombra etiquetas.

- Backlog: [Jira, proyecto SCRUM](https://itba-ingsoft1-grupo6-marceloai.atlassian.net/)
- Diseño: `Cartilla de diseño.pdf`, versión 1. Es normativa: si una decisión de
  diseño choca con la cartilla, gana la cartilla.

## Levantarlo

Hace falta **Node 20.9 o más nuevo** (`node -v`).

```bash
npm install
npm run dev
```

Y abrir http://localhost:3000

**No hace falta configurar nada para que ande.** Sin credenciales de Supabase, la
pantalla de entrada ofrece **"Probar sin cuenta"**: creás tu negocio, elegís el
rubro y usás el sistema entero —abrir casos, hacerlos avanzar, armar
presupuestos, cargar inventario, anotar turnos—, todo guardado en tu navegador.
No viene ningún dato inventado: arrancás vacío, como una cuenta nueva de verdad.

Lo único que no se puede sin Supabase es invitar colaboradores, que necesita
cuentas reales. Para salir, "Mi negocio" → "Salir del modo de ejemplo".

## Conectar la base de Supabase

1. En el SQL Editor de Supabase, correr **en orden numérico** todos los archivos
   de `supabase/`, del `001_schema.sql` al `019_aprobar_desde_el_link.sql` (el `002`
   ya no existe: traía datos inventados y se sacó). Todos se pueden volver a correr
   cuantas veces haga falta.

   **En una base nueva se corren todos.** El 001 crea las tablas y nada más: no
   trae la tabla `usuario` (003), ni las invitaciones y los roles (007), ni prende
   el aislamiento (005) o los permisos (008). Saltearse cualquiera de esos cuatro
   deja la aplicación sin entrar o sin ver nada.

   Los únicos opcionales son **004 y 006**, que arreglan bases creadas con una
   versión anterior del 001; en una base nueva el 001 ya las trae.
2. En el panel de Supabase, *Authentication → Providers → Email*: dejar activado
   el ingreso con contraseña. Para la verificación de mail y la recuperación de
   contraseña, además prender *Confirm email* y agregar
   `http://localhost:3000/nueva-contrasena` a las *Redirect URLs*.
3. Copiar `.env.example` a `.env.local` y completar las dos variables con los valores
   de *Project Settings → API*.
4. Reiniciar `npm run dev`.

Con las claves cargadas, la pantalla de entrada pide mail y contraseña. Sin ellas
sólo queda el modo de ejemplo. La aplicación no dice en pantalla de dónde salen
los datos: es información de desarrollo, no del negocio.

## Cómo está armado

```
src/
├── app/                    una carpeta por pantalla (App Router)
│   ├── page.js             Inicio, armado por módulos
│   ├── casos/              lista, alta, detalle y aprobación de pasos
│   ├── seguimiento/        la pantalla pública que abre el cliente, sin cuenta
│   ├── agenda/  clientes/  inventario/  aprobar/  equipo/  historial/  negocio/
│   └── globals.css         los tokens de la cartilla, en Tailwind
├── componentes/            piezas base: botones, campos, chips, íconos
│   └── inicio/             el marco y el contenido de cada módulo del Inicio
└── lib/
    ├── auth.js             sesión: cuentas de Supabase o modo de ejemplo
    ├── datos.js            capa de datos: Supabase si hay claves, si no local
    ├── semilla.js          el estado inicial del modo de ejemplo: vacío
    ├── estados.js          los cinco estados del caso y sus reglas
    ├── turnos.js           los cuatro estados de un turno de la agenda
    ├── presets.js          los diccionarios de rubro
    ├── modulos.js          el catálogo de módulos que un negocio puede prender
    ├── historial.js        el historial del negocio: tipos de evento, filtros y resumen
    ├── imagen.js           achica la foto del negocio antes de guardarla
    ├── seguimiento.js      qué ve y qué no ve el cliente en la pantalla pública
    └── inicio.js           la grilla del Inicio: catálogo, tamaños y orden
```

**Los tokens de la cartilla viven en `src/app/globals.css`.** Colores, tipografías,
escala tipográfica y radios salen del PDF y no se cambian por gusto. Se puede poner
ese archivo al lado de la sección 02 de la cartilla y coincide línea por línea.

Los íconos son SVG inline en `src/componentes/Icono.js`, no una fuente de íconos:
una fuente que no carga deja la palabra `check_circle` escrita en pantalla, y un
lector de pantalla la lee siempre.

## Reglas de la cartilla que el código ya hace cumplir

- Cuerpo de 18 px. Nada por debajo de 15 px.
- Área táctil mínima de 48 px; el botón principal en celular, 56 px y ancho completo.
- Un solo botón azul por pantalla. El resto va con borde.
- Un botón apagado dice por qué está apagado: «Guardar · falta el teléfono».
- Cada estado se dice con color, ícono y palabra. Si se imprime en blanco y negro
  se sigue entendiendo.
- El anillo de foco azul de 3 px está siempre y no se saca.
- Sin jerga: no hay «dashboard», «settings», «loading» ni «item» en ningún texto.

## Dos vocabularios de estado, a propósito

Un **caso** avanza por los **cinco estados** de la cartilla, que son fijos y
están en `src/lib/estados.js`. Un preset de rubro los renombra —"Está en el
taller" o "En consulta"— pero no agrega un sexto ni cambia su color.

Un **turno** de la agenda cuenta otra cosa: si la persona va a venir y si
vino. Son **cuatro estados** propios, en `src/lib/turnos.js`, con su palabra,
su color y su ícono:

| Estado | Se lee | Qué quiere decir |
| --- | --- | --- |
| `agendado` | Sin confirmar | Está anotado, pero todavía no confirmó que viene. |
| `confirmado` | Confirmado | Dijo que viene. |
| `cancelado` | Cancelado | No va a venir. Queda en la agenda para que se sepa que estaba. |
| `atendido` | Ya vino | Vino y se la atendió. Si traía un trabajo, el turno apunta al caso que salió de él. |

Que sean distintos está bien: un turno no es un trabajo, y la Agenda es un
módulo que un negocio puede tener apagado. Lo que estaba mal era que no
estuvieran escritos en ningún lado.

## Decisiones que se apartan de la cartilla

La cartilla es normativa: si una decisión de diseño choca con ella, gana la
cartilla. Estas dos la contradicen a propósito, por decisión del equipo, y
quedan escritas acá para que nadie las "corrija" sin saberlo.

- **Un paso aprobado por el cliente no se deshace.** Las secciones 08 y 09
  dicen que aprobar y rechazar se pueden deshacer. Lo aprobado es un acuerdo
  con el cliente sobre trabajo y plata, así que queda fijo; aprobar pide
  confirmación antes. Rechazar sí se deshace. Lo hace cumplir también la base
  (`supabase/015_paso_aprobado_fijo.sql`).
- **En el celular, el cuarto lugar de la barra es "Más".** La sección 05 dice
  "cuatro destinos abajo, nunca un menú escondido". Con nueve secciones
  posibles no entran; lo de todos los días (Inicio, Casos, Agenda) sigue a un
  toque, y "Más" abre un panel a pantalla completa con todas las secciones,
  igual que la barra lateral de la computadora. Va con ícono y palabra, y
  queda marcado cuando la pantalla actual está adentro.

## El Inicio se arma por módulos

La pantalla de entrada no es fija: cada módulo asoma una feature del sistema
—los casos, la agenda, el inventario, lo que falta aprobar— y el usuario decide
cuáles ve, en qué orden, de qué tamaño y con qué filtro. Se acomoda desde el
botón "Acomodar la pantalla" y queda guardado en `negocio.inicio`.

Acomodando, cada módulo se comporta como una imagen en un documento: se agarra
del medio y se lleva a cualquier lado, y se le cambia el tamaño tirando de la
esquina punteada de abajo a la derecha. La grilla es de seis columnas y cada
módulo tiene su lugar propio, así que pueden quedar uno al lado del otro y no
sólo apilados.

Dos reglas gobiernan la grilla, y están las dos en `resolver()`:

- **Nadie se pisa.** Al soltar un módulo encima de otro, el otro se corre.
- **Al guardar no quedan huecos verticales.** Mientras se acomoda, el módulo se
  queda exacto donde lo soltaste y el vacío se ve: estás armando la pantalla y
  tenés que mirar lo que hacés. Recién al tocar "Guardar" todo sube a apoyarse
  y los huecos se cierran. A lo ancho no pasa nunca: si dejás una columna libre
  a la izquierda se respeta, porque eso es una decisión de quien acomodó la
  pantalla y no un hueco por descuido.

Son dos funciones distintas en `src/lib/inicio.js`: `resolver()` acomoda
mientras se edita y sólo saca superposiciones; `compactar()` corre al guardar
y al leer, y además sube todo.

Al módulo seleccionado le aparece **Ajustes** arriba a la derecha. Ahí adentro,
en la misma tarjeta, se le cambia el tamaño, se elige qué muestra y se lo saca.
Se sale con el mismo botón o con Escape (y un segundo Escape lo deselecciona).

Arrastrar no es la única forma. Lo mismo se hace con las flechas del teclado
(y con Shift más las flechas para el tamaño), y con los botones de Ajustes: en
un celular no hay grilla que arrastrar, y hay gente que no usa el mouse. En
celular todo pasa a una sola columna y los módulos se leen en el orden en que
quedaron, como manda la sección 04 de la cartilla.

El alto define además cuántas filas muestra el módulo: si hay más, la última
línea dice cuántas quedaron y lleva a la sección completa. Mientras se acomoda
se trabaja sobre una copia, así "Descartar los cambios" deja la pantalla como
estaba.

Agregar un módulo nuevo es sumar una entrada en `src/lib/inicio.js` y su cuerpo
en `src/componentes/inicio/cuerpos.js`.

## La ficha del negocio

El nombre, la descripción y la foto se editan juntos desde "Mi negocio", con un
botón **Editar** que abre el modo edición y lo cierra con **Guardar** o
**Cancelar** (SCRUM-30). El nombre antes se fijaba al crear el negocio y no se
podía tocar más.

Mientras se edita, sobre la foto aparece un **pincel**. Ahí adentro hay dos
opciones: *Elegir foto*, que abre el explorador de archivos, y *Eliminar*, que
vuelve al ícono de local. "Eliminar" sólo aparece si hay una foto: ofrecer
sacar algo que no está es una puerta que no lleva a ningún lado.

**Se edita sobre un borrador, no sobre el dato en vivo.** Es lo que hace que
"Cancelar" deshaga de verdad: si la foto se guardara al elegirla, cancelar la
dejaría cambiada igual. Por eso hasta tocar "Guardar" la barra sigue mostrando
la foto vieja, y los tres campos se escriben en una sola operación: son un solo
"Guardar" en la pantalla y sería raro que la mitad quedara aplicada.

La descripción es un renglón de hasta 140 caracteres, y se ve bajo el rubro en
la tarjeta. El pincel es el único botón sin palabra al lado en todo el sistema
—encima de la foto no entra—, así que lleva `aria-label`.

Sin foto queda el ícono de local, que es lo que había.

La foto **se achica en el navegador** a 256 píxeles de lado y se guarda como
texto en una columna, no en un bucket de archivos. Esa es la decisión que la
hace andar igual con Supabase y en el modo de ejemplo, donde no hay servidor
que reciba nada. Pesa unos 20 KB.

Sale en WebP porque mantiene la transparencia: un logo con fondo transparente
pasado a JPEG queda con un recuadro negro. Un navegador que no lo soporte
devuelve PNG solo y funciona igual.

Tiene un techo y está escrito en `src/lib/imagen.js`: para logos grandes o
fotos de verdad esto no alcanza, y la respuesta es Supabase Storage con su
bucket y sus políticas, no subirle el número al máximo.

## Login

La entrada al sistema es del Sprint 1: crear cuenta (mail + teléfono + contraseña),
verificar el mail, iniciar sesión, recuperar la contraseña, crear el negocio y
elegir el preset del rubro, y cerrar sesión. El modo de ejemplo entra sin cuenta
y hace ese mismo recorrido desde "crear el negocio", pero contra el navegador.

Con la sesión abierta, la contraseña se cambia desde "Mi negocio" → "Tu cuenta"
(SCRUM-32). No pide la contraseña vieja porque Supabase no la pide: lo que
autoriza el cambio es la sesión. Se escribe dos veces, porque no se ve lo que se
escribe y un dedazo dejaría a alguien afuera de su propia cuenta.

La verificación de mail y la recuperación de contraseña necesitan el mail prendido
en el panel de Supabase (ver el paso 2 de "Conectar la base").

## El cliente mira su caso sin cuenta

Es la historia que ataca el problema que dio origen al proyecto: que el teléfono
no pare de sonar (SCRUM-68). Desde el detalle de un caso, el dueño o el
encargado arman un link y se lo mandan al cliente por WhatsApp. El cliente lo
abre en el celular, sin cuenta y sin instalar nada, y ve en qué estado está lo
suyo, por dónde va y lo que aprobó.

**Un link por caso, con un código secreto adentro.** El código lo genera la base
con `gen_random_bytes`: no sale del id del caso ni de su número, así que no se
puede adivinar ni recorrer probando valores cercanos. Compartir dos veces el
mismo caso devuelve el mismo link, porque uno nuevo dejaría muerto el que el
negocio ya mandó. Dejar de compartirlo corta el acceso en el mismo instante.

**Y contesta el presupuesto desde ahí.** Los pasos que esperan su respuesta
aparecen en la misma pantalla y los aprueba o los rechaza de a uno, con el monto
escrito y una confirmación antes. Aprobar es definitivo, igual que cuando lo
carga el mostrador: el trigger de `015_paso_aprobado_fijo.sql` no deja tocar un
paso aprobado, venga de donde venga. El historial deja escrito que lo contestó
él —el evento dice "desde el link" y firma "El cliente"—, que es lo que contesta
la discusión si mañana hay una sobre quién aprobó qué.

Es una decisión con plata tomada por quien tiene un link, sin cuenta: **el link
es la firma**. Por eso la respuesta entra sólo por una función que pide el
código, sólo sobre un paso de ese caso, sólo si está esperando respuesta y sólo
mientras el caso está abierto.

**Qué ve y qué no.** Ve el estado con las palabras de su rubro, qué significa,
qué se está esperando si está frenado, la línea de los cinco estados con sus
fechas, los pasos que aprobó con su total y los que esperan su respuesta. No ve
el diagnóstico interno, ni los pasos que ya rechazó, ni las notas, ni quién lo
está atendiendo, ni nada del inventario, ni ningún otro caso.

Eso está escrito en dos lugares que tienen que decir lo mismo: la función
`ver_seguimiento()`, que nació en `supabase/018_seguimiento.sql` y hoy vive en
`019_aprobar_desde_el_link.sql`, y `src/lib/seguimiento.js`, que hace el mismo
recorte para el modo de ejemplo. `pruebas/seguimiento.test.js` está escrito al revés de lo habitual:
comprueba que **no hay ningún campo de más**, así que falla si mañana alguien le
agrega una columna a `caso` sin acordarse de esta pantalla.

**No hay política de RLS para el rol anónimo.** Una política tendría que abrirle
`select` sobre `caso`, y con eso las columnas internas viajarían igual. La
función `security definer` es la única puerta y el código es la llave, el mismo
patrón que las invitaciones.

En el modo de ejemplo el link anda en ese mismo navegador, que es donde viven
los datos. Lo único que no funciona ahí es el registro de la última visita: eso
lo anota la base.

## Aislamiento por negocio

Las tablas tienen **Row Level Security** (`supabase/005_rls.sql`). Cada cuenta ve
y toca únicamente los datos de su negocio, y la regla vive en la base: aunque
alguien use la clave anónima a mano, no puede salirse de su negocio. Sin sesión
no se ve nada.

La tabla `usuario` liga la cuenta con su negocio, y la función `mi_negocio()` es
de la que cuelgan todas las políticas. El negocio se crea con la función
`crear_mi_negocio()`, que lo da de alta y lo ata a la cuenta en un solo paso —
por eso `negocio` no tiene política de alta: no se pueden crear negocios sueltos.

## Lo que todavía no está

Google Auth. Y la que más pidieron en las entrevistas: **generar solo el pedido
de repuestos** al aprobar un paso —el dolor más grande del taller, que hoy
resuelven a mano en Excel—. La mitad de esa ya está construida: el inventario
lista lo pedido y "marcar que llegó" destraba el caso; lo que falta es que
aprobar un paso cree el pedido.

## El cobro

Al entregar un caso se registra cuánto se cobró (SCRUM-74). El campo viene
precargado con lo que el cliente aprobó, que es lo que casi siempre se cobra, y
se puede pisar.

Dejarlo vacío también entrega el caso, y eso es a propósito: no es lo mismo
**no haber registrado un cobro** —se cobró por afuera, o todavía no se cobró—
que **haber cobrado cero**, que es una garantía o una cortesía. En la base son
`null` y `0`, y guardar las dos igual borraría un dato que después nadie puede
reconstruir.

Entregar es la única puerta por la que un caso se cierra. La lista de casos ya
no cierra en el acto: lleva al caso, donde está el cobro. Dos puertas de salida
y una sola que anota la plata terminaría con la plata sin anotar.

Reabrir un caso no borra el cobro: esa plata entró de verdad.

## Deploy

El proyecto es un Next.js estándar: en Vercel se importa el repo y anda sin
configuración extra. Las dos variables de `.env.local` hay que cargarlas en
*Settings → Environment Variables*.

## Integrantes

Grupo 6 — completar con los nombres y legajos.
