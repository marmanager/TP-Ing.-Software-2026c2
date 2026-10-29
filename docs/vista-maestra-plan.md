# Vista maestra — plan de implementación

> **Estado: aprobado, sin empezar.** Modo elegido por el usuario el 28 de
> octubre de 2026: **subagentes** — usar superpowers:subagent-driven-development,
> tarea por tarea, con un revisor por tarea y una revisión de toda la rama al
> final. Arrancar por la Tarea 0. Los pasos usan casillas (`- [ ]`) para ir
> marcando.

**Objetivo:** que una cuenta con varios negocios los mire todos desde una sola
vista de sólo lectura, saltando de uno a otro con un selector a la derecha
(o una tira arriba en el celular) y con Alt+1…Alt+9.

**Arquitectura:** igual que la visita entre sedes (061). Mirar un negocio mueve
`usuario.negocio_id` a ése y deja la marca `usuario.vista_maestra_desde`. Con la
marca puesta, `permisos_efectivos()` deja sólo los permisos de mirar, un trigger
en cada tabla frena toda escritura, y la API corta los pedidos que no son GET.
Pantallas, RLS y endpoints de lectura sirven sin tocarlos. Lo nuevo: tres tablas
de preferencias de la cuenta, un módulo `vista-maestra` en la API, y en el front
el selector, el desplegable de la flechita, la franja y el botón en Mi perfil.

**Tecnología:** Next.js 16 (App Router) + React 19 + Tailwind 4 (front), Express
5 + TypeScript + zod (API), Supabase con RLS, Jest (`npm.cmd run test:unit`) en
el front y `node --test` en la API.

**Diseño:** [`docs/vista-maestra.md`](vista-maestra.md). Se leen los dos.

## Reglas para todas las tareas

- Textos y comentarios en castellano rioplatense, con el estilo del repo
  (comentarios que dicen el porqué, como en `FranjaDeVisita.js`).
- Cartilla: un solo botón azul por pantalla; áreas táctiles de 48 px
  (`min-h-12`); el estado se dice con color + ícono + palabra; un botón
  apagado dice por qué (`motivo`).
- Nada del navegador escribe en tablas: todo por funciones `security definer`
  con `set search_path = public`, `revoke ... from public, anon`, `grant
  execute ... to authenticated`.
- Errores de funciones (`P0001`, `42501`) pasan tal cual; los demás, por
  `traducir()`.
- El modo de ejemplo ("Probá sin cuenta") no cambia: sin vista maestra.
- Pantalla → `datos.js`/`auth.js`/`lib/*.js` → `api.js` → API. Ninguna pantalla
  ni componente llama a `api.js` (lo verifica `pruebas/fronteras.test.js`).
- Antes de escribir código del front, leer la guía que corresponda en
  `node_modules/next/dist/docs/` (AGENTS.md: este Next tiene cambios).
- Commits **sólo con aprobación del usuario**. Mensaje en castellano, estilo
  del repo, terminando en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- En Windows, `npm.cmd` (la política de PowerShell traba `npm.ps1`).
- Nunca mover `.env.local` mientras el servidor del usuario esté corriendo.

## Global Constraints

- Atajos: `event.code` `Digit1`…`Digit9` con `altKey`, sin `ctrlKey`/`metaKey`/`shiftKey`.
- Atrasado: no `completado`, no `esperando`, sin paso en `esperando`, y el último avance (`caso.actualizado_en`, `paso.actualizado_en`, `evento.ocurrido_en`) hace más de **14 días**.
- Stock bajo: `insumo.estado = 'en_stock'` y (`cantidad = 0` o `cantidad <= minimo`).
- Mensaje de bloqueo: *"Estás en vista maestra: es sólo para mirar. Salí de la vista para cambiar algo."* (código `vista_maestra`, 403 en la API; `42501` en la base).
- Hacen falta **2 o más** negocios con ficha para entrar.
- El negocio que se está mirando no se puede apagar: *"Estás mirándolo."*.
- Nombre de grupo: 1 a 60 caracteres, único por cuenta sin distinguir mayúsculas.

## Review Focus

1. **Una escritura que se escapa del bloqueo**: una función `security definer` que escribe sin pasar por `puede_aca()` (p. ej. las que miran `mi_empleado()` o `mi_rol()`). Lo que se espera: falla con el mensaje de bloqueo. Prueba en la Tarea 1, paso 4 (cambiar un caso, escribir el historial y `guardar_mi_perfil()`, que escribe la ficha sin mirar permisos).
2. **Una tabla creada después de la 076** queda sin trigger. Lo que se espera: la prueba SQL lo detecta. Prueba en la Tarea 1 (todas las tablas de `public`, menos las 4 de la cuenta, tienen el trigger).
3. **Sacarle la ficha a alguien mientras mira ese negocio en vista maestra**. Lo que se espera: sigue en vista maestra, sin ver nada de ese negocio, y "Salir" lo lleva a su negocio de antes o al selector. Prueba en la Tarea 1.
4. **Alt+número mientras se escribe en un campo** (el buscador). Lo que se espera: el atajo igual cambia de negocio (en vista maestra no hay nada que se pierda) y no escribe el carácter; Alt+0 o una posición vacía no hacen nada. Prueba en la Tarea 4 (`negocioDelAtajo` da `null` fuera del selector, y sólo entonces no se llama `preventDefault`) y a mano en la Tarea 8, paso 5, con el foco en el buscador.
5. **Entrar a vista maestra estando de visita en otra sede**. Lo que se espera: termina la visita, y "Salir" vuelve a la sede propia, no a la visitada. Prueba en la Tarea 1.

---

### Tarea 0: Ramas

**Archivos:** ninguno.

- [ ] **Paso 1: el front ya está en `vista-maestra`**

Run: `git -C TP-Ing.-Software-2026c2 branch --show-current`
Expected: `vista-maestra`

- [ ] **Paso 2: la API tiene cambios sin commitear en `master`**

Run: `git -C TP-IngeSoft-API status --short`

Si muestra archivos (hoy: `pruebas/casos-de-uso/landing.test.ts`, `pruebas/contrato/landing.test.ts`, `src/lib/database.types.ts`, `src/modulos/landing/casos-de-uso.ts`), **preguntarle al usuario** qué hacer con ellos antes de crear la rama. No hacer `stash` ni commit sin que diga.

- [ ] **Paso 3: crear la rama en la API**

```bash
git -C TP-IngeSoft-API switch -c vista-maestra
```

---

### Tarea 1: La base — `076_vista_maestra.sql` y su prueba

**Archivos:**
- Crear: `TP-Ing.-Software-2026c2/supabase/migrations/20261028030000_076_vista_maestra.sql`
- Crear: `TP-Ing.-Software-2026c2/supabase/pruebas/vista_maestra.sql`

**Interfaces:**
- Produce (todas para `authenticated`):
  - `usuario.vista_maestra_desde uuid` (nulo = no está en vista maestra)
  - `en_vista_maestra() → boolean`
  - `entrar_a_vista_maestra() → uuid` (el negocio que queda mirando)
  - `mirar_en_vista_maestra(p_negocio uuid) → void`
  - `salir_de_vista_maestra() → uuid` (a dónde volvió; nulo = a ninguno)
  - `mi_vista_maestra() → jsonb` con `{ negocios: [{ id, nombre, rubro, foto, rol_nombre, prendido, orden, grupos: [uuid] }], grupos: [{ id, nombre, negocios: [uuid] }] }`
  - `guardar_negocios_de_vista_maestra(p_negocios jsonb) → void` — `p_negocios` es `[{ "id": uuid, "prendido": bool }]` en el orden nuevo
  - `guardar_grupo_de_negocios(p_grupo uuid, p_nombre text, p_negocios uuid[]) → uuid` (`p_grupo` nulo = crear)
  - `borrar_grupo_de_negocios(p_grupo uuid) → void`
  - `urgencias_de_mis_negocios() → table (negocio_id uuid, casos_atrasados integer, stock_bajo integer)`

- [ ] **Paso 1: escribir la prueba que falla**

`supabase/pruebas/vista_maestra.sql`, con el mismo formato que `supabase/pruebas/red_de_sedes.sql`.
Cuentas: **ana** dueña de A, B y C; **caro** mecánica en A; **beto** dueño de D
(ajeno); **solo** con un negocio, E.

Para armar datos sin pasar por las reglas ("como el sistema") se sale de la
sesión: rol `postgres` y sin `request.jwt.claims`. Así `auth.uid()` es nulo y
el freno de vista maestra no corre, igual que con la API y la clave de servicio.

