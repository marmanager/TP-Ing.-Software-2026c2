// Correr con: npm run test:unit
//
// Agenda, turnos y seguimiento público en los dos idiomas (docs/idiomas.md).
// Las funciones de src/lib/ que devuelven texto usan el `t` y el `locale` que
// se les pasan y, sin ellos, salen en castellano; los nombres de los días y de
// los meses salen de Intl, no del diccionario.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";
import { traducir } from "../src/lib/idioma.js";
import { diaLargo, diaLargoEnFrase, diaPasadoEnFrase, elDia } from "../src/lib/fechas.js";
import { estadoDeTurno, ESTADOS_TURNO } from "../src/lib/turnos.js";
import {
  DIAS,
  ANTICIPACIONES,
  HORIZONTES,
  cortoDelDia,
  enFranjas,
  nombreDelDia,
  palabraDeAnticipacion,
  problemasDeHorarios,
} from "../src/lib/horarios.js";
import {
  DIAS_DE_LA_SEMANA,
  MES_CORTO,
  MES_LARGO,
  diasDeLaSemana,
  mesCorto,
  mesLargo,
  semanaDe,
  tituloDeSemana,
} from "../src/lib/calendario.js";
import { laEspera, mensajeDeConsulta } from "../src/lib/seguimiento.js";

const tEn = (c, v, s) => traducir({ diccionario: en, base: es, locale: "en-US" }, c, v, s);

