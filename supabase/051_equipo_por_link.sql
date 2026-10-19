-- ============================================================
-- 051_equipo_por_link.sql — sumar gente al equipo con un link, y aprobar
--
-- Correr entero en el SQL Editor de Supabase, después de la 047. Es
-- idempotente. Diseño: docs/equipo-por-link.md. Prueba:
-- pruebas/equipo_por_link.sql (y las adaptadas multinegocio.sql y
-- red_de_sedes.sql).
--
-- ANTES: correr la consulta de abajo para ver qué fichas sin cuenta se borran
-- y qué casos y cobros quedan sin persona. Borrarlas no se puede deshacer.
--
--   select n.nombre as negocio, count(distinct e.id) as fichas_sin_cuenta,
--          count(distinct c.id) as casos_que_quedan_sin_asignar,
--          count(distinct k.id) as cobros_que_pierden_quien
--     from empleado e join negocio n on n.id = e.negocio_id
--     left join caso c on c.responsable_id = e.id
--     left join cobro k on k.creado_por = e.id or k.anulado_por = e.id
--    where e.usuario_id is null group by n.nombre order by n.nombre;
--
-- Usar el link no crea una ficha: deja un pedido. La ficha es la membresía
-- (políticas, mis_negocios, sedes, permisos); sin ficha no se ve nada, aunque
-- falte un control en algún lado.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El link del equipo
-- ------------------------------------------------------------
alter table invitacion add column if not exists de_equipo boolean not null default false;
create unique index if not exists invitacion_un_link_de_equipo
  on invitacion (negocio_id) where de_equipo and not anulada;

-- Se terminan las invitaciones con rol: las activas se anulan, y los links sólo
-- los crea cambiar_link_de_equipo().
update invitacion set anulada = true where not de_equipo and not anulada;
revoke insert on invitacion from authenticated;
revoke insert on invitacion from anon;

-- ------------------------------------------------------------
-- 2. Sin fichas sin cuenta
-- ------------------------------------------------------------
-- Lo que apunta a una ficha es "on delete set null": los casos quedan sin
-- asignar y los cobros sin quién. El trigger de la 036 deja pasar las fichas
-- sin cuenta (no hay acceso que quitar).
delete from empleado where usuario_id is null;

-- Las fichas sólo las crean crear_mi_negocio() y aprobar_solicitud(). Cambiar
-- nombre y rol (037) sigue permitido.
revoke insert on empleado from authenticated;
revoke insert on empleado from anon;

-- ------------------------------------------------------------
-- 3. Los pedidos
-- ------------------------------------------------------------
create table if not exists solicitud_de_ingreso (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid        not null references negocio (id) on delete cascade,
  usuario_id  uuid        not null references usuario (id) on delete cascade,
  nombre      text        not null,
  email       text,
  creada_en   timestamptz not null default now(),
  unique (negocio_id, usuario_id)
);

-- Sin políticas a propósito: nadie la lee ni la escribe directo.
alter table solicitud_de_ingreso enable row level security;
revoke all on solicitud_de_ingreso from anon;
revoke all on solicitud_de_ingreso from authenticated;

-- ------------------------------------------------------------
-- 4. Permisos y rangos
-- ------------------------------------------------------------
create or replace function puede_en(p_negocio uuid, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_permiso
             when 'vincular_sedes' then e.rol = 'duenio'
             when 'ver_inventario_de_sedes' then e.rol in ('duenio', 'encargado', 'tecnico')
             when 'sumar_al_equipo' then e.rol = 'duenio'
             else false
           end
      from empleado e
     where e.negocio_id = p_negocio
       and e.usuario_id = auth.uid()
     limit 1
  ), false);
$$;

revoke all on function puede_en(uuid, text) from public;
revoke all on function puede_en(uuid, text) from anon;
grant execute on function puede_en(uuid, text) to authenticated;

