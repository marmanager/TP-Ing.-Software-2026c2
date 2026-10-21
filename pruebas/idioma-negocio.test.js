// Correr con: npm run test:unit
//
// Mi negocio, equipo, roles y landing en los dos idiomas (docs/idiomas.md):
// los textos que salen de src/lib con `t` (recordatorios, módulos, permisos,
// landing, pagos, equipo), lo que es de fábrica y se lee en el idioma de quien
// mira (módulos, permisos, roles de fábrica, la frase de la API al anotar un
// turno) y la paridad es/en de los bloques nuevos.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";
import { traducir } from "../src/lib/idioma.js";
import {
  anticipacionEnPalabras,
  avisoAlAnotar,
  avisoAlAnotarVolver,
  avisoDelPresupuesto,
  avisoDeVolver,
  avisoEnPalabras,
  bajaDeAvisos,
  cuandoSaleEnPalabras,
  errorAlRevertirBaja,
  errorDeVolverEn,
  erroresDelRecordatorio,
  filasDeRecordatorios,
  motivoDelRecordatorio,
  porQueNoHayAviso,
  porQueNoSeAviso,
  textosDelRecordatorio,
} from "../src/lib/recordatorios.js";
import { LISTA_MODULOS, LISTA_SUBMODULOS, MODULOS, SUBMODULOS, nombreDeModulo, traducirModulo } from "../src/lib/modulos.js";
import {
  GRUPOS,
  PERMISOS,
  QUIEN_PUEDE,
  nombreDelGrupo,
  nombreDelRol,
  queCambiaConElRol,
  quienPuede,
  traducirPermiso,
} from "../src/lib/permisos.js";
import { PARTES, FUENTES, SECCIONES, estadoDeSecciones, nombreDeFuente, traducirParte, traducirSeccion } from "../src/lib/landing.js";
import { mensajeDeInvitacion } from "../src/lib/equipo.js";
import { motivoDePagos, pagosEnLinea } from "../src/lib/pagos.js";

const tEs = (c, v, s) => traducir({ diccionario: es, base: null, locale: "es-AR" }, c, v, s);
const tEn = (c, v, s) => traducir({ diccionario: en, base: es, locale: "en-US" }, c, v, s);
const EN = { t: tEn, locale: "en-US", idioma: "en" };
const ES = { t: tEs, locale: "es-AR", idioma: "es" };

// Martes 13 de octubre de 2026, 10:00 en Argentina.
const AHORA = "2026-10-13T13:00:00.000Z";

// ------------------------------------------------------------
// Recordatorios
// ------------------------------------------------------------

test("recordatorios: sin opciones salen en castellano, igual que con el t de castellano", () => {
  assert.equal(anticipacionEnPalabras(48), "dos días antes");
  assert.equal(anticipacionEnPalabras(48, ES), "dos días antes");
  assert.equal(anticipacionEnPalabras(1), "una hora antes");
  assert.equal(anticipacionEnPalabras(13), "13 horas antes");
  assert.equal(cuandoSaleEnPalabras({ tipo: "cierre", plazo: 0, rubro: "taller" }), "Le llega al cliente apenas entregás el caso.");
  assert.equal(
    cuandoSaleEnPalabras({ tipo: "turno", plazo: 24, rubro: "medicina" }),
    "Le llega al cliente el día anterior a su consulta, a la misma hora."
  );
  assert.equal(
    cuandoSaleEnPalabras({ tipo: "volver", plazo: 7, rubro: "medicina" }),
    "Le llega al cliente una semana antes del día que anotaste para su próxima consulta."
  );
  assert.equal(
    cuandoSaleEnPalabras({ tipo: "volver", plazo: 0, rubro: "taller" }),
    "Le llega al cliente el mismo día que anotaste para su próximo turno."
  );
  assert.equal(textosDelRecordatorio("turno", "medicina").nombre, "Antes de la consulta");
  assert.equal(textosDelRecordatorio("turno", "taller").nombre, "Antes del turno");
  assert.equal(
    textosDelRecordatorio("turno", "taller").ayudaInterruptor,
    "Le llega a cada cliente con teléfono que tenga un turno anotado."
  );
  assert.equal(
    textosDelRecordatorio("turno", "medicina").ayudaInterruptor,
    "Le llega a cada cliente con teléfono que tenga una consulta anotada."
  );
  assert.equal(errorDeVolverEn("no", "2026-10-13"), "Elegí un día del calendario.");
  assert.equal(errorDeVolverEn("2026-10-12", "2026-10-13"), "la fecha ya pasó");
  assert.equal(erroresDelRecordatorio({ tipo: "turno", plazo: "999", mensaje: "" }).plazo, "Elegí una cantidad de horas enteras entre 1 y 168 horas.");
  assert.equal(erroresDelRecordatorio({ tipo: "cierre", plazo: "x", mensaje: "ok" }).plazo, "Elegí una cantidad de días enteros entre 0 y 3650.");
});

