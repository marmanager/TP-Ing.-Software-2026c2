import { $, $$, browser, expect } from "@wdio/globals";
import { entrarConDatosDePrueba, verTexto } from "./ayudas.js";

describe("Historia: Marcar consulta completada", () => {
  beforeEach(async () => {
    await entrarConDatosDePrueba("/casos/k239");
    await expect($("h1")).toHaveText(expect.stringContaining("Caso 239"));
  });

  async function entregar(monto = "120000") {
    await $("button=Entregar y cerrar").click();
    await $("#cobro").setValue(monto);
    const botones = await $$("button=Entregar y cerrar");
    await botones[botones.length - 1].click();
  }

  it("AC1: permite entregar y cerrar una consulta abierta", async () => {
    await entregar();
    await verTexto("Este caso ya se entregó y se cerró");
    await expect($("p=Entregaron el trabajo")).toBeDisplayed();
  });

  it("AC2: registra el cobro y conserva el cierre al recargar", async () => {
    await entregar("125000");
    await browser.refresh();
    await verTexto("$125.000");
    await verTexto("Este caso ya se entregó y se cerró");
  });

  it("AC3: no duplica la acción y permite corregir un cierre accidental", async () => {
    await entregar();
    await expect($("button=Entregar y cerrar")).not.toExist();
    await expect(await $$("p=Entregaron el trabajo")).toBeElementsArrayOfSize(1);
    await $("button=Volver a abrirlo").click();
    await expect($("p=Volvieron a abrir el caso")).toBeDisplayed();
  });
});