```sql
-- ============================================================
-- supabase/pruebas/vista_maestra.sql — la vista maestra (076)
--
-- Correr entera en el SQL Editor, después de la 076. Corre dentro de una
-- transacción que se deshace al final: no deja nada. Si una prueba falla,
-- frena y dice cuál; si pasan todas, lo dice.
--
-- Las sesiones se simulan como Supabase: rol "authenticated" y el id de la
-- cuenta en request.jwt.claims. "Como el sistema" es rol postgres y sin
-- claims: auth.uid() nulo, como la API con la clave de servicio.
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();
  caro uuid := gen_random_uuid();
  beto uuid := gen_random_uuid();
  solo uuid := gen_random_uuid();
  neg_a uuid; neg_b uuid; neg_c uuid; neg_d uuid; neg_e uuid;
  inv text; mirando uuid; vuelta uuid; grupo uuid; caso_b uuid;
  frenado boolean; n integer; vm jsonb;
begin
  begin
    insert into auth.users (id, email) values
      (ana,  'prueba-ana-'  || ana  || '@ejemplo.test'),
      (caro, 'prueba-caro-' || caro || '@ejemplo.test'),
      (beto, 'prueba-beto-' || beto || '@ejemplo.test'),
      (solo, 'prueba-solo-' || solo || '@ejemplo.test');
    perform set_config('role', 'authenticated', true);

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Taller A', 'taller', '[]'::jsonb);
    neg_b := crear_mi_negocio('Taller B', 'taller', '[]'::jsonb);
    neg_c := crear_mi_negocio('Taller C', 'taller', '[]'::jsonb);
    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    neg_d := crear_mi_negocio('Taller D', 'taller', '[]'::jsonb);
    perform set_config('request.jwt.claims', json_build_object('sub', solo, 'role', 'authenticated')::text, true);
    neg_e := crear_mi_negocio('Taller E', 'taller', '[]'::jsonb);

    -- Caro, mecánica en A, por el link de equipo (como en red_de_sedes.sql).
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    select codigo into inv from cambiar_link_de_equipo(1);
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform pedir_entrar(inv, 'Caro');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform aprobar_solicitud((select id from pedidos_de_ingreso() where nombre = 'Caro'),
                              (select id from rol where negocio_id = neg_a and nombre = 'Mecánico'));

    -- Como el sistema: un caso en B para probar que después no se cambia.
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'postgres', true);
    insert into caso (negocio_id, numero, servicio) values (neg_b, 1, 'Frenos') returning id into caso_b;
    perform set_config('role', 'authenticated', true);

    -- 1. Con un solo negocio no se entra.
    perform set_config('request.jwt.claims', json_build_object('sub', solo, 'role', 'authenticated')::text, true);
    begin
      perform entrar_a_vista_maestra();
      raise exception 'FALLA 1: entró a vista maestra con un solo negocio';
    exception when raise_exception then
      if sqlerrm <> 'Hace falta más de un negocio.' then raise; end if;
    end;

    -- 2. Ana entra desde B: queda mirando B y con la marca.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_b);
    mirando := entrar_a_vista_maestra();
    if mirando <> neg_b then raise exception 'FALLA 2: no quedó mirando el negocio de antes'; end if;
    if not en_vista_maestra() then raise exception 'FALLA 2b: sin la marca'; end if;

    -- 3. Sólo permisos de mirar, y no es dueña para la API.
    if exists (select 1 from unnest(permisos_efectivos(neg_b)) x where x <> all (permisos_de_mirar())) then
      raise exception 'FALLA 3: en vista maestra quedan permisos de cambiar';
    end if;
    if (mis_permisos() ->> 'es_duenio')::boolean then raise exception 'FALLA 3b: es_duenio sigue en true'; end if;
    if not exists (select 1 from caso where id = caso_b) then raise exception 'FALLA 3c: no ve los casos de B'; end if;

    -- 4. Nada se escribe: ni por la tabla ni por una función.
    frenado := false;
    begin
      update caso set servicio = 'Otra cosa' where id = caso_b;
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLA 4: se cambió un caso en vista maestra'; end if;
    frenado := false;
    begin
      insert into evento (caso_id, titulo) values (caso_b, 'Nota');
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLA 4b: se escribió el historial en vista maestra'; end if;
    frenado := false;
    begin
      perform guardar_mi_perfil('Ana Nueva', null, null);
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLA 4c: guardar_mi_perfil escribió la ficha en vista maestra'; end if;

    -- 5. Mirar otro negocio propio sí; uno ajeno no.
    perform mirar_en_vista_maestra(neg_c);
    if (select negocio_id from usuario where id = ana) <> neg_c then raise exception 'FALLA 5'; end if;
    begin
      perform mirar_en_vista_maestra(neg_d);
      raise exception 'FALLA 5b: miró un negocio ajeno';
    exception when raise_exception then
      if sqlerrm <> 'No estás en ese negocio.' then raise; end if;
    end;

    -- 6. El que se mira (C) no se apaga; los demás sí, y el orden se guarda.
    begin
      perform guardar_negocios_de_vista_maestra(jsonb_build_array(
        jsonb_build_object('id', neg_c, 'prendido', false),
        jsonb_build_object('id', neg_a, 'prendido', true),
        jsonb_build_object('id', neg_b, 'prendido', true)));
      raise exception 'FALLA 6: apagó el negocio que estaba mirando';
    exception when raise_exception then
      if sqlerrm <> 'Estás mirándolo.' then raise; end if;
    end;
    perform guardar_negocios_de_vista_maestra(jsonb_build_array(
      jsonb_build_object('id', neg_c, 'prendido', true),
      jsonb_build_object('id', neg_a, 'prendido', false),
      jsonb_build_object('id', neg_b, 'prendido', true)));
    vm := mi_vista_maestra();
    if (select string_agg(x ->> 'nombre', ',' order by (x ->> 'orden')::int) from jsonb_array_elements(vm -> 'negocios') x)
       <> 'Taller C,Taller A,Taller B' then raise exception 'FALLA 6b: no guardó el orden'; end if;
    begin
      perform mirar_en_vista_maestra(neg_a);
      raise exception 'FALLA 6c: miró un negocio apagado';
    exception when raise_exception then
      if sqlerrm <> 'Ese negocio está apagado en la vista maestra.' then raise; end if;
    end;

    -- 7. Grupos: crear, nombre repetido, negocio ajeno, borrar.
    grupo := guardar_grupo_de_negocios(null, 'Zona sur', array[neg_a, neg_b]);
    if jsonb_array_length(mi_vista_maestra() -> 'grupos') <> 1 then raise exception 'FALLA 7'; end if;
    begin
      perform guardar_grupo_de_negocios(null, 'zona SUR', array[neg_c]);
      raise exception 'FALLA 7b: dos grupos con el mismo nombre';
    exception when raise_exception then
      if sqlerrm <> 'Ya tenés un grupo con ese nombre.' then raise; end if;
    end;
    begin
      perform guardar_grupo_de_negocios(grupo, 'Zona sur', array[neg_d]);
      raise exception 'FALLA 7c: un negocio ajeno en un grupo';
    exception when raise_exception then
      if sqlerrm <> 'No estás en ese negocio.' then raise; end if;
    end;
    perform borrar_grupo_de_negocios(grupo);
    if jsonb_array_length(mi_vista_maestra() -> 'grupos') <> 0 then raise exception 'FALLA 7d'; end if;

    -- 8. Urgencias: el caso viejo de B cuenta; uno viejo "esperando" no; uno
    --    viejo con un paso sin aprobar tampoco; stock bajo sí; nada de lo ajeno.
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'postgres', true);
    insert into caso (negocio_id, numero, servicio, estado, actualizado_en)
      values (neg_b, 2, 'Aceite', 'esperando', now() - interval '20 days');
    with c as (
      insert into caso (negocio_id, numero, servicio, actualizado_en)
      values (neg_b, 3, 'Embrague', now() - interval '20 days') returning id
    )
    insert into paso (caso_id, nombre, estado, actualizado_en)
      select id, 'Cambiar disco', 'esperando', now() - interval '20 days' from c;
    insert into insumo (negocio_id, nombre, cantidad, minimo) values (neg_b, 'Filtro', 1, 2);
    -- los triggers de actualizado_en pisan la fecha en el update: dejarla vieja de nuevo
    alter table caso disable trigger caso_actualizado_en;
    update caso set actualizado_en = now() - interval '20 days' where negocio_id = neg_b;
    alter table caso enable trigger caso_actualizado_en;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select count(*) into n from urgencias_de_mis_negocios() u
     where u.negocio_id = neg_b and u.casos_atrasados = 1 and u.stock_bajo = 1;
    if n <> 1 then raise exception 'FALLA 8: urgencias de B'; end if;
    if exists (select 1 from urgencias_de_mis_negocios() where negocio_id = neg_d) then
      raise exception 'FALLA 8b: urgencias de un negocio ajeno';
    end if;

    -- 9. Estando en vista maestra no se entra de visita.
    begin
      perform entrar_de_visita(neg_d);
      raise exception 'FALLA 9: entró de visita desde vista maestra';
    exception when raise_exception then
      if sqlerrm <> 'Salí de la vista maestra para visitar otra sede.' then raise; end if;
    end;

    -- 10. Salir vuelve al de antes (B) y saca la marca.
    vuelta := salir_de_vista_maestra();
    if vuelta <> neg_b or en_vista_maestra() then raise exception 'FALLA 10'; end if;
    if (select negocio_id from usuario where id = ana) <> neg_b then raise exception 'FALLA 10b'; end if;

    -- 11. Todas las tablas tienen el freno (menos las de la cuenta).
    select count(*) into n
      from pg_tables t
     where t.schemaname = 'public'
       and t.tablename <> all (array['usuario', 'vista_maestra_negocio', 'grupo_de_negocios', 'grupo_negocio'])
       and not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                        join pg_namespace s on s.oid = c.relnamespace
                        where s.nspname = 'public' and c.relname = t.tablename
                          and g.tgname = 'a_frenar_en_vista_maestra');
    if n > 0 then raise exception 'FALLA 11: % tablas sin el freno de vista maestra', n; end if;

    -- 12. Entrar desde una visita (Ana mirando D de visita, como el sistema)
    --     termina la visita, y salir vuelve a la sede propia (A).
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'postgres', true);
    update usuario set negocio_id = neg_d, visitando_desde = neg_a where id = ana;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_a_vista_maestra();
    if (select visitando_desde from usuario where id = ana) is not null then raise exception 'FALLA 12: sigue de visita'; end if;
    if salir_de_vista_maestra() <> neg_a then raise exception 'FALLA 12b: no volvió a la sede propia'; end if;

    -- 13. A Caro le sacan la ficha de A mientras la mira: ya no la ve, y
    --     salir no la deja en A.
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform crear_mi_negocio('Taller de Caro', 'taller', '[]'::jsonb);  -- para tener dos
    perform entrar_al_negocio(neg_a);
    perform entrar_a_vista_maestra();
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'postgres', true);
    delete from empleado where negocio_id = neg_a and usuario_id = caro;   -- como lo hace Equipo
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    if exists (select 1 from caso where negocio_id = neg_a) then raise exception 'FALLA 13: sigue viendo A'; end if;
    vuelta := salir_de_vista_maestra();
    if vuelta is not distinct from neg_a then raise exception 'FALLA 13b: volvió a un negocio sin ficha'; end if;

    raise exception 'TODO_OK';
  exception
    when others then
      if sqlerrm = 'TODO_OK' then
        raise notice 'Vista maestra: pasaron todas las pruebas.';
      else
        raise;
      end if;
  end;
end;
$prueba$;
```

> Notas para quien la corra:
> - Si `insert into caso` pide más columnas (un `numero` que pone un trigger,
>   un `cliente_id`), copiar cómo crea casos `supabase/pruebas/roles.sql`.
> - En el paso 13, `quitar_acceso_al_sacar()` (036/038) cambia el negocio
>   activo de Caro al sacarle la ficha. Si con eso `salir_de_vista_maestra()`
>   da "No estás en vista maestra." porque ese trigger limpió algo, está bien
>   igual: ajustar la prueba a lo que haga y anotarlo acá.

- [ ] **Paso 2: correrla y ver que falla**

En el SQL Editor de Supabase (proyecto de pruebas). Expected: error en la
primera llamada a `entrar_a_vista_maestra` (*function does not exist*).

- [ ] **Paso 3: escribir la migración**

`supabase/migrations/20261028030000_076_vista_maestra.sql`:

```sql
-- ============================================================
-- 076_vista_maestra.sql — mirar todos los negocios de la cuenta, sin cambiar nada
--
-- docs/vista-maestra.md. Es idempotente. Después, correr
-- supabase/pruebas/vista_maestra.sql.
--
-- Igual que la visita entre sedes (061): mirar un negocio mueve
-- usuario.negocio_id a ése, así las políticas de siempre muestran lo suyo. La
-- marca usuario.vista_maestra_desde (a dónde vuelve "Salir de vista") hace que
-- permisos_efectivos() deje sólo los de mirar y que un trigger en cada tabla
-- frene toda escritura, también la que hacen las funciones security definer
-- que no pasan por puede_aca(). Falla cerrado.
-- ============================================================

-- Como el resto de usuario desde la 035: no se escribe desde el navegador.
alter table usuario add column if not exists vista_maestra_desde uuid references negocio (id) on delete set null;

-- ------------------------------------------------------------
-- 1. Lo que la cuenta elige ver: prendidos, orden y grupos
-- ------------------------------------------------------------
-- Sin políticas: sólo las funciones de abajo las leen y escriben.
create table if not exists vista_maestra_negocio (
  usuario_id uuid    not null references usuario (id) on delete cascade,
  negocio_id uuid    not null references negocio (id) on delete cascade,
  prendido   boolean not null default true,
  orden      integer not null default 0,
  primary key (usuario_id, negocio_id)
);
alter table vista_maestra_negocio enable row level security;

create table if not exists grupo_de_negocios (
  id         uuid        primary key default gen_random_uuid(),
  usuario_id uuid        not null references usuario (id) on delete cascade,
  nombre     text        not null check (char_length(trim(nombre)) between 1 and 60),
  creado_en  timestamptz not null default now()
);
create unique index if not exists grupo_de_negocios_nombre_unico
  on grupo_de_negocios (usuario_id, lower(trim(nombre)));
alter table grupo_de_negocios enable row level security;

create table if not exists grupo_negocio (
  grupo_id   uuid not null references grupo_de_negocios (id) on delete cascade,
  negocio_id uuid not null references negocio (id) on delete cascade,
  primary key (grupo_id, negocio_id)
);
alter table grupo_negocio enable row level security;

-- ------------------------------------------------------------
-- 2. ¿Está en vista maestra?
-- ------------------------------------------------------------
create or replace function en_vista_maestra()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select u.vista_maestra_desde is not null from usuario u where u.id = auth.uid()), false);
$$;

revoke all on function en_vista_maestra() from public;
revoke all on function en_vista_maestra() from anon;
grant execute on function en_vista_maestra() to authenticated;

-- ------------------------------------------------------------
-- 3. En vista maestra, sólo los permisos de mirar
-- ------------------------------------------------------------
-- La de la 061 pasa a llamarse permisos_del_rol, sin cambios; la nueva la
-- envuelve. Así no se copia su cuerpo y las políticas que llaman a
-- permisos_efectivos() (por puede_en/puede_aca) siguen igual.
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                  where s.nspname = 'public' and p.proname = 'permisos_del_rol') then
    alter function permisos_efectivos(uuid) rename to permisos_del_rol;
  end if;
end $$;

revoke all on function permisos_del_rol(uuid) from public;
revoke all on function permisos_del_rol(uuid) from anon;
revoke all on function permisos_del_rol(uuid) from authenticated;

create or replace function permisos_efectivos(p_negocio uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
           when en_vista_maestra() then
             array(select x from unnest(permisos_del_rol(p_negocio)) x where x = any(permisos_de_mirar()))
           else permisos_del_rol(p_negocio)
         end;
$$;

revoke all on function permisos_efectivos(uuid) from public;
revoke all on function permisos_efectivos(uuid) from anon;
grant execute on function permisos_efectivos(uuid) to authenticated;

-- Igual que la de la base; en vista maestra nadie es dueño: la API y el front
-- usan es_duenio para dejar hacer todo (puede() de los dos lados).
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
    'es_duenio', coalesce(r.es_duenio, false) and not en_vista_maestra(),
    'permisos', to_jsonb(permisos_efectivos(mi_negocio()))
  )
    from (select 1) uno
    left join empleado e on e.negocio_id = mi_negocio() and e.usuario_id = auth.uid()
    left join rol r on r.id = e.rol_id;
$$;

-- ------------------------------------------------------------
-- 4. El freno: nada se escribe en vista maestra
-- ------------------------------------------------------------
-- En cada tabla de public menos las de la cuenta (usuario y las tres de
-- arriba), que las tocan sólo las funciones de esta migración y las de entrar.
-- Sin sesión (la API con la clave de servicio, la landing anónima)
-- en_vista_maestra() da false y no frena.
-- ponytail: una consulta a usuario por fila escrita; si una carga masiva
-- (restablecer una copia) se nota lenta, cachear en una variable de sesión.
create or replace function frenar_en_vista_maestra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if en_vista_maestra() then
    raise exception 'Estás en vista maestra: es sólo para mirar. Salí de la vista para cambiar algo.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

-- Una tabla nueva después de la 076 queda sin freno: la prueba
-- vista_maestra.sql (paso 11) lo detecta. Volver a correr este bloque la cubre.
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
     where schemaname = 'public'
       and tablename <> all (array['usuario', 'vista_maestra_negocio', 'grupo_de_negocios', 'grupo_negocio'])
  loop
    execute format('drop trigger if exists a_frenar_en_vista_maestra on public.%I', t);
    execute format('create trigger a_frenar_en_vista_maestra before insert or update or delete on public.%I '
                   'for each row execute function frenar_en_vista_maestra()', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5. Una fila por negocio con ficha
-- ------------------------------------------------------------
-- Los negocios nuevos entran al final, prendidos; los que ya no tienen ficha
-- se van. Interna: la llaman las funciones de abajo.
create or replace function preparar_vista_maestra()
returns void
language sql
security definer
set search_path = public
as $$
  delete from vista_maestra_negocio v
   where v.usuario_id = auth.uid()
     and not exists (select 1 from empleado e where e.usuario_id = auth.uid() and e.negocio_id = v.negocio_id);
  insert into vista_maestra_negocio (usuario_id, negocio_id, prendido, orden)
  select auth.uid(), e.negocio_id, true,
         coalesce((select max(v.orden) from vista_maestra_negocio v where v.usuario_id = auth.uid()), -1)
           + row_number() over (order by n.nombre)
    from empleado e
    join negocio n on n.id = e.negocio_id
   where e.usuario_id = auth.uid()
     and not exists (select 1 from vista_maestra_negocio v where v.usuario_id = auth.uid() and v.negocio_id = e.negocio_id);
$$;

revoke all on function preparar_vista_maestra() from public;
revoke all on function preparar_vista_maestra() from anon;
revoke all on function preparar_vista_maestra() from authenticated;

-- ------------------------------------------------------------
-- 6. Entrar, mirar y salir
-- ------------------------------------------------------------
create or replace function entrar_a_vista_maestra()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  origen uuid;
  elegido uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;
  if en_vista_maestra() then
    raise exception 'Ya estás en vista maestra.';
  end if;
  if (select count(*) from empleado where usuario_id = auth.uid()) < 2 then
    raise exception 'Hace falta más de un negocio.';
  end if;

  perform preparar_vista_maestra();

  -- Desde una visita, el de antes es la sede propia, no la visitada.
  select coalesce(u.visitando_desde, u.negocio_id) into origen from usuario u where u.id = auth.uid();
  if not exists (select 1 from empleado where usuario_id = auth.uid() and negocio_id = origen) then
    origen := null;
  end if;

  -- El de antes si está prendido; si no, el primero prendido; si no hay
  -- ninguno (le sacaron la ficha del único), se prende el primero.
  select v.negocio_id into elegido
    from vista_maestra_negocio v
   where v.usuario_id = auth.uid() and v.prendido
   order by (v.negocio_id = origen) desc nulls last, v.orden
   limit 1;
  if elegido is null then
    select v.negocio_id into elegido from vista_maestra_negocio v
     where v.usuario_id = auth.uid() order by v.orden limit 1;
    update vista_maestra_negocio set prendido = true where usuario_id = auth.uid() and negocio_id = elegido;
  end if;

  update usuario
     set negocio_id          = elegido,
         rol                 = (select e.rol from empleado e where e.usuario_id = auth.uid() and e.negocio_id = elegido),
         visitando_desde     = null,
         vista_maestra_desde = coalesce(origen, elegido)
   where id = auth.uid();
  return elegido;
end;
$$;

create or replace function mirar_en_vista_maestra(p_negocio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not en_vista_maestra() then
    raise exception 'No estás en vista maestra.';
  end if;
  if not exists (select 1 from empleado where usuario_id = auth.uid() and negocio_id = p_negocio) then
    raise exception 'No estás en ese negocio.';
  end if;
  if not exists (select 1 from vista_maestra_negocio
                  where usuario_id = auth.uid() and negocio_id = p_negocio and prendido) then
    raise exception 'Ese negocio está apagado en la vista maestra.';
  end if;

  update usuario
     set negocio_id = p_negocio,
         rol        = (select e.rol from empleado e where e.usuario_id = auth.uid() and e.negocio_id = p_negocio)
   where id = auth.uid();
end;
$$;

-- Vuelve al de antes si sigue teniendo ficha; si no, a ninguno (la Guardia
-- lleva al selector de negocios). Devuelve a dónde volvió.
create or replace function salir_de_vista_maestra()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  destino uuid;
begin
  select u.vista_maestra_desde into destino from usuario u where u.id = auth.uid();
  if destino is null then
    raise exception 'No estás en vista maestra.';
  end if;
  if not exists (select 1 from empleado where usuario_id = auth.uid() and negocio_id = destino) then
    destino := null;
  end if;

  update usuario
     set negocio_id          = destino,
         rol                 = (select e.rol from empleado e where e.usuario_id = auth.uid() and e.negocio_id = destino),
         vista_maestra_desde = null
   where id = auth.uid();
  return destino;
end;
$$;

-- Igual que en la 061; además termina la vista maestra ("Editar en este negocio").
create or replace function entrar_al_negocio(p_negocio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  su_rol text;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;

  select rol into su_rol
    from empleado
   where usuario_id = auth.uid()
     and negocio_id = p_negocio;

  if not found then
    raise exception 'No estás en ese negocio.';
  end if;

  update usuario
     set negocio_id          = p_negocio,
         rol                 = su_rol,
         visitando_desde     = null,
         vista_maestra_desde = null
   where id = auth.uid();
end;
$$;
```

