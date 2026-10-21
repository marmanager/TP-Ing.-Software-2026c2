// El idioma se elige por cookie y la dirección no cambia (docs/idiomas.md).

import { browser, $, expect } from "@wdio/globals";

describe("Idioma", () => {
  afterEach(async () => {
    await browser.deleteCookies(["idioma"]);
  });

  it("sin cookie, con Chrome en castellano, se ve en castellano", async () => {
    await browser.url("/iniciar-sesion");
    await expect($("html")).toHaveAttribute("lang", "es");
    await expect($("h1")).toHaveText("Iniciar sesión");
  });

  it("con la cookie en inglés se ve en inglés, en la misma dirección", async () => {
    await browser.url("/iniciar-sesion");
    await browser.setCookies({ name: "idioma", value: "en", path: "/" });
    await browser.refresh();
    await expect($("html")).toHaveAttribute("lang", "en");
    await expect($("h1")).toHaveText("Sign in");
    await expect(browser).toHaveUrl(expect.stringContaining("/iniciar-sesion"));
  });

  it("el selector cambia el idioma y lo recuerda", async () => {
    await browser.url("/iniciar-sesion");
    await $("button=English").click();
    await expect($("h1")).toHaveText("Sign in");
    await browser.refresh();
    await expect($("h1")).toHaveText("Sign in");
  });
});
