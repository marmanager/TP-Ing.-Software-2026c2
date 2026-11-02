-- ============================================================
-- 083_canal_del_cliente.sql — por dónde le escribimos a cada cliente, y la
-- baja por link (docs/avisos-por-mail-plan.md, API-2)
--
-- Correr entero en el SQL Editor de Supabase, después de la 082. Es
-- idempotente.
--
-- El canal es del cliente, no del aviso: todos sus avisos automáticos salen
-- por WhatsApp o todos por mail, nunca por los dos. Y la baja es una sola,
-- para los dos canales: «no recibe avisos automáticos». Un comprobante o una
-- factura le siguen llegando, porque eso no lo decide la baja.
--
-- QUÉ CAMBIA:
--   cliente.canal              'whatsapp' o 'email'. Si no se dice al crearlo:
--       WhatsApp si tiene teléfono; mail si no tiene teléfono y tiene mail.
--       Los que ya existen se completan con la misma regla.
--   cliente.avisos_baja_via    por dónde pidió la baja: 'whatsapp' (contestó
--       BAJA) o 'mail' (el link del mail). La escriben sólo la API y las
--       funciones de acá, como avisos_baja_en; revertir la borra.
--   baja_por_link              un link por mail mandado. Se guarda la huella
--       (sha256) del token, nunca el token. Sin políticas: sólo la clave de
--       servicio. No va en las copias.
--   crear_link_de_baja()       guarda la huella de un aviso que va a salir.
--   ver_baja_por_link()        lo que muestra la página: el nombre y el rubro
--       del negocio, y si ya está de baja. Nada del caso ni del cliente.
--   usar_baja_por_link()       da de baja (vía 'mail'), lo anota en la ficha
--       y cancela los avisos pendientes. El link no vuelve a hacer nada.
--   cambiar_estado_con_notificacion, entregar_caso_con_seguimiento
--       aceptan también un destino por mail ({ canal: 'email', email }). Sin
--       canal, como hasta ahora: por WhatsApp.
--   version_del_esquema()      083: cliente, que va en las copias, tiene
--       columnas nuevas.
--
-- QUÉ NO CAMBIA TODAVÍA: negocio_seguimiento.canal (074) queda, sin uso,
-- hasta que la API que lo lee deje de estar desplegada. Se borra en otra
-- migración.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El canal del cliente
-- ------------------------------------------------------------
alter table cliente add column if not exists canal text;

update cliente set canal = case
    when coalesce(btrim(telefono), '') = '' and coalesce(btrim(email), '') <> '' then 'email'
    else 'whatsapp'
  end
  where canal is null;

alter table cliente drop constraint if exists cliente_canal_check;
alter table cliente add constraint cliente_canal_check check (canal in ('whatsapp', 'email'));

-- Antes del not null: el trigger lo completa al insertar.
create or replace function cliente_canal_al_crear() returns trigger
  language plpgsql set search_path to 'public' as $$
begin
  if new.canal is null then
    new.canal := case
      when coalesce(btrim(new.telefono), '') = '' and coalesce(btrim(new.email), '') <> '' then 'email'
      else 'whatsapp'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists cliente_canal_al_crear on cliente;
create trigger cliente_canal_al_crear before insert on cliente
  for each row execute function cliente_canal_al_crear();

alter table cliente alter column canal set not null;

comment on column cliente.canal is
  'Por dónde le llegan los avisos automáticos: whatsapp o email, uno solo (083). Lo cambia el negocio desde la ficha.';

-- ------------------------------------------------------------
-- 2. Por dónde pidió la baja
-- ------------------------------------------------------------
alter table cliente add column if not exists avisos_baja_via text;

alter table cliente drop constraint if exists cliente_avisos_baja_via_check;
alter table cliente add constraint cliente_avisos_baja_via_check check (
  avisos_baja_via is null or (avisos_baja_via in ('whatsapp', 'mail') and avisos_baja_en is not null)
);

-- Las bajas de antes de la 083 fueron todas por WhatsApp (no había otra vía).
update cliente set avisos_baja_via = 'whatsapp'
  where avisos_baja_en is not null and avisos_baja_via is null;

comment on column cliente.avisos_baja_via is
  'Por dónde pidió no recibir avisos automáticos: whatsapp (contestó BAJA) o mail (el link). null si no lo pidió (083).';

-- Igual que la de la base, y también cuida la vía.
create or replace function cliente_avisos_baja_por_su_camino() returns trigger
  language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('authenticated', 'anon') and (
    (tg_op = 'INSERT' and (new.avisos_baja_en is not null or new.avisos_baja_via is not null)) or
    (tg_op = 'UPDATE' and (new.avisos_baja_en is distinct from old.avisos_baja_en
                           or new.avisos_baja_via is distinct from old.avisos_baja_via))
  ) then
    raise exception 'La baja de avisos la pide el cliente y se revierte desde su ficha.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists cliente_avisos_baja_por_su_camino on cliente;
