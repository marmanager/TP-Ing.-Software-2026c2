-- ============================================================
-- pruebas/red_de_sedes.sql — prueba la 047 contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase. Antes de la 047 tiene que
-- fallar (las funciones no existen); después, dar "Success".
--
-- Desde la 051 (equipo por link) depende también de ella: usa pedir_entrar()
-- y el pedido de ingreso en lugar de aceptar_invitacion(). Antes de la 051
-- tiene que fallar ahí, aunque la 047 esté.
--
-- No deja nada: crea cuentas y negocios de mentira, prueba, y al final lo
-- deshace todo con un error a propósito ('deshacer') que se atrapa.
--
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó.
--   cualquier otro error              → la prueba no pudo correr.
--
-- Las sesiones se simulan como Supabase: rol "authenticated" y el id de la
-- cuenta en request.jwt.claims.
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();  -- dueña de A, B, C, F y G
  beto uuid := gen_random_uuid();  -- dueño de D
  caro uuid := gen_random_uuid();  -- técnica en A y en C
  edu  uuid := gen_random_uuid();  -- encargado en A y en B
  neg_a uuid; neg_b uuid; neg_c uuid; neg_d uuid; neg_f uuid; neg_g uuid;
  inv text;
  red_ab uuid;
  red_x uuid;
  n integer;
  frenado boolean;
  fila record;
