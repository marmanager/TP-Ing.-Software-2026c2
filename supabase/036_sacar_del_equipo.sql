-- ============================================================
-- 036_sacar_del_equipo.sql — sacar a alguien del equipo le quita el acceso
--
-- Correr entero en el SQL Editor de Supabase, después de 001..035.
-- Es idempotente.
--
-- EL AGUJERO:
-- "Sacar" en Equipo borraba la ficha de la persona y nada más. Dejaba de
-- aparecer en Equipo y ya no se le podían asignar casos, pero su cuenta
-- seguía apuntando al negocio (usuario.negocio_id) con el mismo rol. Seguía
-- entrando y viendo todo, y si era encargado seguía cargando y modificando.
-- Nada en la base volvía a dejar vacío ese negocio_id.
--
-- EL ARREGLO, EN LA CAUSA:
-- El problema no es la pantalla: es que borrar una ficha no quita el acceso.
-- Por eso va como trigger sobre el borrado de empleado y no como una función
-- que llame la pantalla. Así lo cubre cualquier camino que borre una ficha
-- —el botón "Sacar", la API directa, el SQL Editor— y la aplicación no
-- necesita cambiar: sigue borrando la ficha como antes.
--
-- Al borrar una ficha ligada a una cuenta, esa cuenta queda sin negocio: con
-- mi_negocio() en null no ve nada. El rol vuelve al de una cuenta nueva
-- ('duenio'): si después crea su propio negocio, tiene que ser dueño de ése,
-- no técnico. Sólo se toca si su negocio es éste; si ya estaba en otro, no.
--
-- Nadie se puede sacar a sí mismo: se quedaría afuera de su propio negocio
-- sin forma de volver a entrar.
--
-- Quién puede borrar fichas no cambia: sólo el dueño (008_permisos.sql). Los
-- casos que tenía la persona quedan sin responsable solos, porque
-- caso.responsable_id se vacía al borrar la ficha (001, on delete set null).
--
-- BEFORE y no AFTER: si hay que frenar el borrado —sacarse a uno mismo—, se
-- frena antes de que pase. El cambio a usuario va en la misma operación que
-- el borrado: o pasan los dos, o ninguno.
-- ============================================================

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

  if old.usuario_id = auth.uid() then
    raise exception 'No te podés sacar a vos del equipo.';
  end if;

  update usuario
     set negocio_id = null,
         rol        = 'duenio'
   where id = old.usuario_id
     and negocio_id = old.negocio_id;

  return old;
end;
$$;

-- Sin revoke de ejecución, a diferencia de las otras funciones: una función
-- que devuelve trigger no se puede llamar directo —ni desde la API ni a mano—,
-- así que no hay nada que cerrar, y quitarle el permiso podría trabar el
-- trigger al dispararse.

drop trigger if exists empleado_quita_acceso on empleado;
create trigger empleado_quita_acceso
  before delete on empleado
  for each row
  execute function quitar_acceso_al_sacar();