test("recordatorios: en inglés, con el vocabulario del rubro en inglés y sin castellano", () => {
  assert.equal(anticipacionEnPalabras(48, EN), "two days before");
  assert.equal(anticipacionEnPalabras(168, EN), "one week before");
  assert.equal(
    cuandoSaleEnPalabras({ tipo: "turno", plazo: 2, rubro: "taller" }, EN),
    "It reaches the customer two hours before their appointment."
  );
  assert.equal(
    cuandoSaleEnPalabras({ tipo: "volver", plazo: 7, rubro: "medicina" }, EN),
    "It reaches the customer one week before the day you noted for their next consultation."
  );
  assert.equal(
    cuandoSaleEnPalabras({ tipo: "presupuesto", plazo: 3, rubro: "taller" }, EN),
    "It reaches the customer when three days have passed without them answering the quote."
  );
  assert.equal(textosDelRecordatorio("turno", "medicina", EN).nombre, "Before the consultation");
  assert.equal(textosDelRecordatorio("cierre", "taller", EN).nombre, "After handing over");
  assert.equal(
    erroresDelRecordatorio({ tipo: "volver", plazo: "200", mensaje: "" }, EN).plazo,
    "Enter a whole number of days between 0 and 90."
  );
  assert.equal(errorDeVolverEn("2026-10-12", "2026-10-13", EN), "that date has already passed");
});

test("recordatorios: filas, avisos del turno y de volver con fechas en el idioma de quien mira", () => {
  const filas = filasDeRecordatorios(
    { configuracion: { activo: true, dias: 7, mensaje: "m", turno: { activo: true, horas: 24, mensaje: "m" } }, rubro: "taller", conAgenda: true },
    EN
  );
  assert.deepEqual(filas.map((f) => f.nombre), ["After handing over", "Before the appointment"]);
  assert.equal(filas[0].cuando, "It reaches the customer seven days after you hand over the case.");

  const pendiente = { aviso: { estado: "pendiente", enviar_en: "2026-10-19T00:30:00.000Z" }, ahora: AHORA };
  assert.equal(avisoEnPalabras(pendiente).frase, "Le va a llegar el recordatorio el 18 de octubre a las 21:30.");
  assert.equal(avisoEnPalabras(pendiente, EN).frase, "The reminder will reach them on October 18 at 21:30.");
  assert.equal(
    avisoEnPalabras({ aviso: { estado: "pendiente", enviar_en: "2026-10-13T19:00:00.000Z" }, ahora: AHORA }, EN).frase,
    "The reminder will reach them today at 16:00."
  );
  assert.equal(
    avisoEnPalabras({ aviso: { estado: "enviado", procesado_en: "2026-10-14T13:00:00.000Z" }, ahora: AHORA }, EN).frase,
    "We sent the reminder tomorrow at 10:00."
  );

  const caso = { volver_en: "2026-11-10", aviso_volver: { estado: "pendiente", enviar_en: "2026-11-03T12:00:00.000Z" } };
  assert.equal(avisoDeVolver({ caso, cliente: {}, hoy: "2026-10-13" }).frase, "Le llega un aviso por WhatsApp el 3 de noviembre de 2026.");
  assert.equal(avisoDeVolver({ caso, cliente: {}, hoy: "2026-10-13" }, EN).frase, "A WhatsApp notice will reach them on November 3, 2026.");
  const cancelado = { volver_en: "2026-11-10", aviso_volver: { estado: "cancelado", motivo: "ya_volvio" } };
  assert.equal(avisoDeVolver({ caso: cancelado, cliente: {}, hoy: "2026-10-13" }).frase, "El cliente ya volvió después de este caso, así que no se le avisa.");
  assert.equal(avisoDeVolver({ caso: cancelado, cliente: {}, hoy: "2026-10-13" }, EN).frase, "The customer already came back after this case, so they won't be told.");
  assert.equal(
    avisoAlAnotarVolver({ volverEn: "2026-11-10", volver: { activo: true, plazo: "7" }, cliente: null, hoy: "2026-10-13" }, EN),
    "A WhatsApp notice will reach them on November 3, 2026."
  );
  assert.equal(
    avisoAlAnotarVolver({ volverEn: "2026-11-10", volver: { activo: false, plazo: "7" }, cliente: null, hoy: "2026-10-13" }, EN),
    "The notice about when it's time to come back is turned off: they won't be told."
  );
});

