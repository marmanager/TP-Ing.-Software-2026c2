-- ============================================================
-- 018_seguimiento.sql — el cliente mira su caso sin cuenta (SCRUM-68)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..017.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- QUÉ RESUELVE:
-- El problema que dio origen al proyecto: el teléfono que no para de sonar.
-- Hoy el cliente llama para preguntar "¿cómo va mi auto?" y alguien tiene
-- que cortar lo que está haciendo para averiguarlo. Con esto el negocio le
-- manda un link por WhatsApp y el cliente mira solo.
--
-- CÓMO:
-- Un link por caso, con un código secreto adentro. Quien tiene el código ve
-- ese caso y nada más. No hay cuenta, no hay sesión y no hay registro.
--
-- EL PROBLEMA DE PERMISOS Y CÓMO SE RESUELVE:
-- Es el mismo de 007_invitaciones.sql y se resuelve igual. Quien abre el
-- link NO pertenece al negocio: mi_negocio() le da NULL y ninguna política
-- lo deja leer nada. Por eso mirar el caso pasa por una función
-- "security definer", que es la única puerta, y el código es la llave.
--
-- LO QUE NO SE HIZO, A PROPÓSITO:
-- No hay una política de RLS que le abra la tabla "caso" al rol anónimo. Una
-- política así tendría que decir "dejá leer la fila cuyo código coincide", y
-- con eso el anónimo pasaría a tener permiso de SELECT sobre la tabla: las
-- columnas internas viajarían igual y bastaría un error de filtro para
-- exponer de más. La función devuelve un objeto armado a mano, con los
-- campos elegidos uno por uno. Lo que no está en ese jsonb no sale de acá.
--
-- POR QUÉ DOS COLUMNAS EN "caso" Y NO UNA TABLA:
-- Un link por caso no justifica una tabla aparte. El día que quieran varios
-- links por caso, o historial de quién lo abrió, ahí sí hace falta.
-- ============================================================

-- ------------------------------------------------------------
-- El código de seguimiento y la última visita
-- ------------------------------------------------------------
-- Nulo quiere decir "no se está compartiendo". Dejar de compartir es volver
-- a nulo, y con eso el link anterior deja de existir en el mismo instante.
alter table caso add column if not exists seguimiento_codigo   text;
alter table caso add column if not exists seguimiento_visto_en timestamptz;

-- Único, para que dos casos no puedan compartir código ni por accidente.
-- En Postgres un índice único deja pasar todos los nulos que haga falta, así
-- que los casos que no se comparten no se estorban entre sí.
create unique index if not exists caso_seguimiento_codigo_idx
  on caso (seguimiento_codigo);

