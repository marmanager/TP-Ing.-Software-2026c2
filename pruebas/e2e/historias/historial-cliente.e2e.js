import { $, $$, expect } from "@wdio/globals";
import { entrarConDatosDePrueba, noVerTexto, verTexto } from "./ayudas.js";

describe("Historia: Ver historial completo del cliente", () => {
  it("AC1: busca por nombre o teléfono y abre la ficha", async () => {
    await entrarConDatosDePrueba("/clientes");
    await $("#buscar-cliente").setValue("456 7890");
    await expect($("a=Marcela Suárez")).toBeDisplayed();
    await $("a=Marcela Suárez").click();
    await expect($("h1=Marcela Suárez")).toBeDisplayed();
  });

  it("AC2: lista todos sus trabajos, del más nuevo al más viejo", async () => {
    await entrarConDatosDePrueba("/clientes/c1");
    const casos = await $$("ul a[href^='/casos/']");
    await expect(casos).toBeElementsArrayOfSize(3);
    await expect(casos[0]).toHaveText(expect.stringContaining("Caso 248"));
    await expect(casos[2]).toHaveText(expect.stringContaining("Caso 210"));
  });

  it("AC3: muestra fecha, estado, servicio y cobro registrado", async () => {
    await entrarConDatosDePrueba("/clientes/c1");
    await verTexto("Revisión general");
    await verTexto("Reparación de motor");
    await verTexto("Cobrado $50.000");
  });

  it("AC4: no mezcla trabajos de otros clientes", async () => {
    await entrarConDatosDePrueba("/clientes/c1");
    await noVerTexto("Caso 253");
    await noVerTexto("Lucía Ferreyra");
  });

  it("AC5: presenta un estado vacío si el cliente no tiene antecedentes", async () => {
    await entrarConDatosDePrueba("/clientes/c3");
    await verTexto("Todavía no hay casos");
  });
});
