-- ============================================================
-- 024_pedir_turno.sql — el cliente pide su turno solo
--
-- Correr entero en el SQL Editor de Supabase, después de 001..023.
-- Es idempotente.
--
-- QUÉ RESUELVE:
-- Pedir un turno era llamar al negocio y que alguien lo anotara a mano. Con
-- esto el negocio comparte un link, el cliente entra sin cuenta, ve los
-- horarios que quedan libres y reserva. Es el mismo problema que el link de
-- seguimiento —que el teléfono no suene— del otro lado del mostrador.
--
-- LA SEGURIDAD ES LA DE SIEMPRE:
-- Mismo patrón que 007 y 018. Quien abre el link no pertenece al negocio, así
-- que mi_negocio() le da NULL y ninguna política lo deja leer nada. Todo pasa
-- por funciones "security definer" que piden el código, que es la llave.
--
-- QUÉ SE EXPONE, Y QUÉ NO:
-- El nombre del negocio, sus horarios, y CUÁNDO está ocupado. Lo que no sale
-- es quién ocupa cada turno: viajan instantes, no personas. Cualquiera que
-- entre va a saber que el martes a las 10 no hay lugar, que es exactamente lo
-- que necesita saber, y nada sobre quién lo tomó.
--
-- LA ZONA HORARIA, QUE ES UNA DECISIÓN:
-- "empieza_en" es timestamptz, o sea un instante, pero "atiende de 9 a 18" es
-- hora local. Para cruzar las dos cosas hace falta una zona, y acá está
-- clavada en la de Argentina. Es coherente con el resto del sistema —los
-- teléfonos, los pesos, las fechas en español— y con lo que hace el navegador
-- en src/lib/horarios.js. El día que haya un negocio en otro huso, esto y ese
-- archivo son los dos lugares donde se arregla.
-- ============================================================

-- ------------------------------------------------------------
-- El link de la agenda
-- ------------------------------------------------------------
-- Uno por negocio, no por turno: es la puerta a pedir, no a mirar algo
-- puntual. Nulo quiere decir que no se está compartiendo.
alter table negocio add column if not exists agenda_codigo text;

create unique index if not exists negocio_agenda_codigo_idx
  on negocio (agenda_codigo);

-- ------------------------------------------------------------
-- Empezar y dejar de compartir la agenda
-- ------------------------------------------------------------
-- Devuelve siempre el mismo código: uno nuevo dejaría muerto el link que el
-- negocio ya puso en su perfil de Instagram.
create or replace function compartir_agenda()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yo     uuid := mi_negocio();
  actual text;
begin
  if yo is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if mi_rol() <> 'duenio' then
    raise exception 'Compartir la agenda lo hace el dueño del negocio.';
  end if;

  select agenda_codigo into actual from negocio where id = yo for update;
  if actual is not null then
    return actual;
  end if;

  loop
    actual := encode(gen_random_bytes(16), 'hex');
    exit when not exists (select 1 from negocio where agenda_codigo = actual);
  end loop;

  update negocio set agenda_codigo = actual where id = yo;
  return actual;
end;
$$;

revoke all on function compartir_agenda() from public;
revoke all on function compartir_agenda() from anon;
grant execute on function compartir_agenda() to authenticated;


create or replace function dejar_de_compartir_agenda()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_negocio() is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if mi_rol() <> 'duenio' then
    raise exception 'Dejar de compartir la agenda lo hace el dueño del negocio.';
  end if;

  update negocio set agenda_codigo = null where id = mi_negocio();
end;
$$;

revoke all on function dejar_de_compartir_agenda() from public;
revoke all on function dejar_de_compartir_agenda() from anon;
grant execute on function dejar_de_compartir_agenda() to authenticated;

