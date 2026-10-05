-- ============================================================
-- 045_tengo_contrasena.sql — si la cuenta tiene contraseña
--
-- Correr entero en el SQL Editor de Supabase, después de 001..044.
-- Es idempotente.
--
-- Mi perfil ofrece CREAR la contraseña a quien entra sólo con Google, y
-- CAMBIARLA (con la anterior o por mail) a quien ya tiene una. Para elegir
-- hace falta saber si la cuenta tiene contraseña, y los proveedores de la
-- cuenta no alcanzan: una cuenta de Google que crea su contraseña puede
-- seguir figurando sólo con "google".
--
-- La API también lo usa para la seguridad: crear la primera no pide la
-- anterior (no hay), pero cambiar una que existe sí. Si la API no pudiera
-- saberlo, alguien podría "crear" encima de una contraseña existente sin la
-- anterior.
--
-- Responde sí o no y nada más: la contraseña (guardada como huella) no sale
-- de auth.users. Sólo de la cuenta de quien llama.
-- ============================================================

create or replace function tengo_contrasena()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.encrypted_password, '') <> ''
    from auth.users u
   where u.id = auth.uid();
$$;

revoke all on function tengo_contrasena() from public;
revoke all on function tengo_contrasena() from anon;
grant execute on function tengo_contrasena() to authenticated;

-- CÓMO VERIFICARLO (sólo lee): en el SQL Editor no hay sesión, así que
-- devuelve null. Lo que sirve es mirar la definición:
--
--   select pg_get_functiondef('tengo_contrasena'::regproc);
