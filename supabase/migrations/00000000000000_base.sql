


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."abrir_sesion_landing"("p_negocio" "uuid", "p_identificador" "text", "p_ultimos4" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  llave text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  vence timestamptz := now() + interval '12 hours';
begin
  insert into landing_sesion (huella, negocio_id, identificador, ultimos4, vence_en)
  values (encode(sha256(convert_to(llave, 'UTF8')), 'hex'), p_negocio, p_identificador, p_ultimos4, vence);

  return jsonb_build_object('llave', llave, 'vence_en', vence);
end;
$$;


ALTER FUNCTION "public"."abrir_sesion_landing"("p_negocio" "uuid", "p_identificador" "text", "p_ultimos4" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."negocio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "rubro" "text" DEFAULT 'taller'::"text" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modulos_activos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "inicio" "jsonb",
    "foto" "text",
    "descripcion" "text",
    "telefono" "text",
    "horarios" "jsonb",
    "agenda_codigo" "text",
    "ics_codigo" "text",
    "nombrar_casos" "text" DEFAULT 'numero'::"text" NOT NULL,
    "creado_por" "uuid",
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "red" "uuid",
    "landing" "jsonb",
    "landing_codigo" "text",
    "pais" "text" DEFAULT 'AR'::"text" NOT NULL,
    CONSTRAINT "negocio_estados_objeto" CHECK (("jsonb_typeof"("estados") = 'object'::"text")),
    CONSTRAINT "negocio_landing_es_objeto" CHECK ((("landing" IS NULL) OR ("jsonb_typeof"("landing") = 'object'::"text"))),
    CONSTRAINT "negocio_nombrar_casos_valido" CHECK (("nombrar_casos" = ANY (ARRAY['numero'::"text", 'cliente'::"text", 'identificador'::"text", 'servicio'::"text"]))),
    CONSTRAINT "negocio_pais_codigo" CHECK (("pais" ~ '^[A-Z]{2}$'::"text")),
    CONSTRAINT "negocio_rubro_check" CHECK (("rubro" = ANY (ARRAY['taller'::"text", 'medicina'::"text", 'service'::"text", 'personalizable'::"text"])))
);


ALTER TABLE "public"."negocio" OWNER TO "postgres";


COMMENT ON COLUMN "public"."negocio"."inicio" IS 'Cómo quedó acomodada la pantalla de Inicio: [{clave, ancho, alto, filtro}]. null = nunca se tocó, vale el orden por defecto. [] = se sacaron todos los módulos.';



COMMENT ON COLUMN "public"."negocio"."landing" IS 'La landing del negocio: {orden, colores: {fondo, cajas, botones, acento: {color, texto}}, fuente}. null = nunca se tocó, vale la de fábrica.';



COMMENT ON COLUMN "public"."negocio"."pais" IS 'Código ISO del país del negocio (AR, UY…). Con él arranca el selector de país de cada teléfono. Los países que se pueden elegir los decide la API (compartido/telefono.ts).';



CREATE OR REPLACE FUNCTION "public"."agenda_del_negocio"("n" "public"."negocio") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."agenda_del_negocio"("n" "public"."negocio") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anotar_turno"("n" "public"."negocio", "p_cliente" "uuid", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_identificador" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."anotar_turno"("n" "public"."negocio", "p_cliente" "uuid", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_identificador" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anular_cobro"("p_cobro_id" "uuid", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  x cobro%rowtype;
begin
  select * into x from cobro where id = p_cobro_id for update;
  if not found or x.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'Ese cobro ya no está.');
  end if;

  if not puede_aca('cobrar') then
    return jsonb_build_object('ok', false, 'motivo', 'Los cobros los corrigen el dueño o el encargado.');
  end if;

  if x.estado not in ('pendiente', 'pagado') then
    return jsonb_build_object('ok', false, 'motivo', 'Ese cobro ya no cuenta: no hay nada que anular.');
  end if;

  if x.estado = 'pagado' and x.medio in ('link', 'qr') then
    return jsonb_build_object('ok', false, 'motivo', 'Ese pago ya entró por el medio de pago. Para devolverlo, hay que hacerlo desde ahí.');
  end if;

  update cobro set
    estado           = 'anulado',
    anulado_en       = now(),
    anulado_por      = mi_empleado(),
    motivo_anulacion = nullif(trim(coalesce(p_motivo, '')), '')
  where id = x.id
  returning * into x;

  return jsonb_build_object('ok', true, 'cobro', to_jsonb(x));
end;
$$;


ALTER FUNCTION "public"."anular_cobro"("p_cobro_id" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anular_cobro_api"("p_cobro_id" "uuid", "p_motivo" "text", "p_autor" "text", "p_detalle" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare r jsonb; e evento%rowtype; x cobro%rowtype;
begin
  select * into x from cobro where id = p_cobro_id;
  r := anular_cobro(p_cobro_id, p_motivo);
  if not coalesce((r->>'ok')::boolean, false) then return r; end if;
  insert into evento (caso_id, tipo, titulo, detalle, icono, monto, autor)
  values (x.caso_id, 'plata', 'Anularon un cobro', p_detalle, 'cruz', x.monto, p_autor)
  returning * into e;
  return r || jsonb_build_object('evento', to_jsonb(e));
end; $$;


ALTER FUNCTION "public"."anular_cobro_api"("p_cobro_id" "uuid", "p_motivo" "text", "p_autor" "text", "p_detalle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aprobar_solicitud"("p_id" "uuid", "p_rol" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  activo uuid := mi_negocio();
  s solicitud_de_ingreso%rowtype;
  nuevo rol%rowtype;
  es_el_primero boolean;
begin
  if not puede_en(activo, 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;

  select * into s from solicitud_de_ingreso x where x.id = p_id and x.negocio_id = activo for update;
  if not found then
    raise exception 'Ese pedido ya no está.';
  end if;

  select * into nuevo from rol where id = p_rol and negocio_id = activo;
  if not found then
    raise exception 'Ese rol ya no existe.';
  end if;
  if nuevo.es_duenio and not soy_duenio_aca() then
    raise exception 'Solo un Dueño puede asignar el rol Dueño.' using errcode = '42501';
  end if;
  if not permisos_del_rol(p_rol) <@ permisos_efectivos(activo) then
    raise exception 'Solo se pueden otorgar permisos incluidos en el rol propio.' using errcode = '42501';
  end if;

  es_el_primero := not exists (select 1 from empleado e where e.usuario_id = s.usuario_id);

  insert into empleado (negocio_id, nombre, rol, rol_id, usuario_id)
  values (activo, s.nombre, nuevo.clave, p_rol, s.usuario_id);

  delete from solicitud_de_ingreso x where x.id = s.id;

  -- Misma regla que la 038: la primera ficha de una cuenta queda de
  -- predeterminado con Inicio rápido.
  if es_el_primero then
    update usuario
       set negocio_predeterminado = activo,
           inicio_rapido          = true
     where id = s.usuario_id;
  end if;

  -- Si no estaba en ningún negocio, entra directo a éste.
  update usuario
     set negocio_id = activo,
         rol        = nuevo.clave
   where id = s.usuario_id
     and negocio_id is null;
end;
$$;


ALTER FUNCTION "public"."aprobar_solicitud"("p_id" "uuid", "p_rol" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."asignar_rol"("p_empleado" "uuid", "p_rol" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  ficha empleado%rowtype;
  nuevo rol%rowtype;
  mios text[] := permisos_efectivos(mi_negocio());
begin
  if not puede_aca('manejar_roles') then
    raise exception 'Este rol no permite manejar roles.' using errcode = '42501';
  end if;

  select * into ficha from empleado where id = p_empleado and negocio_id = mi_negocio() for update;
  if not found then
    raise exception 'Esa persona ya no está en el equipo.';
  end if;
  select * into nuevo from rol where id = p_rol and negocio_id = mi_negocio();
  if not found then
    raise exception 'Ese rol ya no existe.';
  end if;

  if ficha.usuario_id = auth.uid() then
    raise exception 'El rol propio no se modifica.';
  end if;
  if ficha.usuario_id = (select creado_por from negocio where id = ficha.negocio_id) then
    raise exception 'A quien creó el negocio no se le puede cambiar el rol.';
  end if;
  if nuevo.es_duenio and not soy_duenio_aca() then
    raise exception 'Solo un Dueño puede asignar el rol Dueño.' using errcode = '42501';
  end if;
  if (select r.es_duenio from rol r where r.id = ficha.rol_id) and not soy_duenio_aca() then
    raise exception 'Solo un Dueño puede cambiar el rol de otro Dueño.' using errcode = '42501';
  end if;
  if not permisos_del_rol(ficha.rol_id) <@ mios then
    raise exception 'Esta persona tiene permisos que el rol propio no incluye.' using errcode = '42501';
  end if;
  if not permisos_del_rol(p_rol) <@ mios then
    raise exception 'Solo se pueden otorgar permisos incluidos en el rol propio.' using errcode = '42501';
  end if;

  -- La palabra vieja acompaña mientras exista (063): la del rol, o ninguna.
  -- Va con rol_id en el mismo update, así el trigger de la 057 no la pisa.
  update empleado set rol_id = p_rol, rol = nuevo.clave where id = p_empleado;
end;
$$;


ALTER FUNCTION "public"."asignar_rol"("p_empleado" "uuid", "p_rol" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."borrar_negocio"("p_negocio" "uuid", "p_nombre" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n negocio%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.';
  end if;
  select * into n from negocio where id = p_negocio;
  if not found then
    raise exception 'Ese negocio ya no existe.';
  end if;
  if n.creado_por is distinct from auth.uid() then
    raise exception 'Solo quien creó el negocio puede eliminarlo.' using errcode = '42501';
  end if;
  if trim(coalesce(p_nombre, '')) is distinct from trim(n.nombre) then
    raise exception 'El nombre escrito no coincide con el del negocio.';
  end if;

  -- Nadie queda parado en un negocio que no existe. Quien estaba acá vuelve a
  -- su sede de origen si andaba de visita, o a su predeterminado, o a ninguno.
  -- En un UPDATE todas las expresiones leen la fila como estaba antes.
  update usuario
     set negocio_id = case
           when negocio_id = p_negocio
             then coalesce(nullif(visitando_desde, p_negocio), nullif(negocio_predeterminado, p_negocio))
           else negocio_id
         end,
         visitando_desde = case when visitando_desde = p_negocio or negocio_id = p_negocio then null else visitando_desde end,
         negocio_predeterminado = nullif(negocio_predeterminado, p_negocio),
         inicio_rapido = case when negocio_predeterminado = p_negocio then false else inicio_rapido end
   where negocio_id = p_negocio or visitando_desde = p_negocio or negocio_predeterminado = p_negocio;

  delete from negocio where id = p_negocio;
end;
$$;


ALTER FUNCTION "public"."borrar_negocio"("p_negocio" "uuid", "p_nombre" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."borrar_rol"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actual rol%rowtype;
  cuantas integer;
begin
  if not puede_aca('manejar_roles') then
    raise exception 'Este rol no permite manejar roles.' using errcode = '42501';
  end if;
  select * into actual from rol where id = p_id and negocio_id = mi_negocio();
  if not found then
    raise exception 'Ese rol ya no existe.';
  end if;
  if actual.es_duenio then
    raise exception 'El rol Dueño no se modifica.';
  end if;
  if not actual.permisos <@ permisos_efectivos(mi_negocio()) then
    raise exception 'Este rol tiene permisos que el rol propio no incluye.' using errcode = '42501';
  end if;
  select count(*) into cuantas from empleado where rol_id = p_id;
  if cuantas > 0 then
    raise exception 'Rol asignado a % %. Para eliminarlo, asigne otro rol a esas personas.',
      cuantas, case when cuantas = 1 then 'persona' else 'personas' end;
  end if;
  delete from rol where id = p_id;
end;
$$;


ALTER FUNCTION "public"."borrar_rol"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cambiar_descuento_api"("p_caso_id" "uuid", "p_monto" numeric, "p_autor" "text", "p_titulo" "text", "p_detalle" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare c caso%rowtype; e evento%rowtype;
begin
  if not puede_aca('armar_presupuesto') then
    return jsonb_build_object('ok', false, 'motivo', 'Los descuentos los carga el dueño o el encargado.');
  end if;
  update caso set descuento = p_monto where id = p_caso_id returning * into c;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'Ese caso ya no está.'); end if;
  insert into evento (caso_id, tipo, titulo, detalle, icono, monto, autor)
  values (p_caso_id, 'plata', p_titulo, p_detalle,
          case when p_monto > 0 then 'nota' else 'deshacer' end, p_monto, p_autor)
  returning * into e;
  return jsonb_build_object('ok', true, 'caso', to_jsonb(c), 'evento', to_jsonb(e));
end; $$;


ALTER FUNCTION "public"."cambiar_descuento_api"("p_caso_id" "uuid", "p_monto" numeric, "p_autor" "text", "p_titulo" "text", "p_detalle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cambiar_estado_con_notificacion"("p_caso_id" "uuid", "p_actualizado_en" timestamp with time zone, "p_estado" "text", "p_que_falta" "text", "p_evento" "jsonb", "p_notificacion" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
declare
  v_caso public.caso%rowtype;
  v_evento public.evento%rowtype;
  v_notificacion public.seguimiento_whatsapp%rowtype;
  v_telefono text;
  v_ahora timestamptz;
begin
  if not public.puede_aca('avanzar_casos') then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_estado is null or p_estado not in ('nuevo', 'en_proceso', 'esperando', 'revision_final') then
    return jsonb_build_object('ok', false, 'motivo', 'estado_invalido');
  end if;

  select * into v_caso from public.caso
    where id = p_caso_id and negocio_id = public.mi_negocio() for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'caso_no_encontrado');
  end if;
  if v_caso.estado = 'completado' then
    return jsonb_build_object('ok', false, 'motivo', 'caso_cerrado');
  end if;
  if v_caso.actualizado_en is distinct from p_actualizado_en then
    return jsonb_build_object('ok', false, 'motivo', 'choque');
  end if;
  if v_caso.estado = p_estado then
    return jsonb_build_object('ok', true, 'caso', to_jsonb(v_caso), 'evento', null, 'notificacion', null);
  end if;

  select regexp_replace(coalesce(telefono, ''), '[[:space:]()+.\-]', '', 'g')
    into v_telefono from public.cliente
    where id = v_caso.cliente_id and negocio_id = v_caso.negocio_id;
  if v_telefono is null or v_telefono !~ '^[1-9][0-9]{7,14}$'
    or v_telefono is distinct from (p_notificacion->>'telefono') then
    return jsonb_build_object('ok', false, 'motivo', 'telefono_invalido');
  end if;
  if jsonb_typeof(p_notificacion) is distinct from 'object'
    or coalesce(length(btrim(p_notificacion->>'numero_emisor_id')), 0) = 0
    or coalesce(length(p_notificacion->>'mensaje'), 0) not between 1 and 4096
    or jsonb_typeof(p_evento) is distinct from 'object'
    or coalesce(length(btrim(p_evento->>'titulo')), 0) = 0
    or coalesce(length(btrim(p_evento->>'autor')), 0) = 0
    or p_que_falta is null then
    return jsonb_build_object('ok', false, 'motivo', 'notificacion_invalida');
  end if;

  v_ahora := clock_timestamp();
  update public.caso set estado = p_estado, que_falta = p_que_falta
    where id = v_caso.id and negocio_id = v_caso.negocio_id
    returning * into v_caso;
  insert into public.evento(caso_id, tipo, estado, titulo, detalle, icono, autor, ocurrido_en)
    values (v_caso.id, 'estado', p_estado, p_evento->>'titulo',
      p_evento->>'detalle', p_evento->>'icono', p_evento->>'autor', v_ahora)
    returning * into v_evento;
  insert into public.seguimiento_whatsapp(
    caso_id, negocio_id, cerrado_en, enviar_en, telefono, mensaje, numero_emisor_id, tipo
  ) values (
    v_caso.id, v_caso.negocio_id, v_ahora, v_ahora, v_telefono,
    p_notificacion->>'mensaje', p_notificacion->>'numero_emisor_id', 'estado'
  ) returning * into v_notificacion;

  return jsonb_build_object('ok', true, 'caso', to_jsonb(v_caso),
    'evento', to_jsonb(v_evento), 'notificacion', to_jsonb(v_notificacion));
end;
$_$;


ALTER FUNCTION "public"."cambiar_estado_con_notificacion"("p_caso_id" "uuid", "p_actualizado_en" timestamp with time zone, "p_estado" "text", "p_que_falta" "text", "p_evento" "jsonb", "p_notificacion" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cambiar_link_de_equipo"("p_dias" integer DEFAULT 30) RETURNS TABLE("codigo" "text", "vence_en" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  activo uuid := mi_negocio();
begin
  if not puede_en(activo, 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'El link dura entre 1 y 365 días.';
  end if;

  update invitacion i
     set anulada = true
   where i.negocio_id = activo
     and i.de_equipo
     and not i.anulada;

  return query
    insert into invitacion as i (negocio_id, de_equipo, usos_maximos, vence_en, creada_por)
    values (activo, true, 2147483647, now() + make_interval(days => p_dias), auth.uid())
    returning i.codigo, i.vence_en;
end;
$$;


ALTER FUNCTION "public"."cambiar_link_de_equipo"("p_dias" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancelar_seguimiento_al_reabrir"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  update public.seguimiento_whatsapp
  set estado = 'cancelado', procesado_en = statement_timestamp()
  where caso_id = new.id
    and negocio_id = new.negocio_id
    and estado = 'pendiente';
  return new;
end;
$$;


ALTER FUNCTION "public"."cancelar_seguimiento_al_reabrir"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."caso_cambio_permitido"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_nuevo jsonb;
  v_viejo jsonb;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (new.estado = 'completado') is distinct from (old.estado = 'completado') then
    if not puede_aca('entregar_y_reabrir') then
      raise exception 'Este rol no permite entregar ni reabrir casos.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.responsable_id is distinct from old.responsable_id then
    if not puede_aca('asignar_casos') then
      raise exception 'Este rol no permite asignar casos.' using errcode = '42501';
    end if;
  elsif new.estado is distinct from old.estado and not puede_aca('avanzar_casos') then
    raise exception 'Este rol no permite cambiar el estado de los casos.' using errcode = '42501';
  end if;

  v_nuevo := to_jsonb(new) - 'responsable_id' - 'estado' - 'actualizado_en';
  v_viejo := to_jsonb(old) - 'responsable_id' - 'estado' - 'actualizado_en';
  if new.estado is distinct from old.estado or new.responsable_id is distinct from old.responsable_id then
    v_nuevo := v_nuevo - 'que_falta';
    v_viejo := v_viejo - 'que_falta';
  end if;
  if v_nuevo is distinct from v_viejo and not puede_aca('avanzar_casos')
     and not ((v_nuevo - 'descuento') = (v_viejo - 'descuento') and puede_aca('armar_presupuesto')) then
    raise exception 'Este rol no permite modificar casos.' using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."caso_cambio_permitido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cliente_avisos_baja_por_su_camino"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if current_user in ('authenticated', 'anon') and (
    (tg_op = 'INSERT' and new.avisos_baja_en is not null) or
    (tg_op = 'UPDATE' and new.avisos_baja_en is distinct from old.avisos_baja_en)
  ) then
    raise exception 'La baja de avisos la pide el cliente por WhatsApp y se revierte desde su ficha.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."cliente_avisos_baja_por_su_camino"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clientes_de_la_landing"("p_negocio" "uuid", "p_identificador" "text", "p_ultimos4" "text") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."clientes_de_la_landing"("p_negocio" "uuid", "p_identificador" "text", "p_ultimos4" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cobro_recalcular_caso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_caso uuid := coalesce(new.caso_id, old.caso_id);
begin
  update caso set
    cobrado    = (select sum(monto)     from cobro where caso_id = v_caso and estado = 'pagado'),
    cobrado_en = (select max(pagado_en) from cobro where caso_id = v_caso and estado = 'pagado')
  where id = v_caso;
  return null;
end;
$$;


ALTER FUNCTION "public"."cobro_recalcular_caso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compartir_agenda"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  yo     uuid := mi_negocio();
  actual text;
begin
  if yo is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if not puede_aca('configurar_negocio') then
    raise exception 'Compartir la agenda lo hace el dueño del negocio.';
  end if;

  select agenda_codigo into actual from negocio where id = yo for update;
  if actual is not null then
    return actual;
  end if;

  loop
    actual := replace(gen_random_uuid()::text, '-', '');
    exit when not exists (select 1 from negocio where agenda_codigo = actual);
  end loop;

  update negocio set agenda_codigo = actual where id = yo;
  return actual;
end;
$$;


ALTER FUNCTION "public"."compartir_agenda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compartir_caso"("p_caso_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actual text;
begin
  if not puede_aca('avanzar_casos') then
    raise exception 'Compartir el estado con el cliente lo hacen el dueño y el encargado.';
  end if;

  -- "for update" bloquea la fila hasta terminar: dos personas tocando
  -- "Compartir" al mismo tiempo no pueden generar dos códigos distintos y
  -- dejar uno de los dos links muerto al nacer.
  select seguimiento_codigo into actual
  from caso
  where id = p_caso_id and negocio_id = mi_negocio()
  for update;

  if not found then
    raise exception 'Ese caso no es de tu negocio.';
  end if;

  if actual is not null then
    return actual;
  end if;

  -- El choque es virtualmente imposible con 16 bytes, pero el índice único
  -- lo haría fallar y el negocio vería un error sin culpa suya.
  loop
    actual := replace(gen_random_uuid()::text, '-', '');
    exit when not exists (select 1 from caso where seguimiento_codigo = actual);
  end loop;

  update caso set seguimiento_codigo = actual, seguimiento_visto_en = null
  where id = p_caso_id;

  return actual;
end;
$$;


ALTER FUNCTION "public"."compartir_caso"("p_caso_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compartir_ics"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  yo     uuid := mi_negocio();
  actual text;
begin
  if yo is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if not puede_aca('configurar_negocio') then
    raise exception 'Poner la agenda en el calendario lo hace el dueño del negocio.';
  end if;

  -- "for update" bloquea la fila: dos pestañas tocando el botón a la vez no
  -- pueden generar dos códigos y dejar uno de los dos links muerto al nacer.
  select ics_codigo into actual from negocio where id = yo for update;
  if actual is not null then
    return actual;
  end if;

  loop
    actual := replace(gen_random_uuid()::text, '-', '');
    exit when not exists (select 1 from negocio where ics_codigo = actual);
  end loop;

  update negocio set ics_codigo = actual where id = yo;
  return actual;
end;
$$;


ALTER FUNCTION "public"."compartir_ics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compartir_landing"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  yo     uuid := mi_negocio();
  actual text;
begin
  if yo is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if not puede_aca('configurar_negocio') then
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


ALTER FUNCTION "public"."compartir_landing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."creado_por_fijo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.creado_por is distinct from old.creado_por and auth.uid() is not null then
    raise exception 'Quién creó el negocio no se cambia.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."creado_por_fijo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_mi_negocio"("p_nombre" "text", "p_rubro" "text", "p_modulos" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  nuevo uuid;
  mi_mail text;
  mi_nombre text;
  es_el_primero boolean;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión para crear un negocio.';
  end if;

  -- El primero: la cuenta no tenía ninguna ficha antes de este alta. Así no
  -- se le vuelve a prender el predeterminado a quien lo apagó a propósito.
  es_el_primero := not exists (select 1 from empleado where usuario_id = auth.uid());

  select email into mi_mail from auth.users where id = auth.uid();

  -- La fila de usuario puede no existir todavía, según cuándo se confirmó el
  -- mail. Va antes que el negocio: negocio.creado_por apunta a ella.
  insert into usuario (id, email)
  values (auth.uid(), mi_mail)
  on conflict (id) do nothing;

  -- creado_por va en el alta y no en un update después: el trigger
  -- negocio_creado_por_fijo frena cualquier cambio hecho con sesión.
  insert into negocio (nombre, rubro, modulos_activos, creado_por)
  values (p_nombre, p_rubro, coalesce(p_modulos, '[]'::jsonb), auth.uid())
  returning id into nuevo;

  -- El rol va explícito: quien es encargado en el negocio en el que está y
  -- crea otro, entra al nuevo como dueño.
  update usuario
     set negocio_id = nuevo,
         rol        = 'duenio'
   where id = auth.uid();

  select nombre into mi_nombre from usuario where id = auth.uid();

  insert into empleado (negocio_id, nombre, rol, usuario_id)
  values (
    nuevo,
    coalesce(nullif(trim(mi_nombre), ''), split_part(coalesce(mi_mail, 'Alguien'), '@', 1)),
    'duenio',
    auth.uid()
  );

  -- Como el pasaje de la sección 1: con un solo negocio se entra directo, sin
  -- pasar por "¿A qué negocio entrás?" con una sola fila.
  if es_el_primero then
    update usuario
       set negocio_predeterminado = nuevo,
           inicio_rapido          = true
     where id = auth.uid();
  end if;

  return nuevo;
end;
$$;


ALTER FUNCTION "public"."crear_mi_negocio"("p_nombre" "text", "p_rubro" "text", "p_modulos" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_roles_del_negocio"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into rol (negocio_id, nombre, es_duenio, permisos, clave)
  values (new.id, 'Dueño', true, '{}', 'duenio');

  insert into rol (negocio_id, nombre, permisos, clave)
  select new.id, b.nombre, b.permisos, b.clave from roles_base(new.rubro) b;

  return new;
end;
$$;


ALTER FUNCTION "public"."crear_roles_del_negocio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dejar_de_compartir_agenda"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if mi_negocio() is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if not puede_aca('configurar_negocio') then
    raise exception 'Dejar de compartir la agenda lo hace el dueño del negocio.';
  end if;

  update negocio set agenda_codigo = null where id = mi_negocio();
end;
$$;


ALTER FUNCTION "public"."dejar_de_compartir_agenda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dejar_de_compartir_caso"("p_caso_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not puede_aca('avanzar_casos') then
    raise exception 'Dejar de compartir lo hacen el dueño y el encargado.';
  end if;

  update caso
  set seguimiento_codigo = null, seguimiento_visto_en = null
  where id = p_caso_id and negocio_id = mi_negocio();

  if not found then
    raise exception 'Ese caso no es de tu negocio.';
  end if;
end;
$$;


ALTER FUNCTION "public"."dejar_de_compartir_caso"("p_caso_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dejar_de_compartir_ics"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if mi_negocio() is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if not puede_aca('configurar_negocio') then
    raise exception 'Sacar la agenda del calendario lo hace el dueño del negocio.';
  end if;

  update negocio set ics_codigo = null where id = mi_negocio();
end;
$$;


ALTER FUNCTION "public"."dejar_de_compartir_ics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dejar_de_compartir_landing"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if mi_negocio() is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if not puede_aca('configurar_negocio') then
    raise exception 'Dejar de compartir la landing lo hace el dueño del negocio.';
  end if;

  update negocio set landing_codigo = null where id = mi_negocio();
  delete from landing_sesion where negocio_id = mi_negocio();
end;
$$;


ALTER FUNCTION "public"."dejar_de_compartir_landing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."desvincular_sede"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  activo uuid := mi_negocio();
  la_red uuid;
begin
  if not puede_en(activo, 'vincular_sedes') then
    raise exception 'Desvincular sedes lo hace el dueño del negocio.' using errcode = '42501';
  end if;

  select red into la_red from negocio where id = activo;
  if la_red is null then
    return;
  end if;
  update negocio set red = null where id = activo;
  if (select count(*) from negocio where red = la_red) = 1 then
    update negocio set red = null where red = la_red;
  end if;
end;
$$;


ALTER FUNCTION "public"."desvincular_sede"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."empezar_prueba"() RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_hasta timestamptz;
begin
  if mi_negocio() is null or not soy_duenio_aca() then
    raise exception 'La prueba la empieza el dueño del negocio.';
  end if;
  if exists (select 1 from prueba_gratis where usuario_id = auth.uid()) then
    raise exception 'Esta cuenta ya usó su mes de prueba.';
  end if;
  -- Con dos dueños, el segundo no le suma otro mes al mismo negocio.
  if exists (select 1 from prueba_gratis where negocio_id = mi_negocio()) then
    raise exception 'Este negocio ya tuvo su mes de prueba.';
  end if;
  if exists (select 1 from usuario_suscripcion
              where negocio_id = mi_negocio() and estado = 'authorized') then
    raise exception 'El negocio ya tiene una suscripción activa.';
  end if;

  insert into prueba_gratis (usuario_id, negocio_id, hasta)
  values (auth.uid(), mi_negocio(), now() + interval '30 days')
  returning hasta into v_hasta;

  return v_hasta;
end;
$$;


ALTER FUNCTION "public"."empezar_prueba"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."entrar_al_negocio"("p_negocio" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  su_rol text;
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;

  select rol into su_rol
    from empleado
   where usuario_id = auth.uid()
     and negocio_id = p_negocio;

  if not found then
    raise exception 'No estás en ese negocio.';
  end if;

  update usuario
     set negocio_id      = p_negocio,
         rol             = su_rol,
         visitando_desde = null
   where id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."entrar_al_negocio"("p_negocio" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."entrar_de_visita"("p_sede" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  origen uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.';
  end if;
  select coalesce(visitando_desde, negocio_id) into origen from usuario where id = auth.uid();

  if exists (select 1 from empleado where negocio_id = p_sede and usuario_id = auth.uid()) then
    raise exception 'Ya es miembro de esa sede: se entra desde el selector de negocios.';
  end if;
  if not exists (select 1 from sedes_que_veo() s where s.id = p_sede and not s.soy_miembro) then
    raise exception 'Su rol no incluye el permiso «Ver las sedes vinculadas».' using errcode = '42501';
  end if;

  update usuario set negocio_id = p_sede, visitando_desde = origen where id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."entrar_de_visita"("p_sede" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."entregar_caso"("p_caso_id" "uuid", "p_monto" numeric DEFAULT NULL::numeric, "p_medio" "text" DEFAULT NULL::"text", "p_nota" "text" DEFAULT NULL::"text", "p_descuento" numeric DEFAULT 0, "p_detalle" "text" DEFAULT 'El caso queda cerrado.'::"text", "p_autor" "text" DEFAULT 'El equipo'::"text", "p_ocurrido_en" timestamp with time zone DEFAULT "now"(), "p_volver_en" "date" DEFAULT NULL::"date", "p_toca_volver_en" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  actual caso%rowtype;
  cerrado caso%rowtype;
  pago jsonb := null;
  nuevo_evento evento%rowtype;
begin
  select * into actual from caso where id = p_caso_id for update;
  if not found or actual.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'Ese caso ya no está.');
  end if;
  if not puede_aca('entregar_y_reabrir') then
    return jsonb_build_object('ok', false, 'motivo', 'Los casos los entrega el dueño o el encargado.');
  end if;
  if actual.estado = 'completado' then
    return jsonb_build_object('ok', false, 'motivo', 'Ese caso ya está entregado.');
  end if;
  if p_descuento < 0 then
    return jsonb_build_object('ok', false, 'motivo', 'El descuento no puede ser negativo.');
  end if;

  if p_monto is not null and p_monto > 0 then
    pago := registrar_cobro(p_caso_id, p_monto, p_medio, p_nota);
    if not coalesce((pago->>'ok')::boolean, false) then
      return pago;
    end if;
  end if;

  update caso set
    estado = 'completado',
    que_falta = null,
    descuento = p_descuento,
    -- El cero explícito conserva la diferencia histórica entre "no se cobró"
    -- y "no sabemos cuánto se cobró" cuando todavía no hay ningún cobro.
    cobrado = case
      when p_monto is null and not exists (select 1 from cobro where caso_id = p_caso_id) then 0
      else cobrado
    end,
    cobrado_en = case
      when p_monto is null and not exists (select 1 from cobro where caso_id = p_caso_id) then p_ocurrido_en
      else cobrado_en
    end,
    volver_en = case when p_toca_volver_en then p_volver_en else volver_en end
  where id = p_caso_id
  returning * into cerrado;

  insert into evento (caso_id, tipo, titulo, detalle, icono, estado, monto, autor, ocurrido_en)
  values (p_caso_id, 'entrega', 'Entregaron el trabajo', p_detalle, 'listo', 'completado',
          p_monto, p_autor, p_ocurrido_en)
  returning * into nuevo_evento;

  return jsonb_build_object(
    'ok', true,
    'caso', to_jsonb(cerrado),
    'cobro', pago->'cobro',
    'evento', to_jsonb(nuevo_evento)
  );
end;
$$;


ALTER FUNCTION "public"."entregar_caso"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_descuento" numeric, "p_detalle" "text", "p_autor" "text", "p_ocurrido_en" timestamp with time zone, "p_volver_en" "date", "p_toca_volver_en" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."entregar_caso_con_seguimiento"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_descuento" numeric, "p_detalle" "text", "p_autor" "text", "p_ocurrido_en" timestamp with time zone, "p_seguimiento" "jsonb", "p_volver_en" "date" DEFAULT NULL::"date", "p_toca_volver_en" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  resultado jsonb;
  pendiente public.seguimiento_whatsapp%rowtype;
begin
  resultado := public.entregar_caso(
    p_caso_id => p_caso_id, p_monto => p_monto, p_medio => p_medio, p_nota => p_nota,
    p_descuento => p_descuento, p_detalle => p_detalle, p_autor => p_autor, p_ocurrido_en => p_ocurrido_en,
    p_volver_en => p_volver_en, p_toca_volver_en => p_toca_volver_en
  );
  if not coalesce((resultado->>'ok')::boolean, false) then return resultado; end if;

  insert into public.seguimiento_whatsapp (
    caso_id, negocio_id, cerrado_en, enviar_en, telefono, mensaje, numero_emisor_id
  ) values (
    p_caso_id, (resultado->'caso'->>'negocio_id')::uuid, p_ocurrido_en,
    (p_seguimiento->>'enviar_en')::timestamptz, p_seguimiento->>'telefono',
    p_seguimiento->>'mensaje', p_seguimiento->>'numero_emisor_id'
  ) returning * into pendiente;

  return resultado || jsonb_build_object('seguimiento', to_jsonb(pendiente));
end;
$$;


ALTER FUNCTION "public"."entregar_caso_con_seguimiento"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_descuento" numeric, "p_detalle" "text", "p_autor" "text", "p_ocurrido_en" timestamp with time zone, "p_seguimiento" "jsonb", "p_volver_en" "date", "p_toca_volver_en" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."estoy_aca"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select mi_empleado() is not null
      or cardinality(permisos_efectivos(mi_negocio())) > 0;
$$;


ALTER FUNCTION "public"."estoy_aca"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fotos_del_equipo"() RETURNS TABLE("usuario_id" "uuid", "foto" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select u.id, u.foto
    from empleado e
    join usuario u on u.id = e.usuario_id
   where e.negocio_id = mi_negocio()
     and estoy_aca()
     and u.foto is not null;
$$;


ALTER FUNCTION "public"."fotos_del_equipo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_foto" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  limpio text := nullif(trim(p_nombre), '');
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;

  if limpio is null then
    raise exception 'Falta tu nombre.';
  end if;

  -- Una foto es una imagen chica ya achicada: unos 20 KB. El tope deja
  -- margen de sobra y frena que alguien guarde cualquier cosa, de cualquier
  -- tamaño, llamando a la función a mano.
  if p_foto is not null and (p_foto not like 'data:image/%' or length(p_foto) > 400000) then
    raise exception 'La foto no es válida.';
  end if;

  update usuario
     set nombre   = limpio,
         telefono = nullif(trim(p_telefono), ''),
         foto     = p_foto
   where id = auth.uid();

  -- La ficha del equipo es la que firma el historial. El dueño no tiene
  -- ficha: para él no cambia ninguna fila, y está bien.
  update empleado
     set nombre = limpio
   where usuario_id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."guardar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_foto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_preferencias_de_entrada"("p_predeterminado" "uuid", "p_inicio_rapido" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta entrar con tu cuenta.';
  end if;

  if p_predeterminado is not null and not exists (
    select 1 from empleado
     where usuario_id = auth.uid()
       and negocio_id = p_predeterminado
  ) then
    raise exception 'No estás en ese negocio.';
  end if;

  if coalesce(p_inicio_rapido, false) and p_predeterminado is null then
    raise exception 'Elegí primero cuál es tu negocio predeterminado.';
  end if;

  update usuario
     set negocio_predeterminado = p_predeterminado,
         inicio_rapido          = coalesce(p_inicio_rapido, false)
   where id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."guardar_preferencias_de_entrada"("p_predeterminado" "uuid", "p_inicio_rapido" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_rol"("p_id" "uuid", "p_nombre" "text", "p_permisos" "text"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actual rol%rowtype;
  limpio text[];
  mio uuid;
  nombre_limpio text := nullif(trim(p_nombre), '');
begin
  if not puede_aca('manejar_roles') then
    raise exception 'Este rol no permite manejar roles.' using errcode = '42501';
  end if;
  if nombre_limpio is null then
    raise exception 'El rol necesita un nombre.';
  end if;

  -- Algunos permisos no sirven sin el de mirar lo mismo (src/lib/permisos.js,
  -- "implica"): se suman acá, antes del tope, así el tope también los mira.
  limpio := array(
    select distinct x from (
      select unnest(coalesce(p_permisos, '{}')) as x
      union
      select i.implicado
        from (values ('crear_casos', 'ver_todos_los_casos'), ('editar_clientes', 'ver_clientes'),
                     ('editar_inventario', 'ver_inventario'), ('manejar_turnos', 'ver_agenda')) i(clave, implicado)
       where i.clave = any(coalesce(p_permisos, '{}'))
    ) t order by 1);
  if not limpio <@ permisos_conocidos() then
    raise exception 'Hay un permiso que no existe.';
  end if;
  if not limpio <@ permisos_efectivos(mi_negocio()) then
    raise exception 'Solo se pueden otorgar permisos incluidos en el rol propio.' using errcode = '42501';
  end if;

  if p_id is null then
    insert into rol (negocio_id, nombre, permisos)
    values (mi_negocio(), nombre_limpio, limpio)
    returning id into p_id;
    return p_id;
  end if;

  select * into actual from rol where id = p_id and negocio_id = mi_negocio();
  if not found then
    raise exception 'Ese rol ya no existe.';
  end if;
  if actual.es_duenio then
    raise exception 'El rol Dueño no se modifica.';
  end if;
  select rol_id into mio from empleado where negocio_id = mi_negocio() and usuario_id = auth.uid();
  if actual.id = mio then
    raise exception 'El rol propio no se modifica.';
  end if;
  if not actual.permisos <@ permisos_efectivos(mi_negocio()) then
    raise exception 'Este rol tiene permisos que el rol propio no incluye.' using errcode = '42501';
  end if;

  update rol set nombre = nombre_limpio, permisos = limpio where id = p_id;
  return p_id;
exception
  when unique_violation then
    raise exception 'Ya hay un rol con ese nombre.';
end;
$$;


ALTER FUNCTION "public"."guardar_rol"("p_id" "uuid", "p_nombre" "text", "p_permisos" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hueco_ofrecido"("p_horarios" "jsonb", "p_cuando" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."hueco_ofrecido"("p_horarios" "jsonb", "p_cuando" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ingresar_landing"("p_codigo" "text", "p_identificador" "text", "p_ultimos4" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

  -- Un identificador vacío no es de nadie, y uno de más de 40 caracteres
  -- tampoco (el formulario y la API no dejan escribir más; esto es para quien
  -- llama a la función directo). No se anotan: cinco ingresos vacíos no
  -- contestan muchos_intentos en vez de datos_incorrectos, y nadie llena la
  -- tabla de intentos con identificadores inventados.
  if ident = '' or length(ident) > 40 then
    return jsonb_build_object('ok', false, 'motivo', 'datos_incorrectos');
  end if;

  if landing_bloqueada(n.id, ident) then
    return jsonb_build_object('ok', false, 'motivo', 'muchos_intentos');
  end if;

  if length(u4) <> 4 or not exists (select 1 from clientes_de_la_landing(n.id, ident, u4)) then
    insert into landing_intento (negocio_id, identificador) values (n.id, ident);
    return jsonb_build_object('ok', false, 'motivo', 'datos_incorrectos');
  end if;

  return jsonb_build_object('ok', true) || abrir_sesion_landing(n.id, ident, u4);
end;
$$;


ALTER FUNCTION "public"."ingresar_landing"("p_codigo" "text", "p_identificador" "text", "p_ultimos4" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventario_de_mis_sedes"() RETURNS TABLE("negocio_id" "uuid", "id" "uuid", "nombre" "text", "marca" "text", "modelo" "text", "categoria" "text", "cantidad" integer, "minimo" integer, "unidad" "text", "por_caja" integer, "estado" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select i.negocio_id, i.id, i.nombre, i.marca, i.modelo, i.categoria,
         i.cantidad, i.minimo, i.unidad, i.por_caja, i.estado
    from insumo i
    join mis_sedes() s on s.id = i.negocio_id
   where i.estado in ('en_stock', 'pedido')
     and puede_en(i.negocio_id, 'ver_inventario_de_sedes');
$$;


ALTER FUNCTION "public"."inventario_de_mis_sedes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."landing_bloqueada"("p_negocio" "uuid", "p_identificador" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_negocio::text || ' ' || p_identificador, 0));

  return (select count(*) filter (where creado_en > now() - interval '15 minutes') >= 5
                 or count(*) >= 20
            from landing_intento
           where negocio_id = p_negocio
             and identificador = p_identificador
             and creado_en > now() - interval '1 day');
end;
$$;


ALTER FUNCTION "public"."landing_bloqueada"("p_negocio" "uuid", "p_identificador" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."landing_del_codigo"("p_codigo" "text") RETURNS "public"."negocio"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select * from negocio
   where length(p_codigo) >= 8
     and landing_codigo = p_codigo;
$$;


ALTER FUNCTION "public"."landing_del_codigo"("p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_de_equipo"() RETURNS TABLE("codigo" "text", "vence_en" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not puede_en(mi_negocio(), 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;
  return query
    select i.codigo, i.vence_en
      from invitacion i
     where i.negocio_id = mi_negocio()
       and i.de_equipo
       and not i.anulada
       and i.vence_en > now();
end;
$$;


ALTER FUNCTION "public"."link_de_equipo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."marcar_paso_hecho"("p_paso_id" "uuid", "p_hecho" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  p   paso%rowtype;
  c   caso%rowtype;
  ya  timestamptz;
begin
  select * into p from paso where id = p_paso_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'Ese paso ya no está en el presupuesto.');
  end if;

  select * into c from caso where id = p.caso_id;
  if not found or c.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'Ese caso no es de tu negocio.');
  end if;

  -- El técnico marca lo suyo; el dueño y el encargado, cualquier caso del
  -- negocio. Es la misma frontera que ya usa la tabla "caso".
  if (mi_empleado() is null or c.responsable_id is distinct from mi_empleado()) and not (puede_aca('avanzar_casos') and puede_aca('ver_todos_los_casos')) then
    return jsonb_build_object('ok', false, 'motivo', 'Este caso lo tiene otra persona del equipo.');
  end if;

  if p.estado <> 'aprobado' then
    return jsonb_build_object('ok', false, 'motivo', 'Sólo se marca lo que el cliente aprobó.');
  end if;

  -- Un caso cerrado es el registro de lo que pasó, no un borrador. Para
  -- corregirlo se vuelve a abrir, que es una acción sola y queda escrita.
  if c.estado = 'completado' then
    return jsonb_build_object('ok', false, 'motivo', 'El caso ya se entregó. Volvé a abrirlo si hay algo que corregir.');
  end if;

  ya := p.hecho_en;

  if p_hecho then
    if ya is not null then
      return jsonb_build_object('ok', true, 'hecho_en', ya, 'cambio', false);
    end if;
    update paso set hecho_en = now() where id = p.id returning hecho_en into ya;
    return jsonb_build_object('ok', true, 'hecho_en', ya, 'cambio', true);
  end if;

  if ya is null then
    return jsonb_build_object('ok', true, 'hecho_en', null, 'cambio', false);
  end if;
  update paso set hecho_en = null where id = p.id;
  return jsonb_build_object('ok', true, 'hecho_en', null, 'cambio', true);
end;
$$;


ALTER FUNCTION "public"."marcar_paso_hecho"("p_paso_id" "uuid", "p_hecho" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mercadopago_crear_estado"("p_state" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not puede_aca('conectar_mercadopago') then raise exception 'Sin permiso.'; end if;
  delete from "MP_oauth_state" where negocio_id = mi_negocio() or created_at < now() - interval '10 minutes';
  insert into "MP_oauth_state" (state, negocio_id) values (p_state, mi_negocio());
end; $$;


ALTER FUNCTION "public"."mercadopago_crear_estado"("p_state" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mercadopago_desvincular"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not puede_aca('conectar_mercadopago') then raise exception 'Sin permiso.'; end if;
  delete from "negocio_conexionMP" where negocio_id = mi_negocio();
end; $$;


ALTER FUNCTION "public"."mercadopago_desvincular"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mercadopago_estado"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not (puede_aca('cobrar') or puede_aca('conectar_mercadopago')) then raise exception 'Sin permiso.'; end if;
  return exists (select 1 from "negocio_conexionMP" where negocio_id = mi_negocio());
end; $$;


ALTER FUNCTION "public"."mercadopago_estado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mi_empleado"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from empleado
   where usuario_id = auth.uid()
     and negocio_id = mi_negocio()
   limit 1;
$$;


ALTER FUNCTION "public"."mi_empleado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mi_negocio"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select negocio_id from usuario where id = auth.uid();
$$;


ALTER FUNCTION "public"."mi_negocio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mi_rol"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select rol from usuario where id = auth.uid();
$$;


ALTER FUNCTION "public"."mi_rol"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mis_casos_landing"("p_codigo" "text", "p_llave" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."mis_casos_landing"("p_codigo" "text", "p_llave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mis_negocios"() RETURNS TABLE("id" "uuid", "nombre" "text", "rubro" "text", "foto" "text", "rol_nombre" "text", "es_duenio" boolean, "permisos" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select n.id, n.nombre, n.rubro, n.foto, r.nombre, r.es_duenio,
         case when r.es_duenio then permisos_conocidos() else r.permisos end
    from empleado e
    join negocio n on n.id = e.negocio_id
    join rol r on r.id = e.rol_id
   where e.usuario_id = auth.uid()
   order by n.nombre;
$$;


ALTER FUNCTION "public"."mis_negocios"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mis_pedidos"() RETURNS TABLE("negocio_nombre" "text", "creada_en" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select n.nombre, s.creada_en
    from solicitud_de_ingreso s
    join negocio n on n.id = s.negocio_id
   where s.usuario_id = auth.uid()
   order by s.creada_en;
$$;


ALTER FUNCTION "public"."mis_pedidos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mis_permisos"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'rol_id', r.id,
    'rol_nombre', r.nombre,
    'es_duenio', coalesce(r.es_duenio, false),
    'permisos', to_jsonb(permisos_efectivos(mi_negocio()))
  )
    from (select 1) uno
    left join empleado e on e.negocio_id = mi_negocio() and e.usuario_id = auth.uid()
    left join rol r on r.id = e.rol_id;
$$;


ALTER FUNCTION "public"."mis_permisos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mis_sedes"() RETURNS TABLE("id" "uuid", "nombre" "text", "rubro" "text", "foto" "text", "rol_nombre" "text", "es_duenio" boolean, "permisos" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select n.id, n.nombre, n.rubro, n.foto, r.nombre, r.es_duenio,
         case when r.es_duenio then permisos_conocidos() else r.permisos end
    from negocio n
    join empleado e on e.negocio_id = n.id and e.usuario_id = auth.uid()
    join rol r on r.id = e.rol_id
   where n.red is not null
     and n.red = (select red from negocio where id = mi_negocio())
   order by n.nombre;
$$;


ALTER FUNCTION "public"."mis_sedes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mis_turnos_landing"("p_codigo" "text", "p_llave" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."mis_turnos_landing"("p_codigo" "text", "p_llave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nombre_de_clave"("p_rubro" "text", "p_clave" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case p_clave
    when 'duenio' then 'Dueño'
    when 'encargado' then 'Encargado'
    when 'tecnico' then case p_rubro
      when 'taller' then 'Mecánico'
      when 'medicina' then 'Profesional'
      when 'service' then 'Técnico'
      else 'Colaborador'
    end
  end;
$$;


ALTER FUNCTION "public"."nombre_de_clave"("p_rubro" "text", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_identificador"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;


ALTER FUNCTION "public"."normalizar_identificador"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."paso_aprobado_no_se_borra"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.estado = 'aprobado'
     and exists (select 1 from caso where id = old.caso_id) then
    raise exception 'Este paso ya lo aprobó el cliente y no se puede sacar del presupuesto.';
  end if;
  return old;
end;
$$;


ALTER FUNCTION "public"."paso_aprobado_no_se_borra"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."paso_aprobado_no_se_modifica"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.estado = 'aprobado' and (
       new.estado is distinct from old.estado
    or new.nombre is distinct from old.nombre
    or new.descripcion is distinct from old.descripcion
    or new.monto is distinct from old.monto
    or new.caso_id is distinct from old.caso_id
    or new.aprobado_en is distinct from old.aprobado_en
  ) then
    raise exception 'Este paso ya lo aprobó el cliente y no se puede cambiar.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."paso_aprobado_no_se_modifica"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."paso_cambio_permitido"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if not puede_aca('aprobar_por_el_cliente') then
      raise exception 'Este rol no permite aprobar ni rechazar pasos.' using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'estado' - 'aprobado_en' - 'actualizado_en') = (to_jsonb(old) - 'estado' - 'aprobado_en' - 'actualizado_en') then
      return new;
    end if;
  end if;

  if not puede_aca('armar_presupuesto') then
    raise exception 'Este rol no permite armar el presupuesto.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."paso_cambio_permitido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pedidos_de_ingreso"() RETURNS TABLE("id" "uuid", "nombre" "text", "email" "text", "creada_en" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not puede_en(mi_negocio(), 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;
  return query
    select s.id, s.nombre, s.email, s.creada_en
      from solicitud_de_ingreso s
     where s.negocio_id = mi_negocio()
     order by s.creada_en;
end;
$$;


ALTER FUNCTION "public"."pedidos_de_ingreso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pedir_entrar"("p_codigo" "text", "p_nombre" "text" DEFAULT NULL::"text") RETURNS TABLE("negocio_nombre" "text", "estado" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  quien uuid := auth.uid();
  inv invitacion%rowtype;
  mi_mail text;
  mi_nombre text;
  el_negocio text;
begin
  if quien is null then
    raise exception 'Hay que iniciar sesión para pedir entrar.';
  end if;

  select * into inv from invitacion i where i.codigo = p_codigo;
  if not found or not inv.de_equipo then
    raise exception 'Este link no existe. Fijate que esté completo.';
  end if;
  if inv.anulada then
    raise exception 'Quien te invitó dio de baja este link.';
  end if;
  if inv.vence_en < now() then
    raise exception 'Este link ya venció. Pedí uno nuevo.';
  end if;

  select n.nombre into el_negocio from negocio n where n.id = inv.negocio_id;

  if exists (select 1 from empleado e where e.usuario_id = quien and e.negocio_id = inv.negocio_id) then
    return query select el_negocio, 'ya_estas'::text;
    return;
  end if;

  select u.email into mi_mail from auth.users u where u.id = quien;
  insert into usuario (id, email) values (quien, mi_mail) on conflict (id) do nothing;

  -- Sin nombre escrito: el de la cuenta, y si tampoco hay, la parte del mail.
  select u.nombre into mi_nombre from usuario u where u.id = quien;

  insert into solicitud_de_ingreso (negocio_id, usuario_id, nombre, email)
  values (
    inv.negocio_id,
    quien,
    coalesce(
      nullif(trim(p_nombre), ''),
      nullif(trim(mi_nombre), ''),
      split_part(coalesce(mi_mail, 'Alguien'), '@', 1)
    ),
    mi_mail
  )
  on conflict (negocio_id, usuario_id) do nothing;

  return query select el_negocio, 'pendiente'::text;
end;
$$;


ALTER FUNCTION "public"."pedir_entrar"("p_codigo" "text", "p_nombre" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."permisos_conocidos"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select array[
    'ver_todos_los_casos', 'crear_casos', 'avanzar_casos', 'asignar_casos', 'entregar_y_reabrir',
    'armar_presupuesto', 'aprobar_por_el_cliente',
    'cobrar', 'conectar_mercadopago',
    'ver_clientes', 'editar_clientes',
    'ver_agenda', 'manejar_turnos',
    'ver_inventario', 'editar_inventario', 'ver_inventario_de_sedes',
    'ver_sedes_vinculadas', 'vincular_sedes',
    'sumar_al_equipo', 'sacar_del_equipo', 'manejar_roles',
    'configurar_negocio', 'ver_historial'
  ]::text[];
$$;


ALTER FUNCTION "public"."permisos_conocidos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."permisos_de_clave"("p_clave" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case p_clave
    when 'encargado' then array[
      'ver_todos_los_casos', 'crear_casos', 'avanzar_casos', 'asignar_casos', 'entregar_y_reabrir',
      'armar_presupuesto', 'aprobar_por_el_cliente',
      'cobrar', 'conectar_mercadopago',
      'ver_clientes', 'editar_clientes',
      'ver_agenda', 'manejar_turnos',
      'ver_inventario', 'editar_inventario', 'ver_inventario_de_sedes',
      'ver_historial'
    ]::text[]
    when 'tecnico' then array[
      'ver_clientes', 'ver_agenda', 'ver_inventario', 'ver_inventario_de_sedes', 'ver_historial'
    ]::text[]
    else '{}'::text[]
  end;
$$;


ALTER FUNCTION "public"."permisos_de_clave"("p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."permisos_de_mirar"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select array['ver_todos_los_casos', 'ver_clientes', 'ver_agenda', 'ver_inventario', 'ver_historial']::text[];
$$;


ALTER FUNCTION "public"."permisos_de_mirar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."permisos_del_rol"("p_rol" "uuid") RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case when es_duenio then permisos_conocidos() else permisos end from rol where id = p_rol;
$$;


ALTER FUNCTION "public"."permisos_del_rol"("p_rol" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."permisos_efectivos"("p_negocio" "uuid") RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    -- Miembro: los de su rol (057).
    (select case when r.es_duenio then permisos_conocidos() else r.permisos end
       from empleado e
       join rol r on r.id = e.rol_id
      where e.negocio_id = p_negocio
        and e.usuario_id = auth.uid()
      limit 1),
    -- De visita: de los de mirar, los que su rol tiene en la sede de origen.
    (select array(
              select x from unnest(case when r.es_duenio then permisos_conocidos() else r.permisos end) x
               where x = any(permisos_de_mirar())
            )
       from usuario u
       join negocio aca on aca.id = p_negocio
       join negocio origen on origen.id = u.visitando_desde
       join empleado e on e.negocio_id = origen.id and e.usuario_id = u.id
       join rol r on r.id = e.rol_id
      where u.id = auth.uid()
        and u.negocio_id = p_negocio
        and aca.red is not null
        and aca.red = origen.red
        and (r.es_duenio or 'ver_sedes_vinculadas' = any(r.permisos))),
    '{}'::text[]
  );
$$;


ALTER FUNCTION "public"."permisos_efectivos"("p_negocio" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."por_que_no_se_reserva"("n" "public"."negocio", "p_cuando" timestamp with time zone, "p_motivo" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."por_que_no_se_reserva"("n" "public"."negocio", "p_cuando" timestamp with time zone, "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preparar_cobro_publico"("p_codigo" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  c caso%rowtype;
  existente cobro%rowtype;
  aprobado numeric;
  comprometido numeric;
begin
  select * into c from caso where seguimiento_codigo = p_codigo for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'seguimiento_no_encontrado', 'motivo', 'Ese link ya no sirve.');
  end if;

  update cobro set estado = 'vencido'
   where caso_id = c.id and estado = 'pendiente' and vence_en <= now();

  select * into existente from cobro
   where caso_id = c.id and estado = 'pendiente' and medio = 'link'
     and (vence_en is null or vence_en > now()) and link is not null
   order by creado_en desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'existente', to_jsonb(existente));
  end if;

  select coalesce(sum(monto), 0) into aprobado from paso
   where caso_id = c.id and estado = 'aprobado';
  select coalesce(sum(monto), 0) into comprometido from cobro
   where caso_id = c.id and estado in ('pagado', 'pendiente');

  if aprobado - comprometido - coalesce(c.descuento, 0) <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'sin_saldo', 'motivo', 'No queda nada por pagar.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'caso_id', c.id,
    'negocio_id', c.negocio_id,
    'numero', c.numero,
    'monto', aprobado - comprometido - coalesce(c.descuento, 0)
  );
end;
$$;


ALTER FUNCTION "public"."preparar_cobro_publico"("p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."puede_aca"("p_permiso" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select puede_en(mi_negocio(), p_permiso);
$$;


ALTER FUNCTION "public"."puede_aca"("p_permiso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."puede_en"("p_negocio" "uuid", "p_permiso" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p_permiso = any(permisos_efectivos(p_negocio));
$$;


ALTER FUNCTION "public"."puede_en"("p_negocio" "uuid", "p_permiso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."puedo_cargar"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(mi_rol() in ('duenio', 'encargado'), false);
$$;


ALTER FUNCTION "public"."puedo_cargar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."quitar_acceso_al_sacar"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.usuario_id is null then
    -- Una ficha cargada a mano, sin cuenta: no hay acceso que quitar.
    return old;
  end if;

  -- Al borrar el negocio entero, la cascada borra sus fichas cuando la fila
  -- del negocio ya no está (como supone el comentario de abajo, desde la 038):
  -- la del creador y la propia incluidas, a propósito. Con el negocio vivo
  -- este chequeo no frena nada, así que no se puede usar para saltearse las
  -- reglas de abajo.
  if not exists (select 1 from negocio where id = old.negocio_id) then
    return old;
  end if;

  if old.usuario_id = auth.uid() then
    raise exception 'No te podés sacar a vos del equipo.';
  end if;

  -- Al fundador no lo saca otro dueño (sección 1b). Si se borra el negocio
  -- entero, sus fichas se borran después que él: el select da null y no frena.
  if old.usuario_id = (select creado_por from negocio where id = old.negocio_id) then
    raise exception 'A quien creó el negocio no se lo puede sacar del equipo.';
  end if;

  update usuario
     set negocio_id = case when negocio_id = old.negocio_id then null else negocio_id end,
         rol = case when negocio_id = old.negocio_id then 'duenio' else rol end,
         negocio_predeterminado = case
           when negocio_predeterminado = old.negocio_id then null
           else negocio_predeterminado
         end,
         inicio_rapido = case
           when negocio_predeterminado = old.negocio_id then false
           else inicio_rapido
         end
   where id = old.usuario_id
     and (negocio_id = old.negocio_id or negocio_predeterminado = old.negocio_id);

  return old;
end;
$$;


ALTER FUNCTION "public"."quitar_acceso_al_sacar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rango_del_rol"("p_rol" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case p_rol
           when 'duenio' then 3
           when 'encargado' then 2
           when 'tecnico' then 1
           else 0
         end;
$$;


ALTER FUNCTION "public"."rango_del_rol"("p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rechazar_solicitud"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  activo uuid := mi_negocio();
begin
  if not puede_en(activo, 'sumar_al_equipo') then
    raise exception 'Sumar gente al equipo lo hace el dueño del negocio.' using errcode = '42501';
  end if;
  delete from solicitud_de_ingreso x where x.id = p_id and x.negocio_id = activo;
  if not found then
    raise exception 'Ese pedido ya no está.';
  end if;
end;
$$;


ALTER FUNCTION "public"."rechazar_solicitud"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."red_fija"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.red is distinct from old.red and current_user in ('authenticated', 'anon') then
    raise exception 'Las sedes se vinculan desde Mi negocio.' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."red_fija"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_cobro"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  c caso%rowtype;
  nuevo cobro%rowtype;
begin
  select * into c from caso where id = p_caso_id;
  if not found or c.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'Ese caso no es de tu negocio.');
  end if;

  -- Mover plata es del dueño y del encargado (008_permisos.sql).
  if not puede_aca('cobrar') then
    return jsonb_build_object('ok', false, 'motivo', 'Los cobros los anotan el dueño o el encargado.');
  end if;

  if p_monto is null or p_monto <= 0 then
    return jsonb_build_object('ok', false, 'motivo', 'El monto tiene que ser mayor que cero.');
  end if;

  -- Sólo lo que se cobra en el local. Link y QR los crea la API de pagos.
  if p_medio not in ('efectivo', 'transferencia', 'tarjeta') then
    return jsonb_build_object('ok', false, 'motivo', 'Los cobros por link o QR se piden desde el sistema de pagos.');
  end if;

  insert into cobro (negocio_id, caso_id, monto, medio, estado, nota, creado_por, pagado_en)
  values (c.negocio_id, c.id, round(p_monto, 2), p_medio, 'pagado',
          nullif(trim(coalesce(p_nota, '')), ''), mi_empleado(), now())
  returning * into nuevo;

  return jsonb_build_object('ok', true, 'cobro', to_jsonb(nuevo));
end;
$$;


ALTER FUNCTION "public"."registrar_cobro"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_cobro_api"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_autor" "text", "p_detalle" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare r jsonb; e evento%rowtype;
begin
  r := registrar_cobro(p_caso_id, p_monto, p_medio, p_nota);
  if not coalesce((r->>'ok')::boolean, false) then return r; end if;
  insert into evento (caso_id, tipo, titulo, detalle, icono, monto, autor)
  values (p_caso_id, 'plata', 'Cobraron', p_detalle, 'listo', p_monto, p_autor)
  returning * into e;
  return r || jsonb_build_object('evento', to_jsonb(e));
end; $$;


ALTER FUNCTION "public"."registrar_cobro_api"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_autor" "text", "p_detalle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_cobro_en_linea_api"("p_id" "uuid", "p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_proveedor_id" "text", "p_link" "text", "p_qr_imagen" "text", "p_vence_en" timestamp with time zone, "p_codigo" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  c caso%rowtype;
  nuevo cobro%rowtype;
  existente cobro%rowtype;
  aprobado numeric;
  comprometido numeric;
  saldo numeric;
begin
  select * into c from caso where id = p_caso_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'caso_no_encontrado', 'motivo', 'Ese caso ya no está.');
  end if;

  if p_codigo is null then
    if c.negocio_id is distinct from mi_negocio() then
      return jsonb_build_object('ok', false, 'codigo', 'caso_no_encontrado', 'motivo', 'Ese caso ya no está.');
    end if;
    if not puede_aca('cobrar') then
      return jsonb_build_object('ok', false, 'codigo', 'sin_permiso', 'motivo', 'Los cobros los carga el dueño o el encargado.');
    end if;
  elsif c.seguimiento_codigo is distinct from p_codigo then
    return jsonb_build_object('ok', false, 'codigo', 'seguimiento_no_encontrado', 'motivo', 'Ese link ya no sirve.');
  end if;

  if p_medio not in ('link', 'qr') then
    return jsonb_build_object('ok', false, 'codigo', 'medio_invalido', 'motivo', 'Elegí link o QR.');
  end if;
  if p_monto is null or p_monto <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'monto_invalido', 'motivo', 'El monto tiene que ser mayor que cero.');
  end if;

  update cobro set estado = 'vencido'
   where caso_id = c.id and estado = 'pendiente' and vence_en <= now();

  select * into existente from cobro
   where caso_id = c.id and estado = 'pendiente' and medio = p_medio
     and monto = p_monto and (vence_en is null or vence_en > now()) and link is not null
   order by creado_en desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'creado', false, 'cobro', to_jsonb(existente));
  end if;

  select coalesce(sum(monto), 0) into aprobado from paso
   where caso_id = c.id and estado = 'aprobado';
  select coalesce(sum(monto), 0) into comprometido from cobro
   where caso_id = c.id and estado in ('pagado', 'pendiente');
  saldo := aprobado - comprometido - coalesce(c.descuento, 0);

  if (p_codigo is not null and p_monto is distinct from saldo)
     or (aprobado > 0 and p_monto > saldo) then
    return jsonb_build_object('ok', false, 'codigo', 'monto_supera_saldo', 'motivo', 'El monto supera lo que falta cobrar.');
  end if;

  insert into cobro (
    id, negocio_id, caso_id, monto, medio, estado, proveedor,
    proveedor_id, link, qr_imagen, vence_en, creado_por
  ) values (
    p_id, c.negocio_id, c.id, round(p_monto, 2), p_medio, 'pendiente', 'mercadopago',
    p_proveedor_id, p_link, p_qr_imagen, p_vence_en,
    case when auth.uid() is null then null else mi_empleado() end
  ) returning * into nuevo;

  return jsonb_build_object('ok', true, 'creado', true, 'cobro', to_jsonb(nuevo));
end;
$$;


ALTER FUNCTION "public"."registrar_cobro_en_linea_api"("p_id" "uuid", "p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_proveedor_id" "text", "p_link" "text", "p_qr_imagen" "text", "p_vence_en" timestamp with time zone, "p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reservar_turno"("p_codigo" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."reservar_turno"("p_codigo" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reservar_turno_landing"("p_codigo" "text", "p_llave" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text", "p_identificador" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

  -- Sin la Agenda prendida, como si no hubiera publicado sus horarios (ver
  -- ver_agenda_landing): por_que_no_se_reserva() contesta eso, con llave y
  -- sin llave.
  if not (n.modulos_activos ? 'agenda') then
    n.horarios := null;
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

  -- Más de 40 caracteres no es de nadie, como en el ingreso: se contesta
  -- antes de anotar nada.
  ident := normalizar_identificador(p_identificador);
  if ident = '' or length(ident) > 40 then
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
  -- Bloqueado, contesta el mismo código que el ingreso: es el mismo bloqueo.
  if landing_bloqueada(n.id, ident) then
    return jsonb_build_object('ok', false, 'motivo', 'muchos_intentos');
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


ALTER FUNCTION "public"."reservar_turno_landing"("p_codigo" "text", "p_llave" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text", "p_identificador" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."responder_paso_desde_el_link"("p_codigo" "text", "p_paso_id" "uuid", "p_respuesta" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  c        caso%rowtype;
  p        paso%rowtype;
  quedan   integer;
  trabado  boolean;
  destrabo boolean := false;
begin
  if p_respuesta not in ('aprobado', 'rechazado') then
    return jsonb_build_object('ok', false, 'motivo', 'No entendimos la respuesta. Probá de nuevo.');
  end if;

  if p_codigo is null or length(p_codigo) < 8 then
    return jsonb_build_object('ok', false, 'existe', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
  end if;

  select * into c from caso where seguimiento_codigo = p_codigo;
  if not found then
    return jsonb_build_object('ok', false, 'existe', false, 'motivo', 'Este link ya no sirve. Pedile uno nuevo al negocio.');
  end if;

  if c.estado = 'completado' then
    return jsonb_build_object('ok', false, 'motivo', 'Este trabajo ya se entregó. Si querés agregar algo, hablá con el negocio.');
  end if;

  select * into p from paso where id = p_paso_id and caso_id = c.id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'Ese paso ya no está en el presupuesto.');
  end if;

  if p.estado = 'aprobado' then
    return jsonb_build_object('ok', false, 'motivo', 'Ese paso ya estaba aprobado.');
  end if;
  if p.estado = 'rechazado' then
    return jsonb_build_object('ok', false, 'motivo', 'Ese paso ya lo habías contestado.');
  end if;

  update paso
  set estado = p_respuesta,
      aprobado_en = case when p_respuesta = 'aprobado' then now() else aprobado_en end
  where id = p.id;

  insert into evento (caso_id, tipo, titulo, detalle, autor, icono, monto)
  values (
    c.id,
    'plata',
    case when p_respuesta = 'aprobado'
      then 'Lo aprobó el cliente desde el link'
      else 'El cliente no lo hace, contestó desde el link' end,
    p.nombre || ' · $' || translate(to_char(p.monto, 'FM999G999G999'), ',', '.'),
    'El cliente',
    case when p_respuesta = 'aprobado' then 'listo' else 'nota' end,
    p.monto
  );

  -- ------------------------------------------------------------
  -- ¿Queda algo por contestar? ¿Y algo más que lo trabe?
  -- ------------------------------------------------------------
  select count(*) into quedan
  from paso
  where caso_id = c.id and estado = 'esperando';

  select exists (
    select 1 from insumo where caso_id = c.id and estado <> 'en_stock'
  ) into trabado;

  if c.estado = 'esperando' and quedan = 0 and not trabado then
    update caso
    set estado = 'en_proceso',
        que_falta = 'Hacer el trabajo'
    where id = c.id;

    insert into evento (caso_id, tipo, estado, titulo, detalle, autor, icono)
    values (
      c.id,
      'estado',
      'en_proceso',
      'El cliente terminó de contestar',
      'Ya no queda nada esperando su respuesta.',
      'El cliente',
      'llave'
    );

    destrabo := true;

  elsif c.estado = 'revision_final' and p_respuesta = 'aprobado' then
    update caso
    set estado = 'en_proceso',
        que_falta = 'Hacer el trabajo'
    where id = c.id;

    insert into evento (caso_id, tipo, estado, titulo, detalle, autor, icono)
    values (
      c.id,
      'estado',
      'en_proceso',
      'El cliente aprobó algo más',
      'El caso vuelve al trabajo: el control ya no alcanza.',
      'El cliente',
      'llave'
    );

    destrabo := true;
  end if;

  return jsonb_build_object('ok', true, 'destrabo', destrabo, 'quedan', quedan);
end;
$_$;


ALTER FUNCTION "public"."responder_paso_desde_el_link"("p_codigo" "text", "p_paso_id" "uuid", "p_respuesta" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revertir_baja_de_avisos"("p_cliente_id" "uuid", "p_autor" "text" DEFAULT 'Alguien del negocio'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actual cliente%rowtype;
  vuelto cliente%rowtype;
  nuevo  cliente_evento%rowtype;
begin
  select * into actual from cliente where id = p_cliente_id for update;
  if not found or actual.negocio_id is distinct from mi_negocio() then
    return jsonb_build_object('ok', false, 'motivo', 'cliente_no_encontrado');
  end if;
  if not puede_aca('editar_clientes') then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if actual.avisos_baja_en is null then
    return jsonb_build_object('ok', true, 'cliente', to_jsonb(actual), 'evento', null);
  end if;

  update cliente set avisos_baja_en = null where id = actual.id returning * into vuelto;
  insert into cliente_evento (negocio_id, cliente_id, tipo, titulo, detalle, autor, usuario_id)
  values (
    actual.negocio_id, actual.id, 'avisos', 'Vuelve a recibir avisos',
    'Había pedido no recibir avisos el '
      || to_char(actual.avisos_baja_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY "a las" HH24:MI') || '.',
    coalesce(nullif(trim(p_autor), ''), 'Alguien del negocio'), auth.uid()
  )
  returning * into nuevo;

  return jsonb_build_object('ok', true, 'cliente', to_jsonb(vuelto), 'evento', to_jsonb(nuevo));
end;
$$;


ALTER FUNCTION "public"."revertir_baja_de_avisos"("p_cliente_id" "uuid", "p_autor" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rol_de_clave"("p_negocio" "uuid", "p_clave" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  encontrado uuid;
  su_rubro text;
begin
  select id into encontrado from rol where negocio_id = p_negocio and clave = p_clave;
  if found then
    return encontrado;
  end if;

  select rubro into su_rubro from negocio where id = p_negocio;
  insert into rol (negocio_id, nombre, es_duenio, permisos, clave)
  values (p_negocio, nombre_de_clave(su_rubro, p_clave), p_clave = 'duenio', permisos_de_clave(p_clave), p_clave)
  returning id into encontrado;
  return encontrado;
end;
$$;


ALTER FUNCTION "public"."rol_de_clave"("p_negocio" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rol_de_la_ficha_da_permisos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.rol is not distinct from old.rol then
    return new;
  end if;

  if old.usuario_id is not null and old.usuario_id = auth.uid() then
    raise exception 'No podés cambiar tu propio rol.';
  end if;

  if old.usuario_id = (select creado_por from negocio where id = old.negocio_id) then
    raise exception 'A quien creó el negocio no se le puede cambiar el rol.';
  end if;

  -- Sólo si la cuenta está en este negocio. El día que pueda estar en varios,
  -- cambiarle el rol en uno no le toca los permisos que tiene en otro.
  if new.usuario_id is not null then
    update usuario
       set rol = new.rol
     where id = new.usuario_id
       and negocio_id = new.negocio_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."rol_de_la_ficha_da_permisos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rol_duenio_fijo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if old.es_duenio and exists (select 1 from negocio where id = old.negocio_id) then
    raise exception 'El rol Dueño no se modifica.';
  end if;
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."rol_duenio_fijo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rol_id_de_la_clave"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.rol_id is null and new.rol is not null then
      new.rol_id := rol_de_clave(new.negocio_id, new.rol);
    end if;
  elsif new.rol is distinct from old.rol and new.rol_id is not distinct from old.rol_id and new.rol is not null then
    new.rol_id := rol_de_clave(new.negocio_id, new.rol);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."rol_id_de_la_clave"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."roles_base"("p_rubro" "text") RETURNS TABLE("clave" "text", "nombre" "text", "permisos" "text"[])
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select k, nombre_de_clave(p_rubro, k), permisos_de_clave(k)
    from unnest(array['encargado', 'tecnico']) as k
   where p_rubro in ('taller', 'medicina', 'service');
$$;


ALTER FUNCTION "public"."roles_base"("p_rubro" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."roles_del_negocio"() RETURNS TABLE("id" "uuid", "nombre" "text", "es_duenio" boolean, "permisos" "text"[], "personas" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select r.id, r.nombre, r.es_duenio,
         case when r.es_duenio then permisos_conocidos() else r.permisos end,
         (select count(*)::integer from empleado e where e.rol_id = r.id)
    from rol r
   where r.negocio_id = mi_negocio()
     and mi_empleado() is not null
   order by r.es_duenio desc, lower(r.nombre);
$$;


ALTER FUNCTION "public"."roles_del_negocio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rubro_fijo_con_casos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.rubro is distinct from old.rubro
     and exists (select 1 from caso where negocio_id = old.id) then
    raise exception 'El rubro no se puede cambiar: el negocio ya tiene casos cargados con las palabras de su rubro.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."rubro_fijo_con_casos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sedes_que_veo"() RETURNS TABLE("id" "uuid", "nombre" "text", "rubro" "text", "foto" "text", "soy_miembro" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with yo as (
    select coalesce(u.visitando_desde, u.negocio_id) as origen from usuario u where u.id = auth.uid()
  ),
  red as (
    select n.red,
           exists (
             select 1 from empleado e join rol r on r.id = e.rol_id
              where e.negocio_id = n.id and e.usuario_id = auth.uid()
                and (r.es_duenio or 'ver_sedes_vinculadas' = any(r.permisos))
           ) as puede_ver
      from negocio n join yo on n.id = yo.origen
     where n.red is not null
  )
  select n.id, n.nombre, n.rubro, n.foto,
         exists (select 1 from empleado e where e.negocio_id = n.id and e.usuario_id = auth.uid())
    from negocio n
    join red on n.red = red.red
   where red.puede_ver
      or exists (select 1 from empleado e where e.negocio_id = n.id and e.usuario_id = auth.uid())
   order by n.nombre;
$$;


ALTER FUNCTION "public"."sedes_que_veo"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_sesion" (
    "huella" "text" NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "identificador" "text" NOT NULL,
    "ultimos4" "text" NOT NULL,
    "vence_en" timestamp with time zone NOT NULL,
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."landing_sesion" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sesion_de_la_llave"("p_negocio" "uuid", "p_llave" "text") RETURNS "public"."landing_sesion"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select * from landing_sesion
   where huella = encode(sha256(convert_to(p_llave, 'UTF8')), 'hex')
     and negocio_id = p_negocio
     and vence_en > now();
$$;


ALTER FUNCTION "public"."sesion_de_la_llave"("p_negocio" "uuid", "p_llave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soy_duenio_aca"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((
    select r.es_duenio from empleado e join rol r on r.id = e.rol_id
     where e.negocio_id = mi_negocio() and e.usuario_id = auth.uid()
  ), false);
$$;


ALTER FUNCTION "public"."soy_duenio_aca"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tengo_contrasena"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(u.encrypted_password, '') <> ''
    from auth.users u
   where u.id = auth.uid();
$$;


ALTER FUNCTION "public"."tengo_contrasena"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tocar_actualizado_en"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."tocar_actualizado_en"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."turno_respuesta_solo_del_cliente"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is not null and (
    (tg_op = 'INSERT' and (new.respuesta_cliente is not null or new.respuesta_cliente_en is not null)) or
    (tg_op = 'UPDATE' and (new.respuesta_cliente is distinct from old.respuesta_cliente
                           or new.respuesta_cliente_en is distinct from old.respuesta_cliente_en))
  ) then
    raise exception 'Lo que contestó el cliente lo anota el WhatsApp, no se edita a mano.';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."turno_respuesta_solo_del_cliente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ultimos_cuatro"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 4);
$$;


ALTER FUNCTION "public"."ultimos_cuatro"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ver_agenda_ics"("p_codigo" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n negocio%rowtype;
begin
  if p_codigo is null or length(p_codigo) < 8 then
    return jsonb_build_object('sirve', false);
  end if;

  select * into n from negocio where ics_codigo = p_codigo;
  if not found then
    return jsonb_build_object('sirve', false);
  end if;

  return jsonb_build_object(
    'sirve', true,
    'negocio_nombre', n.nombre,
    -- De acá sale cuánto dura un turno que no trae minutos propios.
    'horarios', n.horarios,
    'turnos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id,
               'empieza_en', t.empieza_en,
               'minutos_reservados', t.minutos_reservados,
               'motivo', t.motivo,
               'estado', t.estado,
               'origen', t.origen,
               'cliente_nombre', c.nombre,
               'cliente_telefono', c.telefono)
             order by t.empieza_en)
      from turno t
      left join cliente c on c.id = t.cliente_id
      where t.negocio_id = n.id
        and t.empieza_en >= now() - interval '30 days'
    ), '[]'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."ver_agenda_ics"("p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ver_agenda_landing"("p_codigo" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n negocio%rowtype;
begin
  select * into n from landing_del_codigo(p_codigo);
  if n.id is null then
    return jsonb_build_object('sirve', false);
  end if;

  if not (n.modulos_activos ? 'agenda') then
    n.horarios := null;
  end if;

  return agenda_del_negocio(n);
end;
$$;


ALTER FUNCTION "public"."ver_agenda_landing"("p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ver_agenda_publica"("p_codigo" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."ver_agenda_publica"("p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ver_invitacion"("p_codigo" "text") RETURNS TABLE("negocio_nombre" "text", "sirve" boolean, "motivo" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  inv invitacion%rowtype;
  el_negocio text;
begin
  select * into inv from invitacion i where i.codigo = p_codigo;
  if not found or not inv.de_equipo then
    return query select null::text, false, 'Este link no existe. Fijate que esté completo.'::text;
    return;
  end if;
  select n.nombre into el_negocio from negocio n where n.id = inv.negocio_id;
  if inv.anulada then
    return query select el_negocio, false, 'Quien te invitó dio de baja este link.'::text;
    return;
  end if;
  if inv.vence_en < now() then
    return query select el_negocio, false, 'Este link ya venció. Pedí uno nuevo.'::text;
    return;
  end if;
  return query select el_negocio, true, null::text;
end;
$$;


ALTER FUNCTION "public"."ver_invitacion"("p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ver_landing"("p_codigo" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."ver_landing"("p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ver_seguimiento"("p_codigo" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."ver_seguimiento"("p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vincular_sede"("p_otro" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  activo uuid := mi_negocio();
  red_activo uuid;
  red_otro uuid;
  la_red uuid;
begin
  if p_otro = activo then
    raise exception 'Ya es esta sede.';
  end if;
  if not (puede_en(activo, 'vincular_sedes') and puede_en(p_otro, 'vincular_sedes')) then
    raise exception 'Para vincular sedes tenés que poder hacerlo en las dos.' using errcode = '42501';
  end if;

  select red into red_activo from negocio where id = activo;
  select red into red_otro from negocio where id = p_otro;
  if red_activo is not null and red_otro is not null and red_activo <> red_otro then
    raise exception 'Ese negocio ya está vinculado con otras sedes: desvinculalo primero.';
  end if;

  la_red := coalesce(red_activo, red_otro, gen_random_uuid());
  update negocio set red = la_red where id in (activo, p_otro);
  return la_red;
end;
$$;


ALTER FUNCTION "public"."vincular_sede"("p_otro" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MP_oauth_state" (
    "state" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "negocio_id" "uuid" NOT NULL
);


ALTER TABLE "public"."MP_oauth_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."caso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "numero" integer NOT NULL,
    "cliente_id" "uuid",
    "servicio" "text" NOT NULL,
    "estado" "text" DEFAULT 'nuevo'::"text" NOT NULL,
    "responsable_id" "uuid",
    "que_falta" "text",
    "abierto_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "identificador" "text",
    "diagnostico" "text",
    "seguimiento_codigo" "text",
    "seguimiento_visto_en" timestamp with time zone,
    "cobrado" numeric(12,2),
    "cobrado_en" timestamp with time zone,
    "descuento" numeric(12,2),
    "nombre" "text",
    "volver_en" "date",
    CONSTRAINT "caso_cobrado_no_negativo" CHECK ((("cobrado" IS NULL) OR ("cobrado" >= (0)::numeric))),
    CONSTRAINT "caso_descuento_no_negativo" CHECK ((("descuento" IS NULL) OR ("descuento" >= (0)::numeric))),
    CONSTRAINT "caso_estado_check" CHECK (("estado" = ANY (ARRAY['nuevo'::"text", 'en_proceso'::"text", 'esperando'::"text", 'revision_final'::"text", 'completado'::"text"])))
);


ALTER TABLE "public"."caso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias_del_negocio" (
    "negocio_id" "uuid" NOT NULL,
    "lista" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "categorias_del_negocio_lista_check" CHECK (("jsonb_typeof"("lista") = 'array'::"text"))
);


ALTER TABLE "public"."categorias_del_negocio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cliente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "telefono" "text",
    "email" "text",
    "notas" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmado" boolean DEFAULT true NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avisos_baja_en" timestamp with time zone,
    "telefono_incompleto" boolean GENERATED ALWAYS AS (((COALESCE("btrim"("telefono"), ''::"text") <> ''::"text") AND (("telefono" !~ '^[[:space:]0-9()+.-]*$'::"text") OR ("regexp_replace"("telefono", '[^0-9]'::"text", ''::"text", 'g'::"text") !~ '^(?:549?(?:1[0-46-9]|[23][0-9])[0-9]{8}|5989[0-9]{7}|569[0-9]{8}|55[1-9]{2}9[0-9]{8}|5959[0-9]{8}|591[67][0-9]{7}|34[67][0-9]{8}|1[2-9][0-9]{2}[2-9][0-9]{6})$'::"text")))) STORED
);


ALTER TABLE "public"."cliente" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cliente"."avisos_baja_en" IS 'Cuándo pidió no recibir avisos automáticos (contestó BAJA por WhatsApp). null = nunca lo pidió. La pone el webhook de WhatsApp y la saca sólo revertir_baja_de_avisos().';



COMMENT ON COLUMN "public"."cliente"."telefono_incompleto" IS 'El teléfono no sirve para WhatsApp: le falta el código de país, o tiene el 0 o el 15. Calculada con el mismo patrón que la API (compartido/telefono.ts). Sin teléfono es false.';



CREATE TABLE IF NOT EXISTS "public"."cliente_evento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "detalle" "text",
    "autor" "text" DEFAULT 'Alguien del negocio'::"text" NOT NULL,
    "usuario_id" "uuid",
    "ocurrido_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cliente_evento" OWNER TO "postgres";


COMMENT ON TABLE "public"."cliente_evento" IS 'El historial del cliente (el de evento es del caso). Lo escribe revertir_baja_de_avisos().';



CREATE TABLE IF NOT EXISTS "public"."cobro" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "caso_id" "uuid" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "medio" "text" NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "nota" "text",
    "proveedor" "text",
    "proveedor_id" "text",
    "link" "text",
    "vence_en" timestamp with time zone,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creado_por" "uuid",
    "pagado_en" timestamp with time zone,
    "anulado_en" timestamp with time zone,
    "anulado_por" "uuid",
    "motivo_anulacion" "text",
    "qr_imagen" "text",
    "proveedor_pago_id" "text",
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cobro_anulado_con_fecha" CHECK ((("estado" <> 'anulado'::"text") OR ("anulado_en" IS NOT NULL))),
    CONSTRAINT "cobro_estado_valido" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'pagado'::"text", 'rechazado'::"text", 'vencido'::"text", 'anulado'::"text", 'devuelto'::"text"]))),
    CONSTRAINT "cobro_medio_valido" CHECK (("medio" = ANY (ARRAY['efectivo'::"text", 'transferencia'::"text", 'tarjeta'::"text", 'link'::"text", 'qr'::"text", 'sin_dato'::"text"]))),
    CONSTRAINT "cobro_monto_positivo" CHECK (("monto" > (0)::numeric)),
    CONSTRAINT "cobro_pagado_con_fecha" CHECK ((("estado" <> 'pagado'::"text") OR ("pagado_en" IS NOT NULL)))
);


ALTER TABLE "public"."cobro" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecuacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "formula" "text" NOT NULL,
    "descripcion" "text",
    "categoria" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "unidad_resultado" "text",
    CONSTRAINT "ecuacion_formula_check" CHECK (("btrim"("formula") <> ''::"text")),
    CONSTRAINT "ecuacion_nombre_check" CHECK (("btrim"("nombre") <> ''::"text"))
);


ALTER TABLE "public"."ecuacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecuacion_dependencia" (
    "ecuacion_id" "uuid" NOT NULL,
    "dependencia_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    CONSTRAINT "ecuacion_dependencia_alias_check" CHECK (("btrim"("alias") <> ''::"text")),
    CONSTRAINT "ecuacion_dependencia_check" CHECK (("ecuacion_id" <> "dependencia_id"))
);


ALTER TABLE "public"."ecuacion_dependencia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empleado" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "rol" "text" DEFAULT 'tecnico'::"text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "usuario_id" "uuid",
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rol_id" "uuid" NOT NULL,
    CONSTRAINT "empleado_rol_check" CHECK (("rol" = ANY (ARRAY['duenio'::"text", 'encargado'::"text", 'tecnico'::"text"])))
);


ALTER TABLE "public"."empleado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caso_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "detalle" "text",
    "autor" "text" DEFAULT 'Mostrador'::"text" NOT NULL,
    "icono" "text" DEFAULT 'carpeta'::"text" NOT NULL,
    "ocurrido_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo" "text",
    "monto" numeric(12,2),
    "estado" "text",
    CONSTRAINT "evento_estado_check" CHECK ((("estado" IS NULL) OR ("estado" = ANY (ARRAY['nuevo'::"text", 'en_proceso'::"text", 'esperando'::"text", 'revision_final'::"text", 'completado'::"text"])))),
    CONSTRAINT "evento_monto_check" CHECK ((("monto" IS NULL) OR ("monto" >= (0)::numeric))),
    CONSTRAINT "evento_tipo_check" CHECK ((("tipo" IS NULL) OR ("tipo" = ANY (ARRAY['entro'::"text", 'estado'::"text", 'entrega'::"text", 'plata'::"text", 'nota'::"text"]))))
);


ALTER TABLE "public"."evento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_calendar_conexion" (
    "usuario_id" "uuid" NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "conectado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "error" "text"
);


ALTER TABLE "public"."google_calendar_conexion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_calendar_evento" (
    "usuario_id" "uuid" NOT NULL,
    "turno_id" "uuid" NOT NULL,
    "huella" "text" NOT NULL
);


ALTER TABLE "public"."google_calendar_evento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insumo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "cantidad" integer DEFAULT 0 NOT NULL,
    "minimo" integer DEFAULT 0 NOT NULL,
    "unidad" "text" DEFAULT 'unidad'::"text" NOT NULL,
    "estado" "text" DEFAULT 'en_stock'::"text" NOT NULL,
    "caso_id" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "marca" "text",
    "modelo" "text",
    "por_caja" integer,
    "categoria" "text",
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "insumo_cantidad_check" CHECK (("cantidad" >= 0)),
    CONSTRAINT "insumo_estado_check" CHECK (("estado" = ANY (ARRAY['en_stock'::"text", 'pedido'::"text", 'llegado'::"text"]))),
    CONSTRAINT "insumo_minimo_check" CHECK (("minimo" >= 0)),
    CONSTRAINT "insumo_por_caja_positivo" CHECK ((("por_caja" IS NULL) OR ("por_caja" > 0)))
);


ALTER TABLE "public"."insumo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "codigo" "text" DEFAULT "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") NOT NULL,
    "rol" "text" DEFAULT 'tecnico'::"text" NOT NULL,
    "usos_maximos" integer DEFAULT 1 NOT NULL,
    "usos" integer DEFAULT 0 NOT NULL,
    "vence_en" timestamp with time zone NOT NULL,
    "anulada" boolean DEFAULT false NOT NULL,
    "creada_por" "uuid",
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "de_equipo" boolean DEFAULT false NOT NULL,
    CONSTRAINT "invitacion_rol_check" CHECK (("rol" = ANY (ARRAY['duenio'::"text", 'encargado'::"text", 'tecnico'::"text"]))),
    CONSTRAINT "invitacion_usos_check" CHECK (("usos" >= 0)),
    CONSTRAINT "invitacion_usos_maximos_check" CHECK (("usos_maximos" > 0))
);


ALTER TABLE "public"."invitacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_intento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "identificador" "text" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."landing_intento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."negocio_conexionMP" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "refresh_token" character varying NOT NULL,
    "access_token" character varying NOT NULL,
    "vencimiento" timestamp without time zone NOT NULL,
    "mercadopago_user_id" character varying NOT NULL
);


ALTER TABLE "public"."negocio_conexionMP" OWNER TO "postgres";


ALTER TABLE "public"."negocio_conexionMP" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."negocio_conexionMP_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."negocio_seguimiento" (
    "negocio_id" "uuid" NOT NULL,
    "activo" boolean DEFAULT false NOT NULL,
    "dias" integer,
    "mensaje" "text" NOT NULL,
    "tipo" "text" DEFAULT 'cierre'::"text" NOT NULL,
    "horas" integer,
    CONSTRAINT "negocio_seguimiento_dias_check" CHECK ((("dias" >= 0) AND ("dias" <= 3650))),
    CONSTRAINT "negocio_seguimiento_mensaje_check" CHECK ((("length"("btrim"("mensaje")) >= 1) AND ("length"("btrim"("mensaje")) <= 3000))),
    CONSTRAINT "negocio_seguimiento_plazo" CHECK (((("tipo" = 'cierre'::"text") AND ("dias" IS NOT NULL) AND (("dias" >= 0) AND ("dias" <= 3650)) AND ("horas" IS NULL)) OR (("tipo" = 'turno'::"text") AND ("horas" IS NOT NULL) AND (("horas" >= 1) AND ("horas" <= 168)) AND ("dias" IS NULL)) OR (("tipo" = 'volver'::"text") AND ("dias" IS NOT NULL) AND (("dias" >= 0) AND ("dias" <= 90)) AND ("horas" IS NULL)) OR (("tipo" = 'presupuesto'::"text") AND ("dias" IS NOT NULL) AND (("dias" >= 1) AND ("dias" <= 90)) AND ("horas" IS NULL))))
);


ALTER TABLE "public"."negocio_seguimiento" OWNER TO "postgres";


COMMENT ON COLUMN "public"."negocio_seguimiento"."tipo" IS 'cierre: el aviso posventa, en días después del cierre. turno: el recordatorio de turno, en horas. volver: el aviso de cuándo le toca volver, en días antes de la fecha anotada.';



CREATE TABLE IF NOT EXISTS "public"."paso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caso_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "monto" numeric(12,2) DEFAULT 0 NOT NULL,
    "estado" "text" DEFAULT 'esperando'::"text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aprobado_en" timestamp with time zone,
    "hecho_en" timestamp with time zone,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "paso_estado_check" CHECK (("estado" = ANY (ARRAY['esperando'::"text", 'aprobado'::"text", 'rechazado'::"text"]))),
    CONSTRAINT "paso_hecho_solo_si_aprobado" CHECK ((("hecho_en" IS NULL) OR ("estado" = 'aprobado'::"text"))),
    CONSTRAINT "paso_monto_check" CHECK (("monto" >= (0)::numeric))
);


ALTER TABLE "public"."paso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedido_idempotente" (
    "usuario_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "ruta" "text" NOT NULL,
    "clave" "text" NOT NULL,
    "huella" "text" NOT NULL,
    "estado_http" integer,
    "respuesta" "jsonb",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pedido_idempotente_clave_check" CHECK ((("char_length"("clave") >= 1) AND ("char_length"("clave") <= 200))),
    CONSTRAINT "pedido_idempotente_estado_http_check" CHECK ((("estado_http" >= 100) AND ("estado_http" <= 599))),
    CONSTRAINT "pedido_idempotente_ruta_check" CHECK ((("char_length"("ruta") >= 1) AND ("char_length"("ruta") <= 300)))
);


ALTER TABLE "public"."pedido_idempotente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suscripcion" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nombre" character varying NOT NULL,
    "descripcion" "text" NOT NULL
);


ALTER TABLE "public"."suscripcion" OWNER TO "postgres";


ALTER TABLE "public"."suscripcion" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."plan_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."prueba_gratis" (
    "usuario_id" "uuid" NOT NULL,
    "negocio_id" "uuid",
    "desde" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hasta" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."prueba_gratis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rol" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "es_duenio" boolean DEFAULT false NOT NULL,
    "permisos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "clave" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rol_clave_check" CHECK (("clave" = ANY (ARRAY['duenio'::"text", 'encargado'::"text", 'tecnico'::"text"]))),
    CONSTRAINT "rol_nombre_check" CHECK ((("length"(TRIM(BOTH FROM "nombre")) >= 1) AND ("length"(TRIM(BOTH FROM "nombre")) <= 40))),
    CONSTRAINT "rol_permisos_conocidos" CHECK (("permisos" <@ "public"."permisos_conocidos"()))
);


ALTER TABLE "public"."rol" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seguimiento_whatsapp" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caso_id" "uuid",
    "negocio_id" "uuid" NOT NULL,
    "cerrado_en" timestamp with time zone,
    "enviar_en" timestamp with time zone NOT NULL,
    "telefono" "text" NOT NULL,
    "mensaje" "text" NOT NULL,
    "numero_emisor_id" "text" NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "mensaje_id" "text",
    "error" "text",
    "procesado_en" timestamp with time zone,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo" "text" DEFAULT 'cierre'::"text" NOT NULL,
    "turno_id" "uuid",
    "turno_empieza_en" timestamp with time zone,
    "motivo" "text",
    CONSTRAINT "seguimiento_whatsapp_caso_o_turno" CHECK (("num_nonnulls"("caso_id", "turno_id") = 1)),
    CONSTRAINT "seguimiento_whatsapp_cerrado_con_caso" CHECK ((("caso_id" IS NULL) OR ("cerrado_en" IS NOT NULL))),
    CONSTRAINT "seguimiento_whatsapp_check" CHECK (("enviar_en" >= "cerrado_en")),
    CONSTRAINT "seguimiento_whatsapp_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'enviando'::"text", 'enviado'::"text", 'fallido'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "seguimiento_whatsapp_hora_con_turno" CHECK ((("turno_empieza_en" IS NULL) OR ("turno_id" IS NOT NULL))),
    CONSTRAINT "seguimiento_whatsapp_mensaje_check" CHECK ((("length"("mensaje") >= 1) AND ("length"("mensaje") <= 4096))),
    CONSTRAINT "seguimiento_whatsapp_motivo_si_cancelado" CHECK ((("motivo" IS NULL) OR ("estado" = 'cancelado'::"text"))),
    CONSTRAINT "seguimiento_whatsapp_numero_emisor_id_check" CHECK (("length"(TRIM(BOTH FROM "numero_emisor_id")) > 0)),
    CONSTRAINT "seguimiento_whatsapp_telefono_check" CHECK (("telefono" ~ '^[1-9][0-9]{7,14}$'::"text")),
    CONSTRAINT "seguimiento_whatsapp_tipo_check" CHECK (("tipo" = ANY (ARRAY['cierre'::"text", 'estado'::"text", 'turno'::"text", 'volver'::"text", 'presupuesto'::"text"])))
);


ALTER TABLE "public"."seguimiento_whatsapp" OWNER TO "postgres";


COMMENT ON COLUMN "public"."seguimiento_whatsapp"."turno_id" IS 'El turno del recordatorio (tipo turno). Los avisos de cierre y de estado cuelgan de caso_id.';



COMMENT ON COLUMN "public"."seguimiento_whatsapp"."turno_empieza_en" IS 'R-4a-2: la hora del turno de la que habla el aviso. Si salió y el turno se movió después, la agenda dice que se avisó con la hora anterior.';



COMMENT ON COLUMN "public"."seguimiento_whatsapp"."motivo" IS 'Por qué se canceló sin mandarse (R-2a): sin_fecha, ya_paso, baja_de_avisos, desactivado, ya_esta_aca, ya_volvio, tope_del_mes... El front lo traduce por código. null en lo demás.';



CREATE TABLE IF NOT EXISTS "public"."seguimiento_whatsapp_respuesta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seguimiento_id" "uuid",
    "caso_id" "uuid",
    "negocio_id" "uuid",
    "numero_emisor_id" "text" NOT NULL,
    "mensaje_id" "text" NOT NULL,
    "contexto_mensaje_id" "text",
    "telefono" "text",
    "contacto_id" "text",
    "tipo" "text" NOT NULL,
    "texto" "text",
    "contenido" "jsonb" NOT NULL,
    "enviado_en" timestamp with time zone NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cliente_id" "uuid",
    CONSTRAINT "seguimiento_whatsapp_respuesta_asociacion_check" CHECK (("num_nonnulls"("seguimiento_id", "caso_id", "negocio_id") = ANY (ARRAY[0, 3]))),
    CONSTRAINT "seguimiento_whatsapp_respuesta_contenido_check" CHECK (("jsonb_typeof"("contenido") = 'object'::"text")),
    CONSTRAINT "seguimiento_whatsapp_respuesta_mensaje_id_check" CHECK ((("length"("mensaje_id") >= 1) AND ("length"("mensaje_id") <= 512))),
    CONSTRAINT "seguimiento_whatsapp_respuesta_numero_emisor_id_check" CHECK ((("length"("numero_emisor_id") >= 1) AND ("length"("numero_emisor_id") <= 512))),
    CONSTRAINT "seguimiento_whatsapp_respuesta_telefono_check" CHECK ((("telefono" IS NULL) OR ("telefono" ~ '^[1-9][0-9]{7,14}$'::"text"))),
    CONSTRAINT "seguimiento_whatsapp_respuesta_tipo_check" CHECK ((("length"("tipo") >= 1) AND ("length"("tipo") <= 100)))
);


ALTER TABLE "public"."seguimiento_whatsapp_respuesta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitud_de_ingreso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "email" "text",
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."solicitud_de_ingreso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suscripcion_precio" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "suscripcion_id" bigint NOT NULL,
    "precio" bigint NOT NULL,
    "moneda" character varying NOT NULL,
    "periodo" "text" DEFAULT 'mensual'::"text" NOT NULL,
    CONSTRAINT "suscripcion_precio_periodo_valido" CHECK (("periodo" = ANY (ARRAY['mensual'::"text", 'anual'::"text"])))
);


ALTER TABLE "public"."suscripcion_precio" OWNER TO "postgres";


ALTER TABLE "public"."suscripcion_precio" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."suscripcion_precio_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."turno" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "negocio_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "caso_id" "uuid",
    "motivo" "text" NOT NULL,
    "empieza_en" timestamp with time zone NOT NULL,
    "estado" "text" DEFAULT 'agendado'::"text" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "minutos_reservados" integer,
    "origen" "text" DEFAULT 'mostrador'::"text" NOT NULL,
    "google_evento_id" "text",
    "sincronizado_en" timestamp with time zone,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "identificador" "text",
    "respuesta_cliente" "text",
    "respuesta_cliente_en" timestamp with time zone,
    CONSTRAINT "turno_estado_check" CHECK (("estado" = ANY (ARRAY['agendado'::"text", 'confirmado'::"text", 'cancelado'::"text", 'atendido'::"text"]))),
    CONSTRAINT "turno_minutos_positivos" CHECK ((("minutos_reservados" IS NULL) OR ("minutos_reservados" > 0))),
    CONSTRAINT "turno_origen_check" CHECK (("origen" = ANY (ARRAY['mostrador'::"text", 'cliente'::"text"]))),
    CONSTRAINT "turno_respuesta_cliente" CHECK (((("respuesta_cliente" IS NULL) AND ("respuesta_cliente_en" IS NULL)) OR (("respuesta_cliente" = ANY (ARRAY['confirmo'::"text", 'no_puede'::"text"])) AND ("respuesta_cliente_en" IS NOT NULL))))
);


ALTER TABLE "public"."turno" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuario" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "telefono" "text",
    "nombre" "text",
    "negocio_id" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rol" "text" DEFAULT 'duenio'::"text",
    "foto" "text",
    "negocio_predeterminado" "uuid",
    "inicio_rapido" boolean DEFAULT false NOT NULL,
    "visitando_desde" "uuid",
    CONSTRAINT "usuario_rol_check" CHECK (("rol" = ANY (ARRAY['duenio'::"text", 'encargado'::"text", 'tecnico'::"text"])))
);


ALTER TABLE "public"."usuario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuario_suscripcion" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "suscripcion_id" bigint NOT NULL,
    "proveedor" character varying NOT NULL,
    "proveedor_id" character varying NOT NULL,
    "estado" character varying NOT NULL,
    "negocio_id" "uuid"
);


ALTER TABLE "public"."usuario_suscripcion" OWNER TO "postgres";


ALTER TABLE "public"."usuario_suscripcion" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."usuario_suscripcion_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."MP_oauth_state"
    ADD CONSTRAINT "MP_oauth_state_pkey" PRIMARY KEY ("state");



ALTER TABLE ONLY "public"."caso"
    ADD CONSTRAINT "caso_negocio_id_numero_key" UNIQUE ("negocio_id", "numero");



ALTER TABLE ONLY "public"."caso"
    ADD CONSTRAINT "caso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias_del_negocio"
    ADD CONSTRAINT "categorias_del_negocio_pkey" PRIMARY KEY ("negocio_id");



ALTER TABLE ONLY "public"."cliente_evento"
    ADD CONSTRAINT "cliente_evento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cliente"
    ADD CONSTRAINT "cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cobro"
    ADD CONSTRAINT "cobro_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecuacion_dependencia"
    ADD CONSTRAINT "ecuacion_dependencia_ecuacion_id_alias_key" UNIQUE ("ecuacion_id", "alias");



ALTER TABLE ONLY "public"."ecuacion_dependencia"
    ADD CONSTRAINT "ecuacion_dependencia_pkey" PRIMARY KEY ("ecuacion_id", "dependencia_id");



ALTER TABLE ONLY "public"."ecuacion"
    ADD CONSTRAINT "ecuacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empleado"
    ADD CONSTRAINT "empleado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evento"
    ADD CONSTRAINT "evento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_calendar_conexion"
    ADD CONSTRAINT "google_calendar_conexion_pkey" PRIMARY KEY ("usuario_id");



ALTER TABLE ONLY "public"."google_calendar_evento"
    ADD CONSTRAINT "google_calendar_evento_pkey" PRIMARY KEY ("usuario_id", "turno_id");



ALTER TABLE ONLY "public"."insumo"
    ADD CONSTRAINT "insumo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitacion"
    ADD CONSTRAINT "invitacion_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."invitacion"
    ADD CONSTRAINT "invitacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_intento"
    ADD CONSTRAINT "landing_intento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_sesion"
    ADD CONSTRAINT "landing_sesion_pkey" PRIMARY KEY ("huella");



ALTER TABLE ONLY "public"."negocio_conexionMP"
    ADD CONSTRAINT "negocio_conexionMP_mercadopago_user_id_key" UNIQUE ("mercadopago_user_id");



ALTER TABLE ONLY "public"."negocio_conexionMP"
    ADD CONSTRAINT "negocio_conexionMP_negocio_id_key" UNIQUE ("negocio_id");



ALTER TABLE ONLY "public"."negocio_conexionMP"
    ADD CONSTRAINT "negocio_conexionMP_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."negocio"
    ADD CONSTRAINT "negocio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."negocio_seguimiento"
    ADD CONSTRAINT "negocio_seguimiento_pkey_tipo" PRIMARY KEY ("negocio_id", "tipo");



ALTER TABLE ONLY "public"."paso"
    ADD CONSTRAINT "paso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedido_idempotente"
    ADD CONSTRAINT "pedido_idempotente_pkey" PRIMARY KEY ("usuario_id", "ruta", "clave");



ALTER TABLE ONLY "public"."suscripcion"
    ADD CONSTRAINT "plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prueba_gratis"
    ADD CONSTRAINT "prueba_gratis_pkey" PRIMARY KEY ("usuario_id");



ALTER TABLE ONLY "public"."rol"
    ADD CONSTRAINT "rol_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seguimiento_whatsapp"
    ADD CONSTRAINT "seguimiento_whatsapp_caso_cerrado_tipo" UNIQUE ("caso_id", "cerrado_en", "tipo");



ALTER TABLE ONLY "public"."seguimiento_whatsapp"
    ADD CONSTRAINT "seguimiento_whatsapp_identidad_key" UNIQUE ("id", "caso_id", "negocio_id");



ALTER TABLE ONLY "public"."seguimiento_whatsapp"
    ADD CONSTRAINT "seguimiento_whatsapp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seguimiento_whatsapp_respuesta"
    ADD CONSTRAINT "seguimiento_whatsapp_respuesta_numero_emisor_id_mensaje_id_key" UNIQUE ("numero_emisor_id", "mensaje_id");



ALTER TABLE ONLY "public"."seguimiento_whatsapp_respuesta"
    ADD CONSTRAINT "seguimiento_whatsapp_respuesta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitud_de_ingreso"
    ADD CONSTRAINT "solicitud_de_ingreso_negocio_id_usuario_id_key" UNIQUE ("negocio_id", "usuario_id");



ALTER TABLE ONLY "public"."solicitud_de_ingreso"
    ADD CONSTRAINT "solicitud_de_ingreso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suscripcion_precio"
    ADD CONSTRAINT "suscripcion_precio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turno"
    ADD CONSTRAINT "turno_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuario_suscripcion"
    ADD CONSTRAINT "usuario_suscripcion_pkey" PRIMARY KEY ("id");



CREATE INDEX "caso_identificador_idx" ON "public"."caso" USING "btree" ("negocio_id", "identificador");



CREATE INDEX "caso_identificador_normalizado_idx" ON "public"."caso" USING "btree" ("negocio_id", "public"."normalizar_identificador"("identificador"));



CREATE INDEX "caso_negocio_estado_idx" ON "public"."caso" USING "btree" ("negocio_id", "estado");



CREATE UNIQUE INDEX "caso_seguimiento_codigo_idx" ON "public"."caso" USING "btree" ("seguimiento_codigo");



CREATE INDEX "caso_volver_en_idx" ON "public"."caso" USING "btree" ("negocio_id", "volver_en") WHERE ("volver_en" IS NOT NULL);



CREATE INDEX "cliente_evento_cliente_idx" ON "public"."cliente_evento" USING "btree" ("cliente_id", "ocurrido_en" DESC);



CREATE INDEX "cliente_negocio_idx" ON "public"."cliente" USING "btree" ("negocio_id");



CREATE INDEX "cliente_por_confirmar_idx" ON "public"."cliente" USING "btree" ("negocio_id") WHERE (NOT "confirmado");



CREATE INDEX "cliente_telefono" ON "public"."cliente" USING "btree" ("telefono");



CREATE INDEX "cobro_caso_idx" ON "public"."cobro" USING "btree" ("caso_id");



CREATE INDEX "cobro_negocio_idx" ON "public"."cobro" USING "btree" ("negocio_id", "estado");



CREATE UNIQUE INDEX "cobro_proveedor_idx" ON "public"."cobro" USING "btree" ("proveedor", "proveedor_id") WHERE ("proveedor_id" IS NOT NULL);



CREATE INDEX "ecuacion_dependencia_usada_idx" ON "public"."ecuacion_dependencia" USING "btree" ("dependencia_id");



CREATE INDEX "ecuacion_negocio_idx" ON "public"."ecuacion" USING "btree" ("negocio_id", "creado_en" DESC);



CREATE INDEX "empleado_negocio_idx" ON "public"."empleado" USING "btree" ("negocio_id");



CREATE UNIQUE INDEX "empleado_una_ficha_por_cuenta" ON "public"."empleado" USING "btree" ("usuario_id", "negocio_id") WHERE ("usuario_id" IS NOT NULL);



CREATE INDEX "empleado_usuario_idx" ON "public"."empleado" USING "btree" ("usuario_id");



CREATE INDEX "evento_caso_idx" ON "public"."evento" USING "btree" ("caso_id", "ocurrido_en" DESC);



CREATE INDEX "evento_tipo_idx" ON "public"."evento" USING "btree" ("tipo", "ocurrido_en" DESC);



CREATE INDEX "insumo_negocio_idx" ON "public"."insumo" USING "btree" ("negocio_id", "estado");



CREATE INDEX "invitacion_codigo_idx" ON "public"."invitacion" USING "btree" ("codigo");



CREATE INDEX "invitacion_negocio_idx" ON "public"."invitacion" USING "btree" ("negocio_id");



CREATE UNIQUE INDEX "invitacion_un_link_de_equipo" ON "public"."invitacion" USING "btree" ("negocio_id") WHERE ("de_equipo" AND (NOT "anulada"));



CREATE INDEX "landing_intento_creado_idx" ON "public"."landing_intento" USING "btree" ("creado_en");



CREATE INDEX "landing_intento_idx" ON "public"."landing_intento" USING "btree" ("negocio_id", "identificador", "creado_en");



CREATE INDEX "landing_sesion_vence_idx" ON "public"."landing_sesion" USING "btree" ("vence_en");



CREATE UNIQUE INDEX "negocio_agenda_codigo_idx" ON "public"."negocio" USING "btree" ("agenda_codigo");



CREATE UNIQUE INDEX "negocio_ics_codigo_idx" ON "public"."negocio" USING "btree" ("ics_codigo");



CREATE UNIQUE INDEX "negocio_landing_codigo_idx" ON "public"."negocio" USING "btree" ("landing_codigo");



CREATE INDEX "negocio_red_idx" ON "public"."negocio" USING "btree" ("red") WHERE ("red" IS NOT NULL);



CREATE INDEX "paso_caso_idx" ON "public"."paso" USING "btree" ("caso_id", "orden");



CREATE INDEX "pedido_idempotente_creado_en" ON "public"."pedido_idempotente" USING "btree" ("usuario_id", "creado_en");



CREATE INDEX "prueba_gratis_negocio_idx" ON "public"."prueba_gratis" USING "btree" ("negocio_id");



CREATE UNIQUE INDEX "rol_clave_unica" ON "public"."rol" USING "btree" ("negocio_id", "clave") WHERE ("clave" IS NOT NULL);



CREATE UNIQUE INDEX "rol_nombre_unico" ON "public"."rol" USING "btree" ("negocio_id", "lower"("nombre"));



CREATE UNIQUE INDEX "rol_un_duenio" ON "public"."rol" USING "btree" ("negocio_id") WHERE "es_duenio";



CREATE INDEX "seguimiento_whatsapp_pendientes" ON "public"."seguimiento_whatsapp" USING "btree" ("enviar_en") WHERE ("estado" = 'pendiente'::"text");



CREATE INDEX "seguimiento_whatsapp_respuesta_bandeja" ON "public"."seguimiento_whatsapp_respuesta" USING "btree" ("negocio_id", "creado_en", "id");



CREATE INDEX "seguimiento_whatsapp_respuesta_por_caso" ON "public"."seguimiento_whatsapp_respuesta" USING "btree" ("negocio_id", "caso_id", "creado_en", "id");



CREATE INDEX "seguimiento_whatsapp_turno_idx" ON "public"."seguimiento_whatsapp" USING "btree" ("turno_id") WHERE ("turno_id" IS NOT NULL);



CREATE UNIQUE INDEX "seguimiento_whatsapp_un_pendiente_por_turno" ON "public"."seguimiento_whatsapp" USING "btree" ("turno_id", "tipo") WHERE (("turno_id" IS NOT NULL) AND ("estado" = 'pendiente'::"text"));



CREATE UNIQUE INDEX "seguimiento_whatsapp_un_presupuesto_por_caso" ON "public"."seguimiento_whatsapp" USING "btree" ("caso_id") WHERE (("tipo" = 'presupuesto'::"text") AND ("estado" = 'pendiente'::"text"));



CREATE UNIQUE INDEX "seguimiento_whatsapp_un_volver_por_caso" ON "public"."seguimiento_whatsapp" USING "btree" ("caso_id") WHERE (("tipo" = 'volver'::"text") AND ("estado" = 'pendiente'::"text"));



CREATE UNIQUE INDEX "turno_horario_unico" ON "public"."turno" USING "btree" ("negocio_id", "empieza_en") WHERE ("estado" <> 'cancelado'::"text");



CREATE INDEX "turno_identificador_normalizado_idx" ON "public"."turno" USING "btree" ("negocio_id", "public"."normalizar_identificador"("identificador"));



CREATE INDEX "turno_negocio_fecha_idx" ON "public"."turno" USING "btree" ("negocio_id", "empieza_en");



CREATE INDEX "usuario_negocio_idx" ON "public"."usuario" USING "btree" ("negocio_id");



CREATE INDEX "usuario_suscripcion_negocio_idx" ON "public"."usuario_suscripcion" USING "btree" ("negocio_id", "estado");



CREATE OR REPLACE TRIGGER "caso_actualizado_en" BEFORE UPDATE ON "public"."caso" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "caso_cambio_permitido" BEFORE UPDATE ON "public"."caso" FOR EACH ROW EXECUTE FUNCTION "public"."caso_cambio_permitido"();



CREATE OR REPLACE TRIGGER "caso_reabierto_cancela_seguimiento" AFTER UPDATE OF "estado" ON "public"."caso" FOR EACH ROW WHEN ((("old"."estado" = 'completado'::"text") AND ("new"."estado" <> 'completado'::"text"))) EXECUTE FUNCTION "public"."cancelar_seguimiento_al_reabrir"();



CREATE OR REPLACE TRIGGER "cliente_actualizado_en" BEFORE UPDATE ON "public"."cliente" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "cliente_avisos_baja_por_su_camino" BEFORE INSERT OR UPDATE OF "avisos_baja_en" ON "public"."cliente" FOR EACH ROW EXECUTE FUNCTION "public"."cliente_avisos_baja_por_su_camino"();



CREATE OR REPLACE TRIGGER "cobro_actualizado_en" BEFORE UPDATE ON "public"."cobro" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "cobro_mantiene_caso" AFTER INSERT OR DELETE OR UPDATE ON "public"."cobro" FOR EACH ROW EXECUTE FUNCTION "public"."cobro_recalcular_caso"();



CREATE OR REPLACE TRIGGER "ecuacion_actualizado_en" BEFORE UPDATE ON "public"."ecuacion" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "empleado_actualizado_en" BEFORE UPDATE ON "public"."empleado" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "empleado_quita_acceso" BEFORE DELETE ON "public"."empleado" FOR EACH ROW EXECUTE FUNCTION "public"."quitar_acceso_al_sacar"();



CREATE OR REPLACE TRIGGER "empleado_rol_da_permisos" BEFORE UPDATE OF "rol" ON "public"."empleado" FOR EACH ROW EXECUTE FUNCTION "public"."rol_de_la_ficha_da_permisos"();



CREATE OR REPLACE TRIGGER "empleado_rol_id_de_la_clave" BEFORE INSERT OR UPDATE OF "rol" ON "public"."empleado" FOR EACH ROW EXECUTE FUNCTION "public"."rol_id_de_la_clave"();



CREATE OR REPLACE TRIGGER "insumo_actualizado_en" BEFORE UPDATE ON "public"."insumo" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "invitacion_actualizado_en" BEFORE UPDATE ON "public"."invitacion" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "negocio_actualizado_en" BEFORE UPDATE ON "public"."negocio" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "negocio_crea_sus_roles" AFTER INSERT ON "public"."negocio" FOR EACH ROW EXECUTE FUNCTION "public"."crear_roles_del_negocio"();



CREATE OR REPLACE TRIGGER "negocio_creado_por_fijo" BEFORE UPDATE OF "creado_por" ON "public"."negocio" FOR EACH ROW EXECUTE FUNCTION "public"."creado_por_fijo"();



CREATE OR REPLACE TRIGGER "negocio_red_fija" BEFORE UPDATE OF "red" ON "public"."negocio" FOR EACH ROW EXECUTE FUNCTION "public"."red_fija"();



CREATE OR REPLACE TRIGGER "negocio_rubro_fijo" BEFORE UPDATE OF "rubro" ON "public"."negocio" FOR EACH ROW EXECUTE FUNCTION "public"."rubro_fijo_con_casos"();



CREATE OR REPLACE TRIGGER "paso_actualizado_en" BEFORE UPDATE ON "public"."paso" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "paso_aprobado_fijo" BEFORE UPDATE ON "public"."paso" FOR EACH ROW EXECUTE FUNCTION "public"."paso_aprobado_no_se_modifica"();



CREATE OR REPLACE TRIGGER "paso_aprobado_no_se_borra" BEFORE DELETE ON "public"."paso" FOR EACH ROW EXECUTE FUNCTION "public"."paso_aprobado_no_se_borra"();



CREATE OR REPLACE TRIGGER "paso_cambio_permitido" BEFORE INSERT OR DELETE OR UPDATE ON "public"."paso" FOR EACH ROW EXECUTE FUNCTION "public"."paso_cambio_permitido"();



CREATE OR REPLACE TRIGGER "rol_duenio_fijo" BEFORE DELETE OR UPDATE ON "public"."rol" FOR EACH ROW EXECUTE FUNCTION "public"."rol_duenio_fijo"();



CREATE OR REPLACE TRIGGER "turno_actualizado_en" BEFORE UPDATE ON "public"."turno" FOR EACH ROW EXECUTE FUNCTION "public"."tocar_actualizado_en"();



CREATE OR REPLACE TRIGGER "turno_respuesta_solo_del_cliente" BEFORE INSERT OR UPDATE ON "public"."turno" FOR EACH ROW EXECUTE FUNCTION "public"."turno_respuesta_solo_del_cliente"();



ALTER TABLE ONLY "public"."MP_oauth_state"
    ADD CONSTRAINT "MP_oauth_state_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caso"
    ADD CONSTRAINT "caso_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."caso"
    ADD CONSTRAINT "caso_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caso"
    ADD CONSTRAINT "caso_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."empleado"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."categorias_del_negocio"
    ADD CONSTRAINT "categorias_del_negocio_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cliente_evento"
    ADD CONSTRAINT "cliente_evento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cliente_evento"
    ADD CONSTRAINT "cliente_evento_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cliente_evento"
    ADD CONSTRAINT "cliente_evento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cliente"
    ADD CONSTRAINT "cliente_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cobro"
    ADD CONSTRAINT "cobro_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "public"."empleado"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cobro"
    ADD CONSTRAINT "cobro_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cobro"
    ADD CONSTRAINT "cobro_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."empleado"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cobro"
    ADD CONSTRAINT "cobro_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ecuacion_dependencia"
    ADD CONSTRAINT "ecuacion_dependencia_dependencia_id_fkey" FOREIGN KEY ("dependencia_id") REFERENCES "public"."ecuacion"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ecuacion_dependencia"
    ADD CONSTRAINT "ecuacion_dependencia_ecuacion_id_fkey" FOREIGN KEY ("ecuacion_id") REFERENCES "public"."ecuacion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ecuacion"
    ADD CONSTRAINT "ecuacion_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empleado"
    ADD CONSTRAINT "empleado_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empleado"
    ADD CONSTRAINT "empleado_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."rol"("id");



ALTER TABLE ONLY "public"."empleado"
    ADD CONSTRAINT "empleado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."evento"
    ADD CONSTRAINT "evento_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_calendar_conexion"
    ADD CONSTRAINT "google_calendar_conexion_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_calendar_conexion"
    ADD CONSTRAINT "google_calendar_conexion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_calendar_evento"
    ADD CONSTRAINT "google_calendar_evento_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_calendar_evento"
    ADD CONSTRAINT "google_calendar_evento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."google_calendar_conexion"("usuario_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insumo"
    ADD CONSTRAINT "insumo_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."insumo"
    ADD CONSTRAINT "insumo_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitacion"
    ADD CONSTRAINT "invitacion_creada_por_fkey" FOREIGN KEY ("creada_por") REFERENCES "public"."usuario"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitacion"
    ADD CONSTRAINT "invitacion_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."landing_intento"
    ADD CONSTRAINT "landing_intento_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."landing_sesion"
    ADD CONSTRAINT "landing_sesion_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."negocio_conexionMP"
    ADD CONSTRAINT "negocio_conexionMP_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."negocio"
    ADD CONSTRAINT "negocio_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."negocio_seguimiento"
    ADD CONSTRAINT "negocio_seguimiento_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."paso"
    ADD CONSTRAINT "paso_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedido_idempotente"
    ADD CONSTRAINT "pedido_idempotente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prueba_gratis"
    ADD CONSTRAINT "prueba_gratis_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prueba_gratis"
    ADD CONSTRAINT "prueba_gratis_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rol"
    ADD CONSTRAINT "rol_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seguimiento_whatsapp"
    ADD CONSTRAINT "seguimiento_whatsapp_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seguimiento_whatsapp"
    ADD CONSTRAINT "seguimiento_whatsapp_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seguimiento_whatsapp_respuesta"
    ADD CONSTRAINT "seguimiento_whatsapp_respuesta_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."seguimiento_whatsapp_respuesta"
    ADD CONSTRAINT "seguimiento_whatsapp_respuesta_seguimiento_fkey" FOREIGN KEY ("seguimiento_id", "caso_id", "negocio_id") REFERENCES "public"."seguimiento_whatsapp"("id", "caso_id", "negocio_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."seguimiento_whatsapp"
    ADD CONSTRAINT "seguimiento_whatsapp_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."solicitud_de_ingreso"
    ADD CONSTRAINT "solicitud_de_ingreso_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."solicitud_de_ingreso"
    ADD CONSTRAINT "solicitud_de_ingreso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suscripcion_precio"
    ADD CONSTRAINT "suscripcion_precio_suscripcion_id_fkey" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripcion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turno"
    ADD CONSTRAINT "turno_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."turno"
    ADD CONSTRAINT "turno_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."turno"
    ADD CONSTRAINT "turno_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_negocio_predeterminado_fkey" FOREIGN KEY ("negocio_predeterminado") REFERENCES "public"."negocio"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usuario_suscripcion"
    ADD CONSTRAINT "usuario_suscripcion_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuario_suscripcion"
    ADD CONSTRAINT "usuario_suscripcion_suscripcion_id_fkey" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripcion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usuario_suscripcion"
    ADD CONSTRAINT "usuario_suscripcion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_visitando_desde_fkey" FOREIGN KEY ("visitando_desde") REFERENCES "public"."negocio"("id") ON DELETE SET NULL;



ALTER TABLE "public"."MP_oauth_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."caso" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "caso_lo_abre_quien_puede" ON "public"."caso" FOR INSERT TO "authenticated" WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('crear_casos'::"text") AS "puede_aca")));



CREATE POLICY "caso_lo_borra_quien_puede" ON "public"."caso" FOR DELETE TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('crear_casos'::"text") AS "puede_aca") AND (( SELECT "public"."puede_aca"('ver_todos_los_casos'::"text") AS "puede_aca") OR ("responsable_id" = "public"."mi_empleado"()))));



CREATE POLICY "caso_lo_cambia_quien_puede" ON "public"."caso" FOR UPDATE TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND (( SELECT "public"."puede_aca"('ver_todos_los_casos'::"text") AS "puede_aca") OR ("responsable_id" = "public"."mi_empleado"())))) WITH CHECK (("negocio_id" = "public"."mi_negocio"()));



CREATE POLICY "caso_lo_ve_quien_puede" ON "public"."caso" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND (( SELECT "public"."puede_aca"('ver_todos_los_casos'::"text") AS "puede_aca") OR ("responsable_id" = "public"."mi_empleado"()))));



ALTER TABLE "public"."categorias_del_negocio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categorias_las_carga_quien_puede" ON "public"."categorias_del_negocio" TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('editar_inventario'::"text") AS "puede_aca"))) WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('editar_inventario'::"text") AS "puede_aca")));



CREATE POLICY "categorias_las_ve_el_negocio" ON "public"."categorias_del_negocio" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('ver_inventario'::"text") AS "puede_aca")));



ALTER TABLE "public"."cliente" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cliente_evento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cliente_evento_lo_ve_el_negocio" ON "public"."cliente_evento" FOR SELECT TO "authenticated" USING (("negocio_id" = "public"."mi_negocio"()));



CREATE POLICY "cliente_lo_carga_quien_puede" ON "public"."cliente" TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('editar_clientes'::"text") AS "puede_aca"))) WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('editar_clientes'::"text") AS "puede_aca")));



CREATE POLICY "cliente_lo_ve_el_negocio" ON "public"."cliente" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('ver_clientes'::"text") AS "puede_aca")));



ALTER TABLE "public"."cobro" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cobro_de_mi_negocio" ON "public"."cobro" FOR SELECT USING ((("negocio_id" = "public"."mi_negocio"()) AND ("public"."mi_empleado"() IS NOT NULL)));



ALTER TABLE "public"."ecuacion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecuacion_dependencia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ecuacion_dependencia_la_borra_quien_puede" ON "public"."ecuacion_dependencia" FOR DELETE TO "authenticated" USING ((( SELECT "public"."puede_aca"('armar_presupuesto'::"text") AS "puede_aca") AND (EXISTS ( SELECT 1
   FROM "public"."ecuacion" "e"
  WHERE (("e"."id" = "ecuacion_dependencia"."ecuacion_id") AND ("e"."negocio_id" = "public"."mi_negocio"()))))));



CREATE POLICY "ecuacion_dependencia_la_carga_quien_puede" ON "public"."ecuacion_dependencia" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."puede_aca"('armar_presupuesto'::"text") AS "puede_aca") AND (EXISTS ( SELECT 1
   FROM "public"."ecuacion" "e"
  WHERE (("e"."id" = "ecuacion_dependencia"."ecuacion_id") AND ("e"."negocio_id" = "public"."mi_negocio"())))) AND (EXISTS ( SELECT 1
   FROM "public"."ecuacion" "d"
  WHERE (("d"."id" = "ecuacion_dependencia"."dependencia_id") AND ("d"."negocio_id" = "public"."mi_negocio"()))))));



CREATE POLICY "ecuacion_dependencia_la_ve_el_negocio" ON "public"."ecuacion_dependencia" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ecuacion" "e"
  WHERE (("e"."id" = "ecuacion_dependencia"."ecuacion_id") AND ("e"."negocio_id" = "public"."mi_negocio"())))));



CREATE POLICY "ecuacion_la_borra_quien_puede" ON "public"."ecuacion" FOR DELETE TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('armar_presupuesto'::"text") AS "puede_aca")));



CREATE POLICY "ecuacion_la_carga_quien_puede" ON "public"."ecuacion" FOR INSERT TO "authenticated" WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('armar_presupuesto'::"text") AS "puede_aca")));



