-- ============================================================
-- 033_nombre_del_caso.sql — el nombre del caso (SCRUM-119)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..032.
-- Es idempotente.
--
-- POR QUÉ:
-- Todo caso se llamaba "Caso 271". En el mostrador nadie busca el 271: busca
-- "el Gol de Hugo", o la patente, o "el de los frenos". Ahora cada caso puede
-- tener un nombre, y cada negocio elige con qué nace.
--
-- DOS COLUMNAS:
--
--   caso.nombre            El nombre del caso. null es que no tiene, y
--                          entonces se ve "Caso 271" como siempre. Nunca se
--                          guarda un nombre en blanco: la aplicación lo
--                          manda como null.
--
--   negocio.nombrar_casos  Con qué nace el nombre de los casos NUEVOS:
--                          'numero'        sin nombre, como hasta ahora
--                          'cliente'       el nombre del cliente
--                          'identificador' la patente, la ficha o el número
--                                          de serie, según el rubro
--                          'servicio'      lo que pidió el cliente
--
-- Cambiar la opción NO renombra los casos que ya existen: afecta sólo a los
-- que se abran después. Los de antes se editan de a uno desde el caso.
--
-- El nombre es interno. El cliente no lo ve: ver_seguimiento() no lo
-- devuelve y en el link sigue diciendo "Caso 271". Si algún día se quiere
-- mostrar, hay que sumarlo ahí y en src/lib/seguimiento.js, a propósito.
--
-- Las políticas de caso y de negocio (005_rls.sql) son por fila y no nombran
-- columnas, así que estas dos quedan cubiertas solas.
-- ============================================================

alter table caso    add column if not exists nombre        text;
alter table negocio add column if not exists nombrar_casos text not null default 'numero';

-- La regla va aparte de la columna: `add column if not exists` no la vuelve a
-- poner si la columna ya estaba, así que en una base que corrió una versión
-- anterior de este archivo quedaría sin la restricción. Mismo arreglo que el
-- 012 y el 031.
alter table negocio drop constraint if exists negocio_nombrar_casos_valido;
alter table negocio add  constraint negocio_nombrar_casos_valido
  check (nombrar_casos in ('numero', 'cliente', 'identificador', 'servicio'));