Seguir el mismo archivo con `entrar_de_visita`: **copiar entera la definición
vigente** de `supabase/migrations/00000000000000_base.sql` (busca
`FUNCTION "public"."entrar_de_visita"`) y agregar, después del chequeo de
`auth.uid()`:

```sql
  if en_vista_maestra() then
    raise exception 'Salí de la vista maestra para visitar otra sede.';
  end if;
```

Y seguir con lo del desplegable y las urgencias:

```sql
-- ------------------------------------------------------------
-- 7. Lo que muestra el desplegable de la flechita
-- ------------------------------------------------------------
create or replace function mi_vista_maestra()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform preparar_vista_maestra();
  return jsonb_build_object(
    'negocios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.id, 'nombre', n.nombre, 'rubro', n.rubro, 'foto', n.foto,
               'rol_nombre', r.nombre, 'prendido', v.prendido, 'orden', v.orden,
               'grupos', coalesce((select jsonb_agg(gn.grupo_id) from grupo_negocio gn
                                     join grupo_de_negocios g on g.id = gn.grupo_id
                                    where gn.negocio_id = n.id and g.usuario_id = auth.uid()), '[]'::jsonb))
             order by v.orden)
        from vista_maestra_negocio v
        join negocio n on n.id = v.negocio_id
        join empleado e on e.negocio_id = n.id and e.usuario_id = auth.uid()
        left join rol r on r.id = e.rol_id
       where v.usuario_id = auth.uid()), '[]'::jsonb),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id, 'nombre', g.nombre,
               'negocios', coalesce((select jsonb_agg(gn.negocio_id) from grupo_negocio gn
                                      join empleado e on e.negocio_id = gn.negocio_id and e.usuario_id = auth.uid()
                                     where gn.grupo_id = g.id), '[]'::jsonb))
             order by lower(g.nombre))
        from grupo_de_negocios g
       where g.usuario_id = auth.uid()), '[]'::jsonb)
  );
end;
$$;

-- Prendidos y orden, en una sola llamada: el orden es el del arreglo.
create or replace function guardar_negocios_de_vista_maestra(p_negocios jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mirando uuid;
begin
  if not en_vista_maestra() then
    raise exception 'No estás en vista maestra.';
  end if;
  if jsonb_typeof(p_negocios) <> 'array' then
    raise exception 'No se pudo guardar la lista de negocios.';
  end if;
  perform preparar_vista_maestra();
  select negocio_id into mirando from usuario where id = auth.uid();

  if exists (select 1 from jsonb_array_elements(p_negocios) x
              where (x ->> 'id')::uuid = mirando and not (x ->> 'prendido')::boolean) then
    raise exception 'Estás mirándolo.';
  end if;

  update vista_maestra_negocio v
     set prendido = (x.valor ->> 'prendido')::boolean,
         orden    = x.pos - 1
    from jsonb_array_elements(p_negocios) with ordinality as x (valor, pos)
   where v.usuario_id = auth.uid()
     and v.negocio_id = (x.valor ->> 'id')::uuid;
end;
$$;

-- Crear (p_grupo nulo) o cambiar un grupo: nombre y negocios de una vez.
create or replace function guardar_grupo_de_negocios(p_grupo uuid, p_nombre text, p_negocios uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  limpio text := trim(coalesce(p_nombre, ''));
  id_grupo uuid := p_grupo;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;
  if char_length(limpio) not between 1 and 60 then
    raise exception 'El nombre del grupo tiene que tener entre 1 y 60 letras.';
  end if;
  if exists (select 1 from unnest(coalesce(p_negocios, '{}')) x
              where not exists (select 1 from empleado e where e.usuario_id = auth.uid() and e.negocio_id = x)) then
    raise exception 'No estás en ese negocio.';
  end if;
  if exists (select 1 from grupo_de_negocios g
              where g.usuario_id = auth.uid() and lower(trim(g.nombre)) = lower(limpio)
                and g.id is distinct from p_grupo) then
    raise exception 'Ya tenés un grupo con ese nombre.';
  end if;

  if id_grupo is null then
    insert into grupo_de_negocios (usuario_id, nombre) values (auth.uid(), limpio) returning id into id_grupo;
  else
    update grupo_de_negocios set nombre = limpio where id = id_grupo and usuario_id = auth.uid();
    if not found then
      raise exception 'Ese grupo ya no está.';
    end if;
    delete from grupo_negocio where grupo_id = id_grupo;
  end if;

  insert into grupo_negocio (grupo_id, negocio_id)
  select id_grupo, x from unnest(coalesce(p_negocios, '{}')) x
  on conflict do nothing;
  return id_grupo;
end;
$$;

create or replace function borrar_grupo_de_negocios(p_grupo uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from grupo_de_negocios where id = p_grupo and usuario_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 8. El puntito de urgente
-- ------------------------------------------------------------
-- Atrasado: no está completado ni esperando a un tercero (estado
-- "esperando", o un paso que el cliente todavía no aprobó) y hace 14 días que
-- no avanza: ni el caso, ni sus pasos, ni su historial. Stock bajo: la misma
-- regla que el tablero (estadisticas-inventario.ts de la API). Cada cosa
-- cuenta sólo si el rol de la cuenta la ve en ese negocio.
create or replace function urgencias_de_mis_negocios()
returns table (negocio_id uuid, casos_atrasados integer, stock_bajo integer)
language sql
stable
security definer
set search_path = public
as $$
  select e.negocio_id,
         (select count(*)::integer
            from caso c
           where c.negocio_id = e.negocio_id
             and c.estado not in ('completado', 'esperando')
             and (puede_en(e.negocio_id, 'ver_todos_los_casos') or c.responsable_id = e.id)
             and not exists (select 1 from paso p where p.caso_id = c.id and p.estado = 'esperando')
             and greatest(c.actualizado_en,
                          (select max(p.actualizado_en) from paso p where p.caso_id = c.id),
                          (select max(ev.ocurrido_en) from evento ev where ev.caso_id = c.id))
                 < now() - interval '14 days'),
         case when puede_en(e.negocio_id, 'ver_inventario') then
           (select count(*)::integer
              from insumo i
             where i.negocio_id = e.negocio_id
               and i.estado = 'en_stock'
               and (i.cantidad = 0 or i.cantidad <= i.minimo))
         else 0 end
    from empleado e
   where e.usuario_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 9. Permisos de ejecución
-- ------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'entrar_a_vista_maestra()', 'mirar_en_vista_maestra(uuid)', 'salir_de_vista_maestra()',
    'entrar_al_negocio(uuid)', 'entrar_de_visita(uuid)', 'mi_vista_maestra()',
    'guardar_negocios_de_vista_maestra(jsonb)', 'guardar_grupo_de_negocios(uuid, text, uuid[])',
    'borrar_grupo_de_negocios(uuid)', 'urgencias_de_mis_negocios()', 'mis_permisos()'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke all on function %s from anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
```

> El cambio de nombre de `permisos_efectivos` es seguro porque ninguna función
> de la base usa cuerpos `begin atomic` (que guardan la dependencia por OID y
> seguirían llamando a la vieja): todas son `as $$ ... $$` y buscan por nombre
> al correr. Si alguien agrega una `begin atomic` que la llame, revisar esto.
>
> Ojo con `greatest()`: en Postgres ignora los nulos, así que un caso sin pasos
> ni historial usa sólo `actualizado_en`. Es lo que se quiere.
> `empleado.rol` (texto) es lo que copian `entrar_al_negocio` y la 061; se usa
> igual.

- [ ] **Paso 4: aplicar la migración y correr la prueba**

Aplicarla en el proyecto de pruebas como las otras de `supabase/migrations/`
(`npx.cmd supabase db push`, o pegarla en el SQL Editor). Correr
`supabase/pruebas/vista_maestra.sql` y también `roles.sql`, `red_de_sedes.sql`
y `multinegocio.sql`, que no deben cambiar.
Expected: *"Vista maestra: pasaron todas las pruebas."* y las otras tres, igual
que antes.

- [ ] **Paso 5: commit (con aprobación)**

```bash
git -C TP-Ing.-Software-2026c2 add supabase/migrations/20261028030000_076_vista_maestra.sql supabase/pruebas/vista_maestra.sql
git -C TP-Ing.-Software-2026c2 commit -m "Vista maestra: la base (076) y su prueba"
```

---

### Tarea 2: La API — quién soy y el freno de los pedidos que cambian algo

**Archivos:**
- Modificar: `TP-IngeSoft-API/src/lib/database.types.ts` (columna y funciones nuevas)
- Modificar: `TP-IngeSoft-API/src/compartido/quien-soy.ts`
- Crear: `TP-IngeSoft-API/src/http/middlewares/solo-mirar.ts`
- Modificar: `TP-IngeSoft-API/src/servidor.ts:66-68`
- Modificar: `TP-IngeSoft-API/pruebas/apoyo/afirmar.ts` (`quien`, `quienCon`) y `src/modules/payments/case-payments.ts:169` (el `Quien` de mentira)
- Crear: `TP-IngeSoft-API/pruebas/casos-de-uso/solo-mirar.test.ts`

