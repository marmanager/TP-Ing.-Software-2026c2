# Varios negocios por cuenta — diseño

Estado: **aprobado en conversación, falta revisar este documento**.
Fecha: 28 de septiembre de 2026.

## Qué se quiere

Que una misma cuenta maneje varios negocios —las sucursales de un dueño, o el
negocio propio y otro al que a uno lo invitaron—, que elija en cuál entrar al
iniciar sesión, que pueda cambiar de uno a otro desde Mi perfil, y que el dueño
aparezca en Equipo como uno más.

## Qué queda afuera

- **Métodos de pago y suscripción.** Cobrarle al usuario por usar el sistema es
  otro proyecto, con su propio diseño. No se agrega una sección vacía en Mi
  perfil: sería una puerta que no abre.
- **El modo de ejemplo** ("Probá sin cuenta") sigue con un solo negocio y sin
  selector. Varios negocios, sólo con cuenta real.
- **Un negocio activo distinto en cada dispositivo** (ver "Decisiones").
- **Volver a la pantalla que se había pedido** después de elegir negocio: como el
  selector aparece sólo al iniciar sesión, no hace falta.

## Cómo está hoy

- `usuario.negocio_id` liga la cuenta con **un** negocio. `mi_negocio()` lee de
  ahí, y de esa función cuelgan 62 referencias en las políticas de seguridad.
- `usuario.rol` es el rol con el que entra; `mi_rol()` lee de ahí.
- `empleado` es la ficha de cada persona en un negocio. Desde la 007 tiene
  `usuario_id`, que la liga con una cuenta. El dueño no tiene ficha.
