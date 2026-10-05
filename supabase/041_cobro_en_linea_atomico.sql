-- 041_cobro_en_linea_atomico.sql
-- Reserva el saldo de un caso y crea el cobro pendiente bajo el mismo
-- bloqueo. Evita que dos pestañas o dos clientes pidan al mismo tiempo más
-- dinero del que queda por cobrar. También permite preparar el pago desde el
-- enlace público sin entregar service_role al pedido HTTP.

create or replace function preparar_cobro_publico(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c caso%rowtype;
  existente cobro%rowtype;
  aprobado numeric;
  comprometido numeric;
begin
  select * into c from caso where seguimiento_codigo = p_codigo for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'seguimiento_no_encontrado', 'motivo', 'Ese link ya no sirve.');
  end if;

  update cobro set estado = 'vencido'
   where caso_id = c.id and estado = 'pendiente' and vence_en <= now();

  select * into existente from cobro
   where caso_id = c.id and estado = 'pendiente' and medio = 'link'
     and (vence_en is null or vence_en > now()) and link is not null
   order by creado_en desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'existente', to_jsonb(existente));
  end if;

  select coalesce(sum(monto), 0) into aprobado from paso
   where caso_id = c.id and estado = 'aprobado';
  select coalesce(sum(monto), 0) into comprometido from cobro
   where caso_id = c.id and estado in ('pagado', 'pendiente');

  if aprobado - comprometido - coalesce(c.descuento, 0) <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'sin_saldo', 'motivo', 'No queda nada por pagar.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'caso_id', c.id,
    'negocio_id', c.negocio_id,
    'numero', c.numero,
    'monto', aprobado - comprometido - coalesce(c.descuento, 0)
  );
end;
$$;

revoke all on function preparar_cobro_publico(text) from public;
grant execute on function preparar_cobro_publico(text) to anon, authenticated;

create or replace function registrar_cobro_en_linea_api(
  p_id uuid,
  p_caso_id uuid,
  p_monto numeric,
  p_medio text,
  p_proveedor_id text,
  p_link text,
  p_qr_imagen text,
  p_vence_en timestamptz,
  p_codigo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c caso%rowtype;
  nuevo cobro%rowtype;
  existente cobro%rowtype;
  aprobado numeric;
  comprometido numeric;
  saldo numeric;
begin
  select * into c from caso where id = p_caso_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'caso_no_encontrado', 'motivo', 'Ese caso ya no está.');
  end if;

  if p_codigo is null then
    if c.negocio_id is distinct from mi_negocio() then
      return jsonb_build_object('ok', false, 'codigo', 'caso_no_encontrado', 'motivo', 'Ese caso ya no está.');
    end if;
    if not puedo_cargar() then
      return jsonb_build_object('ok', false, 'codigo', 'sin_permiso', 'motivo', 'Los cobros los carga el dueño o el encargado.');
    end if;
  elsif c.seguimiento_codigo is distinct from p_codigo then
    return jsonb_build_object('ok', false, 'codigo', 'seguimiento_no_encontrado', 'motivo', 'Ese link ya no sirve.');
  end if;

  if p_medio not in ('link', 'qr') then
    return jsonb_build_object('ok', false, 'codigo', 'medio_invalido', 'motivo', 'Elegí link o QR.');
  end if;
  if p_monto is null or p_monto <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'monto_invalido', 'motivo', 'El monto tiene que ser mayor que cero.');
  end if;

  update cobro set estado = 'vencido'
   where caso_id = c.id and estado = 'pendiente' and vence_en <= now();

  select * into existente from cobro
   where caso_id = c.id and estado = 'pendiente' and medio = p_medio
     and monto = p_monto and (vence_en is null or vence_en > now()) and link is not null
   order by creado_en desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'creado', false, 'cobro', to_jsonb(existente));
  end if;

  select coalesce(sum(monto), 0) into aprobado from paso
   where caso_id = c.id and estado = 'aprobado';
  select coalesce(sum(monto), 0) into comprometido from cobro
   where caso_id = c.id and estado in ('pagado', 'pendiente');
  saldo := aprobado - comprometido - coalesce(c.descuento, 0);

  if (p_codigo is not null and p_monto is distinct from saldo)
     or (aprobado > 0 and p_monto > saldo) then
    return jsonb_build_object('ok', false, 'codigo', 'monto_supera_saldo', 'motivo', 'El monto supera lo que falta cobrar.');
  end if;

  insert into cobro (
    id, negocio_id, caso_id, monto, medio, estado, proveedor,
    proveedor_id, link, qr_imagen, vence_en, creado_por
  ) values (
    p_id, c.negocio_id, c.id, round(p_monto, 2), p_medio, 'pendiente', 'mercadopago',
    p_proveedor_id, p_link, p_qr_imagen, p_vence_en,
    case when auth.uid() is null then null else mi_empleado() end
  ) returning * into nuevo;

  return jsonb_build_object('ok', true, 'creado', true, 'cobro', to_jsonb(nuevo));
end;
$$;

revoke all on function registrar_cobro_en_linea_api(uuid, uuid, numeric, text, text, text, text, timestamptz, text) from public;
grant execute on function registrar_cobro_en_linea_api(uuid, uuid, numeric, text, text, text, text, timestamptz, text) to anon, authenticated;
