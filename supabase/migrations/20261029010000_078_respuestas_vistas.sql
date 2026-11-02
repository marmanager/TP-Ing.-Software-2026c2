-- ============================================================
-- 078_respuestas_vistas.sql — «Ya lo vi» en lo que contestan por WhatsApp
--
-- Correr entero en el SQL Editor de Supabase, después de la 077. Es
-- idempotente. Lo usa la API (docs/respuestas-y-plantillas-plan.md, API-1):
--   POST /v1/clientes/:id/whatsapp/visto
--   POST /v1/seguimiento/respuestas/visto   (las que no tienen cliente)
--   GET  /v1/seguimiento/respuestas?pendientes=true
--
-- Las respuestas se agrupan por cliente. «Ya lo vi» marca todas las de ese
-- cliente hasta ahora; si después escribe otra vez, esa vuelve a estar
-- pendiente. Las que no tienen cliente (un número que no está en la agenda)
-- se marcan por teléfono.
--
-- QUIÉN LA ESCRIBE: nadie de forma directa. La tabla sigue sin política de
-- escritura para authenticated (sólo SELECT, como desde la 069): la fecha la
-- pone marcar_respuestas_vistas(), que pide entregar_y_reabrir, el mismo
-- permiso que ver la cola, y sólo toca las respuestas que esa persona ve en
-- la bandeja.
-- ============================================================

alter table seguimiento_whatsapp_respuesta add column if not exists vista_en timestamptz;

comment on column seguimiento_whatsapp_respuesta.vista_en is
  'Cuándo alguien del negocio tocó «Ya lo vi» (078). null: pendiente. Lo escribe sólo marcar_respuestas_vistas().';

-- Lo pendiente del negocio (la bandeja con ?pendientes=true y el Inicio).
create index if not exists seguimiento_whatsapp_respuesta_pendientes
  on seguimiento_whatsapp_respuesta (negocio_id, creado_en, id) where vista_en is null;

-- La conversación con un cliente y su «Ya lo vi».
create index if not exists seguimiento_whatsapp_respuesta_del_cliente
  on seguimiento_whatsapp_respuesta (negocio_id, cliente_id, enviado_en desc, id desc);

-- ------------------------------------------------------------
-- marcar_respuestas_vistas(cliente, teléfono): uno de los dos
-- ------------------------------------------------------------
-- Con cliente: todas las suyas. Con teléfono: las de ese número que no
-- tienen cliente. Devuelve cuántas marcó (0 si ya estaban vistas).
--
-- Es security definer porque la tabla no tiene política de escritura, así
-- que la visibilidad de la bandeja se repite acá: lo de un caso, si la
-- persona ve ese caso (todos, o los suyos un técnico); lo de un aviso sin
-- caso (un recordatorio), si ve la cola, que es el permiso que ya se pidió.
create or replace function marcar_respuestas_vistas(p_cliente uuid, p_telefono text)
  returns integer
  language plpgsql security definer set search_path to 'public' as $$
declare
  v_marcadas integer;
begin
  if not puede_aca('entregar_y_reabrir') then
    raise exception 'Este rol no permite ver las respuestas por WhatsApp.' using errcode = '42501';
  end if;
  if num_nonnulls(p_cliente, p_telefono) <> 1 then
    raise exception 'Falta decir de qué cliente o de qué teléfono.' using errcode = 'P0001';
  end if;

  update seguimiento_whatsapp_respuesta r
     set vista_en = now()
   where r.negocio_id = mi_negocio()
     and r.vista_en is null
     and (case when p_cliente is not null then r.cliente_id = p_cliente
               else r.cliente_id is null and r.telefono = p_telefono end)
     and (
       r.caso_id is null
       or exists (select 1 from caso c
                   where c.id = r.caso_id and c.negocio_id = r.negocio_id
                     and (puede_aca('ver_todos_los_casos') or c.responsable_id = mi_empleado()))
     );
  get diagnostics v_marcadas = row_count;
  return v_marcadas;
end;
$$;

revoke all on function marcar_respuestas_vistas(uuid, text) from public, anon;
grant execute on function marcar_respuestas_vistas(uuid, text) to authenticated;
