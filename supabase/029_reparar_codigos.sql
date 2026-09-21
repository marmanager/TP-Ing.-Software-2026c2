-- Repara funciones creadas con versiones anteriores de 007, 018, 024 y 027.
-- Es idempotente: ejecutar una vez en SQL Editor después de las migraciones previas.
-- gen_random_uuid() ya se usa para las claves primarias de esta misma base.

do $$
declare
  nombre text;
  funcion regprocedure;
  definicion text;
  anterior constant text := 'encode(gen_random_bytes(16), ''hex'')';
  nuevo constant text := 'replace(gen_random_uuid()::text, ''-'', '''')';
begin
  foreach nombre in array array[
    'public.compartir_caso(uuid)',
    'public.compartir_agenda()',
    'public.compartir_ics()'
  ] loop
    funcion := to_regprocedure(nombre);
    if funcion is not null then
      definicion := pg_get_functiondef(funcion);
      if position(anterior in definicion) > 0 then
        execute replace(definicion, anterior, nuevo);
      end if;
    end if;
  end loop;

  if to_regclass('public.invitacion') is not null then
    alter table public.invitacion
      alter column codigo set default replace(gen_random_uuid()::text, '-', '');
  end if;
end;
$$;
