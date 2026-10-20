# Roles y permisos configurables

Implementado. Plan: docs/roles-plan.md.

Diseño aprobado el 2026-10-18.

## Qué cambia

Hoy hay tres roles fijos (`duenio`, `encargado`, `tecnico`, con `check` en la
base) y los permisos están escritos a mano en tres lugares que tienen que
coincidir: las políticas (`mi_rol()`, `puedo_cargar()`), `PERMISOS` en
`src/lib/permisos.js` y `puedeCargar` en la API.

Pasa a haber **roles por negocio, con nombre libre y un set de permisos**. El
dueño (o quien tenga `manejar_roles`) crea los roles que quiera prendiendo y
apagando permisos, y le asigna uno a cada persona del equipo. Siempre existe un
rol **Dueño**, que nace con el negocio y puede todo.

`puede_en(negocio, permiso)` (047, 051) ya se creó pensando en esto: pasa a
leer la tabla de roles en lugar del `case` fijo.

## Decisiones

- **Una persona, un rol por negocio.** Los roles son de cada negocio (sede),
  no de la red.
- **Roles base por rubro.** Taller, medicina y service traen roles base
  editables. Personalizable arranca sólo con Dueño.
- **El rol Dueño** se puede dar a otras personas; no se edita ni se borra.
  Quien creó el negocio no puede ser bajado ni sacado por nadie (como en la 038).
- **Manejar roles es un permiso delegable, con tope:** nadie da un permiso que
  no tiene. Reemplaza al rango (dueño 3 > encargado 2 > técnico 1).
- **Borrar el negocio** lo puede hacer sólo quien lo creó. No es un permiso.
- **Visitas entre sedes:** quien no es miembro de una sede vinculada no la ve,
  salvo que su rol tenga `ver_sedes_vinculadas`; entonces entra sólo a mirar.
- **Sin `ver_montos` por ahora.** RLS filtra filas, no columnas: esconder
  montos obliga a pasar `paso` y `cobro` por vistas. Si hace falta, es una
  etapa propia.
- **Tono de los textos:** formal e impersonal. Ver "Textos".

## Catálogo de permisos

Las claves viven en la base (`permisos_conocidos()`), en la API y en el front.
Una prueba en cada lado verifica que las tres listas coincidan.

| Grupo | Clave | Qué habilita | Hoy |
|---|---|---|---|
| Casos | `ver_todos_los_casos` | Apagado: sólo los casos asignados | `verTodosLosCasos` |
| | `crear_casos` | Abrir casos nuevos | `cargarDatos` |
| | `avanzar_casos` | Cambiar el estado y marcar pasos hechos | `cargarDatos` |
| | `asignar_casos` | Elegir o cambiar el responsable | `cargarDatos` |
| | `entregar_y_reabrir` | Entregar (con seguimiento) y reabrir | `cargarDatos` |
| Presupuesto | `armar_presupuesto` | Crear y editar pasos y montos | `cargarDatos` |
| | `aprobar_por_el_cliente` | Aprobar o rechazar pasos desde el mostrador | `cargarDatos` |
| Cobros | `cobrar` | Registrar cobros, generar QR o link de pago | `cargarDatos` |
| | `conectar_mercadopago` | Vincular la cuenta de cobro | `cargarDatos` (043) |
| Clientes | `ver_clientes` | Ver clientes | todos |
| | `editar_clientes` | Crear y cambiar clientes | `cargarDatos` |
| Agenda | `ver_agenda` | Ver turnos | todos |
| | `manejar_turnos` | Dar, mover y cancelar turnos | `cargarDatos` |
| Inventario | `ver_inventario` | Ver productos y stock | todos |
| | `editar_inventario` | Cargar productos y stock | `cargarDatos` |
| | `ver_inventario_de_sedes` | Vista conjunta del inventario de la red | ya existe |
| Sedes | `ver_sedes_vinculadas` | Entrar a mirar sedes vinculadas donde no se es miembro | nuevo |
| | `vincular_sedes` | Vincular y desvincular sedes | ya existe |
| Equipo | `sumar_al_equipo` | Invitar, link de ingreso, aprobar pedidos | ya existe |
| | `sacar_del_equipo` | Sacar personas del equipo | dueño |
| | `manejar_roles` | Crear, editar y asignar roles (con tope) | nuevo |
| Negocio | `configurar_negocio` | Datos, horarios, módulos, Inicio, landing, links públicos de agenda | dueño |
| | `ver_historial` | Ver el historial del negocio | todos |

**Lo que hoy hace el encargado y queda en un permiso de trabajo diario**, para
que el pasaje no le quite nada: las ecuaciones del presupuesto van con
`armar_presupuesto`; los mensajes de WhatsApp (seguimiento al entregar y
recordatorio de turno) con `entregar_y_reabrir`; compartir el link de
seguimiento de un caso con `avanzar_casos`.

