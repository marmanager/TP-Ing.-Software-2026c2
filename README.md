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

## Pruebas automatizadas

El proyecto usa dos niveles de pruebas:

- **Jest** para probar funciones de negocio de forma aislada y rápida. Los archivos
  están en `pruebas/*.test.js`.
- **WebdriverIO** para probar recorridos completos en Chrome, como lo haría una
  persona. Los archivos están en `pruebas/e2e/*.e2e.js`.

Después de `npm install`, los comandos son:

```bash
npm test                   # todos los tests de Jest, una vez
npm run test:watch         # Jest vuelve a correr al guardar cambios
npm run test:coverage      # Jest genera el informe coverage/
npm run test:e2e           # levanta Next.js y ejecuta WebdriverIO en Chrome
```

En Jest, cada `test` prepara datos, llama una función y verifica el resultado:

```js
import { test, expect } from "@jest/globals";
import { emailValido } from "../src/lib/validaciones.js";

test("rechaza un mail sin dominio", () => {
  expect(emailValido("ana@taller")).toBe(false);
});
```

En WebdriverIO, el test abre una URL, busca controles como los ve el usuario,
interactúa con ellos y verifica la pantalla siguiente:

```js
await browser.url("/iniciar-sesion");
await $("button=Entrar con los datos de ejemplo").click();
await expect($("h1=Inicio")).toBeDisplayed();
```

Conviene reservar Jest para reglas, cálculos y validaciones, y WebdriverIO para
unos pocos caminos críticos (iniciar sesión, crear un caso, aprobar un presupuesto
y cobrar). Los tests E2E son más lentos y más sensibles a cambios visuales.

**No hace falta configurar nada para que ande.** Sin credenciales de Supabase, la
pantalla de entrada ofrece **"Probar sin cuenta"**: creás tu negocio, elegís el
rubro y usás el sistema entero —abrir casos, hacerlos avanzar, armar
presupuestos, cargar inventario, anotar turnos—, todo guardado en tu navegador.
No viene ningún dato inventado: arrancás vacío, como una cuenta nueva de verdad.

Lo único que no se puede sin Supabase es invitar colaboradores, que necesita
cuentas reales. Para salir, "Mi negocio" → "Salir del modo de ejemplo".

## Conectar la base de Supabase

1. En el SQL Editor de Supabase, correr **en orden numérico** todos los archivos
   de `supabase/`, del `001_schema.sql` al `038_multinegocio.sql` (el `028`
   es opcional y se usa sólo para vincular Google Calendar; el `002`
   ya no existe: traía datos inventados y se sacó). Todos se pueden volver a
   correr cuantas veces haga falta.

   Después de la 038, correr `supabase/pruebas/multinegocio.sql`: prueba el
   aislamiento y los permisos contra la base y no deja nada guardado.

   Si una base existente muestra `function gen_random_bytes(integer) does not exist`,
   ejecutar `supabase/029_reparar_codigos.sql` en el SQL Editor. Actualiza las
   funciones y el valor por defecto que quedaron instalados con versiones viejas.

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
│   ├── agenda/             los turnos en lista, y adentro calendario/, el mes
│   ├── clientes/  inventario/  aprobar/  equipo/  historial/  negocio/  perfil/
│   └── globals.css         los tokens de la cartilla, en Tailwind
├── componentes/            piezas base: botones, campos, chips, íconos
│   └── inicio/             el marco y el contenido de cada módulo del Inicio
└── lib/
    ├── auth.js             sesión: cuentas de Supabase o modo de ejemplo
    ├── datos.js            capa de datos: Supabase si hay claves, si no local
    ├── semilla.js          el estado inicial del modo de ejemplo: vacío
    ├── estados.js          los cinco estados del caso y sus reglas
    ├── turnos.js           los cuatro estados de un turno de la agenda
    ├── horarios.js         cuándo atiende el negocio y qué huecos quedan
    ├── calendario.js       turnos por día, meses, semanas y carriles
    ├── inventario.js       cuándo dos productos son el mismo, categorías y cajas
    ├── ics.js              el archivo iCalendar de la agenda
    ├── presets.js          los diccionarios de rubro, y su vocabulario
    ├── modulos.js          el catálogo de módulos, y las pantallas de adentro
    ├── nombres.js          con qué nombre nace un caso y cómo se muestra
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

## Qué se prende y qué está siempre

**Inicio, Casos y Mi negocio están siempre.** Sin casos no hay sistema, y sin Mi
negocio no habría desde dónde volver a prender lo que se apagó. Todo lo demás que
aparece en la barra lateral es un módulo y se prende y apaga desde "Mi negocio" →
"Módulos": Agenda, Clientes, Inventario, A aprobar, Equipo e Historial. La
pantalla de módulos los lista en ese mismo orden, el de la barra, para que quien
busca ahí lo que ve en el menú lo encuentre en el mismo lugar.

Apagar un módulo saca la sección del menú y del Inicio, y su dirección muestra
"Tu negocio no tiene…" con el camino para prenderlo. No borra nada.

### Clientes e Historial vienen prendidos de fábrica (SCRUM-122 y 120)

Eran núcleo y pasaron a ser módulos. El problema es que la lista
`modulos_activos` de cada negocio dice lo que está **prendido**, y ningún negocio
que existe hoy tiene `clientes` ni `historial` escritos: hasta ahora no hacía
falta. Preguntar "¿está en la lista?" habría hecho que, el día que esto se
publique, todos los negocios perdieran las dos secciones de un saque y sin aviso.

