-- ============================================================
-- 084_mail_del_negocio.sql — a dónde le contestan al negocio los avisos por mail
--
-- Correr entero en el SQL Editor de Supabase, después de la 083. Es
-- idempotente. Plan en docs/avisos-por-mail-plan.md.
--
-- Los avisos por mail salen desde el remitente de la app (MAIL_REMITENTE en
-- la API), que no es una casilla que alguien lea. Con el mail del negocio,
-- cada aviso lo lleva como «Responder a»: si el cliente contesta, le llega al
-- negocio. Sin él, la respuesta va al remitente, como hasta ahora.
--
-- Se escribe como el resto de la ficha del negocio (la política de siempre,
-- configurar_negocio). No se muestra en ningún lado público.
--
-- version_del_esquema() pasa a 084: negocio va en las copias.
-- ============================================================

alter table negocio add column if not exists email text;

alter table negocio drop constraint if exists negocio_email_check;
alter table negocio add constraint negocio_email_check
  check (email is null or (length(email) <= 254 and email ~ '^[^[:space:]<>,;"]+@[^[:space:]<>,;"]+\.[^[:space:]<>,;"]+$'));

comment on column negocio.email is
  'Mail del negocio (084). Va como «Responder a» en los avisos por mail: las respuestas de los clientes le llegan ahí.';

create or replace function version_del_esquema() returns text
  language sql immutable set search_path to 'public' as $$ select '084'::text; $$;
