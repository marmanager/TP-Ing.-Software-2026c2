// Correr con: npm test
//
// Las validaciones de los formularios de entrada. Son texto plano sin React,
// así que se prueban directo; el resto de las pantallas se mira en pantalla.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  telefonoValido,
  emailValido,
  contrasenaValida,
  montoValido,
  montoCobrado,
  cobroValido,
  faltantesDelAlta,
  clientesConEseNombre,
  sugerirClientes,
  alElegirCliente,
  alCambiarElNombre,
  clienteDelAlta,
  soloNumeros,
  motivoDeFaltantes,
} from "../src/lib/validaciones.js";

test("el teléfono va con característica, sin el 0 ni el 15", () => {
  assert.equal(telefonoValido("341 456 7890"), true);
  assert.equal(telefonoValido("3414567890"), true);
  assert.equal(telefonoValido("11 5555 1234"), true);
  assert.equal(telefonoValido("0341 15 456789"), false, "sobran dígitos");
  assert.equal(telefonoValido("456 7890"), false, "faltan dígitos");
  assert.equal(telefonoValido("0111234567"), false, "no arranca en 0");
  assert.equal(telefonoValido(""), false);
});

test("el mail necesita arroba y un punto después", () => {
  assert.equal(emailValido("ana@taller.com"), true);
  assert.equal(emailValido("ana.perez@taller.com.ar"), true);
  assert.equal(emailValido("  ana@taller.com  "), true, "se recortan los espacios");
  assert.equal(emailValido("ana@taller"), false);
  assert.equal(emailValido("ana taller.com"), false);
  assert.equal(emailValido("@taller.com"), false);
  assert.equal(emailValido(""), false);
});

test("la contraseña necesita al menos 8 caracteres", () => {
  assert.equal(contrasenaValida("12345678"), true);
  assert.equal(contrasenaValida("1234567"), false);
  assert.equal(contrasenaValida(""), false);
});

test("el monto va con números y sin puntos", () => {
  assert.equal(montoValido("120000"), true);
  assert.equal(montoValido(" 74000 "), true);
  assert.equal(montoValido("120.000"), false, "con puntos no: la cartilla pide sin puntos");
  assert.equal(montoValido("120,50"), false);
  assert.equal(montoValido("ciento veinte mil"), false);
  assert.equal(montoValido("0"), false, "un paso que no cuesta nada no es un paso");
  assert.equal(montoValido("-500"), false);
  assert.equal(montoValido(""), false);
});

// El cobro no se valida con montoValido: ese exige mayor que cero, porque un
// paso del presupuesto que no cuesta nada no es un paso. El cobro juega
// distinto, y la diferencia es la que importa en SCRUM-74:
//
//   vacío → no se registró cobro acá (se cobra afuera, o todavía no se cobró)
//   cero  → se entregó y no se cobró nada (garantía, cortesía, obra social)
//
// Guardar las dos como 0 borraría esa diferencia, y es plata.
test("el campo vacío no registra ningún cobro", () => {
  assert.equal(montoCobrado(""), null);
  assert.equal(montoCobrado("   "), null, "espacios sueltos tampoco son un cobro");
});

test("cobrar cero no es lo mismo que no registrar nada", () => {
  assert.equal(montoCobrado("0"), 0);
});

test("el monto cobrado se guarda como número", () => {
  assert.equal(montoCobrado("120000"), 120000);
  assert.equal(montoCobrado(" 74000 "), 74000, "se recortan los espacios");
});

test("el cobro acepta que no haya monto, pero no acepta cualquier cosa", () => {
  assert.equal(cobroValido(""), true, "entregar sin registrar cobro se puede");
  assert.equal(cobroValido("0"), true);
  assert.equal(cobroValido("120000"), true);
  assert.equal(cobroValido("120.000"), false, "sin puntos, como el resto del sistema");
  assert.equal(cobroValido("-500"), false);
  assert.equal(cobroValido("ciento veinte mil"), false);
});

// ---------------------------------------------------------------
// Qué falta en el alta de un caso
// ---------------------------------------------------------------

const completo = {
  nombre: "Marcela Suárez",
  telefono: "341 456 7890",
  identificador: "AB 123 CD",
  servicio: "Frenos",
};

test("con todo cargado no falta nada y el botón se prende", () => {
  const faltan = faltantesDelAlta(completo, "la patente");
  assert.deepEqual(faltan, []);
  assert.equal(motivoDeFaltantes(faltan), null);
});

test("si falta uno solo, el botón dice cuál", () => {
  const faltan = faltantesDelAlta({ ...completo, identificador: "" }, "el DNI");
  assert.equal(motivoDeFaltantes(faltan), "falta el DNI");
});

test("si faltan varios, el botón dice cuántos y se sabe cuáles marcar", () => {
  const faltan = faltantesDelAlta({ nombre: "", telefono: "", identificador: "", servicio: "" }, "la patente");
  assert.equal(motivoDeFaltantes(faltan), "faltan 4 datos");
  assert.deepEqual(
    faltan.map((f) => f.campo),
    ["cliente", "telefono", "identificador", "servicio"]
  );
});

