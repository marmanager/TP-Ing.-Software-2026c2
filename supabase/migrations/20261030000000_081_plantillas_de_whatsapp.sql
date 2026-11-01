-- ============================================================
-- 081_plantillas_de_whatsapp.sql — los avisos automáticos como plantillas
-- de Meta (API-4)
--
-- Correr entero en el SQL Editor de Supabase, después de la 080. Es
-- idempotente. Los textos están en docs/plantillas-textos.md y el plan en
-- docs/respuestas-y-plantillas-plan.md (API-4).
--
-- Fuera de las 24 h desde el último mensaje del cliente, WhatsApp sólo deja
-- mandar plantillas aprobadas: texto fijo con variables. La API ya las tiene
-- en código, apagadas hasta que Meta las apruebe (WHATSAPP_PLANTILLAS en la
-- API). Esta migración deja lo que necesita la base, y no cambia nada
-- mientras estén apagadas.
--
-- QUÉ CAMBIA:
--   negocio_seguimiento.version   qué versión del texto elige el negocio para
--       cada aviso (taller, salud, general). null: la de su rubro.
--   caso.seguimiento_revocado_en  cuándo se dejó de compartir el link. Para
--       distinguir «revocado» de «nunca compartido»: al primero un aviso no
--       le vuelve a abrir el link; al segundo se le genera al mandarlo.
--       dejar_de_compartir_caso() la llena y compartir_caso() la borra.
--   codigo_para_aviso()           el código del botón de un aviso: el que
--       tiene el caso, uno nuevo si nunca se compartió, o null si se revocó.
--       Sólo para el procesador (clave de servicio).
--   seguimiento_whatsapp.plantilla  con qué plantilla salió cada aviso. null:
--       salió como texto libre. El webhook la mira para saber si el
--       recordatorio tenía botones.
--   reservar_retomar()            como reservar_mensaje_manual() de la 080,
--       pero para «Retomar la conversación»: no pide la ventana abierta (para
--       eso es) y no sale a quien pidió la BAJA.
--   terminar_mensaje_manual()     también termina los de retomar.
--   version_del_esquema()         081: caso y negocio_seguimiento, que van en
--       las copias, tienen columnas nuevas.
--   seguimiento_presupuesto_programar  el aviso del presupuesto se puede
--       programar en un caso que nunca se compartió (con la plantilla, el
--       link se genera al mandar); en uno revocado, no.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La versión de cada aviso
-- ------------------------------------------------------------
alter table negocio_seguimiento add column if not exists version text;

alter table negocio_seguimiento drop constraint if exists negocio_seguimiento_version_check;
alter table negocio_seguimiento add constraint negocio_seguimiento_version_check
  check (version is null or version in ('taller', 'salud', 'general'));

comment on column negocio_seguimiento.version is
  'Qué versión de la plantilla de WhatsApp usa este aviso (081): taller, salud o general. null: la del rubro del negocio.';

-- ------------------------------------------------------------
-- 2. Revocado no es lo mismo que nunca compartido
-- ------------------------------------------------------------
alter table caso add column if not exists seguimiento_revocado_en timestamptz;

comment on column caso.seguimiento_revocado_en is
  'Cuándo se dejó de compartir el link de seguimiento (081). Un aviso no genera uno nuevo si está revocado. compartir_caso() la borra.';

-- Igual que la de la base, y además borra la marca de revocado.
create or replace function compartir_caso(p_caso_id uuid) returns text
  language plpgsql security definer set search_path to 'public' as $$
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

  loop
    actual := replace(gen_random_uuid()::text, '-', '');
    exit when not exists (select 1 from caso where seguimiento_codigo = actual);
  end loop;

  update caso set seguimiento_codigo = actual, seguimiento_visto_en = null, seguimiento_revocado_en = null
  where id = p_caso_id;

  return actual;
end;
$$;

