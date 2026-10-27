import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { cuando, diaLargo, diaPasado, elDia, horaYMinutos, diaEnPalabras } from "../src/lib/fechas.js";
import { pesos } from "../src/lib/estados.js";
import { monto, ahorroAnual } from "../src/lib/suscripcion.js";
import { textoPeriodo } from "../src/lib/dashboard.js";
import { intervalosDashboard } from "../src/lib/dashboard-periodos.js";
import { serieActividadCasos } from "../src/lib/dashboard-casos.js";
import { serieAltasClientes } from "../src/lib/dashboard-clientes.js";
import { serieCobros } from "../src/lib/dashboard-cobros.js";
import { formatoNumero } from "../src/lib/formatoNumero.js";

// Los formatos salen del locale de quien mira (es-AR / en-US); sin locale
// siguen saliendo como siempre, en castellano.

// Una fecha vieja, para que cuando()/elDia() caigan en "el día" y no en "hoy".
const VIEJA = "2020-03-04T12:00:00Z";

test("el día y el mes, en el idioma de quien mira", () => {
  assert.equal(cuando(VIEJA), "4 de marzo");
  assert.equal(cuando(VIEJA, "en-US"), "March 4");
  assert.equal(elDia(VIEJA), "el 4 de marzo");
  assert.ok(elDia(VIEJA, "en-US").endsWith("March 4"));
});

test("el día de la semana, en el idioma de quien mira", () => {
  assert.equal(diaLargo(VIEJA), "miércoles, 4 de marzo");
  assert.equal(diaLargo(VIEJA, "en-US"), "Wednesday, March 4");
  assert.equal(diaPasado(VIEJA), "miércoles, 4 de marzo");
  assert.equal(diaPasado(VIEJA, "en-US"), "Wednesday, March 4");
});

test("la hora sigue en 24 horas en los dos idiomas", () => {
  const iso = new Date(2026, 9, 20, 15, 5).toISOString();
  const medianoche = new Date(2026, 9, 20, 0, 5).toISOString();
  assert.equal(horaYMinutos(iso), "15:05");
  assert.equal(horaYMinutos(iso, "en-US"), "15:05");
  assert.equal(horaYMinutos(medianoche, "en-US"), "00:05");
});

test("un día del calendario en palabras, en el idioma de quien mira", () => {
  assert.equal(diaEnPalabras("2027-04-13"), "13 de abril de 2027");
  assert.equal(diaEnPalabras("2027-04-13", "en-US"), "April 13, 2027");
  assert.equal(diaEnPalabras("basura", "en-US"), "");
  assert.equal(diaEnPalabras("2027-13-45", "en-US"), "");
  assert.equal(diaEnPalabras(undefined), "");
});

test("los pesos, con los separadores de quien mira", () => {
  assert.equal(pesos(1234567), "$1.234.567");
  assert.equal(pesos(1234567, "en-US"), "$1,234,567");
});

test("los montos de los planes, con los separadores de quien mira", () => {
  const precio = { usd: 1234, ars: 1234567 };
  assert.equal(monto(precio, "USD"), "USD 1.234");
  assert.equal(monto(precio, "USD", "en-US"), "USD 1,234");
  assert.equal(monto(precio, "ARS"), "$ 1.234.567");
  assert.equal(monto(precio, "ARS", "en-US"), "$ 1,234,567");
  const mensual = { usd: 1000, ars: 1000000 };
  const anual = { usd: 10000, ars: 10000000 };
  assert.equal(ahorroAnual(mensual, anual, "USD"), "USD 2.000");
  assert.equal(ahorroAnual(mensual, anual, "USD", "en-US"), "USD 2,000");
});

test("el período del dashboard, con las fechas de quien mira", () => {
  const p = { desde: "2026-10-01", hasta: "2026-10-20" };
  assert.equal(textoPeriodo(p), "1 de oct de 2026 al 20 de oct de 2026");
  assert.equal(textoPeriodo({ desde: "2026-10-20", hasta: "2026-10-20" }, "en-US"), "Oct 20, 2026");
});

test("las etiquetas de los intervalos del dashboard, con el locale", () => {
  const p = { desde: "2026-10-01", hasta: "2026-11-05" };
  assert.equal(intervalosDashboard(p, "mes")[0].etiqueta, "oct 2026");
  assert.equal(intervalosDashboard(p, "mes", "en-US")[0].etiqueta, "Oct 2026");
  assert.equal(intervalosDashboard(p, "día")[0].etiqueta, "1 oct");
  assert.equal(intervalosDashboard(p, "día", "en-US")[0].etiqueta, "Oct 1");
});

test("las series del dashboard etiquetan con el locale", () => {
  const p = { desde: "2026-10-01", hasta: "2026-10-03" };
  for (const serie of [
    (l) => serieActividadCasos(p, [], [], l).puntos,
    (l) => serieAltasClientes(p, [], l).puntos,
    (l) => serieCobros(p, [], "día", l),
  ]) {
    assert.equal(serie()[0].etiqueta, "1 oct");
    assert.equal(serie("en-US")[0].etiqueta, "Oct 1");
  }
});

test("un formato de número por locale y opciones", () => {
  assert.equal(formatoNumero("en-US").format(1234.5), "1,234.5");
  assert.equal(formatoNumero("es-AR").format(1234.5), "1.234,5");
  assert.equal(formatoNumero("en-US", { style: "percent" }).format(0.25), "25%");
  assert.equal(formatoNumero("en-US"), formatoNumero("en-US"));
});
