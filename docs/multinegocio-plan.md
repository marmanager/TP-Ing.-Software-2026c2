# Varios negocios por cuenta — plan de implementación

> **Para quien lo ejecute:** usar superpowers:subagent-driven-development
> (recomendado) o superpowers:executing-plans, tarea por tarea. Los pasos usan
> casillas (`- [ ]`) para ir marcando.

**Objetivo:** que una cuenta maneje varios negocios, elija en cuál entrar al
iniciar sesión, cambie desde Mi perfil, y que el dueño aparezca en Equipo.

**Arquitectura:** el negocio activo sigue en `usuario.negocio_id` y
`usuario.rol` (así `mi_negocio()`, `mi_rol()` y las políticas no cambian); la
ficha de `empleado` es la membresía; cambiar de negocio es una función de la
base que verifica y copia. En la app, una pantalla nueva `/negocios`, la
Guardia manda ahí al iniciar sesión, y Mi perfil suma "Tus negocios".

**Tecnología:** Next.js 16 (App Router) + React 19 + Tailwind 4, Supabase con
RLS, Jest (`npm run test:unit`).

**Diseño:** [`docs/multinegocio.md`](multinegocio.md). Se leen los dos.

## Reglas para todas las tareas

- Textos y comentarios en castellano rioplatense, con el estilo del repo.
- Cartilla: un solo botón azul por pantalla; áreas táctiles de 48 px
  (`min-h-12`); el estado se dice con color + ícono + palabra; un botón
  apagado dice por qué (`motivo`).
- Nada del navegador escribe columnas de `usuario` (035): todo por funciones.
- Errores de funciones (`P0001`) pasan tal cual; los demás, por `traducir()`.
- El modo de ejemplo no cambia.
- Nunca mover `.env.local` mientras el servidor del usuario esté corriendo.
- Commits sólo con aprobación del usuario. Mensaje en castellano, estilo del
  repo, terminando en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- En Windows, `npm.cmd` (la política de PowerShell traba `npm.ps1`).

## Lo que el plan agrega al diseño

Salió al leer el código para escribir el plan. Van en las tareas:

1. **`mi_empleado()`** (008) busca la ficha sin mirar el negocio. Con varias
   fichas podía devolver la de otro, y un técnico dejaba de ver sus casos
   (008), de marcar pasos (021) y de firmar cobros (025). La 038 la limita al
   negocio activo.
2. **`fotos_del_equipo()`** (034) lee `usuario.negocio_id`: un compañero que
   está parado en otra sucursal perdía la foto. La 038 la lee de las fichas.
3. **Google Calendar**: el sincronizador desconecta la cuenta si
   `usuario.negocio_id` no es el negocio conectado. Cambiar de sucursal la
   desconectaba. Pasa a mirar si tiene ficha ahí (Tarea 9).
4. **Una ficha por cuenta y negocio**: índice único. Es lo que hace verdad que
   "la ficha es la membresía".
5. **`crear_mi_negocio()`** tiene que poner `rol = 'duenio'`: quien es
   encargado en su negocio activo y crea otro, entra al nuevo como dueño.
6. **`/negocios` sin ningún negocio va directo a `/crear-negocio`** en vez de
   mostrar una lista con sólo "Nuevo negocio". Así la cuenta nueva sigue viendo
   "Listo, tu mail quedó confirmado" y "¿Venías por una invitación?", que viven
   en `/crear-negocio`. Por lo mismo, `crear-cuenta` no cambia.
7. **Contraseña con Google**: quien entró sólo con Google no tiene contraseña.
   Mi perfil dice "Entrás con Google" y ofrece "Crear una", en vez de puntos.
8. **La otra pestaña**: al volver a una pestaña cuyo negocio ya no es el
   activo, la base devuelve vacío. Hoy eso termina en *"Tu negocio todavía no
   aparece en la base"* y pantalla vacía. Pasa a dejar lo que había y mostrar
   el cartel del diseño.

## Archivos

| Archivo | Qué |
|---|---|
| `supabase/038_multinegocio.sql` (nuevo) | Columnas, pasaje, funciones, índice. |
| `supabase/pruebas/multinegocio.sql` (nuevo) | Prueba contra la base, que se deshace. |
| `src/lib/entrada.js` (nuevo) + `pruebas/entrada.test.js` | `alEntrar()`. |
| `src/lib/auth.js` | `misNegocios`, `entrarAlNegocio`, `guardarPreferenciasDeEntrada`; sale `anotarNegocio`. |
| `src/componentes/FilaNegocio.js` (nuevo) | Fila de negocio y fila "Nuevo negocio". |
| `src/app/negocios/page.js` (nuevo) | "¿A qué negocio entrás?". |
| `src/componentes/Guardia.js`, `src/app/iniciar-sesion/page.js` | A dónde va cada uno. |
| `src/app/crear-negocio/page.js`, `src/app/unirme/[codigo]/page.js` | Dejan de frenar. |
| `src/componentes/ui.js` | `Interruptor`. |
| `src/app/perfil/page.js`, `src/app/perfil/TusNegocios.js` (nuevo) | Tu cuenta y Tus negocios. |
| `src/app/equipo/page.js` | "Vos". |
| `src/lib/datos.js`, `src/componentes/Aviso.js` | Cargando al cambiar; cartel de la otra pestaña. |
| `src/lib/google-calendar-server.js` | `sigueEnNegocio` por ficha. |
| `README.md`, `docs/multinegocio.md` | Migración y prueba a mano. |

---

### Tarea 1: la base — `038_multinegocio.sql` y su prueba

**Archivos:**
- Crear: `supabase/pruebas/multinegocio.sql`
- Crear: `supabase/038_multinegocio.sql`

**Interfaces que produce** (las usan las tareas 3, 6 y 9):
- `mis_negocios()` → filas `(id uuid, nombre text, rubro text, foto text, rol text)`.
- `entrar_al_negocio(p_negocio uuid)` → `void`. Error: `'No estás en ese negocio.'`
- `guardar_preferencias_de_entrada(p_predeterminado uuid, p_inicio_rapido boolean)` → `void`.
  Errores: `'No estás en ese negocio.'`, `'Elegí primero cuál es tu negocio predeterminado.'`
- `usuario.negocio_predeterminado uuid`, `usuario.inicio_rapido boolean`.
- `aceptar_invitacion()`: nuevo error `'Ya estás en ese negocio.'`

- [ ] **Paso 1: escribir la prueba** — `supabase/pruebas/multinegocio.sql`:

