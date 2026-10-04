-- 040_entregar_caso_api.sql
-- Persiste en una sola transacción lo que la API ya validó al entregar:
-- cobro manual opcional, descuento, cierre e historial. Es SECURITY INVOKER;
-- conserva la RLS de la persona y reutiliza registrar_cobro() para escribir
-- la tabla cobro, que no admite escrituras directas desde el navegador.

create or replace function registrar_cobro_api(
  p_caso_id uuid, p_monto numeric, p_medio text, p_nota text,
  p_autor text, p_detalle text
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare r jsonb; e evento%rowtype;
begin
  r := registrar_cobro(p_caso_id, p_monto, p_medio, p_nota);
  if not coalesce((r->>'ok')::boolean, false) then return r; end if;
  insert into evento (caso_id, tipo, titulo, detalle, icono, monto, autor)
  values (p_caso_id, 'plata', 'Cobraron', p_detalle, 'listo', p_monto, p_autor)
  returning * into e;
  return r || jsonb_build_object('evento', to_jsonb(e));
end; $$;

revoke all on function registrar_cobro_api(uuid, numeric, text, text, text, text) from public, anon;
grant execute on function registrar_cobro_api(uuid, numeric, text, text, text, text) to authenticated;

create or replace function anular_cobro_api(
  p_cobro_id uuid, p_motivo text, p_autor text, p_detalle text
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare r jsonb; e evento%rowtype; x cobro%rowtype;
begin
  select * into x from cobro where id = p_cobro_id;
  r := anular_cobro(p_cobro_id, p_motivo);
  if not coalesce((r->>'ok')::boolean, false) then return r; end if;
  insert into evento (caso_id, tipo, titulo, detalle, icono, monto, autor)
  values (x.caso_id, 'plata', 'Anularon un cobro', p_detalle, 'cruz', x.monto, p_autor)
  returning * into e;
  return r || jsonb_build_object('evento', to_jsonb(e));
end; $$;

revoke all on function anular_cobro_api(uuid, text, text, text) from public, anon;
grant execute on function anular_cobro_api(uuid, text, text, text) to authenticated;

create or replace function cambiar_descuento_api(
  p_caso_id uuid, p_monto numeric, p_autor text, p_titulo text, p_detalle text
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare c caso%rowtype; e evento%rowtype;
begin
  if not puedo_cargar() then
    return jsonb_build_object('ok', false, 'motivo', 'Los descuentos los carga el dueño o el encargado.');
  end if;
  update caso set descuento = p_monto where id = p_caso_id returning * into c;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'Ese caso ya no está.'); end if;
  insert into evento (caso_id, tipo, titulo, detalle, icono, monto, autor)
  values (p_caso_id, 'plata', p_titulo, p_detalle,
          case when p_monto > 0 then 'nota' else 'deshacer' end, p_monto, p_autor)
  returning * into e;
  return jsonb_build_object('ok', true, 'caso', to_jsonb(c), 'evento', to_jsonb(e));
end; $$;

revoke all on function cambiar_descuento_api(uuid, numeric, text, text, text) from public, anon;
grant execute on function cambiar_descuento_api(uuid, numeric, text, text, text) to authenticated;

create or replace function entregar_caso(
  p_caso_id uuid,
  p_monto numeric default null,
  p_medio text default null,
  p_nota text default null,
  p_descuento numeric default 0,
  p_detalle text default 'El caso queda cerrado.',
  p_autor text default 'El equipo',
  p_ocurrido_en timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actual caso%rowtype;
  cerrado caso%rowtype;
  pago jsonb := null;
  nuevo_evento evento%rowtype;
begin
  select * into actual from caso where id = p_caso_id for update;
  if not found or actual.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'Ese caso ya no está.');
  end if;
  if not puedo_cargar() then
    return jsonb_build_object('ok', false, 'motivo', 'Los casos los entrega el dueño o el encargado.');
  end if;
  if actual.estado = 'completado' then
    return jsonb_build_object('ok', false, 'motivo', 'Ese caso ya está entregado.');
  end if;
  if p_descuento < 0 then
    return jsonb_build_object('ok', false, 'motivo', 'El descuento no puede ser negativo.');
  end if;

  if p_monto is not null and p_monto > 0 then
    pago := registrar_cobro(p_caso_id, p_monto, p_medio, p_nota);
    if not coalesce((pago->>'ok')::boolean, false) then
      return pago;
    end if;
  end if;

  update caso set
    estado = 'completado',
    que_falta = null,
    descuento = p_descuento,
    -- El cero explícito conserva la diferencia histórica entre "no se cobró"
    -- y "no sabemos cuánto se cobró" cuando todavía no hay ningún cobro.
    cobrado = case
      when p_monto is null and not exists (select 1 from cobro where caso_id = p_caso_id) then 0
      else cobrado
    end,
    cobrado_en = case
      when p_monto is null and not exists (select 1 from cobro where caso_id = p_caso_id) then p_ocurrido_en
      else cobrado_en
    end
  where id = p_caso_id
  returning * into cerrado;

  insert into evento (caso_id, tipo, titulo, detalle, icono, estado, monto, autor, ocurrido_en)
  values (p_caso_id, 'entrega', 'Entregaron el trabajo', p_detalle, 'listo', 'completado',
          p_monto, p_autor, p_ocurrido_en)
  returning * into nuevo_evento;

  return jsonb_build_object(
    'ok', true,
    'caso', to_jsonb(cerrado),
    'cobro', pago->'cobro',
    'evento', to_jsonb(nuevo_evento)
  );
end;
$$;

revoke all on function entregar_caso(uuid, numeric, text, text, numeric, text, text, timestamptz) from public;
revoke all on function entregar_caso(uuid, numeric, text, text, numeric, text, text, timestamptz) from anon;
grant execute on function entregar_caso(uuid, numeric, text, text, numeric, text, text, timestamptz) to authenticated;

