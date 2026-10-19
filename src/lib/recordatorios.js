// Recordatorios: avisarle al cliente lo que le sirve, con datos que el
// sistema ya tiene (../Modulo-recordatorios.md).
//
// La primera pieza (R-1b) es cuándo le toca volver: se anota al entregar el
// caso, con la fecha típica del rubro ya cargada, y la ficha del cliente
// muestra la próxima. La segunda (R-4b) es el recordatorio de turno por
// WhatsApp: cuándo sale y cómo se cuenta en el turno lo que pasó con él. La
// tercera (R-8b) es la baja: cómo se dice que el cliente pidió no recibirlos.
// La cuarta (R-2b) cierra la primera: el aviso de que le toca volver sale
// solo, y acá se configura y se dice cuándo sale o por qué no.
//
// Dos reglas que valen para todo el archivo:
//
//   · "hoy" entra por parámetro, en todas las funciones. Nunca new Date()
//     adentro: si no, un test que dice "una fecha anterior a hoy se rechaza"
//     empieza a fallar solo según el día.
//
//   · Las fechas son días del calendario, como strings "2026-10-13", de
//     punta a punta. No pasan por Date ni por toISOString(): eso las vuelve
//     un instante, y el huso horario corre una entrega de las 22 h al día
//     siguiente (el aviso de pruebas/calendario.test.js). Las cuentas se
//     hacen con números de día, sin hora.
//
// No tiene React ni red adentro, como lib/seguimiento.js: así lo corre Jest
// y lo vigila pruebas/fronteras.test.js.

import { cadaCuantoVuelve, mayuscula, vocabulario } from "./presets.js";
import { telefonoWhatsAppValido } from "./seguimiento-whatsapp.js";
import { diaEnPalabras } from "./fechas.js";

// ------------------------------------------------------------
// Días del calendario
// ------------------------------------------------------------

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

