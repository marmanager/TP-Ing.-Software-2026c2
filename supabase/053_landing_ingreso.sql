-- ============================================================
-- 053_landing_ingreso.sql — el link, la página pública y el ingreso de los
-- clientes a la landing
--
-- Correr entero en el SQL Editor de Supabase, después de la 052. Es
-- idempotente. Diseño: docs/landing-por-negocio.md (paso 3). Prueba:
-- pruebas/landing.sql (antes de esta migración falla; después, "Success").
--
-- QUÉ AGREGA:
--   negocio.landing_codigo  el link de la landing. null = no publicada.
--   turno.identificador     la patente (o lo que use el rubro) de quien se
--                           registra sacando turno y todavía no tiene casos.
--   landing_sesion          los clientes que entraron: sólo la huella de su llave.
--   landing_intento         los ingresos fallidos, para el bloqueo.
--   ver_landing, ver_agenda_landing, ingresar_landing, mis_casos_landing,
--   mis_turnos_landing y reservar_turno_landing: lo que llama la API pública.
--
-- Y REDEFINE, SIN CAMBIAR LO QUE CONTESTAN:
--   ver_agenda_publica y reservar_turno (024): su cuerpo pasa a funciones
--   internas que también usa la landing. Misma firma, mismas respuestas.
--   ver_seguimiento (026): suma landing y landing_codigo del negocio.
--
-- LA SEGURIDAD ES LA DE SIEMPRE (018, 024): el cliente no tiene cuenta, así
-- que todo pasa por funciones "security definer" que piden el código. Lo
-- nuevo es la llave. El identificador solo no es secreto (la patente está
-- pegada en el auto), así que para ver casos y turnos hace falta además el
-- final del teléfono que el negocio tiene cargado, y lo verifica la base.
-- Con 5 fallidos en 15 minutos para el mismo identificador, se bloquea.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cómo se reconoce al cliente
-- ------------------------------------------------------------
-- Un cliente nuevo todavía no tiene casos: el identificador con el que se
-- registra queda en el turno que saca. Cuando el negocio le abre el caso
-- desde ese turno, el identificador pasa al caso.
alter table turno add column if not exists identificador text;

