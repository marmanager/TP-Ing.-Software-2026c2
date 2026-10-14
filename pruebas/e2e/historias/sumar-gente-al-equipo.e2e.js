import { $, browser, expect } from "@wdio/globals";
import { sembrar } from "../siembra.js";
import { iniciarCon, noVerTexto, verTexto } from "./ayudas.js";

// Sumar gente al equipo con un link (docs/equipo-por-link.md).
//
// Dos cuentas sembradas por la API: la dueña de Taller Sur ("taller-completo")
// y otra sin negocio ("sin-negocio"). Necesita la API con la 051 corrida.

describe("Historia: Sumar gente al equipo con un link", () => {
  let duenia;
  let otra;

  before(async () => {
    duenia = await sembrar("taller-completo");
    otra = await sembrar("sin-negocio");
  });

  it("AC: Equipo ya no ofrece sumar a alguien sin cuenta ni invitar con rol", async () => {
    await iniciarCon(duenia, "/equipo");
    await expect($("h1")).toHaveText(expect.stringContaining("Equipo"));
    await expect($("button=Sumar a alguien")).not.toBeExisting();
    await expect($("a=Invitar a que entre con su cuenta")).not.toBeExisting();
  });

  it("AC: la pantalla de invitaciones con rol ya no existe", async () => {
    await iniciarCon(duenia, "/equipo/invitaciones");
    await browser.waitUntil(async () => (await browser.getUrl()).endsWith("/equipo"), {
      timeoutMsg: "no redirigió a /equipo",
    });
  });

  it("AC: la dueña crea el link, otra cuenta pide entrar, la dueña la acepta y la cuenta entra", async () => {
    await iniciarCon(duenia, "/equipo");
    await $("button=Crear el link del equipo").click();
    const link = await $("[data-link-del-equipo]").getText();
    expect(link).toContain("/unirme/");

    await iniciarCon(otra, new URL(link).pathname);
    await $("button*=Pedir entrar").click();
    await verTexto("vas a poder entrar cuando te acepten");
    // Sin negocio, /negocios la manda a crear uno, y ahí también se ve el aviso.
    await iniciarCon(otra, "/negocios");
    await verTexto("Esperando que te acepten: Taller Sur");

    await iniciarCon(duenia, "/equipo");
    await verTexto("Quieren entrar (1)");
    await $("select[id^='rol-pedido-']").selectByAttribute("value", "encargado");
    await $("button=Aceptar").click();
    await verTexto("entró como encargado");

    // Ya con acceso, /negocios la manda directo al Inicio de Taller Sur (la 051
    // le deja ese negocio de predeterminado con Inicio rápido). Si el pedido
    // siguiera pendiente, la mandaría a /crear-negocio.
    await iniciarCon(otra, "/negocios");
    await browser.waitUntil(async () => new URL(await browser.getUrl()).pathname === "/", {
      timeoutMsg: "no entró al Inicio del negocio",
    });
    await expect($("h1")).toHaveText("Inicio");
    await noVerTexto("Esperando que te acepten");
    await verTexto("Taller Sur");
  });

  it("AC: cambiar el link deja sin efecto el anterior", async () => {
    await iniciarCon(duenia, "/equipo");
    const viejo = await $("[data-link-del-equipo]").getText();
    await $("button=Cambiar el link").click();
    await $("button=Sí, cambiarlo").click();
    await verTexto("El link anterior ya no sirve");
    const tercera = await sembrar("sin-negocio");
    await iniciarCon(tercera, new URL(viejo).pathname);
    await verTexto("Quien te invitó dio de baja este link.");
  });
});
