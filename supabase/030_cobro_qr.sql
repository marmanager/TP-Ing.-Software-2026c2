-- El QR del pedido de Mercado Pago contiene el link de Checkout Pro.
alter table public.cobro add column if not exists qr_imagen text;
alter table public.cobro add column if not exists proveedor_pago_id text;

-- Los tokens de Mercado Pago y los estados OAuth sólo los lee la API con
-- la clave secreta de Supabase; nunca deben quedar expuestos al navegador.
do $$
begin
  if to_regclass('public."negocio_conexionMP"') is not null then
    alter table public."negocio_conexionMP" enable row level security;
    revoke all on public."negocio_conexionMP" from anon, authenticated;
  end if;
  if to_regclass('public."MP_oauth_state"') is not null then
    alter table public."MP_oauth_state" enable row level security;
    revoke all on public."MP_oauth_state" from anon, authenticated;
  end if;
end;
$$;
