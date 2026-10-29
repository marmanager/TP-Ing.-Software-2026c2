-- Un control más para entrar a la landing: un código de 6 números que el
-- cliente recibe por mensaje (WhatsApp) o por mail.
--
--   · Por mensaje: escribe su teléfono entero. Si es el del cliente, el código
--     le llega a ese número y eso ya prueba que es él: no hacen falta los
--     últimos 4.
--   · Por mail: el negocio no guarda mails de clientes, así que el cliente
--     escribe el suyo y además los últimos 4 del teléfono. El mail sólo es a
--     dónde llega el código; quién es lo siguen diciendo la patente y los 4.
--
-- El código lo genera y lo manda la API; acá queda sólo su huella. Las dos
-- funciones nuevas (y ingresar_landing, que ya no sirve sola) las llama
-- únicamente la API con la clave de servicio: con el cliente anónimo cualquiera
-- podría elegir su propio código y saltearse el control.

create table if not exists landing_codigo (
  id            uuid        primary key default gen_random_uuid(),
  negocio_id    uuid        not null references negocio (id) on delete cascade,
  identificador text        not null,
  ultimos4      text        not null,
  huella        text        not null,
  intentos      int         not null default 0,
  vence_en      timestamptz not null,
  creado_en     timestamptz not null default now()
);

create index if not exists landing_codigo_idx
  on landing_codigo (negocio_id, identificador, creado_en);

alter table landing_codigo enable row level security;
revoke all on landing_codigo from anon;
revoke all on landing_codigo from authenticated;

-- Pide un código. Verifica los datos igual que ingresar_landing (mismo
-- bloqueo, mismos fallidos) y, si coinciden, guarda la huella del código que
-- mandó la API. No más de 3 códigos por identificador cada 15 minutos: sin
-- tope, alguien podría llenarle el WhatsApp a un cliente.
create or replace function pedir_codigo_landing(
  p_codigo text, p_identificador text, p_ultimos4 text, p_telefono text, p_huella text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n     negocio%rowtype;
  ident text;
  tel   text := regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
  u4    text;
  bien  boolean;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'landing_no_encontrada');
  end if;

  ident := normalizar_identificador(p_identificador);
  u4 := case when tel <> '' then right(tel, 4)
             else regexp_replace(coalesce(p_ultimos4, ''), '[^0-9]', '', 'g') end;

  delete from landing_codigo where creado_en < now() - interval '1 day';

  if ident = '' or length(ident) > 40 then
    return jsonb_build_object('ok', false, 'motivo', 'datos_incorrectos');
  end if;

  if landing_bloqueada(n.id, ident) then
    return jsonb_build_object('ok', false, 'motivo', 'muchos_intentos');
  end if;

  if tel <> '' then
    -- El número entero: se comparan los últimos 10 dígitos, que es lo que no
    -- cambia entre "341 456 7890", "+54 9 341 456 7890" y "0341-4567890".
    bien := length(tel) >= 10 and exists (
      select 1 from cliente cl
       where cl.id in (select clientes_de_la_landing(n.id, ident, u4))
         and right(regexp_replace(coalesce(cl.telefono, ''), '[^0-9]', '', 'g'), 10) = right(tel, 10));
  else
    bien := length(u4) = 4 and exists (select 1 from clientes_de_la_landing(n.id, ident, u4));
  end if;

  if not bien then
    insert into landing_intento (negocio_id, identificador) values (n.id, ident);
    return jsonb_build_object('ok', false, 'motivo', 'datos_incorrectos');
  end if;

  if (select count(*) from landing_codigo
       where negocio_id = n.id and identificador = ident
         and creado_en > now() - interval '15 minutes') >= 3 then
    return jsonb_build_object('ok', false, 'motivo', 'muchos_intentos');
  end if;

  insert into landing_codigo (negocio_id, identificador, ultimos4, huella, vence_en)
  values (n.id, ident, u4, p_huella, now() + interval '10 minutes');

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function pedir_codigo_landing(text, text, text, text, text) from public, anon, authenticated;
grant execute on function pedir_codigo_landing(text, text, text, text, text) to service_role;

-- Entra con el último código pedido. 5 errores y ese código muere; cada error
-- cuenta también para el bloqueo por identificador.
create or replace function ingresar_landing_con_codigo(p_codigo text, p_identificador text, p_huella text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n     negocio%rowtype;
  ident text;
  fila  landing_codigo%rowtype;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'landing_no_encontrada');
  end if;

  ident := normalizar_identificador(p_identificador);
  if ident = '' or length(ident) > 40 then
    return jsonb_build_object('ok', false, 'motivo', 'datos_incorrectos');
  end if;

  delete from landing_intento where creado_en < now() - interval '1 day';
  delete from landing_sesion  where vence_en <= now();

  if landing_bloqueada(n.id, ident) then
    return jsonb_build_object('ok', false, 'motivo', 'muchos_intentos');
  end if;

  select * into fila from landing_codigo
   where negocio_id = n.id and identificador = ident and vence_en > now() and intentos < 5
   order by creado_en desc
   limit 1
   for update;

  if fila.id is null or fila.huella <> p_huella then
    if fila.id is not null then
      update landing_codigo set intentos = intentos + 1 where id = fila.id;
    end if;
    insert into landing_intento (negocio_id, identificador) values (n.id, ident);
    return jsonb_build_object('ok', false, 'motivo', 'codigo_incorrecto');
  end if;

  delete from landing_codigo where id = fila.id;
  return jsonb_build_object('ok', true) || abrir_sesion_landing(n.id, ident, fila.ultimos4);
end;
$$;

revoke all on function ingresar_landing_con_codigo(text, text, text) from public, anon, authenticated;
grant execute on function ingresar_landing_con_codigo(text, text, text) to service_role;

-- Entrar sólo con la patente y los 4 números ya no alcanza.
revoke execute on function ingresar_landing(text, text, text) from public, anon, authenticated;
grant execute on function ingresar_landing(text, text, text) to service_role;
