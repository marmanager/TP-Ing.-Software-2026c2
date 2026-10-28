import { $, expect } from "@wdio/globals";
import { entrar, tid } from "./historias/ayudas.js";

// Crear un rol y ver que existe con sus permisos. Requiere la API y la base
// con las migraciones 057 a 060.
describe("roles", () => {
  it("la dueña crea un rol con un permiso y lo ve en la lista", async () => {
    await entrar("/negocio/roles");

    await tid("roles-crear").click();
    await $("#nombre-del-rol").setValue("Caja");
    await tid("rol-permiso-cobrar").click();
    await tid("rol-guardar").click();

    await expect($("span=Caja")).toBeDisplayed();
    await expect($("span*=1 permiso")).toBeDisplayed();
  });
});