CREATE POLICY "ecuacion_la_edita_quien_puede" ON "public"."ecuacion" FOR UPDATE TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('armar_presupuesto'::"text") AS "puede_aca"))) WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('armar_presupuesto'::"text") AS "puede_aca")));



CREATE POLICY "ecuacion_lo_ve_el_negocio" ON "public"."ecuacion" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ("public"."mi_empleado"() IS NOT NULL)));



ALTER TABLE "public"."empleado" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empleado_lo_cambia_quien_puede" ON "public"."empleado" FOR UPDATE TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('manejar_roles'::"text") AS "puede_aca"))) WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('manejar_roles'::"text") AS "puede_aca")));



CREATE POLICY "empleado_lo_saca_quien_puede" ON "public"."empleado" FOR DELETE TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('sacar_del_equipo'::"text") AS "puede_aca")));



CREATE POLICY "empleado_lo_suma_quien_puede" ON "public"."empleado" FOR INSERT TO "authenticated" WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('sumar_al_equipo'::"text") AS "puede_aca")));



CREATE POLICY "empleado_lo_ve_el_negocio" ON "public"."empleado" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND "public"."estoy_aca"()));



ALTER TABLE "public"."evento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evento_lo_agrega_el_equipo" ON "public"."evento" FOR INSERT TO "authenticated" WITH CHECK ((("public"."mi_empleado"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE ("c"."id" = "evento"."caso_id")))));