test("recordatorios: presupuesto, baja de avisos y por qué no hay aviso", () => {
  const caso = { aviso_presupuesto: { estado: "cancelado", motivo: "sin_link" } };
  assert.equal(avisoDelPresupuesto({ caso, cliente: {}, ahora: AHORA }).frase, "Todavía no le compartiste el link del presupuesto, así que no se le avisa.");
  assert.equal(avisoDelPresupuesto({ caso, cliente: {}, ahora: AHORA }, EN).frase, "You haven't shared the quote link with them yet, so they won't be told.");
  assert.equal(
    avisoDelPresupuesto({ caso: { aviso_presupuesto: { estado: "cancelado", motivo: "otra_cosa" } }, cliente: {}, ahora: AHORA }, EN).frase,
    "The quote notice won't be sent."
  );

  const cliente = { avisos_baja_en: "2026-10-12T01:30:00.000Z" };
  assert.deepEqual(bajaDeAvisos({ cliente, rubro: "medicina" }), {
    dia: "2026-10-11",
    frase: "Pidió no recibir mensajes automáticos el 11 de octubre de 2026.",
    consecuencia: "No le van a llegar los recordatorios de sus consultas ni los mensajes de seguimiento por WhatsApp.",
  });
  assert.deepEqual(bajaDeAvisos({ cliente, rubro: "medicina" }, EN), {
    dia: "2026-10-11",
    frase: "They asked not to receive automatic messages on October 11, 2026.",
    consecuencia: "They won't get reminders for their consultations or follow-up messages by WhatsApp.",
  });
  assert.equal(porQueNoSeAviso({ motivo: "baja_de_avisos" }), "No se programó el mensaje porque el cliente pidió no recibir avisos.");
  assert.equal(porQueNoSeAviso({ motivo: "x" }, EN), "The WhatsApp message wasn't scheduled.");
  assert.equal(errorAlRevertirBaja({ codigo: "sin_permiso" }, EN), "Whether the customer receives notices again is up to the business's owner or manager.");
  assert.equal(errorAlRevertirBaja({ codigo: "rarisimo" }), "No pudimos volver a activar sus avisos. Probá de nuevo en un rato.");

  assert.equal(porQueNoHayAviso({ turno: {}, cliente: null, rubro: "medicina" }).frase, "La consulta no tiene cliente, así que no le llega recordatorio.");
  assert.equal(porQueNoHayAviso({ turno: {}, cliente: null, rubro: "medicina" }, EN).frase, "The consultation has no customer, so no reminder is sent.");
  assert.equal(
    porQueNoHayAviso({ turno: { cliente_id: "k" }, cliente: { avisos_baja_en: "x", telefono: "+5493415550000" }, rubro: "taller" }, EN).frase,
    "They asked not to receive automatic messages, so the reminder for their appointment isn't sent."
  );
});

