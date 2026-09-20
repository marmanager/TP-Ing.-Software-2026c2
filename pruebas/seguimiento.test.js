// Correr con: npm test
//
// El seguimiento público (SCRUM-68). Acá hay dos clases de test y la primera
// es la que importa: lo que el cliente NO tiene que ver.
//
// Está escrito al revés de lo habitual: en vez de comprobar que los campos
// que esperamos están, comprueba que no hay ningún otro. Es la única forma
// de que el test siga sirviendo cuando alguien le agregue una columna a
// "caso" dentro de seis meses sin acordarse de esta pantalla.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  CAMPOS_PUBLICOS,
  casoPublico,
  lineaDeEstados,
  linkDeLlamada,
  linkDeSeguimiento,
  linkDeWhatsApp,
  linkDeWhatsAppA,
  mensajeDeConsulta,
  mensajeDeWhatsApp,
  totalAprobado,
} from "../src/lib/seguimiento.js";

const CODIGO = "a3f1c9d84b27e650a3f1c9d84b27e650";

// Un negocio entero, con todo lo interno puesto a propósito: diagnóstico,
// notas, el mecánico, el teléfono del cliente, lo cobrado, un insumo y dos
// pasos que el cliente no aprobó.
const negocio = {
  id: "n1",
  nombre: "Taller Sur",
  rubro: "taller",
  // Distinto del de la clienta a propósito: si fueran iguales, el test de
  // que no viaja el teléfono del cliente pasaría por el motivo equivocado.
  telefono: "341 222 3333",
  inicio: { columnas: 2 },
};

const clientes = [
  {
    id: "c1",
    nombre: "Marcela Suárez",
    telefono: "341 456 7890",
    email: "marcela@ejemplo.com",
    notas: "Paga siempre en efectivo",
  },
  { id: "c2", nombre: "Hugo Peralta", telefono: "341 111 2222" },
];

const casos = [
  {
    id: "k1",
    negocio_id: "n1",
    numero: 248,
    cliente_id: "c1",
    servicio: "Un ruido raro cuando frena",
    identificador: "AB 123 CD",
    diagnostico: "La correa está floja y las pastillas, al límite. Confirmar con el dueño.",
    estado: "esperando",
    responsable_id: "e1",
    que_falta: "El filtro de aceite",
    abierto_en: "2026-09-01T10:00:00.000Z",
    actualizado_en: "2026-09-12T15:30:00.000Z",
    cobrado: 96000,
    cobrado_en: "2026-09-14T11:00:00.000Z",
    seguimiento_codigo: CODIGO,
    seguimiento_visto_en: "2026-09-13T09:00:00.000Z",
  },
  // Otro caso, del mismo cliente, también compartido con OTRO código.
  {
    id: "k2",
    negocio_id: "n1",
    numero: 249,
    cliente_id: "c1",
    servicio: "Service de rutina",
    estado: "nuevo",
    abierto_en: "2026-09-10T10:00:00.000Z",
    seguimiento_codigo: "ffffffffffffffffffffffffffffffff",
  },
  // Y uno que no se comparte con nadie.
  { id: "k3", negocio_id: "n1", numero: 250, cliente_id: "c2", servicio: "Frenos", estado: "nuevo" },
];

const pasos = [
  { id: "p1", caso_id: "k1", nombre: "Revisión completa", monto: 74000, estado: "aprobado", orden: 1 },
  { id: "p2", caso_id: "k1", nombre: "Cambio de pastillas", monto: 22000, estado: "aprobado", orden: 2 },
  { id: "p3", caso_id: "k1", nombre: "Reemplazo de amortiguadores", monto: 58500, estado: "esperando", orden: 3 },
  { id: "p4", caso_id: "k1", nombre: "Cambio de cubiertas", monto: 90000, estado: "rechazado", orden: 4 },
  { id: "p5", caso_id: "k2", nombre: "Cambio de aceite", monto: 30000, estado: "aprobado", orden: 1 },
];

