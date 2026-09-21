-- ============================================================
-- 025_cobros.sql — un caso puede tener varios cobros
--
-- Correr entero en el SQL Editor de Supabase, después de 001..024.
-- Es idempotente.
--
-- QUÉ RESUELVE:
-- 012 guardó UN número por caso: cuánto se cobró. Alcanzaba para anotar lo
-- que pasó en el mostrador, pero no para lo que viene:
--
--   · Pagos parciales: una seña al dejar el auto y el resto al retirarlo.
--   · Cobros que todavía no pasaron: un link de pago que el cliente paga a
--     la noche, desde su casa. El caso ya se entregó y el cobro sigue
--     pendiente, por su lado.
--   · Cómo se pagó: efectivo, transferencia, tarjeta en el local, o por link
--     y QR a través de la API de pagos (los medios exactos todavía no están
--     definidos; la lista de abajo se amplía sin tocar nada más).
--
-- El comentario de 012 ya lo anticipaba: "eso es una tabla cobro con su
-- fecha y su medio, no más columnas acá".
--
-- CASO.COBRADO SIGUE EXISTIENDO, Y SIGUE DICIENDO LO MISMO:
-- Es la suma de lo que efectivamente entró. La mantiene un trigger, así el
-- detalle del caso, la ficha del cliente y los criterios de SCRUM-74 siguen
-- andando sin enterarse de que abajo ahora hay una tabla.
--
--   · Un caso sin ningún cobro en la tabla no se toca: conserva lo que tenía,
--     incluido el 0 de "se entregó sin cobrar" y el NULL de "no se registró".
--   · Un caso con cobros en la tabla pasa a valer la suma de los pagados, o
--     NULL si ninguno se pagó todavía. Un cobro pendiente NO es plata que
--     entró.
--
-- QUIÉN PUEDE QUÉ — LA PARTE QUE IMPORTA:
-- Nadie escribe la tabla directo. Las personas del negocio pasan por dos
-- funciones chicas:
--
--   registrar_cobro() → anota un pago que ya pasó en el local (efectivo,
--                       transferencia, tarjeta). Nace pagado, porque el
--                       negocio tiene la plata en la mano.
--   anular_cobro()    → corrige un cobro mal anotado. No se borra: queda
--                       anulado, con quién y por qué.
--
-- Un cobro por link o QR NO se puede marcar como pagado desde acá. Eso lo
-- hace únicamente la API de pagos, del lado del servidor, cuando el medio
-- de pago le confirma que el pago entró. Si el navegador pudiera escribir
-- "pagado", cualquiera podría marcar como pagado algo que no pagó.
-- ============================================================

create table if not exists cobro (
  id               uuid        primary key default gen_random_uuid(),
  negocio_id       uuid        not null references negocio (id) on delete cascade,
  caso_id          uuid        not null references caso (id) on delete cascade,
  -- Cada cobro es plata que entra: siempre más que cero. "Se entregó sin
  -- cobrar nada" no es un cobro, es caso.cobrado = 0 (012).
  monto            numeric(12, 2) not null,
  medio            text        not null,
  estado           text        not null default 'pendiente',
  nota             text,

  -- Lo que completa la API de pagos. Quedan vacíos en los cobros del local.
  proveedor        text,
  proveedor_id     text,
  link             text,
  vence_en         timestamptz,

  creado_en        timestamptz not null default now(),
  creado_por       uuid        references empleado (id) on delete set null,
  pagado_en        timestamptz,
  anulado_en       timestamptz,
  anulado_por      uuid        references empleado (id) on delete set null,
  motivo_anulacion text
);

-- Los checks van aparte: "create table if not exists" no los vuelve a poner
-- en una base que corrió una versión anterior (mismo motivo que en 012).
alter table cobro drop constraint if exists cobro_monto_positivo;
alter table cobro add  constraint cobro_monto_positivo check (monto > 0);

alter table cobro drop constraint if exists cobro_medio_valido;
alter table cobro add  constraint cobro_medio_valido
  check (medio in ('efectivo', 'transferencia', 'tarjeta', 'link', 'qr', 'sin_dato'));

alter table cobro drop constraint if exists cobro_estado_valido;
alter table cobro add  constraint cobro_estado_valido
  check (estado in ('pendiente', 'pagado', 'rechazado', 'vencido', 'anulado', 'devuelto'));

-- Pagado siempre con fecha; anulado siempre con fecha.
alter table cobro drop constraint if exists cobro_pagado_con_fecha;
alter table cobro add  constraint cobro_pagado_con_fecha
  check (estado <> 'pagado' or pagado_en is not null);
alter table cobro drop constraint if exists cobro_anulado_con_fecha;
alter table cobro add  constraint cobro_anulado_con_fecha
  check (estado <> 'anulado' or anulado_en is not null);

create index if not exists cobro_caso_idx    on cobro (caso_id);
create index if not exists cobro_negocio_idx on cobro (negocio_id, estado);
-- La API busca por el id que le da el medio de pago cuando le avisa.
create unique index if not exists cobro_proveedor_idx
  on cobro (proveedor, proveedor_id)
  where proveedor_id is not null;

-- ------------------------------------------------------------
-- caso.cobrado = lo que entró
-- ------------------------------------------------------------
create or replace function cobro_recalcular_caso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caso uuid := coalesce(new.caso_id, old.caso_id);
begin
  update caso set
    cobrado    = (select sum(monto)     from cobro where caso_id = v_caso and estado = 'pagado'),
    cobrado_en = (select max(pagado_en) from cobro where caso_id = v_caso and estado = 'pagado')
  where id = v_caso;
  return null;
