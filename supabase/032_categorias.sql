-- ============================================================
-- 032_categorias.sql — la categoría de cada producto del inventario
--
-- Correr entero en el SQL Editor de Supabase, después de 001..031.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- QUÉ RESUELVE:
-- Poder ordenar el estante: pernos, tornillos, herramientas, lubricantes. Y
-- mirar el stock agrupado por eso.
--
-- ES OPCIONAL. Un producto sin categoría queda en "Sin categoría", que es lo
-- que falta ordenar.
--
-- SIN ESTA MIGRACIÓN LA APLICACIÓN SIGUE ANDANDO. Si falta, guardar un
-- producto reintenta sin las columnas nuevas (escribirConColumnasNuevas, en
-- src/lib/datos.js): se pierde la categoría, no el producto.
-- ============================================================

-- Texto libre y no una tabla aparte. Cada rubro trae las suyas de fábrica
-- (presets.js), y las que agrega un negocio con "+ Nueva" viven en el
-- producto que las usa: una categoría sin ningún producto adentro no sirve
-- para nada, ni siquiera para mirar el inventario agrupado.
alter table insumo add column if not exists categoria text;

-- ------------------------------------------------------------
-- Nada más
-- ------------------------------------------------------------
-- Sin políticas nuevas: las de 008_permisos.sql son por fila, no por
-- columna. La categoría la ve todo el negocio y la cargan el dueño y el
-- encargado, igual que el resto del insumo.
