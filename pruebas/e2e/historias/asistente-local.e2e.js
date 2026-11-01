import { $, browser, expect } from "@wdio/globals";
import { entrar, noVerTexto, reemplazarTexto, tid, verTexto } from "./ayudas.js";

describe("asistencia local sin API de inteligencia artificial", () => {
  it("recomienda módulos y sólo los aplica después de confirmar", async () => {
    await entrar("/negocio/modulos", "taller-sin-casos");
    await expect(tid("modulo-alternar-ecuaciones")).toHaveAttribute("aria-checked", "false");

    await tid("asistente-modulos-abrir").click();
    await reemplazarTexto("#asistente-negocio", "Usamos fórmulas y cálculos para cada presupuesto");
    await tid("asistente-modulos-analizar").click();
    await verTexto("Ecuaciones personalizadas");
    await expect(tid("modulo-alternar-ecuaciones")).toHaveAttribute("aria-checked", "false");

    await tid("asistente-modulos-aplicar").click();
    await expect(tid("modulo-alternar-ecuaciones")).toHaveAttribute("aria-checked", "false");
    await tid("asistente-modulos-aplicar").click();
    await expect(tid("modulo-alternar-ecuaciones")).toHaveAttribute("aria-checked", "true");
  });

  it("completa el formulario del caso pero no lo guarda", async () => {
    await entrar("/casos/nuevo");
    await tid("asistente-alta-abrir").click();
    await reemplazarTexto("#asistente-caso-frase", "Vino Juan Pérez con un Corolla patente AB123CD por un ruido en los frenos.");
    await tid("asistente-alta-analizar").click();
    await tid("asistente-alta-usar").click();

    await expect($("#cliente")).toHaveValue("Juan Pérez");
    await expect($("#identificador")).toHaveValue("AB123CD");
    await expect($("#servicio")).toHaveValue("ruido en los frenos");
    await expect(browser).toHaveUrl(expect.stringContaining("/casos/nuevo"));
  });

  it("crea una ecuación desde palabras y la deja sin guardar en el editor", async () => {
    await entrar("/negocio/modulos", "taller-sin-casos");
    await tid("modulo-alternar-ecuaciones").click();
    await browser.url("/ecuaciones");

    await tid("asistente-ecuacion-abrir").click();
    await reemplazarTexto("#asistente-ecuacion", "Calcular metros cuadrados multiplicando ancho por alto");
    await tid("asistente-ecuacion-analizar").click();
    await tid("asistente-ecuacion-revisar").click();
    await expect($("#ecuacion-nombre")).toHaveValue("Superficie");
    await expect($("#ecuacion-formula")).toHaveValue("ancho * alto");

    await browser.refresh();
    await noVerTexto("ancho * alto");
  });
});