**Lo que sumó el equipo mientras tanto (053 a 056 y el Dashboard)**, con el
mismo criterio de no cambiarle el acceso a nadie: compartir y dejar de
compartir la landing, con `configurar_negocio`; revertir la baja de avisos de
un cliente, con `editar_clientes` (cambia su ficha); el aviso de volver y los
del presupuesto, como los demás mensajes de WhatsApp, con
`entregar_y_reabrir`; el Dashboard (API y pantalla), con
`ver_todos_los_casos`: son números de todo el negocio, y sin ese permiso la
RLS de caso sólo dejaría contar los asignados.

**`ver_historial`** habilita la pantalla Historial del negocio. Los eventos de
un caso se siguen viendo con el caso (la base los muestra a quien ve el caso).

**Permisos de mirar** (los únicos que valen de visita): `ver_todos_los_casos`,
`ver_clientes`, `ver_agenda`, `ver_inventario`, `ver_historial`.

**Sólo del creador, fuera del catálogo:** borrar el negocio.

## Roles base

Son exactamente los permisos que hoy dan encargado y técnico, así el pasaje no
cambia ningún acceso.

| Rubro | Rol con permisos de encargado | Rol con permisos de técnico |
|---|---|---|
| taller | Encargado | Mecánico |
| medicina | Encargado | Profesional |
| service | Encargado | Técnico |
| personalizable | — | — |

- **Encargado:** todo el catálogo salvo `configurar_negocio`,
  `vincular_sedes`, `sumar_al_equipo`, `sacar_del_equipo`, `manejar_roles` y
  `ver_sedes_vinculadas`. Con `conectar_mercadopago` y
  `ver_inventario_de_sedes` (como hoy).
- **Técnico / Mecánico / Profesional:** `ver_clientes`, `ver_agenda`,
  `ver_inventario`, `ver_inventario_de_sedes`, `ver_historial`. Sin
  `ver_todos_los_casos`. Hoy no cambia el estado de un caso (la API se lo
  frena) pero sí marca hechos los pasos de sus casos asignados (021): eso
  sigue igual, sin permiso aparte. **El responsable de un caso siempre marca
  sus pasos hechos.**

## Base de datos

```
rol(
  id          uuid primary key,
  negocio_id  uuid not null references negocio on delete cascade,
  nombre      text not null,
  es_duenio   boolean not null default false,
  permisos    text[] not null default '{}',
  creado_en   timestamptz not null default now()
)
unique (negocio_id, lower(nombre))
unique (negocio_id) where es_duenio           -- un solo Dueño por negocio
check (permisos <@ permisos_conocidos())
```

- `empleado.rol_id uuid not null references rol`. Un rol no se borra si alguna
  ficha lo usa (`borrar_rol` lo controla; la clave foránea es `no action` para que borrar el negocio entero no choque); la pantalla lo explica.
- Trigger: el rol con `es_duenio` no se edita ni se borra. Su `permisos` se
  ignora: tiene todos, incluidos los que se agreguen después.
- Trigger al crear un negocio: crea el rol Dueño y los de `roles_base(rubro)`.
  El rubro es fijo (013), así que no hay que volver a sembrar.
- Siguen los candados de la 037 y la 038: nadie cambia su propio rol, nadie
  baja ni saca a quien creó el negocio, `usuario_id` lo ponen sólo las
  funciones.
- Escritura de `rol` y de `empleado.rol_id` sólo por funciones
  (`guardar_rol`, `borrar_rol`, `asignar_rol`), no por `insert`/`update`
  directo, para que el tope no se pueda saltear.

**Pasaje de lo que ya existe** (en la misma migración, idempotente):

1. Cada negocio recibe su rol Dueño.
2. Por cada rol viejo en uso en el negocio (`encargado`, `tecnico`) se crea un
   rol con el nombre del preset del rubro y sus permisos de hoy. En
   personalizable, los nombres son "Encargado" y "Colaborador".
3. Cada ficha recibe su `rol_id`.
4. Prueba: para cada persona y cada permiso, el resultado es el mismo antes y
   después.

`empleado.rol`, `usuario.rol`, `mi_rol()`, `puedo_cargar()` y `rango_del_rol()`
se borran en la última etapa.

## Chequeo de permisos

`puede_en(p_negocio, p_permiso)`:

1. Si quien llama tiene ficha en `p_negocio`: su rol. Dueño, sí; si no,
   `p_permiso = any(rol.permisos)`.
2. Si no tiene ficha pero `usuario.visitando_desde` es una sede de la misma red
   y `p_negocio = usuario.negocio_id`: el rol de su ficha en `visitando_desde`,
   y sólo si `p_permiso` es un permiso de mirar.
