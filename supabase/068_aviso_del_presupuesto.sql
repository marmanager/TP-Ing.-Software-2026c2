-- ============================================================
-- 068_aviso_del_presupuesto.sql — el aviso del presupuesto sin respuesta (R-5a)
--
-- Correr entero en el SQL Editor de Supabase, después de la 067.
-- Es idempotente.
--
-- YA ESTÁ CORRIDA en el proyecto: se corrió a mano como
-- "057_aviso_del_presupuesto" (el SQL vivía en el MIGRACION.md de la API) y
-- no tenía archivo. Ese nombre chocaba con 057_roles.sql. Queda acá para
-- que una base nueva salga igual. Es la misma, con un cambio: usa
-- puede_aca('entregar_y_reabrir') en vez de puedo_cargar(), que la 063 sacó
-- (lo mismo que la 058 hizo con las políticas de la cola).
--
-- Suma el cuarto tipo a la cola de WhatsApp, `presupuesto`: uno por caso,
-- que se programa al compartir el link o tocar los pasos y sale una sola
-- vez. El plazo de espera va de 1 a 90 días.
-- ============================================================

alter table seguimiento_whatsapp drop constraint if exists seguimiento_whatsapp_tipo_check;
alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_tipo_check
  check (tipo in ('cierre', 'estado', 'turno', 'volver', 'presupuesto'));

-- Un solo pendiente por caso.
create unique index if not exists seguimiento_whatsapp_un_presupuesto_por_caso
  on seguimiento_whatsapp (caso_id) where tipo = 'presupuesto' and estado = 'pendiente';

-- Programar: un caso abierto, con link, del propio negocio.
drop policy if exists seguimiento_presupuesto_programar on seguimiento_whatsapp;
create policy seguimiento_presupuesto_programar on seguimiento_whatsapp
  for insert to authenticated
  with check (
    tipo = 'presupuesto' and negocio_id = mi_negocio() and (select puede_aca('entregar_y_reabrir'))
    and estado = 'pendiente' and mensaje_id is null and error is null and motivo is null and procesado_en is null
    and exists (select 1 from caso c
                where c.id = seguimiento_whatsapp.caso_id and c.negocio_id = seguimiento_whatsapp.negocio_id
                  and c.estado <> 'completado' and c.seguimiento_codigo is not null)
  );

-- Cancelar: también con el caso entregado.
drop policy if exists seguimiento_presupuesto_cambiar on seguimiento_whatsapp;
create policy seguimiento_presupuesto_cambiar on seguimiento_whatsapp
  for update to authenticated
  using (tipo = 'presupuesto' and negocio_id = mi_negocio() and (select puede_aca('entregar_y_reabrir')) and estado = 'pendiente')
  with check (
    tipo = 'presupuesto' and negocio_id = mi_negocio() and (select puede_aca('entregar_y_reabrir'))
    and estado in ('pendiente', 'cancelado') and mensaje_id is null and error is null
    and exists (select 1 from caso c
                where c.id = seguimiento_whatsapp.caso_id and c.negocio_id = seguimiento_whatsapp.negocio_id)
  );

alter table negocio_seguimiento drop constraint if exists negocio_seguimiento_plazo;
alter table negocio_seguimiento add constraint negocio_seguimiento_plazo check (
  (tipo = 'cierre' and dias is not null and dias between 0 and 3650 and horas is null) or
  (tipo = 'turno' and horas is not null and horas between 1 and 168 and dias is null) or
  (tipo = 'volver' and dias is not null and dias between 0 and 90 and horas is null) or
  (tipo = 'presupuesto' and dias is not null and dias between 1 and 90 and horas is null)
);
