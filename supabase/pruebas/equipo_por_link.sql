-- ============================================================
-- pruebas/equipo_por_link.sql — prueba la 051 contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase. Antes de la 051 tiene que
-- fallar (las funciones no existen); después, dar "Success".
--
-- No deja nada: crea cuentas y negocios de mentira, prueba, y al final lo
-- deshace todo con un error a propósito ('deshacer') que se atrapa.
--
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó.
--   cualquier otro error              → la prueba no pudo correr.
--
-- Las tablas que la RLS esconde (negocio, empleado, solicitud_de_ingreso) se
-- leen como postgres; las funciones se llaman con la sesión simulada.
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();  -- dueña de A
  edu  uuid := gen_random_uuid();  -- será encargado de A
  ivo  uuid := gen_random_uuid();  -- será técnico de A
  zoe  uuid := gen_random_uuid();  -- pide y la rechazan
  neg_a uuid;
  link1 text;
  link2 text;
  pedido uuid;
  n integer;
  fila record;
  frenado boolean;
begin
  begin
    insert into auth.users (id, email) values
      (ana, 'prueba-ana-' || ana || '@ejemplo.test'),
      (edu, 'prueba-edu-' || edu || '@ejemplo.test'),
      (ivo, 'prueba-ivo-' || ivo || '@ejemplo.test'),
      (zoe, 'prueba-zoe-' || zoe || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Equipo A', 'taller', '[]'::jsonb);

    -- ---- 1. El link del equipo: crearlo y cambiarlo ----
    select codigo into link1 from cambiar_link_de_equipo(30);
    select codigo into link2 from link_de_equipo();
    if link1 is null or link2 is distinct from link1 then
      raise exception 'FALLÓ 1: el link del equipo no quedó creado.';
    end if;
    select codigo into link2 from cambiar_link_de_equipo(30);
    if link2 is null or link2 = link1 then
      raise exception 'FALLÓ 1: cambiar el link no hizo uno nuevo.';
    end if;
    frenado := false;
    begin
      perform pedir_entrar(link1, 'Alguien');
    exception when raise_exception then frenado := (sqlerrm = 'Quien te invitó dio de baja este link.');
    end;
    if not frenado then
      raise exception 'FALLÓ 1: el link anterior todavía sirve.';
    end if;

    -- ---- 2. Edu pide entrar: queda un pedido y ninguna ficha ----
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    select * into fila from pedir_entrar(link2, 'Edu');
    if fila.estado <> 'pendiente' or fila.negocio_nombre <> 'Equipo A' then
      raise exception 'FALLÓ 2: pedir entrar no quedó pendiente.';
    end if;
    perform pedir_entrar(link2, 'Edu');
    select count(*) into n from mis_pedidos();
    if n <> 1 then
      raise exception 'FALLÓ 2: pedir dos veces dejó % pedidos.', n;
    end if;
    select count(*) into n from mis_negocios();
    if n <> 0 then
      raise exception 'FALLÓ 2: con el pedido pendiente, el negocio aparece en sus negocios.';
    end if;
    select count(*) into n from empleado;
    if n <> 0 then
      raise exception 'FALLÓ 2: con el pedido pendiente, ve el equipo del negocio.';
    end if;
    select count(*) into n from caso;
    if n <> 0 then
      raise exception 'FALLÓ 2: con el pedido pendiente, ve casos.';
    end if;
    perform set_config('role', 'postgres', true);
    select count(*) into n from empleado where usuario_id = edu;
    perform set_config('role', 'authenticated', true);
    if n <> 0 then
      raise exception 'FALLÓ 2: pedir entrar creó una ficha.';
    end if;

    -- ---- 4. Ana aprueba a Edu como encargado (antes que el 3, para tenerlo) ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select id into pedido from pedidos_de_ingreso() where nombre = 'Edu';
    if pedido is null then
      raise exception 'FALLÓ 4: la dueña no ve el pedido de Edu.';
    end if;
    perform aprobar_solicitud(pedido, 'encargado');
    perform set_config('role', 'postgres', true);
    select rol into fila from empleado where usuario_id = edu and negocio_id = neg_a;
    select count(*) into n from solicitud_de_ingreso where usuario_id = edu;
    perform set_config('role', 'authenticated', true);
    if fila.rol is distinct from 'encargado' or n <> 0 then
      raise exception 'FALLÓ 4: aprobar no dejó la ficha con el rol elegido, o el pedido sigue.';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    select count(*) into n from mis_negocios() m where m.id = neg_a;
    if n <> 1 then
      raise exception 'FALLÓ 4: aprobado, el negocio no aparece en sus negocios.';
    end if;
    select * into fila from usuario where id = edu;
    if fila.negocio_id is distinct from neg_a or fila.rol <> 'encargado' then
      raise exception 'FALLÓ 4: sin otro negocio, el aprobado no quedó adentro con su rol.';
    end if;

    -- ---- Ivo pide entrar; Ana lo aprueba como técnico ----
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link2, 'Ivo');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select id into pedido from pedidos_de_ingreso() where nombre = 'Ivo';
    perform aprobar_solicitud(pedido, 'tecnico');

    -- ---- 3. Encargado y técnico: sin sumar_al_equipo ----
    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link2, 'Zoe');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select id into pedido from pedidos_de_ingreso() where nombre = 'Zoe';

    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform pedidos_de_ingreso(); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 3: el encargado ve los pedidos.'; end if;
    frenado := false;
    begin perform aprobar_solicitud(pedido, 'tecnico'); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 3: el encargado aprobó un pedido.'; end if;
    frenado := false;
    begin perform rechazar_solicitud(pedido); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 3: el encargado rechazó un pedido.'; end if;
    frenado := false;
    begin perform cambiar_link_de_equipo(30); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 3: el encargado cambió el link.'; end if;

    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform link_de_equipo(); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 3: el técnico ve el link.'; end if;

    -- ---- 6. El rol: rangos, y uno que no existe ----
    if rango_del_rol('duenio') <> 3 or rango_del_rol('encargado') <> 2
       or rango_del_rol('tecnico') <> 1 or rango_del_rol('inventado') <> 0 then
      raise exception 'FALLÓ 6: los rangos de los roles están mal.';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform aprobar_solicitud(pedido, 'inventado'); exception when raise_exception then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 6: se aprobó con un rol que no existe.'; end if;

    -- ---- 5. Ana rechaza a Zoe: sin ficha y sin pedido ----
    perform rechazar_solicitud(pedido);
    perform set_config('role', 'postgres', true);
    select count(*) into n from empleado where usuario_id = zoe;
    if n <> 0 then
      perform set_config('role', 'authenticated', true);
      raise exception 'FALLÓ 5: rechazar creó una ficha.';
    end if;
    select count(*) into n from solicitud_de_ingreso where usuario_id = zoe;
    perform set_config('role', 'authenticated', true);
    if n <> 0 then
      raise exception 'FALLÓ 5: rechazar no borró el pedido.';
    end if;

    -- ---- 7. Fichas: ninguna sin cuenta, y no se crean a mano ----
    perform set_config('role', 'postgres', true);
    select count(*) into n from empleado where usuario_id is null and negocio_id = neg_a;
    perform set_config('role', 'authenticated', true);
    if n <> 0 then
      raise exception 'FALLÓ 7: quedan % fichas sin cuenta.', n;
    end if;
    frenado := false;
    begin
      insert into empleado (negocio_id, nombre, rol) values (neg_a, 'Sin cuenta', 'tecnico');
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 7: se pudo crear una ficha a mano.';
    end if;

    -- ---- 8. Invitaciones: no se crean a mano ----
    frenado := false;
    begin
      insert into invitacion (negocio_id, rol, vence_en) values (neg_a, 'duenio', now() + interval '1 day');
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 8: se pudo crear una invitación a mano.';
    end if;

    -- ---- 9. Un link vencido no sirve ----
    perform set_config('role', 'postgres', true);
    update invitacion set vence_en = now() - interval '1 minute' where codigo = link2;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    frenado := false;
    begin
      perform pedir_entrar(link2, 'Zoe');
    exception when raise_exception then frenado := (sqlerrm = 'Este link ya venció. Pedí uno nuevo.');
    end;
    if not frenado then
      raise exception 'FALLÓ 9: un link vencido todavía sirve.';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select count(*) into n from link_de_equipo();
    if n <> 0 then
      raise exception 'FALLÓ 9: el dueño todavía ve el link vencido.';
    end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
