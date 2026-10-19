-- ============================================================
-- 050_recordatorio_turno.sql — el recordatorio de turno por WhatsApp
--
-- Correr entero en el SQL Editor de Supabase, después de la 049. Es
-- idempotente. Historia: R-4a (módulo seguimiento, en la API). Va ANTES de
-- desplegar la API que programa recordatorios y lee la configuración por tipo.
--
-- La cola de WhatsApp (seguimiento_whatsapp) y su configuración
-- (negocio_seguimiento) se crearon desde el panel, sin migración; los
-- nombres de sus constraints y políticas salen de pg_constraint y pg_policies. Esta suma
-- un segundo tipo de aviso: el recordatorio de turno, que cuelga de un turno
-- y no de un caso.
--
-- Cuándo programar, reprogramar o cancelar es regla de la API
-- (seguimiento/reglas-turno.ts). Acá van los checks, los índices y la RLS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La cola: un aviso cuelga de un caso o de un turno
-- ------------------------------------------------------------
-- caso_id y cerrado_en eran obligatorios: el aviso de cierre y el de cambio
-- de estado siempre tienen caso. El de turno puede no tenerlo (un turno sin
-- caso es lo común) y no tiene cierre.
alter table seguimiento_whatsapp alter column caso_id drop not null;
alter table seguimiento_whatsapp alter column cerrado_en drop not null;

alter table seguimiento_whatsapp
  add column if not exists turno_id uuid references turno(id) on delete cascade;

create index if not exists seguimiento_whatsapp_turno_idx
  on seguimiento_whatsapp (turno_id) where turno_id is not null;

-- Exactamente uno de los dos. Lo que ya estaba tiene caso: pasa.
alter table seguimiento_whatsapp drop constraint if exists seguimiento_whatsapp_caso_o_turno;
alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_caso_o_turno
  check (num_nonnulls(caso_id, turno_id) = 1);

-- Los avisos de un caso siguen teniendo su momento de cierre (o de cambio
-- de estado, que es lo que guarda ahí el aviso de estado).
alter table seguimiento_whatsapp drop constraint if exists seguimiento_whatsapp_cerrado_con_caso;
alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_cerrado_con_caso
  check (caso_id is null or cerrado_en is not null);

-- El tipo: el check de cuando se sumó 'estado' no deja entrar 'turno'.
alter table seguimiento_whatsapp drop constraint if exists seguimiento_whatsapp_tipo_check;
alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_tipo_check
  check (tipo in ('cierre', 'estado', 'turno'));

-- unique (caso_id, cerrado_en), check (enviar_en >= cerrado_en) y
-- unique (id, caso_id, negocio_id) siguen como están: con caso_id y
-- cerrado_en en null no chocan ni fallan.

-- Un turno nunca tiene dos recordatorios pendientes del mismo tipo. La API
-- lo cuida, y esto la respalda si llegan dos pedidos a la vez: el segundo
-- choca (23505) y la API lo toma como "ya había uno".
create unique index if not exists seguimiento_whatsapp_un_pendiente_por_turno
  on seguimiento_whatsapp (turno_id, tipo) where turno_id is not null and estado = 'pendiente';

-- ------------------------------------------------------------
-- 2. La RLS de la cola para los avisos de turno
-- ------------------------------------------------------------
-- seguimiento_whatsapp_ver no mira el caso: ya deja ver los de turno al
-- dueño y al encargado. Pero seguimiento_whatsapp_crear y _cancelar piden
-- que el caso exista, así que un aviso de turno no pasa por ellas. Estas se
-- suman (las permisivas se combinan con OR), sólo para tipo = 'turno', con
-- las mismas condiciones que las de caso: entra pendiente y sin resultado,
-- y del turno de un negocio que es el de quien llama. La clave foránea no
-- mira la RLS: sin el exists, alguien de A podría colgar un aviso a su
-- nombre del turno de B. Con el check "caso o turno", una fila que entra por
-- las políticas de caso no puede traer turno.
drop policy if exists seguimiento_turno_programar on seguimiento_whatsapp;
create policy seguimiento_turno_programar on seguimiento_whatsapp
  for insert to authenticated
  with check (
    tipo = 'turno' and negocio_id = mi_negocio() and puedo_cargar()
    and estado = 'pendiente' and mensaje_id is null and error is null and procesado_en is null
    and exists (select 1 from turno t
                where t.id = seguimiento_whatsapp.turno_id and t.negocio_id = seguimiento_whatsapp.negocio_id
                  and t.estado in ('agendado', 'confirmado'))
  );

-- Reprogramar (sigue pendiente) y cancelar. Sólo lo pendiente: lo que el
-- procesador tomó o mandó no se toca.
drop policy if exists seguimiento_turno_cambiar on seguimiento_whatsapp;
create policy seguimiento_turno_cambiar on seguimiento_whatsapp
  for update to authenticated
  using (tipo = 'turno' and negocio_id = mi_negocio() and puedo_cargar() and estado = 'pendiente')
  with check (
    tipo = 'turno' and negocio_id = mi_negocio() and puedo_cargar()
    and estado in ('pendiente', 'cancelado') and mensaje_id is null
    and exists (select 1 from turno t
                where t.id = seguimiento_whatsapp.turno_id and t.negocio_id = seguimiento_whatsapp.negocio_id)
  );

-- ------------------------------------------------------------
-- 3. La configuración, por tipo
-- ------------------------------------------------------------
-- Era una fila por negocio con { activo, dias, mensaje }: el aviso de cierre.
-- Pasa a una fila por (negocio, tipo). Lo que había queda como 'cierre' y
-- sigue andando igual, sin que nadie lo reconfigure. El de turno va en
-- horas: "un día antes" es 24.
alter table negocio_seguimiento add column if not exists tipo text not null default 'cierre';
alter table negocio_seguimiento add column if not exists horas integer;
alter table negocio_seguimiento alter column dias drop not null;
alter table negocio_seguimiento alter column dias drop default;

-- La clave era negocio_id solo: pasa a (negocio_id, tipo).
alter table negocio_seguimiento drop constraint if exists negocio_seguimiento_pkey;
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'negocio_seguimiento'::regclass and conname = 'negocio_seguimiento_pkey_tipo') then
    alter table negocio_seguimiento add constraint negocio_seguimiento_pkey_tipo primary key (negocio_id, tipo);
  end if;
end;
$$;

-- Las políticas de negocio_seguimiento (ver, crear, editar) miran negocio_id
-- y puedo_cargar(): valen igual para la fila de cada tipo.

-- Cada tipo con su plazo: el de cierre en días, el de turno en horas (hasta
-- una semana). Los rangos que ve la persona los valida la API.
alter table negocio_seguimiento drop constraint if exists negocio_seguimiento_plazo;
alter table negocio_seguimiento add constraint negocio_seguimiento_plazo check (
  (tipo = 'cierre' and dias is not null and dias between 0 and 3650 and horas is null) or
  (tipo = 'turno' and horas is not null and horas between 1 and 168 and dias is null)
);

comment on column negocio_seguimiento.tipo is
  'cierre: el aviso posventa, en días. turno: el recordatorio de turno, en horas.';
comment on column seguimiento_whatsapp.turno_id is
  'El turno del recordatorio (tipo turno). Los avisos de cierre y de estado cuelgan de caso_id.';
