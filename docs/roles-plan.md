# Roles y permisos configurables — plan de implementación

> **Nota de integración:** al integrar `development` (que trajo sus propias 053 a 056), las migraciones de este plan se renumeraron a 057–063: 053_roles → 057, 054_politicas_por_permiso → 058, 055_mis_negocios_con_rol → 059, 056_roles_editables → 060, 057_visitas_entre_sedes → 061, 058_borrar_negocio → 062, 059_roles_limpieza → 063. El texto de abajo conserva los números originales.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los tres roles fijos (`duenio`, `encargado`, `tecnico`) por roles por negocio con nombre libre y un set de permisos, con un rol Dueño que puede todo, roles base por rubro, visitas de sólo lectura entre sedes vinculadas y borrado del negocio por quien lo creó.

**Architecture:** La base decide: una tabla `rol` con `permisos text[]`, y `puede_en(negocio, permiso)` / `puede_aca(permiso)` leyendo esa tabla. Todas las políticas y funciones que hoy miran `mi_rol()` o `puedo_cargar()` pasan a preguntar por un permiso con nombre. La API trae los permisos de la sesión (`mis_permisos()`) y responde 403 antes; el front sólo esconde lo que la base va a rechazar. Cinco etapas, cada una deja la aplicación andando.

**Tech Stack:** Supabase (Postgres, RLS, funciones `security definer`), API Express + TypeScript + zod (repo `TP-IngeSoft-API`), front Next.js App Router + Tailwind (repo `TP-Ing.-Software-2026c2`). Pruebas: SQL en el SQL Editor, `node:test` en la API, Jest y WebdriverIO en el front.

**Spec:** `docs/roles.md` (en este repo). Leerla entera antes de empezar.

## Global Constraints

- Dos repos: `TP-Ing.-Software-2026c2` (front y `supabase/`) y `TP-IngeSoft-API`. Las rutas de este plan dicen de cuál son: `front:` o `api:`.
- Migraciones nuevas numeradas desde `053_`. Cada una idempotente (`create or replace`, `if not exists`, `drop ... if exists`), con el encabezado de comentario de las existentes ("Correr entero en el SQL Editor de Supabase, después de …").
- Toda función nueva: `security definer`, `set search_path = public`, `revoke all ... from public; revoke all ... from anon; grant execute ... to authenticated;` (salvo funciones `immutable` de catálogo, que no leen tablas).
- `create or replace function` conserva los grants: al recrear una función existente con la misma firma no hace falta repetirlos. Si cambia el tipo de retorno o la firma, hay que `drop function` y volver a dar los grants.
- Errores de permiso con `using errcode = '42501'`; reglas de negocio con `using errcode = 'P0001'`. La API traduce `42501` → 403 `sin_permiso` y `P0001` → 422 con el mensaje.
- En las políticas, los chequeos van envueltos en `(select puede_aca('...'))` para que Postgres los evalúe una vez por consulta y no por fila.
- **Ningún acceso cambia en las etapas 1 y 2:** el pasaje deja a cada persona con exactamente lo que podía hacer. La única excepción a propósito está en la Tarea 3 (la base pasa a frenar lo mismo que ya frenaba la API).
- **Textos nuevos: formales e impersonales, sin voseo** ("Este rol no incluye ese permiso", "Rol asignado a 3 personas. Para eliminarlo, asigne otro rol a esas personas."). Los textos existentes que no se tocan quedan como están.
- Las reglas de la cartilla que el README lista siguen valiendo: cuerpo de 18 px, nada debajo de 15 px, área táctil de 48 px, un solo botón azul por pantalla, botón apagado dice por qué, estado con color + ícono + palabra.
- Catálogo de permisos (23 claves, mismo orden en los tres lugares):
  `ver_todos_los_casos, crear_casos, avanzar_casos, asignar_casos, entregar_y_reabrir, armar_presupuesto, aprobar_por_el_cliente, cobrar, conectar_mercadopago, ver_clientes, editar_clientes, ver_agenda, manejar_turnos, ver_inventario, editar_inventario, ver_inventario_de_sedes, ver_sedes_vinculadas, vincular_sedes, sumar_al_equipo, sacar_del_equipo, manejar_roles, configurar_negocio, ver_historial`
- Permisos de mirar (los únicos que valen de visita): `ver_todos_los_casos, ver_clientes, ver_agenda, ver_inventario, ver_historial`.
- Permisos del rol viejo `encargado`: todos salvo `configurar_negocio, vincular_sedes, sumar_al_equipo, sacar_del_equipo, manejar_roles, ver_sedes_vinculadas`.
- Permisos del rol viejo `tecnico`: `ver_clientes, ver_agenda, ver_inventario, ver_inventario_de_sedes, ver_historial`.
- Nombres de los roles base: taller → Encargado / Mecánico; medicina → Encargado / Profesional; service → Encargado / Técnico; personalizable → ninguno (sólo Dueño). Para el pasaje de negocios personalizables que ya usan roles viejos: Encargado / Colaborador.

## Review Focus

1. **El pasaje le cambia el acceso a alguien.** Una persona que hoy es encargado o técnico tiene que poder hacer exactamente lo mismo después de la etapa 1. La Tarea 2 lo prueba permiso por permiso contra `permisos_de_clave()`, y la Tarea 3 lo prueba con escrituras reales.
2. **Escalada con `manejar_roles`.** Alguien con `manejar_roles` y sin `cobrar` arma un rol con `cobrar` y se lo da a un amigo, edita el rol de alguien con más permisos para bajarlo, o se asigna el rol Dueño. Lo que se espera: todo frenado con 42501. Lo prueba la Tarea 8.
3. **Borrar el negocio con el equipo adentro.** El creador borra un negocio con fichas, roles y casos: no tiene que fallar por los triggers que protegen al creador (036/038) ni por el `rol_id` de las fichas, y las cuentas del equipo no tienen que quedar paradas en un negocio que ya no existe. Lo prueba la Tarea 13.
4. **El visitante escribe por un camino lateral.** Una función `security definer` que no pregunta por un permiso (por ejemplo `marcar_paso_hecho`) o una política "de todo el negocio" (`cobro`, `ecuacion`, `invitacion`) deja leer o escribir a quien no tiene ficha. Lo que se espera: el visitante no escribe nada y no ve lo que no ve en su sede. Lo prueba la Tarea 11.
5. **Un rol en uso se borra, o una persona queda sin rol.** Borrar un rol asignado, o asignar un rol de otro negocio, tiene que dar un mensaje claro y no dejar fichas apuntando a nada. Lo prueba la Tarea 8.

## Mapa de archivos

**Base (`front:supabase/`)**
- Create `053_roles.sql` — catálogo, tabla `rol`, roles base, pasaje, `puede_en` / `puede_aca` / `mis_permisos`.
- Create `054_politicas_por_permiso.sql` — políticas y funciones reescritas con permisos; triggers de columnas en `caso` y `paso`.
- Create `055_mis_negocios_con_rol.sql` — `mis_negocios()` y `mis_sedes()` devuelven el rol nuevo.
- Create `056_roles_editables.sql` — `guardar_rol`, `borrar_rol`, `asignar_rol`, `roles_del_negocio`, `aprobar_solicitud` con `rol_id`.
- Create `057_visitas_entre_sedes.sql` — `visitando_desde`, permisos de visita, `entrar_de_visita`, `sedes_que_veo`.
- Create `058_borrar_negocio.sql` — `borrar_negocio`.
- Create `059_roles_limpieza.sql` — se borra lo viejo.
- Create `pruebas/roles.sql` — la prueba de todo lo anterior, por secciones.

**API (`api:`)**
- Create `src/compartido/permisos.ts` — catálogo y `puede()`.
- Modify `src/compartido/quien-soy.ts` — `Quien` con `esDuenio`, `permisos`, `rolNombre`, `visitando`.
- Modify los `casos-de-uso.ts` de casos, clientes, cobros, ecuaciones, equipo, inventario, negocio, pedidos, presupuesto, turnos y `seguimiento/configuracion.ts`; `modules/payments/case-payments.ts`.
- Create `src/modulos/roles/{casos-de-uso,errores,esquemas,repositorio,rutas}.ts`.
- Modify `src/modulos/equipo/*`, `src/modulos/sedes/*`, `src/modulos/negocio/*`, `src/modulos/auth/repositorio.ts`, `src/modulos/semilla/casos-de-uso.ts`.
- Modify `pruebas/apoyo/afirmar.ts`, `pruebas/apoyo/supabase-falso.ts`; create `pruebas/apoyo/roles-viejos.ts`.
- Tests: `pruebas/casos-de-uso/permisos.test.ts`, `pruebas/casos-de-uso/roles.test.ts`, `pruebas/contrato/roles.test.ts`, `pruebas/contrato/visitas.test.ts`.

**Front (`front:src/`)**
- Modify `lib/permisos.js` — catálogo en lugar del mapa fijo.
- Modify `lib/auth.js` (`sinBase`), `lib/sedes.js`, `lib/datos.js` (roles, asignar, visitas, borrar negocio), `lib/presets.js` (etapa 5).
- Create `app/negocio/roles/page.js`, `app/negocio/roles/[id]/page.js`, `componentes/FranjaDeVisita.js`, `componentes/BorrarNegocio.js`.
- Modify las pantallas que llaman a `puede(usuario?.rol, …)` (lista en la Tarea 7), `app/equipo/page.js`, `componentes/SumarAlEquipo.js`, `componentes/SedesVinculadas.js`, `componentes/ConexionMercadoPago.js`, `app/perfil/*`, `app/layout.js`.
- Tests: `pruebas/permisos.test.js`, `pruebas/presets.test.js`, `pruebas/e2e/roles.e2e.js`.

---

# Etapa 1 — La base sobre roles, sin cambiar ningún acceso

### Task 1: Tabla `rol`, roles base y pasaje

**Files:**
- Create: `front:supabase/053_roles.sql`
- Create: `front:supabase/pruebas/roles.sql`

**Interfaces:**
- Produces:
  - `permisos_conocidos() returns text[]` (immutable)
  - `permisos_de_mirar() returns text[]` (immutable)
  - `permisos_de_clave(p_clave text) returns text[]` (immutable): los permisos de `encargado` / `tecnico`; `'{}'` para lo demás.
  - `nombre_de_clave(p_rubro text, p_clave text) returns text` (immutable)
  - `roles_base(p_rubro text) returns table (clave text, nombre text, permisos text[])`
  - `rol_de_clave(p_negocio uuid, p_clave text) returns uuid`: busca el rol de esa clave vieja en el negocio, y si no está lo crea.
  - Tabla `rol (id, negocio_id, nombre, es_duenio, permisos, clave, creado_en)`; columna `empleado.rol_id uuid not null references rol (id)`.
  - Triggers: `negocio_crea_sus_roles` (after insert on negocio), `empleado_rol_id_de_la_clave` (before insert or update of rol on empleado), `rol_duenio_fijo` (before update or delete on rol).

- [ ] **Step 1: Escribir la prueba (sección 1 de `pruebas/roles.sql`)**

```sql
-- ============================================================
-- pruebas/roles.sql — prueba los roles (053 a 059) contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase. Cada etapa suma secciones; una
-- sección de una migración que todavía no se corrió falla con "function ...
-- does not exist".
--
-- No deja nada: crea cuentas y negocios de mentira, prueba, y al final lo
-- deshace todo con un error a propósito ('deshacer') que se atrapa.
--
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó.
--   cualquier otro error              → la prueba no pudo correr.
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();  -- crea el taller A
  edu  uuid := gen_random_uuid();  -- encargado de A
  ivo  uuid := gen_random_uuid();  -- técnico de A
  zoe  uuid := gen_random_uuid();  -- crea un negocio personalizable
  neg_a uuid;
  neg_p uuid;
  link text;
  pedido uuid;
  n integer;
  fila record;
  frenado boolean;
  permiso text;
begin
  begin
    insert into auth.users (id, email) values
      (ana, 'prueba-ana-' || ana || '@ejemplo.test'),
      (edu, 'prueba-edu-' || edu || '@ejemplo.test'),
      (ivo, 'prueba-ivo-' || ivo || '@ejemplo.test'),
      (zoe, 'prueba-zoe-' || zoe || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Roles A', 'taller', '[]'::jsonb);

    -- Edu entra como encargado e Ivo como técnico, por el link (051).
    select codigo into link from cambiar_link_de_equipo(30);
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link, 'Edu');
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link, 'Ivo');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select id into pedido from pedidos_de_ingreso() where nombre = 'Edu';
    perform aprobar_solicitud(pedido, 'encargado');
    select id into pedido from pedidos_de_ingreso() where nombre = 'Ivo';
    perform aprobar_solicitud(pedido, 'tecnico');

    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    neg_p := crear_mi_negocio('Roles P', 'personalizable', '[]'::jsonb);

    -- ---- 1. Un negocio nuevo nace con sus roles ----
    perform set_config('role', 'postgres', true);
    select count(*) into n from rol where negocio_id = neg_a;
    if n <> 3 then raise exception 'FALLÓ 1: el taller nació con % roles y no 3.', n; end if;
    select count(*) into n from rol where negocio_id = neg_a and es_duenio and nombre = 'Dueño';
    if n <> 1 then raise exception 'FALLÓ 1: el taller no tiene su rol Dueño.'; end if;
    select count(*) into n from rol where negocio_id = neg_a and nombre in ('Encargado', 'Mecánico') and not es_duenio;
    if n <> 2 then raise exception 'FALLÓ 1: el taller no trae Encargado y Mecánico.'; end if;
    select count(*) into n from rol where negocio_id = neg_p;
    if n <> 1 then raise exception 'FALLÓ 1: el personalizable nació con % roles y no sólo Dueño.', n; end if;

    -- ---- 2. Cada ficha apunta al rol de su clave vieja ----
    select count(*) into n
      from empleado e join rol r on r.id = e.rol_id
     where e.negocio_id = neg_a and r.clave is distinct from e.rol;
    if n <> 0 then raise exception 'FALLÓ 2: % fichas apuntan a un rol que no es el de su clave.', n; end if;
    select count(*) into n from empleado where rol_id is null;
    if n <> 0 then raise exception 'FALLÓ 2: hay % fichas sin rol_id en toda la base.', n; end if;
    select count(*) into n
      from empleado e join rol r on r.id = e.rol_id
     where r.negocio_id <> e.negocio_id;
    if n <> 0 then raise exception 'FALLÓ 2: hay % fichas con un rol de otro negocio.', n; end if;

    -- ---- 3. El rol Dueño no se toca ----
    frenado := false;
    begin
      update rol set nombre = 'Jefe' where negocio_id = neg_a and es_duenio;
    exception when raise_exception then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 3: el rol Dueño se pudo renombrar.'; end if;
    frenado := false;
    begin
      delete from rol where negocio_id = neg_a and es_duenio;
    exception when raise_exception then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 3: el rol Dueño se pudo borrar.'; end if;

    -- ---- 4. Un permiso que no existe no entra ----
    frenado := false;
    begin
      insert into rol (negocio_id, nombre, permisos) values (neg_a, 'Raro', array['borrar_todo']);
    exception when check_violation then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 4: se guardó un permiso que no está en el catálogo.'; end if;

    -- ---- 5. Desde el navegador no se escribe rol ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin
      insert into rol (negocio_id, nombre) values (neg_a, 'Directo');
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 5: la dueña insertó un rol sin pasar por las funciones.'; end if;
    select count(*) into n from rol;
    if n <> 3 then raise exception 'FALLÓ 5: la dueña ve % roles y no los 3 de su negocio.', n; end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then raise; end if;
  end;
end;
$prueba$;
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Correr `supabase/pruebas/roles.sql` entero en el SQL Editor.
Expected: error `relation "rol" does not exist`.

- [ ] **Step 3: Escribir `053_roles.sql` (catálogo, tabla, roles base, pasaje)**

```sql
-- ============================================================
-- 053_roles.sql — roles por negocio, con permisos (etapa 1 de docs/roles.md)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..052.
-- Es idempotente. Después, correr supabase/pruebas/roles.sql.
--
-- Hasta acá un rol era una de tres palabras ('duenio', 'encargado',
-- 'tecnico') y lo que podía hacer estaba escrito a mano en cada política.
-- Desde acá un rol es una fila de `rol`, de un negocio, con una lista de
-- permisos con nombre. Esta migración NO le cambia el acceso a nadie: cada
-- ficha queda apuntando a un rol con exactamente los permisos de su rol viejo.
--
-- empleado.rol (la palabra vieja) sigue mientras dure la transición: un
-- trigger le pone a cada ficha el rol_id que le corresponde. Se va en la 059.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El catálogo
-- ------------------------------------------------------------
-- Las mismas claves, en el mismo orden, que src/lib/permisos.js (front) y
-- src/compartido/permisos.ts (API). Una prueba en cada lado lo verifica.
create or replace function permisos_conocidos()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'ver_todos_los_casos', 'crear_casos', 'avanzar_casos', 'asignar_casos', 'entregar_y_reabrir',
    'armar_presupuesto', 'aprobar_por_el_cliente',
    'cobrar', 'conectar_mercadopago',
    'ver_clientes', 'editar_clientes',
    'ver_agenda', 'manejar_turnos',
    'ver_inventario', 'editar_inventario', 'ver_inventario_de_sedes',
    'ver_sedes_vinculadas', 'vincular_sedes',
    'sumar_al_equipo', 'sacar_del_equipo', 'manejar_roles',
    'configurar_negocio', 'ver_historial'
  ]::text[];
$$;

-- Los únicos que valen de visita en una sede vinculada (057).
create or replace function permisos_de_mirar()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['ver_todos_los_casos', 'ver_clientes', 'ver_agenda', 'ver_inventario', 'ver_historial']::text[];
$$;

