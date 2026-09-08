# TP Ingeniería de Software 2026c2 — Grupo 6

Sistema de gestión de casos para negocios chicos de servicio: taller mecánico,
medicina, service técnico. Un caso entra, avanza por cinco estados, se le arma
un presupuesto que el cliente aprueba paso por paso, y se entrega y se cobra.

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
pantalla de entrada ofrece **"Entrar con los datos de ejemplo"**: se entra sin
cuenta a un taller con 9 casos abiertos, guardado en tu navegador. Todo funciona:
abrir casos, hacerlos avanzar, aprobar pasos, cargar inventario, anotar turnos.
Para salir del modo de ejemplo, "Mi negocio" → "Salir del modo de ejemplo".

## Conectar la base de Supabase

1. En el SQL Editor de Supabase, correr **en orden numérico** todos los archivos
   de `supabase/`, del `001_schema.sql` al `009_diagnostico.sql`. Todos se pueden
   volver a correr cuantas veces haga falta.

   Los que agregan columnas o tablas al esquema —003, 004, 006 y 009— hacen falta
   sólo si la base se creó con una versión anterior del 001; en una base nueva el
   001 ya las trae. El **005** y el **008** no son opcionales: prenden el
   aislamiento por negocio y los permisos por rol, y sin ellos, con RLS activado,
   la aplicación no ve ni escribe nada.
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

`002_seed.sql` borra y recrea todo: sirve para volver al estado inicial conocido,
por ejemplo justo antes de una demo.

## Cómo está armado

```
src/
├── app/                    una carpeta por pantalla (App Router)
│   ├── page.js             Inicio, armado por módulos
│   ├── casos/              lista, alta, detalle y aprobación de pasos
│   ├── agenda/  clientes/  inventario/  aprobar/  equipo/  negocio/
│   └── globals.css         los tokens de la cartilla, en Tailwind
├── componentes/            piezas base: botones, campos, chips, íconos
│   └── inicio/             el marco y el contenido de cada módulo del Inicio
└── lib/
    ├── auth.js             sesión: cuentas de Supabase o modo de ejemplo
    ├── datos.js            capa de datos: Supabase si hay claves, si no local
    ├── semilla.js          los datos de ejemplo
    ├── estados.js          los cinco estados y sus reglas
    ├── presets.js          los diccionarios de rubro
    ├── modulos.js          el catálogo de módulos que un negocio puede prender
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

## Login

La entrada al sistema es del Sprint 1: crear cuenta (mail + teléfono + contraseña),
verificar el mail, iniciar sesión, recuperar la contraseña, crear el negocio y
elegir el preset del rubro, y cerrar sesión. El modo de ejemplo entra sin cuenta
con los datos de muestra del navegador.

La verificación de mail y la recuperación de contraseña necesitan el mail prendido
en el panel de Supabase (ver el paso 2 de "Conectar la base").

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

Google Auth. Y las dos que más pidieron en las entrevistas: **generar solo el
pedido de repuestos** al aprobar un paso —el dolor más grande del taller, que hoy
resuelven a mano en Excel— y **registrar el cobro** al entregar.

## Deploy

El proyecto es un Next.js estándar: en Vercel se importa el repo y anda sin
configuración extra. Las dos variables de `.env.local` hay que cargarlas en
*Settings → Environment Variables*.

## Integrantes

Grupo 6 — completar con los nombres y legajos.
