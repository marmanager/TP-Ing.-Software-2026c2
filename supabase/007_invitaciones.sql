-- ============================================================
-- 007_invitaciones.sql — invitar colaboradores (SCRUM-34)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..006.
-- Es idempotente.
--
-- NO ES OPCIONAL, ni en una base nueva: además de las invitaciones, acá
-- nacen usuario.rol, empleado.usuario_id y la función mi_rol(), de las que
-- depende entero el 008.
--
-- QUÉ RESUELVE:
-- Hasta acá cada cuenta tenía su propio negocio y no había forma de que dos
-- personas trabajaran sobre el mismo. El RLS ya lo soportaba —todas las
-- políticas cuelgan de usuario.negocio_id, así que varias cuentas con el
-- mismo negocio_id ven lo mismo—; lo que faltaba era la puerta de entrada.
--
-- CÓMO:
-- El dueño crea una invitación y comparte un link con un código. Quien lo
-- abre y lo acepta queda atado a ese negocio.
--
-- EL PROBLEMA DE PERMISOS Y CÓMO SE RESUELVE:
-- Quien recibe la invitación TODAVÍA NO pertenece al negocio, así que
-- mi_negocio() le da NULL y las políticas no lo dejan leer la invitación.
-- Por eso mirarla y aceptarla pasan por funciones "security definer", que
-- son la única puerta: piden el código, que es secreto, y no exponen nada
-- más del negocio que su nombre.
-- ============================================================

-- ------------------------------------------------------------
-- Primero las columnas nuevas, después las funciones que las usan
-- ------------------------------------------------------------
-- El orden importa: mi_rol() es "language sql" y Postgres le valida el
-- cuerpo al crearla, así que la columna tiene que existir antes.

-- ---------- el rol vive en la cuenta, no sólo en la ficha de empleado ----------
-- Quien crea el negocio es el dueño. Quien entra por invitación se lleva el
-- rol que diga la invitación.
alter table usuario
  add column if not exists rol text not null default 'duenio';

alter table usuario drop constraint if exists usuario_rol_check;
alter table usuario
  add constraint usuario_rol_check check (rol in ('duenio', 'encargado', 'tecnico'));

-- ---------- una ficha de empleado puede tener cuenta, o no ----------
-- El taller chico anota a Diego sin que Diego use el sistema. Si además
-- entra con su cuenta, las dos cosas quedan atadas por acá.
alter table empleado
  add column if not exists usuario_id uuid references usuario (id) on delete set null;

create index if not exists empleado_usuario_idx on empleado (usuario_id);

-- ------------------------------------------------------------
-- Qué rol tiene quien entró
-- ------------------------------------------------------------
create or replace function mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from usuario where id = auth.uid();
$$;

revoke all on function mi_rol() from public;
revoke all on function mi_rol() from anon;
grant execute on function mi_rol() to authenticated;

-- ------------------------------------------------------------
-- invitacion
-- ------------------------------------------------------------
-- No se borran: se anulan. Así queda el rastro de a quién se invitó.
create table if not exists invitacion (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid        not null references negocio (id) on delete cascade,
  codigo        text        not null unique default encode(gen_random_bytes(16), 'hex'),
  rol           text        not null default 'tecnico'
                check (rol in ('duenio', 'encargado', 'tecnico')),
  usos_maximos  integer     not null default 1 check (usos_maximos > 0),
  usos          integer     not null default 0 check (usos >= 0),
  vence_en      timestamptz not null,
  anulada       boolean     not null default false,
  creada_por    uuid        references usuario (id) on delete set null,
  creada_en     timestamptz not null default now()
);

create index if not exists invitacion_negocio_idx on invitacion (negocio_id);
create index if not exists invitacion_codigo_idx on invitacion (codigo);

