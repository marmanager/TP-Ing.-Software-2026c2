// Correr con: npm run test:unit
//
// R-10b · Mostrar las respuestas del cliente (módulo Recordatorios).
//
// El cliente contesta los avisos por WhatsApp y la API lo guarda (R-10a): si
// dice que sí o que no a un recordatorio de turno, lo anota en el turno
// (turno.respuesta_cliente, "confirmo" o "no_puede"); si pide la baja, en el
// cliente; y todo lo que escribió queda en las respuestas, que se leen por
// negocio (la bandeja) o por caso (con el aviso que contestó, "contexto").
//
// Acá se prueba lo que la pantalla dice de eso, con la lógica pura de
// src/lib/recordatorios.js. Dos cosas que ordenan todo:
//
//   · Que el cliente avise que no puede no es un error: es información. Las
//     frases lo dicen sin alarma (el color lo decide la pantalla).
//   · La certeza se dice. Si el cliente citó el aviso, se afirma a qué
//     contestó; si la API lo asoció al último que le mandamos, es una
//     deducción y la frase suena a deducción.
//
// Las respuestas tienen la forma de la API: la bandeja, sin contexto; las
// del caso, con él.

import { describe, expect, test } from "@jest/globals";
import {
  aQueContesto,
  cuandoContesto,
  linkParaContestar,
  loQueEscribio,
  respuestaDelTurno,
  respuestasDelCliente,
  respuestasPendientes,
} from "../../src/lib/recordatorios.js";

// El 14 de octubre de 2026 a las 9:00 en Argentina.
const AHORA = Date.parse("2026-10-14T12:00:00+00:00");

const turno = (extra = {}) => ({
  id: "t1",
  cliente_id: "c1",
  empieza_en: "2026-10-20T13:00:00+00:00",
  estado: "agendado",
  respuesta_cliente: null,
  respuesta_cliente_en: null,
  aviso: { estado: "enviado", enviar_en: "2026-10-13T13:00:00+00:00", procesado_en: "2026-10-13T13:00:05+00:00" },
  ...extra,
});

// Una fila de la bandeja, como la manda GET /v1/seguimiento/respuestas.
const respuesta = (id, extra = {}) => ({
  id,
  negocio_id: "n1",
  cliente_id: "c1",
  caso_id: null,
  seguimiento_id: "s1",
  contexto_mensaje_id: null,
  mensaje_id: `wamid.${id}`,
  telefono: "5493414567890",
  tipo: "text",
  texto: "hola",
  enviado_en: "2026-10-13T15:00:00+00:00",
  creado_en: "2026-10-13T15:00:01+00:00",
  ...extra,
});

