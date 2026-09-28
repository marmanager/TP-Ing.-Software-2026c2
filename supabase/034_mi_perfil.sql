-- ============================================================
-- 034_mi_perfil.sql — el perfil de cada persona (SCRUM-118)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..033.
-- Es idempotente.
--
-- POR QUÉ:
-- La foto del negocio ya existía (016). Faltaba la de cada persona, y que
-- cada uno pudiera corregir su nombre y su teléfono sin depender del dueño.
--
-- TRES COSAS:
--
--   usuario.foto          La foto de la persona, achicada en el navegador a
--                         256 píxeles como la del negocio. null es que no
--                         cargó ninguna.
--
--   guardar_mi_perfil()   Guarda nombre, teléfono y foto de quien entró, y
--                         copia el nombre a su ficha del equipo.
--
--   fotos_del_equipo()    Le muestra a cada uno la foto de sus compañeros
--                         de negocio, y nada más de su fila.
--
-- POR QUÉ UNA FUNCIÓN PARA GUARDAR:
-- Cada persona tiene dos nombres: el de su cuenta (usuario.nombre) y el de su
-- ficha en el equipo (empleado.nombre), y el historial firma con el de la
-- ficha. La ficha sólo la puede tocar el dueño (008_permisos.sql), así que un
-- técnico que cambiara su nombre en la cuenta seguiría firmando con el viejo.
-- Esta función cambia los dos a la vez, y sólo los de quien entró: por eso
-- puede saltear las políticas (security definer) sin abrir nada de nadie.
--
-- POR QUÉ UNA FUNCIÓN PARA VER LAS FOTOS:
-- La política de usuario (005_rls.sql) deja ver sólo la fila propia. Abrirla
-- a los compañeros abriría también el mail y el teléfono: las políticas
-- filtran filas, no columnas. Esta función devuelve el id y la foto, nada más.
--
-- Editar la foto de otro no hace falta impedirlo acá: usuario_edita_lo_suyo
-- (005) ya lo impide, y guardar_mi_perfil() sólo toca la fila de quien entró.
-- ============================================================

alter table usuario add column if not exists foto text;

-- ------------------------------------------------------------
-- Guardar el perfil de quien entró
-- ------------------------------------------------------------
-- Es un borde de confianza: cualquier cuenta la puede llamar con lo que
-- quiera adentro. La pantalla ya valida todo esto, pero la base no confía en
-- la pantalla.
create or replace function guardar_mi_perfil(p_nombre text, p_telefono text, p_foto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  limpio text := nullif(trim(p_nombre), '');
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;

  if limpio is null then
    raise exception 'Falta tu nombre.';
  end if;

  -- Una foto es una imagen chica ya achicada: unos 20 KB. El tope deja
  -- margen de sobra y frena que alguien guarde cualquier cosa, de cualquier
  -- tamaño, llamando a la función a mano.
  if p_foto is not null and (p_foto not like 'data:image/%' or length(p_foto) > 400000) then
    raise exception 'La foto no es válida.';
  end if;

  update usuario
     set nombre   = limpio,
         telefono = nullif(trim(p_telefono), ''),
         foto     = p_foto
   where id = auth.uid();

  -- La ficha del equipo es la que firma el historial. El dueño no tiene
  -- ficha: para él no cambia ninguna fila, y está bien.
  update empleado
     set nombre = limpio
   where usuario_id = auth.uid();
end;
$$;

revoke all on function guardar_mi_perfil(text, text, text) from public;
revoke all on function guardar_mi_perfil(text, text, text) from anon;
grant execute on function guardar_mi_perfil(text, text, text) to authenticated;

-- ------------------------------------------------------------
-- Las fotos de los compañeros de negocio
-- ------------------------------------------------------------
-- Sólo el id y la foto: ni el mail ni el teléfono salen de acá. Sin negocio,
-- mi_negocio() da null y no devuelve nada.
create or replace function fotos_del_equipo()
returns table (usuario_id uuid, foto text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.foto
    from usuario u
   where u.negocio_id = mi_negocio()
     and u.foto is not null;
$$;

revoke all on function fotos_del_equipo() from public;
revoke all on function fotos_del_equipo() from anon;
grant execute on function fotos_del_equipo() to authenticated;