begin
  begin
    insert into auth.users (id, email) values
      (ana,  'prueba-ana-'  || ana  || '@ejemplo.test'),
      (beto, 'prueba-beto-' || beto || '@ejemplo.test'),
      (caro, 'prueba-caro-' || caro || '@ejemplo.test'),
      (edu,  'prueba-edu-'  || edu  || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);

    -- ---- Los negocios ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Sede A', 'taller', '[]'::jsonb);
    neg_b := crear_mi_negocio('Sede B', 'taller', '[]'::jsonb);
    neg_c := crear_mi_negocio('Sede C', 'taller', '[]'::jsonb);
    neg_f := crear_mi_negocio('Sede F', 'taller', '[]'::jsonb);
    neg_g := crear_mi_negocio('Sede G', 'taller', '[]'::jsonb);
    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    neg_d := crear_mi_negocio('Sede D', 'taller', '[]'::jsonb);

    -- ---- El equipo: Caro técnica en A y C; Edu encargado en A y B ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    select codigo into inv from cambiar_link_de_equipo(1);
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform pedir_entrar(inv, 'Caro');
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform pedir_entrar(inv, 'Edu');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform aprobar_solicitud((select id from pedidos_de_ingreso() where nombre = 'Caro'), 'tecnico');
    perform aprobar_solicitud((select id from pedidos_de_ingreso() where nombre = 'Edu'), 'encargado');

    perform entrar_al_negocio(neg_c);
    select codigo into inv from cambiar_link_de_equipo(1);
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform pedir_entrar(inv, 'Caro');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform aprobar_solicitud((select id from pedidos_de_ingreso() where nombre = 'Caro'), 'tecnico');

    perform entrar_al_negocio(neg_b);
    select codigo into inv from cambiar_link_de_equipo(1);
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform pedir_entrar(inv, 'Edu');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform aprobar_solicitud((select id from pedidos_de_ingreso() where nombre = 'Edu'), 'encargado');

    -- ---- 1. puede_en, con cada rol ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    if not puede_en(neg_a, 'vincular_sedes') then
      raise exception 'FALLÓ 1: la dueña no puede vincular su sede.';
    end if;
    if puede_en(neg_d, 'vincular_sedes') or puede_en(neg_d, 'ver_inventario_de_sedes') then
      raise exception 'FALLÓ 1: sin ficha en D, puede_en dio que sí.';
    end if;
    if puede_en(neg_a, 'un_permiso_inventado') then
      raise exception 'FALLÓ 1: un permiso que no existe dio que sí.';
    end if;
    if not puede_en(neg_a, 'ver_inventario_de_sedes') then
      raise exception 'FALLÓ 1: la dueña no puede ver el inventario de sedes.';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    if puede_en(neg_a, 'vincular_sedes') or not puede_en(neg_a, 'ver_inventario_de_sedes') then
      raise exception 'FALLÓ 1: el encargado tiene mal los permisos de sedes.';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    if puede_en(neg_a, 'vincular_sedes') or not puede_en(neg_a, 'ver_inventario_de_sedes') then
      raise exception 'FALLÓ 1: la técnica tiene mal los permisos de sedes.';
    end if;

    -- ---- 2. Ana vincula A con B ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    red_ab := vincular_sede(neg_b);
    perform set_config('role', 'postgres', true);
    select count(*) into n from negocio where id in (neg_a, neg_b) and red = red_ab;
    perform set_config('role', 'authenticated', true);
    if red_ab is null or n <> 2 then
      raise exception 'FALLÓ 2: A y B no quedaron en la misma red.';
    end if;

    -- ---- 3. C se suma a la misma red ----
    perform entrar_al_negocio(neg_c);
    if vincular_sede(neg_a) is distinct from red_ab then
      raise exception 'FALLÓ 3: C no se sumó a la red de A y B.';
    end if;
    perform set_config('role', 'postgres', true);
    select red into red_x from negocio where id = neg_c;
    perform set_config('role', 'authenticated', true);
    if red_x is distinct from red_ab then
      raise exception 'FALLÓ 3: C no quedó guardada en la red de A y B.';
    end if;

    -- ---- 4. El encargado no vincula ni desvincula, aunque esté en las dos ----
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    frenado := false;
    begin
      perform vincular_sede(neg_b);
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 4: el encargado pudo vincular sedes.';
    end if;
    frenado := false;
    begin
      perform desvincular_sede();
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 4: el encargado pudo desvincular la sede.';
    end if;

    -- ---- 5. Sin ficha en el otro negocio, no se vincula ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    frenado := false;
    begin
      perform vincular_sede(neg_d);
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 5: se vinculó un negocio ajeno.';
    end if;

    -- ---- 6. Consigo misma, o con otra red, se rechaza ----
    frenado := false;
    begin
      perform vincular_sede(neg_a);
    exception when raise_exception then frenado := (sqlerrm = 'Ya es esta sede.');
    end;
    if not frenado then
      raise exception 'FALLÓ 6: se vinculó una sede consigo misma.';
    end if;
    perform entrar_al_negocio(neg_f);
    perform vincular_sede(neg_g);
    perform entrar_al_negocio(neg_a);
    frenado := false;
    begin
      perform vincular_sede(neg_f);
    exception when raise_exception then frenado := (sqlerrm like 'Ese negocio ya está vinculado%');
    end;
    if not frenado then
      raise exception 'FALLÓ 6: se juntaron dos redes distintas.';
    end if;

    -- ---- 7. La red no se cambia a mano ----
    frenado := false;
    begin
      update negocio set red = gen_random_uuid() where id = neg_a;
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 7: se pudo cambiar la red con un update directo.';
    end if;

    -- ---- 8. La técnica ve el inventario de A y C, no el de B ----
    insert into insumo (negocio_id, nombre, cantidad, estado) values
      (neg_a, 'Filtro', 5, 'en_stock'),
      (neg_a, 'Bujía', 2, 'pedido'),
      (neg_a, 'Ya llegó', 1, 'llegado');
    perform entrar_al_negocio(neg_b);
    insert into insumo (negocio_id, nombre, cantidad, estado) values (neg_b, 'Filtro', 1, 'en_stock');
    perform entrar_al_negocio(neg_c);
    insert into insumo (negocio_id, nombre, cantidad, estado) values (neg_c, 'Filtro', 3, 'en_stock');

    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    select count(*) into n from mis_sedes();
    if n <> 2 then
      raise exception 'FALLÓ 8: la técnica ve % sedes y tendría que ver 2 (A y C).', n;
    end if;
    select count(*) into n from inventario_de_mis_sedes() where negocio_id = neg_b;
    if n <> 0 then
      raise exception 'FALLÓ 8: la técnica ve el inventario de B, donde no tiene ficha.';
    end if;
    select count(*) into n from inventario_de_mis_sedes();
    if n <> 3 then
      raise exception 'FALLÓ 8: la técnica ve % filas y tendría que ver 3.', n;
    end if;
    select * into fila from inventario_de_mis_sedes() where nombre = 'Bujía';
    if fila.estado is distinct from 'pedido' then
      raise exception 'FALLÓ 8: el pedido no vino con su estado.';
    end if;

    -- ---- 9. Desvincular: C sale; después B, y A queda sola, sin red ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_c);
    perform desvincular_sede();
    perform set_config('role', 'postgres', true);
    select count(*) into n from negocio where id in (neg_a, neg_b) and red = red_ab;
    select red into red_x from negocio where id = neg_c;
    perform set_config('role', 'authenticated', true);
    if n <> 2 or red_x is not null then
      raise exception 'FALLÓ 9: desvincular C rompió la red de A y B.';
    end if;
    perform entrar_al_negocio(neg_b);
    perform desvincular_sede();
    perform set_config('role', 'postgres', true);
    select red into red_x from negocio where id = neg_a;
    perform set_config('role', 'authenticated', true);
    if red_x is not null then
      raise exception 'FALLÓ 9: A quedó sola en una red.';
    end if;
    perform set_config('role', 'postgres', true);
    select red into red_x from negocio where id = neg_b;
    perform set_config('role', 'authenticated', true);
    if red_x is not null then
      raise exception 'FALLÓ 9: B no salió de la red.';
    end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
