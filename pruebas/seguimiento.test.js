// Correr con: npm test
//
// El seguimiento público (SCRUM-68): cómo se le cuenta al cliente lo que
// devuelve la API. Lo que el cliente NO tiene que ver lo recorta la base
// (ver_seguimiento(), 018 y 026) y lo prueba la API.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  lineaDeEstados,
  linkDeLlamada,
  linkDeSeguimiento,
  linkDeWhatsApp,
  laEspera,
  linkDeWhatsAppA,
  mensajeDeConsulta,
  respuestaDeLaApi,
  seguimientoDeLaApi,
  totalAprobado,
} from "../src/lib/seguimiento.js";

const CODIGO = "a3f1c9d84b27e650a3f1c9d84b27e650";

// Lo que devuelve la API para un caso que está esperando (la forma de
// ver_seguimiento()): lo que la pantalla usa para la línea de tiempo.
const publico = {
  estado: "esperando",
  abierto_en: "2026-09-01T10:00:00.000Z",
  linea: [
    { estado: "en_proceso", ocurrido_en: "2026-09-02T09:00:00.000Z" },
    { estado: "esperando", ocurrido_en: "2026-09-12T15:30:00.000Z" },
  ],
};

test("el total aprobado suma los montos que llegan, aunque vengan como texto", () => {
  assert.equal(totalAprobado([{ monto: 96000 }, { monto: "58500" }]), 154500);
  assert.equal(totalAprobado([]), 0);
  assert.equal(totalAprobado(), 0);
});

// ------------------------------------------------------------
// La línea de tiempo
// ------------------------------------------------------------

test("dice por dónde pasó, dónde está y qué falta", () => {
  const linea = lineaDeEstados(publico.estado, publico.linea, { abiertoEn: publico.abierto_en });

  assert.deepEqual(
    linea.map((p) => p.estado),
    ["nuevo", "en_proceso", "esperando", "revision_final", "completado"]
  );
  assert.deepEqual(
    linea.map((p) => (p.pasado ? "pasó" : p.actual ? "acá" : "falta")),
    ["pasó", "pasó", "acá", "falta", "falta"]
  );
});

test("la fecha de 'nuevo' es la de apertura, que no deja evento", () => {
  const linea = lineaDeEstados(publico.estado, publico.linea, { abiertoEn: publico.abierto_en });
  assert.equal(linea[0].cuando, "2026-09-01T10:00:00.000Z");
  assert.equal(linea[1].cuando, "2026-09-02T09:00:00.000Z");
  assert.equal(linea[2].cuando, "2026-09-12T15:30:00.000Z");
});

test("un caso viejo, sin estados en el historial, no inventa fechas", () => {
  const linea = lineaDeEstados("en_proceso", [], { abiertoEn: "2026-09-01T10:00:00.000Z" });
  assert.equal(linea[0].cuando, "2026-09-01T10:00:00.000Z");
  assert.equal(linea[1].cuando, null);
  assert.equal(linea[1].actual, true);
});

test("si el caso volvió para atrás, manda dónde está ahora y no el ida y vuelta", () => {
  const idaYVuelta = [
    { estado: "en_proceso", ocurrido_en: "2026-09-02T09:00:00.000Z" },
    { estado: "esperando", ocurrido_en: "2026-09-05T09:00:00.000Z" },
    { estado: "en_proceso", ocurrido_en: "2026-09-09T09:00:00.000Z" },
  ];
  const linea = lineaDeEstados("en_proceso", idaYVuelta, { abiertoEn: null });

  assert.equal(linea[1].actual, true, "está en proceso");
  assert.equal(linea[1].cuando, "2026-09-09T09:00:00.000Z", "la última vez que entró, no la primera");
  assert.equal(linea[2].pendiente, true, "esperando vuelve a estar por delante");
});

test("un caso que se volvió a abrir no muestra la entrega como si siguiera hecha", () => {
  // Pasó, se entregó y lo volvieron a abrir: el evento de la entrega sigue
  // en el historial, pero el caso no está entregado.
  const conEntrega = [
    { estado: "en_proceso", ocurrido_en: "2026-09-02T09:00:00.000Z" },
    { estado: "completado", ocurrido_en: "2026-09-08T09:00:00.000Z" },
  ];
  const linea = lineaDeEstados("en_proceso", conEntrega, { abiertoEn: "2026-09-01T10:00:00.000Z" });

  assert.equal(linea[4].pendiente, true, "entregado vuelve a estar por delante");
  assert.equal(linea[4].cuando, null, "y sin fecha: todavía no está entregado");
});

test("un caso entregado tiene los cinco pasos cumplidos y ninguno pendiente", () => {
  const linea = lineaDeEstados("completado", publico.linea, { abiertoEn: publico.abierto_en });
  assert.ok(linea.every((p) => !p.pendiente));
  assert.equal(linea[4].actual, true);
});

// ------------------------------------------------------------
// El link y el mensaje
// ------------------------------------------------------------

