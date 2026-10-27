// Correr con: npm run test:unit
//
// R-1b · Anotar cuándo le toca volver al cliente (módulo Recordatorios).
// R-2b · Configurar el aviso de que le toca volver y ver cuándo sale.
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
  POR_QUE_NO_VOLVER,
  avisoAlAnotarVolver,
  avisoDeLaProximaVisita,
  avisoDeVolver,
  cambiosDeRecordatorios,
  cambiosDelRecordatorio,
  cuandoSaleEnPalabras,
  errorDeVolverEn,
  erroresDelRecordatorio,
  fechaSugerida,
  filasDeRecordatorios,
  intervaloDeducido,
  proximaVisita,
  recordatoriosDeLaApi,
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

// ------------------------------------------------------------
// R-2b · El aviso de volver sale solo
// ------------------------------------------------------------
// Programarlo, correrlo y cancelarlo lo decide la API (R-2a,
// seguimiento/reglas-volver.ts). Acá se configura, y se dice en palabras
// cuándo sale o por qué no sale, traduciendo el motivo por su código.

const DE_LA_API = {
  activo: true, dias: 7, mensaje: "¿Cómo te fue?",
  turno: { activo: false, horas: 24, mensaje: "Te esperamos mañana." },
  volver: { activo: true, dias: 7, mensaje: "Ya te toca el service." },
};

const CON_TELEFONO = { id: "c1", telefono: "+54 9 341 456 7890", avisos_baja_en: null };
const DADO_DE_BAJA = { ...CON_TELEFONO, avisos_baja_en: "2026-10-01T15:00:00Z" };

const cerrado = (cambios = {}) => ({
  id: "k1", cliente_id: "c1", estado: "completado", volver_en: "2027-04-13", aviso_volver: null, ...cambios,
});