-- Lo que podía hacer cada rol viejo (008, 047, 051, 043). Es la definición
-- del pasaje: si esto está mal, alguien gana o pierde acceso.
create or replace function permisos_de_clave(p_clave text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_clave
    when 'encargado' then array[
      'ver_todos_los_casos', 'crear_casos', 'avanzar_casos', 'asignar_casos', 'entregar_y_reabrir',
      'armar_presupuesto', 'aprobar_por_el_cliente',
      'cobrar', 'conectar_mercadopago',
      'ver_clientes', 'editar_clientes',
      'ver_agenda', 'manejar_turnos',
      'ver_inventario', 'editar_inventario', 'ver_inventario_de_sedes',
      'ver_historial'
    ]::text[]
    when 'tecnico' then array[
      'ver_clientes', 'ver_agenda', 'ver_inventario', 'ver_inventario_de_sedes', 'ver_historial'
    ]::text[]
    else '{}'::text[]
  end;
$$;

-- Los mismos nombres que presets.js (roles: { … }) para cada rubro.
create or replace function nombre_de_clave(p_rubro text, p_clave text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_clave
    when 'duenio' then 'Dueño'
    when 'encargado' then 'Encargado'
    when 'tecnico' then case p_rubro
      when 'taller' then 'Mecánico'
      when 'medicina' then 'Profesional'
      when 'service' then 'Técnico'
      else 'Colaborador'
    end
  end;
$$;

-- ------------------------------------------------------------
-- 2. La tabla
-- ------------------------------------------------------------
-- `clave` es la palabra vieja de la que salió el rol, para el pasaje y para
-- el trigger de la sección 4. Los roles que se creen a mano no la tienen. Se
-- va en la 059.
create table if not exists rol (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid        not null references negocio (id) on delete cascade,
  nombre      text        not null check (length(trim(nombre)) between 1 and 40),
  es_duenio   boolean     not null default false,
  permisos    text[]      not null default '{}',
  clave       text        check (clave in ('duenio', 'encargado', 'tecnico')),
  creado_en   timestamptz not null default now(),
  constraint rol_permisos_conocidos check (permisos <@ permisos_conocidos())
);

create unique index if not exists rol_nombre_unico on rol (negocio_id, lower(nombre));
create unique index if not exists rol_un_duenio on rol (negocio_id) where es_duenio;
create unique index if not exists rol_clave_unica on rol (negocio_id, clave) where clave is not null;

-- Se lee con la RLS; se escribe sólo por las funciones (056).
alter table rol enable row level security;
revoke all on rol from anon;
revoke insert, update, delete on rol from authenticated;
grant select on rol to authenticated;

drop policy if exists rol_lo_ve_el_negocio on rol;
create policy rol_lo_ve_el_negocio on rol
  for select to authenticated
  using (negocio_id = mi_negocio());

-- El rol Dueño no se renombra, no se le cambian los permisos y no se borra.
-- Si se borra el negocio entero, el rol se borra después que él: el select da
-- vacío y deja pasar (como el fundador en la 038).
create or replace function rol_duenio_fijo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.es_duenio and exists (select 1 from negocio where id = old.negocio_id) then
    raise exception 'El rol Dueño no se modifica.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rol_duenio_fijo on rol;
create trigger rol_duenio_fijo
  before update or delete on rol
  for each row
  execute function rol_duenio_fijo();

-- ------------------------------------------------------------
-- 3. Los roles con los que nace un negocio
-- ------------------------------------------------------------
create or replace function roles_base(p_rubro text)
returns table (clave text, nombre text, permisos text[])
language sql
immutable
set search_path = public
as $$
  select k, nombre_de_clave(p_rubro, k), permisos_de_clave(k)
    from unnest(array['encargado', 'tecnico']) as k
   where p_rubro in ('taller', 'medicina', 'service');
$$;

-- El rol de una clave vieja en un negocio; si no está, lo crea. Lo usan el
-- pasaje y el trigger de la sección 4.
create or replace function rol_de_clave(p_negocio uuid, p_clave text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  encontrado uuid;
  su_rubro text;
begin
  select id into encontrado from rol where negocio_id = p_negocio and clave = p_clave;
  if found then
    return encontrado;
  end if;

  select rubro into su_rubro from negocio where id = p_negocio;
  insert into rol (negocio_id, nombre, es_duenio, permisos, clave)
  values (p_negocio, nombre_de_clave(su_rubro, p_clave), p_clave = 'duenio', permisos_de_clave(p_clave), p_clave)
  returning id into encontrado;
  return encontrado;
end;
$$;

revoke all on function rol_de_clave(uuid, text) from public;
revoke all on function rol_de_clave(uuid, text) from anon;
revoke all on function rol_de_clave(uuid, text) from authenticated;

-- ------------------------------------------------------------
-- 4. La ficha apunta a un rol
-- ------------------------------------------------------------
-- `no action` y no `restrict`: al borrar el negocio, fichas y roles se borran
-- en el mismo comando y el control va al final (058).
alter table empleado add column if not exists rol_id uuid references rol (id);

-- Mientras haya código que escribe la palabra vieja (crear_mi_negocio,
-- aprobar_solicitud, la siembra), la palabra elige el rol.
create or replace function rol_id_de_la_clave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.rol_id is null and new.rol is not null then
      new.rol_id := rol_de_clave(new.negocio_id, new.rol);
    end if;
  elsif new.rol is distinct from old.rol and new.rol_id is not distinct from old.rol_id and new.rol is not null then
    new.rol_id := rol_de_clave(new.negocio_id, new.rol);
  end if;
  return new;
end;
$$;

drop trigger if exists empleado_rol_id_de_la_clave on empleado;
create trigger empleado_rol_id_de_la_clave
  before insert or update of rol on empleado
  for each row
  execute function rol_id_de_la_clave();

-- ------------------------------------------------------------
-- 5. El pasaje
-- ------------------------------------------------------------
-- Cada negocio: su Dueño y sus roles base. Después, cada ficha a su rol (si
-- un personalizable usa 'encargado' o 'tecnico', rol_de_clave() lo crea con
-- los permisos de hoy).
insert into rol (negocio_id, nombre, es_duenio, permisos, clave)
select n.id, 'Dueño', true, '{}', 'duenio'
  from negocio n
 where not exists (select 1 from rol r where r.negocio_id = n.id and r.es_duenio);

insert into rol (negocio_id, nombre, permisos, clave)
select n.id, b.nombre, b.permisos, b.clave
  from negocio n
 cross join lateral roles_base(n.rubro) b
 where not exists (select 1 from rol r where r.negocio_id = n.id and r.clave = b.clave);

update empleado e
   set rol_id = rol_de_clave(e.negocio_id, e.rol)
 where e.rol_id is null;

alter table empleado alter column rol_id set not null;

-- ------------------------------------------------------------
-- 6. Un negocio nuevo nace con sus roles
-- ------------------------------------------------------------
-- Va después del pasaje, para que el pasaje no lo dispare.
create or replace function crear_roles_del_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into rol (negocio_id, nombre, es_duenio, permisos, clave)
  values (new.id, 'Dueño', true, '{}', 'duenio');

  insert into rol (negocio_id, nombre, permisos, clave)
  select new.id, b.nombre, b.permisos, b.clave from roles_base(new.rubro) b;

  return new;
end;
$$;

drop trigger if exists negocio_crea_sus_roles on negocio;
create trigger negocio_crea_sus_roles
  after insert on negocio
  for each row
  execute function crear_roles_del_negocio();

-- CÓMO VERIFICARLO (sólo lee):
--
--   select count(*) from empleado where rol_id is null;                -- 0
--   select count(*) from negocio n
--    where not exists (select 1 from rol r where r.negocio_id = n.id and r.es_duenio);  -- 0
```

- [ ] **Step 4: Correr la migración y la prueba**

Correr `053_roles.sql` en el SQL Editor, después `pruebas/roles.sql`.
Expected: "Success. No rows returned".

- [ ] **Step 5: Commit**

```bash
git add supabase/053_roles.sql supabase/pruebas/roles.sql
git commit -m "Roles por negocio: tabla rol, roles base y pasaje (053)"
```

### Task 2: `puede_en` lee los roles

**Files:**
- Modify: `front:supabase/053_roles.sql` (al final)
- Modify: `front:supabase/pruebas/roles.sql` (sección 6, antes de `raise exception 'deshacer'`)

**Interfaces:**
- Consumes: tabla `rol`, `empleado.rol_id`, `permisos_conocidos()`, `permisos_de_clave()` (Task 1).
- Produces:
  - `permisos_efectivos(p_negocio uuid) returns text[]`: los de quien llama en ese negocio; Dueño = catálogo entero; sin ficha = `'{}'`. **Es la única función que decide**: la 057 la cambia para las visitas.
  - `puede_en(p_negocio uuid, p_permiso text) returns boolean` (misma firma que 047/051).
  - `puede_aca(p_permiso text) returns boolean` = `puede_en(mi_negocio(), p_permiso)`.
  - `mis_permisos() returns jsonb`: `{ rol_id, rol_nombre, es_duenio, permisos }` en el negocio activo.

- [ ] **Step 1: Escribir la prueba (sección 6)**

```sql
    -- ---- 6. Cada persona puede exactamente lo de su rol viejo ----
    perform set_config('role', 'authenticated', true);
    foreach permiso in array permisos_conocidos() loop
      perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
      if not puede_en(neg_a, permiso) then
        raise exception 'FALLÓ 6: la dueña no puede %.', permiso;
      end if;
      perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
      if puede_en(neg_a, permiso) is distinct from (permiso = any(permisos_de_clave('encargado'))) then
        raise exception 'FALLÓ 6: el encargado cambió en %.', permiso;
      end if;
      perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
      if puede_en(neg_a, permiso) is distinct from (permiso = any(permisos_de_clave('tecnico'))) then
        raise exception 'FALLÓ 6: el técnico cambió en %.', permiso;
      end if;
      -- Zoe no tiene ficha en A.
      perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
      if puede_en(neg_a, permiso) then
        raise exception 'FALLÓ 6: sin ficha en A, Zoe puede % en A.', permiso;
      end if;
    end loop;

    -- Los tres permisos que ya existían (047, 051) dicen lo mismo que antes.
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    if puede_en(neg_a, 'vincular_sedes') or puede_en(neg_a, 'sumar_al_equipo') or not puede_en(neg_a, 'ver_inventario_de_sedes') then
      raise exception 'FALLÓ 6: los permisos de sedes y equipo del encargado cambiaron.';
    end if;
    if puede_en(neg_a, 'borrar_todo') then
      raise exception 'FALLÓ 6: un permiso que no existe dio que sí.';
    end if;

    -- mis_permisos() dice lo mismo, con el nombre del rol.
    select * into fila from jsonb_to_record(mis_permisos()) as x(rol_nombre text, es_duenio boolean, permisos text[]);
    if fila.rol_nombre <> 'Encargado' or fila.es_duenio or fila.permisos <> permisos_de_clave('encargado') then
      raise exception 'FALLÓ 6: mis_permisos() del encargado dice otra cosa.';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select * into fila from jsonb_to_record(mis_permisos()) as x(rol_nombre text, es_duenio boolean, permisos text[]);
    if not fila.es_duenio or fila.permisos <> permisos_conocidos() then
      raise exception 'FALLÓ 6: mis_permisos() de la dueña no trae el catálogo entero.';
    end if;
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Expected: `FALLÓ 6: el técnico cambió en ver_clientes.` (el `puede_en` viejo da `false` para todo lo que no conoce) o `function mis_permisos() does not exist`.

- [ ] **Step 3: Agregar al final de `053_roles.sql`**

```sql
-- ------------------------------------------------------------
-- 7. Los permisos de quien llama
-- ------------------------------------------------------------
-- La única función que decide. puede_en, puede_aca y mis_permisos leen de
-- acá; la 057 le suma las visitas entre sedes y nadie más cambia.
create or replace function permisos_efectivos(p_negocio uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case when r.es_duenio then permisos_conocidos() else r.permisos end
      from empleado e
      join rol r on r.id = e.rol_id
     where e.negocio_id = p_negocio
       and e.usuario_id = auth.uid()
     limit 1
  ), '{}'::text[]);
$$;

revoke all on function permisos_efectivos(uuid) from public;
revoke all on function permisos_efectivos(uuid) from anon;
grant execute on function permisos_efectivos(uuid) to authenticated;

-- Misma firma que la 047 y la 051: quien ya la llama no cambia.
create or replace function puede_en(p_negocio uuid, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_permiso = any(permisos_efectivos(p_negocio));
$$;

create or replace function puede_aca(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select puede_en(mi_negocio(), p_permiso);
$$;

revoke all on function puede_aca(text) from public;
revoke all on function puede_aca(text) from anon;
grant execute on function puede_aca(text) to authenticated;

-- Para la API y el front: con qué rol está quien llama y qué puede, en el
-- negocio activo. Sin ficha, rol null y los permisos que le toquen (vacío,
-- hasta la 057).
create or replace function mis_permisos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rol_id', r.id,
    'rol_nombre', r.nombre,
    'es_duenio', coalesce(r.es_duenio, false),
    'permisos', to_jsonb(permisos_efectivos(mi_negocio()))
  )
    from (select 1) uno
    left join empleado e on e.negocio_id = mi_negocio() and e.usuario_id = auth.uid()
    left join rol r on r.id = e.rol_id;
$$;

revoke all on function mis_permisos() from public;
revoke all on function mis_permisos() from anon;
grant execute on function mis_permisos() to authenticated;
```

- [ ] **Step 4: Correr la migración y la prueba**

Correr `053_roles.sql` de nuevo (es idempotente) y `pruebas/roles.sql`.
Expected: "Success. No rows returned".

- [ ] **Step 5: Commit**

```bash
git add supabase/053_roles.sql supabase/pruebas/roles.sql
git commit -m "puede_en lee los roles; mis_permisos() (053)"
```

### Task 3: Las políticas preguntan por permisos

**Files:**
- Create: `front:supabase/054_politicas_por_permiso.sql`
- Modify: `front:supabase/pruebas/roles.sql` (sección 7)

**Interfaces:**
- Consumes: `puede_aca(text)`, `mi_empleado()` (038).
- Produces: las políticas de la tabla de abajo; triggers `caso_cambio_permitido` y `paso_cambio_permitido`.

Qué cambia, tabla por tabla. "Miembro" es `mi_empleado() is not null`: hoy da lo mismo que "está en el negocio", porque sin ficha no se entra (038), pero desde la 057 deja afuera a quien está de visita.

| Tabla | Política vieja | Pasa a ser |
|---|---|---|
| negocio | `negocio_edita_el_suyo`: `mi_rol() = 'duenio'` | `configurar_negocio` |
| empleado | `empleado_lo_maneja_el_duenio` (for all): dueño | insert `sumar_al_equipo`; update `manejar_roles`; delete `sacar_del_equipo` |
| invitacion | `invitacion_crea_el_duenio`, `invitacion_anula_el_duenio`: dueño | `sumar_al_equipo` |
| invitacion | `invitacion_ve_las_suyas`: el negocio | el negocio y miembro |
| caso | `caso_de_mi_negocio` (for all) | select y update: `ver_todos_los_casos` o el suyo; insert `crear_casos`; delete `crear_casos` y lo ve. Trigger por columnas (abajo) |
| paso | `paso_lo_mueve_quien_puede`: `puedo_cargar()` | `armar_presupuesto` o `aprobar_por_el_cliente`. Trigger por columnas (abajo) |
| cliente | ve: el negocio; carga: `puedo_cargar()` | ve `ver_clientes`; carga `editar_clientes` |
| insumo | ve: el negocio; carga: `puedo_cargar()` | ve `ver_inventario`; carga `editar_inventario` |
| turno | ve: el negocio; carga: `puedo_cargar()` | ve `ver_agenda`; carga `manejar_turnos` |
| ecuacion | ve: el negocio; carga/edita/borra: `puedo_cargar()` | ve: miembro; el resto `armar_presupuesto` |
| ecuacion_dependencia | carga/borra: `puedo_cargar()` | `armar_presupuesto` |
| seguimiento_whatsapp | `seguimiento_turno_programar` / `_cambiar`: `puedo_cargar()` | `manejar_turnos` |
| cobro | `cobro_de_mi_negocio`: el negocio | el negocio y miembro |

**La única excepción a "nada cambia":** hoy la RLS de `caso` deja al técnico cambiar cualquier columna de sus casos, pero la API se lo frena (`exigirQuePuedaCargar` en casos, `api:src/modulos/casos/casos-de-uso.ts:42`). El trigger hace que la base frene lo mismo. Ninguna pantalla lo usa.

- [ ] **Step 1: Escribir la prueba (sección 7)**

```sql
    -- ---- 7. Las políticas: lo mismo que antes, ahora por permiso ----
    perform set_config('role', 'authenticated', true);

    -- Un caso de Edu y otro de Ivo, cargados por la dueña.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    insert into caso (negocio_id, numero, servicio, responsable_id)
    select neg_a, 901, 'Frenos', e.id from empleado e where e.negocio_id = neg_a and e.nombre = 'Ivo';
    insert into caso (negocio_id, numero, servicio) values (neg_a, 902, 'Aceite');

    -- El técnico ve sólo el suyo, y no lo mueve de estado.
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select count(*) into n from caso;
    if n <> 1 then raise exception 'FALLÓ 7: el técnico ve % casos y no 1.', n; end if;
    frenado := false;
    begin
      update caso set estado = 'en_proceso' where numero = 901;
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cambió el estado de su caso.'; end if;

    -- El técnico no carga clientes, turnos, inventario ni pasos; sí los ve.
    frenado := false;
    begin insert into cliente (negocio_id, nombre) values (neg_a, 'X');
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cargó un cliente.'; end if;
    frenado := false;
    begin insert into turno (negocio_id, motivo, empieza_en) values (neg_a, 'X', now() + interval '1 day');
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cargó un turno.'; end if;
    frenado := false;
    begin insert into insumo (negocio_id, nombre) values (neg_a, 'X');
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cargó inventario.'; end if;
    frenado := false;
    begin insert into paso (caso_id, nombre) select id, 'X' from caso where numero = 901;
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 7: el técnico armó presupuesto.'; end if;

    -- El encargado: carga todo eso, ve todos los casos, asigna y mueve estado.
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    select count(*) into n from caso;
    if n <> 2 then raise exception 'FALLÓ 7: el encargado ve % casos y no 2.', n; end if;
    insert into cliente (negocio_id, nombre) values (neg_a, 'Pedro');
    insert into turno (negocio_id, motivo, empieza_en) values (neg_a, 'Service', now() + interval '1 day');
    insert into insumo (negocio_id, nombre) values (neg_a, 'Filtro');
    insert into paso (caso_id, nombre, monto) select id, 'Pastillas', 100 from caso where numero = 902;
    update paso set estado = 'rechazado' where nombre = 'Pastillas';
    update caso set estado = 'en_proceso' where numero = 902;
    update caso set responsable_id = (select id from empleado where negocio_id = neg_a and nombre = 'Edu') where numero = 902;

    -- El encargado no configura el negocio ni toca el equipo.
    update negocio set nombre = 'Cambiado' where id = neg_a;
    perform set_config('role', 'postgres', true);
    select count(*) into n from negocio where id = neg_a and nombre = 'Cambiado';
    perform set_config('role', 'authenticated', true);
    if n <> 0 then raise exception 'FALLÓ 7: el encargado cambió el nombre del negocio.'; end if;
    delete from empleado where negocio_id = neg_a and nombre = 'Ivo';
    perform set_config('role', 'postgres', true);
    select count(*) into n from empleado where negocio_id = neg_a and nombre = 'Ivo';
    perform set_config('role', 'authenticated', true);
    if n <> 1 then raise exception 'FALLÓ 7: el encargado sacó a alguien del equipo.'; end if;

    -- La dueña sí configura.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    update negocio set descripcion = 'Prueba' where id = neg_a;
    perform set_config('role', 'postgres', true);
    select count(*) into n from negocio where id = neg_a and descripcion = 'Prueba';
    perform set_config('role', 'authenticated', true);
    if n <> 1 then raise exception 'FALLÓ 7: la dueña no pudo configurar su negocio.'; end if;

    -- Ninguna política mira ya el rol viejo.
    perform set_config('role', 'postgres', true);
    select count(*) into n from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ 'mi_rol\(\)|puedo_cargar\(\)' or coalesce(with_check, '') ~ 'mi_rol\(\)|puedo_cargar\(\)');
    perform set_config('role', 'authenticated', true);
    if n <> 0 then raise exception 'FALLÓ 7: quedan % políticas con mi_rol() o puedo_cargar().', n; end if;
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Expected: `FALLÓ 7: el técnico cambió el estado de su caso.`

- [ ] **Step 3: Escribir la primera mitad de `054_politicas_por_permiso.sql` (políticas y triggers)**

```sql
-- ============================================================
-- 054_politicas_por_permiso.sql — las políticas preguntan por un permiso
--
-- Correr entero en el SQL Editor de Supabase, después de la 053.
-- Es idempotente. Después, correr supabase/pruebas/roles.sql.
--
-- Cada política y cada función que miraba mi_rol() o puedo_cargar() pasa a
-- preguntar por un permiso con nombre (docs/roles.md, "Chequeo de permisos").
-- Con los roles del pasaje (053) nadie gana ni pierde nada. La única
-- diferencia: la base frena al técnico que cambia columnas de su caso, que
-- hasta acá frenaba sólo la API.
--
-- "Miembro" (mi_empleado() is not null) es lo mismo que "está en el negocio"
-- mientras sin ficha no se pueda entrar. Desde la 057 deja afuera a quien
-- entra de visita a una sede vinculada.
--
-- CUIDADO AL EDITAR: si una política deja afuera al Dueño, el negocio queda
-- sin nadie que pueda arreglarlo desde la aplicación.
-- ============================================================

-- ------------------------------------------------------------
-- negocio
-- ------------------------------------------------------------
drop policy if exists negocio_edita_el_suyo on negocio;
create policy negocio_edita_el_suyo on negocio
  for update to authenticated
  using (id = mi_negocio() and (select puede_aca('configurar_negocio')))
  with check (id = mi_negocio() and (select puede_aca('configurar_negocio')));

-- ------------------------------------------------------------
-- empleado — ver sigue siendo de todo el negocio
-- ------------------------------------------------------------
drop policy if exists empleado_lo_maneja_el_duenio on empleado;

drop policy if exists empleado_lo_suma_quien_puede on empleado;
create policy empleado_lo_suma_quien_puede on empleado
  for insert to authenticated
  with check (negocio_id = mi_negocio() and (select puede_aca('sumar_al_equipo')));

drop policy if exists empleado_lo_cambia_quien_puede on empleado;
create policy empleado_lo_cambia_quien_puede on empleado
  for update to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('manejar_roles')))
  with check (negocio_id = mi_negocio() and (select puede_aca('manejar_roles')));

drop policy if exists empleado_lo_saca_quien_puede on empleado;
create policy empleado_lo_saca_quien_puede on empleado
  for delete to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('sacar_del_equipo')));

-- ------------------------------------------------------------
-- invitacion
-- ------------------------------------------------------------
drop policy if exists invitacion_ve_las_suyas on invitacion;
create policy invitacion_ve_las_suyas on invitacion
  for select to authenticated
  using (negocio_id = mi_negocio() and mi_empleado() is not null);

drop policy if exists invitacion_crea_el_duenio on invitacion;
create policy invitacion_crea_el_duenio on invitacion
  for insert to authenticated
  with check (negocio_id = mi_negocio() and (select puede_aca('sumar_al_equipo')));

drop policy if exists invitacion_anula_el_duenio on invitacion;
create policy invitacion_anula_el_duenio on invitacion
  for update to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('sumar_al_equipo')))
  with check (negocio_id = mi_negocio() and (select puede_aca('sumar_al_equipo')));

-- ------------------------------------------------------------
-- caso — sin ver_todos_los_casos, sólo los asignados
-- ------------------------------------------------------------
drop policy if exists caso_de_mi_negocio on caso;

drop policy if exists caso_lo_ve_quien_puede on caso;
create policy caso_lo_ve_quien_puede on caso
  for select to authenticated
  using (
    negocio_id = mi_negocio()
    and ((select puede_aca('ver_todos_los_casos')) or responsable_id = mi_empleado())
  );

drop policy if exists caso_lo_abre_quien_puede on caso;
create policy caso_lo_abre_quien_puede on caso
  for insert to authenticated
  with check (negocio_id = mi_negocio() and (select puede_aca('crear_casos')));

-- Qué columnas puede cambiar cada uno lo decide el trigger de abajo. El
-- with check deja pasar el caso que se le asigna a otro: quien asigna deja
-- de verlo si no tiene ver_todos_los_casos, y eso está bien.
drop policy if exists caso_lo_cambia_quien_puede on caso;
create policy caso_lo_cambia_quien_puede on caso
  for update to authenticated
  using (
    negocio_id = mi_negocio()
    and ((select puede_aca('ver_todos_los_casos')) or responsable_id = mi_empleado())
  )
  with check (negocio_id = mi_negocio());

drop policy if exists caso_lo_borra_quien_puede on caso;
create policy caso_lo_borra_quien_puede on caso
  for delete to authenticated
  using (
    negocio_id = mi_negocio()
    and (select puede_aca('crear_casos'))
    and ((select puede_aca('ver_todos_los_casos')) or responsable_id = mi_empleado())
  );

-- Las columnas de un caso, por permiso. No es security definer a propósito
-- (como red_fija, 047): adentro de una función security definer current_user
-- es el dueño de las tablas y pasa; con sesión es "authenticated" y se mira.
create or replace function caso_cambio_permitido()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.responsable_id is distinct from old.responsable_id and not puede_aca('asignar_casos') then
    raise exception 'Este rol no permite asignar casos.' using errcode = '42501';
  end if;

  if (new.estado = 'completado') is distinct from (old.estado = 'completado') then
    if not puede_aca('entregar_y_reabrir') then
      raise exception 'Este rol no permite entregar ni reabrir casos.' using errcode = '42501';
    end if;
  elsif new.estado is distinct from old.estado and not puede_aca('avanzar_casos') then
    raise exception 'Este rol no permite cambiar el estado de los casos.' using errcode = '42501';
  end if;

  -- Cualquier otra columna (nombre, servicio, diagnóstico, …) es trabajar el
  -- caso. actualizado_en lo mueve un trigger que corre antes (001).
  if (to_jsonb(new) - 'responsable_id' - 'estado' - 'que_falta' - 'actualizado_en')
       is distinct from (to_jsonb(old) - 'responsable_id' - 'estado' - 'que_falta' - 'actualizado_en')
     and not puede_aca('avanzar_casos') then
    raise exception 'Este rol no permite modificar casos.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists caso_cambio_permitido on caso;
create trigger caso_cambio_permitido
  before update on caso
  for each row
  execute function caso_cambio_permitido();