-- Igual que la de la base, y además anota cuándo.
create or replace function dejar_de_compartir_caso(p_caso_id uuid) returns void
  language plpgsql security definer set search_path to 'public' as $$
begin
  if not puede_aca('avanzar_casos') then
    raise exception 'Dejar de compartir lo hacen el dueño y el encargado.';
  end if;

  update caso
  set seguimiento_codigo = null, seguimiento_visto_en = null, seguimiento_revocado_en = now()
  where id = p_caso_id and negocio_id = mi_negocio();

  if not found then
    raise exception 'Ese caso no es de tu negocio.';
  end if;
end;
$$;

-- El código para el botón de un aviso. Lo llama el procesador, con la clave
-- de servicio: no hay persona detrás, así que no pasa por puede_aca().
create or replace function codigo_para_aviso(p_caso_id uuid) returns text
  language plpgsql security definer set search_path to 'public' as $$
declare
  actual text;
  revocado timestamptz;
begin
  select seguimiento_codigo, seguimiento_revocado_en into actual, revocado
  from caso where id = p_caso_id
  for update;

  if not found or actual is not null then
    return actual;
  end if;
  -- Si el negocio lo dejó de compartir a propósito, un aviso no se lo abre.
  if revocado is not null then
    return null;
  end if;

  loop
    actual := replace(gen_random_uuid()::text, '-', '');
    exit when not exists (select 1 from caso where seguimiento_codigo = actual);
  end loop;
  update caso set seguimiento_codigo = actual, seguimiento_visto_en = null where id = p_caso_id;
  return actual;
end;
$$;

revoke all on function codigo_para_aviso(uuid) from public, anon, authenticated;
grant execute on function codigo_para_aviso(uuid) to service_role;

-- ------------------------------------------------------------
-- 3. Con qué plantilla salió cada aviso
-- ------------------------------------------------------------
alter table seguimiento_whatsapp add column if not exists plantilla text;

alter table seguimiento_whatsapp drop constraint if exists seguimiento_whatsapp_plantilla_check;
alter table seguimiento_whatsapp add constraint seguimiento_whatsapp_plantilla_check
  check (plantilla is null or (plantilla ~ '^[a-z0-9_]+$' and length(plantilla) <= 512));

comment on column seguimiento_whatsapp.plantilla is
  'El nombre de la plantilla de Meta con la que salió (081). null: salió como texto libre.';

-- ------------------------------------------------------------
-- 4. Retomar la conversación
-- ------------------------------------------------------------
-- Errores (P0001, con el código en el hint, como la 080):
--   cliente_no_encontrado   no es un cliente de este negocio
--   cliente_de_baja         pidió no recibir más avisos: no recibe plantillas
--   sin_telefono            nunca escribió y no tiene un teléfono que sirva
-- El destino es el de su último mensaje; si nunca escribió, su teléfono,
-- desde p_emisor (el número de la plataforma, que pasa la API).
create or replace function reservar_retomar(p_cliente uuid, p_mensaje text, p_emisor text)
  returns table (id uuid, telefono text, numero_emisor_id text)
  language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
declare
  v_cliente record;
  v_telefono text;
  v_emisor text;
  v_id uuid;
