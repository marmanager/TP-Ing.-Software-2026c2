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
-- en cascada y las dos cosas pasan a propósito. Es la definición de la 038 tal
-- cual, con un chequeo al principio: si el negocio ya no existe, no hay nada
-- que proteger.
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
  -- del negocio ya no está (como supone el comentario de abajo, desde la 038):
  -- la del creador y la propia incluidas, a propósito. Con el negocio vivo
  -- este chequeo no frena nada, así que no se puede usar para saltearse las
  -- reglas de abajo.
  if not exists (select 1 from negocio where id = old.negocio_id) then
    return old;
  end if;

  if old.usuario_id = auth.uid() then
    raise exception 'No te podés sacar a vos del equipo.';
  end if;

  -- Al fundador no lo saca otro dueño (sección 1b). Si se borra el negocio
  -- entero, sus fichas se borran después que él: el select da null y no frena.
  if old.usuario_id = (select creado_por from negocio where id = old.negocio_id) then
    raise exception 'A quien creó el negocio no se lo puede sacar del equipo.';
  end if;

  update usuario
     set negocio_id = case when negocio_id = old.negocio_id then null else negocio_id end,
         rol = case when negocio_id = old.negocio_id then 'duenio' else rol end,
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
  -- En un UPDATE todas las expresiones leen la fila como estaba antes.
  update usuario
     set negocio_id = case
           when negocio_id = p_negocio
             then coalesce(nullif(visitando_desde, p_negocio), nullif(negocio_predeterminado, p_negocio))
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
