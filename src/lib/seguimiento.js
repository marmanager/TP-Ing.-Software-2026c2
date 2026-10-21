// El seguimiento público de un caso (SCRUM-68).
//
// Es la pantalla más expuesta del sistema: la abre gente que nunca vio la
// aplicación, desde un link de WhatsApp, sin nadie al lado para explicarle.
// Qué se le muestra lo decide la API (ver_seguimiento(), 018 y 026: una
// lista cerrada de campos). Este archivo decide cómo se cuenta: el estado se
// dice con la palabra del rubro, y la línea de tiempo se arma con los cinco
// estados del núcleo, no con los títulos del historial, que están escritos
// para adentro del negocio.
//
// No tiene React adentro a propósito: así lo corre Jest.

// Con la extensión puesta: el resto del sistema la omite porque lo arma
// Next, pero este archivo también lo importa Jest sobre Node, que sigue el
// estándar y no adivina el ".js".
import { ORDEN_ESTADOS } from "./estados.js";
import { normalizarTelefono, telefonoParaLlamar } from "./telefono.js";
import { tCastellano } from "./idioma.js";

// Lo que contesta la API, a la forma que ya conoce la pantalla.
//
// La API recorta lo mismo que ver_seguimiento() pero le saca "sirve": un
// código que no sirve es un 404. Cualquier error se ve igual que un código
// que no sirve, como con la base: contar la diferencia sería contar de más.
// "No existe" y "no pude preguntar" son dos cosas: si la API no contestó, se
// devuelve el problema para que la pantalla lo diga, y el link puede andar
// en un rato. Un link que no existe no trae problema: no hay qué contar.
export const seguimientoDeLaApi = (r) =>
  r.ok
    ? { ...r.datos, sirve: true }
    : r.error.codigo === "seguimiento_no_encontrado"
      ? { sirve: false }
      : { sirve: false, problema: r.error.mensaje };

// La respuesta a un paso: { ok, destrabo, quedan } o { ok: false, motivo },
// con el mensaje de la API, que ya está escrito para el cliente.
export const respuestaDeLaApi = (r) => (r.ok ? { ok: true, ...r.datos } : { ok: false, motivo: r.error.mensaje });

// Lo que el negocio escribe en "qué falta" cuando comparte el link: de ahí
// en más la pelota es del cliente. Es una constante porque la escribe la
// capa de datos y la lee esta pantalla, y si dejaran de coincidir el cliente
// leería "estamos esperando la respuesta del cliente", hablando de él en
// tercera persona en su propia pantalla.
const ESPERA_AL_CLIENTE = "la respuesta del cliente";

// A quién se está esperando, dicho para el que abre el link.
//
// Es la pregunta que decide si el cliente contesta o no. "Esperando" a secas
// no le dice nada: si la pelota es suya y la pantalla no se lo dice, se
// queda esperando a que lo llamen, y el presupuesto se muere ahí.
//
// Quién tiene la pelota NO se adivina leyendo el texto de "qué falta": se
// mira si quedó algo por contestar. Un texto escrito a mano por el mostrador
// puede decir cualquier cosa; la lista de pasos sin contestar, no.
//
// Devuelve null cuando el caso no está frenado: ahí no hay espera que
// explicar, y el estado de arriba ya cuenta todo.
export function laEspera({
  estado,
  queFalta,
  porResponder = 0,
  espera = {},
  generico,
} = {}) {
  if (estado !== "esperando") return null;

  if (porResponder > 0) {
    return {
      deQuien: "cliente",
      titulo: `Estamos esperando ${espera.cliente ?? "tu respuesta"}.`,
      detalle: "Está acá abajo. Apenas contestes, seguimos.",
    };
  }

  // Lo que escribió el mostrador sirve cuando dice algo concreto —"el filtro
  // de aceite"—, y se descarta en dos casos:
  //
  //   Cuando es la marca de "estamos esperando al cliente" y ya no queda
  //   nada por contestar: quedó viejo, y repetirlo sería nombrar al cliente
  //   en tercera persona sin pedirle nada.
  //
  //   Cuando es el texto genérico del rubro, que mezcla las dos esperas
  //   ("El repuesto o el sí del cliente"). Lo escribe solo el sistema al
  //   mover el estado desde el desplegable, y adentro del negocio alcanza;
  //   acá es justo la confusión que esta pantalla vino a sacar.
  const escrito = (queFalta ?? "").trim();
  const sirve = escrito && escrito !== ESPERA_AL_CLIENTE && escrito !== generico;
  const loQueFalta = sirve ? escrito : (espera.negocio ?? "algo");

  return {
    deQuien: "negocio",
    titulo: `Estamos esperando ${primeraMinuscula(loQueFalta)}.`,
    detalle: "No hace falta que hagas nada: te avisamos apenas podamos seguir.",
  };
}