**Interfaces:**
- Consume: `usuario.vista_maestra_desde` (Tarea 1).
- Produce: `Quien.vistaMaestra: boolean`; `dejaPasarEnVistaMaestra(metodo: string, ruta: string): boolean`; middleware `soloMirarEnVistaMaestra`; error `{ codigo: "vista_maestra", estado: 403 }`.

- [ ] **Paso 1: la prueba que falla**

`pruebas/casos-de-uso/solo-mirar.test.ts`:

```ts
// El freno de la vista maestra en la API: sin Supabase, sin HTTP.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dejaPasarEnVistaMaestra, soloMirarEnVistaMaestra } from "../../src/http/middlewares/solo-mirar.js";
import { fallaCon } from "../apoyo/afirmar.js";

const pedido = (method: string, path: string, desde: string | null) => ({
    method, path,
    usuario: { id: "u-1" },
    db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { vista_maestra_desde: desde }, error: null }) }) }) }) },
}) as never;

describe("qué deja pasar en vista maestra", () => {
    test("leer, siempre", () => {
        assert.equal(dejaPasarEnVistaMaestra("GET", "/casos"), true);
        assert.equal(dejaPasarEnVistaMaestra("HEAD", "/casos"), true);
    });
    test("lo de la vista maestra, entrar a un negocio y la sesión", () => {
        assert.equal(dejaPasarEnVistaMaestra("POST", "/vista-maestra/negocio"), true);
        assert.equal(dejaPasarEnVistaMaestra("DELETE", "/vista-maestra"), true);
        assert.equal(dejaPasarEnVistaMaestra("POST", "/cuenta/negocio"), true);
        assert.equal(dejaPasarEnVistaMaestra("DELETE", "/sesiones"), true);
    });
    test("cambiar cualquier otra cosa, no", () => {
        assert.equal(dejaPasarEnVistaMaestra("POST", "/casos"), false);
        assert.equal(dejaPasarEnVistaMaestra("PUT", "/cuenta/perfil"), false);
        assert.equal(dejaPasarEnVistaMaestra("POST", "/vista-maestra-falsa"), false);
    });
});

describe("el middleware", () => {
    test("en vista maestra, un POST a /casos falla con vista_maestra", async () => {
        await fallaCon(soloMirarEnVistaMaestra(pedido("POST", "/casos", "neg-a"), {} as never, () => {}), "vista_maestra", 403);
    });
    test("fuera de vista maestra, pasa", async () => {
        let paso = false;
        await soloMirarEnVistaMaestra(pedido("POST", "/casos", null), {} as never, () => { paso = true; });
        assert.equal(paso, true);
    });
});
```

- [ ] **Paso 2: verla fallar**

Run (desde `TP-IngeSoft-API`): `node --import tsx --test pruebas/casos-de-uso/solo-mirar.test.ts`
Expected: FAIL, *Cannot find module .../solo-mirar.js*.

- [ ] **Paso 3: el middleware**

`src/http/middlewares/solo-mirar.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { ErrorDeNegocio } from "../../compartido/errores.js";

// En vista maestra (docs/vista-maestra.md del front) se mira y no se cambia
// nada. La base ya frena toda escritura (076), pero algunos pedidos hacen algo
// antes de escribir —mandar un WhatsApp o un mail—, y eso no se deshace. Por
// eso se corta acá, antes de que llegue a la ruta.
//
// Pasan: leer, lo de la propia vista maestra (mirar otro, salir, elegir qué se
// ve), entrar a un negocio ("Editar en este negocio") y la sesión.

const LIBRES = [/^\/vista-maestra(\/|$)/, /^\/cuenta\/negocio$/, /^\/cuenta\/preferencias$/, /^\/sesiones(\/|$)/];

export const dejaPasarEnVistaMaestra = (metodo: string, ruta: string) =>
    metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS" || LIBRES.some((r) => r.test(ruta));

export const EnVistaMaestra = () => new ErrorDeNegocio(403, "vista_maestra",
    "Estás en vista maestra: es sólo para mirar. Salí de la vista para cambiar algo.");

export async function soloMirarEnVistaMaestra(req: Request, _res: Response, siguiente: NextFunction) {
    if (dejaPasarEnVistaMaestra(req.method, req.path)) return siguiente();
    const { data, error } = await req.db.from("usuario").select("vista_maestra_desde").eq("id", req.usuario.id).maybeSingle();
    if (error) throw error;
    if (data?.vista_maestra_desde) throw EnVistaMaestra();
    siguiente();
}
```

En `src/servidor.ts`, justo después de `app.use("/v1", sesion);`:

```ts
    app.use("/v1", soloMirarEnVistaMaestra);
```

con su `import { soloMirarEnVistaMaestra } from "./http/middlewares/solo-mirar.js";`.

- [ ] **Paso 4: `quienSoy` y los tipos**

En `src/lib/database.types.ts`, en `usuario` → `Row`, `Insert` y `Update`, agregar
`vista_maestra_desde: string | null` (en `Insert`/`Update` con `?`), y en
`Functions` las de la Tarea 1 con el mismo formato que `entrar_de_visita` y
`mis_sedes` (si el equipo regenera los tipos con `supabase gen types`, hacerlo
así en vez de a mano):

```ts
      entrar_a_vista_maestra: { Args: never; Returns: string }
      mirar_en_vista_maestra: { Args: { p_negocio: string }; Returns: undefined }
      salir_de_vista_maestra: { Args: never; Returns: string | null }
      mi_vista_maestra: { Args: never; Returns: Json }
      guardar_negocios_de_vista_maestra: { Args: { p_negocios: Json }; Returns: undefined }
      guardar_grupo_de_negocios: { Args: { p_grupo: string | null; p_nombre: string; p_negocios: string[] }; Returns: string }
      borrar_grupo_de_negocios: { Args: { p_grupo: string }; Returns: undefined }
      urgencias_de_mis_negocios: {
        Args: never
        Returns: { negocio_id: string; casos_atrasados: number; stock_bajo: number }[]
      }
```

En `src/compartido/quien-soy.ts`: `select("negocio_id, nombre, visitando_desde, vista_maestra_desde")`,
en el tipo `vistaMaestra: boolean;` con el comentario
`// En vista maestra (076): sólo lectura, en todos sus negocios.`, y en el
`return` `vistaMaestra: Boolean(data.vista_maestra_desde),`. Agregar
`vistaMaestra: false` en `quien()` y `quienCon()` de `pruebas/apoyo/afirmar.ts`
y en el `Quien` de `src/modules/payments/case-payments.ts:169`.

- [ ] **Paso 5: correr todo**

Run (desde `TP-IngeSoft-API`): `npm.cmd run tipos` y `npm.cmd run test:pruebas`
Expected: sin errores de tipos; todas pasan, incluida `solo-mirar.test.ts`.

- [ ] **Paso 6: commit (con aprobación)**

```bash
git -C TP-IngeSoft-API add src/http/middlewares/solo-mirar.ts src/servidor.ts src/compartido/quien-soy.ts src/lib/database.types.ts src/modules/payments/case-payments.ts pruebas/apoyo/afirmar.ts pruebas/casos-de-uso/solo-mirar.test.ts
git -C TP-IngeSoft-API commit -m "Vista maestra: la API no deja cambiar nada"
```

---

### Tarea 3: La API — el módulo `vista-maestra`

**Archivos:**
- Crear: `TP-IngeSoft-API/src/modulos/vista-maestra/{rutas,casos-de-uso,repositorio,esquemas,errores}.ts`
- Modificar: `TP-IngeSoft-API/src/servidor.ts` (montar `rutasVistaMaestra`)
- Crear: `TP-IngeSoft-API/pruebas/casos-de-uso/vista-maestra.test.ts`
- Modificar: `TP-Ing.-Software-2026c2/docs/api.md` (los endpoints nuevos, como se agregaron los de R-10b)

**Interfaces:**
- Consume: las funciones de la Tarea 1; `ErrorDeNegocio`, `NoEncontrado`.
- Produce (todas bajo `/v1`, con sesión):
  - `GET /vista-maestra` → `{ negocios, grupos, urgencias: [{ negocio_id, casos_atrasados, stock_bajo }] }`
  - `POST /vista-maestra` → `{ negocio_id }` (entrar)
  - `POST /vista-maestra/negocio` body `{ negocio_id }` → `{ negocio_id }` (mirar)
  - `DELETE /vista-maestra` → `{ negocio_id: string | null }` (salir)
  - `PUT /vista-maestra/negocios` body `{ negocios: [{ id, prendido }] }` → igual que el GET
  - `POST /vista-maestra/grupos` body `{ nombre, negocios: [uuid] }` → igual que el GET
  - `PUT /vista-maestra/grupos/:id` body `{ nombre, negocios }` → igual que el GET
  - `DELETE /vista-maestra/grupos/:id` → igual que el GET
  - Errores: `P0001` → 422 `vista_maestra_regla` con el mensaje de la base; `42501` → 403 `sin_permiso`.

- [ ] **Paso 1: la prueba que falla**

`pruebas/casos-de-uso/vista-maestra.test.ts`:

```ts
// La vista maestra, con un repositorio de mentira: sin Supabase, sin HTTP.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as VM from "../../src/modulos/vista-maestra/casos-de-uso.js";
import type { RepositorioVistaMaestra, Resultado } from "../../src/modulos/vista-maestra/repositorio.js";
import { fallaCon, ID, noPasaElEsquema } from "../apoyo/afirmar.js";

const bien = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const regla = (mensaje: string): Resultado<never> => ({ ok: false, rechazo: { por: "regla", mensaje } });

function repoFalso(sobre: Partial<RepositorioVistaMaestra> = {}) {
    const llamadas: unknown[][] = [];
    const repo: RepositorioVistaMaestra = {
        async config() { return bien({ negocios: [], grupos: [] }); },
        async urgencias() { return bien([{ negocio_id: ID, casos_atrasados: 1, stock_bajo: 0 }]); },
        async entrar() { return bien(ID); },
        async mirar(id) { llamadas.push(["mirar", id]); return bien(null); },
        async salir() { return bien(null); },
        async guardarNegocios(l) { llamadas.push(["negocios", l]); return bien(null); },
        async guardarGrupo(id, nombre, negocios) { llamadas.push(["grupo", id, nombre, negocios]); return bien(ID); },
        async borrarGrupo(id) { llamadas.push(["borrar", id]); return bien(null); },
        ...sobre,
    };
    return { repo, llamadas };
}

describe("vista maestra", () => {
    test("ver junta la configuración y las urgencias", async () => {
        const { repo } = repoFalso();
        const r = await VM.ver({ repo });
        assert.deepEqual(r.urgencias, [{ negocio_id: ID, casos_atrasados: 1, stock_bajo: 0 }]);
        assert.deepEqual(r.negocios, []);
    });

    test("mirar un id que no es uuid es 404, sin llamar a la base", async () => {
        const { repo, llamadas } = repoFalso();
        await fallaCon(VM.mirar({ repo }, { negocio_id: "x" }), "no_encontrado", 404);
        assert.deepEqual(llamadas, []);
    });

    test("lo que la base rechaza pasa con su mensaje", async () => {
        const { repo } = repoFalso({ async guardarNegocios() { return regla("Estás mirándolo."); } });
        await assert.rejects(VM.guardarNegocios({ repo }, { negocios: [{ id: ID, prendido: false }] }), (e: Error & { codigo?: string }) => {
            assert.equal(e.codigo, "vista_maestra_regla");
            assert.equal(e.message, "Estás mirándolo.");
            return true;
        });
    });

    test("un grupo sin nombre no pasa el esquema", async () => {
        const { repo } = repoFalso();
        await noPasaElEsquema(VM.crearGrupo({ repo }, { nombre: "", negocios: [] }));
    });

    test("crear un grupo manda nombre recortado y negocios", async () => {
        const { repo, llamadas } = repoFalso();
        await VM.crearGrupo({ repo }, { nombre: "  Zona sur ", negocios: [ID] });
        assert.deepEqual(llamadas[0], ["grupo", null, "Zona sur", [ID]]);
    });
});
```

- [ ] **Paso 2: verla fallar**

Run (desde `TP-IngeSoft-API`): `node --import tsx --test pruebas/casos-de-uso/vista-maestra.test.ts`
Expected: FAIL, *Cannot find module*.

- [ ] **Paso 3: el módulo**

`src/modulos/vista-maestra/errores.ts`:

```ts
import { ErrorDeNegocio } from "../../compartido/errores.js";

// Los mensajes vienen de la base (076), ya escritos para la persona.

export const SinPermiso = (mensaje: string) => new ErrorDeNegocio(403, "sin_permiso", mensaje);

export const ReglaDeVistaMaestra = (mensaje: string) => new ErrorDeNegocio(422, "vista_maestra_regla", mensaje);
```

`src/modulos/vista-maestra/esquemas.ts`:

```ts
import { z } from "zod";

export const mirar = z.object({ negocio_id: z.uuid() });

export const negocios = z.object({
    negocios: z.array(z.object({ id: z.uuid(), prendido: z.boolean() })).max(200),
});

export const grupo = z.object({
    nombre: z.string().trim().min(1).max(60),
    negocios: z.array(z.uuid()).max(200),
});
```

`src/modulos/vista-maestra/repositorio.ts`:

```ts
import type { Db } from "../../compartido/supabase.js";

// La vista maestra, por las funciones de la 076. Cuando la base dice que no,
// se devuelve el porqué ({ rechazo }) y el caso de uso decide qué error es,
// como en sedes/repositorio.ts. Cualquier otra falla sale como error (500).

export type Rechazo = { por: "permiso" | "regla"; mensaje: string };
export type Resultado<T> = { ok: true; valor: T } | { ok: false; rechazo: Rechazo };
export type Urgencia = { negocio_id: string; casos_atrasados: number; stock_bajo: number };
export type Config = { negocios: unknown[]; grupos: unknown[] };

export type RepositorioVistaMaestra = {
    config(): Promise<Resultado<Config>>;
    urgencias(): Promise<Resultado<Urgencia[]>>;
    entrar(): Promise<Resultado<string>>;
    mirar(negocio: string): Promise<Resultado<null>>;
    salir(): Promise<Resultado<string | null>>;
    guardarNegocios(lista: { id: string; prendido: boolean }[]): Promise<Resultado<null>>;
    guardarGrupo(id: string | null, nombre: string, negocios: string[]): Promise<Resultado<string>>;
    borrarGrupo(id: string): Promise<Resultado<null>>;
};

type ErrorDeLaBase = { code?: string; message: string } | null;

function resultado<T>(data: T, error: ErrorDeLaBase): Resultado<T> {
    if (error?.code === "42501") return { ok: false, rechazo: { por: "permiso", mensaje: error.message } };
    if (error?.code === "P0001") return { ok: false, rechazo: { por: "regla", mensaje: error.message } };
    if (error) throw error;
    return { ok: true, valor: data };
}

export function repositorio(db: Db): RepositorioVistaMaestra {
    return {
        async config() {
            const { data, error } = await db.rpc("mi_vista_maestra");
            return resultado((data ?? { negocios: [], grupos: [] }) as Config, error);
        },
        async urgencias() {
            const { data, error } = await db.rpc("urgencias_de_mis_negocios");
            return resultado(data ?? [], error);
        },
        async entrar() {
            const { data, error } = await db.rpc("entrar_a_vista_maestra");
            return resultado(data as string, error);
        },
        async mirar(negocio) {
            const { error } = await db.rpc("mirar_en_vista_maestra", { p_negocio: negocio });
            return resultado(null, error);
        },
        async salir() {
            const { data, error } = await db.rpc("salir_de_vista_maestra");
            return resultado((data ?? null) as string | null, error);
        },
        async guardarNegocios(lista) {
            const { error } = await db.rpc("guardar_negocios_de_vista_maestra", { p_negocios: lista });
            return resultado(null, error);
        },
        async guardarGrupo(id, nombre, negocios) {
            const { data, error } = await db.rpc("guardar_grupo_de_negocios", { p_grupo: id, p_nombre: nombre, p_negocios: negocios });
            return resultado(data as string, error);
        },
        async borrarGrupo(id) {
            const { error } = await db.rpc("borrar_grupo_de_negocios", { p_grupo: id });
            return resultado(null, error);
        },
    };
}
```

`src/modulos/vista-maestra/casos-de-uso.ts`:

```ts
import { z } from "zod";
import { NoEncontrado } from "../../compartido/errores.js";
import { ReglaDeVistaMaestra, SinPermiso } from "./errores.js";
import * as Esquemas from "./esquemas.js";
import type { Rechazo, RepositorioVistaMaestra, Resultado } from "./repositorio.js";

// La vista maestra (docs/vista-maestra.md del front). Qué negocios son de la
// cuenta, qué se puede mirar y qué no se apaga lo decide la base (076): acá no
// se repite, para que cambie en un solo lugar.

export type Contexto = { repo: RepositorioVistaMaestra };

const error = (r: Rechazo) => (r.por === "permiso" ? SinPermiso(r.mensaje) : ReglaDeVistaMaestra(r.mensaje));

function valor<T>(r: Resultado<T>): T {
    if (!r.ok) throw error(r.rechazo);
    return r.valor;
}

export async function ver({ repo }: Contexto) {
    const [config, urgencias] = await Promise.all([repo.config(), repo.urgencias()]);
    return { ...valor(config), urgencias: valor(urgencias) };
}

export async function entrar({ repo }: Contexto) {
    return { negocio_id: valor(await repo.entrar()) };
}

export async function mirar({ repo }: Contexto, entrada: unknown) {
    const leido = Esquemas.mirar.safeParse(entrada ?? {});
    if (!leido.success) throw NoEncontrado();
    valor(await repo.mirar(leido.data.negocio_id));
    return { negocio_id: leido.data.negocio_id };
}

export async function salir({ repo }: Contexto) {
    return { negocio_id: valor(await repo.salir()) };
}

export async function guardarNegocios(ctx: Contexto, entrada: unknown) {
    const { negocios } = Esquemas.negocios.parse(entrada ?? {});
    valor(await ctx.repo.guardarNegocios(negocios));
    return ver(ctx);
}

export async function crearGrupo(ctx: Contexto, entrada: unknown) {
    const { nombre, negocios } = Esquemas.grupo.parse(entrada ?? {});
    valor(await ctx.repo.guardarGrupo(null, nombre, negocios));
    return ver(ctx);
}

export async function cambiarGrupo(ctx: Contexto, id: string, entrada: unknown) {
    if (!z.uuid().safeParse(id).success) throw NoEncontrado();
    const { nombre, negocios } = Esquemas.grupo.parse(entrada ?? {});
    valor(await ctx.repo.guardarGrupo(id, nombre, negocios));
    return ver(ctx);
}

export async function borrarGrupo(ctx: Contexto, id: string) {
    if (!z.uuid().safeParse(id).success) throw NoEncontrado();
    valor(await ctx.repo.borrarGrupo(id));
    return ver(ctx);
}
```

`src/modulos/vista-maestra/rutas.ts`:

```ts
import { Router, type Request } from "express";
import { ok } from "../../http/respuestas.js";
import * as CasosDeUso from "./casos-de-uso.js";
import { repositorio } from "./repositorio.js";

// Finas: arman el contexto, llaman al caso de uso y responden.
// Crear un grupo no lleva Idempotency-Key: el nombre es único por cuenta, así
// que un reintento da "Ya tenés un grupo con ese nombre." y no lo duplica.

export const rutasVistaMaestra = Router();

const contexto = (req: Request): CasosDeUso.Contexto => ({ repo: repositorio(req.db) });

rutasVistaMaestra.get("/vista-maestra", async (req, res) => {
    res.json(ok(await CasosDeUso.ver(contexto(req))));
});
rutasVistaMaestra.post("/vista-maestra", async (req, res) => {
    res.json(ok(await CasosDeUso.entrar(contexto(req))));
});
rutasVistaMaestra.post("/vista-maestra/negocio", async (req, res) => {
    res.json(ok(await CasosDeUso.mirar(contexto(req), req.body)));
});
rutasVistaMaestra.delete("/vista-maestra", async (req, res) => {
    res.json(ok(await CasosDeUso.salir(contexto(req))));
});
rutasVistaMaestra.put("/vista-maestra/negocios", async (req, res) => {
    res.json(ok(await CasosDeUso.guardarNegocios(contexto(req), req.body)));
});
rutasVistaMaestra.post("/vista-maestra/grupos", async (req, res) => {
    res.json(ok(await CasosDeUso.crearGrupo(contexto(req), req.body)));
});
rutasVistaMaestra.put("/vista-maestra/grupos/:id", async (req, res) => {
    res.json(ok(await CasosDeUso.cambiarGrupo(contexto(req), String(req.params.id), req.body)));
});
rutasVistaMaestra.delete("/vista-maestra/grupos/:id", async (req, res) => {
    res.json(ok(await CasosDeUso.borrarGrupo(contexto(req), String(req.params.id))));
});
```

En `src/servidor.ts`: `import { rutasVistaMaestra } from "./modulos/vista-maestra/rutas.js";` y
`app.use("/v1", rutasVistaMaestra);` después de `app.use("/v1", rutasSedes);`.

- [ ] **Paso 4: correr**

Run (desde `TP-IngeSoft-API`): `npm.cmd run tipos` y `npm.cmd run test:pruebas`
Expected: todo pasa.

- [ ] **Paso 5: `docs/api.md` del front**

Agregar una sección **"Vista maestra"** con la tabla de los 8 endpoints de
arriba (método, ruta, qué hace, qué devuelve) y la línea: *"En vista maestra,
todo pedido que no sea GET, fuera de estos y de `/cuenta/negocio`,
`/cuenta/preferencias` y `/sesiones`, da 403 `vista_maestra`."*

- [ ] **Paso 6: commit (con aprobación), uno por repo**

```bash
git -C TP-IngeSoft-API add src/modulos/vista-maestra src/servidor.ts pruebas/casos-de-uso/vista-maestra.test.ts
git -C TP-IngeSoft-API commit -m "Vista maestra: los endpoints"
git -C TP-Ing.-Software-2026c2 add docs/api.md
git -C TP-Ing.-Software-2026c2 commit -m "Vista maestra: los endpoints en docs/api.md"
```

---

### Tarea 4: El front — la lógica pura

**Archivos:**
- Crear: `TP-Ing.-Software-2026c2/src/lib/vista-maestra.js`
- Crear: `TP-Ing.-Software-2026c2/pruebas/vista-maestra.test.js`

**Interfaces:**
- Consume: la forma de `GET /vista-maestra` (Tarea 3).
- Produce:
  - `delSelector(negocios) → negocio[]` (prendidos, por `orden`)
  - `negocioDelAtajo(evento, selector) → string | null`
  - `conPrendido(negocios, id, prendido, mirandoId) → negocio[]`
  - `conGrupo(negocios, grupo, prender, mirandoId) → negocio[]`
  - `estadoDelGrupo(negocios, grupo) → "prendido" | "apagado" | "mezclado"`
  - `mover(negocios, id, paso) → negocio[]` y `moverA(negocios, id, destinoId) → negocio[]`
  - `paraGuardar(negocios) → { id, prendido }[]`
  - `motivoParaEntrar({ enVista, cantidad }, t) → string | null`
  - `hayUrgencia(u) → boolean`
  - Llamadas: `verVistaMaestra(token)`, `guardarNegociosDeVista(negocios, token)`, `crearGrupo({ nombre, negocios }, token)`, `cambiarGrupo(id, { nombre, negocios }, token)`, `borrarGrupo(id, token)` — todas `{ ok, vista } | { ok: false, error }`.

- [ ] **Paso 1: la prueba que falla**

`pruebas/vista-maestra.test.js`:

```js
// Correr con: npm run test:unit
//
// La vista maestra (docs/vista-maestra.md): qué muestra el selector, los
// atajos, y qué se prende o apaga.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  conGrupo, conPrendido, delSelector, estadoDelGrupo, hayUrgencia, motivoParaEntrar,
  mover, moverA, negocioDelAtajo, paraGuardar,
} from "../src/lib/vista-maestra.js";

const A = { id: "a", nombre: "Centro", prendido: true, orden: 1 };
const B = { id: "b", nombre: "Sur", prendido: false, orden: 0 };
const C = { id: "c", nombre: "Norte", prendido: true, orden: 2 };
const tecla = (code, mas = {}) => ({ code, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, ...mas });
const t = (clave) => clave;

test("el selector: sólo los prendidos, en su orden", () => {
  assert.deepEqual(delSelector([C, B, A]).map((n) => n.id), ["a", "c"]);
});

test("Alt+1 es el primero del selector y Alt+2 el segundo", () => {
  const sel = delSelector([A, B, C]);
  assert.equal(negocioDelAtajo(tecla("Digit1"), sel), "a");
  assert.equal(negocioDelAtajo(tecla("Digit2"), sel), "c");
});

test("sin Alt, con Ctrl, o fuera del selector, nada", () => {
  const sel = delSelector([A, C]);
  assert.equal(negocioDelAtajo(tecla("Digit1", { altKey: false }), sel), null);
  assert.equal(negocioDelAtajo(tecla("Digit1", { ctrlKey: true }), sel), null);
  assert.equal(negocioDelAtajo(tecla("Digit3"), sel), null);
  assert.equal(negocioDelAtajo(tecla("Digit0"), sel), null);
  assert.equal(negocioDelAtajo(tecla("KeyA"), sel), null);
});

test("en la Mac Option+1 escribe '¡', pero el código sigue siendo Digit1", () => {
  assert.equal(negocioDelAtajo({ ...tecla("Digit1"), key: "¡" }, delSelector([A, C])), "a");
});

test("el que se está mirando no se apaga", () => {
  assert.equal(conPrendido([A, C], "a", false, "a").find((n) => n.id === "a").prendido, true);
  assert.equal(conPrendido([A, C], "c", false, "a").find((n) => n.id === "c").prendido, false);
});

test("apagar un grupo deja prendido el que se está mirando", () => {
  const grupo = { id: "g", negocios: ["a", "c"] };
  const r = conGrupo([A, B, C], grupo, false, "a");
  assert.deepEqual(r.map((n) => [n.id, n.prendido]), [["a", true], ["b", false], ["c", false]]);
  assert.deepEqual(conGrupo([A, B, C], { id: "g", negocios: ["b"] }, true, "a").find((n) => n.id === "b").prendido, true);
});

test("estado del grupo", () => {
  assert.equal(estadoDelGrupo([A, C], { negocios: ["a", "c"] }), "prendido");
  assert.equal(estadoDelGrupo([A, B], { negocios: ["a", "b"] }), "mezclado");
  assert.equal(estadoDelGrupo([B], { negocios: ["b"] }), "apagado");
});

test("subir y bajar renumeran el orden y no se pasan de los bordes", () => {
  assert.deepEqual(mover([A, B, C], "a", -1).map((n) => [n.id, n.orden]), [["a", 0], ["b", 1], ["c", 2]]);
  assert.deepEqual(mover([A, B, C], "b", -1).map((n) => n.id), ["b", "a", "c"]);
  assert.deepEqual(mover([A, B, C], "c", 1).map((n) => n.id), ["b", "a", "c"]);
});

test("arrastrar uno encima de otro lo pone en su lugar", () => {
  assert.deepEqual(moverA([A, B, C], "c", "b").map((n) => n.id), ["c", "b", "a"]);
  assert.deepEqual(moverA([A, B, C], "b", "c").map((n) => n.id), ["a", "c", "b"]);
});

test("para guardar: en orden, sólo id y prendido", () => {
  assert.deepEqual(paraGuardar([A, B, C]), [
    { id: "b", prendido: false }, { id: "a", prendido: true }, { id: "c", prendido: true },
  ]);
});

test("por qué no se puede entrar", () => {
  assert.equal(motivoParaEntrar({ enVista: true, cantidad: 3 }, t), "vistaMaestra.yaEstas");
  assert.equal(motivoParaEntrar({ enVista: false, cantidad: 1 }, t), "vistaMaestra.faltanNegocios");
  assert.equal(motivoParaEntrar({ enVista: false, cantidad: 2 }, t), null);
});

test("urgencia", () => {
  assert.equal(hayUrgencia({ casos_atrasados: 0, stock_bajo: 0 }), false);
  assert.equal(hayUrgencia({ casos_atrasados: 1, stock_bajo: 0 }), true);
  assert.equal(hayUrgencia(undefined), false);
});
```