test("nombres de días y meses: Intl en castellano igual que siempre, y en inglés", () => {
  assert.deepEqual(DIAS_DE_LA_SEMANA, ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
  assert.deepEqual(MES_LARGO, [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ]);
  assert.deepEqual(MES_CORTO, ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]);
  assert.deepEqual(
    DIAS.map((d) => [d.nombre, d.corto]),
    [["Lunes", "Lun"], ["Martes", "Mar"], ["Miércoles", "Mié"], ["Jueves", "Jue"], ["Viernes", "Vie"], ["Sábado", "Sáb"], ["Domingo", "Dom"]]
  );
  assert.deepEqual(diasDeLaSemana("en-US"), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert.equal(mesLargo(8, "en-US"), "September");
  assert.equal(mesCorto(0, "en-US"), "Jan");
  assert.equal(nombreDelDia(0, "en-US"), "Sunday");
  assert.equal(cortoDelDia(3, "en-US"), "Wed");
});

test("fechas: hoy, mañana y ayer en las frases salen del t; sin t, en castellano", () => {
  const hoy = new Date();
  const manana = new Date(Date.now() + 86400000);
  const ayer = new Date(Date.now() - 86400000);
  assert.equal(diaLargo(hoy), "Hoy");
  assert.equal(diaLargo(manana), "Mañana");
  assert.equal(diaLargo(hoy, "en-US", tEn), "Today");
  assert.equal(diaLargo(manana, "en-US", tEn), "Tomorrow");
  assert.equal(diaLargoEnFrase(hoy), "hoy");
  assert.equal(diaLargoEnFrase(manana, "en-US", tEn), "tomorrow");
  assert.equal(diaPasadoEnFrase(ayer, "en-US", tEn), "yesterday");
  assert.equal(elDia(hoy, "en-US", tEn), "today");
  assert.equal(elDia(ayer), "ayer");
  // Un día lejano: "el 2 de septiembre" / "September 2", sin palabras sueltas en castellano.
  const lejano = new Date(2020, 8, 2, 12);
  assert.equal(elDia(lejano), "el 2 de septiembre");
  assert.equal(elDia(lejano, "en-US", tEn), "September 2");
  assert.equal(diaLargo(lejano, "en-US", tEn), "Wednesday, September 2");
});

test("turnos: los cuatro estados en los dos idiomas", () => {
  assert.equal(estadoDeTurno("agendado").palabra, "Sin confirmar");
  assert.equal(ESTADOS_TURNO.atendido.palabra, "Ya vino");
  assert.deepEqual(
    ["agendado", "confirmado", "cancelado", "atendido"].map((e) => estadoDeTurno(e, tEn).palabra),
    ["Not confirmed", "Confirmed", "Canceled", "Came in"]
  );
  assert.match(estadoDeTurno("confirmado", tEn).significado, /coming/);
  // Lo que no es texto no cambia con el idioma.
  assert.equal(estadoDeTurno("cancelado", tEn).texto, ESTADOS_TURNO.cancelado.texto);
});

test("horarios: problemas, franjas y palabras de las opciones", () => {
  assert.deepEqual(problemasDeHorarios(null), ["Todavía no configuraste tus horarios."]);
  assert.deepEqual(problemasDeHorarios(null, tEn), ["You haven't set your hours yet."]);
  assert.deepEqual(
    problemasDeHorarios({ dias: ["lun"], desde: "09:00", hasta: "09:20", minutos: 30 }, tEn),
    ["No 30-minute appointment fits in those hours."]
  );
  const huecos = [new Date(2026, 8, 22, 9), new Date(2026, 8, 22, 16)];
  assert.deepEqual(enFranjas(huecos).map((f) => f.nombre), ["A la mañana", "A la tarde"]);
  assert.deepEqual(enFranjas(huecos, tEn).map((f) => f.nombre), ["In the morning", "In the afternoon"]);
  assert.deepEqual(ANTICIPACIONES.map((a) => a.palabra), ["Sin mínimo", "2 horas antes", "Un día antes", "Dos días antes"]);
  assert.deepEqual(HORIZONTES.map((h) => h.palabra), ["Dos semanas", "Un mes", "Dos meses", "Tres meses"]);
  assert.equal(palabraDeAnticipacion(24, tEn), "A day ahead");
});

test("calendario: el título de la semana, en los dos idiomas", () => {
  const semana = (y, m, d) => semanaDe(new Date(y, m, d));
  assert.equal(tituloDeSemana(semana(2026, 8, 21)), "21 al 27 de septiembre");
  assert.equal(tituloDeSemana(semana(2026, 8, 21), "en-US", tEn), "September 21 to 27");
  assert.equal(tituloDeSemana(semana(2026, 8, 30)), "28 de septiembre al 4 de octubre");
  assert.equal(tituloDeSemana(semana(2026, 8, 30), "en-US", tEn), "September 28 to October 4");
  assert.equal(tituloDeSemana(semana(2026, 11, 31), "en-US", tEn), "December 28, 2026 to January 3, 2027");
});

test("seguimiento: la espera y el mensaje de consulta salen en el idioma del t", () => {
  const caso = { estado: "esperando", porResponder: 0, queFalta: "El filtro de aceite", espera: { negocio: "un repuesto" } };
  assert.equal(laEspera(caso).titulo, "Estamos esperando el filtro de aceite.");
  assert.equal(laEspera(caso, tEn).titulo, "We're waiting for el filtro de aceite.");
  // El texto genérico del rubro, escrito en cualquiera de los dos idiomas, se descarta.
  const generico = ["Algo que falta", "Something that's missing"];
  const e = laEspera({ ...caso, queFalta: "Something that's missing", generico }, tEn);
  assert.equal(e.titulo, "We're waiting for un repuesto.");
  assert.equal(laEspera({ ...caso, porResponder: 2, espera: { cliente: "your reply" } }, tEn).titulo, "We're waiting for your reply.");
  assert.equal(laEspera({ estado: "esperando", porResponder: 1 }, tEn).titulo, "We're waiting for your reply.");

  const datos = { clienteNombre: "Ana", identificador: "AB123CD", paso: "Frenos" };
  assert.equal(
    mensajeDeConsulta(datos),
    "Hola, soy Ana. Te escribo por AB123CD. Quería preguntarte por «Frenos» antes de decidir."
  );
  assert.equal(
    mensajeDeConsulta(datos, tEn),
    "Hi, I'm Ana. I'm writing about AB123CD. I wanted to ask you about “Frenos” before deciding."
  );
  assert.equal(mensajeDeConsulta({}, tEn), "Hi. I'm writing about what I left. I had a question.");
});

// Las claves nuevas de agenda, turnos y seguimiento están en los dos idiomas con
// las mismas variables {x}.
test("agenda, turnos, seguimiento: mismas claves y variables en es y en", () => {
  const aplanar = (o, p = "") =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === "object" && !("other" in v) ? aplanar(v, `${p}${k}.`) : [[`${p}${k}`, v]]
    );
  const vars = (v) => [...new Set((typeof v === "string" ? v : `${v.one} ${v.other}`).match(/\{\w+\}/g) ?? [])].sort();
  for (const top of ["agenda", "turnos", "seguimiento"]) {
    const deEs = new Map(aplanar(es[top], `${top}.`));
    const deEn = new Map(aplanar(en[top], `${top}.`));
    assert.deepEqual([...deEn.keys()].sort(), [...deEs.keys()].sort(), top);
    for (const [clave, valor] of deEs) {
      // Un plural en inglés puede no usar {n} en "one" ("every day"), pero las demás variables sí.
      const a = vars(valor).filter((x) => x !== "{n}");
      const b = vars(deEn.get(clave)).filter((x) => x !== "{n}");
      assert.deepEqual(b, a, clave);
    }
  }
});

