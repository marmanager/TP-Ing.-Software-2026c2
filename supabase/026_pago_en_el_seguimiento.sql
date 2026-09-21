-- ============================================================
-- 026_pago_en_el_seguimiento.sql — el cliente ve cuánto falta pagar
--
-- Correr entero en el SQL Editor de Supabase, después de 001..025.
-- Es idempotente.
--
-- QUÉ AGREGA:
-- La misma ver_seguimiento() de siempre —nació en 018 y creció en 019, 020
-- y 021— con un campo más, "pago":
--
--   { pagado, falta, pendientes: [{ monto, link, vence_en }] }
--
-- Con eso, el link de seguimiento le dice al cliente cuánto pagó, cuánto le
-- falta y, si el negocio le mandó un link de pago, el botón para pagarlo.
-- Pagar desde ahí es una opción, no una obligación: también puede pagar en
-- el local.
--
-- LO QUE NO VIAJA:
-- Cómo se pagó cada cosa, las notas de los cobros, los anulados, los QR
-- (son para el mostrador) y los descuentos. Todo eso es de adentro. Del
-- descuento sólo se ve el efecto: lo que falta ya viene descontado.
--
-- CUÁNDO VA "pago" Y CUÁNDO VA NULL:
--   · Si le mandaron un link que todavía no pagó: siempre, aunque el trabajo
--     no esté terminado (una seña).
--   · Si el trabajo está listo o entregado y hay algo aprobado: sí.
--   · Si no: null. Antes de terminar, el total todavía puede cambiar.
--   · Un caso entregado antes de 025 sin ningún cobro anotado: null. Puede
--     haberse cobrado por afuera, y decirle al cliente que debe sería
--     inventarlo.
--
-- Es la misma cuenta que pagoPublico() en src/lib/cobros.js, que la usa el
-- modo de ejemplo; los tests están en pruebas/cobros.test.js.
-- ============================================================

create or replace function ver_seguimiento(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c          caso%rowtype;
  n          negocio%rowtype;
  cli        cliente%rowtype;
  aprobado   numeric;
  pagado     numeric;
  pendiente  numeric;
  descontado numeric;
  hay_cobros boolean;
  links      jsonb;
  pago       jsonb;
begin
  if p_codigo is null or length(p_codigo) < 8 then
    return jsonb_build_object('sirve', false);
  end if;

  select * into c from caso where seguimiento_codigo = p_codigo;
  if not found then
    return jsonb_build_object('sirve', false);
  end if;

  select * into n   from negocio where id = c.negocio_id;
  select * into cli from cliente where id = c.cliente_id;

  update caso set seguimiento_visto_en = now() where id = c.id;

  -- ---------- el pago ----------
  select coalesce(sum(monto), 0) into aprobado
  from paso where caso_id = c.id and estado = 'aprobado';

  select coalesce(sum(monto) filter (where estado = 'pagado'), 0),
         coalesce(sum(monto) filter (where estado = 'pendiente'), 0),
         count(*) > 0
    into pagado, pendiente, hay_cobros
  from cobro where caso_id = c.id;

  -- Lo anotado con 012 que no pasó a la tabla (no debería quedar ninguno
  -- después de 025, pero el modo de ejemplo lo contempla y tienen que dar
  -- lo mismo).
  if not hay_cobros and coalesce(c.cobrado, 0) > 0 then
    pagado := c.cobrado;
  end if;

  -- Mismo criterio que descuentoDelCaso(): lo que dice la columna, o para un
  -- caso cerrado con 012 cobrando de menos, la diferencia.
  descontado := case
    when c.descuento is not null then c.descuento
    when c.estado = 'completado' and c.cobrado is not null then greatest(aprobado - c.cobrado, 0)
    else 0
  end;

  links := coalesce((
    select jsonb_agg(jsonb_build_object('monto', x.monto, 'link', x.link, 'vence_en', x.vence_en)
                     order by x.creado_en)
    from cobro x
    where x.caso_id = c.id and x.estado = 'pendiente' and x.medio = 'link'
  ), '[]'::jsonb);

  if jsonb_array_length(links) > 0
     or (c.estado in ('revision_final', 'completado')
         and aprobado > 0
         and (c.estado <> 'completado' or hay_cobros or c.descuento is not null or c.cobrado is not null))
  then
    pago := jsonb_build_object(
      'pagado', pagado,
      'falta', greatest(aprobado - pagado - pendiente - descontado, 0),
      'pendientes', links
    );
  else
    pago := null;
  end if;

  return jsonb_build_object(
    'sirve', true,
    'negocio_nombre', n.nombre,
    'negocio_telefono', nullif(trim(coalesce(n.telefono, '')), ''),
    'rubro', n.rubro,
    'cliente_nombre', nullif(split_part(coalesce(cli.nombre, ''), ' ', 1), ''),
    'numero', c.numero,
    'identificador', c.identificador,
    'servicio', c.servicio,
    'estado', c.estado,
    'que_falta', case when c.estado = 'esperando' then c.que_falta else null end,
    'abierto_en', c.abierto_en,
    'actualizado_en', c.actualizado_en,
    'pasos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre', p.nombre, 'monto', p.monto,
               'hecho', p.hecho_en is not null)
                       order by p.orden, p.creado_en)
      from paso p
      where p.caso_id = c.id and p.estado = 'aprobado'
    ), '[]'::jsonb),
    'por_responder', case when c.estado = 'completado' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre,
               'descripcion', p.descripcion, 'monto', p.monto)
                       order by p.orden, p.creado_en)
      from paso p
      where p.caso_id = c.id and p.estado = 'esperando'
    ), '[]'::jsonb) end,
    'linea', coalesce((
      select jsonb_agg(jsonb_build_object('estado', e.estado, 'ocurrido_en', e.ocurrido_en)
                       order by e.ocurrido_en)
      from evento e
      where e.caso_id = c.id and e.estado is not null
    ), '[]'::jsonb),
    'pago', pago
  );
end;
$$;

revoke all on function ver_seguimiento(text) from public;
grant execute on function ver_seguimiento(text) to anon, authenticated;