test("un teléfono mal escrito cuenta como faltante", () => {
  const faltan = faltantesDelAlta({ ...completo, telefono: "0341 15 456" }, "la patente");
  assert.equal(motivoDeFaltantes(faltan), "falta el teléfono");
});

test("los espacios solos no cuentan como dato", () => {
  const faltan = faltantesDelAlta({ ...completo, nombre: "   " }, "la patente");
  assert.equal(motivoDeFaltantes(faltan), "falta el nombre");
});

// ---------------------------------------------------------------
// El cliente del alta: se elige de la lista, o se reconoce por nombre y
// teléfono
// ---------------------------------------------------------------

const MARCELA = { id: "c1", nombre: "Marcela Suárez", telefono: "341 456 7890" };
const OTRA_MARCELA = { id: "c4", nombre: "Marcela Suárez", telefono: "351 777 8888" };
const HUGO = { id: "c2", nombre: "Hugo Peralta", telefono: "11 2233 4455" };
const SIN_TELEFONO = { id: "c3", nombre: "Ana Gómez", telefono: null };
const CLIENTES = [MARCELA, HUGO, SIN_TELEFONO, OTRA_MARCELA];

test("la lista sugiere los que contienen lo escrito, también los repetidos", () => {
  assert.deepEqual(sugerirClientes("marce", CLIENTES), [MARCELA, OTRA_MARCELA]);
  assert.deepEqual(sugerirClientes("PERALTA", CLIENTES), [HUGO]);
  assert.deepEqual(sugerirClientes("   ", CLIENTES), []);
});

test("los clientes con ese nombre: sin importar mayúsculas ni espacios de más", () => {
  assert.deepEqual(clientesConEseNombre("  marcela suárez ", CLIENTES), [MARCELA, OTRA_MARCELA]);
  assert.deepEqual(clientesConEseNombre("Marcela", CLIENTES), []);
});

test("elegir un cliente pone su nombre y su teléfono, aunque hubiera otro escrito", () => {
  assert.deepEqual(alElegirCliente(MARCELA, "351 000 0000"), {
    nombre: "Marcela Suárez",
    telefono: "341 456 7890",
    elegido: MARCELA,
  });
});

test("elegir otro, por un toque equivocado, pone el teléfono del otro", () => {
  assert.equal(alElegirCliente(OTRA_MARCELA, "341 456 7890").telefono, "351 777 8888");
});

test("un cliente sin teléfono guardado deja el que estaba escrito", () => {
  assert.equal(alElegirCliente(SIN_TELEFONO, "351 000 0000").telefono, "351 000 0000");
});

test("escribir el nombre a mano no trae el teléfono", () => {
  const r = alCambiarElNombre({ nombre: "Marcela Suárez", telefono: "", elegido: null });
  assert.deepEqual(r, { telefono: "", elegido: null });
});

test("si el nombre deja de ser el del elegido, se suelta, y el teléfono que se puso solo se va", () => {
  const r = alCambiarElNombre({ nombre: "Marcela Suárez de", telefono: "341 456 7890", elegido: MARCELA });
  assert.deepEqual(r, { telefono: "", elegido: null });
});

test("si el nombre deja de ser el del elegido, un teléfono corregido a mano queda", () => {
  const r = alCambiarElNombre({ nombre: "Marcela S", telefono: "341 999 9999", elegido: MARCELA });
  assert.deepEqual(r, { telefono: "341 999 9999", elegido: null });
});

test("mientras el nombre siga siendo el del elegido, no cambia nada", () => {
  const r = alCambiarElNombre({ nombre: "marcela suárez", telefono: "341 999 9999", elegido: MARCELA });
  assert.deepEqual(r, { telefono: "341 999 9999", elegido: MARCELA });
});

test("el caso va al cliente elegido de la lista, aunque haya otro con el mismo nombre", () => {
  const r = clienteDelAlta({ nombre: "Marcela Suárez", telefono: "341 456 7890", clientes: CLIENTES, elegido: OTRA_MARCELA });
  assert.equal(r, OTRA_MARCELA);
});

test("escrito a mano, el caso va al cliente con el mismo nombre y el mismo teléfono", () => {
  const r = clienteDelAlta({ nombre: "marcela suárez", telefono: "351-777-8888", clientes: CLIENTES, elegido: null });
  assert.equal(r, OTRA_MARCELA);
});

test("escrito a mano con otro teléfono, es un cliente nuevo", () => {
  const r = clienteDelAlta({ nombre: "Hugo Peralta", telefono: "11 9999 0000", clientes: CLIENTES, elegido: null });
  assert.equal(r, null);
});

test("sin teléfono escrito todavía no se reconoce a nadie", () => {
  assert.equal(clienteDelAlta({ nombre: "Hugo Peralta", telefono: "", clientes: CLIENTES, elegido: null }), null);
});

test("el teléfono se compara sólo por los números", () => {
  assert.equal(soloNumeros("341 456-7890"), "3414567890");
  assert.equal(soloNumeros(null), "");
});