-- "ab 123-cd" y "AB123CD" son la misma patente: mayúsculas y sin nada que no
-- sea letra o número. null da '', que no coincide con nada.
--
-- Immutable para poder indexarla. Ésta y ultimos_cuatro() quedan sin revoke a
-- propósito, como hueco_ofrecido() (024): no leen ninguna tabla, no exponen
-- nada. A authenticated se le da explícito: los índices de abajo la evalúan
-- con el usuario que carga el caso o el turno, y sin permiso de ejecución esa
-- carga fallaría.
create or replace function normalizar_identificador(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

grant execute on function normalizar_identificador(text) to authenticated;

-- Los últimos 4 dígitos de un teléfono, sacando todo lo que no sea número.
-- Con menos de 4 dígitos devuelve menos, y eso no coincide con ningún ingreso:
-- un cliente sin teléfono cargado no puede entrar.
create or replace function ultimos_cuatro(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 4);
$$;

-- El índice de la 009 compara el identificador tal cual; éstos, normalizado,
-- que es como lo busca el ingreso.
create index if not exists caso_identificador_normalizado_idx
  on caso (negocio_id, normalizar_identificador(identificador));
create index if not exists turno_identificador_normalizado_idx
  on turno (negocio_id, normalizar_identificador(identificador));

-- ------------------------------------------------------------
-- 2. Las llaves y los intentos
-- ------------------------------------------------------------
-- Una fila por cliente que entró. La llave viaja al navegador y acá queda
-- sólo su huella (sha256): quien llegue a leer la tabla no puede entrar con
-- lo que ve. identificador (normalizado) y ultimos4 son con qué entró: es lo
-- que se vuelve a buscar en cada pedido. Dura 12 horas.
create table if not exists landing_sesion (
  huella        text        primary key,
  negocio_id    uuid        not null references negocio (id) on delete cascade,
  identificador text        not null,
  ultimos4      text        not null,
  vence_en      timestamptz not null,
  creada_en     timestamptz not null default now()
);

-- Los ingresos fallidos, para el bloqueo. Vencen solos a los 15 minutos:
-- entrar bien no los borra (ver ingresar_landing).
create table if not exists landing_intento (
  id            uuid        primary key default gen_random_uuid(),
  negocio_id    uuid        not null references negocio (id) on delete cascade,
  identificador text        not null,
  creado_en     timestamptz not null default now()
);

create index if not exists landing_intento_idx
  on landing_intento (negocio_id, identificador, creado_en);

-- Sin políticas a propósito, como solicitud_de_ingreso (051): nadie las lee
-- ni las escribe directo, sólo las funciones de abajo.
alter table landing_sesion enable row level security;
revoke all on landing_sesion from anon;
revoke all on landing_sesion from authenticated;

alter table landing_intento enable row level security;
revoke all on landing_intento from anon;
revoke all on landing_intento from authenticated;

-- ------------------------------------------------------------
-- 3. El link de la landing
-- ------------------------------------------------------------
-- Uno por negocio, aparte del de la agenda: si el negocio apaga el link de
-- turnos, la landing no se cae.
alter table negocio add column if not exists landing_codigo text;

create unique index if not exists negocio_landing_codigo_idx
  on negocio (landing_codigo);

-- Copia de compartir_agenda() (024): devuelve siempre el mismo código, porque
-- uno nuevo dejaría muerto el link que el negocio ya puso en su Instagram.
create or replace function compartir_landing()
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
  if mi_rol() is distinct from 'duenio' then
    raise exception 'Compartir la landing lo hace el dueño del negocio.';
  end if;

  select landing_codigo into actual from negocio where id = yo for update;
  if actual is not null then
    return actual;
  end if;

  loop
    actual := replace(gen_random_uuid()::text, '-', '');
    exit when not exists (select 1 from negocio where landing_codigo = actual);
  end loop;

  update negocio set landing_codigo = actual where id = yo;
  return actual;
end;
$$;

revoke all on function compartir_landing() from public;
revoke all on function compartir_landing() from anon;
grant execute on function compartir_landing() to authenticated;

-- El link deja de funcionar acá mismo, y con él las llaves de quienes estaban
-- adentro: si el dueño lo apaga, no quiere a nadie entrando por ahí.
create or replace function dejar_de_compartir_landing()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_negocio() is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if mi_rol() is distinct from 'duenio' then
    raise exception 'Dejar de compartir la landing lo hace el dueño del negocio.';
  end if;

  update negocio set landing_codigo = null where id = mi_negocio();
  delete from landing_sesion where negocio_id = mi_negocio();
end;
$$;

revoke all on function dejar_de_compartir_landing() from public;
revoke all on function dejar_de_compartir_landing() from anon;
grant execute on function dejar_de_compartir_landing() to authenticated;

-- ------------------------------------------------------------
-- 4. Las internas
-- ------------------------------------------------------------
-- Las usan las públicas de abajo y las de la 024. Nadie de afuera las llama:
-- revoke a public, anon y authenticated (Supabase les da ejecución a anon y
-- authenticated por su cuenta, así que no alcanza con public). No son
-- security definer: siempre las llama una que sí lo es, y corren con sus
-- permisos.

-- El negocio de un link de landing, o null.
create or replace function landing_del_codigo(p_codigo text)
returns negocio
language sql
stable
set search_path = public
as $$
  select * from negocio
   where length(p_codigo) >= 8
     and landing_codigo = p_codigo;
$$;

revoke all on function landing_del_codigo(text) from public, anon, authenticated;

-- Quiénes entran con ese identificador (normalizado) y esos 4 dígitos: los
-- clientes del negocio con un teléfono que termina así y un caso o un turno
-- con ese identificador. Las dos cosas juntas: si una patente cambió de
-- dueño, el teléfono separa lo de cada uno. Pueden ser varios (la misma
-- persona anotada "por confirmar" y después de verdad), y se ve lo de todos.
create or replace function clientes_de_la_landing(p_negocio uuid, p_identificador text, p_ultimos4 text)
returns setof uuid
language sql
stable
set search_path = public
as $$
  select cl.id
    from cliente cl
   where cl.negocio_id = p_negocio
     and p_identificador <> ''
     and length(p_ultimos4) = 4
     and ultimos_cuatro(cl.telefono) = p_ultimos4
     and cl.id in (
           select c.cliente_id from caso c
            where c.negocio_id = p_negocio
              and normalizar_identificador(c.identificador) = p_identificador
           union
           select t.cliente_id from turno t
            where t.negocio_id = p_negocio
              and normalizar_identificador(t.identificador) = p_identificador);
$$;

revoke all on function clientes_de_la_landing(uuid, text, text) from public, anon, authenticated;

-- La sesión de una llave, si es de ese negocio y no venció; si no, null.
create or replace function sesion_de_la_llave(p_negocio uuid, p_llave text)
returns landing_sesion
language sql
stable
set search_path = public
as $$
  select * from landing_sesion
   where huella = encode(sha256(convert_to(p_llave, 'UTF8')), 'hex')
     and negocio_id = p_negocio
     and vence_en > now();
$$;

revoke all on function sesion_de_la_llave(uuid, text) from public, anon, authenticated;

-- Abre una sesión y devuelve { llave, vence_en }. La llave son dos uuid al
-- azar sin guiones (64 caracteres, 244 bits): no se adivina. Se guarda sólo
-- la huella. La usan el ingreso y el registro, para que sea una sola regla.
create or replace function abrir_sesion_landing(p_negocio uuid, p_identificador text, p_ultimos4 text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  llave text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  vence timestamptz := now() + interval '12 hours';
begin
  insert into landing_sesion (huella, negocio_id, identificador, ultimos4, vence_en)
  values (encode(sha256(convert_to(llave, 'UTF8')), 'hex'), p_negocio, p_identificador, p_ultimos4, vence);

  return jsonb_build_object('llave', llave, 'vence_en', vence);
end;
$$;

revoke all on function abrir_sesion_landing(uuid, text, text) from public, anon, authenticated;

-- ¿Ese identificador está bloqueado en ese negocio? 5 fallidos en 15 minutos.
-- Antes de contar toma un candado por (negocio, identificador) hasta el final
-- de la transacción: sin él, veinte pedidos al mismo tiempo contarían los
-- mismos cuatro fallidos y pasarían todos. Con él, cada uno ve los fallidos
-- que anotaron los anteriores.
create or replace function landing_bloqueada(p_negocio uuid, p_identificador text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_negocio::text || ' ' || p_identificador, 0));

  return (select count(*)
            from landing_intento
           where negocio_id = p_negocio
             and identificador = p_identificador
             and creado_en > now() - interval '15 minutes') >= 5;
end;
$$;

revoke all on function landing_bloqueada(uuid, text) from public, anon, authenticated;

-- Lo que ve el cliente antes de elegir un turno: el cuerpo de
-- ver_agenda_publica() (024) desde que encontró el negocio, tal cual. Lo
-- usan ella y ver_agenda_landing(), así contestan lo mismo.
--
-- De los turnos ocupados viajan el instante y cuánto duran. Nada más: ni
-- quién es, ni por qué vino, ni si confirmó.
create or replace function agenda_del_negocio(n negocio)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
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

revoke all on function agenda_del_negocio(negocio) from public, anon, authenticated;

-- ¿Se puede reservar ese horario? null si sí; si no, la frase para el
-- cliente. Son los chequeos de reservar_turno() (024) después del nombre,
-- en el mismo orden y con las mismas palabras.
--
-- La lista de horarios se arma en el navegador, pero no se le puede creer:
-- quien manda la reserva puede mandar cualquier instante.
create or replace function por_que_no_se_reserva(n negocio, p_cuando timestamptz, p_motivo text)
returns text
language plpgsql
set search_path = public
as $$
declare
  minutos   integer;
  anticipa  numeric;
  horizonte integer;
  tope      timestamptz;
begin
  if n.horarios is null then
    return 'El negocio todavía no publicó sus horarios.';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    return 'Contanos para qué venís.';
  end if;

  minutos  := coalesce((n.horarios ->> 'minutos')::int, 30);
  anticipa := coalesce((n.horarios ->> 'anticipacionHoras')::numeric, 0);

  if p_cuando < now() + (anticipa * interval '1 hour') then
    return 'Ese horario ya no se puede pedir. Elegí otro de la lista.';
  end if;

  -- Hasta cuándo se puede pedir: hoy cuenta como el día 1, y el tope es la
  -- medianoche (hora de acá) del día siguiente al último. Mismo corte que
  -- huecoSigueLibre() en src/lib/horarios.js.
  horizonte := coalesce((n.horarios ->> 'horizonteDias')::int, 60);
  tope := (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
           + horizonte * interval '1 day') at time zone 'America/Argentina/Buenos_Aires';
  if p_cuando >= tope then
    return 'Para ese día todavía no se dan turnos. Elegí uno de la lista.';
  end if;

  if not hueco_ofrecido(n.horarios, p_cuando) then
    return 'Ese horario no es uno de los que atiende el negocio. Elegí uno de la lista.';
  end if;

  -- El chequeo que se ve, para poder contestar con una frase. El de verdad
  -- —el que aguanta dos personas reservando en el mismo segundo— es el
  -- índice único de 023, que atrapa anotar_turno().
  if exists (
    select 1 from turno
    where negocio_id = n.id
      and estado <> 'cancelado'
      and tstzrange(empieza_en, empieza_en + (coalesce(minutos_reservados, minutos) * interval '1 minute'))
          && tstzrange(p_cuando, p_cuando + (minutos * interval '1 minute'))
  ) then
    return 'Justo te lo ganaron. Elegí otro horario.';
  end if;

  return null;
end;
$$;

revoke all on function por_que_no_se_reserva(negocio, timestamptz, text) from public, anon, authenticated;

-- Anota el turno, como lo anotaba reservar_turno() (024): nace "agendado" y
-- con origen 'cliente', porque confirmarlo es del negocio. Devuelve
-- { ok: true, cuando, minutos } o, si el índice único atajó a alguien que
-- reservó en el mismo segundo, { ok: false, motivo }. Borrar el cliente que
-- se había creado para esa reserva le toca a quien lo creó.
create or replace function anotar_turno(n negocio, p_cliente uuid, p_cuando timestamptz, p_motivo text, p_identificador text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  minutos integer := coalesce((n.horarios ->> 'minutos')::int, 30);
begin
  begin
    insert into turno (negocio_id, cliente_id, motivo, empieza_en, estado, origen, minutos_reservados, identificador)
    values (n.id, p_cliente, trim(p_motivo), p_cuando, 'agendado', 'cliente', minutos, p_identificador);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'Justo te lo ganaron. Elegí otro horario.');
  end;

  return jsonb_build_object('ok', true, 'cuando', p_cuando, 'minutos', minutos);
end;
$$;

revoke all on function anotar_turno(negocio, uuid, timestamptz, text, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Las de la 024, por dentro
-- ------------------------------------------------------------
-- Misma firma y mismas respuestas para cada entrada: los mismos mensajes, en
-- el mismo orden, y "existe": false sólo cuando el link no sirve. Lo único
-- que cambia es que el cuerpo vive en las internas de arriba.

-- Los horarios del negocio y cuándo está ocupado. Los huecos los arma el
-- navegador con esos dos datos.
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

  return agenda_del_negocio(n);
end;
$$;

revoke all on function ver_agenda_publica(text) from public;
grant execute on function ver_agenda_publica(text) to anon, authenticated;

-- Devuelve { ok: true, cuando, minutos } o { ok: false, motivo }, con los
-- motivos escritos para que el cliente los lea tal cual.
--
-- El cliente que se anota queda "por confirmar": pidió turno, pero todavía
-- no vino. Se confirma solo cuando se le abre el primer caso.
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
  por_que    text;
  id_cliente uuid;
  resultado  jsonb;
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

  por_que := por_que_no_se_reserva(n, p_cuando, p_motivo);
  if por_que is not null then
    return jsonb_build_object('ok', false, 'motivo', por_que);
  end if;

  insert into cliente (negocio_id, nombre, telefono, confirmado)
  values (n.id, trim(p_nombre), nullif(trim(coalesce(p_telefono, '')), ''), false)
  returning id into id_cliente;

  resultado := anotar_turno(n, id_cliente, p_cuando, p_motivo, null);

  -- Dos personas tocaron el botón en el mismo segundo y el índice atajó a la
  -- segunda: se borra el cliente que se había creado para ella.
  if resultado ->> 'ok' <> 'true' then
    delete from cliente where id = id_cliente;
  end if;

  return resultado;
end;
$$;

revoke all on function reservar_turno(text, timestamptz, text, text, text) from public;
grant execute on function reservar_turno(text, timestamptz, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 6. Lo que llama la landing
-- ------------------------------------------------------------
-- Todas devuelven JSON con ok y motivo y no tiran excepciones, como las de la
-- 024: la API no traduce errores de Postgres en lo público. Los motivos que
-- son códigos (landing_no_encontrada, datos_incorrectos, muchos_intentos,
-- llave_vencida) los traduce la API; los demás son frases para el cliente.

-- Lo que se ve sin entrar: los datos del negocio, la personalización, qué
-- módulos tiene prendidos y los horarios (con eso la API decide qué secciones
-- aparecen). Nada de clientes, casos ni turnos.
create or replace function ver_landing(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n negocio%rowtype;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('sirve', false);
  end if;

  return jsonb_build_object(
    'sirve', true,
    'negocio', jsonb_build_object(
      'nombre', n.nombre,
      'telefono', nullif(trim(coalesce(n.telefono, '')), ''),
      'foto', n.foto,
      'descripcion', n.descripcion,
      'rubro', n.rubro,
      'estados', n.estados
    ),
    'landing', n.landing,
    'modulos_activos', n.modulos_activos,
    'horarios', n.horarios
  );
end;
$$;

revoke all on function ver_landing(text) from public;
grant execute on function ver_landing(text) to anon, authenticated;

-- El calendario de "Sacar turno": lo mismo que ver_agenda_publica(), pero
-- con el link de la landing.
create or replace function ver_agenda_landing(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n negocio%rowtype;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('sirve', false);
  end if;

  return agenda_del_negocio(n);
end;
$$;

revoke all on function ver_agenda_landing(text) from public;
grant execute on function ver_agenda_landing(text) to anon, authenticated;

-- Entrar: { ok: true, llave, vence_en } o { ok: false, motivo }.
--
-- Falle el identificador o fallen los dígitos, el motivo es el mismo
-- (datos_incorrectos), para no dar pistas de qué patentes son clientes. El
-- bloqueo se mira antes de verificar, y estando bloqueado no se anota otro
-- intento: así no se estira solo.
--
-- Entrar bien no borra los fallidos: vencen solos a los 15 minutos. El
-- contador es por identificador y lo comparten todos los que lo tienen (el
-- dueño nuevo de un auto usado, o quien se registró con la patente de otro y
-- su propio teléfono): si entrar bien lo borrara, cualquiera de ellos podría
-- intercalar su ingreso cada 4 intentos y probar los dígitos de otro sin
-- tope. El costo es de comodidad: quien se equivocó 4 veces y después entró
-- tiene que escribir con cuidado durante 15 minutos.
create or replace function ingresar_landing(p_codigo text, p_identificador text, p_ultimos4 text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n     negocio%rowtype;
  ident text;
  u4    text;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'landing_no_encontrada');
  end if;

  ident := normalizar_identificador(p_identificador);
  u4    := regexp_replace(coalesce(p_ultimos4, ''), '[^0-9]', '', 'g');

  -- Limpieza barata, sin cron: cada ingreso se lleva lo viejo.
  delete from landing_intento where creado_en < now() - interval '1 day';
  delete from landing_sesion  where vence_en <= now();

  if landing_bloqueada(n.id, ident) then
    return jsonb_build_object('ok', false, 'motivo', 'muchos_intentos');
  end if;

  -- Un identificador vacío no es de nadie: no se anota, así cinco ingresos
  -- vacíos no contestan muchos_intentos en vez de datos_incorrectos.
  if ident = '' or length(u4) <> 4
     or not exists (select 1 from clientes_de_la_landing(n.id, ident, u4)) then
    if ident <> '' then
      insert into landing_intento (negocio_id, identificador) values (n.id, ident);
    end if;
    return jsonb_build_object('ok', false, 'motivo', 'datos_incorrectos');
  end if;

  return jsonb_build_object('ok', true) || abrir_sesion_landing(n.id, ident, u4);
end;
$$;

revoke all on function ingresar_landing(text, text, text) from public;
grant execute on function ingresar_landing(text, text, text) to anon, authenticated;

-- Los casos abiertos (los que no están completados) de quien entró, del más
-- nuevo al más viejo. Cada uno con el link de su seguimiento, que es la
-- pantalla que ya existe: el que no lo tenía lo recibe acá, generado igual
-- que en compartir_caso() (018). Por eso no es stable.
--
-- Va lo mismo que muestra el seguimiento. caso.nombre no: es interno (033).
create or replace function mis_casos_landing(p_codigo text, p_llave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n       negocio%rowtype;
  s       landing_sesion%rowtype;
  id_caso uuid;
  nuevo   text;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'landing_no_encontrada');
  end if;

  select * into s from sesion_de_la_llave(n.id, p_llave);
  if s.huella is null then
    return jsonb_build_object('ok', false, 'motivo', 'llave_vencida');
  end if;

  -- "for update", como en compartir_caso(): dos pedidos al mismo tiempo no
  -- pueden darle dos códigos distintos al mismo caso. El segundo espera, y
  -- al ver que el caso ya tiene código lo saltea.
  for id_caso in
    select x.id
      from caso x
     where x.negocio_id = n.id
       and x.estado <> 'completado'
       and x.seguimiento_codigo is null
       and x.cliente_id in (select * from clientes_de_la_landing(n.id, s.identificador, s.ultimos4))
       for update of x
  loop
    loop
      nuevo := replace(gen_random_uuid()::text, '-', '');
      exit when not exists (select 1 from caso where seguimiento_codigo = nuevo);
    end loop;

    update caso set seguimiento_codigo = nuevo, seguimiento_visto_en = null
     where id = id_caso;
  end loop;

  return jsonb_build_object('ok', true, 'casos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'numero', x.numero,
             'servicio', x.servicio,
             'identificador', x.identificador,
             'estado', x.estado,
             'seguimiento_codigo', x.seguimiento_codigo,
             'abierto_en', x.abierto_en)
           order by x.abierto_en desc, x.numero desc)
      from caso x
     where x.negocio_id = n.id
       and x.estado <> 'completado'
       and x.cliente_id in (select * from clientes_de_la_landing(n.id, s.identificador, s.ultimos4))
  ), '[]'::jsonb));
end;
$$;

revoke all on function mis_casos_landing(text, text) from public;
grant execute on function mis_casos_landing(text, text) to anon, authenticated;

-- Los próximos turnos de quien entró: desde ahora, sin los cancelados, por
-- fecha.
create or replace function mis_turnos_landing(p_codigo text, p_llave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n negocio%rowtype;
  s landing_sesion%rowtype;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'landing_no_encontrada');
  end if;

  select * into s from sesion_de_la_llave(n.id, p_llave);
  if s.huella is null then
    return jsonb_build_object('ok', false, 'motivo', 'llave_vencida');
  end if;

  return jsonb_build_object('ok', true, 'turnos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'empieza_en', t.empieza_en,
             'minutos_reservados', t.minutos_reservados,
             'motivo', t.motivo,
             'estado', t.estado)
           order by t.empieza_en)
      from turno t
     where t.negocio_id = n.id
       and t.estado <> 'cancelado'
       and t.empieza_en >= now()
       and t.cliente_id in (select * from clientes_de_la_landing(n.id, s.identificador, s.ultimos4))
  ), '[]'::jsonb));
