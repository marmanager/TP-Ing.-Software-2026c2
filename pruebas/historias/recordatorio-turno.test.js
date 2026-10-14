// Correr con: npm run test:unit
//
// R-4b · Recordarle el turno al cliente (módulo Recordatorios).
//
// La lógica pura de src/lib/recordatorios.js para el recordatorio de turno:
// cuándo sale el aviso, cuándo un turno no tiene, cómo se dice la
// anticipación y cómo se cuenta en el turno lo que pasó con el aviso.
//
// Cuándo programar, reprogramar o cancelar lo decide la API (R-4a,
// seguimiento/reglas-turno.ts). Acá sólo se traduce a palabras lo que la API
// dice, y se calcula lo que la pantalla muestra antes de guardar.
//
// "ahora" entra por parámetro y las horas son las de Argentina: el test no
// depende del día ni del huso de la máquina que lo corre.

import { describe, expect, test } from "@jest/globals";
import {
  anticipacionEnPalabras,
  avisoEnPalabras,
  cuandoSaleElAviso,
  cuandoSaleEnPalabras,
  erroresDelRecordatorio,
  porQueNoHayAviso,
} from "../../src/lib/recordatorios.js";

// Martes 13 de octubre de 2026, 10:00 en Argentina.
const AHORA = "2026-10-13T13:00:00.000Z";

const turno = (cambios = {}) => ({
  id: "t1",
  cliente_id: "c1",
  empieza_en: "2026-10-15T13:00:00+00:00", // jueves 15, 10:00 en Argentina
  estado: "agendado",
  ...cambios,
});

