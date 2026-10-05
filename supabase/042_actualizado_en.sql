-- 042_actualizado_en.sql
-- Marca la versión de las filas editables para que la API pueda detectar
-- choques igual que ya hace con caso.actualizado_en.

do $$
declare tabla text;
begin
  foreach tabla in array array['negocio', 'cliente', 'empleado', 'insumo', 'turno', 'paso', 'invitacion', 'cobro']
  loop
    execute format('alter table %I add column if not exists actualizado_en timestamptz not null default now()', tabla);
    execute format('drop trigger if exists %I on %I', tabla || '_actualizado_en', tabla);
    execute format(
      'create trigger %I before update on %I for each row execute function tocar_actualizado_en()',
      tabla || '_actualizado_en', tabla
    );
  end loop;
end $$;