-- ------------------------------------------------------------
-- paso — armar el presupuesto y responder por el cliente son dos permisos
-- ------------------------------------------------------------
drop policy if exists paso_lo_mueve_quien_puede on paso;
create policy paso_lo_mueve_quien_puede on paso
  for all to authenticated
  using (
    ((select puede_aca('armar_presupuesto')) or (select puede_aca('aprobar_por_el_cliente')))
    and exists (select 1 from caso c where c.id = paso.caso_id and c.negocio_id = mi_negocio())
  )
  with check (
    ((select puede_aca('armar_presupuesto')) or (select puede_aca('aprobar_por_el_cliente')))
    and exists (select 1 from caso c where c.id = paso.caso_id and c.negocio_id = mi_negocio())
  );

-- Responder es cambiar estado (y aprobado_en, que pone la API al aprobar).
-- Todo lo demás —crear, borrar, cambiar nombre o monto— es armar.
create or replace function paso_cambio_permitido()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if not puede_aca('aprobar_por_el_cliente') then
      raise exception 'Este rol no permite aprobar ni rechazar pasos.' using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'estado' - 'aprobado_en') = (to_jsonb(old) - 'estado' - 'aprobado_en') then
      return new;
    end if;
  end if;

  if not puede_aca('armar_presupuesto') then
    raise exception 'Este rol no permite armar el presupuesto.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists paso_cambio_permitido on paso;
create trigger paso_cambio_permitido
  before insert or update or delete on paso
  for each row
  execute function paso_cambio_permitido();

-- ------------------------------------------------------------
-- cliente, insumo, turno
-- ------------------------------------------------------------
drop policy if exists cliente_lo_ve_el_negocio on cliente;
create policy cliente_lo_ve_el_negocio on cliente
  for select to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('ver_clientes')));

drop policy if exists cliente_lo_carga_quien_puede on cliente;
create policy cliente_lo_carga_quien_puede on cliente
  for all to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('editar_clientes')))
  with check (negocio_id = mi_negocio() and (select puede_aca('editar_clientes')));

drop policy if exists insumo_lo_ve_el_negocio on insumo;
create policy insumo_lo_ve_el_negocio on insumo
  for select to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('ver_inventario')));

drop policy if exists insumo_lo_carga_quien_puede on insumo;
create policy insumo_lo_carga_quien_puede on insumo
  for all to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('editar_inventario')))
  with check (negocio_id = mi_negocio() and (select puede_aca('editar_inventario')));

drop policy if exists turno_lo_ve_el_negocio on turno;
create policy turno_lo_ve_el_negocio on turno
  for select to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('ver_agenda')));

drop policy if exists turno_lo_carga_quien_puede on turno;
create policy turno_lo_carga_quien_puede on turno
  for all to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('manejar_turnos')))
  with check (negocio_id = mi_negocio() and (select puede_aca('manejar_turnos')));

-- ------------------------------------------------------------
-- ecuacion y ecuacion_dependencia — son parte del presupuesto
-- ------------------------------------------------------------
drop policy if exists ecuacion_lo_ve_el_negocio on ecuacion;
create policy ecuacion_lo_ve_el_negocio on ecuacion
  for select to authenticated
  using (negocio_id = mi_negocio() and mi_empleado() is not null);

drop policy if exists ecuacion_la_carga_quien_puede on ecuacion;
create policy ecuacion_la_carga_quien_puede on ecuacion
  for insert to authenticated
  with check (negocio_id = mi_negocio() and (select puede_aca('armar_presupuesto')));

drop policy if exists ecuacion_la_edita_quien_puede on ecuacion;
create policy ecuacion_la_edita_quien_puede on ecuacion
  for update to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('armar_presupuesto')))
  with check (negocio_id = mi_negocio() and (select puede_aca('armar_presupuesto')));

drop policy if exists ecuacion_la_borra_quien_puede on ecuacion;
create policy ecuacion_la_borra_quien_puede on ecuacion
  for delete to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('armar_presupuesto')));

drop policy if exists ecuacion_dependencia_la_carga_quien_puede on ecuacion_dependencia;
create policy ecuacion_dependencia_la_carga_quien_puede on ecuacion_dependencia
  for insert to authenticated
  with check (
    (select puede_aca('armar_presupuesto'))
    and exists (select 1 from ecuacion e where e.id = ecuacion_id and e.negocio_id = mi_negocio())
    and exists (select 1 from ecuacion d where d.id = dependencia_id and d.negocio_id = mi_negocio())
  );

drop policy if exists ecuacion_dependencia_la_borra_quien_puede on ecuacion_dependencia;
create policy ecuacion_dependencia_la_borra_quien_puede on ecuacion_dependencia
  for delete to authenticated
  using (
    (select puede_aca('armar_presupuesto'))
    and exists (select 1 from ecuacion e where e.id = ecuacion_id and e.negocio_id = mi_negocio())
  );

-- ------------------------------------------------------------
-- seguimiento_whatsapp — el recordatorio de turno (050)
-- ------------------------------------------------------------
drop policy if exists seguimiento_turno_programar on seguimiento_whatsapp;
create policy seguimiento_turno_programar on seguimiento_whatsapp
  for insert to authenticated
  with check (
    tipo = 'turno' and negocio_id = mi_negocio() and (select puede_aca('manejar_turnos'))
    and estado = 'pendiente' and mensaje_id is null and error is null and procesado_en is null
    and exists (select 1 from turno t
                 where t.id = seguimiento_whatsapp.turno_id
                   and t.negocio_id = seguimiento_whatsapp.negocio_id
                   and t.estado in ('agendado', 'confirmado'))
  );

drop policy if exists seguimiento_turno_cambiar on seguimiento_whatsapp;
create policy seguimiento_turno_cambiar on seguimiento_whatsapp
  for update to authenticated
  using (tipo = 'turno' and negocio_id = mi_negocio() and (select puede_aca('manejar_turnos')) and estado = 'pendiente')
  with check (
    tipo = 'turno' and negocio_id = mi_negocio() and (select puede_aca('manejar_turnos'))
    and estado in ('pendiente', 'cancelado') and mensaje_id is null
    and exists (select 1 from turno t
                 where t.id = seguimiento_whatsapp.turno_id
                   and t.negocio_id = seguimiento_whatsapp.negocio_id)
  );

-- ------------------------------------------------------------
-- cobro — se sigue viendo en todo el negocio, pero sólo los miembros
-- ------------------------------------------------------------
drop policy if exists cobro_de_mi_negocio on cobro;
create policy cobro_de_mi_negocio on cobro
  for select
  using (negocio_id = mi_negocio() and mi_empleado() is not null);
```

- [ ] **Step 4: Correr la migración y la prueba**

Correr `054_politicas_por_permiso.sql` y `pruebas/roles.sql`.
Expected: "Success. No rows returned".

- [ ] **Step 5: Correr las pruebas SQL viejas**

Correr `pruebas/multinegocio.sql`, `pruebas/red_de_sedes.sql`, `pruebas/equipo_por_link.sql` y `pruebas/pedido_idempotente.sql`.
Expected: todas "Success. No rows returned". Si una falla, la política nueva cambió un acceso: corregir la política, no la prueba.

- [ ] **Step 6: Commit**

```bash
git add supabase/054_politicas_por_permiso.sql supabase/pruebas/roles.sql
git commit -m "Las políticas preguntan por permisos (054)"
```

### Task 4: Las funciones preguntan por permisos

**Files:**
- Modify: `front:supabase/054_politicas_por_permiso.sql` (segunda mitad)
- Modify: `front:supabase/pruebas/roles.sql` (sección 8)

**Interfaces:**
- Consumes: `puede_aca(text)` (Task 2).
- Produces: las mismas funciones, con la misma firma y los mismos grants.

Cada función se copia **entera, tal cual** desde su última definición y se cambia **sólo** la línea indicada. `create or replace` con la misma firma conserva los grants. Los mensajes de error de esas funciones no se tocan (son textos existentes).

| Función | Copiar desde | Línea vieja | Línea nueva |
|---|---|---|---|
| `compartir_caso` | `018_seguimiento.sql:80-121` | `89: if not puedo_cargar() then` | `if not puede_aca('avanzar_casos') then` |
| `dejar_de_compartir_caso` | `018_seguimiento.sql:133-152` | `140: if not puedo_cargar() then` | `if not puede_aca('avanzar_casos') then` |
| `marcar_paso_hecho` | `021_paso_hecho.sql:56-109` | `79: if not puedo_cargar() and c.responsable_id is distinct from mi_empleado() then` | `if (mi_empleado() is null or c.responsable_id is distinct from mi_empleado()) and not (puede_aca('avanzar_casos') and puede_aca('ver_todos_los_casos')) then` |
| `compartir_agenda` | `024_pedir_turno.sql:48-78` | `61: if mi_rol() <> 'duenio' then` | `if not puede_aca('configurar_negocio') then` |
| `dejar_de_compartir_agenda` | `024_pedir_turno.sql:85-101` | `95: if mi_rol() <> 'duenio' then` | `if not puede_aca('configurar_negocio') then` |
| `registrar_cobro` | `025_cobros.sql:177-218` | `198: if not puedo_cargar() then` | `if not puede_aca('cobrar') then` |
| `anular_cobro` | `025_cobros.sql:233-269` | `247: if not puedo_cargar() then` | `if not puede_aca('cobrar') then` |
| `compartir_ics` | `027_agenda_ics.sql:55-87` | `68: if mi_rol() <> 'duenio' then` | `if not puede_aca('configurar_negocio') then` |
| `dejar_de_compartir_ics` | `027_agenda_ics.sql:98-114` | `108: if mi_rol() <> 'duenio' then` | `if not puede_aca('configurar_negocio') then` |
| `cambiar_descuento_api` | `040_entregar_caso_api.sql:43-59` | `49: if not puedo_cargar() then` | `if not puede_aca('armar_presupuesto') then` |
| `registrar_cobro_en_linea_api` | `041_cobro_en_linea_atomico.sql:57-137` | `90: if not puedo_cargar() then` | `if not puede_aca('cobrar') then` |
| `mercadopago_estado` | `043_mercadopago_rls.sql:5-10` | `8: if not puedo_cargar() then raise exception 'Sin permiso.'; end if;` | `if not (puede_aca('cobrar') or puede_aca('conectar_mercadopago')) then raise exception 'Sin permiso.'; end if;` |
| `mercadopago_crear_estado` | `043_mercadopago_rls.sql:12-18` | `15: …puedo_cargar()…` | `if not puede_aca('conectar_mercadopago') then raise exception 'Sin permiso.'; end if;` |
| `mercadopago_desvincular` | `043_mercadopago_rls.sql:20-25` | `23: …puedo_cargar()…` | `if not puede_aca('conectar_mercadopago') then raise exception 'Sin permiso.'; end if;` |
| `entregar_caso` | `048_volver_en.sql:36-110` | `63: if not puedo_cargar() then` | `if not puede_aca('entregar_y_reabrir') then` |

`marcar_paso_hecho`: el responsable del caso marca siempre lo suyo (como hoy); a los casos ajenos los marca sólo quien ve todos y puede avanzarlos. Es `security definer` y lee el caso sin RLS: por eso pide también `ver_todos_los_casos`. El `mi_empleado() is null` va a propósito: sin ficha (de visita, 057) `mi_empleado()` da null, y en un caso sin responsable `null is distinct from null` es falso, así que sin ese chequeo un visitante marcaría pasos.

Quedan con el rol viejo, a propósito, hasta su tarea: `crear_mi_negocio`, `entrar_al_negocio`, `quitar_acceso_al_sacar`, `rol_de_la_ficha_da_permisos`, `mis_negocios`, `mis_sedes` (Tareas 5 y 14), `aprobar_solicitud` y `rango_del_rol` (Tarea 8), `aceptar_invitacion` y `ver_invitacion` (Tarea 14). Ninguna de ellas decide un permiso con `mi_rol()` ni `puedo_cargar()`.

- [ ] **Step 1: Escribir la prueba (sección 8)**

```sql
    -- ---- 8. Las funciones: mismo resultado que antes ----
    perform set_config('role', 'authenticated', true);

    -- El técnico no comparte la agenda ni cobra; la dueña sí comparte.
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform compartir_agenda(); exception when others then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 8: el técnico compartió la agenda.'; end if;

    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform compartir_agenda(); exception when others then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 8: el encargado compartió la agenda.'; end if;

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform compartir_agenda();

    -- El técnico marca hechos los pasos de SU caso, no los de otro.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    insert into paso (caso_id, nombre, estado) select id, 'Suyo', 'aprobado' from caso where numero = 901;
    insert into paso (caso_id, nombre, estado) select id, 'Ajeno', 'aprobado' from caso where numero = 902;
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select * into fila from jsonb_to_record(marcar_paso_hecho((select id from paso where nombre = 'Suyo'), true)) as x(ok boolean);
    if not fila.ok then raise exception 'FALLÓ 8: el técnico no pudo marcar un paso de su caso.'; end if;
    perform set_config('role', 'postgres', true);
    select id into pedido from paso where nombre = 'Ajeno';
    perform set_config('role', 'authenticated', true);
    select * into fila from jsonb_to_record(marcar_paso_hecho(pedido, true)) as x(ok boolean);
    if fila.ok then raise exception 'FALLÓ 8: el técnico marcó un paso de un caso ajeno.'; end if;

    -- Ninguna función decide ya con mi_rol() ni puedo_cargar().
    perform set_config('role', 'postgres', true);
    select count(*) into n
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.proname not in ('mi_rol', 'puedo_cargar')
       and p.prosrc ~ 'mi_rol\(\)|puedo_cargar\(\)';
    perform set_config('role', 'authenticated', true);
    if n <> 0 then raise exception 'FALLÓ 8: quedan % funciones que deciden con el rol viejo.', n; end if;
```

> Si `marcar_paso_hecho` devuelve otro tipo que `jsonb` (mirar `021_paso_hecho.sql:56-58`), adaptar las dos llamadas: con `json`, `json_to_record`.

- [ ] **Step 2: Correr la prueba y ver que falla**

Expected: `FALLÓ 8: quedan N funciones que deciden con el rol viejo.` (N ≥ 15: son las de la tabla; si alguna menciona `puedo_cargar()` en un comentario adentro del cuerpo también cuenta, y se arregla sacando esa mención al recrearla).

- [ ] **Step 3: Agregar al final de `054_politicas_por_permiso.sql` las 15 funciones de la tabla**

Encabezar con:

```sql
-- ------------------------------------------------------------
-- Las funciones security definer que decidían con el rol
-- ------------------------------------------------------------
-- Cada una es la última definición tal cual (archivo y líneas al lado), con
-- una sola línea cambiada. Misma firma: los grants se conservan.
```

Y por cada fila de la tabla: copiar el bloque `create or replace function … $$;` desde el archivo y las líneas indicadas, cambiar sólo la línea, y dejar arriba un comentario `-- <archivo>:<líneas>, con <permiso>`.

- [ ] **Step 4: Correr la migración y todas las pruebas SQL**

Correr `054_politicas_por_permiso.sql`, `pruebas/roles.sql` y las cuatro pruebas viejas.
Expected: todas "Success. No rows returned".

- [ ] **Step 5: Commit**

```bash
git add supabase/054_politicas_por_permiso.sql supabase/pruebas/roles.sql
git commit -m "Las funciones preguntan por permisos (054)"
```

---

# Etapa 2 — La API y el front leen permisos

### Task 5: `mis_negocios` y `mis_sedes` devuelven el rol nuevo

**Files:**
- Create: `front:supabase/055_mis_negocios_con_rol.sql`
- Modify: `front:supabase/pruebas/roles.sql` (sección 9)

**Interfaces:**
- Produces: `mis_negocios()` y `mis_sedes()` con columnas `(id uuid, nombre text, rubro text, foto text, rol_nombre text, es_duenio boolean, permisos text[])`. La columna `rol` desaparece.

- [ ] **Step 1: Escribir la prueba (sección 9)**

```sql
    -- ---- 9. mis_negocios() trae el rol nuevo ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select * into fila from mis_negocios() where id = neg_a;
    if fila.rol_nombre <> 'Mecánico' or fila.es_duenio or fila.permisos <> permisos_de_clave('tecnico') then
      raise exception 'FALLÓ 9: mis_negocios() del técnico no trae su rol nuevo.';
    end if;
```

- [ ] **Step 2: Correr y ver que falla**

Expected: `record "fila" has no field "rol_nombre"`.

- [ ] **Step 3: Escribir `055_mis_negocios_con_rol.sql`**

```sql
-- ============================================================
-- 055_mis_negocios_con_rol.sql — los negocios de la cuenta, con su rol nuevo
--
-- Correr entero en el SQL Editor de Supabase, después de la 054.
-- Es idempotente. Va junto con la API que lee rol_nombre (docs/roles-plan.md,
-- Tarea 6): correrla antes deja al selector de negocios sin el nombre del rol.
--
-- Cambia el tipo de retorno: hay que borrarlas y volver a dar los permisos.
-- ============================================================

drop function if exists mis_negocios();
create function mis_negocios()
returns table (id uuid, nombre text, rubro text, foto text, rol_nombre text, es_duenio boolean, permisos text[])
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.nombre, n.rubro, n.foto, r.nombre, r.es_duenio,
         case when r.es_duenio then permisos_conocidos() else r.permisos end
    from empleado e
    join negocio n on n.id = e.negocio_id
    join rol r on r.id = e.rol_id
   where e.usuario_id = auth.uid()
   order by n.nombre;
$$;

revoke all on function mis_negocios() from public;
revoke all on function mis_negocios() from anon;
grant execute on function mis_negocios() to authenticated;

drop function if exists mis_sedes();
create function mis_sedes()
returns table (id uuid, nombre text, rubro text, foto text, rol_nombre text, es_duenio boolean, permisos text[])
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.nombre, n.rubro, n.foto, r.nombre, r.es_duenio,
         case when r.es_duenio then permisos_conocidos() else r.permisos end
    from negocio n
    join empleado e on e.negocio_id = n.id and e.usuario_id = auth.uid()
    join rol r on r.id = e.rol_id
   where n.red is not null
     and n.red = (select red from negocio where id = mi_negocio())
   order by n.nombre;
$$;

revoke all on function mis_sedes() from public;
revoke all on function mis_sedes() from anon;
grant execute on function mis_sedes() to authenticated;
```

- [ ] **Step 4: Correr la migración y la prueba**

Expected: "Success. No rows returned". `pruebas/red_de_sedes.sql` y `pruebas/multinegocio.sql` también: si alguna lee `.rol` de estas funciones, cambiarla a `.rol_nombre` en la prueba (es el contrato nuevo, no un acceso).

- [ ] **Step 5: Commit**

```bash
git add supabase/055_mis_negocios_con_rol.sql supabase/pruebas
git commit -m "mis_negocios y mis_sedes con el rol nuevo (055)"
```

### Task 6: La API decide con permisos

**Files:**
- Create: `api:src/compartido/permisos.ts`
- Create: `api:pruebas/apoyo/roles-viejos.ts`
- Create: `api:pruebas/casos-de-uso/permisos.test.ts`
- Modify: `api:src/compartido/quien-soy.ts`
- Modify: `api:pruebas/apoyo/afirmar.ts`, `api:pruebas/apoyo/supabase-falso.ts`
- Modify: los casos de uso de la tabla de abajo, `api:src/modules/payments/case-payments.ts`
- Modify: `api:src/modulos/auth/repositorio.ts` (`usuarioDe`)
- Modify: `api:src/lib/database.types.ts` (regenerar)

**Interfaces:**
- Consumes: `mis_permisos()` (Task 2), `mis_negocios()` (Task 5).
- Produces:
  - `PERMISOS: readonly Permiso[]`, `type Permiso`, `PERMISOS_DE_MIRAR`, `puede(quien: { esDuenio: boolean; permisos: readonly string[] }, permiso: Permiso): boolean` en `src/compartido/permisos.ts`.
  - `Quien = { usuarioId; negocioId; esDuenio: boolean; permisos: string[]; rolNombre: string | null; nombre?; email? }` (sin `rol`).
  - `GET /cuenta` → `usuario` trae además `rol_id`, `rol_nombre`, `es_duenio`, `permisos`.
  - En las pruebas: `quien(rolViejo, negocioId?)` sigue igual por fuera y arma `permisos` con `PERMISOS_DE_ROL_VIEJO`.

Qué permiso pide cada caso de uso (reemplaza `puedeCargar(quien)` o `quien.rol !== "duenio"`):

| Archivo | Funciones | Permiso |
|---|---|---|
| `casos/casos-de-uso.ts` | `abrir` | `crear_casos` |
| | `editar`, `cambiarEstado`, `anotarNota`, `compartir`, `dejarDeCompartir` | `avanzar_casos` |
| | `asignar` | `asignar_casos` |
| | `reabrir` | `entregar_y_reabrir` |
| `clientes/casos-de-uso.ts` | `agregar`, `editar` | `editar_clientes` |
| `cobros/casos-de-uso.ts` | `registrar`, `anular` | `cobrar` |
| | `cambiarDescuento` | `armar_presupuesto` |
| | `entregar` | `entregar_y_reabrir` |
| `ecuaciones/casos-de-uso.ts` | `agregar`, `editar`, `borrar` | `armar_presupuesto` |
| `equipo/casos-de-uso.ts` | `cambiarRol` | `manejar_roles` |
| | `sacar` | `sacar_del_equipo` |
| `inventario/casos-de-uso.ts` | `agregar`, `fijarCantidad`, `ajustarCantidad`, `editar`, `eliminar` | `editar_inventario` |
| `negocio/casos-de-uso.ts` | `editar`, `cambiarModulos`, `cambiarInicio`, `cambiarLanding`, `compartir` | `configurar_negocio` |
| `pedidos/casos-de-uso.ts` | `pedir`, `llego` | `editar_inventario` |
| `presupuesto/casos-de-uso.ts` | `agregar`, `sacar` | `armar_presupuesto` |
| | `responder` | `aprobar_por_el_cliente` |
| `seguimiento/configuracion.ts` | `editar` | `entregar_y_reabrir` |
| `turnos/casos-de-uso.ts` | `agregar`, `editar`, `atender`, `desatender` | `manejar_turnos` |
| | `guardarHorarios` | `configurar_negocio` |
| `modules/payments/case-payments.ts` | las dos lecturas de `user.rol` (líneas 28-29 y 37-38) | `cobrar` |

- [ ] **Step 1: Escribir la prueba del catálogo y de `puede`**

`api:pruebas/casos-de-uso/permisos.test.ts`:

```ts
// El catálogo de permisos de la API: el mismo que la base (053) y el front.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { PERMISOS, PERMISOS_DE_MIRAR, puede } from "../../src/compartido/permisos.js";
import { PERMISOS_DE_ROL_VIEJO } from "../apoyo/roles-viejos.js";

