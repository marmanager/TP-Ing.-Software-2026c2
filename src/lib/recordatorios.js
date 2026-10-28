// Recordatorios: avisarle al cliente lo que le sirve, con datos que el
// sistema ya tiene (../Modulo-recordatorios.md).
//
// La primera pieza (R-1b) es cuándo le toca volver: se anota al entregar el
// caso, con la fecha típica del rubro ya cargada, y la ficha del cliente
// muestra la próxima. La segunda (R-4b) es el recordatorio de turno por
// WhatsApp: cuándo sale y cómo se cuenta en el turno lo que pasó con él. La
// tercera (R-8b) es la baja: cómo se dice que el cliente pidió no recibirlos.
// La cuarta (R-2b) cierra la primera: el aviso de que le toca volver sale
// solo, y acá se configura y se dice cuándo sale o por qué no. La quinta
// (R-5b) es el aviso del presupuesto sin respuesta: una entrada más del
// registro, y /aprobar dice en cada caso cuándo le llega o si ya se le avisó.
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
import { tCastellano } from "./idioma.js";

// Los textos para mostrar salen del diccionario (recordatorios.*). Lo último
// que reciben las funciones es { t, locale, idioma } (lo que da useIdioma);
// sin eso salen en castellano, como siempre.
const POR_DEFECTO = { t: tCastellano, locale: "es-AR", idioma: "es" };
const lang = (o) => ({ ...POR_DEFECTO, ...o });

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
export function errorDeVolverEn(fecha, hoy, opciones) {
  const { t } = lang(opciones);
  if (!fecha) return null;
  if (!partes(fecha)) return t("recordatorios.errorFecha.noEsDia");
  return yaPaso(fecha, hoy) ? t("recordatorios.errorFecha.yaPaso") : null;
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
const enLetras = (n, t) => t(`recordatorios.numeros.${n}`, {}, String(n));

// La anticipación del recordatorio de turno, como se dice en el mostrador.
export function anticipacionEnPalabras(horas, opciones) {
  const { t } = lang(opciones);
  const h = Number(horas);
  if (h === 24) return t("recordatorios.anticipacion.diaAnterior");
  if (h === 168) return t("recordatorios.anticipacion.semana");
  if (h % 24 === 0 && h / 24 <= 6) return t("recordatorios.anticipacion.dias", { cantidad: enLetras(h / 24, t) });
  if (h === 1) return t("recordatorios.anticipacion.hora");
  return t("recordatorios.anticipacion.horas", { cantidad: enLetras(h, t) });
}

// La anticipación del aviso de volver, en días antes de la fecha anotada
// (el mismo día, n === 0, lo dice la frase de cuandoSale).
function diasAntesEnPalabras(n, t) {
  if (n === 1) return t("recordatorios.diasAntes.un");
  if (n % 7 === 0) return n === 7 ? t("recordatorios.diasAntes.semana") : t("recordatorios.diasAntes.semanas", { cantidad: enLetras(n / 7, t) });
  return t("recordatorios.diasAntes.dias", { cantidad: enLetras(n, t) });
}

// ------------------------------------------------------------
// Los recordatorios, por tipo
// ------------------------------------------------------------
// Uno por tipo de la API: "cierre" (el posventa, en días después de
// entregar), "turno" (en horas antes del turno, R-4b), "volver" (en días
// antes del día que se anotó, R-2b) y "presupuesto" (en días sin respuesta,
// R-5b). Todo lo que cambia de uno a otro está
// acá: dónde viaja en la API, cómo se llama y en qué unidad va su plazo,
// cómo se dice cuándo sale y los textos de su pantalla. Las funciones de
// abajo y las dos pantallas de /negocio/recordatorios recorren este mapa,
// así que sumar un tipo es sumar una entrada.
//
// "enLaApi" es dónde viaja en /negocio/seguimiento: null es arriba de todo
// (el posventa, que fue el primero); si no, el nombre de su objeto.

// Los textos de los tipos que no dependen del rubro: nombre, interruptor,
// ayuda y etiqueta del plazo.
const textosFijos = (tipo, t) => ({
  nombre: t(`recordatorios.tipos.${tipo}.nombre`),
  interruptor: t(`recordatorios.tipos.${tipo}.interruptor`),
  ayudaInterruptor: t(`recordatorios.tipos.${tipo}.ayudaInterruptor`),
  etiquetaPlazo: t(`recordatorios.tipos.${tipo}.etiquetaPlazo`),
  ayudaPlazo: t(`recordatorios.tipos.${tipo}.ayudaPlazo`),
});

const RECORDATORIOS = {
  cierre: {
    enLaApi: null,
    plazo: "dias",
    min: 0,
    max: 3650,
    errorDelPlazo: (t) => t("recordatorios.errorPlazo.dias", { min: 0, max: 3650 }),
    cuandoSale: (n, _voc, t) =>
      n === 0
        ? t("recordatorios.cuandoSale.cierre.enseguida")
        : n === 1
          ? t("recordatorios.cuandoSale.cierre.uno")
          : t("recordatorios.cuandoSale.cierre.varios", { cantidad: enLetras(n, t) }),
    textos: (_voc, t) => textosFijos("cierre", t),
  },
  // En un consultorio el turno es una consulta.
  turno: {
    enLaApi: "turno",
    plazo: "horas",
    min: 1,
    max: 168,
    soloConAgenda: true,
    errorDelPlazo: (t) => t("recordatorios.errorPlazo.horas", { min: 1, max: 168 }),
    cuandoSale: (n, { cita }, t) =>
      n === 24
        ? t("recordatorios.cuandoSale.turno.diaAnterior", { cita: cita.palabra() })
        : t("recordatorios.cuandoSale.turno.otro", { antes: anticipacionEnPalabras(n, { t }), cita: cita.palabra() }),
    textos: ({ cita }, t) => {
      const g = cita.segun("m", "f");
      const vars = { cita: cita.palabra(), un: cita.un() };
      return {
        nombre: t(`recordatorios.tipos.turno.nombre.${g}`, vars),
        interruptor: t(`recordatorios.tipos.turno.interruptor.${g}`, vars),
        ayudaInterruptor: t(`recordatorios.tipos.turno.ayudaInterruptor.${g}`, vars),
        etiquetaPlazo: t("recordatorios.tipos.turno.etiquetaPlazo"),
        ayudaPlazo: t("recordatorios.tipos.turno.ayudaPlazo"),
      };
    },
  },
  // Los días son ANTES de la fecha anotada; los del posventa, después de
  // entregar. Van uno al lado del otro: la frase lo dice sin ambigüedad.
  volver: {
    enLaApi: "volver",
    plazo: "dias",
    min: 0,
    max: 90,
    errorDelPlazo: (t) => t("recordatorios.errorPlazo.dias", { min: 0, max: 90 }),
    cuandoSale: (n, { cita }, t) => {
      const g = cita.segun("m", "f");
      return n === 0
        ? t(`recordatorios.cuandoSale.volver.mismoDia.${g}`, { cita: cita.palabra() })
        : t(`recordatorios.cuandoSale.volver.antes.${g}`, { antes: diasAntesEnPalabras(n, t), cita: cita.palabra() });
    },
    textos: (_voc, t) => textosFijos("volver", t),
  },
  // Los días cuentan desde el paso sin contestar más viejo, y sale una sola
  // vez. No depende de la agenda: el presupuesto se arma igual sin turnos.
  presupuesto: {
    enLaApi: "presupuesto",
    plazo: "dias",
    min: 1,
    max: 90,
    errorDelPlazo: (t) => t("recordatorios.errorPlazo.dias", { min: 1, max: 90 }),
    cuandoSale: (n, _voc, t) =>
      n === 1
        ? t("recordatorios.cuandoSale.presupuesto.uno")
        : t("recordatorios.cuandoSale.presupuesto.varios", { cantidad: enLetras(n, t) }),
    textos: (_voc, t) => textosFijos("presupuesto", t),
  },
};

const definicion = (tipo) => RECORDATORIOS[tipo] ?? RECORDATORIOS.cierre;

export const esTipoDeRecordatorio = (tipo) => Object.hasOwn(RECORDATORIOS, tipo);

// Los textos de la pantalla de un recordatorio, y su plazo mínimo y máximo.
export function textosDelRecordatorio(tipo, rubro, opciones) {
  const { t, idioma } = lang(opciones);
  const def = definicion(tipo);
  return { ...def.textos(vocabulario(rubro, idioma), t), min: def.min, max: def.max };
}

// La frase que explica, sin jerga, cuándo le llega cada mensaje al cliente.
// "tipo" es el de la API.
export function cuandoSaleEnPalabras({ tipo, plazo, rubro }, opciones) {
  const { t, idioma } = lang(opciones);
  return definicion(tipo).cuandoSale(Number(plazo), vocabulario(rubro, idioma), t);
}

// Lo que falta para poder guardar un recordatorio, por campo. El plazo va
// en su unidad y con el rango que valida la API.
export function erroresDelRecordatorio({ tipo, plazo, mensaje }, opciones) {
  const { t } = lang(opciones);
  const { min, max, errorDelPlazo } = definicion(tipo);
  const valor = String(plazo ?? "").trim();
  const entero = /^\d+$/.test(valor) ? Number(valor) : null;
  const plazoMal = (entero === null || entero < min || entero > max) && errorDelPlazo(t);
  const texto = String(mensaje ?? "").trim();
  const mensajeMal = !texto
    ? t("recordatorios.errorMensaje.vacio")
    : texto.length > 3000 && t("recordatorios.errorMensaje.largo");
  return {
    ...(plazoMal ? { plazo: plazoMal } : {}),
    ...(mensajeMal ? { mensaje: mensajeMal } : {}),
  };
}

// Por qué un turno no va a tener recordatorio, cuando se ve desde el
// turno: { motivo, frase }, o null si no hay nada que lo impida. Es lo que
// se señala en vez de dejar un hueco (y, si falta el teléfono, se ofrece
// completarlo).
export function porQueNoHayAviso({ turno, cliente, rubro }, opciones) {
  const { t, idioma } = lang(opciones);
  const { cita } = vocabulario(rubro, idioma);
  if (!turno?.cliente_id) {
    return { motivo: "sin_cliente", frase: t("recordatorios.sinAviso.sinCliente", { el: mayuscula(cita.el()) }) };
  }
  // Antes que el teléfono, como en la API (R-8a): si pidió la baja,
  // completar el teléfono no cambiaría nada.
  if (cliente?.avisos_baja_en) {
    return { motivo: "baja_de_avisos", frase: t("recordatorios.sinAviso.baja", { cita: cita.palabra() }) };
  }
  if (!telefonoWhatsAppValido(cliente?.telefono)) {
    return { motivo: "sin_telefono", frase: t("recordatorios.sinAviso.sinTelefono") };
  }
  return null;
}

// "hoy a las 10:00", "mañana a las 10:00", "el 19 de octubre a las 21:30".
function momentoEnPalabras(instante, ahora, { t, locale }) {
  const cuando = enArgentina(instante);
  if (!cuando) return "";
  const hoy = enArgentina(ahora).dia;
  const vars = { hora: cuando.hora };
  if (cuando.dia === hoy) return t("recordatorios.momento.hoy", vars);
  if (cuando.dia === sumarDias(hoy, 1)) return t("recordatorios.momento.manana", vars);
  return t("recordatorios.momento.dia", { ...vars, dia: diaEnPalabrasSinAño(cuando.dia, locale) });
}

// "19 de octubre" / "October 19": el día sin el año, con el mes que dice Intl.
const diaEnPalabrasSinAño = (dia, locale) => {
  const { a, m, d } = partes(dia);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(Date.UTC(a, m - 1, d, 12));
};

// Lo que pasó con el aviso de un turno, en una frase para la persona:
// { estado: "programado" | "enviado" | "fallido", frase }, o null si no hay
// aviso que mostrar (no tiene, o se canceló).
//
// El error de un envío fallido no se muestra nunca: es texto del proveedor
// ("Kapso rechazó el envío (HTTP 400)"). La frase dice qué hacer, como pide
// la sección 07 de la cartilla. Casi siempre es el número.
export function avisoEnPalabras({ aviso, ahora }, opciones) {
  const l = lang(opciones);
  const { t } = l;
  switch (aviso?.estado) {
    case "pendiente":
      return { estado: "programado", frase: t("recordatorios.aviso.programado", { momento: momentoEnPalabras(aviso.enviar_en, ahora, l) }) };
    case "enviado":
      return { estado: "enviado", frase: t("recordatorios.aviso.enviado", { momento: momentoEnPalabras(aviso.procesado_en ?? aviso.enviar_en, ahora, l) }) };
    case "fallido":
      return { estado: "fallido", frase: t("recordatorios.aviso.fallido") };
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
const SE_AVISA_AL_ANOTAR = new Set(["muy_cerca", "whatsapp_no_configurado", "mail_no_configurado", "no_se_pudo"]);

// El texto lo escribe la API, en castellano. Si es el de fábrica de ese motivo
// (recordatorios.alAnotar.*) se muestra en el idioma de quien mira; si es otro
// —la API lo cambió— se muestra tal cual vino.
export function avisoAlAnotar(recordatorio, opciones) {
  return SE_AVISA_AL_ANOTAR.has(recordatorio?.motivo) ? motivoDelRecordatorio(recordatorio, opciones) : null;
}

// Por qué un turno quedó sin recordatorio, con la frase que mandó la API.
export function motivoDelRecordatorio(recordatorio, opciones) {
  const { t } = lang(opciones);
  const mensaje = recordatorio?.mensaje ?? null;
  if (mensaje == null) return null;
  const clave = `recordatorios.alAnotar.${recordatorio.motivo}`;
  return mensaje === tCastellano(clave, {}, null) ? t(clave) : mensaje;
}

// ------------------------------------------------------------
// La configuración de los recordatorios
// ------------------------------------------------------------
// La API la manda con el posventa arriba ({ activo, dias, mensaje }), el de
// turnos en "turno" ({ activo, horas, mensaje }), el de volver en "volver"
// y el del presupuesto en "presupuesto" ({ activo, dias, mensaje }). La pantalla edita todos igual, cada uno con
// su plazo como texto del campo.

const paraEditar = (c, plazo) => ({
  activo: Boolean(c?.activo),
  plazo: plazo == null ? "" : String(plazo),
  mensaje: c?.mensaje ?? "",
  canal: c?.canal === "email" ? "email" : "whatsapp",
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

// Si la API deja elegir por dónde sale: turno, volver y presupuesto sí; el posventa no.
export const ofreceCanal = (tipo) => Boolean(definicion(tipo).enLaApi);

// Lo que cambió de uno, con los nombres de la API y en su lugar del PATCH.
export function cambiosDelRecordatorio(tipo, antes, ahora) {
  const def = definicion(tipo);
  const cambios = {};
  if (ahora.activo !== antes.activo) cambios.activo = ahora.activo;
  if (String(ahora.plazo).trim() !== String(antes.plazo).trim()) cambios[def.plazo] = Number(ahora.plazo);
  if (ahora.mensaje.trim() !== antes.mensaje.trim()) cambios.mensaje = ahora.mensaje.trim();
  // El posventa (arriba de todo en la API) no tiene canal: sale siempre por WhatsApp.
  if (def.enLaApi && ahora.canal !== antes.canal) cambios.canal = ahora.canal;
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
export function filasDeRecordatorios({ configuracion, rubro, conAgenda }, opciones) {
  return Object.entries(recordatoriosDeLaApi(configuracion))
    .filter(([tipo]) => conAgenda || !RECORDATORIOS[tipo].soloConAgenda)
    .map(([tipo, valor]) => ({
      tipo,
      nombre: textosDelRecordatorio(tipo, rubro, opciones).nombre,
      prendido: valor.activo,
      cuando: erroresDelRecordatorio({ tipo, ...valor }, opciones).plazo ? "" : cuandoSaleEnPalabras({ tipo, plazo: valor.plazo, rubro }, opciones),
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
const CODIGOS_NO_VOLVER = ["sin_cliente", "telefono_invalido", "desactivado", "ya_paso", "whatsapp_no_configurado", "email_invalido", "mail_no_configurado", "ya_esta_aca", "ya_volvio", "tope_del_mes"];

// El texto de cada motivo, en el idioma de t (sin t, en castellano).
export function porQueNoVolver(motivo, opciones) {
  const { t } = lang(opciones);
  return CODIGOS_NO_VOLVER.includes(motivo) ? t(`recordatorios.volver.porQue.${motivo}`) : t("recordatorios.volver.noSale");
}

// Lo mismo, en castellano y por código, como siempre estuvo.
export const POR_QUE_NO_VOLVER = Object.fromEntries(CODIGOS_NO_VOLVER.map((c) => [c, porQueNoVolver(c)]));

// El día en que sale el aviso de una fecha, con la anticipación guardada.
// null si el plazo no es un número de días.
function diaDelAviso(volverEn, plazo) {
  const dias = String(plazo ?? "").trim();
  return partes(volverEn) && /^\d+$/.test(dias) ? sumarDias(volverEn, -Number(dias)) : null;
}

const noSale = (motivo, l) => ({ estado: "no_sale", motivo, frase: porQueNoVolver(motivo, l) });

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
export function avisoDeVolver({ caso, cliente, volver = null, hoy }, opciones) {
  const l = lang(opciones);
  const { t, locale } = l;
  if (cliente?.avisos_baja_en || !caso?.volver_en) return null;
  const aviso = caso.aviso_volver;
  if (aviso?.motivo === "baja_de_avisos" || aviso?.motivo === "sin_fecha") return null;

  switch (aviso?.estado) {
    case "pendiente":
      return { estado: "programado", frase: t("recordatorios.volver.programado", { dia: diaEnPalabras(enArgentina(aviso.enviar_en)?.dia, locale) }) };
    case "enviado":
      return { estado: "enviado", frase: t("recordatorios.volver.enviado", { dia: diaEnPalabras(enArgentina(aviso.procesado_en ?? aviso.enviar_en)?.dia, locale) }) };
    case "fallido":
      return { estado: "fallido", frase: t("recordatorios.volver.fallido") };
    case "cancelado":
      return noSale(aviso.motivo, l);
  }

  const motivo = motivoSinFila({ caso, cliente, volver, hoy });
  return motivo && motivo !== "baja_de_avisos" && motivo !== "sin_fecha" ? noSale(motivo, l) : null;
}

// Al anotar o corregir la fecha, qué va a pasar con el aviso, así nadie
// cree que el sistema va a hacer algo que no hace. null mientras no hay
// fecha válida o no se sabe todavía cómo está configurado.
export function avisoAlAnotarVolver({ volverEn, volver, cliente, hoy }, opciones) {
  const l = lang(opciones);
  if (!partes(volverEn) || !volver || cliente?.avisos_baja_en) return null;
  if (!volver.activo) return porQueNoVolver("desactivado", l);
  if (cliente && !telefonoWhatsAppValido(cliente.telefono)) return porQueNoVolver("telefono_invalido", l);
  const dia = diaDelAviso(volverEn, volver.plazo);
  if (!dia) return null;
  if (yaPaso(dia, hoy)) return porQueNoVolver("ya_paso", l);
  return l.t("recordatorios.volver.alAnotar", { dia: diaEnPalabras(dia, l.locale) });
}

// El caso como queda después de entregar o de corregir la fecha: la
// respuesta trae "volver" ({ programado, motivo, aviso }), o null si no se
// tocó la fecha; entonces sigue valiendo lo que el caso ya tenía. El aviso
// del presupuesto (R-5b) sólo viene en las lecturas: se conserva el de antes.
export function conAvisoDeVolver(caso, volver, antes) {
  const aviso_presupuesto = caso.aviso_presupuesto ?? antes?.aviso_presupuesto ?? null;
  if (!volver) {
    return {
      ...caso,
      aviso_volver: caso.aviso_volver ?? antes?.aviso_volver ?? null,
      motivo_sin_aviso_volver: antes?.motivo_sin_aviso_volver ?? null,
      aviso_presupuesto,
    };
  }
  return {
    ...caso,
    aviso_volver: volver.aviso ?? null,
    motivo_sin_aviso_volver: volver.aviso ? null : volver.motivo ?? null,
    aviso_presupuesto,
  };
}

// La próxima visita de la ficha, con el caso que la tiene y su aviso.
export function avisoDeLaProximaVisita({ casos, cliente, volver = null, hoy }, opciones) {
  const dia = proximaVisita(casos, hoy);
  if (!dia) return null;
  const caso = casos.find((c) => c.volver_en === dia);
  return { dia, caso, aviso: avisoDeVolver({ caso, cliente, volver, hoy }, opciones) };
}

// ------------------------------------------------------------
// El aviso del presupuesto, en /aprobar (R-5b)
// ------------------------------------------------------------
// Programarlo, mandarlo y cancelarlo lo decide la API (R-5a,
// seguimiento/reglas-presupuesto.ts), y el texto se arma al mandarlo. Acá
// sólo se dice lo que ya decidió, para que el dueño sepa a quién llamar:
// sale una sola vez, así que después del aviso insistir es cosa suya.
//
// El caso trae el último aviso en "aviso_presupuesto" ({ estado,
// enviar_en, procesado_en, motivo }) o null. Sin fila no se dice nada: la
// pantalla no lee la configuración, y adivinar por qué no hay aviso
// (apagado, sin link, sin teléfono) diría cosas que pueden no ser ciertas.

// Por qué no sale, por el código de la API. Su texto no se muestra nunca
// (cartilla, 07).
const CODIGOS_NO_PRESUPUESTO = ["sin_cliente", "telefono_invalido", "desactivado", "whatsapp_no_configurado", "email_invalido", "mail_no_configurado", "sin_link", "todo_contestado", "caso_cerrado", "ya_se_aviso"];

export function porQueNoPresupuesto(motivo, opciones) {
  const { t } = lang(opciones);
  return CODIGOS_NO_PRESUPUESTO.includes(motivo) ? t(`recordatorios.presupuesto.porQue.${motivo}`) : t("recordatorios.presupuesto.noSale");
}

export const POR_QUE_NO_PRESUPUESTO = Object.fromEntries(CODIGOS_NO_PRESUPUESTO.map((c) => [c, porQueNoPresupuesto(c)]));

// Lo que /aprobar dice del aviso de un caso: { estado, frase } (y
// "motivo" si no sale), o null si no hay nada que decir. Con la baja,
// nada: la ficha del cliente ya la dice (R-8b).
export function avisoDelPresupuesto({ caso, cliente, ahora }, opciones) {
  const l = lang(opciones);
  const { t } = l;
  const aviso = caso?.aviso_presupuesto;
  if (!aviso || cliente?.avisos_baja_en || aviso.motivo === "baja_de_avisos") return null;

  switch (aviso.estado) {
    case "pendiente":
      return { estado: "programado", frase: t("recordatorios.presupuesto.programado", { momento: momentoEnPalabras(aviso.enviar_en, ahora, l) }) };
    case "enviado":
      return {
        estado: "enviado",
        frase: t("recordatorios.presupuesto.enviado", { momento: momentoEnPalabras(aviso.procesado_en ?? aviso.enviar_en, ahora, l) }),
      };
    case "fallido":
      return { estado: "fallido", frase: t("recordatorios.presupuesto.fallido") };
    case "cancelado":
      return { estado: "no_sale", motivo: aviso.motivo, frase: porQueNoPresupuesto(aviso.motivo, l) };
    default:
      return null;
  }
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
export function bajaDeAvisos({ cliente, rubro }, opciones) {
  const { t, locale, idioma } = lang(opciones);
  const cuando = cliente?.avisos_baja_en ? enArgentina(cliente.avisos_baja_en) : null;
  if (!cuando) return null;
  const { cita } = vocabulario(rubro, idioma);
  return {
    dia: cuando.dia,
    frase: t("recordatorios.baja.frase", { dia: diaEnPalabras(cuando.dia, locale) }),
    consecuencia: t("recordatorios.baja.consecuencia", { citas: cita.palabra(2) }),
  };
}

// Al entregar o cambiar de estado la API dice, en sin_aviso, por qué no
// programó el mensaje. La frase sale del motivo, no de su texto.
export function porQueNoSeAviso(sinAviso, opciones) {
  const { t } = lang(opciones);
  if (!sinAviso) return null;
  return sinAviso.motivo === "baja_de_avisos" ? t("recordatorios.baja.noSeAviso") : t("recordatorios.baja.noSeAvisoOtro");
}

// Por qué no se pudo revertir la baja, dicho por lo que pasó y qué hacer.
const AL_REVERTIR = ["sin_permiso", "cliente_no_encontrado", "no_esta", "sin_conexion", "sesion_vencida"];

export function errorAlRevertirBaja(error, opciones) {
  const { t } = lang(opciones);
  return t(`recordatorios.alRevertir.${AL_REVERTIR.includes(error?.codigo) ? error.codigo : "otro"}`);
}
