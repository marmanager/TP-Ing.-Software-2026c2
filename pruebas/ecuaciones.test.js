import {
  errorDeVariables,
  filtrarEcuaciones,
  mismaExpresion,
  nuevaEcuacion,
  resolverEcuacion,
  validarFormula,
} from "../src/lib/ecuaciones.js";

test("valida campos obligatorios y sintaxis básica", () => {
  expect(nuevaEcuacion({ nombre: "", formula: "x+1" }).error).toMatch(/nombre/i);
  expect(nuevaEcuacion({ nombre: "Total", formula: "x+" }).error).toMatch(/incompleta/i);
  expect(nuevaEcuacion({
    nombre: "Total", formula: "(x+1)*2", descripcion: "Una cuenta",
    variables: [{ id: "x", tipo: "variable", nombre: "x", valor: null }],
  }).ecuacion.nombre).toBe("Total");
});

test("busca, filtra y ordena el listado", () => {
  const ecuaciones = [
    { nombre: "Zeta", categoria: "Ventas" },
    { nombre: "Área", categoria: "Obra" },
    { nombre: "Margen", categoria: "Ventas" },
  ];
  expect(filtrarEcuaciones(ecuaciones, { busqueda: "area" }).map((e) => e.nombre)).toEqual(["Área"]);
  expect(filtrarEcuaciones(ecuaciones, { categoria: "Ventas" }).map((e) => e.nombre)).toEqual(["Margen", "Zeta"]);
  expect(filtrarEcuaciones(ecuaciones, { orden: "categoria" }).map((e) => e.categoria)).toEqual(["Obra", "Ventas", "Ventas"]);
});

test("detecta expresiones iguales respetando el orden", () => {
  expect(mismaExpresion("a+b", "a+b")).toBe(true);
  expect(mismaExpresion("a + b", "a+b")).toBe(true);
  expect(mismaExpresion("a+b", "b+a")).toBe(false);
  expect(validarFormula("a/(b-1)")).toBeNull();
  expect(validarFormula("área * 2")).toBeNull();
  expect(validarFormula("2 valores")).toMatch(/operador/i);
});

test("valida las variables y constantes de la fórmula", () => {
  expect(nuevaEcuacion({ nombre: "Total", formula: "precio*cantidad", variables: [] }).error).toMatch(/precio.*definida/i);
  expect(errorDeVariables([
    { id: "1", nombre: "precio", tipo: "variable" },
    { id: "2", nombre: "Precio", tipo: "variable" },
  ])).toMatch(/repetido/i);
  expect(errorDeVariables([{ id: "pi", nombre: "pi", tipo: "constante", valor: "" }])).toMatch(/necesita un valor/i);
  expect(nuevaEcuacion({
    nombre: "Diagonal", formula: "sqrt(lado^2+alto^2)", unidad_resultado: "cm",
    variables: [
      { id: "lado", nombre: "lado", tipo: "variable", descripcion: "Ancho", unidad: "cm", valor: 2 },
      { id: "alto", nombre: "alto", tipo: "variable", unidad: "cm", valor: null },
    ],
  }).ecuacion.variables).toHaveLength(2);
});

test("resuelve potencias y raíces y explica operaciones inválidas", () => {
  const ecuacion = {
    formula: "sqrt(lado^2+alto^2)",
    variables: [
      { id: "lado", nombre: "lado", tipo: "variable" },
      { id: "alto", nombre: "alto", tipo: "variable" },
    ],
  };
  expect(resolverEcuacion(ecuacion, { lado: 3, alto: 4 }).resultado).toBe(5);
  expect(resolverEcuacion({ formula: "a/b", variables: [
    { id: "a", nombre: "a", tipo: "variable" }, { id: "b", nombre: "b", tipo: "variable" },
  ] }, { a: 2, b: 0 }).error).toMatch(/cero/i);
  expect(resolverEcuacion(ecuacion, { lado: "", alto: 4 }).error).toMatch(/lado/i);
});
