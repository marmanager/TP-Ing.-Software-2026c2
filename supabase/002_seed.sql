-- ============================================================
-- 002_seed.sql — datos de ejemplo
-- Un taller mecánico con 9 casos abiertos.
--
-- Los datos del caso 248 son textuales de la sección 09 de la cartilla
-- de diseño, para poder comparar la pantalla contra el PDF al lado.
--
-- Es idempotente: borra y recrea. Se puede correr todas las veces que
-- haga falta para volver al estado inicial conocido (por ejemplo,
-- justo antes de la demo).
-- ============================================================

-- Borra en orden inverso a las dependencias.
truncate turno, insumo, evento, paso, caso, empleado, cliente, negocio restart identity cascade;

-- ---------- negocio ----------
insert into negocio (id, nombre, rubro, modulos_activos) values
  ('00000000-0000-0000-0000-0000000000b0', 'Taller Sur', 'taller',
   '["agenda", "inventario", "equipo", "presupuesto"]'::jsonb);

-- ---------- empleados ----------
insert into empleado (id, negocio_id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b0', 'Diego', 'tecnico'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b0', 'Nico',  'tecnico'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000b0', 'Sofía', 'encargado');

-- ---------- clientes ----------
insert into cliente (id, negocio_id, nombre, telefono, notas) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b0', 'Marcela Suárez', '341 456 7890', 'Deja el auto todo el día.'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b0', 'Lucía Ferreyra', '341 502 1188', null),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b0', 'Ramiro Paz',     '341 611 3204', null),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b0', 'Julián Molina',  '341 233 9017', 'Prefiere que le avisen por WhatsApp.'),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000b0', 'Sabrina Britos', '341 780 4451', null),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000b0', 'Pablo Ríos',     '341 344 2290', null),
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000b0', 'Carla Bianchi',  '341 908 5512', null),
  ('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000b0', 'Nahuel Sosa',    '341 122 7788', null),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000b0', 'Ana Duarte',     '341 455 6621', null),
  ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000b0', 'Valeria Ocampo', '341 677 0043', null);

