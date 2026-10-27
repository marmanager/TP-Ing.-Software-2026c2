-- ============================================================
-- 058_politicas_por_permiso.sql — las políticas preguntan por un permiso
--
-- Correr entero en el SQL Editor de Supabase, después de la 057.
-- Es idempotente. Después, correr supabase/pruebas/roles.sql.
--
-- Cada política y cada función que miraba mi_rol() o puedo_cargar() pasa a
-- preguntar por un permiso con nombre (docs/roles.md, "Chequeo de permisos").
-- Con los roles del pasaje (057) nadie gana ni pierde nada. La única
-- diferencia: la base frena al técnico que cambia columnas de su caso, que
-- hasta acá frenaba sólo la API.
--
-- "Miembro" (mi_empleado() is not null) es lo mismo que "está en el negocio"
-- mientras sin ficha no se pueda entrar. Desde la 061 deja afuera a quien
-- entra de visita a una sede vinculada.
--
-- CUIDADO AL EDITAR: si una política deja afuera al Dueño, el negocio queda
-- sin nadie que pueda arreglarlo desde la aplicación.
-- ============================================================

-- ------------------------------------------------------------
-- negocio
-- ------------------------------------------------------------
drop policy if exists negocio_edita_el_suyo on negocio;
create policy negocio_edita_el_suyo on negocio
  for update to authenticated
  using (id = mi_negocio() and (select puede_aca('configurar_negocio')))
  with check (id = mi_negocio() and (select puede_aca('configurar_negocio')));

-- ------------------------------------------------------------
-- empleado — ver sigue siendo de todo el negocio
-- ------------------------------------------------------------
drop policy if exists empleado_lo_maneja_el_duenio on empleado;

drop policy if exists empleado_lo_suma_quien_puede on empleado;
create policy empleado_lo_suma_quien_puede on empleado
  for insert to authenticated
  with check (negocio_id = mi_negocio() and (select puede_aca('sumar_al_equipo')));

drop policy if exists empleado_lo_cambia_quien_puede on empleado;
create policy empleado_lo_cambia_quien_puede on empleado
  for update to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('manejar_roles')))
  with check (negocio_id = mi_negocio() and (select puede_aca('manejar_roles')));

drop policy if exists empleado_lo_saca_quien_puede on empleado;
create policy empleado_lo_saca_quien_puede on empleado
  for delete to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('sacar_del_equipo')));

-- ------------------------------------------------------------
-- invitacion
-- ------------------------------------------------------------
drop policy if exists invitacion_ve_las_suyas on invitacion;
create policy invitacion_ve_las_suyas on invitacion
  for select to authenticated
  using (negocio_id = mi_negocio() and mi_empleado() is not null);

drop policy if exists invitacion_crea_el_duenio on invitacion;
create policy invitacion_crea_el_duenio on invitacion
  for insert to authenticated
  with check (negocio_id = mi_negocio() and (select puede_aca('sumar_al_equipo')));

drop policy if exists invitacion_anula_el_duenio on invitacion;
create policy invitacion_anula_el_duenio on invitacion
  for update to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('sumar_al_equipo')))
  with check (negocio_id = mi_negocio() and (select puede_aca('sumar_al_equipo')));

-- ------------------------------------------------------------
-- caso — sin ver_todos_los_casos, sólo los asignados
-- ------------------------------------------------------------
drop policy if exists caso_de_mi_negocio on caso;

drop policy if exists caso_lo_ve_quien_puede on caso;
create policy caso_lo_ve_quien_puede on caso
  for select to authenticated
  using (
    negocio_id = mi_negocio()
    and ((select puede_aca('ver_todos_los_casos')) or responsable_id = mi_empleado())
  );

drop policy if exists caso_lo_abre_quien_puede on caso;
create policy caso_lo_abre_quien_puede on caso
  for insert to authenticated
  with check (negocio_id = mi_negocio() and (select puede_aca('crear_casos')));

-- Qué columnas puede cambiar cada uno lo decide el trigger de abajo. El
-- with check deja pasar el caso que se le asigna a otro: quien asigna deja
-- de verlo si no tiene ver_todos_los_casos, y eso está bien.
drop policy if exists caso_lo_cambia_quien_puede on caso;
create policy caso_lo_cambia_quien_puede on caso
  for update to authenticated
  using (
    negocio_id = mi_negocio()
    and ((select puede_aca('ver_todos_los_casos')) or responsable_id = mi_empleado())
  )
  with check (negocio_id = mi_negocio());