describe("Historia: las respuestas del cliente", () => {
  test("la ficha lista lo que contestó, con fecha y en orden", () => {
    const respuestas = [
      respuesta("r1", { texto: "primero", enviado_en: "2026-10-10T15:00:00+00:00" }),
      respuesta("r2", { cliente_id: "c2", texto: "de otro", enviado_en: "2026-10-11T15:00:00+00:00" }),
      respuesta("r3", { texto: "último", enviado_en: "2026-10-13T15:00:00+00:00" }),
      respuesta("r4", { texto: "del medio", enviado_en: "2026-10-12T15:00:00+00:00" }),
    ];
    const suyas = respuestasDelCliente({ respuestas, clienteId: "c1" });
    // Sólo las suyas, de la más nueva a la más vieja, como el resto del
    // historial de la ficha.
    expect(suyas.map((r) => r.id)).toEqual(["r3", "r4", "r1"]);
    expect(suyas[0].cuando).toBe("el 13 de octubre a las 12:00");
    // Sin respuestas, una lista vacía: la ficha no muestra la sección.
    expect(respuestasDelCliente({ respuestas: undefined, clienteId: "c1" })).toEqual([]);
  });

  test("la agenda dice que el turno está confirmado por el cliente", () => {
    const r = respuestaDelTurno({
      turno: turno({ estado: "confirmado", respuesta_cliente: "confirmo", respuesta_cliente_en: "2026-10-14T11:30:00+00:00" }),
      rubro: "taller",
      ahora: AHORA,
    });
    expect(r).toEqual({ estado: "confirmo", frase: "Confirmó por WhatsApp hoy a las 08:30." });
  });

  test("la agenda dice que el cliente avisó que no puede", () => {
    const r = respuestaDelTurno({
      turno: turno({ respuesta_cliente: "no_puede", respuesta_cliente_en: "2026-10-13T22:00:00+00:00" }),
      rubro: "medicina",
      ahora: AHORA,
    });
    expect(r.estado).toBe("no_puede");
    // Con la palabra del rubro, y sin tono de falla: el turno sigue en pie y
    // decide el negocio.
    expect(r.frase).toBe("Avisó por WhatsApp que no puede venir a su consulta (el 13 de octubre a las 19:00).");
    expect(r.frase).not.toMatch(/error|falló|no se pudo/i);
  });

  test("un turno sin respuesta dice que todavía no contestó", () => {
    expect(respuestaDelTurno({ turno: turno(), rubro: "taller", ahora: AHORA })).toEqual({
      estado: "sin_respuesta",
      frase: "Todavía no contestó el recordatorio.",
    });
    // Si no le mandamos nada, no hay qué contestar: no se dice nada.
    expect(respuestaDelTurno({ turno: turno({ aviso: null }), rubro: "taller", ahora: AHORA })).toBeNull();
    expect(respuestaDelTurno({ turno: turno({ aviso: { estado: "pendiente", enviar_en: "2026-10-19T13:00:00+00:00" } }), rubro: "taller", ahora: AHORA })).toBeNull();
    // Uno cancelado ya no espera respuesta.
    expect(respuestaDelTurno({ turno: turno({ estado: "cancelado" }), rubro: "taller", ahora: AHORA })).toBeNull();
  });

  test("una respuesta citada dice a qué mensaje contesta", () => {
    const r = aQueContesto({
      contexto: {
        seguimiento_id: "s1", mensaje_id: "wamid.aviso", texto: "Hola Ana, te recordamos tu turno…",
        tipo: "turno", enviado_en: "2026-10-13T13:00:05+00:00", asociacion: "citada",
      },
      rubro: "taller",
    });
    expect(r).toEqual({
      certeza: "citada",
      frase: "Contestó al recordatorio de su turno que le mandamos el 13 de octubre.",
    });
  });

  test("una asociada por último aviso lo dice como deducción, no como certeza", () => {
    const r = aQueContesto({
      contexto: {
        seguimiento_id: "s2", mensaje_id: "wamid.otro", texto: "Hola Ana, ya es hora de volver…",
        tipo: "volver", enviado_en: "2026-10-12T14:00:00+00:00", asociacion: "ultimo_aviso",
      },
      rubro: "taller",
    });
    expect(r.certeza).toBe("deducida");
    expect(r.frase).toBe("Parece contestar al aviso de que le toca volver, que fue lo último que le mandamos, el 12 de octubre.");
    expect(r.frase).not.toMatch(/^Contestó/);
    // Sin contexto no se dice a qué contestó.
    expect(aQueContesto({ contexto: null, rubro: "taller" })).toBeNull();
  });

  test("la bandeja deja afuera las que ya resolvieron un turno", () => {
    const turnos = [
      turno({ id: "t1", estado: "confirmado", respuesta_cliente: "confirmo", respuesta_cliente_en: "2026-10-13T15:00:00+00:00" }),
    ];
    const clientes = [
      { id: "c1", avisos_baja_en: null },
      { id: "c2", avisos_baja_en: "2026-10-13T16:00:00+00:00" },
    ];
    const respuestas = [
      // El "sí" que confirmó el turno t1: ya se ve en la agenda.
      respuesta("r1", { texto: "sí", enviado_en: "2026-10-13T15:00:00+00:00" }),
      // El BAJA de c2: ya se ve en su ficha.
      respuesta("r2", { cliente_id: "c2", texto: "BAJA", enviado_en: "2026-10-13T16:00:00+00:00" }),
      // Una pregunta: nadie la contestó todavía.
      respuesta("r3", { texto: "¿a qué hora cierran?", enviado_en: "2026-10-13T17:00:00+00:00" }),
      // A la misma hora que el "sí", pero de otro cliente: no resolvió nada.
      respuesta("r4", { cliente_id: "c3", texto: "sí", enviado_en: "2026-10-13T15:00:00+00:00" }),
    ];
    // En el orden de la API: de la más vieja a la más nueva.
    expect(respuestasPendientes({ respuestas, turnos, clientes }).map((r) => r.id)).toEqual(["r3", "r4"]);
  });

  test("sin respuestas pendientes devuelve vacío, no undefined", () => {
    expect(respuestasPendientes({ respuestas: undefined, turnos: [], clientes: [] })).toEqual([]);
    expect(respuestasPendientes({ respuestas: [], turnos: undefined, clientes: undefined })).toEqual([]);
    const resueltas = respuestasPendientes({
      respuestas: [respuesta("r1", { enviado_en: "2026-10-13T15:00:00+00:00" })],
      turnos: [turno({ respuesta_cliente: "no_puede", respuesta_cliente_en: "2026-10-13T15:00:00+00:00" })],
      clientes: [],
    });
    expect(resueltas).toEqual([]);
  });

  test("el enlace de wa.me se arma con el número internacional", () => {
    // Como se guarda desde B-1b, o como se ve en pantalla: el mismo link.
    expect(linkParaContestar("5493414567890")).toBe("https://wa.me/5493414567890");
    expect(linkParaContestar("+54 9 341 456 7890")).toBe("https://wa.me/5493414567890");
    expect(linkParaContestar("+598 94 123 456")).toBe("https://wa.me/59894123456");
    // Uno de antes, sin código de país: no se arma, no se adivina el país.
    expect(linkParaContestar("3414567890")).toBeNull();
    expect(linkParaContestar(null)).toBeNull();
  });

  test("el texto del cliente se muestra tal cual", () => {
    const escrito = "  sí pero llego 10 min tarde!! 🙏\nperdon  ";
    expect(loQueEscribio(respuesta("r1", { texto: escrito }))).toEqual({ literal: true, texto: escrito });
    // Una palabra de las que la API entiende tampoco se reemplaza por lo que
    // quiso decir.
    expect(loQueEscribio(respuesta("r2", { texto: "NO" })).texto).toBe("NO");
    // Lo que no es texto (un audio, una foto) no tiene nada que mostrar tal
    // cual: se dice qué mandó.
    expect(loQueEscribio(respuesta("r3", { tipo: "audio", texto: null }))).toEqual({ literal: false, texto: "Mandó un audio." });
  });

  test("una respuesta de las 22:30 se muestra con el día de Argentina", () => {
    // 01:30 del 15 en UTC es 22:30 del 14 en Argentina.
    const r = respuesta("r1", { enviado_en: "2026-10-15T01:30:00+00:00" });
    expect(cuandoContesto(r)).toBe("el 14 de octubre a las 22:30");
    expect(respuestasDelCliente({ respuestas: [r], clienteId: "c1" })[0].cuando).toBe("el 14 de octubre a las 22:30");
  });
});
