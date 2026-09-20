import { $, browser, expect } from "@wdio/globals";

describe("modo de ejemplo", () => {
  it("permite entrar y abrir el formulario de un caso nuevo", async () => {
    await browser.url("/iniciar-sesion");

    const entrarDemo = await $("button=Entrar con los datos de ejemplo");
    await entrarDemo.click();

    await expect($("h1=Inicio")).toBeDisplayed();
    const abrirCaso = await $("*=Abrir un caso nuevo");
    await expect(abrirCaso).toBeDisplayed();

    await abrirCaso.click();
    await expect(browser).toHaveUrl(expect.stringContaining("/casos/nuevo"));
    await expect($("h1")).toBeDisplayed();
  });
});
