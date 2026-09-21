-- ============================================================
-- 021_paso_hecho.sql — un paso aprobado dice si ya se hizo
--
-- Correr entero en el SQL Editor de Supabase, después de 001..020.
-- Es idempotente.
--
-- QUÉ RESUELVE:
-- Hasta acá un paso podía estar esperando, aprobado o rechazado. Eso dice
-- qué contestó el cliente, no si el trabajo se hizo. Un caso con tres pasos
-- aprobados no tenía forma de mostrar que dos ya están listos y falta uno, y
-- sin eso el ciclo del caso no cierra: nadie sabe cuándo corresponde pasar a
-- control final, y el cliente no ve el avance de lo que pagó.
--
-- POR QUÉ UNA FECHA Y NO UN SEGUNDO ESTADO:
-- "hecho_en" nulo es pendiente, con fecha es hecho. Un segundo estado
-- obligaría a mantener dos máquinas de estados sobre la misma fila y a
-- decidir qué pasa con las combinaciones imposibles (rechazado y hecho).
-- Con la fecha, además, salen gratis dos reglas que pedía la historia:
-- marcar dos veces no cambia la fecha original, y desmarcar es volver a nulo.
--
-- LA RESPUESTA DEL CLIENTE NO SE TOCA:
-- "estado" sigue diciendo qué contestó él y "hecho_en" qué hizo el negocio.
-- Son dos cosas distintas y por eso son dos columnas. El trigger de 015 no
-- se entromete: mira estado, nombre, descripción, monto, caso_id y
-- aprobado_en, y hecho_en no está en esa lista a propósito.
--
-- EL PERMISO, QUE ES LA PARTE FINA:
-- La historia es del mecánico —"quiero marcar que terminé un paso"— pero
-- 008_permisos.sql no lo deja tocar la tabla "paso": mover plata es del
-- dueño y del encargado. Las dos cosas son correctas, así que la puerta es
-- chica: una función que escribe SOLAMENTE hecho_en, y para el técnico
-- solamente sobre un caso que tiene asignado. No puede cambiar montos, ni
-- aprobar, ni sacar un paso. Sigue sin poder tocar la tabla directamente.
-- ============================================================

-- ------------------------------------------------------------
-- Cuándo se hizo
-- ------------------------------------------------------------
alter table paso add column if not exists hecho_en timestamptz;

-- Sólo lo aprobado se hace. Un paso que el cliente todavía no contestó, o
-- que rechazó, no es trabajo: es una propuesta.
alter table paso drop constraint if exists paso_hecho_solo_si_aprobado;
alter table paso add constraint paso_hecho_solo_si_aprobado
  check (hecho_en is null or estado = 'aprobado');

-- ------------------------------------------------------------
-- Marcar y desmarcar
-- ------------------------------------------------------------
-- Devuelve { ok: true, hecho_en } o { ok: false, motivo }. Los motivos están
-- escritos para leerse en pantalla.
--
-- Marcar algo ya marcado no hace nada y no falla: devuelve la fecha que ya
-- tenía. Dos dedos sobre el mismo botón no pueden generar dos eventos ni
-- mover la hora en que se terminó el trabajo.
create or replace function marcar_paso_hecho(p_paso_id uuid, p_hecho boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  if not puedo_cargar() and c.responsable_id is distinct from mi_empleado() then
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

revoke all on function marcar_paso_hecho(uuid, boolean) from public;
revoke all on function marcar_paso_hecho(uuid, boolean) from anon;
grant execute on function marcar_paso_hecho(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- El cliente ve el avance de lo que pagó
-- ------------------------------------------------------------
-- Misma función de siempre —nació en 018, creció en 019 y 020— con un dato
-- más por cada paso aprobado: si ya se hizo. Sigue siendo UNA sola puerta y
-- sigue armando el objeto campo por campo.
--
-- Se manda "hecho" como booleano y no la fecha: al cliente le sirve saber
-- que está hecho, y la hora exacta en que el mecánico tocó el botón es un
-- dato de adentro del taller.
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
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function ver_seguimiento(text) from public;
grant execute on function ver_seguimiento(text) to anon, authenticated;
