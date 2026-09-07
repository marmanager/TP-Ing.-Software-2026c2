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

1. En el SQL Editor de Supabase, correr en orden `supabase/001_schema.sql`,
   `002_seed.sql`, `003_usuario.sql` y `004_negocio_modulos_y_medicina.sql`. Todos
   se pueden volver a correr cuantas veces haga falta. El 003 y el 004 hacen falta
   sólo si la base se creó con una versión anterior del 001.
2. En el panel de Supabase, *Authentication → Providers → Email*: dejar activado
   el ingreso con contraseña. Para la verificación de mail y la recuperación de
   contraseña, además prender *Confirm email* y agregar
   `http://localhost:3000/nueva-contrasena` a las *Redirect URLs*.
3. Copiar `.env.example` a `.env.local` y completar las dos variables con los valores
   de *Project Settings → API*.
4. Reiniciar `npm run dev`.

En "Mi negocio" se ve de dónde están saliendo los datos en cada momento.

`002_seed.sql` borra y recrea todo: sirve para volver al estado inicial conocido,
por ejemplo justo antes de una demo.

## Cómo está armado

```
src/
├── app/                    una carpeta por pantalla (App Router)
│   ├── page.js             Hoy
│   ├── casos/              lista, alta, detalle y aprobación de pasos
│   ├── agenda/  clientes/  inventario/  aprobar/  equipo/  negocio/
│   └── globals.css         los tokens de la cartilla, en Tailwind
├── componentes/            piezas base: botones, campos, chips, íconos
└── lib/
    ├── auth.js             sesión: cuentas de Supabase o modo de ejemplo
    ├── datos.js            capa de datos: Supabase si hay claves, si no local
    ├── semilla.js          los datos de ejemplo
    ├── estados.js          los cinco estados y sus reglas
    ├── presets.js          los diccionarios de rubro
    └── modulos.js          el catálogo de módulos que un negocio puede prender
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

## Login

La entrada al sistema es del Sprint 1: crear cuenta (mail + teléfono + contraseña),
iniciar sesión, crear el negocio y elegir el preset del rubro, y cerrar sesión.
El modo de ejemplo entra sin cuenta con los datos de muestra del navegador.

Todavía pendiente: verificación de mail y recuperación de contraseña (dependen de
prender el mail en el panel de Supabase). Google Auth queda fuera de esta tanda.

## Lo que todavía no está

Las tablas siguen **sin Row Level Security**: la clave anónima puede leer y
escribir todo, y el negocio del usuario se resuelve del lado del cliente. El
aislamiento real por negocio va en el Sprint 2.

## Deploy

El proyecto es un Next.js estándar: en Vercel se importa el repo y anda sin
configuración extra. Las dos variables de `.env.local` hay que cargarlas en
*Settings → Environment Variables*.

## Integrantes

Grupo 6 — completar con los nombres y legajos.
