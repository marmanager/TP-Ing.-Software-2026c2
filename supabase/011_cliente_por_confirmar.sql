-- ============================================================
-- 011_cliente_por_confirmar.sql — clientes que todavía no vinieron
--
-- Correr en el SQL Editor de Supabase, después de 001..010.
-- Es idempotente.
--
-- POR QUÉ:
-- Se puede pedir un turno por teléfono y no aparecer nunca. Si esa persona
-- entra derecho a la lista de clientes, la lista se llena de gente que el
-- negocio no conoce, y deja de servir para lo que sirve: encontrar a alguien
-- que ya vino.
--
-- Entonces el que se anota desde la agenda queda "por confirmar", y se
-- confirma solo cuando se le abre el primer caso. Abrir un caso es la prueba
-- de que la persona efectivamente vino.
--
-- Por defecto true: el que se carga a mano desde Clientes ya está confirmado,
-- porque alguien lo escribió a propósito.
-- ============================================================

alter table cliente add column if not exists confirmado boolean not null default true;

create index if not exists cliente_por_confirmar_idx
  on cliente (negocio_id) where not confirmado;
