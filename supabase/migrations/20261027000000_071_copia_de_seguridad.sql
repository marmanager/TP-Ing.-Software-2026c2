-- ============================================================
-- 071_copia_de_seguridad.sql — la copia de seguridad del negocio (docs/copia-de-seguridad.md, paso 1)
--
-- Correr entero en el SQL Editor de Supabase, después de la 070. Es
-- idempotente. Probar con supabase/pruebas/copia_de_seguridad.sql.
--
-- QUÉ AGREGA:
--   copia_de_seguridad    las copias, con las filas del negocio en un jsonb. RLS
--                         cerrada: sólo la tocan las funciones de abajo.
--   negocio               copia_automatica y copia_hora (los usa el paso 2).
--   copia_de_seguridad    permiso nuevo, de fábrica sólo del dueño (es_duenio
--   (permiso)             recibe todos los de permisos_conocidos()).
--   hacer_copia           guarda una copia manual. Se queda con las 3 últimas.
--   restablecer_copia     vuelve el negocio a una copia, entero o nada.
--
-- LA VERSIÓN DEL ESQUEMA: las migraciones se corren a mano, no queda registro
-- de cuál fue la última. version_del_esquema() lo suple: cada migración que
-- cambie las columnas de una tabla de copia_tablas() tiene que redefinirla con
-- su número. Una copia de otra versión no se restablece (D1 del plan).
--
-- LOS TRIGGERS QUE BLOQUEAN: restablecer tiene que tocar pasos aprobados y la
-- respuesta de un turno, que sus triggers prohíben. Se les agrega una salida,
-- restableciendo_copia(), que sólo es cierta adentro de restablecer_copia() (una
-- fila que sólo esa función escribe, atada a la transacción). No se usa una
-- variable de sesión: cualquiera con sesión podría prenderla.
--
-- Lo que se pierde al restablecer, además de lo que dice el plan: actualizado_en
-- de las filas que se actualizan queda en la hora del restablecimiento (lo pisa
-- tocar_actualizado_en), y los avisos de WhatsApp ya enviados de un caso que se
-- borra se van con el caso (ON DELETE CASCADE).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabla y columnas
-- ------------------------------------------------------------
create table if not exists copia_de_seguridad (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references negocio(id) on delete cascade,
  creada_en   timestamptz not null default now(),
  origen      text not null check (origen in ('automatica', 'manual', 'antes_de_restablecer')),
  migracion   text not null,
  datos       jsonb not null
);
create index if not exists copia_de_seguridad_negocio on copia_de_seguridad (negocio_id, creada_en desc);
alter table copia_de_seguridad enable row level security;  -- sin políticas: nadie la lee ni escribe directo
revoke all on copia_de_seguridad from anon, authenticated;

-- Las filas de las transacciones que están restableciendo (ver arriba).
create table if not exists copia_en_curso (txid bigint primary key);
alter table copia_en_curso enable row level security;
revoke all on copia_en_curso from anon, authenticated;

alter table negocio
  add column if not exists copia_automatica boolean not null default false,
  add column if not exists copia_hora smallint not null default 4;
alter table negocio drop constraint if exists negocio_copia_hora_valida;
alter table negocio add constraint negocio_copia_hora_valida check (copia_hora between 0 and 23);

-- ------------------------------------------------------------
-- 2. El permiso
-- ------------------------------------------------------------
create or replace function permisos_conocidos() returns text[]
  language sql immutable set search_path to 'public' as $$
  select array[
    'ver_todos_los_casos', 'crear_casos', 'avanzar_casos', 'asignar_casos', 'entregar_y_reabrir',
    'armar_presupuesto', 'aprobar_por_el_cliente',
    'cobrar', 'conectar_mercadopago',
    'ver_clientes', 'editar_clientes',
    'ver_agenda', 'manejar_turnos',
    'ver_inventario', 'editar_inventario', 'ver_inventario_de_sedes',
    'ver_sedes_vinculadas', 'vincular_sedes',
    'sumar_al_equipo', 'sacar_del_equipo', 'manejar_roles',
    'configurar_negocio', 'ver_historial',
    'copia_de_seguridad'
  ]::text[];
