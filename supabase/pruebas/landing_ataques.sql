-- ============================================================
-- pruebas/landing_ataques.sql — ataques a la landing (053) desde afuera
--
-- Correr entero en el SQL Editor de Supabase (o con roles/pg-local/pg.sh run).
-- Complementa a pruebas/landing.sql: aquella prueba que la landing anda; ésta
-- prueba que no se la puede usar para llegar a lo de otro.
--
-- Todo se llama como anon, que es como llega alguien que salta la API y usa
-- la clave pública de Supabase directo.
--
-- No deja nada: crea cuentas, negocios, clientes y casos de mentira, prueba,
-- y al final lo deshace todo con un error a propósito ('deshacer') que se
-- atrapa.
--
--   "Success. No rows returned"       → pasaron todas.
--   un error que empieza con "FALLÓ"  → dice cuál no pasó.
--   cualquier otro error              → la prueba no pudo correr.
--
-- La 8 no falla: el tope de intentos es por identificador, y rociar muchos
-- identificadores distintos sólo lo frena el límite por IP de la API. Queda
-- como aviso (NOTICE) para que se vea si alguna vez cambia.
-- ============================================================

do $prueba$
declare
  ana  uuid := gen_random_uuid();  -- dueña del Taller A
  beto uuid := gen_random_uuid();  -- dueño del Taller B
  neg_a uuid;
  neg_b uuid;
  cod_a  text;
  cod_b  text;
  cod_a2 text;                     -- el link de A después de volver a compartir
  marcela uuid;
  sin_tel uuid;
  corto   uuid;
  otro_b  uuid;                    -- tiene la misma patente que Marcela, en B
  r       jsonb;
  llave_a text;
  llave_b text;
  i       integer;