drop policy if exists caso_lo_borra_quien_puede on caso;
create policy caso_lo_borra_quien_puede on caso
  for delete to authenticated
  using (
    negocio_id = mi_negocio()
    and (select puede_aca('crear_casos'))
    and ((select puede_aca('ver_todos_los_casos')) or responsable_id = mi_empleado())
  );

-- Las columnas de un caso, por permiso. No es security definer a propósito
-- (como red_fija, 047): adentro de una función security definer current_user
-- es el dueño de las tablas y pasa; con sesión es "authenticated" y se mira.
--
-- Entregar o reabrir (pasar a o desde 'completado') pide entregar_y_reabrir y
-- puede tocar cualquier columna: entregar_caso (048) escribe descuento,
-- cobrado, volver_en... junto con el estado. Cambiar el responsable pide
-- asignar_casos, y el estado que viaja con él (la API reasigna y pasa a
-- 'esperando' de una) no pide más. Un cambio de estado solo pide
-- avanzar_casos, igual que cualquier otra columna (nombre, servicio,
-- diagnóstico, que_falta, …); que_falta viaja libre sólo si cambia con el
-- estado o con el responsable. El descuento solo también lo cambia quien arma
-- el presupuesto (armar_presupuesto, como la API). actualizado_en lo mueve un
-- trigger que corre antes (001).
create or replace function caso_cambio_permitido()
returns trigger
language plpgsql
set search_path = public
as $$
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

drop trigger if exists caso_cambio_permitido on caso;
create trigger caso_cambio_permitido
  before update on caso
  for each row
  execute function caso_cambio_permitido();

-- ------------------------------------------------------------
-- paso — armar el presupuesto y responder por el cliente son dos permisos
-- ------------------------------------------------------------
drop policy if exists paso_lo_mueve_quien_puede on paso;
create policy paso_lo_mueve_quien_puede on paso
  for all to authenticated
  using (
    ((select puede_aca('armar_presupuesto')) or (select puede_aca('aprobar_por_el_cliente')))
    and exists (select 1 from caso c where c.id = paso.caso_id and c.negocio_id = mi_negocio())
  )
  with check (
    ((select puede_aca('armar_presupuesto')) or (select puede_aca('aprobar_por_el_cliente')))
    and exists (select 1 from caso c where c.id = paso.caso_id and c.negocio_id = mi_negocio())
  );

-- Responder es cambiar estado (y aprobado_en, que pone la API al aprobar;
-- actualizado_en lo mueve un trigger que corre antes, 042).
-- Todo lo demás —crear, borrar, cambiar nombre o monto— es armar.
create or replace function paso_cambio_permitido()
returns trigger
language plpgsql
set search_path = public
as $$
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

drop trigger if exists paso_cambio_permitido on paso;
create trigger paso_cambio_permitido
  before insert or update or delete on paso
  for each row
  execute function paso_cambio_permitido();

-- ------------------------------------------------------------
-- cliente, insumo, turno
-- ------------------------------------------------------------
drop policy if exists cliente_lo_ve_el_negocio on cliente;
create policy cliente_lo_ve_el_negocio on cliente
  for select to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('ver_clientes')));

drop policy if exists cliente_lo_carga_quien_puede on cliente;
create policy cliente_lo_carga_quien_puede on cliente
  for all to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('editar_clientes')))
  with check (negocio_id = mi_negocio() and (select puede_aca('editar_clientes')));

drop policy if exists insumo_lo_ve_el_negocio on insumo;
create policy insumo_lo_ve_el_negocio on insumo
  for select to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('ver_inventario')));

drop policy if exists insumo_lo_carga_quien_puede on insumo;
create policy insumo_lo_carga_quien_puede on insumo
  for all to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('editar_inventario')))
  with check (negocio_id = mi_negocio() and (select puede_aca('editar_inventario')));

drop policy if exists turno_lo_ve_el_negocio on turno;
create policy turno_lo_ve_el_negocio on turno
  for select to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('ver_agenda')));

