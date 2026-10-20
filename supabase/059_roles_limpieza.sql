-- ============================================================
-- 059_roles_limpieza.sql — se va el rol viejo
--
-- Correr entero en el SQL Editor de Supabase, después de la 058, y SÓLO con
-- la API y el front de las etapas 2 a 5 ya publicados: después de esto, nada
-- puede leer empleado.rol ni usuario.rol.
-- Es idempotente.
--
-- Se van: empleado.rol, usuario.rol, rol.clave, mi_rol(), puedo_cargar(),
-- rango_del_rol(), rol_de_clave(), rol_id_de_la_clave(),
-- rol_de_la_ficha_da_permisos() y aceptar_invitacion(). Quedan invitacion.rol
-- y ver_invitacion(): son de otra tabla.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Las funciones que todavía escribían la palabra vieja
-- ------------------------------------------------------------
-- Todo lo de esta sección va ANTES de la sección 2: la sección 2 borra
-- rol.clave y empleado.rol, que estas funciones nombraban.

-- crear_mi_negocio (038), sin la palabra vieja. La ficha va al rol Dueño, que
-- ya existe: lo creó el trigger de la 053 al insertar el negocio. Crear un
-- negocio estando de visita en otra sede termina la visita.
create or replace function crear_mi_negocio(p_nombre text, p_rubro text, p_modulos jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo uuid;
  mi_mail text;
  mi_nombre text;
  es_el_primero boolean;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión para crear un negocio.';
  end if;

  -- El primero: la cuenta no tenía ninguna ficha antes de este alta. Así no
  -- se le vuelve a prender el predeterminado a quien lo apagó a propósito.
  es_el_primero := not exists (select 1 from empleado where usuario_id = auth.uid());

  select email into mi_mail from auth.users where id = auth.uid();

  -- La fila de usuario puede no existir todavía, según cuándo se confirmó el
  -- mail. Va antes que el negocio: negocio.creado_por apunta a ella.
  insert into usuario (id, email)
  values (auth.uid(), mi_mail)
  on conflict (id) do nothing;

  -- creado_por va en el alta y no en un update después: el trigger
  -- negocio_creado_por_fijo frena cualquier cambio hecho con sesión.
  insert into negocio (nombre, rubro, modulos_activos, creado_por)
  values (p_nombre, p_rubro, coalesce(p_modulos, '[]'::jsonb), auth.uid())
  returning id into nuevo;

  update usuario
     set negocio_id      = nuevo,
         visitando_desde = null
   where id = auth.uid();

  select nombre into mi_nombre from usuario where id = auth.uid();

  insert into empleado (negocio_id, nombre, rol_id, usuario_id)
  values (
    nuevo,
    coalesce(nullif(trim(mi_nombre), ''), split_part(coalesce(mi_mail, 'Alguien'), '@', 1)),
    (select id from rol where negocio_id = nuevo and es_duenio),
    auth.uid()
  );

  -- Como el pasaje de la 038: con un solo negocio se entra directo, sin pasar
  -- por el selector de negocios con una sola fila.
  if es_el_primero then
    update usuario
       set negocio_predeterminado = nuevo,
           inicio_rapido          = true
     where id = auth.uid();
  end if;

  return nuevo;
end;
$$;

revoke all on function crear_mi_negocio(text, text, jsonb) from public;
revoke all on function crear_mi_negocio(text, text, jsonb) from anon;
grant execute on function crear_mi_negocio(text, text, jsonb) to authenticated;

-- entrar_al_negocio (057), sin copiar la palabra vieja a usuario.
create or replace function entrar_al_negocio(p_negocio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;

  perform 1 from empleado where usuario_id = auth.uid() and negocio_id = p_negocio;

  if not found then
    raise exception 'No estás en ese negocio.';
  end if;

  update usuario
     set negocio_id      = p_negocio,
         visitando_desde = null
   where id = auth.uid();
end;
$$;

revoke all on function entrar_al_negocio(uuid) from public;
revoke all on function entrar_al_negocio(uuid) from anon;
grant execute on function entrar_al_negocio(uuid) to authenticated;

-- quitar_acceso_al_sacar (058), sin la línea que volvía a poner 'duenio'.
create or replace function quitar_acceso_al_sacar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.usuario_id is null then
    -- Una ficha cargada a mano, sin cuenta: no hay acceso que quitar.
    return old;
  end if;

  -- Al borrar el negocio entero, la cascada borra sus fichas cuando la fila
  -- del negocio ya no está: la del creador y la propia incluidas, a propósito.
  -- Con el negocio vivo este chequeo no frena nada, así que no se puede usar
  -- para saltearse las reglas de abajo.
  if not exists (select 1 from negocio where id = old.negocio_id) then
    return old;
  end if;

  if old.usuario_id = auth.uid() then
    raise exception 'No te podés sacar a vos del equipo.';
  end if;

  -- Al fundador no lo saca otro dueño (038, sección 1b).
  if old.usuario_id = (select creado_por from negocio where id = old.negocio_id) then
    raise exception 'A quien creó el negocio no se lo puede sacar del equipo.';
  end if;

  update usuario
     set negocio_id = case when negocio_id = old.negocio_id then null else negocio_id end,
         negocio_predeterminado = case
           when negocio_predeterminado = old.negocio_id then null
           else negocio_predeterminado
         end,
         inicio_rapido = case
           when negocio_predeterminado = old.negocio_id then false
           else inicio_rapido
         end
   where id = old.usuario_id
     and (negocio_id = old.negocio_id or negocio_predeterminado = old.negocio_id);

  return old;
end;
$$;

-- aprobar_solicitud (056): la ficha sólo con rol_id.
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

  insert into empleado (negocio_id, nombre, rol_id, usuario_id)
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
     set negocio_id = activo
   where id = s.usuario_id
     and negocio_id is null;
end;
$$;

revoke all on function aprobar_solicitud(uuid, uuid) from public;
revoke all on function aprobar_solicitud(uuid, uuid) from anon;
grant execute on function aprobar_solicitud(uuid, uuid) to authenticated;

-- asignar_rol (056): el update sólo toca rol_id.
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

  update empleado set rol_id = p_rol where id = p_empleado;
end;
$$;

revoke all on function asignar_rol(uuid, uuid) from public;
revoke all on function asignar_rol(uuid, uuid) from anon;
grant execute on function asignar_rol(uuid, uuid) to authenticated;

-- roles_base (053) deja de devolver la clave: cambia el tipo que devuelve,
-- así que se borra y se vuelve a crear. El nombre sigue saliendo de
-- nombre_de_clave() y los permisos de permisos_de_clave().
drop function if exists roles_base(text);
create function roles_base(p_rubro text)
returns table (nombre text, permisos text[])
language sql
immutable
set search_path = public
as $$
  select nombre_de_clave(p_rubro, k), permisos_de_clave(k)
    from unnest(array['encargado', 'tecnico']) as k
   where p_rubro in ('taller', 'medicina', 'service');
$$;

-- crear_roles_del_negocio (053), sin clave.
create or replace function crear_roles_del_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into rol (negocio_id, nombre, es_duenio, permisos)
  values (new.id, 'Dueño', true, '{}');

  insert into rol (negocio_id, nombre, permisos)
  select new.id, b.nombre, b.permisos from roles_base(new.rubro) b;

  return new;
end;
$$;

-- borrar_negocio (058). Además: quien visitaba otra sede DESDE el negocio que
-- se borra no se queda en esa sede sin ficha; pasa a su predeterminado (si no
-- es el borrado) o a ninguno.
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
    raise exception 'Hace falta iniciar sesión.';
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

  -- Nadie queda parado en un negocio que no existe. Quien estaba acá vuelve a
  -- su sede de origen si andaba de visita, o a su predeterminado, o a ninguno.
  -- Quien andaba de visita en otra sede saliendo de acá pasa a su
  -- predeterminado, o a ninguno.
  -- En un UPDATE todas las expresiones leen la fila como estaba antes.
  update usuario
     set negocio_id = case
           when negocio_id = p_negocio
             then coalesce(nullif(visitando_desde, p_negocio), nullif(negocio_predeterminado, p_negocio))
           when visitando_desde = p_negocio
             then nullif(negocio_predeterminado, p_negocio)
           else negocio_id
         end,
         visitando_desde = case when visitando_desde = p_negocio or negocio_id = p_negocio then null else visitando_desde end,
         negocio_predeterminado = nullif(negocio_predeterminado, p_negocio),
         inicio_rapido = case when negocio_predeterminado = p_negocio then false else inicio_rapido end
   where negocio_id = p_negocio or visitando_desde = p_negocio or negocio_predeterminado = p_negocio;

  delete from negocio where id = p_negocio;
end;
$$;

revoke all on function borrar_negocio(uuid, text) from public;
revoke all on function borrar_negocio(uuid, text) from anon;
grant execute on function borrar_negocio(uuid, text) to authenticated;

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
-- Sin uso desde el link de equipo (051, que ya la borró): nada del front ni
-- de la API la llama. Por si quedó en alguna base.
drop function if exists aceptar_invitacion(text, text);

-- Las políticas abiertas de la 005 (todo el negocio puede todo). Las borraba
-- la 008, que ya no se puede volver a correr (usa mi_rol()): si alguien vuelve
-- a correr la 005, la 059 las saca de nuevo. Las de hoy son las de la 054.
drop policy if exists cliente_de_mi_negocio on cliente;
drop policy if exists empleado_de_mi_negocio on empleado;
drop policy if exists insumo_de_mi_negocio on insumo;
drop policy if exists paso_de_mi_negocio on paso;
drop policy if exists turno_de_mi_negocio on turno;

alter table empleado drop column if exists rol;
alter table usuario drop column if exists rol;
drop index if exists rol_clave_unica;
alter table rol drop column if exists clave;

-- CÓMO VERIFICARLO (sólo lee):
--
--   select table_name, column_name from information_schema.columns
--    where table_schema = 'public'
--      and ((table_name in ('empleado', 'usuario') and column_name = 'rol')
--        or (table_name = 'rol' and column_name = 'clave'));          -- 0 filas
