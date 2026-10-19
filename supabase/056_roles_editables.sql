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
  if (select r.es_duenio from rol r where r.id = ficha.rol_id) and not soy_duenio_aca() then
    raise exception 'Solo un Dueño puede cambiar el rol de otro Dueño.' using errcode = '42501';
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

-- ------------------------------------------------------------
-- 7. Aprobar un pedido con un rol del negocio
-- ------------------------------------------------------------
-- Cuerpo de la 051 (aprobar_solicitud), con el rol por id en vez de la palabra.
drop function if exists aprobar_solicitud(uuid, text);

create or replace function aprobar_solicitud(p_id uuid, p_rol uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  activo uuid := mi_negocio();
  s solicitud_de_ingreso%rowtype;
  nuevo rol%rowtype;
  es_el_primero boolean;
begin
  if not puede_en(activo, 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;

  select * into s from solicitud_de_ingreso x where x.id = p_id and x.negocio_id = activo for update;
  if not found then
    raise exception 'Ese pedido ya no está.';
  end if;

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

  es_el_primero := not exists (select 1 from empleado e where e.usuario_id = s.usuario_id);

  insert into empleado (negocio_id, nombre, rol, rol_id, usuario_id)
  values (activo, s.nombre, nuevo.clave, p_rol, s.usuario_id);

  delete from solicitud_de_ingreso x where x.id = s.id;

  -- Misma regla que la 038: la primera ficha de una cuenta queda de
  -- predeterminado con Inicio rápido.
  if es_el_primero then
    update usuario
       set negocio_predeterminado = activo,
           inicio_rapido          = true
     where id = s.usuario_id;
  end if;

  -- Si no estaba en ningún negocio, entra directo a éste.
  update usuario
     set negocio_id = activo,
         rol        = nuevo.clave
   where id = s.usuario_id
     and negocio_id is null;
end;
$$;

revoke all on function aprobar_solicitud(uuid, uuid) from public;
revoke all on function aprobar_solicitud(uuid, uuid) from anon;
grant execute on function aprobar_solicitud(uuid, uuid) to authenticated;
