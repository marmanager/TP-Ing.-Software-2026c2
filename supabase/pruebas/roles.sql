-- ============================================================
-- pruebas/roles.sql — prueba los roles (053 a 059) contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase. Cada etapa suma secciones; una
-- sección de una migración que todavía no se corrió falla con "function ...
-- does not exist".
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
  ana  uuid := gen_random_uuid();  -- crea el taller A
  edu  uuid := gen_random_uuid();  -- encargado de A
  ivo  uuid := gen_random_uuid();  -- técnico de A
  zoe  uuid := gen_random_uuid();  -- crea un negocio personalizable
  neg_a uuid;
  neg_p uuid;
  link text;
  pedido uuid;
  n integer;
  fila record;
  frenado boolean;
  permiso text;
begin
  begin
    insert into auth.users (id, email) values
      (ana, 'prueba-ana-' || ana || '@ejemplo.test'),
      (edu, 'prueba-edu-' || edu || '@ejemplo.test'),
      (ivo, 'prueba-ivo-' || ivo || '@ejemplo.test'),
      (zoe, 'prueba-zoe-' || zoe || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Roles A', 'taller', '[]'::jsonb);

    -- Edu entra como encargado e Ivo como técnico, por el link (051).
    select codigo into link from cambiar_link_de_equipo(30);
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link, 'Edu');
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link, 'Ivo');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select id into pedido from pedidos_de_ingreso() where nombre = 'Edu';
    perform aprobar_solicitud(pedido, 'encargado');
    select id into pedido from pedidos_de_ingreso() where nombre = 'Ivo';
    perform aprobar_solicitud(pedido, 'tecnico');

    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    neg_p := crear_mi_negocio('Roles P', 'personalizable', '[]'::jsonb);

    -- ---- 1. Un negocio nuevo nace con sus roles ----
    perform set_config('role', 'postgres', true);
    select count(*) into n from rol where negocio_id = neg_a;
    if n <> 3 then raise exception 'FALLÓ 1: el taller nació con % roles y no 3.', n; end if;
    select count(*) into n from rol where negocio_id = neg_a and es_duenio and nombre = 'Dueño';
    if n <> 1 then raise exception 'FALLÓ 1: el taller no tiene su rol Dueño.'; end if;
    select count(*) into n from rol where negocio_id = neg_a and nombre in ('Encargado', 'Mecánico') and not es_duenio;
    if n <> 2 then raise exception 'FALLÓ 1: el taller no trae Encargado y Mecánico.'; end if;
    select count(*) into n from rol where negocio_id = neg_p;
    if n <> 1 then raise exception 'FALLÓ 1: el personalizable nació con % roles y no sólo Dueño.', n; end if;

    -- ---- 2. Cada ficha apunta al rol de su clave vieja ----
    select count(*) into n
      from empleado e join rol r on r.id = e.rol_id
     where e.negocio_id = neg_a and r.clave is distinct from e.rol;
    if n <> 0 then raise exception 'FALLÓ 2: % fichas apuntan a un rol que no es el de su clave.', n; end if;
    select count(*) into n from empleado where rol_id is null;
    if n <> 0 then raise exception 'FALLÓ 2: hay % fichas sin rol_id en toda la base.', n; end if;
    select count(*) into n
      from empleado e join rol r on r.id = e.rol_id
     where r.negocio_id <> e.negocio_id;
    if n <> 0 then raise exception 'FALLÓ 2: hay % fichas con un rol de otro negocio.', n; end if;

    -- ---- 3. El rol Dueño no se toca ----
    frenado := false;
    begin
      update rol set nombre = 'Jefe' where negocio_id = neg_a and es_duenio;
    exception when raise_exception then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 3: el rol Dueño se pudo renombrar.'; end if;
    frenado := false;
    begin
      delete from rol where negocio_id = neg_a and es_duenio;
    exception when raise_exception then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 3: el rol Dueño se pudo borrar.'; end if;

    -- ---- 4. Un permiso que no existe no entra ----
    frenado := false;
    begin
      insert into rol (negocio_id, nombre, permisos) values (neg_a, 'Raro', array['borrar_todo']);
    exception when check_violation then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 4: se guardó un permiso que no está en el catálogo.'; end if;

    -- ---- 5. Desde el navegador no se escribe rol ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin
      insert into rol (negocio_id, nombre) values (neg_a, 'Directo');
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 5: la dueña insertó un rol sin pasar por las funciones.'; end if;
    select count(*) into n from rol;
    if n <> 3 then raise exception 'FALLÓ 5: la dueña ve % roles y no los 3 de su negocio.', n; end if;

    -- ---- 6. Cada persona puede exactamente lo de su rol viejo ----
    perform set_config('role', 'authenticated', true);
    foreach permiso in array permisos_conocidos() loop
      perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
      if not puede_en(neg_a, permiso) then
        raise exception 'FALLÓ 6: la dueña no puede %.', permiso;
      end if;
      perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
      if puede_en(neg_a, permiso) is distinct from (permiso = any(permisos_de_clave('encargado'))) then
        raise exception 'FALLÓ 6: el encargado cambió en %.', permiso;
      end if;
      perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
      if puede_en(neg_a, permiso) is distinct from (permiso = any(permisos_de_clave('tecnico'))) then
        raise exception 'FALLÓ 6: el técnico cambió en %.', permiso;
      end if;
      -- Zoe no tiene ficha en A.
      perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
      if puede_en(neg_a, permiso) then
        raise exception 'FALLÓ 6: sin ficha en A, Zoe puede % en A.', permiso;
      end if;
    end loop;

    -- Los tres permisos que ya existían (047, 051) dicen lo mismo que antes.
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    if puede_en(neg_a, 'vincular_sedes') or puede_en(neg_a, 'sumar_al_equipo') or not puede_en(neg_a, 'ver_inventario_de_sedes') then
      raise exception 'FALLÓ 6: los permisos de sedes y equipo del encargado cambiaron.';
    end if;
    if puede_en(neg_a, 'borrar_todo') then
      raise exception 'FALLÓ 6: un permiso que no existe dio que sí.';
    end if;

    -- mis_permisos() dice lo mismo, con el nombre del rol.
    select * into fila from jsonb_to_record(mis_permisos()) as x(rol_nombre text, es_duenio boolean, permisos text[]);
    if fila.rol_nombre <> 'Encargado' or fila.es_duenio or fila.permisos <> permisos_de_clave('encargado') then
      raise exception 'FALLÓ 6: mis_permisos() del encargado dice otra cosa.';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select * into fila from jsonb_to_record(mis_permisos()) as x(rol_nombre text, es_duenio boolean, permisos text[]);
    if not fila.es_duenio or fila.permisos <> permisos_conocidos() then
      raise exception 'FALLÓ 6: mis_permisos() de la dueña no trae el catálogo entero.';
    end if;

    -- ---- 7. Las políticas: lo mismo que antes, ahora por permiso ----
    perform set_config('role', 'authenticated', true);

    -- Un caso de Edu y otro de Ivo, cargados por la dueña.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    insert into caso (negocio_id, numero, servicio, responsable_id)
    select neg_a, 901, 'Frenos', e.id from empleado e where e.negocio_id = neg_a and e.nombre = 'Ivo';
    insert into caso (negocio_id, numero, servicio) values (neg_a, 902, 'Aceite');

    -- El técnico ve sólo el suyo, y no lo mueve de estado.
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select count(*) into n from caso;
    if n <> 1 then raise exception 'FALLÓ 7: el técnico ve % casos y no 1.', n; end if;
    frenado := false;
    begin
      update caso set estado = 'en_proceso' where numero = 901;
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cambió el estado de su caso.'; end if;

    -- El técnico no carga clientes, turnos, inventario ni pasos; sí los ve.
    frenado := false;
    begin insert into cliente (negocio_id, nombre) values (neg_a, 'X');
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cargó un cliente.'; end if;
    frenado := false;
    begin insert into turno (negocio_id, motivo, empieza_en) values (neg_a, 'X', now() + interval '1 day');
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cargó un turno.'; end if;
    frenado := false;
    begin insert into insumo (negocio_id, nombre) values (neg_a, 'X');
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cargó inventario.'; end if;
    frenado := false;
    begin insert into paso (caso_id, nombre) select id, 'X' from caso where numero = 901;
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 7: el técnico armó presupuesto.'; end if;

    -- El encargado: carga todo eso, ve todos los casos, asigna y mueve estado.
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    select count(*) into n from caso;
    if n <> 2 then raise exception 'FALLÓ 7: el encargado ve % casos y no 2.', n; end if;
    insert into cliente (negocio_id, nombre) values (neg_a, 'Pedro');
    insert into turno (negocio_id, motivo, empieza_en) values (neg_a, 'Service', now() + interval '1 day');
    insert into insumo (negocio_id, nombre) values (neg_a, 'Filtro');
    insert into paso (caso_id, nombre, monto) select id, 'Pastillas', 100 from caso where numero = 902;
    update paso set estado = 'rechazado' where nombre = 'Pastillas';
    update caso set estado = 'en_proceso' where numero = 902;
    update caso set responsable_id = (select id from empleado where negocio_id = neg_a and nombre = 'Edu') where numero = 902;

    -- El encargado no configura el negocio ni toca el equipo.
    update negocio set nombre = 'Cambiado' where id = neg_a;
    perform set_config('role', 'postgres', true);
    select count(*) into n from negocio where id = neg_a and nombre = 'Cambiado';
    perform set_config('role', 'authenticated', true);
    if n <> 0 then raise exception 'FALLÓ 7: el encargado cambió el nombre del negocio.'; end if;
    delete from empleado where negocio_id = neg_a and nombre = 'Ivo';
    perform set_config('role', 'postgres', true);
    select count(*) into n from empleado where negocio_id = neg_a and nombre = 'Ivo';
    perform set_config('role', 'authenticated', true);
    if n <> 1 then raise exception 'FALLÓ 7: el encargado sacó a alguien del equipo.'; end if;

    -- La dueña sí configura.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    update negocio set descripcion = 'Prueba' where id = neg_a;
    perform set_config('role', 'postgres', true);
    select count(*) into n from negocio where id = neg_a and descripcion = 'Prueba';
    perform set_config('role', 'authenticated', true);
    if n <> 1 then raise exception 'FALLÓ 7: la dueña no pudo configurar su negocio.'; end if;

    -- Ninguna política mira ya el rol viejo.
    perform set_config('role', 'postgres', true);
    select count(*) into n from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ 'mi_rol\(\)|puedo_cargar\(\)' or coalesce(with_check, '') ~ 'mi_rol\(\)|puedo_cargar\(\)');
    perform set_config('role', 'authenticated', true);
    if n <> 0 then raise exception 'FALLÓ 7: quedan % políticas con mi_rol() o puedo_cargar().', n; end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then raise; end if;
  end;
end;
$prueba$;