-- ---------- casos ----------
-- responsable_id en null se muestra derivado del estado:
-- esperando -> "Proveedor", completado -> "Entregado", resto -> "Sin asignar".
insert into caso (id, negocio_id, numero, cliente_id, servicio, estado, responsable_id, que_falta, abierto_en) values
  ('00000000-0000-0000-0000-000000000248', '00000000-0000-0000-0000-0000000000b0', 248, '00000000-0000-0000-0000-0000000000c1', 'Revisión general',        'esperando',      '00000000-0000-0000-0000-0000000000e1', 'Espera respuesta del cliente',  now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000245', '00000000-0000-0000-0000-0000000000b0', 245, '00000000-0000-0000-0000-0000000000c2', 'Cambio de pieza',         'esperando',      null,                                   'El insumo llega mañana',        now() - interval '6 days'),
  ('00000000-0000-0000-0000-000000000251', '00000000-0000-0000-0000-0000000000b0', 251, '00000000-0000-0000-0000-0000000000c3', 'Diagnóstico',             'en_proceso',     '00000000-0000-0000-0000-0000000000e2', 'Diagnóstico a medio cargar',    now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000239', '00000000-0000-0000-0000-0000000000b0', 239, '00000000-0000-0000-0000-0000000000c4', 'Reparación',              'revision_final', '00000000-0000-0000-0000-0000000000e3', 'Control antes de entregar',     now() - interval '9 days'),
  ('00000000-0000-0000-0000-000000000249', '00000000-0000-0000-0000-0000000000b0', 249, '00000000-0000-0000-0000-0000000000c7', 'Service de 40.000 km',    'revision_final', '00000000-0000-0000-0000-0000000000e1', 'Control antes de entregar',     now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000252', '00000000-0000-0000-0000-0000000000b0', 252, '00000000-0000-0000-0000-0000000000c8', 'Frenos delanteros',       'en_proceso',     '00000000-0000-0000-0000-0000000000e2', 'Está en el taller',             now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000253', '00000000-0000-0000-0000-0000000000b0', 253, '00000000-0000-0000-0000-0000000000c5', 'Primera consulta',        'nuevo',          null,                                   'Asignar a alguien del equipo',  now() - interval '3 hours'),
  ('00000000-0000-0000-0000-000000000254', '00000000-0000-0000-0000-0000000000b0', 254, '00000000-0000-0000-0000-0000000000c9', 'Cambio de correa',        'nuevo',          null,                                   'Asignar a alguien del equipo',  now() - interval '1 hour'),
  ('00000000-0000-0000-0000-000000000255', '00000000-0000-0000-0000-0000000000b0', 255, '00000000-0000-0000-0000-0000000000ca', 'Alineación y balanceo',   'en_proceso',     '00000000-0000-0000-0000-0000000000e3', 'Está en el taller',             now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000232', '00000000-0000-0000-0000-0000000000b0', 232, '00000000-0000-0000-0000-0000000000c6', 'Mantenimiento',           'completado',     null,                                   'Cobrado el viernes',            now() - interval '14 days');

-- ---------- pasos del caso 248 ----------
-- Textuales de la cartilla: aprobado $96.000 · esperando $88.500 · total $184.500
insert into paso (caso_id, nombre, descripcion, monto, estado, orden) values
  ('00000000-0000-0000-0000-000000000248', 'Revisión completa',                    'Diagnóstico de todo lo que se detectó. Incluye la mano de obra.', 74000.00, 'aprobado',  1),
  ('00000000-0000-0000-0000-000000000248', 'Cambio de la pieza principal',         'Está al límite. Conviene hacerlo ahora.',                        22000.00, 'aprobado',  2),
  ('00000000-0000-0000-0000-000000000248', 'Reemplazo de las dos piezas de apoyo', 'Se pueden hacer más adelante sin riesgo.',                       58500.00, 'esperando', 3),
  ('00000000-0000-0000-0000-000000000248', 'Mantenimiento de rutina',              'Ya pasó el plazo recomendado.',                                  18000.00, 'esperando', 4),
  ('00000000-0000-0000-0000-000000000248', 'Control final y ajuste',               'Conviene después de los cambios anteriores.',                    12000.00, 'esperando', 5);

-- ---------- pasos de otros casos ----------
insert into paso (caso_id, nombre, descripcion, monto, estado, orden) values
  ('00000000-0000-0000-0000-000000000239', 'Reparación del sistema',   'Lo que se detectó en el diagnóstico.', 96000.00, 'aprobado',  1),
  ('00000000-0000-0000-0000-000000000239', 'Cambio de dos soportes',   'Estaban flojos.',                      31000.00, 'aprobado',  2),
  ('00000000-0000-0000-0000-000000000245', 'Cambio de la pieza rota',  'Falta que llegue el repuesto.',        48000.00, 'aprobado',  1),
  ('00000000-0000-0000-0000-000000000249', 'Service completo',         'Aceite, filtros y revisión general.',  85000.00, 'aprobado',  1),
  ('00000000-0000-0000-0000-000000000249', 'Cambio de bujías',         'Ya cumplieron su vida útil.',          24500.00, 'esperando', 2),
  ('00000000-0000-0000-0000-000000000252', 'Pastillas delanteras',     'Están al límite.',                     42000.00, 'esperando', 1),
  ('00000000-0000-0000-0000-000000000252', 'Discos delanteros',        'Conviene cambiarlos junto con las pastillas.', 68000.00, 'esperando', 2),
  ('00000000-0000-0000-0000-000000000232', 'Mantenimiento de rutina',  'El de todos los años.',                55000.00, 'aprobado',  1);

-- ---------- historial del caso 248 ----------
-- De lo último a lo primero, textual de la cartilla.
insert into evento (caso_id, titulo, detalle, autor, icono, ocurrido_en) values
  ('00000000-0000-0000-0000-000000000248', 'Pasos enviados por WhatsApp', '5 pasos por $184.500. La clienta aprobó 2.', 'Encargado', 'reloj',   now() - interval '5 hours'),
  ('00000000-0000-0000-0000-000000000248', 'Diagnóstico cargado',         'Dos problemas detectados y 3 fotos.',        'Diego',     'llave',   now() - interval '1 day 7 hours'),
  ('00000000-0000-0000-0000-000000000248', 'Empezó el trabajo',           'La clienta lo deja todo el día.',            'Diego',     'llave',   now() - interval '1 day 15 hours'),
  ('00000000-0000-0000-0000-000000000248', 'Caso abierto',                'La clienta llamó por un ruido raro.',        'Mostrador', 'carpeta', now() - interval '4 days');

-- ---------- historial del resto ----------
insert into evento (caso_id, titulo, detalle, autor, icono, ocurrido_en)
select id, 'Caso abierto', 'Entró por mostrador.', 'Mostrador', 'carpeta', abierto_en
from caso
where id <> '00000000-0000-0000-0000-000000000248';

-- ---------- inventario ----------
-- El insumo "llegado" es el que alimenta la tarjeta
-- "Insumos que llegaron · 1 pedido · Pieza del caso 245" de la pantalla Hoy.
insert into insumo (negocio_id, nombre, descripcion, cantidad, minimo, unidad, estado, caso_id) values
  ('00000000-0000-0000-0000-0000000000b0', 'Pieza principal',      'La del caso 245.',                 1, 0, 'unidad', 'llegado', '00000000-0000-0000-0000-000000000245'),
  ('00000000-0000-0000-0000-0000000000b0', 'Aceite 10W40',         'Bidón de 4 litros.',              12, 4, 'bidón',  'en_stock', null),
  ('00000000-0000-0000-0000-0000000000b0', 'Filtro de aceite',     'Medida común.',                    3, 5, 'unidad', 'en_stock', null),
  ('00000000-0000-0000-0000-0000000000b0', 'Filtro de aire',       null,                               7, 3, 'unidad', 'en_stock', null),
  ('00000000-0000-0000-0000-0000000000b0', 'Pastillas de freno',   'Juego delantero.',                 2, 4, 'juego',  'en_stock', null),
  ('00000000-0000-0000-0000-0000000000b0', 'Bujías',               'Juego de cuatro.',                 9, 4, 'juego',  'en_stock', null),
  ('00000000-0000-0000-0000-0000000000b0', 'Correa de distribución','Pedida para el caso 254.',        1, 0, 'unidad', 'pedido',  '00000000-0000-0000-0000-000000000254'),
  ('00000000-0000-0000-0000-0000000000b0', 'Líquido de frenos',    null,                               5, 2, 'botella','en_stock', null);

-- ---------- agenda ----------
insert into turno (negocio_id, cliente_id, caso_id, motivo, empieza_en, minutos, estado) values
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-000000000253', 'Primera consulta',        date_trunc('day', now()) + interval '9 hours',            45, 'confirmado'),
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000248', 'Entrega del auto',        date_trunc('day', now()) + interval '11 hours 30 minutes', 30, 'agendado'),
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-000000000254', 'Cambio de correa',        date_trunc('day', now()) + interval '15 hours',            90, 'confirmado'),
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-000000000252', 'Revisión de frenos',      date_trunc('day', now()) + interval '1 day 10 hours',      60, 'agendado'),
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c7', null,                                   'Presupuesto de chapa',    date_trunc('day', now()) + interval '1 day 16 hours',      30, 'agendado'),
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000251', 'Retirar el diagnóstico',  date_trunc('day', now()) + interval '2 days 9 hours 30 minutes', 30, 'agendado');