begin
  begin
    insert into auth.users (id, email) values
      (ana,  'prueba-ana-'  || ana  || '@ejemplo.test'),
      (beto, 'prueba-beto-' || beto || '@ejemplo.test');

    -- ---- Los negocios y sus links ----
    perform set_config('role', 'authenticated', true);

    perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
    neg_b := crear_mi_negocio('Taller B', 'taller', '[]'::jsonb);
    cod_b := compartir_landing();

    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    neg_a := crear_mi_negocio('Taller A', 'taller', '[]'::jsonb);
    cod_a := compartir_landing();

    -- ---- Los datos, como postgres ----
    perform set_config('role', 'postgres', true);

    insert into cliente (negocio_id, nombre, telefono) values (neg_a, 'Marcela', '341 456 7890')
      returning id into marcela;
    insert into cliente (negocio_id, nombre, telefono) values (neg_a, 'Sin teléfono', null)
      returning id into sin_tel;
    insert into cliente (negocio_id, nombre, telefono) values (neg_a, 'Teléfono corto', '123')
      returning id into corto;
    -- La misma patente que Marcela, en el otro negocio y con otro teléfono.
    insert into cliente (negocio_id, nombre, telefono) values (neg_b, 'Otro dueño', '11 0000 9999')
      returning id into otro_b;

    insert into caso (negocio_id, numero, cliente_id, servicio, identificador, estado) values
      (neg_a, 1, marcela, 'Secreto de A', 'AB123CD', 'nuevo'),
      (neg_a, 2, sin_tel, 'Sin teléfono', 'SINTEL1', 'nuevo'),
      (neg_a, 3, corto,   'Corto',        'CORTO12', 'nuevo'),
      (neg_b, 1, otro_b,  'Caso de B',    'AB123CD', 'nuevo');

    -- De acá en adelante, alguien sin cuenta.
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);

    -- ---- 1. Inyección SQL en el código del link y en la patente ----
    if (ver_landing($$' or '1'='1$$)->>'sirve')::boolean is distinct from false
       or ingresar_landing(cod_a, $$' OR 1=1 --$$, '7890')->>'ok' is distinct from 'false' then
      raise exception 'FALLÓ 1: una inyección SQL en el código o en la patente entra.';
    end if;

    -- ---- 2. Comodines en los 4 dígitos ----
    if ingresar_landing(cod_a, 'AB123CD', '%%%%')->>'ok' is distinct from 'false'
       or ingresar_landing(cod_a, 'AB123CD', '____')->>'ok' is distinct from 'false'
       or ingresar_landing(cod_a, 'AB123CD', '.*.*')->>'ok' is distinct from 'false' then
      raise exception 'FALLÓ 2: un comodín (%%, _ o regex) en los dígitos entra.';
    end if;

    -- ---- 3. Clientes sin teléfono o con menos de 4 dígitos ----
    if coalesce(ingresar_landing(cod_a, 'SINTEL1', '')->>'ok', 'false')   <> 'false'
       or coalesce(ingresar_landing(cod_a, 'SINTEL1', null)->>'ok', 'false') <> 'false'
       or ingresar_landing(cod_a, 'CORTO12', '123')->>'ok'  is distinct from 'false'
       or ingresar_landing(cod_a, 'CORTO12', '0123')->>'ok' is distinct from 'false' then
      raise exception 'FALLÓ 3: entra un cliente sin teléfono o con teléfono de menos de 4 dígitos.';
    end if;

    -- ---- 4. Los datos de A no abren la misma patente en B ----
    if ingresar_landing(cod_b, 'AB123CD', '7890')->>'ok' is distinct from 'false' then
      raise exception 'FALLÓ 4: con los dígitos de un cliente de A se entra a la landing de B.';
    end if;

    -- ---- 5. Llaves cruzadas, vacías o inventadas ----
    r := ingresar_landing(cod_a, 'AB123CD', '7890');
    llave_a := r->>'llave';
    r := ingresar_landing(cod_b, 'AB123CD', '9999');
    llave_b := r->>'llave';
    if llave_a is null or llave_b is null then
      raise exception 'FALLÓ 5: con los datos buenos no se pudo entrar, la prueba no puede seguir.';
    end if;

    if mis_casos_landing(cod_b, llave_a)->>'ok'  is distinct from 'false'
       or mis_turnos_landing(cod_b, llave_a)->>'ok' is distinct from 'false'
       or mis_casos_landing(cod_a, llave_b)->>'ok'  is distinct from 'false'
       or mis_casos_landing(cod_a, '')->>'ok'       is distinct from 'false'
       or mis_casos_landing(cod_a, '%')->>'ok'      is distinct from 'false'
       or coalesce(mis_casos_landing(cod_a, null)->>'ok', 'false') <> 'false' then
      raise exception 'FALLÓ 5: sirve la llave de otro negocio, una vacía, un comodín o null.';
    end if;
    if (mis_casos_landing(cod_a, llave_a)->'casos')::text like '%Caso de B%'
       or (mis_casos_landing(cod_a, llave_a)->'casos')::text not like '%Secreto de A%' then
      raise exception 'FALLÓ 5: con la llave de A no se ven exactamente los casos de A.';
    end if;

    -- ---- 6. Escribir la patente de otras formas no esquiva el bloqueo ----
    for i in 1..5 loop
      perform ingresar_landing(
        cod_a, (array['AB123CD', 'ab-123-cd', 'ab 123 cd', 'Ab.123.Cd', 'a b 1 2 3 c d'])[i], '000' || i);
    end loop;
    r := ingresar_landing(cod_a, 'AB123CD', '7890');
    if r->>'motivo' is distinct from 'muchos_intentos' then
      raise exception 'FALLÓ 6: escribiendo la patente de otra forma se esquiva el bloqueo: %', r;
    end if;

    -- ---- 7. Dejar de compartir mata el link y las llaves viejas ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
    perform dejar_de_compartir_landing();
    cod_a2 := compartir_landing();
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);

    if (ver_landing(cod_a)->>'sirve')::boolean is distinct from false
       or mis_casos_landing(cod_a2, llave_a)->>'ok' is distinct from 'false'
       or cod_a2 = cod_a then
      raise exception 'FALLÓ 7: después de dejar de compartir, el link o una llave vieja siguen sirviendo.';
    end if;

    -- ---- 8. Rociar identificadores distintos (límite conocido) ----
    for i in 1..50 loop
      r := ingresar_landing(cod_a2, 'ZZ' || lpad(i::text, 3, '0') || 'ZZ', '1234');
      exit when r->>'motivo' = 'muchos_intentos';
    end loop;
    if r->>'motivo' = 'muchos_intentos' then
      raise notice 'La base ahora corta al rociar identificadores (a los % intentos): actualizar esta prueba.', i;
    else
      raise notice 'Límite conocido (8): 50 identificadores distintos seguidos y ninguno bloqueado; el tope por IP es de la API.';
    end if;

    raise exception 'deshacer';
  exception when raise_exception then
    if sqlerrm <> 'deshacer' then
      raise;
    end if;
  end;
end
$prueba$;
