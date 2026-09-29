-- ============================================================
-- 038_multinegocio.sql — varios negocios por cuenta
--
-- Correr entero en el SQL Editor de Supabase, después de 001..037.
-- Es idempotente. Después, correr supabase/pruebas/multinegocio.sql.
--
-- El diseño está en docs/multinegocio.md. En corto:
--
--   - usuario.negocio_id y usuario.rol pasan a ser "dónde estoy ahora y con
--     qué rol". mi_negocio(), mi_rol() y las políticas no cambian.
--   - La ficha de empleado es la membresía: los negocios de una cuenta son las
--     fichas con su usuario_id, cada una con su rol.
--   - Cambiar de negocio es entrar_al_negocio(), que verifica y copia.
--   - El dueño pasa a tener ficha, y aparece en Equipo como uno más.
--
-- ORDEN: primero el pasaje de lo que ya existe —así ninguna cuenta queda sin
-- ficha—, después las funciones.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Preferencias de entrada, y el pasaje de las cuentas que ya existen
-- ------------------------------------------------------------
-- Como el resto de usuario desde la 035, no se escriben desde el navegador:
-- sólo por guardar_preferencias_de_entrada().
--
-- A quien ya tiene un negocio no le cambia nada: su negocio queda como
-- predeterminado y con Inicio rápido, así sigue entrando directo como hoy.
--
-- El pasaje va adentro del "if": corre sólo la vez que se agregan las
-- columnas. Si corriera siempre, volver a correr la migración le prendería de
-- nuevo el Inicio rápido a quien lo apagó.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'usuario'
       and column_name = 'inicio_rapido'
  ) then
    alter table usuario
      add column if not exists negocio_predeterminado uuid references negocio (id) on delete set null;
    alter table usuario
      add column if not exists inicio_rapido boolean not null default false;

    update usuario
       set negocio_predeterminado = negocio_id,
           inicio_rapido = true
     where negocio_id is not null;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. El dueño tiene ficha
-- ------------------------------------------------------------
-- Hasta acá sólo tenía ficha quien entraba por invitación. Cada cuenta con
-- negocio que no tiene ficha ahí —los dueños— recibe la suya, con el rol que
-- ya tenía: nadie gana ni pierde acceso. Con el nombre de la cuenta, o la
-- parte del mail antes del arroba, como aceptar_invitacion().
insert into empleado (negocio_id, nombre, rol, usuario_id)
select u.negocio_id,
       coalesce(nullif(trim(u.nombre), ''), split_part(coalesce(u.email, 'Alguien'), '@', 1)),
       u.rol,
       u.id
  from usuario u
 where u.negocio_id is not null
   and not exists (
     select 1 from empleado e
      where e.usuario_id = u.id
        and e.negocio_id = u.negocio_id
   );

-- Una ficha por cuenta y negocio: es la membresía. Si esto falla, hay una
-- cuenta con dos fichas en el mismo negocio. Para verlas:
--
--   select usuario_id, negocio_id, count(*) from empleado
--    where usuario_id is not null group by 1, 2 having count(*) > 1;
create unique index if not exists empleado_una_ficha_por_cuenta
  on empleado (usuario_id, negocio_id)
  where usuario_id is not null;

-- ------------------------------------------------------------
-- 3. "Mi ficha" es la de este negocio
-- ------------------------------------------------------------
-- mi_empleado() (008) buscaba la ficha de la cuenta sin mirar el negocio: con
-- una sola daba lo mismo. Con varias podía devolver la de otro negocio, y un
-- técnico dejaba de ver sus casos (008), de marcar pasos (021) y de firmar
-- cobros (025). Ahora, la del negocio en el que está.
create or replace function mi_empleado()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from empleado
   where usuario_id = auth.uid()
     and negocio_id = mi_negocio()
   limit 1;
$$;