describe("permisos", () => {
    test("son las 23 claves del catálogo, sin repetir", () => {
        assert.equal(PERMISOS.length, 23);
        assert.equal(new Set(PERMISOS).size, 23);
    });

    test("los de mirar están en el catálogo", () => {
        for (const p of PERMISOS_DE_MIRAR) assert.ok(PERMISOS.includes(p), p);
    });

    test("los de los roles viejos están en el catálogo", () => {
        for (const lista of Object.values(PERMISOS_DE_ROL_VIEJO)) {
            for (const p of lista) assert.ok(PERMISOS.includes(p), p);
        }
    });

    test("el Dueño puede todo, aunque su lista venga vacía", () => {
        for (const p of PERMISOS) assert.equal(puede({ esDuenio: true, permisos: [] }, p), true, p);
    });

    test("los demás, sólo lo de su lista", () => {
        const q = { esDuenio: false, permisos: ["cobrar"] };
        assert.equal(puede(q, "cobrar"), true);
        assert.equal(puede(q, "crear_casos"), false);
    });

    // Si el repo del front está al lado (como en la máquina de desarrollo), las
    // claves tienen que coincidir con las de la 053. En CI, sin el front, se saltea.
    test("coinciden con la 053", (t) => {
        let sql: string;
        try {
            sql = readFileSync(new URL("../../../TP-Ing.-Software-2026c2/supabase/053_roles.sql", import.meta.url), "utf8");
        } catch {
            t.skip("no está el repo del front al lado");
            return;
        }
        const bloque = sql.slice(sql.indexOf("function permisos_conocidos()"), sql.indexOf("]::text[]"));
        const enLaBase = [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
        assert.deepEqual(enLaBase, [...PERMISOS]);
    });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npm run test:pruebas`
Expected: FAIL con `Cannot find module '../../src/compartido/permisos.js'`.

- [ ] **Step 3: Escribir `src/compartido/permisos.ts` y `pruebas/apoyo/roles-viejos.ts`**

`api:src/compartido/permisos.ts`:

```ts
// Los permisos con nombre (docs/roles.md del front). Las mismas claves, en el
// mismo orden, que permisos_conocidos() en supabase/053_roles.sql y que
// src/lib/permisos.js del front: la prueba permisos.test.ts lo verifica.
//
// La que manda es la base: esto sólo sirve para contestar 403 antes de ir.

export const PERMISOS = [
    "ver_todos_los_casos", "crear_casos", "avanzar_casos", "asignar_casos", "entregar_y_reabrir",
    "armar_presupuesto", "aprobar_por_el_cliente",
    "cobrar", "conectar_mercadopago",
    "ver_clientes", "editar_clientes",
    "ver_agenda", "manejar_turnos",
    "ver_inventario", "editar_inventario", "ver_inventario_de_sedes",
    "ver_sedes_vinculadas", "vincular_sedes",
    "sumar_al_equipo", "sacar_del_equipo", "manejar_roles",
    "configurar_negocio", "ver_historial",
] as const;

export type Permiso = (typeof PERMISOS)[number];

export const PERMISOS_DE_MIRAR: readonly Permiso[] = [
    "ver_todos_los_casos", "ver_clientes", "ver_agenda", "ver_inventario", "ver_historial",
];

export const esPermiso = (x: unknown): x is Permiso => (PERMISOS as readonly unknown[]).includes(x);

export const puede = (quien: { esDuenio: boolean; permisos: readonly string[] }, permiso: Permiso) =>
    quien.esDuenio || quien.permisos.includes(permiso);
```

`api:pruebas/apoyo/roles-viejos.ts`:

```ts
// Los permisos de los roles viejos, como permisos_de_clave() en la 053. Las
// pruebas siguen hablando de "duenio", "encargado" y "tecnico" porque son los
// roles con los que nace un taller; esto los traduce a permisos.

import type { Permiso } from "../../src/compartido/permisos.js";

export const PERMISOS_DE_ROL_VIEJO: Record<string, readonly Permiso[]> = {
    duenio: [],
    encargado: [
        "ver_todos_los_casos", "crear_casos", "avanzar_casos", "asignar_casos", "entregar_y_reabrir",
        "armar_presupuesto", "aprobar_por_el_cliente",
        "cobrar", "conectar_mercadopago",
        "ver_clientes", "editar_clientes",
        "ver_agenda", "manejar_turnos",
        "ver_inventario", "editar_inventario", "ver_inventario_de_sedes",
        "ver_historial",
    ],
    tecnico: ["ver_clientes", "ver_agenda", "ver_inventario", "ver_inventario_de_sedes", "ver_historial"],
};

export const NOMBRE_DE_ROL_VIEJO: Record<string, string> = {
    duenio: "Dueño", encargado: "Encargado", tecnico: "Mecánico",
};
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npm run test:pruebas -- --test-name-pattern=permisos`
Expected: PASS.

- [ ] **Step 5: `Quien` con permisos**

En `api:src/compartido/quien-soy.ts`, reemplazar el tipo, `quienSoy` y borrar `puedeCargar`:

```ts
export type Quien = {
    usuarioId: string;
    negocioId: string;
    esDuenio: boolean;
    permisos: string[];
    rolNombre: string | null;
    // Para firmar el historial (casos): el nombre de la cuenta y el mail.
    nombre?: string | null;
    email?: string | null;
};

type MisPermisos = { rol_nombre: string | null; es_duenio: boolean; permisos: string[] };

export async function quienSoy(req: Request): Promise<Quien> {
    const [{ data, error }, permisos] = await Promise.all([
        req.db.from("usuario").select("negocio_id, nombre").eq("id", req.usuario.id).maybeSingle(),
        req.db.rpc("mis_permisos"),
    ]);

    if (error) throw error;
    if (permisos.error) throw permisos.error;
    if (!data?.negocio_id) {
        throw new ErrorDeNegocio(403, "sin_negocio", "Todavía no estás en ningún negocio.");
    }
    const p = (permisos.data ?? null) as MisPermisos | null;

    return {
        usuarioId: req.usuario.id,
        negocioId: data.negocio_id,
        esDuenio: Boolean(p?.es_duenio),
        permisos: p?.permisos ?? [],
        rolNombre: p?.rol_nombre ?? null,
        nombre: data.nombre ?? null,
        email: req.usuario.email ?? null,
    };
}
```

Actualizar el comentario de arriba del archivo: "Quién llama: en qué negocio está ahora y qué permisos tiene ahí (mis_permisos(), 053)".

- [ ] **Step 6: Las pruebas arman `Quien` con permisos**

En `api:pruebas/apoyo/afirmar.ts`:

```ts
import { NOMBRE_DE_ROL_VIEJO, PERMISOS_DE_ROL_VIEJO } from "./roles-viejos.js";

export const quien = (rol: string, negocioId = "negocio-a"): Quien => ({
    usuarioId: `u-${rol}`,
    negocioId,
    esDuenio: rol === "duenio",
    permisos: [...(PERMISOS_DE_ROL_VIEJO[rol] ?? [])],
    rolNombre: NOMBRE_DE_ROL_VIEJO[rol] ?? null,
});

// Alguien con exactamente estos permisos, para probar roles hechos a mano.
export const quienCon = (permisos: string[], negocioId = "negocio-a"): Quien => ({
    usuarioId: "u-a-medida", negocioId, esDuenio: false, permisos, rolNombre: "A medida",
});
```

En `api:pruebas/apoyo/supabase-falso.ts`:
- Importar `PERMISOS_DE_ROL_VIEJO` y `NOMBRE_DE_ROL_VIEJO` y `PERMISOS` (de `src/compartido/permisos.js`).
- Agregar a `Persona` un campo opcional `permisos?: string[]` (si viene, manda sobre el rol viejo).
- Reemplazar las líneas 39-43 por:

```ts
// Lo que puede una persona, como permisos_efectivos() en la 053.
const permisosDe = (q: Persona): string[] =>
    q.rol === "duenio" ? [...PERMISOS] : q.permisos ?? [...(PERMISOS_DE_ROL_VIEJO[q.rol] ?? [])];
const tiene = (q: Persona, permiso: string) => permisosDe(q).includes(permiso);

// La RLS de caso (054): lo del negocio, y sin ver_todos_los_casos sólo lo suyo.
const veElCaso = (q: Persona, f: Fila) =>
    f.negocio_id === q.negocio_id && (tiene(q, "ver_todos_los_casos") || f.responsable_id === q.empleado_id);
```

- Reemplazar cada `puedeCargar(q)` / `puedeCargar(quien)` según la tabla de la Tarea 3 para su tabla (cliente → `tiene(q, "editar_clientes")`, insumo → `"editar_inventario"`, turno → `"manejar_turnos"`, paso → `"armar_presupuesto"` o `"aprobar_por_el_cliente"`, ecuacion → `"armar_presupuesto"`; en `marcar_paso_hecho`, `tiene(quien, "avanzar_casos") && tiene(quien, "ver_todos_los_casos")`).
- Líneas 112 y 117 (`escribir … && q.rol === "duenio"`): mirar de qué tabla son. Si es `empleado`, `tiene(q, "manejar_roles") || tiene(q, "sacar_del_equipo") || tiene(q, "sumar_al_equipo")`; si es `invitacion`, `tiene(q, "sumar_al_equipo")`.
- Línea 165 (negocio): `tiene(q, "configurar_negocio")`.
- Línea 514 (compartir agenda/ics): `!quien || !tiene(quien, "configurar_negocio")`.
- En `funcion()`, antes de `fotos_del_equipo`, agregar:

```ts
    // mis_permisos() (053): el rol de quien llama en su negocio activo.
    if (nombre === "mis_permisos") {
        if (!quien) return json(null);
        return json({
            rol_id: null,
            rol_nombre: NOMBRE_DE_ROL_VIEJO[quien.rol] ?? null,
            es_duenio: quien.rol === "duenio",
            permisos: permisosDe(quien),
        });
    }
```

- Si alguna fila falsa de `mis_negocios` (línea 744) arma `rol: p.rol`, cambiarla por `rol_nombre`, `es_duenio` y `permisos` con `permisosDe(p)`.

- [ ] **Step 7: Correr las pruebas y ver qué rompe**

Run: `npm run tipos && npm run test:pruebas`
Expected: errores de tipos en cada `puedeCargar` y `quien.rol` (los casos de uso de la tabla). Es la lista de lo que falta.

- [ ] **Step 8: Cambiar cada caso de uso según la tabla**

Patrón, con casos como ejemplo (`api:src/modulos/casos/casos-de-uso.ts`):

```ts
import { puede, type Permiso } from "../../compartido/permisos.js";
import type { Quien } from "../../compartido/quien-soy.js";

function exigir(quien: Quien, permiso: Permiso) {
    if (!puede(quien, permiso)) throw SinPermisoParaCargar();
}
```

y en cada función, `exigirQuePuedaCargar(quien)` → `exigir(quien, "<permiso de la tabla>")`. Los errores (`SinPermisoParaCargar`, `SoloElDuenio`, `SinPermiso`) quedan con su código (`sin_permiso`, 403); cambiar sólo su mensaje a `"Su rol no incluye el permiso para esta acción."` en cada `errores.ts` (casos, clientes, cobros, ecuaciones, equipo, inventario, negocio, turnos): con roles a medida, "lo hace el dueño" ya no es verdad.

En `case-payments.ts`, líneas 28-29 y 37-38: dejar de pedir `rol` en el `select` y, en lugar de `!["duenio", "encargado"].includes(user.rol)`, preguntar a la base con el mismo cliente que hizo el `select`:

```ts
const { data: puedeCobrar } = await db.rpc("puede_aca", { p_permiso: "cobrar" });
if (error || !user?.negocio_id || !puedeCobrar) return null;
```

(`db` es el cliente con el token de la persona que ya usa esa función; usar el mismo nombre de variable que tiene ahí.) En `anotarPedidoDePago` (línea 170-172), el `quien` que arma pasa a `{ usuarioId, negocioId, esDuenio: false, permisos: ["cobrar"], rolNombre: null, nombre }`: sólo se usa para firmar el historial.

- [ ] **Step 9: Pruebas de un rol a medida**

Agregar a `api:pruebas/casos-de-uso/permisos.test.ts`:

```ts
import * as Clientes from "../../src/modulos/clientes/casos-de-uso.js";
import { fallaCon, quienCon } from "../apoyo/afirmar.js";

describe("un rol a medida", () => {
    const repo = { async crear(f: Record<string, unknown>) { return f as never; }, async actualizar() { return null; } };

    test("con editar_clientes carga clientes aunque no sea encargado", async () => {
        await Clientes.agregar({ repo, quien: quienCon(["editar_clientes"]) }, { nombre: "Pedro" });
    });

    test("sin editar_clientes, no", async () => {
        await fallaCon(Clientes.agregar({ repo, quien: quienCon(["cobrar"]) }, { nombre: "Pedro" }), "sin_permiso", 403);
    });
});
```

- [ ] **Step 10: `GET /cuenta` trae los permisos**

En `api:src/modulos/auth/repositorio.ts`, `usuarioDe` (cerca de la línea 90): después de leer (o crear) la fila de `usuario`, sumarle `mis_permisos()` con el mismo cliente:

```ts
            const { data: permisos } = await db.rpc("mis_permisos");
            return { ...fila, ...(permisos ?? { rol_id: null, rol_nombre: null, es_duenio: false, permisos: [] }) };
```

(donde `fila` es lo que hoy se devuelve: `data` o `creado`). Agregar a `pruebas/contrato/auth.test.ts` una prueba: con una persona `encargado` del falso, `GET /cuenta` trae `datos.usuario.permisos` igual a `PERMISOS_DE_ROL_VIEJO.encargado` y `datos.usuario.es_duenio === false`.

- [ ] **Step 11: Regenerar los tipos y correr todo**

Run: `npx supabase gen types typescript --linked > src/lib/database.types.ts` (si no hay acceso a la base, agregar a mano en `database.types.ts`, sección `Functions`: `mis_permisos: { Args: never; Returns: Json }`, `puede_aca: { Args: { p_permiso: string }; Returns: boolean }`, y cambiar las columnas de retorno de `mis_negocios` y `mis_sedes` como en la Tarea 5).

Run: `npm run tipos && npm test`
Expected: todo PASS.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "La API decide con permisos con nombre"
```

### Task 7: El front lee permisos

**Files:**
- Modify: `front:src/lib/permisos.js`
- Modify: `front:pruebas/permisos.test.js`
- Modify: `front:src/lib/auth.js:131` (`sinBase`)
- Modify: `front:src/lib/sedes.js:37`
- Modify: las pantallas de la tabla de abajo

**Interfaces:**
- Consumes: `usuario.permisos`, `usuario.es_duenio`, `usuario.rol_nombre` de `GET /cuenta` (Task 6); `n.rol_nombre`, `n.es_duenio`, `n.permisos` en `mis_negocios` / `mis_sedes`.
- Produces:
  - `PERMISOS: { clave, grupo, nombre, descripcion }[]` (23, en el orden del catálogo), `GRUPOS: string[]`, `PERMISOS_DE_MIRAR: string[]`.
  - `puede(quien, clave) → boolean` donde `quien` es cualquier objeto con `es_duenio` y `permisos` (el `usuario`, o una fila de `mis_negocios`).
  - `QUIEN_PUEDE[clave] → string` y `queCambiaConElRol(antes, despues) → { gana: string[], pierde: string[] }` con `antes` / `despues` = `{ es_duenio, permisos }`.

Pantallas a cambiar (`puede(usuario?.rol, X)` → `puede(usuario, Y)`):

| Archivo | Hoy | Pasa a |
|---|---|---|
| `app/agenda/page.js:23` | `cargarDatos` | `manejar_turnos` |
| `app/casos/[id]/page.js:67` | `cargarDatos` | `avanzar_casos` (ver nota) |
| `app/casos/[id]/pasos/page.js:82` | `cargarDatos` | ver nota |
| `app/clientes/page.js:17`, `app/clientes/[id]/page.js:33` | `cargarDatos` | `editar_clientes` |
| `app/equipo/page.js:36` | `manejarEquipo` | `manejar_roles` (cambiar rol) y `sacar_del_equipo` (sacar): dos constantes |
| `app/inventario/page.js:53`, `app/inventario/en-camino/page.js:58` | `cargarDatos` | `editar_inventario` |
| `app/inventario/sedes/page.js:54`, `componentes/SedesVinculadas.js:21` | `vincularSedes` | `vincular_sedes` |
| `app/negocio/horarios/page.js:68`, `app/negocio/landing/page.js:59`, `app/negocio/modulos/page.js:40`, `app/negocio/page.js:132`, `app/page.js:395,399` | `configurarNegocio` | `configurar_negocio` |
| `app/negocio/page.js:367` | `["duenio","encargado"].includes(usuario?.rol)` | `puede(usuario, "conectar_mercadopago")` |
| `componentes/ConexionMercadoPago.js:19` | lo mismo | `puede(usuario, "conectar_mercadopago")` |
| `app/negocio/page.js:519`, `app/negocio/recordatorios/page.js:79` | `cargarDatos` | `entregar_y_reabrir` |
| `componentes/SumarAlEquipo.js:33` | `sumarAlEquipo` | `sumar_al_equipo` |
| `lib/sedes.js:37` | `puede(n.rol, "vincularSedes")` | `puede(n, "vincular_sedes")` |
| `app/historial/page.js` | (sin chequeo) | al principio: si `!puede(usuario, "ver_historial")`, mostrar `<Vacio icono="candado" titulo="Historial">{QUIEN_PUEDE.ver_historial}</Vacio>` y nada más |
| `app/perfil/page.js:260-262` | `etiquetaRol(negocio?.rubro, usuario.rol)` | `usuario.rol_nombre` |
| `app/perfil/TusNegocios.js:74,91` | `rol={usuario?.rol}` / `rol={n.rol}` | `rol={usuario?.rol_nombre}` / `rol={n.rol_nombre}`; en `FilaNegocio.js`, mostrar `rol` tal cual en lugar de `etiquetaRol(…)` |

**Nota, casos:** en `app/casos/[id]/page.js` la constante `puedeCargar` (línea 67) cubre bloques distintos. Dejarla como `puede(usuario, "avanzar_casos")` y agregar al lado `puedeEntregar = puede(usuario, "entregar_y_reabrir")`, `puedeCobrar = puede(usuario, "cobrar")` y `puedePedir = puede(usuario, "editar_inventario")`. Usarlas: línea 742 (bloque de entregar/reabrir) → `puedeEntregar`; línea 736 (prop `puedeCargar` de `Cobros`) → `puedeCobrar`; líneas 704 y 713 (en camino) → `puedePedir`. El resto sigue con `puedeCargar`.

**Nota, pasos:** en `app/casos/[id]/pasos/page.js`, línea 82, partir en `puedeArmar = puede(usuario, "armar_presupuesto")` y `puedeResponder = puede(usuario, "aprobar_por_el_cliente")`. Leer cada uso (líneas 104, 200, 317, 322, 620): lo que agrega, saca o edita un paso usa `puedeArmar`; lo que aprueba o rechaza usa `puedeResponder`.

- [ ] **Step 1: Reescribir `pruebas/permisos.test.js`**

```js
// Correr con: npm test
//
// Los permisos de la interfaz: el mismo catálogo que la base (053_roles.sql)
// y la API (src/compartido/permisos.ts). Si acá sobra un permiso, se ofrece un
// botón que la base va a rechazar; si falta, se esconde algo que sí se podía.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GRUPOS, PERMISOS, PERMISOS_DE_MIRAR, QUIEN_PUEDE, puede, queCambiaConElRol } from "../src/lib/permisos.js";

const claves = PERMISOS.map((p) => p.clave);

test("son las mismas 23 claves que la 053, en el mismo orden", () => {
  const sql = readFileSync(new URL("../supabase/053_roles.sql", import.meta.url), "utf8");
  const bloque = sql.slice(sql.indexOf("function permisos_conocidos()"), sql.indexOf("]::text[]"));
  assert.deepEqual(claves, [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
});

test("cada permiso tiene grupo, nombre, descripción y su frase de por qué no", () => {
  for (const p of PERMISOS) {
    assert.ok(GRUPOS.includes(p.grupo), `${p.clave}: grupo desconocido`);
    assert.ok(p.nombre && p.descripcion, `${p.clave}: falta el texto`);
    assert.ok(QUIEN_PUEDE[p.clave], `${p.clave}: falta QUIEN_PUEDE`);
  }
});

test("los de mirar están en el catálogo", () => {
  for (const c of PERMISOS_DE_MIRAR) assert.ok(claves.includes(c), c);
});

test("el Dueño puede todo, aunque su lista venga vacía", () => {
  for (const c of claves) assert.equal(puede({ es_duenio: true, permisos: [] }, c), true, c);
});

test("los demás, sólo lo de su lista", () => {
  const q = { es_duenio: false, permisos: ["cobrar"] };
  assert.equal(puede(q, "cobrar"), true);
  assert.equal(puede(q, "crear_casos"), false);
});

test("sin usuario (la cuenta todavía no cargó) no se ofrece nada", () => {
  assert.equal(puede(null, "configurar_negocio"), false);
  assert.equal(puede(undefined, "cobrar"), false);
  assert.equal(puede({}, "cobrar"), false);
});

test("una clave que no existe no habilita nada", () => {
  assert.equal(puede({ es_duenio: false, permisos: ["borrar_todo"] }, "borrar_todo"), false);
});

test("qué gana y qué pierde alguien al cambiar de rol", () => {
  const { gana, pierde } = queCambiaConElRol(
    { es_duenio: false, permisos: ["cobrar", "ver_agenda"] },
    { es_duenio: false, permisos: ["ver_agenda", "crear_casos"] }
  );
  assert.deepEqual(gana, [PERMISOS.find((p) => p.clave === "crear_casos").descripcion]);
  assert.deepEqual(pierde, [PERMISOS.find((p) => p.clave === "cobrar").descripcion]);
});

test("pasar a Dueño gana todo lo que no tenía", () => {
  const { gana, pierde } = queCambiaConElRol({ es_duenio: false, permisos: ["cobrar"] }, { es_duenio: true, permisos: [] });
  assert.equal(gana.length, 22);
  assert.equal(pierde.length, 0);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npm run test:unit -- pruebas/permisos.test.js`
Expected: FAIL (`GRUPOS` no existe).

- [ ] **Step 3: Reescribir `src/lib/permisos.js`**

```js
// Qué puede hacer un rol (docs/roles.md).
//
// El catálogo es el mismo que la base (supabase/053_roles.sql) y la API
// (src/compartido/permisos.ts), con las mismas claves en el mismo orden: la
// prueba lo verifica contra la 053. Acá sólo sirve para no ofrecer botones
// que van a rechazar: **la que manda es la base**. Esconder un botón no
// protege nada.
//
// Los textos son formales e impersonales (docs/roles.md, "Textos").

export const GRUPOS = ["Casos", "Presupuesto", "Cobros", "Clientes", "Agenda", "Inventario", "Sedes", "Equipo", "Negocio"];

export const PERMISOS = [
  { clave: "ver_todos_los_casos", grupo: "Casos", nombre: "Ver todos los casos", descripcion: "Ver todos los casos del negocio. Sin este permiso, solo los casos asignados." },
  { clave: "crear_casos", grupo: "Casos", nombre: "Abrir casos", descripcion: "Abrir casos nuevos." },
  { clave: "avanzar_casos", grupo: "Casos", nombre: "Trabajar los casos", descripcion: "Cambiar el estado, editar los datos, anotar y compartir el seguimiento." },
  { clave: "asignar_casos", grupo: "Casos", nombre: "Asignar casos", descripcion: "Elegir o cambiar el responsable de un caso." },
  { clave: "entregar_y_reabrir", grupo: "Casos", nombre: "Entregar y reabrir", descripcion: "Entregar casos, reabrirlos y configurar los mensajes de WhatsApp." },
  { clave: "armar_presupuesto", grupo: "Presupuesto", nombre: "Armar el presupuesto", descripcion: "Agregar, editar y quitar pasos, montos, descuentos y ecuaciones." },
  { clave: "aprobar_por_el_cliente", grupo: "Presupuesto", nombre: "Responder por el cliente", descripcion: "Aprobar o rechazar pasos en nombre del cliente." },
  { clave: "cobrar", grupo: "Cobros", nombre: "Cobrar", descripcion: "Registrar y anular cobros, y generar el QR o link de pago." },
  { clave: "conectar_mercadopago", grupo: "Cobros", nombre: "Conectar Mercado Pago", descripcion: "Vincular y desvincular la cuenta de cobro del negocio." },
  { clave: "ver_clientes", grupo: "Clientes", nombre: "Ver clientes", descripcion: "Ver la lista de clientes y sus datos." },
  { clave: "editar_clientes", grupo: "Clientes", nombre: "Editar clientes", descripcion: "Agregar y modificar clientes." },
  { clave: "ver_agenda", grupo: "Agenda", nombre: "Ver la agenda", descripcion: "Ver los turnos." },
  { clave: "manejar_turnos", grupo: "Agenda", nombre: "Manejar turnos", descripcion: "Dar, mover, cancelar y marcar turnos, con sus recordatorios." },
  { clave: "ver_inventario", grupo: "Inventario", nombre: "Ver el inventario", descripcion: "Ver productos y stock." },
  { clave: "editar_inventario", grupo: "Inventario", nombre: "Editar el inventario", descripcion: "Cargar productos, cambiar el stock y hacer pedidos." },
  { clave: "ver_inventario_de_sedes", grupo: "Inventario", nombre: "Ver el inventario de las sedes", descripcion: "Ver el inventario conjunto de las sedes vinculadas donde se es miembro." },
  { clave: "ver_sedes_vinculadas", grupo: "Sedes", nombre: "Ver las sedes vinculadas", descripcion: "Entrar en modo solo lectura a las sedes vinculadas donde no se es miembro." },
  { clave: "vincular_sedes", grupo: "Sedes", nombre: "Vincular sedes", descripcion: "Vincular y desvincular este negocio con otras sedes." },
  { clave: "sumar_al_equipo", grupo: "Equipo", nombre: "Sumar al equipo", descripcion: "Manejar el link de ingreso y aprobar o rechazar pedidos." },
  { clave: "sacar_del_equipo", grupo: "Equipo", nombre: "Sacar del equipo", descripcion: "Quitar personas del equipo." },
  { clave: "manejar_roles", grupo: "Equipo", nombre: "Manejar roles", descripcion: "Crear, editar y asignar roles, solo con permisos incluidos en el rol propio." },
  { clave: "configurar_negocio", grupo: "Negocio", nombre: "Configurar el negocio", descripcion: "Datos, horarios, módulos, Inicio, landing y links públicos de la agenda." },
  { clave: "ver_historial", grupo: "Negocio", nombre: "Ver el historial", descripcion: "Ver la pantalla Historial del negocio." },
];

const CLAVES = new Set(PERMISOS.map((p) => p.clave));

export const PERMISOS_DE_MIRAR = ["ver_todos_los_casos", "ver_clientes", "ver_agenda", "ver_inventario", "ver_historial"];

// `quien` es el usuario de la sesión o una fila de mis_negocios(): cualquier
// cosa con es_duenio y permisos. Sin datos (la cuenta todavía no cargó) no se
// ofrece nada.
export function puede(quien, clave) {
  if (!CLAVES.has(clave)) return false;
  return Boolean(quien?.es_duenio) || Boolean(quien?.permisos?.includes(clave));
}

// Para explicar por qué un control está apagado.
export const QUIEN_PUEDE = Object.fromEntries(
  PERMISOS.map((p) => [p.clave, `Su rol no incluye el permiso «${p.nombre}».`])
);

const efectivos = (rol) => (rol?.es_duenio ? PERMISOS.map((p) => p.clave) : rol?.permisos ?? []);

// Qué gana y qué pierde alguien al pasar de un rol a otro. Para la
// confirmación de Equipo: "Permisos que se agregan" / "Permisos que se quitan".
export function queCambiaConElRol(antes, despues) {
  const a = new Set(efectivos(antes));
  const d = new Set(efectivos(despues));
  return {
    gana: PERMISOS.filter((p) => !a.has(p.clave) && d.has(p.clave)).map((p) => p.descripcion),
    pierde: PERMISOS.filter((p) => a.has(p.clave) && !d.has(p.clave)).map((p) => p.descripcion),
  };
}
```

`rolesQuePuedeDar` se va: la Tarea 10 lo reemplaza. Mientras tanto, en `SumarAlEquipo.js:79` cambiar `rolesQuePuedeDar(usuario?.rol)` por la lista fija que usaba ese archivo para un Dueño o encargado, filtrada así: `["duenio", "encargado", "tecnico"].filter((r) => usuario?.es_duenio || r !== "duenio")`.

- [ ] **Step 4: `sinBase` es Dueño**

En `src/lib/auth.js`, en `sinBase` (línea 131), reemplazar `rol: "duenio",` por:

```js
      // Sin base (modo de ejemplo) la cuenta es la dueña de su negocio local.
      es_duenio: true,
      permisos: [],
      rol_nombre: "Dueño",
```

- [ ] **Step 5: Cambiar las pantallas de la tabla**

Hacer los cambios de la tabla y las dos notas. En cada archivo, `QUIEN_PUEDE.cargarDatos` / `QUIEN_PUEDE.configurarNegocio` / etc. pasan a `QUIEN_PUEDE.<clave nueva>`.

Run: `grep -rn "usuario?.rol\b\|usuario\.rol\b\|\.rol)" src --include=*.js`
Expected: ninguna línea que decida un permiso (pueden quedar `e.rol` de fichas en `app/equipo/page.js`: los cambia la Tarea 10).

- [ ] **Step 6: Correr todo**

Run: `npm run test:unit`
Expected: PASS. Si `pruebas/sedes.test.js` o `pruebas/presets.test.js` usan `puede(n.rol, …)` o `rolesQuePuedeDar`, actualizarlas al contrato nuevo.

- [ ] **Step 7: Probar a mano**

`npm run dev`, entrar con una cuenta dueña y con una encargada (base con 053-055 y la API de la Tarea 6): los mismos botones que antes en Casos, Agenda, Clientes, Inventario y Mi negocio. En modo de ejemplo (sin `NEXT_PUBLIC_API_URL`), todo como antes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "El front decide con los permisos de la sesión"
```

---

# Etapa 3 — Roles editables

### Task 8: Funciones para crear, editar, borrar y asignar roles

**Files:**
- Create: `front:supabase/056_roles_editables.sql`
- Modify: `front:supabase/pruebas/roles.sql` (secciones 10 y 11)
- Modify: `front:supabase/pruebas/equipo_por_link.sql` (las llamadas a `aprobar_solicitud`)

**Interfaces:**
- Consumes: `permisos_efectivos`, `puede_aca`, `permisos_conocidos`.
- Produces:
  - `roles_del_negocio() returns table (id uuid, nombre text, es_duenio boolean, permisos text[], personas integer)`
  - `guardar_rol(p_id uuid, p_nombre text, p_permisos text[]) returns uuid` (`p_id` null = crear)
  - `borrar_rol(p_id uuid) returns void`
  - `asignar_rol(p_empleado uuid, p_rol uuid) returns void`
  - `aprobar_solicitud(p_id uuid, p_rol uuid) returns void` (reemplaza a `(uuid, text)`)
  - `empleado.rol` y `usuario.rol` pasan a aceptar null; `authenticated` deja de poder escribir `empleado.rol`.

Reglas del tope (docs/roles.md, "El tope"), con el mensaje de cada una:

| Regla | errcode | Mensaje |
|---|---|---|
| Sin `manejar_roles` | 42501 | Este rol no permite manejar roles. |
| Un permiso fuera de los propios | 42501 | Solo se pueden otorgar permisos incluidos en el rol propio. |
| Editar o asignar un rol con permisos que el propio no tiene | 42501 | Este rol tiene permisos que el rol propio no incluye. |
| Tocar el rol Dueño | P0001 | El rol Dueño no se modifica. |
| Tocar el rol propio / cambiarse el rol | P0001 | El rol propio no se modifica. |
| Cambiarle el rol al creador | P0001 | A quien creó el negocio no se le puede cambiar el rol. |
| Dar el rol Dueño sin ser Dueño | 42501 | Solo un Dueño puede asignar el rol Dueño. |
| Bajar a alguien con más permisos | 42501 | Esta persona tiene permisos que el rol propio no incluye. |
| Nombre vacío | P0001 | El rol necesita un nombre. |
| Nombre repetido | P0001 | Ya hay un rol con ese nombre. |
| Permiso inexistente | P0001 | Hay un permiso que no existe. |
| Borrar un rol en uso | P0001 | Rol asignado a N personas. Para eliminarlo, asigne otro rol a esas personas. |
| Rol o ficha de otro negocio, o que no está | P0001 | Ese rol ya no existe. / Esa persona ya no está en el equipo. |

- [ ] **Step 1: Escribir la prueba (sección 10: el tope)**

```sql
    -- ---- 10. Roles a medida y el tope ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);

    -- La dueña arma "Recepción" (puede manejar roles y cobrar, nada más) y se
    -- la da a Edu.
    pedido := guardar_rol(null, 'Recepción', array['manejar_roles', 'cobrar']);
    perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Edu'), pedido);

    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    if not puede_aca('cobrar') or puede_aca('crear_casos') then
      raise exception 'FALLÓ 10: el rol asignado no dio sus permisos.';
    end if;

    -- Edu no arma un rol con un permiso que no tiene.
    frenado := false;
    begin perform guardar_rol(null, 'Amigo', array['cobrar', 'crear_casos']);
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se dio un permiso que no se tiene.'; end if;

    -- Sí uno dentro de lo suyo.
    perform guardar_rol(null, 'Caja', array['cobrar']);

    -- No edita el Encargado (tiene permisos que él no).
    frenado := false;
    begin perform guardar_rol((select id from rol where negocio_id = neg_a and nombre = 'Encargado'), 'Encargado', array['cobrar']);
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se editó un rol con más permisos que el propio.'; end if;

    -- No edita su propio rol, ni el Dueño, ni se cambia el rol.
    frenado := false;
    begin perform guardar_rol(pedido, 'Recepción', array['cobrar']);
    exception when raise_exception then frenado := (sqlerrm = 'El rol propio no se modifica.'); end;
    if not frenado then raise exception 'FALLÓ 10: se editó el rol propio.'; end if;
    frenado := false;
    begin perform guardar_rol((select id from rol where negocio_id = neg_a and es_duenio), 'Jefe', '{}');
    exception when raise_exception then frenado := (sqlerrm = 'El rol Dueño no se modifica.'); end;
    if not frenado then raise exception 'FALLÓ 10: se editó el rol Dueño.'; end if;
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Edu'), (select id from rol where negocio_id = neg_a and nombre = 'Caja'));
    exception when raise_exception then frenado := (sqlerrm = 'El rol propio no se modifica.'); end;
    if not frenado then raise exception 'FALLÓ 10: alguien se cambió su propio rol.'; end if;

    -- No se da el rol Dueño, ni baja a la dueña, ni baja a Ivo al rol Caja
    -- (Ivo tiene permisos de mirar que Edu ya no).
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Ivo'), (select id from rol where negocio_id = neg_a and es_duenio));
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se dio el rol Dueño sin ser Dueño.'; end if;
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and usuario_id = ana), (select id from rol where negocio_id = neg_a and nombre = 'Caja'));
    exception when others then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se le cambió el rol a la creadora.'; end if;
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Ivo'), (select id from rol where negocio_id = neg_a and nombre = 'Caja'));
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se bajó a alguien con permisos que el propio no tiene.'; end if;

    -- Un rol de otro negocio no se asigna.
    perform set_config('role', 'postgres', true);
    select id into fila from rol where negocio_id = neg_p and es_duenio;
    perform set_config('role', 'authenticated', true);
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Ivo'), fila.id);
    exception when raise_exception then frenado := (sqlerrm = 'Ese rol ya no existe.'); end;
    if not frenado then raise exception 'FALLÓ 10: se asignó un rol de otro negocio.'; end if;

    -- Un rol en uso no se borra; uno libre sí.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform borrar_rol(pedido);
    exception when raise_exception then frenado := (sqlerrm like 'Rol asignado a 1 persona%'); end;
    if not frenado then raise exception 'FALLÓ 10: se borró un rol en uso.'; end if;
    perform borrar_rol((select id from rol where negocio_id = neg_a and nombre = 'Caja'));

    -- Nombre repetido y permiso inexistente.
    frenado := false;
    begin perform guardar_rol(null, 'recepción', '{}');
    exception when raise_exception then frenado := (sqlerrm = 'Ya hay un rol con ese nombre.'); end;
    if not frenado then raise exception 'FALLÓ 10: se repitió el nombre de un rol.'; end if;
    frenado := false;
    begin perform guardar_rol(null, 'Raro', array['borrar_todo']);
    exception when raise_exception then frenado := (sqlerrm = 'Hay un permiso que no existe.'); end;
    if not frenado then raise exception 'FALLÓ 10: se guardó un permiso que no existe.'; end if;

    -- roles_del_negocio() cuenta las personas.
    select personas into n from roles_del_negocio() where nombre = 'Recepción';
    if n <> 1 then raise exception 'FALLÓ 10: roles_del_negocio() cuenta % personas en Recepción.', n; end if;

    -- Desde el navegador ya no se escribe el rol de una ficha.
    frenado := false;
    begin update empleado set rol = 'tecnico' where negocio_id = neg_a and nombre = 'Ivo';
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se cambió empleado.rol sin pasar por asignar_rol().'; end if;

    -- ---- 11. Aprobar un pedido con un rol a medida ----
    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link, 'Zoe');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform aprobar_solicitud((select id from pedidos_de_ingreso() where nombre = 'Zoe'), pedido);
    perform set_config('role', 'postgres', true);
    select count(*) into n from empleado where negocio_id = neg_a and usuario_id = zoe and rol_id = pedido;
    perform set_config('role', 'authenticated', true);
    if n <> 1 then raise exception 'FALLÓ 11: aprobar no dejó a Zoe con el rol elegido.'; end if;
