// Los cinco estados del núcleo común (cartilla, sección 02).
//
// Son fijos. Un preset de rubro puede renombrarlos y esconder los que no usa,
// pero no puede agregar un sexto color ni cambiar el ícono de uno existente.
//
// Las clases de Tailwind van escritas enteras a propósito: el escáner de
// Tailwind lee el código fuente, así que un `bg-${x}-fondo` no generaría nada.

// La extensión va escrita: Next la perdona, pero `node --test` corre con el
// ESM de Node, que la pide. Sin ella los tests no encuentran el módulo.
import { preset } from "./presets.js";

export const ORDEN_ESTADOS = [
  "nuevo",
  "en_proceso",
  "esperando",
  "revision_final",
  "completado",
];

export const ESTADOS = {
  nuevo: {
    clave: "nuevo",
    icono: "carpeta",
    texto: "text-nuevo",
    fondo: "bg-nuevo-fondo",
    barra: "bg-nuevo",
    borde: "border-nuevo",
    significado: "El caso está anotado pero todavía nadie empezó a trabajarlo.",
  },
  en_proceso: {
    clave: "en_proceso",
    icono: "llave",
    texto: "text-proceso",
    fondo: "bg-proceso-fondo",
    barra: "bg-proceso",
    borde: "border-proceso",
    significado: "Alguien del equipo lo está atendiendo ahora.",
  },
  esperando: {
    clave: "esperando",
    icono: "reloj",
    texto: "text-espera",
    fondo: "bg-espera-fondo",
    barra: "bg-espera",
    borde: "border-espera",
    significado:
      "Está detenido por algo de afuera: una aprobación, un insumo o la respuesta del cliente.",
  },
  revision_final: {
    clave: "revision_final",
    icono: "nota",
    texto: "text-revision",
    fondo: "bg-revision-fondo",
    barra: "bg-revision",
    borde: "border-revision",
    significado: "El trabajo está hecho y se está controlando antes de entregarlo.",
  },
  completado: {
    clave: "completado",
    icono: "listo",
    texto: "text-completo",
    fondo: "bg-completo-fondo",
    barra: "bg-completo",
    borde: "border-completo",
    significado: "Entregado al cliente y cerrado.",
  },
};

// Un caso está abierto mientras no se entregó.
export const estaAbierto = (caso) => caso.estado !== "completado";

// Qué falta hacer en un caso, dicho en el idioma del mostrador.
//
// Sale de los pasos y los insumos del caso, no de una tabla por estado: la
// cartilla (sección 05, punto 5 de la anatomía de la tarjeta) pide que diga
// el próximo paso, y su ejemplo es «que la clienta apruebe 3 de los 5 pasos».
// Con una tabla por estado terminaba repitiendo el chip: para en_proceso
// devolvía "Está en el taller", que es la etiqueta del estado.
//
// El orden importa: gana lo más concreto. Que el cliente conteste tres pasos
// es más accionable que "está en el taller".
export function queFalta(caso, { rubro, pasos = [], insumos = [], cliente } = {}) {
  if (caso.estado === "completado") return "Nada, el caso está cerrado.";

  if (caso.estado === "nuevo" && !caso.responsable_id) {
    return "Asignar a alguien del equipo";
  }

  const sinContestar = pasos.filter(
    (p) => p.caso_id === caso.id && p.estado === "esperando"
  ).length;
  if (sinContestar > 0) {
    const quien = cliente?.nombre ?? "el cliente";
    return `Que ${quien} apruebe ${sinContestar} ${sinContestar === 1 ? "paso" : "pasos"}`;
  }

  const trabado = insumos.find(
    (i) => i.caso_id === caso.id && i.estado !== "en_stock"
  );
  // Entre comillas y con su mayúscula: el artículo depende del género del
  // insumo ("la correa", "el filtro") y no vale la pena adivinarlo.
  if (trabado) return `Que llegue «${trabado.nombre}»`;

  const p = preset(rubro);
  if (caso.estado === "revision_final") return p.explica.revision_final;
  if (caso.estado === "esperando") return p.explica.esperando;

  const mios = pasos.filter((x) => x.caso_id === caso.id);
  return mios.length === 0 ? "Armar el presupuesto" : "Hacer el trabajo";
}