test("plurales de terminasteTodoTexto, sueleVolverDias y sueleVolverMeses: n=1 y n=2 en los dos idiomas", () => {
  const ctx = (diccionario, locale) => ({ diccionario, base: null, locale });
  const e = ctx(es, "es-AR"), i = ctx(en, "en-US");
  const claves = ["casos.detalle.terminasteTodoTexto", "agenda.cuandoVuelve.sueleVolverDias", "agenda.cuandoVuelve.sueleVolverMeses"];
  const v = { estado: "X" };
  assert.match(traducir(e, claves[0], { ...v, n: 1 }), /^El paso está hecho\./);
  assert.match(traducir(e, claves[0], { ...v, n: 2 }), /^Los 2 pasos están hechos\./);
  assert.match(traducir(i, claves[0], { ...v, n: 1 }), /^The step is done\./);
  assert.match(traducir(i, claves[0], { ...v, n: 2 }), /^All 2 steps are done\./);
  assert.match(traducir(e, claves[1], { n: 1 }), /cada día\.$/);
  assert.match(traducir(e, claves[1], { n: 2 }), /cada 2 días\.$/);
  assert.match(traducir(e, claves[2], { n: 1 }), /cada mes\.$/);
  assert.match(traducir(e, claves[2], { n: 2 }), /cada 2 meses\.$/);
  assert.match(traducir(i, claves[1], { n: 1 }), /every day\.$/);
  assert.match(traducir(i, claves[1], { n: 2 }), /every 2 days\.$/);
  assert.match(traducir(i, claves[2], { n: 1 }), /every month\.$/);
  assert.match(traducir(i, claves[2], { n: 2 }), /every 2 months\.$/);
  // las variables de cada forma, es y en, coinciden
  const vars = (t) => new Set([...JSON.stringify(t).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  for (const k of claves) {
    const get = (d) => k.split(".").reduce((o, p) => o[p], d);
    assert.deepEqual(vars(get(es)), vars(get(en)));
    for (const f of ["one", "other"]) assert.deepEqual(vars(get(es)[f]), vars(get(en)[f]));
  }
});

test("respuestas del cliente (R-10b): las frases siguen al t que se pasa, y sin t salen en castellano", async () => {
  const { aQueContesto, cuandoContesto, loQueEscribio, respuestaDelTurno } = await import("../src/lib/recordatorios.js");
  const en = { t: tEn, locale: "en-US", idioma: "en" };
  const contexto = { tipo: "turno", enviado_en: "2026-10-13T13:00:05+00:00", asociacion: "ultimo_aviso" };
  assert.equal(
    aQueContesto({ contexto, rubro: "taller" }, en).frase,
    "Seems to reply to the reminder for their appointment, the last thing we sent them, on October 13."
  );
  assert.match(aQueContesto({ contexto, rubro: "taller" }).frase, /^Parece contestar al recordatorio de su turno/);
  assert.equal(cuandoContesto({ enviado_en: "2026-10-15T01:30:00+00:00" }, en), "on October 14 at 22:30");
  assert.equal(loQueEscribio({ tipo: "audio", texto: null }, en).texto, "Sent a voice message.");
  const turno = { estado: "agendado", respuesta_cliente: null, aviso: { estado: "enviado" } };
  assert.equal(respuestaDelTurno({ turno, rubro: "taller", ahora: Date.now() }, en).frase, "Hasn't answered the reminder yet.");
});
