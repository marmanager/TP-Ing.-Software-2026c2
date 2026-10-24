-- ============================================================
-- 067_turno_empieza_en.sql — la hora del turno de la que habla cada aviso (R-4a-2)
--
-- Correr entero en el SQL Editor de Supabase, después de la 066.
-- Es idempotente.
--
-- YA ESTÁ CORRIDA en el proyecto: se agregó a mano antes de la 057 (el
-- aviso del presupuesto) y no tenía archivo. Queda acá para que una base
-- nueva salga igual. Correrla otra vez no cambia nada.
--
-- Cada recordatorio de turno guarda la hora del turno de la que avisa, al
-- programarlo y al correrlo. Si ya salió y el turno se movió después, la
-- agenda dice "se le avisó con la hora anterior". Los avisos de antes de
-- la columna no la tienen y no se marcan.
-- ============================================================

alter table seguimiento_whatsapp add column if not exists turno_empieza_en timestamptz;

comment on column seguimiento_whatsapp.turno_empieza_en is
  'R-4a-2: la hora del turno de la que habla el aviso. Si salió y el turno se movió después, la agenda dice que se avisó con la hora anterior.';
