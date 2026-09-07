// Datos de ejemplo — el mismo taller que crea supabase/002_seed.sql.
//
// Se usan cuando no hay credenciales de Supabase configuradas, para que
// cualquiera pueda clonar el repo y ver la aplicación andando sin esperar
// a que alguien reparta las claves.
//
// Los datos del caso 248 son textuales de la sección 09 de la cartilla,
// así se puede comparar la pantalla contra el PDF al lado.

const hs = (n) => n * 60 * 60 * 1000;
const dias = (n) => hs(24 * n);

export function construirSemilla() {
  const ahora = Date.now();
  const hace = (ms) => new Date(ahora - ms).toISOString();

  const hoyALas = (h, m = 0) => {
    const d = new Date(ahora);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const enDias = (n, h, m = 0) => {
    const d = new Date(ahora + dias(n));
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const negocio = {
    id: "b0",
    nombre: "Taller Sur",
    rubro: "taller",
    modulos_activos: ["agenda", "inventario", "equipo", "presupuesto"],
  };

  const empleados = [
    { id: "e1", negocio_id: "b0", nombre: "Diego", rol: "tecnico" },
    { id: "e2", negocio_id: "b0", nombre: "Nico", rol: "tecnico" },
    { id: "e3", negocio_id: "b0", nombre: "Sofía", rol: "encargado" },
  ];

  const clientes = [
    { id: "c1", negocio_id: "b0", nombre: "Marcela Suárez", telefono: "341 456 7890", notas: "Deja el auto todo el día." },
    { id: "c2", negocio_id: "b0", nombre: "Lucía Ferreyra", telefono: "341 502 1188", notas: "" },
    { id: "c3", negocio_id: "b0", nombre: "Ramiro Paz", telefono: "341 611 3204", notas: "" },
    { id: "c4", negocio_id: "b0", nombre: "Julián Molina", telefono: "341 233 9017", notas: "Prefiere que le avisen por WhatsApp." },
    { id: "c5", negocio_id: "b0", nombre: "Sabrina Britos", telefono: "341 780 4451", notas: "" },
    { id: "c6", negocio_id: "b0", nombre: "Pablo Ríos", telefono: "341 344 2290", notas: "" },
    { id: "c7", negocio_id: "b0", nombre: "Carla Bianchi", telefono: "341 908 5512", notas: "" },
    { id: "c8", negocio_id: "b0", nombre: "Nahuel Sosa", telefono: "341 122 7788", notas: "" },
    { id: "c9", negocio_id: "b0", nombre: "Ana Duarte", telefono: "341 455 6621", notas: "" },
    { id: "ca", negocio_id: "b0", nombre: "Valeria Ocampo", telefono: "341 677 0043", notas: "" },
  ];

  const casos = [
    { id: "k248", negocio_id: "b0", numero: 248, cliente_id: "c1", servicio: "Revisión general", estado: "esperando", responsable_id: "e1", que_falta: "Espera respuesta del cliente", abierto_en: hace(dias(4)) },
    { id: "k245", negocio_id: "b0", numero: 245, cliente_id: "c2", servicio: "Cambio de pieza", estado: "esperando", responsable_id: null, que_falta: "El insumo llega mañana", abierto_en: hace(dias(6)) },
    { id: "k251", negocio_id: "b0", numero: 251, cliente_id: "c3", servicio: "Diagnóstico", estado: "en_proceso", responsable_id: "e2", que_falta: "Diagnóstico a medio cargar", abierto_en: hace(dias(1)) },
    { id: "k239", negocio_id: "b0", numero: 239, cliente_id: "c4", servicio: "Reparación", estado: "revision_final", responsable_id: "e3", que_falta: "Control antes de entregar", abierto_en: hace(dias(9)) },
    { id: "k249", negocio_id: "b0", numero: 249, cliente_id: "c7", servicio: "Service de 40.000 km", estado: "revision_final", responsable_id: "e1", que_falta: "Control antes de entregar", abierto_en: hace(dias(5)) },
    { id: "k252", negocio_id: "b0", numero: 252, cliente_id: "c8", servicio: "Frenos delanteros", estado: "en_proceso", responsable_id: "e2", que_falta: "Está en el taller", abierto_en: hace(dias(2)) },
    { id: "k253", negocio_id: "b0", numero: 253, cliente_id: "c5", servicio: "Primera consulta", estado: "nuevo", responsable_id: null, que_falta: "Asignar a alguien del equipo", abierto_en: hace(hs(3)) },
    { id: "k254", negocio_id: "b0", numero: 254, cliente_id: "c9", servicio: "Cambio de correa", estado: "nuevo", responsable_id: null, que_falta: "Asignar a alguien del equipo", abierto_en: hace(hs(1)) },
    { id: "k255", negocio_id: "b0", numero: 255, cliente_id: "ca", servicio: "Alineación y balanceo", estado: "en_proceso", responsable_id: "e3", que_falta: "Está en el taller", abierto_en: hace(dias(1)) },
    { id: "k232", negocio_id: "b0", numero: 232, cliente_id: "c6", servicio: "Mantenimiento", estado: "completado", responsable_id: null, que_falta: "Cobrado el viernes", abierto_en: hace(dias(14)) },
  ];

  const pasos = [
    // Caso 248 — aprobado $96.000 · esperando $88.500 · todo el caso $184.500
    { id: "p1", caso_id: "k248", nombre: "Revisión completa", descripcion: "Diagnóstico de todo lo que se detectó. Incluye la mano de obra.", monto: 74000, estado: "aprobado", orden: 1 },
    { id: "p2", caso_id: "k248", nombre: "Cambio de la pieza principal", descripcion: "Está al límite. Conviene hacerlo ahora.", monto: 22000, estado: "aprobado", orden: 2 },
    { id: "p3", caso_id: "k248", nombre: "Reemplazo de las dos piezas de apoyo", descripcion: "Se pueden hacer más adelante sin riesgo.", monto: 58500, estado: "esperando", orden: 3 },
    { id: "p4", caso_id: "k248", nombre: "Mantenimiento de rutina", descripcion: "Ya pasó el plazo recomendado.", monto: 18000, estado: "esperando", orden: 4 },
    { id: "p5", caso_id: "k248", nombre: "Control final y ajuste", descripcion: "Conviene después de los cambios anteriores.", monto: 12000, estado: "esperando", orden: 5 },

    { id: "p6", caso_id: "k239", nombre: "Reparación del sistema", descripcion: "Lo que se detectó en el diagnóstico.", monto: 96000, estado: "aprobado", orden: 1 },
    { id: "p7", caso_id: "k239", nombre: "Cambio de dos soportes", descripcion: "Estaban flojos.", monto: 31000, estado: "aprobado", orden: 2 },
    { id: "p8", caso_id: "k245", nombre: "Cambio de la pieza rota", descripcion: "Falta que llegue el repuesto.", monto: 48000, estado: "aprobado", orden: 1 },
    { id: "p9", caso_id: "k249", nombre: "Service completo", descripcion: "Aceite, filtros y revisión general.", monto: 85000, estado: "aprobado", orden: 1 },
    { id: "p10", caso_id: "k249", nombre: "Cambio de bujías", descripcion: "Ya cumplieron su vida útil.", monto: 24500, estado: "esperando", orden: 2 },
    { id: "p11", caso_id: "k252", nombre: "Pastillas delanteras", descripcion: "Están al límite.", monto: 42000, estado: "esperando", orden: 1 },
    { id: "p12", caso_id: "k252", nombre: "Discos delanteros", descripcion: "Conviene cambiarlos junto con las pastillas.", monto: 68000, estado: "esperando", orden: 2 },
    { id: "p13", caso_id: "k232", nombre: "Mantenimiento de rutina", descripcion: "El de todos los años.", monto: 55000, estado: "aprobado", orden: 1 },
  ];

  const eventos = [
    // Historial del caso 248, de lo último a lo primero.
    { id: "v1", caso_id: "k248", titulo: "Pasos enviados por WhatsApp", detalle: "5 pasos por $184.500. La clienta aprobó 2.", autor: "Encargado", icono: "reloj", ocurrido_en: hace(hs(5)) },
    { id: "v2", caso_id: "k248", titulo: "Diagnóstico cargado", detalle: "Dos problemas detectados y 3 fotos.", autor: "Diego", icono: "llave", ocurrido_en: hace(dias(1) + hs(7)) },
    { id: "v3", caso_id: "k248", titulo: "Empezó el trabajo", detalle: "La clienta lo deja todo el día.", autor: "Diego", icono: "llave", ocurrido_en: hace(dias(1) + hs(15)) },
    { id: "v4", caso_id: "k248", titulo: "Caso abierto", detalle: "La clienta llamó por un ruido raro.", autor: "Mostrador", icono: "carpeta", ocurrido_en: hace(dias(4)) },
    ...casos
      .filter((c) => c.id !== "k248")
      .map((c, i) => ({
        id: "va" + i,
        caso_id: c.id,
        titulo: "Caso abierto",
        detalle: "Entró por mostrador.",
        autor: "Mostrador",
        icono: "carpeta",
        ocurrido_en: c.abierto_en,
      })),
  ];

  const insumos = [
    { id: "i1", negocio_id: "b0", nombre: "Pieza principal", descripcion: "La del caso 245.", cantidad: 1, minimo: 0, unidad: "unidad", estado: "llegado", caso_id: "k245" },
    { id: "i2", negocio_id: "b0", nombre: "Aceite 10W40", descripcion: "Bidón de 4 litros.", cantidad: 12, minimo: 4, unidad: "bidón", estado: "en_stock", caso_id: null },
    { id: "i3", negocio_id: "b0", nombre: "Filtro de aceite", descripcion: "Medida común.", cantidad: 3, minimo: 5, unidad: "unidad", estado: "en_stock", caso_id: null },
    { id: "i4", negocio_id: "b0", nombre: "Filtro de aire", descripcion: "", cantidad: 7, minimo: 3, unidad: "unidad", estado: "en_stock", caso_id: null },
    { id: "i5", negocio_id: "b0", nombre: "Pastillas de freno", descripcion: "Juego delantero.", cantidad: 2, minimo: 4, unidad: "juego", estado: "en_stock", caso_id: null },
    { id: "i6", negocio_id: "b0", nombre: "Bujías", descripcion: "Juego de cuatro.", cantidad: 9, minimo: 4, unidad: "juego", estado: "en_stock", caso_id: null },
    { id: "i7", negocio_id: "b0", nombre: "Correa de distribución", descripcion: "Pedida para el caso 254.", cantidad: 1, minimo: 0, unidad: "unidad", estado: "pedido", caso_id: "k254" },
    { id: "i8", negocio_id: "b0", nombre: "Líquido de frenos", descripcion: "", cantidad: 5, minimo: 2, unidad: "botella", estado: "en_stock", caso_id: null },
  ];

  const turnos = [
    { id: "t1", negocio_id: "b0", cliente_id: "c5", caso_id: "k253", motivo: "Primera consulta", empieza_en: hoyALas(9), minutos: 45, estado: "confirmado" },
    { id: "t2", negocio_id: "b0", cliente_id: "c1", caso_id: "k248", motivo: "Entrega del auto", empieza_en: hoyALas(11, 30), minutos: 30, estado: "agendado" },
    { id: "t3", negocio_id: "b0", cliente_id: "c9", caso_id: "k254", motivo: "Cambio de correa", empieza_en: hoyALas(15), minutos: 90, estado: "confirmado" },
    { id: "t4", negocio_id: "b0", cliente_id: "c8", caso_id: "k252", motivo: "Revisión de frenos", empieza_en: enDias(1, 10), minutos: 60, estado: "agendado" },
    { id: "t5", negocio_id: "b0", cliente_id: "c7", caso_id: null, motivo: "Presupuesto de chapa", empieza_en: enDias(1, 16), minutos: 30, estado: "agendado" },
    { id: "t6", negocio_id: "b0", cliente_id: "c3", caso_id: "k251", motivo: "Retirar el diagnóstico", empieza_en: enDias(2, 9, 30), minutos: 30, estado: "agendado" },
  ];

  return { negocio, empleados, clientes, casos, pasos, eventos, insumos, turnos };
}
