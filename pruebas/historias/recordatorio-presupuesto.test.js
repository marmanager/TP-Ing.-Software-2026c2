// Correr con: npm run test:unit
//
// R-5b · El aviso del presupuesto sin respuesta (módulo Recordatorios).
//
// Es una entrada más en RECORDATORIOS (src/lib/recordatorios.js): la lista
// de /negocio/recordatorios y su pantalla, /negocio/recordatorios/presupuesto,
// salen del registro sin código de pantalla nuevo (criterio 15). Lo único
// propio es /aprobar, que dice en cada caso cuándo le llega el aviso al
// cliente o si ya se le avisó (criterio 18).
//
// Programarlo, mandarlo o cancelarlo lo decide la API (R-5a,
// seguimiento/reglas-presupuesto.ts). Cada caso trae su último aviso en
// "aviso_presupuesto" ({ estado, enviar_en, procesado_en, motivo }) o null;
// acá sólo se dice en palabras.
//
// "ahora" entra por parámetro: el test no depende de cuándo se corre.

import { describe, expect, test } from "@jest/globals";
import {
  avisoDelPresupuesto,
  cambiosDeRecordatorios,
  conAvisoDeVolver,
  cuandoSaleEnPalabras,
  erroresDelRecordatorio,
  filasDeRecordatorios,
  recordatoriosDeLaApi,
  textosDelRecordatorio,
} from "../../src/lib/recordatorios.js";

// Lunes 19 de octubre de 2026, 12:00 en Argentina.
const AHORA = Date.parse("2026-10-19T15:00:00.000Z");

// Lo que manda GET /v1/negocio/seguimiento con R-5a: el cuarto tipo, en
// "presupuesto", apagado de fábrica y sugerido según el rubro.
const DE_LA_API = {
  activo: true,
  dias: 3,
  mensaje: "¡Gracias por elegirnos!",
  turno: { activo: true, horas: 24, mensaje: "Te esperamos mañana." },
  volver: { activo: false, dias: 7, mensaje: "Ya te toca el service." },
  presupuesto: {
    activo: false,
    dias: 7,
    mensaje: "Hola, el presupuesto que te pasamos sigue disponible.",
    sugerido: true,
  },
};

const conTelefono = { id: "cli-1", telefono: "5493414567890", avisos_baja_en: null };

const caso = (aviso_presupuesto) => ({ id: "caso-1", cliente_id: "cli-1", aviso_presupuesto });

