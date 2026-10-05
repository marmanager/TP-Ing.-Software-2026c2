import { $, $$, browser, expect } from "@wdio/globals";
import { entrarConDatosDePrueba, reemplazarTexto, verTexto } from "./ayudas.js";

describe("Historia: Marcar consulta completada", () => {
  beforeEach(async () => {
    await entrarConDatosDePrueba("/casos/k239");
    await expect($("h1")).toHaveText(expect.stringContaining("Caso 239"));
  });

  async function entregar(monto = "120000") {
    await $("button=Entregar y cerrar").click();
    // El monto arranca como confirmación de lo aprobado (b86a1cb); escribirlo
    // a mano pide un toque más.
    await $("button=Cobré otra cosa").click();
    await reemplazarTexto("#cobro", monto);
    await $("button=Sí, entregar y cerrar").click();
  }

  it("AC1: permite entregar y cerrar una consulta abierta", async () => {
    await entregar();
    await verTexto("El caso está cerrado");
    await expect($("p=Entregaron el trabajo")).toBeDisplayed();
  });

  it("AC2: registra el cobro y conserva el cierre al recargar", async () => {
    await entregar("125000");
    await browser.refresh();
    await verTexto("$125.000");
    await verTexto("El caso está cerrado");
  });

  it("AC3: no duplica la acción y permite corregir un cierre accidental", async () => {
    await entregar();
    await expect($("button=Entregar y cerrar")).not.toExist();
    await expect(await $$("p=Entregaron el trabajo")).toBeElementsArrayOfSize(1);
    await $("button=Volver a abrirlo").click();
    await expect($("p=Volvieron a abrir el caso")).toBeDisplayed();
  });
});
