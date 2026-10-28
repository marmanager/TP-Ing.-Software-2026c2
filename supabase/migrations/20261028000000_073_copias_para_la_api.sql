-- ============================================================
-- 073_copias_para_la_api.sql — lo que la API necesita para mostrar y configurar
-- las copias (docs/copia-de-seguridad.md, paso 3)
--
-- Correr entero en el SQL Editor de Supabase, después de la 072. Es
-- idempotente. Probar con supabase/pruebas/copias_para_la_api.sql.
--
-- La tabla de copias está cerrada (071): la API no la lee. Estas funciones
-- muestran la lista sin los datos (pesan cientos de KB) y guardan la
-- configuración, todas con el permiso copia_de_seguridad del negocio donde
-- está parada la persona. Escribir negocio.copia_* directo, con
-- configurar_negocio, ya no es el camino.
-- ============================================================

create or replace function copias_del_negocio()
  returns table (id uuid, creada_en timestamptz, origen text, restablecible boolean)
  language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not puede_aca('copia_de_seguridad') then
    raise exception 'Este rol no permite manejar las copias de seguridad.' using errcode = '42501';
  end if;
  return query
    select c.id, c.creada_en, c.origen, c.migracion = version_del_esquema()
      from copia_de_seguridad c
     where c.negocio_id = mi_negocio()
     order by c.creada_en desc, c.id;
end;
$$;

create or replace function configuracion_de_copias()
  returns table (automatica boolean, hora smallint)
  language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not puede_aca('copia_de_seguridad') then
    raise exception 'Este rol no permite manejar las copias de seguridad.' using errcode = '42501';
  end if;
  return query select n.copia_automatica, n.copia_hora from negocio n where n.id = mi_negocio();
end;
$$;

create or replace function configurar_copias(p_automatica boolean, p_hora smallint) returns void
  language plpgsql security definer set search_path to 'public' as $$
begin
  if not puede_aca('copia_de_seguridad') then
    raise exception 'Este rol no permite manejar las copias de seguridad.' using errcode = '42501';
  end if;
  if p_hora is null or p_hora not between 0 and 23 then
    raise exception 'La hora tiene que ser de 0 a 23.' using errcode = 'P0001';
  end if;
  update negocio set copia_automatica = coalesce(p_automatica, false), copia_hora = p_hora
   where id = mi_negocio();
end;
$$;

revoke all on function copias_del_negocio() from public, anon;
revoke all on function configuracion_de_copias() from public, anon;
revoke all on function configurar_copias(boolean, smallint) from public, anon;
grant execute on function copias_del_negocio() to authenticated;
grant execute on function configuracion_de_copias() to authenticated;
grant execute on function configurar_copias(boolean, smallint) to authenticated;
