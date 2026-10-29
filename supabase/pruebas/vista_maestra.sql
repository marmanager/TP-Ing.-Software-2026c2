-- ============================================================
-- supabase/pruebas/vista_maestra.sql — la vista maestra (076)
--
-- Correr entera en el SQL Editor, después de la 076. Corre dentro de una
-- transacción que se deshace al final: no deja nada. Si una prueba falla,
-- frena y dice cuál; si pasan todas, lo dice.
--
-- Las sesiones se simulan como Supabase: rol "authenticated" y el id de la
-- cuenta en request.jwt.claims. "Como el sistema" es rol postgres y sin
-- claims: auth.uid() nulo, como la API con la clave de servicio.
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();
  caro uuid := gen_random_uuid();
  beto uuid := gen_random_uuid();
  solo uuid := gen_random_uuid();
  neg_a uuid; neg_b uuid; neg_c uuid; neg_d uuid; neg_e uuid;
  inv text; mirando uuid; vuelta uuid; grupo uuid; caso_b uuid;
  frenado boolean; n integer; vm jsonb;
begin
  begin
    insert into auth.users (id, email) values
      (ana,  'prueba-ana-'  || ana  || '@ejemplo.test'),
      (caro, 'prueba-caro-' || caro || '@ejemplo.test'),
      (beto, 'prueba-beto-' || beto || '@ejemplo.test'),
      (solo, 'prueba-solo-' || solo || '@ejemplo.test');
    perform set_config('role', 'authenticated', true);

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Taller A', 'taller', '[]'::jsonb);
    neg_b := crear_mi_negocio('Taller B', 'taller', '[]'::jsonb);
    neg_c := crear_mi_negocio('Taller C', 'taller', '[]'::jsonb);
    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    neg_d := crear_mi_negocio('Taller D', 'taller', '[]'::jsonb);
    perform set_config('request.jwt.claims', json_build_object('sub', solo, 'role', 'authenticated')::text, true);
    neg_e := crear_mi_negocio('Taller E', 'taller', '[]'::jsonb);

    -- Caro, mecánica en A, por el link de equipo (como en red_de_sedes.sql).
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_a);
    select codigo into inv from cambiar_link_de_equipo(1);
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform pedir_entrar(inv, 'Caro');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform aprobar_solicitud((select id from pedidos_de_ingreso() where nombre = 'Caro'),
                              (select id from rol where negocio_id = neg_a and nombre = 'Mecánico'));

    -- Como el sistema: un caso en B para probar que después no se cambia.
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'postgres', true);
    insert into caso (negocio_id, numero, servicio) values (neg_b, 1, 'Frenos') returning id into caso_b;
    perform set_config('role', 'authenticated', true);

    -- 1. Con un solo negocio no se entra.
    perform set_config('request.jwt.claims', json_build_object('sub', solo, 'role', 'authenticated')::text, true);
    begin
      perform entrar_a_vista_maestra();
      raise exception 'FALLA 1: entró a vista maestra con un solo negocio';
    exception when raise_exception then
      if sqlerrm <> 'Hace falta más de un negocio.' then raise; end if;
    end;

    -- 2. Ana entra desde B: queda mirando B y con la marca.
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_al_negocio(neg_b);
    mirando := entrar_a_vista_maestra();
    if mirando <> neg_b then raise exception 'FALLA 2: no quedó mirando el negocio de antes'; end if;
    if not en_vista_maestra() then raise exception 'FALLA 2b: sin la marca'; end if;

    -- 3. Sólo permisos de mirar, y no es dueña para la API.
    if exists (select 1 from unnest(permisos_efectivos(neg_b)) x where x <> all (permisos_de_mirar())) then
      raise exception 'FALLA 3: en vista maestra quedan permisos de cambiar';
    end if;
    if (mis_permisos() ->> 'es_duenio')::boolean then raise exception 'FALLA 3b: es_duenio sigue en true'; end if;
    if not exists (select 1 from caso where id = caso_b) then raise exception 'FALLA 3c: no ve los casos de B'; end if;

    -- 4. Nada se escribe: ni por la tabla ni por una función.
    frenado := false;
    begin
      update caso set servicio = 'Otra cosa' where id = caso_b;
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLA 4: se cambió un caso en vista maestra'; end if;
    frenado := false;
    begin
      insert into evento (caso_id, titulo) values (caso_b, 'Nota');
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLA 4b: se escribió el historial en vista maestra'; end if;
    frenado := false;
    begin
      perform guardar_mi_perfil('Ana Nueva', null, null);
    exception when insufficient_privilege then frenado := true;
    end;
    if not frenado then raise exception 'FALLA 4c: guardar_mi_perfil escribió la ficha en vista maestra'; end if;

    -- 5. Mirar otro negocio propio sí; uno ajeno no.
    perform mirar_en_vista_maestra(neg_c);
    if (select negocio_id from usuario where id = ana) <> neg_c then raise exception 'FALLA 5'; end if;
    begin
      perform mirar_en_vista_maestra(neg_d);
      raise exception 'FALLA 5b: miró un negocio ajeno';
    exception when raise_exception then
      if sqlerrm <> 'No estás en ese negocio.' then raise; end if;
    end;

    -- 6. El que se mira (C) no se apaga; los demás sí, y el orden se guarda.
    begin
      perform guardar_negocios_de_vista_maestra(jsonb_build_array(
        jsonb_build_object('id', neg_c, 'prendido', false),
        jsonb_build_object('id', neg_a, 'prendido', true),
        jsonb_build_object('id', neg_b, 'prendido', true)));
      raise exception 'FALLA 6: apagó el negocio que estaba mirando';
    exception when raise_exception then
      if sqlerrm <> 'Estás mirándolo.' then raise; end if;
    end;
    perform guardar_negocios_de_vista_maestra(jsonb_build_array(
      jsonb_build_object('id', neg_c, 'prendido', true),
      jsonb_build_object('id', neg_a, 'prendido', false),
      jsonb_build_object('id', neg_b, 'prendido', true)));
    vm := mi_vista_maestra();
    if (select string_agg(x ->> 'nombre', ',' order by (x ->> 'orden')::int) from jsonb_array_elements(vm -> 'negocios') x)
       <> 'Taller C,Taller A,Taller B' then raise exception 'FALLA 6b: no guardó el orden'; end if;
    begin
      perform mirar_en_vista_maestra(neg_a);
      raise exception 'FALLA 6c: miró un negocio apagado';
    exception when raise_exception then
      if sqlerrm <> 'Ese negocio está apagado en la vista maestra.' then raise; end if;
    end;

    -- 7. Grupos: crear, nombre repetido, negocio ajeno, borrar.
    grupo := guardar_grupo_de_negocios(null, 'Zona sur', array[neg_a, neg_b]);
    if jsonb_array_length(mi_vista_maestra() -> 'grupos') <> 1 then raise exception 'FALLA 7'; end if;
    begin
      perform guardar_grupo_de_negocios(null, 'zona SUR', array[neg_c]);
      raise exception 'FALLA 7b: dos grupos con el mismo nombre';
    exception when raise_exception then
      if sqlerrm <> 'Ya tenés un grupo con ese nombre.' then raise; end if;
    end;
    begin
      perform guardar_grupo_de_negocios(grupo, 'Zona sur', array[neg_d]);
      raise exception 'FALLA 7c: un negocio ajeno en un grupo';
    exception when raise_exception then
      if sqlerrm <> 'No estás en ese negocio.' then raise; end if;
    end;
    perform borrar_grupo_de_negocios(grupo);
    if jsonb_array_length(mi_vista_maestra() -> 'grupos') <> 0 then raise exception 'FALLA 7d'; end if;

    -- 8. Urgencias: el caso viejo de B cuenta; uno viejo "esperando" no; uno
    --    viejo con un paso sin aprobar tampoco; stock bajo sí; nada de lo ajeno.
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'postgres', true);
    insert into caso (negocio_id, numero, servicio, estado, actualizado_en)
      values (neg_b, 2, 'Aceite', 'esperando', now() - interval '20 days');
    with c as (
      insert into caso (negocio_id, numero, servicio, actualizado_en)
      values (neg_b, 3, 'Embrague', now() - interval '20 days') returning id
    )
    insert into paso (caso_id, nombre, estado, actualizado_en)
      select id, 'Cambiar disco', 'esperando', now() - interval '20 days' from c;
    insert into insumo (negocio_id, nombre, cantidad, minimo) values (neg_b, 'Filtro', 1, 2);
    -- los triggers de actualizado_en pisan la fecha en el update: dejarla vieja de nuevo
    alter table caso disable trigger caso_actualizado_en;
    update caso set actualizado_en = now() - interval '20 days' where negocio_id = neg_b;
    alter table caso enable trigger caso_actualizado_en;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select count(*) into n from urgencias_de_mis_negocios() u
     where u.negocio_id = neg_b and u.casos_atrasados = 1 and u.stock_bajo = 1;
    if n <> 1 then raise exception 'FALLA 8: urgencias de B'; end if;
    if exists (select 1 from urgencias_de_mis_negocios() where negocio_id = neg_d) then
      raise exception 'FALLA 8b: urgencias de un negocio ajeno';
    end if;

    -- 9. Estando en vista maestra no se entra de visita.
    begin
      perform entrar_de_visita(neg_d);
      raise exception 'FALLA 9: entró de visita desde vista maestra';
    exception when raise_exception then
      if sqlerrm <> 'Salí de la vista maestra para visitar otra sede.' then raise; end if;
    end;

    -- 10. Salir vuelve al de antes (B) y saca la marca.
    vuelta := salir_de_vista_maestra();
    if vuelta <> neg_b or en_vista_maestra() then raise exception 'FALLA 10'; end if;
    if (select negocio_id from usuario where id = ana) <> neg_b then raise exception 'FALLA 10b'; end if;

    -- 11. Todas las tablas tienen el freno (menos las de la cuenta).
    select count(*) into n
      from pg_tables t
     where t.schemaname = 'public'
       and t.tablename <> all (array['usuario', 'vista_maestra_negocio', 'grupo_de_negocios', 'grupo_negocio'])
       and not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                        join pg_namespace s on s.oid = c.relnamespace
                        where s.nspname = 'public' and c.relname = t.tablename
                          and g.tgname = 'frenar_en_vista_maestra');
    if n > 0 then raise exception 'FALLA 11: % tablas sin el freno de vista maestra', n; end if;

    -- 12. Entrar desde una visita (Ana mirando D de visita, como el sistema)
    --     termina la visita, y salir vuelve a la sede propia (A).
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'postgres', true);
    update usuario set negocio_id = neg_d, visitando_desde = neg_a where id = ana;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform entrar_a_vista_maestra();
    if (select visitando_desde from usuario where id = ana) is not null then raise exception 'FALLA 12: sigue de visita'; end if;
    if salir_de_vista_maestra() <> neg_a then raise exception 'FALLA 12b: no volvió a la sede propia'; end if;

    -- 13. A Caro le sacan la ficha de A mientras la mira: ya no la ve, y
    --     salir no la deja en A.
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform crear_mi_negocio('Taller de Caro', 'taller', '[]'::jsonb);  -- para tener dos
    perform entrar_al_negocio(neg_a);
    perform entrar_a_vista_maestra();
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'postgres', true);
    delete from empleado where negocio_id = neg_a and usuario_id = caro;   -- como lo hace Equipo
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    if exists (select 1 from caso where negocio_id = neg_a) then raise exception 'FALLA 13: sigue viendo A'; end if;
    vuelta := salir_de_vista_maestra();
    if vuelta is not distinct from neg_a then raise exception 'FALLA 13b: volvió a un negocio sin ficha'; end if;

    raise exception 'TODO_OK';
  exception
    when others then
      if sqlerrm = 'TODO_OK' then
        raise notice 'Vista maestra: pasaron todas las pruebas.';
      else
        raise;
      end if;
  end;
end;
$prueba$;
