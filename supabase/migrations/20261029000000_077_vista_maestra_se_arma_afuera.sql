-- ============================================================
-- 077 — Los negocios de la vista maestra se arman ANTES de entrar
-- (docs/vista-maestra.md). Se arman en Mi perfil, con la flechita al lado de
-- "Vista maestra"; adentro de la vista sólo se mira. La 076 pedía estar en la
-- vista para prender, apagar y ordenar: acá se puede en cualquier momento.
--
-- "Estás mirándolo." sigue valiendo, pero sólo adentro de la vista: afuera no
-- hay un negocio que se esté mirando. Mi vista maestra, los grupos y su borrado
-- ya andaban afuera (no miran la marca).
--
-- Se puede correr de nuevo: sólo redefine una función.
-- ============================================================

create or replace function guardar_negocios_de_vista_maestra(p_negocios jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mirando uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;
  if jsonb_typeof(p_negocios) <> 'array' then
    raise exception 'No se pudo guardar la lista de negocios.';
  end if;
  perform preparar_vista_maestra();

  -- Sólo adentro de la vista hay un negocio que se está mirando.
  if en_vista_maestra() then
    select negocio_id into mirando from usuario where id = auth.uid();
    if exists (select 1 from jsonb_array_elements(p_negocios) x
                where (x ->> 'id')::uuid = mirando and not (x ->> 'prendido')::boolean) then
      raise exception 'Estás mirándolo.';
    end if;
  end if;

  update vista_maestra_negocio v
     set prendido = (x.valor ->> 'prendido')::boolean,
         orden    = x.pos - 1
    from jsonb_array_elements(p_negocios) with ordinality as x (valor, pos)
   where v.usuario_id = auth.uid()
     and v.negocio_id = (x.valor ->> 'id')::uuid;
end;
$$;

revoke all on function guardar_negocios_de_vista_maestra(jsonb) from public;
revoke all on function guardar_negocios_de_vista_maestra(jsonb) from anon;
grant execute on function guardar_negocios_de_vista_maestra(jsonb) to authenticated;
