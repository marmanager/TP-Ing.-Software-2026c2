import { $, browser, expect } from "@wdio/globals";
import { cargarArchivoEnInput, entrar, verTexto } from "./ayudas.js";

// Hay dos fotos: la de la ficha del negocio (SCRUM-30), que se prueba acá, y
// la personal de cada usuario (SCRUM-118, en Mi perfil). Los dos criterios de
// la personal siguen salteados: ahora las e2e entran con una cuenta sembrada,
// así que se pueden escribir. Los hace cumplir la base: guardar pasa por
// guardar_mi_perfil() (034) y editar la foto de otro lo impide la política
// usuario_edita_lo_suyo (005).
describe("Historia: Foto del negocio y foto personal", () => {
  beforeEach(async () => {
    await entrar("/negocio");
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

  it.skip("[INTEGRACIÓN SUPABASE] guarda una foto personal para cada usuario", async () => {});
  it.skip("[INTEGRACIÓN SUPABASE] impide editar la foto personal de otro usuario", async () => {});
});
