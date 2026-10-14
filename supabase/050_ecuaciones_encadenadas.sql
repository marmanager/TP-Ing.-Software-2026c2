-- Relaciones estables entre ecuaciones. El alias es el nombre que usa la
-- fórmula; el nombre visible de la ecuación puede cambiar sin romperla.

create table if not exists ecuacion_dependencia (
  ecuacion_id uuid not null references ecuacion(id) on delete cascade,
  dependencia_id uuid not null references ecuacion(id) on delete restrict,
  alias text not null check (btrim(alias) <> ''),
  primary key (ecuacion_id, dependencia_id),
  unique (ecuacion_id, alias),
  check (ecuacion_id <> dependencia_id)
);

create index if not exists ecuacion_dependencia_usada_idx
  on ecuacion_dependencia (dependencia_id);

alter table ecuacion_dependencia enable row level security;

drop policy if exists ecuacion_dependencia_la_ve_el_negocio on ecuacion_dependencia;
create policy ecuacion_dependencia_la_ve_el_negocio on ecuacion_dependencia
  for select to authenticated
  using (exists (
    select 1 from ecuacion e
    where e.id = ecuacion_id and e.negocio_id = mi_negocio()
  ));

drop policy if exists ecuacion_dependencia_la_carga_quien_puede on ecuacion_dependencia;
create policy ecuacion_dependencia_la_carga_quien_puede on ecuacion_dependencia
  for insert to authenticated
  with check (
    puedo_cargar()
    and exists (select 1 from ecuacion e where e.id = ecuacion_id and e.negocio_id = mi_negocio())
    and exists (select 1 from ecuacion d where d.id = dependencia_id and d.negocio_id = mi_negocio())
  );

drop policy if exists ecuacion_dependencia_la_borra_quien_puede on ecuacion_dependencia;
create policy ecuacion_dependencia_la_borra_quien_puede on ecuacion_dependencia
  for delete to authenticated
  using (
    puedo_cargar()
    and exists (select 1 from ecuacion e where e.id = ecuacion_id and e.negocio_id = mi_negocio())
  );

grant select, insert, delete on ecuacion_dependencia to authenticated;