const eventos = [
  { id: "v1", caso_id: "k1", tipo: "estado", estado: "en_proceso", titulo: "Lo empezó Diego", detalle: "Diego lo tiene", ocurrido_en: "2026-09-02T09:00:00.000Z" },
  { id: "v2", caso_id: "k1", tipo: "nota", titulo: "Anotaron algo", detalle: "El cliente regatea, no bajar de 90", ocurrido_en: "2026-09-03T09:00:00.000Z" },
  { id: "v3", caso_id: "k1", tipo: "estado", estado: "esperando", titulo: "Quedó esperando", detalle: "Falta el filtro", ocurrido_en: "2026-09-12T15:30:00.000Z" },
  { id: "v4", caso_id: "k2", tipo: "estado", estado: "en_proceso", titulo: "Arrancó", ocurrido_en: "2026-09-11T09:00:00.000Z" },
];

const todo = { negocio, casos, clientes, pasos, eventos };
const publico = casoPublico({ codigo: CODIGO, ...todo });

// ------------------------------------------------------------
// Lo que el cliente NO ve
// ------------------------------------------------------------

test("el objeto público no tiene ni un campo de más", () => {
  assert.deepEqual(Object.keys(publico).sort(), [...CAMPOS_PUBLICOS].sort());
});

// Este es el test del criterio 20 y el que tiene que sobrevivir a las
// columnas que todavía no existen. Busca el valor en TODO el objeto, por
// más hondo que esté: en un paso, en la línea de tiempo o en un anidado que
// alguien agregue mañana.
const PROHIBIDO = [
  ["el diagnóstico interno", casos[0].diagnostico],
  ["una nota interna", eventos[1].detalle],
  ["quién lo está atendiendo", casos[0].responsable_id],
  ["el teléfono del cliente", clientes[0].telefono],
  ["el mail del cliente", clientes[0].email],
  ["las notas del cliente", clientes[0].notas],
  ["el apellido del cliente", "Suárez"],
  ["el id del caso", casos[0].id],
  ["el id del negocio", negocio.id],
  ["el código del link", CODIGO],
  // Un paso que espera respuesta SÍ viaja desde que el cliente puede
  // contestarlo desde el link (019_aprobar_desde_el_link.sql). Lo que sigue
  // afuera es el rechazado: ya lo contestó, y volver a ofrecerlo es del
  // negocio.
  ["un paso que rechazó", pasos[3].nombre],
  ["el monto de un paso que rechazó", pasos[3].monto],
  ["los títulos del historial, escritos para adentro", eventos[0].titulo],
  ["otro caso del mismo cliente", casos[1].servicio],
];

for (const [que, valor] of PROHIBIDO) {
  test(`no viaja ${que}`, () => {
    assert.ok(!estaAdentro(publico, valor), `${que} apareció en el objeto público`);
  });
}

function estaAdentro(objeto, valor) {
  const texto = JSON.stringify(objeto);
  return texto.includes(JSON.stringify(valor)) || texto.includes(String(valor));
}

test("una columna nueva en caso no se publica sola", () => {
  const conColumnaNueva = casoPublico({
    codigo: CODIGO,
    ...todo,
    casos: casos.map((c) =>
      c.id === "k1" ? { ...c, margen_de_ganancia: 41000, proveedor: "Repuestos Díaz" } : c
    ),
  });
  assert.deepEqual(Object.keys(conColumnaNueva).sort(), [...CAMPOS_PUBLICOS].sort());
  assert.ok(!estaAdentro(conColumnaNueva, 41000));
  assert.ok(!estaAdentro(conColumnaNueva, "Repuestos Díaz"));
});

test("un paso aprobado lleva sólo el nombre y el monto", () => {
  for (const paso of publico.pasos) {
    assert.deepEqual(Object.keys(paso).sort(), ["monto", "nombre"]);
  }
});

test("un paso por contestar lleva el id, el nombre, el porqué y el monto, y nada más", () => {
  for (const paso of publico.por_responder) {
    assert.deepEqual(Object.keys(paso).sort(), ["descripcion", "id", "monto", "nombre"]);
  }
});

