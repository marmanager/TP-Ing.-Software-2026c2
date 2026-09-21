// Correr con: npm run test:unit
//
// El archivo iCalendar de la agenda.
//
// Es un formato con reglas que no se ven hasta que un cliente de calendario
// se niega a abrir el archivo: CRLF, líneas de 75 octetos como máximo, y
// comas y punto y coma escapados. Lo que se prueba acá es eso, porque el
// error no aparece en pantalla: aparece en el celular de alguien, tres días
// después, como un calendario vacío.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { armarIcs } from "../src/lib/ics.js";

const AHORA = new Date(Date.UTC(2026, 8, 21, 12, 0, 0));

const turno = (extra = {}) => ({
  id: "11111111-2222-3333-4444-555555555555",
  empieza_en: new Date(Date.UTC(2026, 8, 22, 12, 0, 0)).toISOString(),
  minutos_reservados: 30,
  motivo: "cambio de aceite",
  estado: "confirmado",
  origen: "mostrador",
  cliente_nombre: "Marcela Suárez",
  cliente_telefono: null,
  ...extra,
});

const armar = (turnos, extra = {}) =>
  armarIcs({ negocio: { nombre: "Taller Sur" }, turnos, ahora: AHORA, ...extra });

const lineas = (texto) => texto.split("\r\n");

// ---------- el envoltorio ----------

test("abre y cierra como un calendario", () => {
  const ics = armar([]);
  const l = lineas(ics);
  assert.equal(l[0], "BEGIN:VCALENDAR");
  assert.ok(l.includes("VERSION:2.0"));
  assert.ok(l.includes("END:VCALENDAR"));
});

test("todas las líneas terminan en CRLF", () => {
  // Con saltos de Unix hay clientes que directamente no lo leen.
  const ics = armar([turno()]);
  assert.ok(ics.endsWith("\r\n"));
  const soloLf = ics.replace(/\r\n/g, "");
  assert.ok(!soloLf.includes("\n"), "quedó un salto de línea sin su retorno de carro");
});

test("el calendario lleva el nombre del negocio", () => {
  // Sin esto, en el celular la suscripción aparece con la dirección entera
  // como título.
  assert.ok(lineas(armar([])).includes("X-WR-CALNAME:Taller Sur"));
});

test("sin turnos el archivo igual es válido", () => {
  const l = lineas(armar([]));
  assert.equal(l[0], "BEGIN:VCALENDAR");
  assert.ok(!l.some((x) => x.startsWith("BEGIN:VEVENT")));
});

// ---------- cada turno ----------

test("un turno es un evento con su arranque y su fin", () => {
  const l = lineas(armar([turno()]));
  assert.ok(l.includes("DTSTART:20260922T120000Z"));
  assert.ok(l.includes("DTEND:20260922T123000Z"));
});

test("el fin sale de los minutos del turno", () => {
  const l = lineas(armar([turno({ minutos_reservados: 90 })]));
  assert.ok(l.includes("DTEND:20260922T133000Z"));
});

test("un turno sin minutos propios dura lo que da el negocio", () => {
  const l = lineas(armar([turno({ minutos_reservados: null })], { minutosPorDefecto: 60 }));
  assert.ok(l.includes("DTEND:20260922T130000Z"));
});

test("las fechas van en UTC, sin depender del huso de quien lo abra", () => {
  const ics = armar([turno()]);
  for (const campo of ["DTSTART", "DTEND", "DTSTAMP"]) {
    const linea = lineas(ics).find((l) => l.startsWith(campo + ":"));
    assert.match(linea, /^[A-Z]+:\d{8}T\d{6}Z$/, `${campo} no está en UTC`);
  }
});

test("el identificador del evento es el del turno y no cambia entre lecturas", () => {
  // Si cambiara, el calendario borraría y recrearía el evento en cada
  // lectura, y se perderían los recordatorios que la persona le puso.
  const uno = lineas(armar([turno()])).find((l) => l.startsWith("UID:"));
  const otro = lineas(armar([turno()], { ahora: new Date() })).find((l) => l.startsWith("UID:"));
  assert.equal(uno, otro);
  assert.ok(uno.includes("11111111-2222-3333-4444-555555555555"));
});

test("el título lleva el motivo y quién viene", () => {
  const l = lineas(armar([turno()]));
  assert.ok(l.includes("SUMMARY:cambio de aceite · Marcela Suárez"));
});

