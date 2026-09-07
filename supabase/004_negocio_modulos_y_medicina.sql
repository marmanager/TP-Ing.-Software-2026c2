-- ============================================================
-- 004_negocio_modulos_y_medicina.sql — preset medicina y módulos (SCRUM-12)
--
-- Para bases creadas con una versión anterior de 001. Correr en el SQL
-- Editor de Supabase. Es idempotente.
--
--   - Cambia la lista de rubros: sale 'veterinaria', entra 'medicina'.
--   - Suma negocio.modulos_activos: qué módulos vienen prendidos.
--
-- Si algún negocio quedó con rubro 'veterinaria', pasarlo antes a 'medicina'
-- o a 'service' a mano; si no, la restricción nueva no se va a poder crear.
-- ============================================================

alter table negocio drop constraint if exists negocio_rubro_check;
alter table negocio
  add constraint negocio_rubro_check check (rubro in ('taller', 'medicina', 'service'));

alter table negocio
  add column if not exists modulos_activos jsonb not null default '[]'::jsonb;
