-- ============================================================
-- 076_vista_maestra.sql — mirar todos los negocios de la cuenta, sin cambiar nada
--
-- docs/vista-maestra.md. Es idempotente. Después, correr
-- supabase/pruebas/vista_maestra.sql.
--
-- Igual que la visita entre sedes (061): mirar un negocio mueve
-- usuario.negocio_id a ése, así las políticas de siempre muestran lo suyo. La
-- marca usuario.vista_maestra_desde (a dónde vuelve "Salir de vista") hace que
-- permisos_efectivos() deje sólo los de mirar y que un trigger en cada tabla
-- frene toda escritura, también la que hacen las funciones security definer
-- que no pasan por puede_aca(). Falla cerrado.
-- ============================================================

-- Como el resto de usuario desde la 035: no se escribe desde el navegador.
alter table usuario add column if not exists vista_maestra_desde uuid references negocio (id) on delete set null;

-- ------------------------------------------------------------
-- 1. Lo que la cuenta elige ver: prendidos, orden y grupos
-- ------------------------------------------------------------
-- Sin políticas: sólo las funciones de abajo las leen y escriben.
create table if not exists vista_maestra_negocio (
  usuario_id uuid    not null references usuario (id) on delete cascade,
  negocio_id uuid    not null references negocio (id) on delete cascade,
  prendido   boolean not null default true,
  orden      integer not null default 0,
  primary key (usuario_id, negocio_id)
);
alter table vista_maestra_negocio enable row level security;

create table if not exists grupo_de_negocios (
  id         uuid        primary key default gen_random_uuid(),
  usuario_id uuid        not null references usuario (id) on delete cascade,
  nombre     text        not null check (char_length(trim(nombre)) between 1 and 60),
  creado_en  timestamptz not null default now()
);
create unique index if not exists grupo_de_negocios_nombre_unico
  on grupo_de_negocios (usuario_id, lower(trim(nombre)));
alter table grupo_de_negocios enable row level security;

create table if not exists grupo_negocio (
  grupo_id   uuid not null references grupo_de_negocios (id) on delete cascade,
  negocio_id uuid not null references negocio (id) on delete cascade,
  primary key (grupo_id, negocio_id)
);
alter table grupo_negocio enable row level security;

-- ------------------------------------------------------------
-- 2. ¿Está en vista maestra?
-- ------------------------------------------------------------
create or replace function en_vista_maestra()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select u.vista_maestra_desde is not null from usuario u where u.id = auth.uid()), false);
$$;

revoke all on function en_vista_maestra() from public;
revoke all on function en_vista_maestra() from anon;
grant execute on function en_vista_maestra() to authenticated;

-- ------------------------------------------------------------
-- 3. En vista maestra, sólo los permisos de mirar
-- ------------------------------------------------------------
-- La de la 061 pasa a llamarse permisos_sin_vista_maestra, sin cambios; la
-- nueva la envuelve. Así no se copia su cuerpo y las políticas que llaman a
-- permisos_efectivos() (por puede_en/puede_aca) siguen igual. (No sirve
-- "permisos_del_rol": ese nombre ya lo usa otra función, la de un rol.)
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                  where s.nspname = 'public' and p.proname = 'permisos_sin_vista_maestra') then
    alter function permisos_efectivos(uuid) rename to permisos_sin_vista_maestra;
  end if;
end $$;

revoke all on function permisos_sin_vista_maestra(uuid) from public;
revoke all on function permisos_sin_vista_maestra(uuid) from anon;
revoke all on function permisos_sin_vista_maestra(uuid) from authenticated;