test("recordatorios: la frase de la API al anotar un turno es de fábrica sólo si es la que escribió la API", () => {
  const fabrica = "El turno es antes de cuando tocaba mandar el recordatorio, así que no se manda.";
  const r = (motivo, mensaje) => ({ programado: false, motivo, mensaje, aviso: null });
  // El texto de fábrica de la API sigue al idioma de quien mira.
  assert.equal(avisoAlAnotar(r("muy_cerca", fabrica)), fabrica);
  assert.equal(avisoAlAnotar(r("muy_cerca", fabrica), EN), "The appointment is before the time the reminder was due to go out, so it isn't sent.");
  assert.equal(motivoDelRecordatorio(r("desactivado", "El recordatorio de turnos está apagado."), EN), "Appointment reminders are turned off.");
  // Si la API escribió otra cosa, se muestra tal cual vino.
  assert.equal(avisoAlAnotar(r("muy_cerca", "otro texto"), EN), "otro texto");
  // Lo que no se avisa al anotar sigue sin avisarse.
  assert.equal(avisoAlAnotar(r("desactivado", "El recordatorio de turnos está apagado."), EN), null);
  assert.equal(avisoAlAnotar(null, EN), null);
});

// ------------------------------------------------------------
// Módulos, permisos, roles
// ------------------------------------------------------------

test("módulos: el diccionario en castellano es el texto de las constantes y el inglés tiene los mismos", () => {
  for (const m of [...LISTA_MODULOS, ...LISTA_SUBMODULOS]) {
    for (const campo of ["nombre", "descripcion", "queHace"]) {
      assert.equal(es.modulos[m.clave]?.[campo], m[campo], `es.modulos.${m.clave}.${campo}`);
      assert.equal(typeof en.modulos[m.clave]?.[campo], "string", `en.modulos.${m.clave}.${campo}`);
    }
  }
  assert.deepEqual(Object.keys(es.modulos).sort(), [...LISTA_MODULOS, ...LISTA_SUBMODULOS].map((m) => m.clave).sort());
  // Sin t, o con el de castellano, es la constante.
  assert.deepEqual(traducirModulo(MODULOS.agenda), MODULOS.agenda);
  assert.deepEqual(traducirModulo(SUBMODULOS.en_camino, tEs), SUBMODULOS.en_camino);
  assert.equal(traducirModulo(SUBMODULOS.en_camino, tEn).nombre, "On the way");
  assert.equal(nombreDeModulo("presupuesto", tEn), "Pending approval");
  assert.equal(nombreDeModulo("presupuesto"), "Pendientes de aprobación");
  assert.equal(nombreDeModulo("inexistente", tEn), "inexistente");
  assert.equal(traducirModulo(null, tEn), null);
});

test("permisos: textos del catálogo, grupos y 'su rol no incluye' en los dos idiomas", () => {
  for (const p of PERMISOS) {
    assert.equal(es.permisos.catalogo[p.clave].nombre, p.nombre, `es nombre ${p.clave}`);
    assert.equal(es.permisos.catalogo[p.clave].descripcion, p.descripcion, `es descripcion ${p.clave}`);
    assert.equal(typeof en.permisos.catalogo[p.clave].nombre, "string", `en nombre ${p.clave}`);
    assert.equal(typeof en.permisos.catalogo[p.clave].descripcion, "string", `en descripcion ${p.clave}`);
  }
  for (const g of GRUPOS) {
    assert.equal(nombreDelGrupo(g), g);
    assert.equal(typeof en.permisos.grupos[g], "string", `en grupo ${g}`);
  }
  assert.equal(nombreDelGrupo("Equipo", tEn), "Team");
  // QUIEN_PUEDE sigue igual (lo usan pantallas que todavía no pasan t).
  assert.equal(QUIEN_PUEDE.cobrar, "Su rol no incluye el permiso «Cobrar».");
  assert.equal(quienPuede("cobrar", tEn), "Your role doesn't include the «Collect payment» permission.");
  assert.equal(quienPuede("manejar_roles"), "Su rol no incluye el permiso «Manejar roles».");
  assert.equal(traducirPermiso(PERMISOS[0], tEn).nombre, "See all cases");
  assert.deepEqual(traducirPermiso(PERMISOS[0]), PERMISOS[0]);

  const mecanico = { permisos: ["avanzar_casos"] };
  const encargado = { permisos: ["avanzar_casos", "cobrar"] };
  assert.deepEqual(queCambiaConElRol(mecanico, encargado).gana, ["Registrar y anular cobros, y generar el QR o link de pago."]);
  assert.deepEqual(queCambiaConElRol(mecanico, encargado, tEn).gana, ["Record and cancel payments, and generate the payment QR or link."]);
  assert.deepEqual(queCambiaConElRol(encargado, mecanico, tEn).pierde, ["Record and cancel payments, and generate the payment QR or link."]);
});