describe("Historia: el aviso del presupuesto sin respuesta", () => {
  // ------------------------------------------------------------
  // En la configuración: una entrada más del registro
  // ------------------------------------------------------------

  test("aparece en la lista de recordatorios con su nombre", () => {
    const filas = filasDeRecordatorios({ configuracion: DE_LA_API, rubro: "taller", conAgenda: true });
    const presupuesto = filas.find((f) => f.tipo === "presupuesto");

    expect(filas.map((f) => f.tipo)).toEqual(["cierre", "turno", "volver", "presupuesto"]);
    expect(presupuesto).toEqual({
      tipo: "presupuesto",
      nombre: "Presupuesto sin respuesta",
      prendido: false,
      cuando: "Le llega al cliente cuando pasaron siete días sin que conteste el presupuesto.",
      href: "/negocio/recordatorios/presupuesto",
    });
    // No depende de la agenda: el presupuesto se arma igual sin turnos.
    expect(filasDeRecordatorios({ configuracion: DE_LA_API, rubro: "taller", conAgenda: false }).map((f) => f.tipo))
      .toContain("presupuesto");
  });

  test("una API sin R-5a no lo ofrece: configurarlo no haría nada", () => {
    const { presupuesto: _, ...sinPresupuesto } = DE_LA_API;
    expect(Object.keys(recordatoriosDeLaApi(sinPresupuesto))).toEqual(["cierre", "turno", "volver"]);
  });

  test("la frase de cuándo sale lo dice sin jerga, y es la misma en todos los rubros", () => {
    // Ningún rubro tiene otra palabra para "presupuesto" ni para "cliente":
    // la frase no cambia. Los números chicos, con letras.
    for (const rubro of ["taller", "medicina", "service", "personalizable"]) {
      expect(cuandoSaleEnPalabras({ tipo: "presupuesto", plazo: 5, rubro }))
        .toBe("Le llega al cliente cuando pasaron cinco días sin que conteste el presupuesto.");
    }
    expect(cuandoSaleEnPalabras({ tipo: "presupuesto", plazo: 1, rubro: "taller" }))
      .toBe("Le llega al cliente cuando pasó un día sin que conteste el presupuesto.");
    expect(cuandoSaleEnPalabras({ tipo: "presupuesto", plazo: 30, rubro: "taller" }))
      .toBe("Le llega al cliente cuando pasaron 30 días sin que conteste el presupuesto.");
  });

  test("su pantalla tiene sus textos y su rango", () => {
    const textos = textosDelRecordatorio("presupuesto", "taller");
    expect(textos).toMatchObject({ nombre: "Presupuesto sin respuesta", min: 1, max: 90 });
    expect(textos.etiquetaPlazo).toBe("¿Cuántos días sin respuesta?");
  });

  test("un plazo fuera de 1 a 90 apaga el botón y dice qué falta", () => {
    const ok = { tipo: "presupuesto", mensaje: "Sigue disponible." };
    const falta = "Elegí una cantidad de días enteros entre 1 y 90.";

    expect(erroresDelRecordatorio({ ...ok, plazo: "1" })).toEqual({});
    expect(erroresDelRecordatorio({ ...ok, plazo: "90" })).toEqual({});
    // 0 no: un presupuesto recién compartido no se reclama el mismo día.
    expect(erroresDelRecordatorio({ ...ok, plazo: "0" })).toEqual({ plazo: falta });
    expect(erroresDelRecordatorio({ ...ok, plazo: "91" })).toEqual({ plazo: falta });
    expect(erroresDelRecordatorio({ ...ok, plazo: "2,5" })).toEqual({ plazo: falta });
    expect(erroresDelRecordatorio({ ...ok, plazo: "" })).toEqual({ plazo: falta });
  });

  test("un mensaje vacío apaga el botón", () => {
    expect(erroresDelRecordatorio({ tipo: "presupuesto", plazo: "7", mensaje: "   " }))
      .toEqual({ mensaje: "Escribí el mensaje que va a recibir el cliente." });
  });

  test("prenderlo manda sólo lo suyo, en su lugar del PATCH", () => {
    const guardado = recordatoriosDeLaApi(DE_LA_API);
    const borrador = { ...guardado, presupuesto: { ...guardado.presupuesto, activo: true, plazo: "10" } };

    expect(cambiosDeRecordatorios(guardado, borrador)).toEqual({ presupuesto: { activo: true, dias: 10 } });
  });

  // ------------------------------------------------------------
  // En /aprobar: cuándo le llega o si ya se le avisó
  // ------------------------------------------------------------

  test("A aprobar dice cuándo le llega el aviso a cada caso", () => {
    const manana = { estado: "pendiente", enviar_en: "2026-10-20T13:00:00.000Z", procesado_en: null, motivo: null };
    const masAdelante = { ...manana, enviar_en: "2026-10-27T13:00:00.000Z" };

    expect(avisoDelPresupuesto({ caso: caso(manana), cliente: conTelefono, ahora: AHORA })).toEqual({
      estado: "programado",
      frase: "Si no contesta antes, le llega un aviso por WhatsApp mañana a las 10:00.",
    });
    expect(avisoDelPresupuesto({ caso: caso(masAdelante), cliente: conTelefono, ahora: AHORA }).frase)
      .toBe("Si no contesta antes, le llega un aviso por WhatsApp el 27 de octubre a las 10:00.");
  });

  test("A aprobar dice si ya se le avisó, y que no se le manda otro", () => {
    const enviado = {
      estado: "enviado",
      enviar_en: "2026-10-16T13:00:00.000Z",
      procesado_en: "2026-10-16T13:00:04.000Z",
      motivo: null,
    };

    expect(avisoDelPresupuesto({ caso: caso(enviado), cliente: conTelefono, ahora: AHORA })).toEqual({
      estado: "enviado",
      frase: "Ya le avisamos por WhatsApp el 16 de octubre a las 10:00. No se le manda otro.",
    });
  });

  test("si no se pudo mandar, dice qué revisar, sin el error del proveedor", () => {
    const fallido = { estado: "fallido", enviar_en: "2026-10-16T13:00:00.000Z", procesado_en: null, motivo: null };

    expect(avisoDelPresupuesto({ caso: caso(fallido), cliente: conTelefono, ahora: AHORA })).toEqual({
      estado: "fallido",
      frase: "No se pudo mandar el aviso del presupuesto. Revisá que el teléfono del cliente tenga código de país.",
    });
  });

  test("si se canceló, dice por qué con su motivo, no con el texto de la API", () => {
    const cancelado = (motivo) => caso({ estado: "cancelado", enviar_en: "2026-10-16T13:00:00.000Z", procesado_en: null, motivo });

    expect(avisoDelPresupuesto({ caso: cancelado("desactivado"), cliente: conTelefono, ahora: AHORA })).toEqual({
      estado: "no_sale",
      motivo: "desactivado",
      frase: "El aviso del presupuesto sin respuesta está apagado: no se le va a avisar.",
    });
    expect(avisoDelPresupuesto({ caso: cancelado("ya_se_aviso"), cliente: conTelefono, ahora: AHORA }).frase)
      .toBe("Ya se le avisó una vez de este presupuesto: no se le manda otro.");
    // Un motivo que el front todavía no conoce no deja la fila muda.
    expect(avisoDelPresupuesto({ caso: cancelado("algo_nuevo"), cliente: conTelefono, ahora: AHORA }).frase)
      .toBe("No se le va a mandar el aviso del presupuesto.");
  });

  test("sin aviso en la cola no dice nada", () => {
    expect(avisoDelPresupuesto({ caso: caso(null), cliente: conTelefono, ahora: AHORA })).toBeNull();
    expect(avisoDelPresupuesto({ caso: { id: "caso-1" }, cliente: conTelefono, ahora: AHORA })).toBeNull();
  });

  test("un cliente dado de baja no muestra nada de este aviso", () => {
    const deBaja = { ...conTelefono, avisos_baja_en: "2026-10-10T18:00:00.000Z" };
    const pendiente = { estado: "pendiente", enviar_en: "2026-10-20T13:00:00.000Z", procesado_en: null, motivo: null };
    const cancelado = { estado: "cancelado", enviar_en: "2026-10-20T13:00:00.000Z", procesado_en: null, motivo: "baja_de_avisos" };

    expect(avisoDelPresupuesto({ caso: caso(pendiente), cliente: deBaja, ahora: AHORA })).toBeNull();
    // Y si la baja la registró la cola, tampoco: la ficha del cliente ya la dice (R-8b).
    expect(avisoDelPresupuesto({ caso: caso(cancelado), cliente: conTelefono, ahora: AHORA })).toBeNull();
  });

  test("al editar el caso, lo que se sabía del aviso no se pierde", () => {
    // Las respuestas de editar un caso traen el caso sin sus avisos: sólo
    // las lecturas los traen. lib/datos.js conserva los de antes.
    const antes = {
      id: "caso-1",
      aviso_volver: null,
      aviso_presupuesto: { estado: "pendiente", enviar_en: "2026-10-20T13:00:00.000Z", procesado_en: null, motivo: null },
    };
    const editado = { id: "caso-1", diagnostico: "Pastillas gastadas" };

    expect(conAvisoDeVolver(editado, null, antes).aviso_presupuesto).toEqual(antes.aviso_presupuesto);
    expect(conAvisoDeVolver(editado, { programado: false, motivo: "sin_fecha", aviso: null }, antes).aviso_presupuesto)
      .toEqual(antes.aviso_presupuesto);
  });
});
