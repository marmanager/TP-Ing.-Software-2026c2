-- ============================================================
-- 082_direccion_del_negocio.sql — la dirección del negocio y el «Cancelo» del turno
--
-- Correr entero en el SQL Editor de Supabase, después de la 081. Es
-- idempotente. Para API-4b (docs/plantillas-textos.md, sección 6).
--
-- El recordatorio de turno y el «listo para retirar» por WhatsApp dicen a
-- dónde ir («en {{direccion}}», «retirarlo por {{direccion}}»). Sin dirección
-- esos avisos no salen (motivo faltan_datos_del_negocio en la API), así que el
-- negocio la carga en Mi negocio. Se escribe como el resto de la ficha del
-- negocio (la política de siempre, configurar_negocio), tal cual la escribe el
-- negocio, en una línea.
--
-- También se ve en la landing: ver_landing() la devuelve con el teléfono.
--
-- Y el botón «Cancelo» del recordatorio: turno.respuesta_cliente admite
-- 'cancelo' (el cliente canceló el turno por WhatsApp), y la respuesta lo
-- anota en resolvio.
--
-- version_del_esquema() pasa a 082: negocio y turno van en las copias.
-- ============================================================

alter table negocio add column if not exists direccion text;

alter table negocio drop constraint if exists negocio_direccion_check;
alter table negocio add constraint negocio_direccion_check
  check (direccion is null or (length(trim(direccion)) between 1 and 200 and direccion !~ '[\r\n\t]'));

comment on column negocio.direccion is
  'Dirección del negocio, como la escribió (082). Va en el recordatorio de turno y en el aviso de listo para retirar, y en la landing.';

-- Igual que la de la base, con la dirección.
create or replace function ver_landing(p_codigo text) returns jsonb
  language plpgsql security definer set search_path to 'public' as $$
declare
  n negocio%rowtype;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('sirve', false);
  end if;

  return jsonb_build_object(
    'sirve', true,
    'negocio', jsonb_build_object(
      'nombre', n.nombre,
      'telefono', nullif(trim(coalesce(n.telefono, '')), ''),
      'direccion', nullif(trim(coalesce(n.direccion, '')), ''),
      'foto', n.foto,
      'descripcion', n.descripcion,
      'rubro', n.rubro,
      'estados', n.estados
    ),
    'landing', n.landing,
    'modulos_activos', n.modulos_activos,
    'horarios', n.horarios
  );
end;
$$;

-- ------------------------------------------------------------
-- El botón «Cancelo» del recordatorio (turno_*)
-- ------------------------------------------------------------
-- Con la plantilla, el recordatorio trae «Confirmar» y «Cancelo». «Cancelo»
-- cancela el turno de verdad (estado cancelado, el lugar queda libre) y lo
-- anota como del cliente: respuesta_cliente = 'cancelo', con la hora. La
-- agenda lo muestra como «Canceló por WhatsApp». Lo escribe sólo el webhook,
-- como las otras respuestas (el trigger de la 071 lo sigue cuidando).
alter table turno drop constraint if exists turno_respuesta_cliente;
alter table turno add constraint turno_respuesta_cliente check (
  (respuesta_cliente is null and respuesta_cliente_en is null)
  or (respuesta_cliente in ('confirmo', 'no_puede', 'cancelo') and respuesta_cliente_en is not null)
);

-- Y lo que resolvió sola esa respuesta (079), para la conversación.
alter table seguimiento_whatsapp_respuesta drop constraint if exists seguimiento_whatsapp_respuesta_resolvio_check;
alter table seguimiento_whatsapp_respuesta add constraint seguimiento_whatsapp_respuesta_resolvio_check
  check (resolvio is null or resolvio in ('confirmo', 'no_puede', 'cancelo', 'baja'));

create or replace function version_del_esquema() returns text
  language sql immutable set search_path to 'public' as $$ select '082'::text; $$;