drop policy if exists turno_lo_carga_quien_puede on turno;
create policy turno_lo_carga_quien_puede on turno
  for all to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('manejar_turnos')))
  with check (negocio_id = mi_negocio() and (select puede_aca('manejar_turnos')));

-- ------------------------------------------------------------
-- ecuacion y ecuacion_dependencia — son parte del presupuesto
-- ------------------------------------------------------------
drop policy if exists ecuacion_lo_ve_el_negocio on ecuacion;
create policy ecuacion_lo_ve_el_negocio on ecuacion
  for select to authenticated
  using (negocio_id = mi_negocio() and mi_empleado() is not null);

drop policy if exists ecuacion_la_carga_quien_puede on ecuacion;
create policy ecuacion_la_carga_quien_puede on ecuacion
  for insert to authenticated
  with check (negocio_id = mi_negocio() and (select puede_aca('armar_presupuesto')));

drop policy if exists ecuacion_la_edita_quien_puede on ecuacion;
create policy ecuacion_la_edita_quien_puede on ecuacion
  for update to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('armar_presupuesto')))
  with check (negocio_id = mi_negocio() and (select puede_aca('armar_presupuesto')));

drop policy if exists ecuacion_la_borra_quien_puede on ecuacion;
create policy ecuacion_la_borra_quien_puede on ecuacion
  for delete to authenticated
  using (negocio_id = mi_negocio() and (select puede_aca('armar_presupuesto')));

drop policy if exists ecuacion_dependencia_la_carga_quien_puede on ecuacion_dependencia;
create policy ecuacion_dependencia_la_carga_quien_puede on ecuacion_dependencia
  for insert to authenticated
  with check (
    (select puede_aca('armar_presupuesto'))
    and exists (select 1 from ecuacion e where e.id = ecuacion_id and e.negocio_id = mi_negocio())
    and exists (select 1 from ecuacion d where d.id = dependencia_id and d.negocio_id = mi_negocio())
  );

drop policy if exists ecuacion_dependencia_la_borra_quien_puede on ecuacion_dependencia;
create policy ecuacion_dependencia_la_borra_quien_puede on ecuacion_dependencia
  for delete to authenticated
  using (
    (select puede_aca('armar_presupuesto'))
    and exists (select 1 from ecuacion e where e.id = ecuacion_id and e.negocio_id = mi_negocio())
  );

-- ------------------------------------------------------------
-- seguimiento_whatsapp — el recordatorio de turno (050)
-- ------------------------------------------------------------
drop policy if exists seguimiento_turno_programar on seguimiento_whatsapp;
create policy seguimiento_turno_programar on seguimiento_whatsapp
  for insert to authenticated
  with check (
    tipo = 'turno' and negocio_id = mi_negocio() and (select puede_aca('manejar_turnos'))
    and estado = 'pendiente' and mensaje_id is null and error is null and procesado_en is null
    and exists (select 1 from turno t
                 where t.id = seguimiento_whatsapp.turno_id
                   and t.negocio_id = seguimiento_whatsapp.negocio_id
                   and t.estado in ('agendado', 'confirmado'))
  );

drop policy if exists seguimiento_turno_cambiar on seguimiento_whatsapp;
create policy seguimiento_turno_cambiar on seguimiento_whatsapp
  for update to authenticated
  using (tipo = 'turno' and negocio_id = mi_negocio() and (select puede_aca('manejar_turnos')) and estado = 'pendiente')
  with check (
    tipo = 'turno' and negocio_id = mi_negocio() and (select puede_aca('manejar_turnos'))
    and estado in ('pendiente', 'cancelado') and mensaje_id is null
    and exists (select 1 from turno t
                 where t.id = seguimiento_whatsapp.turno_id
                   and t.negocio_id = seguimiento_whatsapp.negocio_id)
  );

-- ------------------------------------------------------------
-- cobro — se sigue viendo en todo el negocio, pero sólo los miembros
-- ------------------------------------------------------------
drop policy if exists cobro_de_mi_negocio on cobro;
create policy cobro_de_mi_negocio on cobro
  for select
  using (negocio_id = mi_negocio() and mi_empleado() is not null);

-- ------------------------------------------------------------
-- Las funciones security definer que decidían con el rol
-- ------------------------------------------------------------
-- Cada una es la última definición tal cual (archivo y líneas al lado), con
-- una sola línea cambiada. Misma firma: los grants se conservan.

