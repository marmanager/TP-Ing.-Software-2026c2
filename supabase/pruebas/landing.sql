-- ============================================================
-- pruebas/landing.sql — prueba la 053 contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase. Antes de la 053 tiene que
-- fallar (las funciones no existen); después, dar "Success".
--
-- No deja nada: crea cuentas, negocios, clientes, casos y turnos de mentira,
-- prueba, y al final lo deshace todo con un error a propósito ('deshacer')
-- que se atrapa.
--
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó.
--   cualquier otro error              → la prueba no pudo correr.
--
-- Los datos se cargan y se revisan como postgres (las tablas tienen RLS); las
-- funciones públicas se llaman como anon, que es como llegan desde la API: el
-- cliente de la landing no tiene cuenta.
--
-- Todo corre en una sola transacción, así que now() no avanza: los turnos se
-- piden para mañana y la llave se vence moviendo vence_en para atrás.
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();  -- dueña del taller
  edu  uuid := gen_random_uuid();  -- será encargado del taller
  beto uuid := gen_random_uuid();  -- dueño de otro negocio, sin horarios
  neg  uuid;
  cod_landing   text;  -- link de la landing del taller
  cod_landing_b text;  -- link de la landing del otro negocio
  cod_agenda    text;  -- link de la agenda (024) del taller
  cod_agenda_b  text;  -- link de la agenda del otro negocio
  cod_nuevo     text;  -- el link del taller después de volver a compartir
  cod_239       text;  -- el caso 239 ya estaba compartido
  marcela    uuid;
  marcela_pc uuid;     -- la misma Marcela, anotada "por confirmar" desde un turno
  lucia      uuid;
  raul       uuid;     -- le compró a Marcela un auto con la misma patente
  manana     timestamptz;  -- mañana a las 10, hora de acá
  r       jsonb;
  r2      jsonb;
  casos_m jsonb;
  llave   text;
  llave_m text;
  llave_r text;
  llave_i text;
  link_equipo text;
  pedido  uuid;
  n       integer;
  antes   integer;
  i       integer;
  frenado boolean;
  fila    record;
