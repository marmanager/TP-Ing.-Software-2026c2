-- ============================================================
-- 044_rubro_personalizable.sql — el rubro "personalizable" (SCRUM-95)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..043.
-- Es idempotente.
--
-- Suma "personalizable" a los rubros que acepta un negocio. Es para el que no
-- es taller, consultorio ni service: arranca sin ningún módulo prendido y el
-- dueño elige los suyos desde Mi negocio → Módulos. Lo que cambia es sólo la
-- lista; las palabras del rubro viven en presets.js del front y en
-- compartido/presets.ts de la API.
--
-- Va antes que el código nuevo: sin esto, crear un negocio personalizable
-- choca con esta restricción.
-- ============================================================

alter table negocio drop constraint if exists negocio_rubro_check;
alter table negocio
  add constraint negocio_rubro_check
  check (rubro in ('taller', 'medicina', 'service', 'personalizable'));

-- CÓMO VERIFICARLO (sólo lee):
--
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'negocio_rubro_check';
--
-- Tiene que nombrar los cuatro rubros.
