-- ============================================================
-- pruebas/multinegocio.sql — prueba la 035..038 contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase, DESPUÉS de la 038.
--
-- No deja nada: crea tres cuentas y dos negocios de mentira, prueba, y al
-- final lo deshace todo. El bloque de adentro termina con un error a
-- propósito ('deshacer') que se atrapa: al atraparlo, Postgres vuelve atrás
-- todo lo que hizo el bloque.
--
-- Cómo leer el resultado:
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó. Tampoco deja nada.
--   cualquier otro error              → la prueba no pudo correr (por
--                                        ejemplo, falta alguna migración).
--
-- Las sesiones se simulan como las arma Supabase: rol "authenticated" y el id
-- de la cuenta en request.jwt.claims, que es de donde lee auth.uid().
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();  -- dueña del negocio A
  beto uuid := gen_random_uuid();  -- dueño del negocio B
  caro uuid := gen_random_uuid();  -- técnica, invitada a A
  neg_a uuid;
  neg_b uuid;
  neg_a2 uuid;
  inv_caro text;
  inv_beto text;
  ficha_ana uuid;
  ficha_caro uuid;
  n integer;
  fila record;
  frenado boolean;
begin
  begin
    -- Las cuentas se crean como postgres, antes de pasar a "authenticated".
    insert into auth.users (id, email) values
      (ana,  'prueba-ana-'  || ana  || '@ejemplo.test'),
      (beto, 'prueba-beto-' || beto || '@ejemplo.test'),
      (caro, 'prueba-caro-' || caro || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);

    -- ---- 1. Crear un negocio deja al dueño adentro y con ficha ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Prueba A', 'taller', '[]'::jsonb);
    select * into fila from usuario where id = ana;
    if fila.negocio_id is distinct from neg_a or fila.rol <> 'duenio' then
      raise exception 'FALLÓ 1: crear un negocio no dejó a la cuenta adentro como dueña.';
    end if;
    select id into ficha_ana from empleado
     where usuario_id = ana and negocio_id = neg_a and rol = 'duenio';
    if ficha_ana is null then
      raise exception 'FALLÓ 1: la dueña no tiene ficha en su negocio nuevo.';
    end if;

    -- ---- 2. Beto crea el suyo ----
    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    neg_b := crear_mi_negocio('Prueba B', 'service', '[]'::jsonb);

    -- ---- 3. Ana no ve nada del negocio de Beto ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select count(*) into n from negocio where id = neg_b;
    if n <> 0 then
      raise exception 'FALLÓ 3: una cuenta ve otro negocio.';
    end if;
    select count(*) into n from empleado where negocio_id = neg_b;
    if n <> 0 then
      raise exception 'FALLÓ 3: una cuenta ve el equipo de otro negocio.';
    end if;

    -- ---- 4. No se entra a un negocio ajeno ----
    frenado := false;
    begin
      perform entrar_al_negocio(neg_b);
    exception when raise_exception then
      frenado := sqlerrm = 'No estás en ese negocio.';
    end;
    if not frenado then
      raise exception 'FALLÓ 4: se pudo entrar a un negocio ajeno.';
    end if;

    -- ---- 5. El predeterminado tiene que ser propio, y va antes que Inicio rápido ----
    frenado := false;
    begin
      perform guardar_preferencias_de_entrada(neg_b, false);
    exception when raise_exception then
      frenado := sqlerrm = 'No estás en ese negocio.';
    end;
    if not frenado then
      raise exception 'FALLÓ 5: se pudo elegir de predeterminado un negocio ajeno.';
    end if;

    frenado := false;
    begin
      perform guardar_preferencias_de_entrada(null, true);
    exception when raise_exception then
      frenado := sqlerrm = 'Elegí primero cuál es tu negocio predeterminado.';
    end;
    if not frenado then
      raise exception 'FALLÓ 5: se prendió Inicio rápido sin predeterminado.';
    end if;

    -- ---- 6. Ana invita a Caro (técnica, dos usos) y a Beto (encargado) ----
    insert into invitacion (negocio_id, rol, usos_maximos, vence_en)
    values (neg_a, 'tecnico', 2, now() + interval '1 day')
    returning codigo into inv_caro;
    insert into invitacion (negocio_id, rol, vence_en)
    values (neg_a, 'encargado', now() + interval '1 day')
    returning codigo into inv_beto;

    -- ---- 7. Caro acepta y entra a A como técnica; una segunda vez, no ----
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform aceptar_invitacion(inv_caro, 'Caro');
    select * into fila from usuario where id = caro;
    if fila.negocio_id is distinct from neg_a or fila.rol <> 'tecnico' then
      raise exception 'FALLÓ 7: aceptar la invitación no dejó a la cuenta adentro con su rol.';
    end if;

    frenado := false;
    begin
      perform aceptar_invitacion(inv_caro, 'Caro');
    exception when raise_exception then
      frenado := sqlerrm = 'Ya estás en ese negocio.';
    end;
    if not frenado then
      raise exception 'FALLÓ 7: se pudo entrar dos veces al mismo negocio.';
    end if;

    -- ---- 8. Nadie se cambia el negocio ni el rol a mano (035) ----
    frenado := false;
    begin
      update usuario set rol = 'duenio' where id = caro;
    exception when insufficient_privilege then
      frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 8: una cuenta se pudo cambiar el rol a mano.';
    end if;

    frenado := false;
    begin
      update usuario set negocio_id = neg_b where id = caro;
    exception when insufficient_privilege then
      frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 8: una cuenta se pudo cambiar de negocio a mano.';
    end if;

    -- ---- 9. Beto, estando en B, acepta la invitación a A; un rol por negocio ----
    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    perform aceptar_invitacion(inv_beto, 'Beto');
    select * into fila from usuario where id = beto;
    if fila.negocio_id is distinct from neg_a or fila.rol <> 'encargado' then
      raise exception 'FALLÓ 9: aceptar una invitación estando en otro negocio no funcionó.';
    end if;
    select count(*) into n from mis_negocios() m where m.id in (neg_a, neg_b);
    if n <> 2 then
      raise exception 'FALLÓ 9: mis_negocios() no trae los dos negocios de la cuenta.';
    end if;

    perform entrar_al_negocio(neg_b);
    select * into fila from usuario where id = beto;
    if fila.negocio_id is distinct from neg_b or fila.rol <> 'duenio' then
      raise exception 'FALLÓ 9: al volver a su negocio no recuperó el rol que tiene ahí.';
    end if;

    -- ---- 10. Ana crea otra sucursal, mis_negocios() trae sólo las suyas ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a2 := crear_mi_negocio('Prueba A2', 'taller', '[]'::jsonb);
    select count(*) into n from mis_negocios();
    if n <> 2 then
      raise exception 'FALLÓ 10: mis_negocios() no trae los dos negocios de la dueña.';
    end if;
    select count(*) into n from mis_negocios() m where m.id = neg_b;
    if n <> 0 then
      raise exception 'FALLÓ 10: mis_negocios() trae un negocio ajeno.';
    end if;
    perform entrar_al_negocio(neg_a);

    -- ---- 11. empleado.usuario_id no se escribe a mano (037) ----
    -- "others" cuenta como no frenado: si el permiso dejara pasar, el choque
    -- sería con el índice único o la clave foránea, no con el permiso.
    select id into ficha_caro from empleado where usuario_id = caro and negocio_id = neg_a;
    frenado := false;
    begin
      update empleado set usuario_id = beto where id = ficha_caro;
    exception
      when insufficient_privilege then frenado := true;
      when others then frenado := false;
    end;
    if not frenado then
      raise exception 'FALLÓ 11: se pudo cambiar a mano de quién es una ficha.';
    end if;

    frenado := false;
    begin
      insert into empleado (negocio_id, nombre, rol, usuario_id)
      values (neg_a, 'Intrusa', 'tecnico', caro);
    exception
      when insufficient_privilege then frenado := true;
      when others then frenado := false;
    end;
    if not frenado then
      raise exception 'FALLÓ 11: se pudo meter a mano una cuenta en el equipo.';
    end if;

    -- ---- 12. El rol de la ficha da los permisos; el propio no se toca (037) ----
    update empleado set rol = 'encargado' where id = ficha_caro;
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    select * into fila from usuario where id = caro;
    if fila.rol <> 'encargado' then
      raise exception 'FALLÓ 12: cambiar el rol en Equipo no cambió los permisos.';
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin
      update empleado set rol = 'tecnico' where id = ficha_ana;
    exception when raise_exception then
      frenado := sqlerrm = 'No podés cambiar tu propio rol.';
    end;
    if not frenado then
      raise exception 'FALLÓ 12: una cuenta se pudo cambiar su propio rol.';
    end if;

    -- ---- 13. Al sacar a alguien pierde el acceso y el predeterminado (036, 038) ----
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform guardar_preferencias_de_entrada(neg_a, true);

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    delete from empleado where id = ficha_caro;

    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    select * into fila from usuario where id = caro;
    if fila.negocio_id is not null then
      raise exception 'FALLÓ 13: sacada del equipo, la cuenta sigue adentro.';
    end if;
    if fila.negocio_predeterminado is not null or fila.inicio_rapido then
      raise exception 'FALLÓ 13: sacada del equipo, le quedó ese negocio de predeterminado.';
    end if;
    select count(*) into n from mis_negocios();
    if n <> 0 then
      raise exception 'FALLÓ 13: sacada del equipo, el negocio le sigue apareciendo.';
    end if;
    select count(*) into n from negocio where id = neg_a;
    if n <> 0 then
      raise exception 'FALLÓ 13: sacada del equipo, sigue viendo el negocio.';
    end if;

    -- ---- 14. Nadie se saca a sí mismo (036) ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin
      delete from empleado where id = ficha_ana;
    exception when raise_exception then
      frenado := sqlerrm = 'No te podés sacar a vos del equipo.';
    end;
    if not frenado then
      raise exception 'FALLÓ 14: una cuenta se pudo sacar a sí misma del equipo.';
    end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
