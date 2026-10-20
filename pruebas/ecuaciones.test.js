import {
  errorDeVariables,
  entradasDeEcuacionEncadenada,
  filtrarEcuaciones,
  mismaExpresion,
  nombreParaDependencia,
  nuevaEcuacion,
  ordenarEcuaciones,
  resolverEcuacion,
  resolverEcuacionEncadenada,
  validarFormula,
  variablesHeredadas,
} from "../src/lib/ecuaciones.js";

const variable = (id) => ({ id, nombre: id, tipo: "variable" });
const ecuacion = (id, nombre, formula, variables = [], dependencias = []) =>
  ({ id, nombre, formula, variables, dependencias, unidad_resultado: "" });

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

test("resuelve una ecuación que utiliza el resultado de otra", () => {
  const imc = ecuacion("imc", "IMC", "peso/altura^2", [variable("peso"), variable("altura")]);
  const riesgo = ecuacion("riesgo", "Riesgo", "imc*factor", [variable("factor")], [
    { ecuacion_id: "imc", nombre: "imc" },
  ]);
  const salida = resolverEcuacionEncadenada(riesgo, [imc, riesgo], { peso: 80, altura: 2, factor: 1.5 });
  expect(salida.resultado).toBe(30);
  expect(salida.intermedios).toEqual([{ id: "imc", nombre: "IMC", resultado: 20, unidad: "" }]);
});

test("permite usar en una ecuación las variables de sus precedentes", () => {
  const f1 = ecuacion("f1", "F1", "a+b", [variable("a"), variable("b")]);
  const f2 = ecuacion("f2", "F2", "f1*a", [], [{ ecuacion_id: "f1", nombre: "f1" }]);

  expect(variablesHeredadas(f2, [f1, f2]).variables.map((v) => [v.nombre, v.ecuacion]))
    .toEqual([["a", "F1"], ["b", "F1"]]);
  expect(nuevaEcuacion(f2, [f1, f2]).error).toBeUndefined();
  expect(resolverEcuacionEncadenada(f2, [f1, f2], { a: 2, b: 3 }).resultado).toBe(10);
});

test("expone también las variables heredadas transitivamente sin duplicarlas", () => {
  const base = ecuacion("base", "Base", "x+1", [variable("x")]);
  const media = ecuacion("media", "Media", "base+y", [variable("y")], [{ ecuacion_id: "base", nombre: "base" }]);
  const final = ecuacion("final", "Final", "media*x", [], [{ ecuacion_id: "media", nombre: "media" }]);

  expect(variablesHeredadas(final, [base, media, final]).variables.map((v) => v.nombre)).toEqual(["x", "y"]);
  expect(resolverEcuacionEncadenada(final, [base, media, final], { x: 2, y: 3 }).resultado).toBe(12);
});

test("ordena y resuelve una cadena de tres ecuaciones una sola vez", () => {
  const a = ecuacion("a", "A", "x+1", [variable("x")]);
  const b = ecuacion("b", "B", "a*2", [], [{ ecuacion_id: "a", nombre: "a" }]);
  const c = ecuacion("c", "C", "b+3", [], [{ ecuacion_id: "b", nombre: "b" }]);
  expect(ordenarEcuaciones(c, [c, a, b]).orden.map((e) => e.id)).toEqual(["a", "b", "c"]);
  expect(resolverEcuacionEncadenada(c, [c, a, b], { x: 4 })).toMatchObject({
    resultado: 13,
    intermedios: [{ id: "a", resultado: 5 }, { id: "b", resultado: 10 }],
  });
});

test("resuelve varias dependencias y pide sólo sus entradas reales", () => {
  const precio = ecuacion("precio", "Precio", "cantidad*unitario", [variable("cantidad"), variable("unitario")]);
  const descuento = ecuacion("descuento", "Descuento", "porcentaje/100", [variable("porcentaje")]);
  const total = ecuacion("total", "Total", "precio*(1-descuento)", [], [
    { ecuacion_id: "precio", nombre: "precio" },
    { ecuacion_id: "descuento", nombre: "descuento" },
  ]);
  expect(entradasDeEcuacionEncadenada(total, [precio, descuento, total]).entradas.map((v) => v.id))
    .toEqual(["cantidad", "unitario", "porcentaje"]);
  expect(resolverEcuacionEncadenada(total, [precio, descuento, total], {
    cantidad: 2, unitario: 100, porcentaje: 10,
  }).resultado).toBe(180);
});

test("detecta ciclos directos e indirectos sin calcular infinitamente", () => {
  const directa = ecuacion("a", "A", "a+1", [], [{ ecuacion_id: "a", nombre: "a" }]);
  expect(ordenarEcuaciones(directa, [directa]).error).toMatch(/circular/i);
  const a = ecuacion("a", "A", "b", [], [{ ecuacion_id: "b", nombre: "b" }]);
  const b = ecuacion("b", "B", "c", [], [{ ecuacion_id: "c", nombre: "c" }]);
  const c = ecuacion("c", "C", "a", [], [{ ecuacion_id: "a", nombre: "a" }]);
  expect(ordenarEcuaciones(a, [a, b, c]).error).toMatch(/circular/i);
});

test("atribuye entradas faltantes y operaciones inválidas a la ecuación dependiente", () => {
  const division = ecuacion("division", "División base", "a/b", [variable("a"), variable("b")]);
  const final = ecuacion("final", "Final", "base+1", [], [{ ecuacion_id: "division", nombre: "base" }]);
  expect(resolverEcuacionEncadenada(final, [division, final], { a: 2 }).error).toMatch(/División base.*b/i);
  expect(resolverEcuacionEncadenada(final, [division, final], { a: 2, b: 0 }).error).toMatch(/División base.*cero/i);
});

test("genera alias válidos y estables para insertar dependencias", () => {
  expect(nombreParaDependencia({ nombre: "Nivel de riesgo" })).toBe("nivel_de_riesgo");
  expect(nombreParaDependencia({ nombre: "Nivel de riesgo" }, ["nivel_de_riesgo"])).toBe("nivel_de_riesgo_2");
  expect(nombreParaDependencia({ nombre: "2 × precio" })).toBe("resultado_2_precio");
});
