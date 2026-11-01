import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  asistirCaso,
  consultarInicio,
  extraerAltaCaso,
  prepararAccion,
  proponerEcuacion,
  recomendarModulos,
  reconciliarAlta,
  revisarEcuacion,
} from "../src/lib/asistente/index.js";
import { nuevaEcuacion } from "../src/lib/ecuaciones.js";

const nivel = (r, clave) => r.propuesta.modulos.find((m) => m.clave === clave).nivel;

test("recomienda Agenda, Inventario y Equipo para un taller con técnicos y turnos", () => {
  const r = recomendarModulos({ rubro: "taller", descripcion: "Taller con tres técnicos, turnos y repuestos", personas: 3 });
  assert.equal(nivel(r, "agenda"), "recomendado");
  assert.equal(nivel(r, "inventario"), "recomendado");
  assert.equal(nivel(r, "equipo"), "recomendado");
});

test("consultorio con citas recomienda Agenda y Equipo", () => {
  const r = recomendarModulos({ rubro: "medicina", descripcion: "Consultorio con dos médicos y citas", personas: 2 });
  assert.equal(nivel(r, "agenda"), "recomendado");
  assert.equal(nivel(r, "equipo"), "recomendado");
});

test("service con materiales y aprobación recomienda Inventario y Pendientes", () => {
  const r = recomendarModulos({ rubro: "service", descripcion: "Service de equipos, usamos materiales y enviamos presupuestos para aprobación" });
  assert.equal(nivel(r, "inventario"), "recomendado");
  assert.equal(nivel(r, "presupuesto"), "recomendado");
});

test("negocio unipersonal no recomienda Equipo por defecto", () => {
  const r = recomendarModulos({ rubro: "personalizable", descripcion: "Trabajo solo haciendo reparaciones", personas: 1 });
  assert.notEqual(nivel(r, "equipo"), "recomendado");
});

test("varias sedes recomienda los submódulos de sedes", () => {
  const r = recomendarModulos({ descripcion: "Tenemos varias sedes con stock" });
  for (const clave of ["sedes", "en_camino_sedes"]) assert.equal(r.propuesta.submodulos.find((s) => s.clave === clave).nivel, "recomendado");
});

test("descripción vacía o ambigua pide información", () => {
  assert.equal(recomendarModulos({}).estado, "falta_informacion");
  assert.equal(recomendarModulos({ descripcion: "Tenemos un negocio" }).estado, "falta_informacion");
});

test("una decisión explícita no se sobrescribe por la descripción", () => {
  const r = recomendarModulos({ descripcion: "Usamos turnos y stock", turnos: false, stock: true });
  assert.notEqual(nivel(r, "agenda"), "recomendado");
  assert.equal(nivel(r, "inventario"), "recomendado");
});

test("extrae el ejemplo de Juan Pérez y sólo asigna a Diego si existe", () => {
  const frase = "Vino Juan Pérez con un Corolla patente AB123CD por un ruido en los frenos. Lo va a atender Diego.";
  const r = extraerAltaCaso({ frase, rubro: "taller", empleados: [{ id: "d1", nombre: "Diego" }] });
  assert.equal(r.propuesta.nombre, "Juan Pérez");
  assert.equal(r.propuesta.identificador, "AB123CD");
  assert.equal(r.propuesta.servicio, "ruido en los frenos");
  assert.equal(r.propuesta.responsable, "d1");
});

test("conserva campos escritos y expone el conflicto", () => {
  const r = reconciliarAlta({ nombre: "Ana", servicio: "Diagnóstico" }, { nombre: "Juan", servicio: "Frenos", identificador: "AB123CD" });
  assert.equal(r.valores.nombre, "Ana");
  assert.equal(r.valores.identificador, "AB123CD");
  assert.deepEqual(r.conflictos.map((c) => c.campo), ["nombre", "servicio"]);
});