```sql
-- ============================================================
-- pruebas/multinegocio.sql — prueba la 035..038 contra la base de verdad
--
-- Correr entero en el SQL Editor de Supabase, DESPUÉS de la 038.
--
-- No deja nada: crea tres cuentas y dos negocios de mentira, prueba, y al
-- final lo deshace todo. El bloque de adentro termina con un error a
-- propósito ('deshacer') que se atrapa: al atraparlo, Postgres vuelve atrás
-- todo lo que hizo el bloque.
--
-- Cómo leer el resultado:
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó. Tampoco deja nada.
--   cualquier otro error              → la prueba no pudo correr (por
--                                        ejemplo, falta alguna migración).
--
-- Las sesiones se simulan como las arma Supabase: rol "authenticated" y el id
-- de la cuenta en request.jwt.claims, que es de donde lee auth.uid().
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();  -- dueña del negocio A
  beto uuid := gen_random_uuid();  -- dueño del negocio B
  caro uuid := gen_random_uuid();  -- técnica, invitada a A
  neg_a uuid;
  neg_b uuid;
  neg_a2 uuid;
  inv_caro text;
  inv_beto text;
  ficha_ana uuid;
  ficha_caro uuid;
  n integer;
  fila record;
  frenado boolean;
begin
  begin
    -- Las cuentas se crean como postgres, antes de pasar a "authenticated".
    insert into auth.users (id, email) values
      (ana,  'prueba-ana-'  || ana  || '@ejemplo.test'),
      (beto, 'prueba-beto-' || beto || '@ejemplo.test'),
      (caro, 'prueba-caro-' || caro || '@ejemplo.test');

    perform set_config('role', 'authenticated', true);

    -- ---- 1. Crear un negocio deja al dueño adentro y con ficha ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Prueba A', 'taller', '[]'::jsonb);
    select * into fila from usuario where id = ana;
    if fila.negocio_id is distinct from neg_a or fila.rol <> 'duenio' then
      raise exception 'FALLÓ 1: crear un negocio no dejó a la cuenta adentro como dueña.';
    end if;
    select id into ficha_ana from empleado
     where usuario_id = ana and negocio_id = neg_a and rol = 'duenio';
    if ficha_ana is null then
      raise exception 'FALLÓ 1: la dueña no tiene ficha en su negocio nuevo.';
    end if;

    -- ---- 2. Beto crea el suyo ----
    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    neg_b := crear_mi_negocio('Prueba B', 'service', '[]'::jsonb);

    -- ---- 3. Ana no ve nada del negocio de Beto ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    select count(*) into n from negocio where id = neg_b;
    if n <> 0 then
      raise exception 'FALLÓ 3: una cuenta ve otro negocio.';
    end if;
    select count(*) into n from empleado where negocio_id = neg_b;
    if n <> 0 then
      raise exception 'FALLÓ 3: una cuenta ve el equipo de otro negocio.';
    end if;

    -- ---- 4. No se entra a un negocio ajeno ----
    frenado := false;
    begin
      perform entrar_al_negocio(neg_b);
    exception when raise_exception then
      frenado := sqlerrm = 'No estás en ese negocio.';
    end;
    if not frenado then
      raise exception 'FALLÓ 4: se pudo entrar a un negocio ajeno.';
    end if;

    -- ---- 5. El predeterminado tiene que ser propio, y va antes que Inicio rápido ----
    frenado := false;
    begin
      perform guardar_preferencias_de_entrada(neg_b, false);
    exception when raise_exception then
      frenado := sqlerrm = 'No estás en ese negocio.';
    end;
    if not frenado then
      raise exception 'FALLÓ 5: se pudo elegir de predeterminado un negocio ajeno.';
    end if;

    frenado := false;
    begin
      perform guardar_preferencias_de_entrada(null, true);
    exception when raise_exception then
      frenado := sqlerrm = 'Elegí primero cuál es tu negocio predeterminado.';
    end;
    if not frenado then
      raise exception 'FALLÓ 5: se prendió Inicio rápido sin predeterminado.';
    end if;

    -- ---- 6. Ana invita a Caro (técnica, dos usos) y a Beto (encargado) ----
    insert into invitacion (negocio_id, rol, usos_maximos, vence_en)
    values (neg_a, 'tecnico', 2, now() + interval '1 day')
    returning codigo into inv_caro;
    insert into invitacion (negocio_id, rol, vence_en)
    values (neg_a, 'encargado', now() + interval '1 day')
    returning codigo into inv_beto;

    -- ---- 7. Caro acepta y entra a A como técnica; una segunda vez, no ----
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform aceptar_invitacion(inv_caro, 'Caro');
    select * into fila from usuario where id = caro;
    if fila.negocio_id is distinct from neg_a or fila.rol <> 'tecnico' then
      raise exception 'FALLÓ 7: aceptar la invitación no dejó a la cuenta adentro con su rol.';
    end if;

    frenado := false;
    begin
      perform aceptar_invitacion(inv_caro, 'Caro');
    exception when raise_exception then
      frenado := sqlerrm = 'Ya estás en ese negocio.';
    end;
    if not frenado then
      raise exception 'FALLÓ 7: se pudo entrar dos veces al mismo negocio.';
    end if;

    -- ---- 8. Nadie se cambia el negocio ni el rol a mano (035) ----
    frenado := false;
    begin
      update usuario set rol = 'duenio' where id = caro;
    exception when insufficient_privilege then
      frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 8: una cuenta se pudo cambiar el rol a mano.';
    end if;

    frenado := false;
    begin
      update usuario set negocio_id = neg_b where id = caro;
    exception when insufficient_privilege then
      frenado := true;
    end;
    if not frenado then
      raise exception 'FALLÓ 8: una cuenta se pudo cambiar de negocio a mano.';
    end if;

    -- ---- 9. Beto, estando en B, acepta la invitación a A; un rol por negocio ----
    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    perform aceptar_invitacion(inv_beto, 'Beto');
    select * into fila from usuario where id = beto;
    if fila.negocio_id is distinct from neg_a or fila.rol <> 'encargado' then
      raise exception 'FALLÓ 9: aceptar una invitación estando en otro negocio no funcionó.';
    end if;
    select count(*) into n from mis_negocios() m where m.id in (neg_a, neg_b);
    if n <> 2 then
      raise exception 'FALLÓ 9: mis_negocios() no trae los dos negocios de la cuenta.';
    end if;

    perform entrar_al_negocio(neg_b);
    select * into fila from usuario where id = beto;
    if fila.negocio_id is distinct from neg_b or fila.rol <> 'duenio' then
      raise exception 'FALLÓ 9: al volver a su negocio no recuperó el rol que tiene ahí.';
    end if;

    -- ---- 10. Ana crea otra sucursal, mis_negocios() trae sólo las suyas ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a2 := crear_mi_negocio('Prueba A2', 'taller', '[]'::jsonb);
    select count(*) into n from mis_negocios();
    if n <> 2 then
      raise exception 'FALLÓ 10: mis_negocios() no trae los dos negocios de la dueña.';
    end if;
    select count(*) into n from mis_negocios() m where m.id = neg_b;
    if n <> 0 then
      raise exception 'FALLÓ 10: mis_negocios() trae un negocio ajeno.';
    end if;
    perform entrar_al_negocio(neg_a);

    -- ---- 11. empleado.usuario_id no se escribe a mano (037) ----
    -- "others" cuenta como no frenado: si el permiso dejara pasar, el choque
    -- sería con el índice único o la clave foránea, no con el permiso.
    select id into ficha_caro from empleado where usuario_id = caro and negocio_id = neg_a;
    frenado := false;
    begin
      update empleado set usuario_id = beto where id = ficha_caro;
    exception
      when insufficient_privilege then frenado := true;
      when others then frenado := false;
    end;
    if not frenado then
      raise exception 'FALLÓ 11: se pudo cambiar a mano de quién es una ficha.';
    end if;

    frenado := false;
    begin
      insert into empleado (negocio_id, nombre, rol, usuario_id)
      values (neg_a, 'Intrusa', 'tecnico', caro);
    exception
      when insufficient_privilege then frenado := true;
      when others then frenado := false;
    end;
    if not frenado then
      raise exception 'FALLÓ 11: se pudo meter a mano una cuenta en el equipo.';
    end if;

    -- ---- 12. El rol de la ficha da los permisos; el propio no se toca (037) ----
    update empleado set rol = 'encargado' where id = ficha_caro;
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    select * into fila from usuario where id = caro;
    if fila.rol <> 'encargado' then
      raise exception 'FALLÓ 12: cambiar el rol en Equipo no cambió los permisos.';
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin
      update empleado set rol = 'tecnico' where id = ficha_ana;
    exception when raise_exception then
      frenado := sqlerrm = 'No podés cambiar tu propio rol.';
    end;
    if not frenado then
      raise exception 'FALLÓ 12: una cuenta se pudo cambiar su propio rol.';
    end if;

    -- ---- 13. Al sacar a alguien pierde el acceso y el predeterminado (036, 038) ----
    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    perform guardar_preferencias_de_entrada(neg_a, true);

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    delete from empleado where id = ficha_caro;

    perform set_config('request.jwt.claims', json_build_object('sub', caro, 'role', 'authenticated')::text, true);
    select * into fila from usuario where id = caro;
    if fila.negocio_id is not null then
      raise exception 'FALLÓ 13: sacada del equipo, la cuenta sigue adentro.';
    end if;
    if fila.negocio_predeterminado is not null or fila.inicio_rapido then
      raise exception 'FALLÓ 13: sacada del equipo, le quedó ese negocio de predeterminado.';
    end if;
    select count(*) into n from mis_negocios();
    if n <> 0 then
      raise exception 'FALLÓ 13: sacada del equipo, el negocio le sigue apareciendo.';
    end if;
    select count(*) into n from negocio where id = neg_a;
    if n <> 0 then
      raise exception 'FALLÓ 13: sacada del equipo, sigue viendo el negocio.';
    end if;

    -- ---- 14. Nadie se saca a sí mismo (036) ----
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    frenado := false;
    begin
      delete from empleado where id = ficha_ana;
    exception when raise_exception then
      frenado := sqlerrm = 'No te podés sacar a vos del equipo.';
    end;
    if not frenado then
      raise exception 'FALLÓ 14: una cuenta se pudo sacar a sí misma del equipo.';
    end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
```

