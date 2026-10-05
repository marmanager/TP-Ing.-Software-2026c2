-- ============================================================
-- 046_presentacion_estados.sql — nombres e íconos de los estados
--
-- Correr entero en el SQL Editor de Supabase, después de 045.
-- Es idempotente y conserva todos los negocios existentes.
--
-- Las claves funcionales del flujo siguen siendo nuevo, en_proceso,
-- esperando, revision_final y completado. Acá sólo se guarda cómo las
-- presenta cada negocio.
-- ============================================================

alter table negocio
  add column if not exists estados jsonb not null default '{}'::jsonb;

alter table negocio drop constraint if exists negocio_estados_objeto;
alter table negocio
  add constraint negocio_estados_objeto
  check (jsonb_typeof(estados) = 'object');

-- CÓMO VERIFICARLO (sólo lee):
--
--   select id, nombre, estados from negocio limit 5;
