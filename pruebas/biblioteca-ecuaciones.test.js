import {
  CATEGORIAS, bibliotecaEn, errorDePlantilla, filtrarBiblioteca, ordenarParaElRubro, paraGuardar, yaGuardada,
} from "../src/lib/biblioteca-ecuaciones.js";
import { resolverEcuacion } from "../src/lib/ecuaciones.js";

const todas = (idioma = "es") => bibliotecaEn(idioma).flatMap((c) => c.ecuaciones);

// Resuelve una plantilla con los valores dados por nombre de variable.
function resolver(plantilla, valores) {
  const ecuacion = paraGuardar(plantilla);
  const entradas = Object.fromEntries(ecuacion.variables.map((v) => [v.id, valores[v.nombre]]));
  return resolverEcuacion(ecuacion, entradas);
}
const buscar = (clave) => todas().find((e) => e.clave === clave);

test("cada ecuación de la biblioteca se puede guardar", () => {
  for (const plantilla of todas()) expect([plantilla.clave, errorDePlantilla(plantilla)]).toEqual([plantilla.clave, null]);
});

test("cada ecuación se puede resolver con valores de ejemplo", () => {
  for (const plantilla of todas()) {
    const valores = Object.fromEntries(plantilla.variables.map((v, i) => [v.nombre, i + 3]));
    const salida = resolver(plantilla, valores);
    expect([plantilla.clave, salida.error ?? null]).toEqual([plantilla.clave, null]);
    expect(Number.isFinite(salida.resultado)).toBe(true);
  }
});

test("las claves y las fórmulas no se repiten", () => {
  const lista = todas();
  expect(new Set(lista.map((e) => e.clave)).size).toBe(lista.length);
  expect(new Set(lista.map((e) => e.formula.replace(/\s+/g, ""))).size).toBe(lista.length);
  expect(new Set(CATEGORIAS.map((c) => c.clave)).size).toBe(CATEGORIAS.length);
});

test("todo está escrito en los dos idiomas", () => {
  for (const idioma of ["es", "en"]) {
    for (const categoria of bibliotecaEn(idioma)) {
      expect(categoria.nombre && categoria.queEs).toBeTruthy();
      for (const e of categoria.ecuaciones) {
        expect([e.clave, Boolean(e.nombre && e.descripcion)]).toEqual([e.clave, true]);
        for (const v of e.variables) expect([e.clave, v.nombre, Boolean(v.descripcion)]).toEqual([e.clave, v.nombre, true]);
      }
    }
  }
  expect(bibliotecaEn("en")[0].nombre).toBe("Costs and pricing");
});

test("las cuentas dan lo que tienen que dar", () => {
  expect(resolver(buscar("costos/precio-con-iva"), { neto: 100 }).resultado).toBeCloseTo(121);
  expect(resolver(buscar("costos/precio-por-margen"), { costo: 80, margen: 20 }).resultado).toBeCloseTo(100);
  expect(resolver(buscar("salud/imc"), { peso: 70, altura: 1.75 }).resultado).toBeCloseTo(22.857, 2);
  expect(resolver(buscar("finanzas/cuota-sistema-frances"), { monto: 1000, tasa: 1, cuotas: 12 }).resultado).toBeCloseTo(88.85, 2);
  expect(resolver(buscar("conversiones/celsius-a-fahrenheit"), { celsius: 100 }).resultado).toBeCloseTo(212);
});

test("las categorías del rubro van primero y lo dicen", () => {
  const ordenadas = ordenarParaElRubro(bibliotecaEn(), "medicina");
  expect(ordenadas.filter((c) => c.delRubro).map((c) => c.clave)).toEqual(["costos", "salud"]);
  expect(ordenadas.slice(0, 2).map((c) => c.clave)).toEqual(["costos", "salud"]);
  expect(ordenarParaElRubro(bibliotecaEn(), null).every((c) => !c.delRubro)).toBe(true);
});

test("busca sin tildes en nombre, descripción y fórmula, y filtra por categoría", () => {
  const biblioteca = bibliotecaEn();
  expect(filtrarBiblioteca(biblioteca, { busqueda: "indice" }).flatMap((c) => c.ecuaciones.map((e) => e.clave))).toEqual(["salud/imc"]);
  expect(filtrarBiblioteca(biblioteca, { busqueda: "valor_hora" })[0].ecuaciones[0].clave).toBe("costos/presupuesto-de-trabajo");
  const soloElectricidad = filtrarBiblioteca(biblioteca, { categoria: "electricidad" });
  expect(soloElectricidad.map((c) => c.clave)).toEqual(["electricidad"]);
  expect(filtrarBiblioteca(biblioteca, { busqueda: "no existe nada así" })).toEqual([]);
});

test("reconoce la que ya está guardada aunque cambien los espacios", () => {
  const iva = buscar("costos/precio-con-iva");
  expect(yaGuardada(iva, [{ nombre: "IVA", formula: "neto*(1+iva/100)" }])?.nombre).toBe("IVA");
  expect(yaGuardada(iva, [{ nombre: "Otra", formula: "neto * 2" }])).toBeNull();
});

test("cada vez que se guarda, las variables llevan ids nuevos", () => {
  const plantilla = buscar("electricidad/potencia-electrica");
  const a = paraGuardar(plantilla).variables.map((v) => v.id);
  const b = paraGuardar(plantilla).variables.map((v) => v.id);
  expect(new Set([...a, ...b]).size).toBe(4);
  expect(paraGuardar(plantilla).categoria).toBe("Electricidad");
});
