-- Conexión personal: cada integrante del negocio autoriza su propia cuenta.
-- Sólo las rutas del servidor acceden a estas tablas con la clave de servicio.
create table if not exists google_calendar_conexion (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  negocio_id uuid not null references negocio(id) on delete cascade,
  refresh_token text not null,
  conectado_en timestamptz not null default now(),
  error text
);

create table if not exists google_calendar_evento (
  usuario_id uuid not null references google_calendar_conexion(usuario_id) on delete cascade,
  turno_id uuid not null references turno(id) on delete cascade,
  huella text not null,
  primary key (usuario_id, turno_id)
);

alter table google_calendar_conexion enable row level security;
alter table google_calendar_evento enable row level security;
revoke all on google_calendar_conexion, google_calendar_evento from anon, authenticated;
grant all on google_calendar_conexion, google_calendar_evento to service_role;