- [ ] **Paso 2: verla fallar**

Run (desde `TP-Ing.-Software-2026c2`): `npm.cmd run test:unit -- pruebas/vista-maestra.test.js`
Expected: FAIL, *Cannot find module '../src/lib/vista-maestra.js'*.

- [ ] **Paso 3: la lógica**

`src/lib/vista-maestra.js`:

```js
// La vista maestra, del lado de la aplicación (docs/vista-maestra.md).
//
// Qué muestra el selector, qué atajo va a qué negocio, y qué se prende o
// apaga. Qué es de la cuenta y qué no se puede apagar lo decide la base (076):
// esto sólo evita ofrecer lo que va a rechazar.

import { mandar, quitar, reemplazar, traer } from "./api.js";

const porOrden = (a, b) => a.orden - b.orden;

export const delSelector = (negocios = []) => negocios.filter((n) => n.prendido).sort(porOrden);

// Alt+1…Alt+9 → el negocio de esa posición del selector. Se mira event.code y
// no event.key: en la Mac, Option+1 escribe "¡" y con otra distribución de
// teclado el número puede estar en otro lado.
export function negocioDelAtajo(evento, selector) {
  if (!evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return null;
  const numero = /^Digit([1-9])$/.exec(evento.code ?? "")?.[1];
  return numero ? (selector[Number(numero) - 1]?.id ?? null) : null;
}

// El que se está mirando no se apaga (decisión 9): el interruptor ya dice por
// qué, y la base igual lo rechaza.
export function conPrendido(negocios, id, prendido, mirandoId) {
  if (!prendido && id === mirandoId) return negocios;
  return negocios.map((n) => (n.id === id ? { ...n, prendido } : n));
}

export function conGrupo(negocios, grupo, prender, mirandoId) {
  const delGrupo = new Set(grupo.negocios);
  return negocios.map((n) => (delGrupo.has(n.id) ? { ...n, prendido: prender || n.id === mirandoId } : n));
}

export function estadoDelGrupo(negocios, grupo) {
  const suyos = negocios.filter((n) => grupo.negocios.includes(n.id));
  if (suyos.length && suyos.every((n) => n.prendido)) return "prendido";
  if (suyos.some((n) => n.prendido)) return "mezclado";
  return "apagado";
}

const renumerar = (lista) => lista.map((n, i) => ({ ...n, orden: i }));

// Subir (-1) o bajar (+1) un lugar: lo mismo que arrastrar, para quien usa
// teclado o lector de pantalla.
export function mover(negocios, id, paso) {
  const lista = [...negocios].sort(porOrden);
  const i = lista.findIndex((n) => n.id === id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= lista.length) return renumerar(lista);
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return renumerar(lista);
}

// Soltar uno arrastrado encima de otro: queda en el lugar de ése.
export function moverA(negocios, id, destinoId) {
  const lista = [...negocios].sort(porOrden);
  const desde = lista.findIndex((n) => n.id === id);
  const hasta = lista.findIndex((n) => n.id === destinoId);
  if (desde < 0 || hasta < 0) return renumerar(lista);
  const [movido] = lista.splice(desde, 1);
  lista.splice(hasta, 0, movido);
  return renumerar(lista);
}

export const paraGuardar = (negocios) => [...negocios].sort(porOrden).map(({ id, prendido }) => ({ id, prendido }));

export function motivoParaEntrar({ enVista, cantidad }, t) {
  if (enVista) return t("vistaMaestra.yaEstas");
  if (cantidad < 2) return t("vistaMaestra.faltanNegocios");
  return null;
}

export const hayUrgencia = (u) => Boolean(u && (u.casos_atrasados > 0 || u.stock_bajo > 0));

// --- Las llamadas a la API, con el token de la sesión ---

const conVista = (r) => (r.ok ? { ok: true, vista: r.datos } : { ok: false, error: r.error });

export const verVistaMaestra = async (token) => conVista(await traer("/vista-maestra", token));

export const guardarNegociosDeVista = async (negocios, token) =>
  conVista(await reemplazar("/vista-maestra/negocios", { negocios: paraGuardar(negocios) }, token));

export const crearGrupo = async ({ nombre, negocios }, token) =>
  conVista(await mandar("/vista-maestra/grupos", { nombre, negocios }, token));

export const cambiarGrupo = async (id, { nombre, negocios }, token) =>
  conVista(await reemplazar(`/vista-maestra/grupos/${id}`, { nombre, negocios }, token));

export const borrarGrupo = async (id, token) => conVista(await quitar(`/vista-maestra/grupos/${id}`, token));
```

- [ ] **Paso 4: correr**

Run: `npm.cmd run test:unit -- pruebas/vista-maestra.test.js pruebas/fronteras.test.js`
Expected: PASS las dos.

- [ ] **Paso 5: commit (con aprobación)**

```bash
git -C TP-Ing.-Software-2026c2 add src/lib/vista-maestra.js pruebas/vista-maestra.test.js
git -C TP-Ing.-Software-2026c2 commit -m "Vista maestra: la lógica del selector, los atajos y los grupos"
```

---

### Tarea 5: El front — entrar, mirar y salir (`auth.js`) y los textos

**Archivos:**
- Modificar: `TP-Ing.-Software-2026c2/src/lib/auth.js` (junto a `entrarAlNegocio`, ~línea 353)
- Modificar: `TP-Ing.-Software-2026c2/src/lib/idiomas/es.js` y `en.js` (clave nueva `vistaMaestra`, al nivel de `cuenta`)

**Interfaces:**
- Consume: `POST/DELETE /vista-maestra`, `POST /vista-maestra/negocio` (Tarea 3).
- Produce, en `useAuth()`:
  - `usuario.vista_maestra_desde` (viene solo: `/cuenta` hace `select("*")`)
  - `entrarAVistaMaestra() → { ok } | { ok: false, error }`
  - `mirarEnVistaMaestra(negocioId) → { ok } | { ok: false, error }`
  - `salirDeVistaMaestra() → { ok, negocioId: string | null } | { ok: false, error }`
- Produce las claves `vistaMaestra.*` que usan las Tareas 6 a 8.

- [ ] **Paso 1: las tres acciones**

En `auth.js`, después de `entrarAlNegocio`, con el mismo patrón (vuelven a leer
`usuario` y con eso `datos.js` recarga el negocio nuevo solo, porque mira
`usuario.negocio_id`):

```js
      // La vista maestra (docs/vista-maestra.md): mirar todos los negocios de
      // la cuenta sin cambiar nada. Como la visita entre sedes, cada negocio
      // que se mira pasa a ser el activo; la base frena toda escritura
      // mientras dure (076).
      async entrarAVistaMaestra() {
        if (!hayCuentas) return { ok: false, error: { codigo: "sin_sesion", mensaje: "No hay una sesión abierta." } };
        const r = await mandar("/vista-maestra", {}, sesion?.access_token);
        if (!r.ok) return { ok: false, error: r.error };
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user, sesion.access_token));
        return { ok: true };
      },

      async mirarEnVistaMaestra(negocioId) {
        if (!hayCuentas) return { ok: false, error: { codigo: "sin_sesion", mensaje: "No hay una sesión abierta." } };
        const r = await mandar("/vista-maestra/negocio", { negocio_id: negocioId }, sesion?.access_token);
        if (!r.ok) return { ok: false, error: r.error };
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user, sesion.access_token));
        return { ok: true };
      },

      // Vuelve al negocio de antes; si ya no está ahí, a ninguno, y la
      // Guardia lleva al selector de negocios.
      async salirDeVistaMaestra() {
        if (!hayCuentas) return { ok: false, error: { codigo: "sin_sesion", mensaje: "No hay una sesión abierta." } };
        const r = await quitar("/vista-maestra", sesion?.access_token);
        if (!r.ok) return { ok: false, error: r.error };
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user, sesion.access_token));
        return { ok: true, negocioId: r.datos.negocio_id ?? null };
      },
```

Importar `quitar` de `./api.js` si `auth.js` no lo importa todavía.

- [ ] **Paso 2: los textos**

En `es.js`, al nivel de `cuenta`:

```js
  vistaMaestra: {
    titulo: "Vista maestra",
    entrar: "Vista maestra",
    yaEstas: "Ya estás en vista maestra.",
    faltanNegocios: "Hace falta más de un negocio.",
    salir: "Salir de vista",
    soloLectura: "Vista maestra · sólo lectura · {negocio}",
    editarAca: "Editar en este negocio",
    selector: "Tus negocios en la vista maestra",
    atajo: "Alt+{n}",
    mirando: "Estás mirándolo.",
    urgente: "{casos} · {stock}",
    casosAtrasados: { one: "1 caso atrasado", other: "{n} casos atrasados" },
    stockBajo: { one: "1 con stock bajo", other: "{n} con stock bajo" },
    sinUrgencias: "Todo al día",
    desplegable: {
      abrir: "Elegir qué negocios ver",
      cerrar: "Cerrar",
      negocios: "Negocios",
      grupos: "Grupos",
      nuevoGrupo: "Nuevo grupo",
      nombreGrupo: "Nombre del grupo",
      guardarGrupo: "Guardar grupo",
      borrarGrupo: "Borrar grupo",
      cambiarGrupo: "Cambiar",
      subir: "Subir {negocio}",
      bajar: "Bajar {negocio}",
      arrastrar: "Arrastrá para ordenar",
      mezclado: "Algunos",
    },
    perfilApagado: "Salí de la vista maestra para cambiar tus datos.",
  },
```

En `en.js`, lo mismo en inglés:

```js
  vistaMaestra: {
    titulo: "Master view",
    entrar: "Master view",
    yaEstas: "You're already in master view.",
    faltanNegocios: "You need more than one business.",
    salir: "Leave master view",
    soloLectura: "Master view · read only · {negocio}",
    editarAca: "Edit in this business",
    selector: "Your businesses in master view",
    atajo: "Alt+{n}",
    mirando: "You're looking at it.",
    urgente: "{casos} · {stock}",
    casosAtrasados: { one: "1 overdue job", other: "{n} overdue jobs" },
    stockBajo: { one: "1 low on stock", other: "{n} low on stock" },
    sinUrgencias: "All up to date",
    desplegable: {
      abrir: "Choose which businesses to see",
      cerrar: "Close",
      negocios: "Businesses",
      grupos: "Groups",
      nuevoGrupo: "New group",
      nombreGrupo: "Group name",
      guardarGrupo: "Save group",
      borrarGrupo: "Delete group",
      cambiarGrupo: "Edit",
      subir: "Move {negocio} up",
      bajar: "Move {negocio} down",
      arrastrar: "Drag to reorder",
      mezclado: "Some",
    },
    perfilApagado: "Leave master view to change your details.",
  },
```

> Revisar en `es.js` cómo se escriben los plurales (`{ one, other }` con `{n}`,
> como `sueleVolverDias`) y usar exactamente esa forma.

- [ ] **Paso 3: correr las pruebas de idioma**

Run: `npm.cmd run test:unit -- pruebas/idioma-claves.test.js pruebas/idioma.test.js`
Expected: PASS (las dos lenguas tienen las mismas claves).

- [ ] **Paso 4: commit (con aprobación)**

```bash
git -C TP-Ing.-Software-2026c2 add src/lib/auth.js src/lib/idiomas/es.js src/lib/idiomas/en.js
git -C TP-Ing.-Software-2026c2 commit -m "Vista maestra: entrar, mirar y salir, y sus textos"
```

---

### Tarea 6: El front — el botón en Mi perfil

**Archivos:**
- Modificar: `TP-Ing.-Software-2026c2/src/app/perfil/page.js:214` (el `<h1>`) y la sección "Tu cuenta"

**Interfaces:**
- Consume: `useAuth().entrarAVistaMaestra`, `misNegocios`, `usuario.vista_maestra_desde`; `motivoParaEntrar` (Tarea 4); `Boton` de `ui.js`.

- [ ] **Paso 1: el encabezado**

Reemplazar el `<h1>` por una fila con el botón a la derecha. Los negocios ya se
piden en esta pantalla para "Tus negocios" (`TusNegocios.js`); si la lista vive
adentro de ese componente, subir el pedido de `misNegocios()` a `page.js` y
pasársela, en vez de pedirla dos veces.

