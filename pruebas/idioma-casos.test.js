// Correr con: npm run test:unit
//
// Casos e historial en los dos idiomas (docs/idiomas.md). Las funciones de
// src/lib/ que devuelven texto para mostrar usan el `t` que se les pasa y, sin
// él, salen en castellano; el texto que alguien escribió no se toca.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";
import { traducir } from "../src/lib/idioma.js";
import {
  accionDeFila,
  queFalta,
  quienLoTiene,
  quienLoTieneEnPalabras,
  significadoDeEstado,
  ORDEN_ESTADOS,
} from "../src/lib/estados.js";
import { presentacionEstado } from "../src/lib/presentacion-estados.js";
import { mensajeDePago, palabraDelCobro, palabraDelMedio, MEDIOS } from "../src/lib/cobros.js";
import { erroresSeguimiento, linkDelAvisoDeAvance } from "../src/lib/seguimiento-whatsapp.js";
import { casoEnFrase, lineaDelCaso, subtituloDelCaso, tituloDelCaso } from "../src/lib/nombres.js";
import { cuando, cuantoHace, diaPasado, haceCuanto } from "../src/lib/fechas.js";
import { conElementos } from "../src/lib/conElementos.js";

const tEn = (c, v, s) => traducir({ diccionario: en, base: es, locale: "en-US" }, c, v, s);

const caso = (estado, extra = {}) => ({ id: "k1", numero: 271, estado, responsable_id: null, ...extra });
const paso = (estado, extra = {}) => ({ caso_id: "k1", nombre: "Un paso", monto: 1000, estado, ...extra });

test("qué falta: sale en el idioma del t y con el preset del idioma; los nombres de los datos quedan", () => {
  const ctx = { rubro: "taller", pasos: [paso("esperando"), paso("esperando")], cliente: { nombre: "Marcela Suárez" } };
  assert.equal(queFalta(caso("esperando", { responsable_id: "e1" }), ctx), "Que Marcela Suárez apruebe 2 pasos");
  assert.equal(
    queFalta(caso("esperando", { responsable_id: "e1" }), { ...ctx, idioma: "en" }, tEn),
    "Waiting for Marcela Suárez to approve 2 steps"
  );
  assert.equal(
    queFalta(caso("esperando", { responsable_id: "e1" }), { ...ctx, pasos: [paso("esperando")], cliente: null, idioma: "en" }, tEn),
    "Waiting for the customer to approve 1 step"
  );
  assert.equal(queFalta(caso("completado")), "Nada, el caso está cerrado.");
  assert.equal(queFalta(caso("completado"), {}, tEn), "Nothing, the case is closed.");
  assert.equal(queFalta(caso("nuevo"), {}, tEn), "Assign someone on the team");
  // El insumo que trabó el caso es un dato del negocio.
  assert.equal(
    queFalta(caso("esperando", { responsable_id: "e1" }), { rubro: "taller", insumos: [{ caso_id: "k1", estado: "pedido", nombre: "La correa" }], idioma: "en" }, tEn),
    "Waiting for “La correa” to arrive"
  );
  // La frase del preset viene en el idioma del preset.
  assert.equal(
    queFalta(caso("revision_final", { responsable_id: "e1" }), { rubro: "taller", idioma: "en" }, tEn),
    "Check before handing it over"
  );
});

test("quién lo tiene y la acción de la fila", () => {
  assert.equal(quienLoTiene(caso("esperando"), []), "Proveedor");
  assert.equal(quienLoTiene(caso("esperando"), [], tEn), "Supplier");
  assert.equal(quienLoTiene(caso("nuevo", { responsable_id: "e1" }), [{ id: "e1", nombre: "Diego" }], tEn), "Diego");
  assert.equal(quienLoTieneEnPalabras(caso("nuevo", { responsable_id: "e1" }), [{ id: "e1", nombre: "Diego" }]), "Lo tiene Diego");
  assert.equal(quienLoTieneEnPalabras(caso("nuevo"), [], tEn), "Nobody has it yet");
  assert.equal(accionDeFila(caso("nuevo")).etiqueta, "Asignar responsable");
  assert.equal(accionDeFila(caso("nuevo"), {}, tEn).etiqueta, "Assign someone");
  assert.equal(accionDeFila(caso("revision_final"), {}, tEn).etiqueta, "Hand over and close");
  assert.equal(
    accionDeFila(caso("esperando"), { insumos: [{ caso_id: "k1", estado: "pedido", id: "i1" }] }, tEn).etiqueta,
    "Mark as arrived"
  );
});