-- Nadie da un rol más alto que el suyo.
create or replace function rango_del_rol(p_rol text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_rol
           when 'duenio' then 3
           when 'encargado' then 2
           when 'tecnico' then 1
           else 0
         end;
$$;

revoke all on function rango_del_rol(text) from public;
revoke all on function rango_del_rol(text) from anon;
grant execute on function rango_del_rol(text) to authenticated;

-- ------------------------------------------------------------
-- 5. El link: verlo y cambiarlo
-- ------------------------------------------------------------
create or replace function link_de_equipo()
returns table (codigo text, vence_en timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not puede_en(mi_negocio(), 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;
  return query
    select i.codigo, i.vence_en
      from invitacion i
     where i.negocio_id = mi_negocio()
       and i.de_equipo
       and not i.anulada
       and i.vence_en > now();
end;
$$;

revoke all on function link_de_equipo() from public;
revoke all on function link_de_equipo() from anon;
grant execute on function link_de_equipo() to authenticated;

create or replace function cambiar_link_de_equipo(p_dias integer default 30)
returns table (codigo text, vence_en timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  activo uuid := mi_negocio();
begin
  if not puede_en(activo, 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'El link dura entre 1 y 365 días.';
  end if;

  update invitacion i
     set anulada = true
   where i.negocio_id = activo
     and i.de_equipo
     and not i.anulada;

  return query
    insert into invitacion as i (negocio_id, de_equipo, usos_maximos, vence_en, creada_por)
    values (activo, true, 2147483647, now() + make_interval(days => p_dias), auth.uid())
    returning i.codigo, i.vence_en;
end;
$$;

revoke all on function cambiar_link_de_equipo(integer) from public;
revoke all on function cambiar_link_de_equipo(integer) from anon;
grant execute on function cambiar_link_de_equipo(integer) to authenticated;

-- ------------------------------------------------------------
-- 6. Pedir entrar (reemplaza a aceptar_invitacion)
-- ------------------------------------------------------------
drop function if exists aceptar_invitacion(text, text);

create or replace function pedir_entrar(p_codigo text, p_nombre text default null)
returns table (negocio_nombre text, estado text)
language plpgsql
security definer
set search_path = public
as $$
declare
  quien uuid := auth.uid();
  inv invitacion%rowtype;
  mi_mail text;
  mi_nombre text;
  el_negocio text;
begin
  if quien is null then
    raise exception 'Hay que iniciar sesión para pedir entrar.';
  end if;

  select * into inv from invitacion i where i.codigo = p_codigo;
  if not found or not inv.de_equipo then
    raise exception 'Este link no existe. Fijate que esté completo.';
  end if;
  if inv.anulada then
    raise exception 'Quien te invitó dio de baja este link.';
  end if;
  if inv.vence_en < now() then
    raise exception 'Este link ya venció. Pedí uno nuevo.';
  end if;

  select n.nombre into el_negocio from negocio n where n.id = inv.negocio_id;

  if exists (select 1 from empleado e where e.usuario_id = quien and e.negocio_id = inv.negocio_id) then
    return query select el_negocio, 'ya_estas'::text;
    return;
  end if;

  select u.email into mi_mail from auth.users u where u.id = quien;
  insert into usuario (id, email) values (quien, mi_mail) on conflict (id) do nothing;

  -- Sin nombre escrito: el de la cuenta, y si tampoco hay, la parte del mail.
  select u.nombre into mi_nombre from usuario u where u.id = quien;

  insert into solicitud_de_ingreso (negocio_id, usuario_id, nombre, email)
  values (
    inv.negocio_id,
    quien,
    coalesce(
      nullif(trim(p_nombre), ''),
      nullif(trim(mi_nombre), ''),
      split_part(coalesce(mi_mail, 'Alguien'), '@', 1)
    ),
    mi_mail
  )
  on conflict (negocio_id, usuario_id) do nothing;

  return query select el_negocio, 'pendiente'::text;
end;
$$;

revoke all on function pedir_entrar(text, text) from public;
revoke all on function pedir_entrar(text, text) from anon;
grant execute on function pedir_entrar(text, text) to authenticated;

-- Lo que ve la pantalla de unirse antes de pedir. Cambia lo que devuelve (ya no
-- hay rol), así que se borra y se vuelve a crear.
drop function if exists ver_invitacion(text);

create function ver_invitacion(p_codigo text)
returns table (negocio_nombre text, sirve boolean, motivo text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inv invitacion%rowtype;
  el_negocio text;
begin
  select * into inv from invitacion i where i.codigo = p_codigo;
  if not found or not inv.de_equipo then
    return query select null::text, false, 'Este link no existe. Fijate que esté completo.'::text;
    return;
  end if;
  select n.nombre into el_negocio from negocio n where n.id = inv.negocio_id;
  if inv.anulada then
    return query select el_negocio, false, 'Quien te invitó dio de baja este link.'::text;
    return;
  end if;
  if inv.vence_en < now() then
    return query select el_negocio, false, 'Este link ya venció. Pedí uno nuevo.'::text;
    return;
  end if;
  return query select el_negocio, true, null::text;
end;
$$;

revoke all on function ver_invitacion(text) from public;
grant execute on function ver_invitacion(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 7. Ver, aprobar y rechazar pedidos
-- ------------------------------------------------------------
create or replace function pedidos_de_ingreso()
returns table (id uuid, nombre text, email text, creada_en timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not puede_en(mi_negocio(), 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;
  return query
    select s.id, s.nombre, s.email, s.creada_en
      from solicitud_de_ingreso s
     where s.negocio_id = mi_negocio()
     order by s.creada_en;
end;
$$;

revoke all on function pedidos_de_ingreso() from public;
revoke all on function pedidos_de_ingreso() from anon;
grant execute on function pedidos_de_ingreso() to authenticated;

create or replace function aprobar_solicitud(p_id uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  activo uuid := mi_negocio();
  s solicitud_de_ingreso%rowtype;
  mi_rol_aca text;
  es_el_primero boolean;
begin
  if not puede_en(activo, 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;

  select * into s from solicitud_de_ingreso x where x.id = p_id and x.negocio_id = activo for update;
  if not found then
    raise exception 'Ese pedido ya no está.';
  end if;
  if rango_del_rol(p_rol) = 0 then
    raise exception 'Elegí un rol válido.';
  end if;

  select e.rol into mi_rol_aca from empleado e where e.negocio_id = activo and e.usuario_id = auth.uid();
  if rango_del_rol(p_rol) > rango_del_rol(mi_rol_aca) then
    raise exception 'No podés dar un rol más alto que el tuyo.' using errcode = '42501';
  end if;

  es_el_primero := not exists (select 1 from empleado e where e.usuario_id = s.usuario_id);

  insert into empleado (negocio_id, nombre, rol, usuario_id)
  values (activo, s.nombre, p_rol, s.usuario_id);

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
         rol        = p_rol
   where id = s.usuario_id
     and negocio_id is null;
end;
$$;

revoke all on function aprobar_solicitud(uuid, text) from public;
revoke all on function aprobar_solicitud(uuid, text) from anon;
grant execute on function aprobar_solicitud(uuid, text) to authenticated;

create or replace function rechazar_solicitud(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  activo uuid := mi_negocio();
begin
  if not puede_en(activo, 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;
  delete from solicitud_de_ingreso x where x.id = p_id and x.negocio_id = activo;
  if not found then
    raise exception 'Ese pedido ya no está.';
  end if;
end;
$$;

revoke all on function rechazar_solicitud(uuid) from public;
revoke all on function rechazar_solicitud(uuid) from anon;
grant execute on function rechazar_solicitud(uuid) to authenticated;

-- Los pedidos que la persona tiene esperando.
create or replace function mis_pedidos()
returns table (negocio_nombre text, creada_en timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select n.nombre, s.creada_en
    from solicitud_de_ingreso s
    join negocio n on n.id = s.negocio_id
   where s.usuario_id = auth.uid()
   order by s.creada_en;
$$;

revoke all on function mis_pedidos() from public;
revoke all on function mis_pedidos() from anon;
grant execute on function mis_pedidos() to authenticated;