end;
$$;

revoke all on function mis_turnos_landing(text, text) from public;
grant execute on function mis_turnos_landing(text, text) to anon, authenticated;

-- Sacar turno desde la landing. Devuelve { ok: true, cuando, minutos } (más
-- { llave, vence_en } si fue un registro), { ok: false, existe: false,
-- motivo } si el link no sirve, { ok: false, llave_vencida: true } si la
-- llave no sirve, o { ok: false, motivo } con la frase para el cliente.
--
-- Con llave: el turno va a nombre de quien entró, con el identificador de su
-- sesión, y lo que venga de nombre, teléfono e identificador no cuenta. Si
-- la persona tiene varias fichas, va a la confirmada más reciente (la "por
-- confirmar" es la que dejó un turno anterior); si no hay confirmada, a la
-- más reciente.
--
-- Sin llave es el registro: crea el cliente "por confirmar", como
-- reservar_turno(), anota el turno con su identificador y le abre la sesión,
-- para que pueda ver su turno sin volver a poner los datos.
create or replace function reservar_turno_landing(
  p_codigo        text,
  p_llave         text,
  p_cuando        timestamptz,
  p_motivo        text,
  p_nombre        text,
  p_telefono      text,
  p_identificador text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n          negocio%rowtype;
  s          landing_sesion%rowtype;
  por_que    text;
  id_cliente uuid;
  ident      text;
  u4         text;
  adivina    boolean;
  resultado  jsonb;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('ok', false, 'existe', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
  end if;

  -- ---------- con llave ----------
  if p_llave is not null then
    select * into s from sesion_de_la_llave(n.id, p_llave);
    if s.huella is null then
      return jsonb_build_object('ok', false, 'llave_vencida', true);
    end if;

    select cl.id into id_cliente
      from cliente cl
     where cl.id in (select * from clientes_de_la_landing(n.id, s.identificador, s.ultimos4))
     order by cl.confirmado desc, cl.creado_en desc
     limit 1;

    -- La sesión ya no es de nadie (le cambiaron el teléfono, lo borraron):
    -- que vuelva a poner sus datos.
    if id_cliente is null then
      return jsonb_build_object('ok', false, 'llave_vencida', true);
    end if;

    por_que := por_que_no_se_reserva(n, p_cuando, p_motivo);
    if por_que is not null then
      return jsonb_build_object('ok', false, 'motivo', por_que);
    end if;

    return anotar_turno(n, id_cliente, p_cuando, p_motivo, s.identificador);
  end if;

  -- ---------- sin llave: el registro ----------
  if coalesce(trim(p_nombre), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'Necesitamos tu nombre para anotarte.');
  end if;

  u4 := ultimos_cuatro(p_telefono);
  if length(u4) < 4 then
    return jsonb_build_object('ok', false, 'motivo', 'Necesitamos tu teléfono para que puedas volver a entrar.');
  end if;

  ident := normalizar_identificador(p_identificador);
  if ident = '' then
    return jsonb_build_object('ok', false, 'motivo', 'Falta con qué te identificamos.');
  end if;

  por_que := por_que_no_se_reserva(n, p_cuando, p_motivo);
  if por_que is not null then
    return jsonb_build_object('ok', false, 'motivo', por_que);
  end if;

  -- El registro abre una sesión con el identificador y los dígitos que
  -- elige quien se registra, y esa sesión ve lo de todos los clientes con
  -- esos datos: registrarse es probar 4 dígitos contra ese identificador.
  -- Por eso respeta el bloqueo y, salvo que ya coincida con alguien (la
  -- misma persona que se registra de nuevo), cuenta como un intento
  -- fallido, que vence solo como los demás. Si no, alcanzaría con
  -- registrarse una vez por combinación y mirar "Mis casos". Se anota igual
  -- sea el identificador conocido o no, para que el bloqueo no cuente qué
  -- patentes son clientes; y la respuesta es la misma en todos los casos.
  if landing_bloqueada(n.id, ident) then
    return jsonb_build_object('ok', false, 'motivo', 'Se hicieron muchos intentos seguidos. Probá de nuevo en unos minutos.');
  end if;

  adivina := not exists (select 1 from clientes_de_la_landing(n.id, ident, u4));

  insert into cliente (negocio_id, nombre, telefono, confirmado)
  values (n.id, trim(p_nombre), trim(p_telefono), false)
  returning id into id_cliente;

  resultado := anotar_turno(n, id_cliente, p_cuando, p_motivo, trim(p_identificador));

  if resultado ->> 'ok' <> 'true' then
    delete from cliente where id = id_cliente;
    return resultado;
  end if;

  if adivina then
    insert into landing_intento (negocio_id, identificador) values (n.id, ident);
  end if;

  return resultado || abrir_sesion_landing(n.id, ident, u4);
end;
$$;

revoke all on function reservar_turno_landing(text, text, timestamptz, text, text, text, text) from public;
grant execute on function reservar_turno_landing(text, text, timestamptz, text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 7. El seguimiento, con la landing del negocio
-- ------------------------------------------------------------
-- La ver_seguimiento() de la 026, tal cual, con dos campos más del negocio
-- del caso: landing (para pintar el seguimiento con sus colores) y
-- landing_codigo (para el "Volver a [negocio]"; null si no está publicada).
-- Lo demás no cambia: ver la 026 para qué viaja y qué no.
create or replace function ver_seguimiento(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c          caso%rowtype;
  n          negocio%rowtype;
  cli        cliente%rowtype;
  aprobado   numeric;
  pagado     numeric;
  pendiente  numeric;
  descontado numeric;
  hay_cobros boolean;
  links      jsonb;
  pago       jsonb;
begin
  if p_codigo is null or length(p_codigo) < 8 then
    return jsonb_build_object('sirve', false);
  end if;

  select * into c from caso where seguimiento_codigo = p_codigo;
  if not found then
    return jsonb_build_object('sirve', false);
  end if;

  select * into n   from negocio where id = c.negocio_id;
  select * into cli from cliente where id = c.cliente_id;

  update caso set seguimiento_visto_en = now() where id = c.id;

  -- ---------- el pago ----------
  select coalesce(sum(monto), 0) into aprobado
  from paso where caso_id = c.id and estado = 'aprobado';

  select coalesce(sum(monto) filter (where estado = 'pagado'), 0),
         coalesce(sum(monto) filter (where estado = 'pendiente'), 0),
         count(*) > 0
    into pagado, pendiente, hay_cobros
  from cobro where caso_id = c.id;

  -- Lo anotado con 012 que no pasó a la tabla (no debería quedar ninguno
  -- después de 025, pero el modo de ejemplo lo contempla y tienen que dar
  -- lo mismo).
  if not hay_cobros and coalesce(c.cobrado, 0) > 0 then
    pagado := c.cobrado;
  end if;

  -- Mismo criterio que descuentoDelCaso(): lo que dice la columna, o para un
  -- caso cerrado con 012 cobrando de menos, la diferencia.
  descontado := case
    when c.descuento is not null then c.descuento
    when c.estado = 'completado' and c.cobrado is not null then greatest(aprobado - c.cobrado, 0)
    else 0
  end;

  links := coalesce((
    select jsonb_agg(jsonb_build_object('monto', x.monto, 'link', x.link, 'vence_en', x.vence_en)
                     order by x.creado_en)
    from cobro x
    where x.caso_id = c.id and x.estado = 'pendiente' and x.medio = 'link'
  ), '[]'::jsonb);

  if jsonb_array_length(links) > 0
     or (c.estado in ('revision_final', 'completado')
         and aprobado > 0
         and (c.estado <> 'completado' or hay_cobros or c.descuento is not null or c.cobrado is not null))
  then
    pago := jsonb_build_object(
      'pagado', pagado,
      'falta', greatest(aprobado - pagado - pendiente - descontado, 0),
      'pendientes', links
    );
  else
    pago := null;
  end if;

  return jsonb_build_object(
    'sirve', true,
    'negocio_nombre', n.nombre,
    'negocio_telefono', nullif(trim(coalesce(n.telefono, '')), ''),
    'rubro', n.rubro,
    'cliente_nombre', nullif(split_part(coalesce(cli.nombre, ''), ' ', 1), ''),
    'numero', c.numero,
    'identificador', c.identificador,
    'servicio', c.servicio,
    'estado', c.estado,
    'que_falta', case when c.estado = 'esperando' then c.que_falta else null end,
    'abierto_en', c.abierto_en,
    'actualizado_en', c.actualizado_en,
    'pasos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre', p.nombre, 'monto', p.monto,
               'hecho', p.hecho_en is not null)
                       order by p.orden, p.creado_en)
      from paso p
      where p.caso_id = c.id and p.estado = 'aprobado'
    ), '[]'::jsonb),
    'por_responder', case when c.estado = 'completado' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre,
               'descripcion', p.descripcion, 'monto', p.monto)
                       order by p.orden, p.creado_en)
      from paso p
      where p.caso_id = c.id and p.estado = 'esperando'
    ), '[]'::jsonb) end,
    'linea', coalesce((
      select jsonb_agg(jsonb_build_object('estado', e.estado, 'ocurrido_en', e.ocurrido_en)
                       order by e.ocurrido_en)
      from evento e
      where e.caso_id = c.id and e.estado is not null
    ), '[]'::jsonb),
    'pago', pago,
    'landing', n.landing,
    'landing_codigo', n.landing_codigo
  );
end;
$$;

revoke all on function ver_seguimiento(text) from public;
grant execute on function ver_seguimiento(text) to anon, authenticated;
