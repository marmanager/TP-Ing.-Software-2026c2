import { $, $$, browser, expect } from "@wdio/globals";
import { entrar, verTexto } from "./ayudas.js";

// SCRUM-196 a 199: el editor de la landing (docs/landing-por-negocio.md).
// Entra como dueño de un negocio sembrado, cambia, guarda y comprueba que
// quedó después de refrescar. La vista previa se lee por el style de
// [data-lienzo], que es lo que pinta.

// Un <input type="color"> no se escribe: se le pone el valor como lo haría
// el selector del navegador, y se avisa a React con el evento input.
async function elegirColor(etiqueta, valor) {
  await browser.execute(
    (etiqueta, valor) => {
      const input = document.querySelector(`input[aria-label="${etiqueta}"]`);
      const poner = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      poner.call(input, valor);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    etiqueta,
    valor
  );
}

const estiloDeLaVistaPrevia = () => $("[data-lienzo]").getAttribute("style");

async function primeraSeccion() {
  const titulos = await $$("[data-orden] li h3");
  return titulos[0].getText();
}

describe("Historia: El dueño arma la landing de su negocio", () => {
  beforeEach(async () => {
    await entrar("/negocio/landing");
    await expect($("h1=Tu landing")).toBeDisplayed();
  });

  it("SCRUM-196: se llega desde Mi negocio", async () => {
    await browser.url("/negocio");
    await $("a=Armar tu landing").click();
    await expect($("h1=Tu landing")).toBeDisplayed();
  });

  it("SCRUM-197: cambia el orden de las secciones y queda guardado", async () => {
    expect(await primeraSeccion()).toBe("El negocio");
    await $('button[aria-label="Bajar El negocio"]').click();
    expect(await primeraSeccion()).toBe("Sacar turno");
    await $("button=Guardar").click();
    await verTexto("Tu landing quedó guardada");
    await browser.refresh();
    await expect($("h1=Tu landing")).toBeDisplayed();
    expect(await primeraSeccion()).toBe("Sacar turno");
  });

  it("SCRUM-198: elige los colores, la vista previa los muestra y quedan guardados", async () => {
    await elegirColor("Color de Fondo", "#112233");
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #112233");
    // El texto del fondo pasa solo al recomendado: sobre azul oscuro, blanco.
    expect(await estiloDeLaVistaPrevia()).toContain("--color-tinta: #ffffff");
    await $("button=Guardar").click();
    await verTexto("Tu landing quedó guardada");
    await browser.refresh();
    await expect($("[data-lienzo]")).toBeDisplayed();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #112233");
  });

  it("SCRUM-198: avisa cuando el texto elegido no se lee", async () => {
    await elegirColor("Color de Botones", "#ffd400");
    await elegirColor("Texto de Botones", "#ffffff");
    await verTexto("Con este texto cuesta leer");
  });

  it("SCRUM-198: elige la fuente y queda guardada", async () => {
    await $("label=Lora").click();
    expect(await estiloDeLaVistaPrevia()).toContain("--font-titulo: var(--fuente-landing)");
    await $("button=Guardar").click();
    await verTexto("Tu landing quedó guardada");
    await browser.refresh();
    await expect($("[data-lienzo]")).toBeDisplayed();
    expect(await estiloDeLaVistaPrevia()).toContain("--font-titulo: var(--fuente-landing)");
  });

  it("SCRUM-199: vuelve a la de fábrica", async () => {
    await elegirColor("Color de Fondo", "#112233");
    await $("button=Guardar").click();
    await verTexto("Tu landing quedó guardada");
    await $("button=Volver a la de fábrica").click();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #fbf8f4");
    await $("button=Guardar").click();
    // El aviso del primer guardado sigue en pantalla (no se va solo), así que
    // verTexto no esperaría nada. Guardar vuelve a decir "no cambiaste nada"
    // recién cuando la API contestó; refrescar antes puede cortar el guardado.
    await expect($("button*=no cambiaste nada")).toBeDisplayed();
    await browser.refresh();
    await expect($("[data-lienzo]")).toBeDisplayed();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #fbf8f4");
  });
});
