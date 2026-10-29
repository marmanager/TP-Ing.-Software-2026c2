import { tCastellano } from "./idioma.js";

const TOKEN = /\s*(\d+(?:\.\d+)?|[A-Za-zÁÉÍÓÚÜáéíóúüÑñ_][A-Za-zÁÉÍÓÚÜáéíóúüÑñ_0-9]*|[()+\-*/^])\s*/gy;
const NOMBRE = /^[A-Za-zÁÉÍÓÚÜáéíóúüÑñ_][A-Za-zÁÉÍÓÚÜáéíóúüÑñ_0-9]*$/;
const FUNCIONES = new Set(["sqrt", "raiz"]);
const clave = (valor) => String(valor ?? "").trim().toLocaleLowerCase("es");
const claveDeBusqueda = (valor) => clave(valor).normalize("NFD").replace(/[\u0300-\u0301\u0308]/g, "");

// Los mensajes salen del diccionario (ecuaciones.errores.*); `t` va último y sin
// él salen en castellano. Las fórmulas (sqrt, raiz, ^) son parte del lenguaje
// de las ecuaciones y no se traducen.
const e = (t, clave, vars) => t(`ecuaciones.errores.${clave}`, vars);

function tokensDe(formula, t = tCastellano) {
  const texto = String(formula ?? "").trim();
  if (!texto) return { error: e(t, "formulaObligatoria") };
  const tokens = [];
  let posicion = 0;
  while (posicion < texto.length) {
    TOKEN.lastIndex = posicion;
    const encontrado = TOKEN.exec(texto);
    if (!encontrado) return { error: e(t, "simboloInvalido") };
    tokens.push(encontrado[1]);
    posicion = TOKEN.lastIndex;
  }
  return { tokens };
}

function calcular(tokens, valores = {}, comprobarValores = false, t = tCastellano) {
  let posicion = 0;
  const usadas = new Set();
  let error = null;
  const fallar = (mensaje) => { if (!error) error = mensaje; return 0; };
  const mirar = () => tokens[posicion];
  const tomar = () => tokens[posicion++];

  function primaria() {
    const token = tomar();
    if (token === undefined) return fallar(e(t, "formulaIncompleta"));
    if (token === "(") {
      const valor = expresion();
      if (tomar() !== ")") return fallar(e(t, "parentesis"));
      return valor;
    }
    if (/^\d/.test(token)) return Number(token);
    if (NOMBRE.test(token)) {
      if (FUNCIONES.has(clave(token))) {
        if (tomar() !== "(") return fallar(e(t, "raizParentesis"));
        const valor = expresion();
        if (tomar() !== ")") return fallar(e(t, "parentesis"));
        if (comprobarValores && valor < 0) return fallar(e(t, "raizNegativa"));
        return comprobarValores ? Math.sqrt(valor) : 1;
      }
      usadas.add(clave(token));
      if (!comprobarValores) return 1;
      const valor = valores[clave(token)];
      return Number.isFinite(valor) ? valor : fallar(e(t, "faltaValor", { nombre: token }));
    }
    return fallar(e(t, "faltaValorFormula"));
  }

  function potencia() {
    const izquierda = primaria();
    if (mirar() !== "^") return izquierda;
    tomar();
    const resultado = izquierda ** unaria();
    return comprobarValores && !Number.isFinite(resultado)
      ? fallar(e(t, "potencia")) : resultado;
  }

  function unaria() {
    if (mirar() === "+") { tomar(); return unaria(); }
    if (mirar() === "-") { tomar(); return -unaria(); }
    return potencia();
  }

  function termino() {
    let valor = unaria();
    while (mirar() === "*" || mirar() === "/") {
      const operador = tomar();
      const derecha = unaria();
      if (comprobarValores && operador === "/" && derecha === 0) return fallar(e(t, "divisionPorCero"));
      valor = operador === "*" ? valor * derecha : valor / derecha;
    }
    return valor;
  }

  function expresion() {
    let valor = termino();
    while (mirar() === "+" || mirar() === "-") {
      const operador = tomar();
      const derecha = termino();
      valor = operador === "+" ? valor + derecha : valor - derecha;
    }
    return valor;
  }

  const resultado = expresion();
  if (!error && posicion < tokens.length) error = e(t, "faltaOperador");
  if (!error && comprobarValores && !Number.isFinite(resultado)) error = e(t, "resultadoInvalido");
  return { resultado, usadas: [...usadas], error };
}

export function analizarFormula(formula, t = tCastellano) {
  const leida = tokensDe(formula, t);
  if (leida.error) return { error: leida.error, usadas: [] };
  return calcular(leida.tokens, {}, false, t);
}

export const validarFormula = (formula, t = tCastellano) => analizarFormula(formula, t).error;

