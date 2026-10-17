-- ============================================================
-- 052_landing.sql — la personalización de la landing de cada negocio
--
-- Correr entero en el SQL Editor de Supabase, después de la 051. Es
-- idempotente. Diseño: docs/landing-por-negocio.md (pasos 1 y 2).
--
-- QUÉ AGREGA:
--   negocio.landing   el orden de las secciones, los colores y la fuente que
--                     eligió el dueño. null = la de fábrica.
--
-- El link público, la página y el ingreso de los clientes vienen en la 053.
--
-- Se valida en la API (PUT /v1/negocio/landing) y no acá, como el Inicio
-- (006): un valor viejo o mal formado no tiene que romper nada, tiene que
-- caer en la de fábrica. Eso lo hace normalizarLanding() en
-- src/lib/landing.js. Acá sólo se asegura que sea un objeto, como los
-- estados (046).
-- ============================================================

alter table negocio
  add column if not exists landing jsonb;

-- Aparte de la columna: "add column if not exists" no vuelve a poner la
-- regla si la columna ya estaba (033).
alter table negocio drop constraint if exists negocio_landing_es_objeto;
alter table negocio add constraint negocio_landing_es_objeto
  check (landing is null or jsonb_typeof(landing) = 'object');

comment on column negocio.landing is
  'La landing del negocio: {orden, colores: {fondo, cajas, botones, acento: {color, texto}}, fuente}. '
  'null = nunca se tocó, vale la de fábrica.';
