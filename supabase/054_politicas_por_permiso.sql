-- ============================================================
-- 054_politicas_por_permiso.sql — las políticas preguntan por un permiso
--
-- Correr entero en el SQL Editor de Supabase, después de la 053.
-- Es idempotente. Después, correr supabase/pruebas/roles.sql.
--
-- Cada política y cada función que miraba mi_rol() o puedo_cargar() pasa a
-- preguntar por un permiso con nombre (docs/roles.md, "Chequeo de permisos").
-- Con los roles del pasaje (053) nadie gana ni pierde nada. La única
-- diferencia: la base frena al técnico que cambia columnas de su caso, que
-- hasta acá frenaba sólo la API.
--
-- "Miembro" (mi_empleado() is not null) es lo mismo que "está en el negocio"
-- mientras sin ficha no se pueda entrar. Desde la 057 deja afuera a quien
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
-- estado. actualizado_en lo mueve un trigger que corre antes (001).
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
  if new.estado is distinct from old.estado then
    v_nuevo := v_nuevo - 'que_falta';
    v_viejo := v_viejo - 'que_falta';
  end if;
  if v_nuevo is distinct from v_viejo and not puede_aca('avanzar_casos') then
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
