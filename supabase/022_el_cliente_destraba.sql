-- ============================================================
-- 022_el_cliente_destraba.sql — contestar el presupuesto suelta el caso
--
-- Correr entero en el SQL Editor de Supabase, después de 001..021.
-- Es idempotente.
--
-- QUÉ RESUELVE:
-- El cliente contestaba desde el link y del lado del negocio no pasaba nada
-- visible: el caso se quedaba en "esperando" hasta que alguien se acordara
-- de mirar. El bucle de los puntos 5 y 6 del flujo quedaba abierto, y la
-- pelota se quedaba en el aire: el cliente ya contestó y el taller sigue
-- creyendo que espera.
--
-- CUÁNDO SE SUELTA, Y CUÁNDO NO:
-- Sólo cuando ya no queda nada por contestar. Con tres pasos en la mesa, el
-- cliente puede aprobar uno hoy y pensar los otros dos: el caso sigue
-- esperando, porque sigue esperando.
--
-- Y sólo si lo único que lo trababa era él. Un caso puede estar esperando
-- por un repuesto que no llegó, y ahí la respuesta del cliente no destraba
-- nada: el auto sigue sin poder salir. Por eso se mira también el
-- inventario del caso antes de mover el estado.
--
-- Rechazar destraba igual que aprobar. Un "no" es una respuesta: el taller
-- sigue con lo aprobado y, si hace falta, propone otra cosa. Un paso
-- rechazado no puede dejar un caso trabado para siempre.
--
-- POR QUÉ DEVUELVE "existe":
-- El mismo navegador puede tener credenciales cargadas y estar usando el
-- modo de ejemplo, que guarda todo local. Un link armado en modo de ejemplo
-- no está en la base, y la base tiene que poder decir "ese código no es mío"
-- de una forma distinta a "ese código es mío y esta respuesta no va". Con un
-- "no" a secas, el navegador dejaba de buscar y el link del modo de ejemplo
-- no andaba.
--
-- QUIÉN FIRMA:
-- El evento dice "El cliente", igual que los de aprobar y rechazar. Si
-- mañana alguien pregunta por qué el caso salió de esperando un domingo a
-- las once de la noche, el historial lo contesta.
-- ============================================================

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
  c        caso%rowtype;
  p        paso%rowtype;
  quedan   integer;
  trabado  boolean;
  destrabo boolean := false;
begin
  if p_respuesta not in ('aprobado', 'rechazado') then
    return jsonb_build_object('ok', false, 'motivo', 'No entendimos la respuesta. Probá de nuevo.');
  end if;

  if p_codigo is null or length(p_codigo) < 8 then
    return jsonb_build_object('ok', false, 'existe', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
  end if;

  select * into c from caso where seguimiento_codigo = p_codigo;
  if not found then
    return jsonb_build_object('ok', false, 'existe', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
  end if;

  if c.estado = 'completado' then
    return jsonb_build_object('ok', false, 'motivo', 'Este trabajo ya se entregó. Si querés agregar algo, hablá con el negocio.');
  end if;

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

  insert into evento (caso_id, tipo, titulo, detalle, autor, icono, monto)
  values (
    c.id,
    'plata',
    case when p_respuesta = 'aprobado'
      then 'Lo aprobó el cliente desde el link'
      else 'El cliente no lo hace, contestó desde el link' end,
    p.nombre || ' · $' || translate(to_char(p.monto, 'FM999G999G999'), ',', '.'),
    'El cliente',
    case when p_respuesta = 'aprobado' then 'listo' else 'nota' end,
    p.monto
  );

  -- ------------------------------------------------------------
  -- ¿Queda algo por contestar? ¿Y algo más que lo trabe?
  -- ------------------------------------------------------------
  select count(*) into quedan
  from paso
  where caso_id = c.id and estado = 'esperando';

  select exists (
    select 1 from insumo where caso_id = c.id and estado <> 'en_stock'
  ) into trabado;

  if c.estado = 'esperando' and quedan = 0 and not trabado then
    update caso
    set estado = 'en_proceso',
        que_falta = 'Hacer el trabajo'
    where id = c.id;

    insert into evento (caso_id, tipo, estado, titulo, detalle, autor, icono)
    values (
      c.id,
      'estado',
      'en_proceso',
      'El cliente terminó de contestar',
      'Ya no queda nada esperando su respuesta.',
      'El cliente',
      'llave'
    );

    destrabo := true;
  end if;

  return jsonb_build_object('ok', true, 'destrabo', destrabo, 'quedan', quedan);
end;
$$;

revoke all on function responder_paso_desde_el_link(text, uuid, text) from public;
grant execute on function responder_paso_desde_el_link(text, uuid, text) to anon, authenticated;
