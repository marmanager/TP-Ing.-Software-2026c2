// El seguimiento público de un caso (SCRUM-68).
//
// Es la pantalla más expuesta del sistema: la abre gente que nunca vio la
// aplicación, desde un link de WhatsApp, sin nadie al lado para explicarle.
// Este archivo decide DOS cosas, y las dos importan:
//
//   1. Qué se le muestra y qué no. La lista de campos está escrita a mano,
//      una por una. Es un permiso, no un filtro: si mañana alguien le agrega
//      una columna a "caso", esa columna no aparece acá y no se publica.
//      Hay un test que falla si eso deja de ser cierto.
//
//   2. Cómo se cuenta. El estado se dice con la palabra del rubro, y la
//      línea de tiempo se arma con los cinco estados del núcleo, no con los
//      títulos del historial, que están escritos para adentro del negocio.
//
// No tiene React ni Supabase adentro a propósito: así lo corre Jest
// y así lo usan las dos fuentes de datos, la base y el modo de ejemplo.

// Con la extensión puesta: el resto del sistema la omite porque lo arma
// Next, pero este archivo también lo importa Jest sobre Node, que sigue el
// estándar y no adivina el ".js".
import { ORDEN_ESTADOS } from "./estados.js";

// Lo único que sale del negocio hacia afuera. El mismo recorte que hace
// ver_seguimiento(), que nació en supabase/018_seguimiento.sql y hoy vive en
// 019_aprobar_desde_el_link.sql: si se cambia uno, se cambian los dos.
export const CAMPOS_PUBLICOS = [
  "sirve",
  "negocio_nombre",
  "negocio_telefono",
  "rubro",
  "cliente_nombre",
  "numero",
  "identificador",
  "servicio",
  "estado",
  "que_falta",
  "abierto_en",
  "actualizado_en",
  "pasos",
  "por_responder",
  "linea",
];

// De cada paso aprobado, sólo el nombre y el monto. Lo que el cliente ya
// aprobó y ya conoce.
const CAMPOS_PASO = ["nombre", "monto"];

// De cada paso que espera su respuesta, además el porqué —lo escribió el
// negocio para explicárselo a él— y el id, que es lo único que se expone de
// más en todo el recorte: hace falta para poder decir "este". Es un uuid al
// azar, no sirve sin el código, y la base comprueba igual que el paso sea
// del caso de ese código (019_aprobar_desde_el_link.sql).
const CAMPOS_PASO_POR_RESPONDER = ["id", "nombre", "descripcion", "monto"];

// Arma el objeto público a partir de los datos completos del negocio.
//
// Lo usa el modo de ejemplo, donde no hay servidor que recorte nada y todo
// está en el navegador. Con Supabase el recorte lo hace la base y esto no
// llega a correr, pero el resultado tiene que ser el mismo objeto: la
// pantalla es una sola.
//
// Devuelve { sirve: false } cuando el código no sirve, sin decir por qué:
// que no exista, que lo hayan revocado o que el caso ya no esté se ven
// exactamente igual desde afuera.
export function casoPublico({ codigo, negocio, casos = [], clientes = [], pasos = [], eventos = [] }) {
  if (!codigo) return { sirve: false };

  const caso = casos.find((c) => c.seguimiento_codigo && c.seguimiento_codigo === codigo);
  if (!caso || !negocio) return { sirve: false };

  const cliente = clientes.find((c) => c.id === caso.cliente_id) ?? null;

  return {
    sirve: true,
    negocio_nombre: negocio.nombre ?? null,
    // Para que el cliente pueda preguntar antes de decidir. Nulo si el
    // negocio no lo cargó: la pantalla no inventa un botón que no lleva a
    // ningún lado.
    negocio_telefono: nullSiVacio(negocio.telefono),
    rubro: negocio.rubro ?? null,
    // Sólo el nombre de pila: alcanza para reconocer que el link es el suyo.
    cliente_nombre: primerNombre(cliente?.nombre),
    numero: caso.numero ?? null,
    identificador: caso.identificador ?? null,
    servicio: caso.servicio ?? null,
    estado: caso.estado ?? null,
    // "Qué falta" sólo cuando está frenado. En los otros estados es una
    // instrucción para adentro ("Asignar a alguien del equipo"), no la
    // respuesta a "¿por qué tarda?".
    que_falta: caso.estado === "esperando" ? (caso.que_falta ?? null) : null,
    abierto_en: caso.abierto_en ?? null,
    actualizado_en: caso.actualizado_en ?? null,
    pasos: pasos
      .filter((p) => p.caso_id === caso.id && p.estado === "aprobado")
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((p) => soloEstos(p, CAMPOS_PASO)),
    // Lo que espera su respuesta. Un caso entregado no lleva ninguno: sobre
    // un trabajo terminado no hay nada que decidir, y ofrecerlo sería
    // ofrecer una puerta que no abre.
    //
    // Los rechazados tampoco están: ya los contestó, y volver a ofrecerlos
    // es del negocio, no del cliente.
    por_responder:
      caso.estado === "completado"
        ? []
        : pasos
            .filter((p) => p.caso_id === caso.id && p.estado === "esperando")
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
            .map((p) => soloEstos(p, CAMPOS_PASO_POR_RESPONDER)),
    linea: eventos
      .filter((e) => e.caso_id === caso.id && e.estado)
      .map((e) => ({ estado: e.estado, ocurrido_en: e.ocurrido_en ?? null }))
      .sort((a, b) => new Date(a.ocurrido_en) - new Date(b.ocurrido_en)),
  };
}

