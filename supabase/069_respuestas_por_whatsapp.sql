-- ============================================================
-- 069_respuestas_por_whatsapp.sql — lo que contestan queda con su cliente,
-- y un sí o un no al recordatorio anotan el turno
--
-- Correr entero en el SQL Editor de Supabase, después de la 068.
-- Es idempotente. Va ANTES de desplegar la API que la usa: sin ella el
-- webhook no puede guardar ninguna respuesta (escribe cliente_id), y se
-- pierden, BAJA incluida.
--
-- Las columnas ya están en el proyecto (se corrió desde el MIGRACION.md de
-- la API, donde se llamaba 064, número que acá ya era de las categorías).
-- El trigger, el check y los índices no se pudieron confirmar desde afuera:
-- correrla entera otra vez es seguro.
--
-- RESPUESTAS: cada una guarda el cliente al que corresponde (el del aviso
-- que contestó o, sin aviso, el único que tiene ese teléfono). La bandeja
-- del negocio las lista por (negocio_id, creado_en, id).
--
-- TURNO: respuesta_cliente es lo último que contestó el cliente al
-- recordatorio: 'confirmo' (y el turno queda confirmado) o 'no_puede' (el
-- turno NO se cancela: el negocio decide). Un turno confirmado desde el
-- negocio la tiene en null; así se distinguen. La escribe sólo el webhook,
-- con la clave de servicio: con una sesión de persona, el trigger frena.
-- ============================================================

alter table seguimiento_whatsapp_respuesta
  add column if not exists cliente_id uuid references cliente(id) on delete set null;
create index if not exists seguimiento_whatsapp_respuesta_bandeja
  on seguimiento_whatsapp_respuesta (negocio_id, creado_en, id);
create index if not exists cliente_telefono on cliente (telefono);

alter table turno add column if not exists respuesta_cliente text;
alter table turno add column if not exists respuesta_cliente_en timestamptz;
alter table turno drop constraint if exists turno_respuesta_cliente;
alter table turno add constraint turno_respuesta_cliente check (
  (respuesta_cliente is null and respuesta_cliente_en is null) or
  (respuesta_cliente in ('confirmo', 'no_puede') and respuesta_cliente_en is not null)
);

-- La clave de servicio no tiene auth.uid(); una persona sí.
create or replace function turno_respuesta_solo_del_cliente() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and (
    (tg_op = 'INSERT' and (new.respuesta_cliente is not null or new.respuesta_cliente_en is not null)) or
    (tg_op = 'UPDATE' and (new.respuesta_cliente is distinct from old.respuesta_cliente
                           or new.respuesta_cliente_en is distinct from old.respuesta_cliente_en))
  ) then
    raise exception 'Lo que contestó el cliente lo anota el WhatsApp, no se edita a mano.';
  end if;
  return new;
end $$;
drop trigger if exists turno_respuesta_solo_del_cliente on turno;
create trigger turno_respuesta_solo_del_cliente before insert or update on turno
  for each row execute function turno_respuesta_solo_del_cliente();
