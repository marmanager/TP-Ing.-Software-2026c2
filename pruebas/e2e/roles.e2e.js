import { $, expect } from "@wdio/globals";
import { entrar } from "./historias/ayudas.js";

// Crear un rol y ver que existe con sus permisos. Requiere la API y la base
// con las migraciones 053 a 056.
describe("roles", () => {
  it("la dueña crea un rol con un permiso y lo ve en la lista", async () => {
    await entrar("/negocio/roles");

    await $("a=Crear un rol").click();
    await $("#nombre-del-rol").setValue("Caja");
    await $('button[role="switch"]*=Cobrar').click();
    await $("button*=Guardar el rol").click();

    await expect($("span=Caja")).toBeDisplayed();
    await expect($("span*=1 permiso")).toBeDisplayed();
  });
});
