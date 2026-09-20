import { $, browser, expect } from "@wdio/globals";
import { entrarConDatosDePrueba, noVerTexto, verTexto } from "./ayudas.js";

describe("Historia: Cambiar el estado desde el detalle del caso", () => {
  beforeEach(async () => {
    await entrarConDatosDePrueba("/casos/k248");
  });

  it("AC1: el estado actual abre un selector con los otros estados abiertos", async () => {
    const selector = await $('[aria-label="El caso está en «Esperando». Tocá para cambiarlo."]');
    await expect(selector).toHaveAttribute("aria-expanded", "false");
    await selector.click();
    await expect(selector).toHaveAttribute("aria-expanded", "true");

    await expect($('[aria-label="Marcar el caso como Turno anotado"]')).toBeDisplayed();
    await expect($('[aria-label="Marcar el caso como Está en el taller"]')).toBeDisplayed();
    await expect($('[aria-label="Marcar el caso como Control final"]')).toBeDisplayed();
    await expect($('[aria-label="Marcar el caso como Entregado"]')).not.toExist();
  });

  it("AC2: cambiar el estado actualiza la ficha, el historial y persiste", async () => {
    await $('[aria-label="El caso está en «Esperando». Tocá para cambiarlo."]').click();
    await $('[aria-label="Marcar el caso como Está en el taller"]').click();

    await expect(
      $('[aria-label="El caso está en «Está en el taller». Tocá para cambiarlo."]')
    ).toBeDisplayed();
    await verTexto("Se puso a trabajar");

    await browser.refresh();
    await expect(
      $('[aria-label="El caso está en «Está en el taller». Tocá para cambiarlo."]')
    ).toBeDisplayed();
  });

  it("AC3: entregar no aparece en el selector y conserva su flujo de cobro", async () => {
    await $('[aria-label="El caso está en «Esperando». Tocá para cambiarlo."]').click();
    await expect($('[aria-label="Marcar el caso como Entregado"]')).not.toExist();

    await $("button=Entregar y cerrar").click();
    await expect($("#cobro")).toBeDisplayed();
    await verTexto("¿Cuánto cobraste?");
    await noVerTexto("Pasar el caso a");
  });
});
