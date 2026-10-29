import { $, expect } from "@wdio/globals";
import { entrar } from "./historias/ayudas.js";

// La copia de seguridad (docs/copia-de-seguridad.md): activar la copia
// automática, hacer una copia, restablecerla y ver que quedó la de antes de
// restablecer. Requiere la API (/v1/copias) y la base con las migraciones 071 a 073.
describe("copia de seguridad", () => {
  it("la dueña activa la copia automática, hace una copia y la restablece", async () => {
    await entrar("/negocio/copia-de-seguridad");

    await $('button[role="switch"]*=Copia automática').click();
    await $("button=Guardar").click();
    await expect($("p=Configuración guardada.")).toBeDisplayed();

    await $("button=Hacer una copia ahora").click();
    await expect($("span=A mano")).toBeDisplayed();

    // Pide confirmar y dice qué se pierde antes de tocar nada.
    await $("button=Restablecer").click();
    await expect($("li*=Se pierde todo lo hecho después de esa copia")).toBeDisplayed();
    await $("button=Sí, restablecer").click();
    await expect($("p*=Copia restablecida")).toBeDisplayed();

    // La pantalla se recarga y la copia de antes de restablecer ya está en la lista.
    await expect($("span=Antes de restablecer")).toBeDisplayed();
  });
});