$$;

-- ------------------------------------------------------------
-- 3. Qué se copia, en orden de dependencias
--    filtro: las filas del negocio ($1). excluir: columnas que ni se copian ni
--    se restablecen. borra: si restablecer borra lo que no está en la copia.
-- ------------------------------------------------------------
create or replace function version_del_esquema() returns text
  language sql immutable set search_path to 'public' as $$ select '071'::text; $$;

create or replace function copia_tablas()
  returns table (orden integer, tabla text, pk text[], filtro text, excluir text[], borra boolean)
  language sql immutable set search_path to 'public' as $$
  select * from (values
    (1,  'negocio',                '{id}'::text[],                     'id = $1',          array['id', 'creado_en', 'creado_por', 'rubro', 'red', 'agenda_codigo', 'landing_codigo', 'ics_codigo', 'copia_automatica', 'copia_hora'], false),
    (2,  'cliente',                '{id}',                             'negocio_id = $1',  '{}', true),
    (3,  'cliente_evento',         '{id}',                             'negocio_id = $1',  '{}', true),
    (4,  'caso',                   '{id}',                             'negocio_id = $1',  '{}', true),
    (5,  'paso',                   '{id}',                             'caso_id in (select id from caso where negocio_id = $1)', '{}', true),
    (6,  'evento',                 '{id}',                             'caso_id in (select id from caso where negocio_id = $1)', '{}', true),
    (7,  'turno',                  '{id}',                             'negocio_id = $1',  '{}', true),
    (8,  'insumo',                 '{id}',                             'negocio_id = $1',  '{}', true),
    (9,  'categorias_del_negocio', '{negocio_id}',                     'negocio_id = $1',  '{}', true),
    (10, 'ecuacion',               '{id}',                             'negocio_id = $1',  '{}', true),
    (11, 'ecuacion_dependencia',   '{ecuacion_id,dependencia_id}',     'ecuacion_id in (select id from ecuacion where negocio_id = $1)', '{}', true),
    (12, 'negocio_seguimiento',    '{negocio_id,tipo}',                'negocio_id = $1',  '{}', true)
  ) t(orden, tabla, pk, filtro, excluir, borra);
$$;

-- Las columnas que se pueden escribir: sin las generadas (cliente.telefono_incompleto) ni las excluidas.
create or replace function copia_columnas(p_tabla text, p_excluir text[]) returns text[]
  language sql stable set search_path to 'public' as $$
  select array_agg(a.attname::text order by a.attnum)
    from pg_attribute a
   where a.attrelid = ('public.' || quote_ident(p_tabla))::regclass
     and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
     and a.attname::text <> all (p_excluir);
$$;

-- Cierta sólo adentro de restablecer_copia().
create or replace function restableciendo_copia() returns boolean
  language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from copia_en_curso where txid = txid_current());
$$;

-- ------------------------------------------------------------
-- 4. Los triggers que dejan pasar a restablecer_copia()
-- ------------------------------------------------------------
create or replace function paso_aprobado_no_se_modifica() returns trigger
  language plpgsql as $$
begin
  if restableciendo_copia() then
    return new;
  end if;
  if old.estado = 'aprobado' and (
       new.estado is distinct from old.estado
    or new.nombre is distinct from old.nombre
    or new.descripcion is distinct from old.descripcion
    or new.monto is distinct from old.monto
    or new.caso_id is distinct from old.caso_id
    or new.aprobado_en is distinct from old.aprobado_en
  ) then
    raise exception 'Este paso ya lo aprobó el cliente y no se puede cambiar.';
  end if;
  return new;
end;
$$;

create or replace function paso_aprobado_no_se_borra() returns trigger
  language plpgsql security definer set search_path to 'public' as $$
begin
  if restableciendo_copia() then
    return old;
  end if;
  if old.estado = 'aprobado'
     and exists (select 1 from caso where id = old.caso_id) then
    raise exception 'Este paso ya lo aprobó el cliente y no se puede sacar del presupuesto.';
  end if;
  return old;
end;
$$;

