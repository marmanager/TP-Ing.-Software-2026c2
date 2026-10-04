-- ============================================================
-- 039_pedido_idempotente.sql — que un reintento no repita la operación
--
-- Correr entero en el SQL Editor de Supabase, después de 001..038.
-- Es idempotente. Después, correr supabase/pruebas/pedido_idempotente.sql.
--
-- La usa la API (TP-IngeSoft-API, src/http/middlewares/idempotencia.ts). El
-- front no la toca.
--
-- El problema: se corta internet justo al tocar "Guardar". El front no sabe si
-- llegó, y reintenta. Sin esto, el reintento suma el stock dos veces o pide
-- dos cobros. Con esto, el front manda en cada intento una cabecera
--   Idempotency-Key: <uuid que genera él, uno por intento>
-- y la API guarda acá la respuesta de la primera vez. Si la misma clave vuelve
-- a llegar, devuelve esa respuesta sin volver a hacer nada.
--
-- Cada fila es de una persona: la clave vale por cuenta y por ruta, así dos
-- personas (o dos rutas) no se pisan aunque usen la misma clave. La API la
-- escribe con el token de la persona, no con la service_role: por eso la RLS
-- de abajo, que deja a cada uno ver y tocar sólo las suyas.
--
-- Mientras la operación corre, la fila existe con estado_http nulo: si llega
-- el mismo pedido otra vez en ese momento, la API contesta "todavía se está
-- procesando" en vez de hacerlo dos veces. La clave primaria es lo que lo
-- garantiza aunque los dos lleguen al mismo tiempo.
--
-- Las filas viejas no sirven: la API borra las de más de 7 días de la persona
-- cada vez que guarda una nueva. No hace falta ninguna tarea programada.
-- ============================================================

create table if not exists pedido_idempotente (
  usuario_id  uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  -- Método y ruta del pedido, con los ids: "POST /v1/insumos/<id>/ajustar".
  ruta        text        not null check (char_length(ruta) between 1 and 300),
  clave       text        not null check (char_length(clave) between 1 and 200),
  -- Huella (sha-256) del cuerpo: la misma clave con otro cuerpo es un error
  -- del front, no un reintento, y no tiene que devolver la respuesta vieja.
  huella      text        not null,
  -- Nulo mientras la operación corre.
  estado_http integer     check (estado_http between 100 and 599),
  respuesta   jsonb,
  creado_en   timestamptz not null default now(),
  primary key (usuario_id, ruta, clave)
);

create index if not exists pedido_idempotente_creado_en on pedido_idempotente (usuario_id, creado_en);

alter table pedido_idempotente enable row level security;

drop policy if exists pedido_idempotente_propio on pedido_idempotente;
create policy pedido_idempotente_propio on pedido_idempotente
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Sin sesión no hay nada que guardar.
revoke all on pedido_idempotente from anon;
grant select, insert, update, delete on pedido_idempotente to authenticated;