test("un turno sin cliente lleva sólo el motivo", () => {
  const l = lineas(armar([turno({ cliente_nombre: null })]));
  assert.ok(l.includes("SUMMARY:cambio de aceite"));
});

test("el teléfono va en el detalle cuando está", () => {
  const ics = armar([turno({ cliente_telefono: "341 456 7890" })]);
  assert.ok(ics.includes("Teléfono: 341 456 7890"));
});

test("sin teléfono no queda un renglón vacío", () => {
  const ics = armar([turno({ cliente_telefono: null })]);
  assert.ok(!ics.includes("Teléfono:"));
});

test("se avisa si el turno lo pidió el cliente por el link", () => {
  const ics = armar([turno({ origen: "cliente" })]);
  assert.ok(ics.includes("Lo pidió por el link."));
});

// ---------- los estados ----------

test("cada estado de turno se traduce al del calendario", () => {
  const esperado = {
    agendado: "TENTATIVE",
    confirmado: "CONFIRMED",
    cancelado: "CANCELLED",
    atendido: "CONFIRMED",
  };
  for (const [estado, ics] of Object.entries(esperado)) {
    assert.ok(
      lineas(armar([turno({ estado })])).includes(`STATUS:${ics}`),
      `${estado} no se tradujo a ${ics}`
    );
  }
});

test("un estado que no conocemos no rompe el archivo", () => {
  assert.ok(lineas(armar([turno({ estado: "loquesea" })])).includes("STATUS:TENTATIVE"));
});

// ---------- lo que rompe el formato ----------

test("una coma en el motivo va escapada", () => {
  // Sin escapar, la coma parte el campo en dos y hay clientes que dejan de
  // leer el archivo entero.
  const ics = armar([turno({ motivo: "Frenos, y ruido raro", cliente_nombre: null })]);
  assert.ok(ics.includes("SUMMARY:Frenos\\, y ruido raro"));
});

test("el punto y coma y la barra invertida también van escapados", () => {
  const ics = armar([turno({ motivo: "a;b\\c", cliente_nombre: null })]);
  assert.ok(ics.includes("SUMMARY:a\\;b\\\\c"));
});

test("un salto de línea adentro de un texto no parte la línea del archivo", () => {
  const ics = armar([turno({ motivo: "primero\nsegundo", cliente_nombre: null })]);
  assert.ok(ics.includes("SUMMARY:primero\\nsegundo"));
});

test("ninguna línea pasa de 75 octetos", () => {
  // La regla se mide en octetos: una "ñ" ocupa dos, así que cortar por
  // caracteres dejaría líneas largas de más.
  const largo = "ñoño ".repeat(40);
  const ics = armar([turno({ motivo: largo })]);
  for (const l of lineas(ics)) {
    assert.ok(
      new TextEncoder().encode(l).length <= 75,
      `línea de ${new TextEncoder().encode(l).length} octetos: ${l.slice(0, 40)}…`
    );
  }
});

test("las líneas partidas siguen con un espacio adelante", () => {
  const ics = armar([turno({ motivo: "x".repeat(200), cliente_nombre: null })]);
  const l = lineas(ics);
  const i = l.findIndex((x) => x.startsWith("SUMMARY:"));
  assert.ok(l[i + 1].startsWith(" "), "la continuación no arranca con espacio");
});

test("al desplegarlo vuelve el texto original", () => {
  // Plegar y despegar tiene que ser de ida y vuelta, o el motivo llega
  // cortado al calendario.
  const motivo = "ñandú " + "largo ".repeat(30);
  const ics = armar([turno({ motivo, cliente_nombre: null })]);
  const desplegado = ics.replace(/\r\n /g, "");
  assert.ok(desplegado.includes(`SUMMARY:${motivo.trim()}`.replace(/,/g, "\\,")));
});

test("un turno con fecha rota se saltea en vez de romper el archivo", () => {
  const ics = armar([turno({ empieza_en: "no es una fecha" }), turno({ id: "otro" })]);
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 1);
  assert.ok(ics.includes("END:VCALENDAR"));
});

test("cada evento abre y cierra", () => {
  const ics = armar([turno(), turno({ id: "b" }), turno({ id: "c" })]);
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 3);
  assert.equal(ics.match(/END:VEVENT/g).length, 3);
});
