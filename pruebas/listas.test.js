import { reemplazarUnicoPorId, unicosPorId } from "../src/lib/listas.js";

describe("listas por id", () => {
  test("la carga conserva una sola copia de cada caso", () => {
    expect(unicosPorId([
      { id: "a", estado: "nuevo" },
      { id: "a", estado: "nuevo" },
      { id: "b", estado: "esperando" },
    ])).toEqual([
      { id: "a", estado: "nuevo" },
      { id: "b", estado: "esperando" },
    ]);
  });

  test("avanzar un caso actualiza una sola fila aunque la lista viniera repetida", () => {
    expect(reemplazarUnicoPorId([
      { id: "a", estado: "nuevo" },
      { id: "a", estado: "nuevo" },
      { id: "b", estado: "esperando" },
    ], { id: "a", estado: "revision_final" })).toEqual([
      { id: "a", estado: "revision_final" },
      { id: "b", estado: "esperando" },
    ]);
  });
});