create trigger cliente_avisos_baja_por_su_camino before insert or update of avisos_baja_en, avisos_baja_via on cliente
  for each row execute function cliente_avisos_baja_por_su_camino();

-- Igual que la de la base, y borra la vía.
create or replace function revertir_baja_de_avisos(p_cliente_id uuid, p_autor text default 'Alguien del negocio') returns jsonb
  language plpgsql security definer set search_path to 'public' as $$
declare
  actual cliente%rowtype;
  vuelto cliente%rowtype;
  nuevo  cliente_evento%rowtype;
begin
  select * into actual from cliente where id = p_cliente_id for update;
  if not found or actual.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'cliente_no_encontrado');
  end if;
  if not puede_aca('editar_clientes') then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if actual.avisos_baja_en is null then
    return jsonb_build_object('ok', true, 'cliente', to_jsonb(actual), 'evento', null);
  end if;

  update cliente set avisos_baja_en = null, avisos_baja_via = null where id = actual.id returning * into vuelto;
  insert into cliente_evento (negocio_id, cliente_id, tipo, titulo, detalle, autor, usuario_id)
  values (
    actual.negocio_id, actual.id, 'avisos', 'Vuelve a recibir avisos',
    'Había pedido no recibir avisos el '
      || to_char(actual.avisos_baja_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY "a las" HH24:MI')
      || case actual.avisos_baja_via when 'mail' then ', desde el mail.' when 'whatsapp' then ', por WhatsApp.' else '.' end,
    coalesce(nullif(trim(p_autor), ''), 'Alguien del negocio'), auth.uid()
  )
  returning * into nuevo;

  return jsonb_build_object('ok', true, 'cliente', to_jsonb(vuelto), 'evento', to_jsonb(nuevo));
end;
$$;

-- ------------------------------------------------------------
-- 3. La baja por link
-- ------------------------------------------------------------
-- Un link por mail mandado: el token (32 bytes al azar) lo genera la API y
-- va en el mail; acá queda sólo su huella. Usar cualquiera de los links de
-- un cliente lo da de baja; después, ese link sólo confirma que ya está.
create table if not exists baja_por_link (
  huella       text primary key check (huella ~ '^[0-9a-f]{64}$'),
  cliente_id   uuid not null references cliente(id) on delete cascade,
  negocio_id   uuid not null references negocio(id) on delete cascade,
  creado_en    timestamptz not null default now(),
  usado_en     timestamptz
);
create index if not exists baja_por_link_cliente on baja_por_link (cliente_id);
alter table baja_por_link enable row level security;  -- sin políticas: nadie la lee ni escribe directo
revoke all on baja_por_link from anon, authenticated;

comment on table baja_por_link is
  'Los links de baja de los mails (083). Sólo la huella del token. Lo escriben crear_link_de_baja() y usar_baja_por_link().';

-- El cliente de un aviso de la cola: el suyo, el de su caso o el de su turno.
create or replace function cliente_del_aviso(p_seguimiento uuid) returns uuid
  language sql stable security definer set search_path to 'public' as $$
  select coalesce(s.cliente_id, c.cliente_id, t.cliente_id)
  from seguimiento_whatsapp s
  left join caso c on c.id = s.caso_id and c.negocio_id = s.negocio_id
  left join turno t on t.id = s.turno_id and t.negocio_id = s.negocio_id
  where s.id = p_seguimiento;
$$;

-- La llama el procesador (clave de servicio) antes de mandar un mail.
create or replace function crear_link_de_baja(p_seguimiento uuid, p_huella text) returns boolean
  language plpgsql security definer set search_path to 'public' as $$
declare
  v_cliente cliente%rowtype;
begin
  select * into v_cliente from cliente where id = cliente_del_aviso(p_seguimiento);
  if not found then return false; end if;
  insert into baja_por_link (huella, cliente_id, negocio_id)
    values (p_huella, v_cliente.id, v_cliente.negocio_id)
    on conflict (huella) do nothing;
  return true;
end;
$$;

-- Lo que necesita la página de baja. Con un link que no existe, lo mismo
-- que con uno que existe pero no se puede leer: sirve = false.
create or replace function ver_baja_por_link(p_huella text) returns jsonb
  language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_link baja_por_link%rowtype;
  v_negocio negocio%rowtype;
  v_de_baja boolean;
begin
  select * into v_link from baja_por_link where huella = p_huella;
  if not found then return jsonb_build_object('sirve', false); end if;
  select * into v_negocio from negocio where id = v_link.negocio_id;
  select avisos_baja_en is not null into v_de_baja from cliente where id = v_link.cliente_id;
  return jsonb_build_object(
    'sirve', true,
    'de_baja', coalesce(v_de_baja, false),
    'negocio', jsonb_build_object('nombre', v_negocio.nombre, 'rubro', v_negocio.rubro)
  );
end;
$$;

-- El clic. Si ya estaba de baja (por cualquier vía) no cambia la fecha ni la
-- vía. Si el link ya se usó, no hace nada: no vuelve a dar de baja a quien
-- el negocio le revirtió la baja.
create or replace function usar_baja_por_link(p_huella text) returns jsonb
  language plpgsql security definer set search_path to 'public' as $$
declare
  v_link baja_por_link%rowtype;
  v_cliente cliente%rowtype;
  v_ahora timestamptz := clock_timestamp();
  v_cancelados int := 0;
begin
  select * into v_link from baja_por_link where huella = p_huella for update;
  if not found then return jsonb_build_object('sirve', false); end if;
  if v_link.usado_en is not null then
    return ver_baja_por_link(p_huella) || jsonb_build_object('recien', false);
  end if;

  update baja_por_link set usado_en = v_ahora where cliente_id = v_link.cliente_id and usado_en is null;

  select * into v_cliente from cliente where id = v_link.cliente_id for update;
  if v_cliente.avisos_baja_en is null then
    update cliente set avisos_baja_en = v_ahora, avisos_baja_via = 'mail' where id = v_cliente.id;
    insert into cliente_evento (negocio_id, cliente_id, tipo, titulo, detalle, autor)
    values (v_cliente.negocio_id, v_cliente.id, 'avisos', 'Pidió no recibir avisos',
      'Usó el link de baja de un mail.', 'El cliente');
    update seguimiento_whatsapp s set estado = 'cancelado', procesado_en = v_ahora, motivo = 'baja_de_avisos'
      where s.negocio_id = v_cliente.negocio_id and s.estado = 'pendiente'
        and s.tipo in ('cierre', 'estado', 'turno', 'volver', 'presupuesto')
        and cliente_del_aviso(s.id) = v_cliente.id;
    get diagnostics v_cancelados = row_count;
  end if;

  return ver_baja_por_link(p_huella) || jsonb_build_object('recien', true, 'cancelados', v_cancelados);
end;
$$;

revoke all on function cliente_del_aviso(uuid) from public, anon, authenticated;
revoke all on function crear_link_de_baja(uuid, text) from public, anon, authenticated;
revoke all on function ver_baja_por_link(text) from public, anon, authenticated;
revoke all on function usar_baja_por_link(text) from public, anon, authenticated;
grant execute on function cliente_del_aviso(uuid) to service_role;
grant execute on function crear_link_de_baja(uuid, text) to service_role;
grant execute on function ver_baja_por_link(text) to service_role;
grant execute on function usar_baja_por_link(text) to service_role;

-- ------------------------------------------------------------
-- 4. El avance y el posventa, también por mail
-- ------------------------------------------------------------
-- Igual que la de la base, con el destino por mail: p_notificacion trae
-- { canal: 'email', email } en vez del teléfono. Tiene que ser el mail del
-- cliente, como el teléfono tenía que ser el suyo.
create or replace function cambiar_estado_con_notificacion(
  p_caso_id uuid, p_actualizado_en timestamptz, p_estado text, p_que_falta text, p_evento jsonb, p_notificacion jsonb
) returns jsonb
  language plpgsql set search_path to 'public' as $_$
declare
  v_caso public.caso%rowtype;
  v_evento public.evento%rowtype;
  v_notificacion public.seguimiento_whatsapp%rowtype;
  v_por_mail boolean := coalesce(p_notificacion->>'canal', 'whatsapp') = 'email';
  v_telefono text;
  v_email text;
  v_ahora timestamptz;
begin
  if not public.puede_aca('avanzar_casos') then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_estado is null or p_estado not in ('nuevo', 'en_proceso', 'esperando', 'revision_final') then
    return jsonb_build_object('ok', false, 'motivo', 'estado_invalido');
  end if;

  select * into v_caso from public.caso
    where id = p_caso_id and negocio_id = public.mi_negocio() for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'caso_no_encontrado');
  end if;
  if v_caso.estado = 'completado' then
    return jsonb_build_object('ok', false, 'motivo', 'caso_cerrado');
  end if;
  if v_caso.actualizado_en is distinct from p_actualizado_en then
    return jsonb_build_object('ok', false, 'motivo', 'choque');
  end if;
  if v_caso.estado = p_estado then
    return jsonb_build_object('ok', true, 'caso', to_jsonb(v_caso), 'evento', null, 'notificacion', null);
  end if;

  if v_por_mail then
    select btrim(email) into v_email from public.cliente
      where id = v_caso.cliente_id and negocio_id = v_caso.negocio_id;
    if v_email is null or v_email !~ '^[^[:space:]<>,;"]+@[^[:space:]<>,;"]+$'
      or v_email is distinct from (p_notificacion->>'email') then
      return jsonb_build_object('ok', false, 'motivo', 'email_invalido');
    end if;
  else
    select regexp_replace(coalesce(telefono, ''), '[[:space:]()+.\-]', '', 'g')
      into v_telefono from public.cliente
      where id = v_caso.cliente_id and negocio_id = v_caso.negocio_id;
    if v_telefono is null or v_telefono !~ '^[1-9][0-9]{7,14}$'
      or v_telefono is distinct from (p_notificacion->>'telefono') then
      return jsonb_build_object('ok', false, 'motivo', 'telefono_invalido');
    end if;
  end if;
  if jsonb_typeof(p_notificacion) is distinct from 'object'
    or coalesce(length(btrim(p_notificacion->>'numero_emisor_id')), 0) = 0
    or coalesce(length(p_notificacion->>'mensaje'), 0) not between 1 and 4096
    or jsonb_typeof(p_evento) is distinct from 'object'
    or coalesce(length(btrim(p_evento->>'titulo')), 0) = 0
    or coalesce(length(btrim(p_evento->>'autor')), 0) = 0
    or p_que_falta is null then
    return jsonb_build_object('ok', false, 'motivo', 'notificacion_invalida');
  end if;

  v_ahora := clock_timestamp();
  update public.caso set estado = p_estado, que_falta = p_que_falta
    where id = v_caso.id and negocio_id = v_caso.negocio_id
    returning * into v_caso;
  insert into public.evento(caso_id, tipo, estado, titulo, detalle, icono, autor, ocurrido_en)
    values (v_caso.id, 'estado', p_estado, p_evento->>'titulo',
      p_evento->>'detalle', p_evento->>'icono', p_evento->>'autor', v_ahora)
    returning * into v_evento;
  insert into public.seguimiento_whatsapp(
    caso_id, negocio_id, cerrado_en, enviar_en, canal, telefono, email, mensaje, numero_emisor_id, tipo
  ) values (
    v_caso.id, v_caso.negocio_id, v_ahora, v_ahora,
    case when v_por_mail then 'email' else 'whatsapp' end, v_telefono, v_email,
    p_notificacion->>'mensaje', p_notificacion->>'numero_emisor_id', 'estado'
  ) returning * into v_notificacion;

  return jsonb_build_object('ok', true, 'caso', to_jsonb(v_caso),
    'evento', to_jsonb(v_evento), 'notificacion', to_jsonb(v_notificacion));
