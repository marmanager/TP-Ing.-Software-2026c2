-- Variables, unidad de resultado y edición de ecuaciones.

alter table ecuacion
  add column if not exists variables jsonb not null default '[]'::jsonb,
  add column if not exists unidad_resultado text;

drop policy if exists ecuacion_la_edita_quien_puede on ecuacion;
create policy ecuacion_la_edita_quien_puede on ecuacion
  for update to authenticated
  using (negocio_id = mi_negocio() and puedo_cargar())
  with check (negocio_id = mi_negocio() and puedo_cargar());

drop policy if exists ecuacion_la_borra_quien_puede on ecuacion;
create policy ecuacion_la_borra_quien_puede on ecuacion
  for delete to authenticated
  using (negocio_id = mi_negocio() and puedo_cargar());

grant update, delete on ecuacion to authenticated;
