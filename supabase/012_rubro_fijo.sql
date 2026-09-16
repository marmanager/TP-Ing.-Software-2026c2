-- ============================================================
-- 012_rubro_fijo.sql — el rubro queda fijo desde el primer caso (SCRUM-90)
--
-- Correr en el SQL Editor de Supabase, después de 001..011.
-- Es idempotente.
--
-- POR QUÉ:
-- Un negocio no cambia de oficio. Con casos cargados, pasar un taller a
-- medicina no convierte las patentes en DNI ni a los mecánicos en
-- profesionales: sólo les cambia el nombre a datos que siguen siendo de un
-- taller, y todo queda sin sentido.
--
-- Pero equivocarse al elegir el rubro cuando se crea el negocio tiene que
-- tener arreglo. Por eso el rubro se puede cambiar mientras el negocio no
-- tenga ningún caso —abierto o cerrado— y desde el primero queda fijo.
--
-- La pantalla de "Mi negocio" ya no ofrece el cambio cuando hay casos. Esto
-- es para que la regla se cumpla igual aunque alguien use la clave anónima
-- a mano.
--
-- security definer: la cuenta de casos tiene que ver todos los casos del
-- negocio, sin depender de lo que las políticas de `caso` le dejen ver a
-- quien está haciendo el cambio.
-- ============================================================

create or replace function rubro_fijo_con_casos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rubro is distinct from old.rubro
     and exists (select 1 from caso where negocio_id = old.id) then
    raise exception 'El rubro no se puede cambiar: el negocio ya tiene casos cargados con las palabras de su rubro.';
  end if;
  return new;
end;
$$;

drop trigger if exists negocio_rubro_fijo on negocio;
create trigger negocio_rubro_fijo
  before update of rubro on negocio
  for each row
  execute function rubro_fijo_con_casos();
