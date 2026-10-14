# Sumar gente al equipo con un link, y aprobar quién entra — diseño

Estado: **aprobado; plan en `docs/equipo-por-link-plan.md` (Tareas 3-9 re-planificadas el 13/10/2026 sobre el código sin modo de ejemplo).**
Fecha: 12 de octubre de 2026.

## Qué se quiere

Que el dueño sume gente a su negocio mandando **un solo link al grupo de
WhatsApp**, sin elegir un rol por persona ni armar un link para cada uno. Quien
usa el link no entra directo: **queda pendiente** hasta que el dueño lo aprueba y
le da el rol. Y que no existan más personas sin cuenta en el equipo.

## Qué queda afuera

- **Avisarle a la persona por mail o WhatsApp cuando la aceptan.** Se entera al
  entrar: el negocio aparece en su selector.
- **La pantalla para configurar permisos por rol.** El permiso nuevo nace con
  nombre, en un solo lugar (ver "Permisos"), listo para enchufarse ahí.
- **Limitar cuántas personas pueden pedir con un link.** El link es de grupo; si
  se filtra, se cambia.

## Cómo está hoy

- **"Sumar a alguien"** (Equipo) crea una ficha **sin cuenta**: un nombre para
  asignarle casos a quien no usa el sistema. Se puede porque la `037` deja al
  dueño insertar fichas (`grant insert (id, negocio_id, nombre, rol) on empleado`).
- **"Invitar a que entre con su cuenta"** (`/equipo/invitaciones`) crea links de
  la tabla `invitacion` (007) con rol, cantidad de usos y días. Se comparten por
  WhatsApp, copiado o mail.
- **`aceptar_invitacion(codigo, nombre)`** (038) valida el link, crea la ficha con
  el rol del link, deja a la persona adentro de ese negocio y suma un uso.
- **Ser miembro de un negocio es tener ficha.** De eso dependen las políticas de
  la base, `mis_negocios()`, el selector, la red de sedes (`puede_en`, 047) y los
  permisos por rol (037).
- Lo que apunta a una ficha (`caso.responsable_id`, `cobro.creado_por`,
  `cobro.anulado_por`) está declarado `on delete set null`.

## Decisiones

1. **Un link de equipo por negocio**, sin rol y sin límite de usos, con
   vencimiento (30 días). "Cambiar el link" anula el anterior y crea otro; los que
   ya entraron siguen adentro.
2. **Usar el link deja un pedido, no una ficha.** El pedido vive en una tabla
   aparte (`solicitud_de_ingreso`). Quien pidió no tiene ficha, así que no ve nada
   del negocio aunque falte un control en algún lado. Se descartó una ficha con
   estado "pendiente": habría que enseñarle a ignorarla a cada uno de los lugares
   que tratan la ficha como membresía, y con que falte uno, alguien que consiguió
   el link reenviado ve el negocio.
3. **Aprobar crea la ficha con el rol que se elige en ese momento.** Rechazar
   borra el pedido. Quien es rechazado puede volver a pedir con el mismo link;
   si el link se filtra, el dueño lo cambia.
4. **El permiso `sumar_al_equipo`** cubre ver y cambiar el link, ver los pedidos,
   aprobar y rechazar. Hoy lo tiene sólo el dueño.
5. **Nadie da un rol más alto que el suyo.** Para cuando otro rol tenga
   `sumar_al_equipo`: un encargado que aprueba no puede crear dueños.
6. **Se borran todas las fichas sin cuenta** y la base deja de aceptar fichas
   nuevas creadas a mano: sólo nacen al crear un negocio (el dueño) y al aprobar un
   pedido. A pedido del usuario: no quiere personas sin cuenta en su negocio.
7. **Se terminan las invitaciones con rol.** Las activas se anulan y no se pueden
   crear más.

## Permisos

Como en `docs/red-de-sedes.md`: la base decide con `puede_en(negocio, permiso)`.

| Permiso | Dueño | Encargado | Técnico |
|---|---|---|---|
| `sumar_al_equipo` | sí | no | no |

- **Base:** la 051 vuelve a crear `puede_en` agregando el caso
  `'sumar_al_equipo' → e.rol = 'duenio'`, sin tocar los dos que ya tiene.
- **Rango de los roles:** dueño 3, encargado 2, técnico 1. Se puede dar un rol si
  su rango no supera el del rol propio en ese negocio.