CREATE POLICY "evento_lo_borra_el_equipo" ON "public"."evento" FOR DELETE TO "authenticated" USING ((("public"."mi_empleado"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE ("c"."id" = "evento"."caso_id")))));



CREATE POLICY "evento_lo_cambia_el_equipo" ON "public"."evento" FOR UPDATE TO "authenticated" USING ((("public"."mi_empleado"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE ("c"."id" = "evento"."caso_id"))))) WITH CHECK ((("public"."mi_empleado"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE ("c"."id" = "evento"."caso_id")))));



CREATE POLICY "evento_lo_ve_quien_ve_el_caso" ON "public"."evento" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE ("c"."id" = "evento"."caso_id"))));



ALTER TABLE "public"."google_calendar_conexion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_calendar_evento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insumo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insumo_lo_carga_quien_puede" ON "public"."insumo" TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('editar_inventario'::"text") AS "puede_aca"))) WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('editar_inventario'::"text") AS "puede_aca")));



CREATE POLICY "insumo_lo_ve_el_negocio" ON "public"."insumo" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('ver_inventario'::"text") AS "puede_aca")));



ALTER TABLE "public"."invitacion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitacion_anula_el_duenio" ON "public"."invitacion" FOR UPDATE TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('sumar_al_equipo'::"text") AS "puede_aca"))) WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('sumar_al_equipo'::"text") AS "puede_aca")));