test("los cinco estados tienen su significado en los dos idiomas; el nombre guardado por el negocio no se traduce", () => {
  for (const e of ORDEN_ESTADOS) {
    assert.ok(significadoDeEstado(e).length > 10, e);
    assert.notEqual(significadoDeEstado(e, tEn), significadoDeEstado(e), e);
  }
  assert.equal(presentacionEstado({ rubro: "taller" }, "en_proceso").nombre, "Está en el taller");
  assert.equal(presentacionEstado({ rubro: "taller" }, "en_proceso", "en").nombre, "In the shop");
  assert.equal(
    presentacionEstado({ rubro: "taller", estados: { en_proceso: { nombre: "En el box" } } }, "en_proceso", "en").nombre,
    "En el box"
  );
});

test("cobros: la palabra del medio y del cobro, y el mensaje de WhatsApp que sale en el idioma de quien lo manda", () => {
  assert.equal(MEDIOS.tarjeta.palabra, "Tarjeta en el local");
  assert.equal(palabraDelMedio("tarjeta", tEn), "Card in store");
  assert.equal(palabraDelMedio("algo-raro", tEn), "No record of how it was paid");
  assert.equal(palabraDelCobro("pagado"), "Pagado");
  assert.equal(palabraDelCobro("rechazado", tEn), "Payment didn't go through");
  const datos = { negocio: "Taller Sur", cliente: "Marcela Suárez", monto: 60000, link: "https://pago/x" };
  assert.equal(mensajeDePago(datos), "Hola Marcela. Te escribimos de Taller Sur. Podés pagar los $60.000 desde acá: https://pago/x");
  assert.equal(mensajeDePago(datos, tEn, "en-US"), "Hi Marcela. We're writing from Taller Sur. You can pay $60,000 from here: https://pago/x");
  assert.equal(mensajeDePago({ monto: 1, link: "l" }, tEn), "Hi. You can pay $1 from here: l");
  assert.equal(mensajeDePago({ negocio: "Taller Sur", monto: 1, link: "l" }), "Hola. Te escribimos de Taller Sur. Podés pagar los $1 desde acá: l");
});

test("seguimiento de WhatsApp: errores y aviso de link en el idioma del t", () => {
  const valor = { enviar: true, dias: "x", mensaje: "" };
  assert.equal(erroresSeguimiento(valor).dias, "Elegí una cantidad de días enteros entre 0 y 3650.");
  assert.equal(erroresSeguimiento(valor, tEn).dias, "Choose a whole number of days between 0 and 3650.");
  assert.equal(erroresSeguimiento(valor, tEn).mensaje, "Write the message the customer will receive.");
  assert.deepEqual(erroresSeguimiento({ enviar: false }, tEn), {});
  const aviso = linkDelAvisoDeAvance({ caso: caso("en_proceso"), pasos: [paso("esperando")] }, tEn);
  assert.equal(aviso.boton, "Create the link");
  assert.ok(aviso.consecuencia.startsWith("It has unanswered steps"));
});

test("el nombre del caso: 'Caso 271' sale en el idioma; el nombre que le puso el negocio, tal cual", () => {
  assert.equal(tituloDelCaso({ numero: 271 }), "Caso 271");
  assert.equal(tituloDelCaso({ numero: 271 }, tEn), "Case 271");
  assert.equal(tituloDelCaso({ numero: 271, nombre: "Cambio de aceite" }, tEn), "Cambio de aceite");
  assert.equal(subtituloDelCaso({ numero: 271, nombre: "Cambio de aceite" }, tEn), "Case 271");
  assert.equal(subtituloDelCaso({ numero: 271 }, tEn), null);
  assert.equal(casoEnFrase({ numero: 271 }), "caso 271");
  assert.equal(casoEnFrase({ numero: 271 }, tEn), "case 271");
  assert.equal(casoEnFrase({ numero: 271, nombre: "Hugo Peralta" }, tEn), "case Hugo Peralta");
  assert.equal(lineaDelCaso({ numero: 271, servicio: "Frenos" }, "Hugo", tEn), "Frenos · Hugo");
});

