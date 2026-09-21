-- ============================================================
-- 010_turno_sin_duracion.sql — sacar la duración del turno
--
-- Correr en el SQL Editor de Supabase, después de 001..009.
-- Es idempotente.
--
-- POR QUÉ SE VA:
-- Cuánto va a durar un turno no se sabe de antemano. En un taller no se
-- puede medir hasta que el auto está arriba, y en una consulta depende de
-- lo que aparezca. Pedirlo obligaba a inventar un número que después no
-- servía para nada: ni para ordenar la agenda ni para avisarle a nadie.
--
-- La agenda muestra a qué hora empieza cada turno, que es lo que se usa.
-- ============================================================

alter table turno drop column if exists minutos;
