import { $, browser, expect } from "@wdio/globals";
import { entrar, reemplazarTexto, tid, verTexto } from "./ayudas.js";


async function agregarVariable(nombre) {
  await tid("ecuacion-variable-agregar").click();
  await reemplazarTexto("#variable-nombre", nombre);
  await tid("ecuacion-variable-guardar").click();
}

async function completar(nombre, valor) {
  const etiqueta = await $(`//label[contains(normalize-space(), '${nombre}')]`);
  await $(`#${await etiqueta.getAttribute("for")}`).setValue(valor);
}

describe("ecuaciones encadenadas", () => {
  it("crea una base, la utiliza y resuelve el resultado final", async () => {
    // El taller sembrado no trae el módulo: se prende como lo haría la dueña.
    await entrar("/negocio/modulos", "taller-sin-casos");
    await tid("modulo-alternar-ecuaciones").click();
    await expect(tid("modulo-alternar-ecuaciones")).toHaveAttribute("aria-pressed", "true");
    await browser.url("/ecuaciones");

    await tid("ecuaciones-crear").click();
    await reemplazarTexto("#ecuacion-nombre", "IMC");
    await reemplazarTexto("#ecuacion-formula", "peso/altura^2");
    await agregarVariable("peso");
    await agregarVariable("altura");
    await tid("ecuacion-guardar").click();
    await verTexto("IMC");

    await tid("ecuaciones-crear").click();
    await reemplazarTexto("#ecuacion-nombre", "Nivel de riesgo");
    await tid("ecuacion-dependencia-select").selectByVisibleText("IMC");
    await tid("ecuacion-dependencia-agregar").click();
    await reemplazarTexto("#ecuacion-formula", "imc*");
    await tid("ecuacion-heredada-insertar-IMC-peso").click();
    await tid("ecuacion-guardar").click();

    await tid("ecuacion-resolver-Nivel de riesgo").click();
    await completar("peso", "80");
    await completar("altura", "2");
    await tid("ecuacion-calcular").click();

    await expect($("body")).toHaveText(expect.stringContaining("Resultado"));
    await expect($("body")).toHaveText(expect.stringContaining("1.600"));
    await expect($("body")).toHaveText(expect.stringContaining("Resultados intermedios"));
    await expect($("body")).toHaveText(expect.stringContaining("IMC: 20"));
  });
});