-- ------------------------------------------------------------
-- Mirar una invitación sin pertenecer todavía al negocio
-- ------------------------------------------------------------
-- Devuelve lo mínimo para que la persona entienda a qué la invitaron, y por
-- qué no sirve el link si no sirve. No expone nada más del negocio.
create or replace function ver_invitacion(p_codigo text)
returns table (negocio_nombre text, rol text, sirve boolean, motivo text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inv invitacion%rowtype;
  neg negocio%rowtype;
begin
  select * into inv from invitacion where codigo = p_codigo;

  if not found then
    return query select null::text, null::text, false, 'Este link no existe. Fijate que esté completo.';
    return;
  end if;

  select * into neg from negocio where id = inv.negocio_id;

  if inv.anulada then
    return query select neg.nombre, inv.rol, false, 'Quien te invitó dio de baja este link.';
  elsif inv.vence_en < now() then
    return query select neg.nombre, inv.rol, false, 'Este link ya venció. Pedí uno nuevo.';
  elsif inv.usos >= inv.usos_maximos then
    return query select neg.nombre, inv.rol, false, 'Este link ya se usó todas las veces que podía.';
  else
    return query select neg.nombre, inv.rol, true, null::text;
  end if;
end;
$$;

-- A propósito también para "anon": quien recibe el link tiene que poder ver
-- a qué negocio lo invitan ANTES de crearse la cuenta, o estaría creando una
-- cuenta a ciegas. Lo único que se expone es el nombre del negocio, y sólo a
-- quien ya tiene el código, que es secreto.
revoke all on function ver_invitacion(text) from public;
grant execute on function ver_invitacion(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Aceptar la invitación
-- ------------------------------------------------------------
-- Ata la cuenta al negocio, le pone el rol de la invitación y le crea la
-- ficha de empleado para que pueda recibir casos desde el primer día.
-- Todo junto o nada.
create or replace function aceptar_invitacion(p_codigo text, p_nombre text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitacion%rowtype;
  quien uuid := auth.uid();
  mi_mail text;
begin
  if quien is null then
    raise exception 'Hay que iniciar sesión para aceptar una invitación.';
  end if;

  -- "for update" bloquea la fila hasta terminar: si dos personas abren el
  -- mismo link al mismo tiempo, no se pasa de los usos permitidos.
  select * into inv from invitacion where codigo = p_codigo for update;

  if not found then
    raise exception 'Este link no existe. Fijate que esté completo.';
  end if;
  if inv.anulada then
    raise exception 'Quien te invitó dio de baja este link.';
  end if;
  if inv.vence_en < now() then
    raise exception 'Este link ya venció. Pedí uno nuevo.';
  end if;
  if inv.usos >= inv.usos_maximos then
    raise exception 'Este link ya se usó todas las veces que podía.';
  end if;
  if (select negocio_id from usuario where id = quien) is not null then
    raise exception 'Tu cuenta ya está en un negocio.';
  end if;

  select email into mi_mail from auth.users where id = quien;

  insert into usuario (id, email, negocio_id, rol)
  values (quien, mi_mail, inv.negocio_id, inv.rol)
  on conflict (id) do update
    set negocio_id = excluded.negocio_id,
        rol = excluded.rol;

  -- La ficha de empleado, para poder quedar como responsable de un caso.
  insert into empleado (negocio_id, nombre, rol, usuario_id)
  values (
    inv.negocio_id,
    coalesce(nullif(trim(p_nombre), ''), split_part(coalesce(mi_mail, 'Alguien'), '@', 1)),
    inv.rol,
    quien
  );

  update invitacion set usos = usos + 1 where id = inv.id;

  return inv.negocio_id;
end;
$$;

revoke all on function aceptar_invitacion(text, text) from public;
grant execute on function aceptar_invitacion(text, text) to authenticated;

-- ------------------------------------------------------------
-- Políticas: la invitación es del negocio, y sólo el dueño invita
-- ------------------------------------------------------------
-- Primer permiso por rol que se hace cumplir en la base y no sólo
-- escondiendo botones: sumar gente es de las cosas que importan.
alter table invitacion enable row level security;

drop policy if exists invitacion_ve_las_suyas on invitacion;
create policy invitacion_ve_las_suyas on invitacion
  for select to authenticated
  using (negocio_id = mi_negocio());

drop policy if exists invitacion_crea_el_duenio on invitacion;
create policy invitacion_crea_el_duenio on invitacion
  for insert to authenticated
  with check (negocio_id = mi_negocio() and mi_rol() = 'duenio');

drop policy if exists invitacion_anula_el_duenio on invitacion;
create policy invitacion_anula_el_duenio on invitacion
  for update to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'duenio')
  with check (negocio_id = mi_negocio() and mi_rol() = 'duenio');

-- Sin política de delete: las invitaciones se anulan, no se borran.