```jsx
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-pantalla">{t("cuenta.titulo")}</h1>
        {/* Arriba a la derecha (docs/vista-maestra.md). Borde y no azul: el
            botón azul de la pantalla es el de guardar los datos. */}
        <Boton
          icono="ojo"
          onClick={entrarAVista}
          motivo={motivoParaEntrar({ enVista: enVista, cantidad: negocios.length }, t)}
          data-testid="entrar-vista-maestra"
        >
          {t("vistaMaestra.entrar")}
        </Boton>
      </div>
```

con, arriba en el componente:

```js
  const enVista = Boolean(usuario?.vista_maestra_desde);
  async function entrarAVista() {
    const r = await entrarAVistaMaestra();
    if (r.ok) router.push("/");
    else setError(r.error.mensaje);
  }
```

(`setError` es el estado de error que ya usa la pantalla para `guardarPerfil`;
usar ése. Sin base —modo de ejemplo— `misNegocios()` da `ok: false`: tratar la
lista como vacía, y el botón queda apagado con *"Hace falta más de un
negocio."*.)

- [ ] **Paso 2: los datos de la cuenta, apagados en vista maestra**

En la sección "Tu cuenta", el botón de guardar los datos y "Cambiarla" de la
contraseña reciben `motivo={enVista ? t("vistaMaestra.perfilApagado") : undefined}`
(si ya tienen otro motivo, el de vista maestra va primero). Los campos quedan
`disabled={enVista}`. Tema e idioma no cambian.

- [ ] **Paso 3: verlo andar**

Con la API y el front corriendo (`preview_start`), cuenta con 2 negocios:
Mi perfil → el botón a la derecha del título, prendido. Cuenta con 1: apagado
con *"Hace falta más de un negocio."*. Captura de pantalla de los dos.

- [ ] **Paso 4: commit (con aprobación)**

```bash
git -C TP-Ing.-Software-2026c2 add src/app/perfil
git -C TP-Ing.-Software-2026c2 commit -m "Vista maestra: el botón en Mi perfil"
```

---

### Tarea 7: El front — la barra lateral y el desplegable de la flechita

**Archivos:**
- Modificar: `TP-Ing.-Software-2026c2/src/componentes/Navegacion.js` (`BarraLateral` ~líneas 239-270, `PanelDeSecciones` ~líneas 394-460)
- Crear: `TP-Ing.-Software-2026c2/src/componentes/DesplegableVistaMaestra.js`

**Interfaces:**
- Consume: `usuario.vista_maestra_desde`, `salirDeVistaMaestra` (Tarea 5); de Tarea 4 `verVistaMaestra`, `guardarNegociosDeVista`, `crearGrupo`, `cambiarGrupo`, `borrarGrupo`, `conPrendido`, `conGrupo`, `estadoDelGrupo`, `mover`, `moverA`; `Interruptor`, `Boton`, `Campo` de `ui.js`.
- Produce: `<DesplegableVistaMaestra vista={vista} alCambiar={setVista} />` y el evento de ventana `"vista-maestra:cambio"` (lo escucha el selector de la Tarea 8 para volver a pedir la vista).

- [ ] **Paso 1: el encabezado de la barra**

En `BarraLateral`, con `const enVista = Boolean(usuario?.vista_maestra_desde);`,
el bloque de foto + nombre pasa a ser, en vista maestra:

```jsx
        {enVista ? (
          <div className="mb-6">
            <div className="flex items-center gap-3 pl-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-campo bg-espera text-white">
                <Icono nombre="ojo" />
              </span>
              <span className="min-w-0 flex-1 font-titulo font-extrabold text-subtitulo leading-tight">
                {t("vistaMaestra.titulo")}
              </span>
              <button
                type="button"
                onClick={() => setAbierto(!abierto)}
                aria-expanded={abierto}
                aria-controls="desplegable-vista-maestra"
                aria-label={t("vistaMaestra.desplegable.abrir")}
                title={t("vistaMaestra.desplegable.abrir")}
                className="flex size-12 shrink-0 items-center justify-center rounded-campo text-tinta-media hover:bg-superficie hover:text-azul"
              >
                <Icono nombre={abierto ? "flecha-arriba" : "flecha-abajo"} />
              </button>
              {botonDeBarra}
            </div>
            {abierto && <DesplegableVistaMaestra id="desplegable-vista-maestra" />}
          </div>
        ) : (
          /* el bloque de foto + nombre de hoy, sin cambios */
        )}
```

- [ ] **Paso 2: el pie — "Salir de vista" abajo de todo**

En vista maestra, la lista del pie es `[perfil]` sin "Mi negocio", y debajo un
botón (no un `Link`: hace una llamada) con el mismo aspecto que
`ListaDeSecciones`:

```jsx
        <div className="mt-4 border-t border-borde pt-4">
          <ListaDeSecciones destinos={enVista ? alPie.filter((d) => d.id !== "negocio") : alPie} ruta={ruta} />
          {enVista && (
            <button
              type="button"
              onClick={salir}
              disabled={saliendo}
              className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-campo px-3 text-cuerpo text-tinta-media hover:bg-superficie"
            >
              <Icono nombre="salir" className="size-7" />
              {t("vistaMaestra.salir")}
            </button>
          )}
        </div>
```

con `salir` = `await salirDeVistaMaestra()` y `router.replace(r.negocioId ? "/" : "/negocios")`.
Hacer lo mismo en `PanelDeSecciones` (el "Más" del celular): mismo encabezado
con "Vista maestra" y el mismo "Salir de vista" al final del grupo del pie.
En la barra de abajo del celular (`paraCelular`), "Mi negocio" tampoco aparece
en vista maestra: filtrarlo igual.

- [ ] **Paso 3: el desplegable**

`src/componentes/DesplegableVistaMaestra.js`. Pide `verVistaMaestra(token)` al
abrirse y guarda **en cada cambio** (no hay botón "Guardar": cada interruptor
dice su estado y se guarda al tocarlo; si falla, vuelve al estado anterior y
muestra el error con `ErrorGeneral`). Después de guardar, dispara
`window.dispatchEvent(new Event("vista-maestra:cambio"))`.

```jsx
"use client";

// El desplegable de la flechita, en vista maestra (docs/vista-maestra.md):
// qué negocios aparecen en el selector de la derecha, en qué orden, y los
// grupos para prender o apagar varios de una. Se guarda al tocar, en la cuenta
// (076), así el celular ve lo mismo.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import {
  borrarGrupo, cambiarGrupo, conGrupo, conPrendido, crearGrupo, estadoDelGrupo,
  guardarNegociosDeVista, mover, moverA, verVistaMaestra,
} from "@/lib/vista-maestra";
import Icono from "./Icono";
import { Boton, Campo, ErrorGeneral, Interruptor } from "./ui";

const avisar = () => window.dispatchEvent(new Event("vista-maestra:cambio"));

export default function DesplegableVistaMaestra({ id }) {
  const { sesion, usuario } = useAuth();
  const { t } = useIdioma();
  const token = sesion?.access_token;
  const mirandoId = usuario?.negocio_id;
  const [vista, setVista] = useState(null);
  const [error, setError] = useState(null);
  const [arrastrado, setArrastrado] = useState(null);
  const [grupoEditado, setGrupoEditado] = useState(null); // { id|null, nombre, negocios }

  useEffect(() => {
    let vivo = true;
    verVistaMaestra(token).then((r) => vivo && (r.ok ? setVista(r.vista) : setError(r.error.mensaje)));
    return () => { vivo = false; };
  }, [token]);

  // Optimista: se muestra ya y, si la base dice que no, se vuelve atrás.
  async function guardar(negocios) {
    const antes = vista;
    setVista({ ...vista, negocios });
    setError(null);
    const r = await guardarNegociosDeVista(negocios, token);
    if (r.ok) { setVista(r.vista); avisar(); }
    else { setVista(antes); setError(r.error.mensaje); }
  }

  async function guardarGrupo() {
    const { id: gid, nombre, negocios } = grupoEditado;
    const r = gid ? await cambiarGrupo(gid, { nombre, negocios }, token) : await crearGrupo({ nombre, negocios }, token);
    if (r.ok) { setVista(r.vista); setGrupoEditado(null); setError(null); }
    else setError(r.error.mensaje);
  }

  async function quitarGrupo(gid) {
    const r = await borrarGrupo(gid, token);
    if (r.ok) { setVista(r.vista); setGrupoEditado(null); }
    else setError(r.error.mensaje);
  }

  if (!vista) return <div id={id} className="mt-3 px-3 text-apoyo text-tinta-suave">…</div>;
  const negocios = [...vista.negocios].sort((a, b) => a.orden - b.orden);

  return (
    <div id={id} className="mt-3 flex max-h-[60dvh] flex-col gap-4 overflow-y-auto rounded-campo border border-borde bg-superficie p-3">
      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      <section aria-labelledby={`${id}-grupos`}>
        <h2 id={`${id}-grupos`} className="mb-2 font-bold">{t("vistaMaestra.desplegable.grupos")}</h2>
        <ul className="flex flex-col gap-1">
          {vista.grupos.map((g) => {
            const estado = estadoDelGrupo(negocios, g);
            return (
              <li key={g.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Interruptor
                    prendido={estado === "prendido"}
                    onChange={() => guardar(conGrupo(negocios, g, estado !== "prendido", mirandoId))}
                    ayuda={estado === "mezclado" ? t("vistaMaestra.desplegable.mezclado") : undefined}
                  >
                    {g.nombre}
                  </Interruptor>
                </div>
                <button type="button" className="min-h-12 px-2 text-apoyo font-bold text-azul"
                  onClick={() => setGrupoEditado({ id: g.id, nombre: g.nombre, negocios: g.negocios })}>
                  {t("vistaMaestra.desplegable.cambiarGrupo")}
                </button>
              </li>
            );
          })}
        </ul>
        {grupoEditado ? (
          <div className="mt-2 flex flex-col gap-2">
            <Campo
              etiqueta={t("vistaMaestra.desplegable.nombreGrupo")}
              value={grupoEditado.nombre}
              maxLength={60}
              onChange={(e) => setGrupoEditado({ ...grupoEditado, nombre: e.target.value })}
            />
            {negocios.map((n) => (
              <label key={n.id} className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={grupoEditado.negocios.includes(n.id)}
                  onChange={(e) => setGrupoEditado({
                    ...grupoEditado,
                    negocios: e.target.checked
                      ? [...grupoEditado.negocios, n.id]
                      : grupoEditado.negocios.filter((x) => x !== n.id),
                  })}
                />
                {n.nombre}
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <Boton onClick={guardarGrupo} motivo={grupoEditado.nombre.trim() ? undefined : t("vistaMaestra.desplegable.nombreGrupo")}>
                {t("vistaMaestra.desplegable.guardarGrupo")}
              </Boton>
              {grupoEditado.id && (
                <Boton icono="tacho" onClick={() => quitarGrupo(grupoEditado.id)}>
                  {t("vistaMaestra.desplegable.borrarGrupo")}
                </Boton>
              )}
              <Boton onClick={() => setGrupoEditado(null)}>{t("vistaMaestra.desplegable.cerrar")}</Boton>
            </div>
          </div>
        ) : (
          <Boton icono="mas" className="mt-2" onClick={() => setGrupoEditado({ id: null, nombre: "", negocios: [] })}>
            {t("vistaMaestra.desplegable.nuevoGrupo")}
          </Boton>
        )}
      </section>

      <section aria-labelledby={`${id}-negocios`}>
        <h2 id={`${id}-negocios`} className="font-bold">{t("vistaMaestra.desplegable.negocios")}</h2>
        <p className="mb-2 text-apoyo text-tinta-suave">{t("vistaMaestra.desplegable.arrastrar")}</p>
        <ol className="flex flex-col gap-1">
          {negocios.map((n, i) => (
            <li
              key={n.id}
              draggable
              onDragStart={() => setArrastrado(n.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (arrastrado && arrastrado !== n.id) guardar(moverA(negocios, arrastrado, n.id)); setArrastrado(null); }}
              className="flex items-center gap-1 rounded-campo bg-fondo"
            >
              <span aria-hidden="true" className="cursor-grab px-1 text-tinta-suave">⋮⋮</span>
              <div className="min-w-0 flex-1">
                <Interruptor
                  prendido={n.prendido}
                  onChange={() => guardar(conPrendido(negocios, n.id, !n.prendido, mirandoId))}
                  motivo={n.id === mirandoId ? t("vistaMaestra.mirando") : undefined}
                >
                  {n.nombre}
                </Interruptor>
              </div>
              <button type="button" disabled={i === 0} onClick={() => guardar(mover(negocios, n.id, -1))}
                aria-label={t("vistaMaestra.desplegable.subir", { negocio: n.nombre })}
                className="flex size-12 items-center justify-center rounded-campo disabled:opacity-40">
                <Icono nombre="flecha-arriba" />
              </button>
              <button type="button" disabled={i === negocios.length - 1} onClick={() => guardar(mover(negocios, n.id, 1))}
                aria-label={t("vistaMaestra.desplegable.bajar", { negocio: n.nombre })}
                className="flex size-12 items-center justify-center rounded-campo disabled:opacity-40">
                <Icono nombre="flecha-abajo" />
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
```

> Revisar las props reales de `Interruptor`, `Campo` y `ErrorGeneral` en
> `ui.js` antes de usarlas (arriba: `prendido`, `onChange`, `children`,
> `ayuda`, `motivo`; `Campo` con `etiqueta`) y ajustar si difieren.

- [ ] **Paso 4: verlo andar**

`preview_start`. Entrar a vista maestra desde Mi perfil:
- La barra dice "Vista maestra" con el ojo; la flechita abre el desplegable.
- Apagar un negocio que no se mira → se apaga; el que se mira → apagado con *"Estás mirándolo."*.
- Subir/Bajar cambia el orden; arrastrar también. Recargar: el orden se mantiene.
- Crear "Zona sur" con 2 negocios, apagarlo → se apagan menos el que se mira.
- El pie: "Mi perfil" y abajo "Salir de vista"; "Mi negocio" no está.
- Celular (`resize_window` mobile): "Más" muestra lo mismo.
- `read_console_messages` sin errores. Capturas.

- [ ] **Paso 5: commit (con aprobación)**

```bash
git -C TP-Ing.-Software-2026c2 add src/componentes/Navegacion.js src/componentes/DesplegableVistaMaestra.js
git -C TP-Ing.-Software-2026c2 commit -m "Vista maestra: la barra lateral y el desplegable de negocios y grupos"
```

---

### Tarea 8: El front — el selector, los atajos, la franja y el puntito

**Archivos:**
- Crear: `TP-Ing.-Software-2026c2/src/componentes/SelectorDeVistaMaestra.js`
- Crear: `TP-Ing.-Software-2026c2/src/componentes/FranjaDeVistaMaestra.js`
- Modificar: `TP-Ing.-Software-2026c2/src/componentes/Guardia.js:234` (junto a `<FranjaDeVisita />`)

**Interfaces:**
- Consume: `usuario.vista_maestra_desde`, `usuario.negocio_id`, `mirarEnVistaMaestra`, `entrarAlNegocio` (Tareas 5 y existente); `verVistaMaestra`, `delSelector`, `negocioDelAtajo`, `hayUrgencia` (Tarea 4); evento `"vista-maestra:cambio"` (Tarea 7).
- Produce: `<SelectorDeVistaMaestra />`, `<FranjaDeVistaMaestra />`.

- [ ] **Paso 1: la franja**

`src/componentes/FranjaDeVistaMaestra.js`, hermana de `FranjaDeVisita.js`
(mismo aspecto, `role="status"`):

```jsx
"use client";

// Arriba de todo en vista maestra (docs/vista-maestra.md): qué negocio se está
// mirando, que no se puede cambiar nada, y cómo ir a cambiar algo ahí. Estado
// con color, ícono y palabra (cartilla), como la franja de visita.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "./Icono";

export default function FranjaDeVistaMaestra() {
  const { usuario, entrarAlNegocio } = useAuth();
  const { negocio } = useDatos();
  const { t } = useIdioma();
  const router = useRouter();
  const [yendo, setYendo] = useState(false);

  if (!usuario?.vista_maestra_desde) return null;

  // Sale de la vista maestra y entra a éste, con su rol de siempre (076).
  async function editarAca() {
    setYendo(true);
    const r = await entrarAlNegocio(negocio.id);
    setYendo(false);
    if (r.ok) router.refresh();
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-l-4 border-l-espera bg-espera-fondo px-4 py-3 text-espera">
      <Icono nombre="ojo" />
      <span className="font-bold">{t("vistaMaestra.soloLectura", { negocio: negocio?.nombre ?? "" })}</span>
      <button type="button" disabled={yendo || !negocio} onClick={editarAca} className="ml-auto min-h-12 font-bold underline">
        {t("vistaMaestra.editarAca")}
      </button>
    </div>
  );
}
```

- [ ] **Paso 2: el selector**

`src/componentes/SelectorDeVistaMaestra.js`. En la compu, una columna flotante
a la derecha, centrada en alto (`fixed right-4 top-1/2 -translate-y-1/2`), que
no llega ni arriba ni abajo (`max-h-[70dvh] overflow-y-auto`). En el celular
(`md:hidden`), una tira horizontal arriba del contenido que se desliza de
costado (`overflow-x-auto`, `sticky top-0`).

```jsx
"use client";

// El selector de negocios de la vista maestra (docs/vista-maestra.md): uno a
// la vez, con su foto y su nombre para saber cuál es cuál. Tocar uno cambia la
// pantalla en la que se está a ese negocio, sin moverse de sección. Alt+1…9
// eligen por posición. El puntito avisa si hay casos atrasados o stock bajo.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { delSelector, hayUrgencia, negocioDelAtajo, verVistaMaestra } from "@/lib/vista-maestra";
import Icono from "./Icono";

export default function SelectorDeVistaMaestra() {
  const { usuario, sesion, mirarEnVistaMaestra } = useAuth();
  const { t } = useIdioma();
  const token = sesion?.access_token;
  const enVista = Boolean(usuario?.vista_maestra_desde);
  const mirandoId = usuario?.negocio_id;
  const [vista, setVista] = useState(null);
  const [yendo, setYendo] = useState(null);

  const pedir = useCallback(() => {
    verVistaMaestra(token).then((r) => r.ok && setVista(r.vista));
  }, [token]);

  // Al entrar y cada vez que el desplegable guarda algo.
  useEffect(() => {
    if (!enVista) return;
    pedir();
    window.addEventListener("vista-maestra:cambio", pedir);
    return () => window.removeEventListener("vista-maestra:cambio", pedir);
  }, [enVista, pedir]);

  const selector = delSelector(vista?.negocios);

  const mirar = useCallback(async (id) => {
    if (!id || id === mirandoId || yendo) return;
    setYendo(id);
    await mirarEnVistaMaestra(id);
    setYendo(null);
  }, [mirandoId, yendo, mirarEnVistaMaestra]);

  // Alt+número. Sólo se frena la tecla si había un negocio en esa posición:
  // así Alt sola, o Alt+0, siguen haciendo lo de siempre.
  useEffect(() => {
    if (!enVista) return;
    const alApretar = (e) => {
      const id = negocioDelAtajo(e, selector);
      if (!id) return;
      e.preventDefault();
      mirar(id);
    };
    window.addEventListener("keydown", alApretar);
    return () => window.removeEventListener("keydown", alApretar);
  }, [enVista, selector, mirar]);

  if (!enVista || !vista) return null;

  const urgencia = (id) => vista.urgencias.find((u) => u.negocio_id === id);
  const textoDeUrgencia = (u) => hayUrgencia(u)
    ? [u.casos_atrasados && t("vistaMaestra.casosAtrasados", { n: u.casos_atrasados }),
       u.stock_bajo && t("vistaMaestra.stockBajo", { n: u.stock_bajo })].filter(Boolean).join(" · ")
    : t("vistaMaestra.sinUrgencias");

  const boton = (n, i, enTira) => {
    const u = urgencia(n.id);
    const aca = n.id === mirandoId;
    const titulo = `${n.nombre} · ${textoDeUrgencia(u)}${i < 9 ? ` · ${t("vistaMaestra.atajo", { n: i + 1 })}` : ""}`;
    return (
      <li key={n.id}>
        <button
          type="button"
          onClick={() => mirar(n.id)}
          aria-current={aca ? "true" : undefined}
          aria-keyshortcuts={i < 9 ? `Alt+${i + 1}` : undefined}
          aria-busy={yendo === n.id}
          title={titulo}
          className={[
            "relative flex min-h-12 items-center gap-2 rounded-campo px-2 text-left",
            enTira ? "shrink-0" : "w-full",
            aca ? "bg-azul-claro font-bold text-azul" : "text-tinta-media hover:bg-superficie",
          ].join(" ")}
        >
          {n.foto ? (
            <img src={n.foto} alt="" className="size-9 shrink-0 rounded-campo object-cover" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
              <Icono nombre="tienda" />
            </span>
          )}
          <span className="max-w-40 truncate">{n.nombre}</span>
          {hayUrgencia(u) && (
            <span className="flex items-center text-error">
              <Icono nombre="alerta" className="size-5" />
              <span className="sr-only">{textoDeUrgencia(u)}</span>
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <>
      <nav aria-label={t("vistaMaestra.selector")}
        className="fixed top-1/2 right-4 z-30 hidden max-h-[70dvh] w-56 -translate-y-1/2 overflow-y-auto rounded-campo border border-borde bg-fondo p-2 shadow-lg md:block">
        <ul className="flex flex-col gap-1">{selector.map((n, i) => boton(n, i, false))}</ul>
      </nav>
      <nav aria-label={t("vistaMaestra.selector")}
        className="sticky top-0 z-30 overflow-x-auto border-b border-borde bg-fondo px-2 py-2 md:hidden">
        <ul className="flex gap-2">{selector.map((n, i) => boton(n, i, true))}</ul>
      </nav>
    </>
  );
}
```

> El puntito usa ícono (`alerta`) + color + palabra (en `title` y `sr-only`):
> cartilla. Revisar que exista la clase de color de error del tema (`text-error`
> o la que usen los avisos en `globals.css`) y usar ésa.

- [ ] **Paso 3: montarlos en la Guardia**

En `Guardia.js`, debajo de `<FranjaDeVisita />`:

```jsx
          <FranjaDeVistaMaestra />
          <SelectorDeVistaMaestra />
```

y que el contenido no quede tapado por la columna de la derecha: al bloque
`@container mx-auto ...` agregarle `md:pr-64` sólo en vista maestra
(`usuario?.vista_maestra_desde`).

- [ ] **Paso 4: la pestaña que quedó en otro dispositivo**

Con dos pestañas de la misma cuenta: en una, entrar a vista maestra y mirar
otro negocio. Volver a la otra → el cartel de multinegocio *"Desde otro
dispositivo pasaste a {nombre}"* con **Recargar** (ya existe en `datos.js`,
línea ~392). Si en vez de eso dice otra cosa o no avisa, ajustar ahí la
comparación para que también mire `vista_maestra_desde`. Intentar guardar algo
en la pestaña vieja → *"Estás en vista maestra: es sólo para mirar…"*.

