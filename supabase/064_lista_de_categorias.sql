-- ============================================================
-- 064_lista_de_categorias.sql — la lista de categorías del negocio
--
-- Correr entero en el SQL Editor de Supabase, después de 001..063.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- QUÉ RESUELVE:
-- "Editar categorías" en el Inventario: ver la lista, borrar las que no se
-- usan y agregar nuevas antes de tener un producto que las use.
--
-- Una fila por negocio con la lista entera. Sin fila, el negocio sigue con
-- las de fábrica de su rubro (presets.js), como hasta ahora. La categoría de
-- cada producto sigue siendo texto en insumo.categoria (032).
--
-- SIN ESTA MIGRACIÓN LA APLICACIÓN SIGUE ANDANDO: /datos trae la lista en
-- null y se ven las de fábrica; lo único que falla es guardar la lista.
-- ============================================================

create table if not exists categorias_del_negocio (
  negocio_id uuid primary key references negocio(id) on delete cascade,
  lista jsonb not null default '[]'::jsonb check (jsonb_typeof(lista) = 'array'),
  actualizado_en timestamptz not null default now()
);

alter table categorias_del_negocio enable row level security;

-- Las mismas que insumo (058): la ve quien ve el inventario y la cambia
-- quien lo carga.
drop policy if exists categorias_las_ve_el_negocio on categorias_del_negocio;
create policy categorias_las_ve_el_negocio on categorias_del_negocio
  for select to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('ver_inventario')));

drop policy if exists categorias_las_carga_quien_puede on categorias_del_negocio;
create policy categorias_las_carga_quien_puede on categorias_del_negocio
  for all to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('editar_inventario')))
  with check (negocio_id = mi_negocio() and (select puede_aca('editar_inventario')));

-- CÓMO VERIFICARLO (sólo lee):
--
--   select negocio_id, lista from categorias_del_negocio limit 5;
