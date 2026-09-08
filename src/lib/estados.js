// Los cinco estados del núcleo común (cartilla, sección 02).
//
// Son fijos. Un preset de rubro puede renombrarlos y esconder los que no usa,
// pero no puede agregar un sexto color ni cambiar el ícono de uno existente.
//
// Las clases de Tailwind van escritas enteras a propósito: el escáner de
// Tailwind lee el código fuente, así que un `bg-${x}-fondo` no generaría nada.

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

// "Quién lo tiene". Si nadie del equipo lo tiene, se deriva del estado
// en vez de mostrar un hueco (cartilla, lista de casos de la sección 05).
export function quienLoTiene(caso, empleados) {
  const persona = empleados.find((e) => e.id === caso.responsable_id);
  if (persona) return persona.nombre;
  if (caso.estado === "completado") return "Entregado";
  if (caso.estado === "esperando") return "Proveedor";
  return "Sin asignar";
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
      return {
        caso,
        pendientes,
        cuantos: pendientes.length,
        plata: pendientes.reduce((total, p) => total + Number(p.monto), 0),
      };
    })
    .filter((x) => x.cuantos > 0)
    .sort((a, b) => b.plata - a.plata);
}

export const pesos = (n) =>
  "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

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
