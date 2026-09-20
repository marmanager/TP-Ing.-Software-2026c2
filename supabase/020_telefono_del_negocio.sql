-- ============================================================
-- 020_telefono_del_negocio.sql — con qué número lo encuentra el cliente
--
-- Correr entero en el SQL Editor de Supabase, después de 001..019.
-- Es idempotente.
--
-- QUÉ RESUELVE:
-- 019 dejó al cliente aprobando plata desde el link. Lo que faltaba era la
-- salida para el que no está seguro: hoy, si duda, el único camino es
-- cerrar la pantalla y buscar el número del taller en algún lado. Eso es
-- volver al teléfono que no para de sonar, pero peor, porque ahora además
-- hay una decisión con plata esperando.
--
-- El negocio tenía nombre, rubro, descripción y foto, pero no teléfono. El
-- que había era el de cada cliente y el de cada cuenta, que son otra cosa:
-- el número de una persona no es el número del negocio.
--
-- POR QUÉ ES SEGURO MOSTRARLO:
-- Es el número que el negocio le da a sus clientes; el que está en el
-- cartel. Quien abre el link ya es cliente de ese negocio. Y lo carga el
-- negocio a mano: si lo deja vacío, no se muestra nada.
-- ============================================================

alter table negocio add column if not exists telefono text;

-- ------------------------------------------------------------
-- Lo que ve el cliente, ahora con el teléfono del negocio
-- ------------------------------------------------------------
-- Misma función de 018, ampliada en 019 y otra vez acá. Sigue siendo UNA
-- sola puerta y sigue armando el objeto campo por campo.
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
    -- Nulo si el negocio no lo cargó. La pantalla no inventa un botón de
    -- contacto que no lleva a ningún lado.
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
      select jsonb_agg(jsonb_build_object('nombre', p.nombre, 'monto', p.monto)
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
