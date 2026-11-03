// Las secciones 04 (módulos) y 05 (Remi) de la bienvenida
// (docs/bienvenida-modulos-y-remi.md). Es una pantalla pública: no siembra
// nada ni entra con una cuenta.

import { browser, $, expect } from "@wdio/globals";

describe("Bienvenida: los módulos y Remi", () => {
  beforeEach(async () => {
    await browser.url("/bienvenida");
  });

  it("elegir un módulo muestra su pantalla de ejemplo", async () => {
    const agenda = $("#modulo-agenda");
    const inventario = $("#modulo-inventario");
    await expect(agenda).toHaveAttribute("aria-selected", "true");

    await inventario.scrollIntoView({ block: "center" });
    await inventario.click();

    await expect(inventario).toHaveAttribute("aria-selected", "true");
    await expect(agenda).toHaveAttribute("aria-selected", "false");
    await expect($("#modulo-pantalla")).toHaveText(expect.stringContaining("Pastillas de freno"));
  });

  it("las flechas del teclado recorren los módulos y dan la vuelta", async () => {
    const agenda = $("#modulo-agenda");
    await agenda.scrollIntoView({ block: "center" });
    await agenda.click();

    await browser.keys("ArrowUp");
    await expect($("#modulo-dashboard")).toHaveAttribute("aria-selected", "true");
    await expect($("#modulo-dashboard")).toBeFocused();

    await browser.keys("Home");
    await expect(agenda).toHaveAttribute("aria-selected", "true");
  });

  it("la charla de Remi se puede pausar y seguir", async () => {
    const boton = $("button=Pausar");
    await boton.scrollIntoView({ block: "center" });
    await boton.click();
    await expect($("button=Seguir")).toBeDisplayed();
    await $("button=Seguir").click();
    await expect($("button=Pausar")).toBeDisplayed();
  });
});
