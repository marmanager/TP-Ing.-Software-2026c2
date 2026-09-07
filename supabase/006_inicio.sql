-- ============================================================
-- 006_inicio.sql — la pantalla de Inicio armada por módulos
--
-- Correr en el SQL Editor de Supabase. Es idempotente.
--
-- Guarda cómo dejó cada negocio su pantalla de entrada: qué módulos ve,
-- en qué orden, de qué tamaño y con qué filtro.
--
-- Va en "negocio" y no en "usuario" porque hoy cada cuenta tiene su propio
-- negocio, así que es lo mismo, y de esta forma reusa las políticas RLS que
-- ya existen. El día que se pueda invitar compañeros al mismo negocio, esta
-- columna se muda a "usuario" para que cada uno tenga la suya.
--
-- La forma de cada elemento es:
--   { "clave": "casos", "x": 0, "y": 2, "ancho": 4, "alto": 3, "filtro": "abiertos" }
--
--   clave  · cuál de los módulos del catálogo (src/lib/inicio.js)
--   x, y   · dónde arranca, en celdas, contando desde cero
--   ancho  · de 1 a 6 celdas, sobre una grilla de seis columnas
--   alto   · de 1 a 6 celdas; también define cuántas filas muestra
--   filtro · qué subconjunto muestra; null si el módulo no filtra
--
-- Cada módulo tiene su lugar propio, así que dos pueden ir uno al lado del
-- otro y no sólo apilados. Lo único que la aplicación no deja es que se
-- pisen: al soltar uno encima de otro, el otro baja.
--
-- Se valida en la aplicación y no acá a propósito: un arreglo mal formado
-- no tiene que romper el login, tiene que caer en el orden por defecto.
-- Eso lo hace normalizarInicio() en src/lib/inicio.js.
--
-- '[]'::jsonb NO es el valor por defecto: una lista vacía significa "saqué
-- todos los módulos". El default es null, que la aplicación lee como
-- "todavía no lo tocó" y muestra el orden de fábrica.
-- ============================================================

alter table negocio
  add column if not exists inicio jsonb;

comment on column negocio.inicio is
  'Cómo quedó acomodada la pantalla de Inicio: [{clave, x, y, ancho, alto, filtro}]. '
  'null = nunca se tocó, vale el orden por defecto. [] = se sacaron todos los módulos.';