Agregarlos con una migración parece lo directo, pero las migraciones de este repo
se pueden volver a correr, y volver a correr ésa prendería de nuevo lo que un
dueño apagó. Taparlo pedía una columna de versión, repetir lo mismo para el modo
de ejemplo, y dejaba un caso donde la elección de alguien se deshace sola.

Así que esos dos llevan `deFabrica: true` en `src/lib/modulos.js`: están
prendidos salvo que alguien los haya apagado, y apagarlos se anota explícito en
la lista como `-clientes` o `-historial`. Nada que migrar, igual en Supabase y en
el modo de ejemplo. `pruebas/modulos.test.js` recorre las listas de los negocios
de hoy y comprueba que ninguno pierda nada.

**Nadie pregunta `activos.includes(...)` a mano.** Se pregunta `estaPrendido()`,
que es el único que sabe cuáles son de fábrica. Lo usan la barra, la Guardia, el
Inicio y las dos pantallas de Mi negocio.

Apagar Clientes no deja de anotar clientes: se siguen dando de alta al abrir un
caso o un turno. Apagar Historial no deja de anotar lo que pasa: cada caso sigue
mostrando el suyo. Lo que se va es la sección.

### "A aprobar" se llamaba "Presupuesto" (SCRUM-121)

El módulo se llamaba "Presupuesto" y prometía algo que no hacía: apagarlo **no
apagaba ningún presupuesto**. Los pasos se siguen armando y aprobando adentro de
cada caso. Lo único que prende y apaga es la pantalla `/aprobar` —todos los casos
esperando que el cliente conteste— y su tarjeta del Inicio. Ahora se llama "A
aprobar", como en el menú, y la pantalla de módulos dice exactamente eso.

La clave sigue siendo `presupuesto`: está escrita en la lista de cada negocio que
existe y en cada preset, y cambiarla obligaba a migrar todo eso para decir lo
mismo.

### El Inicio no manda a secciones apagadas

El aviso de "lo que hay que mirar" del Inicio y la tarjeta de pendientes
linkeaban a la Agenda, a "A aprobar" y al Inventario sin mirar si estaban
prendidos: con el Inventario apagado, el Inicio seguía insistiendo con "insumos
por debajo del mínimo" y un link a una pantalla que el negocio había decidido no
tener. Ahora cada aviso sale sólo si su sección está prendida.

Los turnos nuevos pedidos por el link se miran contra la pantalla **Turnos** y no
contra la Agenda entera, porque se confirman ahí: el Calendario no tiene
acciones.

## Cada rubro habla como su mostrador

Lo que un negocio tiene en stock y pide no se llama igual en todos lados: un
taller o un service tienen **productos**, un consultorio **insumos**. Esas
palabras viven en el preset de cada rubro (`src/lib/presets.js`, campo
`palabras`) y las pantallas las piden con `vocabulario()`. Ninguna palabra del
oficio se escribe a mano en una pantalla.

El taller empezó con "repuesto" y pasó a "producto" porque en el estante hay
más que repuestos: tornillos, herramientas, lubricantes. Fue cambiar una línea
del preset, y cambió en toda la app.

```js
const { articulo } = vocabulario(negocio?.rubro);
`Agregar ${articulo.un()}`             // "Agregar un producto" · "Agregar un insumo"
`Guardar ${articulo.el()}`             // "Guardar el producto"
`${articulo.cuantos(3)} en camino`     // "3 productos en camino"
`${articulo.segun("Nuevo", "Nueva")}`  // concuerda con el género de la palabra
```

Cada palabra lleva su plural y su género **escritos**, no calculados, por lo
mismo que el identificador lleva `enFrase` aparte: el castellano no se deduce.
"Análisis" no cambia en plural, y "pieza" pide "una" y "nueva". Por eso
`pruebas/vocabulario.test.js` prueba también una palabra femenina, aunque hoy
ningún rubro use una: el día que un taller prefiera "pieza" a "repuesto" es un
cambio de una línea, y no puede salir "un pieza".

