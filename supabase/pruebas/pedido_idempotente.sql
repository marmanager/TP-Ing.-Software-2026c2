-- ============================================================
-- pruebas/pedido_idempotente.sql — prueba la 039 contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase, DESPUÉS de la 039.
--
-- No deja nada: crea dos cuentas de mentira, prueba, y al final lo deshace
-- todo. El bloque de adentro termina con un error a propósito ('deshacer')
-- que se atrapa: al atraparlo, Postgres vuelve atrás todo lo que hizo.
--
-- Cómo leer el resultado:
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó. Tampoco deja nada.
--   cualquier otro error              → la prueba no pudo correr (por
--                                        ejemplo, falta la 039).
--
-- Las sesiones se simulan como las arma Supabase: rol "authenticated" y el id
-- de la cuenta en request.jwt.claims, que es de donde lee auth.uid().
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();
  beto uuid := gen_random_uuid();
  n integer;
  frenado boolean;
begin
  begin
    insert into auth.users (id, email) values
      (ana,  'prueba-ana-'  || ana  || '@ejemplo.test'),
      (beto, 'prueba-beto-' || beto || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);

    -- ---- 1. Cada uno guarda su clave; usuario_id sale de la sesión ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    insert into pedido_idempotente (ruta, clave, huella) values ('POST /v1/insumos', 'clave-1', 'h');
    select count(*) into n from pedido_idempotente where usuario_id = ana and clave = 'clave-1';
    if n <> 1 then
      raise exception 'FALLÓ 1: no se guardó la clave con el usuario de la sesión.';
    end if;

    -- ---- 2. La misma clave en la misma ruta no entra dos veces ----
    frenado := false;
    begin
      insert into pedido_idempotente (ruta, clave, huella) values ('POST /v1/insumos', 'clave-1', 'h');
    exception when unique_violation then
      frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 2: la misma clave entró dos veces en la misma ruta.';
    end if;

    -- ---- 3. Otra persona puede usar la misma clave, y no ve la de Ana ----
    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    insert into pedido_idempotente (ruta, clave, huella) values ('POST /v1/insumos', 'clave-1', 'h');
    select count(*) into n from pedido_idempotente where usuario_id = ana;
    if n <> 0 then
      raise exception 'FALLÓ 3: una cuenta ve las claves de otra.';
    end if;

    -- ---- 4. Beto no puede escribir a nombre de Ana ----
    frenado := false;
    begin
      insert into pedido_idempotente (usuario_id, ruta, clave, huella) values (ana, 'POST /v1/insumos', 'colada', 'h');
    exception when insufficient_privilege then
      frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 4: una cuenta guardó una clave a nombre de otra.';
    end if;

    -- ---- 5. Ni cambiar ni borrar las de Ana ----
    update pedido_idempotente set estado_http = 200 where usuario_id = ana;
    delete from pedido_idempotente where usuario_id = ana;
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select count(*) into n from pedido_idempotente where usuario_id = ana and estado_http is null;
    if n <> 1 then
      raise exception 'FALLÓ 5: una cuenta cambió o borró las claves de otra.';
    end if;

    -- ---- 6. Ana sí completa y borra las suyas ----
    update pedido_idempotente set estado_http = 201, respuesta = '{"ok":true}' where clave = 'clave-1';
    select count(*) into n from pedido_idempotente where clave = 'clave-1' and estado_http = 201;
    if n <> 1 then
      raise exception 'FALLÓ 6: la dueña de la clave no pudo guardar la respuesta.';
    end if;
    delete from pedido_idempotente where clave = 'clave-1';
    select count(*) into n from pedido_idempotente;
    if n <> 0 then
      raise exception 'FALLÓ 6: la dueña de la clave no pudo borrarla.';
    end if;

    -- ---- 7. Sin sesión no se ve nada ----
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    frenado := false;
    begin
      perform 1 from pedido_idempotente;
    exception when insufficient_privilege then
      frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 7: sin sesión se puede leer la tabla.';
    end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
