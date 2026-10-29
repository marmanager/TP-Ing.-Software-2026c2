-- ============================================================
-- pruebas/copias_para_la_api.sql — prueba la 073 contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase, DESPUÉS de la 073.
-- No deja nada: lo deshace todo con un error a propósito ('deshacer').
--
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó.
--   cualquier otro error              → la prueba no pudo correr.
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();
  edu  uuid := gen_random_uuid();
  zoe  uuid := gen_random_uuid();
  neg_a uuid;
  neg_b uuid;
  link text;
  pedido uuid;
  copia uuid;
  fila record;
  n integer;
  frenado boolean;
begin
  begin
    insert into auth.users (id, email) values
      (ana, 'prueba-ana-' || ana || '@ejemplo.test'),
      (edu, 'prueba-edu-' || edu || '@ejemplo.test'),
      (zoe, 'prueba-zoe-' || zoe || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Lista A', 'taller', '[]'::jsonb);
    select codigo into link from cambiar_link_de_equipo(30);
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link, 'Edu');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select id into pedido from pedidos_de_ingreso() where nombre = 'Edu';
    perform aprobar_solicitud(pedido, (select id from rol where negocio_id = neg_a and nombre = 'Encargado'));
    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    neg_b := crear_mi_negocio('Lista B', 'personalizable', '[]'::jsonb);
    perform hacer_copia(neg_b, 'manual');

    -- ---- 1. Sin el permiso, las tres dan 42501 ----
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform 1 from copias_del_negocio();
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 1: el encargado vio la lista.'; end if;
    frenado := false;
    begin perform 1 from configuracion_de_copias();
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 1: el encargado vio la configuración.'; end if;
    frenado := false;
    begin perform configurar_copias(true, 6::smallint);
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 1: el encargado configuró las copias.'; end if;

    -- ---- 2. La lista: sólo las de su negocio, sin datos, con si se puede restablecer ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select count(*) into n from copias_del_negocio();
    if n <> 0 then raise exception 'FALLÓ 2: la lista trae % copias y no 0 (la de B se coló).', n; end if;
    copia := hacer_copia(neg_a, 'manual');
    select * into fila from copias_del_negocio();
    if fila.id <> copia or fila.origen <> 'manual' or not fila.restablecible then
      raise exception 'FALLÓ 2: la copia no aparece bien en la lista.';
    end if;
    perform set_config('role', 'postgres', true);
    update copia_de_seguridad set migracion = '070' where id = copia;
    perform set_config('role', 'authenticated', true);
    select * into fila from copias_del_negocio();
    if fila.restablecible then raise exception 'FALLÓ 2: una copia de otra versión figura como restablecible.'; end if;

    -- ---- 3. La configuración ----
    select * into fila from configuracion_de_copias();
    if fila.automatica or fila.hora <> 4 then raise exception 'FALLÓ 3: de fábrica no es apagada y a las 4.'; end if;
    perform configurar_copias(true, 6::smallint);
    select * into fila from configuracion_de_copias();
    if not fila.automatica or fila.hora <> 6 then raise exception 'FALLÓ 3: no guardó la configuración.'; end if;
    frenado := false;
    begin perform configurar_copias(true, 24::smallint);
    exception when raise_exception then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 3: aceptó la hora 24.'; end if;
    frenado := false;
    begin perform configurar_copias(true, null);
    exception when raise_exception then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 3: aceptó una hora vacía.'; end if;

    -- ---- 4. Sin sesión, nada ----
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    frenado := false;
    begin perform 1 from copias_del_negocio();
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 4: sin sesión se pudo ver la lista.'; end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