// Qué queda escrito en el historial al pasar a cada estado.
//
// Vive en una tabla y no en cada botón porque desde el desplegable cualquier
// estado puede ir a cualquier otro: son veinte pasajes posibles y repartir el
// texto por la pantalla era garantía de que alguno quedara sin escribir.
// pruebas/pasajes.test.js se asegura de que no falte ninguno.
export const AL_PASAR_A = {
  nuevo: {
    titulo: "Volvió a quedar sin empezar",
    detalle: "Todavía no lo está atendiendo nadie.",
    icono: "carpeta",
  },
  en_proceso: {
    titulo: "Se puso a trabajar",
    detalle: "Alguien del equipo lo está atendiendo.",
    icono: "llave",
  },
  esperando: {
    titulo: "Quedó esperando",
    detalle: "Está detenido por algo de afuera.",
    icono: "reloj",
  },
  revision_final: {
    titulo: "Terminó el trabajo",
    detalle: "Pasa al control antes de entregar.",
    icono: "nota",
  },
  completado: {
    titulo: "Se entregó el caso",
    detalle: "Queda cerrado.",
    icono: "listo",
  },
};

// Los estados a los que se puede pasar desde uno dado: todos menos ése.
//
// Salen siempre en el orden del ciclo de vida, no reordenados según dónde
// estés parado: así el encargado aprende dónde está cada opción y deja de
// leer la lista.
export const otrosEstados = (actual) => ORDEN_ESTADOS.filter((e) => e !== actual);

// Los estados que ofrece el desplegable de la pantalla del caso.
//
// Son los otros abiertos, y nunca "completado". Entregar no es un pasaje
// más: abre el formulario de cobro, escribe cuánto se cobró y cierra el
// caso, y es el único momento en que alguien tiene el número delante. Si
// estuviera acá habría dos formas de cerrar un caso y una se saltearía la
// plata.
//
// Por lo mismo tampoco vuelve: de un caso cerrado se sale por "Volver a
// abrirlo", que deja dicho en el historial que se había cerrado de más.
export const estadosAElegir = (actual) =>
  ORDEN_ESTADOS.filter((e) => e !== actual && e !== "completado");

// "Quién lo tiene". Si nadie del equipo lo tiene, se deriva del estado
// en vez de mostrar un hueco (cartilla, lista de casos de la sección 05).
export function quienLoTiene(caso, empleados) {
  const persona = empleados.find((e) => e.id === caso.responsable_id);
  if (persona) return persona.nombre;
  if (caso.estado === "completado") return "Entregado";
  if (caso.estado === "esperando") return "Proveedor";
  return "Sin asignar";
}

// Lo mismo, dicho como frase para la cabecera del caso: ahí no hay una
// columna con título que diga qué es el dato, así que la frase lo dice
// sola. "Diego" suelto no aclara si es el cliente o quien hace el trabajo;
// "Lo tiene Diego", sí (auditoría, H2).
export function quienLoTieneEnPalabras(caso, empleados) {
  const persona = empleados.find((e) => e.id === caso.responsable_id);
  if (persona) return `Lo tiene ${persona.nombre}`;
  if (caso.estado === "completado") return "Ya se entregó";
  if (caso.estado === "esperando") return "Lo tiene el proveedor";
  return "Todavía no lo tiene nadie";
}

// El botón de cada fila: uno solo, el que casi siempre se va a tocar.
// Va con borde, nunca azul lleno: un solo botón azul por pantalla.
export function accionDeFila(caso, { pasos = [], insumos = [] } = {}) {
  const tienePasosEsperando = pasos.some(
    (p) => p.caso_id === caso.id && p.estado === "esperando"
  );
  const insumoPendiente = insumos.find(
    (i) => i.caso_id === caso.id && (i.estado === "pedido" || i.estado === "llegado")
  );

  switch (caso.estado) {
    case "nuevo":
      return { tipo: "asignar", etiqueta: "Asignar responsable", icono: "persona-mas" };
    case "en_proceso":
      return { tipo: "ir", etiqueta: "Cargar diagnóstico", icono: "diagnostico" };
    case "esperando":
      if (insumoPendiente && !tienePasosEsperando) {
        return {
          tipo: "insumo",
          etiqueta: "Marcar que llegó",
          icono: "camion",
          insumoId: insumoPendiente.id,
        };
      }
      return { tipo: "pasos", etiqueta: "Ver los pasos", icono: "nota" };
    case "revision_final":
      return { tipo: "entregar", etiqueta: "Entregar y cerrar", icono: "listo" };
    default:
      return { tipo: "ir", etiqueta: "Ver el caso", icono: "carpeta" };
  }
}