create or replace function turno_respuesta_solo_del_cliente() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is not null and not restableciendo_copia() and (
    (tg_op = 'INSERT' and (new.respuesta_cliente is not null or new.respuesta_cliente_en is not null)) or
    (tg_op = 'UPDATE' and (new.respuesta_cliente is distinct from old.respuesta_cliente
                           or new.respuesta_cliente_en is distinct from old.respuesta_cliente_en))
  ) then
    raise exception 'Lo que contestó el cliente lo anota el WhatsApp, no se edita a mano.';
  end if;
  return new;
end $$;

-- ------------------------------------------------------------
-- 5. Guardar una copia (interna: sin chequeo de permiso)
-- ------------------------------------------------------------
create or replace function copia_guardar(p_negocio uuid, p_origen text) returns uuid
  language plpgsql security definer set search_path to 'public' as $$
declare
  t record;
  v_filas jsonb;
  v_datos jsonb := '{}'::jsonb;
  v_id uuid;
begin
  for t in select * from copia_tablas() order by orden loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) - $2), ''[]''::jsonb) from %I x where %s', t.tabla, t.filtro)
      into v_filas using p_negocio, t.excluir;
    v_datos := v_datos || jsonb_build_object(t.tabla, v_filas);
  end loop;

  insert into copia_de_seguridad (negocio_id, creada_en, origen, migracion, datos)
  values (p_negocio, clock_timestamp(), p_origen, version_del_esquema(), v_datos)
  returning id into v_id;

  -- Quedan las 3 últimas; la de antes de restablecer cuenta aparte, y es una sola.
  delete from copia_de_seguridad
   where negocio_id = p_negocio and origen <> 'antes_de_restablecer'
     and id not in (select id from copia_de_seguridad
                     where negocio_id = p_negocio and origen <> 'antes_de_restablecer'
                     order by creada_en desc, id limit 3);
  delete from copia_de_seguridad
   where negocio_id = p_negocio and origen = 'antes_de_restablecer'
     and id not in (select id from copia_de_seguridad
                     where negocio_id = p_negocio and origen = 'antes_de_restablecer'
                     order by creada_en desc, id limit 1);
  return v_id;
end;
$$;

-- La que llama el dueño: sólo a mano. La automática y la de antes de restablecer
-- las arman copia_guardar() desde adentro.
create or replace function hacer_copia(p_negocio uuid, p_origen text default 'manual') returns uuid
  language plpgsql security definer set search_path to 'public' as $$
begin
  if p_origen <> 'manual' then
    raise exception 'A mano sólo se hacen copias manuales.' using errcode = '22023';
  end if;
  if not puede_en(p_negocio, 'copia_de_seguridad') then
    raise exception 'Este rol no permite manejar las copias de seguridad.' using errcode = '42501';
  end if;
  return copia_guardar(p_negocio, 'manual');
end;
$$;

-- ------------------------------------------------------------
-- 6. Restablecer
-- ------------------------------------------------------------
create or replace function restablecer_copia(p_copia uuid) returns void
  language plpgsql security definer set search_path to 'public' as $$
declare
  c copia_de_seguridad%rowtype;
  t record;
  v_datos jsonb;
  v_conservados uuid[];
  v_cols text[];
  v_pk_igual text;
  v_set text;
