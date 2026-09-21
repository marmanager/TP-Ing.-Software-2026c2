-- ============================================================
-- 003_usuario.sql — cuentas y su negocio (SCRUM-5)
--
-- Correr entero en el SQL Editor de Supabase, después del 001.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- NO ES OPCIONAL: el 001 no crea esta tabla. Sin ella no hay forma de saber
-- de qué negocio es una cuenta, y todo el aislamiento del 005 cuelga de acá:
-- mi_negocio() lee justamente esta tabla.
--
-- La protege el 005, que le prende Row Level Security: cada cuenta ve su
-- propia fila y ninguna otra.
-- ============================================================

-- ---------- usuario ----------
-- Una fila por cuenta. El id es el mismo que el de auth.users de Supabase.
-- "negocio_id" queda en null entre "crear la cuenta" y "crear el negocio".
create table if not exists usuario (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  telefono    text,
  nombre      text,
  negocio_id  uuid references negocio (id) on delete set null,
  creado_en   timestamptz not null default now()
);

create index if not exists usuario_negocio_idx on usuario (negocio_id);
