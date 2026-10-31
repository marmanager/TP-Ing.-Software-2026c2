-- ============================================================
-- 080_mensaje_a_mano.sql — contestarle a un cliente por WhatsApp desde la app
--
-- Correr entero en el SQL Editor de Supabase, después de la 079. Es
-- idempotente. Lo usa la API (docs/respuestas-y-plantillas-plan.md, API-3):
--   POST /v1/clientes/:id/whatsapp   { texto }
--
-- WhatsApp deja escribir texto libre sólo dentro de las 24 h desde el último
-- mensaje del cliente. Pasado eso, hace falta una plantilla aprobada por Meta
-- («Retomar la conversación», que llega con API-4).
--
-- QUÉ CAMBIA:
--   seguimiento_whatsapp.tipo   admite manual (lo que alguien escribió a mano)
--       y retomar (la plantilla de API-4). Ninguno de los dos cuelga de un
--       caso ni de un turno: son del cliente (cliente_id, 079).
--   reservar_mensaje_manual()   deja el mensaje en la cola como «enviando»,
--       con el teléfono y el número de la plataforma del último mensaje del
--       cliente: la API no elige a quién le manda. Si la ventana está
--       cerrada, no reserva nada.
--   terminar_mensaje_manual()   lo da por enviado (con el id de WhatsApp) o
--       por fallido, y al enviarlo marca vistas las respuestas del cliente.
--
-- La API manda el mensaje entre las dos. El procesador de la cola no toca
-- estos tipos: sólo toma los «pendiente», y éstos nacen «enviando».
-- Los dos piden entregar_y_reabrir, como la cola.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Los tipos nuevos, sin caso ni turno
-- ------------------------------------------------------------
alter table seguimiento_whatsapp drop constraint if exists seguimiento_whatsapp_tipo_check;
alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_tipo_check
  check (tipo in ('cierre', 'estado', 'turno', 'volver', 'presupuesto', 'manual', 'retomar'));

alter table seguimiento_whatsapp drop constraint if exists seguimiento_whatsapp_caso_o_turno;
alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_caso_o_turno check (
  case when tipo in ('manual', 'retomar') then num_nonnulls(caso_id, turno_id) = 0
       else num_nonnulls(caso_id, turno_id) = 1 end
);

-- ------------------------------------------------------------
-- 2. Reservar: la ventana, el destino y la fila «enviando»
-- ------------------------------------------------------------
-- Errores (P0001, con el código en el hint, para que la API los traduzca):
--   cliente_no_encontrado   no es un cliente de este negocio
--   ventana_cerrada         no escribió nunca, o hace 24 h o más
create or replace function reservar_mensaje_manual(p_cliente uuid, p_mensaje text)
  returns table (id uuid, telefono text, numero_emisor_id text)
  language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
declare
  v_ultimo record;
  v_id uuid;
begin
  if not puede_aca('entregar_y_reabrir') then
    raise exception 'Este rol no permite contestar por WhatsApp.' using errcode = '42501';
  end if;
  if not exists (select 1 from cliente c where c.id = p_cliente and c.negocio_id = mi_negocio()) then
    raise exception 'Ese cliente ya no está.' using errcode = 'P0001', hint = 'cliente_no_encontrado';
  end if;

  -- Su último mensaje a este negocio: de ahí salen la ventana y el destino.
  select r.enviado_en, r.telefono, r.numero_emisor_id into v_ultimo
    from seguimiento_whatsapp_respuesta r
   where r.negocio_id = mi_negocio() and r.cliente_id = p_cliente and r.telefono is not null
   order by r.enviado_en desc, r.id desc
   limit 1;
  if not found or v_ultimo.enviado_en <= now() - interval '24 hours' then
    raise exception 'Pasaron más de 24 horas desde su último mensaje.' using errcode = 'P0001', hint = 'ventana_cerrada';
  end if;

  insert into seguimiento_whatsapp (negocio_id, cliente_id, tipo, estado, canal, telefono, numero_emisor_id,
                                    mensaje, enviar_en, procesado_en)
  values (mi_negocio(), p_cliente, 'manual', 'enviando', 'whatsapp', v_ultimo.telefono, v_ultimo.numero_emisor_id,
          p_mensaje, now(), now())
  returning seguimiento_whatsapp.id into v_id;

  return query select v_id, v_ultimo.telefono, v_ultimo.numero_emisor_id;
end;
$$;

-- ------------------------------------------------------------
-- 3. Terminar: enviado o fallido
-- ------------------------------------------------------------
-- Con p_mensaje_id, enviado; sin él, fallido con p_error. Sólo un manual de
-- este negocio que sigue «enviando». Devuelve cuándo quedó, o null si no
-- había nada que terminar.
create or replace function terminar_mensaje_manual(p_id uuid, p_mensaje_id text, p_error text)
  returns timestamptz
  language plpgsql security definer set search_path to 'public' as $$
declare
  v_cliente uuid;
  v_en timestamptz;
begin
  if not puede_aca('entregar_y_reabrir') then
    raise exception 'Este rol no permite contestar por WhatsApp.' using errcode = '42501';
  end if;

  update seguimiento_whatsapp s
     set estado = case when p_mensaje_id is not null then 'enviado' else 'fallido' end,
         mensaje_id = p_mensaje_id,
         error = case when p_mensaje_id is not null then null else coalesce(p_error, 'No se pudo mandar.') end,
         procesado_en = now()
   where s.id = p_id and s.negocio_id = mi_negocio() and s.tipo = 'manual' and s.estado = 'enviando'
  returning s.cliente_id, s.procesado_en into v_cliente, v_en;

  -- Si le contestaron, lo que había escrito ya se vio.
  if v_en is not null and p_mensaje_id is not null and v_cliente is not null then
    perform marcar_respuestas_vistas(v_cliente, null);
  end if;
  return v_en;
end;
$$;

revoke all on function reservar_mensaje_manual(uuid, text) from public, anon;
revoke all on function terminar_mensaje_manual(uuid, text, text) from public, anon;
grant execute on function reservar_mensaje_manual(uuid, text) to authenticated;
grant execute on function terminar_mensaje_manual(uuid, text, text) to authenticated;
