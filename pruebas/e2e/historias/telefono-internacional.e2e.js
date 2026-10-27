import { $, $$, browser, expect } from "@wdio/globals";
import { entrar, verTexto } from "./ayudas.js";

// B-1b · El teléfono tiene que poder llegar a WhatsApp (front).
//
// Necesita la API con B-1a (migración 055) y su siembra: los teléfonos en
// internacional y «Hugo Teléfono Viejo» (c5), cargado antes de exigir el
// código de país, que la 055 marca incompleto. El negocio sembrado es de
// Argentina, así que el selector arranca en +54 9.
//
// Las reglas (qué país, cómo se arma, qué dice el error) están probadas en
// pruebas/historias/telefono-internacional.test.js; acá se mira que la
// pantalla las muestre y que la API acepte lo que el campo arma.

// Como pega o escribe alguien: React escucha el evento input.
async function escribir(selector, valor) {
  await browser.execute((sel, v) => {
    const input = document.querySelector(sel);
    const poner = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    poner.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, selector, valor);
}

describe("Historia: el teléfono tiene que poder llegar a WhatsApp", () => {
  it("AC11, AC12 y AC14: el selector arranca en el país del negocio y la ayuda se ve antes de escribir", async () => {
    await entrar("/clientes");
    await $("button*=Dar de alta un cliente").click();
    await expect($("#nuevo-telefono-pais")).toHaveValue("AR");
    await expect($("#nuevo-telefono-pais").parentElement()).toHaveText(expect.stringContaining("+54 9"));
    await expect($("#nuevo-telefono-ayuda")).toHaveText(
      "Característica y número, sin el 0 ni el 15. Ejemplo: 341 456 7890."
    );
    await expect($("#nuevo-telefono")).toHaveValue("");
  });

  it("AC14 y AC21: el país se cambia con el teclado, y cambian el formato y el ejemplo", async () => {
    await entrar("/clientes");
    await $("button*=Dar de alta un cliente").click();
    await expect($("#nuevo-telefono-pais")).toHaveAttribute("aria-label", "País del teléfono");
    await $("#nuevo-nombre").click();
    await browser.keys("Tab");
    await expect($("#nuevo-telefono-pais")).toBeFocused();
    await browser.keys("ArrowDown");
    await expect($("#nuevo-telefono-pais")).toHaveValue("UY");
    await expect($("#nuevo-telefono-ayuda")).toHaveText("El celular sin el 0 de adelante. Ejemplo: 94 123 456.");
  });

  it("AC15: pegar el número completo elige el país y deja el resto", async () => {
    await entrar("/clientes");
    await $("button*=Dar de alta un cliente").click();
    await $("#nuevo-telefono-pais").selectByAttribute("value", "UY");
    await escribir("#nuevo-telefono", "+54 9 341 777 8888");
    await expect($("#nuevo-telefono-pais")).toHaveValue("AR");
    await expect($("#nuevo-telefono")).toHaveValue("341 777 8888");
  });

  it("AC16: el error dice qué pasa y da el ejemplo del país", async () => {
    await entrar("/clientes");
    await $("button*=Dar de alta un cliente").click();
    await $("#nuevo-telefono").click();
    await escribir("#nuevo-telefono", "0341 777 8888");
    // El error aparece al salir del campo, no mientras se escribe.
    await $("#nuevo-nombre").click();
    await verTexto("Escribilo sin el 0 de adelante. Característica y número, sin el 0 ni el 15. Por ejemplo: 341 456 7890.");
  });

  it("AC13 y AC17: se guarda en internacional y se muestra legible", async () => {
    await entrar("/clientes");
    await $("button*=Dar de alta un cliente").click();
    await $("#nuevo-nombre").setValue("Pablo Selector");
    await escribir("#nuevo-telefono", "341 777 8888");
    await $("button*=Guardar el cliente").click();
    await verTexto("Pablo Selector ya está en la lista de clientes");
    const tarjeta = $("li*=Pablo Selector");
    await expect(tarjeta.$('a[href^="tel:"]')).toHaveText("+54 9 341 777 8888");
    await expect(tarjeta.$('a[href^="tel:"]')).toHaveAttribute("href", "tel:+5493417778888");
  });

  it("AC19: la ficha señala el teléfono de antes y lo corrige con el país del negocio", async () => {
    await entrar("/clientes/{c5}");
    await expect($("[data-telefono-incompleto]")).toHaveText(expect.stringContaining("le falta el código de país"));
    await $("button*=Corregir el teléfono").click();
    await expect($("#telefono-pais")).toHaveValue("AR");
    await expect($("#telefono")).toHaveValue("341 555 4444");
    await $("button*=Guardar el teléfono").click();
    await verTexto("ahora es +54 9 341 555 4444");
    await expect($("[data-telefono-incompleto]")).not.toExist();

    // Y no vuelve al recargar: la API lo guardó en internacional.
    await browser.refresh();
    await expect($("h1")).toHaveText("Hugo Teléfono Viejo");
    await expect($("[data-telefono-incompleto]")).not.toExist();
  });

  it("AC17: los demás clientes se ven con el código separado", async () => {
    await entrar("/clientes");
    await expect($("li*=Marcela Suárez")).toBeDisplayed();
    const legibles = await $$('main a[href^="tel:+"]').map((a) => a.getText());
    expect(legibles.length).toBeGreaterThan(0);
    for (const texto of legibles) expect(texto).toMatch(/^\+\d+ /);
  });
});
