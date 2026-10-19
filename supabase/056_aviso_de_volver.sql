-- ============================================================
-- 056_aviso_de_volver.sql — el aviso de "le toca volver" por WhatsApp
--
-- Correr entero en el SQL Editor de Supabase, después de la 055. Es
-- idempotente. Historia: R-2a (módulo seguimiento, en la API). Va ANTES de
-- desplegar la API que programa el aviso de volver: sin ella, GET y PATCH
-- /v1/negocio/seguimiento con `volver` fallan (el check de plazo no deja
-- entrar la fila), y entregar con fecha de volver queda sin aviso.
--
-- QUÉ AGREGA:
--   seguimiento_whatsapp.tipo     un tercer tipo de aviso, 'volver', que
--                                 cuelga del caso que lo generó.
--   seguimiento_whatsapp.motivo   por qué se canceló un aviso al revisarlo
--                                 (baja_de_avisos, ya_volvio...). El front
--                                 lo traduce por código; `error` sigue
--                                 siendo sólo lo que rechaza Kapso.
--   negocio_seguimiento 'volver'  activo, días de anticipación y mensaje.
--
-- Cuándo programar, reprogramar, cancelar y si mandarlo al momento de
-- enviar es regla de la API (seguimiento/reglas-volver.ts). Acá van los
-- checks, los índices y la RLS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La cola: el tercer tipo y el motivo
-- ------------------------------------------------------------
alter table seguimiento_whatsapp drop constraint if exists seguimiento_whatsapp_tipo_check;
alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_tipo_check
  check (tipo in ('cierre', 'estado', 'turno', 'volver'));

alter table seguimiento_whatsapp add column if not exists motivo text;

-- El motivo es de un aviso que no salió porque no tenía sentido. Uno que
-- falló al mandarlo lleva su `error`, no un motivo.
alter table seguimiento_whatsapp drop constraint if exists seguimiento_whatsapp_motivo_si_cancelado;
alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_motivo_si_cancelado
  check (motivo is null or estado = 'cancelado');

-- El aviso de volver cuelga del caso y guarda en cerrado_en cuándo se
-- programó (el check de la 050 pide cerrado_en con caso, y el de antes,
-- enviar_en >= cerrado_en). El unique (caso_id, cerrado_en) de cuando la
-- cola se creó desde el panel lo haría chocar con el posventa de la misma
-- entrega si caen en el mismo instante: pasa a ser por tipo. El nombre sale
-- de pg_constraint (o de pg_index, si se creó como índice).
do $$
declare
  columnas smallint[] := array[
    (select attnum from pg_attribute where attrelid = 'seguimiento_whatsapp'::regclass and attname = 'caso_id'),
    (select attnum from pg_attribute where attrelid = 'seguimiento_whatsapp'::regclass and attname = 'cerrado_en')
  ];
  viejo record;
begin
  for viejo in
    select conname from pg_constraint
    where conrelid = 'seguimiento_whatsapp'::regclass and contype = 'u'
      and conkey @> columnas and conkey <@ columnas
  loop
    execute format('alter table seguimiento_whatsapp drop constraint %I', viejo.conname);
  end loop;

  for viejo in
    select c.relname from pg_index i join pg_class c on c.oid = i.indexrelid
    where i.indrelid = 'seguimiento_whatsapp'::regclass and i.indisunique and not i.indisprimary
      and i.indkey::smallint[] @> columnas and i.indkey::smallint[] <@ columnas
      and not exists (select 1 from pg_constraint where conindid = i.indexrelid)
  loop
    execute format('drop index %I', viejo.relname);
  end loop;

  if not exists (select 1 from pg_constraint
                 where conrelid = 'seguimiento_whatsapp'::regclass and conname = 'seguimiento_whatsapp_caso_cerrado_tipo') then
    alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_caso_cerrado_tipo
      unique (caso_id, cerrado_en, tipo);
  end if;
end;
$$;

-- Un caso nunca tiene dos avisos de volver pendientes. La API lo cuida, y
-- esto la respalda si llegan dos pedidos a la vez: el segundo choca (23505)
-- y la API lo toma como "ya había uno". Igual que el de turno en la 050.
create unique index if not exists seguimiento_whatsapp_un_volver_por_caso
  on seguimiento_whatsapp (caso_id) where tipo = 'volver' and estado = 'pendiente';

-- ------------------------------------------------------------
-- 2. La RLS de la cola para los avisos de volver
-- ------------------------------------------------------------
-- Como las de turno de la 050: se suman a las de caso (las permisivas se
-- combinan con OR), sólo para tipo = 'volver'. Entra pendiente y sin
-- resultado, del caso ENTREGADO de un negocio que es el de quien llama: la
-- clave foránea no mira la RLS, y sin el exists alguien de A podría colgar
-- un aviso del caso de B.
drop policy if exists seguimiento_volver_programar on seguimiento_whatsapp;
create policy seguimiento_volver_programar on seguimiento_whatsapp
  for insert to authenticated
  with check (
    tipo = 'volver' and negocio_id = mi_negocio() and puedo_cargar()
    and estado = 'pendiente' and mensaje_id is null and error is null and motivo is null and procesado_en is null
    and exists (select 1 from caso c
                where c.id = seguimiento_whatsapp.caso_id and c.negocio_id = seguimiento_whatsapp.negocio_id
                  and c.estado = 'completado' and c.volver_en is not null)
  );

-- Reprogramar (sigue pendiente) y cancelar. Sólo lo pendiente: lo que el
-- procesador tomó o mandó no se toca. El procesador escribe con la clave
-- de servicio y no pasa por acá.
drop policy if exists seguimiento_volver_cambiar on seguimiento_whatsapp;
create policy seguimiento_volver_cambiar on seguimiento_whatsapp
  for update to authenticated
  using (tipo = 'volver' and negocio_id = mi_negocio() and puedo_cargar() and estado = 'pendiente')
  with check (
    tipo = 'volver' and negocio_id = mi_negocio() and puedo_cargar()
    and estado in ('pendiente', 'cancelado') and mensaje_id is null and error is null
    and exists (select 1 from caso c
                where c.id = seguimiento_whatsapp.caso_id and c.negocio_id = seguimiento_whatsapp.negocio_id)
  );

-- ------------------------------------------------------------
-- 3. La configuración del tercer tipo
-- ------------------------------------------------------------
-- En días, como el de cierre, pero ANTES de la fecha anotada (los del
-- posventa son DESPUÉS del cierre). Hasta tres meses antes.
alter table negocio_seguimiento drop constraint if exists negocio_seguimiento_plazo;
alter table negocio_seguimiento add constraint negocio_seguimiento_plazo check (
  (tipo = 'cierre' and dias is not null and dias between 0 and 3650 and horas is null) or
  (tipo = 'turno' and horas is not null and horas between 1 and 168 and dias is null) or
  (tipo = 'volver' and dias is not null and dias between 0 and 90 and horas is null)
);

comment on column negocio_seguimiento.tipo is
  'cierre: el aviso posventa, en días después del cierre. turno: el recordatorio de turno, en horas. '
  'volver: el aviso de cuándo le toca volver, en días antes de la fecha anotada.';
comment on column seguimiento_whatsapp.motivo is
  'Por qué se canceló sin mandarse (R-2a): sin_fecha, ya_paso, baja_de_avisos, desactivado, ya_esta_aca, '
  'ya_volvio, tope_del_mes... El front lo traduce por código. null en lo demás.';