test("roles: el nombre de fábrica (en castellano o en inglés) sigue al idioma; el que puso el negocio, no", () => {
  assert.equal(nombreDelRol({ nombre: "Dueño", es_duenio: true }), "Dueño");
  assert.equal(nombreDelRol({ nombre: "Dueño", es_duenio: true }, tEn), "Owner");
  assert.equal(nombreDelRol("Encargado", tEn), "Manager");
  assert.equal(nombreDelRol({ nombre: "Manager" }, tEs), "Encargado");
  assert.equal(nombreDelRol({ nombre: "mecánico" }, tEn), "Mechanic");
  assert.equal(nombreDelRol({ nombre: "Mecanico" }, tEn), "Mechanic");
  assert.equal(nombreDelRol({ nombre: "Técnico" }, tEn), "Technician");
  assert.equal(nombreDelRol({ nombre: "Colaborador" }, tEn), "Collaborator");
  // Lo que el negocio escribió queda como lo escribió, en cualquier idioma.
  assert.equal(nombreDelRol({ nombre: "Recepción" }, tEn), "Recepción");
  assert.equal(nombreDelRol({ nombre: "Caja" }, tEs), "Caja");
  assert.equal(nombreDelRol(undefined, tEn), "");
  assert.equal(nombreDelRol("Encargado"), "Encargado");
});

// ------------------------------------------------------------
// Landing, equipo y pagos
// ------------------------------------------------------------

test("landing: secciones, colores y tipografías de fábrica en el idioma de t; el castellano es la constante", () => {
  for (const s of SECCIONES) {
    assert.deepEqual(traducirSeccion(s), s);
    assert.equal(es.landing.secciones[s.clave].nombre, s.nombre);
    assert.equal(es.landing.secciones[s.clave].queMuestra, s.queMuestra);
  }
  for (const p of PARTES) {
    assert.deepEqual(traducirParte(p), p);
    assert.equal(es.landing.partes[p.clave].ayuda, p.ayuda);
  }
  for (const f of FUENTES) assert.equal(nombreDeFuente(f), f.nombre);
  assert.equal(traducirSeccion(SECCIONES[1], tEn).nombre, "Book an appointment");
  assert.equal(traducirParte(PARTES[0], tEn).nombre, "Background");
  assert.equal(nombreDeFuente(FUENTES[0], tEn), "The app's own");

  const secciones = estadoDeSecciones(["negocio", "sacar_turno", "mis_casos", "mis_turnos"], [], false, tEn);
  const sacar = secciones.find((s) => s.clave === "sacar_turno");
  assert.equal(sacar.nombre, "Book an appointment");
  assert.equal(sacar.motivo, "Shows up once you turn on the Schedule module.");
  assert.equal(
    estadoDeSecciones(["sacar_turno"], ["agenda"], false, tEn).find((s) => s.clave === "sacar_turno").motivo,
    "Shows up once you publish your hours."
  );
  // Sin t, igual que siempre.
  assert.equal(estadoDeSecciones(["sacar_turno"], [], true).find((s) => s.clave === "sacar_turno").motivo, "Aparece cuando prendés el módulo Agenda.");
});

