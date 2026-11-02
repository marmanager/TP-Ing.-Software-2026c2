-- ============================================================
-- 079_conversacion_del_cliente.sql — la conversación por WhatsApp de un
-- cliente, filtrada en la base
--
-- Correr entero en el SQL Editor de Supabase, después de la 078. Es
-- idempotente. Lo usa la API (docs/respuestas-y-plantillas-plan.md, API-2):
--   GET /v1/clientes/:id/whatsapp
--
-- La ficha del cliente muestra lo que le mandamos y lo que contestó, mezclado
-- por fecha. Hasta ahora la ficha leía TODAS las respuestas del negocio y se
-- quedaba con las del cliente (con un tope de 2000). Para filtrar en la base
-- hacen falta dos cosas:
--
--   seguimiento_whatsapp.cliente_id   a quién le salió cada aviso. Hoy se
--       llega por el caso o por el turno; con la columna, la conversación es
--       una consulta por cliente. La llena un trigger al insertar, a partir
--       del caso o del turno del aviso (no se toma lo que venga en la fila),
--       y se completa para lo que ya está en la cola. Si después el caso
--       cambia de cliente, el aviso sigue siendo de a quién le llegó.
--
--   seguimiento_whatsapp_respuesta.resolvio   qué anotó solo la API con esa
--       respuesta: confirmo (confirmó el turno), no_puede (avisó que no
--       puede) o baja (pidió no recibir más avisos). null si sólo se guardó.
--       Lo escribe el webhook, con la clave de servicio; lo anterior a esta
--       migración queda en null.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A qué cliente le salió cada aviso
-- ------------------------------------------------------------
alter table seguimiento_whatsapp
  add column if not exists cliente_id uuid references cliente (id) on delete set null;

comment on column seguimiento_whatsapp.cliente_id is
  'A quién le salió el aviso (079): el cliente del caso o del turno al insertarlo. Lo pone el trigger seguimiento_whatsapp_cliente.';

create or replace function seguimiento_whatsapp_cliente() returns trigger
  language plpgsql security definer set search_path to 'public' as $$
begin
  if new.caso_id is not null or new.turno_id is not null then
    new.cliente_id := coalesce(
      (select c.cliente_id from caso c where c.id = new.caso_id and c.negocio_id = new.negocio_id),
      (select t.cliente_id from turno t where t.id = new.turno_id and t.negocio_id = new.negocio_id)
    );
  end if;
  return new;
end;
$$;

revoke all on function seguimiento_whatsapp_cliente() from public, anon, authenticated;

drop trigger if exists seguimiento_whatsapp_cliente on seguimiento_whatsapp;
create trigger seguimiento_whatsapp_cliente before insert on seguimiento_whatsapp
  for each row execute function seguimiento_whatsapp_cliente();

-- Lo que ya está en la cola.
update seguimiento_whatsapp s
   set cliente_id = coalesce(
     (select c.cliente_id from caso c where c.id = s.caso_id and c.negocio_id = s.negocio_id),
     (select t.cliente_id from turno t where t.id = s.turno_id and t.negocio_id = s.negocio_id)
   )
 where s.cliente_id is null and (s.caso_id is not null or s.turno_id is not null);

-- Lo que le salió a un cliente, del más nuevo al más viejo.
create index if not exists seguimiento_whatsapp_del_cliente
  on seguimiento_whatsapp (negocio_id, cliente_id, procesado_en desc, id desc) where estado = 'enviado';

-- ------------------------------------------------------------
-- 2. Qué resolvió sola cada respuesta
-- ------------------------------------------------------------
alter table seguimiento_whatsapp_respuesta add column if not exists resolvio text;

alter table seguimiento_whatsapp_respuesta drop constraint if exists seguimiento_whatsapp_respuesta_resolvio_check;
alter table seguimiento_whatsapp_respuesta add constraint seguimiento_whatsapp_respuesta_resolvio_check
  check (resolvio is null or resolvio in ('confirmo', 'no_puede', 'baja'));

comment on column seguimiento_whatsapp_respuesta.resolvio is
  'Qué anotó sola la API con esta respuesta (079): confirmo, no_puede o baja. null si sólo se guardó.';
