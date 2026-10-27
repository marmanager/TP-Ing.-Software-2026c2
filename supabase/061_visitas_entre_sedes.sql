-- ============================================================
-- 061_visitas_entre_sedes.sql — entrar a mirar una sede vinculada
--
-- Correr entero en el SQL Editor de Supabase, después de la 060.
-- Es idempotente. Después, correr supabase/pruebas/roles.sql.
--
-- Quien es miembro de una sede y su rol tiene ver_sedes_vinculadas puede
-- entrar a las otras sedes de la red donde no es miembro, sólo a mirar: de
-- los permisos de mirar, los que su rol ya tiene en su sede. Sin el permiso,
-- las otras sedes no aparecen en ningún lado (docs/roles.md, "Visitas").
--
-- Las políticas de datos siguen pasando por permisos_efectivos(). Lo que
-- no tiene un permiso de mirar propio se corta con estoy_aca() (ficha o visita
-- vigente: negocio, empleado, rol y fotos del equipo) o con la ficha (escribir
-- en evento). Cobro, ecuacion e invitacion ya pedían ficha desde la 058.
-- ============================================================

-- Como el resto de usuario desde la 035: no se escribe desde el navegador.
alter table usuario add column if not exists visitando_desde uuid references negocio (id) on delete set null;

-- ------------------------------------------------------------
-- 1. Los permisos de quien está de visita
-- ------------------------------------------------------------
create or replace function permisos_efectivos(p_negocio uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- Miembro: los de su rol (057).
    (select case when r.es_duenio then permisos_conocidos() else r.permisos end
       from empleado e
       join rol r on r.id = e.rol_id
      where e.negocio_id = p_negocio
        and e.usuario_id = auth.uid()
      limit 1),
    -- De visita: de los de mirar, los que su rol tiene en la sede de origen.
    (select array(
              select x from unnest(case when r.es_duenio then permisos_conocidos() else r.permisos end) x
               where x = any(permisos_de_mirar())
            )
       from usuario u
       join negocio aca on aca.id = p_negocio
       join negocio origen on origen.id = u.visitando_desde
       join empleado e on e.negocio_id = origen.id and e.usuario_id = u.id
       join rol r on r.id = e.rol_id
      where u.id = auth.uid()
        and u.negocio_id = p_negocio
        and aca.red is not null
        and aca.red = origen.red
        and (r.es_duenio or 'ver_sedes_vinculadas' = any(r.permisos))),
    '{}'::text[]
  );
$$;

-- ------------------------------------------------------------
-- 2. Qué sedes ve cada uno
-- ------------------------------------------------------------
-- Las de su red donde es miembro, y las demás de esa red si su rol en la sede
-- de origen tiene ver_sedes_vinculadas. La sede de origen es la activa, o
-- de la que salió si está de visita.
create or replace function sedes_que_veo()
returns table (id uuid, nombre text, rubro text, foto text, soy_miembro boolean)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select coalesce(u.visitando_desde, u.negocio_id) as origen from usuario u where u.id = auth.uid()
  ),
  red as (
    select n.red,
           exists (
             select 1 from empleado e join rol r on r.id = e.rol_id
              where e.negocio_id = n.id and e.usuario_id = auth.uid()
                and (r.es_duenio or 'ver_sedes_vinculadas' = any(r.permisos))
           ) as puede_ver
      from negocio n join yo on n.id = yo.origen
     where n.red is not null
  )
  select n.id, n.nombre, n.rubro, n.foto,
         exists (select 1 from empleado e where e.negocio_id = n.id and e.usuario_id = auth.uid())
    from negocio n
    join red on n.red = red.red
   where red.puede_ver
      or exists (select 1 from empleado e where e.negocio_id = n.id and e.usuario_id = auth.uid())
   order by n.nombre;
$$;

revoke all on function sedes_que_veo() from public;
revoke all on function sedes_que_veo() from anon;
grant execute on function sedes_que_veo() to authenticated;

-- ------------------------------------------------------------
-- 3. Entrar de visita
-- ------------------------------------------------------------
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

revoke all on function entrar_de_visita(uuid) from public;
revoke all on function entrar_de_visita(uuid) from anon;
grant execute on function entrar_de_visita(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Volver a una sede propia termina la visita
-- ------------------------------------------------------------
-- Igual que en la 038; cambia sólo el update final.
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
     set negocio_id      = p_negocio,
         rol             = su_rol,
         visitando_desde = null
   where id = auth.uid();
end;
$$;

revoke all on function entrar_al_negocio(uuid) from public;
revoke all on function entrar_al_negocio(uuid) from anon;
grant execute on function entrar_al_negocio(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. Una visita que dejó de valer corta también lo que se lee por negocio_id
-- ------------------------------------------------------------
-- Si a quien visita se le quita la ficha de origen, se desvinculan las sedes o
-- se le quita el permiso, permisos_efectivos() da {} pero negocio, empleado,
-- rol y las fotos del equipo sólo miraban negocio_id = mi_negocio(). Con
-- estoy_aca() quedan en vacío.
create or replace function estoy_aca()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select mi_empleado() is not null
      or cardinality(permisos_efectivos(mi_negocio())) > 0;
$$;

revoke all on function estoy_aca() from public;
revoke all on function estoy_aca() from anon;
grant execute on function estoy_aca() to authenticated;

drop policy if exists negocio_ve_el_suyo on negocio;
create policy negocio_ve_el_suyo on negocio
  for select to authenticated
  using (id = mi_negocio() and estoy_aca());

drop policy if exists empleado_lo_ve_el_negocio on empleado;
create policy empleado_lo_ve_el_negocio on empleado
  for select to authenticated
  using (negocio_id = mi_negocio() and estoy_aca());

drop policy if exists rol_lo_ve_el_negocio on rol;
create policy rol_lo_ve_el_negocio on rol
  for select to authenticated
  using (negocio_id = mi_negocio() and estoy_aca());

-- Igual que en la 038; se suma estoy_aca().
create or replace function fotos_del_equipo()
returns table (usuario_id uuid, foto text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.foto
    from empleado e
    join usuario u on u.id = e.usuario_id
   where e.negocio_id = mi_negocio()
     and estoy_aca()
     and u.foto is not null;
$$;

-- ------------------------------------------------------------
-- 6. El historial de un caso no lo escribe quien está de visita
-- ------------------------------------------------------------
-- evento_de_mi_negocio (008) era "for all" y sólo miraba que el caso se viera.
-- Ver el historial vale con permisos de mirar; escribirlo pide ficha.
drop policy if exists evento_de_mi_negocio on evento;

drop policy if exists evento_lo_ve_quien_ve_el_caso on evento;
create policy evento_lo_ve_quien_ve_el_caso on evento
  for select to authenticated
  using (exists (select 1 from caso c where c.id = evento.caso_id));

drop policy if exists evento_lo_agrega_el_equipo on evento;
create policy evento_lo_agrega_el_equipo on evento
  for insert to authenticated
  with check (mi_empleado() is not null and exists (select 1 from caso c where c.id = evento.caso_id));

drop policy if exists evento_lo_cambia_el_equipo on evento;
create policy evento_lo_cambia_el_equipo on evento
  for update to authenticated
  using (mi_empleado() is not null and exists (select 1 from caso c where c.id = evento.caso_id))
  with check (mi_empleado() is not null and exists (select 1 from caso c where c.id = evento.caso_id));

drop policy if exists evento_lo_borra_el_equipo on evento;
create policy evento_lo_borra_el_equipo on evento
  for delete to authenticated
  using (mi_empleado() is not null and exists (select 1 from caso c where c.id = evento.caso_id));
