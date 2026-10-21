// Correr con: npm run test:unit
//
// Las claves que el código pide con t("...") existen en el castellano (si no,
// la pantalla mostraría la clave cruda), y las funciones de src/lib/ que
// devuelven texto usan el `t` que se les pasa y, sin él, salen en castellano
// (docs/idiomas.md).

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";
import { traducir } from "../src/lib/idioma.js";
import { armarTelefono, normalizarTelefono, ayudaDelPais, nombreDelPais, fraseTelefonoIncompleto } from "../src/lib/telefono.js";
import { motivoDeContrasenaNueva, faltantesDelAlta, motivoDeFaltantes } from "../src/lib/validaciones.js";
import { revisarArchivo } from "../src/lib/imagen.js";

const raiz = fileURLToPath(new URL("../", import.meta.url));
const buscar = (dicc, clave) => clave.split(".").reduce((o, k) => o?.[k], dicc);

test("toda clave t(\"...\") escrita literal en src/ existe en castellano", () => {
  const faltan = [];
  for (const e of readdirSync(join(raiz, "src"), { recursive: true, withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith(".js")) continue;
    const ruta = join(e.parentPath ?? e.path, e.name);
    const fuente = readFileSync(ruta, "utf8");
    for (const [, clave] of fuente.matchAll(/(?<![\w.$])t\(\s*"([a-z][\w]*(?:\.[\w]+)+)"/g)) {
      if (buscar(es, clave) == null) faltan.push(`${e.name}: ${clave}`);
    }
  }
  assert.deepEqual(faltan, []);
});

const tEn = (c, v, s) => traducir({ diccionario: en, base: es, locale: "en-US" }, c, v, s);

test("telefono: los mensajes salen en el idioma del t que se pasa, y en castellano sin t", () => {
  assert.equal(
    armarTelefono("AR", "12").mensaje,
    "Al número le faltan dígitos para Argentina. Característica y número, sin el 0 ni el 15. Por ejemplo: 341 456 7890."
  );
  assert.equal(
    armarTelefono("BR", "12", tEn).mensaje,
    "The number is missing digits for Brazil. Area code (DDD) and number, with the mobile 9. For example: 11 91234 5678."
  );
  assert.equal(armarTelefono("AR", "12", tEn).motivo, "corto");
  assert.equal(normalizarTelefono("abc", tEn).mensaje, "The phone number takes only digits.");
  assert.equal(normalizarTelefono("+99 123", tEn).mensaje.startsWith("That country code isn't one we support: Argentina, Uruguay"), true);
  assert.equal(ayudaDelPais("US", tEn), "Area code and number. Example: 201 555 0123.");
  assert.equal(nombreDelPais("ES", tEn), "Spain, +34");
  assert.equal(nombreDelPais("ES"), "España, +34");
  assert.equal(fraseTelefonoIncompleto(tEn).startsWith("This phone number is missing its country code"), true);
});

test("validaciones: los motivos salen en el idioma del t que se pasa", () => {
  assert.equal(motivoDeContrasenaNueva("abc", "abc"), "necesita 8 caracteres o más");
  assert.equal(motivoDeContrasenaNueva("abc", "abc", tEn), "needs 8 characters or more");
  assert.equal(motivoDeContrasenaNueva("12345678", "1234567", tEn), "type it the same below");
  const faltan = faltantesDelAlta({}, "the license plate", tEn);
  assert.deepEqual(faltan.map((f) => f.frase), ["name missing", "phone missing", "the license plate missing", "what they need is missing"]);
  assert.equal(motivoDeFaltantes(faltan, tEn), "4 details missing");
  assert.equal(motivoDeFaltantes(faltan), "faltan 4 datos");
});

test("imagen: el error de un archivo sale en el idioma del t que se pasa", () => {
  assert.equal(revisarArchivo(null), "No se eligió ninguna foto.");
  assert.equal(revisarArchivo(null, tEn), "No photo was chosen.");
});
