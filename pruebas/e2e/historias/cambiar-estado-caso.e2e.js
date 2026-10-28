import { $, browser, expect } from "@wdio/globals";
import { entrar, noVerTexto, tid, verTexto } from "./ayudas.js";

describe("Historia: Cambiar el estado desde el detalle del caso", () => {
  beforeEach(async () => {
    await entrar("/casos/{k248}");
  });

  it("AC1: el estado actual abre un selector con los otros estados abiertos", async () => {
    const selector = tid("caso-estado");
    await expect(selector).toHaveAttribute("data-estado", "esperando");
    await expect(selector).toHaveAttribute("aria-expanded", "false");
    await selector.click();
    await expect(selector).toHaveAttribute("aria-expanded", "true");

    await expect(tid("caso-estado-opcion-nuevo")).toBeDisplayed();
    await expect(tid("caso-estado-opcion-en_proceso")).toBeDisplayed();
    await expect(tid("caso-estado-opcion-revision_final")).toBeDisplayed();
    await expect(tid("caso-estado-opcion-completado")).not.toExist();
  });

  it("AC2: cambiar el estado actualiza la ficha, el historial y persiste", async () => {
    await tid("caso-estado").click();
    await tid("caso-estado-opcion-en_proceso").click();

    await expect(tid("caso-estado")).toHaveAttribute("data-estado", "en_proceso");
    await verTexto("Se puso a trabajar");

    await browser.refresh();
    await expect(tid("caso-estado")).toHaveAttribute("data-estado", "en_proceso");
  });

  it("AC3: entregar no aparece en el selector y conserva su flujo de cobro", async () => {
    await tid("caso-estado").click();
    await expect(tid("caso-estado-opcion-completado")).not.toExist();

    await $("button=Entregar y cerrar").click();
    await verTexto("Vas a anotar que cobraste");
    await $("button=Cobré otra cosa").click();
    await expect($("#cobro")).toBeDisplayed();
    await verTexto("¿Cuánto cobraste?");
    await noVerTexto("Pasar el caso a");
  });
});
