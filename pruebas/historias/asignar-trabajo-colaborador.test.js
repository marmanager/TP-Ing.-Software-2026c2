import { describe, expect, test } from "@jest/globals";
import { accionDeFila, quienLoTiene } from "../../src/lib/estados.js";

describe("Historia: Asignar trabajo a colaborador", () => {
  const empleados = [
    { id: "e1", nombre: "Diego" },
    { id: "e2", nombre: "Nico" },
  ];

  test("un trabajo nuevo ofrece asignar responsable", () => {
    const accion = accionDeFila({ id: "caso-1", estado: "nuevo" });

    expect(accion.tipo).toBe("asignar");
    expect(accion.etiqueta).toBe("Asignar responsable");
  });

  test("resuelve el nombre del colaborador asignado", () => {
    expect(
      quienLoTiene({ estado: "en_proceso", responsable_id: "e2" }, empleados)
    ).toBe("Nico");
  });

  test("un trabajo nuevo sin responsable se muestra sin asignar", () => {
    expect(quienLoTiene({ estado: "nuevo", responsable_id: null }, empleados)).toBe(
      "Sin asignar"
    );
  });
});
