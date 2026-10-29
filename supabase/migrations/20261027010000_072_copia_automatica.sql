-- ============================================================
-- 072_copia_automatica.sql — la copia automática (docs/copia-de-seguridad.md, paso 2)
--
-- Correr entero en el SQL Editor de Supabase, después de la 071. Es
-- idempotente. Probar con supabase/pruebas/copia_automatica.sql.
--
-- QUÉ AGREGA:
--   copia_datos(negocio)            el jsonb de la copia (sale de copia_guardar,
--                                   que ahora lo usa: mismo resultado que en la 071).
--   hacer_copias_de_esta_hora(...)  copia los negocios con copia_automatica cuya
--                                   copia_hora es la hora de ahora. Si no cambió
--                                   nada desde su última copia, no hace otra: una
--                                   semana sin uso no se lleva las 3 buenas.
--   el cron 'copias'                la llama en punto, cada hora (pg_cron).
--
-- LA ZONA HORARIA: negocio no tiene zona, sólo pais. De entrada todos usan
-- America/Argentina/Buenos_Aires.
-- ponytail: una zona para todos; cuando haya negocios de otro huso, una zona por país.
--
-- No cambia columnas de las tablas copiadas: version_del_esquema() sigue en '071'.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El armado de los datos, aparte para poder compararlo
-- ------------------------------------------------------------
create or replace function copia_datos(p_negocio uuid) returns jsonb
  language plpgsql stable security definer set search_path to 'public' as $$
declare
  t record;
  v_filas jsonb;
  v_datos jsonb := '{}'::jsonb;
begin
  for t in select * from copia_tablas() order by orden loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) - $2), ''[]''::jsonb) from %I x where %s', t.tabla, t.filtro)
      into v_filas using p_negocio, t.excluir;
    v_datos := v_datos || jsonb_build_object(t.tabla, v_filas);
  end loop;
  return v_datos;
end;
$$;

create or replace function copia_guardar(p_negocio uuid, p_origen text) returns uuid
  language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
begin
  insert into copia_de_seguridad (negocio_id, creada_en, origen, migracion, datos)
  values (p_negocio, clock_timestamp(), p_origen, version_del_esquema(), copia_datos(p_negocio))
  returning id into v_id;

  -- Quedan las 3 últimas; la de antes de restablecer cuenta aparte, y es una sola.
  delete from copia_de_seguridad
   where negocio_id = p_negocio and origen <> 'antes_de_restablecer'
     and id not in (select id from copia_de_seguridad
                     where negocio_id = p_negocio and origen <> 'antes_de_restablecer'
                     order by creada_en desc, id limit 3);
  delete from copia_de_seguridad
   where negocio_id = p_negocio and origen = 'antes_de_restablecer'
     and id not in (select id from copia_de_seguridad
                     where negocio_id = p_negocio and origen = 'antes_de_restablecer'
                     order by creada_en desc, id limit 1);
  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- 2. Las copias de esta hora. Devuelve cuántas hizo.
--    p_ahora sólo se pasa en las pruebas.
-- ------------------------------------------------------------
create or replace function hacer_copias_de_esta_hora(p_ahora timestamptz default now()) returns integer
  language plpgsql security definer set search_path to 'public' as $$
declare
  n record;
  v_hora integer := extract(hour from p_ahora at time zone 'America/Argentina/Buenos_Aires');
  v_ultima copia_de_seguridad%rowtype;
  v_hechas integer := 0;
begin
  for n in select id from negocio where copia_automatica and copia_hora = v_hora loop
    begin
      select * into v_ultima from copia_de_seguridad
       where negocio_id = n.id and origen <> 'antes_de_restablecer'
       order by creada_en desc, id limit 1;
      -- Sin cambios desde la última (y con la misma estructura): no se hace otra.
      if found and v_ultima.migracion = version_del_esquema() and v_ultima.datos = copia_datos(n.id) then
        continue;
      end if;
      perform copia_guardar(n.id, 'automatica');
      v_hechas := v_hechas + 1;
    exception when others then
      -- Que un negocio falle no deja a los demás sin copia.
      raise warning 'copia automática del negocio % falló: %', n.id, sqlerrm;
    end;
  end loop;
  return v_hechas;
end;
$$;

revoke all on function copia_datos(uuid) from public, anon, authenticated;
revoke all on function hacer_copias_de_esta_hora(timestamptz) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. El reloj: pg_cron, en punto, cada hora (schedule con nombre reemplaza al anterior)
-- ------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('copias', '0 * * * *', $$ select hacer_copias_de_esta_hora() $$);
