-- ============================================================
-- 085_turno_por_link.sql — contestar el recordatorio del turno desde el mail
-- (docs/avisos-por-mail-plan.md, API-6)
--
-- Correr entero en el SQL Editor de Supabase, después de la 084. Es
-- idempotente.
--
-- Por WhatsApp el recordatorio trae dos botones, «Confirmo» y «Cancelo»
-- (082). Por mail no hay botones de Meta: el mail trae un link a una página
-- con los mismos dos, y la respuesta se anota igual que la del WhatsApp.
--
-- QUÉ CAMBIA:
--   turno.respuesta_cliente_via   por dónde contestó: 'whatsapp' o 'mail'.
--       null en las de antes de la 085, que fueron todas por WhatsApp. La
--       cuida el mismo trigger que la respuesta: no se edita a mano.
--   turno_por_link                un link por mail de recordatorio. Se guarda
--       la huella (sha256) del token, nunca el token. Sin políticas: sólo la
--       clave de servicio. No va en las copias.
--   crear_link_de_turno()         guarda la huella de un recordatorio que va a salir.
--   ver_turno_por_link()          lo que muestra la página: el negocio, cuándo
--       es el turno, si sigue en pie y qué contestó.
--   responder_turno_por_link()    «confirmo» confirma el turno; «cancelo» lo
--       cancela (el lugar queda libre), como el botón del WhatsApp. Un link
--       contesta una sola vez.
--   version_del_esquema()         085: turno, que va en las copias, tiene una
--       columna nueva.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Por dónde contestó
-- ------------------------------------------------------------
alter table turno add column if not exists respuesta_cliente_via text;

alter table turno drop constraint if exists turno_respuesta_cliente_via_check;
alter table turno add constraint turno_respuesta_cliente_via_check check (
  respuesta_cliente_via is null or (respuesta_cliente_via in ('whatsapp', 'mail') and respuesta_cliente is not null)
);

comment on column turno.respuesta_cliente_via is
  'Por dónde contestó el recordatorio: whatsapp o mail (085). null en las de antes, que fueron por WhatsApp.';

-- Igual que la de la 071, y también cuida la vía.
create or replace function turno_respuesta_solo_del_cliente() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is not null and not restableciendo_copia() and (
    (tg_op = 'INSERT' and (new.respuesta_cliente is not null or new.respuesta_cliente_en is not null
                           or new.respuesta_cliente_via is not null)) or
    (tg_op = 'UPDATE' and (new.respuesta_cliente is distinct from old.respuesta_cliente
                           or new.respuesta_cliente_en is distinct from old.respuesta_cliente_en
                           or new.respuesta_cliente_via is distinct from old.respuesta_cliente_via))
  ) then
    raise exception 'Lo que contestó el cliente lo anota el WhatsApp o el mail, no se edita a mano.';
  end if;
  return new;
end $$;

-- ------------------------------------------------------------
-- 2. Los links
-- ------------------------------------------------------------
create table if not exists turno_por_link (
  huella          text primary key check (huella ~ '^[0-9a-f]{64}$'),
  seguimiento_id  uuid not null references seguimiento_whatsapp(id) on delete cascade,
  turno_id        uuid not null references turno(id) on delete cascade,
  negocio_id      uuid not null references negocio(id) on delete cascade,
  creado_en       timestamptz not null default now(),
  usado_en        timestamptz,
  respuesta       text check (respuesta in ('confirmo', 'cancelo')),
  check ((usado_en is null) = (respuesta is null))
);
create index if not exists turno_por_link_turno on turno_por_link (turno_id);
alter table turno_por_link enable row level security;  -- sin políticas: nadie la lee ni escribe directo
revoke all on turno_por_link from anon, authenticated;

comment on table turno_por_link is
  'Los links para contestar el recordatorio de turno desde el mail (085). Sólo la huella del token.';

-- La llama el procesador (clave de servicio) antes de mandar el recordatorio por mail.
create or replace function crear_link_de_turno(p_seguimiento uuid, p_huella text) returns boolean
  language plpgsql security definer set search_path to 'public' as $$
declare
  v_aviso seguimiento_whatsapp%rowtype;
begin
  select * into v_aviso from seguimiento_whatsapp where id = p_seguimiento and tipo = 'turno' and turno_id is not null;
  if not found then return false; end if;
  insert into turno_por_link (huella, seguimiento_id, turno_id, negocio_id)
    values (p_huella, v_aviso.id, v_aviso.turno_id, v_aviso.negocio_id)
    on conflict (huella) do nothing;
  return true;
end;
$$;

-- Lo que necesita la página. Un link que no existe: sirve = false.
-- en_pie: el turno sigue agendado o confirmado y todavía no pasó.
create or replace function ver_turno_por_link(p_huella text) returns jsonb
  language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_link turno_por_link%rowtype;
  v_turno turno%rowtype;
  v_negocio negocio%rowtype;
begin
  select * into v_link from turno_por_link where huella = p_huella;
  if not found then return jsonb_build_object('sirve', false); end if;
  select * into v_turno from turno where id = v_link.turno_id;
  select * into v_negocio from negocio where id = v_link.negocio_id;
  return jsonb_build_object(
    'sirve', true,
    'negocio', jsonb_build_object('nombre', v_negocio.nombre, 'rubro', v_negocio.rubro,
      'telefono', nullif(trim(coalesce(v_negocio.telefono, '')), '')),
    'turno', jsonb_build_object('empieza_en', v_turno.empieza_en, 'estado', v_turno.estado),
    'en_pie', v_turno.estado in ('agendado', 'confirmado') and v_turno.empieza_en > now(),
    'respuesta', v_link.respuesta
  );
end;
$$;

create or replace function responder_turno_por_link(p_huella text, p_respuesta text) returns jsonb
  language plpgsql security definer set search_path to 'public' as $$
declare
  v_link turno_por_link%rowtype;
  v_ahora timestamptz := clock_timestamp();
begin
  if p_respuesta is null or p_respuesta not in ('confirmo', 'cancelo') then
    return jsonb_build_object('sirve', false);
  end if;
  select * into v_link from turno_por_link where huella = p_huella for update;
  if not found then return jsonb_build_object('sirve', false); end if;
  -- Ya contestó con este link: se muestra lo que contestó, sin cambiar nada.
  if v_link.usado_en is not null then
    return ver_turno_por_link(p_huella) || jsonb_build_object('recien', false);
  end if;

  update turno set
      estado = case p_respuesta when 'confirmo' then 'confirmado' else 'cancelado' end,
      respuesta_cliente = p_respuesta, respuesta_cliente_en = v_ahora, respuesta_cliente_via = 'mail'
    where id = v_link.turno_id and estado in ('agendado', 'confirmado') and empieza_en > v_ahora;
  if not found then
    return ver_turno_por_link(p_huella) || jsonb_build_object('recien', false);
  end if;

  update turno_por_link set usado_en = v_ahora, respuesta = p_respuesta where huella = p_huella;
  return ver_turno_por_link(p_huella) || jsonb_build_object('recien', true);
end;
$$;

revoke all on function crear_link_de_turno(uuid, text) from public, anon, authenticated;
revoke all on function ver_turno_por_link(text) from public, anon, authenticated;
revoke all on function responder_turno_por_link(text, text) from public, anon, authenticated;
grant execute on function crear_link_de_turno(uuid, text) to service_role;
grant execute on function ver_turno_por_link(text) to service_role;
grant execute on function responder_turno_por_link(text, text) to service_role;

create or replace function version_del_esquema() returns text
  language sql immutable set search_path to 'public' as $$ select '085'::text; $$;
