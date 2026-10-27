import { $, browser, expect } from "@wdio/globals";
import { empezarElMesGratis, entrar } from "./historias/ayudas.js";

// Antes era "modo de ejemplo": entrar sin cuenta y crear un negocio en el
// navegador. Ese modo se fue; lo que sigue valiendo es que una cuenta recién
// hecha, sin negocio, lo crea y puede abrir su primer caso.
describe("crear el negocio", () => {
  it("una cuenta sin negocio lo crea y llega a abrir un caso", async () => {
    await entrar("/", "sin-negocio");

    await expect(browser).toHaveUrl(expect.stringContaining("/crear-negocio"));
    await expect($("h1=Crear tu negocio")).toBeDisplayed();
    await $("#nombre").setValue("Taller de prueba");
    await $("button*=Taller mecánico").click();
    await $("button=Crear el negocio").click();
    await empezarElMesGratis();

    await expect($("h1=Inicio")).toBeDisplayed();
    const abrirCaso = await $("*=Abrir un caso nuevo");
    await expect(abrirCaso).toBeDisplayed();

    await abrirCaso.click();
    await expect(browser).toHaveUrl(expect.stringContaining("/casos/nuevo"));
    await expect($("h1")).toBeDisplayed();
  });
});
