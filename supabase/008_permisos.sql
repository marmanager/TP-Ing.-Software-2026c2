-- ============================================================
-- 008_permisos.sql — qué puede hacer cada rol (SCRUM-18)
--
-- Correr entero en el SQL Editor de Supabase, después de 001..007.
-- Es idempotente.
--
-- El 007 no se puede saltear: acá se usa mi_rol() en casi todas las
-- políticas, y esa función —y la columna usuario.rol de la que lee— nacen
-- ahí. Correr este archivo antes del 007 falla.
--
-- Hasta acá cualquiera que estuviera en el negocio podía hacer todo. Este
-- archivo reemplaza esas políticas por otras que miran el rol.
--
--   DUEÑO      todo, incluido configurar el negocio y manejar el equipo.
--   ENCARGADO  todo el trabajo diario: casos, presupuestos, clientes,
--              inventario y agenda. No configura ni suma gente.
--   TÉCNICO    ve y trabaja SÓLO los casos que tiene asignados. Ve los
--              clientes, el inventario y la agenda, pero no los cambia.
--
-- SOBRE LOS MONTOS: las políticas filtran filas, no columnas, así que no se
-- puede esconder `paso.monto` a un rol. El técnico ve los pasos —los
-- necesita para saber qué trabajo hacer— pero no puede crearlos, aprobarlos
-- ni rechazarlos, que es donde se mueve la plata.
--
-- CUIDADO AL EDITAR: si una política deja afuera al dueño, el negocio queda
-- sin nadie que pueda arreglarlo desde la aplicación.
-- ============================================================

-- ------------------------------------------------------------
-- Cuál es la ficha de empleado de quien entró
-- ------------------------------------------------------------
-- Se necesita para saber qué casos son "los suyos". Da NULL si la cuenta no
-- tiene ficha, y entonces no ve ningún caso: falla cerrado.
create or replace function mi_empleado()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from empleado where usuario_id = auth.uid() limit 1;
$$;

revoke all on function mi_empleado() from public;
revoke all on function mi_empleado() from anon;
grant execute on function mi_empleado() to authenticated;

-- Atajo para "manda en el negocio": dueño o encargado.
create or replace function puedo_cargar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(mi_rol() in ('duenio', 'encargado'), false);
$$;

revoke all on function puedo_cargar() from public;
revoke all on function puedo_cargar() from anon;
grant execute on function puedo_cargar() to authenticated;

-- ------------------------------------------------------------
-- negocio — lo configura sólo el dueño
-- ------------------------------------------------------------
drop policy if exists negocio_edita_el_suyo on negocio;
create policy negocio_edita_el_suyo on negocio
  for update to authenticated
  using (id = mi_negocio() and mi_rol() = 'duenio')
  with check (id = mi_negocio() and mi_rol() = 'duenio');

-- ------------------------------------------------------------
-- empleado — lo ve todo el negocio, lo maneja el dueño
-- ------------------------------------------------------------
drop policy if exists empleado_de_mi_negocio on empleado;

drop policy if exists empleado_lo_ve_el_negocio on empleado;
create policy empleado_lo_ve_el_negocio on empleado
  for select to authenticated
  using (negocio_id = mi_negocio());

drop policy if exists empleado_lo_maneja_el_duenio on empleado;
create policy empleado_lo_maneja_el_duenio on empleado
  for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'duenio')
  with check (negocio_id = mi_negocio() and mi_rol() = 'duenio');

-- ------------------------------------------------------------
-- caso — el técnico ve y toca sólo los suyos
-- ------------------------------------------------------------
-- Un caso sin responsable tampoco lo ve el técnico: todavía no es su
-- trabajo. Aparece en cuanto se lo asignan.
drop policy if exists caso_de_mi_negocio on caso;
create policy caso_de_mi_negocio on caso
  for all to authenticated
  using (
    negocio_id = mi_negocio()
    and (mi_rol() <> 'tecnico' or responsable_id = mi_empleado())
  )
  with check (
    negocio_id = mi_negocio()
    and (mi_rol() <> 'tecnico' or responsable_id = mi_empleado())
  );

-- ------------------------------------------------------------
-- paso — la plata la mueven el dueño y el encargado
-- ------------------------------------------------------------
-- El técnico los ve, porque son la lista de lo que hay que hacer, pero no
-- los crea ni los aprueba.
drop policy if exists paso_de_mi_negocio on paso;

drop policy if exists paso_lo_ve_quien_ve_el_caso on paso;
create policy paso_lo_ve_quien_ve_el_caso on paso
  for select to authenticated
  using (exists (select 1 from caso c where c.id = paso.caso_id));

drop policy if exists paso_lo_mueve_quien_puede on paso;
create policy paso_lo_mueve_quien_puede on paso
  for all to authenticated
  using (
    puedo_cargar()
    and exists (select 1 from caso c where c.id = paso.caso_id and c.negocio_id = mi_negocio())
  )
  with check (
    puedo_cargar()
    and exists (select 1 from caso c where c.id = paso.caso_id and c.negocio_id = mi_negocio())
  );

-- ------------------------------------------------------------
-- evento — el historial lo escribe cualquiera del negocio
-- ------------------------------------------------------------
-- Un técnico que mueve un caso tiene que poder dejar constancia. Sigue
-- viendo sólo el historial de los casos que ve, porque la subconsulta pasa
-- por las políticas de `caso`.
drop policy if exists evento_de_mi_negocio on evento;
create policy evento_de_mi_negocio on evento
  for all to authenticated
  using (exists (select 1 from caso c where c.id = evento.caso_id))
  with check (exists (select 1 from caso c where c.id = evento.caso_id));

-- ------------------------------------------------------------
-- cliente, insumo y turno — todos los ven, los cargan dueño y encargado
-- ------------------------------------------------------------

-- ---------- cliente ----------
drop policy if exists cliente_de_mi_negocio on cliente;

drop policy if exists cliente_lo_ve_el_negocio on cliente;
create policy cliente_lo_ve_el_negocio on cliente
  for select to authenticated
  using (negocio_id = mi_negocio());

drop policy if exists cliente_lo_carga_quien_puede on cliente;
create policy cliente_lo_carga_quien_puede on cliente
  for all to authenticated
  using (negocio_id = mi_negocio() and puedo_cargar())
  with check (negocio_id = mi_negocio() and puedo_cargar());

-- ---------- insumo ----------
drop policy if exists insumo_de_mi_negocio on insumo;

drop policy if exists insumo_lo_ve_el_negocio on insumo;
create policy insumo_lo_ve_el_negocio on insumo
  for select to authenticated
  using (negocio_id = mi_negocio());

drop policy if exists insumo_lo_carga_quien_puede on insumo;
create policy insumo_lo_carga_quien_puede on insumo
  for all to authenticated
  using (negocio_id = mi_negocio() and puedo_cargar())
  with check (negocio_id = mi_negocio() and puedo_cargar());

-- ---------- turno ----------
drop policy if exists turno_de_mi_negocio on turno;

drop policy if exists turno_lo_ve_el_negocio on turno;
create policy turno_lo_ve_el_negocio on turno
  for select to authenticated
  using (negocio_id = mi_negocio());

drop policy if exists turno_lo_carga_quien_puede on turno;
create policy turno_lo_carga_quien_puede on turno
  for all to authenticated
  using (negocio_id = mi_negocio() and puedo_cargar())
  with check (negocio_id = mi_negocio() and puedo_cargar());
