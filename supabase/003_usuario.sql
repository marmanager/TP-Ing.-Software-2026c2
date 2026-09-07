-- ============================================================
-- 003_usuario.sql — cuentas y su negocio (SCRUM-5)
--
-- Correr entero en el SQL Editor de Supabase, después de 001 y 002.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- NOTA SOBRE SEGURIDAD (sigue siendo decisión consciente, no olvido):
-- la tabla queda SIN Row Level Security, igual que el resto. La clave
-- anónima puede leer y escribir. El aislamiento por negocio con políticas
-- RLS va en el Sprint 2; por ahora el negocio del usuario se resuelve del
-- lado del cliente con esta tabla.
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
