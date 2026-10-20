-- ============================================================
-- 054_baja_de_avisos.sql — el cliente pide no recibir más avisos
--
-- Correr entero en el SQL Editor de Supabase, después de la 052 (la 053 es
-- de la landing y no se cruza con esta). Es idempotente. Historia: R-8a
-- (módulo seguimiento, en la API). Va ANTES de desplegar la API que da de
-- baja: esa API lee cliente.avisos_baja_en al programar cualquier aviso, y
-- sin la columna entregar un caso con seguimiento y el recordatorio de
-- turno fallan.
--
-- QUÉ AGREGA:
--   cliente.avisos_baja_en      cuándo pidió no recibir avisos. null = nunca.
--   cliente_evento              el historial del cliente (el de `evento`
--                               cuelga de un caso, con caso_id obligatorio).
--   revertir_baja_de_avisos()   el único camino para deshacer la baja, con
--                               su evento en el historial.
--
-- Cuándo es un pedido de baja, a quién se le da y qué avisos se cancelan es
-- regla de la API (seguimiento/baja.ts y respuestas.ts). Acá van la
-- columna, el candado y el historial.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cuándo pidió la baja
-- ------------------------------------------------------------
-- Una fecha y no un sí/no, con el mismo criterio que el cobro nulo contra
-- el cobro en cero (012): un booleano borra cuándo lo pidió, y eso después
-- no lo reconstruye nadie.
alter table cliente add column if not exists avisos_baja_en timestamptz;

comment on column cliente.avisos_baja_en is
  'Cuándo pidió no recibir avisos automáticos (contestó BAJA por WhatsApp). null = nunca lo pidió. '
  'La pone el webhook de WhatsApp y la saca sólo revertir_baja_de_avisos().';

-- ------------------------------------------------------------
-- 2. El candado: la fecha no se toca a mano
-- ------------------------------------------------------------
-- La RLS de cliente (008) deja al dueño y al encargado cambiar cualquier
-- columna de sus clientes. Sin esto, alguien podría sacarle la baja a un
-- cliente directo contra la base, sin que quede registrado, o dar de baja
-- a quien no lo pidió. Con una sesión de persona (authenticated) la columna
-- no se escribe; sí desde el webhook (service_role) y desde
-- revertir_baja_de_avisos(), que corre como su dueño.
create or replace function cliente_avisos_baja_por_su_camino()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and (
    (tg_op = 'INSERT' and new.avisos_baja_en is not null) or
    (tg_op = 'UPDATE' and new.avisos_baja_en is distinct from old.avisos_baja_en)
  ) then
    raise exception 'La baja de avisos la pide el cliente por WhatsApp y se revierte desde su ficha.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists cliente_avisos_baja_por_su_camino on cliente;
create trigger cliente_avisos_baja_por_su_camino
  before insert or update of avisos_baja_en on cliente
  for each row execute function cliente_avisos_baja_por_su_camino();

-- ------------------------------------------------------------
-- 3. El historial del cliente
-- ------------------------------------------------------------
-- Como `evento`, pero del cliente y no de un caso. Por ahora sólo lo
-- escribe revertir_baja_de_avisos(): no tiene políticas de insert, update
-- ni delete, así que lo que queda anotado no se cambia ni se borra.
create table if not exists cliente_evento (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid        not null references negocio (id) on delete cascade,
  cliente_id   uuid        not null references cliente (id) on delete cascade,
  tipo         text        not null,
  titulo       text        not null,
  detalle      text,
  autor        text        not null default 'Alguien del negocio',
  usuario_id   uuid        references auth.users (id) on delete set null,
  ocurrido_en  timestamptz not null default now()
);

create index if not exists cliente_evento_cliente_idx on cliente_evento (cliente_id, ocurrido_en desc);

alter table cliente_evento enable row level security;
revoke all on cliente_evento from anon;

drop policy if exists cliente_evento_lo_ve_el_negocio on cliente_evento;
create policy cliente_evento_lo_ve_el_negocio on cliente_evento
  for select to authenticated
  using (negocio_id = mi_negocio());

comment on table cliente_evento is
  'El historial del cliente (el de evento es del caso). Lo escribe revertir_baja_de_avisos().';

-- ------------------------------------------------------------
-- 4. Revertir la baja
-- ------------------------------------------------------------
-- A veces fue un malentendido y el cliente pide volver. Se puede, y queda
-- en su historial quién y cuándo, con la fecha en que había pedido la baja.
-- En un paso: no puede quedar la baja revertida sin su evento.
--
-- security definer para pasar el candado de arriba; por eso mira a mano lo
-- que miraría la RLS: el cliente es del negocio de quien llama, y quien
-- llama es dueño o encargado (puedo_cargar(), 008). Devuelve el motivo
-- como código: la API escribe el mensaje.
--
-- Si no estaba dado de baja, no cambia nada ni anota nada.
create or replace function revertir_baja_de_avisos(p_cliente_id uuid, p_autor text default 'Alguien del negocio')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actual cliente%rowtype;
  vuelto cliente%rowtype;
  nuevo  cliente_evento%rowtype;
begin
  select * into actual from cliente where id = p_cliente_id for update;
  if not found or actual.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'cliente_no_encontrado');
  end if;
  if not puedo_cargar() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if actual.avisos_baja_en is null then
    return jsonb_build_object('ok', true, 'cliente', to_jsonb(actual), 'evento', null);
  end if;

  update cliente set avisos_baja_en = null where id = actual.id returning * into vuelto;
  insert into cliente_evento (negocio_id, cliente_id, tipo, titulo, detalle, autor, usuario_id)
  values (
    actual.negocio_id, actual.id, 'avisos', 'Vuelve a recibir avisos',
    'Había pedido no recibir avisos el '
      || to_char(actual.avisos_baja_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY "a las" HH24:MI') || '.',
    coalesce(nullif(trim(p_autor), ''), 'Alguien del negocio'), auth.uid()
  )
  returning * into nuevo;

  return jsonb_build_object('ok', true, 'cliente', to_jsonb(vuelto), 'evento', to_jsonb(nuevo));
end;
$$;

revoke all on function revertir_baja_de_avisos(uuid, text) from public;
revoke all on function revertir_baja_de_avisos(uuid, text) from anon;
grant execute on function revertir_baja_de_avisos(uuid, text) to authenticated;