begin
  if not puede_aca('entregar_y_reabrir') then
    raise exception 'Este rol no permite contestar por WhatsApp.' using errcode = '42501';
  end if;
  select c.telefono, c.avisos_baja_en into v_cliente
    from cliente c where c.id = p_cliente and c.negocio_id = mi_negocio();
  if not found then
    raise exception 'Ese cliente ya no está.' using errcode = 'P0001', hint = 'cliente_no_encontrado';
  end if;
  if v_cliente.avisos_baja_en is not null then
    raise exception 'Pidió no recibir más avisos.' using errcode = 'P0001', hint = 'cliente_de_baja';
  end if;

  select r.telefono, r.numero_emisor_id into v_telefono, v_emisor
    from seguimiento_whatsapp_respuesta r
   where r.negocio_id = mi_negocio() and r.cliente_id = p_cliente and r.telefono is not null
   order by r.enviado_en desc, r.id desc
   limit 1;
  if not found then
    v_telefono := regexp_replace(coalesce(v_cliente.telefono, ''), '\D', '', 'g');
    v_emisor := p_emisor;
  end if;
  if v_telefono !~ '^[1-9][0-9]{7,14}$' or coalesce(trim(v_emisor), '') = '' then
    raise exception 'No tiene un teléfono de WhatsApp.' using errcode = 'P0001', hint = 'sin_telefono';
  end if;

  insert into seguimiento_whatsapp (negocio_id, cliente_id, tipo, estado, canal, telefono, numero_emisor_id,
                                    mensaje, plantilla, enviar_en, procesado_en)
  values (mi_negocio(), p_cliente, 'retomar', 'enviando', 'whatsapp', v_telefono, v_emisor,
          p_mensaje, 'retomar_conversacion', now(), now())
  returning seguimiento_whatsapp.id into v_id;

  return query select v_id, v_telefono, v_emisor;
end;
$$;

revoke all on function reservar_retomar(uuid, text, text) from public, anon;
grant execute on function reservar_retomar(uuid, text, text) to authenticated;

-- Igual que en la 080, y también para los de retomar.
create or replace function terminar_mensaje_manual(p_id uuid, p_mensaje_id text, p_error text)
  returns timestamptz
  language plpgsql security definer set search_path to 'public' as $$
declare
  v_cliente uuid;
  v_en timestamptz;
begin
  if not puede_aca('entregar_y_reabrir') then
    raise exception 'Este rol no permite contestar por WhatsApp.' using errcode = '42501';
  end if;

  update seguimiento_whatsapp s
     set estado = case when p_mensaje_id is not null then 'enviado' else 'fallido' end,
         mensaje_id = p_mensaje_id,
         error = case when p_mensaje_id is not null then null else coalesce(p_error, 'No se pudo mandar.') end,
         procesado_en = now()
   where s.id = p_id and s.negocio_id = mi_negocio() and s.tipo in ('manual', 'retomar') and s.estado = 'enviando'
  returning s.cliente_id, s.procesado_en into v_cliente, v_en;

  -- Si le escribieron, lo que había escrito ya se vio.
  if v_en is not null and p_mensaje_id is not null and v_cliente is not null then
    perform marcar_respuestas_vistas(v_cliente, null);
  end if;
  return v_en;
end;
$$;

-- ------------------------------------------------------------
-- 5. Las copias: caso y negocio_seguimiento cambiaron de columnas
-- ------------------------------------------------------------
create or replace function version_del_esquema() returns text
  language sql immutable set search_path to 'public' as $$ select '081'::text; $$;

-- ------------------------------------------------------------
-- 6. El aviso del presupuesto: «revocado, no sale» en vez de «sin link»
-- ------------------------------------------------------------
-- Con la plantilla, el link va en el botón y se genera al mandar si nunca se
-- compartió. La API sigue pidiendo el link cuando el aviso sale en texto
-- libre; la base sólo frena lo que el negocio revocó. El resto, como en la 057.
drop policy if exists seguimiento_presupuesto_programar on seguimiento_whatsapp;
create policy seguimiento_presupuesto_programar on seguimiento_whatsapp
  for insert to authenticated
  with check (
    tipo = 'presupuesto' and negocio_id = mi_negocio()
    and (select puede_aca('entregar_y_reabrir'))
    and estado = 'pendiente' and mensaje_id is null and error is null and motivo is null and procesado_en is null
    and exists (select 1 from caso c
                 where c.id = seguimiento_whatsapp.caso_id and c.negocio_id = seguimiento_whatsapp.negocio_id
                   and c.estado <> 'completado'
                   and (c.seguimiento_codigo is not null or c.seguimiento_revocado_en is null))
  );