// ------------------------------------------------------------
// Lo que falta que conteste
// ------------------------------------------------------------

test("le llega lo que espera su respuesta, y sólo eso", () => {
  assert.deepEqual(
    publico.por_responder.map((p) => p.nombre),
    ["Reemplazo de amortiguadores"]
  );
  assert.equal(publico.por_responder[0].id, "p3");
  assert.equal(totalAprobado(publico.por_responder), 58500);
});

test("un caso entregado no ofrece nada para contestar", () => {
  const entregado = casoPublico({
    codigo: CODIGO,
    ...todo,
    casos: casos.map((c) => (c.id === "k1" ? { ...c, estado: "completado" } : c)),
  });
  assert.deepEqual(entregado.por_responder, []);
  // Y el paso sin contestar tampoco viaja escondido en otro lado.
  assert.ok(!estaAdentro(entregado, pasos[2].nombre));
});

test("los pasos de otro caso no entran en lo que hay que contestar", () => {
  const otro = casoPublico({ codigo: "ffffffffffffffffffffffffffffffff", ...todo });
  assert.deepEqual(
    otro.por_responder.map((p) => p.nombre),
    []
  );
  assert.deepEqual(
    otro.pasos.map((p) => p.nombre),
    ["Cambio de aceite"]
  );
});

test("contestar mueve el paso de una lista a la otra", () => {
  // Es lo que ve el cliente después de aprobar: el paso deja de estar entre
  // los que esperan respuesta y aparece entre los que aprobó.
  const despues = casoPublico({
    codigo: CODIGO,
    ...todo,
    pasos: pasos.map((p) => (p.id === "p3" ? { ...p, estado: "aprobado" } : p)),
  });

  assert.deepEqual(despues.por_responder, []);
  assert.equal(despues.pasos.length, 3);
  assert.equal(totalAprobado(despues.pasos), 154500);
});

test("rechazar lo saca de las dos listas", () => {
  const despues = casoPublico({
    codigo: CODIGO,
    ...todo,
    pasos: pasos.map((p) => (p.id === "p3" ? { ...p, estado: "rechazado" } : p)),
  });

  assert.deepEqual(despues.por_responder, []);
  assert.equal(despues.pasos.length, 2);
  assert.ok(!estaAdentro(despues, pasos[2].nombre), "lo rechazado no se sigue mostrando");
});

// ------------------------------------------------------------
// Lo que el cliente SÍ ve
// ------------------------------------------------------------

test("trae lo suyo y lo que ya sabe", () => {
  assert.equal(publico.sirve, true);
  assert.equal(publico.negocio_nombre, "Taller Sur");
  assert.equal(publico.rubro, "taller");
  assert.equal(publico.cliente_nombre, "Marcela");
  assert.equal(publico.numero, 248);
  assert.equal(publico.identificador, "AB 123 CD");
  assert.equal(publico.servicio, "Un ruido raro cuando frena");
  assert.equal(publico.estado, "esperando");
});

test("frenado, dice qué se está esperando", () => {
  assert.equal(publico.que_falta, "El filtro de aceite");
});

test("si no está frenado, no dice qué falta: eso es una instrucción de adentro", () => {
  const trabajando = casoPublico({
    codigo: CODIGO,
    ...todo,
    casos: casos.map((c) =>
      c.id === "k1"
        ? { ...c, estado: "en_proceso", que_falta: "Asignar a alguien del equipo" }
        : c
    ),
  });
  assert.equal(trabajando.que_falta, null);
  assert.ok(!estaAdentro(trabajando, "Asignar a alguien del equipo"));
});

test("los pasos aprobados y su total son los que el cliente aceptó", () => {
  assert.equal(publico.pasos.length, 2);
  assert.equal(totalAprobado(publico.pasos), 96000);
});

