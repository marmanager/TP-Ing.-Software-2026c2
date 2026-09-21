import { $, browser, expect } from "@wdio/globals";
import { cargarArchivoEnInput, entrarConDatosDePrueba, verTexto } from "./ayudas.js";

// Lo implementado es la foto de la ficha del negocio. Si Jira se refiere a
// la foto personal de cada usuario, esa funcionalidad continúa ausente.
describe("Historia parcial: Foto del perfil del negocio", () => {
  beforeEach(async () => {
    await entrarConDatosDePrueba("/negocio");
    await $("button=Editar").click();
  });

  it("AC existente: acepta, previsualiza y guarda una imagen PNG", async () => {
    await $('[aria-label="Cambiar la foto del negocio"]').click();
    await cargarArchivoEnInput({
      nombre: "negocio.png",
      tipo: "image/png",
      contenido: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    });
    await browser.waitUntil(async () => (await $("img").isExisting()), {
      timeoutMsg: "La imagen no apareció en la previsualización",
    });
    await $("button=Guardar").click();
    await expect($("img")).toBeDisplayed();
    await browser.refresh();
    await expect($("img")).toBeDisplayed();
  });

  it("AC existente: rechaza un archivo que no es imagen", async () => {
    await $('[aria-label="Cambiar la foto del negocio"]').click();
    await cargarArchivoEnInput({ nombre: "notas.txt", tipo: "text/plain", contenido: "bm8gZXMgdW5hIGltYWdlbg==" });
    await verTexto("Ese archivo no es una imagen");
  });

  it.skip("[NO IMPLEMENTADA] guarda una foto personal para cada usuario", async () => {});
  it.skip("[NO IMPLEMENTADA] impide editar la foto personal de otro usuario", async () => {});
});
