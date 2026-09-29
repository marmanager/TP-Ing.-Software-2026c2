-- ============================================================
-- 037_rol_da_permisos.sql — el rol de Equipo es el que da los permisos
--
-- Correr entero en el SQL Editor de Supabase, después de 001..036.
-- Es idempotente.
--
-- ANTES:
-- Cada persona con cuenta tenía el rol en dos lugares: la etiqueta de su ficha
-- en Equipo (empleado.rol) y el que daba los permisos (usuario.rol, de donde
-- lee mi_rol()). Se cargaban juntos al aceptar la invitación y después nada
-- los volvía a unir. Era a propósito (comentario de cambiarRolEmpleado, en
-- datos.js), pero dejaba sin forma de cambiarle los permisos a alguien: bajar
-- a un encargado a técnico en Equipo le cambiaba la etiqueta y seguía con
-- permisos de encargado.
--
-- AHORA:
-- El rol de la ficha es el que vale. Cambiarlo cambia los permisos de esa
-- cuenta, si está en este negocio. La pantalla lo confirma antes diciendo qué
-- gana y qué pierde la persona (auditoría, H5: en un desplegable de celular
-- el dedo elige otra opción sin querer).
--
-- Es el primer paso del multinegocio: la ficha pasa a ser la membresía de
-- una cuenta en un negocio, con su rol, y el rol queda en un solo lugar.
--
-- DOS CANDADOS en empleado, con permisos por columna (como la 035):
--
--   usuario_id    no se escribe desde el navegador. Lo pone sólo
--                 aceptar_invitacion(). Si no, un dueño podría meter la
--                 cuenta de cualquiera en su negocio sin que la persona
--                 aceptara nada.
--
--   el rol propio nadie se lo cambia: el último dueño podría bajarse a
--                 técnico y dejar el negocio sin nadie que lo maneje.
--
-- Qué fichas se pueden tocar no cambia: sólo el dueño (008_permisos.sql).
--
-- LO QUE YA ESTABA DESALINEADO:
-- Si una etiqueta ya no coincidía con los permisos reales, se corrige la
-- etiqueta para que diga la verdad, y no al revés: correr esta migración no le
-- cambia el acceso a nadie. Si el dueño quiere cambiar a alguien, lo hace
-- desde Equipo, y ahí se le confirma.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Las etiquetas desalineadas dicen la verdad
-- ------------------------------------------------------------
-- Va antes del trigger: así no se dispara por esta corrección.
update empleado e
   set rol = u.rol
  from usuario u
 where e.usuario_id = u.id
   and e.negocio_id = u.negocio_id
   and e.rol is distinct from u.rol;

-- ------------------------------------------------------------
-- 2. Cambiar el rol de la ficha cambia los permisos
-- ------------------------------------------------------------
-- BEFORE: si hay que frenar el cambio —el rol propio—, se frena antes. Lo de
-- usuario va en la misma operación: o pasan los dos, o ninguno.
create or replace function rol_de_la_ficha_da_permisos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol is not distinct from old.rol then
    return new;
  end if;

  if old.usuario_id is not null and old.usuario_id = auth.uid() then
    raise exception 'No podés cambiar tu propio rol.';
  end if;

  -- Sólo si la cuenta está en este negocio. El día que pueda estar en varios,
  -- cambiarle el rol en uno no le toca los permisos que tiene en otro.
  if new.usuario_id is not null then
    update usuario
       set rol = new.rol
     where id = new.usuario_id
       and negocio_id = new.negocio_id;
  end if;

  return new;
end;
$$;

-- Sin revoke de ejecución: una función que devuelve trigger no se puede
-- llamar directo (ver 036).

drop trigger if exists empleado_rol_da_permisos on empleado;
create trigger empleado_rol_da_permisos
  before update of rol on empleado
  for each row
  execute function rol_de_la_ficha_da_permisos();

-- ------------------------------------------------------------
-- 3. usuario_id sólo lo ponen las funciones
-- ------------------------------------------------------------
-- La aplicación da de alta fichas con id, negocio_id, nombre y rol, y cambia
-- el rol. Nada más, y nunca usuario_id.
revoke insert, update on empleado from authenticated;
revoke insert, update on empleado from anon;

grant insert (id, negocio_id, nombre, rol) on empleado to authenticated;
grant update (nombre, rol) on empleado to authenticated;

-- CÓMO VERIFICARLO (sólo lee):
--
--   select privilege_type, column_name
--     from information_schema.column_privileges
--    where table_schema = 'public' and table_name = 'empleado'
--      and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
--    order by 1, 2;
--
-- INSERT: id, negocio_id, nombre, rol. UPDATE: nombre, rol. Nunca usuario_id.