test("sin pasos aprobados el total es cero y la lista viene vacía", () => {
  const reciennacido = casoPublico({ codigo: CODIGO, ...todo, pasos: [] });
  assert.deepEqual(reciennacido.pasos, []);
  assert.equal(totalAprobado(reciennacido.pasos), 0);
});

// ------------------------------------------------------------
// El código
// ------------------------------------------------------------

test("un código que no existe no sirve, y no cuenta por qué", () => {
  const r = casoPublico({ codigo: "no-existe", ...todo });
  assert.deepEqual(r, { sirve: false });
});

test("un caso sin código no se abre con el código vacío", () => {
  // Si la comparación fuera floja, undefined === undefined abriría el caso
  // k3, que nadie compartió nunca.
  assert.deepEqual(casoPublico({ codigo: undefined, ...todo }), { sirve: false });
  assert.deepEqual(casoPublico({ codigo: "", ...todo }), { sirve: false });
  assert.deepEqual(casoPublico({ codigo: null, ...todo }), { sirve: false });
});

test("revocar el código da lo mismo que un código inventado", () => {
  const revocado = casoPublico({
    codigo: CODIGO,
    ...todo,
    casos: casos.map((c) => (c.id === "k1" ? { ...c, seguimiento_codigo: null } : c)),
  });
  assert.deepEqual(revocado, { sirve: false });
});

test("si el caso se borró, el link se comporta como revocado", () => {
  const borrado = casoPublico({ codigo: CODIGO, ...todo, casos: casos.filter((c) => c.id !== "k1") });
  assert.deepEqual(borrado, { sirve: false });
});

test("el código de un caso no abre el de al lado", () => {
  const otro = casoPublico({ codigo: "ffffffffffffffffffffffffffffffff", ...todo });
  assert.equal(otro.numero, 249);
  assert.ok(!estaAdentro(otro, "AB 123 CD"));
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

test("el mensaje de WhatsApp dice de parte de quién es y qué es el link", () => {
  const link = linkDeSeguimiento("http://localhost:3000", CODIGO);
  const mensaje = mensajeDeWhatsApp({
    negocioNombre: "Taller Sur",
    identificador: "AB 123 CD",
    servicio: "Un ruido raro cuando frena",
    link,
  });

  assert.ok(mensaje.includes("Taller Sur"), "dice de qué negocio es");
  assert.ok(mensaje.includes("AB 123 CD"), "dice de qué auto habla");
  assert.ok(mensaje.includes(link), "lleva el link");
});

test("sin identificador, el mensaje habla de lo que pidió", () => {
  const mensaje = mensajeDeWhatsApp({
    negocioNombre: "Consultorio Belgrano",
    identificador: null,
    servicio: "Dolor de cabeza",
    link: "x",
  });
  assert.ok(mensaje.includes("Dolor de cabeza"));
});

// ------------------------------------------------------------
// Preguntarle al negocio antes de decidir
// ------------------------------------------------------------

test("el teléfono del negocio viaja; el del cliente, no", () => {
  assert.equal(publico.negocio_telefono, "341 222 3333");
  assert.ok(!estaAdentro(publico, clientes[0].telefono));
});

test("un negocio sin teléfono cargado no manda un vacío disfrazado", () => {
  for (const sinTelefono of [undefined, null, "", "   "]) {
    const r = casoPublico({ codigo: CODIGO, ...todo, negocio: { ...negocio, telefono: sinTelefono } });
    assert.equal(r.negocio_telefono, null, `con ${JSON.stringify(sinTelefono)}`);
  }
});

test("el link de WhatsApp lleva el número al formato que quiere WhatsApp", () => {
  // Diez dígitos, como los pide el sistema: con característica y sin el 0
  // ni el 15. Para un celular argentino eso es 54 9 adelante.
  assert.ok(linkDeWhatsAppA("341 456 7890", "hola").startsWith("https://wa.me/5493414567890?text="));
  assert.ok(linkDeWhatsAppA("3414567890", "hola").startsWith("https://wa.me/5493414567890?text="));
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