begin
  select * into c from copia_de_seguridad where id = p_copia;
  if not found or not puede_en(c.negocio_id, 'copia_de_seguridad') then
    raise exception 'Este rol no permite manejar las copias de seguridad.' using errcode = '42501';
  end if;
  if c.migracion <> version_del_esquema() then
    raise exception 'No se puede restablecer: el sistema se actualizó después de esta copia.' using errcode = 'P0001';
  end if;

  -- Para poder deshacer. Antes de levantar la marca: si falla, nada cambió.
  perform copia_guardar(c.negocio_id, 'antes_de_restablecer');
  insert into copia_en_curso (txid) values (txid_current()) on conflict do nothing;

  v_datos := c.datos;

  -- Lo que apunta a algo que ya no existe (afuera de la copia) se suelta.
  v_datos := jsonb_set(v_datos, '{caso}', coalesce((
    select jsonb_agg(case when f ->> 'responsable_id' is not null and e.id is null
                          then f || '{"responsable_id": null}'::jsonb else f end)
      from jsonb_array_elements(v_datos -> 'caso') f
      left join empleado e on e.id = (f ->> 'responsable_id')::uuid and e.negocio_id = c.negocio_id
  ), '[]'::jsonb));
  v_datos := jsonb_set(v_datos, '{cliente_evento}', coalesce((
    select jsonb_agg(case when f ->> 'usuario_id' is not null and u.id is null
                          then f || '{"usuario_id": null}'::jsonb else f end)
      from jsonb_array_elements(v_datos -> 'cliente_evento') f
      left join auth.users u on u.id = (f ->> 'usuario_id')::uuid
  ), '[]'::jsonb));

  -- Los casos con cobros que no están en la copia no se borran (el cobro queda
  -- afuera y borrar el caso lo borraría): ellos y sus pasos y eventos quedan como están.
  select coalesce(array_agg(k.id), '{}') into v_conservados
    from caso k
   where k.negocio_id = c.negocio_id
     and exists (select 1 from cobro b where b.caso_id = k.id)
     and k.id not in (select (f ->> 'id')::uuid from jsonb_array_elements(v_datos -> 'caso') f);

  -- Primero se borra lo que sobra, de los hijos a los padres.
  for t in select * from copia_tablas() where borra order by orden desc loop
    v_pk_igual := (select string_agg(format('r.%1$I = x.%1$I', k), ' and ') from unnest(t.pk) k);
    execute format(
      'delete from %1$I x where %2$s %3$s and not exists (
         select 1 from jsonb_populate_recordset(null::%1$I, $2) r where %4$s)',
      t.tabla, t.filtro,
      case t.tabla when 'caso' then 'and x.id <> all ($3)'
                   when 'paso' then 'and x.caso_id <> all ($3)'
                   when 'evento' then 'and x.caso_id <> all ($3)' else '' end,
      v_pk_igual)
      using c.negocio_id, v_datos -> t.tabla, v_conservados;
  end loop;

  -- Después se pone lo de la copia, de los padres a los hijos.
  for t in select * from copia_tablas() order by orden loop
    v_cols := copia_columnas(t.tabla, t.excluir);
    if t.tabla = 'negocio' then
      -- La fila ya existe y tiene columnas que no se tocan: sólo se actualiza.
      select string_agg(format('%1$I = r.%1$I', k), ', ') into v_set from unnest(v_cols) k;
      execute format(
        'update negocio n set %s from jsonb_populate_recordset(null::negocio, $2) r where n.id = $1', v_set)
        using c.negocio_id, v_datos -> 'negocio';
    else
      select string_agg(format('%1$I = excluded.%1$I', k), ', ') into v_set
        from unnest(v_cols) k where k <> all (t.pk);
      execute format(
        'insert into %1$I (%2$s) select %2$s from jsonb_populate_recordset(null::%1$I, $1)
           on conflict (%3$s) do update set %4$s',
        t.tabla,
        (select string_agg(format('%I', k), ', ') from unnest(v_cols) k),
        (select string_agg(format('%I', k), ', ') from unnest(t.pk) k),
        v_set)
        using v_datos -> t.tabla;
    end if;
  end loop;

  delete from copia_en_curso where txid = txid_current();
end;
$$;

-- ------------------------------------------------------------
-- 7. Quién ejecuta qué
-- ------------------------------------------------------------
revoke all on function copia_guardar(uuid, text) from public, anon, authenticated;
revoke all on function copia_tablas() from public, anon, authenticated;
revoke all on function copia_columnas(text, text[]) from public, anon, authenticated;
-- Los triggers corren con el rol de quien escribe: tiene que poder preguntarla.
-- Sólo contesta sí/no, y la fila que la hace cierta no la puede escribir nadie de afuera.
revoke all on function restableciendo_copia() from public;
grant execute on function restableciendo_copia() to anon, authenticated;
revoke all on function hacer_copia(uuid, text) from public, anon;
revoke all on function restablecer_copia(uuid) from public, anon;
grant execute on function hacer_copia(uuid, text) to authenticated;
grant execute on function restablecer_copia(uuid) to authenticated;
