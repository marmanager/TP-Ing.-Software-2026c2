import { $, expect } from "@wdio/globals";
import { entrar, reemplazarTexto, verTexto } from "./ayudas.js";

const boton = (texto) => $(`button=${texto}`);

async function agregarVariable(nombre) {
  await $("//h2[normalize-space()='Variables y constantes']/following::button[normalize-space()='Agregar'][1]").click();
  await reemplazarTexto("#variable-nombre", nombre);
  await boton("Guardar variable").click();
}

async function completar(nombre, valor) {
  const etiqueta = await $(`//label[contains(normalize-space(), '${nombre}')]`);
  await $(`#${await etiqueta.getAttribute("for")}`).setValue(valor);
}

describe("ecuaciones encadenadas", () => {
  it("crea una base, la utiliza y resuelve el resultado final", async () => {
    await entrar("/ecuaciones", "taller-sin-casos");

    await boton("Crear una ecuación").click();
    await reemplazarTexto("#ecuacion-nombre", "IMC");
    await reemplazarTexto("#ecuacion-formula", "peso/altura^2");
    await agregarVariable("peso");
    await agregarVariable("altura");
    await boton("Guardar ecuación").click();
    await verTexto("IMC");

    await boton("Crear una ecuación").click();
    await reemplazarTexto("#ecuacion-nombre", "Nivel de riesgo");
    await $("select[aria-label='Ecuación para utilizar']").selectByVisibleText("IMC");
    await $("//h2[normalize-space()='Ecuaciones calculadas']/following::button[normalize-space()='Agregar'][1]").click();
    await reemplazarTexto("#ecuacion-formula", "imc*factor");
    await agregarVariable("factor");
    await boton("Guardar ecuación").click();

    await $("//li[.//*[contains(text(),'Nivel de riesgo')]]//button[normalize-space()='Resolver']").click();
    await completar("peso", "80");
    await completar("altura", "2");
    await completar("factor", "1.5");
    await boton("Calcular").click();

    await expect($("body")).toHaveText(expect.stringContaining("Resultado"));
    await expect($("body")).toHaveText(expect.stringContaining("30"));
    await expect($("body")).toHaveText(expect.stringContaining("Resultados intermedios"));
    await expect($("body")).toHaveText(expect.stringContaining("IMC: 20"));
  });
});