3. En cualquier otro caso, o con una clave desconocida: no.

`puede_aca(p) = puede_en(mi_negocio(), p)` es el atajo para las políticas.

Una migración vuelve a crear cada política y cada función `security definer`
que hoy mira el rol:

- `mi_rol() = 'duenio'` → el permiso que corresponda (`configurar_negocio`,
  `sacar_del_equipo`, …).
- `puedo_cargar()` → el permiso específico de cada tabla.
- `mi_rol() <> 'tecnico' or responsable_id = mi_empleado()` →
  `puede_aca('ver_todos_los_casos') or responsable_id = mi_empleado()`.
- Las políticas de lectura que hoy son "todo el negocio" pasan a exigir su
  permiso de mirar (`ver_clientes`, `ver_agenda`, …).

Afecta las políticas de la 008 y las funciones de 018, 021, 024, 025, 027,
040, 041, 043, 048, 049, 050 y 051 que llaman a `mi_rol()` o `puedo_cargar()`.

### El tope

Quien tiene `manejar_roles` (o es Dueño):

- **Crea o edita** un rol sólo si sus permisos, antes y después, están dentro
  de los propios. No toca el rol Dueño ni el rol propio.
- **Asigna** un rol a alguien sólo si el rol nuevo y el que la persona tiene
  ahora están dentro de los propios. Nunca a sí mismo ni a quien creó el
  negocio.
- **El rol Dueño** lo da sólo un Dueño.
- `aprobar_solicitud` (051) aplica la misma regla en lugar de `rango_del_rol`.
- **Saca del equipo** (`sacar_del_equipo`) a alguien con cuenta sólo si el rol
  de esa persona está dentro de los propios; a un Dueño, sólo otro Dueño
  (`quitar_acceso_al_sacar`, 063).

### Acciones compuestas

Una acción que hace más de una cosa pide el permiso de cada una:

- **Permisos que vienen con otro.** `guardar_rol` suma el de mirar sin el cual
  otro no sirve: `crear_casos` → `ver_todos_los_casos`, `editar_clientes` →
  `ver_clientes`, `editar_inventario` → `ver_inventario`, `manejar_turnos` →
  `ver_agenda`. Se suman antes del tope. El editor los prende con el que los
  trae y los muestra fijos: "Incluido por «<nombre>»".
- **Abrir un caso** con un cliente nuevo pide además `editar_clientes`; desde un
  turno, `manejar_turnos`. **Dar un turno** a un cliente nuevo pide además
  `editar_clientes`.
- **Pedir algo para un caso o marcar que llegó** pide `editar_inventario` y
  `avanzar_casos`.
- **El descuento** de un caso lo cambia también quien arma el presupuesto
  (`armar_presupuesto`), solo. `que_falta` viaja libre con el estado y con el
  responsable (`asignar_casos`).

Errores con `errcode = '42501'` (sin permiso) o `P0001` (regla de negocio, con
el mensaje para mostrar).

### Borrar el negocio

`borrar_negocio(p_negocio uuid, p_nombre text)`: sólo si
`negocio.creado_por = auth.uid()` y `p_nombre` coincide con el nombre del
negocio. Borra en cascada. Las cuentas del equipo quedan; si el negocio era su
activo, `usuario.negocio_id` pasa a su predeterminado o a null.

## Visitas entre sedes

- `sedes_que_veo()`: parte de la red de la sede de origen (la activa, o aquella
  desde la que empezó la visita) y lista las sedes donde se es miembro más, si
  el rol de origen tiene `ver_sedes_vinculadas` o es Dueño, las demás sedes de
  esa red. Sin el permiso, las otras sedes no aparecen en ningún lado.
- `entrar_de_visita(p_sede)`: misma red, sin ficha en `p_sede`, y el rol en la
  sede activa tiene `ver_sedes_vinculadas`. Pone `usuario.negocio_id = p_sede`
  y `usuario.visitando_desde = <sede activa>`.
- `entrar_al_negocio()` limpia `visitando_desde`. Es la forma de volver.
- **El visitante ve sólo lo que su rol ve en su sede:** de los permisos de
  mirar, los que su rol tiene. Si en su sede no ve clientes, en la otra
  tampoco. Ningún permiso de cambiar vale de visita, así que todas las
  políticas de escritura lo frenan sin tocarlas (salvo `evento`, ver abajo).
- **Visita vencida:** si durante la visita se quita la ficha de origen, se
  desvinculan las sedes o se quita el permiso, `estoy_aca()` da falso y el
  negocio, el equipo, los roles y las fotos de la sede visitada quedan vacíos.
  El historial de los casos (`evento`) sólo lo escribe quien tiene ficha.
- **Límite conocido:** durante una visita legítima la fila de `negocio`
  (incluidos los códigos de sus links públicos) se puede leer aunque el rol de
  origen no tenga `ver_agenda`, porque RLS no filtra columnas.
