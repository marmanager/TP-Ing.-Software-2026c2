import { $, $$, browser, expect } from "@wdio/globals";
import { entrar, tid, verTexto } from "./ayudas.js";

// SCRUM-196 a 199: el editor de la landing (docs/landing-por-negocio.md).
// Entra como dueño de un negocio sembrado, cambia, guarda y comprueba que
// quedó después de refrescar. La vista previa se lee por el style de
// [data-lienzo], que es lo que pinta.

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
    await tid("negocio-landing-armar").click();
    await expect($("h1=Tu landing")).toBeDisplayed();
  });

  it("SCRUM-197: cambia el orden de las secciones y queda guardado", async () => {
    expect(await primeraSeccion()).toBe("El negocio");
    await tid("landing-seccion-bajar-negocio").click();
    expect(await primeraSeccion()).toBe("Sacar turno");
    // Quien usa el teclado sigue en el mismo botón después de mover.
    expect(
      await browser.execute(() => document.activeElement?.getAttribute("aria-label"))
    ).toBe("Bajar El negocio");
    await tid("landing-guardar").click();
    await verTexto("Tu landing quedó guardada");
    await browser.refresh();
    await expect($("h1=Tu landing")).toBeDisplayed();
    expect(await primeraSeccion()).toBe("Sacar turno");
  });

  it("SCRUM-198: elige los colores, la vista previa los muestra y quedan guardados", async () => {
    await tid("landing-color-fondo-noche").click();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #1b2a41");
    // El texto del fondo pasa solo al recomendado: sobre azul oscuro, blanco.
    expect(await estiloDeLaVistaPrevia()).toContain("--color-tinta: #ffffff");
    await tid("landing-guardar").click();
    await verTexto("Tu landing quedó guardada");
    await browser.refresh();
    await expect($("[data-lienzo]")).toBeDisplayed();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #1b2a41");
  });

  it("SCRUM-198: avisa cuando los links no se leen sobre las cajas", async () => {
    await tid("landing-color-cajas-carbon").click();
    await tid("landing-color-botones-grafito").click();
    await verTexto("sobre las cajas cuesta leerlos");
  });

  it("SCRUM-198: elige la fuente y queda guardada", async () => {
    await tid("landing-fuente-lora").click();
    expect(await estiloDeLaVistaPrevia()).toContain("--font-titulo: var(--fuente-landing)");
    await tid("landing-guardar").click();
    await verTexto("Tu landing quedó guardada");
    await browser.refresh();
    await expect($("[data-lienzo]")).toBeDisplayed();
    expect(await estiloDeLaVistaPrevia()).toContain("--font-titulo: var(--fuente-landing)");
  });

  it("SCRUM-199: vuelve a la de fábrica", async () => {
    await tid("landing-color-fondo-noche").click();
    await tid("landing-guardar").click();
    await verTexto("Tu landing quedó guardada");
    await tid("landing-de-fabrica").click();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #fbf8f4");
    await tid("landing-guardar").click();
    // El aviso del primer guardado sigue en pantalla (no se va solo), así que
    // verTexto no esperaría nada. Guardar vuelve a decir "no cambiaste nada"
    // recién cuando la API contestó; refrescar antes puede cortar el guardado.
    await expect(tid("landing-guardar")).toHaveText(expect.stringContaining("no cambiaste nada"));
    await browser.refresh();
    await expect($("[data-lienzo]")).toBeDisplayed();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #fbf8f4");
  });

  it("SCRUM-196: publica el link de la landing y lo deja de compartir", async () => {
    await tid("link-armar").click();
    // El link nace en el navegador (origen + /n/<código>): toHaveValue espera
    // a que el campo se llene en vez de leerlo vacío.
    await expect($("#link-landing")).toHaveValue(expect.stringContaining("/n/"));
    await tid("link-dejar").click();
    await tid("link-dejar-confirmar").click();
    // Sin link, vuelve el botón de publicar.
    await expect(tid("link-armar")).toBeDisplayed();
  });
});
