-- ============================================================
-- 012_cobro.sql — registrar el cobro al entregar (SCRUM-74)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..011.
-- Es idempotente.
--
-- POR QUÉ:
-- El sistema sabía cuánto se presupuestó y cuánto aprobó el cliente, pero no
-- cuánto entró. Al entregar el trabajo es el momento en que el negocio tiene
-- el número delante, y es el único momento en que alguien se va a acordar de
-- anotarlo.
--
-- La columna es nullable a propósito, y la diferencia importa:
--
--   NULL → nadie registró un cobro. Se cobró por afuera del sistema, o
--          todavía no se cobró. El sistema no inventa que entró plata.
--   0    → se entregó y no se cobró nada: una garantía, una cortesía, una
--          obra social que paga por otro lado.
--
-- Guardar las dos como 0 borraría esa diferencia, y es la clase de dato que
-- después nadie puede reconstruir.
--
-- No hay tabla de cobros ni pagos parciales: un caso tiene un cobro. Si algún
-- día se necesitan señas o cuotas, eso es una tabla `cobro` con su fecha y su
-- medio, no más columnas acá.
-- ============================================================

alter table caso add column if not exists cobrado    numeric(12, 2);
alter table caso add column if not exists cobrado_en timestamptz;

-- El check va aparte de la columna: `add column if not exists` no lo vuelve a
-- poner si la columna ya estaba, así que en una base que corrió una versión
-- anterior quedaría sin la restricción.
alter table caso drop constraint if exists caso_cobrado_no_negativo;
alter table caso add  constraint caso_cobrado_no_negativo
  check (cobrado is null or cobrado >= 0);

-- Las políticas de RLS de `caso` (005_rls.sql) son por fila y no nombran
-- columnas, así que estas dos quedan cubiertas solas: no hay nada que tocar
-- ahí. Se deja dicho para que nadie salga a buscarlo.