// "El filtro de aceite" en medio de una frase es "el filtro de aceite".
//
// Sólo se baja la mayúscula cuando la primera palabra es un artículo. Mirar
// si empieza en mayúscula no alcanza: "Bosch, que confirme el precio"
// también empieza en mayúscula, y bajarla lo rompe. El test lo agarró.
const ARTICULOS = ["el", "la", "los", "las", "un", "una", "unos", "unas", "que"];

const primeraMinuscula = (texto) => {
  const primera = texto.split(/[\s,.]/)[0].toLowerCase();
  return ARTICULOS.includes(primera) ? texto[0].toLowerCase() + texto.slice(1) : texto;
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

// El aviso de que el trabajo está listo (flujo, punto 9).
//
// Es el hermano del mensaje del presupuesto: mismo patrón, mismo link, otro
// momento. Aquel se manda cuando hay que decidir; este, cuando ya se hizo.
//
// Lleva las tres cosas que pide la historia: qué se hizo, en qué estado está
// el caso y el link para seguir mirando. Los pasos van con su marca —lo
// terminado con un tilde y lo que todavía no, con un punto— porque decir
// "ya está todo" cuando falta algo es la clase de mentira que el cliente
// descubre al llegar al mostrador.
//
// Lo manda el negocio: sale en el idioma de quien lo arma (`t`, al final).
export function mensajeDeLoHecho({
  negocioNombre,
  clienteNombre,
  identificador,
  servicio,
  estadoEnPalabras,
  entregado = false,
  pasos = [],
  link,
}, t = tCastellano) {
  const cual = identificador || servicio || t("casos.aviso.mensaje.loQueDejo");

  return [
    clienteNombre
      ? t("casos.aviso.mensaje.conNombre", { nombre: clienteNombre, negocio: negocioNombre, cual })
      : t("casos.aviso.mensaje.sinNombre", { negocio: negocioNombre, cual }),
    "",
    entregado ? t("casos.aviso.mensaje.hicimos") : t("casos.aviso.mensaje.terminamos"),
    ...pasos.map((p) => `${p.hecho ? "✓" : "•"} ${p.nombre}`),
    "",
    entregado
      ? t("casos.aviso.mensaje.entregado", { estado: estadoEnPalabras })
      : t("casos.aviso.mensaje.revision", { estado: estadoEnPalabras }),
    ...(link ? ["", t("casos.aviso.mensaje.seguirMirando", { link })] : []),
  ].join("\n");
}

// wa.me abre WhatsApp con el mensaje ya escrito, sin integración ni
// servidor: es un link común. Sin número, porque el que lo toca es el
// negocio y elige a quién mandárselo desde su propia agenda.
export const linkDeWhatsApp = (mensaje) =>
  `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

// Lo mismo pero hacia un número concreto: el del negocio, para que el
// cliente pueda preguntar antes de aprobar.
//
// WhatsApp quiere el número internacional, que es como se guarda desde B-1b
// (5493414567890). Uno de antes, sin código de país, no arma link: antes se
// le pegaba un 549 a ciegas, y si era de otro país el mensaje se iba a otro
// lado. Mejor no ofrecer el botón que mandarlo mal.
export function linkDeWhatsAppA(telefono, mensaje) {
  const r = normalizarTelefono(telefono);
  if (!r.ok) return null;
  return `https://wa.me/${r.telefono}?text=${encodeURIComponent(mensaje)}`;
}

// Llamar. En una computadora puede no hacer nada, y por eso el número se
// muestra escrito al lado: en el peor caso se copia a mano.
export const linkDeLlamada = (telefono) => {
  const numero = telefonoParaLlamar(telefono);
  return numero ? `tel:${numero}` : null;
};

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