const primerNombre = (nombre) => (nombre ?? "").trim().split(/\s+/)[0] || null;

const nullSiVacio = (texto) => (texto ?? "").trim() || null;

const soloEstos = (objeto, campos) =>
  Object.fromEntries(campos.map((campo) => [campo, objeto?.[campo] ?? null]));

// Qué quiere decir cada estado, dicho para el cliente.
//
// No sale de ESTADOS[].significado: ese texto está escrito para adentro del
// negocio ("Está detenido por algo de afuera: una aprobación, un insumo o la
// respuesta del cliente") y del otro lado el cliente ES esa respuesta que se
// está esperando. Leerse nombrado en tercera persona es raro.
//
// Tampoco sale del preset: son frases neutras, que tienen que funcionar
// igual para un auto, un paciente y una notebook. El día que a alguna le
// quede corto el rubro, el lugar donde cambiarlas es acá.
export const QUE_SIGNIFICA = {
  nuevo: "Ya quedó anotado. Todavía no lo empezaron.",
  en_proceso: "Lo están haciendo ahora.",
  esperando: "Está frenado: falta algo para poder seguir.",
  revision_final: "El trabajo está hecho. Lo están controlando antes de entregarlo.",
  completado: "Terminado y entregado.",
};

// La línea de tiempo: los cinco estados del núcleo, en orden, diciendo cuál
// ya pasó, cuál es el de ahora y cuáles faltan.
//
// Se arma con el orden de los estados y no con lo que haya en el historial:
// un caso que volvió para atrás —de "esperando" a "en proceso"— tiene dos
// eventos del mismo estado, y el cliente no necesita ver el ida y vuelta,
// necesita saber dónde está lo suyo.
//
// La fecha sale del último evento de ese estado. Puede no haber: los casos
// anteriores a 018_seguimiento.sql no tienen el estado guardado en el
// historial. En ese caso va sin fecha, que es mejor que una inventada.
export function lineaDeEstados(estadoActual, linea = [], { abiertoEn = null } = {}) {
  const dondeEstamos = ORDEN_ESTADOS.indexOf(estadoActual);

  return ORDEN_ESTADOS.map((estado, i) => {
    const suyos = linea.filter((e) => e.estado === estado);
    const ultimo = suyos.length ? suyos[suyos.length - 1].ocurrido_en : null;
    const pendiente = dondeEstamos < i;

    return {
      estado,
      // El caso nace en "nuevo" cuando se abre, y eso no deja evento: la
      // fecha de apertura ES la de ese primer paso.
      //
      // Una etapa que todavía no llegó va sin fecha aunque el caso haya
      // estado ahí antes: un caso entregado que se volvió a abrir tiene un
      // evento de "entregado", y "Entregado · hoy" arriba de un caso que no
      // está entregado es justo lo contrario de lo que se vino a leer.
      cuando: pendiente ? null : estado === "nuevo" ? (ultimo ?? abiertoEn) : ultimo,
      pasado: dondeEstamos > i,
      actual: dondeEstamos === i,
      pendiente,
    };
  });
}

