-- ============================================================
-- 001_schema.sql — estructura inicial
-- Proyecto SCRUM · ITBA Grupo 6 · Ingeniería de Software
--
-- Correr entero en el SQL Editor de Supabase. Es idempotente:
-- se puede volver a correr sin romper nada.
--
-- NOTA SOBRE SEGURIDAD (decisión consciente, no olvido):
-- las tablas quedan SIN Row Level Security porque todavía no hay login.
-- Eso significa que la clave anónima puede leer y escribir todo.
-- Es aceptable para el Sprint 1, que corre en localhost con datos inventados.
-- El aislamiento por negocio va junto con el login, en el Sprint 2.
-- ============================================================

-- ---------- negocio ----------
-- Una fila por negocio. En el Sprint 1 hay una sola por cuenta.
-- "rubro" elige el preset: renombra las etiquetas de los estados,
-- no cambia ni el color ni el ícono (regla de la cartilla, sección 02).
-- "modulos_activos" es la lista de módulos prendidos (SCRUM-38); el preset
-- la deja cargada al crear el negocio (SCRUM-12).
create table if not exists negocio (
  id              uuid primary key default gen_random_uuid(),
  nombre          text        not null,
  rubro           text        not null default 'taller'
                  check (rubro in ('taller', 'medicina', 'service')),
  modulos_activos jsonb       not null default '[]'::jsonb,
  creado_en       timestamptz not null default now()
);

-- ---------- cliente ----------
create table if not exists cliente (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid        not null references negocio (id) on delete cascade,
  nombre      text        not null,
  telefono    text,
  email       text,
  notas       text,
  creado_en   timestamptz not null default now()
);

create index if not exists cliente_negocio_idx on cliente (negocio_id);

-- ---------- empleado ----------
-- Quién puede quedar como responsable de un caso.
create table if not exists empleado (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid        not null references negocio (id) on delete cascade,
  nombre      text        not null,
  rol         text        not null default 'tecnico'
              check (rol in ('duenio', 'encargado', 'tecnico')),
  creado_en   timestamptz not null default now()
);

create index if not exists empleado_negocio_idx on empleado (negocio_id);

-- ---------- caso ----------
-- La entidad central del producto: un trabajo que entra, avanza por
-- estados, se presupuesta, se entrega y se cobra.
--
-- Los cinco estados son fijos. Un preset los renombra y puede esconder
-- los que no usa, pero no puede agregar un sexto.
create table if not exists caso (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid        not null references negocio (id) on delete cascade,
  numero          integer     not null,
  cliente_id      uuid        references cliente (id) on delete set null,
  servicio        text        not null,
  estado          text        not null default 'nuevo'
                  check (estado in ('nuevo', 'en_proceso', 'esperando', 'revision_final', 'completado')),
  responsable_id  uuid        references empleado (id) on delete set null,
  que_falta       text,
  abierto_en      timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  unique (negocio_id, numero)
);

create index if not exists caso_negocio_estado_idx on caso (negocio_id, estado);

-- ---------- paso ----------
-- Cada línea del presupuesto que el cliente aprueba o rechaza por separado.
-- Es la pantalla que la cartilla llama "la decisión que más plata mueve".
create table if not exists paso (
  id           uuid primary key default gen_random_uuid(),
  caso_id      uuid        not null references caso (id) on delete cascade,
  nombre       text        not null,
  descripcion  text,
  monto        numeric(12, 2) not null default 0 check (monto >= 0),
  estado       text        not null default 'esperando'
               check (estado in ('esperando', 'aprobado', 'rechazado')),
  orden        integer     not null default 0,
  creado_en    timestamptz not null default now()
);

create index if not exists paso_caso_idx on paso (caso_id, orden);

-- ---------- evento ----------
-- El historial del caso: qué pasó, cuándo y quién lo hizo,
-- con las palabras del negocio y no con códigos.
create table if not exists evento (
  id           uuid primary key default gen_random_uuid(),
  caso_id      uuid        not null references caso (id) on delete cascade,
  titulo       text        not null,
  detalle      text,
  autor        text        not null default 'Mostrador',
  icono        text        not null default 'carpeta',
  ocurrido_en  timestamptz not null default now()
);

create index if not exists evento_caso_idx on evento (caso_id, ocurrido_en desc);

-- ---------- insumo ----------
-- Inventario. Un insumo puede estar en stock, pedido para un caso,
-- o recién llegado y esperando que alguien lo use.
create table if not exists insumo (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid        not null references negocio (id) on delete cascade,
  nombre       text        not null,
  descripcion  text,
  cantidad     integer     not null default 0 check (cantidad >= 0),
  minimo       integer     not null default 0 check (minimo >= 0),
  unidad       text        not null default 'unidad',
  estado       text        not null default 'en_stock'
               check (estado in ('en_stock', 'pedido', 'llegado')),
  caso_id      uuid        references caso (id) on delete set null,
  creado_en    timestamptz not null default now()
);

create index if not exists insumo_negocio_idx on insumo (negocio_id, estado);

-- ---------- turno ----------
-- Agenda. Un turno puede o no estar atado a un caso ya abierto.
create table if not exists turno (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid        not null references negocio (id) on delete cascade,
  cliente_id   uuid        references cliente (id) on delete set null,
  caso_id      uuid        references caso (id) on delete set null,
  motivo       text        not null,
  empieza_en   timestamptz not null,
  minutos      integer     not null default 60 check (minutos > 0),
  estado       text        not null default 'agendado'
               check (estado in ('agendado', 'confirmado', 'cancelado', 'atendido')),
  creado_en    timestamptz not null default now()
);

create index if not exists turno_negocio_fecha_idx on turno (negocio_id, empieza_en);

-- ---------- actualizado_en automático en caso ----------
create or replace function tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists caso_actualizado_en on caso;
create trigger caso_actualizado_en
  before update on caso
  for each row
  execute function tocar_actualizado_en();
