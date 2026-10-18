-- ============================================================
-- 055_mis_negocios_con_rol.sql — los negocios de la cuenta, con su rol nuevo
--
-- Correr entero en el SQL Editor de Supabase, después de la 054.
-- Es idempotente. Va junto con la API que lee rol_nombre (docs/roles-plan.md,
-- Tarea 6): correrla antes deja al selector de negocios sin el nombre del rol.
--
-- Cambia el tipo de retorno: hay que borrarlas y volver a dar los permisos.
-- ============================================================

drop function if exists mis_negocios();
create function mis_negocios()
returns table (id uuid, nombre text, rubro text, foto text, rol_nombre text, es_duenio boolean, permisos text[])
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.nombre, n.rubro, n.foto, r.nombre, r.es_duenio,
         case when r.es_duenio then permisos_conocidos() else r.permisos end
    from empleado e
    join negocio n on n.id = e.negocio_id
    join rol r on r.id = e.rol_id
   where e.usuario_id = auth.uid()
   order by n.nombre;
$$;

revoke all on function mis_negocios() from public;
revoke all on function mis_negocios() from anon;
grant execute on function mis_negocios() to authenticated;

drop function if exists mis_sedes();
create function mis_sedes()
returns table (id uuid, nombre text, rubro text, foto text, rol_nombre text, es_duenio boolean, permisos text[])
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.nombre, n.rubro, n.foto, r.nombre, r.es_duenio,
         case when r.es_duenio then permisos_conocidos() else r.permisos end
    from negocio n
    join empleado e on e.negocio_id = n.id and e.usuario_id = auth.uid()
    join rol r on r.id = e.rol_id
   where n.red is not null
     and n.red = (select red from negocio where id = mi_negocio())
   order by n.nombre;
$$;

revoke all on function mis_sedes() from public;
revoke all on function mis_sedes() from anon;
grant execute on function mis_sedes() to authenticated;
