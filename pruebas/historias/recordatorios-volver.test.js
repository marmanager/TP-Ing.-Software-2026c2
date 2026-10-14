// Correr con: npm run test:unit
//
// R-1b · Anotar cuándo le toca volver al cliente (módulo Recordatorios).
//
// La lógica pura de src/lib/recordatorios.js: qué fecha se sugiere al
// entregar, cuándo una fecha no sirve, cuál es la próxima visita de un
// cliente y cuándo se puede deducir cada cuánto viene.
//
// "hoy" entra siempre por parámetro y las fechas son días del calendario
// ("2026-10-13"), sin hora: así el test no depende del día en que se corre
// ni del huso horario de la máquina.

import { describe, expect, test } from "@jest/globals";
import {
  errorDeVolverEn,
  fechaSugerida,
  intervaloDeducido,
  proximaVisita,
  volverEnParaLaApi,
} from "../../src/lib/recordatorios.js";
import { cadaCuantoVuelve } from "../../src/lib/presets.js";
import { diaDeArgentina, diaEnPalabras } from "../../src/lib/fechas.js";

const HOY = "2026-10-13";

describe("Historia: anotar cuándo le toca volver", () => {
  // ------------------------------------------------------------
  // La fecha sugerida
  // ------------------------------------------------------------

  test("el intervalo del preset define la fecha sugerida", () => {
    // El taller trae seis meses: lo que el mecánico le dice al cliente.
    expect(cadaCuantoVuelve("taller")).toEqual({ meses: 6 });
    expect(fechaSugerida({ rubro: "taller", hoy: HOY })).toBe("2027-04-13");
    expect(fechaSugerida({ rubro: "medicina", hoy: HOY })).toBe("2027-10-13");
  });

  test("un rubro sin intervalo no sugiere ninguna fecha", () => {
    expect(cadaCuantoVuelve("service")).toBeNull();
    expect(fechaSugerida({ rubro: "service", hoy: HOY })).toBeNull();
    expect(fechaSugerida({ rubro: "personalizable", hoy: HOY })).toBeNull();
  });

  test("sumar meses a fin de mes cae en el último día del mes, no en el siguiente", () => {
    // 31 de agosto + 6 meses no existe: es el último de febrero.
    expect(fechaSugerida({ rubro: "taller", hoy: "2026-08-31" })).toBe("2027-02-28");
    expect(fechaSugerida({ rubro: "taller", hoy: "2027-08-31" })).toBe("2028-02-29");
  });

  // ------------------------------------------------------------
  // Qué fecha sirve
  // ------------------------------------------------------------

  test("una fecha vacía es válida", () => {
    expect(errorDeVolverEn("", HOY)).toBeNull();
    expect(errorDeVolverEn(null, HOY)).toBeNull();
    expect(errorDeVolverEn(undefined, HOY)).toBeNull();
  });

  test("rechaza una fecha anterior a hoy", () => {
    expect(errorDeVolverEn("2026-10-12", HOY)).toMatch(/ya pasó/);
    expect(errorDeVolverEn("2025-12-31", HOY)).toMatch(/ya pasó/);
  });

  test("acepta la fecha de hoy", () => {
    expect(errorDeVolverEn(HOY, HOY)).toBeNull();
    expect(errorDeVolverEn("2027-04-13", HOY)).toBeNull();
  });

  // ------------------------------------------------------------
  // La próxima visita del cliente
  // ------------------------------------------------------------

  test("la próxima visita del cliente es la más cercana que no pasó", () => {
    const casos = [
      { id: "a", volver_en: "2027-04-13" },
      { id: "b", volver_en: "2026-12-01" },
      { id: "c", volver_en: null },
      { id: "d" },
    ];
    expect(proximaVisita(casos, HOY)).toBe("2026-12-01");
    // La de hoy todavía no pasó.
    expect(proximaVisita([{ volver_en: HOY }, { volver_en: "2027-01-01" }], HOY)).toBe(HOY);
  });

  test("una fecha que ya pasó no cuenta como próxima visita", () => {
    expect(proximaVisita([{ volver_en: "2026-10-12" }, { volver_en: "2027-01-05" }], HOY)).toBe("2027-01-05");
    expect(proximaVisita([{ volver_en: "2026-10-12" }], HOY)).toBeNull();
  });

  test("un cliente sin fechas no tiene próxima visita", () => {
    expect(proximaVisita([], HOY)).toBeNull();
    expect(proximaVisita([{ volver_en: null }, {}], HOY)).toBeNull();
    expect(proximaVisita(undefined, HOY)).toBeNull();
  });

  // ------------------------------------------------------------
  // Deducir cada cuánto viene
  // ------------------------------------------------------------

  test("deduce el intervalo con tres casos espaciados parejo", () => {
    // 90 días entre cada visita, en cualquier orden.
    const visitas = ["2026-04-12", "2026-01-12", "2026-07-11"];
    expect(intervaloDeducido(visitas, HOY)).toEqual({ dias: 90, fecha: "2027-01-11" });
  });

  test("no deduce intervalo con un solo caso previo", () => {
    expect(intervaloDeducido(["2026-07-10"], HOY)).toBeNull();
    expect(intervaloDeducido(["2026-04-10", "2026-07-10"], HOY)).toBeNull();
    expect(intervaloDeducido([], HOY)).toBeNull();
  });

  test("no deduce intervalo si los casos están espaciados muy distinto", () => {
    // Un mes y después siete: no hay un ritmo que sugerir.
    expect(intervaloDeducido(["2026-01-10", "2026-02-10", "2026-09-10"], HOY)).toBeNull();
  });

  // ------------------------------------------------------------
  // Lo que viaja a la API
  // ------------------------------------------------------------

  test("borrar la fecha viaja como null, que la API entiende como \"sin fecha\"", () => {
    expect(volverEnParaLaApi("")).toBeNull();
    expect(volverEnParaLaApi("  ")).toBeNull();
    expect(volverEnParaLaApi(null)).toBeNull();
    expect(volverEnParaLaApi("2027-04-13")).toBe("2027-04-13");
  });

  // ------------------------------------------------------------
  // De la pantalla a los días del calendario
  // ------------------------------------------------------------

  test("una entrega de la noche cuenta en el día de Argentina, no en el de Greenwich", () => {
    // 22:30 del 13 en Argentina son las 01:30 del 14 en UTC: toISOString()
    // diría "2026-10-14".
    expect(diaDeArgentina("2026-10-14T01:30:00.000Z")).toBe("2026-10-13");
    expect(diaDeArgentina("2026-10-13T12:00:00.000Z")).toBe("2026-10-13");
  });

  test("el día se escribe como se dice, sin pasar por Date", () => {
    expect(diaEnPalabras("2027-04-13")).toBe("13 de abril de 2027");
    expect(diaEnPalabras("2026-12-01")).toBe("1 de diciembre de 2026");
    expect(diaEnPalabras(null)).toBe("");
  });
});