create or replace function permisos_efectivos(p_negocio uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
           when en_vista_maestra() then
             array(select x from unnest(permisos_sin_vista_maestra(p_negocio)) x where x = any(permisos_de_mirar()))
           else permisos_sin_vista_maestra(p_negocio)
         end;
$$;

revoke all on function permisos_efectivos(uuid) from public;
revoke all on function permisos_efectivos(uuid) from anon;
grant execute on function permisos_efectivos(uuid) to authenticated;

-- Igual que la de la base; en vista maestra nadie es dueño: la API y el front
-- usan es_duenio para dejar hacer todo (puede() de los dos lados).
create or replace function mis_permisos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rol_id', r.id,
    'rol_nombre', r.nombre,
    'es_duenio', coalesce(r.es_duenio, false) and not en_vista_maestra(),
    'permisos', to_jsonb(permisos_efectivos(mi_negocio()))
  )
    from (select 1) uno
    left join empleado e on e.negocio_id = mi_negocio() and e.usuario_id = auth.uid()
    left join rol r on r.id = e.rol_id;
$$;

-- ------------------------------------------------------------
-- 4. El freno: nada se escribe en vista maestra
-- ------------------------------------------------------------
-- En cada tabla de public menos las de la cuenta (usuario y las tres de
-- arriba), que las tocan sólo las funciones de esta migración y las de entrar.
-- Sin sesión (la API con la clave de servicio, la landing anónima)
-- en_vista_maestra() da false y no frena.
-- ponytail: una consulta a usuario por fila escrita; si una carga masiva
-- (restablecer una copia) se nota lenta, cachear en una variable de sesión.
create or replace function frenar_en_vista_maestra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if en_vista_maestra() then
    raise exception 'Estás en vista maestra: es sólo para mirar. Salí de la vista para cambiar algo.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

-- OJO: usuario no tiene el freno (lo necesitan entrar/mirar/salir). Toda función
-- security definer que escriba SÓLO en usuario debe chequear en_vista_maestra()
-- ella misma (ver guardar_preferencias_de_entrada, abajo).
-- Una tabla nueva después de la 076 queda sin freno: la prueba
-- vista_maestra.sql (paso 11) lo detecta. Volver a correr este bloque la cubre.
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
     where schemaname = 'public'
       and tablename <> all (array['usuario', 'vista_maestra_negocio', 'grupo_de_negocios', 'grupo_negocio'])
  loop
    execute format('drop trigger if exists frenar_en_vista_maestra on public.%I', t);
    execute format('create trigger frenar_en_vista_maestra before insert or update or delete on public.%I '
                   'for each row execute function frenar_en_vista_maestra()', t);
  end loop;
end $$;