-- Lo mismo con las fotos (034): leían usuario.negocio_id, y un compañero
-- parado en otra sucursal perdía la foto. Ahora, las de quienes tienen ficha
-- en este negocio.
create or replace function fotos_del_equipo()
returns table (usuario_id uuid, foto text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.foto
    from empleado e
    join usuario u on u.id = e.usuario_id
   where e.negocio_id = mi_negocio()
     and u.foto is not null;
$$;

-- ------------------------------------------------------------
-- 4. Los negocios de la cuenta, y entrar a uno
-- ------------------------------------------------------------
-- Hace falta una función: las políticas de empleado y de negocio sólo dejan
-- ver el negocio activo, y no se abren.
create or replace function mis_negocios()
returns table (id uuid, nombre text, rubro text, foto text, rol text)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.nombre, n.rubro, n.foto, e.rol
    from empleado e
    join negocio n on n.id = e.negocio_id
   where e.usuario_id = auth.uid()
   order by n.nombre;
$$;

revoke all on function mis_negocios() from public;
revoke all on function mis_negocios() from anon;
grant execute on function mis_negocios() to authenticated;

-- Copia a la cuenta el negocio y el rol de su ficha ahí. Sin ficha, nada: es
-- lo que impide meterse en un negocio ajeno.
create or replace function entrar_al_negocio(p_negocio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
     set negocio_id = p_negocio,
         rol        = su_rol
   where id = auth.uid();
end;
$$;

revoke all on function entrar_al_negocio(uuid) from public;
revoke all on function entrar_al_negocio(uuid) from anon;
grant execute on function entrar_al_negocio(uuid) to authenticated;

-- El predeterminado y el Inicio rápido valen para la cuenta, en todos los
-- dispositivos.
create or replace function guardar_preferencias_de_entrada(p_predeterminado uuid, p_inicio_rapido boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function guardar_preferencias_de_entrada(uuid, boolean) from public;
revoke all on function guardar_preferencias_de_entrada(uuid, boolean) from anon;
grant execute on function guardar_preferencias_de_entrada(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 5. Crear un negocio o aceptar una invitación, estando ya en otro
-- ------------------------------------------------------------
-- Dejan de rechazar a quien ya tiene negocio. Las dos crean la ficha y entran.

create or replace function crear_mi_negocio(p_nombre text, p_rubro text, p_modulos jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo uuid;
  mi_mail text;
  mi_nombre text;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión para crear un negocio.';
  end if;

  insert into negocio (nombre, rubro, modulos_activos)
  values (p_nombre, p_rubro, coalesce(p_modulos, '[]'::jsonb))
  returning id into nuevo;

  select email into mi_mail from auth.users where id = auth.uid();

  -- La fila de usuario puede no existir todavía, según cuándo se confirmó el
  -- mail. El rol va explícito: quien es encargado en el negocio en el que está
  -- y crea otro, entra al nuevo como dueño.
  insert into usuario (id, email, negocio_id, rol)
  values (auth.uid(), mi_mail, nuevo, 'duenio')
  on conflict (id) do update
    set negocio_id = excluded.negocio_id,
        rol        = excluded.rol;

  select nombre into mi_nombre from usuario where id = auth.uid();

  insert into empleado (negocio_id, nombre, rol, usuario_id)
  values (
    nuevo,
    coalesce(nullif(trim(mi_nombre), ''), split_part(coalesce(mi_mail, 'Alguien'), '@', 1)),
    'duenio',
    auth.uid()
  );

  return nuevo;
end;
$$;

revoke all on function crear_mi_negocio(text, text, jsonb) from public;
revoke all on function crear_mi_negocio(text, text, jsonb) from anon;
grant execute on function crear_mi_negocio(text, text, jsonb) to authenticated;

create or replace function aceptar_invitacion(p_codigo text, p_nombre text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitacion%rowtype;
  quien uuid := auth.uid();
  mi_mail text;
begin
  if quien is null then
    raise exception 'Hay que iniciar sesión para aceptar una invitación.';
  end if;

  -- "for update" bloquea la fila hasta terminar: si dos personas abren el
  -- mismo link al mismo tiempo, no se pasa de los usos permitidos.
  select * into inv from invitacion where codigo = p_codigo for update;

  if not found then
    raise exception 'Este link no existe. Fijate que esté completo.';
  end if;
  if inv.anulada then
    raise exception 'Quien te invitó dio de baja este link.';
  end if;
  if inv.vence_en < now() then
    raise exception 'Este link ya venció. Pedí uno nuevo.';
  end if;
  if inv.usos >= inv.usos_maximos then
    raise exception 'Este link ya se usó todas las veces que podía.';
  end if;
  if exists (
    select 1 from empleado
     where usuario_id = quien
       and negocio_id = inv.negocio_id
  ) then
    raise exception 'Ya estás en ese negocio.';
  end if;

  select email into mi_mail from auth.users where id = quien;

  insert into usuario (id, email, negocio_id, rol)
  values (quien, mi_mail, inv.negocio_id, inv.rol)
  on conflict (id) do update
    set negocio_id = excluded.negocio_id,
        rol = excluded.rol;

  insert into empleado (negocio_id, nombre, rol, usuario_id)
  values (
    inv.negocio_id,
    coalesce(nullif(trim(p_nombre), ''), split_part(coalesce(mi_mail, 'Alguien'), '@', 1)),
    inv.rol,
    quien
  );

  update invitacion set usos = usos + 1 where id = inv.id;

  return inv.negocio_id;
end;
$$;

revoke all on function aceptar_invitacion(text, text) from public;
revoke all on function aceptar_invitacion(text, text) from anon;
grant execute on function aceptar_invitacion(text, text) to authenticated;

-- ------------------------------------------------------------
-- 6. Sacar a alguien también le saca el predeterminado (cambia la 036)
-- ------------------------------------------------------------
-- Además de dejarla sin negocio activo si estaba en éste, la cuenta pierde
-- este negocio como predeterminado, y con él el Inicio rápido. Si tiene otros
-- negocios, al iniciar sesión pasa por el selector.
--
-- En un UPDATE, todas las expresiones leen la fila como estaba antes: por eso
-- cada columna mira negocio_id y negocio_predeterminado viejos.
create or replace function quitar_acceso_al_sacar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.usuario_id is null then
    -- Una ficha cargada a mano, sin cuenta: no hay acceso que quitar.
    return old;
  end if;

  if old.usuario_id = auth.uid() then
    raise exception 'No te podés sacar a vos del equipo.';
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

-- El trigger (036) ya apunta a esta función: no hace falta recrearlo.

-- CÓMO VERIFICARLO (sólo lee):
--
--   select count(*) from usuario u
--    where u.negocio_id is not null
--      and not exists (select 1 from empleado e
--                       where e.usuario_id = u.id and e.negocio_id = u.negocio_id);
--
-- Tiene que dar 0: toda cuenta con negocio tiene su ficha ahí.
-- Después, correr supabase/pruebas/multinegocio.sql.