- [ ] **Paso 5: verlo andar**

`preview_start`, cuenta con 3 negocios, uno con un caso de hace 20 días
(cambiar `actualizado_en` en el SQL Editor) y un producto bajo el mínimo:
- Selector a la derecha, centrado; tocar otro negocio → la pantalla cambia sin
  irse de la sección (probar en Casos y en Inventario).
- Alt+1, Alt+2, Alt+3 → saltan; Alt+4 no hace nada. Probarlo con el foco en el
  buscador de Casos.
- El puntito aparece en el que tiene el caso viejo y el stock bajo; el `title`
  lo dice.
- Ningún botón de crear o editar en ninguna sección. Probar a mano un `fetch`
  POST desde la consola (`javascript_tool`) → 403 `vista_maestra`.
- "Editar en este negocio" → sale de la vista y queda en ese negocio, con los
  botones de siempre.
- "Salir de vista" → vuelve al negocio de antes.
- Celular: la tira arriba se desliza.
- Capturas y `read_console_messages` sin errores.

- [ ] **Paso 6: commit (con aprobación)**

```bash
git -C TP-Ing.-Software-2026c2 add src/componentes/SelectorDeVistaMaestra.js src/componentes/FranjaDeVistaMaestra.js src/componentes/Guardia.js src/lib/datos.js
git -C TP-Ing.-Software-2026c2 commit -m "Vista maestra: el selector de negocios, los atajos y la franja"
```

---

### Tarea 9: Cierre — documentación y prueba a mano

**Archivos:**
- Modificar: `TP-Ing.-Software-2026c2/docs/vista-maestra.md` (Estado: implementado; sección "Prueba a mano")
- Modificar: `TP-Ing.-Software-2026c2/docs/roles.md` (en "Visitas entre sedes", una línea: *"En vista maestra (076) no se entra de visita; ver docs/vista-maestra.md."*)

- [ ] **Paso 1: correr todo**

Run (front): `npm.cmd run test:unit`
Run (API): `npm.cmd run tipos` y `npm.cmd run test:pruebas`
Run (base): `supabase/pruebas/vista_maestra.sql`, `roles.sql`, `red_de_sedes.sql`, `multinegocio.sql`
Expected: todo pasa. Si algo falla, decirlo con la salida, no taparlo.

- [ ] **Paso 2: la prueba a mano en el diseño**

Agregar a `docs/vista-maestra.md` una sección **"Prueba a mano"** numerada,
como la de `docs/multinegocio.md`, con lo de los pasos "verlo andar" de las
Tareas 6 a 8, y además:
1. Cuenta con 1 negocio: el botón apagado con su motivo.
2. Modo de ejemplo: no hay botón de vista maestra.
3. De visita en una sede vinculada → Mi perfil → Vista maestra → la visita
   termina; "Salir de vista" vuelve a la sede propia.
4. Con Google Calendar conectado: entrar a vista maestra, mirar otros negocios,
   esperar un minuto, salir → la Agenda del negocio conectado sigue conectada.
5. Dueña le saca la ficha a Caro mientras Caro mira ese negocio en vista
   maestra → Caro, al volver a la pestaña, ve el cartel; "Salir de vista" la
   lleva a su negocio.

- [ ] **Paso 3: commit (con aprobación)**

```bash
git -C TP-Ing.-Software-2026c2 add docs/vista-maestra.md docs/roles.md
git -C TP-Ing.-Software-2026c2 commit -m "Vista maestra: la prueba a mano y la nota en roles"
```

## Orden de publicación

1. Correr la 076 en Supabase (agrega; el código de hoy no la usa).
2. Correr `supabase/pruebas/vista_maestra.sql` y las otras tres.
3. Publicar la API (el middleware sólo frena si hay marca, y nadie la tiene todavía).
4. Publicar el front.