begin
  begin
    insert into auth.users (id, email) values
      (ana,  'prueba-ana-'  || ana  || '@ejemplo.test'),
      (edu,  'prueba-edu-'  || edu  || '@ejemplo.test'),
      (beto, 'prueba-beto-' || beto || '@ejemplo.test');

    -- ---- Los negocios y sus links ----
    perform set_config('role', 'authenticated', true);

    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    perform crear_mi_negocio('Otro Taller', 'taller', '[]'::jsonb);
    cod_landing_b := compartir_landing();
    cod_agenda_b  := compartir_agenda();

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg         := crear_mi_negocio('Taller Landing', 'taller', '["agenda"]'::jsonb);
    cod_landing := compartir_landing();
    cod_agenda  := compartir_agenda();

    -- ---- Los datos, como postgres ----
    perform set_config('role', 'postgres', true);

    update negocio
       set horarios = '{"dias": ["dom", "lun", "mar", "mie", "jue", "vie", "sab"],
                        "desde": "08:00", "hasta": "20:00", "minutos": 30,
                        "anticipacionHoras": 0, "horizonteDias": 60}'::jsonb,
           landing  = '{"fuente": "fabrica"}'::jsonb,
           telefono = '341 000 0000'
     where id = neg;

    manana := (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') + interval '1 day 10 hours')
              at time zone 'America/Argentina/Buenos_Aires';

    insert into cliente (negocio_id, nombre, telefono, creado_en)
    values (neg, 'Marcela Pérez', '341 456 7890', now() - interval '1 year')
    returning id into marcela;
    insert into cliente (negocio_id, nombre, telefono, confirmado)
    values (neg, 'Marcela', '3414567890', false)
    returning id into marcela_pc;
    insert into cliente (negocio_id, nombre, telefono)
    values (neg, 'Lucía Gómez', '341 555 1111')
    returning id into lucia;
    insert into cliente (negocio_id, nombre, telefono)
    values (neg, 'Raúl Díaz', '11 2222 3333')
    returning id into raul;

    cod_239 := replace(gen_random_uuid()::text, '-', '');
    insert into caso (negocio_id, numero, cliente_id, servicio, identificador, estado, nombre, seguimiento_codigo, abierto_en) values
      (neg, 248, marcela, 'Revisión general',    'AB123CD',   'nuevo',      'El auto de Marcela', null,    now()),
      (neg, 239, marcela, 'Reparación de motor', 'AA000AA',   'en_proceso', null,                 cod_239, now() - interval '10 days'),
      (neg, 210, marcela, 'Frenos',              'ZZ999ZZ',   'completado', null,                 null,    now() - interval '90 days'),
      (neg, 253, lucia,   'Service',             'AC456EF',   'nuevo',      null,                 null,    now()),
      (neg, 300, raul,    'Cambio de aceite',    'ab-123 cd', 'nuevo',      null,                 null,    now());

    -- El turno viejo con el que Marcela quedó "por confirmar".
    insert into turno (negocio_id, cliente_id, motivo, empieza_en, estado, origen, identificador)
    values (neg, marcela_pc, 'Ruido en el motor', now() - interval '30 days', 'atendido', 'cliente', 'AB123CD');

    -- De acá en adelante, el cliente sin cuenta.
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);

    -- ---- 1. La página pública ----
    if ver_landing('noexisteestecodigo') is distinct from '{"sirve": false}'::jsonb
       or ver_landing(null) is distinct from '{"sirve": false}'::jsonb
       or ver_landing(cod_agenda) is distinct from '{"sirve": false}'::jsonb then
      raise exception 'FALLÓ 1: un código que no es el de la landing sirve.';
    end if;
    r := ver_landing(cod_landing);
    if r ->> 'sirve' is distinct from 'true'
       or r #>> '{negocio,nombre}' is distinct from 'Taller Landing'
       or r #>> '{landing,fuente}' is distinct from 'fabrica' then
      raise exception 'FALLÓ 1: con el código bueno no trae el nombre y la landing: %', r;
    end if;
    if (select array_agg(k order by k) from jsonb_object_keys(r) k)
         is distinct from array['horarios', 'landing', 'modulos_activos', 'negocio', 'sirve']
       or (select array_agg(k order by k) from jsonb_object_keys(r -> 'negocio') k)
         is distinct from array['descripcion', 'estados', 'foto', 'nombre', 'rubro', 'telefono'] then
      raise exception 'FALLÓ 1: ver_landing no tiene la forma del contrato: %', r;
    end if;

    -- ---- 2. Entrar con el identificador y los 4 dígitos ----
    r := ingresar_landing(cod_landing, ' ab 123-cd ', '7890');
    llave := r ->> 'llave';
    if r ->> 'ok' is distinct from 'true' or length(llave) is distinct from 64 or r ->> 'vence_en' is null then
      raise exception 'FALLÓ 2: con los datos buenos no entra: %', r;
    end if;
    perform set_config('role', 'postgres', true);
    select count(*) into n
      from landing_sesion
     where huella = encode(sha256(convert_to(llave, 'UTF8')), 'hex')
       and negocio_id = neg and identificador = 'AB123CD' and ultimos4 = '7890';
    if n <> 1 or exists (select 1 from landing_sesion where huella = llave) then
      raise exception 'FALLÓ 2: la sesión no quedó guardada sólo con la huella de la llave.';
    end if;
    perform set_config('role', 'anon', true);

    -- ---- 3. Datos malos: siempre el mismo motivo ----
    r  := ingresar_landing(cod_landing, 'XX999XX', '7890');  -- un identificador que no es
    r2 := ingresar_landing(cod_landing, 'AB123CD', '0000');  -- unos dígitos que no son
    if r is distinct from '{"ok": false, "motivo": "datos_incorrectos"}'::jsonb
       or r2 is distinct from r
       or ingresar_landing(cod_landing, 'AB123CD', '789') is distinct from r
       or ingresar_landing(cod_landing, '', '7890') is distinct from r then
      raise exception 'FALLÓ 3: los datos malos no contestan siempre datos_incorrectos: % / %', r, r2;
    end if;
    if ingresar_landing('noexisteestecodigo', 'AB123CD', '7890')
         is distinct from '{"ok": false, "motivo": "landing_no_encontrada"}'::jsonb then
      raise exception 'FALLÓ 3: con un link malo no contesta landing_no_encontrada.';
    end if;

    -- ---- 4. El bloqueo: al 5.º fallido, aunque en el medio haya entrado bien ----
    -- Entrar bien no borra los fallidos: vencen solos a los 15 minutos.
    for i in 1..4 loop
      r := ingresar_landing(cod_landing, 'AC456EF', '0000');
      if r ->> 'motivo' is distinct from 'datos_incorrectos' then
        raise exception 'FALLÓ 4: el fallido % no contestó datos_incorrectos: %', i, r;
      end if;
    end loop;
    r := ingresar_landing(cod_landing, 'AC456EF', '1111');
    if r ->> 'ok' is distinct from 'true' then
      raise exception 'FALLÓ 4: con 4 fallidos, los datos buenos no entran: %', r;
    end if;
    r := ingresar_landing(cod_landing, 'AC456EF', '0000');
    if r ->> 'motivo' is distinct from 'datos_incorrectos' then
      raise exception 'FALLÓ 4: el 5.º fallido no contestó datos_incorrectos: %', r;
    end if;
    r := ingresar_landing(cod_landing, 'ac 456 ef', '1111');
    if r is distinct from '{"ok": false, "motivo": "muchos_intentos"}'::jsonb then
      raise exception 'FALLÓ 4: entrar bien borró los fallidos, o después de 5 los datos buenos entran: %', r;
    end if;
    perform set_config('role', 'postgres', true);
    select count(*) into n from landing_intento where negocio_id = neg and identificador = 'AC456EF';
    perform set_config('role', 'anon', true);
    if n <> 5 then
      raise exception 'FALLÓ 4: el intento bloqueado se anotó igual (hay %).', n;
    end if;

    -- ---- 5. La llave vencida, inventada o de otro negocio no sirve ----
    -- (mis_turnos y no mis_casos: mis_casos les da link a los casos, y eso lo
    -- mira el 8.)
    if mis_turnos_landing(cod_landing, llave) ->> 'ok' is distinct from 'true' then
      raise exception 'FALLÓ 5: la llave recién dada no sirve.';
    end if;
    if mis_casos_landing(cod_landing, 'inventada' || repeat('0', 55))
         is distinct from '{"ok": false, "motivo": "llave_vencida"}'::jsonb
       or mis_casos_landing(cod_landing, null)
         is distinct from '{"ok": false, "motivo": "llave_vencida"}'::jsonb
       or mis_casos_landing(cod_landing_b, llave)
         is distinct from '{"ok": false, "motivo": "llave_vencida"}'::jsonb
       or mis_casos_landing('noexisteestecodigo', llave)
         is distinct from '{"ok": false, "motivo": "landing_no_encontrada"}'::jsonb then
      raise exception 'FALLÓ 5: una llave inventada o de otro negocio sirve.';
    end if;
    perform set_config('role', 'postgres', true);
    update landing_sesion set vence_en = now() - interval '1 minute'
     where huella = encode(sha256(convert_to(llave, 'UTF8')), 'hex');
    perform set_config('role', 'anon', true);
    if mis_casos_landing(cod_landing, llave)
         is distinct from '{"ok": false, "motivo": "llave_vencida"}'::jsonb
       or mis_turnos_landing(cod_landing, llave)
         is distinct from '{"ok": false, "motivo": "llave_vencida"}'::jsonb
       or reservar_turno_landing(cod_landing, llave, manana, 'Algo', null, null, null)
         is distinct from '{"ok": false, "llave_vencida": true}'::jsonb then
      raise exception 'FALLÓ 5: una llave vencida todavía sirve.';
    end if;

    -- ---- 6. La misma patente, dos dueños: cada uno ve lo suyo ----
    llave_m := ingresar_landing(cod_landing, 'AB123CD', '7890') ->> 'llave';
    llave_r := ingresar_landing(cod_landing, 'AB 123 CD', '3333') ->> 'llave';
    if llave_m is null or llave_r is null then
      raise exception 'FALLÓ 6: los dos dueños de la patente no pudieron entrar.';
    end if;
    casos_m := mis_casos_landing(cod_landing, llave_m);
    if (select array_agg((x ->> 'numero')::int order by (x ->> 'numero')::int)
          from jsonb_array_elements(casos_m -> 'casos') x)
         is distinct from array[239, 248] then
      raise exception 'FALLÓ 6: Marcela no ve exactamente sus casos abiertos: %', casos_m;
    end if;
    r := mis_casos_landing(cod_landing, llave_r);
    if (select array_agg((x ->> 'numero')::int) from jsonb_array_elements(r -> 'casos') x)
         is distinct from array[300] then
      raise exception 'FALLÓ 6: Raúl no ve exactamente su caso: %', r;
    end if;

    -- Con la llave, el turno va a la ficha confirmada (aunque la "por
    -- confirmar" sea más nueva) y con la patente de la sesión; lo que venga
    -- de nombre, teléfono e identificador no cuenta.
    r := reservar_turno_landing(cod_landing, llave_m, manana + interval '2 hours', 'Ruido raro',
                                'Otro nombre', '000', 'OTRA');
    if r is distinct from jsonb_build_object('ok', true, 'cuando', manana + interval '2 hours', 'minutos', 30) then
      raise exception 'FALLÓ 6: reservar con la llave no contestó lo esperado: %', r;
    end if;
    perform set_config('role', 'postgres', true);
    select cliente_id, identificador into fila
      from turno where negocio_id = neg and empieza_en = manana + interval '2 hours';
    perform set_config('role', 'anon', true);
    if fila.cliente_id is distinct from marcela or fila.identificador is distinct from 'AB123CD' then
      raise exception 'FALLÓ 6: con la llave, el turno no quedó en la ficha confirmada y con la patente de la sesión.';
    end if;
    r := mis_turnos_landing(cod_landing, llave_m);
    if jsonb_array_length(r -> 'turnos') is distinct from 1
       or (r #>> '{turnos,0,empieza_en}')::timestamptz is distinct from manana + interval '2 hours'
       or (select array_agg(k order by k) from jsonb_object_keys(r -> 'turnos' -> 0) k)
         is distinct from array['empieza_en', 'estado', 'minutos_reservados', 'motivo'] then
      raise exception 'FALLÓ 6: Marcela no ve su próximo turno, o no con la forma del contrato: %', r;
    end if;

    -- ---- 7. Registrarse con la patente de otro no muestra nada ajeno ----
    perform set_config('role', 'postgres', true);
    select count(*) into antes from landing_intento where negocio_id = neg and identificador = 'AB123CD';
    perform set_config('role', 'anon', true);
    r := reservar_turno_landing(cod_landing, null, manana, 'Quiero un turno',
                                'Intruso', '11 4000 0001', ' AB-123-CD ');
    llave_i := r ->> 'llave';
    if r ->> 'ok' is distinct from 'true' or length(llave_i) is distinct from 64 then
      raise exception 'FALLÓ 7: el registro no reservó o no devolvió la llave: %', r;
    end if;
    if mis_casos_landing(cod_landing, llave_i) is distinct from '{"ok": true, "casos": []}'::jsonb then
      raise exception 'FALLÓ 7: con la patente de otro se ven casos ajenos.';
    end if;
    if jsonb_array_length(mis_turnos_landing(cod_landing, llave_i) -> 'turnos') is distinct from 1 then
      raise exception 'FALLÓ 7: el que se registró no ve sólo su turno.';
    end if;
    perform set_config('role', 'postgres', true);
    select t.identificador, c.confirmado into fila
      from turno t join cliente c on c.id = t.cliente_id
     where t.negocio_id = neg and t.empieza_en = manana and t.estado <> 'cancelado';
    perform set_config('role', 'anon', true);
    if fila.identificador is distinct from 'AB-123-CD' or fila.confirmado is distinct from false then
      raise exception 'FALLÓ 7: el turno del registro no guardó el identificador como vino, o el cliente no quedó por confirmar.';
    end if;

    -- Registrarse con la patente de otro y unos dígitos que no son de nadie
    -- cuenta como un intento, que entrar después con esos mismos datos (que
    -- ahora son los del registro) no borra: si no, registrarse una vez por
    -- cada combinación de dígitos salteaba el bloqueo. Con lo que falta para
    -- llegar a 5, el registro y el ingreso con esa patente quedan bloqueados.
    -- El registro bloqueado contesta el código (muchos_intentos), como el
    -- ingreso, y no una frase: la API lo traduce al mismo 429.
    if ingresar_landing(cod_landing, 'AB123CD', '0001') ->> 'ok' is distinct from 'true' then
      raise exception 'FALLÓ 7: el que se registró no puede volver a entrar con sus datos.';
    end if;
    perform set_config('role', 'postgres', true);
    select count(*) into n from landing_intento where negocio_id = neg and identificador = 'AB123CD';
    insert into landing_intento (negocio_id, identificador)
    select neg, 'AB123CD' from generate_series(1, 5 - n);
    perform set_config('role', 'anon', true);
    if n <> antes + 1 then
      raise exception 'FALLÓ 7: el registro con la patente de otro no quedó como intento (había %, hay %).', antes, n;
    end if;
    r := reservar_turno_landing(cod_landing, null, manana + interval '30 minutes', 'Otro',
                                'Intruso', '11 4000 0002', 'AB123CD');
    if r is distinct from '{"ok": false, "motivo": "muchos_intentos"}'::jsonb
       or ingresar_landing(cod_landing, 'AB123CD', '7890')
            is distinct from '{"ok": false, "motivo": "muchos_intentos"}'::jsonb then
      raise exception 'FALLÓ 7: con 5 intentos, el registro o el ingreso con esa patente siguen andando: %', r;
    end if;
    perform set_config('role', 'postgres', true);
    select count(*) into n from cliente where negocio_id = neg and nombre = 'Intruso';
    perform set_config('role', 'anon', true);
    if n <> 1 then
      raise exception 'FALLÓ 7: el registro bloqueado creó un cliente.';
    end if;

    -- ---- 8. Los casos sin link reciben uno; los completados no aparecen ----
    -- casos_m es lo que contestó mis_casos_landing a Marcela en el 6.
    if casos_m #>> '{casos,0,numero}' is distinct from '248'
       or (select array_agg(k order by k) from jsonb_object_keys(casos_m -> 'casos' -> 0) k)
         is distinct from array['abierto_en', 'estado', 'identificador', 'numero', 'seguimiento_codigo', 'servicio'] then
      raise exception 'FALLÓ 8: los casos no vienen del más nuevo al más viejo o no tienen la forma del contrato: %', casos_m;
    end if;
    perform set_config('role', 'postgres', true);
    select
      max(seguimiento_codigo) filter (where numero = 248) as k248,
      max(seguimiento_codigo) filter (where numero = 239) as k239,
      max(seguimiento_codigo) filter (where numero = 210) as k210
      into fila
      from caso where negocio_id = neg;
    perform set_config('role', 'anon', true);
    if fila.k248 is null
       or fila.k248 is distinct from casos_m #>> '{casos,0,seguimiento_codigo}'
       or fila.k239 is distinct from cod_239
       or fila.k210 is not null then
      raise exception 'FALLÓ 8: el caso sin link no recibió uno, el compartido cambió, o el completado recibió uno.';
    end if;
    r := ver_seguimiento(fila.k248);
    if r ->> 'sirve' is distinct from 'true'
       or r ->> 'landing_codigo' is distinct from cod_landing
       or r #>> '{landing,fuente}' is distinct from 'fabrica' then
      raise exception 'FALLÓ 8: el seguimiento no trae la landing del negocio: %', r;
    end if;

    -- ---- 9. Las de la 024 contestan igual que antes ----
    if ver_agenda_publica('noexisteestecodigo') is distinct from '{"sirve": false}'::jsonb
       or ver_agenda_publica(null) is distinct from '{"sirve": false}'::jsonb
       or ver_agenda_publica(cod_landing) is distinct from '{"sirve": false}'::jsonb then
      raise exception 'FALLÓ 9: ver_agenda_publica con un código malo no contesta sirve:false.';
    end if;
    r := ver_agenda_publica(cod_agenda);
    if (select array_agg(k order by k) from jsonb_object_keys(r) k)
         is distinct from array['horarios', 'negocio_nombre', 'negocio_telefono', 'ocupados', 'rubro', 'sirve']
       or r ->> 'negocio_nombre' is distinct from 'Taller Landing'
       or r ->> 'negocio_telefono' is distinct from '341 000 0000'
       or not exists (select 1 from jsonb_array_elements(r -> 'ocupados') o
                       where (o ->> 'empieza_en')::timestamptz = manana
                         and o ->> 'minutos_reservados' = '30') then
      raise exception 'FALLÓ 9: ver_agenda_publica no contesta lo de siempre: %', r;
    end if;
    if ver_agenda_landing(cod_landing) is distinct from r
       or ver_agenda_landing('noexisteestecodigo') is distinct from '{"sirve": false}'::jsonb
       or ver_agenda_landing(cod_agenda) is distinct from '{"sirve": false}'::jsonb then
      raise exception 'FALLÓ 9: ver_agenda_landing no contesta lo mismo que ver_agenda_publica.';
    end if;

    r := jsonb_build_object('ok', false, 'existe', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
    if reservar_turno('noexisteestecodigo', manana, 'Algo', 'Pepe', '341') is distinct from r
       or reservar_turno(null, manana, 'Algo', 'Pepe', '341') is distinct from r
       or reservar_turno(cod_landing, manana, 'Algo', 'Pepe', '341') is distinct from r then
      raise exception 'FALLÓ 9: reservar_turno con un link malo no contesta existe:false.';
    end if;
    -- Sin horarios, y antes que el nombre.
    if reservar_turno(cod_agenda_b, manana, 'Algo', '', '341')
         is distinct from '{"ok": false, "motivo": "El negocio todavía no publicó sus horarios."}'::jsonb then
      raise exception 'FALLÓ 9: sin horarios no contesta lo de siempre.';
    end if;
    -- Sin nombre (antes que el motivo), sin motivo, y los horarios que no van.
    if reservar_turno(cod_agenda, manana + interval '1 hour', '', '  ', '341')
         is distinct from '{"ok": false, "motivo": "Necesitamos tu nombre para anotarte."}'::jsonb
       or reservar_turno(cod_agenda, manana + interval '1 hour', '  ', 'Pepe', '341')
         is distinct from '{"ok": false, "motivo": "Contanos para qué venís."}'::jsonb
       or reservar_turno(cod_agenda, now() - interval '1 hour', 'Algo', 'Pepe', '341')
         is distinct from '{"ok": false, "motivo": "Ese horario ya no se puede pedir. Elegí otro de la lista."}'::jsonb
       or reservar_turno(cod_agenda, manana + interval '100 days', 'Algo', 'Pepe', '341')
         is distinct from '{"ok": false, "motivo": "Para ese día todavía no se dan turnos. Elegí uno de la lista."}'::jsonb
       or reservar_turno(cod_agenda, manana + interval '10 minutes', 'Algo', 'Pepe', '341')
         is distinct from '{"ok": false, "motivo": "Ese horario no es uno de los que atiende el negocio. Elegí uno de la lista."}'::jsonb
       or reservar_turno(cod_agenda, manana, 'Algo', 'Pepe', '341')
         is distinct from '{"ok": false, "motivo": "Justo te lo ganaron. Elegí otro horario."}'::jsonb then
      raise exception 'FALLÓ 9: reservar_turno no rechaza con los mensajes y el orden de siempre.';
    end if;
    -- Una reserva buena.
    r := reservar_turno(cod_agenda, manana + interval '1 hour', 'Cambio de aceite', ' Pepe Argento ', '341 777 8888');
    if r is distinct from jsonb_build_object('ok', true, 'cuando', manana + interval '1 hour', 'minutos', 30) then
      raise exception 'FALLÓ 9: una reserva buena no contesta lo de siempre: %', r;
    end if;
    perform set_config('role', 'postgres', true);
    select t.estado, t.origen, t.minutos_reservados, t.identificador, t.motivo,
           c.nombre, c.telefono, c.confirmado
      into fila
      from turno t join cliente c on c.id = t.cliente_id
     where t.negocio_id = neg and t.empieza_en = manana + interval '1 hour';
    select count(*) into n from cliente where negocio_id = neg and nombre = 'Pepe';
    if fila.estado is distinct from 'agendado' or fila.origen is distinct from 'cliente'
       or fila.minutos_reservados is distinct from 30 or fila.identificador is not null
       or fila.motivo is distinct from 'Cambio de aceite' or fila.nombre is distinct from 'Pepe Argento'
       or fila.telefono is distinct from '341 777 8888' or fila.confirmado is distinct from false then
      raise exception 'FALLÓ 9: la reserva buena no dejó el turno y el cliente de siempre.';
    end if;
    if n <> 0 then
      raise exception 'FALLÓ 9: una reserva rechazada dejó un cliente.';
    end if;
    -- La carrera que ataja el índice único (dos personas en el mismo segundo)
    -- no se puede armar desde una sola sesión: se prueba la interna que la
    -- atrapa, contra un horario ya tomado.
    r := anotar_turno((select x from negocio x where x.id = neg), marcela, manana, 'Algo', null);
    if r is distinct from '{"ok": false, "motivo": "Justo te lo ganaron. Elegí otro horario."}'::jsonb then
      raise exception 'FALLÓ 9: el choque con el índice único no contesta "te lo ganaron" (¿falta turno_horario_unico de la 023?): %', r;
    end if;
    perform set_config('role', 'anon', true);

    -- ---- 10. Las tablas y las internas no se tocan desde afuera ----
    frenado := false;
    begin perform 1 from landing_sesion; exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: anon puede leer landing_sesion.'; end if;
    frenado := false;
    begin perform 1 from landing_intento; exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: anon puede leer landing_intento.'; end if;
    frenado := false;
    begin perform landing_del_codigo(cod_landing); exception when insufficient_privilege then frenado := true; end;
    if not frenado then raise exception 'FALLÓ 10: anon puede llamar a una función interna.'; end if;

    perform set_config('role', 'postgres', true);
    select count(*) into n
      from unnest(array['anon', 'authenticated']) quien,
           unnest(array['landing_del_codigo(text)',
                        'clientes_de_la_landing(uuid, text, text)',
                        'sesion_de_la_llave(uuid, text)',
                        'abrir_sesion_landing(uuid, text, text)',
                        'landing_bloqueada(uuid, text)',
                        'agenda_del_negocio(negocio)',
                        'por_que_no_se_reserva(negocio, timestamptz, text)',
                        'anotar_turno(negocio, uuid, timestamptz, text, text)']) funcion
     where has_function_privilege(quien, funcion, 'execute');
    if n <> 0 then
      raise exception 'FALLÓ 10: anon o authenticated pueden llamar a % funciones internas.', n;
    end if;
    if has_function_privilege('anon', 'compartir_landing()', 'execute')
       or has_function_privilege('anon', 'dejar_de_compartir_landing()', 'execute') then
      raise exception 'FALLÓ 10: anon puede compartir o dejar de compartir la landing.';
    end if;
    select count(*) into n
      from unnest(array['anon', 'authenticated']) quien,
           unnest(array['landing_sesion', 'landing_intento']) tabla,
           unnest(array['select', 'insert', 'update', 'delete']) permiso
     where has_table_privilege(quien, tabla, permiso);
    if n <> 0 then
      raise exception 'FALLÓ 10: anon o authenticated tienen % permisos sobre las tablas de la landing.', n;
    end if;
    if exists (select 1 from pg_class
                where relnamespace = 'public'::regnamespace
                  and relname in ('landing_sesion', 'landing_intento')
                  and not relrowsecurity)
       or exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename in ('landing_sesion', 'landing_intento')) then
      raise exception 'FALLÓ 10: las tablas de la landing no tienen RLS o tienen políticas.';
    end if;
    -- La limpieza de cada ingreso borra por fecha: sin estos índices recorre
    -- las tablas enteras.
    if not exists (select 1 from pg_indexes
                    where schemaname = 'public' and tablename = 'landing_intento'
                      and indexdef like '%(creado_en)')
       or not exists (select 1 from pg_indexes
                       where schemaname = 'public' and tablename = 'landing_sesion'
                         and indexdef like '%(vence_en)') then
      raise exception 'FALLÓ 10: faltan los índices de la limpieza (landing_intento por creado_en, landing_sesion por vence_en).';
    end if;

    -- ---- 11. Compartir la landing: sólo el dueño, y siempre el mismo código ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select codigo into link_equipo from cambiar_link_de_equipo(30);
    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    perform pedir_entrar(link_equipo, 'Edu');
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select id into pedido from pedidos_de_ingreso() where nombre = 'Edu';
    -- Desde la 060 se aprueba con el rol del negocio (rol.id), no con una palabra.
    perform aprobar_solicitud(pedido, (select id from rol where negocio_id = neg and nombre = 'Encargado'));

    perform set_config('request.jwt.claims', json_build_object('sub', edu, 'role', 'authenticated')::text, true);
    frenado := false;
    begin
      perform compartir_landing();
    exception when raise_exception then
      frenado := (sqlerrm = 'Compartir la landing lo hace el dueño del negocio.');
    end;
    if not frenado then raise exception 'FALLÓ 11: el encargado compartió la landing.'; end if;
    frenado := false;
    begin
      perform dejar_de_compartir_landing();
    exception when raise_exception then
      frenado := (sqlerrm = 'Dejar de compartir la landing lo hace el dueño del negocio.');
    end;
    if not frenado then raise exception 'FALLÓ 11: el encargado dejó de compartir la landing.'; end if;

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    if compartir_landing() is distinct from cod_landing or compartir_landing() is distinct from cod_landing then
      raise exception 'FALLÓ 11: compartir otra vez no devolvió el mismo código.';
    end if;

    -- Dejar de compartir apaga el link y las llaves; volver a compartir da otro.
    perform dejar_de_compartir_landing();
    perform set_config('role', 'postgres', true);
    select count(*) into n from landing_sesion where negocio_id = neg;
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    if n <> 0
       or ver_landing(cod_landing) is distinct from '{"sirve": false}'::jsonb
       or mis_turnos_landing(cod_landing, llave_m)
            is distinct from '{"ok": false, "motivo": "landing_no_encontrada"}'::jsonb then
      raise exception 'FALLÓ 11: dejar de compartir no apagó el link o dejó llaves vivas.';
    end if;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    cod_nuevo := compartir_landing();
    if cod_nuevo is not distinct from cod_landing then
      raise exception 'FALLÓ 11: volver a compartir no dio un link nuevo.';
    end if;
    cod_landing := cod_nuevo;

    -- ---- 12. Entrar con un registro propio no desarma el bloqueo ----
    -- Quien se registra con la patente de otro y un teléfono propio tiene un
    -- ingreso que siempre entra (coincide con su propio turno). Si entrar con
    -- él borrara los fallidos, intercalándolo cada 4 se adivinaría sin tope.
    -- Va con AA000AA (el caso 239 de Marcela, confirmada): las otras patentes
    -- ya quedaron bloqueadas más arriba.
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    r := reservar_turno_landing(cod_landing, null, manana + interval '3 hours', 'Otro turno',
                                'Intrusa', '11 4000 0099', 'AA000AA');
    if r ->> 'ok' is distinct from 'true' then
      raise exception 'FALLÓ 12: el registro con la patente de otro no salió: %', r;
    end if;
    perform ingresar_landing(cod_landing, 'AA000AA', '1000');
    perform ingresar_landing(cod_landing, 'AA000AA', '2000');
    perform ingresar_landing(cod_landing, 'AA000AA', '3000');
    if ingresar_landing(cod_landing, 'AA000AA', '0099') ->> 'ok' is distinct from 'true' then
      raise exception 'FALLÓ 12: la que se registró no puede entrar con sus datos.';
    end if;
    perform ingresar_landing(cod_landing, 'AA000AA', '4000');
    perform ingresar_landing(cod_landing, 'AA000AA', '5000');
    if ingresar_landing(cod_landing, 'AA000AA', '7890')
         is distinct from '{"ok": false, "motivo": "muchos_intentos"}'::jsonb
       or ingresar_landing(cod_landing, 'AA000AA', '0099')
         is distinct from '{"ok": false, "motivo": "muchos_intentos"}'::jsonb then
      raise exception 'FALLÓ 12: entrar con un registro propio borró los fallidos y el bloqueo se desarmó.';
    end if;

    -- Un identificador vacío no suma intentos (el del 3): si no, cinco
    -- ingresos vacíos contestarían muchos_intentos en vez de datos_incorrectos.
    perform set_config('role', 'postgres', true);
    select count(*) into n from landing_intento where negocio_id = neg and identificador = '';
    perform set_config('role', 'anon', true);
    if n <> 0 then
      raise exception 'FALLÓ 12: un ingreso con el identificador vacío anotó % intentos.', n;
    end if;

    -- ---- 13. Otro cliente confirmado con la misma patente tampoco lo reinicia ----
    -- El contador es por identificador: lo comparten todos los que lo tienen.
    -- Si entrar bien lo borrara, Raúl (confirmado, con la patente que fue de
    -- Lucía) podría intercalar su ingreso y probar los dígitos de ella sin
    -- tope. Patente nueva, porque las de arriba ya quedaron bloqueadas.
    perform set_config('role', 'postgres', true);
    insert into caso (negocio_id, numero, cliente_id, servicio, identificador, estado) values
      (neg, 400, lucia, 'Chapa',   'CC111CC',   'completado'),
      (neg, 401, raul,  'Pintura', 'cc-111-cc', 'nuevo');
    perform set_config('role', 'anon', true);
    perform ingresar_landing(cod_landing, 'CC111CC', '1000');
    perform ingresar_landing(cod_landing, 'CC111CC', '2000');
    perform ingresar_landing(cod_landing, 'CC111CC', '3000');
    perform ingresar_landing(cod_landing, 'CC111CC', '4000');
    if ingresar_landing(cod_landing, 'CC111CC', '3333') ->> 'ok' is distinct from 'true' then
      raise exception 'FALLÓ 13: Raúl no puede entrar con lo suyo.';
    end if;
    perform ingresar_landing(cod_landing, 'CC111CC', '5000');
    if ingresar_landing(cod_landing, 'CC111CC', '1111')
         is distinct from '{"ok": false, "motivo": "muchos_intentos"}'::jsonb
       or ingresar_landing(cod_landing, 'CC111CC', '3333')
         is distinct from '{"ok": false, "motivo": "muchos_intentos"}'::jsonb then
      raise exception 'FALLÓ 13: un cliente confirmado con la misma patente reinició el bloqueo.';
    end if;

    -- ---- 14. Un identificador de más de 40 caracteres no es de nadie ----
    -- Ni el formulario ni la API dejan escribir más, pero las funciones se
    -- pueden llamar directo con la clave anónima. La base contesta como a
    -- cualquier dato malo y no anota nada: si no, se podría llenar la tabla
    -- de intentos con identificadores que no son de nadie. 40 justos sí
    -- cuentan como un intento.
    if ingresar_landing(cod_landing, repeat('Z', 41), '7890')
         is distinct from '{"ok": false, "motivo": "datos_incorrectos"}'::jsonb
       or ingresar_landing(cod_landing, repeat('Y', 40), '7890')
         is distinct from '{"ok": false, "motivo": "datos_incorrectos"}'::jsonb then
      raise exception 'FALLÓ 14: un identificador de más de 40 caracteres no contesta datos_incorrectos.';
    end if;
    r := reservar_turno_landing(cod_landing, null, manana + interval '4 hours', 'Algo',
                                'Largo', '11 4000 0041', repeat('X', 41));
    if r is distinct from '{"ok": false, "motivo": "Falta con qué te identificamos."}'::jsonb then
      raise exception 'FALLÓ 14: el registro con un identificador de más de 40 caracteres no contestó que falta: %', r;
    end if;
    perform set_config('role', 'postgres', true);
    select count(*) filter (where length(identificador) > 40) as largos,
           count(*) filter (where identificador = repeat('Y', 40)) as de40
      into fila
      from landing_intento where negocio_id = neg;
    select count(*) into n from cliente where negocio_id = neg and nombre = 'Largo';
    perform set_config('role', 'anon', true);
    if fila.largos <> 0 or n <> 0 then
      raise exception 'FALLÓ 14: un identificador de más de 40 caracteres anotó % intentos o creó % clientes.', fila.largos, n;
    end if;
    if fila.de40 <> 1 then
      raise exception 'FALLÓ 14: un identificador de 40 caracteres justos no anotó su intento (hay %).', fila.de40;
    end if;

    -- ---- 15. El tope del día: 20 fallidos, aunque vengan espaciados ----
    -- Con sólo el bloqueo de 15 minutos, alguien paciente prueba 5 cada 15
    -- minutos (480 por día) y en tres semanas recorre los 10.000 números. Con
    -- 20 por día lleva más de un año. Los fallidos se corren para atrás de a 4 (como
    -- postgres: now() no avanza dentro de la prueba) para que no caigan en la
    -- ventana de 15 minutos. Patente nueva: las de arriba ya están bloqueadas.
    perform set_config('role', 'postgres', true);
    insert into caso (negocio_id, numero, cliente_id, servicio, identificador, estado) values
      (neg, 402, lucia, 'Alineación', 'DD222DD', 'nuevo');
    perform set_config('role', 'anon', true);
    for i in 1..19 loop
      r := ingresar_landing(cod_landing, 'DD222DD', '0000');
      if r ->> 'motivo' is distinct from 'datos_incorrectos' then
        raise exception 'FALLÓ 15: el fallido % no contestó datos_incorrectos: %', i, r;
      end if;
      if i % 4 = 0 then
        perform set_config('role', 'postgres', true);
        update landing_intento set creado_en = now() - i * interval '20 minutes'
         where negocio_id = neg and identificador = 'DD222DD' and creado_en = now();
        perform set_config('role', 'anon', true);
      end if;
    end loop;
    if ingresar_landing(cod_landing, 'DD222DD', '1111') ->> 'ok' is distinct from 'true' then
      raise exception 'FALLÓ 15: con 19 fallidos en el día (3 en los últimos 15 minutos), los datos buenos no entran.';
    end if;
    perform ingresar_landing(cod_landing, 'DD222DD', '0000');  -- el 20.º, el 4.º de los recientes
    if ingresar_landing(cod_landing, 'DD222DD', '1111')
         is distinct from '{"ok": false, "motivo": "muchos_intentos"}'::jsonb then
      raise exception 'FALLÓ 15: con 20 fallidos en el día (4 en los últimos 15 minutos), los datos buenos entran.';
    end if;
    -- Y vencen solos: pasado el día, se vuelve a entrar.
    perform set_config('role', 'postgres', true);
    update landing_intento set creado_en = now() - interval '25 hours'
     where negocio_id = neg and identificador = 'DD222DD';
    perform set_config('role', 'anon', true);
    if ingresar_landing(cod_landing, 'DD222DD', '1111') ->> 'ok' is distinct from 'true' then
      raise exception 'FALLÓ 15: pasado el día, los fallidos siguen bloqueando.';
    end if;

    -- ---- 16. Sin la Agenda prendida no se sacan turnos por la landing ----
    -- Aunque tenga horarios guardados. El link sirve (los casos se siguen
    -- viendo), así que no es existe:false: la agenda contesta como sin
    -- horarios y la reserva, lo mismo que si no los hubiera publicado. Con
    -- llave y sin llave.
    perform set_config('role', 'postgres', true);
    insert into caso (negocio_id, numero, cliente_id, servicio, identificador, estado) values
      (neg, 403, raul, 'Escape', 'EE333EE', 'nuevo');
    update negocio set modulos_activos = '[]'::jsonb where id = neg;
    perform set_config('role', 'anon', true);
    r := ver_agenda_landing(cod_landing);
    if r ->> 'sirve' is distinct from 'true' or r -> 'horarios' is distinct from 'null'::jsonb then
      raise exception 'FALLÓ 16: con la Agenda apagada, la agenda de la landing trae horarios: %', r;
    end if;
    llave := ingresar_landing(cod_landing, 'EE333EE', '3333') ->> 'llave';
    r := '{"ok": false, "motivo": "El negocio todavía no publicó sus horarios."}'::jsonb;
    if llave is null
       or reservar_turno_landing(cod_landing, llave, manana + interval '5 hours', 'Algo', null, null, null)
            is distinct from r
       or reservar_turno_landing(cod_landing, null, manana + interval '5 hours', 'Algo',
                                 'Nueva', '11 4000 0055', 'FF444FF') is distinct from r then
      raise exception 'FALLÓ 16: con la Agenda apagada se reserva por la landing, o no contesta como sin horarios.';
    end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
