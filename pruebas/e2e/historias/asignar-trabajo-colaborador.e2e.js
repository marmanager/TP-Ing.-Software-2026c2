import { $, $$, browser, expect } from "@wdio/globals";
import { entrarConDatosDePrueba, verTexto } from "./ayudas.js";

describe("Historia: Asignar trabajo a colaborador", () => {
  beforeEach(async () => {
    await entrarConDatosDePrueba("/casos/k253");
    await expect($("h1")).toHaveText(expect.stringContaining("Caso 253"));
  });

  it("AC1: permite elegir un colaborador y lo muestra como responsable", async () => {
    await $("button=Asignar").click();
    await $("button=Diego").click();
    await verTexto("Lo tiene Diego");
  });

  it("AC2: conserva la asignación después de recargar", async () => {
    await $("button=Asignar").click();
    await $("button=Nico").click();
    await browser.refresh();
    await verTexto("Lo tiene Nico");
  });

  it("AC3: registra una sola asignación con el nombre en el historial", async () => {
    await $("button=Asignar").click();
    await $("button=Sofía").click();
    await expect($("p=Asignaron el caso")).toBeDisplayed();
    await expect($("p=Lo va a atender Sofía.")).toBeDisplayed();
    await expect(await $$("p=Asignaron el caso")).toBeElementsArrayOfSize(1);
  });

  it("AC4: permite reasignar un trabajo ya iniciado", async () => {
    await $("button=Asignar").click();
    await $("button=Diego").click();
    await verTexto("Lo tiene Diego");

    await $("button=Cambiar").click();
    await $("button=Nico").click();
    await verTexto("Lo tiene Nico");

    await browser.refresh();
    await verTexto("Lo tiene Nico");
  });

  it.skip("[NO IMPLEMENTADA] excluye colaboradores inactivos", async () => {});
  it.skip("[INTEGRACIÓN SUPABASE] impide asignar personas de otro negocio", async () => {});
});