// Los casos que están esperando que el cliente conteste, con lo que hay en
// juego en cada uno. Ordenados por plata, no por fecha: lo que más pesa va
// primero.
//
// Un caso cerrado no entra aunque le hayan quedado pasos sin contestar. Se
// entregó igual —el cliente lo pasó a buscar, o esos pasos no se hicieron—,
// así que nadie va a contestarlos: sumarlos a "esperando respuesta" infla
// una plata que ya no está en juego.
//
// Vive acá y no en cada pantalla porque la usan dos: "A aprobar" y el módulo
// del Inicio. Es plata a la vista, y tiene test.
export function casosPorAprobar(casos, pasos) {
  return casos
    .filter(estaAbierto)
    .map((caso) => {
      const pendientes = pasos.filter(
        (p) => p.caso_id === caso.id && p.estado === "esperando"
      );
      // Desde cuándo espera: la fecha del paso sin contestar más viejo. Es
      // lo que hay que saber para decidir a quién llamar; la fecha del caso
      // contestaba otra cosa (auditoría, H1). Un paso sin fecha —cargado
      // antes de que se guardara— cae en la del caso.
      const esperandoDesde = pendientes
        .map((p) => p.creado_en ?? caso.abierto_en)
        .sort()[0];

      return {
        caso,
        pendientes,
        cuantos: pendientes.length,
        plata: pendientes.reduce((total, p) => total + Number(p.monto), 0),
        esperandoDesde,
      };
    })
    .filter((x) => x.cuantos > 0)
    .sort((a, b) => b.plata - a.plata);
}

export const pesos = (n) =>
  "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

// Con qué firma el historial lo que contestó el cliente desde su link.
//
// Es una constante y no un texto suelto porque la usan tres lugares que
// tienen que coincidir: lo que escribe la base al recibir la respuesta
// (022_el_cliente_destraba.sql), lo que escribe el modo de ejemplo, y lo que
// el Inicio busca para avisar que hay novedades. Si dejaran de coincidir, el
// aviso no aparecería nunca y nadie se enteraría de por qué.
export const FIRMA_DEL_CLIENTE = "El cliente";

// Si contestar ese paso suelta el caso.
//
// Pasa cuando ya no queda nada esperando su respuesta Y lo único que lo
// trababa era él. Dos cosas, y las dos importan:
//
//   Con tres pasos en la mesa, el cliente puede aprobar uno hoy y pensar los
//   otros dos. El caso sigue esperando, porque sigue esperando.
//
//   Un caso puede estar frenado por un repuesto que no llegó, y ahí la
//   respuesta del cliente no destraba nada: el auto sigue sin poder salir.
//
// Rechazar destraba igual que aprobar: un "no" es una respuesta. El taller
// sigue con lo aprobado y, si hace falta, propone otra cosa. Un paso
// rechazado no puede dejar un caso trabado para siempre.
//
// La base hace exactamente esta cuenta en SQL. Si se cambia una, se cambia
// la otra.
export function elClienteDestraba(caso, { pasos = [], insumos = [] } = {}) {
  if (!caso || caso.estado !== "esperando") return false;

  const sinContestar = pasos.some(
    (p) => p.caso_id === caso.id && p.estado === "esperando"
  );
  if (sinContestar) return false;

  const trabado = insumos.some(
    (i) => i.caso_id === caso.id && i.estado !== "en_stock"
  );
  return !trabado;
}

// Un caso que figura controlado pero tiene trabajo sin hacer.
//
// Es el punto 10 del flujo: se controló todo, y justo ahí apareció otra cosa
// que hay que presupuestar. Se suma el paso, el cliente lo aprueba, y el
// caso queda diciendo "control final" con trabajo nuevo esperando adentro.
//
// No se corrige solo desde acá: lo dice, y ofrece el camino de vuelta. Del
// lado del negocio siempre hay alguien mirando la pantalla, y puede ser que
// el paso nuevo se haga después de entregar.
export function quedoTrabajoPendiente(caso, pasosDelCaso = []) {
  if (caso?.estado !== "revision_final") return false;
  return avanceDePasos(pasosDelCaso).faltan > 0;
}