- [ ] **Paso 2: comprobar que falla sin la 038.** No se puede correr desde acá
  (no entramos a la base del equipo). Se revisa leyendo: la prueba 1 llama a
  `crear_mi_negocio()` y busca la ficha de la dueña, que hoy no se crea →
  `FALLÓ 1`. Al usuario se le pide correrla **después** de la 038 (Paso 4).

- [ ] **Paso 3: escribir la migración** — `supabase/038_multinegocio.sql`:

```sql
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
```

- [ ] **Paso 4: el usuario corre las dos en Supabase.** Pedirle, en este
  orden: `038_multinegocio.sql`, la consulta de verificación (tiene que dar
  `0`), y `supabase/pruebas/multinegocio.sql` (tiene que decir *"Success. No
  rows returned"*). Si la prueba dice `FALLÓ n`, frenar y revisar la prueba
  `n` antes de seguir. Si falla con permiso denegado sobre `auth.users`,
  avisar: la prueba necesita otra forma de crear las cuentas de mentira.

- [ ] **Paso 5: commit** (con aprobación del usuario)

```bash
git add supabase/038_multinegocio.sql supabase/pruebas/multinegocio.sql
git commit -m "Varios negocios por cuenta, en la base"
```

---

### Tarea 2: a dónde va la cuenta al iniciar sesión — `entrada.js`

**Archivos:**
- Crear: `pruebas/entrada.test.js`
- Crear: `src/lib/entrada.js`

**Interfaces que produce** (la usa la Tarea 4):
- `alEntrar({ negocios, predeterminado, inicioRapido })` →
  `{ ir: "crear" }` | `{ ir: "entrar", negocio: string }` | `{ ir: "elegir" }`

- [ ] **Paso 1: escribir la prueba** — `pruebas/entrada.test.js`:

```js
// Correr con: npm run test:unit
//
// A dónde va una cuenta real al iniciar sesión (docs/multinegocio.md).

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { alEntrar } from "../src/lib/entrada.js";

const A = { id: "a", nombre: "Taller Centro" };
const B = { id: "b", nombre: "Taller Norte" };

test("sin ningún negocio, a crear uno", () => {
  assert.deepEqual(alEntrar({ negocios: [] }), { ir: "crear" });
  assert.deepEqual(alEntrar({ negocios: [], predeterminado: "a", inicioRapido: true }), {
    ir: "crear",
  });
});

test("con Inicio rápido y un predeterminado suyo, entra directo", () => {
  assert.deepEqual(alEntrar({ negocios: [A, B], predeterminado: "b", inicioRapido: true }), {
    ir: "entrar",
    negocio: "b",
  });
});

test("sin Inicio rápido, elige aunque haya predeterminado", () => {
  assert.deepEqual(alEntrar({ negocios: [A, B], predeterminado: "a", inicioRapido: false }), {
    ir: "elegir",
  });
});

test("un predeterminado que ya no es suyo no cuenta: elige", () => {
  assert.deepEqual(alEntrar({ negocios: [A], predeterminado: "b", inicioRapido: true }), {
    ir: "elegir",
  });
});

test("con un solo negocio y sin Inicio rápido, también elige", () => {
  assert.deepEqual(alEntrar({ negocios: [A] }), { ir: "elegir" });
});
```

- [ ] **Paso 2: correrla y ver que falla**

Correr: `npm.cmd run test:unit -- pruebas/entrada.test.js`
Esperado: FALLA con *"Cannot find module '../src/lib/entrada.js'"*.

- [ ] **Paso 3: escribir `src/lib/entrada.js`**

```js
// A dónde va una cuenta real al iniciar sesión (docs/multinegocio.md).
//
//   { ir: "crear" }                  no está en ningún negocio
//   { ir: "entrar", negocio: id }    Inicio rápido, con un predeterminado que
//                                    sigue siendo suyo
//   { ir: "elegir" }                 todo lo demás: el selector
//
// El predeterminado se busca entre sus negocios y no se cree a ciegas: si lo
// sacaron de ese equipo, entrar directo fallaría, y es mejor que elija.
export function alEntrar({ negocios = [], predeterminado = null, inicioRapido = false } = {}) {
  if (negocios.length === 0) return { ir: "crear" };
  if (inicioRapido && negocios.some((n) => n.id === predeterminado)) {
    return { ir: "entrar", negocio: predeterminado };
  }
  return { ir: "elegir" };
}
```

- [ ] **Paso 4: correrla y ver que pasa**

Correr: `npm.cmd run test:unit -- pruebas/entrada.test.js`
Esperado: 5 pasan.

- [ ] **Paso 5: commit** (con aprobación)

```bash
git add src/lib/entrada.js pruebas/entrada.test.js
git commit -m "A dónde va una cuenta al iniciar sesión"
```

---

### Tarea 3: `auth.js` — los negocios de la cuenta

**Archivos:**
- Modificar: `src/lib/auth.js` (acciones, dentro del `useMemo`)
- Modificar: `src/app/crear-negocio/page.js` (usa `anotarNegocio`, que sale)

**Interfaces:**
- Consume: `mis_negocios`, `entrar_al_negocio`, `guardar_preferencias_de_entrada` (Tarea 1).
- Produce (desde `useAuth()`):
  - `misNegocios()` → `{ ok: true, negocios: [{ id, nombre, rubro, foto, rol }] }` | `{ ok: false, error }`
  - `entrarAlNegocio(negocioId)` → `{ ok: true }` | `{ ok: false, error }`
  - `guardarPreferenciasDeEntrada({ predeterminado, inicioRapido })` → `{ ok: true }` | `{ ok: false, error }`
  - `usuario.negocio_predeterminado`, `usuario.inicio_rapido` (vienen solos: `traerUsuario()` hace `select("*")`).
  - Sale `anotarNegocio`.

- [ ] **Paso 1: reemplazar `anotarNegocio`** en `src/lib/auth.js`. Borrar este bloque:

```js
      // La usa "Crear negocio" (SCRUM-12) al volver de crear_mi_negocio().
      // El vínculo en la base ya lo dejó hecho esa función; acá sólo se
      // refresca lo que hay en pantalla, para no leer de nuevo.
      anotarNegocio(negocioId) {
        setUsuario((u) => (u ? { ...u, negocio_id: negocioId } : u));
      },
```

y en su lugar poner:

```js
      // Los negocios de la cuenta (docs/multinegocio.md): uno por cada ficha
      // de equipo que tiene. Sin la 038 corrida la función no existe y da
      // ok: false; quien la usa sigue como antes, con el negocio activo.
      async misNegocios() {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        const { data, error } = await supabase.rpc("mis_negocios");
        if (error) return { ok: false, error: traducir(error) };
        return { ok: true, negocios: data ?? [] };
      },

      // Pasa la cuenta a otro de sus negocios. La base verifica que tenga
      // ficha ahí y copia el rol de esa ficha (038). Después se vuelve a leer
      // la fila de usuario, y con eso datos.js carga el negocio nuevo.
      async entrarAlNegocio(negocioId) {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        const { error } = await supabase.rpc("entrar_al_negocio", { p_negocio: negocioId });
        if (error) {
          return { ok: false, error: error.code === "P0001" ? error.message : traducir(error) };
        }
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user));
        return { ok: true };
      },

      // El predeterminado y el Inicio rápido: valen para la cuenta, en todos
      // los dispositivos, por eso van a la base y no al navegador.
      async guardarPreferenciasDeEntrada({ predeterminado, inicioRapido }) {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        const { error } = await supabase.rpc("guardar_preferencias_de_entrada", {
          p_predeterminado: predeterminado ?? null,
          p_inicio_rapido: Boolean(inicioRapido),
        });
        if (error) {
          return { ok: false, error: error.code === "P0001" ? error.message : traducir(error) };
        }
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user));
        return { ok: true };
      },
```

- [ ] **Paso 2: actualizar el comentario de `refrescarUsuario`** (mismo archivo):

```js
      // Vuelve a leer la fila de `usuario`. Se usa después de aceptar una
      // invitación o de crear un negocio, donde cambian el negocio y el rol
      // de una sola vez.
```

- [ ] **Paso 3: `crear-negocio` deja de usar `anotarNegocio`.** En
  `src/app/crear-negocio/page.js`:

```js
  const { esDemo, usuario, refrescarUsuario } = useAuth();
```

y en `crear()`:

```js
    // La base ya dejó la cuenta adentro, como dueña (038). Se vuelve a leer
    // la fila entera y no sólo el negocio: el rol también cambió. En el modo
    // de ejemplo no hay cuenta y no hace nada.
    await refrescarUsuario();
    router.replace("/");
```

(en lugar de `anotarNegocio(creado.id);` + `router.replace("/");`).

- [ ] **Paso 4: que compile**

Correr: `npm.cmd run build`
Esperado: termina sin errores. (`next build` usa `.next`, no `.next/dev`: no
molesta al servidor del usuario.)

- [ ] **Paso 5: commit** (con aprobación)

```bash
git add src/lib/auth.js src/app/crear-negocio/page.js
git commit -m "Leer los negocios de la cuenta y entrar a uno"
```

---

### Tarea 4: la pantalla "¿A qué negocio entrás?" y la Guardia

**Archivos:**
- Crear: `src/componentes/FilaNegocio.js`
- Crear: `src/app/negocios/page.js`
- Modificar: `src/componentes/Guardia.js`
- Modificar: `src/app/iniciar-sesion/page.js:51`

**Interfaces:**
- Consume: `alEntrar` (Tarea 2); `misNegocios`, `entrarAlNegocio` (Tarea 3).
- Produce: `FilaNegocio({ negocio, rol })` (default) y `FilaNuevoNegocio()`
  (con nombre), de `src/componentes/FilaNegocio.js`. Las usa la Tarea 6.

- [ ] **Paso 1: `src/componentes/FilaNegocio.js`**

```js
// Una fila de negocio: la foto —o el ícono de local—, el nombre y el rubro, y
// el rol si se pasa. Es sólo el contenido: quien la usa pone alrededor el
// botón o la tarjeta, porque en el selector la fila entera se toca y en Mi
// perfil tiene botones adentro.

import Link from "next/link";
import { etiquetaRol, preset } from "@/lib/presets";
import Icono from "./Icono";

export default function FilaNegocio({ negocio, rol }) {
  return (
    <>
      {/* Sin texto alternativo: el nombre está al lado. */}
      {negocio.foto ? (
        <img src={negocio.foto} alt="" className="size-12 shrink-0 rounded-campo object-cover" />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
          <Icono nombre="tienda" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-cuerpo">{negocio.nombre}</span>
        <span className="block text-tinta-media">
          {preset(negocio.rubro).nombre}
          {rol && ` · ${etiquetaRol(negocio.rubro, rol)}`}
        </span>
      </span>
    </>
  );
}

// La última fila: un "+" en el lugar de la foto.
export function FilaNuevoNegocio() {
  return (
    <Link
      href="/crear-negocio"
      className="flex min-h-12 items-center gap-3 rounded-tarjeta border-2 border-dashed border-borde-fuerte p-4 font-bold text-azul hover:bg-superficie"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-campo bg-azul-claro">
        <Icono nombre="mas" />
      </span>
      Nuevo negocio
    </Link>
  );
}
```

- [ ] **Paso 2: `src/app/negocios/page.js`**

```js
"use client";

// "¿A qué negocio entrás?" (docs/multinegocio.md).
//
// Aparece al iniciar sesión —con mail, con Google, o al confirmar la cuenta—,
// no cada vez que se abre la aplicación: la Guardia manda acá desde las
// pantallas de entrada. Si la cuenta tiene Inicio rápido con un
// predeterminado suyo, no se muestra: entra y sigue.
//
// Sin ningún negocio va a "Crear tu negocio", que es donde viven el aviso de
// mail recién confirmado y el de invitación pendiente.
//
// El modo de ejemplo tiene un negocio solo y no pasa por acá.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { alEntrar } from "@/lib/entrada";
import { useTitulo } from "@/lib/useTitulo";
import FilaNegocio, { FilaNuevoNegocio } from "@/componentes/FilaNegocio";
import Icono from "@/componentes/Icono";
import { Cargando, ErrorGeneral, TituloPantalla } from "@/componentes/ui";

export default function Negocios() {
  const router = useRouter();
  const { esDemo, usuario, misNegocios, entrarAlNegocio } = useAuth();
  useTitulo("Tus negocios");

  const [negocios, setNegocios] = useState(null);
  const [entrando, setEntrando] = useState(null);
  const [error, setError] = useState(null);

  async function entrar(id) {
    setError(null);
    setEntrando(id);
    // Al negocio en el que ya está no hace falta volver a entrar.
    if (id !== usuario?.negocio_id) {
      const r = await entrarAlNegocio(id);
      if (!r.ok) {
        setEntrando(null);
        setError(r.error);
        return;
      }
    }
    router.replace("/");
  }

  useEffect(() => {
    if (esDemo) {
      router.replace("/");
      return;
    }
    let vivo = true;
    (async () => {
      const r = await misNegocios();
      if (!vivo) return;
      // Sin la 038 corrida no hay lista: se entra al negocio activo, como
      // antes, o a crearlo.
      if (!r.ok) {
        router.replace(usuario?.negocio_id ? "/" : "/crear-negocio");
        return;
      }
      const paso = alEntrar({
        negocios: r.negocios,
        predeterminado: usuario?.negocio_predeterminado,
        inicioRapido: usuario?.inicio_rapido,
      });
      if (paso.ir === "crear") router.replace("/crear-negocio");
      else if (paso.ir === "entrar") entrar(paso.negocio);
      else setNegocios(r.negocios);
    })();
    return () => {
      vivo = false;
    };
    // Una vez, al llegar: es la decisión de recién iniciada la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!negocios) return <Cargando filas={2} />;

  return (
    <>
      <TituloPantalla>¿A qué negocio entrás?</TituloPantalla>

      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      <ul className="grid gap-3">
        {negocios.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              disabled={Boolean(entrando)}
              onClick={() => entrar(n.id)}
              className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-tarjeta border border-borde bg-tarjeta p-4 text-left hover:bg-superficie disabled:cursor-wait"
            >
              <FilaNegocio negocio={n} />
              {entrando === n.id ? (
                <span className="text-tinta-media">Entrando…</span>
              ) : (
                <Icono nombre="flecha" className="shrink-0 text-azul" />
              )}
            </button>
          </li>
        ))}
        <li>
          <FilaNuevoNegocio />
        </li>
      </ul>
    </>
  );
}
```

- [ ] **Paso 3: la Guardia.** En `src/componentes/Guardia.js`:

Cabecera (líneas 5-10):

```js
// Decide, según el estado de la sesión, si se ve una pantalla de entrada o el
// sistema completo con su navegación, y manda a la persona a donde corresponde:
//   sin entrar             -> /bienvenida
//   entró, falta confirmar -> /confirma-tu-mail
//   entró, sin negocio     -> /negocios (el modo de ejemplo, /crear-negocio)
//   recién entró           -> /negocios, que elige o entra directo
//   entró y con negocio    -> el sistema
```

Después de `const RUTA_CONFIRMAR = "/confirma-tu-mail";`:

```js
// "¿A qué negocio entrás?" (docs/multinegocio.md). Se puede abrir con o sin
// negocio activo, y va con el marco de las pantallas de entrada.
const RUTA_NEGOCIOS = "/negocios";
```

Reemplazar las dos ramas del final del cálculo de `destino`:

```js
    } else if (!tieneNegocio) {
      // Una cuenta real sin negocio activo elige entre los suyos o crea uno.
      // El modo de ejemplo tiene uno solo: lo crea.
      if (ruta !== RUTA_NEGOCIO && ruta !== RUTA_NEGOCIOS && !esInvitacion(ruta))
        destino = esDemo ? RUTA_NEGOCIO : RUTA_NEGOCIOS;
    } else if (RUTAS_ENTRADA.includes(ruta) || ruta === RUTA_BIENVENIDA) {
      // Con sesión y negocio, estar en una pantalla de entrada es haber
      // iniciado sesión recién —así se vuelve de Google—: toca elegir
      // negocio. El modo de ejemplo tiene uno solo y va directo al Inicio.
      // /crear-negocio y /negocios se pueden visitar teniendo negocio.
      destino = esDemo ? "/" : RUTA_NEGOCIOS;
    }
```

Y en `enEntrada`, sumar la ruta:

```js
    ruta === RUTA_NEGOCIO ||
    ruta === RUTA_NEGOCIOS ||
    esInvitacion(ruta);
```

- [ ] **Paso 4: `iniciar-sesion` va al selector.** En
  `src/app/iniciar-sesion/page.js`, en `entrar()` (línea 51):

```js
    router.replace("/negocios");
```

(`verEjemplo()` sigue yendo a `/`.)

- [ ] **Paso 5: que compile y que el modo de ejemplo no cambie**

Correr: `npm.cmd run build` → sin errores.
Correr: `npm.cmd run test:unit` → pasan todas.
En el navegador, en modo de ejemplo (sólo si el servidor del usuario está
parado; si no, pedírselo): "Probá sin cuenta" → crea el negocio → Inicio;
abrir `/negocios` → vuelve a `/`; abrir `/iniciar-sesion` → vuelve a `/`.

- [ ] **Paso 6: commit** (con aprobación)

```bash
git add src/componentes/FilaNegocio.js src/app/negocios/page.js src/componentes/Guardia.js src/app/iniciar-sesion/page.js
git commit -m "Elegir a qué negocio entrar al iniciar sesión"
```

---

### Tarea 5: crear un negocio o sumarse a otro, teniendo ya uno

**Archivos:**
- Modificar: `src/app/crear-negocio/page.js`
- Modificar: `src/app/unirme/[codigo]/page.js`

- [ ] **Paso 1: `crear-negocio` deja de frenar.** Borrar:

```js
  // El modo de ejemplo también crea su negocio: es el mismo paso, sólo que se
  // guarda en el navegador.
  if (!esDemo && usuario?.negocio_id) {
    return <YaHayNegocio texto="Ya tenés un negocio creado." />;
  }
```

y la función `YaHayNegocio` del final del archivo. Después de la `</Tarjeta>`
del formulario, antes del `</>` final:

```js
      {/* Quien ya está en un negocio llega acá desde "Nuevo negocio", y puede
          arrepentirse. */}
      {!esDemo && usuario?.negocio_id && (
        <div className="mt-6">
          <Link href="/" className="inline-flex min-h-12 items-center gap-2 font-bold text-azul">
            <Icono nombre="volver" />
            Volver sin crear
          </Link>
        </div>
      )}
```

- [ ] **Paso 2: `unirme` deja de frenar.** En `src/app/unirme/[codigo]/page.js`,
  borrar el bloque entero `// Ya tiene un negocio: no se puede estar en dos.`
  (`if (usuario?.negocio_id) { return (...); }`). Si ya está en ese negocio,
  la base responde *"Ya estás en ese negocio."* y la pantalla lo muestra en
  `ErrorGeneral`, como los otros errores. Actualizar la cabecera del archivo:

```js
// Es la otra punta del link de invitación. Se abre en cualquier estado, así
// que la pantalla tiene que explicarse sola: sin cuenta, o con cuenta —con o
// sin negocios—. Sumarse a otro negocio no saca de los que ya se tiene: se
// entra al nuevo, y desde Mi perfil se vuelve.
```

- [ ] **Paso 3: que compile**

`usuario` sólo lo usaba ese bloque: sacarlo del `useAuth()` —
`const { sesion, esDemo, cargando, verInvitacion, aceptarInvitacion } = useAuth();`.

Correr: `npm.cmd run build` → sin errores.

- [ ] **Paso 4: commit** (con aprobación)

```bash
git add src/app/crear-negocio/page.js "src/app/unirme/[codigo]/page.js"
git commit -m "Crear otro negocio o sumarse a otro, teniendo ya uno"
```

---

### Tarea 6: Mi perfil — Tu cuenta y Tus negocios

**Archivos:**
- Modificar: `src/componentes/ui.js` (nuevo `Interruptor`)
- Crear: `src/app/perfil/TusNegocios.js`
- Modificar: `src/app/perfil/page.js`

**Interfaces:**
- Consume: `FilaNegocio`, `FilaNuevoNegocio` (Tarea 4); `misNegocios`,
  `entrarAlNegocio`, `guardarPreferenciasDeEntrada` (Tarea 3).
- Produce: `Interruptor({ prendido, onChange, children, ayuda, palabras, motivo, disabled })` en `ui.js`.

- [ ] **Paso 1: `Interruptor` en `src/componentes/ui.js`**, después de `Boton`:

```js
// Un interruptor de prendido y apagado. La etiqueta es parte del botón: así el
// área para tocar llega a los 48 px aunque la perilla sea chica, y el lector
// de pantalla dice el nombre y el estado juntos. El estado se dice con color,
// ícono —la tilde en la perilla— y palabra. Apagado, dice por qué, como Boton.
export function Interruptor({
  prendido,
  onChange,
  children,
  ayuda,
  palabras = ["Apagado", "Prendido"],
  motivo,
  disabled,
}) {
  const apagado = Boolean(motivo) || disabled;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={prendido}
      disabled={apagado}
      onClick={() => onChange(!prendido)}
      className="inline-flex min-h-12 cursor-pointer items-center gap-3 rounded-campo text-left disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          prendido ? "bg-azul" : "bg-borde-fuerte"
        } ${apagado ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0 flex size-6 items-center justify-center rounded-full bg-white text-azul transition-transform ${
            prendido ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        >
          {prendido && <Icono nombre="check" className="size-4" />}
        </span>
      </span>
      <span>
        <span className="block font-bold">{children}</span>
        {ayuda && <span className="block text-tinta-media">{ayuda}</span>}
        <span className="block text-apoyo text-tinta-suave">
          {prendido ? palabras[1] : palabras[0]}
          {motivo && ` · ${motivo}`}
        </span>
      </span>
    </button>
  );
}
```

- [ ] **Paso 2: `src/app/perfil/TusNegocios.js`**

```js
"use client";

// "Tus negocios", en Mi perfil (docs/multinegocio.md): los negocios de la
// cuenta con su rol, en cuál está ahora, cuál es el predeterminado y si al
// iniciar sesión entra directo a él.
//
// Sin la 038 corrida no hay lista: se muestra el negocio activo, como antes,
// sin interruptores ni "Nuevo negocio" (la base no dejaría crear otro).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import FilaNegocio, { FilaNuevoNegocio } from "@/componentes/FilaNegocio";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Interruptor, Tarjeta } from "@/componentes/ui";

export default function TusNegocios() {
  const router = useRouter();
  const { usuario, misNegocios, entrarAlNegocio, guardarPreferenciasDeEntrada } = useAuth();
  const { negocio, avisarExito } = useDatos();

  const [negocios, setNegocios] = useState(null);
  const [sinLista, setSinLista] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    misNegocios().then((r) => {
      if (!vivo) return;
      if (r.ok) setNegocios(r.negocios);
      else setSinLista(true);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const predeterminado = usuario?.negocio_predeterminado ?? null;
  const inicioRapido = Boolean(usuario?.inicio_rapido);

  async function entrar(n) {
    setError(null);
    setOcupado(true);
    const r = await entrarAlNegocio(n.id);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    avisarExito(`Listo, estás en ${n.nombre}.`);
    router.push("/");
  }

  // Uno solo a la vez: es una sola columna en la base. Apagar el
  // predeterminado apaga también el Inicio rápido, que sin él no tiene a
  // dónde entrar.
  async function guardar(nuevoPredeterminado, nuevoInicioRapido) {
    setError(null);
    setOcupado(true);
    const r = await guardarPreferenciasDeEntrada({
      predeterminado: nuevoPredeterminado,
      inicioRapido: nuevoPredeterminado ? nuevoInicioRapido : false,
    });
    setOcupado(false);
    if (!r.ok) setError(r.error);
  }

  if (sinLista) {
    if (!negocio) return null;
    return (
      <Link href="/negocio" className="mb-12 block">
        <Tarjeta className="flex items-center gap-3 hover:bg-superficie">
          <FilaNegocio negocio={negocio} rol={usuario?.rol} />
          <span className="font-bold text-azul">Ir a Mi negocio</span>
        </Tarjeta>
      </Link>
    );
  }

  if (!negocios) return <Cargando filas={2} />;

  return (
    <div className="mb-12">
      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      <ul className="grid gap-3">
        {negocios.map((n) => (
          <li key={n.id}>
            <Tarjeta className="flex flex-wrap items-center gap-3">
              <FilaNegocio negocio={n} rol={n.rol} />
              {n.id === usuario?.negocio_id ? (
                <span className="flex min-h-12 items-center gap-2 font-bold text-completo">
                  <Icono nombre="listo" className="size-6" />
                  Estás acá
                </span>
              ) : (
                <Boton disabled={ocupado} onClick={() => entrar(n)}>
                  Entrar
                </Boton>
              )}
              <div className="basis-full">
                <Interruptor
                  prendido={predeterminado === n.id}
                  palabras={["No", "Sí"]}
                  disabled={ocupado}
                  onChange={(v) => guardar(v ? n.id : null, inicioRapido)}
                >
                  Predeterminado
                </Interruptor>
              </div>
            </Tarjeta>
          </li>
        ))}
        <li>
          <FilaNuevoNegocio />
        </li>
      </ul>

      <Tarjeta className="mt-3">
        <Interruptor
          prendido={inicioRapido}
          ayuda="Al iniciar sesión, entrar directo al predeterminado."
          motivo={predeterminado ? null : "primero elegí uno predeterminado"}
          disabled={ocupado}
          onChange={(v) => guardar(predeterminado, v)}
        >
          Inicio rápido
        </Interruptor>
      </Tarjeta>
    </div>
  );
}
```

- [ ] **Paso 3: Mi perfil.** En `src/app/perfil/page.js`:

(a) Imports y `useAuth`:

```js
import TusNegocios from "./TusNegocios";
```

```js
  const { esDemo, sesion, usuario, cerrarSesion, definirContrasena, guardarPerfil } = useAuth();
```

(b) Después de `const foto = editando ? borrador.foto : usuario?.foto;`:

```js
  // Quien entró sólo con Google no tiene contraseña: mostrarle puntos sería
  // decirle que tiene una. Si no se sabe con qué entró, se asume la de
  // siempre.
  const proveedores = sesion?.user?.app_metadata?.providers;
  const soloGoogle = Array.isArray(proveedores) && !proveedores.includes("email");
```

(c) Reemplazar el `<dl>` del modo lectura (Mail y Teléfono) por:

```js
              <>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-apoyo text-tinta-suave">Mail</dt>
                    <dd className="break-words">{usuario?.email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-apoyo text-tinta-suave">Teléfono</dt>
                    <dd>{usuario?.telefono || "Sin cargar"}</dd>
                  </div>
                  <div>
                    <dt className="text-apoyo text-tinta-suave">Contraseña</dt>
                    <dd className="flex flex-wrap items-center gap-x-3">
                      {soloGoogle ? (
                        <span>Entrás con Google</span>
                      ) : (
                        <>
                          <span aria-hidden="true">••••••••</span>
                          <span className="sr-only">Guardada</span>
                        </>
                      )}
                      {!cambiandoContrasena && (
                        <Boton
                          variante="plano"
                          icono="llave"
                          onClick={() => setCambiandoContrasena(true)}
                        >
                          {soloGoogle ? "Crear una" : "Cambiarla"}
                        </Boton>
                      )}
                    </dd>
                  </div>
                </dl>

                {cambiandoContrasena && (
                  <div className="mt-6 max-w-[560px] border-t border-borde pt-6">
                    {/* Los mismos dos campos de antes (SCRUM-32), que vivían en
                        su propia sección. */}
                    <Campo
                      id="contrasena-nueva"
                      etiqueta="Tu contraseña nueva"
                      ayuda="Al menos 8 caracteres. Desde que la cambiás, entrás con esta."
                      type="password"
                      autoComplete="new-password"
                      value={contrasena}
                      onChange={(e) => {
                        setContrasena(e.target.value);
                        setErrorContrasena(null);
                      }}
                    />
                    <Campo
                      id="contrasena-repetida"
                      etiqueta="Escribila de nuevo"
                      error={repetida && contrasena !== repetida ? "Las dos no son iguales." : null}
                      exito={repetida && contrasena === repetida ? "Coinciden." : null}
                      type="password"
                      autoComplete="new-password"
                      value={repetida}
                      onChange={(e) => {
                        setRepetida(e.target.value);
                        setErrorContrasena(null);
                      }}
                    />

                    {errorContrasena && (
                      <p className="mb-4 flex items-start gap-2 font-bold text-rojo">
                        <Icono nombre="alerta" className="size-6" />
                        <span>{errorContrasena}</span>
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <Boton
                        variante="principal"
                        icono="check"
                        motivo={guardandoContrasena ? "guardando" : motivoContrasena}
                        onClick={guardarContrasena}
                      >
                        {soloGoogle ? "Crear la contraseña" : "Cambiar la contraseña"}
                      </Boton>
                      <Boton variante="plano" onClick={cerrarCambioDeContrasena}>
                        Mejor no
                      </Boton>
                    </div>
                  </div>
                )}
              </>
```

Son los mismos dos `<Campo>` y el mismo `<p>` de `errorContrasena` de la
sección "Tu contraseña", que se borra en (f).

(d) En `guardarContrasena()`, el aviso sirve para las dos:

```js
    datos.avisarExito("Listo, tu contraseña quedó guardada.");
```

(e) Reemplazar la sección "Tu negocio" entera (comentario, `TituloSeccion` y
`<ul>`) por:

```js
      {/* Con cuenta, todos sus negocios (docs/multinegocio.md). En el modo de
          ejemplo hay uno solo y no hay cuenta a la que atar otro. */}
      <TituloSeccion id="negocios">{esDemo ? "Tu negocio" : "Tus negocios"}</TituloSeccion>
      {esDemo ? (
        negocio && (
          <Link href="/negocio" className="mb-12 block">
            <Tarjeta className="flex items-center gap-3 hover:bg-superficie">
              <FilaNegocio negocio={negocio} />
              <span className="font-bold text-azul">Ir a Mi negocio</span>
            </Tarjeta>
          </Link>
        )
      ) : (
        <TusNegocios />
      )}
```

con `import FilaNegocio from "@/componentes/FilaNegocio";`. Borrar
`const rubro = preset(negocio?.rubro);` —sólo lo usaba la tarjeta vieja— y
dejar el import en `import { etiquetaRol } from "@/lib/presets";`.

(f) Borrar la sección "Tu contraseña" (`TituloSeccion id="contrasena"` y su
`Tarjeta`). Queda sólo "Cerrar sesión" dentro de `{!esDemo && (...)}`.

(g) El comentario de cabecera: cambiar "y el negocio en el que está" por "y
sus negocios: en cuál está, y a cuál entra al iniciar sesión".

- [ ] **Paso 4: que compile y que pasen las pruebas**

Correr: `npm.cmd run build` → sin errores.
Correr: `npm.cmd run test:unit` → pasan todas.
`grep -rn 'id="contrasena"\|#contrasena' src` → nada (nadie enlazaba a la
sección vieja; si aparece algo, apuntarlo a `#cuenta`).

- [ ] **Paso 5: commit** (con aprobación)

```bash
git add src/componentes/ui.js src/app/perfil/page.js src/app/perfil/TusNegocios.js
git commit -m "Mi perfil: la contraseña en Tu cuenta, y Tus negocios"
```

---

### Tarea 7: Equipo — "Vos"

**Archivos:**
- Modificar: `src/app/equipo/page.js`

- [ ] **Paso 1:** dentro de `empleados.map((e) => {`, después de `const foto = ...;`:

```js
            // La ficha propia: desde la 038 el dueño también tiene una. No se
            // cambia el rol ni se saca a sí mismo —la base lo rechaza (036,
            // 037)—, y un botón que no funciona no se muestra.
            const esVos = Boolean(e.usuario_id) && e.usuario_id === usuario?.id;
```

- [ ] **Paso 2:** el nombre lleva la marca:

```js
                    <p className="font-bold text-subtitulo">{e.nombre}</p>
                    {esVos && (
                      <span className="rounded-full bg-azul-claro px-3 py-1 text-apoyo font-bold text-azul">
                        Vos
                      </span>
                    )}
```

- [ ] **Paso 3:** el desplegable de rol sólo para las otras fichas:
  `{puedeManejar ? (` → `{puedeManejar && !esVos ? (`. La rama de lectura
  (`etiquetaRol`) queda para la propia.

- [ ] **Paso 4:** "Sacar" tampoco: `{!puedeManejar ? null : sacando === e.id ? (`
  → `{!puedeManejar || esVos ? null : sacando === e.id ? (`.

- [ ] **Paso 5: que compile** — `npm.cmd run build` → sin errores.

- [ ] **Paso 6: commit** (con aprobación)

```bash
git add src/app/equipo/page.js
git commit -m "Equipo: la ficha propia dice Vos"
```

---

### Tarea 8: cargar el negocio nuevo, y el cartel de la otra pestaña

**Archivos:**
- Modificar: `src/lib/datos.js` (`DatosProvider`)
- Modificar: `src/componentes/Aviso.js`

**Interfaces:**
- Produce: `useDatos().otroNegocio` → `null` | `{ nombre: string | null }`.

- [ ] **Paso 1: `useRef`.** En `src/lib/datos.js`, línea 12:

```js
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Paso 2: estado nuevo**, junto a los otros `useState` de `DatosProvider`:

```js
  // De qué negocio es lo que hay en pantalla. Al cambiar de negocio, hasta
  // tener el nuevo se muestra "cargando" y no lo del anterior.
  const cargadoDe = useRef(null);
  // Si desde otro dispositivo la cuenta pasó a otro negocio (o la sacaron de
  // éste): { nombre } del nuevo, o nombre null. Ver docs/multinegocio.md.
  const [otroNegocio, setOtroNegocio] = useState(null);
```

- [ ] **Paso 3: en el efecto de carga**, rama "Cuenta real todavía sin
  negocio", antes de `setDatos(VACIO)`:

```js
        cargadoDe.current = null;
```

y la rama "Cuenta real con negocio" queda:

```js
      // Cuenta real con negocio: se lee de Supabase, sólo lo de ese negocio.
      if (cargadoDe.current !== usuario.negocio_id) setCargando(true);
      try {
        const traido = await leerDeSupabase(usuario.negocio_id);
        if (!vivo) return;
        if (traido.negocio) {
          cargadoDe.current = usuario.negocio_id;
          setOtroNegocio(null);
          setDatos(traido);
          setFuente("supabase");
          setCargando(false);
          return;
        }

        // La base ya no deja ver este negocio. Si es porque la cuenta está en
        // otro —se cambió desde otro dispositivo— o porque la sacaron, lo
        // que hay en pantalla queda, con un cartel para recargar: cambiar
        // solo podría llevarse algo que se estaba escribiendo. Mientras
        // tanto la base rechaza lo que se intente guardar acá.
        const { data: ahora } = await supabase
          .from("usuario")
          .select("negocio_id")
          .eq("id", usuario.id)
          .maybeSingle();
        if (!vivo) return;
        if (ahora && ahora.negocio_id !== usuario.negocio_id) {
          const { data: suyos } = await supabase.rpc("mis_negocios");
          if (!vivo) return;
          setOtroNegocio({
            nombre: suyos?.find((n) => n.id === ahora.negocio_id)?.nombre ?? null,
          });
          setCargando(false);
          return;
        }

        setAviso(
          "Tu negocio todavía no aparece en la base. Esperá unos segundos y volvé a entrar."
        );
```

(el resto de la rama —`setDatos(VACIO)`, `catch`— sin cambios).

- [ ] **Paso 4: exponerlo.** En `const valor = { ... }`, junto a `aviso`:

```js
    otroNegocio,
```

- [ ] **Paso 5: el cartel.** En `src/componentes/Aviso.js`, `Banda` recibe el
  texto del botón:

```js
function Banda({ tono, icono, texto, alDescartar, deshacer, rol, textoDescartar = "Entendido" }) {
```

```js
        <Boton variante="plano" onClick={alDescartar}>
          {textoDescartar}
        </Boton>
```

y en `Aviso()`:

```js
  const { aviso, exito, deshacerExito, descartarAviso, descartarExito, otroNegocio } = useDatos();

  if (!exito && !aviso && !otroNegocio) return null;
```

con, después de la `Banda` de `aviso`:

```js
      {/* No se descarta: lo de abajo ya es de un negocio en el que no está.
          Recargar lee de nuevo la cuenta y entra al negocio en el que está. */}
      {otroNegocio && (
        <Banda
          rol="alert"
          tono="border-l-espera bg-espera-fondo text-espera"
          icono="alerta"
          texto={
            otroNegocio.nombre
              ? `Desde otro dispositivo pasaste a ${otroNegocio.nombre}. Lo que ves acá es del negocio anterior y ya no se guarda.`
              : "Ya no estás en este negocio. Lo que ves acá ya no se guarda."
          }
          textoDescartar="Recargar"
          alDescartar={() => window.location.reload()}
        />
      )}
```

- [ ] **Paso 6: que compile y que pasen las pruebas**

Correr: `npm.cmd run build` → sin errores.
Correr: `npm.cmd run test:unit` → pasan todas.

- [ ] **Paso 7: commit** (con aprobación)

```bash
git add src/lib/datos.js src/componentes/Aviso.js
git commit -m "Al cambiar de negocio, cargar el nuevo; avisar si cambió en otro dispositivo"
```

---

### Tarea 9: Google Calendar no se desconecta al cambiar de sucursal

**Archivos:**
- Modificar: `src/lib/google-calendar-server.js:204-207`

- [ ] **Paso 1:** reemplazar `sigueEnNegocio`:

```js
// Si la cuenta sigue en el negocio del calendario conectado: si tiene ficha
// ahí (docs/multinegocio.md). Pararse en otra sucursal no lo desconecta;
// que la saquen del equipo, sí. Sin la 038 corrida los dueños no tienen
// ficha: por eso vale también que sea su negocio activo.
export async function sigueEnNegocio(usuarioId, negocioId) {
  const [{ data: ficha }, { data: cuenta }] = await Promise.all([
    db.from("empleado").select("id")
      .eq("usuario_id", usuarioId).eq("negocio_id", negocioId).limit(1).maybeSingle(),
    db.from("usuario").select("negocio_id").eq("id", usuarioId).maybeSingle(),
  ]);
  return Boolean(ficha) || cuenta?.negocio_id === negocioId;
}
```

- [ ] **Paso 2: que compile** — `npm.cmd run build` → sin errores. No tiene
  prueba automática (necesita la base con la clave de servicio): va en la
  prueba a mano de la Tarea 10.

- [ ] **Paso 3: commit** (con aprobación)

```bash
git add src/lib/google-calendar-server.js
git commit -m "Google Calendar sigue conectado al cambiar de sucursal"
```

---

### Tarea 10: README, la prueba a mano, y la verificación final

**Archivos:**
- Modificar: `README.md` (paso 1 de "Conectar la base", y un párrafo después del de la 037)
- Modificar: `docs/multinegocio.md` (estado, y la prueba a mano)

- [ ] **Paso 1: README.** En "Conectar la base", `037_rol_da_permisos.sql` →
  `038_multinegocio.sql`, y sumar: *"Después de la 038, correr
  `supabase/pruebas/multinegocio.sql`: prueba el aislamiento y los permisos
  contra la base y no deja nada guardado."* Después del párrafo de la 037:

```md
**Varios negocios por cuenta** (`038_multinegocio.sql`, diseño en
`docs/multinegocio.md`). Una cuenta puede estar en varios negocios —sus
sucursales, o el propio y otro al que la invitaron—, con un rol en cada uno. Al
iniciar sesión elige a cuál entra, o entra directo al predeterminado si prendió
Inicio rápido; desde Mi perfil cambia de uno a otro. El negocio activo sigue en
`usuario.negocio_id`, así que el aislamiento no cambió: cambiar de negocio es
una función de la base que verifica que la cuenta tenga ficha ahí. El dueño
ahora tiene ficha y aparece en Equipo. A quien ya tenía un negocio no le cambia
nada: queda como predeterminado, con Inicio rápido prendido.
```

- [ ] **Paso 2: `docs/multinegocio.md`.** `Estado:` → *"aprobado;
  implementado en `development` (plan: `docs/multinegocio-plan.md`)"*. Al
  final, la sección:

```md
## Prueba a mano, con cuentas reales

Con la 038 corrida y la prueba de la base pasada. Dos cuentas: **Dueña** (con
un negocio) y **Otra** (sin nada).

1. Dueña inicia sesión → entra directo a su negocio (Inicio rápido, del pasaje).
2. Mi perfil → Tus negocios: su negocio con "· Dueño", "Estás acá",
   Predeterminado en Sí; Inicio rápido prendido. Equipo: su ficha con "Vos",
   sin desplegable ni "Sacar".
3. Mi perfil → Nuevo negocio → crear "Sucursal 2" → entra a la sucursal, vacía.
   Mi perfil: dos negocios; "Estás acá" en la Sucursal 2.
4. "Entrar" en el primero → Inicio del primero, con sus casos.
5. Apagar Predeterminado → Inicio rápido se apaga solo y queda "primero elegí
   uno predeterminado". Cerrar sesión e iniciar → "¿A qué negocio entrás?" con
   los dos. Elegir uno → entra.
6. Dueña invita a Otra como técnica. Otra crea cuenta, acepta → entra al
   negocio de Dueña. Otra crea un negocio propio → entra a ése como dueña.
   Mi perfil de Otra: dos negocios, "· Técnico" en uno y "· Dueño" en el otro.
7. Dueña saca a Otra del equipo. Otra, en la pestaña que tenía abierta en el
   negocio de Dueña, vuelve a la pestaña → cartel "Ya no estás en este
   negocio" → Recargar → su propio negocio (o el selector).
8. Dos dispositivos con Dueña: en uno cambiar a la Sucursal 2; en el otro,
   volver a la pestaña → "Desde otro dispositivo pasaste a Sucursal 2" →
   Recargar → la Sucursal 2.
9. Una cuenta que entró con Google: Mi perfil dice "Entrás con Google" y
   "Crear una".
10. Con Google Calendar conectado: cambiar de sucursal y esperar la
    sincronización (un minuto) → en Agenda del negocio conectado sigue
    conectado.
11. Modo de ejemplo: "Probá sin cuenta" → igual que antes, sin selector; Mi
    perfil dice "Tu negocio".
```

- [ ] **Paso 3: verificación final**

Correr: `npm.cmd run test:unit` → pasan todas (incluidas las 5 de `entrada`).
Correr: `npm.cmd run build` → sin errores.
Modo de ejemplo en el navegador (con el servidor del usuario parado, moviendo
`.env.local` al scratchpad y devolviéndolo al terminar): crear el negocio,
Inicio, Equipo, Mi perfil ("Tu negocio", sin "Tus negocios"), `/negocios` →
`/`. Revisar la consola sin errores.

- [ ] **Paso 4: commit** (con aprobación)

```bash
git add README.md docs/multinegocio.md
git commit -m "Varios negocios por cuenta: README y prueba a mano"
```

- [ ] **Paso 5: orden de publicación** (al usuario): 1) correr la 038 en
  Supabase; 2) correr `supabase/pruebas/multinegocio.sql`; 3) push y
  publicar el código.
