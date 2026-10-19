-- ============================================================
-- 047_red_de_sedes.sql — el inventario de varias sedes de una vez
--
-- Correr entero en el SQL Editor de Supabase, después de la 046. Es
-- idempotente. Diseño: docs/red-de-sedes.md. Prueba: pruebas/red_de_sedes.sql.
--
-- Una sede es un negocio. Los negocios con la misma `red` están vinculados, y
-- en la vista conjunta cada persona ve sólo las sedes donde ya tiene ficha:
-- nada que no pudiera ver cambiando de negocio en el selector. Las políticas
-- del inventario no se tocan; la vista pasa sólo por estas funciones.
-- ============================================================

alter table negocio add column if not exists red uuid;
create index if not exists negocio_red_idx on negocio (red) where red is not null;

-- ------------------------------------------------------------
-- 1. La red no se cambia a mano
-- ------------------------------------------------------------
-- El dueño puede editar su negocio (008): sin esto podría meterse en una red
-- ajena. No es security definer a propósito: así current_user dice quién
-- ejecuta el cambio. Desde una sesión es "authenticated" y se frena; adentro
-- de las funciones de abajo, que son security definer, es el dueño de las
-- tablas y pasa. Desde el SQL Editor, sin sesión, también pasa.
-- (creado_por_fijo, en la 038, frena todo lo que venga con sesión: acá no
-- sirve, porque estas funciones también corren con la sesión de la persona.)
create or replace function red_fija()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.red is distinct from old.red and current_user in ('authenticated', 'anon') then
    raise exception 'Las sedes se vinculan desde Mi negocio.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists negocio_red_fija on negocio;
create trigger negocio_red_fija
  before update of red on negocio
  for each row
  execute function red_fija();

-- ------------------------------------------------------------
-- 2. Los permisos, con nombre y en un solo lugar
-- ------------------------------------------------------------
-- Si el rol de quien llama en ESE negocio tiene el permiso. Sin ficha, o un
-- permiso que no conoce: no (falla cerrado). Recibe el negocio porque la
-- configuración de permisos que viene va a ser por negocio: ese día esta
-- función lee esa tabla, con estos valores de respaldo, y nadie más cambia.
create or replace function puede_en(p_negocio uuid, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_permiso
             when 'vincular_sedes' then e.rol = 'duenio'
             when 'ver_inventario_de_sedes' then e.rol in ('duenio', 'encargado', 'tecnico')
             else false
           end
      from empleado e
     where e.negocio_id = p_negocio
       and e.usuario_id = auth.uid()
     limit 1
  ), false);
$$;

revoke all on function puede_en(uuid, text) from public;
revoke all on function puede_en(uuid, text) from anon;
grant execute on function puede_en(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 3. Vincular y desvincular
-- ------------------------------------------------------------
-- Pone el negocio activo y p_otro en la misma red: si uno ya tiene, el otro se
-- suma; si ninguno, se crea. Hay que poder en los dos. Un negocio que no
-- existe, o donde no tiene ficha, cae en el mismo mensaje de permiso: no se
-- revela cuál de las dos cosas es.
create or replace function vincular_sede(p_otro uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function vincular_sede(uuid) from public;
revoke all on function vincular_sede(uuid) from anon;
grant execute on function vincular_sede(uuid) to authenticated;

-- Saca de la red al negocio activo. Una red de uno no vincula nada: si queda
-- una sola sede, también sale.
create or replace function desvincular_sede()
returns void
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function desvincular_sede() from public;
revoke all on function desvincular_sede() from anon;
grant execute on function desvincular_sede() to authenticated;

-- ------------------------------------------------------------
-- 4. Ver
-- ------------------------------------------------------------
-- Las sedes de la red del negocio activo donde quien llama tiene ficha. Sin
-- red, ninguna.
create or replace function mis_sedes()
returns table (id uuid, nombre text, rubro text, foto text, rol text)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.nombre, n.rubro, n.foto, e.rol
    from negocio n
    join empleado e on e.negocio_id = n.id and e.usuario_id = auth.uid()
   where n.red is not null
     and n.red = (select red from negocio where id = mi_negocio())
   order by n.nombre;
$$;

revoke all on function mis_sedes() from public;
revoke all on function mis_sedes() from anon;
grant execute on function mis_sedes() to authenticated;

-- El stock y lo pedido de esas sedes, donde además puede ver el inventario de
-- sedes. Sólo se lee: ninguna fila de otra sede se cambia desde afuera.
create or replace function inventario_de_mis_sedes()
returns table (
  negocio_id uuid, id uuid, nombre text, marca text, modelo text, categoria text,
  cantidad integer, minimo integer, unidad text, por_caja integer, estado text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.negocio_id, i.id, i.nombre, i.marca, i.modelo, i.categoria,
         i.cantidad, i.minimo, i.unidad, i.por_caja, i.estado
    from insumo i
    join mis_sedes() s on s.id = i.negocio_id
   where i.estado in ('en_stock', 'pedido')
     and puede_en(i.negocio_id, 'ver_inventario_de_sedes');
$$;

revoke all on function inventario_de_mis_sedes() from public;
revoke all on function inventario_de_mis_sedes() from anon;
grant execute on function inventario_de_mis_sedes() to authenticated;
