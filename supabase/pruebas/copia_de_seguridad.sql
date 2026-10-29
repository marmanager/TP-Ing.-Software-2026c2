-- ============================================================
-- pruebas/copia_de_seguridad.sql — prueba la 071 contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase, DESPUÉS de la 071.
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
  ana  uuid := gen_random_uuid();  -- dueña del taller A
  edu  uuid := gen_random_uuid();  -- encargado de A: no tiene el permiso
  zoe  uuid := gen_random_uuid();  -- dueña de otro negocio, B
  neg_a uuid;
  neg_b uuid;
  link text;
  pedido uuid;
  cli1 uuid;
  cli2 uuid;
  k1 uuid;
  k2 uuid;
  k3 uuid;
  k4 uuid;
  copia uuid;
  copia_b uuid;
  antes uuid;
  codigo_agenda text;
  n integer;
  txt text;
  frenado boolean;
begin
  begin
    insert into auth.users (id, email) values
      (ana, 'prueba-ana-' || ana || '@ejemplo.test'),
      (edu, 'prueba-edu-' || edu || '@ejemplo.test'),
      (zoe, 'prueba-zoe-' || zoe || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Copia A', 'taller', '[]'::jsonb);
    select codigo into link from cambiar_link_de_equipo(30);
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link, 'Edu');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select id into pedido from pedidos_de_ingreso() where nombre = 'Edu';
    perform aprobar_solicitud(pedido, (select id from rol where negocio_id = neg_a and nombre = 'Encargado'));
    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    neg_b := crear_mi_negocio('Copia B', 'personalizable', '[]'::jsonb);

    -- Lo que tiene A cuando se hace la copia.
    perform set_config('role', 'postgres', true);
    insert into cliente (negocio_id, nombre) values (neg_a, 'Cliente uno') returning id into cli1;
    insert into caso (negocio_id, numero, servicio, cliente_id, diagnostico)
      values (neg_a, 1, 'Aceite', cli1, 'original') returning id into k1;
    insert into caso (negocio_id, numero, servicio) values (neg_a, 2, 'Frenos') returning id into k2;
    insert into paso (caso_id, nombre, monto, estado) values (k1, 'Filtro', 100, 'aprobado');
    insert into insumo (negocio_id, nombre, cantidad) values (neg_a, 'Aceite 5W30', 10);
    insert into caso (negocio_id, numero, servicio) values (neg_b, 1, 'De B');
    update negocio set descripcion = 'descripción original' where id = neg_a;
    select agenda_codigo into codigo_agenda from negocio where id = neg_a;

    -- ---- 1. El dueño tiene el permiso; el encargado no ----
    if not ('copia_de_seguridad' = any(permisos_conocidos())) then
      raise exception 'FALLÓ 1: el permiso no está en el catálogo.';
    end if;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform hacer_copia(neg_a, 'manual');
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 1: el encargado pudo hacer una copia.'; end if;

    -- ---- 2. Hacer una copia ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform hacer_copia(neg_a, 'automatica');
    exception when invalid_parameter_value then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 2: a mano se pudo pedir una copia automática.'; end if;
    copia := hacer_copia(neg_a, 'manual');
    perform set_config('role', 'postgres', true);
    select count(*) into n from copia_de_seguridad where negocio_id = neg_a and origen = 'manual' and migracion = version_del_esquema();
    if n <> 1 then raise exception 'FALLÓ 2: la copia no quedó guardada (%).', n; end if;
    select count(*) into n from copia_de_seguridad where negocio_id = neg_b;
    if n <> 0 then raise exception 'FALLÓ 2: se copió el otro negocio.'; end if;

    -- ---- 3. Se cambia de todo después de la copia ----
    update cliente set nombre = 'Cliente cambiado' where id = cli1;
    insert into cliente (negocio_id, nombre) values (neg_a, 'Cliente nuevo') returning id into cli2;
    update caso set diagnostico = 'cambiado' where id = k1;
    insert into paso (caso_id, nombre, monto, estado) values (k1, 'Nuevo aprobado', 50, 'aprobado');
    delete from insumo where negocio_id = neg_a;
    insert into caso (negocio_id, numero, servicio) values (neg_a, 3, 'Con cobro') returning id into k3;
    insert into cobro (negocio_id, caso_id, monto, medio) values (neg_a, k3, 100, 'efectivo');
    insert into caso (negocio_id, numero, servicio) values (neg_a, 4, 'Sin cobro') returning id into k4;
    update negocio set descripcion = 'descripción nueva' where id = neg_a;
    delete from empleado where negocio_id = neg_a and usuario_id = edu;  -- se echó a Edu

    -- ---- 4. Sin permiso no se restablece; con otra copia que no es del negocio tampoco ----
    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    copia_b := hacer_copia(neg_b, 'manual');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform restablecer_copia(copia_b);
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 4: Ana restableció la copia de otro negocio.'; end if;

    -- ---- 5. Restablecer ----
    perform restablecer_copia(copia);
    perform set_config('role', 'postgres', true);

    select nombre into txt from cliente where id = cli1;
    if txt <> 'Cliente uno' then raise exception 'FALLÓ 5: el cliente no volvió (%).', txt; end if;
    if exists (select 1 from cliente where id = cli2) then raise exception 'FALLÓ 5: el cliente nuevo sigue.'; end if;
    select diagnostico into txt from caso where id = k1;
    if txt <> 'original' then raise exception 'FALLÓ 5: el caso no volvió (%).', txt; end if;
    select count(*) into n from paso where caso_id = k1;
    if n <> 1 then raise exception 'FALLÓ 5: el caso 1 tiene % pasos y no 1 (el aprobado nuevo debía irse).', n; end if;
    select count(*) into n from insumo where negocio_id = neg_a and nombre = 'Aceite 5W30' and cantidad = 10;
    if n <> 1 then raise exception 'FALLÓ 5: el insumo borrado no volvió.'; end if;
    if exists (select 1 from caso where id = k4) then raise exception 'FALLÓ 5: el caso nuevo sin cobro sigue.'; end if;
    select descripcion into txt from negocio where id = neg_a;
    if txt <> 'descripción original' then raise exception 'FALLÓ 5: el negocio no volvió (%).', txt; end if;

    -- ---- 6. Lo de afuera no cambia ----
    if not exists (select 1 from caso where id = k3) then raise exception 'FALLÓ 6: se borró un caso con cobro.'; end if;
    select count(*) into n from cobro where caso_id = k3;
    if n <> 1 then raise exception 'FALLÓ 6: el cobro no sobrevivió.'; end if;
    if exists (select 1 from empleado where negocio_id = neg_a and usuario_id = edu) then
      raise exception 'FALLÓ 6: restablecer le devolvió la ficha a quien se echó.';
    end if;
    if (select agenda_codigo from negocio where id = neg_a) is distinct from codigo_agenda then
      raise exception 'FALLÓ 6: cambió el link de la agenda.';
    end if;
    select count(*) into n from caso where negocio_id = neg_b;
    if n <> 1 then raise exception 'FALLÓ 6: se tocó el otro negocio.'; end if;

    -- ---- 7. Se puede deshacer ----
    select id into antes from copia_de_seguridad where negocio_id = neg_a and origen = 'antes_de_restablecer';
    if antes is null then raise exception 'FALLÓ 7: no quedó la copia de antes de restablecer.'; end if;
    perform set_config('role', 'authenticated', true);
    perform restablecer_copia(antes);
    perform set_config('role', 'postgres', true);
    if not exists (select 1 from caso where id = k4) or not exists (select 1 from cliente where id = cli2) then
      raise exception 'FALLÓ 7: deshacer no devolvió lo de antes.';
    end if;
    select count(*) into n from paso where caso_id = k1;
    if n <> 2 then raise exception 'FALLÓ 7: deshacer no devolvió el paso aprobado (%).', n; end if;

    -- ---- 8. Una copia de antes de una migración no se restablece ----
    update copia_de_seguridad set migracion = '070' where id = copia;
    perform set_config('role', 'authenticated', true);
    frenado := false;
    begin perform restablecer_copia(copia);
    exception when raise_exception then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 8: se restableció una copia de otra versión.'; end if;
    perform set_config('role', 'postgres', true);
    select nombre into txt from cliente where id = cli1;
    if txt <> 'Cliente cambiado' then raise exception 'FALLÓ 8: el rechazo dejó cambios a medias.'; end if;

    -- ---- 9. Quedan las 3 últimas ----
    perform set_config('role', 'authenticated', true);
    perform hacer_copia(neg_a, 'manual');
    perform hacer_copia(neg_a, 'manual');
    perform hacer_copia(neg_a, 'manual');
    perform set_config('role', 'postgres', true);
    select count(*) into n from copia_de_seguridad where negocio_id = neg_a and origen = 'manual';
    if n <> 3 then raise exception 'FALLÓ 9: quedaron % copias manuales y no 3.', n; end if;
    if exists (select 1 from copia_de_seguridad where id = copia) then raise exception 'FALLÓ 9: no se borró la más vieja.'; end if;

    -- ---- 10. Los triggers siguen cerrados para quien no está restableciendo ----
    perform set_config('role', 'authenticated', true);
    frenado := false;
    begin
      insert into copia_en_curso (txid) values (txid_current());
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: una sesión pudo prender la marca de restablecer.'; end if;
    frenado := false;
    begin
      update paso set monto = 1 where caso_id = k1 and estado = 'aprobado';
    exception when raise_exception then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se pudo cambiar un paso aprobado a mano.'; end if;

    -- ---- 11. Las copias no se leen desde afuera ----
    frenado := false;
    begin
      perform 1 from copia_de_seguridad;
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 11: se pudo leer la tabla de copias.'; end if;
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    frenado := false;
    begin
      perform restablecer_copia(copia);
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 11: sin sesión se pudo restablecer.'; end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