test("fechas: las palabras (hoy, ayer, hace N días) salen en el idioma del t", () => {
  const ahora = new Date();
  const hace = (dias) => new Date(ahora.getTime() - dias * 86400000).toISOString();
  assert.equal(cuantoHace(hace(0)), "hoy");
  assert.equal(cuantoHace(hace(0), tEn), "today");
  assert.equal(cuantoHace(hace(1), tEn), "yesterday");
  assert.equal(cuantoHace(hace(5)), "hace 5 días");
  assert.equal(cuantoHace(hace(5), tEn), "5 days ago");
  assert.equal(haceCuanto(hace(5)), "Abierto hace 5 días");
  assert.equal(haceCuanto(hace(5), tEn), "Opened 5 days ago");
  assert.equal(haceCuanto(hace(0), tEn), "Opened today");
  assert.equal(diaPasado(hace(0), "en-US", tEn), "Today");
  assert.equal(diaPasado(hace(1)), "Ayer");
  assert.match(cuando(hace(0), "en-US", tEn), /^Today \d\d:\d\d$/);
  assert.match(cuando(hace(0)), /^Hoy \d\d:\d\d$/);
});

test("conElementos parte la frase en el marcador y deja el resto como está", () => {
  const partes = conElementos("Ya te pagó {pagado} de {aprobado}.", { pagado: "X" });
  assert.equal(partes.length, 5);
  assert.equal(partes[0], "Ya te pagó ");
  assert.equal(partes[1].props.children, "X");
  assert.equal(partes[3], "{aprobado}");
  assert.equal(partes.at(-1), ".");
});

test("las claves de casos, historial, aprobar y fechas están en los dos idiomas, con la misma forma", () => {
  const esPlural = (v) => v && typeof v === "object" && "other" in v;
  const claves = (o, p = "") =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !esPlural(v) ? claves(v, `${p}${k}.`) : [`${p}${k}`]));
  for (const ns of ["casos", "historial", "aprobar", "fechas"]) {
    assert.deepEqual(claves(en[ns]).sort(), claves(es[ns]).sort(), ns);
  }
});

test("las variables de cada texto en inglés son las mismas que en castellano", () => {
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const texto = (v) => (esPlural(v) ? `${v.one} ${v.other}` : v);
  const esPlural = (v) => v && typeof v === "object" && "other" in v;
  const recorrer = (a, b, ruta, malas) => {
    for (const [k, v] of Object.entries(a)) {
      const w = b?.[k];
      if (w == null) continue;
      if (v && typeof v === "object" && !esPlural(v)) recorrer(v, w, `${ruta}.${k}`, malas);
      else {
        const sv = new Set(vars(texto(v)).split(",").filter(Boolean));
        const sw = new Set(vars(texto(w)).split(",").filter(Boolean));
        // {n} sólo en la forma plural puede faltar en "one" (por ejemplo "un paso"), pero no sobrar.
        for (const x of sw) if (!sv.has(x)) malas.push(`${ruta}.${k}: sobra {${x}}`);
        for (const x of sv) if (!sw.has(x) && x !== "n") malas.push(`${ruta}.${k}: falta {${x}}`);
      }
    }
  };
  const malas = [];
  for (const ns of ["casos", "historial", "aprobar", "fechas"]) recorrer(es[ns], en[ns], ns, malas);
  assert.deepEqual(malas, []);
});

// Un nombre guardado que es el de fábrica (en cualquiera de los dos idiomas) se
// traduce; uno que el negocio escribió se muestra como lo escribió.
test("nombres de estado guardados: los de fábrica siguen al idioma, los propios no", async () => {
  const { RUBROS, preset } = await import("../src/lib/presets.js");
  assert.equal(RUBROS.length, 4);
  for (const { clave: rubro } of RUBROS) {
    for (const estado of ORDEN_ESTADOS) {
      const fabrica = (i) => preset(rubro, i).etiquetas[estado];
      const con = (nombre) => ({ rubro, estados: { [estado]: { nombre, icono: "reloj" } } });
      const ver = (nombre, idioma) => presentacionEstado(con(nombre), estado, idioma).nombre;
      assert.equal(ver(fabrica("es"), "en"), fabrica("en"), `${rubro}/${estado} es->en`);
      assert.equal(ver(fabrica("en"), "es"), fabrica("es"), `${rubro}/${estado} en->es`);
      assert.equal(ver(`  ${fabrica("es")} `, "en"), fabrica("en"), `${rubro}/${estado} con espacios`);
      assert.equal(ver("En el box", "es"), "En el box");
      assert.equal(ver("En el box", "en"), "En el box");
      assert.equal(ver("", "en"), fabrica("en"));
      assert.equal(ver("   ", "es"), fabrica("es"));
      assert.equal(presentacionEstado({ rubro }, estado, "en").nombre, fabrica("en"));
      // el ícono guardado se respeta
      assert.equal(presentacionEstado(con(fabrica("es")), estado, "en").icono, "reloj");
    }
  }
});