- La vista conjunta de inventario (047) no cambia: muestra sólo las sedes donde
  se es miembro.

## API

- `quienSoy()` trae `permisos: string[]` con `rpc('mis_permisos')`, y
  `visitando: boolean`.
- `puede(quien, clave)` reemplaza a `puedeCargar` y a los `quien.rol === …`
  (12 archivos). La base decide igual; la API sólo responde antes.
- Módulo nuevo `roles`: `GET /v1/roles`, `POST /v1/roles`,
  `PATCH /v1/roles/:id`, `DELETE /v1/roles/:id`,
  `PATCH /v1/equipo/:empleadoId/rol` con `{ rol_id }`. Llaman a las funciones de la base;
  `42501` → 403 `sin_permiso`, `P0001` → 422.
- `GET /v1/sedes` usa `sedes_que_veo()`; `POST /v1/sedes/:id/visita` llama a
  `entrar_de_visita`.
- `DELETE /v1/negocio` con `{ nombre }`.
- `pruebas/apoyo/supabase-falso.ts` aprende `puede_en` con roles.

## Front

- **Mi negocio → Roles** (pantalla nueva): lista de roles con cuántas personas
  tiene cada uno; Dueño primero, con candado y "Tiene todos los permisos".
  Dentro de un rol: nombre y permisos agrupados como en el catálogo, cada uno
  con su descripción. "Crear un rol" y "Copiar de otro rol".
- **Equipo:** el desplegable lista los roles del negocio. La confirmación del
  cambio sale de comparar las dos listas de permisos (`queCambiaConElRol`).
- `src/lib/permisos.js`: `PERMISOS` fijo → catálogo (clave, grupo,
  descripción). `puede(permisos, clave)` recibe la lista de la sesión.
- `src/lib/presets.js`: se van `roles` y `etiquetaRol`; el nombre del rol es
  un dato.
- **Franja de visita** en todas las pantallas: "Sede Centro · Sólo lectura.
  Volver a Sede Norte". No se ofrecen controles de cambio.
- **Mi negocio → Borrar el negocio:** visible sólo para quien lo creó. Pide
  escribir el nombre del negocio.

### Textos

Formales e impersonales, sin voseo ni giros coloquiales. Ejemplos:

| En lugar de | Va |
|---|---|
| "Va a poder…" / "Deja de poder…" | "Permisos que se agregan" / "Permisos que se quitan" |
| "No podés dar un permiso que no tenés" | "Este permiso no está incluido en su rol" |
| "Lo tienen 3 personas, cambiales el rol primero" | "Rol asignado a 3 personas. Para eliminarlo, asigne otro rol a esas personas." |
| "Estás mirando Sede Centro, no podés cambiar nada" | "Sede Centro · Sólo lectura" |

**Pendiente fuera de este diseño:** reescribir la regla de la cartilla que
pide hablarle al usuario de vos y en registro coloquial, para que deje de
aplicarse, y después llevar el resto de los textos de la aplicación al mismo
tono. Mientras tanto, esta funcionalidad ya usa el tono nuevo.

## Pruebas

- **SQL** (`supabase/pruebas/roles.sql`, sin dejar datos): el pasaje no cambia
  el acceso de nadie; el tope impide escalar (editar y asignar); el rol Dueño
  no se edita ni se borra; nadie cambia su propio rol ni toca al creador; un
  rol en uso no se borra; el visitante no escribe y no ve lo que no ve en su
  sede; sin `ver_sedes_vinculadas` la otra sede no aparece; sólo el creador
  borra el negocio.
- **API:** contrato de los endpoints de roles, visita y borrado; casos de uso
  con el repositorio falso; las tres listas de claves coinciden.
- **Front (Jest):** cada clave del catálogo tiene grupo y descripción;
  `queCambiaConElRol` con listas; `puede` con la lista de la sesión.
- **E2E:** crear un rol, asignarlo y comprobar que la persona deja de ver la
  acción.

## Etapas

Cada una se entrega sola y deja la aplicación andando.

1. **Base sin cambio de comportamiento:** tabla `rol`, pasaje, `puede_en` con
   roles, políticas reescritas. Mismos accesos que hoy.
2. **API y front leen permisos:** `quienSoy` con `permisos`, `puede(permisos,
   …)` en el front.
3. **Roles editables:** pantalla Roles, el tope, Equipo con roles.
4. **Visitas entre sedes:** `ver_sedes_vinculadas`, `sedes_que_veo`, franja de
   sólo lectura.
5. **Borrar el negocio y limpieza:** `borrar_negocio`; se borran
   `empleado.rol`, `usuario.rol`, `mi_rol()`, `puedo_cargar()`,
   `rango_del_rol()`.