// Suma los montos de una lista de pasos públicos. No usa totalesDeCaso()
// porque estos no traen estado: ya vienen separados en dos listas, los
// aprobados y los que esperan respuesta.
export const totalAprobado = (pasos = []) =>
  pasos.reduce((total, p) => total + Number(p.monto || 0), 0);

// El link que se comparte. Se arma con el origen del navegador para que ande
// igual en localhost, en la compu de al lado y el día que esto se publique.
export const linkDeSeguimiento = (origen, codigo) =>
  `${(origen ?? "").replace(/\/$/, "")}/seguimiento/${codigo}`;

// El mensaje que sale escrito en WhatsApp. Lo puede borrar y escribir lo que
// quiera: es un punto de partida, no un formulario.
//
// Dice de parte de quién es y qué es el link, porque del otro lado alguien
// recibe una dirección de internet de un número que quizás no tiene agendado.
export function mensajeDeWhatsApp({ negocioNombre, identificador, servicio, link }) {
  const cosa = identificador || servicio || "tu trabajo";
  return (
    `Hola, te escribimos de ${negocioNombre}. ` +
    `Podés ver cómo viene ${cosa} acá, sin instalar nada: ${link}`
  );
}

// wa.me abre WhatsApp con el mensaje ya escrito, sin integración ni
// servidor: es un link común. Sin número, porque el que lo toca es el
// negocio y elige a quién mandárselo desde su propia agenda.
export const linkDeWhatsApp = (mensaje) =>
  `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

// Lo mismo pero hacia un número concreto: el del negocio, para que el
// cliente pueda preguntar antes de aprobar.
//
// El sistema pide los teléfonos como los dice la gente acá —"con
// característica, sin el 0 ni el 15"—, o sea diez dígitos: 341 456 7890.
// WhatsApp los quiere en formato internacional, y para un celular argentino
// eso es 54 9 delante. Esa traducción vive sólo acá.
//
// Si el número ya viene con el 54, se respeta: alguien puede haber cargado
// un número de otro país, y romperlo poniéndole otro 54 sería peor que no
// ofrecer el botón.
export function linkDeWhatsAppA(telefono, mensaje) {
  const digitos = soloDigitos(telefono);
  if (!digitos) return null;
  const internacional = digitos.startsWith("54") ? digitos : `549${digitos}`;
  return `https://wa.me/${internacional}?text=${encodeURIComponent(mensaje)}`;
}

// Llamar. En una computadora puede no hacer nada, y por eso el número se
// muestra escrito al lado: en el peor caso se copia a mano.
export const linkDeLlamada = (telefono) => {
  const digitos = soloDigitos(telefono);
  return digitos ? `tel:${digitos}` : null;
};

const soloDigitos = (telefono) => (telefono ?? "").replace(/\D/g, "");

// Lo que el cliente le escribe al negocio cuando no está seguro. Ya viene
// escrito porque del otro lado alguien tiene que entender de qué caso le
// hablan sin preguntar tres veces.
export function mensajeDeConsulta({ clienteNombre, identificador, servicio, numero, paso }) {
  const quien = clienteNombre ? `Hola, soy ${clienteNombre}.` : "Hola.";
  const cual = identificador
    ? `por ${identificador}`
    : numero
      ? `por el caso ${numero}`
      : `por ${servicio ?? "lo que dejé"}`;

  return paso
    ? `${quien} Te escribo ${cual}. Quería preguntarte por «${paso}» antes de decidir.`
    : `${quien} Te escribo ${cual}. Quería hacerte una consulta.`;
}