```

Y en la sección 1 de la misma prueba (Task 1) y en `pruebas/equipo_por_link.sql`: las llamadas `aprobar_solicitud(pedido, 'encargado')` / `'tecnico'` pasan a `aprobar_solicitud(pedido, (select id from rol where negocio_id = <negocio> and nombre = 'Encargado'))` / `'Mecánico'` (leyendo `rol` como `postgres` si hace falta, como hacen esas pruebas con `empleado`).

- [ ] **Step 2: Correr y ver que falla**

Expected: `function guardar_rol(unknown, unknown, text[]) does not exist`.

- [ ] **Step 3: Escribir `056_roles_editables.sql`**

```sql
-- ============================================================
-- 056_roles_editables.sql — crear, editar, borrar y asignar roles
--
-- Correr entero en el SQL Editor de Supabase, después de la 055.
-- Es idempotente. Va junto con la API de la Tarea 9 (docs/roles-plan.md):
-- cambia la firma de aprobar_solicitud.
--
-- EL TOPE (docs/roles.md): quien tiene manejar_roles sólo da permisos que su
-- rol ya tiene, no toca el rol Dueño ni el propio, no se cambia el rol, no
-- toca a quien creó el negocio y no baja a alguien que tiene más que él. El
-- rol Dueño lo da sólo un Dueño. Reemplaza al rango (dueño 3 > encargado 2 >
-- técnico 1) de la 051.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La palabra vieja deja de ser obligatoria
-- ------------------------------------------------------------
-- Un rol a medida no tiene palabra vieja. Las columnas se van en la 059.
alter table empleado alter column rol drop not null;
alter table usuario alter column rol drop not null;

-- El rol de una ficha se cambia sólo con asignar_rol(). nombre sigue (037).
revoke update on empleado from authenticated;
grant update (nombre) on empleado to authenticated;

-- ------------------------------------------------------------
-- 2. Ayudas
-- ------------------------------------------------------------
create or replace function soy_duenio_aca()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select r.es_duenio from empleado e join rol r on r.id = e.rol_id
     where e.negocio_id = mi_negocio() and e.usuario_id = auth.uid()
  ), false);
$$;

revoke all on function soy_duenio_aca() from public;
revoke all on function soy_duenio_aca() from anon;
grant execute on function soy_duenio_aca() to authenticated;

