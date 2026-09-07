-- ============================================================
-- 005_rls.sql — aislamiento por negocio (Row Level Security)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..004.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- QUÉ HACE:
-- Hasta acá la clave anónima podía leer y escribir todo. A partir de este
-- archivo, cada cuenta ve y toca únicamente los datos de SU negocio, y la
-- regla vive en la base y no en el navegador. Aunque alguien use la clave
-- anónima a mano, no puede salirse de su negocio.
--
-- CÓMO:
-- La tabla `usuario` liga la cuenta (auth.users) con un negocio. La función
-- mi_negocio() devuelve el negocio de quien está entrando, y todas las
-- políticas se apoyan en ella.
--
-- Sin sesión no se ve nada: las políticas son sólo para el rol
-- "authenticated". Si mi_negocio() da NULL (cuenta sin negocio todavía),
-- ninguna comparación da verdadero y no se ve nada. Falla cerrado.
-- ============================================================

-- ------------------------------------------------------------
-- De qué negocio es la persona que entró
-- ------------------------------------------------------------
-- security definer: corre con los permisos del dueño de la función, así
-- puede leer `usuario` sin volver a pasar por las políticas de `usuario`
-- (si no, una política que consulta la tabla que está protegiendo se
-- muerde la cola).
create or replace function mi_negocio()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select negocio_id from usuario where id = auth.uid();
$$;

revoke all on function mi_negocio() from public;
grant execute on function mi_negocio() to authenticated;

-- ------------------------------------------------------------
-- Crear el negocio y atarlo a la cuenta, en un solo paso
-- ------------------------------------------------------------
-- Va como función y no como insert suelto por dos razones:
--   1. Es atómico: no puede quedar un negocio huérfano si falla el vínculo.
--   2. Permite que `negocio` no tenga política de insert. Nadie puede crear
--      negocios sueltos: el único camino es esta función, que además
--      controla que la cuenta no tenga ya uno.
create or replace function crear_mi_negocio(p_nombre text, p_rubro text, p_modulos jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión para crear un negocio.';
  end if;

  if (select negocio_id from usuario where id = auth.uid()) is not null then
    raise exception 'Esta cuenta ya tiene un negocio.';
  end if;

  insert into negocio (nombre, rubro, modulos_activos)
  values (p_nombre, p_rubro, coalesce(p_modulos, '[]'::jsonb))
  returning id into nuevo;

  -- La fila de usuario puede no existir todavía, según cuándo se confirmó
  -- el mail. Se crea o se actualiza, lo que haga falta.
  insert into usuario (id, email, negocio_id)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), nuevo)
  on conflict (id) do update set negocio_id = excluded.negocio_id;

  return nuevo;
end;
$$;

revoke all on function crear_mi_negocio(text, text, jsonb) from public;
grant execute on function crear_mi_negocio(text, text, jsonb) to authenticated;

-- ------------------------------------------------------------
-- usuario — cada cuenta, su propia fila
-- ------------------------------------------------------------
alter table usuario enable row level security;

drop policy if exists usuario_ve_lo_suyo on usuario;
create policy usuario_ve_lo_suyo on usuario
  for select to authenticated
  using (id = auth.uid());

drop policy if exists usuario_crea_lo_suyo on usuario;
create policy usuario_crea_lo_suyo on usuario
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists usuario_edita_lo_suyo on usuario;
create policy usuario_edita_lo_suyo on usuario
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- negocio — se ve y se edita el propio; se crea sólo por la función
-- ------------------------------------------------------------
alter table negocio enable row level security;

drop policy if exists negocio_ve_el_suyo on negocio;
create policy negocio_ve_el_suyo on negocio
  for select to authenticated
  using (id = mi_negocio());

drop policy if exists negocio_edita_el_suyo on negocio;
create policy negocio_edita_el_suyo on negocio
  for update to authenticated
  using (id = mi_negocio())
  with check (id = mi_negocio());

-- A propósito no hay política de insert ni de delete: el alta pasa por
-- crear_mi_negocio() y el borrado no se hace desde la aplicación.

-- ------------------------------------------------------------
-- Tablas que cuelgan del negocio
-- ------------------------------------------------------------
-- Mismo criterio para las cinco: se puede todo, pero sólo sobre las filas
-- del negocio propio. El "with check" evita además mover una fila a otro
-- negocio con un update.

-- ---------- cliente ----------
alter table cliente enable row level security;
drop policy if exists cliente_de_mi_negocio on cliente;
create policy cliente_de_mi_negocio on cliente
  for all to authenticated
  using (negocio_id = mi_negocio())
  with check (negocio_id = mi_negocio());

-- ---------- empleado ----------
alter table empleado enable row level security;
drop policy if exists empleado_de_mi_negocio on empleado;
create policy empleado_de_mi_negocio on empleado
  for all to authenticated
  using (negocio_id = mi_negocio())
  with check (negocio_id = mi_negocio());

-- ---------- caso ----------
alter table caso enable row level security;
drop policy if exists caso_de_mi_negocio on caso;
create policy caso_de_mi_negocio on caso
  for all to authenticated
  using (negocio_id = mi_negocio())
  with check (negocio_id = mi_negocio());

-- ---------- insumo ----------
alter table insumo enable row level security;
drop policy if exists insumo_de_mi_negocio on insumo;
create policy insumo_de_mi_negocio on insumo
  for all to authenticated
  using (negocio_id = mi_negocio())
  with check (negocio_id = mi_negocio());

-- ---------- turno ----------
alter table turno enable row level security;
drop policy if exists turno_de_mi_negocio on turno;
create policy turno_de_mi_negocio on turno
  for all to authenticated
  using (negocio_id = mi_negocio())
  with check (negocio_id = mi_negocio());

-- ------------------------------------------------------------
-- Tablas que cuelgan del caso
-- ------------------------------------------------------------
-- `paso` y `evento` no tienen negocio_id: se llega por el caso.

-- ---------- paso ----------
alter table paso enable row level security;
drop policy if exists paso_de_mi_negocio on paso;
create policy paso_de_mi_negocio on paso
  for all to authenticated
  using (
    exists (select 1 from caso c where c.id = paso.caso_id and c.negocio_id = mi_negocio())
  )
  with check (
    exists (select 1 from caso c where c.id = paso.caso_id and c.negocio_id = mi_negocio())
  );

-- ---------- evento ----------
alter table evento enable row level security;
drop policy if exists evento_de_mi_negocio on evento;
create policy evento_de_mi_negocio on evento
  for all to authenticated
  using (
    exists (select 1 from caso c where c.id = evento.caso_id and c.negocio_id = mi_negocio())
  )
  with check (
    exists (select 1 from caso c where c.id = evento.caso_id and c.negocio_id = mi_negocio())
  );

-- ============================================================
-- Nota sobre los datos de ejemplo de 002_seed.sql
--
-- El taller sembrado no es de nadie, así que con RLS prendido no lo ve
-- ninguna cuenta. Para engancharlo a la tuya y entrar con los 9 casos ya
-- cargados, después de crear tu cuenta corré esto cambiando el mail:
--
--   update usuario
--   set negocio_id = '00000000-0000-0000-0000-0000000000b0'
--   where email = 'tu@mail.com';
--
-- Ojo: 002_seed.sql borra y recrea las tablas, y eso también vacía
-- `usuario`. Si lo volvés a correr, hay que volver a crear la cuenta.
-- ============================================================