- `crear_mi_negocio()` rechaza si la cuenta ya tiene negocio (*"Esta cuenta ya
  tiene un negocio"*), y `aceptar_invitacion()` también (*"Tu cuenta ya está en
  un negocio"*).

Ya resuelto camino a esto, cada uno en su commit:

| Migración | Qué hace |
|---|---|
| `035_usuario_blindado.sql` | Nadie cambia `usuario.negocio_id` ni `usuario.rol` desde el navegador. |
| `036_sacar_del_equipo.sql` | Borrar una ficha le quita el acceso a esa cuenta. |
| `037_rol_da_permisos.sql` | El rol de la ficha es el que da los permisos; nadie se cambia el propio; `empleado.usuario_id` sólo lo ponen las funciones. |

## Decisiones

**1. El negocio activo vive en la cuenta.** `usuario.negocio_id` y `usuario.rol`
pasan a significar *"dónde estoy ahora y con qué rol"*. Cambiar de negocio es
una función que verifica y copia. Así `mi_negocio()`, `mi_rol()` y las 62
referencias no se tocan.

*Contracara aceptada:* es uno por cuenta, no por dispositivo. Si en el celular
se cambia a otro negocio, la compu también queda en ése. La pantalla que quedó
atrás avisa y ofrece recargar; mientras tanto la base rechaza lo que intente
guardar para el negocio anterior. **Falla cerrado: nunca mezcla negocios.**

*Descartado:* leer el negocio activo de cada pedido del navegador. Obligaba a
reescribir `mi_negocio()`, el corazón del aislamiento, y todo lo que habla con
la base desde el servidor.

**2. La ficha de empleado es la membresía.** Los negocios de una cuenta son las
fichas que tienen su `usuario_id`. Sin tabla nueva: una tabla `miembro` aparte
duplicaría el rol, que es justo lo que la 037 terminó de unir.

**3. Un rol por negocio.** Se puede ser dueño en uno y encargado en otro.

**4. El selector aparece sólo al iniciar sesión** —con mail, con Google, o al
crear o confirmar la cuenta—, no cada vez que se abre la aplicación.

**5. El predeterminado y el Inicio rápido valen para la cuenta**, en todos los
dispositivos. Se guardan en la base.

**6. A quien ya tiene un negocio no le cambia nada:** al pasar a esta versión, su
negocio queda como predeterminado y con Inicio rápido prendido.

## La base: `038_multinegocio.sql`

### Columnas nuevas en `usuario`

- `negocio_predeterminado uuid references negocio (id) on delete set null`
- `inicio_rapido boolean not null default false`

Como el resto de `usuario` desde la 035, no se escriben desde el navegador:
sólo por `guardar_preferencias_de_entrada()`.

### Funciones

Todas `security definer`, con `set search_path = public`, sin ejecución para
`anon`. Verifican antes de tocar, y sólo tocan filas de quien entró.

- **`mis_negocios()`** → `(id, nombre, rubro, foto, rol)` de cada negocio donde
  la cuenta tiene ficha. Hace falta porque la política de `empleado` y la de
  `negocio` sólo dejan ver el negocio activo, y no se abren.

- **`entrar_al_negocio(p_negocio uuid)`** → busca la ficha de la cuenta en ese
  negocio; si no hay, *"No estás en ese negocio."*. Si hay, copia el negocio y
  el rol de la ficha a `usuario`.

- **`crear_mi_negocio(p_nombre, p_rubro, p_modulos)`** → deja de rechazar si ya
  hay negocio. Crea el negocio, crea la ficha de la cuenta como `duenio`
  —nombre: `usuario.nombre`, o la parte del mail antes del arroba, como hace
  `aceptar_invitacion()`— y entra.

- **`aceptar_invitacion(p_codigo, p_nombre)`** → deja de rechazar si ya hay
  negocio. Si la cuenta ya tiene ficha en ese negocio: *"Ya estás en ese
  negocio."*. Si no, crea la ficha como hoy y entra.

- **`guardar_preferencias_de_entrada(p_predeterminado uuid, p_inicio_rapido
  boolean)`** → el predeterminado tiene que ser un negocio con ficha de la
  cuenta, o nulo. Inicio rápido sin predeterminado: *"Elegí primero cuál es tu
  negocio predeterminado."*.

### Cambio a la 036

`quitar_acceso_al_sacar()`, además de dejar la cuenta sin negocio activo, le
saca ese negocio como predeterminado —y apaga Inicio rápido si queda sin
predeterminado—. Una cuenta con otros negocios, al iniciar sesión, pasa por el
selector.

### Pasaje de lo que ya existe (dentro de la 038)

1. Cada cuenta con negocio que no tiene ficha ahí —los dueños— recibe su ficha,
   con el rol de `usuario.rol`.
2. A cada cuenta con negocio: `negocio_predeterminado = negocio_id` e
   `inicio_rapido = true`.

Va antes de cambiar las funciones, para que ninguna cuenta quede sin ficha.

## La aplicación

### Lógica pura: `src/lib/entrada.js`, con pruebas

`alEntrar({ negocios, predeterminado, inicioRapido })` → a qué negocio entrar
directo, o que hay que mostrar el selector:

- Inicio rápido y un predeterminado que sigue siendo suyo → entra a ése.
- Sin ningún negocio → a `/crear-negocio`, donde viven el aviso de mail recién
  confirmado y el de invitación pendiente.
- Si no → selector.

### `src/lib/auth.js`

`misNegocios()`, `entrarAlNegocio(id)` y `guardarPreferenciasDeEntrada(...)`.
Después de entrar o de guardar, vuelven a leer la fila de `usuario`
(`traerUsuario()`), y con eso `datos.js` recarga solo el negocio nuevo.

Los errores de las funciones (`raise exception`, código `P0001`) pasan tal
cual; los demás, por `traducir()`, como en `guardarPerfil()`.

### Pantalla nueva: `/negocios`

*"¿A qué negocio entrás?"*. Columna centrada, una fila por negocio —foto o
ícono de local, nombre, rubro— y al final **"Nuevo negocio"** con un **+** en el
lugar de la foto, que lleva a `/crear-negocio`. Tocar un negocio entra y lleva
al Inicio.

Al cargar, si `alEntrar()` dice que entra directo, no se muestra: entra y sigue.

Las filas son un componente, `FilaNegocio`, que usa también Mi perfil.

### La Guardia y las entradas

- Cuenta real sin negocio activo → `/negocios` (antes, `/crear-negocio`).
- Una pantalla de entrada con sesión abierta —lo que pasa al volver de Google—
  → `/negocios` (antes, `/`).
- `iniciar-sesion` → `/negocios` al entrar con mail (antes, `/`).
- `/negocios` y `/crear-negocio` se pueden abrir teniendo negocio.
- El modo de ejemplo no cambia.

### `/crear-negocio`

Deja de frenar si ya hay un negocio (*"ya hay uno"*). Crea, entra, y va al
Inicio.

### Mi perfil

**Tu cuenta**: nombre, mail (con el que entrás, no se cambia), teléfono y
contraseña como `••••••••` con "Cambiarla", que abre el formulario de hoy. La
sección suelta "Tu contraseña" se suma acá.

**Tus negocios**: cada fila con foto, nombre, rubro y el rol de la cuenta en ese
negocio (*"· Dueño"*); el selector no muestra el rol. El negocio activo dice *"Estás acá"*, los otros
tienen **"Entrar"**, y a la derecha el interruptor **Predeterminado** (uno solo a
la vez: prender uno apaga el otro). Al final, **"Nuevo negocio"**. Debajo, el
interruptor **Inicio rápido**: *"Al iniciar sesión, entrar directo al
predeterminado."*. Apagado y diciendo por qué si no hay predeterminado; si se
apaga el predeterminado, se apaga solo.

**El interruptor** es un componente nuevo en `ui.js`: `<button role="switch"
aria-checked>`, con su etiqueta como parte del botón (área de 48 px), y una
bolita con tilde cuando está prendido. Dice su estado con color, ícono y
palabra, como pide la cartilla.

### Equipo

La ficha propia lleva la marca **"Vos"**, sin desplegable de rol ni "Sacar": la
base ya lo impide (036, 037), y un botón que no funciona no se muestra.

### Cuando el negocio cambia desde otro dispositivo

Al volver a la pestaña, se lee `usuario.negocio_id`. Si no es el negocio que se
está mostrando: cartel *"Desde otro dispositivo pasaste a {nombre}"* con
**Recargar**. No cambia solo, para no perder algo que se esté escribiendo.

### Si la 038 todavía no se corrió

La aplicación no se traba: si `mis_negocios()` no existe, se entra directo al
negocio activo, como hoy, sin selector. Es el mismo criterio que con los cobros
y las fotos del equipo.

## Pruebas

- **Jest**: `alEntrar()` y el resto de la lógica pura que salga.
- **`supabase/pruebas/multinegocio.sql`**: se corre en el SQL Editor, dentro de
  una transacción que se deshace al final, así que no deja nada. Crea dos
  negocios y tres cuentas de mentira, simula la sesión de cada una y comprueba:
  - una cuenta no ve los datos del otro negocio;
  - no se puede cambiar `negocio_id` ni `rol` a mano (035);
  - al sacar a alguien pierde el acceso y su predeterminado (036, 038);
  - al cambiarle el rol cambian sus permisos, y nadie se cambia el propio (037);
  - `empleado.usuario_id` no se escribe a mano (037);
  - `entrar_al_negocio()` a un negocio ajeno falla;
  - crear un segundo negocio y aceptar una invitación estando en otro funcionan;
  - `mis_negocios()` devuelve sólo los propios;
  - el predeterminado no puede ser un negocio ajeno.

  Si una prueba falla, frena y dice cuál. Si pasan todas, lo dice.
- **A mano, con cuentas reales**: una lista de pasos para el selector, cambiar de
  sucursal, Inicio rápido y Equipo.
- **El modo de ejemplo**, que no cambia, se prueba en el navegador.

## Orden de publicación

1. Correr la 038 en Supabase (agrega; no rompe nada del código de hoy).
2. Correr `supabase/pruebas/multinegocio.sql` y ver que pase.
3. Publicar el código.

A diferencia de la 037, acá la base va primero: el código nuevo llama a
funciones de la 038. Si igual se publica antes, entra directo como hoy (ver
"Si la 038 todavía no se corrió").