CREATE POLICY "invitacion_crea_el_duenio" ON "public"."invitacion" FOR INSERT TO "authenticated" WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('sumar_al_equipo'::"text") AS "puede_aca")));



CREATE POLICY "invitacion_ve_las_suyas" ON "public"."invitacion" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ("public"."mi_empleado"() IS NOT NULL)));



ALTER TABLE "public"."landing_intento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."landing_sesion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."negocio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."negocio_conexionMP" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "negocio_edita_el_suyo" ON "public"."negocio" FOR UPDATE TO "authenticated" USING ((("id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('configurar_negocio'::"text") AS "puede_aca"))) WITH CHECK ((("id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('configurar_negocio'::"text") AS "puede_aca")));



ALTER TABLE "public"."negocio_seguimiento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "negocio_seguimiento_crear" ON "public"."negocio_seguimiento" FOR INSERT TO "authenticated" WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca")));



CREATE POLICY "negocio_seguimiento_editar" ON "public"."negocio_seguimiento" FOR UPDATE TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca"))) WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca")));



CREATE POLICY "negocio_seguimiento_ver" ON "public"."negocio_seguimiento" FOR SELECT TO "authenticated" USING (("negocio_id" = "public"."mi_negocio"()));



CREATE POLICY "negocio_ve_el_suyo" ON "public"."negocio" FOR SELECT TO "authenticated" USING ((("id" = "public"."mi_negocio"()) AND "public"."estoy_aca"()));