// Cuando la respuesta del cliente vuelve a dar trabajo.
//
// Aprobar algo nuevo sobre un caso que ya estaba controlado lo saca de
// control final: ese control se hizo sobre otro trabajo, y el caso ya no
// está listo para entregar. Acá sí se corrige solo, y por el mismo motivo
// que en elClienteDestraba(): del otro lado no hay nadie del negocio para
// darse cuenta.
//
// Rechazar no mueve nada: un "no" no agrega trabajo.
export const elClienteVolvioADarTrabajo = (caso, respuesta) =>
  caso?.estado === "revision_final" && respuesta === "aprobado";

// Los casos donde el cliente contestó algo hace poco.
//
// Sirve para avisar en el Inicio: el cliente contesta cuando puede —un
// domingo a la noche, desde el celular— y del lado del negocio eso tiene que
// aparecer solo a la mañana siguiente, no cuando alguien se acuerde de
// entrar al caso.
//
// La ventana es de dos días y no de uno: un presupuesto contestado el viernes
// a la tarde tiene que seguir avisando el lunes.
export function casosQueContestoElCliente(
  casos = [],
  eventos = [],
  { horas = 48, ahora = Date.now() } = {}
) {
  const desde = ahora - horas * 3600000;

  const contestados = new Set(
    eventos
      .filter((e) => e.autor === FIRMA_DEL_CLIENTE && new Date(e.ocurrido_en) >= desde)
      .map((e) => e.caso_id)
  );

  // Un caso entregado no necesita que nadie mire: ya se cerró.
  return casos.filter((c) => contestados.has(c.id) && estaAbierto(c));
}

// El avance del trabajo: cuántos de los pasos aprobados ya se hicieron.
//
// Es otra cuenta que otra: totalesDeCaso() dice qué contestó el cliente y
// cuánta plata hay en juego; esto dice cuánto de eso ya está hecho. Un paso
// que el cliente todavía no contestó no cuenta como trabajo pendiente,
// porque todavía no es trabajo: es una propuesta.
//
// "hecho_en" nulo es pendiente y con fecha es hecho (021_paso_hecho.sql).
// Acá no se mira la fecha, sólo si está: la hora en que el mecánico tocó el
// botón no cambia ninguna cuenta.
export function avanceDePasos(pasosDelCaso = []) {
  const aprobados = pasosDelCaso.filter((p) => p.estado === "aprobado");
  const hechos = aprobados.filter((p) => p.hecho_en);

  return {
    aprobados: aprobados.length,
    hechos: hechos.length,
    faltan: aprobados.length - hechos.length,
    // Con cero pasos aprobados no está "todo hecho": no hay trabajo todavía.
    // Si devolviera true, un caso recién abierto ofrecería pasar a control
    // final sin que nadie haya tocado el auto.
    todoHecho: aprobados.length > 0 && hechos.length === aprobados.length,
  };
}

// Si este paso se puede marcar como hecho. Sólo lo aprobado es trabajo, y un
// caso cerrado es el registro de lo que pasó, no un borrador: para
// corregirlo se vuelve a abrir. La base hace cumplir las dos reglas
// (021_paso_hecho.sql); acá sirven para no ofrecer un botón que va a fallar.
// Sin caso no se decide nada: "caso?.estado !== 'completado'" sobre un nulo
// da true, y eso ofrecería el botón justo cuando todavía no se sabe sobre
// qué. El test lo agarró.
export const sePuedeMarcarHecho = (paso, caso) =>
  Boolean(paso) && Boolean(caso) && paso.estado === "aprobado" && caso.estado !== "completado";

// El total del caso, separado en aprobado y esperando respuesta.
//
// Es la única lógica del sistema donde un bug se ve en pantalla y con plata,
// por eso vive acá afuera y tiene un test: pruebas/totales.test.js
//
// Lo rechazado no suma en ningún lado: si el cliente dijo que no, ese trabajo
// no se hace y no se cobra.
export function totalesDeCaso(pasosDelCaso) {
  const suma = (estado) =>
    pasosDelCaso
      .filter((p) => p.estado === estado)
      .reduce((total, p) => total + Number(p.monto), 0);

  const aprobado = suma("aprobado");
  const esperando = suma("esperando");

  return {
    aprobado,
    esperando,
    todo: aprobado + esperando,
    cuantosEsperan: pasosDelCaso.filter((p) => p.estado === "esperando").length,
  };
}