test("el link se arma con el origen del navegador, sin barra doble", () => {
  assert.equal(
    linkDeSeguimiento("http://localhost:3000", CODIGO),
    `http://localhost:3000/seguimiento/${CODIGO}`
  );
  assert.equal(
    linkDeSeguimiento("http://localhost:3000/", CODIGO),
    `http://localhost:3000/seguimiento/${CODIGO}`
  );
});

// ------------------------------------------------------------
// Preguntarle al negocio antes de decidir
// ------------------------------------------------------------

test("el link de WhatsApp va al número internacional guardado", () => {
  // Desde B-1b el teléfono se guarda con código de país. Uno de antes, sin
  // país, no arma link: no se le inventa el 549 (telefono-internacional.test.js).
  assert.ok(linkDeWhatsAppA("5493414567890", "hola").startsWith("https://wa.me/5493414567890?text="));
  assert.equal(linkDeWhatsAppA("3414567890", "hola"), null);
});

test("un número que ya viene con el país no se le suma otro", () => {
  assert.ok(linkDeWhatsAppA("+54 9 341 456 7890", "hola").startsWith("https://wa.me/5493414567890?"));
});

test("sin número no hay link, ni de WhatsApp ni de llamada", () => {
  assert.equal(linkDeWhatsAppA(null, "hola"), null);
  assert.equal(linkDeWhatsAppA("", "hola"), null);
  assert.equal(linkDeLlamada(null), null);
  assert.equal(linkDeLlamada("sin números"), null);
});

test("llamar marca sólo los dígitos", () => {
  assert.equal(linkDeLlamada("341 456 7890"), "tel:3414567890");
});

test("el mensaje de consulta dice quién escribe, por qué cosa y sobre qué paso", () => {
  const m = mensajeDeConsulta({
    clienteNombre: "Marcela",
    identificador: "AB 123 CD",
    servicio: "Ruido raro",
    numero: 248,
    paso: "Cambio de pastillas de freno",
  });

  assert.ok(m.includes("Marcela"), "dice quién es");
  assert.ok(m.includes("AB 123 CD"), "dice de qué auto habla");
  assert.ok(m.includes("Cambio de pastillas de freno"), "dice qué está dudando");
});

test("sin patente, la consulta se identifica con el número de caso", () => {
  const m = mensajeDeConsulta({ clienteNombre: "Marcela", identificador: null, numero: 248 });
  assert.ok(m.includes("caso 248"));
});

test("sin nombre ni patente, el mensaje sigue siendo una frase entera", () => {
  const m = mensajeDeConsulta({ servicio: "Ruido raro" });
  assert.ok(m.startsWith("Hola."), m);
  assert.ok(m.includes("Ruido raro"));
});

test("el link de WhatsApp sin número sigue sirviendo para el negocio", () => {
  // El de la otra punta: lo toca el negocio y elige el contacto en su agenda.
  assert.ok(linkDeWhatsApp("hola").startsWith("https://wa.me/?text="));
});

// ------------------------------------------------------------
// De quién es la pelota (flujo, 3.6)
// ------------------------------------------------------------
// "Esperando" a secas no le dice nada al que abre el link: si la pelota es
// suya y la pantalla no se lo dice, se queda esperando a que lo llamen y el
// presupuesto se muere ahí.

import { comoSeEspera } from "../src/lib/presets.js";

const taller = comoSeEspera("taller");

test("con algo por contestar, le dice que la pelota es suya y qué hacer", () => {
  const e = laEspera({ estado: "esperando", porResponder: 2, espera: taller });

  assert.equal(e.deQuien, "cliente");
  assert.match(e.titulo, /esperando tu respuesta/);
  assert.match(e.detalle, /contestes/);
});

test("esperando al negocio, lo dice y no le pide nada", () => {
  const e = laEspera({
    estado: "esperando",
    queFalta: "El filtro de aceite",
    porResponder: 0,
    espera: taller,
  });

  assert.equal(e.deQuien, "negocio");
  assert.equal(e.titulo, "Estamos esperando el filtro de aceite.");
  assert.match(e.detalle, /No hace falta que hagas nada/);
});

test("lo que tiene la pelota manda por sobre lo que alguien escribió a mano", () => {
  // El mostrador puede haber dejado escrito cualquier cosa en "qué falta".
  // Lo que decide es si quedó algo sin contestar.
  const e = laEspera({
    estado: "esperando",
    queFalta: "El filtro de aceite",
    porResponder: 1,
    espera: taller,
  });
  assert.equal(e.deQuien, "cliente");
});

test("no se le habla en tercera persona en su propia pantalla", () => {
  // Compartir el link deja escrito "la respuesta del cliente". Si ya no
  // queda nada por contestar, ese texto quedó viejo: repetirlo sería decirle
  // "estamos esperando la respuesta del cliente" al cliente.
  const e = laEspera({
    estado: "esperando",
    queFalta: "la respuesta del cliente",
    porResponder: 0,
    espera: taller,
  });

  assert.equal(e.deQuien, "negocio");
  assert.ok(!e.titulo.includes("del cliente"), e.titulo);
  assert.equal(e.titulo, "Estamos esperando un repuesto.");
});