-- ------------------------------------------------------------
-- A qué estado pasó el caso en cada evento
-- ------------------------------------------------------------
-- El historial ya guardaba el momento del cambio, pero no a qué estado se
-- pasó: eso vivía sólo en el título, escrito para adentro del negocio ("Se
-- destrabó lo que estaba esperando"). La línea de tiempo que ve el cliente
-- necesita el estado, no la frase, porque las palabras las pone el preset de
-- su rubro y el título del negocio no es para él.
--
-- Nulo en los eventos que no son de estado, y también en los viejos: a un
-- caso de antes de esta migración la línea de tiempo le va a faltar alguna
-- fecha, y eso es preferible a inventarla.
alter table evento add column if not exists estado text;

alter table evento drop constraint if exists evento_estado_check;
alter table evento add constraint evento_estado_check
  check (estado is null or estado in
    ('nuevo', 'en_proceso', 'esperando', 'revision_final', 'completado'));

-- ------------------------------------------------------------
-- Empezar a compartir un caso
-- ------------------------------------------------------------
-- Devuelve el código. Si el caso ya tiene uno, devuelve ese mismo: tocar
-- "Compartir" dos veces no puede dejar sin efecto el link que el negocio ya
-- mandó por WhatsApp.
--
-- El código lo genera la base y no el navegador: son 16 bytes al azar del
-- generador criptográfico de Postgres, 32 caracteres. No sale del id del
-- caso ni de su número, así que no se puede adivinar ni recorrer probando
-- valores cercanos.
create or replace function compartir_caso(p_caso_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actual text;
begin
  if not puedo_cargar() then
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
    actual := encode(gen_random_bytes(16), 'hex');
    exit when not exists (select 1 from caso where seguimiento_codigo = actual);
  end loop;

  update caso set seguimiento_codigo = actual, seguimiento_visto_en = null
  where id = p_caso_id;

  return actual;
end;
$$;

revoke all on function compartir_caso(uuid) from public;
revoke all on function compartir_caso(uuid) from anon;
grant execute on function compartir_caso(uuid) to authenticated;

-- ------------------------------------------------------------
-- Dejar de compartirlo
-- ------------------------------------------------------------
-- El link anterior deja de funcionar acá mismo. La fecha de la última visita
-- también se borra: es de ese link, no del caso, y dejarla puesta haría
-- parecer que alguien abrió el link nuevo.
create or replace function dejar_de_compartir_caso(p_caso_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not puedo_cargar() then
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

revoke all on function dejar_de_compartir_caso(uuid) from public;
revoke all on function dejar_de_compartir_caso(uuid) from anon;
grant execute on function dejar_de_compartir_caso(uuid) to authenticated;

-- ------------------------------------------------------------
-- Lo que ve el cliente
-- ------------------------------------------------------------
-- La única puerta. Recibe el código y devuelve un objeto armado campo por
-- campo: nada de "select *". Lo que no está escrito acá abajo no llega al
-- navegador del cliente, ni siquiera escondido en el HTML.
--
-- Queda afuera a propósito: el diagnóstico (es texto escrito entre
-- mecánicos), los pasos rechazados o sin decidir y sus montos, las notas
-- internas, quién lo está atendiendo, cualquier dato de inventario, y el
-- teléfono y el mail del propio cliente —no le hacen falta y achican el daño
-- si el link se filtra—.
--
-- Cuando el código no sirve devuelve lo mismo si nunca existió, si lo
-- revocaron o si el caso se borró: un "no" no puede ser la confirmación de
-- que ese código alguna vez fue bueno.
--
-- No es "stable" porque escribe: deja registrada la visita, que es lo que
-- después le muestra al negocio si el cliente abrió el link alguna vez.
create or replace function ver_seguimiento(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c   caso%rowtype;
  n   negocio%rowtype;
  cli cliente%rowtype;
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

  return jsonb_build_object(
    'sirve', true,
    'negocio_nombre', n.nombre,
    'rubro', n.rubro,
    -- Sólo el nombre de pila: alcanza para que reconozca que el link es el
    -- suyo y es lo menos que se puede mostrar.
    'cliente_nombre', nullif(split_part(coalesce(cli.nombre, ''), ' ', 1), ''),
    'numero', c.numero,
    'identificador', c.identificador,
    'servicio', c.servicio,
    'estado', c.estado,
    -- Sólo cuando está frenado. En los otros estados "qué falta" es una
    -- instrucción para adentro del negocio ("Asignar a alguien del equipo"),
    -- no una respuesta a "¿por qué tarda?".
    'que_falta', case when c.estado = 'esperando' then c.que_falta else null end,
    'abierto_en', c.abierto_en,
    'actualizado_en', c.actualizado_en,
    'pasos', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', p.nombre, 'monto', p.monto)
                       order by p.orden, p.creado_en)
      from paso p
      where p.caso_id = c.id and p.estado = 'aprobado'
    ), '[]'::jsonb),
    'linea', coalesce((
      select jsonb_agg(jsonb_build_object('estado', e.estado, 'ocurrido_en', e.ocurrido_en)
                       order by e.ocurrido_en)
      from evento e
      where e.caso_id = c.id and e.estado is not null
    ), '[]'::jsonb)
  );
end;
$$;

-- A propósito también para "anon": quien abre el link no tiene cuenta, y
-- pedirle una sería volver al teléfono. Lo único que se expone es este
-- objeto, y sólo a quien ya tiene el código.
revoke all on function ver_seguimiento(text) from public;
grant execute on function ver_seguimiento(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Nada más
-- ------------------------------------------------------------
-- Sin políticas nuevas. "caso" sigue siendo invisible para el rol anónimo:
-- con el código no se puede leer otro caso, ni listar casos, ni tocar
-- ninguna otra tabla del negocio. La única puerta es ver_seguimiento().
