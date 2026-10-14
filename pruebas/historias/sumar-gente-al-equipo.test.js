// Correr con: npm run test:unit
//
// Historia: sumar gente al equipo con un link (docs/equipo-por-link.md).
// La base decide quién puede (puede_en); esto es lo que el front necesita para
// no ofrecer lo que la base va a rechazar, y el mensaje que va a WhatsApp.

import { describe, expect, test } from "@jest/globals";
import { PERMISOS, puede, queCambiaConElRol, rolesQuePuedeDar } from "../../src/lib/permisos.js";
import { linkDeInvitacion, mensajeDeInvitacion } from "../../src/lib/equipo.js";

describe("Historia: Sumar gente al equipo con un link", () => {
  test("sumar gente al equipo lo hace sólo el dueño", () => {
    expect(puede("duenio", "sumarAlEquipo")).toBe(true);
    expect(puede("encargado", "sumarAlEquipo")).toBe(false);
    expect(puede("tecnico", "sumarAlEquipo")).toBe(false);
  });

  test("pasar de encargado a dueño dice que gana sumar gente", () => {
    const { gana } = queCambiaConElRol("encargado", "duenio");
    expect(gana.some((t) => /sumar gente/.test(t))).toBe(true);
  });

  test("nadie da un rol más alto que el suyo", () => {
    expect(rolesQuePuedeDar("duenio")).toEqual(["duenio", "encargado", "tecnico"]);
    expect(rolesQuePuedeDar("encargado")).toEqual(["encargado", "tecnico"]);
    expect(rolesQuePuedeDar("tecnico")).toEqual(["tecnico"]);
    expect(rolesQuePuedeDar("inventado")).toEqual([]);
  });

  test("el link y el mensaje para el grupo de WhatsApp", () => {
    const link = linkDeInvitacion("abc123", "https://ejemplo.test");
    expect(link).toBe("https://ejemplo.test/unirme/abc123");
    expect(mensajeDeInvitacion("Taller Sur", link)).toBe(
      "Sumate al equipo de Taller Sur en MarManager: https://ejemplo.test/unirme/abc123"
    );
  });

  test("cada rol define el permiso nuevo", () => {
    for (const rol of ["duenio", "encargado", "tecnico"]) {
      expect(typeof PERMISOS[rol].sumarAlEquipo).toBe("boolean");
    }
  });
});
