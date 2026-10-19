// Correr con: npm run test:unit
//
// Historia: sumar gente al equipo con un link (docs/equipo-por-link.md).
// La base decide quién puede (puede_en); esto es lo que el front necesita para
// no ofrecer lo que la base va a rechazar, y el mensaje que va a WhatsApp.

import { describe, expect, test } from "@jest/globals";
import { puede, queCambiaConElRol } from "../../src/lib/permisos.js";
import { linkDeInvitacion, mensajeDeInvitacion } from "../../src/lib/equipo.js";

describe("Historia: Sumar gente al equipo con un link", () => {
  test("sumar gente al equipo lo hace quien tiene el permiso, y el dueño siempre", () => {
    expect(puede({ es_duenio: true, permisos: [] }, "sumar_al_equipo")).toBe(true);
    expect(puede({ es_duenio: false, permisos: ["sumar_al_equipo"] }, "sumar_al_equipo")).toBe(true);
    expect(puede({ es_duenio: false, permisos: ["cobrar"] }, "sumar_al_equipo")).toBe(false);
  });

  test("pasar de un rol sin el permiso a uno que lo tiene dice que gana sumar gente", () => {
    const { gana } = queCambiaConElRol(
      { es_duenio: false, permisos: [] },
      { es_duenio: false, permisos: ["sumar_al_equipo"] }
    );
    expect(gana.some((t) => /link de ingreso/.test(t))).toBe(true);
  });

  test("el link y el mensaje para el grupo de WhatsApp", () => {
    const link = linkDeInvitacion("abc123", "https://ejemplo.test");
    expect(link).toBe("https://ejemplo.test/unirme/abc123");
    expect(mensajeDeInvitacion("Taller Sur", link)).toBe(
      "Sumate al equipo de Taller Sur en MarManager: https://ejemplo.test/unirme/abc123"
    );
  });
});