test("responsable inexistente o ambiguo no se asigna", () => {
  const frase = "Vino Juan Pérez con patente AB123CD por frenos. Lo va a atender Diego.";
  assert.equal(extraerAltaCaso({ frase, rubro: "taller", empleados: [] }).propuesta.responsable, "");
  const ambiguo = extraerAltaCaso({ frase, rubro: "taller", empleados: [{ id: "1", nombre: "Diego Pérez" }, { id: "2", nombre: "Diego Gómez" }] });
  assert.equal(ambiguo.propuesta.responsable, "");
  assert.ok(ambiguo.preguntas.length > 0);
});

for (const [frase, formula] of [
  ["Precio final es materiales más horas por 15000, con 20% de margen.", "(materiales + horas * tarifa_hora) * (1 + margen / 100)"],
  ["Calcular metros cuadrados multiplicando ancho por alto.", "ancho * alto"],
  ["Cantidad de pintura para una superficie con rendimiento de 10 metros cuadrados por litro.", "superficie / rendimiento"],
]) test(`genera y valida la ecuación: ${formula}`, () => {
  const r = proponerEcuacion(frase);
  assert.equal(r.estado, "listo");
  assert.equal(r.propuesta.formula, formula);
  assert.ok(nuevaEcuacion(r.propuesta).ecuacion);
});

test("no inventa una ecuación fuera de los patrones", () => {
  assert.equal(proponerEcuacion("Calculá algo conveniente para este cliente").estado, "no_entendido");
});

test("propone una corrección sólo cuando falta cerrar paréntesis", () => {
  const r = revisarEcuacion({ formula: "(ancho * alto", variables: [] });
  assert.equal(r.propuesta.formula, "(ancho * alto)");
});

test("Inicio encuentra casos esperando, stock faltante y próximos turnos", () => {
  const base = { modulosActivos: ["inventario", "stock", "agenda", "turnos"], casos: [{ id: "c1", estado: "esperando", nombre: "Caso uno" }] };
  assert.deepEqual(consultarInicio("casos esperando", base).propuesta.items.map((x) => x.href), ["/casos/c1"]);
  assert.equal(consultarInicio("productos por debajo del mínimo", { ...base, insumos: [{ id: "i1", nombre: "Filtro", estado: "en_stock", cantidad: 1, minimo: 2 }] }).propuesta.items[0].titulo, "Filtro");
  assert.equal(consultarInicio("próximos turnos", { ...base, turnos: [{ motivo: "Control", empieza_en: "2099-01-01T10:00:00", estado: "confirmado" }] }).propuesta.items[0].href, "/agenda");
});

test("prepara Agenda e Inventario sin aplicar acciones", () => {
  assert.equal(prepararAccion("agenda", "Turno para Ana mañana a las 15 por control").propuesta.nombreCliente, "Ana");
  assert.equal(prepararAccion("inventario", "Agregar 12 filtros de aceite, mínimo 3").propuesta.cantidad, "12");
});

test("ninguna función del asistente modifica los datos recibidos", () => {
  const contexto = Object.freeze({
    caso: Object.freeze({ id: "c1", estado: "nuevo", abierto_en: "2026-01-01" }),
    pasos: Object.freeze([]), insumos: Object.freeze([]), empleados: Object.freeze([]), eventos: Object.freeze([]),
  });
  asistirCaso("resumen", contexto);
  assert.deepEqual(contexto.pasos, []);
  const actual = Object.freeze({ nombre: "Ana" });
  reconciliarAlta(actual, Object.freeze({ nombre: "Juan" }));
  assert.equal(actual.nombre, "Ana");
});

test("el proveedor sólo devuelve propuestas: no recibe ni ejecuta acciones", () => {
  let aplicado = false;
  const entrada = { descripcion: "usamos turnos", aplicar: () => { aplicado = true; } };
  recomendarModulos(entrada);
  assert.equal(aplicado, false);
});

