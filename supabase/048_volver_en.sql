-- ============================================================
-- 048_volver_en.sql — cuándo le toca volver al cliente
--
-- Correr entero en el SQL Editor de Supabase, después de la 047. Es
-- idempotente. Historia: R-1a (módulo Recordatorios, en la API).
--
-- El caso guarda cuándo le toca volver al cliente: una fecha de calendario,
-- sin hora, opcional. Se anota al entregar el caso ("volvé en seis meses") y
-- se corrige después. De ahí va a colgar el recordatorio "le toca volver".
--
-- Vive en el caso y no en el cliente: un cliente de taller puede tener dos
-- autos con mantenimientos distintos, y no hay una entidad para el vehículo.
--
-- Que la fecha no haya pasado es una regla de la API (depende de qué día es
-- hoy en Argentina): acá no hay check, como con las demás reglas de negocio.
-- ============================================================

alter table caso add column if not exists volver_en date;

-- Las reglas de recordatorios van a preguntar "qué casos de este negocio
-- vencen hoy". Parcial: la mayoría de los casos no tiene fecha.
create index if not exists caso_volver_en_idx on caso (negocio_id, volver_en) where volver_en is not null;

-- ------------------------------------------------------------
-- entregar_caso() también guarda la fecha, en la misma transacción
-- ------------------------------------------------------------
-- Es la de la 040 con dos parámetros más al final. p_toca_volver_en dice si
-- el pedido trajo la fecha: sin eso no se distingue "no la mandó" (no se
-- toca) de "mandó null" (se borra). Los dos tienen default, así que la API
-- de antes de esta migración sigue llamándola igual.
--
-- Cambia la firma: hay que borrar la de 8 parámetros, o quedarían las dos
-- y PostgREST no sabría a cuál llamar.
drop function if exists entregar_caso(uuid, numeric, text, text, numeric, text, text, timestamptz);

create or replace function entregar_caso(
  p_caso_id uuid,
  p_monto numeric default null,
  p_medio text default null,
  p_nota text default null,
  p_descuento numeric default 0,
  p_detalle text default 'El caso queda cerrado.',
  p_autor text default 'El equipo',
  p_ocurrido_en timestamptz default now(),
  p_volver_en date default null,
  p_toca_volver_en boolean default false
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
    end,
    volver_en = case when p_toca_volver_en then p_volver_en else volver_en end
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

revoke all on function entregar_caso(uuid, numeric, text, text, numeric, text, text, timestamptz, date, boolean) from public;
revoke all on function entregar_caso(uuid, numeric, text, text, numeric, text, text, timestamptz, date, boolean) from anon;
grant execute on function entregar_caso(uuid, numeric, text, text, numeric, text, text, timestamptz, date, boolean) to authenticated;

-- ------------------------------------------------------------
-- entregar_caso_con_seguimiento(), con los mismos dos parámetros
-- ------------------------------------------------------------
-- Entrega y deja programado el WhatsApp de seguimiento (Kapso), todo en una
-- transacción. Se había creado directo en Supabase y no estaba en ningún
-- repo: ésta es su definición tal cual estaba (pg_get_functiondef), más
-- p_volver_en y p_toca_volver_en, que pasa de largo a entregar_caso().
-- Security invoker, como antes: la RLS de quien llama aplica igual.
drop function if exists entregar_caso_con_seguimiento(uuid, numeric, text, text, numeric, text, text, timestamptz, jsonb);

create or replace function entregar_caso_con_seguimiento(
  p_caso_id uuid,
  p_monto numeric,
  p_medio text,
  p_nota text,
  p_descuento numeric,
  p_detalle text,
  p_autor text,
  p_ocurrido_en timestamptz,
  p_seguimiento jsonb,
  p_volver_en date default null,
  p_toca_volver_en boolean default false
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  resultado jsonb;
  pendiente public.seguimiento_whatsapp%rowtype;
begin
  resultado := public.entregar_caso(
    p_caso_id => p_caso_id, p_monto => p_monto, p_medio => p_medio, p_nota => p_nota,
    p_descuento => p_descuento, p_detalle => p_detalle, p_autor => p_autor, p_ocurrido_en => p_ocurrido_en,
    p_volver_en => p_volver_en, p_toca_volver_en => p_toca_volver_en
  );
  if not coalesce((resultado->>'ok')::boolean, false) then return resultado; end if;

  insert into public.seguimiento_whatsapp (
    caso_id, negocio_id, cerrado_en, enviar_en, telefono, mensaje, numero_emisor_id
  ) values (
    p_caso_id, (resultado->'caso'->>'negocio_id')::uuid, p_ocurrido_en,
    (p_seguimiento->>'enviar_en')::timestamptz, p_seguimiento->>'telefono',
    p_seguimiento->>'mensaje', p_seguimiento->>'numero_emisor_id'
  ) returning * into pendiente;

  return resultado || jsonb_build_object('seguimiento', to_jsonb(pendiente));
end;
$$;

revoke all on function entregar_caso_con_seguimiento(uuid, numeric, text, text, numeric, text, text, timestamptz, jsonb, date, boolean) from public;
revoke all on function entregar_caso_con_seguimiento(uuid, numeric, text, text, numeric, text, text, timestamptz, jsonb, date, boolean) from anon;
grant execute on function entregar_caso_con_seguimiento(uuid, numeric, text, text, numeric, text, text, timestamptz, jsonb, date, boolean) to authenticated;
