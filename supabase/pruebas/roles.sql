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

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then raise; end if;
  end;
end;
$prueba$;