describe("Historia: recordarle el turno al cliente", () => {
  // ------------------------------------------------------------
  // Cuándo sale
  // ------------------------------------------------------------

  test("calcula cuándo sale el aviso de un turno según las horas de anticipación", () => {
    expect(cuandoSaleElAviso({ empiezaEn: "2026-10-15T13:00:00+00:00", horas: 24 }))
      .toEqual({ dia: "2026-10-14", hora: "10:00" });
    expect(cuandoSaleElAviso({ empiezaEn: "2026-10-15T13:00:00+00:00", horas: 2 }))
      .toEqual({ dia: "2026-10-15", hora: "08:00" });
    expect(cuandoSaleElAviso({ empiezaEn: null, horas: 24 })).toBeNull();
  });

  test("un turno de las 21:00 calcula su aviso en el día correcto", () => {
    // Jueves 15 a las 21:00 en Argentina son las 00:00 del 16 en UTC. Un día
    // antes son las 00:00 del 15 en UTC: toISOString() diría "2026-10-15",
    // pero para el cliente es el miércoles 14 a las 21:00.
    expect(cuandoSaleElAviso({ empiezaEn: "2026-10-16T00:00:00.000Z", horas: 24 }))
      .toEqual({ dia: "2026-10-14", hora: "21:00" });
  });

  // ------------------------------------------------------------
  // Cuándo un turno no tiene aviso
  // ------------------------------------------------------------

  test("un turno sin cliente no tiene aviso", () => {
    const sinCliente = porQueNoHayAviso({ turno: turno({ cliente_id: null }), cliente: null, rubro: "taller" });
    expect(sinCliente.motivo).toBe("sin_cliente");
    expect(sinCliente.frase).toMatch(/no tiene cliente/);
  });

  test("un cliente sin teléfono no tiene aviso y dice por qué", () => {
    for (const telefono of [null, "", "15 1234", "abc"]) {
      const r = porQueNoHayAviso({ turno: turno(), cliente: { id: "c1", telefono }, rubro: "taller" });
      expect(r.motivo).toBe("sin_telefono");
      expect(r.frase).toMatch(/teléfono/);
    }
    // Con teléfono con código de país, sí hay aviso.
    expect(porQueNoHayAviso({ turno: turno(), cliente: { id: "c1", telefono: "+54 9 341 456 7890" }, rubro: "taller" }))
      .toBeNull();
  });

  // ------------------------------------------------------------
  // El texto y el plazo
  // ------------------------------------------------------------

  test("la frase de cuándo sale usa la palabra del rubro", () => {
    // El texto sugerido lo arma la API según el rubro (sugeridaTurno): el
    // front no tiene copia. Lo que sí es del front es la frase que explica
    // cuándo sale, y en un consultorio un turno es una consulta.
    expect(cuandoSaleEnPalabras({ tipo: "turno", plazo: 24, rubro: "medicina" }))
      .toBe("Le llega al cliente el día anterior a su consulta, a la misma hora.");
    expect(cuandoSaleEnPalabras({ tipo: "turno", plazo: 2, rubro: "taller" }))
      .toBe("Le llega al cliente dos horas antes de su turno.");
    expect(cuandoSaleEnPalabras({ tipo: "cierre", plazo: 7, rubro: "taller" }))
      .toBe("Le llega al cliente siete días después de que entregás el caso.");
    expect(cuandoSaleEnPalabras({ tipo: "cierre", plazo: 0, rubro: "taller" }))
      .toBe("Le llega al cliente apenas entregás el caso.");
  });

  test("un texto vacío no es válido", () => {
    expect(erroresDelRecordatorio({ tipo: "turno", plazo: "24", mensaje: "  " }).mensaje)
      .toMatch(/Escribí el mensaje/);
    expect(erroresDelRecordatorio({ tipo: "turno", plazo: "24", mensaje: "Hola" })).toEqual({});
    // Y el plazo, en su unidad: horas para el turno, días para el posventa.
    expect(erroresDelRecordatorio({ tipo: "turno", plazo: "0", mensaje: "Hola" }).plazo).toMatch(/entre 1 y 168 horas/);
    expect(erroresDelRecordatorio({ tipo: "turno", plazo: "2.5", mensaje: "Hola" }).plazo).toMatch(/horas/);
    expect(erroresDelRecordatorio({ tipo: "cierre", plazo: "0", mensaje: "Hola" })).toEqual({});
    expect(erroresDelRecordatorio({ tipo: "cierre", plazo: "-1", mensaje: "Hola" }).plazo).toMatch(/días/);
  });

  test("las horas se muestran en palabras (\"el día anterior\", \"dos horas antes\")", () => {
    expect(anticipacionEnPalabras(24)).toBe("el día anterior");
    expect(anticipacionEnPalabras(2)).toBe("dos horas antes");
    expect(anticipacionEnPalabras(1)).toBe("una hora antes");
    expect(anticipacionEnPalabras(48)).toBe("dos días antes");
    expect(anticipacionEnPalabras(168)).toBe("una semana antes");
    expect(anticipacionEnPalabras(36)).toBe("36 horas antes");
  });

  // ------------------------------------------------------------
  // Lo que muestra el turno
  // ------------------------------------------------------------

  test("un aviso programado dice cuándo le llega al cliente", () => {
    const r = avisoEnPalabras({
      aviso: { estado: "pendiente", enviar_en: "2026-10-14T13:00:00+00:00" },
      ahora: AHORA,
    });
    expect(r).toEqual({ estado: "programado", frase: "Le va a llegar el recordatorio mañana a las 10:00." });

    const masLejos = avisoEnPalabras({
      aviso: { estado: "pendiente", enviar_en: "2026-10-20T00:30:00.000Z" },
      ahora: AHORA,
    });
    expect(masLejos.frase).toBe("Le va a llegar el recordatorio el 19 de octubre a las 21:30.");
  });

  test("un aviso que ya salió se muestra como enviado", () => {
    const r = avisoEnPalabras({
      aviso: { estado: "enviado", enviar_en: "2026-10-13T12:00:00Z", procesado_en: "2026-10-13T12:00:20Z" },
      ahora: AHORA,
    });
    expect(r).toEqual({ estado: "enviado", frase: "Le mandamos el recordatorio hoy a las 09:00." });
  });

  test("un aviso fallido se traduce a una frase para la persona, sin el error técnico", () => {
    const r = avisoEnPalabras({
      aviso: { estado: "fallido", enviar_en: "2026-10-13T12:00:00Z", error: "Kapso rechazó el envío (HTTP 400)" },
      ahora: AHORA,
    });
    expect(r.estado).toBe("fallido");
    expect(r.frase).toBe("No se pudo enviar el recordatorio. Revisá que el teléfono del cliente tenga código de país.");
    expect(r.frase).not.toMatch(/Kapso|HTTP|400|error/i);
  });

  test("un aviso cancelado, o ninguno, no muestra nada", () => {
    expect(avisoEnPalabras({ aviso: { estado: "cancelado", enviar_en: "2026-10-14T13:00:00Z" }, ahora: AHORA })).toBeNull();
    expect(avisoEnPalabras({ aviso: null, ahora: AHORA })).toBeNull();
  });
});
