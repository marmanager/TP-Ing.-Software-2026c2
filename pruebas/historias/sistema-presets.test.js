import { describe, expect, test } from "@jest/globals";
import { MODULOS } from "../../src/lib/modulos.js";
import {
  ORDEN_ROLES,
  PRESETS,
  RUBROS,
  comoSeIdentifica,
  ejemplosDe,
  preset,
} from "../../src/lib/presets.js";
import { ORDEN_ESTADOS } from "../../src/lib/estados.js";

describe("Historia: Sistema de presets", () => {
  test("AC2: ofrece rubros variados y con claves únicas", () => {
    expect(RUBROS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(RUBROS.map((rubro) => rubro.clave)).size).toBe(RUBROS.length);
    expect(RUBROS.map((rubro) => rubro.clave)).toEqual(
      expect.arrayContaining(["taller", "medicina", "service"])
    );
  });

  test("AC3: cada rubro define módulos iniciales válidos", () => {
    for (const rubro of RUBROS) {
      expect(rubro.modulos.length).toBeGreaterThan(0);
      for (const modulo of rubro.modulos) expect(MODULOS[modulo]).toBeDefined();
    }
  });

  test("AC4: cada preset adapta estados, roles, ejemplos e identificador", () => {
    for (const rubro of RUBROS) {
      for (const estado of ORDEN_ESTADOS) {
        expect(rubro.etiquetas[estado]?.trim()).toBeTruthy();
      }
      for (const rol of ORDEN_ROLES) {
        expect(rubro.roles[rol]?.trim()).toBeTruthy();
      }

      const identificador = comoSeIdentifica(rubro.clave);
      expect(identificador.nombre.trim()).toBeTruthy();
      expect(identificador.enFrase.trim()).toBeTruthy();
      expect(identificador.ejemplo.trim()).toBeTruthy();

      for (const ejemplo of Object.values(ejemplosDe(rubro.clave))) {
        expect(ejemplo.trim()).toBeTruthy();
      }
    }
  });

  test("AC4: elegir otro rubro realmente cambia sus preferencias", () => {
    expect(preset("taller").etiquetas.en_proceso).not.toBe(
      preset("medicina").etiquetas.en_proceso
    );
    expect(preset("taller").roles.tecnico).not.toBe(preset("medicina").roles.tecnico);
    expect(comoSeIdentifica("taller").nombre).not.toBe(comoSeIdentifica("service").nombre);
    expect(PRESETS.taller.modulos).not.toEqual(PRESETS.service.modulos);
  });

  test.skip("[NO IMPLEMENTADA] AC1: existe la opción Sin preset", () => {});
  test.skip("[NO IMPLEMENTADA] AC5: Sin preset permite configurar preferencias manualmente", () => {});
  test.skip("[NO IMPLEMENTADA] AC6: conserva la configuración manual al volver a ingresar", () => {});
  test.skip("[NO IMPLEMENTADA] AC7: permite editar la configuración manual antes del primer caso", () => {});
  test.skip("[NO IMPLEMENTADA] AC8: bloquea la configuración manual después del primer caso", () => {});
});