test("cada rubro espera con sus palabras", () => {
  const dice = (rubro) =>
    laEspera({ estado: "esperando", porResponder: 0, espera: comoSeEspera(rubro) }).titulo;

  assert.equal(dice("taller"), "Estamos esperando un repuesto.");
  assert.equal(dice("medicina"), "Estamos esperando un estudio o un turno con el especialista.");
  assert.equal(dice("service"), "Estamos esperando un repuesto.");
});

test("el texto mezclado del rubro tampoco se le repite", () => {
  // Al mover el estado desde el desplegable, el sistema escribe el genérico
  // del preset, que mezcla las dos esperas: "El repuesto o el sí del
  // cliente". Adentro del negocio alcanza; acá es la confusión que esta
  // pantalla vino a sacar.
  const e = laEspera({
    estado: "esperando",
    queFalta: "El repuesto o el sí del cliente",
    porResponder: 0,
    espera: taller,
    generico: "El repuesto o el sí del cliente",
  });

  assert.equal(e.titulo, "Estamos esperando un repuesto.");
  assert.ok(!e.titulo.includes("cliente"));
});

test("un nombre propio no se pasa a minúscula", () => {
  const e = laEspera({
    estado: "esperando",
    queFalta: "Bosch, que confirme el precio",
    porResponder: 0,
    espera: taller,
  });
  assert.match(e.titulo, /Bosch/);
});

test("si el caso no está frenado no hay espera que explicar", () => {
  for (const estado of ["nuevo", "en_proceso", "revision_final", "completado"]) {
    assert.equal(laEspera({ estado, porResponder: 3, espera: taller }), null, estado);
  }
});

test("sin nada escrito y sin preset, igual dice algo entero", () => {
  const e = laEspera({ estado: "esperando" });
  assert.equal(e.deQuien, "negocio");
  assert.ok(e.titulo.endsWith("."), e.titulo);
});

// ------------------------------------------------------------
// Lo que contesta la API (GET y POST /v1/publico/seguimiento/...)
// ------------------------------------------------------------
// La API recorta lo mismo que la base pero le saca "sirve": un código que no
// sirve es un 404, no un objeto. La pantalla, en cambio, sigue preguntando
// por "sirve", así que se lo devuelve la traducción.

test("lo que manda la API se muestra tal cual, y sirve", () => {
  const datos = { negocio_nombre: "Taller Sur", estado: "en_proceso", pasos: [], por_responder: [] };

  assert.deepEqual(seguimientoDeLaApi({ ok: true, datos }), { ...datos, sirve: true });
});

test("un link que la API no conoce no sirve", () => {
  const r = seguimientoDeLaApi({
    ok: false,
    error: { codigo: "seguimiento_no_encontrado", mensaje: "Este link ya no sirve. Pedile uno nuevo al negocio." },
  });

  assert.deepEqual(r, { sirve: false });
});

// CAMBIO DE DECISIÓN. Antes esta prueba pedía lo contrario —«si la API no
// contesta, el link tampoco sirve»— con el argumento de que distinguirlo
// sería contar de más.
//
// No se sostiene. Lo que no hay que contar es si un link alguna vez fue
// bueno (criterio 15): por eso «nunca existió» y «lo dieron de baja» siguen
// siendo el mismo «Este link ya no sirve». Un corte de conexión no dice nada
// sobre el código: pasa igual con un link bueno que con uno inventado.
//
// Y el costo era concreto: el link pasa por la API, y Render se duerme y
// tarda en despertar más de lo que el front espera. El primer cliente que
// abría su link después de un rato quieto leía que el link había muerto,
// cuando sólo tenía que esperar. Es lo mismo que ya hace la agenda pública.
test("si la API no contesta, se dice eso y no que el link murió", () => {
  const sinConexion = seguimientoDeLaApi({
    ok: false,
    error: { codigo: "sin_conexion", mensaje: "No pudimos conectarnos. Fijate que tengas internet y volvé a probar." },
  });
  assert.deepEqual(sinConexion, {
    sirve: false,
    problema: "No pudimos conectarnos. Fijate que tengas internet y volvé a probar.",
  });

  const muchos = seguimientoDeLaApi({
    ok: false,
    error: { codigo: "muchos_intentos", mensaje: "Probá de nuevo en un minuto: se hicieron muchos intentos seguidos." },
  });
  assert.deepEqual(muchos, {
    sirve: false,
    problema: "Probá de nuevo en un minuto: se hicieron muchos intentos seguidos.",
  });
});

test("contestar un paso por la API devuelve ok con lo que dice la API", () => {
  assert.deepEqual(respuestaDeLaApi({ ok: true, datos: { destrabo: true, quedan: 0 } }), {
    ok: true,
    destrabo: true,
    quedan: 0,
  });
});

// El mensaje de la API ya está escrito para el cliente: se muestra tal cual.
test("si la API dice que no, el motivo es su mensaje", () => {
  const r = respuestaDeLaApi({
    ok: false,
    error: { codigo: "respuesta_no_va", mensaje: "Ese paso ya estaba aprobado." },
  });

  assert.deepEqual(r, { ok: false, motivo: "Ese paso ya estaba aprobado." });
});