ALTER TABLE "public"."paso" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "paso_lo_mueve_quien_puede" ON "public"."paso" TO "authenticated" USING (((( SELECT "public"."puede_aca"('armar_presupuesto'::"text") AS "puede_aca") OR ( SELECT "public"."puede_aca"('aprobar_por_el_cliente'::"text") AS "puede_aca")) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE (("c"."id" = "paso"."caso_id") AND ("c"."negocio_id" = "public"."mi_negocio"())))))) WITH CHECK (((( SELECT "public"."puede_aca"('armar_presupuesto'::"text") AS "puede_aca") OR ( SELECT "public"."puede_aca"('aprobar_por_el_cliente'::"text") AS "puede_aca")) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE (("c"."id" = "paso"."caso_id") AND ("c"."negocio_id" = "public"."mi_negocio"()))))));



CREATE POLICY "paso_lo_ve_quien_ve_el_caso" ON "public"."paso" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE ("c"."id" = "paso"."caso_id"))));



ALTER TABLE "public"."pedido_idempotente" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pedido_idempotente_propio" ON "public"."pedido_idempotente" TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."prueba_gratis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prueba_gratis_la_ve_el_negocio" ON "public"."prueba_gratis" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) OR ("usuario_id" = "auth"."uid"())));



ALTER TABLE "public"."rol" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rol_lo_ve_el_negocio" ON "public"."rol" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND "public"."estoy_aca"()));