- **API:** no decide permisos; traduce `42501` → 403 y `P0001` → 422.
- **Front:** `PERMISOS` suma `sumarAlEquipo` (sólo el dueño), con su
  `QUIEN_PUEDE` ("Sumar gente al equipo lo hace el dueño del negocio.") y su
  `QUE_ES` ("sumar gente al equipo y aprobar quién entra").

## La base: `051_equipo_por_link.sql`

La corre el usuario en el SQL Editor, después de la 047. Antes, la consulta de
"Antes de correrla".

### Antes de correrla: qué se va a borrar

```sql
select n.nombre                 as negocio,
       count(distinct e.id)     as fichas_sin_cuenta,
       count(distinct c.id)     as casos_que_quedan_sin_asignar,
       count(distinct k.id)     as cobros_que_pierden_quien
  from empleado e
  join negocio n   on n.id = e.negocio_id
  left join caso c  on c.responsable_id = e.id
  left join cobro k on k.creado_por = e.id or k.anulado_por = e.id
 where e.usuario_id is null
 group by n.nombre
 order by n.nombre;
```

Se corre como administrador en el SQL Editor y no cambia nada.

### Cambios a lo que existe

- `invitacion.de_equipo boolean not null default false`, y un índice único parcial
  `on invitacion (negocio_id) where de_equipo and not anulada`: un solo link de
  equipo activo por negocio.
- `update invitacion set anulada = true where not de_equipo and not anulada;`
- `revoke insert on invitacion from authenticated;`: los links sólo los crea
  `cambiar_link_de_equipo()`.
- `delete from empleado where usuario_id is null;`
- `revoke insert on empleado from authenticated;`: las fichas sólo las crean
  `crear_mi_negocio()` y `aprobar_solicitud()`, que son `security definer`. El
  permiso de cambiar `nombre` y `rol` (037) se mantiene.
- `aceptar_invitacion` se borra: la reemplaza `pedir_entrar`.
- `ver_invitacion(p_codigo)` cambia lo que devuelve, así que se borra y se vuelve a
  crear: `(negocio_nombre text, sirve boolean, motivo text)`. "Sirve" sólo si es un
  link de equipo, no anulado y no vencido.

### Tabla nueva: `solicitud_de_ingreso`

`id uuid pk, negocio_id uuid not null references negocio on delete cascade,
usuario_id uuid not null references usuario on delete cascade, nombre text not
null, email text, creada_en timestamptz not null default now()`, con
`unique (negocio_id, usuario_id)`. RLS prendida y **sin ninguna política**: nadie
la lee ni la escribe directo, sólo las funciones de abajo.

### Funciones

Todas `security definer`, `set search_path = public`, sin permiso para `public`
ni `anon` y con permiso para `authenticated`. Permisos con `errcode = '42501'`;
lo demás, `P0001`.

| Función | Qué hace | Qué rechaza |
|---|---|---|
| `link_de_equipo()` → `(codigo, vence_en)` | El link de equipo activo del negocio activo, o ninguna fila. | Sin `sumar_al_equipo` (42501: "Sumar gente al equipo lo hace el dueño del negocio."). |
| `cambiar_link_de_equipo(p_dias integer default 30)` → `(codigo, vence_en)` | Anula el link de equipo activo y crea otro, con vencimiento `now() + p_dias`. | Sin `sumar_al_equipo` (42501); `p_dias` fuera de 1 a 365. |
| `pedir_entrar(p_codigo text, p_nombre text default null)` → `(negocio_nombre text, estado text)` | Valida el link. Si la persona ya tiene ficha ahí: `'ya_estas'`. Si no, asegura su fila en `usuario` (id y mail), deja un pedido (si ya había uno, lo deja como está) y devuelve `'pendiente'`. No cambia su negocio activo. | Sin sesión; link inexistente, anulado, vencido o que no es de equipo, con los mensajes de hoy ("Este link no existe…", "Quien te invitó dio de baja este link.", "Este link ya venció. Pedí uno nuevo."). |
| `pedidos_de_ingreso()` → `(id, nombre, email, creada_en)` | Los pedidos del negocio activo, del más viejo al más nuevo. | Sin `sumar_al_equipo` (42501). |
| `aprobar_solicitud(p_id uuid, p_rol text)` | Crea la ficha (nombre del pedido, rol elegido) y borra el pedido. Si era la primera ficha de esa cuenta, queda de predeterminado con Inicio rápido (regla de la 038). Si la cuenta no estaba en ningún negocio, éste pasa a ser su negocio activo. | Un pedido que no es del negocio activo ("Ese pedido ya no está."); sin `sumar_al_equipo` (42501); un rol que no existe; un rol más alto que el propio (42501: "No podés dar un rol más alto que el tuyo."). |
| `rechazar_solicitud(p_id uuid)` | Borra el pedido. | Un pedido que no es del negocio activo; sin `sumar_al_equipo` (42501). |
| `mis_pedidos()` → `(negocio_nombre, creada_en)` | Los pedidos que la persona tiene esperando. | — |