test("equipo y pagos: el mensaje al grupo sale en el idioma de quien lo manda; el motivo de pagos, en el de quien mira", () => {
  assert.equal(mensajeDeInvitacion("Taller Sur", "https://x.test/unirme/a"), "Sumate al equipo de Taller Sur en MarManager: https://x.test/unirme/a");
  assert.equal(mensajeDeInvitacion("Taller Sur", "https://x.test/unirme/a", tEn), "Join the Taller Sur team on MarManager: https://x.test/unirme/a");

  const sin = pagosEnLinea({ api: null });
  assert.equal(sin.disponible, false);
  assert.equal(motivoDePagos(sin), "todavía no está conectado el sistema de pagos");
  assert.equal(motivoDePagos(sin, tEn), "the payments system isn't connected yet");
  assert.equal(motivoDePagos(pagosEnLinea({ api: "https://api.test" }), tEn), null);
  assert.equal(motivoDePagos(pagosEnLinea({ api: "https://tp-ing-software-2026c2.vercel.app" }), tEn).includes("NEXT_PUBLIC_API_URL"), true);
  assert.equal(motivoDePagos(null, tEn), null);
});

// ------------------------------------------------------------
// Paridad es/en de los bloques nuevos
// ------------------------------------------------------------

const esPlural = (v) => v && typeof v === "object" && "other" in v;
const claves = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !esPlural(v) ? claves(v, `${p}${k}.`) : [`${p}${k}`]));
const valor = (o, c) => c.split(".").reduce((x, k) => x?.[k], o);
const variables = (v) =>
  [...new Set((typeof v === "string" ? [v] : Object.values(v)).flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();

const BLOQUES = ["negocio", "equipo", "landing", "permisos", "modulos", "recordatorios"];

test("los bloques de negocio, equipo, landing, permisos, módulos y recordatorios tienen las mismas claves y variables en es y en", () => {
  for (const b of BLOQUES) {
    const deEs = claves(es[b]);
    const deEn = claves(en[b]);
    assert.deepEqual([...deEn].sort(), [...deEs].sort(), `claves de ${b}`);
    for (const c of deEs) {
      const ve = valor(es[b], c);
      const vn = valor(en[b], c);
      assert.equal(esPlural(ve), esPlural(vn), `${b}.${c}: plural en un idioma y no en el otro`);
      // Los marcadores son los mismos, salvo que un idioma no use una variable.
      assert.deepEqual(variables(vn).filter((x) => !variables(ve).includes(x)), [], `${b}.${c}: el inglés usa una variable que el castellano no tiene`);
    }
  }
});

test("los códigos de error de la landing pública están en los dos idiomas", () => {
  for (const c of ["landing_no_encontrada", "datos_incorrectos", "llave_vencida", "sin_almacenamiento"]) {
    assert.equal(typeof es.errores[c], "string", `es.errores.${c}`);
    assert.equal(typeof en.errores[c], "string", `en.errores.${c}`);
  }
});

// Una clave repetida en el mismo objeto del diccionario pasa desapercibida
// (JavaScript se queda con la última) pero deja texto muerto: se vigila.
test("es.js y en.js no repiten propiedades en un mismo objeto", () => {
  for (const archivo of ["es.js", "en.js"]) {
    const fuente = readFileSync(fileURLToPath(new URL(`../src/lib/idiomas/${archivo}`, import.meta.url)), "utf8");
    const pila = []; // [{ sangria, claves }]
    const repetidas = [];
    for (const [i, linea] of fuente.split(/\r?\n/).entries()) {
      const m = /^(\s*)([A-Za-z_]\w*|\d+):/.exec(linea);
      if (!m) continue;
      const sangria = m[1].length;
      while (pila.length && pila[pila.length - 1].sangria > sangria) pila.pop();
      if (!pila.length || pila[pila.length - 1].sangria < sangria) pila.push({ sangria, claves: new Set() });
      const { claves: vistas } = pila[pila.length - 1];
      if (vistas.has(m[2])) repetidas.push(`${archivo}:${i + 1} ${m[2]}`);
      vistas.add(m[2]);
      // Un objeto nuevo arranca con su propio conjunto de claves.
      if (/\{\s*$/.test(linea)) pila.push({ sangria: sangria + 1, claves: new Set() });
    }
    assert.deepEqual(repetidas, [], `claves repetidas en ${archivo}`);
  }
});
