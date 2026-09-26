-- ============================================================
-- 031_productos.sql — marca, modelo y cajas en el inventario
--
-- Correr entero en el SQL Editor de Supabase, después de 001..030.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- QUÉ RESUELVE:
-- Un "filtro de aceite" suelto no alcanza para saber qué hay en el estante:
-- hay de dos marcas y de tres modelos, y los tornillos vienen en cajas de
-- cien. Cada producto pasa a tener marca, modelo, y si viene en caja, cuántos
-- trae cada una.
--
-- LAS TRES SON OPCIONALES. Todo lo que ya está cargado sigue valiendo tal
-- cual: nulo quiere decir "no se dijo", no "no tiene".
--
-- SIN ESTA MIGRACIÓN LA APLICACIÓN SIGUE ANDANDO. Si falta, guardar un
-- producto reintenta sin las columnas nuevas (escribirConColumnasNuevas, en
-- src/lib/datos.js): se pierden la marca y el modelo, no el producto.
-- ============================================================

alter table insumo add column if not exists marca     text;
alter table insumo add column if not exists modelo    text;

-- Cuántos vienen en cada caja, cuando "unidad" es 'caja'. La cantidad y el
-- mínimo se cuentan en cajas: es como se cuentan en el estante.
alter table insumo add column if not exists por_caja  integer;

alter table insumo drop constraint if exists insumo_por_caja_positivo;
alter table insumo add constraint insumo_por_caja_positivo
  check (por_caja is null or por_caja > 0);

-- ------------------------------------------------------------
-- Nada más
-- ------------------------------------------------------------
-- Sin políticas nuevas: las de 008_permisos.sql son por fila, no por
-- columna. Las columnas nuevas las ve todo el negocio y las cargan el dueño y
-- el encargado, igual que el resto del insumo.
--
-- ponytail: dos productos idénticos se suman en la aplicación (buscarIgual
-- en src/lib/inventario.js), no en la base. Dos personas agregando el mismo
-- producto en el mismo segundo pueden dejar dos filas. Si pasa, un índice
-- único sobre la clave normalizada lo cierra de este lado.