`puede_en` se vuelve a crear con el caso nuevo (ver "Permisos"), y una función
chica `rango_del_rol(text) → integer` (dueño 3, encargado 2, técnico 1, cualquier
otro 0) para la regla del rol más alto.

### Pruebas

**Nueva: `supabase/pruebas/equipo_por_link.sql`**, con el formato de las otras
(cuentas y negocios de mentira, sesiones simuladas, todo se deshace). Lee
`negocio`, `empleado` y `solicitud_de_ingreso` como postgres donde la RLS no
dejaría ver. Se escribe antes que la 051 y tiene que fallar sin ella.

1. El dueño crea el link de equipo; cambiarlo anula el anterior y el anterior deja
   de servir para `pedir_entrar`.
2. Una cuenta pide entrar: queda un pedido y **ninguna** ficha. Con su sesión no ve
   el negocio, su equipo, sus casos ni su inventario, y el negocio no está en
   `mis_negocios()`. Pedir dos veces deja un solo pedido.
3. Un técnico y un encargado no pueden ver pedidos, aprobar, rechazar ni cambiar el
   link (42501).
4. El dueño aprueba con rol encargado: aparece la ficha con ese rol, el pedido se
   borra y la cuenta ve el negocio en `mis_negocios()`.
5. Rechazar borra el pedido y no crea ficha.
6. Un rol más alto que el propio se rechaza. Se prueba con `rango_del_rol` y con
   un dueño que intenta dar un rol inexistente. Con un encargado no se puede
   probar entero hasta que tenga el permiso: se prueba la función de rango.
7. `insert into empleado` directo desde una sesión se frena, y ya no queda ninguna
   ficha con `usuario_id` nulo.
8. `insert into invitacion` directo desde una sesión se frena.
9. Un link de equipo vencido o anulado: `pedir_entrar` lo rechaza con su mensaje.

**Adaptar las que ya existen** (usan invitaciones con rol para armar sus escenarios):

- `supabase/pruebas/multinegocio.sql`: donde el dueño crea una invitación con rol
  y la persona la acepta, pasa a ser: el dueño crea el link de equipo, la persona
  pide entrar y el dueño aprueba con ese rol (y después la persona entra con
  `entrar_al_negocio`). Los casos que probaban límites de usos de una invitación
  se reemplazan por "un link anulado no sirve".
- `supabase/pruebas/red_de_sedes.sql`: lo mismo para sumar a Caro y a Edu.

Orden de TDD: la prueba nueva y las adaptadas fallan antes de la 051 y dan
"Success" después.

## La API (rama + PR a `master`)

| Endpoint | Llama a | Responde |
|---|---|---|
| `GET /v1/equipo/link` | `link_de_equipo()` | `{ link: { codigo, vence_en } \| null }` |
| `POST /v1/equipo/link` | `cambiar_link_de_equipo()` | `{ link }` |
| `GET /v1/equipo/pedidos` | `pedidos_de_ingreso()` | `{ pedidos }` |
| `POST /v1/equipo/pedidos/:id/aprobar` con `{ rol }` | `aprobar_solicitud` | `{ empleados }`: el equipo actualizado, con la ficha nueva |
| `POST /v1/equipo/pedidos/:id/rechazar` | `rechazar_solicitud` | `{ rechazado: true }` |
| `POST /v1/invitaciones/:codigo/pedir` con `{ nombre? }` | `pedir_entrar` | `{ negocio_nombre, estado }` |
| `GET /v1/cuenta/pedidos` | `mis_pedidos()` | `{ pedidos }` |

- Se sacan: `POST /v1/equipo` (ficha sin cuenta), `POST /v1/invitaciones`,
  `POST /v1/invitaciones/:id/anular` y `POST /v1/invitaciones/:codigo/aceptar`.
- `GET /v1/publico/invitaciones/:codigo` queda, con la forma nueva de
  `ver_invitacion`.
- Errores como en sedes: `42501` → 403 `sin_permiso`, `P0001` → 422 con el mensaje
  de la base; ids que no son uuid y roles que no existen → 422.
