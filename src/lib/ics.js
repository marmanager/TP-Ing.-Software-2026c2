// El archivo iCalendar de la agenda: los turnos del negocio, para que el
// dueño los vea en el calendario que ya usa (SCRUM-20, fase 2).
//
// POR QUÉ UN .ics Y NO LA API DE GOOGLE. Google Calendar, el de Apple y
// Outlook se suscriben los tres, de fábrica, a una dirección que devuelva este
// formato. Eso es cero OAuth, cero credenciales guardadas y cero servidor
// hablando con Google. El precio está escrito abajo, en "el techo".
//
// EL TECHO. Es de sólo lectura y Google reconsulta los calendarios suscritos
// cuando quiere —habitualmente cada varias horas, y no respeta ningún encabezado
// que le pidamos—. Apple sí deja elegir cada cuánto. Un turno recién anotado
// puede tardar en aparecer.
//
// ponytail: feed de sólo lectura. Si hace falta que un turno aparezca en el
// minuto, o poder escribir desde Google, el camino es la API con OAuth por
// negocio, y ahí entran las columnas google_evento_id/sincronizado_en que la
// 023 ya dejó puestas. Es otra historia, no un parámetro de ésta.
//
// No tiene React ni Supabase adentro: lo usan el route handler (con datos de
// la base) y el modo de ejemplo (con datos del navegador), y lo corre
// `npm run test:unit`.

import { duracionDe } from "./calendario";

// RFC 5545 §3.3.11: en un valor de texto hay que escapar la barra invertida,
// el punto y coma, la coma y los saltos de línea. Sin esto, un motivo con una
// coma —"Frenos, y ruido raro"— parte el campo en dos y el archivo entero deja
// de parsearse en algunos clientes.
const escapar = (texto) =>
  String(texto ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// RFC 5545 §3.1: ninguna línea puede pasar de 75 octetos. Las que siguen
// arrancan con un espacio.
//
// Se mide en octetos y no en caracteres porque el archivo va en UTF-8 y una
// "ñ" ocupa dos: cortar por caracteres deja líneas de más de 75 octetos, que
// es justo lo que la regla prohíbe. Y se corta contando el carácter entero,
// para no partir una letra por la mitad y romper el UTF-8.
function plegar(linea) {
  const octetos = (s) => new TextEncoder().encode(s).length;
  if (octetos(linea) <= 75) return linea;

  const partes = [];
  let actual = "";
  let tope = 75;

  for (const caracter of linea) {
    if (octetos(actual + caracter) > tope) {
      partes.push(actual);
      actual = " ";
      // Las líneas siguientes arrancan con un espacio que también cuenta.
      tope = 75;
    }
    actual += caracter;
  }
  partes.push(actual);
  return partes.join("\r\n");
}

// "20260921T120000Z". Siempre en UTC, que es lo único que no depende de en qué
// huso esté el que abre el calendario: el cliente lo pasa a la hora local solo.
// Así no hace falta declarar un VTIMEZONE.
function enUtc(fecha) {
  const d = new Date(fecha);
  const dosDigitos = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${dosDigitos(d.getUTCMonth() + 1)}${dosDigitos(d.getUTCDate())}` +
    `T${dosDigitos(d.getUTCHours())}${dosDigitos(d.getUTCMinutes())}${dosDigitos(d.getUTCSeconds())}Z`
  );
}

// Los cuatro estados del turno contra los tres que tiene iCalendar. "atendido"
// ya pasó y fue: para el calendario es un evento confirmado como cualquier
// otro, y el que quiera saber si vino lo mira en Turnos.
const ESTADO_ICS = {
  agendado: "TENTATIVE",
  confirmado: "CONFIRMED",
  cancelado: "CANCELLED",
  atendido: "CONFIRMED",
};

// El armador. "turnos" son filas de la tabla, con el cliente ya resuelto en
// "cliente_nombre" y "cliente_telefono" —la función de la base y el modo de
// ejemplo se los dejan puestos—.
export function armarIcs({ negocio, turnos = [], minutosPorDefecto = 30, ahora = new Date() } = {}) {
  const nombre = negocio?.nombre || "Mi negocio";
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MarManager//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // No son del estándar, pero son las que leen Google y Apple para ponerle
    // nombre a la suscripción. Sin esto el calendario aparece con la dirección
    // entera como título.
    `X-WR-CALNAME:${escapar(nombre)}`,
    "X-WR-CALDESC:" + escapar(`Los turnos de ${nombre}`),
    // Cada cuánto nos gustaría que lo relean. Apple lo respeta; Google lo
    // ignora y relee cuando quiere. Va igual: no cuesta nada y al que lo
    // respeta le sirve.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const t of turnos) {
    const empieza = new Date(t.empieza_en);
    if (Number.isNaN(empieza.getTime())) continue;

    const dura = duracionDe(t, minutosPorDefecto);
    const termina = new Date(empieza.getTime() + dura * 60000);

    const quien = t.cliente_nombre?.trim();
    const detalle = [
      quien ? `Para: ${quien}` : null,
      t.cliente_telefono?.trim() ? `Teléfono: ${t.cliente_telefono.trim()}` : null,
      t.origen === "cliente" ? "Lo pidió por el link." : null,
    ].filter(Boolean);

    lineas.push(
      "BEGIN:VEVENT",
      // El UID tiene que ser estable entre lecturas: si cambiara, el
      // calendario borraría el evento y lo crearía de nuevo cada vez que
      // relee, y perdería los recordatorios que la persona le puso.
      `UID:${t.id}@marmanager`,
      `DTSTAMP:${enUtc(ahora)}`,
      `DTSTART:${enUtc(empieza)}`,
      `DTEND:${enUtc(termina)}`,
      plegar(`SUMMARY:${escapar(quien ? `${t.motivo} · ${quien}` : t.motivo)}`),
      ...(detalle.length ? [plegar(`DESCRIPTION:${escapar(detalle.join("\n"))}`)] : []),
      `STATUS:${ESTADO_ICS[t.estado] ?? "TENTATIVE"}`,
      "END:VEVENT"
    );
  }

  lineas.push("END:VCALENDAR");
  // CRLF, que es lo que pide el RFC. Con saltos de línea de Unix hay clientes
  // que no lo leen.
  return lineas.join("\r\n") + "\r\n";
}