Hoy el vocabulario tiene una palabra, `articulo`, y la usan el Inventario, "En
camino", el caso, el Inicio y el historial. **"Caso" y "cliente" no están**:
aparecen en cientos de textos, cambiarlos pide concordancia en cada uno ("el
caso nuevo" → "la consulta nueva"), y además el núcleo común dice que las
pantallas son las mismas para todos. Si algún día se quiere "paciente" en un
consultorio, se agrega en `palabras` de los tres rubros y se reemplaza texto por
texto con `vocabulario(rubro).cliente`.

Las descripciones de los módulos (`src/lib/modulos.js`) no nombran lo que se
guarda: ese catálogo es uno solo para todos los rubros.

## Qué hay en el estante

Cada producto tiene, además del nombre, **marca**, **modelo** y **categoría**, y
puede venir **suelto o en caja**. Las cuatro son opcionales y nacen en
`supabase/031_productos.sql` (marca, modelo y caja) y `032_categorias.sql`
(categoría); sin esas migraciones la app sigue guardando productos, sin esos
datos, en vez de perderlos.

**En caja, se cuenta en cajas.** Una caja de 100 tornillos se carga diciendo
cuántos trae cada una, y la cantidad y el mínimo van en cajas, que es como se
cuenta en el estante. La fila muestra "3 cajas de 100 · 300 en total", y los
botones ± suman y restan de a una caja (y el lector de pantalla lo dice).

### Dos productos iguales son uno solo

Si se agrega algo que ya está, **se suma a lo que hay** en vez de crear otra
fila: dos filas de lo mismo hacen que ninguno de los dos números sea el del
estante. El alta lo avisa antes de guardar ("Ya lo tenés: hay 3 cajas de 100"),
el botón pasa a decir "Sumarlo a lo que hay", y el mínimo no se pide, porque se
está reponiendo, no configurando.

"Igual" lo decide `mismoProducto()`, en `src/lib/inventario.js`, con prueba:

- mismo nombre, marca y modelo, escritos como sea: sin mayúsculas, espacios de
  más ni tildes ("Bujía NGK" es "bujia  ngk"). La **ñ se queda**: "caño" no es
  "cano".
- y la misma presentación: suelto con suelto, y cajas del mismo tamaño. Una caja
  de 100 y una de 50 del mismo tornillo son dos líneas, porque 3 cajas más 2
  cajas no son 5 cajas de nada.
- la categoría **no** cuenta: es cómo se ordena, no qué es.

La regla se aplica en las dos puertas por donde entra stock: el alta, y un
pedido para reponer que llega desde "En camino". Con una sola, la otra seguía
dejando duplicados.

### Las categorías

Cada rubro trae las suyas en su preset (el taller: repuestos, filtros,
lubricantes, pernos, tornillos, herramientas, eléctrico). La que falte se crea
con **"+ Nueva"**, al lado del campo, sin salir del alta. Si ya existe escrita
de otra manera ("tornillos" con "Tornillos" en la lista) no se duplica: se elige
la que hay, y se dice.

Las que crea un negocio **no tienen tabla**: viven en el producto que las usa, y
la lista completa la arma `categoriasDisponibles()` con las de fábrica más las
que ya usan sus productos. Una categoría sin ningún producto adentro no sirve ni
para mirar el stock agrupado.

El botón dice "+ Nueva" y no sólo "+": la cartilla pide ícono y palabra en todo
botón, y la única excepción anotada es el pincel de la foto del negocio, que
encima de la foto no tiene lugar. Al lado del campo, sí.

### Mirarlo por producto o por categoría

"En stock" se mira de dos maneras, con dos botones arriba de la lista:
**Productos**, todos juntos, o **Categorías**, agrupados en orden alfabético con
"Sin categoría" al final, que es lo que falta ordenar y no una categoría más. Las
dos vistas usan la misma fila. La elección no se guarda, igual que "Mensual /
Semanal" del calendario.

### Buscar y filtrar (SCRUM-81)

En **Productos** hay una búsqueda que encuentra por nombre, marca, modelo o
categoría, sin mirar mayúsculas ni tildes: "bujia" encuentra "Bujía". A su
derecha, el botón **Filtros**, que abre debajo un panel con un grupo por
característica: categoría, marca, modelo y cómo viene.

**Los filtros salen de lo que tienen cargado los productos**, no de una lista
fija. Si ningún producto tiene marca, no hay grupo Marca; si todo viene suelto,
no hay "Cómo viene"; y si no hay nada que filtrar, no aparece el botón. Agregar
un producto con una marca nueva la suma a los filtros, y borrar el último de una
marca la saca. Lo mismo escrito distinto ("Bosch" y "bosch") es una sola
pastilla.

Adentro de un grupo se suma ("Bosch o NGK") y entre grupos se restringe ("Bosch
y Filtros"). La pastilla elegida va con el contorno y las letras en azul y el
fondo azul claro, la misma que "Productos / Categorías". Si se borra el único
producto de un valor elegido, la elección se descarta sola: si no, la lista
quedaría vacía sin nada a la vista para destrabarla.

En **Categorías** hay búsqueda y no filtros. Si lo escrito es el nombre de una
categoría, aparece entera; si es el de un producto, aparece su categoría con ese
producto, que es la respuesta a "¿dónde puse la bujía?". Cada vista tiene su
propia búsqueda porque buscan cosas distintas: "Bosch" escrito en una dejaría la
otra vacía sin razón a la vista.

Todo lo que no es pantalla está en `src/lib/inventario.js`, con pruebas:
`filtrosDisponibles()`, `filtrarProductos()`, `soloVigentes()` y
`buscarEnCategorias()`.

### El alta, como la de un turno

"Agregar un producto" se apaga en su lugar mientras el alta está abierta, y dice
por qué, en vez de cambiar de texto y cerrarla. Salir es "Cancelar", en rojo y
con el tacho, al pie del formulario. Es el mismo arreglo que el alta de un turno
y el pedido de "En camino".

## Lo que está en camino (SCRUM-113)

El Inventario tiene dos pantallas, como la Agenda: **En stock** —lo que hay y
cuánto queda— y **En camino** —lo que se pidió y todavía no llegó—. Se cambia
con las pestañas de arriba (`src/componentes/Pestanas.js`, el mismo componente
que usa la Agenda) y cada una se prende por su cuenta desde "Mi negocio".

**Lo que había y lo que faltaba.** Todo lo de después de pedir ya estaba
construido: el caso decía "Que llegue «…»", la lista de casos ofrecía "Marcar
que llegó", y el cliente no podía destrabar un caso al que le faltaba una pieza.
Lo que no existía era la manera de pedir: **ninguna parte del sistema creaba un
pedido**, y la sección que los listaba estaba siempre vacía. Ésa es la mitad
que se agregó.

Se pide desde "En camino", desde el caso ("Pedir un repuesto para este caso",
con el caso ya elegido) o desde "En stock" cuando algo baja del mínimo
("Pedirlo", con el nombre ya puesto). Un pedido para un caso lo deja esperando;
uno sin caso es para reponer el stock.

**Qué le pasa al caso** lo deciden dos funciones puras de `src/lib/estados.js`,
con prueba en `pruebas/en-camino.test.js`:

- `alPedirInsumo()`: el caso pasa a esperar. Si ya esperaba otra cosa, qué le
  falta lo decide `queFalta()`, que pone primero lo que tiene que contestar el
  cliente: un pedido nuevo no tapa que la pelota es suya.
- `alLlegarInsumo()`: el caso vuelve a moverse **sólo si ya no le falta nada**.

Esto último arregló un error que estaba escondido. Que llegara una pieza pasaba
el caso a "en proceso" siempre: aunque faltara otra, aunque el cliente no
hubiera contestado, y aunque el caso estuviera cerrado. Como nadie podía pedir,
nunca se notó; con pedidos de verdad, la primera pieza de dos destrababa un caso
que seguía sin poder avanzar.

En el historial, "Se pidió el repuesto" y "Llegó el repuesto" se anotan siempre,
pero **llevan el estado sólo cuando el caso cambió**: es lo que dibuja la línea
de tiempo que ve el cliente, y un punto sin cambio la ensuciaría.

**Pedir y marcar que llegó lo hacen el dueño y el encargado**, como el resto del
inventario: la base (`008_permisos.sql`) no deja que un técnico escriba un
insumo.

**"Llegado" no se usa.** La base tiene tres estados para un insumo —`pedido`,
`llegado`, `en_stock`— pensados para "llegó y todavía no se usó". Pero marcar
que llegó lo pasa directo al stock, así que nada produce `llegado`. "En camino"
lo sigue mostrando por si quedó alguno de antes. El filtro "Los que llegaron" de
la tarjeta de Inventario del Inicio, por lo mismo, da siempre vacío.

## La Agenda tiene dos pantallas

La Agenda dejó de ser una sola pantalla: adentro están **Turnos** —la lista, día
por día, que es donde se anota, se confirma, se cancela y se marca que alguien
vino— y **Calendario**, el mes en una grilla (SCRUM-20, fase 1).

**Se cambia de una a otra con dos pestañas arriba de la pantalla**
(`src/componentes/Pestanas.js`), no desde la barra lateral. La barra
dice a qué sección vas; una vez adentro, elegir la vista es parte de la sección,
igual que "Los que vienen / Los que ya pasaron" de la lista de turnos. Entrar a
Agenda cae siempre en Turnos.

Las pestañas son links y no botones: cada vista tiene su dirección, así que
funciona el botón de atrás del navegador y se puede guardar un favorito. Por eso
tampoco llevan `role="tab"`, que es para paneles que cambian sin salir de la
página; lo que corresponde es `aria-current="page"`. Si el negocio dejó una sola
pantalla prendida no aparece ninguna pestaña: un par donde no hay nada para
elegir ocupa 48 px de alto para no decir nada.

Las dos son **submódulos**: se prenden por separado desde "Mi negocio" →
"Módulos", y sólo aparecen si la Agenda está prendida. Sin Agenda no significan
nada, así que no son módulos sueltos. Están en `SUBMODULOS`, un catálogo aparte
de `MODULOS` en `src/lib/modulos.js`: de `LISTA_MODULOS` salen el contador de
"Mi negocio" y lo que recomienda cada preset, y meter los hijos ahí adentro
habría cambiado esos dos números sin que nadie lo pidiera.

Tres reglas, todas en `modulos.js` y todas con prueba en `pruebas/modulos.test.js`:

- **Prender la Agenda prende las dos.** Apagarla se las lleva.
- **La última prendida no se apaga.** Dejaría la Agenda prendida y vacía, que es
  lo mismo que apagarla pero por la puerta de atrás. El botón dice por qué:
  «Apagar Calendario · apagá Agenda».
- **Un negocio de antes de esto tiene las dos.** Tiene `agenda` en la lista y
  ningún hijo escrito, y eso no quiere decir "las dos apagadas": quiere decir que
  nadie eligió todavía. La primera vez que alguien toca un interruptor quedan
  escritas las dos. Por eso no hace falta migración.

### Mensual o semanal

El calendario se mira de dos maneras, y se cambia con dos botones arriba:

- **Mensual**: el mes en una grilla, con cuántos turnos tiene cada día. Es la
  vista de "cómo viene lo que viene". Se navega con los selectores de mes y año,
  o con "Anterior" / "Siguiente".
- **Semanal**: los siete días en franjas horarias, como la de Google Calendar.
  Cada turno se dibuja donde empieza y del alto que ocupa. Se navega con
  "Semana del" y "Anterior" / "Siguiente", que corren de a siete días.

La vista **no se guarda**: volver a entrar arranca en el mes. Guardarla es una
columna más en `negocio` o una preferencia por persona, y todavía nadie la pidió.

**La escala sale del área táctil, no al revés.** El turno que da el negocio mide
siempre 48 px de alto, que es el mínimo de la cartilla, y de ahí sale cuántos
píxeles vale un minuto. Un negocio que da turnos de 15 minutos tiene la grilla
más alta que uno que los da de una hora, y en los dos el turno de siempre se
puede tocar con el dedo.

**La grilla se estira para que no se esconda nada.** Arranca en el horario del
negocio, pero si hay un turno a las 8 en un negocio que abre a las 9 —lo cargó
alguien a mano— la grilla empieza a las 8. Una agenda que esconde un turno es
peor que no tener agenda.

**Los turnos que se pisan se parten el ancho.** El índice `turno_horario_unico`
(023) impide dos turnos a la misma hora, pero no dos que se pisen: uno de una
hora a las 9 y otro de media a las 9:30 conviven, y sin carriles el segundo se
dibujaría encima del primero. `acomodarEnCarriles()` los reparte, y cuenta los
carriles **por grupo de turnos encadenados y no por día**: si a las 9 hay dos
pisados y a las 15 hay uno solo, el de las 15 ocupa todo el ancho.

**Los cancelados no se dibujan en la semana.** Ese horario quedó libre, y
pintarlo diría que el negocio está ocupado cuando no lo está. Es el mismo
criterio que usa la base en `turno_horario_unico`, que también los deja afuera.
Siguen estando en Turnos, que es donde importa que se sepa que estaban.

Cada turno de la semana es un **botón** que elige su día. No es una acción —no
hay acciones en el Calendario— pero un bloque que no se puede enfocar deja la
grilla entera fuera del alcance del teclado y del lector de pantalla. Al tocarlo,
la lista de abajo muestra ese día entero, con todo lo que en la franja no entra.

### Los turnos en el calendario del celular

El dueño se suscribe una vez y sus turnos aparecen en el calendario que ya usa
—Google, Apple, Outlook— sin abrir el sistema (SCRUM-20, fase 2). El link se
arma en "Mi negocio" → "Cuándo atendés".

**Es un archivo iCalendar, no la API de Google.** Los tres clientes se suscriben
de fábrica a una dirección que devuelva ese formato: cero OAuth, cero
credenciales guardadas y ningún servidor nuestro hablándole a Google. Las tres
piezas son `supabase/027_agenda_ics.sql`, el route handler del archivo
(`src/app/calendario/[codigo]/route.js`) y el armador `src/lib/ics.js`.

**La suscripción por URL** es de sólo lectura. Google relee el archivo cuando
quiere —puede tardar horas—. Apple deja elegir cada cuánto.

**Vincular con Google Calendar** está junto al calendario de la app. Cada
integrante autoriza su propia cuenta una vez y la app copia los turnos a su
calendario principal. Al vincular, copia los existentes; mientras la app esté
abierta revisa cambios cada minuto. También hay una sincronización diaria en
Vercel, compatible con el plan Hobby, para los turnos que entran cuando no hay
nadie conectado. Google nunca escribe de vuelta en la agenda de la app.

Para activar esta opción:

1. Ejecutar `supabase/028_google_calendar.sql` en el proyecto Supabase de la app.
2. En Google Cloud, habilitar Calendar API, configurar el consentimiento OAuth
   y crear un cliente de tipo aplicación web con la URI de redirección exacta
   `https://TU-DOMINIO/api/google-calendar/callback`. El alcance solicitado es
   `https://www.googleapis.com/auth/calendar.events.owned`. Para probar en local,
   registrar también `http://localhost:3000/api/google-calendar/callback` y
   usar esa URI en el `.env.local`; la autorización debe volver al mismo origen
   que inició la vinculación.
3. Configurar en Vercel `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_KEY` y
   `CRON_SECRET`, siguiendo `.env.example`, y volver a desplegar. La clave de
   servicio y el secreto de Google van sólo en Vercel, nunca en `NEXT_PUBLIC_`.
   Se puede generar `GOOGLE_TOKEN_KEY` con
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. Entrar a la app, abrir **Agenda → Calendario** y tocar **Vincular con Google Calendar**.

Si una cuenta ya tenía la suscripción `.ics`, conviene quitarla de Google antes
de vincular para no ver cada turno dos veces. Al desvincular, los eventos ya
copiados permanecen en Google, pero dejan de actualizarse.

**Dos links, dos códigos, dos interruptores.** `agenda_codigo` (024) es el que
el negocio reparte por Instagram y muestra sólo qué horarios están ocupados, sin
ningún nombre. `ics_codigo` (027) es para el dueño y muestra nombre, motivo y
teléfono de cada turno. Con un solo código, cualquiera que pidiera turno podría
leer la agenda entera, y dar de baja uno daría de baja el otro. La pantalla dice
con todas las letras qué expone el segundo, y darlo de baja lo mata en el acto.

**Lo que se publica** sale de `ver_agenda_ics()`, armado campo por campo como
`ver_seguimiento()`: los turnos de los últimos 30 días para adelante, con nombre,
motivo, estado y teléfono. Nada de casos, presupuestos, plata ni inventario. La
ventana de 30 días no es capricho: un calendario no necesita los turnos de hace
dos años, y publicarlos agranda el archivo y el daño si el link se filtra.

**El formato tiene reglas que no se ven.** Líneas terminadas en CRLF, ninguna de
más de 75 **octetos** —una "ñ" ocupa dos, así que cortar por caracteres deja
líneas largas de más— y comas, punto y coma y barras invertidas escapados. Un
error ahí no se ve en pantalla: se ve en el celular de alguien, tres días
después, como un calendario vacío. Por eso `pruebas/ics.test.js` prueba el
formato y no el contenido.

El `UID` de cada evento es el id del turno y no cambia entre lecturas: si
cambiara, el calendario borraría y recrearía el evento cada vez que relee, y se
perderían los recordatorios que la persona le puso.

En el modo de ejemplo los turnos viven en el navegador y no hay servidor que los
publique; la pantalla lo dice y el link queda armado para cuando haya base.

### El calendario cambia según cómo esté el teléfono

En la computadora y **con el teléfono acostado** se ve el mes o la semana, con
sus controles. **Parado** se ve un día solo, con "Ayer" / "Mañana" y un selector
para saltar a cualquier otro; ahí no aparece el botón de mensual/semanal.

No es que la grilla no entre: entraría apretada. Son dos trabajos distintos.
Mirar el mes para planificar se hace sentado; el que abre el teléfono en el
taller quiere saber qué le queda hoy, y darle una grilla de casillas de 40 px es
hacerlo apuntar con el dedo para leer lo que ya sabía.

Las dos vistas se dibujan siempre y el navegador esconde una con `display:none`,
así que la escondida tampoco existe para un lector de pantalla. Al girar el
teléfono cambia sola, sin recargar y sin perder el día que estabas mirando: el
estado es uno solo para las dos.

El corte es `max-height:480px`, que es como este código viene diciendo "teléfono
acostado" desde la auditoría.

### El calendario sólo se mira

Anotar, confirmar, cancelar y marcar que alguien vino se hacen **todos en
Turnos**. El calendario no tiene ninguna acción: es para ver cómo viene el mes.

Así hay un solo lugar donde buscar cada cosa. El alta llegó a estar en las dos
pantallas y se sacó: obligaba a mantener dos veces el mismo formulario con sus
avisos, y le daba al usuario dos lugares para anotar lo mismo sin ninguna
diferencia entre ellos. El calendario lo dice con un link, en vez de que alguien
lo descubra buscando.

### Los turnos que pide el cliente aparecen solos

No hubo que integrar nada: un turno pedido por el link (024) es una fila de la
misma tabla `turno`, y el calendario lo dibuja como a cualquier otro. Los que
todavía no confirmó nadie del negocio se marcan en azul y con un punto, además
del número —color, símbolo y número, para que impreso en blanco y negro se siga
entendiendo—.

Lo que sí hubo que agregar es que la pantalla se entere. Los datos se leían una
sola vez, al entrar, y un turno que crea otra persona en otro navegador no
aparecía nunca. Ahora `datos.js` vuelve a leer cuando la pestaña vuelve al
frente (`visibilitychange`), que es el momento en que a alguien le importa que
esté al día. Un reloj que pregunta cada tanto gastaría pedidos toda la tarde con
la pestaña de fondo y seguiría llegando tarde justo cuando la persona vuelve.

Si alguna vez hace falta que el turno aparezca sin tocar nada, el camino es
Supabase Realtime sobre la tabla `turno` —que no anda en el modo de ejemplo,
donde no hay servidor—. Queda anotado con un comentario `ponytail:` en el código.

### Abrir el alta y salir de ella no son el mismo botón

El alta vive en `src/componentes/AltaDeTurno.js`, en Turnos.

"Anotar un turno" **no cambia de texto al abrirse el formulario**: se queda donde
está y se apaga, en gris, diciendo por qué —«Anotar un turno · ya estás anotando
uno»—, como manda la cartilla para todo botón apagado. Antes ese mismo botón, en
el mismo lugar, pasaba a decir "Cerrar el alta": el dedo iba al lugar de siempre
y hacía lo contrario de lo que esperaba. De paso, apagado no se pueden abrir dos
altas a la vez.

Salir es **"Cancelar"**, al pie del formulario, con tachito y en rojo, al lado de
"Guardar el turno". Descarta lo que se venía escribiendo.

El rojo acá es una excepción a la regla de `ui.js` —"el rojo es sólo para lo que
borra o no tiene vuelta"— y está pedida por el equipo. El argumento a favor es
que cancelar tira el borrador y eso no se deshace; el argumento en contra es que
todavía no se creó nada, así que por la regla iría `neutro`. Queda anotado para
que no se "corrija" sin saber que fue una decisión.

## El nombre de los casos

Un caso puede tener nombre (SCRUM-119). En el mostrador nadie busca "el 271":
busca el Gol de Hugo, la patente o "el de los frenos".

En **Mi negocio → Cómo se nombran los casos** se elige con qué nace el nombre
de cada caso nuevo: por número (como siempre), por el nombre del cliente, por
la patente —la ficha o el número de serie, según el rubro— o por lo que pidió.
Cambiar la opción **no renombra los casos que ya existen**: esos se editan de a
uno con el botón **Editar** del caso, que cambia el nombre y lo que pidió. Si el
nombre se borra, el caso vuelve a verse como "Caso 271". Cada cambio queda en el
historial, y con el caso cerrado no se edita.

El nombre va de título y el número queda siempre a la vista, en chiquito: dos
casos del mismo cliente se llamarían igual. Lo que el título ya dice no se
repite abajo: un caso nombrado por la patente no dice "AB 123 CD · AB 123 CD".

**El nombre es interno.** El cliente, en su link de seguimiento y en los
WhatsApp, sigue viendo "Caso 271": un nombre que alguien del negocio le puso al
caso no tiene por qué llegarle. Lo cuidan `ver_seguimiento()` en la base y
`CAMPOS_PUBLICOS` en `src/lib/seguimiento.js`, y hay un test que falla si el
nombre se filtra.

En el código hay dos formas de nombrar un caso, y no son intercambiables:
`tituloDelCaso()` para un título ("Caso 271" o el nombre) y `casoEnFrase()` para
adentro de una frase ("el caso 271" o "el caso Hugo Peralta"). Usar la primera
en una frase da "el caso Caso 271".

## Mi perfil

Lo de la persona, aparte de lo del negocio (SCRUM-118). Está en la barra
lateral, debajo de Mi negocio, y en el celular adentro de "Más". Tiene los
datos de la cuenta —nombre, teléfono y foto, que se editan con **Editar**, el
pincel y Guardar/Cancelar, igual que la ficha del negocio—, el mail (que se ve
pero no se cambia), el negocio en el que está la persona, la contraseña y
cerrar sesión. Todo eso antes vivía al pie de Mi negocio, como "Mi cuenta":
la contraseña es de quien entró, no del negocio. En Mi negocio queda un enlace
que dice adónde se mudó.

**Hay dos fotos y no se mezclan.** La del local es la de la ficha del negocio.
La de cada persona se carga en su perfil, y el equipo la ve en **Equipo**, al
lado de su nombre. Se lee de la cuenta en vivo, no se copia: si la persona la
cambia, en Equipo se ve la nueva. Las fichas cargadas a mano, sin cuenta, no
tienen perfil y siguen con el ícono; el dueño no tiene ficha y no aparece en
Equipo, así que su foto se ve en su perfil.

**Cada persona tiene dos nombres**: el de su cuenta (`usuario.nombre`) y el de
su ficha en el equipo (`empleado.nombre`), y el historial firma con el de la
ficha. La ficha sólo la puede tocar el dueño, así que guardar el perfil pasa
por `guardar_mi_perfil()` (`034_mi_perfil.sql`), que cambia los dos juntos y
sólo los de quien entró. Si no, alguien cambiaba su nombre y el historial
seguía firmando con el viejo.

Esa función es un borde de confianza —cualquier cuenta la puede llamar con lo
que quiera adentro—, así que valida en la base, sin confiar en la pantalla, que
el nombre no esté vacío y que la foto sea una imagen de tamaño razonable.

**Ver las fotos del equipo pasa por `fotos_del_equipo()`** y no por la tabla. La
política de `usuario` deja ver sólo la fila propia, y abrirla a los compañeros
abriría también el mail y el teléfono: las políticas filtran filas, no
columnas. La función devuelve el id y la foto, nada más. Editar la foto de otro
ya era imposible: lo impide la política `usuario_edita_lo_suyo` (005).

Si la 034 no se corrió, la aplicación arranca igual y Equipo muestra los íconos,
como con las invitaciones y los cobros. Guardar el perfil, en cambio, avisa que
no se pudo.

Hoy cada cuenta está en un solo negocio (`usuario.negocio_id`), y de eso cuelga
todo el aislamiento entre negocios. "Tu negocio" ya se muestra como una lista
para que el día que una cuenta pueda estar en varios crezca sin rediseñarse,
pero eso es otro trabajo, y toca la seguridad de toda la base.

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

## Revisar y presupuestar son un solo momento

El diagnóstico —qué se encontró al revisar— vive en la pantalla de los pasos y
no en el detalle del caso. Es el mismo momento de trabajo: se mira el auto, se
escribe qué tiene, y de eso salen los pasos del presupuesto. Estaba partido en
dos pantallas y había que ir y venir con el auto delante.

Va arriba de los pasos porque es el orden en que pasa, y porque así los pasos
se escriben mirando el diagnóstico y no de memoria. Desde ahí, "Armar un paso
con esto" abre el formulario sin salir ni perder lo escrito.

Corregir un diagnóstico que ya estaba trae el texto anterior cargado en el
campo y avisa que guardar lo reemplaza: ampliar es escribir abajo, no volver a
empezar.

## El cliente mira su caso sin cuenta

Es la historia que ataca el problema que dio origen al proyecto: que el teléfono
no pare de sonar (SCRUM-68). Desde la pantalla de los pasos —"Mandarle los
pasos al cliente"—, el dueño o el encargado arman un link y se lo mandan por
WhatsApp con el presupuesto entero escrito. El cliente lo abre en el celular,
sin cuenta y sin instalar nada, y ve en qué estado está lo suyo, por dónde va y
lo que aprobó.

Va ahí y no en el detalle del caso porque lo que se manda es el presupuesto. En
el detalle queda un renglón que dice si está compartido y si el cliente lo
abrió, que es lo que responde si hace falta llamarlo.

**Y cuando el trabajo está listo hay otro mensaje**, desde el detalle del
caso: dice qué se le hizo —con un tilde en lo terminado y un punto en lo que
no—, en qué estado quedó y el mismo link. Si el caso todavía no tenía link, lo
arma en ese mismo toque. Es el hermano del mensaje del presupuesto: mismo
patrón, otro momento.

**Mandar el link deja el caso esperando al cliente**, pero sólo cuando hay algo
que el cliente tenga que contestar. Avisarle que el trabajo ya está también
comparte el link, y ahí no se espera nada de él: el caso se queda en control
final, que es donde tiene que estar hasta que lo vengan a buscar.

Cuando sí hay algo para contestar, la pelota pasó a su lado,
así que el estado se mueve solo a "esperando" y el "qué falta" pasa a ser "la
respuesta del cliente". Si no, el tablero seguiría diciendo que el trabajo
avanza mientras en realidad no se puede hacer nada hasta que conteste.

**Un link por caso, con un código secreto adentro.** El código lo genera la base
con `gen_random_uuid()`: no sale del id del caso ni de su número, así que no se
puede adivinar ni recorrer probando valores cercanos. Compartir dos veces el
mismo caso devuelve el mismo link, porque uno nuevo dejaría muerto el que el
negocio ya mandó. Dejar de compartirlo corta el acceso en el mismo instante.

**El mostrador puede seguir contestando por él.** No todos los clientes van a
usar el link: el que llama por teléfono o pasa por el local se sigue
contestando a mano desde la pantalla de los pasos. Esa confirmación avisa que
se está contestando en nombre de otro y que va a quedar registrado como que lo
aprobó él, porque es un acuerdo por plata y el que toca el botón no es el que
acepta.

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

Y por eso la pantalla, antes de que diga que sí, contesta tres preguntas
distintas en tres renglones: **qué es** el trabajo (el "por qué conviene" que
escribió el negocio, o el aviso de que no dejó ninguno), **cuánto** le van a
cobrar y en cuánto queda su total, y **qué pasa después**. Cuando contesta, un
comprobante repite qué aprobó y por cuánto: el renglón que tocó ya no está en la
pantalla, y sin eso no le queda constancia de nada.

**La salida para el que duda** es el teléfono del negocio, que se carga en "Mi
negocio" y vive en `negocio.telefono` (`020_telefono_del_negocio.sql`). No es el
de ninguna persona: es el del cartel. Con él, la pantalla ofrece escribirle por
WhatsApp con el mensaje ya armado —dice quién es, por qué cosa escribe y sobre
qué paso duda— o llamarlo. Si el negocio no lo cargó, no aparece ningún botón:
una puerta que no abre es peor que ninguna.

**El estado, como un camino.** Arriba de todo van los cinco estados como
cuadrados unidos por flechas: en fila en la compu, apilados en el celular —que
es donde casi siempre se abre el link—. Los que ya pasaron llevan un tilde y la
fecha, el actual va resaltado con "Acá está ahora", y los que faltan van
apagados. La flecha que sale del actual va en azul: es la que dice qué sigue.

Debajo, qué quiere decir ese estado, dicho por el negocio y en las palabras del
rubro: "Estamos diagnosticando y evaluando posibles problemas con tu vehículo"
en un taller, "tu equipo" en un service, y a la persona en medicina. Esos textos
viven en `src/lib/presets.js`, junto a los ejemplos de cada rubro, y un rubro
que no traiga los suyos usa unos genéricos (`SEGUIMIENTO_GENERICO`), pensados
como punto de partida del futuro preset "Personalizado". Se buscan con
`queSignificaPara()` y no con `preset()`, porque `preset()` cae en el taller
cuando no conoce el rubro, y un negocio de otro oficio terminaría leyendo
"tu vehículo". Si el caso está frenado y se sabe qué se espera, en vez de ese
texto va el aviso de quién tiene la pelota.

**Qué ve y qué no.** Ve el estado con las palabras de su rubro, qué significa,
qué se está esperando si está frenado, el camino de los cinco estados con sus
fechas, los pasos que aprobó con su total y los que esperan su respuesta. No ve
el diagnóstico interno, ni los pasos que ya rechazó, ni las notas, ni quién lo
está atendiendo, ni nada del inventario, ni ningún otro caso, ni el nombre que
el negocio le puso al caso.

Eso está escrito en dos lugares que tienen que decir lo mismo: la función
`ver_seguimiento()`, que nació en `supabase/018_seguimiento.sql` y hoy vive en
`026_pago_en_el_seguimiento.sql`, y `src/lib/seguimiento.js`, que hace el mismo
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

**`usuario.negocio_id` y `usuario.rol` no se tocan desde el navegador**
(`035_usuario_blindado.sql`). Son las dos columnas de las que leen
`mi_negocio()` y `mi_rol()`, y hasta la 035 cada cuenta podía cambiarlas en su
propia fila: las políticas filtran filas, no columnas, y la de `usuario` sólo
mira que la fila sea de quien entró. Un técnico se podía poner `'duenio'`, y
cualquiera que conociera el identificador de otro negocio se podía meter en él.
Ahora las cuentas no pueden modificar ninguna columna de `usuario`, y al crear
su fila sólo pueden mandar `id`, `email`, `telefono` y `nombre`. El negocio y el
rol cambian únicamente a través de las funciones de la base, que verifican antes
de tocar. Si alguna vez hace falta que el navegador escriba otra columna de
`usuario`, se le da permiso a esa columna sola, nunca a la tabla.

**Sacar a alguien del equipo le quita el acceso** (`036_sacar_del_equipo.sql`).
Antes se borraba su ficha y nada más: dejaba de aparecer en Equipo, pero su
cuenta seguía apuntando al negocio y seguía entrando. Ahora un trigger sobre el
borrado de `empleado` deja a esa cuenta sin negocio en la misma operación. Va
como trigger y no en la pantalla a propósito: lo que abría el agujero era
borrar la ficha, por el camino que fuera, así que el arreglo cubre todos los
caminos.

**El rol de Equipo es el que da los permisos** (`037_rol_da_permisos.sql`). Cada
persona con cuenta tenía el rol en dos lugares: la etiqueta de su ficha y el que
daba los permisos (`usuario.rol`), y nada los volvía a unir después de la
invitación. Bajar a un encargado a técnico le cambiaba la etiqueta y seguía con
permisos de encargado. Ahora cambiar el rol de la ficha cambia los permisos, y
Equipo lo confirma antes diciendo qué gana y qué pierde la persona. Nadie se
puede cambiar el rol propio, y `empleado.usuario_id` no se escribe desde el
navegador: sólo lo pone aceptar una invitación. Al correrla, las etiquetas que
ya no coincidían se corrigen para decir la verdad: la migración no le cambia el
acceso a nadie.

**Varios negocios por cuenta** (`038_multinegocio.sql`, diseño en
`docs/multinegocio.md`). Una cuenta puede estar en varios negocios —sus
sucursales, o el propio y otro al que la invitaron—, con un rol en cada uno. Al
iniciar sesión elige a cuál entra, o entra directo al predeterminado si prendió
Inicio rápido; desde Mi perfil cambia de uno a otro. El negocio activo sigue en
`usuario.negocio_id`, así que el aislamiento no cambió: cambiar de negocio es
una función de la base que verifica que la cuenta tenga ficha ahí. El dueño
ahora tiene ficha y aparece en Equipo. A quien ya tenía un negocio no le cambia
nada: queda como predeterminado, con Inicio rápido prendido.

## Lo que todavía no está

La que más pidieron en las entrevistas, a medias: **generar solo el pedido de
repuestos** al aprobar un paso —el dolor más grande del taller, que hoy
resuelven a mano en Excel—. Desde SCRUM-113 el pedido se hace a mano, desde el
caso o desde "En camino" (ver "Lo que está en camino", más arriba), y el caso lo
espera y se destraba solo cuando llega. Lo que falta es que aprobar un paso lo
cree sin que nadie lo pida.

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