-- Los permisos efectivos de un rol (Dueño = todos).
create or replace function permisos_del_rol(p_rol uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case when es_duenio then permisos_conocidos() else permisos end from rol where id = p_rol;
$$;

revoke all on function permisos_del_rol(uuid) from public;
revoke all on function permisos_del_rol(uuid) from anon;
revoke all on function permisos_del_rol(uuid) from authenticated;

-- ------------------------------------------------------------
-- 3. Ver
-- ------------------------------------------------------------
create or replace function roles_del_negocio()
returns table (id uuid, nombre text, es_duenio boolean, permisos text[], personas integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.nombre, r.es_duenio,
         case when r.es_duenio then permisos_conocidos() else r.permisos end,
         (select count(*)::integer from empleado e where e.rol_id = r.id)
    from rol r
   where r.negocio_id = mi_negocio()
     and mi_empleado() is not null
   order by r.es_duenio desc, lower(r.nombre);
$$;

revoke all on function roles_del_negocio() from public;
revoke all on function roles_del_negocio() from anon;
grant execute on function roles_del_negocio() to authenticated;

-- ------------------------------------------------------------
-- 4. Crear y editar
-- ------------------------------------------------------------
create or replace function guardar_rol(p_id uuid, p_nombre text, p_permisos text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actual rol%rowtype;
  limpio text[];
  mio uuid;
  nombre_limpio text := nullif(trim(p_nombre), '');
begin
  if not puede_aca('manejar_roles') then
    raise exception 'Este rol no permite manejar roles.' using errcode = '42501';
  end if;
  if nombre_limpio is null then
    raise exception 'El rol necesita un nombre.';
  end if;

  limpio := array(select distinct x from unnest(coalesce(p_permisos, '{}')) x order by 1);
  if not limpio <@ permisos_conocidos() then
    raise exception 'Hay un permiso que no existe.';
  end if;
  if not limpio <@ permisos_efectivos(mi_negocio()) then
    raise exception 'Solo se pueden otorgar permisos incluidos en el rol propio.' using errcode = '42501';
  end if;

  if p_id is null then
    insert into rol (negocio_id, nombre, permisos)
    values (mi_negocio(), nombre_limpio, limpio)
    returning id into p_id;
    return p_id;
  end if;

  select * into actual from rol where id = p_id and negocio_id = mi_negocio();
  if not found then
    raise exception 'Ese rol ya no existe.';
  end if;
  if actual.es_duenio then
    raise exception 'El rol Dueño no se modifica.';
  end if;
  select rol_id into mio from empleado where negocio_id = mi_negocio() and usuario_id = auth.uid();
  if actual.id = mio then
    raise exception 'El rol propio no se modifica.';
  end if;
  if not actual.permisos <@ permisos_efectivos(mi_negocio()) then
    raise exception 'Este rol tiene permisos que el rol propio no incluye.' using errcode = '42501';
  end if;

  update rol set nombre = nombre_limpio, permisos = limpio where id = p_id;
  return p_id;
exception
  when unique_violation then
    raise exception 'Ya hay un rol con ese nombre.';
end;
$$;

revoke all on function guardar_rol(uuid, text, text[]) from public;
revoke all on function guardar_rol(uuid, text, text[]) from anon;
grant execute on function guardar_rol(uuid, text, text[]) to authenticated;

-- ------------------------------------------------------------
-- 5. Borrar
-- ------------------------------------------------------------
create or replace function borrar_rol(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actual rol%rowtype;
  cuantas integer;
begin
  if not puede_aca('manejar_roles') then
    raise exception 'Este rol no permite manejar roles.' using errcode = '42501';
  end if;
  select * into actual from rol where id = p_id and negocio_id = mi_negocio();
  if not found then
    raise exception 'Ese rol ya no existe.';
  end if;
  if actual.es_duenio then
    raise exception 'El rol Dueño no se modifica.';
  end if;
  if not actual.permisos <@ permisos_efectivos(mi_negocio()) then
    raise exception 'Este rol tiene permisos que el rol propio no incluye.' using errcode = '42501';
  end if;
  select count(*) into cuantas from empleado where rol_id = p_id;
  if cuantas > 0 then
    raise exception 'Rol asignado a % %. Para eliminarlo, asigne otro rol a esas personas.',
      cuantas, case when cuantas = 1 then 'persona' else 'personas' end;
  end if;
  delete from rol where id = p_id;
end;
$$;

revoke all on function borrar_rol(uuid) from public;
revoke all on function borrar_rol(uuid) from anon;
grant execute on function borrar_rol(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Asignar
-- ------------------------------------------------------------
create or replace function asignar_rol(p_empleado uuid, p_rol uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ficha empleado%rowtype;
  nuevo rol%rowtype;
  mios text[] := permisos_efectivos(mi_negocio());
begin
  if not puede_aca('manejar_roles') then
    raise exception 'Este rol no permite manejar roles.' using errcode = '42501';
  end if;

  select * into ficha from empleado where id = p_empleado and negocio_id = mi_negocio() for update;
  if not found then
    raise exception 'Esa persona ya no está en el equipo.';
  end if;
  select * into nuevo from rol where id = p_rol and negocio_id = mi_negocio();
  if not found then
    raise exception 'Ese rol ya no existe.';
  end if;

  if ficha.usuario_id = auth.uid() then
    raise exception 'El rol propio no se modifica.';
  end if;
  if ficha.usuario_id = (select creado_por from negocio where id = ficha.negocio_id) then
    raise exception 'A quien creó el negocio no se le puede cambiar el rol.';
  end if;
  if nuevo.es_duenio and not soy_duenio_aca() then
    raise exception 'Solo un Dueño puede asignar el rol Dueño.' using errcode = '42501';
  end if;
  if not permisos_del_rol(ficha.rol_id) <@ mios then
    raise exception 'Esta persona tiene permisos que el rol propio no incluye.' using errcode = '42501';
  end if;
  if not permisos_del_rol(p_rol) <@ mios then
    raise exception 'Solo se pueden otorgar permisos incluidos en el rol propio.' using errcode = '42501';
  end if;

  -- La palabra vieja acompaña mientras exista (059): la del rol, o ninguna.
  -- Va con rol_id en el mismo update, así el trigger de la 053 no la pisa.
  update empleado set rol_id = p_rol, rol = nuevo.clave where id = p_empleado;
end;
$$;

revoke all on function asignar_rol(uuid, uuid) from public;
revoke all on function asignar_rol(uuid, uuid) from anon;
grant execute on function asignar_rol(uuid, uuid) to authenticated;
```

Después, en la misma migración, `aprobar_solicitud` con rol nuevo. Copiar `051_equipo_por_link.sql:306-358` y cambiar:
- La firma: `drop function if exists aprobar_solicitud(uuid, text);` antes, y `create function aprobar_solicitud(p_id uuid, p_rol uuid)`.
- `declare`: sacar `mi_rol_aca text;`, agregar `nuevo rol%rowtype;`.
- Reemplazar el bloque de `rango_del_rol` (las dos comprobaciones, líneas 326-333) por:

```sql
  select * into nuevo from rol where id = p_rol and negocio_id = activo;
  if not found then
    raise exception 'Ese rol ya no existe.';
  end if;
  if nuevo.es_duenio and not soy_duenio_aca() then
    raise exception 'Solo un Dueño puede asignar el rol Dueño.' using errcode = '42501';
  end if;
  if not permisos_del_rol(p_rol) <@ permisos_efectivos(activo) then
    raise exception 'Solo se pueden otorgar permisos incluidos en el rol propio.' using errcode = '42501';
  end if;
```

- El insert: `insert into empleado (negocio_id, nombre, rol, rol_id, usuario_id) values (activo, s.nombre, nuevo.clave, p_rol, s.usuario_id);`
- El último update: `rol = nuevo.clave` en lugar de `rol = p_rol`.
- Al final, los grants con la firma nueva `(uuid, uuid)`.

- [ ] **Step 4: Correr la migración y todas las pruebas SQL**

Expected: todas "Success. No rows returned".

- [ ] **Step 5: Commit**

```bash
git add supabase/056_roles_editables.sql supabase/pruebas
git commit -m "Roles editables con tope (056)"
```

### Task 9: La API de roles

**Files:**
- Create: `api:src/modulos/roles/errores.ts`, `esquemas.ts`, `repositorio.ts`, `casos-de-uso.ts`, `rutas.ts`
- Modify: el archivo donde se montan las rutas (buscar `rutasEquipo` en `api:src/servidor.ts`) para montar `rutasRoles` igual.
- Modify: `api:src/modulos/equipo/{esquemas,repositorio,casos-de-uso}.ts`
- Create: `api:pruebas/casos-de-uso/roles.test.ts`, `api:pruebas/contrato/roles.test.ts`
- Modify: `api:requests.http` (ejemplos)

**Interfaces:**
- Consumes: `roles_del_negocio`, `guardar_rol`, `borrar_rol`, `asignar_rol`, `aprobar_solicitud(uuid, uuid)` (Task 8).
- Produces (todas con sesión, bajo `/v1`):
  - `GET /roles` → `{ ok, datos: { roles: Rol[] } }` con `Rol = { id, nombre, es_duenio, permisos, personas }`
  - `POST /roles` `{ nombre, permisos }` → `{ roles }`
  - `PATCH /roles/:id` `{ nombre, permisos }` → `{ roles }`
  - `DELETE /roles/:id` → `{ roles }`
  - `PATCH /equipo/:id/rol` `{ rol_id }` → `{ empleado }` (antes `{ rol, actualizado_en }`)
  - `POST /equipo/pedidos/:id/aprobar` `{ rol_id }` (antes `{ rol }`)

La API **no** repite el tope: lo decide la base. Sólo exige `manejar_roles` antes (403 rápido) y traduce `42501` → 403 `sin_permiso`, `P0001` → 422 `regla` con el mensaje (como `equipo`; mirar `valor()` en `api:src/modulos/equipo/casos-de-uso.ts` y reusar ese mismo traductor).

- [ ] **Step 1: Escribir las pruebas de casos de uso**

`api:pruebas/casos-de-uso/roles.test.ts`:

```ts
// Roles, con un repositorio de mentira: sin base ni HTTP. Las reglas del tope
// las prueba supabase/pruebas/roles.sql; acá, lo que hace la API.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as Roles from "../../src/modulos/roles/casos-de-uso.js";
import type { RepositorioRoles } from "../../src/modulos/roles/repositorio.js";
import { fallaCon, ID, noPasaElEsquema, quien, quienCon } from "../apoyo/afirmar.js";

function rolesFalso() {
    const llamadas: unknown[][] = [];
    const repo: RepositorioRoles = {
        async listar() { return { ok: true, valor: [] }; },
        async guardar(id, nombre, permisos) { llamadas.push(["guardar", id, nombre, permisos]); return { ok: true, valor: ID }; },
        async borrar(id) { llamadas.push(["borrar", id]); return { ok: true, valor: null }; },
    };
    return { repo, llamadas };
}

describe("roles", () => {
    test("sin manejar_roles, 403 antes de ir a la base", async () => {
        const { repo, llamadas } = rolesFalso();
        await fallaCon(Roles.crear({ repo, quien: quien("encargado") }, { nombre: "Caja", permisos: ["cobrar"] }), "sin_permiso", 403);
        assert.equal(llamadas.length, 0);
    });

    test("con manejar_roles, guarda con el nombre limpio y sin repetir permisos", async () => {
        const { repo, llamadas } = rolesFalso();
        await Roles.crear({ repo, quien: quienCon(["manejar_roles", "cobrar"]) }, { nombre: "  Caja ", permisos: ["cobrar", "cobrar"] });
        assert.deepEqual(llamadas[0], ["guardar", null, "Caja", ["cobrar"]]);
    });

    test("un permiso que no existe no pasa el esquema", async () => {
        await noPasaElEsquema(Roles.crear({ repo: rolesFalso().repo, quien: quien("duenio") }, { nombre: "X", permisos: ["borrar_todo"] }));
    });

    test("sin nombre no pasa el esquema", async () => {
        await noPasaElEsquema(Roles.crear({ repo: rolesFalso().repo, quien: quien("duenio") }, { nombre: " ", permisos: [] }));
    });

    test("editar con un id que no es uuid es 404", async () => {
        await fallaCon(Roles.editar({ repo: rolesFalso().repo, quien: quien("duenio") }, "x", { nombre: "A", permisos: [] }), "no_encontrado", 404);
    });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npm run test:pruebas`
Expected: FAIL `Cannot find module '../../src/modulos/roles/casos-de-uso.js'`.

- [ ] **Step 3: Escribir el módulo `roles`**

`api:src/modulos/roles/errores.ts`:

```ts
import { ErrorDeNegocio } from "../../compartido/errores.js";

export const SinPermiso = () => new ErrorDeNegocio(403, "sin_permiso", "Su rol no incluye el permiso «Manejar roles».");
export const RolNoEncontrado = () => new ErrorDeNegocio(404, "no_encontrado", "Ese rol ya no existe.");
```

`api:src/modulos/roles/esquemas.ts`:

```ts
import { z } from "zod";
import { esPermiso } from "../../compartido/permisos.js";

export const rol = z.object({
    nombre: z.string({ error: "El rol necesita un nombre." }).trim().min(1, { error: "El rol necesita un nombre." })
        .max(40, { error: "El nombre admite hasta 40 caracteres." }),
    permisos: z.array(z.string().refine(esPermiso, { error: "Hay un permiso que no existe." }))
        .transform((l) => [...new Set(l)].sort()),
}, { error: "Faltan el nombre y los permisos." });
```

`api:src/modulos/roles/repositorio.ts` (seguir el patrón de `equipo/repositorio.ts`: `Resultado<T>` y el traductor de errores de la base que usa ese archivo):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resultado } from "../equipo/repositorio.js";

export type Rol = { id: string; nombre: string; es_duenio: boolean; permisos: string[]; personas: number };

export type RepositorioRoles = {
    listar(): Promise<Resultado<Rol[]>>;
    guardar(id: string | null, nombre: string, permisos: string[]): Promise<Resultado<string>>;
    borrar(id: string): Promise<Resultado<null>>;
};

export function repositorio(db: SupabaseClient): RepositorioRoles {
    return {
        async listar() {
            const { data, error } = await db.rpc("roles_del_negocio");
            return error ? { ok: false, error } : { ok: true, valor: (data ?? []) as Rol[] };
        },
        async guardar(id, nombre, permisos) {
            const { data, error } = await db.rpc("guardar_rol", { p_id: id, p_nombre: nombre, p_permisos: permisos });
            return error ? { ok: false, error } : { ok: true, valor: data as string };
        },
        async borrar(id) {
            const { error } = await db.rpc("borrar_rol", { p_id: id });
            return error ? { ok: false, error } : { ok: true, valor: null };
        },
    };
}
```

> Si `equipo/repositorio.ts` no exporta `Resultado` o lo arma distinto, usar el mismo tipo y la misma forma que usa ese archivo para `aprobar` (línea 68) y exportarlo desde ahí.

`api:src/modulos/roles/casos-de-uso.ts`:

```ts
import { puede } from "../../compartido/permisos.js";
import type { Quien } from "../../compartido/quien-soy.js";
import { valor } from "../equipo/casos-de-uso.js";
import { RolNoEncontrado, SinPermiso } from "./errores.js";
import * as Esquemas from "./esquemas.js";
import type { RepositorioRoles } from "./repositorio.js";

// Crear, editar y borrar roles. El tope (nadie da lo que no tiene) lo decide
// la base (056); acá sólo se contesta 403 antes si falta manejar_roles.

export type Contexto = { repo: RepositorioRoles; quien: Quien };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exigir(quien: Quien) {
    if (!puede(quien, "manejar_roles")) throw SinPermiso();
}

const lista = async (repo: RepositorioRoles) => ({ roles: valor(await repo.listar()) });

export async function listar({ repo }: Contexto) {
    return lista(repo);
}

export async function crear({ repo, quien }: Contexto, entrada: unknown) {
    exigir(quien);
    const { nombre, permisos } = Esquemas.rol.parse(entrada ?? {});
    valor(await repo.guardar(null, nombre, permisos));
    return lista(repo);
}

export async function editar({ repo, quien }: Contexto, id: string, entrada: unknown) {
    exigir(quien);
    if (!UUID.test(id)) throw RolNoEncontrado();
    const { nombre, permisos } = Esquemas.rol.parse(entrada ?? {});
    valor(await repo.guardar(id, nombre, permisos));
    return lista(repo);
}

export async function borrar({ repo, quien }: Contexto, id: string) {
    exigir(quien);
    if (!UUID.test(id)) throw RolNoEncontrado();
    valor(await repo.borrar(id));
    return lista(repo);
}
```

> `valor()` es el que ya usa `equipo/casos-de-uso.ts` para traducir el resultado de la base (`42501` → 403, `P0001` → 422). Si no está exportado, exportarlo de ahí (no copiarlo).

`api:src/modulos/roles/rutas.ts`:

```ts
import { Router, type Request } from "express";
import { quienSoy } from "../../compartido/quien-soy.js";
import { ok } from "../../http/respuestas.js";
import * as CasosDeUso from "./casos-de-uso.js";
import { repositorio } from "./repositorio.js";

// Finas: arman el contexto, llaman al caso de uso y responden.

export const rutasRoles = Router();

const contexto = async (req: Request): Promise<CasosDeUso.Contexto> => ({
    repo: repositorio(req.db),
    quien: await quienSoy(req),
});
const id = (req: Request) => String(req.params.id);

rutasRoles.get("/roles", async (req, res) => {
    res.json(ok(await CasosDeUso.listar(await contexto(req))));
});

rutasRoles.post("/roles", async (req, res) => {
    res.json(ok(await CasosDeUso.crear(await contexto(req), req.body)));
});

rutasRoles.patch("/roles/:id", async (req, res) => {
    res.json(ok(await CasosDeUso.editar(await contexto(req), id(req), req.body)));
});

rutasRoles.delete("/roles/:id", async (req, res) => {
    res.json(ok(await CasosDeUso.borrar(await contexto(req), id(req))));
});
```

Montar `rutasRoles` donde se monta `rutasEquipo` (mismo `app.use`, mismo prefijo y middlewares de sesión).

- [ ] **Step 4: Equipo usa `rol_id`**

`api:src/modulos/equipo/esquemas.ts`:

```ts
const rolId = z.uuid({ error: "Elija un rol válido." });

export const cambioDeRol = z.object({ rol_id: rolId }, { error: "Falta el rol." });

export const aprobacion = z.object({ rol_id: rolId }, { error: "Elija un rol válido." });
```

`api:src/modulos/equipo/repositorio.ts`: `aprobar(id, rolId)` → `db.rpc("aprobar_solicitud", { p_id: id, p_rol: rolId })`; agregar `asignar(empleadoId: string, rolId: string): Promise<Resultado<null>>` → `db.rpc("asignar_rol", { p_empleado: empleadoId, p_rol: rolId })`; y que `empleados(negocioId)` traiga el nombre del rol: `.select("*, rol:rol_id (id, nombre, es_duenio)")`.

> El supabase falso no resuelve embebidos: si `pruebas/contrato` de equipo falla por eso, agregar en `pruebas/apoyo/supabase-falso.ts` el caso `rol:rol_id (…)` para `empleado` (buscando la fila en `mundo.filas.rol`) o, más simple, leer los roles aparte con `roles_del_negocio` y unirlos en el caso de uso.

`api:src/modulos/equipo/casos-de-uso.ts`:

```ts
export async function cambiarRol({ repo, quien }: Contexto, id: string, entrada: unknown) {
    if (!puede(quien, "manejar_roles")) throw SinPermiso("Su rol no incluye el permiso «Manejar roles».");
    if (!UUID.test(id)) throw EmpleadoNoEncontrado();
    const { rol_id } = Esquemas.cambioDeRol.parse(entrada ?? {});
    valor(await repo.asignar(id, rol_id));
    const empleado = (await repo.empleados(quien.negocioId)).find((e) => e.id === id);
    if (!empleado) throw EmpleadoNoEncontrado();
    return { empleado };
}

export async function aprobarPedido({ repo, quien }: Contexto, id: string, entrada: unknown) {
    const pedido = Esquemas.idDePedido.parse(id);
    const { rol_id } = Esquemas.aprobacion.parse(entrada ?? {});
    valor(await repo.aprobar(pedido, rol_id));
    return { empleados: await repo.empleados(quien.negocioId) };
}
```

(`actualizado_en` y `CHOQUE` dejan de usarse en `cambiarRol`: `asignar_rol` toma la ficha `for update`.) Actualizar `pruebas/casos-de-uso/clientes-y-equipo.test.ts` y `pruebas/contrato/equipo-por-link.test.ts` a `{ rol_id }`.

- [ ] **Step 5: Prueba de contrato**

`api:pruebas/contrato/roles.test.ts`, siguiendo `pruebas/contrato/equipo-por-link.test.ts` (mismo arranque de la app y del `mundo`): con `mundo.funciones.roles_del_negocio`, `guardar_rol` y `borrar_rol` a medida, probar:
- `GET /v1/roles` con una dueña → 200 `{ ok: true, datos: { roles: [...] } }`.
- `POST /v1/roles` con un encargado → 403 `sin_permiso` y `guardar_rol` no se llamó.
- `POST /v1/roles` con una dueña y `guardar_rol` que contesta `{ error: { code: "42501", message: "Solo se pueden otorgar permisos incluidos en el rol propio." } }` → 403 con ese mensaje.
- `DELETE /v1/roles/:id` con `borrar_rol` que contesta `{ error: { code: "P0001", message: "Rol asignado a 2 personas. Para eliminarlo, asigne otro rol a esas personas." } }` → 422 con ese mensaje.

- [ ] **Step 6: Correr todo**

Run: `npm run tipos && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "API de roles; Equipo asigna por rol_id"
```

### Task 10: La pantalla de roles y Equipo con roles

**Files:**
- Create: `front:src/app/negocio/roles/page.js` (lista)
- Create: `front:src/app/negocio/roles/[id]/page.js` (crear y editar; `id = "nuevo"` crea)
- Modify: `front:src/lib/datos.js` (roles, `cambiarRolEmpleado`, aprobar pedido)
- Modify: `front:src/app/negocio/page.js` (enlace a Roles)
- Modify: `front:src/app/equipo/page.js`, `front:src/componentes/SumarAlEquipo.js`
- Create: `front:pruebas/e2e/roles.e2e.js`

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /roles`, `PATCH /equipo/:id/rol { rol_id }`, `POST /equipo/pedidos/:id/aprobar { rol_id }` (Task 9); `PERMISOS`, `GRUPOS`, `puede`, `QUIEN_PUEDE`, `queCambiaConElRol` (Task 7).
- Produces en `useDatos()`: `roles` (array de `Rol`), `cargarRoles()`, `guardarRol({ id, nombre, permisos }) → Promise<{ ok, error? }>`, `borrarRol(id) → Promise<{ ok, error? }>`, `cambiarRolEmpleado(empleadoId, rolId)`.
- Produces en `lib/permisos.js`: `rolesQuePuedeDar(usuario, roles) → Rol[]`.

- [ ] **Step 1: Prueba de `rolesQuePuedeDar`**

Agregar a `front:pruebas/permisos.test.js`:

```js
import { rolesQuePuedeDar } from "../src/lib/permisos.js";

test("se ofrecen sólo los roles dentro de lo propio, y Dueño sólo a un Dueño", () => {
  const roles = [
    { id: "d", nombre: "Dueño", es_duenio: true, permisos: [] },
    { id: "c", nombre: "Caja", es_duenio: false, permisos: ["cobrar"] },
    { id: "e", nombre: "Encargado", es_duenio: false, permisos: ["cobrar", "crear_casos"] },
  ];
  const recepcion = { es_duenio: false, permisos: ["manejar_roles", "cobrar"] };
  assert.deepEqual(rolesQuePuedeDar(recepcion, roles).map((r) => r.id), ["c"]);
  assert.deepEqual(rolesQuePuedeDar({ es_duenio: true, permisos: [] }, roles).map((r) => r.id), ["d", "c", "e"]);
});
```

Run: `npm run test:unit -- pruebas/permisos.test.js` → FAIL. Agregar a `src/lib/permisos.js`:

```js
// Los roles que alguien puede dar: los que no tienen nada que su rol no tenga.
// El rol Dueño, sólo un Dueño. La base lo vuelve a controlar (056).
export function rolesQuePuedeDar(quien, roles) {
  const mios = new Set(efectivos(quien));
  return (roles ?? []).filter((r) =>
    r.es_duenio ? Boolean(quien?.es_duenio) : r.permisos.every((p) => mios.has(p))
  );
}
```

Run otra vez → PASS.

- [ ] **Step 2: `datos.js`**

Junto a `cambiarRolEmpleado` (cerca de la línea 934), con los mismos `enLaApi`, `traer`, `mandar`, `parchar` que usa el archivo (si no hay un `borrar`/DELETE, sumarlo al lado de `parchar` con la misma forma):

```js
      // ---------- roles (docs/roles.md) ----------
      // En modo de ejemplo no hay equipo al que dar roles: la pantalla lo dice.
      async cargarRoles() {
        const r = await enLaApi((token) => traer("/roles", token));
        if (r?.ok) setDatos((d) => ({ ...d, roles: r.datos.roles }));
        return r;
      },

      async guardarRol({ id, nombre, permisos }) {
        const r = await enLaApi((token) =>
          id ? parchar(`/roles/${id}`, { nombre, permisos }, token) : mandar("/roles", { nombre, permisos }, token)
        );
        if (r?.ok) setDatos((d) => ({ ...d, roles: r.datos.roles }));
        return r;
      },

      async borrarRol(id) {
        const r = await enLaApi((token) => borrar(`/roles/${id}`, token));
        if (r?.ok) setDatos((d) => ({ ...d, roles: r.datos.roles }));
        return r;
      },
```

> Si `enLaApi` no devuelve el resultado (mirar su definición en `datos.js`), usar directamente el helper que usan las otras funciones `async` del archivo que esperan respuesta, como `cambiarLink` o `aprobarPedido`.

`cambiarRolEmpleado(empleadoId, rolId)`: cambiar el cuerpo del `parchar` a `{ rol_id: rolId }`, y la actualización optimista a `rol_id: rolId`. El pedido de aprobación (buscar `/equipo/pedidos/` en `datos.js`) manda `{ rol_id }`.

- [ ] **Step 3: Pantalla de lista `app/negocio/roles/page.js`**

```js
"use client";

// Roles (docs/roles.md). La lista de roles del negocio: cuántas personas tiene
// cada uno y, al tocarlo, sus permisos. El rol Dueño va primero y no se edita.

import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import Icono from "@/componentes/Icono";
import { Cargando, Tarjeta, TituloPantalla, Vacio } from "@/componentes/ui";

export default function Roles() {
  const datos = useDatos();
  const { usuario, hayCuentas } = useAuth();
  useTitulo("Roles");
  const puedeManejar = puede(usuario, "manejar_roles");

  useEffect(() => {
    if (hayCuentas) datos.cargarRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayCuentas]);

  if (!hayCuentas) {
    return (
      <>
        <Volver />
        <TituloPantalla>Roles</TituloPantalla>
        <Vacio icono="candado" titulo="Requiere una cuenta">
          Los roles se asignan a personas del equipo, y sumar personas requiere una cuenta.
        </Vacio>
      </>
    );
  }
  if (!datos.roles) return <Cargando />;

  return (
    <>
      <Volver />
      <TituloPantalla apoyo="Qué puede hacer cada persona del equipo.">Roles</TituloPantalla>

      {puedeManejar ? (
        <Link
          href="/negocio/roles/nuevo"
          className="mb-8 inline-flex min-h-12 items-center gap-2 rounded-campo bg-azul px-6 font-bold text-white"
        >
          <Icono nombre="mas" />
          Crear un rol
        </Link>
      ) : (
        <p className="mb-8 text-tinta-media">{QUIEN_PUEDE.manejar_roles}</p>
      )}

      <ul className="grid gap-4">
        {datos.roles.map((r) => (
          <li key={r.id}>
            <Link href={`/negocio/roles/${r.id}`} className="block min-h-12">
              <Tarjeta className="flex items-center justify-between gap-4">
                <span>
                  <span className="block font-bold">{r.nombre}</span>
                  <span className="block text-tinta-media">
                    {r.es_duenio ? "Tiene todos los permisos" : `${r.permisos.length} permisos`}
                    {" · "}
                    {r.personas === 1 ? "1 persona" : `${r.personas} personas`}
                  </span>
                </span>
                <Icono nombre={r.es_duenio ? "candado" : "siguiente"} />
              </Tarjeta>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Volver() {
  return (
    <Link href="/negocio" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
      <Icono nombre="volver" />
      Volver a Mi negocio
    </Link>
  );
}
```

> `hayCuentas` sale de `useAuth()` (está en `AuthProvider`); si no se expone, exponerlo en el `value` del provider. Los nombres de íconos (`candado`, `mas`, `siguiente`, `volver`) tienen que existir en `componentes/Icono.js`: usar los que haya con ese sentido y agregar el que falte como SVG inline, como los demás.

- [ ] **Step 4: Pantalla de un rol `app/negocio/roles/[id]/page.js`**

```js
"use client";

// Un rol: su nombre y sus permisos, agrupados como en el catálogo. Un permiso
// que el rol propio no tiene se muestra apagado y dice por qué (cartilla:
// un control apagado explica el motivo). La base vuelve a controlar todo (056).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { GRUPOS, PERMISOS, puede, QUIEN_PUEDE } from "@/lib/permisos";
import Icono from "@/componentes/Icono";
import { Boton, BotonPrincipalFijo, Campo, Cargando, ErrorGeneral, Interruptor, TituloPantalla, TituloSeccion } from "@/componentes/ui";

export default function EditarRol() {
  const { id } = useParams();
  const router = useRouter();
  const datos = useDatos();
  const { usuario } = useAuth();
  const nuevo = id === "nuevo";
  const rol = nuevo ? null : datos.roles?.find((r) => r.id === id);
  useTitulo(nuevo ? "Crear un rol" : rol?.nombre ?? "Rol");

  const [nombre, setNombre] = useState("");
  const [permisos, setPermisos] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!datos.roles) datos.cargarRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (rol) {
      setNombre(rol.nombre);
      setPermisos(rol.permisos);
    }
  }, [rol]);

  if (!nuevo && !rol) return <Cargando />;

  const esPropio = !nuevo && rol.id === usuario?.rol_id;
  const soloLectura = !puede(usuario, "manejar_roles") || rol?.es_duenio || esPropio;
  const motivoGeneral = rol?.es_duenio
    ? "El rol Dueño no se modifica."
    : esPropio
      ? "El rol propio no se modifica."
      : !puede(usuario, "manejar_roles")
        ? QUIEN_PUEDE.manejar_roles
        : null;

  const alternar = (clave, prendido) =>
    setPermisos((l) => (prendido ? [...l, clave] : l.filter((c) => c !== clave)));

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await datos.guardarRol({ id: nuevo ? null : id, nombre, permisos });
    setGuardando(false);
    if (r?.ok) router.push("/negocio/roles");
    else setError(r?.error?.mensaje ?? "No se pudo guardar el rol.");
  }

  async function eliminar() {
    setError(null);
    const r = await datos.borrarRol(id);
    if (r?.ok) router.push("/negocio/roles");
    else setError(r?.error?.mensaje ?? "No se pudo eliminar el rol.");
  }

  return (
    <>
      <Link href="/negocio/roles" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
        <Icono nombre="volver" />
        Volver a Roles
      </Link>

      <TituloPantalla apoyo={motivoGeneral ?? "Active los permisos que corresponden a este rol."}>
        {nuevo ? "Crear un rol" : rol.nombre}
      </TituloPantalla>

      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      {nuevo && !soloLectura && (
        <div className="mb-6">
          <label htmlFor="copiar-de" className="block font-bold text-cuerpo">Copiar los permisos de otro rol</label>
          <select
            id="copiar-de"
            className="mt-2 min-h-12 w-full rounded-campo border-2 border-borde bg-tarjeta px-4"
            defaultValue=""
            onChange={(e) => {
              const origen = datos.roles?.find((r) => r.id === e.target.value);
              // Sólo los que se pueden dar: copiar el Dueño trae los propios.
              if (origen) setPermisos(origen.permisos.filter((c) => puede(usuario, c)));
            }}
          >
            <option value="">Empezar sin permisos</option>
            {datos.roles?.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {!soloLectura && (
        <Campo
          id="nombre-del-rol"
          etiqueta="Nombre del rol"
          ejemplo="Recepción"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
        />
      )}

      {GRUPOS.map((grupo) => (
        <section key={grupo} className="mb-8">
          <TituloSeccion>{grupo}</TituloSeccion>
          <ul className="grid gap-2">
            {PERMISOS.filter((p) => p.grupo === grupo).map((p) => (
              <li key={p.clave}>
                <Interruptor
                  prendido={rol?.es_duenio || permisos.includes(p.clave)}
                  onChange={(v) => alternar(p.clave, v)}
                  ayuda={p.descripcion}
                  palabras={["Desactivado", "Activado"]}
                  disabled={soloLectura}
                  motivo={!soloLectura && !puede(usuario, p.clave) ? "Este permiso no está incluido en su rol" : null}
                >
                  {p.nombre}
                </Interruptor>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!soloLectura && (
        <>
          {!nuevo && (
            <Boton icono="borrar" onClick={eliminar} className="mb-8">
              Eliminar el rol
            </Boton>
          )}
          <BotonPrincipalFijo
            onClick={guardar}
            disabled={guardando}
            motivo={!nombre.trim() ? "falta el nombre" : null}
          >
            {guardando ? "Guardando" : "Guardar el rol"}
          </BotonPrincipalFijo>
        </>
      )}
    </>
  );
}
```

> El campo de error de la API que trae el mensaje (`r.error.mensaje`) es el que usa el resto de `datos.js`; si se llama distinto (`motivo`, `message`), usar ese.

- [ ] **Step 5: Mi negocio enlaza a Roles**

En `app/negocio/page.js`, donde están los enlaces a "Módulos" y "Equipo", agregar uno igual a `/negocio/roles` con el texto "Roles" y el apoyo "Qué puede hacer cada persona del equipo". Visible para todos los miembros (la lista se puede mirar; sólo se edita con `manejar_roles`).

- [ ] **Step 6: Equipo con roles**

En `app/equipo/page.js`:
- Cargar los roles al entrar (`datos.cargarRoles()` en un `useEffect`, como en la lista).
- El desplegable de rol (línea 133) lista `rolesQuePuedeDar(usuario, datos.roles)` con `value={r.id}` y texto `r.nombre`, y su `value` es `e.rol_id`. Para la ficha propia y la del creador del negocio, el desplegable no se ofrece: se muestra el nombre del rol.
- Donde se muestra el rol (línea 172), `datos.roles?.find((r) => r.id === e.rol_id)?.nombre`.
- La confirmación (línea 299): `queCambiaConElRol(rolDe(persona.rol_id), rolDe(nuevo))` con `rolDe = (id) => datos.roles?.find((r) => r.id === id)`. Los títulos de las dos listas: "Permisos que se agregan" y "Permisos que se quitan". El mensaje de listo (línea 162): `` `${e.nombre} tiene ahora el rol ${rolDe(cambiandoRol.rol).nombre}.` ``.
- `puedeManejar` (línea 36) pasa a `puede(usuario, "manejar_roles")` para el desplegable y `puede(usuario, "sacar_del_equipo")` para "Sacar del equipo".

En `componentes/SumarAlEquipo.js:79`: `const roles = rolesQuePuedeDar(usuario, datos.roles);` y el selector de rol de la aprobación manda `rol_id`.

- [ ] **Step 7: Prueba E2E**

`front:pruebas/e2e/roles.e2e.js`, siguiendo `pruebas/e2e/crear-negocio.e2e.js` (misma siembra y mismo inicio de sesión que ese archivo):

```js
// Crear un rol y ver que existe con sus permisos.

describe("roles", () => {
  it("la dueña crea un rol con un permiso y lo ve en la lista", async () => {
    // (inicio de sesión como en crear-negocio.e2e.js)
    await browser.url("/negocio/roles");
    await $("a=Crear un rol").click();
    await $("#nombre-del-rol").setValue("Caja");
    await $('button[role="switch"]*=Cobrar').click();
    await $("button*=Guardar el rol").click();
    await expect($("span=Caja")).toBeDisplayed();
    await expect($("span*=1 permisos")).toBeDisplayed();
  });
});
```

> "1 permisos" es el texto de la lista para un rol con un solo permiso: corregir la lista a "1 permiso" (singular) y la prueba con él.

Run: `npm run test:e2e`
Expected: PASS (requiere la API y la base con 053-056).

- [ ] **Step 8: Correr todo y probar a mano**

Run: `npm run test:unit`
Expected: PASS.

A mano: crear "Recepción" con `manejar_roles` y `cobrar`, asignársela a alguien desde Equipo (ver la confirmación con "Permisos que se agregan / que se quitan"), entrar con esa persona y ver que en Roles los permisos que no tiene aparecen apagados con "Este permiso no está incluido en su rol".

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Pantalla de roles; Equipo asigna roles del negocio"
```

---

# Etapa 4 — Visitas entre sedes vinculadas

### Task 11: La base deja entrar de visita

**Files:**
- Create: `front:supabase/057_visitas_entre_sedes.sql`
- Modify: `front:supabase/pruebas/roles.sql` (sección 12)

**Interfaces:**
- Consumes: `permisos_efectivos` (Task 2), `negocio.red` (047), `vincular_sedes` (047, para armar la red en la prueba).
- Produces:
  - `usuario.visitando_desde uuid references negocio (id) on delete set null`
  - `permisos_efectivos(p_negocio)` v2: si no hay ficha y se está de visita, los permisos de mirar del rol de origen.
  - `entrar_de_visita(p_sede uuid) returns void`
  - `entrar_al_negocio(p_negocio uuid)` v3: limpia `visitando_desde`.
  - `sedes_que_veo() returns table (id uuid, nombre text, rubro text, foto text, soy_miembro boolean)`

- [ ] **Step 1: Escribir la prueba (sección 12)**

```sql
    -- ---- 12. Visitas entre sedes ----
    -- Ana crea la sede B y la vincula con A (vincular_sede, 047, desde el
    -- negocio activo). Ivo es miembro sólo de A.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_b := crear_mi_negocio('Roles B', 'taller', '[]'::jsonb);
    perform entrar_al_negocio(neg_a);
    perform vincular_sede(neg_b);
    perform set_config('role', 'postgres', true);
    insert into cliente (negocio_id, nombre) values (neg_b, 'Cliente de B');
    perform set_config('role', 'authenticated', true);

    -- Sin ver_sedes_vinculadas, Ivo no ve B y no entra.
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    select count(*) into n from sedes_que_veo() where id = neg_b;
    if n <> 0 then raise exception 'FALLÓ 12: sin el permiso, Ivo ve la sede B.'; end if;
    frenado := false;
    begin perform entrar_de_visita(neg_b); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 12: sin el permiso, Ivo entró de visita.'; end if;

    -- Con el permiso (la dueña le suma ver_sedes_vinculadas a Mecánico), la ve y entra.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    perform guardar_rol((select id from rol where negocio_id = neg_a and nombre = 'Mecánico'), 'Mecánico',
      permisos_de_clave('tecnico') || array['ver_sedes_vinculadas']);
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select count(*) into n from sedes_que_veo() where id = neg_b and not soy_miembro;
    if n <> 1 then raise exception 'FALLÓ 12: con el permiso, Ivo no ve la sede B como visita.'; end if;
    perform entrar_de_visita(neg_b);

    -- De visita: ve lo que su rol ve en A (clientes sí; casos ajenos no) y no escribe nada.
    select count(*) into n from cliente where nombre = 'Cliente de B';
    if n <> 1 then raise exception 'FALLÓ 12: de visita, Ivo no ve los clientes de B.'; end if;
    if puede_aca('editar_clientes') or puede_aca('ver_todos_los_casos') then
      raise exception 'FALLÓ 12: de visita, Ivo tiene permisos que no son de mirar o que no tiene en A.';
    end if;
    frenado := false;
    begin insert into cliente (negocio_id, nombre) values (neg_b, 'X');
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 12: de visita, Ivo cargó un cliente.'; end if;
    select count(*) into n from cobro;
    if n <> 0 then raise exception 'FALLÓ 12: de visita, Ivo ve cobros.'; end if;
    select count(*) into n from ecuacion;
    if n <> 0 then raise exception 'FALLÓ 12: de visita, Ivo ve ecuaciones.'; end if;

    -- Tampoco por una función security definer: un paso aprobado de un caso
    -- de B sin responsable (ahí mi_empleado() y responsable_id son null).
    perform set_config('role', 'postgres', true);
    insert into caso (negocio_id, numero, servicio) values (neg_b, 903, 'Sin responsable');
    insert into paso (caso_id, nombre, estado) select id, 'De B', 'aprobado' from caso where numero = 903;
    select id into pedido from paso where nombre = 'De B';
    perform set_config('role', 'authenticated', true);
    select * into fila from jsonb_to_record(marcar_paso_hecho(pedido, true)) as x(ok boolean);
    if fila.ok then raise exception 'FALLÓ 12: de visita, Ivo marcó un paso hecho.'; end if;

    -- Volver a su sede limpia la visita.
    perform entrar_al_negocio(neg_a);
    perform set_config('role', 'postgres', true);
    select count(*) into n from usuario where id = ivo and visitando_desde is not null;
    perform set_config('role', 'authenticated', true);
    if n <> 0 then raise exception 'FALLÓ 12: volver a su sede no limpió la visita.'; end if;
```

(Agregar `neg_b uuid;` al `declare`.)

- [ ] **Step 2: Correr y ver que falla**

Expected: `function sedes_que_veo() does not exist`.

- [ ] **Step 3: Escribir `057_visitas_entre_sedes.sql`**

```sql
-- ============================================================
-- 057_visitas_entre_sedes.sql — entrar a mirar una sede vinculada
--
-- Correr entero en el SQL Editor de Supabase, después de la 056.
-- Es idempotente. Después, correr supabase/pruebas/roles.sql.
--
-- Quien es miembro de una sede y su rol tiene ver_sedes_vinculadas puede
-- entrar a las otras sedes de la red donde no es miembro, sólo a mirar: de
-- los permisos de mirar, los que su rol ya tiene en su sede. Sin el permiso,
-- las otras sedes no aparecen en ningún lado (docs/roles.md, "Visitas").
--
-- Ninguna política cambia: todo pasa por permisos_efectivos(). Las tablas sin
-- un permiso de mirar propio (cobro, ecuacion, invitacion) ya piden ficha
-- desde la 054.
-- ============================================================

-- Como el resto de usuario desde la 035: no se escribe desde el navegador.
alter table usuario add column if not exists visitando_desde uuid references negocio (id) on delete set null;

-- ------------------------------------------------------------
-- 1. Los permisos de quien está de visita
-- ------------------------------------------------------------
create or replace function permisos_efectivos(p_negocio uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- Miembro: los de su rol (053).
    (select case when r.es_duenio then permisos_conocidos() else r.permisos end
       from empleado e
       join rol r on r.id = e.rol_id
      where e.negocio_id = p_negocio
        and e.usuario_id = auth.uid()
      limit 1),
    -- De visita: de los de mirar, los que su rol tiene en la sede de origen.
    (select array(
              select x from unnest(case when r.es_duenio then permisos_conocidos() else r.permisos end) x
               where x = any(permisos_de_mirar())
            )
       from usuario u
       join negocio aca on aca.id = p_negocio
       join negocio origen on origen.id = u.visitando_desde
       join empleado e on e.negocio_id = origen.id and e.usuario_id = u.id
       join rol r on r.id = e.rol_id
      where u.id = auth.uid()
        and u.negocio_id = p_negocio
        and aca.red is not null
        and aca.red = origen.red
        and (r.es_duenio or 'ver_sedes_vinculadas' = any(r.permisos))),
    '{}'::text[]
  );
$$;

-- ------------------------------------------------------------
-- 2. Qué sedes ve cada uno
-- ------------------------------------------------------------
-- Las de su red donde es miembro, y las demás de esa red si su rol en la sede
-- de origen tiene ver_sedes_vinculadas. La sede de origen es la activa, o
-- de la que salió si está de visita.
create or replace function sedes_que_veo()
returns table (id uuid, nombre text, rubro text, foto text, soy_miembro boolean)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select coalesce(u.visitando_desde, u.negocio_id) as origen from usuario u where u.id = auth.uid()
  ),
  red as (
    select n.red,
           exists (
             select 1 from empleado e join rol r on r.id = e.rol_id
              where e.negocio_id = n.id and e.usuario_id = auth.uid()
                and (r.es_duenio or 'ver_sedes_vinculadas' = any(r.permisos))
           ) as puede_ver
      from negocio n join yo on n.id = yo.origen
     where n.red is not null
  )
  select n.id, n.nombre, n.rubro, n.foto,
         exists (select 1 from empleado e where e.negocio_id = n.id and e.usuario_id = auth.uid())
    from negocio n
    join red on n.red = red.red
   where red.puede_ver
      or exists (select 1 from empleado e where e.negocio_id = n.id and e.usuario_id = auth.uid())
   order by n.nombre;
$$;

revoke all on function sedes_que_veo() from public;
revoke all on function sedes_que_veo() from anon;
grant execute on function sedes_que_veo() to authenticated;

-- ------------------------------------------------------------
-- 3. Entrar de visita
-- ------------------------------------------------------------
create or replace function entrar_de_visita(p_sede uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  origen uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;
  select coalesce(visitando_desde, negocio_id) into origen from usuario where id = auth.uid();

  if exists (select 1 from empleado where negocio_id = p_sede and usuario_id = auth.uid()) then
    raise exception 'Ya es miembro de esa sede: se entra desde el selector de negocios.';
  end if;
  if not exists (select 1 from sedes_que_veo() s where s.id = p_sede and not s.soy_miembro) then
    raise exception 'Su rol no incluye el permiso «Ver las sedes vinculadas».' using errcode = '42501';
  end if;

  update usuario set negocio_id = p_sede, visitando_desde = origen where id = auth.uid();
end;
$$;

revoke all on function entrar_de_visita(uuid) from public;
revoke all on function entrar_de_visita(uuid) from anon;
grant execute on function entrar_de_visita(uuid) to authenticated;
```

Después, `entrar_al_negocio`: copiar entera la definición de `038_multinegocio.sql:211-238` y cambiar sólo el `update` final a:

```sql
  update usuario
     set negocio_id      = p_negocio,
         rol             = su_rol,
         visitando_desde = null
   where id = auth.uid();
```

- [ ] **Step 4: Correr la migración y todas las pruebas SQL**

Expected: todas "Success. No rows returned".

- [ ] **Step 5: Commit**

```bash
git add supabase/057_visitas_entre_sedes.sql supabase/pruebas/roles.sql
git commit -m "Visitas de sólo lectura entre sedes vinculadas (057)"
```

### Task 12: API y front de las visitas

**Files:**
- Modify: `api:src/modulos/sedes/{repositorio,casos-de-uso,rutas}.ts`
- Modify: `api:src/compartido/quien-soy.ts` (`visitando`)
- Create: `api:pruebas/contrato/visitas.test.ts`
- Create: `front:src/componentes/FranjaDeVisita.js`
- Modify: `front:src/app/layout.js` (o el marco que envuelve las pantallas con sesión: buscar dónde se monta `Navegacion`)
- Modify: `front:src/componentes/SedesVinculadas.js`, `front:src/lib/datos.js`, `front:src/lib/sedes.js`

**Interfaces:**
- Consumes: `sedes_que_veo()`, `entrar_de_visita(uuid)` (Task 11); `usuario.visitando_desde` (viene solo en `GET /cuenta`, que hace `select *`).
- Produces:
  - `GET /sedes` usa `sedes_que_veo()` → `{ sedes: { id, nombre, rubro, foto, soy_miembro }[] }`
  - `POST /sedes/:id/visita` → `{ ok, datos: { negocio_id } }`
  - `Quien.visitando: boolean`
  - `<FranjaDeVisita />`: se muestra si `usuario.visitando_desde`.

- [ ] **Step 1: Prueba de contrato**

`api:pruebas/contrato/visitas.test.ts`, con el arranque de `pruebas/contrato/sedes.test.ts`:
- `GET /v1/sedes` con `mundo.funciones.sedes_que_veo` que devuelve una sede propia y una ajena → 200 con las dos y su `soy_miembro`.
- `POST /v1/sedes/:id/visita` con `entrar_de_visita` que contesta `{ error: { code: "42501", message: "Su rol no incluye el permiso «Ver las sedes vinculadas»." } }` → 403 con ese mensaje.
- `POST /v1/sedes/:id/visita` con `entrar_de_visita` que contesta `{ data: null }` → 200 `{ ok: true, datos: { negocio_id: <id> } }`.
- `POST /v1/sedes/no-uuid/visita` → 404 y la función no se llamó.

Run: `npm run test:pruebas` → FAIL (ruta inexistente).

- [ ] **Step 2: Implementar**

En `sedes/repositorio.ts`: donde hoy se llama `mis_sedes` para listar, llamar `sedes_que_veo`; agregar `visitar(id)` → `db.rpc("entrar_de_visita", { p_sede: id })` con el mismo `Resultado` del archivo. En `sedes/casos-de-uso.ts`: `visitar(ctx, id)` valida uuid (404 si no), llama `valor(await repo.visitar(id))` y devuelve `{ negocio_id: id }`. En `sedes/rutas.ts`: `rutasSedes.post("/sedes/:id/visita", …)` como las demás.

En `quien-soy.ts`: leer también `visitando_desde` en el `select` de `usuario` y devolver `visitando: Boolean(data.visitando_desde)`. En `afirmar.quien` y `quienCon`, `visitando: false`.

Run: `npm run tipos && npm test` → PASS.

- [ ] **Step 3: Front — la franja**

`front:src/componentes/FranjaDeVisita.js`:

```js
"use client";

// Arriba de todo mientras se mira una sede vinculada sin ser miembro
// (docs/roles.md, "Visitas"). Dice dónde se está, que no se puede cambiar
// nada, y cómo volver. Estado con color, ícono y palabra (cartilla).

import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import Icono from "@/componentes/Icono";

export default function FranjaDeVisita() {
  const { usuario, entrarAlNegocio } = useAuth();
  const { negocio, sedes } = useDatos();
  if (!usuario?.visitando_desde) return null;

  const origen = sedes?.find((s) => s.id === usuario.visitando_desde);

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-l-4 border-espera bg-espera-fondo px-4 py-3 text-espera">
      <Icono nombre="ojo" />
      <span className="font-bold">{negocio?.nombre} · Solo lectura</span>
      <button
        type="button"
        onClick={() => entrarAlNegocio(usuario.visitando_desde)}
        className="ml-auto min-h-12 font-bold underline"
      >
        Volver a {origen?.nombre ?? "la sede propia"}
      </button>
    </div>
  );
}
```

> `entrarAlNegocio` es la función con la que hoy el selector de negocios cambia de negocio (buscar `/cuenta/negocio` en `lib/auth.js`): usar esa, con su nombre real. `sedes` es la lista que ya carga `SedesVinculadas` (`datos.js`); si no está en `useDatos()`, sumarla ahí. Las clases `border-espera`, `bg-espera-fondo` y `text-espera` son las de la `Banda` de `docs/multinegocio-plan.md:1831`.

Montar `<FranjaDeVisita />` arriba del contenido en el marco de las pantallas con sesión (el mismo archivo que monta `Navegacion`).

- [ ] **Step 4: Front — la lista de sedes**

En `componentes/SedesVinculadas.js`: las sedes con `soy_miembro` se muestran como hoy; las demás (sólo llegan si el rol tiene el permiso) llevan la marca "Solo lectura" (ícono `ojo` + palabra) y un botón "Ver la sede" que llama a `datos.visitarSede(id)`:

```js
      // En datos.js, junto a las demás funciones de sedes:
      async visitarSede(id) {
        const r = await enLaApi((token) => mandar(`/sedes/${id}/visita`, {}, token));
        if (r?.ok) window.location.assign("/");
        return r;
      },
```

(Se recarga la aplicación entera, como al cambiar de negocio en el selector: todos los datos son de la otra sede.)

En `lib/sedes.js:37`, el filtro de "sedes que se pueden vincular" sigue usando sólo las de `mis_negocios` (miembro); no cambia.

- [ ] **Step 5: Probar a mano**

Con dos sedes vinculadas (`Mi negocio → Sedes`), una persona miembro sólo de una y con un rol con `ver_sedes_vinculadas` y `ver_clientes`: ve la otra sede con "Solo lectura", entra, ve la franja, ve los clientes, no ve botones de cargar, y "Volver a …" la devuelve. Sin el permiso, la otra sede no aparece.

- [ ] **Step 6: Commit (en cada repo)**

```bash
git add -A
git commit -m "Visitas de sólo lectura a sedes vinculadas"
```

---

# Etapa 5 — Borrar el negocio y limpieza

### Task 13: Borrar el negocio

**Files:**
- Create: `front:supabase/058_borrar_negocio.sql`
- Modify: `front:supabase/pruebas/roles.sql` (sección 13)
- Modify: `api:src/modulos/negocio/{repositorio,casos-de-uso,rutas,esquemas,errores}.ts`
- Create: `front:src/componentes/BorrarNegocio.js`
- Modify: `front:src/app/negocio/page.js`, `front:src/lib/datos.js`

**Interfaces:**
- Produces:
  - `borrar_negocio(p_negocio uuid, p_nombre text) returns void`
  - `quitar_acceso_al_sacar()` v4: no frena cuando lo dispara `borrar_negocio`.
  - `DELETE /negocio` `{ nombre }` → `{ ok, datos: { borrado: true } }`
  - `datos.borrarNegocio(nombre) → Promise<{ ok, error? }>`

- [ ] **Step 1: Escribir la prueba (sección 13)**

```sql
    -- ---- 13. Borrar el negocio ----
    perform set_config('role', 'authenticated', true);

    -- Edu (no es el creador) no lo borra, aunque fuera Dueño.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Edu'),
                        (select id from rol where negocio_id = neg_a and es_duenio));
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    frenado := false;
    begin perform borrar_negocio(neg_a, 'Roles A'); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 13: un Dueño que no lo creó borró el negocio.'; end if;

    -- Ana, con el nombre mal escrito, tampoco.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform borrar_negocio(neg_a, 'Roles');
    exception when raise_exception then frenado := (sqlerrm = 'El nombre escrito no coincide con el del negocio.'); end;
    if not frenado then raise exception 'FALLÓ 13: se borró con el nombre mal escrito.'; end if;

    -- Con el nombre bien, se borra con todo adentro (fichas, roles, casos).
    perform borrar_negocio(neg_a, 'Roles A');
    perform set_config('role', 'postgres', true);
    select count(*) into n from negocio where id = neg_a;
    if n <> 0 then raise exception 'FALLÓ 13: el negocio sigue.'; end if;
    select count(*) into n from rol where negocio_id = neg_a;
    if n <> 0 then raise exception 'FALLÓ 13: quedaron % roles.', n; end if;
    select count(*) into n from usuario where id in (ana, edu, ivo, zoe) and (negocio_id = neg_a or visitando_desde = neg_a);
    if n <> 0 then raise exception 'FALLÓ 13: quedaron % cuentas paradas en el negocio borrado.', n; end if;
    perform set_config('role', 'authenticated', true);
```

Run → FAIL (`function borrar_negocio does not exist`).

- [ ] **Step 2: Escribir `058_borrar_negocio.sql`**

```sql
-- ============================================================
-- 058_borrar_negocio.sql — quien creó el negocio lo puede borrar
--
-- Correr entero en el SQL Editor de Supabase, después de la 057.
-- Es idempotente.
--
-- Sólo quien lo creó (negocio.creado_por, 038), escribiendo el nombre del
-- negocio para confirmar. Se borra en cascada: fichas, roles, casos, todo. Las
-- cuentas del equipo quedan; si estaban paradas en este negocio, pasan a su
-- predeterminado o a ninguno.
-- ============================================================

-- quitar_acceso_al_sacar (036, 038) frena que alguien se saque a sí mismo y
-- que saquen al creador. Al borrar el negocio entero, sus fichas se borran
-- en cascada y las dos cosas pasan a propósito: borrar_negocio() lo avisa
-- con una variable de la transacción. Es la definición de la 038 tal cual,
-- con ese chequeo al principio.
-- <AQUÍ: la función quitar_acceso_al_sacar, ver el paso de abajo>

create or replace function borrar_negocio(p_negocio uuid, p_nombre text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n negocio%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;
  select * into n from negocio where id = p_negocio;
  if not found then
    raise exception 'Ese negocio ya no existe.';
  end if;
  if n.creado_por is distinct from auth.uid() then
    raise exception 'Solo quien creó el negocio puede eliminarlo.' using errcode = '42501';
  end if;
  if trim(coalesce(p_nombre, '')) is distinct from trim(n.nombre) then
    raise exception 'El nombre escrito no coincide con el del negocio.';
  end if;

  -- Nadie queda parado en un negocio que no existe.
  update usuario
     set negocio_id = case
           when negocio_id = p_negocio then nullif(negocio_predeterminado, p_negocio)
           else negocio_id
         end,
         visitando_desde = case when visitando_desde = p_negocio then null else visitando_desde end,
         negocio_predeterminado = nullif(negocio_predeterminado, p_negocio)
   where negocio_id = p_negocio or visitando_desde = p_negocio or negocio_predeterminado = p_negocio;

  perform set_config('roles.borrando_negocio', p_negocio::text, true);
  delete from negocio where id = p_negocio;
  perform set_config('roles.borrando_negocio', '', true);
end;
$$;

revoke all on function borrar_negocio(uuid, text) from public;
revoke all on function borrar_negocio(uuid, text) from anon;
grant execute on function borrar_negocio(uuid, text) to authenticated;
```

En el lugar marcado `<AQUÍ: …>`, copiar entera `quitar_acceso_al_sacar` desde `038_multinegocio.sql:438-476` y agregarle, justo después del primer `if old.usuario_id is null then … return old; end if;`:

```sql
  -- borrar_negocio() (058) borra todas las fichas a propósito, la del
  -- creador y la propia incluidas.
  if current_setting('roles.borrando_negocio', true) = old.negocio_id::text then
    return old;
  end if;
```

> El `nullif(negocio_predeterminado, p_negocio)` del primer `case` deja a la cuenta en su predeterminado si es otro. Si ese predeterminado es un negocio donde ya no tiene ficha, `entrar_al_negocio` lo vuelve a resolver al iniciar sesión, como hoy.
> Si la 058 falla con `update or delete on table "rol" violates foreign key constraint` al borrar, es que `empleado.rol_id` quedó con `on delete restrict`: la 053 lo crea sin acción (`no action`), que se controla al final del comando. Verificar con `select confdeltype from pg_constraint where conname like 'empleado_rol_id%'` (tiene que dar `a`).

Run: migración y prueba → "Success. No rows returned".

- [ ] **Step 3: API**

`negocio/esquemas.ts`: `export const borrado = z.object({ nombre: z.string({ error: "Escriba el nombre del negocio." }) });`
`negocio/repositorio.ts`: `borrar(id, nombre)` → `db.rpc("borrar_negocio", { p_negocio: id, p_nombre: nombre })` con el `Resultado` del archivo.
`negocio/casos-de-uso.ts`:

```ts
// Borrar el negocio: sólo quien lo creó. No es un permiso; lo decide la base
// (058) mirando negocio.creado_por.
export async function borrar({ repo, quien }: Contexto, entrada: unknown) {
    const { nombre } = Esquemas.borrado.parse(entrada ?? {});
    valor(await repo.borrar(quien.negocioId, nombre));
    return { borrado: true };
}
```

(usando el traductor de errores de la base que ya use ese módulo). `negocio/rutas.ts`: `rutasNegocio.delete("/negocio", …)`.

Prueba de contrato en `pruebas/contrato/` (archivo de negocio existente): `DELETE /v1/negocio` con `borrar_negocio` que contesta 42501 → 403; con `data: null` → 200 `{ borrado: true }`.

Run: `npm run tipos && npm test` → PASS.

- [ ] **Step 4: Front**

`front:src/componentes/BorrarNegocio.js`:

```js
"use client";

// Eliminar el negocio (docs/roles.md). Sólo lo ve quien lo creó. Pide escribir
// el nombre del negocio: es irreversible y borra todo lo cargado.

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { Boton, Campo, ErrorGeneral, Tarjeta, TituloSeccion } from "@/componentes/ui";

export default function BorrarNegocio() {
  const { usuario } = useAuth();
  const datos = useDatos();
  const { negocio } = datos;
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState(null);

  if (!negocio || negocio.creado_por !== usuario?.id) return null;

  async function borrar() {
    setError(null);
    const r = await datos.borrarNegocio(nombre);
    if (r?.ok) window.location.assign("/");
    else setError(r?.error?.mensaje ?? "No se pudo eliminar el negocio.");
  }

  return (
    <Tarjeta className="mt-12 border-error">
      <TituloSeccion>Eliminar el negocio</TituloSeccion>
      <p className="mb-4 text-tinta-media">
        Se eliminan el negocio y todo lo cargado: casos, clientes, agenda, inventario, cobros y equipo. No se puede deshacer.
      </p>
      {!abierto ? (
        <Boton icono="borrar" onClick={() => setAbierto(true)}>Eliminar el negocio</Boton>
      ) : (
        <>
          {error && <ErrorGeneral>{error}</ErrorGeneral>}
          <Campo
            id="confirmar-nombre"
            etiqueta={`Para confirmar, escriba «${negocio.nombre}»`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Boton icono="borrar" onClick={borrar} motivo={nombre.trim() !== negocio.nombre.trim() ? "el nombre no coincide" : null}>
            Eliminar definitivamente
          </Boton>
        </>
      )}
    </Tarjeta>
  );
}
```

> `negocio.creado_por` llega con la fila del negocio (si `datos.js` no lo trae, agregarlo a la lectura). `border-error` es el token de color de error de `globals.css`: usar el que exista con ese sentido.

`datos.js`: `async borrarNegocio(nombre) { return enLaApi((token) => borrar("/negocio", token, { nombre })); }` (con el helper de DELETE de la Tarea 10, aceptando cuerpo). En modo de ejemplo, `borrarNegocio` borra el estado local y vuelve a la semilla vacía, igual que "Salir del modo de ejemplo".

Montar `<BorrarNegocio />` al final de `app/negocio/page.js`.

- [ ] **Step 5: Commit (en cada repo)**

```bash
git add -A
git commit -m "Quien creó el negocio lo puede eliminar (058)"
```

### Task 14: Limpieza del rol viejo

**Files:**
- Create: `front:supabase/059_roles_limpieza.sql`
- Modify: `front:supabase/pruebas/roles.sql` (secciones 1 y 14), `front:supabase/pruebas/*.sql` que lean `empleado.rol` o `usuario.rol`
- Modify: `api:src/modulos/semilla/casos-de-uso.ts`, `api:src/lib/database.types.ts`, `api:pruebas/apoyo/supabase-falso.ts`
- Modify: `front:src/lib/presets.js`, `front:pruebas/presets.test.js`, `front:src/componentes/FilaNegocio.js`
- Modify: `front:README.md` (lista de migraciones), `front:docs/roles.md` (estado: implementado)

**Interfaces:**
- Produces: sin `empleado.rol`, `usuario.rol`, `rol.clave`, `mi_rol()`, `puedo_cargar()`, `rango_del_rol()`, `rol_de_clave()`, `rol_id_de_la_clave()`, `rol_de_la_ficha_da_permisos()`, `aceptar_invitacion()`.

- [ ] **Step 1: Prueba (sección 14)**

```sql
    -- ---- 14. No queda nada del rol viejo ----
    perform set_config('role', 'postgres', true);
    select count(*) into n from information_schema.columns
     where table_schema = 'public'
       and ((table_name in ('empleado', 'usuario') and column_name = 'rol')
         or (table_name = 'rol' and column_name = 'clave'));
    if n <> 0 then raise exception 'FALLÓ 14: quedan % columnas del rol viejo.', n; end if;
    select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.proname in ('mi_rol', 'puedo_cargar', 'rango_del_rol', 'rol_de_clave', 'rol_id_de_la_clave',
                         'rol_de_la_ficha_da_permisos', 'aceptar_invitacion');
    if n <> 0 then raise exception 'FALLÓ 14: quedan % funciones del rol viejo.', n; end if;
    perform set_config('role', 'authenticated', true);
```

En la sección 2 (Task 1), cambiar `r.clave is distinct from e.rol` por una comprobación que no use la palabra vieja: que la ficha de Edu apunte a `Encargado` y la de Ivo a `Mecánico` por nombre. En la sección 6, los nombres de los roles se buscan por `nombre`, no por clave.

Run → FAIL (`FALLÓ 14: quedan 3 columnas del rol viejo.`).

- [ ] **Step 2: Escribir `059_roles_limpieza.sql`**

```sql
-- ============================================================
-- 059_roles_limpieza.sql — se va el rol viejo
--
-- Correr entero en el SQL Editor de Supabase, después de la 058, y SÓLO con
-- la API y el front de las etapas 2 a 5 ya publicados: después de esto, nada
-- puede leer empleado.rol ni usuario.rol.
-- Es idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Las funciones que todavía escribían la palabra vieja
-- ------------------------------------------------------------
-- crear_mi_negocio (038:285-347): copiar entera y cambiar
--   - el update de usuario: sacar la línea "rol = 'duenio'" (queda sólo negocio_id = nuevo);
--   - el insert de empleado: (negocio_id, nombre, rol_id, usuario_id) con
--     rol_id = (select id from rol where negocio_id = nuevo and es_duenio).
--     El rol Dueño ya existe: lo creó el trigger de la 053 al insertar el negocio.
--
-- entrar_al_negocio (057, sección final): copiar y sacar su_rol (declare, select y "rol = su_rol").
--   El select pasa a "perform 1 from empleado where usuario_id = auth.uid() and negocio_id = p_negocio;".
--
-- quitar_acceso_al_sacar (058): copiar y sacar la línea "rol = case when ... 'duenio' else rol end,".
--
-- aprobar_solicitud (056): copiar y sacar "rol" del insert de empleado (y "nuevo.clave") y la
--   línea "rol = nuevo.clave" del último update.
--
-- asignar_rol (056): el update queda "update empleado set rol_id = p_rol where id = p_empleado;".
--
-- roles_base (053): drop function + create, devolviendo (nombre text, permisos text[]):
--   el mismo select sin la columna k.
-- crear_roles_del_negocio (053): copiar y sacar "clave" de los dos insert
--   (el Dueño: (negocio_id, nombre, es_duenio, permisos); los base: (negocio_id, nombre, permisos)).
--
-- Todo lo de esta sección va ANTES de la sección 2: la sección 2 borra
-- rol.clave y empleado.rol, que estas funciones todavía nombran.

-- ------------------------------------------------------------
-- 2. Lo que se va
-- ------------------------------------------------------------
drop trigger if exists empleado_rol_da_permisos on empleado;
drop trigger if exists empleado_rol_id_de_la_clave on empleado;
drop function if exists rol_de_la_ficha_da_permisos();
drop function if exists rol_id_de_la_clave();
drop function if exists rol_de_clave(uuid, text);
drop function if exists rango_del_rol(text);
drop function if exists puedo_cargar();
drop function if exists mi_rol();
-- Sin uso desde el link de equipo (051): nada del front ni de la API la llama.
drop function if exists aceptar_invitacion(text, text);

alter table empleado drop column if exists rol;
alter table usuario drop column if exists rol;
drop index if exists rol_clave_unica;
alter table rol drop column if exists clave;

-- El nombre de los roles base ya no sale de una clave: roles_base() lo arma
-- con nombre_de_clave() y sigue igual.
```

Antes de correrla: `grep -rn "\.rol\b\|'rol'\|\"rol\"" TP-IngeSoft-API/src TP-Ing.-Software-2026c2/src` y revisar que nada lea `empleado.rol` ni `usuario.rol` (la columna `rol` de `invitacion` y `ver_invitacion` no se tocan: es otra tabla).

Run: migración y todas las pruebas SQL → "Success. No rows returned".


- [ ] **Step 3: API**

- `semilla/casos-de-uso.ts:38-45`: sacar `rol: "duenio"` de `usuario`. Las fichas: después de crear el negocio (el trigger le crea los roles), leer `rol` del negocio (`select id, nombre, es_duenio`) y poner `rol_id`: la del creador → el `es_duenio`; cada `x.rol` de los escenarios (`"encargado"`, `"tecnico"`) → el rol `"Encargado"` o el otro rol base (no Dueño, no Encargado) del negocio.
- `pruebas/apoyo/supabase-falso.ts`: `Persona.rol` puede quedar como etiqueta de prueba (ya no es una columna); la tabla falsa `empleado` deja de guardar `rol` y guarda `rol_id`.
- Regenerar `database.types.ts`.

Run: `npm run tipos && npm test` → PASS.

- [ ] **Step 4: Front**

- `src/lib/presets.js`: borrar `roles: { … }` de cada preset, el comentario de las líneas 272-286 y `etiquetaRol`. Si algo todavía importa `etiquetaRol`, es un lugar que se olvidó en la Tarea 7: cambiarlo por el `rol_nombre`.
- `pruebas/presets.test.js`: sacar lo que pruebe `roles` o `etiquetaRol`.
- `README.md`, sección "Conectar la base de Supabase": la lista de migraciones llega hasta la `059`, y se nombra `supabase/pruebas/roles.sql` junto a las otras pruebas.
- `docs/roles.md`: arriba, "Implementado. Plan: docs/roles-plan.md."

Run: `npm run test:unit` → PASS. `npm run test:e2e` → PASS.

- [ ] **Step 5: Commit (en cada repo)**

```bash
git add -A
git commit -m "Se va el rol viejo (059)"
```

---

## Fuera de este plan

- **Reescribir la regla de tono de la cartilla** (hablar de vos, registro coloquial) y llevar los textos existentes de la aplicación al tono formal. La spec lo deja como pendiente; esta funcionalidad ya usa el tono nuevo.
- **`ver_montos`**: esconder montos por rol exige vistas para `paso` y `cobro`. Etapa propia si se pide.
