// Correr con: npm run test:unit
//
// B-1b · El teléfono tiene que poder llegar a WhatsApp (front).
//
// Hasta acá el front pedía diez dígitos sin país —3414567890— y los daba por
// buenos para WhatsApp, que sin código de país no sabe adónde mandarlos. La
// API ya los rechaza (B-1a). Acá se prueba lo que la pantalla necesita para
// pedirlos bien, con la lógica pura de src/lib/telefono.js:
//
//   · El país no se escribe: se elige en un selector que arranca en el país
//     del negocio y muestra lo que se va a agregar (🇦🇷 +54 9).
//   · Debajo del campo, antes de escribir, el formato y un ejemplo del país.
//   · Lo que se guarda es internacional, sólo dígitos: 5493414567890.

import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  armarTelefono,
  ayudaDelPais,
  chipDelPais,
  normalizarTelefono,
  paisInicial,
  PAISES,
  paraEditar,
  PATRON_TELEFONO_COMPLETO,
  separarLoEscrito,
  telefonoIncompleto,
  telefonoLegible,
} from "../../src/lib/telefono.js";
import { telefonoWhatsAppValido } from "../../src/lib/seguimiento-whatsapp.js";
import { linkDeWhatsAppA } from "../../src/lib/seguimiento.js";

const soloNumeros = (t) => String(t ?? "").replace(/\D/g, "");

describe("Historia: el teléfono tiene que poder llegar a WhatsApp", () => {
  test("el selector arranca en el país del negocio", () => {
    expect(paisInicial({ pais: "UY" })).toBe("UY");
    expect(paisInicial({ pais: "AR" })).toBe("AR");
    // Un negocio de antes de la 055, o sin negocio todavía (crear cuenta):
    // Argentina, que es el de todos los que ya existen.
    expect(paisInicial({})).toBe("AR");
    expect(paisInicial(null)).toBe("AR");
    // Un país que el front no conoce no deja el selector vacío.
    expect(paisInicial({ pais: "FR" })).toBe("AR");
  });

  test("el código que muestra el selector es el que se agrega al guardar", () => {
    expect(chipDelPais("AR")).toBe("🇦🇷 +54 9");
    expect(chipDelPais("UY")).toBe("🇺🇾 +598");
    for (const p of PAISES) {
      const armado = armarTelefono(p.codigo, p.ejemplo);
      expect(armado.ok).toBe(true);
      expect(armado.telefono.startsWith(soloNumeros(chipDelPais(p.codigo)))).toBe(true);
    }
  });

  test("con Argentina elegida, diez dígitos se arman en internacional con el 9", () => {
    for (const escrito of ["341 456 7890", "3414567890", "341-456-7890", "(341) 456 7890"]) {
      expect(armarTelefono("AR", escrito)).toEqual({ ok: true, telefono: "5493414567890", pais: "AR" });
    }
    // Si alguien escribe el 9 por costumbre, no queda doble.
    expect(armarTelefono("AR", "9 341 456 7890").telefono).toBe("5493414567890");
  });

  test("cambiar el país cambia el ejemplo y el formato que se pide", () => {
    expect(ayudaDelPais("AR")).toBe("Característica y número, sin el 0 ni el 15. Ejemplo: 341 456 7890.");
    expect(ayudaDelPais("UY")).toBe("El celular sin el 0 de adelante. Ejemplo: 94 123 456.");
    expect(new Set(PAISES.map((p) => ayudaDelPais(p.codigo))).size).toBe(PAISES.length);
    // Y lo que vale depende del país: diez dígitos sirven en Argentina, no
    // en Uruguay.
    expect(armarTelefono("UY", "341 456 7890").ok).toBe(false);
    expect(armarTelefono("UY", "94 123 456")).toEqual({ ok: true, telefono: "59894123456", pais: "UY" });
  });

  test("pegar el número completo con +54 9 elige el país y deja el resto", () => {
    expect(separarLoEscrito("+54 9 341 456 7890", "UY")).toEqual({ pais: "AR", numero: "341 456 7890" });
    expect(separarLoEscrito("+598 94 123 456", "AR")).toEqual({ pais: "UY", numero: "94 123 456" });
    // Copiado de un contacto, sin el +, pero completo: también se entiende.
    expect(separarLoEscrito("5493414567890", "AR")).toEqual({ pais: "AR", numero: "341 456 7890" });
    // Lo que se escribe normal queda como está, en el país elegido.
    expect(separarLoEscrito("341 456", "AR")).toEqual({ pais: "AR", numero: "341 456" });
  });

  test("rechaza uno que empieza con 0 y explica qué hacer", () => {
    const r = armarTelefono("AR", "0341 456 7890");
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("empieza_con_cero");
    expect(r.mensaje).toBe(
      "Escribilo sin el 0 de adelante. Característica y número, sin el 0 ni el 15. Por ejemplo: 341 456 7890."
    );
  });

  test("rechaza uno con el 15 adelante", () => {
    for (const escrito of ["15 4567 8901", "341 15 456 7890"]) {
      const r = armarTelefono("AR", escrito);
      expect(r.ok).toBe(false);
      expect(r.motivo).toBe("con_quince");
      expect(r.mensaje).toMatch(/^Escribilo sin el 15\. .*Por ejemplo: 341 456 7890\.$/);
    }
    // Los cortos y los largos también dicen qué pasa, con el ejemplo del país.
    expect(armarTelefono("AR", "456 7890").mensaje).toMatch(/^Al número le faltan dígitos para Argentina\./);
    expect(armarTelefono("UY", "94 123 4567").mensaje).toMatch(/Por ejemplo: 94 123 456\.$/);
  });

  test("un código de país no soportado se avisa en pantalla", () => {
    const r = separarLoEscrito("+44 7911 123456", "AR");
    expect(r.pais).toBe("AR");
    expect(r.motivo).toBe("pais_no_soportado");
    expect(r.mensaje).toMatch(/^Ese código de país no está entre los que manejamos: Argentina, Uruguay/);
  });

  test("muestra el número guardado legible y con el código separado", () => {
    expect(telefonoLegible("5493414567890")).toBe("+54 9 341 456 7890");
    expect(telefonoLegible("59894123456")).toBe("+598 94 123 456");
    expect(telefonoLegible("5511912345678")).toBe("+55 11 91234 5678");
    // Uno de antes no se disfraza de internacional: se muestra como está.
    expect(telefonoLegible("3414567890")).toBe("3414567890");
    expect(telefonoLegible(null)).toBe("");
  });

  test("un teléfono incompleto de antes se marca en la ficha del cliente", () => {
    expect(telefonoIncompleto({ telefono: "3414567890" })).toBe(true);
    expect(telefonoIncompleto({ telefono: "5493414567890" })).toBe(false);
    expect(telefonoIncompleto({ telefono: null })).toBe(false);
    // Si la API lo dice (055), manda la API.
    expect(telefonoIncompleto({ telefono: "3414567890", telefono_incompleto: false })).toBe(false);
    // Al corregirlo, el selector arranca en el país del negocio y el número
    // viejo queda para no tener que escribirlo de nuevo.
    expect(paraEditar("3414567890", "AR")).toEqual({ pais: "AR", numero: "3414567890" });
    expect(paraEditar("59894123456", "AR")).toEqual({ pais: "UY", numero: "94 123 456" });
    expect(paraEditar(null, "UY")).toEqual({ pais: "UY", numero: "" });
  });

  test("el enlace de wa.me se arma con el número internacional", () => {
    expect(linkDeWhatsAppA("5493414567890", "hola")).toBe("https://wa.me/5493414567890?text=hola");
    expect(linkDeWhatsAppA("+54 9 341 456 7890", "hola")).toBe("https://wa.me/5493414567890?text=hola");
    // Sin país no se arma: antes se le pegaba un 549 a ciegas.
    expect(linkDeWhatsAppA("3414567890", "hola")).toBeNull();
  });
});

