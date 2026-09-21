-- ============================================================
-- 019_aprobar_desde_el_link.sql — el cliente contesta el presupuesto
--
-- Correr entero en el SQL Editor de Supabase, después de 001..018.
-- Es idempotente.
--
-- QUÉ RESUELVE:
-- 018 dejó al cliente mirando. Esto lo deja contestar: los pasos que
-- esperan su respuesta aparecen en la misma pantalla pública, y los aprueba
-- o los rechaza de a uno, sin llamar y sin cuenta. Es el paso que faltaba
-- para que el presupuesto no dependa de agarrar a alguien por teléfono.
--
-- LO QUE ESTO CAMBIA, Y HAY QUE DECIRLO:
-- 018 no le mostraba al cliente los pasos que todavía no había aprobado.
-- Ahora sí, porque no se puede contestar lo que no se ve. Lo que sigue
-- afuera es todo lo demás: el diagnóstico, las notas, quién lo atiende, el
-- inventario, los otros casos. Y los pasos RECHAZADOS tampoco se muestran:
-- ya los contestó, y volver a ofrecerlos es del negocio.
--
-- EL RIESGO, DE FRENTE:
-- Es una decisión con plata tomada por quien tiene un link, sin cuenta. El
-- link es la firma. De ahí las tres reglas de abajo.
--
--   1. La respuesta entra sólo por esta función, con el código en la mano,
--      y sólo sobre un paso de ESE caso. Con un código no se puede contestar
--      el presupuesto de otro.
--
--   2. Sólo se contesta lo que está esperando respuesta, y sólo mientras el
--      caso está abierto. Sobre un trabajo ya entregado no se aprueba nada.
--
--   3. Queda escrito quién contestó. El evento dice "desde el link" y firma
--      "El cliente", distinto de cuando lo carga alguien del mostrador. Si
--      mañana hay una discusión sobre quién aprobó qué, el historial la
--      contesta.
--
-- Aprobar sigue siendo definitivo: el trigger de 015 no deja tocar un paso
-- aprobado, venga de donde venga. Por eso la pantalla pregunta antes, con
-- el monto escrito.
-- ============================================================

-- ------------------------------------------------------------
-- Lo que ve el cliente, ahora con lo que falta que conteste
-- ------------------------------------------------------------
-- Misma función de 018 con un campo más: "por_responder". Va acá y no en un
-- ver_seguimiento_2() para que siga habiendo UNA sola puerta.
--
-- De cada paso por contestar salen el nombre, el porqué y el monto. Y el
-- id, que es lo único nuevo que se expone: hace falta para poder decir
-- "este". Es un uuid al azar, no sirve sin el código, y la función que
-- recibe la respuesta comprueba igual que el paso sea de ese caso.
create or replace function ver_seguimiento(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c   caso%rowtype;
  n   negocio%rowtype;
  cli cliente%rowtype;
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

  return jsonb_build_object(
    'sirve', true,
    'negocio_nombre', n.nombre,
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
      select jsonb_agg(jsonb_build_object('nombre', p.nombre, 'monto', p.monto)
                       order by p.orden, p.creado_en)
      from paso p
      where p.caso_id = c.id and p.estado = 'aprobado'
    ), '[]'::jsonb),
    -- Sólo mientras el caso está abierto: sobre un trabajo entregado no hay
    -- nada que decidir, y ofrecerlo sería ofrecer una puerta que no abre.
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
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function ver_seguimiento(text) from public;
grant execute on function ver_seguimiento(text) to anon, authenticated;

-- ------------------------------------------------------------
-- La respuesta del cliente
-- ------------------------------------------------------------
-- Devuelve { ok: true } o { ok: false, motivo: '<una frase para leer>' }.
-- Los motivos están escritos para el cliente, que no sabe qué es un caso ni
-- un paso: son lo que va a aparecer en su pantalla tal cual.
--
-- No devuelve el caso actualizado a propósito: la pantalla vuelve a pedirlo
-- con ver_seguimiento(), así lo que se dibuja sale siempre del mismo lugar.
create or replace function responder_paso_desde_el_link(
  p_codigo    text,
  p_paso_id   uuid,
  p_respuesta text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c caso%rowtype;
  p paso%rowtype;
begin
  if p_respuesta not in ('aprobado', 'rechazado') then
    return jsonb_build_object('ok', false, 'motivo', 'No entendimos la respuesta. Probá de nuevo.');
  end if;

  if p_codigo is null or length(p_codigo) < 8 then
    return jsonb_build_object('ok', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
  end if;

  select * into c from caso where seguimiento_codigo = p_codigo;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
  end if;

  if c.estado = 'completado' then
    return jsonb_build_object('ok', false, 'motivo', 'Este trabajo ya se entregó. Si querés agregar algo, hablá con el negocio.');
  end if;

  -- El paso tiene que ser de ESTE caso. Es lo que hace que un código no
  -- pueda contestar el presupuesto de otro.
  --
  -- "for update" bloquea la fila: si el cliente toca desde el celular
  -- mientras el mostrador contesta lo mismo, uno de los dos espera al otro
  -- y ve el resultado, en vez de pisarse.
  select * into p from paso where id = p_paso_id and caso_id = c.id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'Ese paso ya no está en el presupuesto.');
  end if;

  if p.estado = 'aprobado' then
    return jsonb_build_object('ok', false, 'motivo', 'Ese paso ya estaba aprobado.');
  end if;
  if p.estado = 'rechazado' then
    return jsonb_build_object('ok', false, 'motivo', 'Ese paso ya lo habías contestado.');
  end if;

  update paso
  set estado = p_respuesta,
      aprobado_en = case when p_respuesta = 'aprobado' then now() else aprobado_en end
  where id = p.id;

  -- Queda escrito que lo contestó el cliente y no el mostrador. El autor y
  -- el título son distintos a propósito: es la diferencia que importa si
  -- mañana hay una discusión sobre quién aprobó qué.
  insert into evento (caso_id, tipo, titulo, detalle, autor, icono, monto)
  values (
    c.id,
    'plata',
    case when p_respuesta = 'aprobado'
      then 'Lo aprobó el cliente desde el link'
      else 'El cliente no lo hace, contestó desde el link' end,
    -- El punto de mil va a mano: to_char usa el separador del idioma de la
    -- base, que en Supabase es el de Estados Unidos y pondría "$74,000".
    -- El resto del historial lo escribe el navegador con pesos(), en
    -- argentino, y los dos textos tienen que leerse igual.
    p.nombre || ' · $' || translate(to_char(p.monto, 'FM999G999G999'), ',', '.'),
    'El cliente',
    case when p_respuesta = 'aprobado' then 'listo' else 'nota' end,
    p.monto
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function responder_paso_desde_el_link(text, uuid, text) from public;
grant execute on function responder_paso_desde_el_link(text, uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Nada más
-- ------------------------------------------------------------
-- Sigue sin haber políticas de RLS para el rol anónimo. Las dos funciones
-- de arriba son toda la superficie que el cliente puede tocar, y las dos
-- piden el código.
