-- 048_ecuaciones.sql — fórmulas guardadas por negocio

create table if not exists ecuacion (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocio(id) on delete cascade,
  nombre text not null check (btrim(nombre) <> ''),
  formula text not null check (btrim(formula) <> ''),
  descripcion text,
  categoria text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists ecuacion_negocio_idx on ecuacion (negocio_id, creado_en desc);

drop trigger if exists ecuacion_actualizado_en on ecuacion;
create trigger ecuacion_actualizado_en
  before update on ecuacion
  for each row execute function tocar_actualizado_en();

alter table ecuacion enable row level security;

drop policy if exists ecuacion_lo_ve_el_negocio on ecuacion;
create policy ecuacion_lo_ve_el_negocio on ecuacion
  for select to authenticated
  using (negocio_id = mi_negocio());

drop policy if exists ecuacion_la_carga_quien_puede on ecuacion;
create policy ecuacion_la_carga_quien_puede on ecuacion
  for insert to authenticated
  with check (negocio_id = mi_negocio() and puedo_cargar());

grant select, insert on ecuacion to authenticated;
