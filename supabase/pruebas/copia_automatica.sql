-- ============================================================
-- pruebas/copia_automatica.sql — prueba la 072 contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase, DESPUÉS de la 072.
-- La función se prueba con la hora fija; el cron no (sólo que esté programado).
--
-- No deja nada: crea cuentas y negocios de mentira, prueba, y al final lo
-- deshace todo con un error a propósito ('deshacer') que se atrapa.
--
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó.
--   cualquier otro error              → la prueba no pudo correr.
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();
  zoe  uuid := gen_random_uuid();
  neg_a uuid;
  neg_b uuid;
  -- 04:30 en Buenos Aires (UTC-3) = 07:30 UTC
  a_las_4 timestamptz := '2026-10-27 07:30:00+00';
  a_las_5 timestamptz := '2026-10-27 08:30:00+00';
  n integer;
  frenado boolean;
begin
  begin
    insert into auth.users (id, email) values
      (ana, 'prueba-ana-' || ana || '@ejemplo.test'),
      (zoe, 'prueba-zoe-' || zoe || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Auto A', 'taller', '[]'::jsonb);
    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    neg_b := crear_mi_negocio('Auto B', 'personalizable', '[]'::jsonb);
    perform set_config('role', 'postgres', true);

    -- Contar sólo los de la prueba: la base puede tener negocios de verdad.
    -- ---- 1. De fábrica la copia automática está apagada ----
    select count(*) into n from negocio where id in (neg_a, neg_b) and (copia_automatica or copia_hora <> 4);
    if n <> 0 then raise exception 'FALLÓ 1: un negocio nuevo no nace apagado y a las 04:00.'; end if;
    perform hacer_copias_de_esta_hora(a_las_4);
    select count(*) into n from copia_de_seguridad where negocio_id in (neg_a, neg_b);
    if n <> 0 then raise exception 'FALLÓ 1: se copió un negocio con la copia apagada (%).', n; end if;

    -- ---- 2. Prendida, copia a su hora y no a otra ----
    update negocio set copia_automatica = true where id = neg_a;           -- 04:00
    update negocio set copia_automatica = true, copia_hora = 5 where id = neg_b;
    perform hacer_copias_de_esta_hora(a_las_4);
    select count(*) into n from copia_de_seguridad where negocio_id = neg_a and origen = 'automatica';
    if n <> 1 then raise exception 'FALLÓ 2: A no se copió a las 04:30 (%).', n; end if;
    select count(*) into n from copia_de_seguridad where negocio_id = neg_b;
    if n <> 0 then raise exception 'FALLÓ 2: B se copió una hora antes de la suya.'; end if;
    perform hacer_copias_de_esta_hora(a_las_5);
    select count(*) into n from copia_de_seguridad where negocio_id = neg_b and origen = 'automatica';
    if n <> 1 then raise exception 'FALLÓ 2: B no se copió a las 05:30 (%).', n; end if;

    -- ---- 3. Sin cambios no hay otra copia ----
    perform hacer_copias_de_esta_hora(a_las_4);
    perform hacer_copias_de_esta_hora(a_las_4);
    select count(*) into n from copia_de_seguridad where negocio_id = neg_a;
    if n <> 1 then raise exception 'FALLÓ 3: sin cambios se hizo otra copia (%).', n; end if;

    -- ---- 4. Con cambios, sí ----
    insert into cliente (negocio_id, nombre) values (neg_a, 'Cliente nuevo');
    perform hacer_copias_de_esta_hora(a_las_4);
    select count(*) into n from copia_de_seguridad where negocio_id = neg_a and origen = 'automatica';
    if n <> 2 then raise exception 'FALLÓ 4: con cambios no se hizo otra copia (%).', n; end if;

    -- ---- 5. Una semana sin cambios no se lleva las copias buenas ----
    for n in 1..7 loop
      perform hacer_copias_de_esta_hora(a_las_4);
    end loop;
    select count(*) into n from copia_de_seguridad where negocio_id = neg_a;
    if n <> 2 then raise exception 'FALLÓ 5: siete días sin uso dejaron % copias y no 2.', n; end if;

    -- ---- 6. Una copia de otra versión no cuenta como "ya copiado" ----
    update copia_de_seguridad set migracion = '070' where negocio_id = neg_a;
    perform hacer_copias_de_esta_hora(a_las_4);
    select count(*) into n from copia_de_seguridad where negocio_id = neg_a and migracion = version_del_esquema();
    if n <> 1 then raise exception 'FALLÓ 6: con la estructura nueva no se hizo una copia actual (%).', n; end if;

    -- ---- 8. Nadie de afuera la dispara ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform hacer_copias_de_esta_hora(a_las_4);
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 8: un usuario pudo disparar las copias.'; end if;
    perform set_config('role', 'postgres', true);

    -- ---- 9. El cron está programado ----
    select count(*) into n from cron.job where jobname = 'copias' and schedule = '0 * * * *';
    if n <> 1 then raise exception 'FALLÓ 9: el cron "copias" no está programado (%).', n; end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
