-- ============================================================
-- 070_respuesta_a_recordatorio.sql — lo que contestan a un recordatorio de
-- turno se guarda y se ve en la bandeja
--
-- Correr entero en el SQL Editor de Supabase, después de la 069. Es
-- idempotente. Arregla un error de la 069, que el Supabase falso de las
-- pruebas de la API escondía y apareció al correrlas contra Postgres.
--
-- EL ERROR: cuando un cliente contesta el recordatorio de un turno, la API
-- asocia la respuesta al aviso y al negocio, pero ese aviso no tiene caso:
-- va (seguimiento_id, caso_id = null, negocio_id). El check de asociación
-- pedía los tres o ninguno, así que la fila no entraba y el webhook
-- contestaba 503. Se perdía la respuesta: el «sí» que confirma el turno, el
-- «no puedo» y también una BAJA.
--
-- Y aunque entrara, la política de lectura pedía que existiera el caso de la
-- respuesta: la bandeja no la mostraba.
--
-- QUÉ CAMBIA:
--   el check   admite también aviso y negocio sin caso (la respuesta a un
--              recordatorio de turno). Sigue sin admitir un caso sin aviso,
--              ni un aviso sin negocio.
--   la RLS     una respuesta sin caso la ve quien ve su aviso en la cola:
--              el mismo negocio y entregar_y_reabrir (seguimiento_whatsapp_ver).
--
-- Lo que NO cambia: con caso, la clave foránea compuesta de siempre sigue
-- atando aviso, caso y negocio. Sin caso, esa clave no se controla (MATCH
-- SIMPLE, como ya pasaba): el aviso y el negocio los escribe sólo el webhook,
-- con la clave de servicio, a partir del aviso que encontró.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El check: los tres, ninguno, o aviso y negocio sin caso
-- ------------------------------------------------------------
alter table seguimiento_whatsapp_respuesta
  drop constraint if exists seguimiento_whatsapp_respuesta_asociacion_check;
alter table seguimiento_whatsapp_respuesta
  add constraint seguimiento_whatsapp_respuesta_asociacion_check check (
    num_nonnulls(seguimiento_id, negocio_id) in (0, 2)
    and (caso_id is null or seguimiento_id is not null)
  );

-- ------------------------------------------------------------
-- 2. La bandeja: la de un caso, como siempre; la de un recordatorio, por su aviso
-- ------------------------------------------------------------
drop policy if exists seguimiento_whatsapp_respuesta_ver on seguimiento_whatsapp_respuesta;
create policy seguimiento_whatsapp_respuesta_ver on seguimiento_whatsapp_respuesta
  for select to authenticated
  using (
    negocio_id = mi_negocio()
    and (
      exists (select 1 from caso c
               where c.id = seguimiento_whatsapp_respuesta.caso_id
                 and c.negocio_id = seguimiento_whatsapp_respuesta.negocio_id)
      or (
        seguimiento_whatsapp_respuesta.caso_id is null
        -- Con la RLS de la cola: quien no ve el aviso, no ve lo que le contestaron.
        and exists (select 1 from seguimiento_whatsapp s
                     where s.id = seguimiento_whatsapp_respuesta.seguimiento_id
                       and s.negocio_id = seguimiento_whatsapp_respuesta.negocio_id)
      )
    )
  );
