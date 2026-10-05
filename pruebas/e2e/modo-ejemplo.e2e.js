import { $, browser, expect } from "@wdio/globals";

describe("modo de ejemplo", () => {
  it("permite entrar y abrir el formulario de un caso nuevo", async () => {
    await browser.url("/iniciar-sesion");

    await $("button=Probá sin cuenta").click();

    // El modo de ejemplo arranca vacío (01dab40): primero se crea el negocio.
    await expect(browser).toHaveUrl(expect.stringContaining("/crear-negocio"));
    await expect($("h1=Crear tu negocio")).toBeDisplayed();
    await $("#nombre").setValue("Taller de prueba");
    await $("button*=Taller mecánico").click();
    await $("button=Crear el negocio").click();

    await expect($("h1=Inicio")).toBeDisplayed();
    const abrirCaso = await $("*=Abrir un caso nuevo");
    await expect(abrirCaso).toBeDisplayed();

    await abrirCaso.click();
    await expect(browser).toHaveUrl(expect.stringContaining("/casos/nuevo"));
    await expect($("h1")).toBeDisplayed();
  });
});