export function limpiarVariables(variables = []) {
  return variables.map((variable) => ({
    id: String(variable.id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
    tipo: variable.tipo === "constante" ? "constante" : "variable",
    nombre: String(variable.nombre ?? "").trim(),
    descripcion: String(variable.descripcion ?? "").trim(),
    valor: variable.valor === "" || variable.valor == null ? null : Number(variable.valor),
    unidad: String(variable.unidad ?? "").trim(),
  }));
}

export function limpiarDependencias(dependencias = []) {
  return dependencias.map((dependencia) => ({
    ecuacion_id: String(dependencia.ecuacion_id ?? ""),
    nombre: String(dependencia.nombre ?? "").trim(),
  }));
}

export function errorDeVariables(variables = [], t = tCastellano) {
  const vistas = new Set();
  for (const variable of limpiarVariables(variables)) {
    if (!NOMBRE.test(variable.nombre) || FUNCIONES.has(clave(variable.nombre))) {
      return e(t, "nombreVariable");
    }
    const nombre = clave(variable.nombre);
    if (vistas.has(nombre)) return e(t, "nombreRepetido", { nombre: variable.nombre });
    vistas.add(nombre);
    if (variable.valor !== null && !Number.isFinite(variable.valor)) return e(t, "valorNoNumerico", { nombre: variable.nombre });
    if (variable.tipo === "constante" && variable.valor === null) return e(t, "constanteSinValor", { nombre: variable.nombre });
  }
  return null;
}

export function errorDeDependencias(variables = [], dependencias = [], t = tCastellano) {
  const nombres = new Set(limpiarVariables(variables).map((variable) => clave(variable.nombre)));
  const ecuaciones = new Set();
  for (const dependencia of limpiarDependencias(dependencias)) {
    if (!NOMBRE.test(dependencia.nombre) || FUNCIONES.has(clave(dependencia.nombre))) {
      return e(t, "nombreDependencia");
    }
    const nombre = clave(dependencia.nombre);
    if (nombres.has(nombre)) return e(t, "nombreRepetido", { nombre: dependencia.nombre });
    nombres.add(nombre);
    if (ecuaciones.has(dependencia.ecuacion_id)) return e(t, "dependenciaRepetida");
    ecuaciones.add(dependencia.ecuacion_id);
  }
  return null;
}

export function nuevaEcuacion({ nombre, formula, descripcion = "", categoria = "", variables = [], dependencias = [], unidad_resultado = "", id }, ecuaciones = [], t = tCastellano) {
  const nombreLimpio = String(nombre ?? "").trim();
  const formulaLimpia = String(formula ?? "").trim();
  if (!nombreLimpio) return { error: e(t, "nombreObligatorio"), campo: "nombre" };
  const analisis = analizarFormula(formulaLimpia, t);
  if (analisis.error) return { error: analisis.error, campo: "formula" };
  const limpias = limpiarVariables(variables);
  const errorVariables = errorDeVariables(limpias, t);
  if (errorVariables) return { error: errorVariables, campo: "variables" };
  const dependenciasLimpias = limpiarDependencias(dependencias);
  const errorDependencias = errorDeDependencias(limpias, dependenciasLimpias, t);
  if (errorDependencias) return { error: errorDependencias, campo: "dependencias" };
  const heredadas = variablesHeredadas({ id, variables: limpias, dependencias: dependenciasLimpias }, ecuaciones, t);
  if (heredadas.error) return { error: heredadas.error, campo: "dependencias" };
  const definidas = new Set([
    ...limpias.map((variable) => clave(variable.nombre)),
    ...dependenciasLimpias.map((d) => clave(d.nombre)),
    ...heredadas.variables.map((variable) => clave(variable.nombre)),
  ]);
  const indefinida = analisis.usadas.find((usada) => !definidas.has(usada));
  if (indefinida) return { error: e(t, "indefinida", { nombre: indefinida }), campo: "formula" };
  return { ecuacion: {
    nombre: nombreLimpio, formula: formulaLimpia,
    descripcion: String(descripcion ?? "").trim(), categoria: String(categoria ?? "").trim(),
    variables: limpias, dependencias: dependenciasLimpias, unidad_resultado: String(unidad_resultado ?? "").trim(),
  } };
}

export function resolverEcuacion(ecuacion, entradas = {}, t = tCastellano) {
  const variables = limpiarVariables(ecuacion?.variables ?? []);
  const valores = {};
  for (const variable of variables) {
    const recibido = variable.tipo === "constante" ? variable.valor : entradas[variable.id];
    if (recibido === "" || recibido == null) return { error: e(t, "ingresaValor", { nombre: variable.nombre }), campo: variable.id };
    const numero = Number(recibido);
    if (!Number.isFinite(numero)) return { error: e(t, "necesitaNumerico", { nombre: variable.nombre }), campo: variable.id };
    valores[clave(variable.nombre)] = numero;
  }
  const leida = tokensDe(ecuacion?.formula, t);
  if (leida.error) return { error: leida.error };
  const calculada = calcular(leida.tokens, valores, true, t);
  return calculada.error ? { error: calculada.error } : { resultado: calculada.resultado };
}

export function ordenarEcuaciones(ecuacion, ecuaciones = [], t = tCastellano) {
  const porId = new Map(ecuaciones.map((actual) => [actual.id, actual]));
  if (ecuacion?.id) porId.set(ecuacion.id, ecuacion);
  const visitando = new Set();
  const visitadas = new Set();
  const orden = [];

  function visitar(actual) {
    if (!actual) return e(t, "noExiste");
    if (visitando.has(actual.id)) return e(t, "circular");
    if (visitadas.has(actual.id)) return null;
    visitando.add(actual.id);
    for (const dependencia of actual.dependencias ?? []) {
      const error = visitar(porId.get(dependencia.ecuacion_id));
      if (error) return error;
    }
    visitando.delete(actual.id);
    visitadas.add(actual.id);
    orden.push(actual);
    return null;
  }

  const error = visitar(ecuacion);
  return error ? { error } : { orden };
}

export function entradasDeEcuacionEncadenada(ecuacion, ecuaciones = [], t = tCastellano) {
  const cadena = ordenarEcuaciones(ecuacion, ecuaciones, t);
  if (cadena.error) return cadena;
  const vistas = new Set();
  const entradas = [];
  for (const actual of cadena.orden) {
    for (const variable of actual.variables ?? []) {
      if (variable.tipo !== "constante" && !vistas.has(variable.id)) {
        vistas.add(variable.id);
        entradas.push({ ...variable, ecuacion: actual.nombre });
      }
    }
  }
  return { entradas };
}

export function variablesHeredadas(ecuacion, ecuaciones = [], t = tCastellano) {
  const cadena = ordenarEcuaciones(ecuacion, ecuaciones, t);
  if (cadena.error) return cadena;
  const vistas = new Set();
  const variables = [];
  for (const actual of cadena.orden) {
    if (actual === ecuacion || (ecuacion?.id && actual.id === ecuacion.id)) continue;
    for (const variable of actual.variables ?? []) {
      if (!vistas.has(variable.id)) {
        vistas.add(variable.id);
        variables.push({ ...variable, ecuacion: actual.nombre });
      }
    }
  }
  return { variables };
}

export function resolverEcuacionEncadenada(ecuacion, ecuaciones = [], entradas = {}, t = tCastellano) {
  const cadena = ordenarEcuaciones(ecuacion, ecuaciones, t);
  if (cadena.error) return cadena;
  const resultados = new Map();
  const intermedios = [];

  for (const actual of cadena.orden) {
    const heredadas = variablesHeredadas(actual, ecuaciones, t).variables ?? [];
    const calculadas = (actual.dependencias ?? []).map((dependencia) => ({
      id: `ecuacion:${dependencia.ecuacion_id}`,
      tipo: "variable",
      nombre: dependencia.nombre,
      descripcion: "",
      valor: null,
      unidad: "",
    }));
    const valores = { ...entradas };
    for (const dependencia of actual.dependencias ?? []) {
      valores[`ecuacion:${dependencia.ecuacion_id}`] = resultados.get(dependencia.ecuacion_id);
    }
    const salida = resolverEcuacion({ ...actual, variables: [...heredadas, ...(actual.variables ?? []), ...calculadas] }, valores, t);
    if (salida.error) return { ...salida, error: `${actual.nombre}: ${salida.error}`, ecuacion: actual.nombre };
    resultados.set(actual.id, salida.resultado);
    if (actual.id !== ecuacion.id) intermedios.push({
      id: actual.id, nombre: actual.nombre, resultado: salida.resultado, unidad: actual.unidad_resultado ?? "",
    });
  }

  return { resultado: resultados.get(ecuacion.id), intermedios };
}

export function nombreParaDependencia(ecuacion, ocupados = []) {
  const base = claveDeBusqueda(ecuacion?.nombre).replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "resultado";
  const valido = /^\d/.test(base) || FUNCIONES.has(base) ? `resultado_${base}` : base;
  const usados = new Set(ocupados.map(clave));
  let nombre = valido, numero = 2;
  while (usados.has(clave(nombre))) nombre = `${valido}_${numero++}`;
  return nombre;
}

const expresionComparable = (valor) => String(valor ?? "").replace(/\s+/g, "");
export const mismaExpresion = (a, b) => expresionComparable(a) === expresionComparable(b);

export function filtrarEcuaciones(ecuaciones = [], { busqueda = "", categoria = "", orden = "nombre" } = {}) {
  const texto = claveDeBusqueda(busqueda);
  return ecuaciones
    .filter((e) => (!texto || claveDeBusqueda(e.nombre).includes(texto)) && (!categoria || e.categoria === categoria))
    .toSorted((a, b) => String(a[orden] ?? "").localeCompare(String(b[orden] ?? ""), "es", { sensitivity: "base" }));
}