-- 018_seguimiento.sql:80-121, con avanzar_casos
create or replace function compartir_caso(p_caso_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
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

-- 018_seguimiento.sql:133-152, con avanzar_casos
create or replace function dejar_de_compartir_caso(p_caso_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

-- 021_paso_hecho.sql:56-109, con avanzar_casos y ver_todos_los_casos
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

-- 024_pedir_turno.sql:48-78, con configurar_negocio
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

-- 024_pedir_turno.sql:85-101, con configurar_negocio
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
  if not puede_aca('configurar_negocio') then
    raise exception 'Dejar de compartir la agenda lo hace el dueño del negocio.';
  end if;

  update negocio set agenda_codigo = null where id = mi_negocio();
end;
$$;

-- 025_cobros.sql:177-218, con cobrar
create or replace function registrar_cobro(
  p_caso_id uuid,
  p_monto   numeric,
  p_medio   text,
  p_nota    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

-- 025_cobros.sql:233-269, con cobrar
create or replace function anular_cobro(p_cobro_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

-- 027_agenda_ics.sql:55-87, con configurar_negocio
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

-- 027_agenda_ics.sql:98-114, con configurar_negocio
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
  if not puede_aca('configurar_negocio') then
    raise exception 'Sacar la agenda del calendario lo hace el dueño del negocio.';
  end if;

  update negocio set ics_codigo = null where id = mi_negocio();
end;
$$;

-- 040_entregar_caso_api.sql:43-59, con armar_presupuesto
create or replace function cambiar_descuento_api(
  p_caso_id uuid, p_monto numeric, p_autor text, p_titulo text, p_detalle text
)
returns jsonb language plpgsql security invoker set search_path = public as $$
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

-- 041_cobro_en_linea_atomico.sql:57-137, con cobrar
create or replace function registrar_cobro_en_linea_api(
  p_id uuid,
  p_caso_id uuid,
  p_monto numeric,
  p_medio text,
  p_proveedor_id text,
  p_link text,
  p_qr_imagen text,
  p_vence_en timestamptz,
  p_codigo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

-- 043_mercadopago_rls.sql:5-10, con cobrar o conectar_mercadopago
create or replace function mercadopago_estado()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not (puede_aca('cobrar') or puede_aca('conectar_mercadopago')) then raise exception 'Sin permiso.'; end if;
  return exists (select 1 from "negocio_conexionMP" where negocio_id = mi_negocio());
end; $$;

-- 043_mercadopago_rls.sql:12-18, con conectar_mercadopago
create or replace function mercadopago_crear_estado(p_state text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede_aca('conectar_mercadopago') then raise exception 'Sin permiso.'; end if;
  delete from "MP_oauth_state" where negocio_id = mi_negocio() or created_at < now() - interval '10 minutes';
  insert into "MP_oauth_state" (state, negocio_id) values (p_state, mi_negocio());
end; $$;

-- 043_mercadopago_rls.sql:20-25, con conectar_mercadopago
create or replace function mercadopago_desvincular()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede_aca('conectar_mercadopago') then raise exception 'Sin permiso.'; end if;
  delete from "negocio_conexionMP" where negocio_id = mi_negocio();
end; $$;

-- 048_volver_en.sql:36-110, con entregar_y_reabrir
create or replace function entregar_caso(
  p_caso_id uuid,
  p_monto numeric default null,
  p_medio text default null,
  p_nota text default null,
  p_descuento numeric default 0,
  p_detalle text default 'El caso queda cerrado.',
  p_autor text default 'El equipo',
  p_ocurrido_en timestamptz default now(),
  p_volver_en date default null,
  p_toca_volver_en boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
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

-- 053_landing_ingreso.sql:134-164, con configurar_negocio (la landing es
-- configuración del negocio, como el link de la agenda)
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

-- 053_landing_ingreso.sql:172-189, con configurar_negocio
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
  if not puede_aca('configurar_negocio') then
    raise exception 'Dejar de compartir la landing lo hace el dueño del negocio.';
  end if;

  update negocio set landing_codigo = null where id = mi_negocio();
  delete from landing_sesion where negocio_id = mi_negocio();
end;
$$;

-- 054_baja_de_avisos.sql:110-145, con editar_clientes (deshacer la baja
-- cambia la ficha del cliente: avisos_baja_en)
create or replace function revertir_baja_de_avisos(p_cliente_id uuid, p_autor text default 'Alguien del negocio')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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


-- ------------------------------------------------------------
-- seguimiento_whatsapp — el aviso de volver (056), con entregar_y_reabrir
-- ------------------------------------------------------------
-- 056_aviso_de_volver.sql:92-118. El aviso cuelga de un caso entregado y
-- es de los mensajes de WhatsApp: el mismo permiso que el posventa.
drop policy if exists seguimiento_volver_programar on seguimiento_whatsapp;
create policy seguimiento_volver_programar on seguimiento_whatsapp
  for insert to authenticated
  with check (
    tipo = 'volver' and negocio_id = mi_negocio() and (select puede_aca('entregar_y_reabrir'))
    and estado = 'pendiente' and mensaje_id is null and error is null and motivo is null and procesado_en is null
    and exists (select 1 from caso c
                where c.id = seguimiento_whatsapp.caso_id and c.negocio_id = seguimiento_whatsapp.negocio_id
                  and c.estado = 'completado' and c.volver_en is not null)
  );

-- Reprogramar (sigue pendiente) y cancelar. Sólo lo pendiente: lo que el
-- procesador tomó o mandó no se toca. El procesador escribe con la clave
-- de servicio y no pasa por acá.
drop policy if exists seguimiento_volver_cambiar on seguimiento_whatsapp;
create policy seguimiento_volver_cambiar on seguimiento_whatsapp
  for update to authenticated
  using (tipo = 'volver' and negocio_id = mi_negocio() and (select puede_aca('entregar_y_reabrir')) and estado = 'pendiente')
  with check (
    tipo = 'volver' and negocio_id = mi_negocio() and (select puede_aca('entregar_y_reabrir'))
    and estado in ('pendiente', 'cancelado') and mensaje_id is null and error is null
    and exists (select 1 from caso c
                where c.id = seguimiento_whatsapp.caso_id and c.negocio_id = seguimiento_whatsapp.negocio_id)
  );


-- ------------------------------------------------------------
-- Las políticas creadas desde el panel (050, sección 2)
-- ------------------------------------------------------------
-- negocio_seguimiento, la cola de cierre de seguimiento_whatsapp y sus
-- respuestas (seguimiento_whatsapp_respuesta, las del webhook de Kapso) se crearon
-- desde el panel de Supabase, sin migración: sus políticas no tienen nombre
-- conocido y usan puedo_cargar(). Se reescriben donde estén, con el permiso
-- de los mensajes de WhatsApp (entregar_y_reabrir). Si después de esto queda
-- alguna política en public que use mi_rol() o puedo_cargar(), la migración
-- frena y la nombra: la 063 borra esas funciones.
do $$
declare
  p record;
  nueva text := '(select puede_aca(''entregar_y_reabrir''))';
  sentencia text;
begin
  for p in
    select tablename, policyname, qual, with_check from pg_policies
     where schemaname = 'public'
       and tablename in ('negocio_seguimiento', 'seguimiento_whatsapp', 'seguimiento_whatsapp_respuesta')
       and (qual ~ '\mpuedo_cargar\(\)' or with_check ~ '\mpuedo_cargar\(\)')
  loop
    sentencia := format('alter policy %I on %I', p.policyname, p.tablename);
    if p.qual is not null then
      sentencia := sentencia || format(' using (%s)', regexp_replace(p.qual, '\mpuedo_cargar\(\)', nueva, 'g'));
    end if;
    if p.with_check is not null then
      sentencia := sentencia || format(' with check (%s)', regexp_replace(p.with_check, '\mpuedo_cargar\(\)', nueva, 'g'));
    end if;
    execute sentencia;
  end loop;

  for p in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and (qual ~ '\m(mi_rol|puedo_cargar)\(\)' or with_check ~ '\m(mi_rol|puedo_cargar)\(\)')
     order by tablename, policyname
  loop
    raise exception 'La política % de la tabla % todavía usa el rol viejo (mi_rol() o puedo_cargar()). Hay que reescribirla con puede_aca() antes de seguir.',
      p.policyname, p.tablename;
  end loop;
end;
$$;
