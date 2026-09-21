import { describe, expect, test } from "@jest/globals";
import { accionDeFila, estaAbierto, quienLoTiene } from "../../src/lib/estados.js";

describe("Historia: Marcar consulta completada", () => {
  test("un trabajo en revisión ofrece entregarlo y cerrarlo", () => {
    const accion = accionDeFila({ id: "caso-1", estado: "revision_final" });

    expect(accion).toEqual({
      tipo: "entregar",
      etiqueta: "Entregar y cerrar",
      icono: "listo",
    });
  });

  test("un trabajo completado deja de considerarse abierto", () => {
    expect(estaAbierto({ estado: "completado" })).toBe(false);
    expect(estaAbierto({ estado: "revision_final" })).toBe(true);
  });

  test("un trabajo completado sin responsable se identifica como entregado", () => {
    expect(quienLoTiene({ estado: "completado", responsable_id: null }, [])).toBe(
      "Entregado"
    );
  });
});