describe("WhatsApp no se ofrece a un número que no lo puede recibir", () => {
  test("telefonoWhatsAppValido exige el código de país", () => {
    expect(telefonoWhatsAppValido("3414567890")).toBe(false);
    expect(telefonoWhatsAppValido("5493414567890")).toBe(true);
    expect(telefonoWhatsAppValido("+54 9 341 456 7890")).toBe(true);
    expect(telefonoWhatsAppValido("")).toBe(false);
  });
});

// ------------------------------------------------------------
// El espejo de la API
// ------------------------------------------------------------
// La lista de países está dos veces: en la API (compartido/telefono.ts) y
// acá. Las dos se atan al mismo literal, el de la 055: la API lo compara del
// otro lado (migracion-telefonos.test.ts) y este test de éste. Si una cambia
// y la otra no, falla alguno de los dos.

describe("La regla del front es la misma que la de la API", () => {
  test("el patrón de un teléfono completo es el de la 055", () => {
    const sql = readFileSync(
      fileURLToPath(new URL("../../supabase/055_telefono_internacional.sql", import.meta.url)),
      "utf8"
    );
    expect(sql).toContain(`'${PATRON_TELEFONO_COMPLETO}'`);
  });

  test("lo que guarda el front pasa la regla de la API", () => {
    for (const p of PAISES) {
      const { telefono } = armarTelefono(p.codigo, p.ejemplo);
      expect(new RegExp(PATRON_TELEFONO_COMPLETO).test(telefono)).toBe(true);
      expect(normalizarTelefono(telefono)).toEqual({ ok: true, telefono, pais: p.codigo });
    }
  });
});