end;
$$;

drop trigger if exists cobro_mantiene_caso on cobro;
create trigger cobro_mantiene_caso
  after insert or update or delete on cobro
  for each row execute function cobro_recalcular_caso();

-- ------------------------------------------------------------
-- Lo que ya estaba anotado pasa a la tabla
-- ------------------------------------------------------------
-- Un caso que registró un cobro con 012 tiene un número y una fecha, pero no
-- cómo se pagó: queda con medio 'sin_dato'. Sin esto, el primer cobro nuevo
-- sobre un caso viejo (reabierto, por ejemplo) pisaría lo anterior en vez de
-- sumarse. El 0 no se pasa: no es plata que entró.
insert into cobro (negocio_id, caso_id, monto, medio, estado, creado_en, pagado_en)
select c.negocio_id, c.id, c.cobrado, 'sin_dato', 'pagado',
       coalesce(c.cobrado_en, c.actualizado_en), coalesce(c.cobrado_en, c.actualizado_en)
from caso c
where c.cobrado > 0
  and not exists (select 1 from cobro x where x.caso_id = c.id);

-- ------------------------------------------------------------
-- Quién ve qué
-- ------------------------------------------------------------
alter table cobro enable row level security;

-- Todo el equipo ve los cobros de su negocio: el técnico que entrega el
-- auto necesita saber si falta cobrar algo.
drop policy if exists cobro_de_mi_negocio on cobro;
create policy cobro_de_mi_negocio on cobro
  for select
  using (negocio_id = mi_negocio());

-- Sin políticas de insert, update ni delete: para escribir se pasa por las
-- funciones de abajo. RLS niega todo lo que no está permitido.

-- ------------------------------------------------------------
-- Anotar un pago del local
-- ------------------------------------------------------------
-- Devuelve { ok: true, cobro } o { ok: false, motivo }, con el motivo
-- escrito para leerse en pantalla.
create or replace function registrar_cobro(
  p_caso_id uuid,
  p_monto   numeric,
  p_medio   text,
  p_nota    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c caso%rowtype;
  nuevo cobro%rowtype;
begin
  select * into c from caso where id = p_caso_id;
  if not found or c.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'Ese caso no es de tu negocio.');
  end if;

  -- Mover plata es del dueño y del encargado (008_permisos.sql).
  if not puedo_cargar() then
    return jsonb_build_object('ok', false, 'motivo', 'Los cobros los anotan el dueño o el encargado.');
  end if;

  if p_monto is null or p_monto <= 0 then
    return jsonb_build_object('ok', false, 'motivo', 'El monto tiene que ser mayor que cero.');
  end if;

  -- Sólo lo que se cobra en el local. Link y QR los crea la API de pagos.
  if p_medio not in ('efectivo', 'transferencia', 'tarjeta') then
    return jsonb_build_object('ok', false, 'motivo', 'Los cobros por link o QR se piden desde el sistema de pagos.');
  end if;

  insert into cobro (negocio_id, caso_id, monto, medio, estado, nota, creado_por, pagado_en)
  values (c.negocio_id, c.id, round(p_monto, 2), p_medio, 'pagado',
          nullif(trim(coalesce(p_nota, '')), ''), mi_empleado(), now())
  returning * into nuevo;

  return jsonb_build_object('ok', true, 'cobro', to_jsonb(nuevo));
end;
$$;

revoke all on function registrar_cobro(uuid, numeric, text, text) from public;
revoke all on function registrar_cobro(uuid, numeric, text, text) from anon;
grant execute on function registrar_cobro(uuid, numeric, text, text) to authenticated;

-- ------------------------------------------------------------
-- Corregir un cobro mal anotado
-- ------------------------------------------------------------
-- No se borra: el cobro queda anulado, con fecha, quién y por qué. Es plata,
-- y lo que pasó con la plata no se reescribe.
--
-- Se anula un cobro del local ya pagado (se anotó mal) o uno pendiente que
-- no se va a usar. Un pago por link o QR que ya entró no se anula: se
-- devuelve, y eso lo hace el medio de pago a través de la API.
create or replace function anular_cobro(p_cobro_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x cobro%rowtype;
begin
  select * into x from cobro where id = p_cobro_id for update;
  if not found or x.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'Ese cobro ya no está.');
  end if;

  if not puedo_cargar() then
    return jsonb_build_object('ok', false, 'motivo', 'Los cobros los corrigen el dueño o el encargado.');
  end if;

  if x.estado not in ('pendiente', 'pagado') then
    return jsonb_build_object('ok', false, 'motivo', 'Ese cobro ya no cuenta: no hay nada que anular.');
  end if;

  if x.estado = 'pagado' and x.medio in ('link', 'qr') then
    return jsonb_build_object('ok', false, 'motivo', 'Ese pago ya entró por el medio de pago. Para devolverlo, hay que hacerlo desde ahí.');
  end if;

  update cobro set
    estado           = 'anulado',
    anulado_en       = now(),
    anulado_por      = mi_empleado(),
    motivo_anulacion = nullif(trim(coalesce(p_motivo, '')), '')
  where id = x.id
  returning * into x;

  return jsonb_build_object('ok', true, 'cobro', to_jsonb(x));
end;
$$;

revoke all on function anular_cobro(uuid, text) from public;
revoke all on function anular_cobro(uuid, text) from anon;
grant execute on function anular_cobro(uuid, text) to authenticated;
