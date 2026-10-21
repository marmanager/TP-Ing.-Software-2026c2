-- ============================================================
-- 066_planes_y_prueba.sql — Básico y Pro, mensual o anual, y un mes gratis
--
-- Correr entero en el SQL Editor de Supabase, después de la 065.
-- Es idempotente.
--
-- PLANES: los precios se cargan en dólares. Mercado Pago cobra en pesos: la
-- API convierte al dólar oficial al suscribirse. El anual sale 10 mensuales
-- (2 meses gratis). Por ahora Básico y Pro dan el mismo acceso.
--
-- PRUEBA: un mes gratis, sin tarjeta, una vez por cuenta. La empieza el dueño
-- y la usa todo el negocio. Vive en su propia tabla, que sólo escribe
-- empezar_prueba(): en una columna de negocio, cualquiera con
-- configurar_negocio podría correrse la fecha.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Mensual o anual
-- ------------------------------------------------------------
alter table suscripcion_precio
  add column if not exists periodo text not null default 'mensual';

alter table suscripcion_precio drop constraint if exists suscripcion_precio_periodo_valido;
alter table suscripcion_precio
  add constraint suscripcion_precio_periodo_valido check (periodo in ('mensual', 'anual'));

-- ------------------------------------------------------------
-- 2. Los planes
-- ------------------------------------------------------------
-- El de ejemplo de la 065 se va, si nadie se suscribió a él.
delete from suscripcion_precio
 where suscripcion_id in (select id from suscripcion where nombre = 'Mensual')
   and not exists (select 1 from usuario_suscripcion u
                    where u.suscripcion_id = suscripcion_precio.suscripcion_id);
delete from suscripcion s
 where s.nombre = 'Mensual'
   and not exists (select 1 from usuario_suscripcion u where u.suscripcion_id = s.id)
   and not exists (select 1 from suscripcion_precio p where p.suscripcion_id = s.id);

insert into suscripcion (nombre, descripcion)
select v.nombre, v.descripcion
from (values
  ('Básico', 'Todo el sistema para tu negocio y tu equipo.'),
  ('Pro',    'Todo el sistema, con prioridad en soporte y en lo que viene.')
) as v(nombre, descripcion)
where not exists (select 1 from suscripcion s where s.nombre = v.nombre);

insert into suscripcion_precio (suscripcion_id, moneda, periodo, precio)
select s.id, 'USD', v.periodo, v.precio
from (values
  ('Básico', 'mensual', 20),
  ('Básico', 'anual',   200),
  ('Pro',    'mensual', 100),
  ('Pro',    'anual',   1000)
) as v(nombre, periodo, precio)
join suscripcion s on s.nombre = v.nombre
where not exists (
  select 1 from suscripcion_precio p
   where p.suscripcion_id = s.id and p.moneda = 'USD' and p.periodo = v.periodo
);

-- ------------------------------------------------------------
-- 3. La prueba
-- ------------------------------------------------------------
-- Una fila por cuenta: la clave primaria es lo que impide la segunda.
-- negocio_id queda en null si se borra el negocio, pero la fila sigue: borrar
-- el negocio no devuelve la prueba.
create table if not exists prueba_gratis (
  usuario_id uuid primary key references usuario(id) on delete cascade,
  negocio_id uuid references negocio(id) on delete set null,
  desde      timestamptz not null default now(),
  hasta      timestamptz not null
);

create index if not exists prueba_gratis_negocio_idx on prueba_gratis (negocio_id);

alter table prueba_gratis enable row level security;

-- La ve el equipo del negocio (para saber si hay acceso) y la cuenta que la
-- usó (para no ofrecerle otra). Sin políticas de escritura.
drop policy if exists prueba_gratis_la_ve_el_negocio on prueba_gratis;
create policy prueba_gratis_la_ve_el_negocio on prueba_gratis
  for select to authenticated
  using (negocio_id = mi_negocio() or usuario_id = auth.uid());

create or replace function empezar_prueba()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hasta timestamptz;
begin
  if mi_negocio() is null or not soy_duenio_aca() then
    raise exception 'La prueba la empieza el dueño del negocio.';
  end if;
  if exists (select 1 from prueba_gratis where usuario_id = auth.uid()) then
    raise exception 'Esta cuenta ya usó su mes de prueba.';
  end if;
  -- Con dos dueños, el segundo no le suma otro mes al mismo negocio.
  if exists (select 1 from prueba_gratis where negocio_id = mi_negocio()) then
    raise exception 'Este negocio ya tuvo su mes de prueba.';
  end if;
  if exists (select 1 from usuario_suscripcion
              where negocio_id = mi_negocio() and estado = 'authorized') then
    raise exception 'El negocio ya tiene una suscripción activa.';
  end if;

  insert into prueba_gratis (usuario_id, negocio_id, hasta)
  values (auth.uid(), mi_negocio(), now() + interval '30 days')
  returning hasta into v_hasta;

  return v_hasta;
end;
$$;

revoke all on function empezar_prueba() from public, anon;
grant execute on function empezar_prueba() to authenticated;
