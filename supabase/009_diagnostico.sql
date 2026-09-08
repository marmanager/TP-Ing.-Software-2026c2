-- ============================================================
-- 009_diagnostico.sql — el identificador del rubro y el diagnóstico
-- (SCRUM-50 y SCRUM-51)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..008.
-- Es idempotente.
--
-- Dos cosas que al caso le faltaban:
--
--   identificador  Cómo reconoce el negocio a la cosa que entró. Es lo
--                  vertical de cada rubro: la patente en un taller, el
--                  número de ficha en un consultorio, el número de serie
--                  en un service. La columna es una sola; cómo se llama lo
--                  dice el preset, igual que los estados.
--
--   diagnostico    Qué se encontró al revisar. Es distinto de "servicio",
--                  que es lo que pidió el cliente: uno trae "hace un ruido
--                  raro" y el otro dice "la correa está flojo".
--
-- Las notas sueltas NO van acá: esas son el historial (tabla evento), que
-- no se pisa ni se reescribe.
-- ============================================================

alter table caso add column if not exists identificador text;
alter table caso add column if not exists diagnostico   text;

-- Se busca por identificador, así que conviene tenerlo indexado por negocio.
create index if not exists caso_identificador_idx on caso (negocio_id, identificador);
