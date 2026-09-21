-- ============================================================
-- 023_horarios_del_negocio.sql — cuándo atiende, y cuánto ocupa un turno
--
-- Correr entero en el SQL Editor de Supabase, después de 001..022.
-- Es idempotente.
--
-- QUÉ RESUELVE:
-- Para que un cliente pueda pedir turno solo hay que poder contestarle dos
-- preguntas: cuándo atiende el negocio, y cuáles de esos huecos están
-- libres. Hoy no se puede contestar ninguna de las dos: los turnos se
-- cargan a mano, a la hora que sea, y no hay en ningún lado los días y
-- horarios en los que el negocio trabaja.
--
-- ESTO NO CONTRADICE A 010, AUNQUE LO PAREZCA:
-- La 010 sacó "minutos" del turno, y tenía razón: cuánto va a DURAR el
-- trabajo no se sabe de antemano. En un taller no se puede medir hasta que
-- el auto está arriba.
--
-- Lo que vuelve es otra cosa, y por eso se llama distinto: cuántos minutos
-- OCUPA ese turno en la agenda. No es una predicción sobre el trabajo, es
-- una decisión del negocio —"doy turnos cada media hora"— y es lo único que
-- permite decirle a alguien "el martes a las 10 está libre". El auto puede
-- quedarse tres días; el hueco de la agenda fue de media hora.
--
-- Queda copiado en cada turno y no se lee de la configuración: si mañana el
-- negocio pasa sus turnos de 30 a 45 minutos, la agenda de ayer no se
-- reescribe sola.
--
-- LAS DOS COLUMNAS DE GOOGLE:
-- Hoy no las escribe nadie. Están para que el día que exista el servidor que
-- sincroniza con Google Calendar pueda saber qué turno ya subió y cuál no,
-- sin tener que adivinarlo ni volver a subir todo. Sin ellas, esa
-- integración empieza por una migración en vez de por su propio código.
-- ============================================================

-- ------------------------------------------------------------
-- Cuánto ocupa el turno
-- ------------------------------------------------------------
-- Nulo en los turnos viejos, que se cargaron cuando esto no existía: no se
-- les inventa una duración hacia atrás. Para la agenda siguen siendo lo que
-- siempre fueron, una hora de inicio.
alter table turno add column if not exists minutos_reservados integer;

alter table turno drop constraint if exists turno_minutos_positivos;
alter table turno add constraint turno_minutos_positivos
  check (minutos_reservados is null or minutos_reservados > 0);

-- ------------------------------------------------------------
-- Quién lo pidió
-- ------------------------------------------------------------
-- Un turno que pidió el cliente desde el link no es lo mismo que uno que
-- cargó alguien del mostrador: al primero todavía no lo confirmó nadie del
-- negocio, y en la agenda conviene que se note.
alter table turno add column if not exists origen text not null default 'mostrador';

alter table turno drop constraint if exists turno_origen_check;
alter table turno add constraint turno_origen_check
  check (origen in ('mostrador', 'cliente'));

-- ------------------------------------------------------------
-- La costura con Google Calendar
-- ------------------------------------------------------------
-- Nulas mientras no haya integración. El día que la haya, quien sincroniza
-- es un servidor con sus propias credenciales: ni el navegador ni esta base
-- hablan con Google.
alter table turno add column if not exists google_evento_id text;
alter table turno add column if not exists sincronizado_en  timestamptz;

-- ------------------------------------------------------------
-- Cuándo atiende el negocio
-- ------------------------------------------------------------
-- Nulo es "no lo configuró todavía", que no es lo mismo que "no atiende
-- ningún día". Con nulo, la página pública de turnos no puede abrir: no hay
-- nada que ofrecer.
--
-- Va como jsonb y no como tabla de rangos por dos motivos. Uno: es
-- configuración de un negocio, se lee entera y se escribe entera, nunca se
-- consulta por partes. Dos: lo mismo hace "inicio", que es la otra
-- configuración de pantalla que ya vive acá.
alter table negocio add column if not exists horarios jsonb;

-- ------------------------------------------------------------
-- Dos turnos no pueden ocupar el mismo lugar
-- ------------------------------------------------------------
-- Un turno cancelado libera el horario: queda en la agenda para que se sepa
-- que estaba, pero no reserva nada.
--
-- El índice es la garantía de verdad, la que no se puede saltear ni con dos
-- personas reservando en el mismo segundo. La función que reserva chequea
-- igual, para poder contestar con una frase en vez de con un error.
--
-- OJO: si la base ya tiene dos turnos a la misma hora, el índice no se puede
-- crear. En vez de hacer fallar la migración entera —dejando las columnas de
-- arriba a medio aplicar— avisa y sigue. Después se limpian los choques y se
-- corre esto de nuevo, que para eso es idempotente.
do $$
declare
  choques integer;
begin
  select count(*) into choques from (
    select negocio_id, empieza_en
    from turno
    where estado <> 'cancelado'
    group by negocio_id, empieza_en
    having count(*) > 1
  ) as repetidos;

  if choques > 0 then
    raise warning 'NO se creó el índice que impide dos turnos a la misma hora: ya hay % horarios repetidos. Mirálos con la consulta de abajo, resolvé los choques y volvé a correr esta migración.', choques;
    raise warning 'select negocio_id, empieza_en, count(*) from turno where estado <> ''cancelado'' group by 1, 2 having count(*) > 1;';
  else
    create unique index if not exists turno_horario_unico
      on turno (negocio_id, empieza_en)
      where estado <> 'cancelado';
  end if;
end $$;