const partes = (fecha) => {
  const m = DIA.exec(fecha ?? "");
  return m ? { a: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};

const dosCifras = (n) => String(n).padStart(2, "0");
const escribir = ({ a, m, d }) => `${String(a).padStart(4, "0")}-${dosCifras(m)}-${dosCifras(d)}`;

const bisiesto = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const diasDelMes = (a, m) => [31, bisiesto(a) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

// El número de día desde una fecha fija, para restar y sumar días sin Date.
// Es la cuenta de "días desde el 1/1/1970" del calendario gregoriano.
function numeroDeDia({ a, m, d }) {
  const año = m <= 2 ? a - 1 : a;
  const era = Math.floor(año / 400);
  const dentroDeLaEra = año - era * 400;
  const delAño = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const deLaEra = dentroDeLaEra * 365 + Math.floor(dentroDeLaEra / 4) - Math.floor(dentroDeLaEra / 100) + delAño;
  return era * 146097 + deLaEra - 719468;
}

function deNumeroDeDia(n) {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const deLaEra = z - era * 146097;
  const dentroDeLaEra = Math.floor(
    (deLaEra - Math.floor(deLaEra / 1460) + Math.floor(deLaEra / 36524) - Math.floor(deLaEra / 146096)) / 365
  );
  const delAño = deLaEra - (365 * dentroDeLaEra + Math.floor(dentroDeLaEra / 4) - Math.floor(dentroDeLaEra / 100));
  const mp = Math.floor((5 * delAño + 2) / 153);
  const d = delAño - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { a: dentroDeLaEra + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

const sumarDias = (fecha, dias) => escribir(deNumeroDeDia(numeroDeDia(partes(fecha)) + dias));

const diasEntre = (desde, hasta) => numeroDeDia(partes(hasta)) - numeroDeDia(partes(desde));

// "En seis meses" desde el 31 de agosto es el último de febrero, no el 3 de
// marzo: el día se recorta al largo del mes al que se llega.
function sumarMeses(fecha, meses) {
  const { a, m, d } = partes(fecha);
  const total = a * 12 + (m - 1) + meses;
  const año = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return escribir({ a: año, m: mes, d: Math.min(d, diasDelMes(año, mes)) });
}

// Las fechas tienen la misma forma, así que el orden de los strings es el
// orden del calendario.
const yaPaso = (fecha, hoy) => fecha < hoy;

// ------------------------------------------------------------
// Cuándo le toca volver
// ------------------------------------------------------------

// La fecha que se ofrece ya cargada al entregar: hoy más el intervalo típico
// del rubro. Un rubro sin intervalo no sugiere nada.
export function fechaSugerida({ rubro, hoy }) {
  const intervalo = cadaCuantoVuelve(rubro);
  return intervalo ? sumarMeses(hoy, intervalo.meses) : null;
}

// Por qué no sirve la fecha, o null si sirve. Vacía sirve: no todos los
// trabajos tienen una próxima vez, y entregar no se traba por eso. Hoy
// sirve. Es la misma regla que valida la API (422 volver_en_pasado): acá se
// mira antes para no ofrecer un botón que va a fallar.
export function errorDeVolverEn(fecha, hoy) {
  if (!fecha) return null;
  if (!partes(fecha)) return "Elegí un día del calendario.";
  return yaPaso(fecha, hoy) ? "la fecha ya pasó" : null;
}

// La próxima visita de un cliente: de las fechas de sus casos, la más
// cercana que todavía no pasó. El dato vive en el caso y no en el cliente
// porque un cliente de taller puede tener dos autos con mantenimientos
// distintos; la ficha muestra la que viene primero.
export function proximaVisita(casos = [], hoy) {
  const futuras = (casos ?? [])
    .map((c) => c?.volver_en)
    .filter((f) => partes(f) && !yaPaso(f, hoy))
    .sort();
  return futuras[0] ?? null;
}

// Para los clientes que vienen de antes y no tienen fecha anotada: si sus
// visitas están espaciadas parejo, cada cuánto viene. Lo sugiere, no lo
// impone: la pantalla lo ofrece y el encargado decide.
//
// Pide tres visitas como mínimo (dos intervalos que comparar) y que cada
// intervalo no se aleje más de un cuarto del promedio. Con menos, o con un
// ritmo desparejo, adivinar se equivoca más de lo que ayuda.
const MINIMO_DE_VISITAS = 3;
const TOLERANCIA = 0.25;

export function intervaloDeducido(visitas = [], hoy) {
  const fechas = [...new Set((visitas ?? []).filter((f) => partes(f) && !(f > hoy)))].sort();
  if (fechas.length < MINIMO_DE_VISITAS) return null;

  const intervalos = fechas.slice(1).map((f, i) => diasEntre(fechas[i], f));
  const promedio = intervalos.reduce((s, n) => s + n, 0) / intervalos.length;
  if (promedio < 1) return null;
  if (intervalos.some((n) => Math.abs(n - promedio) > promedio * TOLERANCIA)) return null;

  const dias = Math.round(promedio);
  return { dias, fecha: sumarDias(hoy, dias) };
}

// Lo que viaja a la API (R-1a): el día tal cual, o null cuando el campo
// quedó vacío. null es "sin fecha" —al entregar, y borra una que había al
// corregir—; un string vacío la API lo rechazaría como fecha que no es.
export const volverEnParaLaApi = (valor) => (valor ?? "").trim() || null;

// ------------------------------------------------------------
// El recordatorio de turno (R-4b)
// ------------------------------------------------------------
// Cuándo programarlo, correrlo o cancelarlo lo decide la API (R-4a,
// seguimiento/reglas-turno.ts), y también el texto sugerido según el rubro:
// acá no hay copia de esas reglas. Lo que vive acá es lo que la pantalla
// dice: cuándo sale, en palabras, y qué pasó con el aviso de cada turno.
//
// El turno sí es un instante ("2026-10-15T13:00:00+00:00"), y el aviso
// también. Se resta en milisegundos y se lee con la hora de Argentina; nunca
// se pasa por toISOString() para después cortarlo, que daría el día de
// Greenwich: el aviso de un turno de las 21 h caería un día corrido.

const HORA = 3_600_000;

const RELOJ_ARGENTINA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// El día y la hora de un instante, como se leen en Argentina:
// { dia: "2026-10-14", hora: "21:00" }.
function enArgentina(instante) {
  const ms = typeof instante === "number" ? instante : Date.parse(instante ?? "");
  if (Number.isNaN(ms)) return null;
  const p = Object.fromEntries(RELOJ_ARGENTINA.formatToParts(ms).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

// Cuándo sale el aviso de un turno que empieza a "empiezaEn", con "horas" de
// anticipación. Es lo que la pantalla muestra antes de que conteste la API.
export function cuandoSaleElAviso({ empiezaEn, horas }) {
  const empieza = Date.parse(empiezaEn ?? "");
  if (Number.isNaN(empieza) || !Number.isFinite(Number(horas))) return null;
  return enArgentina(empieza - Number(horas) * HORA);
}

// Los números chicos se escriben con letras: "dos horas antes", no "2 horas".
const NUMEROS = ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];
const enLetras = (n) => NUMEROS[n] ?? String(n);

// La anticipación del recordatorio de turno, como se dice en el mostrador.
export function anticipacionEnPalabras(horas) {
  const h = Number(horas);
  if (h === 24) return "el día anterior";
  if (h === 168) return "una semana antes";
  if (h % 24 === 0 && h / 24 <= 6) return `${enLetras(h / 24)} días antes`;
  if (h === 1) return "una hora antes";
  return `${enLetras(h)} horas antes`;
}

// La anticipación del aviso de volver, en días antes de la fecha anotada.
function diasAntesEnPalabras(n) {
  if (n === 0) return "el mismo día";
  if (n === 1) return "un día antes";
  if (n % 7 === 0) return n === 7 ? "una semana antes" : `${enLetras(n / 7)} semanas antes`;
  return `${enLetras(n)} días antes`;
}

// ------------------------------------------------------------
// Los recordatorios, por tipo
// ------------------------------------------------------------
// Uno por tipo de la API: "cierre" (el posventa, en días después de
// entregar), "turno" (en horas antes del turno, R-4b) y "volver" (en días
// antes del día que se anotó, R-2b). Todo lo que cambia de uno a otro está
// acá: dónde viaja en la API, cómo se llama y en qué unidad va su plazo,
// cómo se dice cuándo sale y los textos de su pantalla. Las funciones de
// abajo y las dos pantallas de /negocio/recordatorios recorren este mapa,
// así que sumar un tipo es sumar una entrada.
//
// "enLaApi" es dónde viaja en /negocio/seguimiento: null es arriba de todo
// (el posventa, que fue el primero); si no, el nombre de su objeto.

const RECORDATORIOS = {
  cierre: {
    enLaApi: null,
    plazo: "dias",
    min: 0,
    max: 3650,
    errorDelPlazo: "Elegí una cantidad de días enteros entre 0 y 3650.",
    cuandoSale: (n) =>
      n === 0
        ? "Le llega al cliente apenas entregás el caso."
        : `Le llega al cliente ${n === 1 ? "un día" : `${enLetras(n)} días`} después de que entregás el caso.`,
    textos: () => ({
      nombre: "Después de entregar",
      interruptor: "Mensaje después de entregar",
      ayudaInterruptor: "Al entregar cada caso elegís si se lo mandás.",
      etiquetaPlazo: "¿Cuántos días después de entregar?",
      ayudaPlazo: "Poné 0 para mandarlo apenas entregás.",
    }),
  },
  // En un consultorio el turno es una consulta.
  turno: {
    enLaApi: "turno",
    plazo: "horas",
    min: 1,
    max: 168,
    soloConAgenda: true,
    errorDelPlazo: "Elegí una cantidad de horas enteras entre 1 y 168 horas.",
    cuandoSale: (n, { cita }) => {
      const su = `su ${cita.palabra()}`;
      return n === 24
        ? `Le llega al cliente el día anterior a ${su}, a la misma hora.`
        : `Le llega al cliente ${anticipacionEnPalabras(n)} de ${su}.`;
    },
    textos: ({ cita }) => ({
      nombre: `Antes ${cita.segun("del", "de la")} ${cita.palabra()}`,
      interruptor: `Recordatorio ${cita.segun("del", "de la")} ${cita.palabra()}`,
      ayudaInterruptor: `Le llega a cada cliente con teléfono que tenga ${cita.un()} anotad${cita.segun("o", "a")}.`,
      etiquetaPlazo: "¿Cuántas horas antes?",
      ayudaPlazo: "24 es el día anterior, a la misma hora. Hasta 168, una semana.",
    }),
  },
  // Los días son ANTES de la fecha anotada; los del posventa, después de
  // entregar. Van uno al lado del otro: la frase lo dice sin ambigüedad.
  volver: {
    enLaApi: "volver",
    plazo: "dias",
    min: 0,
    max: 90,
    errorDelPlazo: "Elegí una cantidad de días enteros entre 0 y 90.",
    cuandoSale: (n, { cita }) => {
      const para = `para su ${cita.segun("próximo", "próxima")} ${cita.palabra()}`;
      return n === 0
        ? `Le llega al cliente el mismo día que anotaste ${para}.`
        : `Le llega al cliente ${diasAntesEnPalabras(n)} del día que anotaste ${para}.`;
    },
    textos: () => ({
      nombre: "Cuando le toca volver",
      interruptor: "Aviso de que le toca volver",
      ayudaInterruptor: "Le llega a cada cliente con teléfono al que le anotaste cuándo le toca volver al entregar.",
      etiquetaPlazo: "¿Cuántos días antes de la fecha?",
      ayudaPlazo: "Poné 0 para mandarlo el mismo día. Hasta 90 días antes.",
    }),
  },
};

const definicion = (tipo) => RECORDATORIOS[tipo] ?? RECORDATORIOS.cierre;

export const esTipoDeRecordatorio = (tipo) => Object.hasOwn(RECORDATORIOS, tipo);

// Los textos de la pantalla de un recordatorio, y su plazo mínimo y máximo.
export function textosDelRecordatorio(tipo, rubro) {
  const def = definicion(tipo);
  return { ...def.textos(vocabulario(rubro)), min: def.min, max: def.max };
}

// La frase que explica, sin jerga, cuándo le llega cada mensaje al cliente.
// "tipo" es el de la API.
export function cuandoSaleEnPalabras({ tipo, plazo, rubro }) {
  return definicion(tipo).cuandoSale(Number(plazo), vocabulario(rubro));
}

// Lo que falta para poder guardar un recordatorio, por campo. El plazo va
// en su unidad y con el rango que valida la API.
export function erroresDelRecordatorio({ tipo, plazo, mensaje }) {
  const { min, max, errorDelPlazo } = definicion(tipo);
  const valor = String(plazo ?? "").trim();
  const entero = /^\d+$/.test(valor) ? Number(valor) : null;
  const plazoMal = (entero === null || entero < min || entero > max) && errorDelPlazo;
  const texto = String(mensaje ?? "").trim();
  const mensajeMal = !texto
    ? "Escribí el mensaje que va a recibir el cliente."
    : texto.length > 3000 && "El mensaje no puede superar 3000 caracteres.";
  return {
    ...(plazoMal ? { plazo: plazoMal } : {}),
    ...(mensajeMal ? { mensaje: mensajeMal } : {}),
  };
}

// Por qué un turno no va a tener recordatorio, cuando se ve desde el
// turno: { motivo, frase }, o null si no hay nada que lo impida. Es lo que
// se señala en vez de dejar un hueco (y, si falta el teléfono, se ofrece
// completarlo).
export function porQueNoHayAviso({ turno, cliente, rubro }) {
  const { cita } = vocabulario(rubro);
  if (!turno?.cliente_id) {
    return { motivo: "sin_cliente", frase: `${mayuscula(cita.el())} no tiene cliente, así que no le llega recordatorio.` };
  }
  // Antes que el teléfono, como en la API (R-8a): si pidió la baja,
  // completar el teléfono no cambiaría nada.
  if (cliente?.avisos_baja_en) {
    return { motivo: "baja_de_avisos", frase: `Pidió no recibir mensajes automáticos, así que no le llega el recordatorio de su ${cita.palabra()}.` };
  }
  if (!telefonoWhatsAppValido(cliente?.telefono)) {
    return { motivo: "sin_telefono", frase: "Falta el teléfono del cliente, con código de país, para mandarle el recordatorio." };
  }
  return null;
}

// "hoy a las 10:00", "mañana a las 10:00", "el 19 de octubre a las 21:30".
function momentoEnPalabras(instante, ahora) {
  const cuando = enArgentina(instante);
  if (!cuando) return "";
  const hoy = enArgentina(ahora).dia;
  const dia = cuando.dia === hoy
    ? "hoy"
    : cuando.dia === sumarDias(hoy, 1)
      ? "mañana"
      : `el ${diaEnPalabrasSinAño(cuando.dia)}`;
  return `${dia} a las ${cuando.hora}`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const diaEnPalabrasSinAño = (dia) => {
  const { m, d } = partes(dia);
  return `${d} de ${MESES[m - 1]}`;
};

// Lo que pasó con el aviso de un turno, en una frase para la persona:
// { estado: "programado" | "enviado" | "fallido", frase }, o null si no hay
// aviso que mostrar (no tiene, o se canceló).
//
// El error de un envío fallido no se muestra nunca: es texto del proveedor
// ("Kapso rechazó el envío (HTTP 400)"). La frase dice qué hacer, como pide
// la sección 07 de la cartilla. Casi siempre es el número.
export function avisoEnPalabras({ aviso, ahora }) {
  switch (aviso?.estado) {
    case "pendiente":
      return { estado: "programado", frase: `Le va a llegar el recordatorio ${momentoEnPalabras(aviso.enviar_en, ahora)}.` };
    case "enviado":
      return { estado: "enviado", frase: `Le mandamos el recordatorio ${momentoEnPalabras(aviso.procesado_en ?? aviso.enviar_en, ahora)}.` };
    case "fallido":
      return {
        estado: "fallido",
        frase: "No se pudo enviar el recordatorio. Revisá que el teléfono del cliente tenga código de país.",
      };
    default:
      return null;
  }
}

// El aviso de un turno, como lo trae la API: el último de la cola, en el
// listado (turno.aviso), o el que quedó después de un cambio, en la
// respuesta (turno.recordatorio.aviso). Si viene "aviso", manda.
export function avisoDelTurno(turno) {
  if (turno && turno.aviso !== undefined) return turno.aviso;
  return turno?.recordatorio?.aviso ?? null;
}

// Al anotar o mover un turno, lo que vale la pena decir en el momento sobre
// su recordatorio. La frase es la de la API, ya escrita para la persona.
// Apagado, sin cliente o sin teléfono no se dice: la agenda lo muestra en el
// mismo turno, y repetirlo en cada alta sería ruido.
const SE_AVISA_AL_ANOTAR = new Set(["muy_cerca", "whatsapp_no_configurado", "no_se_pudo"]);

export function avisoAlAnotar(recordatorio) {
  return SE_AVISA_AL_ANOTAR.has(recordatorio?.motivo) ? recordatorio.mensaje ?? null : null;
}

// ------------------------------------------------------------
// La configuración de los recordatorios
// ------------------------------------------------------------
// La API la manda con el posventa arriba ({ activo, dias, mensaje }), el de
// turnos en "turno" ({ activo, horas, mensaje }) y el de volver en "volver"
// ({ activo, dias, mensaje }). La pantalla edita todos igual, cada uno con
// su plazo como texto del campo.

const paraEditar = (c, plazo) => ({
  activo: Boolean(c?.activo),
  plazo: plazo == null ? "" : String(plazo),
  mensaje: c?.mensaje ?? "",
});

// Un tipo que la API no manda no se ofrece: una API sin R-2a no tiene
// "volver", y configurarlo no haría nada.
export function recordatoriosDeLaApi(config) {
  const editables = {};
  for (const [tipo, def] of Object.entries(RECORDATORIOS)) {
    if (def.enLaApi && config?.[def.enLaApi] == null) continue;
    const fuente = def.enLaApi ? config[def.enLaApi] : config;
    editables[tipo] = paraEditar(fuente, fuente?.[def.plazo]);
  }
  return editables;
}

// Lo que cambió de uno, con los nombres de la API y en su lugar del PATCH.
export function cambiosDelRecordatorio(tipo, antes, ahora) {
  const def = definicion(tipo);
  const cambios = {};
  if (ahora.activo !== antes.activo) cambios.activo = ahora.activo;
  if (String(ahora.plazo).trim() !== String(antes.plazo).trim()) cambios[def.plazo] = Number(ahora.plazo);
  if (ahora.mensaje.trim() !== antes.mensaje.trim()) cambios.mensaje = ahora.mensaje.trim();
  if (!Object.keys(cambios).length) return {};
  return def.enLaApi ? { [def.enLaApi]: cambios } : cambios;
}

// El PATCH de /negocio/seguimiento: sólo lo que cambió. Así apagar uno no
// escribe nada de los otros, y la API guarda cada tipo por separado.
export function cambiosDeRecordatorios(guardado, borrador) {
  return Object.keys(guardado)
    .filter((tipo) => borrador[tipo])
    .reduce((cambios, tipo) => ({ ...cambios, ...cambiosDelRecordatorio(tipo, guardado[tipo], borrador[tipo]) }), {});
}

// Las filas de /negocio/recordatorios: una por recordatorio, con si está
// prendido y cuándo sale. Sin agenda, el de turnos no se configura: no se usa.
export function filasDeRecordatorios({ configuracion, rubro, conAgenda }) {
  return Object.entries(recordatoriosDeLaApi(configuracion))
    .filter(([tipo]) => conAgenda || !RECORDATORIOS[tipo].soloConAgenda)
    .map(([tipo, valor]) => ({
      tipo,
      nombre: textosDelRecordatorio(tipo, rubro).nombre,
      prendido: valor.activo,
      cuando: erroresDelRecordatorio({ tipo, ...valor }).plazo ? "" : cuandoSaleEnPalabras({ tipo, plazo: valor.plazo, rubro }),
      href: `/negocio/recordatorios/${tipo}`,
    }));
}

// ------------------------------------------------------------
// El aviso de volver, en el caso y en la ficha (R-2b)
// ------------------------------------------------------------
// Programarlo, correrlo y cancelarlo lo decide la API (R-2a,
// seguimiento/reglas-volver.ts), dos veces: al anotar la fecha y otra vez
// al momento de mandarlo, porque en el medio pasan meses. Acá sólo se dice
// en palabras lo que la API ya decidió.
//
// El caso trae el último aviso en "aviso_volver" ({ estado, enviar_en,
// procesado_en, motivo }) o null. Lo que nunca llegó a la cola no deja
// fila: el motivo sólo viene en la respuesta de entregar o de corregir la
// fecha, y lib/datos.js lo deja en "motivo_sin_aviso_volver".

// Por qué no sale, por el código de la API. Su texto no se muestra nunca
// (cartilla, 07): si mañana cambia, la pantalla sigue diciendo lo mismo.
export const POR_QUE_NO_VOLVER = {
  sin_cliente: "El caso no tiene cliente, así que no se le avisa cuándo le toca volver.",
  telefono_invalido: "Falta el teléfono del cliente, con código de país, para mandarle el aviso.",
  desactivado: "El aviso de cuándo le toca volver está apagado: no se le va a avisar.",
  ya_paso: "El día de mandar el aviso ya pasó, así que no se manda.",
  whatsapp_no_configurado: "Falta configurar el WhatsApp del negocio para mandar avisos.",
  ya_esta_aca: "Tiene un caso abierto, así que no hace falta avisarle.",
  ya_volvio: "El cliente ya volvió después de este caso, así que no se le avisa.",
  tope_del_mes: "Ya le llegó un mensaje automático este mes, así que no se le manda otro.",
};

const NO_SALE = "No se va a mandar el aviso de cuándo le toca volver.";

// El día en que sale el aviso de una fecha, con la anticipación guardada.
// null si el plazo no es un número de días.
function diaDelAviso(volverEn, plazo) {
  const dias = String(plazo ?? "").trim();
  return partes(volverEn) && /^\d+$/.test(dias) ? sumarDias(volverEn, -Number(dias)) : null;
}

const noSale = (motivo) => ({ estado: "no_sale", motivo, frase: POR_QUE_NO_VOLVER[motivo] ?? NO_SALE });

// Lo que se sabe sin aviso en la cola: lo que contestó la API al guardar
// y, si no, lo que se ve desde el caso, el cliente y la configuración.
function motivoSinFila({ caso, cliente, volver, hoy }) {
  if (caso.motivo_sin_aviso_volver) return caso.motivo_sin_aviso_volver;
  if (!caso.cliente_id) return "sin_cliente";
  if (volver && !volver.activo) return "desactivado";
  if (!telefonoWhatsAppValido(cliente?.telefono)) return "telefono_invalido";
  const dia = volver ? diaDelAviso(caso.volver_en, volver.plazo) : null;
  return dia && yaPaso(dia, hoy) ? "ya_paso" : null;
}

// Lo que el caso dice de su aviso de volver: { estado, frase } (y "motivo"
// si no sale), o null si no hay nada que decir. "volver" es la
// configuración editable del tipo, si ya se leyó.
//
// Con la baja, nada: la baja gana sobre todo, y la ficha ya la dice (R-8b).
export function avisoDeVolver({ caso, cliente, volver = null, hoy }) {
  if (cliente?.avisos_baja_en || !caso?.volver_en) return null;
  const aviso = caso.aviso_volver;
  if (aviso?.motivo === "baja_de_avisos" || aviso?.motivo === "sin_fecha") return null;

  switch (aviso?.estado) {
    case "pendiente":
      return { estado: "programado", frase: `Le llega un aviso por WhatsApp el ${diaEnPalabras(enArgentina(aviso.enviar_en)?.dia)}.` };
    case "enviado":
      return { estado: "enviado", frase: `Le mandamos el aviso por WhatsApp el ${diaEnPalabras(enArgentina(aviso.procesado_en ?? aviso.enviar_en)?.dia)}.` };
    case "fallido":
      return {
        estado: "fallido",
        frase: "No se pudo mandar el aviso de cuándo le toca volver. Revisá que el teléfono del cliente tenga código de país.",
      };
    case "cancelado":
      return noSale(aviso.motivo);
  }

  const motivo = motivoSinFila({ caso, cliente, volver, hoy });
  return motivo && motivo !== "baja_de_avisos" && motivo !== "sin_fecha" ? noSale(motivo) : null;
}

// Al anotar o corregir la fecha, qué va a pasar con el aviso, así nadie
// cree que el sistema va a hacer algo que no hace. null mientras no hay
// fecha válida o no se sabe todavía cómo está configurado.
export function avisoAlAnotarVolver({ volverEn, volver, cliente, hoy }) {
  if (!partes(volverEn) || !volver || cliente?.avisos_baja_en) return null;
  if (!volver.activo) return POR_QUE_NO_VOLVER.desactivado;
  if (cliente && !telefonoWhatsAppValido(cliente.telefono)) return POR_QUE_NO_VOLVER.telefono_invalido;
  const dia = diaDelAviso(volverEn, volver.plazo);
  if (!dia) return null;
  if (yaPaso(dia, hoy)) return POR_QUE_NO_VOLVER.ya_paso;
  return `Le va a llegar un aviso por WhatsApp el ${diaEnPalabras(dia)}.`;
}

// El caso como queda después de entregar o de corregir la fecha: la
// respuesta trae "volver" ({ programado, motivo, aviso }), o null si no se
// tocó la fecha; entonces sigue valiendo lo que el caso ya tenía.
export function conAvisoDeVolver(caso, volver, antes) {
  if (!volver) {
    return {
      ...caso,
      aviso_volver: caso.aviso_volver ?? antes?.aviso_volver ?? null,
      motivo_sin_aviso_volver: antes?.motivo_sin_aviso_volver ?? null,
    };
  }
  return { ...caso, aviso_volver: volver.aviso ?? null, motivo_sin_aviso_volver: volver.aviso ? null : volver.motivo ?? null };
}

// La próxima visita de la ficha, con el caso que la tiene y su aviso.
export function avisoDeLaProximaVisita({ casos, cliente, volver = null, hoy }) {
  const dia = proximaVisita(casos, hoy);
  if (!dia) return null;
  const caso = casos.find((c) => c.volver_en === dia);
  return { dia, caso, aviso: avisoDeVolver({ caso, cliente, volver, hoy }) };
}

// ------------------------------------------------------------
// La baja de avisos (R-8b)
// ------------------------------------------------------------
// El cliente la pide contestando BAJA por WhatsApp, y la API la registra
// en cliente.avisos_baja_en (R-8a): un instante, no un sí/no. Desde ahí no
// se le programa ningún aviso, de ningún tipo.
//
// No es un error: el cliente ejerció un derecho. Las frases lo informan, y
// lo que dice la API se traduce acá: su texto no se muestra (cartilla, 07).

// Lo que la ficha dice de la baja: { dia, frase, consecuencia }, o null si
// nunca la pidió. El día es el de Argentina: un pedido de las 22:30 es de
// ese día, aunque en UTC ya sea el siguiente.
export function bajaDeAvisos({ cliente, rubro }) {
  const cuando = cliente?.avisos_baja_en ? enArgentina(cliente.avisos_baja_en) : null;
  if (!cuando) return null;
  const { cita } = vocabulario(rubro);
  return {
    dia: cuando.dia,
    frase: `Pidió no recibir mensajes automáticos el ${diaEnPalabras(cuando.dia)}.`,
    consecuencia: `No le van a llegar los recordatorios de sus ${cita.palabra(2)} ni los mensajes de seguimiento por WhatsApp.`,
  };
}

// Al entregar o cambiar de estado la API dice, en sin_aviso, por qué no
// programó el mensaje. La frase sale del motivo, no de su texto.
export function porQueNoSeAviso(sinAviso) {
  if (!sinAviso) return null;
  return sinAviso.motivo === "baja_de_avisos"
    ? "No se programó el mensaje porque el cliente pidió no recibir avisos."
    : "No se programó el mensaje por WhatsApp.";
}

// Por qué no se pudo revertir la baja, dicho por lo que pasó y qué hacer.
const AL_REVERTIR = {
  sin_permiso: "Que el cliente vuelva a recibir avisos lo decide el dueño o el encargado del negocio.",
  cliente_no_encontrado: "No encontramos a este cliente. Volvé a la lista de clientes y buscalo de nuevo.",
  no_esta: "No encontramos a este cliente. Volvé a la lista de clientes y buscalo de nuevo.",
  sin_conexion: "Se cortó internet. Cuando vuelva, probá de nuevo: el cliente sigue sin recibir avisos.",
  sesion_vencida: "Tu sesión venció. Volvé a entrar y probá de nuevo.",
};

export const errorAlRevertirBaja = (error) =>
  AL_REVERTIR[error?.codigo] ?? "No pudimos volver a activar sus avisos. Probá de nuevo en un rato.";
