import { mismaExpresion, nuevaEcuacion, validarFormula } from "../src/lib/ecuaciones.js";

test("valida campos obligatorios y sintaxis básica", () => {
  expect(nuevaEcuacion({ nombre: "", formula: "x+1" }).error).toMatch(/nombre/i);
  expect(nuevaEcuacion({ nombre: "Total", formula: "x+" }).error).toMatch(/incompleta/i);
  expect(nuevaEcuacion({ nombre: "Total", formula: "(x+1)*2", descripcion: "Una cuenta" }).ecuacion.nombre).toBe("Total");
});

test("detecta expresiones iguales respetando el orden", () => {
  expect(mismaExpresion("a+b", "a+b")).toBe(true);
  expect(mismaExpresion("a + b", "a+b")).toBe(true);
  expect(mismaExpresion("a+b", "b+a")).toBe(false);
  expect(validarFormula("a/(b-1)")).toBeNull();
  expect(validarFormula("área * 2")).toBeNull();
  expect(validarFormula("2 valores")).toMatch(/operador/i);
});
