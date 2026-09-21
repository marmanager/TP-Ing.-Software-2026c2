-- ============================================================
-- 027_agenda_ics.sql — la agenda en el calendario del dueño (SCRUM-20, fase 2)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..024.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- POR QUÉ 027 Y NO 025. Los números 025 y 026 están tomados por la rama
-- sprint-2/cobros (025_cobros.sql y 026_pago_en_el_seguimiento.sql). Cuando
-- esa rama entre, los tres números conviven sin pisarse.
--
-- QUÉ RESUELVE:
-- El dueño quiere ver sus turnos en el calendario que ya tiene en el celular,
-- sin abrir el sistema. Con esto se suscribe una vez a una dirección y los
-- turnos le aparecen solos.
--
-- CÓMO:
-- Una dirección con un código secreto adentro devuelve un archivo iCalendar.
-- Google Calendar, el de Apple y Outlook se suscriben los tres a una dirección
-- así, de fábrica. No hace falta OAuth, ni credenciales guardadas, ni que
-- ningún servidor nuestro le hable a Google.
--
-- POR QUÉ UN CÓDIGO PROPIO Y NO "agenda_codigo":
-- Son dos links con dos audiencias opuestas. "agenda_codigo" (024) es el que
-- el negocio reparte por Instagram: muestra sólo qué horarios están ocupados,
-- sin ningún nombre, justamente porque lo va a ver cualquiera. Éste es para el
-- dueño y muestra nombre, motivo y teléfono de cada turno. Con un solo código,
-- cualquiera que pidiera turno podría leer la agenda entera, y dar de baja uno
-- daría de baja el otro. Son dos columnas y dos interruptores.
--
-- LO QUE ESTE LINK EXPONE, DICHO EN CRIOLLO:
-- quien lo tenga ve todos los turnos del negocio con el nombre, el motivo y el
-- teléfono del cliente. No ve casos, ni presupuestos, ni plata, ni inventario,
-- ni nada de otro negocio. La pantalla que lo entrega lo dice con esas mismas
-- palabras, y cortarlo es un botón.
-- ============================================================

-- ------------------------------------------------------------
-- El código del calendario
-- ------------------------------------------------------------
-- Nulo quiere decir "no se está compartiendo". Volver a nulo mata el link en
-- el mismo instante.
alter table negocio add column if not exists ics_codigo text;

create unique index if not exists negocio_ics_codigo_idx
  on negocio (ics_codigo);

-- ------------------------------------------------------------
-- Empezar a compartir
-- ------------------------------------------------------------
-- Devuelve el código. Si ya hay uno, devuelve ese mismo: tocar dos veces no
-- puede dejar muerta la suscripción que la persona ya cargó en el celular.
--
-- Lo hace el dueño, igual que compartir la agenda (024). Un empleado no
-- reparte un link que muestra todos los teléfonos de los clientes.
create or replace function compartir_ics()
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
    raise exception 'Poner la agenda en el calendario lo hace el dueño del negocio.';
  end if;

  -- "for update" bloquea la fila: dos pestañas tocando el botón a la vez no
  -- pueden generar dos códigos y dejar uno de los dos links muerto al nacer.
  select ics_codigo into actual from negocio where id = yo for update;
  if actual is not null then
    return actual;
  end if;

  loop
    actual := encode(gen_random_bytes(16), 'hex');
    exit when not exists (select 1 from negocio where ics_codigo = actual);
  end loop;

  update negocio set ics_codigo = actual where id = yo;
  return actual;
end;
$$;

revoke all on function compartir_ics() from public;
revoke all on function compartir_ics() from anon;
grant execute on function compartir_ics() to authenticated;

-- ------------------------------------------------------------
-- Dejar de compartir
-- ------------------------------------------------------------
-- El link deja de servir acá mismo. El calendario que ya lo tenía cargado
-- deja de traer turnos la próxima vez que lea.
create or replace function dejar_de_compartir_ics()
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
    raise exception 'Sacar la agenda del calendario lo hace el dueño del negocio.';
  end if;

  update negocio set ics_codigo = null where id = mi_negocio();
end;
$$;

revoke all on function dejar_de_compartir_ics() from public;
revoke all on function dejar_de_compartir_ics() from anon;
grant execute on function dejar_de_compartir_ics() to authenticated;

-- ------------------------------------------------------------
-- Lo que se publica
-- ------------------------------------------------------------
-- La única puerta, igual que ver_seguimiento() en la 018: devuelve un objeto
-- armado campo por campo, nada de "select *". Lo que no está escrito acá abajo
-- no sale de la base.
--
-- Queda afuera a propósito: todo lo del caso (diagnóstico, pasos, montos,
-- notas), todo lo del inventario, el mail del cliente y cualquier dato de otro
-- negocio. Va el teléfono porque el sentido de esto es que el dueño, mirando
-- el celular, pueda llamar al que no llegó sin entrar al sistema.
--
-- POR QUÉ UNA VENTANA DE TIEMPO. Un calendario no necesita los turnos de hace
-- dos años y publicarlos agranda el archivo y el daño si el link se filtra.
-- Treinta días para atrás alcanza para mirar la semana pasada.
--
-- Se declara "stable": no escribe nada. Al revés que ver_seguimiento(), que
-- anota la visita, acá no hay a quién anotarle: es una máquina releyendo.
create or replace function ver_agenda_ics(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

-- Para "anon": quien lee esto es el servidor de calendario de Google o de
-- Apple, que no tiene ninguna cuenta nuestra y nunca la va a tener. Lo único
-- que se expone es este objeto, y sólo a quien ya tiene el código.
revoke all on function ver_agenda_ics(text) from public;
grant execute on function ver_agenda_ics(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Nada más
-- ------------------------------------------------------------
-- Sin políticas nuevas. "turno" y "cliente" siguen siendo invisibles para el
-- rol anónimo: con el código no se puede leer otra tabla ni salirse de este
-- negocio. La función security definer es la única puerta y el código es la
-- llave, el mismo patrón que las invitaciones (007) y el seguimiento (018).
