-- ============================================================
-- 015_paso_aprobado_fijo.sql — lo que el cliente aprobó ya no se cambia
--
-- Correr en el SQL Editor de Supabase, después de 001..014.
-- Es idempotente.
--
-- POR QUÉ:
-- Un paso aprobado es un acuerdo con el cliente: dijo que sí a ese trabajo
-- por esa plata. Desde ahora no se puede volver atrás, ni cambiarle el
-- nombre o el monto, ni sacarlo del presupuesto.
--
-- Lo que el cliente todavía no aprobó sigue siendo movible: un paso
-- esperando respuesta se puede sacar, y uno rechazado se puede volver a
-- poner en espera, porque el cliente puede cambiar de idea sobre algo que
-- no había aceptado.
--
-- OJO: la cartilla, secciones 08 y 09, dice "Aprobar o rechazar se puede
-- deshacer". Esta regla la contradice a propósito, por decisión del equipo.
--
-- "aprobado_en" es cuándo lo aprobó. Como la aprobación ya no se deshace,
-- es un dato estable, y el historial suma la plata aprobada en un período
-- con esto, en vez de sumar eventos.
-- ============================================================

alter table paso add column if not exists aprobado_en timestamptz;

-- ------------------------------------------------------------
-- Relleno de los pasos que ya estaban aprobados
-- ------------------------------------------------------------
-- La fecha sale del último evento "Lo aprobó el cliente" de ese caso cuyo
-- detalle empieza con el nombre del paso. Si no hay ninguno, vale la fecha
-- en que se creó el paso: es la mejor aproximación que hay.

update paso p set aprobado_en = coalesce(
  (
    select max(e.ocurrido_en)
    from evento e
    where e.caso_id = p.caso_id
      and e.titulo = 'Lo aprobó el cliente'
      and e.detalle like p.nombre || ' · %'
  ),
  p.creado_en
)
where p.estado = 'aprobado' and p.aprobado_en is null;

-- ------------------------------------------------------------
-- Un paso aprobado no se modifica
-- ------------------------------------------------------------
create or replace function paso_aprobado_no_se_modifica()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'aprobado' and (
       new.estado is distinct from old.estado
    or new.nombre is distinct from old.nombre
    or new.descripcion is distinct from old.descripcion
    or new.monto is distinct from old.monto
    or new.caso_id is distinct from old.caso_id
    or new.aprobado_en is distinct from old.aprobado_en
  ) then
    raise exception 'Este paso ya lo aprobó el cliente y no se puede cambiar.';
  end if;
  return new;
end;
$$;

drop trigger if exists paso_aprobado_fijo on paso;
create trigger paso_aprobado_fijo
  before update on paso
  for each row
  execute function paso_aprobado_no_se_modifica();

-- ------------------------------------------------------------
-- Un paso aprobado no se borra
-- ------------------------------------------------------------
-- Salvo que se esté borrando su caso entero (on delete cascade): en ese
-- momento el caso ya no existe, y no hay acuerdo que proteger.
--
-- security definer: tiene que ver el caso aunque las políticas no se lo
-- muestren a quien está borrando.
create or replace function paso_aprobado_no_se_borra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado = 'aprobado'
     and exists (select 1 from caso where id = old.caso_id) then
    raise exception 'Este paso ya lo aprobó el cliente y no se puede sacar del presupuesto.';
  end if;
  return old;
end;
$$;

drop trigger if exists paso_aprobado_no_se_borra on paso;
create trigger paso_aprobado_no_se_borra
  before delete on paso
  for each row
  execute function paso_aprobado_no_se_borra();