describe("Historia: el aviso de volver sale solo", () => {
  test("la lista muestra los tres recordatorios con su estado", () => {
    const filas = filasDeRecordatorios({ configuracion: DE_LA_API, rubro: "taller", conAgenda: true });
    expect(filas.map((f) => f.tipo)).toEqual(["cierre", "turno", "volver"]);
    expect(filas.map((f) => f.prendido)).toEqual([true, false, true]);
    const volver = filas.find((f) => f.tipo === "volver");
    expect(volver.nombre).toBe("Cuando le toca volver");
    expect(volver.cuando).toMatch(/una semana antes/);
    expect(volver.href).toBe("/negocio/recordatorios/volver");
    // Sin agenda, el de turnos no se configura: no se usa.
    expect(filasDeRecordatorios({ configuracion: DE_LA_API, rubro: "taller", conAgenda: false }).map((f) => f.tipo))
      .toEqual(["cierre", "volver"]);
  });

  test("guardar uno no manda los campos de los otros", () => {
    const guardado = recordatoriosDeLaApi(DE_LA_API);
    expect(guardado.volver).toEqual({ activo: true, plazo: "7", mensaje: "Ya te toca el service." });

    const volver = { ...guardado.volver, plazo: "14" };
    expect(cambiosDelRecordatorio("volver", guardado.volver, volver)).toEqual({ volver: { dias: 14 } });
    expect(cambiosDeRecordatorios(guardado, { ...guardado, volver })).toEqual({ volver: { dias: 14 } });
    // El posventa va arriba y el de turno en "turno", como antes.
    expect(cambiosDelRecordatorio("cierre", guardado.cierre, { ...guardado.cierre, activo: false })).toEqual({ activo: false });
    expect(cambiosDelRecordatorio("turno", guardado.turno, { ...guardado.turno, plazo: "2" })).toEqual({ turno: { horas: 2 } });
    expect(cambiosDelRecordatorio("volver", guardado.volver, guardado.volver)).toEqual({});
  });

  test("la frase de cuándo sale usa la palabra del rubro", () => {
    expect(cuandoSaleEnPalabras({ tipo: "volver", plazo: 7, rubro: "taller" }))
      .toBe("Le llega al cliente una semana antes del día que anotaste para su próximo turno.");
    expect(cuandoSaleEnPalabras({ tipo: "volver", plazo: 3, rubro: "medicina" }))
      .toBe("Le llega al cliente tres días antes del día que anotaste para su próxima consulta.");
    expect(cuandoSaleEnPalabras({ tipo: "volver", plazo: 0, rubro: "taller" }))
      .toBe("Le llega al cliente el mismo día que anotaste para su próximo turno.");
    expect(cuandoSaleEnPalabras({ tipo: "volver", plazo: 1, rubro: "taller" })).toMatch(/un día antes/);
    expect(cuandoSaleEnPalabras({ tipo: "volver", plazo: 14, rubro: "taller" })).toMatch(/dos semanas antes/);
    // Al lado del posventa, que es después: que no se confundan.
    expect(cuandoSaleEnPalabras({ tipo: "cierre", plazo: 7, rubro: "taller" })).toMatch(/después/);
  });

  test("una anticipación fuera de rango apaga el botón y dice qué falta", () => {
    for (const plazo of ["91", "-1", "2.5", "", "siete"]) {
      expect(erroresDelRecordatorio({ tipo: "volver", plazo, mensaje: "Hola" }).plazo)
        .toBe("Elegí una cantidad de días enteros entre 0 y 90.");
    }
    expect(erroresDelRecordatorio({ tipo: "volver", plazo: "0", mensaje: "Hola" })).toEqual({});
    expect(erroresDelRecordatorio({ tipo: "volver", plazo: "90", mensaje: "Hola" })).toEqual({});
  });

  test("un mensaje vacío apaga el botón", () => {
    expect(erroresDelRecordatorio({ tipo: "volver", plazo: "7", mensaje: "   " }).mensaje)
      .toMatch(/Escribí el mensaje/);
  });

  test("el caso cerrado muestra la fecha de volver y el día del aviso", () => {
    const caso = cerrado({ aviso_volver: { estado: "pendiente", enviar_en: "2027-04-06T13:00:00.000Z", motivo: null } });
    expect(diaEnPalabras(caso.volver_en)).toBe("13 de abril de 2027");
    expect(avisoDeVolver({ caso, cliente: CON_TELEFONO, hoy: HOY }))
      .toEqual({ estado: "programado", frase: "Le llega un aviso por WhatsApp el 6 de abril de 2027." });

    const enviado = cerrado({ aviso_volver: { estado: "enviado", enviar_en: "2027-04-06T13:00:00Z", procesado_en: "2027-04-06T13:00:20Z" } });
    expect(avisoDeVolver({ caso: enviado, cliente: CON_TELEFONO, hoy: "2027-04-10" }))
      .toEqual({ estado: "enviado", frase: "Le mandamos el aviso por WhatsApp el 6 de abril de 2027." });

    // Sin fecha no hay nada que decir.
    expect(avisoDeVolver({ caso: cerrado({ volver_en: null }), cliente: CON_TELEFONO, hoy: HOY })).toBeNull();
  });

  test("si el tipo está apagado, el caso lo aclara al anotar la fecha", () => {
    const apagado = { activo: false, plazo: "7", mensaje: "x" };
    const prendido = { activo: true, plazo: "7", mensaje: "x" };
    expect(avisoAlAnotarVolver({ volverEn: "2027-04-13", volver: apagado, cliente: CON_TELEFONO, hoy: HOY }))
      .toBe("El aviso de cuándo le toca volver está apagado: no se le va a avisar.");
    expect(avisoAlAnotarVolver({ volverEn: "2027-04-13", volver: prendido, cliente: CON_TELEFONO, hoy: HOY }))
      .toBe("Le va a llegar un aviso por WhatsApp el 6 de abril de 2027.");
    // Si el aviso caería antes de hoy, no sale.
    expect(avisoAlAnotarVolver({ volverEn: "2026-10-15", volver: prendido, cliente: CON_TELEFONO, hoy: HOY }))
      .toMatch(/ya pasó/);
    // Sin fecha, o sin saber todavía cómo está configurado, no se dice nada.
    expect(avisoAlAnotarVolver({ volverEn: "", volver: apagado, cliente: CON_TELEFONO, hoy: HOY })).toBeNull();
    expect(avisoAlAnotarVolver({ volverEn: "2027-04-13", volver: null, cliente: CON_TELEFONO, hoy: HOY })).toBeNull();
    // Y en el caso cerrado sin aviso en la cola, el apagado es el motivo.
    expect(avisoDeVolver({ caso: cerrado(), cliente: CON_TELEFONO, volver: apagado, hoy: HOY }))
      .toEqual({ estado: "no_sale", motivo: "desactivado", frase: "El aviso de cuándo le toca volver está apagado: no se le va a avisar." });
  });

  test("un cliente dado de baja no muestra nada de este aviso", () => {
    const pendiente = cerrado({ aviso_volver: { estado: "pendiente", enviar_en: "2027-04-06T13:00:00Z" } });
    expect(avisoDeVolver({ caso: pendiente, cliente: DADO_DE_BAJA, hoy: HOY })).toBeNull();
    const cancelado = cerrado({ aviso_volver: { estado: "cancelado", enviar_en: "2027-04-06T13:00:00Z", motivo: "baja_de_avisos" } });
    expect(avisoDeVolver({ caso: cancelado, cliente: CON_TELEFONO, hoy: HOY })).toBeNull();
    expect(avisoAlAnotarVolver({ volverEn: "2027-04-13", volver: { activo: false, plazo: "7" }, cliente: DADO_DE_BAJA, hoy: HOY }))
      .toBeNull();
  });

  test("el motivo de no-aviso se traduce por código, no por el texto de la API", () => {
    const cancelado = (motivo) => cerrado({
      aviso_volver: { estado: "cancelado", enviar_en: "2027-04-06T13:00:00Z", motivo, mensaje: "texto crudo de la API" },
    });
    for (const motivo of ["ya_esta_aca", "ya_volvio", "tope_del_mes", "desactivado", "telefono_invalido", "ya_paso", "whatsapp_no_configurado"]) {
      const r = avisoDeVolver({ caso: cancelado(motivo), cliente: CON_TELEFONO, hoy: HOY });
      expect(r).toEqual({ estado: "no_sale", motivo, frase: POR_QUE_NO_VOLVER[motivo] });
      expect(r.frase).not.toMatch(/texto crudo/);
    }
    expect(POR_QUE_NO_VOLVER.ya_volvio).toMatch(/ya volvió/);
    // Un código que el front no conoce dice algo genérico, nunca el texto.
    expect(avisoDeVolver({ caso: cancelado("algo_nuevo"), cliente: CON_TELEFONO, hoy: HOY }).frase)
      .toBe("No se va a mandar el aviso de cuándo le toca volver.");
    // Lo que contestó la API al guardar, aunque no haya quedado en la cola.
    const recien = cerrado({ motivo_sin_aviso_volver: "telefono_invalido" });
    expect(avisoDeVolver({ caso: recien, cliente: CON_TELEFONO, hoy: HOY }).frase).toBe(POR_QUE_NO_VOLVER.telefono_invalido);
    // Y sin nada en la cola, lo que se sabe del cliente.
    expect(avisoDeVolver({ caso: cerrado(), cliente: { ...CON_TELEFONO, telefono: "341 456 7890" }, hoy: HOY }).motivo)
      .toBe("telefono_invalido");
    // Un fallido dice qué hacer, no el error del proveedor.
    const fallido = cerrado({ aviso_volver: { estado: "fallido", enviar_en: "2027-04-06T13:00:00Z", error: "Kapso (HTTP 400)" } });
    expect(avisoDeVolver({ caso: fallido, cliente: CON_TELEFONO, hoy: "2027-04-10" }).frase).not.toMatch(/Kapso|HTTP/);
  });

  test("la ficha del cliente muestra cuándo le llega el aviso", () => {
    const casos = [
      cerrado({ id: "k1", volver_en: "2027-04-13", aviso_volver: { estado: "pendiente", enviar_en: "2027-04-06T13:00:00Z" } }),
      cerrado({ id: "k2", volver_en: "2027-09-01", aviso_volver: { estado: "pendiente", enviar_en: "2027-08-25T13:00:00Z" } }),
    ];
    const r = avisoDeLaProximaVisita({ casos, cliente: CON_TELEFONO, hoy: HOY });
    expect(r.caso.id).toBe("k1");
    expect(r.aviso.frase).toBe("Le llega un aviso por WhatsApp el 6 de abril de 2027.");
    expect(avisoDeLaProximaVisita({ casos, cliente: DADO_DE_BAJA, hoy: HOY }).aviso).toBeNull();
    expect(avisoDeLaProximaVisita({ casos: [], cliente: CON_TELEFONO, hoy: HOY })).toBeNull();
  });
});