CREATE POLICY "seguimiento_presupuesto_cambiar" ON "public"."seguimiento_whatsapp" FOR UPDATE TO "authenticated" USING ((("tipo" = 'presupuesto'::"text") AND ("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca") AND ("estado" = 'pendiente'::"text"))) WITH CHECK ((("tipo" = 'presupuesto'::"text") AND ("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca") AND ("estado" = ANY (ARRAY['pendiente'::"text", 'cancelado'::"text"])) AND ("mensaje_id" IS NULL) AND ("error" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE (("c"."id" = "seguimiento_whatsapp"."caso_id") AND ("c"."negocio_id" = "seguimiento_whatsapp"."negocio_id"))))));



CREATE POLICY "seguimiento_presupuesto_programar" ON "public"."seguimiento_whatsapp" FOR INSERT TO "authenticated" WITH CHECK ((("tipo" = 'presupuesto'::"text") AND ("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca") AND ("estado" = 'pendiente'::"text") AND ("mensaje_id" IS NULL) AND ("error" IS NULL) AND ("motivo" IS NULL) AND ("procesado_en" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE (("c"."id" = "seguimiento_whatsapp"."caso_id") AND ("c"."negocio_id" = "seguimiento_whatsapp"."negocio_id") AND ("c"."estado" <> 'completado'::"text") AND ("c"."seguimiento_codigo" IS NOT NULL))))));