- Pruebas de contrato para cada endpoint, con el Supabase de mentira
  (`mundo.funciones`), y que las rutas sacadas devuelvan 404.

## La aplicación

### Lógica pura, con pruebas

- `rolesQuePuedeDar(miRol)` en `src/lib/permisos.js`: los roles de rango menor o
  igual al propio, en el orden de `ORDEN_ROLES`.
- `mensajeDeInvitacion(nombreDelNegocio, link)` en `src/lib/equipo.js` (nuevo): "Sumate
  al equipo de Taller Sur en MarManager: <link>".

### Equipo (`src/app/equipo/page.js`)

- Se va el formulario y el botón **Sumar a alguien**.
- Sección **Sumar gente al equipo** (con `sumarAlEquipo`):
  - Con link: **Compartir por WhatsApp** (`wa.me` con el mensaje), **Copiar el
    link**, "Vence el …" y **Cambiar el link**, que pregunta antes: "El link
    anterior deja de funcionar. Los que ya entraron siguen adentro."
  - Sin link: **Crear el link del equipo**.
- Lista **Quieren entrar (n)** (con `sumarAlEquipo`, si hay pedidos): nombre, mail
  y fecha, un desplegable de rol con `rolesQuePuedeDar` (por defecto, técnico),
  **Aceptar** y **Rechazar**. Aceptar avisa "Listo. Ana entró como encargada."
- Sin `sumarAlEquipo`: la sección no aparece y la lista del equipo se ve como hoy.
- `/equipo/invitaciones` se borra; la ruta redirige a `/equipo`.

### Quien usa el link (`/unirme/[codigo]`)

- Muestra "Taller Sur te invitó a su equipo" y **Pedir entrar** (con sesión; sin
  sesión, primero entra o crea su cuenta y vuelve, como hoy con
  `invitacionPendiente`).
- Al pedir: "Listo. Le avisamos a Taller Sur: vas a poder entrar cuando te
  acepten." Si ya estaba: "Ya estás en Taller Sur." con el botón para entrar.
- Link vencido, anulado o inexistente: el mensaje de la base.

### Mientras espera

- **Selector (`/negocios`)**: arriba, "Esperando que te acepten: Taller Sur" (de
  `GET /v1/cuenta/pedidos`).
- **Crear negocio**, si no tiene ningún negocio: el mismo aviso, y la opción de
  crear el suyo mientras tanto.

## Pruebas

- **Base:** `pruebas/equipo_por_link.sql` (nueva) y las dos adaptadas.
- **API:** contrato de los endpoints nuevos y de los sacados.
- **Front, Jest:** `rolesQuePuedeDar`, `mensajeDeInvitacion`, el permiso
  `sumarAlEquipo` (y que `queCambiaConElRol` lo nombre).
- **Vista previa local:** Equipo sin link, con link y con la confirmación de
  cambiarlo; `/equipo/invitaciones` redirige; celular a 375 px. Los pedidos con
  datos reales necesitan cuentas reales.

**Registro de pruebas:** `pruebas/equipo-por-link.md` lleva la trazabilidad criterio → Jest → WebdriverIO y cada corrida (fecha, comando, resultado). Jest va por historia en `pruebas/historias/sumar-gente-al-equipo.test.js`; WebdriverIO en `pruebas/e2e/historias/sumar-gente-al-equipo.e2e.js`, con dos cuentas sembradas por la API (la dueña y otra sin negocio): prueba el circuito entero, link → pedido → aceptar → entrar. Desde el 12/10/2026 el front no tiene modo de ejemplo.

## Orden de publicación

1. La consulta de "Antes de correrla": el usuario ve qué se va a borrar.
2. Las tres pruebas de la base, antes de la 051: fallan.
3. `051_equipo_por_link.sql`. Las tres pruebas otra vez: "Success".
4. PR de la API a `master`; se mergea, Render publica, se borra la rama.
5. El front a `development` (con PR de base `development`, no `main`).

## Prueba a mano, con dos cuentas reales

1. Con la cuenta dueña: Equipo → Crear el link del equipo → Compartir por WhatsApp.
2. Con otra cuenta: abrir el link, Pedir entrar. El selector dice "Esperando que te
   acepten". No ve nada del negocio.
3. Con la dueña: Equipo → Quieren entrar → elegir encargado → Aceptar.
4. Con la otra cuenta: el negocio aparece en el selector; entra como encargada.
5. Con la dueña: Cambiar el link. Una tercera cuenta con el link viejo: "Quien te
   invitó dio de baja este link."
