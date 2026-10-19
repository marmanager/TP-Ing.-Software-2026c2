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
  neg_b uuid;
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
    perform aprobar_solicitud(pedido, (select id from rol where negocio_id = neg_a and nombre = 'Encargado'));
    select id into pedido from pedidos_de_ingreso() where nombre = 'Ivo';
    perform aprobar_solicitud(pedido, (select id from rol where negocio_id = neg_a and nombre = 'Mecánico'));

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
    frenado := false;
    begin
      update caso set diagnostico = 'Pastillas gastadas' where numero = 901;
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cambió el diagnóstico de su caso.'; end if;
    frenado := false;
    begin
      update caso set que_falta = 'Repuesto' where numero = 901;
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 7: el técnico cambió que_falta de su caso.'; end if;

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

    -- Quien sólo aprueba (un rol a medida): responde un paso, pero no lo arma.
    perform set_config('role', 'postgres', true);
    insert into rol (negocio_id, nombre, permisos)
    values (neg_a, 'Sólo aprobar', array['ver_todos_los_casos', 'aprobar_por_el_cliente']);
    update empleado set rol_id = (select id from rol where negocio_id = neg_a and nombre = 'Sólo aprobar')
     where negocio_id = neg_a and nombre = 'Ivo';
    -- Que actualizado_en difiera, como pasa en una base con historia (042).
    perform set_config('session_replication_role', 'replica', true);
    update paso set actualizado_en = now() - interval '1 day' where nombre = 'Pastillas';
    perform set_config('session_replication_role', 'origin', true);
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    frenado := false;
    begin
      update paso set nombre = 'x' where nombre = 'Pastillas';
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLÓ 7: quien sólo aprueba pudo cambiar el nombre de un paso.'; end if;
    update paso set estado = 'aprobado' where nombre = 'Pastillas';
    perform set_config('role', 'postgres', true);
    update empleado set rol_id = (select id from rol where negocio_id = neg_a and clave = 'tecnico')
     where negocio_id = neg_a and nombre = 'Ivo';
    delete from rol where negocio_id = neg_a and nombre = 'Sólo aprobar';
    perform set_config('role', 'authenticated', true);

    -- Ninguna política mira ya el rol viejo.
    perform set_config('role', 'postgres', true);
    select count(*) into n from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ 'mi_rol\(\)|puedo_cargar\(\)' or coalesce(with_check, '') ~ 'mi_rol\(\)|puedo_cargar\(\)');
    perform set_config('role', 'authenticated', true);
    if n <> 0 then raise exception 'FALLÓ 7: quedan % políticas con mi_rol() o puedo_cargar().', n; end if;

    -- ---- 8. Las funciones: mismo resultado que antes ----
    perform set_config('role', 'authenticated', true);

    -- El técnico no comparte la agenda ni cobra; la dueña sí comparte.
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform compartir_agenda(); exception when others then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 8: el técnico compartió la agenda.'; end if;

    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform compartir_agenda(); exception when others then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 8: el encargado compartió la agenda.'; end if;

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform compartir_agenda();

    -- El técnico marca hechos los pasos de SU caso, no los de otro.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    insert into paso (caso_id, nombre, estado) select id, 'Suyo', 'aprobado' from caso where numero = 901;
    insert into paso (caso_id, nombre, estado) select id, 'Ajeno', 'aprobado' from caso where numero = 902;
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select * into fila from jsonb_to_record(marcar_paso_hecho((select id from paso where nombre = 'Suyo'), true)) as x(ok boolean);
    if not fila.ok then raise exception 'FALLÓ 8: el técnico no pudo marcar un paso de su caso.'; end if;
    perform set_config('role', 'postgres', true);
    select id into pedido from paso where nombre = 'Ajeno';
    perform set_config('role', 'authenticated', true);
    select * into fila from jsonb_to_record(marcar_paso_hecho(pedido, true)) as x(ok boolean);
    if fila.ok then raise exception 'FALLÓ 8: el técnico marcó un paso de un caso ajeno.'; end if;

    -- Ninguna función decide ya con mi_rol() ni puedo_cargar().
    perform set_config('role', 'postgres', true);
    select count(*) into n
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.proname not in ('mi_rol', 'puedo_cargar')
       and p.prosrc ~ 'mi_rol\(\)|puedo_cargar\(\)';
    perform set_config('role', 'authenticated', true);
    if n <> 0 then raise exception 'FALLÓ 8: quedan % funciones que deciden con el rol viejo.', n; end if;

    -- ---- 9. mis_negocios() trae el rol nuevo ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select * into fila from mis_negocios() where id = neg_a;
    if fila.rol_nombre <> 'Mecánico' or fila.es_duenio or fila.permisos <> permisos_de_clave('tecnico') then
      raise exception 'FALLÓ 9: mis_negocios() del técnico no trae su rol nuevo.';
    end if;

    -- ---- 10. Roles a medida y el tope ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);

    -- La dueña arma "Recepción" (puede manejar roles y cobrar, nada más) y se
    -- la da a Edu.
    pedido := guardar_rol(null, 'Recepción', array['manejar_roles', 'cobrar']);
    perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Edu'), pedido);

    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    if not puede_aca('cobrar') or puede_aca('crear_casos') then
      raise exception 'FALLÓ 10: el rol asignado no dio sus permisos.';
    end if;

    -- Edu no arma un rol con un permiso que no tiene.
    frenado := false;
    begin perform guardar_rol(null, 'Amigo', array['cobrar', 'crear_casos']);
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se dio un permiso que no se tiene.'; end if;

    -- Sí uno dentro de lo suyo.
    perform guardar_rol(null, 'Caja', array['cobrar']);

    -- No edita el Encargado (tiene permisos que él no).
    frenado := false;
    begin perform guardar_rol((select id from rol where negocio_id = neg_a and nombre = 'Encargado'), 'Encargado', array['cobrar']);
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se editó un rol con más permisos que el propio.'; end if;

    -- No edita su propio rol, ni el Dueño, ni se cambia el rol.
    frenado := false;
    begin perform guardar_rol(pedido, 'Recepción', array['cobrar']);
    exception when raise_exception then frenado := (sqlerrm = 'El rol propio no se modifica.'); end;
    if not frenado then raise exception 'FALLÓ 10: se editó el rol propio.'; end if;
    frenado := false;
    begin perform guardar_rol((select id from rol where negocio_id = neg_a and es_duenio), 'Jefe', '{}');
    exception when raise_exception then frenado := (sqlerrm = 'El rol Dueño no se modifica.'); end;
    if not frenado then raise exception 'FALLÓ 10: se editó el rol Dueño.'; end if;
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Edu'), (select id from rol where negocio_id = neg_a and nombre = 'Caja'));
    exception when raise_exception then frenado := (sqlerrm = 'El rol propio no se modifica.'); end;
    if not frenado then raise exception 'FALLÓ 10: alguien se cambió su propio rol.'; end if;

    -- No se da el rol Dueño, ni baja a la dueña, ni baja a Ivo al rol Caja
    -- (Ivo tiene permisos de mirar que Edu ya no).
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Ivo'), (select id from rol where negocio_id = neg_a and es_duenio));
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se dio el rol Dueño sin ser Dueño.'; end if;
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and usuario_id = ana), (select id from rol where negocio_id = neg_a and nombre = 'Caja'));
    exception when others then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se le cambió el rol a la creadora.'; end if;
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Ivo'), (select id from rol where negocio_id = neg_a and nombre = 'Caja'));
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se bajó a alguien con permisos que el propio no tiene.'; end if;

    -- Un rol de otro negocio no se asigna.
    perform set_config('role', 'postgres', true);
    select id into fila from rol where negocio_id = neg_p and es_duenio;
    perform set_config('role', 'authenticated', true);
    frenado := false;
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Ivo'), fila.id);
    exception when raise_exception then frenado := (sqlerrm = 'Ese rol ya no existe.'); end;
    if not frenado then raise exception 'FALLÓ 10: se asignó un rol de otro negocio.'; end if;

    -- Un rol en uso no se borra; uno libre sí.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform borrar_rol(pedido);
    exception when raise_exception then frenado := (sqlerrm like 'Rol asignado a 1 persona%'); end;
    if not frenado then raise exception 'FALLÓ 10: se borró un rol en uso.'; end if;
    perform borrar_rol((select id from rol where negocio_id = neg_a and nombre = 'Caja'));

    -- Nombre repetido y permiso inexistente.
    frenado := false;
    begin perform guardar_rol(null, 'recepción', '{}');
    exception when raise_exception then frenado := (sqlerrm = 'Ya hay un rol con ese nombre.'); end;
    if not frenado then raise exception 'FALLÓ 10: se repitió el nombre de un rol.'; end if;
    frenado := false;
    begin perform guardar_rol(null, 'Raro', array['borrar_todo']);
    exception when raise_exception then frenado := (sqlerrm = 'Hay un permiso que no existe.'); end;
    if not frenado then raise exception 'FALLÓ 10: se guardó un permiso que no existe.'; end if;

    -- roles_del_negocio() cuenta las personas.
    select personas into n from roles_del_negocio() where nombre = 'Recepción';
    if n <> 1 then raise exception 'FALLÓ 10: roles_del_negocio() cuenta % personas en Recepción.', n; end if;

    -- Desde el navegador ya no se escribe el rol de una ficha.
    frenado := false;
    begin update empleado set rol = 'tecnico' where negocio_id = neg_a and nombre = 'Ivo';
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se cambió empleado.rol sin pasar por asignar_rol().'; end if;

    frenado := false;
    begin update empleado set rol_id = (select id from rol where negocio_id = neg_a and nombre = 'Mecánico') where negocio_id = neg_a and nombre = 'Ivo';
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: se cambió empleado.rol_id sin pasar por asignar_rol().'; end if;

    -- Quien tiene todos los permisos sin ser Dueño no le baja el rol a un Dueño.
    -- La dueña hace Dueño a Ivo y deja a Edu con un rol que tiene todo el catálogo.
    frenado := false;
    pedido := guardar_rol(null, 'Casi dueño', permisos_conocidos());
    perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Ivo'), (select id from rol where negocio_id = neg_a and es_duenio));
    perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Edu'), pedido);
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    begin perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Ivo'), (select id from rol where negocio_id = neg_a and nombre = 'Mecánico'));
    exception when insufficient_privilege then frenado := (sqlerrm = 'Solo un Dueño puede cambiar el rol de otro Dueño.'); end;
    if not frenado then raise exception 'FALLÓ 10: quien no es Dueño le bajó el rol a un Dueño.'; end if;

    -- Se deja todo como estaba para la sección 11.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Ivo'), (select id from rol where negocio_id = neg_a and nombre = 'Mecánico'));
    pedido := (select id from rol where negocio_id = neg_a and nombre = 'Recepción');
    perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Edu'), pedido);

    -- ---- 11. Aprobar un pedido con un rol a medida ----
    perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link, 'Zoe');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform aprobar_solicitud((select id from pedidos_de_ingreso() where nombre = 'Zoe'), pedido);
    perform set_config('role', 'postgres', true);
    select count(*) into n from empleado where negocio_id = neg_a and usuario_id = zoe and rol_id = pedido;
    perform set_config('role', 'authenticated', true);
    if n <> 1 then raise exception 'FALLÓ 11: aprobar no dejó a Zoe con el rol elegido.'; end if;

    -- ---- 12. Visitas entre sedes ----
    -- Ana crea la sede B y la vincula con A (vincular_sede, 047, desde el
    -- negocio activo). Ivo es miembro sólo de A.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_b := crear_mi_negocio('Roles B', 'taller', '[]'::jsonb);
    perform entrar_al_negocio(neg_a);
    perform vincular_sede(neg_b);
    perform set_config('role', 'postgres', true);
    insert into cliente (negocio_id, nombre) values (neg_b, 'Cliente de B');
    perform set_config('role', 'authenticated', true);

    -- Sin ver_sedes_vinculadas, Ivo no ve B y no entra.
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    select count(*) into n from sedes_que_veo() where id = neg_b;
    if n <> 0 then raise exception 'FALLÓ 12: sin el permiso, Ivo ve la sede B.'; end if;
    frenado := false;
    begin perform entrar_de_visita(neg_b); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 12: sin el permiso, Ivo entró de visita.'; end if;

    -- Con el permiso (la dueña le suma ver_sedes_vinculadas a Mecánico), la ve y entra.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    perform guardar_rol((select id from rol where negocio_id = neg_a and nombre = 'Mecánico'), 'Mecánico',
      permisos_de_clave('tecnico') || array['ver_sedes_vinculadas']);
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select count(*) into n from sedes_que_veo() where id = neg_b and not soy_miembro;
    if n <> 1 then raise exception 'FALLÓ 12: con el permiso, Ivo no ve la sede B como visita.'; end if;
    perform entrar_de_visita(neg_b);

    -- De visita: ve lo que su rol ve en A (clientes sí; casos ajenos no) y no escribe nada.
    select count(*) into n from cliente where nombre = 'Cliente de B';
    if n <> 1 then raise exception 'FALLÓ 12: de visita, Ivo no ve los clientes de B.'; end if;
    if puede_aca('editar_clientes') or puede_aca('ver_todos_los_casos') then
      raise exception 'FALLÓ 12: de visita, Ivo tiene permisos que no son de mirar o que no tiene en A.';
    end if;
    frenado := false;
    begin insert into cliente (negocio_id, nombre) values (neg_b, 'X');
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 12: de visita, Ivo cargó un cliente.'; end if;
    select count(*) into n from cobro;
    if n <> 0 then raise exception 'FALLÓ 12: de visita, Ivo ve cobros.'; end if;
    select count(*) into n from ecuacion;
    if n <> 0 then raise exception 'FALLÓ 12: de visita, Ivo ve ecuaciones.'; end if;

    -- Tampoco por una función security definer: un paso aprobado de un caso
    -- de B sin responsable (ahí mi_empleado() y responsable_id son null).
    perform set_config('role', 'postgres', true);
    insert into caso (negocio_id, numero, servicio) values (neg_b, 903, 'Sin responsable');
    insert into paso (caso_id, nombre, estado) select id, 'De B', 'aprobado' from caso where numero = 903;
    select id into pedido from paso where nombre = 'De B';
    perform set_config('role', 'authenticated', true);
    select * into fila from jsonb_to_record(marcar_paso_hecho(pedido, true)) as x(ok boolean);
    if fila.ok then raise exception 'FALLÓ 12: de visita, Ivo marcó un paso hecho.'; end if;

    -- Una visita que dejó de valer no deja leer nada de B: la dueña le quita el
    -- permiso a Mecánico mientras Ivo está en B.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform guardar_rol((select id from rol where negocio_id = neg_a and nombre = 'Mecánico'), 'Mecánico',
      permisos_de_clave('tecnico'));
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select count(*) into n from empleado;
    if n <> 0 then raise exception 'FALLÓ 12: la visita vencida lee % empleados de B.', n; end if;
    select count(*) into n from rol;
    if n <> 0 then raise exception 'FALLÓ 12: la visita vencida lee % roles de B.', n; end if;
    select count(*) into n from negocio;
    if n <> 0 then raise exception 'FALLÓ 12: la visita vencida lee el negocio B.'; end if;
    select count(*) into n from fotos_del_equipo();
    if n <> 0 then raise exception 'FALLÓ 12: la visita vencida lee las fotos del equipo de B.'; end if;
    -- Con el permiso de vuelta, la visita vuelve a valer.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform guardar_rol((select id from rol where negocio_id = neg_a and nombre = 'Mecánico'), 'Mecánico',
      permisos_de_clave('tecnico') || array['ver_sedes_vinculadas']);
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select count(*) into n from negocio where id = neg_b;
    if n <> 1 then raise exception 'FALLÓ 12: con el permiso de vuelta, Ivo no ve el negocio B.'; end if;

    -- De visita se mira el historial de un caso, no se escribe.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform guardar_rol((select id from rol where negocio_id = neg_a and nombre = 'Mecánico'), 'Mecánico',
      permisos_de_clave('tecnico') || array['ver_sedes_vinculadas', 'ver_todos_los_casos']);
    perform set_config('role', 'postgres', true);
    insert into evento (caso_id, titulo) select id, 'Del caso de B' from caso where numero = 903;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);
    select count(*) into n from evento where titulo = 'Del caso de B';
    if n <> 1 then raise exception 'FALLÓ 12: de visita, Ivo no ve el historial del caso de B.'; end if;
    frenado := false;
    begin insert into evento (caso_id, titulo) select id, 'De la visita' from caso where numero = 903;
    exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 12: de visita, Ivo escribió en el historial de B.'; end if;
    update evento set titulo = 'Pisado' where titulo = 'Del caso de B';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLÓ 12: de visita, Ivo cambió el historial de B.'; end if;
    delete from evento where titulo = 'Del caso de B';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLÓ 12: de visita, Ivo borró el historial de B.'; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform guardar_rol((select id from rol where negocio_id = neg_a and nombre = 'Mecánico'), 'Mecánico',
      permisos_de_clave('tecnico') || array['ver_sedes_vinculadas']);
    perform set_config('request.jwt.claims', json_build_object('sub', ivo, 'role', 'authenticated')::text, true);

    -- Volver a su sede limpia la visita.
    perform entrar_al_negocio(neg_a);
    perform set_config('role', 'postgres', true);
    select count(*) into n from usuario where id = ivo and visitando_desde is not null;
    perform set_config('role', 'authenticated', true);
    if n <> 0 then raise exception 'FALLÓ 12: volver a su sede no limpió la visita.'; end if;

    -- ---- 13. Borrar el negocio ----
    perform set_config('role', 'authenticated', true);

    -- Edu (no es el creador) no lo borra, aunque fuera Dueño.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    perform asignar_rol((select id from empleado where negocio_id = neg_a and nombre = 'Edu'),
                        (select id from rol where negocio_id = neg_a and es_duenio));
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    frenado := false;
    begin perform borrar_negocio(neg_a, 'Roles A'); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 13: un Dueño que no lo creó borró el negocio.'; end if;

    -- Ana, con el nombre mal escrito, tampoco.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin perform borrar_negocio(neg_a, 'Roles');
    exception when raise_exception then frenado := (sqlerrm = 'El nombre escrito no coincide con el del negocio.'); end;
    if not frenado then raise exception 'FALLÓ 13: se borró con el nombre mal escrito.'; end if;

    -- Con el nombre bien, se borra con todo adentro (fichas, roles, casos con
    -- pasos aprobados y cobros).
    perform set_config('role', 'postgres', true);
    insert into cobro (negocio_id, caso_id, monto, medio, estado, pagado_en)
      select negocio_id, id, 50, 'efectivo', 'pagado', now() from caso where numero = 901 and negocio_id = neg_a;
    perform set_config('role', 'authenticated', true);
    perform borrar_negocio(neg_a, 'Roles A');
    perform set_config('role', 'postgres', true);
    select count(*) into n from negocio where id = neg_a;
    if n <> 0 then raise exception 'FALLÓ 13: el negocio sigue.'; end if;
    select count(*) into n from rol where negocio_id = neg_a;
    if n <> 0 then raise exception 'FALLÓ 13: quedaron % roles.', n; end if;
    select count(*) into n from usuario where id in (ana, edu, ivo, zoe) and (negocio_id = neg_a or visitando_desde = neg_a);
    if n <> 0 then raise exception 'FALLÓ 13: quedaron % cuentas paradas en el negocio borrado.', n; end if;
    perform set_config('role', 'authenticated', true);

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then raise; end if;
  end;
end;
$prueba$;