CREATE POLICY "seguimiento_turno_cambiar" ON "public"."seguimiento_whatsapp" FOR UPDATE TO "authenticated" USING ((("tipo" = 'turno'::"text") AND ("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('manejar_turnos'::"text") AS "puede_aca") AND ("estado" = 'pendiente'::"text"))) WITH CHECK ((("tipo" = 'turno'::"text") AND ("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('manejar_turnos'::"text") AS "puede_aca") AND ("estado" = ANY (ARRAY['pendiente'::"text", 'cancelado'::"text"])) AND ("mensaje_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."turno" "t"
  WHERE (("t"."id" = "seguimiento_whatsapp"."turno_id") AND ("t"."negocio_id" = "seguimiento_whatsapp"."negocio_id"))))));



CREATE POLICY "seguimiento_turno_programar" ON "public"."seguimiento_whatsapp" FOR INSERT TO "authenticated" WITH CHECK ((("tipo" = 'turno'::"text") AND ("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('manejar_turnos'::"text") AS "puede_aca") AND ("estado" = 'pendiente'::"text") AND ("mensaje_id" IS NULL) AND ("error" IS NULL) AND ("procesado_en" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."turno" "t"
  WHERE (("t"."id" = "seguimiento_whatsapp"."turno_id") AND ("t"."negocio_id" = "seguimiento_whatsapp"."negocio_id") AND ("t"."estado" = ANY (ARRAY['agendado'::"text", 'confirmado'::"text"])))))));



CREATE POLICY "seguimiento_volver_cambiar" ON "public"."seguimiento_whatsapp" FOR UPDATE TO "authenticated" USING ((("tipo" = 'volver'::"text") AND ("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca") AND ("estado" = 'pendiente'::"text"))) WITH CHECK ((("tipo" = 'volver'::"text") AND ("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca") AND ("estado" = ANY (ARRAY['pendiente'::"text", 'cancelado'::"text"])) AND ("mensaje_id" IS NULL) AND ("error" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE (("c"."id" = "seguimiento_whatsapp"."caso_id") AND ("c"."negocio_id" = "seguimiento_whatsapp"."negocio_id"))))));



CREATE POLICY "seguimiento_volver_programar" ON "public"."seguimiento_whatsapp" FOR INSERT TO "authenticated" WITH CHECK ((("tipo" = 'volver'::"text") AND ("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca") AND ("estado" = 'pendiente'::"text") AND ("mensaje_id" IS NULL) AND ("error" IS NULL) AND ("motivo" IS NULL) AND ("procesado_en" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE (("c"."id" = "seguimiento_whatsapp"."caso_id") AND ("c"."negocio_id" = "seguimiento_whatsapp"."negocio_id") AND ("c"."estado" = 'completado'::"text") AND ("c"."volver_en" IS NOT NULL))))));



ALTER TABLE "public"."seguimiento_whatsapp" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seguimiento_whatsapp_cancelar" ON "public"."seguimiento_whatsapp" FOR UPDATE TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca") AND ("estado" = 'pendiente'::"text"))) WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca") AND ("estado" = 'cancelado'::"text") AND ("mensaje_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE (("c"."id" = "seguimiento_whatsapp"."caso_id") AND ("c"."negocio_id" = "seguimiento_whatsapp"."negocio_id") AND ("c"."estado" <> 'completado'::"text"))))));



CREATE POLICY "seguimiento_whatsapp_crear" ON "public"."seguimiento_whatsapp" FOR INSERT TO "authenticated" WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca") AND ("estado" = 'pendiente'::"text") AND ("mensaje_id" IS NULL) AND ("error" IS NULL) AND ("procesado_en" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE (("c"."id" = "seguimiento_whatsapp"."caso_id") AND ("c"."negocio_id" = "seguimiento_whatsapp"."negocio_id") AND ((("seguimiento_whatsapp"."tipo" = 'cierre'::"text") AND ("c"."estado" = 'completado'::"text")) OR (("seguimiento_whatsapp"."tipo" = 'estado'::"text") AND ("c"."estado" <> 'completado'::"text"))))))));



ALTER TABLE "public"."seguimiento_whatsapp_respuesta" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seguimiento_whatsapp_respuesta_ver" ON "public"."seguimiento_whatsapp_respuesta" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND (EXISTS ( SELECT 1
   FROM "public"."caso" "c"
  WHERE (("c"."id" = "seguimiento_whatsapp_respuesta"."caso_id") AND ("c"."negocio_id" = "seguimiento_whatsapp_respuesta"."negocio_id"))))));



CREATE POLICY "seguimiento_whatsapp_ver" ON "public"."seguimiento_whatsapp" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('entregar_y_reabrir'::"text") AS "puede_aca")));



ALTER TABLE "public"."solicitud_de_ingreso" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suscripcion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suscripcion_la_ve_cualquiera" ON "public"."suscripcion" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."suscripcion_precio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suscripcion_precio_lo_ve_cualquiera" ON "public"."suscripcion_precio" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."turno" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "turno_lo_carga_quien_puede" ON "public"."turno" TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('manejar_turnos'::"text") AS "puede_aca"))) WITH CHECK ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('manejar_turnos'::"text") AS "puede_aca")));



CREATE POLICY "turno_lo_ve_el_negocio" ON "public"."turno" FOR SELECT TO "authenticated" USING ((("negocio_id" = "public"."mi_negocio"()) AND ( SELECT "public"."puede_aca"('ver_agenda'::"text") AS "puede_aca")));



ALTER TABLE "public"."usuario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuario_crea_lo_suyo" ON "public"."usuario" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "usuario_edita_lo_suyo" ON "public"."usuario" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."usuario_suscripcion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuario_suscripcion_la_ve_el_negocio" ON "public"."usuario_suscripcion" FOR SELECT TO "authenticated" USING (("negocio_id" = "public"."mi_negocio"()));



