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