end;
$_$;

-- Igual que la de la base, con el canal y el mail del seguimiento.
create or replace function entregar_caso_con_seguimiento(
  p_caso_id uuid, p_monto numeric, p_medio text, p_nota text, p_descuento numeric, p_detalle text, p_autor text,
  p_ocurrido_en timestamptz, p_seguimiento jsonb, p_volver_en date default null, p_toca_volver_en boolean default false
) returns jsonb
  language plpgsql set search_path to 'public' as $$
declare
  resultado jsonb;
  pendiente public.seguimiento_whatsapp%rowtype;
  v_por_mail boolean := coalesce(p_seguimiento->>'canal', 'whatsapp') = 'email';
begin
  resultado := public.entregar_caso(
    p_caso_id => p_caso_id, p_monto => p_monto, p_medio => p_medio, p_nota => p_nota,
    p_descuento => p_descuento, p_detalle => p_detalle, p_autor => p_autor, p_ocurrido_en => p_ocurrido_en,
    p_volver_en => p_volver_en, p_toca_volver_en => p_toca_volver_en
  );
  if not coalesce((resultado->>'ok')::boolean, false) then return resultado; end if;

  insert into public.seguimiento_whatsapp (
    caso_id, negocio_id, cerrado_en, enviar_en, canal, telefono, email, mensaje, numero_emisor_id
  ) values (
    p_caso_id, (resultado->'caso'->>'negocio_id')::uuid, p_ocurrido_en,
    (p_seguimiento->>'enviar_en')::timestamptz,
    case when v_por_mail then 'email' else 'whatsapp' end,
    case when v_por_mail then null else p_seguimiento->>'telefono' end,
    case when v_por_mail then p_seguimiento->>'email' end,
    p_seguimiento->>'mensaje', p_seguimiento->>'numero_emisor_id'
  ) returning * into pendiente;

  return resultado || jsonb_build_object('seguimiento', to_jsonb(pendiente));
end;
$$;

create or replace function version_del_esquema() returns text
  language sql immutable set search_path to 'public' as $$ select '083'::text; $$;