-- Igual que la de la base; escribe sólo usuario, así que el trigger no la ve:
-- frena ella misma en vista maestra.
create or replace function guardar_preferencias_de_entrada(p_predeterminado uuid, p_inicio_rapido boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if en_vista_maestra() then
    raise exception 'Estás en vista maestra: es sólo para mirar. Salí de la vista para cambiar algo.'
      using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;

  if p_predeterminado is not null and not exists (
    select 1 from empleado
     where usuario_id = auth.uid()
       and negocio_id = p_predeterminado
  ) then
    raise exception 'No estás en ese negocio.';
  end if;

  if coalesce(p_inicio_rapido, false) and p_predeterminado is null then
    raise exception 'Elegí primero cuál es tu negocio predeterminado.';
  end if;

  update usuario
     set negocio_predeterminado = p_predeterminado,
         inicio_rapido          = coalesce(p_inicio_rapido, false)
   where id = auth.uid();
end;
$$;

revoke all on function guardar_preferencias_de_entrada(uuid, boolean) from public;
revoke all on function guardar_preferencias_de_entrada(uuid, boolean) from anon;
grant execute on function guardar_preferencias_de_entrada(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 5. Una fila por negocio con ficha
-- ------------------------------------------------------------
-- Los negocios nuevos entran al final, prendidos; los que ya no tienen ficha
-- se van. Interna: la llaman las funciones de abajo.
create or replace function preparar_vista_maestra()
returns void
language sql
security definer
set search_path = public
as $$
  delete from vista_maestra_negocio v
   where v.usuario_id = auth.uid()
     and not exists (select 1 from empleado e where e.usuario_id = auth.uid() and e.negocio_id = v.negocio_id);
  insert into vista_maestra_negocio (usuario_id, negocio_id, prendido, orden)
  select auth.uid(), e.negocio_id, true,
         coalesce((select max(v.orden) from vista_maestra_negocio v where v.usuario_id = auth.uid()), -1)
           + row_number() over (order by n.nombre)
    from empleado e
    join negocio n on n.id = e.negocio_id
   where e.usuario_id = auth.uid()
     and not exists (select 1 from vista_maestra_negocio v where v.usuario_id = auth.uid() and v.negocio_id = e.negocio_id);
$$;

revoke all on function preparar_vista_maestra() from public;
revoke all on function preparar_vista_maestra() from anon;
revoke all on function preparar_vista_maestra() from authenticated;

-- ------------------------------------------------------------
-- 6. Entrar, mirar y salir
-- ------------------------------------------------------------
create or replace function entrar_a_vista_maestra()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  origen uuid;
  elegido uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;
  if en_vista_maestra() then
    raise exception 'Ya estás en vista maestra.';
  end if;
  if (select count(*) from empleado where usuario_id = auth.uid()) < 2 then
    raise exception 'Hace falta más de un negocio.';
  end if;

  perform preparar_vista_maestra();

  -- Desde una visita, el de antes es la sede propia, no la visitada.
  select coalesce(u.visitando_desde, u.negocio_id) into origen from usuario u where u.id = auth.uid();
  if not exists (select 1 from empleado where usuario_id = auth.uid() and negocio_id = origen) then
    origen := null;
  end if;

  -- El de antes si está prendido; si no, el primero prendido; si no hay
  -- ninguno (le sacaron la ficha del único), se prende el primero.
  select v.negocio_id into elegido
    from vista_maestra_negocio v
   where v.usuario_id = auth.uid() and v.prendido
   order by (v.negocio_id = origen) desc nulls last, v.orden
   limit 1;
  if elegido is null then
    select v.negocio_id into elegido from vista_maestra_negocio v
     where v.usuario_id = auth.uid() order by v.orden limit 1;
    update vista_maestra_negocio set prendido = true where usuario_id = auth.uid() and negocio_id = elegido;
  end if;

  update usuario
     set negocio_id          = elegido,
         rol                 = (select e.rol from empleado e where e.usuario_id = auth.uid() and e.negocio_id = elegido),
         visitando_desde     = null,
         vista_maestra_desde = coalesce(origen, elegido)
   where id = auth.uid();
  return elegido;
end;
$$;

create or replace function mirar_en_vista_maestra(p_negocio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not en_vista_maestra() then
    raise exception 'No estás en vista maestra.';
  end if;
  if not exists (select 1 from empleado where usuario_id = auth.uid() and negocio_id = p_negocio) then
    raise exception 'No estás en ese negocio.';
  end if;
  if not exists (select 1 from vista_maestra_negocio
                  where usuario_id = auth.uid() and negocio_id = p_negocio and prendido) then
    raise exception 'Ese negocio está apagado en la vista maestra.';
  end if;

  update usuario
     set negocio_id = p_negocio,
         rol        = (select e.rol from empleado e where e.usuario_id = auth.uid() and e.negocio_id = p_negocio)
   where id = auth.uid();
end;
$$;

-- Vuelve al de antes si sigue teniendo ficha; si no, a ninguno (la Guardia
-- lleva al selector de negocios). Devuelve a dónde volvió.
create or replace function salir_de_vista_maestra()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  destino uuid;
begin
  select u.vista_maestra_desde into destino from usuario u where u.id = auth.uid();
  if destino is null then
    raise exception 'No estás en vista maestra.';
  end if;
  if not exists (select 1 from empleado where usuario_id = auth.uid() and negocio_id = destino) then
    destino := null;
  end if;

  update usuario
     set negocio_id          = destino,
         rol                 = (select e.rol from empleado e where e.usuario_id = auth.uid() and e.negocio_id = destino),
         vista_maestra_desde = null
   where id = auth.uid();
  return destino;
end;
$$;

-- Igual que en la 061; además termina la vista maestra ("Editar en este negocio").
create or replace function entrar_al_negocio(p_negocio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  su_rol text;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;

  select rol into su_rol
    from empleado
   where usuario_id = auth.uid()
     and negocio_id = p_negocio;

  if not found then
    raise exception 'No estás en ese negocio.';
  end if;

  update usuario
     set negocio_id          = p_negocio,
         rol                 = su_rol,
         visitando_desde     = null,
         vista_maestra_desde = null
   where id = auth.uid();
end;
$$;

-- Igual que en la 061; además no se visita estando en vista maestra.
create or replace function entrar_de_visita(p_sede uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  origen uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.';
  end if;
  if en_vista_maestra() then
    raise exception 'Salí de la vista maestra para visitar otra sede.';
  end if;
  select coalesce(visitando_desde, negocio_id) into origen from usuario where id = auth.uid();

  if exists (select 1 from empleado where negocio_id = p_sede and usuario_id = auth.uid()) then
    raise exception 'Ya es miembro de esa sede: se entra desde el selector de negocios.';
  end if;
  if not exists (select 1 from sedes_que_veo() s where s.id = p_sede and not s.soy_miembro) then
    raise exception 'Su rol no incluye el permiso «Ver las sedes vinculadas».' using errcode = '42501';
  end if;

  update usuario set negocio_id = p_sede, visitando_desde = origen where id = auth.uid();
end;
$$;

-- ------------------------------------------------------------
-- 7. Lo que muestra el desplegable de la flechita
-- ------------------------------------------------------------
create or replace function mi_vista_maestra()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform preparar_vista_maestra();
  return jsonb_build_object(
    'negocios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.id, 'nombre', n.nombre, 'rubro', n.rubro, 'foto', n.foto,
               'rol_nombre', r.nombre, 'prendido', v.prendido, 'orden', v.orden,
               'grupos', coalesce((select jsonb_agg(gn.grupo_id) from grupo_negocio gn
                                     join grupo_de_negocios g on g.id = gn.grupo_id
                                    where gn.negocio_id = n.id and g.usuario_id = auth.uid()), '[]'::jsonb))
             order by v.orden)
        from vista_maestra_negocio v
        join negocio n on n.id = v.negocio_id
        join empleado e on e.negocio_id = n.id and e.usuario_id = auth.uid()
        left join rol r on r.id = e.rol_id
       where v.usuario_id = auth.uid()), '[]'::jsonb),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id, 'nombre', g.nombre,
               'negocios', coalesce((select jsonb_agg(gn.negocio_id) from grupo_negocio gn
                                      join empleado e on e.negocio_id = gn.negocio_id and e.usuario_id = auth.uid()
                                     where gn.grupo_id = g.id), '[]'::jsonb))
             order by lower(g.nombre))
        from grupo_de_negocios g
       where g.usuario_id = auth.uid()), '[]'::jsonb)
  );