-- ------------------------------------------------------------
-- ¿Ese horario es uno de los que el negocio ofrece?
-- ------------------------------------------------------------
-- La lista de horarios se arma en el navegador, pero no se le puede creer:
-- quien manda la reserva puede mandar cualquier instante. Esto vuelve a
-- hacer la cuenta del lado de la base.
--
-- Es la misma regla que src/lib/horarios.js: el día tiene que estar entre los
-- que atiende, la hora tiene que caer en un tramo, y tiene que estar parada
-- justo sobre la grilla —si los turnos son de 30 minutos, a las 10:15 no
-- empieza ninguno—.
create or replace function hueco_ofrecido(p_horarios jsonb, p_cuando timestamptz)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  zona    text := 'America/Argentina/Buenos_Aires';
  local   timestamp;
  clave   text;
  minutos integer;
  m       integer;
  abre    integer;
  cierra  integer;
  corte_a integer;
  corte_b integer;
begin
  if p_horarios is null then return false; end if;

  local := p_cuando at time zone zona;

  -- La semana de Postgres arranca el domingo con 0, igual que la de
  -- JavaScript. Las claves son las mismas que usa la configuración.
  clave := (array['dom','lun','mar','mie','jue','vie','sab'])[extract(dow from local)::int + 1];
  if not (p_horarios -> 'dias' ? clave) then return false; end if;

  minutos := coalesce((p_horarios ->> 'minutos')::int, 30);
  if minutos <= 0 then return false; end if;

  m      := extract(hour from local)::int * 60 + extract(minute from local)::int;
  abre   := split_part(p_horarios ->> 'desde', ':', 1)::int * 60
          + split_part(p_horarios ->> 'desde', ':', 2)::int;
  cierra := split_part(p_horarios ->> 'hasta', ':', 1)::int * 60
          + split_part(p_horarios ->> 'hasta', ':', 2)::int;

  if extract(second from local)::int <> 0 then return false; end if;
  if m < abre or m + minutos > cierra then return false; end if;
  if (m - abre) % minutos <> 0 then return false; end if;

  -- El corte del mediodía: adentro no hay turnos, y la grilla de la tarde
  -- vuelve a arrancar desde la hora de volver.
  if p_horarios -> 'corte' is not null and jsonb_typeof(p_horarios -> 'corte') = 'object' then
    corte_a := split_part(p_horarios #>> '{corte,desde}', ':', 1)::int * 60
             + split_part(p_horarios #>> '{corte,desde}', ':', 2)::int;
    corte_b := split_part(p_horarios #>> '{corte,hasta}', ':', 1)::int * 60
             + split_part(p_horarios #>> '{corte,hasta}', ':', 2)::int;

    if m + minutos > corte_a and m < corte_b then return false; end if;
    if m >= corte_b and (m - corte_b) % minutos <> 0 then return false; end if;
  end if;

  return true;
end;
$$;

-- ------------------------------------------------------------
-- Lo que ve el cliente antes de elegir
-- ------------------------------------------------------------
-- Los horarios del negocio y cuándo está ocupado. Los huecos los arma el
-- navegador con esos dos datos: así la lista se puede pintar sin ir y venir
-- por cada día.
--
-- De los turnos ocupados viajan el instante y cuánto duran. Nada más: ni
-- quién es, ni por qué vino, ni si confirmó.
create or replace function ver_agenda_publica(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n negocio%rowtype;
begin
  if p_codigo is null or length(p_codigo) < 8 then
    return jsonb_build_object('sirve', false);
  end if;

  select * into n from negocio where agenda_codigo = p_codigo;
  if not found then
    return jsonb_build_object('sirve', false);
  end if;

  -- Sin horarios cargados no hay nada que ofrecer, y es distinto de que el
  -- link no sirva: la pantalla lo cuenta de otra manera.
  return jsonb_build_object(
    'sirve', true,
    'negocio_nombre', n.nombre,
    'negocio_telefono', nullif(trim(coalesce(n.telefono, '')), ''),
    'rubro', n.rubro,
    'horarios', n.horarios,
    'ocupados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'empieza_en', t.empieza_en,
               'minutos_reservados', t.minutos_reservados))
      from turno t
      where t.negocio_id = n.id
        and t.estado <> 'cancelado'
        and t.empieza_en >= now() - interval '1 day'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function ver_agenda_publica(text) from public;
grant execute on function ver_agenda_publica(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Reservar
-- ------------------------------------------------------------
-- Devuelve { ok: true, cuando } o { ok: false, motivo }, con los motivos
-- escritos para que el cliente los lea tal cual.
--
-- El cliente que se anota queda "por confirmar": pidió turno, pero todavía
-- no vino. Es la misma marca que usa el mostrador cuando anota a alguien por
-- teléfono, y se confirma sola cuando se le abre el primer caso.
--
-- El turno nace "agendado" y con origen 'cliente'. Confirmarlo es del
-- negocio: nadie del taller lo vio todavía.
create or replace function reservar_turno(
  p_codigo   text,
  p_cuando   timestamptz,
  p_motivo   text,
  p_nombre   text,
  p_telefono text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n          negocio%rowtype;
  minutos    integer;
  anticipa   numeric;
  id_cliente uuid;
begin
  if p_codigo is null or length(p_codigo) < 8 then
    return jsonb_build_object('ok', false, 'existe', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
  end if;

  select * into n from negocio where agenda_codigo = p_codigo;
  if not found then
    return jsonb_build_object('ok', false, 'existe', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
  end if;

  if n.horarios is null then
    return jsonb_build_object('ok', false, 'motivo', 'El negocio todavía no publicó sus horarios.');
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'Necesitamos tu nombre para anotarte.');
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'Contanos para qué venís.');
  end if;

  minutos  := coalesce((n.horarios ->> 'minutos')::int, 30);
  anticipa := coalesce((n.horarios ->> 'anticipacionHoras')::numeric, 0);

  if p_cuando < now() + (anticipa * interval '1 hour') then
    return jsonb_build_object('ok', false, 'motivo', 'Ese horario ya no se puede pedir. Elegí otro de la lista.');
  end if;

  if not hueco_ofrecido(n.horarios, p_cuando) then
    return jsonb_build_object('ok', false, 'motivo', 'Ese horario no es uno de los que atiende el negocio. Elegí uno de la lista.');
  end if;

  -- El chequeo que se ve, para poder contestar con una frase. El de verdad
  -- —el que aguanta dos personas reservando en el mismo segundo— es el
  -- índice único de 023, que se atrapa más abajo.
  if exists (
    select 1 from turno
    where negocio_id = n.id
      and estado <> 'cancelado'
      and tstzrange(empieza_en, empieza_en + (coalesce(minutos_reservados, minutos) * interval '1 minute'))
          && tstzrange(p_cuando, p_cuando + (minutos * interval '1 minute'))
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'Justo te lo ganaron. Elegí otro horario.');
  end if;

  insert into cliente (negocio_id, nombre, telefono, confirmado)
  values (n.id, trim(p_nombre), nullif(trim(coalesce(p_telefono, '')), ''), false)
  returning id into id_cliente;

  begin
    insert into turno (negocio_id, cliente_id, motivo, empieza_en, estado, origen, minutos_reservados)
    values (n.id, id_cliente, trim(p_motivo), p_cuando, 'agendado', 'cliente', minutos);
  exception when unique_violation then
    -- Dos personas tocaron el botón en el mismo segundo. El índice atajó a
    -- la segunda; acá se le contesta con palabras y se borra el cliente que
    -- se había creado para ella.
    delete from cliente where id = id_cliente;
    return jsonb_build_object('ok', false, 'motivo', 'Justo te lo ganaron. Elegí otro horario.');
  end;

  return jsonb_build_object('ok', true, 'cuando', p_cuando, 'minutos', minutos);
end;
$$;

revoke all on function reservar_turno(text, timestamptz, text, text, text) from public;
grant execute on function reservar_turno(text, timestamptz, text, text, text) to anon, authenticated;