CREATE POLICY "usuario_ve_lo_suyo" ON "public"."usuario" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."abrir_sesion_landing"("p_negocio" "uuid", "p_identificador" "text", "p_ultimos4" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."abrir_sesion_landing"("p_negocio" "uuid", "p_identificador" "text", "p_ultimos4" "text") TO "service_role";



GRANT ALL ON TABLE "public"."negocio" TO "anon";
GRANT ALL ON TABLE "public"."negocio" TO "authenticated";
GRANT ALL ON TABLE "public"."negocio" TO "service_role";



REVOKE ALL ON FUNCTION "public"."agenda_del_negocio"("n" "public"."negocio") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."agenda_del_negocio"("n" "public"."negocio") TO "service_role";



REVOKE ALL ON FUNCTION "public"."anotar_turno"("n" "public"."negocio", "p_cliente" "uuid", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_identificador" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."anotar_turno"("n" "public"."negocio", "p_cliente" "uuid", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_identificador" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."anular_cobro"("p_cobro_id" "uuid", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."anular_cobro"("p_cobro_id" "uuid", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."anular_cobro"("p_cobro_id" "uuid", "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."anular_cobro_api"("p_cobro_id" "uuid", "p_motivo" "text", "p_autor" "text", "p_detalle" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."anular_cobro_api"("p_cobro_id" "uuid", "p_motivo" "text", "p_autor" "text", "p_detalle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."anular_cobro_api"("p_cobro_id" "uuid", "p_motivo" "text", "p_autor" "text", "p_detalle" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."aprobar_solicitud"("p_id" "uuid", "p_rol" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."aprobar_solicitud"("p_id" "uuid", "p_rol" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aprobar_solicitud"("p_id" "uuid", "p_rol" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."asignar_rol"("p_empleado" "uuid", "p_rol" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."asignar_rol"("p_empleado" "uuid", "p_rol" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."asignar_rol"("p_empleado" "uuid", "p_rol" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."borrar_negocio"("p_negocio" "uuid", "p_nombre" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."borrar_negocio"("p_negocio" "uuid", "p_nombre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."borrar_negocio"("p_negocio" "uuid", "p_nombre" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."borrar_rol"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."borrar_rol"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."borrar_rol"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cambiar_descuento_api"("p_caso_id" "uuid", "p_monto" numeric, "p_autor" "text", "p_titulo" "text", "p_detalle" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cambiar_descuento_api"("p_caso_id" "uuid", "p_monto" numeric, "p_autor" "text", "p_titulo" "text", "p_detalle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cambiar_descuento_api"("p_caso_id" "uuid", "p_monto" numeric, "p_autor" "text", "p_titulo" "text", "p_detalle" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cambiar_estado_con_notificacion"("p_caso_id" "uuid", "p_actualizado_en" timestamp with time zone, "p_estado" "text", "p_que_falta" "text", "p_evento" "jsonb", "p_notificacion" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cambiar_estado_con_notificacion"("p_caso_id" "uuid", "p_actualizado_en" timestamp with time zone, "p_estado" "text", "p_que_falta" "text", "p_evento" "jsonb", "p_notificacion" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cambiar_estado_con_notificacion"("p_caso_id" "uuid", "p_actualizado_en" timestamp with time zone, "p_estado" "text", "p_que_falta" "text", "p_evento" "jsonb", "p_notificacion" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cambiar_link_de_equipo"("p_dias" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cambiar_link_de_equipo"("p_dias" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cambiar_link_de_equipo"("p_dias" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancelar_seguimiento_al_reabrir"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancelar_seguimiento_al_reabrir"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancelar_seguimiento_al_reabrir"() TO "service_role";



GRANT ALL ON FUNCTION "public"."caso_cambio_permitido"() TO "anon";
GRANT ALL ON FUNCTION "public"."caso_cambio_permitido"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."caso_cambio_permitido"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cliente_avisos_baja_por_su_camino"() TO "anon";
GRANT ALL ON FUNCTION "public"."cliente_avisos_baja_por_su_camino"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cliente_avisos_baja_por_su_camino"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."clientes_de_la_landing"("p_negocio" "uuid", "p_identificador" "text", "p_ultimos4" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clientes_de_la_landing"("p_negocio" "uuid", "p_identificador" "text", "p_ultimos4" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cobro_recalcular_caso"() TO "anon";
GRANT ALL ON FUNCTION "public"."cobro_recalcular_caso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cobro_recalcular_caso"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."compartir_agenda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compartir_agenda"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."compartir_agenda"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."compartir_caso"("p_caso_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compartir_caso"("p_caso_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compartir_caso"("p_caso_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."compartir_ics"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compartir_ics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."compartir_ics"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."compartir_landing"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compartir_landing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."compartir_landing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."creado_por_fijo"() TO "anon";
GRANT ALL ON FUNCTION "public"."creado_por_fijo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."creado_por_fijo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."crear_mi_negocio"("p_nombre" "text", "p_rubro" "text", "p_modulos" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."crear_mi_negocio"("p_nombre" "text", "p_rubro" "text", "p_modulos" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_mi_negocio"("p_nombre" "text", "p_rubro" "text", "p_modulos" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_roles_del_negocio"() TO "anon";
GRANT ALL ON FUNCTION "public"."crear_roles_del_negocio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_roles_del_negocio"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."dejar_de_compartir_agenda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dejar_de_compartir_agenda"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dejar_de_compartir_agenda"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."dejar_de_compartir_caso"("p_caso_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dejar_de_compartir_caso"("p_caso_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dejar_de_compartir_caso"("p_caso_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."dejar_de_compartir_ics"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dejar_de_compartir_ics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dejar_de_compartir_ics"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."dejar_de_compartir_landing"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dejar_de_compartir_landing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dejar_de_compartir_landing"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."desvincular_sede"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."desvincular_sede"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."desvincular_sede"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."empezar_prueba"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."empezar_prueba"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."empezar_prueba"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."entrar_al_negocio"("p_negocio" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."entrar_al_negocio"("p_negocio" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."entrar_al_negocio"("p_negocio" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."entrar_de_visita"("p_sede" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."entrar_de_visita"("p_sede" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."entrar_de_visita"("p_sede" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."entregar_caso"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_descuento" numeric, "p_detalle" "text", "p_autor" "text", "p_ocurrido_en" timestamp with time zone, "p_volver_en" "date", "p_toca_volver_en" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."entregar_caso"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_descuento" numeric, "p_detalle" "text", "p_autor" "text", "p_ocurrido_en" timestamp with time zone, "p_volver_en" "date", "p_toca_volver_en" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."entregar_caso"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_descuento" numeric, "p_detalle" "text", "p_autor" "text", "p_ocurrido_en" timestamp with time zone, "p_volver_en" "date", "p_toca_volver_en" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."entregar_caso_con_seguimiento"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_descuento" numeric, "p_detalle" "text", "p_autor" "text", "p_ocurrido_en" timestamp with time zone, "p_seguimiento" "jsonb", "p_volver_en" "date", "p_toca_volver_en" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."entregar_caso_con_seguimiento"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_descuento" numeric, "p_detalle" "text", "p_autor" "text", "p_ocurrido_en" timestamp with time zone, "p_seguimiento" "jsonb", "p_volver_en" "date", "p_toca_volver_en" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."entregar_caso_con_seguimiento"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_descuento" numeric, "p_detalle" "text", "p_autor" "text", "p_ocurrido_en" timestamp with time zone, "p_seguimiento" "jsonb", "p_volver_en" "date", "p_toca_volver_en" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."estoy_aca"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."estoy_aca"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."estoy_aca"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fotos_del_equipo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fotos_del_equipo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fotos_del_equipo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_foto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_foto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."guardar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_foto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_preferencias_de_entrada"("p_predeterminado" "uuid", "p_inicio_rapido" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_preferencias_de_entrada"("p_predeterminado" "uuid", "p_inicio_rapido" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."guardar_preferencias_de_entrada"("p_predeterminado" "uuid", "p_inicio_rapido" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_rol"("p_id" "uuid", "p_nombre" "text", "p_permisos" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_rol"("p_id" "uuid", "p_nombre" "text", "p_permisos" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."guardar_rol"("p_id" "uuid", "p_nombre" "text", "p_permisos" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."hueco_ofrecido"("p_horarios" "jsonb", "p_cuando" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."hueco_ofrecido"("p_horarios" "jsonb", "p_cuando" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hueco_ofrecido"("p_horarios" "jsonb", "p_cuando" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."ingresar_landing"("p_codigo" "text", "p_identificador" "text", "p_ultimos4" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ingresar_landing"("p_codigo" "text", "p_identificador" "text", "p_ultimos4" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ingresar_landing"("p_codigo" "text", "p_identificador" "text", "p_ultimos4" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ingresar_landing"("p_codigo" "text", "p_identificador" "text", "p_ultimos4" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."inventario_de_mis_sedes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inventario_de_mis_sedes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."inventario_de_mis_sedes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."landing_bloqueada"("p_negocio" "uuid", "p_identificador" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."landing_bloqueada"("p_negocio" "uuid", "p_identificador" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."landing_del_codigo"("p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."landing_del_codigo"("p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."link_de_equipo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."link_de_equipo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_de_equipo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."marcar_paso_hecho"("p_paso_id" "uuid", "p_hecho" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."marcar_paso_hecho"("p_paso_id" "uuid", "p_hecho" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."marcar_paso_hecho"("p_paso_id" "uuid", "p_hecho" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."mercadopago_crear_estado"("p_state" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mercadopago_crear_estado"("p_state" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mercadopago_crear_estado"("p_state" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mercadopago_desvincular"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mercadopago_desvincular"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mercadopago_desvincular"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mercadopago_estado"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mercadopago_estado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mercadopago_estado"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mi_empleado"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mi_empleado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mi_empleado"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mi_negocio"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mi_negocio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mi_negocio"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mi_rol"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mi_rol"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mi_rol"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mis_casos_landing"("p_codigo" "text", "p_llave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mis_casos_landing"("p_codigo" "text", "p_llave" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mis_casos_landing"("p_codigo" "text", "p_llave" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mis_casos_landing"("p_codigo" "text", "p_llave" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mis_negocios"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mis_negocios"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mis_negocios"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mis_pedidos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mis_pedidos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mis_pedidos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mis_permisos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mis_permisos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mis_permisos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mis_sedes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mis_sedes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mis_sedes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mis_turnos_landing"("p_codigo" "text", "p_llave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mis_turnos_landing"("p_codigo" "text", "p_llave" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mis_turnos_landing"("p_codigo" "text", "p_llave" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mis_turnos_landing"("p_codigo" "text", "p_llave" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."nombre_de_clave"("p_rubro" "text", "p_clave" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."nombre_de_clave"("p_rubro" "text", "p_clave" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."nombre_de_clave"("p_rubro" "text", "p_clave" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalizar_identificador"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalizar_identificador"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalizar_identificador"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."paso_aprobado_no_se_borra"() TO "anon";
GRANT ALL ON FUNCTION "public"."paso_aprobado_no_se_borra"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."paso_aprobado_no_se_borra"() TO "service_role";



GRANT ALL ON FUNCTION "public"."paso_aprobado_no_se_modifica"() TO "anon";
GRANT ALL ON FUNCTION "public"."paso_aprobado_no_se_modifica"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."paso_aprobado_no_se_modifica"() TO "service_role";



GRANT ALL ON FUNCTION "public"."paso_cambio_permitido"() TO "anon";
GRANT ALL ON FUNCTION "public"."paso_cambio_permitido"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."paso_cambio_permitido"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pedidos_de_ingreso"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pedidos_de_ingreso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pedidos_de_ingreso"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pedir_entrar"("p_codigo" "text", "p_nombre" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pedir_entrar"("p_codigo" "text", "p_nombre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pedir_entrar"("p_codigo" "text", "p_nombre" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."permisos_conocidos"() TO "anon";
GRANT ALL ON FUNCTION "public"."permisos_conocidos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."permisos_conocidos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."permisos_de_clave"("p_clave" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."permisos_de_clave"("p_clave" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."permisos_de_clave"("p_clave" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."permisos_de_mirar"() TO "anon";
GRANT ALL ON FUNCTION "public"."permisos_de_mirar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."permisos_de_mirar"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."permisos_del_rol"("p_rol" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."permisos_del_rol"("p_rol" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."permisos_efectivos"("p_negocio" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."permisos_efectivos"("p_negocio" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."permisos_efectivos"("p_negocio" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."por_que_no_se_reserva"("n" "public"."negocio", "p_cuando" timestamp with time zone, "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."por_que_no_se_reserva"("n" "public"."negocio", "p_cuando" timestamp with time zone, "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."preparar_cobro_publico"("p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preparar_cobro_publico"("p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."preparar_cobro_publico"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."preparar_cobro_publico"("p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."puede_aca"("p_permiso" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."puede_aca"("p_permiso" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."puede_aca"("p_permiso" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."puede_en"("p_negocio" "uuid", "p_permiso" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."puede_en"("p_negocio" "uuid", "p_permiso" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."puede_en"("p_negocio" "uuid", "p_permiso" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."puedo_cargar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."puedo_cargar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."puedo_cargar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."quitar_acceso_al_sacar"() TO "anon";
GRANT ALL ON FUNCTION "public"."quitar_acceso_al_sacar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."quitar_acceso_al_sacar"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rango_del_rol"("p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rango_del_rol"("p_rol" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rango_del_rol"("p_rol" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rechazar_solicitud"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rechazar_solicitud"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rechazar_solicitud"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."red_fija"() TO "anon";
GRANT ALL ON FUNCTION "public"."red_fija"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."red_fija"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_cobro"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_cobro"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_cobro"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_cobro_api"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_autor" "text", "p_detalle" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_cobro_api"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_autor" "text", "p_detalle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_cobro_api"("p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_nota" "text", "p_autor" "text", "p_detalle" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_cobro_en_linea_api"("p_id" "uuid", "p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_proveedor_id" "text", "p_link" "text", "p_qr_imagen" "text", "p_vence_en" timestamp with time zone, "p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_cobro_en_linea_api"("p_id" "uuid", "p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_proveedor_id" "text", "p_link" "text", "p_qr_imagen" "text", "p_vence_en" timestamp with time zone, "p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_cobro_en_linea_api"("p_id" "uuid", "p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_proveedor_id" "text", "p_link" "text", "p_qr_imagen" "text", "p_vence_en" timestamp with time zone, "p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_cobro_en_linea_api"("p_id" "uuid", "p_caso_id" "uuid", "p_monto" numeric, "p_medio" "text", "p_proveedor_id" "text", "p_link" "text", "p_qr_imagen" "text", "p_vence_en" timestamp with time zone, "p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reservar_turno"("p_codigo" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reservar_turno"("p_codigo" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reservar_turno"("p_codigo" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reservar_turno"("p_codigo" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reservar_turno_landing"("p_codigo" "text", "p_llave" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text", "p_identificador" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reservar_turno_landing"("p_codigo" "text", "p_llave" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text", "p_identificador" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reservar_turno_landing"("p_codigo" "text", "p_llave" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text", "p_identificador" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reservar_turno_landing"("p_codigo" "text", "p_llave" "text", "p_cuando" timestamp with time zone, "p_motivo" "text", "p_nombre" "text", "p_telefono" "text", "p_identificador" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."responder_paso_desde_el_link"("p_codigo" "text", "p_paso_id" "uuid", "p_respuesta" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."responder_paso_desde_el_link"("p_codigo" "text", "p_paso_id" "uuid", "p_respuesta" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."responder_paso_desde_el_link"("p_codigo" "text", "p_paso_id" "uuid", "p_respuesta" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."responder_paso_desde_el_link"("p_codigo" "text", "p_paso_id" "uuid", "p_respuesta" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revertir_baja_de_avisos"("p_cliente_id" "uuid", "p_autor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revertir_baja_de_avisos"("p_cliente_id" "uuid", "p_autor" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revertir_baja_de_avisos"("p_cliente_id" "uuid", "p_autor" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rol_de_clave"("p_negocio" "uuid", "p_clave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rol_de_clave"("p_negocio" "uuid", "p_clave" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rol_de_la_ficha_da_permisos"() TO "anon";
GRANT ALL ON FUNCTION "public"."rol_de_la_ficha_da_permisos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rol_de_la_ficha_da_permisos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rol_duenio_fijo"() TO "anon";
GRANT ALL ON FUNCTION "public"."rol_duenio_fijo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rol_duenio_fijo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rol_id_de_la_clave"() TO "anon";
GRANT ALL ON FUNCTION "public"."rol_id_de_la_clave"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rol_id_de_la_clave"() TO "service_role";



GRANT ALL ON FUNCTION "public"."roles_base"("p_rubro" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."roles_base"("p_rubro" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."roles_base"("p_rubro" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."roles_del_negocio"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."roles_del_negocio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."roles_del_negocio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rubro_fijo_con_casos"() TO "anon";
GRANT ALL ON FUNCTION "public"."rubro_fijo_con_casos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rubro_fijo_con_casos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sedes_que_veo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sedes_que_veo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sedes_que_veo"() TO "service_role";



GRANT ALL ON TABLE "public"."landing_sesion" TO "service_role";



REVOKE ALL ON FUNCTION "public"."sesion_de_la_llave"("p_negocio" "uuid", "p_llave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sesion_de_la_llave"("p_negocio" "uuid", "p_llave" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."soy_duenio_aca"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soy_duenio_aca"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."soy_duenio_aca"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tengo_contrasena"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tengo_contrasena"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tengo_contrasena"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tocar_actualizado_en"() TO "anon";
GRANT ALL ON FUNCTION "public"."tocar_actualizado_en"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tocar_actualizado_en"() TO "service_role";



GRANT ALL ON FUNCTION "public"."turno_respuesta_solo_del_cliente"() TO "anon";
GRANT ALL ON FUNCTION "public"."turno_respuesta_solo_del_cliente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."turno_respuesta_solo_del_cliente"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ultimos_cuatro"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ultimos_cuatro"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ultimos_cuatro"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ver_agenda_ics"("p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ver_agenda_ics"("p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ver_agenda_ics"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ver_agenda_ics"("p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ver_agenda_landing"("p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ver_agenda_landing"("p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ver_agenda_landing"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ver_agenda_landing"("p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ver_agenda_publica"("p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ver_agenda_publica"("p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ver_agenda_publica"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ver_agenda_publica"("p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ver_invitacion"("p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ver_invitacion"("p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ver_invitacion"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ver_invitacion"("p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ver_landing"("p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ver_landing"("p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ver_landing"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ver_landing"("p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ver_seguimiento"("p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ver_seguimiento"("p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ver_seguimiento"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ver_seguimiento"("p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vincular_sede"("p_otro" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vincular_sede"("p_otro" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vincular_sede"("p_otro" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."MP_oauth_state" TO "service_role";



GRANT ALL ON TABLE "public"."caso" TO "anon";
GRANT ALL ON TABLE "public"."caso" TO "authenticated";
GRANT ALL ON TABLE "public"."caso" TO "service_role";



GRANT ALL ON TABLE "public"."categorias_del_negocio" TO "anon";
GRANT ALL ON TABLE "public"."categorias_del_negocio" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_del_negocio" TO "service_role";



GRANT ALL ON TABLE "public"."cliente" TO "anon";
GRANT ALL ON TABLE "public"."cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."cliente" TO "service_role";



GRANT ALL ON TABLE "public"."cliente_evento" TO "authenticated";
GRANT ALL ON TABLE "public"."cliente_evento" TO "service_role";



GRANT ALL ON TABLE "public"."cobro" TO "anon";
GRANT ALL ON TABLE "public"."cobro" TO "authenticated";
GRANT ALL ON TABLE "public"."cobro" TO "service_role";



GRANT ALL ON TABLE "public"."ecuacion" TO "anon";
GRANT ALL ON TABLE "public"."ecuacion" TO "authenticated";
GRANT ALL ON TABLE "public"."ecuacion" TO "service_role";



GRANT ALL ON TABLE "public"."ecuacion_dependencia" TO "anon";
GRANT ALL ON TABLE "public"."ecuacion_dependencia" TO "authenticated";
GRANT ALL ON TABLE "public"."ecuacion_dependencia" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."empleado" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."empleado" TO "authenticated";
GRANT ALL ON TABLE "public"."empleado" TO "service_role";



GRANT UPDATE("nombre") ON TABLE "public"."empleado" TO "authenticated";



GRANT ALL ON TABLE "public"."evento" TO "anon";
GRANT ALL ON TABLE "public"."evento" TO "authenticated";
GRANT ALL ON TABLE "public"."evento" TO "service_role";



GRANT ALL ON TABLE "public"."google_calendar_conexion" TO "service_role";



GRANT ALL ON TABLE "public"."google_calendar_evento" TO "service_role";



GRANT ALL ON TABLE "public"."insumo" TO "anon";
GRANT ALL ON TABLE "public"."insumo" TO "authenticated";
GRANT ALL ON TABLE "public"."insumo" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."invitacion" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."invitacion" TO "authenticated";
GRANT ALL ON TABLE "public"."invitacion" TO "service_role";



GRANT ALL ON TABLE "public"."landing_intento" TO "service_role";



GRANT ALL ON TABLE "public"."negocio_conexionMP" TO "service_role";



GRANT ALL ON SEQUENCE "public"."negocio_conexionMP_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."negocio_conexionMP_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."negocio_conexionMP_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."negocio_seguimiento" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."negocio_seguimiento" TO "authenticated";



GRANT ALL ON TABLE "public"."paso" TO "anon";
GRANT ALL ON TABLE "public"."paso" TO "authenticated";
GRANT ALL ON TABLE "public"."paso" TO "service_role";



GRANT ALL ON TABLE "public"."pedido_idempotente" TO "authenticated";
GRANT ALL ON TABLE "public"."pedido_idempotente" TO "service_role";



GRANT ALL ON TABLE "public"."suscripcion" TO "anon";
GRANT ALL ON TABLE "public"."suscripcion" TO "authenticated";
GRANT ALL ON TABLE "public"."suscripcion" TO "service_role";



GRANT ALL ON SEQUENCE "public"."plan_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."plan_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."plan_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prueba_gratis" TO "anon";
GRANT ALL ON TABLE "public"."prueba_gratis" TO "authenticated";
GRANT ALL ON TABLE "public"."prueba_gratis" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."rol" TO "authenticated";
GRANT ALL ON TABLE "public"."rol" TO "service_role";



GRANT ALL ON TABLE "public"."seguimiento_whatsapp" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."seguimiento_whatsapp" TO "authenticated";



GRANT UPDATE("enviar_en") ON TABLE "public"."seguimiento_whatsapp" TO "authenticated";



GRANT UPDATE("estado") ON TABLE "public"."seguimiento_whatsapp" TO "authenticated";



GRANT UPDATE("procesado_en") ON TABLE "public"."seguimiento_whatsapp" TO "authenticated";



GRANT ALL ON TABLE "public"."seguimiento_whatsapp_respuesta" TO "service_role";
GRANT SELECT ON TABLE "public"."seguimiento_whatsapp_respuesta" TO "authenticated";



GRANT ALL ON TABLE "public"."solicitud_de_ingreso" TO "service_role";



GRANT ALL ON TABLE "public"."suscripcion_precio" TO "anon";
GRANT ALL ON TABLE "public"."suscripcion_precio" TO "authenticated";
GRANT ALL ON TABLE "public"."suscripcion_precio" TO "service_role";



GRANT ALL ON SEQUENCE "public"."suscripcion_precio_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."suscripcion_precio_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."suscripcion_precio_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."turno" TO "anon";
GRANT ALL ON TABLE "public"."turno" TO "authenticated";
GRANT ALL ON TABLE "public"."turno" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."usuario" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."usuario" TO "authenticated";
GRANT ALL ON TABLE "public"."usuario" TO "service_role";



GRANT INSERT("id") ON TABLE "public"."usuario" TO "authenticated";



GRANT INSERT("email") ON TABLE "public"."usuario" TO "authenticated";



GRANT INSERT("telefono") ON TABLE "public"."usuario" TO "authenticated";



GRANT INSERT("nombre") ON TABLE "public"."usuario" TO "authenticated";



GRANT ALL ON TABLE "public"."usuario_suscripcion" TO "anon";
GRANT ALL ON TABLE "public"."usuario_suscripcion" TO "authenticated";
GRANT ALL ON TABLE "public"."usuario_suscripcion" TO "service_role";



GRANT ALL ON SEQUENCE "public"."usuario_suscripcion_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."usuario_suscripcion_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."usuario_suscripcion_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







