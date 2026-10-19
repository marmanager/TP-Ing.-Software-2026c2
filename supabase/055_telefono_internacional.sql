-- ============================================================
-- 055_telefono_internacional.sql — el teléfono tiene que poder llegar a WhatsApp
--
-- Correr entero en el SQL Editor de Supabase, después de la 054. Es
-- idempotente. Historia: B-1a (en la API). Va ANTES de desplegar la API que
-- exige el código de país: esa API devuelve negocio.pais y
-- cliente.telefono_incompleto, y PATCH /v1/negocio con { pais } escribe la
-- columna.
--
-- QUÉ AGREGA:
--   negocio.pais                 con qué país arranca el selector de cada
--                                teléfono del negocio. 'AR' en los que ya
--                                existen.
--   cliente.telefono_incompleto  el teléfono guardado no sirve para WhatsApp
--                                (le falta el código de país, o tiene el 0 o
--                                el 15). Calculada: no se escribe.
--
-- QUÉ NO HACE: no cambia ningún teléfono. A un 3414567890 de antes no se le
-- inventa el +54: puede ser de cualquier lado, y mejor que la ficha diga
-- "falta el país" que un aviso que sale a otro país. Se corrigen desde la
-- ficha del cliente (B-1b), y al corregirlo la marca se va sola.
--
-- Cuándo un teléfono sirve es regla de la API (compartido/telefono.ts). Acá
-- va el mismo patrón, para que la base marque lo que la API rechazaría.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El país del negocio
-- ------------------------------------------------------------
-- Es un dato del negocio, no una adivinanza: el mostrador de Rosario abre el
-- formulario y el selector ya dice +54 9. Qué países hay lo decide la API
-- (PAISES); acá sólo se cuida la forma, para no tener que migrar la base
-- cada vez que se suma uno.
alter table negocio add column if not exists pais text not null default 'AR';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'negocio_pais_codigo') then
    alter table negocio add constraint negocio_pais_codigo check (pais ~ '^[A-Z]{2}$');
  end if;
end;
$$;

comment on column negocio.pais is
  'Código ISO del país del negocio (AR, UY…). Con él arranca el selector de país de cada teléfono. '
  'Los países que se pueden elegir los decide la API (compartido/telefono.ts).';

-- ------------------------------------------------------------
-- 2. Los teléfonos incompletos
-- ------------------------------------------------------------
-- Una columna calculada y no un booleano que alguien pone: así se marca lo
-- que ya está guardado (al agregarla) y también lo que entre después por un
-- camino que no pasa por la validación de la API, como pedir turno desde el
-- link (reservar_turno()). Y al corregir el teléfono se desmarca sola.
--
-- Sirve si, con sólo números, espacios, paréntesis, + . y -, los dígitos son
-- un celular completo de un país de la lista. Es PATRON_TELEFONO_COMPLETO de
-- la API, tal cual: pruebas/casos-de-uso/migracion-telefonos.test.ts lo
-- compara con este literal. Si cambia la lista de países, va una migración
-- nueva con el patrón nuevo.
--
--   549?…            Argentina, con o sin el 9 (la API lo agrega al guardar)
--   5989…            Uruguay       569…   Chile        55..9…  Brasil
--   5959…            Paraguay      591…   Bolivia      34…     España
--   1…               Estados Unidos
alter table cliente add column if not exists telefono_incompleto boolean
  generated always as (
    coalesce(btrim(telefono), '') <> '' and (
      telefono !~ '^[[:space:]0-9()+.-]*$'
      or regexp_replace(telefono, '[^0-9]', '', 'g') !~
        '^(?:549?(?:1[0-46-9]|[23][0-9])[0-9]{8}|5989[0-9]{7}|569[0-9]{8}|55[1-9]{2}9[0-9]{8}|5959[0-9]{8}|591[67][0-9]{7}|34[67][0-9]{8}|1[2-9][0-9]{2}[2-9][0-9]{6})$'
    )
  ) stored;

comment on column cliente.telefono_incompleto is
  'El teléfono no sirve para WhatsApp: le falta el código de país, o tiene el 0 o el 15. '
  'Calculada con el mismo patrón que la API (compartido/telefono.ts). Sin teléfono es false.';

-- ------------------------------------------------------------
-- 3. Cuántos quedaron incompletos
-- ------------------------------------------------------------
-- Queda en la salida del SQL Editor: es el número de fichas que alguien va a
-- tener que corregir.
do $$
declare
  incompletos int;
  con_telefono int;
begin
  select count(*) filter (where telefono_incompleto),
         count(*) filter (where coalesce(btrim(telefono), '') <> '')
    into incompletos, con_telefono
    from cliente;
  raise notice '055: % de % clientes con teléfono quedaron con el teléfono incompleto. No se cambió ninguno: se corrigen desde la ficha.',
    incompletos, con_telefono;
end;
$$;