end;
$$;

-- Prendidos y orden, en una sola llamada: el orden es el del arreglo.
create or replace function guardar_negocios_de_vista_maestra(p_negocios jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mirando uuid;
begin
  if not en_vista_maestra() then
    raise exception 'No estás en vista maestra.';
  end if;
  if jsonb_typeof(p_negocios) <> 'array' then
    raise exception 'No se pudo guardar la lista de negocios.';
  end if;
  perform preparar_vista_maestra();
  select negocio_id into mirando from usuario where id = auth.uid();

  if exists (select 1 from jsonb_array_elements(p_negocios) x
              where (x ->> 'id')::uuid = mirando and not (x ->> 'prendido')::boolean) then
    raise exception 'Estás mirándolo.';
  end if;

  update vista_maestra_negocio v
     set prendido = (x.valor ->> 'prendido')::boolean,
         orden    = x.pos - 1
    from jsonb_array_elements(p_negocios) with ordinality as x (valor, pos)
   where v.usuario_id = auth.uid()
     and v.negocio_id = (x.valor ->> 'id')::uuid;
end;
$$;

-- Crear (p_grupo nulo) o cambiar un grupo: nombre y negocios de una vez.
create or replace function guardar_grupo_de_negocios(p_grupo uuid, p_nombre text, p_negocios uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  limpio text := trim(coalesce(p_nombre, ''));
  id_grupo uuid := p_grupo;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;
  if char_length(limpio) not between 1 and 60 then
    raise exception 'El nombre del grupo tiene que tener entre 1 y 60 letras.';
  end if;
  if exists (select 1 from unnest(coalesce(p_negocios, '{}')) x
              where not exists (select 1 from empleado e where e.usuario_id = auth.uid() and e.negocio_id = x)) then
    raise exception 'No estás en ese negocio.';
  end if;
  if exists (select 1 from grupo_de_negocios g
              where g.usuario_id = auth.uid() and lower(trim(g.nombre)) = lower(limpio)
                and g.id is distinct from p_grupo) then
    raise exception 'Ya tenés un grupo con ese nombre.';
  end if;

  if id_grupo is null then
    insert into grupo_de_negocios (usuario_id, nombre) values (auth.uid(), limpio) returning id into id_grupo;
  else
    update grupo_de_negocios set nombre = limpio where id = id_grupo and usuario_id = auth.uid();
    if not found then
      raise exception 'Ese grupo ya no está.';
    end if;
    delete from grupo_negocio where grupo_id = id_grupo;
  end if;

  insert into grupo_negocio (grupo_id, negocio_id)
  select id_grupo, x from unnest(coalesce(p_negocios, '{}')) x
  on conflict do nothing;
  return id_grupo;
end;
$$;

create or replace function borrar_grupo_de_negocios(p_grupo uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from grupo_de_negocios where id = p_grupo and usuario_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 8. El puntito de urgente
-- ------------------------------------------------------------
-- Atrasado: no está completado ni esperando a un tercero (estado
-- "esperando", o un paso que el cliente todavía no aprobó) y hace 14 días que
-- no avanza: ni el caso, ni sus pasos, ni su historial. Stock bajo: la misma
-- regla que el tablero (estadisticas-inventario.ts de la API). Cada cosa
-- cuenta sólo si el rol de la cuenta la ve en ese negocio.
create or replace function urgencias_de_mis_negocios()
returns table (negocio_id uuid, casos_atrasados integer, stock_bajo integer)
language sql
stable
security definer
set search_path = public
as $$
  select e.negocio_id,
         (select count(*)::integer
            from caso c
           where c.negocio_id = e.negocio_id
             and c.estado not in ('completado', 'esperando')
             and (puede_en(e.negocio_id, 'ver_todos_los_casos') or c.responsable_id = e.id)
             and not exists (select 1 from paso p where p.caso_id = c.id and p.estado = 'esperando')
             and greatest(c.actualizado_en,
                          (select max(p.actualizado_en) from paso p where p.caso_id = c.id),
                          (select max(ev.ocurrido_en) from evento ev where ev.caso_id = c.id))
                 < now() - interval '14 days'),
         case when puede_en(e.negocio_id, 'ver_inventario') then
           (select count(*)::integer
              from insumo i
             where i.negocio_id = e.negocio_id
               and i.estado = 'en_stock'
               and (i.cantidad = 0 or i.cantidad <= i.minimo))
         else 0 end
    from empleado e
   where e.usuario_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 9. Permisos de ejecución
-- ------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'entrar_a_vista_maestra()', 'mirar_en_vista_maestra(uuid)', 'salir_de_vista_maestra()',
    'entrar_al_negocio(uuid)', 'entrar_de_visita(uuid)', 'mi_vista_maestra()',
    'guardar_negocios_de_vista_maestra(jsonb)', 'guardar_grupo_de_negocios(uuid, text, uuid[])',
    'borrar_grupo_de_negocios(uuid)', 'urgencias_de_mis_negocios()', 'mis_permisos()'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke all on function %s from anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
