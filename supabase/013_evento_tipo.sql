-- ============================================================
-- 013_evento_tipo.sql — de qué tipo es cada evento (SCRUM-75)
--
-- Correr en el SQL Editor de Supabase, después de 001..012.
-- Es idempotente.
--
-- POR QUÉ:
-- El historial del negocio se filtra por tipo: lo que entró, lo que cambió
-- de estado, lo que se entregó, la plata y las anotaciones. Hasta acá el
-- tipo sólo se podía adivinar leyendo el título, y los títulos son texto
-- para personas: si alguien cambia una frase, el filtro deja de encontrar
-- esos eventos sin avisar. Por eso se guarda aparte.
--
-- "monto" es la plata de los eventos de tipo 'plata': cuánto era el paso que
-- se sumó, se sacó, se aprobó o se rechazó. Antes vivía sólo adentro del
-- detalle, como texto.
--
-- LOS EVENTOS QUE YA EXISTÍAN:
-- Al final del archivo se les pone tipo una sola vez, a partir de los
-- títulos que la aplicación escribió hasta ahora. Leer títulos es justo lo
-- que se quiso evitar, pero acá es distinto: es un relleno único, sobre una
-- lista cerrada de frases conocidas, y no algo que el filtro haga siempre.
-- Sin esto, en una base con historia el resumen diría "Entraron 0 casos"
-- aunque hayan entrado muchos.
--
-- Lo que no coincide con ninguna frase conocida queda sin tipo, y la
-- aplicación lo muestra en "Todo" y en ningún filtro.
-- ============================================================

alter table evento add column if not exists tipo text;
alter table evento add column if not exists monto numeric(12, 2);

alter table evento drop constraint if exists evento_tipo_check;
alter table evento add constraint evento_tipo_check
  check (tipo is null or tipo in ('entro', 'estado', 'entrega', 'plata', 'nota'));

alter table evento drop constraint if exists evento_monto_check;
alter table evento add constraint evento_monto_check
  check (monto is null or monto >= 0);

-- El historial del negocio se lee por tipo y por fecha.
create index if not exists evento_tipo_idx on evento (tipo, ocurrido_en desc);

-- ------------------------------------------------------------
-- Relleno de los eventos que ya existían
-- ------------------------------------------------------------
-- Sólo los que no tienen tipo: correrlo de nuevo no pisa nada.

update evento set tipo = 'entro'
where tipo is null and titulo = 'Caso abierto';

-- "Dieron por revisado el trabajo" es como se llamaba entregar un caso antes
-- de que el botón pasara a decir "Entregar y cerrar".
update evento set tipo = 'entrega'
where tipo is null
  and titulo in ('Entregaron el trabajo', 'Dieron por revisado el trabajo');

update evento set tipo = 'estado'
where tipo is null
  and titulo in (
    'Asignaron el caso',
    'Quedó esperando',
    'Terminó el trabajo',
    'Volvió al trabajo',
    'Volvieron a abrir el caso',
    'Llegó el insumo'
  );

update evento set tipo = 'nota'
where tipo is null
  and (
    titulo in ('Anotaron algo', 'Cargaron el diagnóstico', 'Corrigieron el diagnóstico')
    or titulo like 'Cargaron la %' or titulo like 'Cargaron el %'
    or titulo like 'Corrigieron la %' or titulo like 'Corrigieron el %'
  );

-- En los de plata el monto estaba escrito al final del detalle, con el
-- formato de acá: "Cambio de pastillas · $120.000". Se saca de ahí.
update evento set
  tipo = 'plata',
  monto = nullif(
    replace(replace(substring(detalle from '\$([0-9.,]+)$'), '.', ''), ',', '.'),
    ''
  )::numeric
where tipo is null
  and titulo in (
    'Sumaron un paso al presupuesto',
    'Sacaron un paso del presupuesto',
    'Lo aprobó el cliente',
    'El cliente no lo hace',
    'Volvieron atrás la respuesta'
  );
