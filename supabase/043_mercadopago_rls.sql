-- 043_mercadopago_rls.sql
-- Operaciones mínimas sobre las credenciales de Mercado Pago para pedidos
-- autenticados. Las funciones sólo devuelven estado, nunca tokens.

create or replace function mercadopago_estado()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not puedo_cargar() then raise exception 'Sin permiso.'; end if;
  return exists (select 1 from "negocio_conexionMP" where negocio_id = mi_negocio());
end; $$;

create or replace function mercadopago_crear_estado(p_state text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puedo_cargar() then raise exception 'Sin permiso.'; end if;
  delete from "MP_oauth_state" where negocio_id = mi_negocio() or created_at < now() - interval '10 minutes';
  insert into "MP_oauth_state" (state, negocio_id) values (p_state, mi_negocio());
end; $$;

create or replace function mercadopago_desvincular()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puedo_cargar() then raise exception 'Sin permiso.'; end if;
  delete from "negocio_conexionMP" where negocio_id = mi_negocio();
end; $$;

revoke all on function mercadopago_estado() from public, anon;
revoke all on function mercadopago_crear_estado(text) from public, anon;
revoke all on function mercadopago_desvincular() from public, anon;
grant execute on function mercadopago_estado() to authenticated;
grant execute on function mercadopago_crear_estado(text) to authenticated;
grant execute on function mercadopago_desvincular() to authenticated;
