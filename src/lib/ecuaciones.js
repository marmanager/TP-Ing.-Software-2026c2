const TOKEN = /\s*(\d+(?:\.\d+)?|[A-Za-zÁÉÍÓÚÜáéíóúüÑñ_][A-Za-zÁÉÍÓÚÜáéíóúüÑñ_0-9]*|[()+\-*/^])\s*/gy;
const NOMBRE = /^[A-Za-zÁÉÍÓÚÜáéíóúüÑñ_][A-Za-zÁÉÍÓÚÜáéíóúüÑñ_0-9]*$/;
const FUNCIONES = new Set(["sqrt", "raiz"]);
const clave = (valor) => String(valor ?? "").trim().toLocaleLowerCase("es");
const claveDeBusqueda = (valor) => clave(valor).normalize("NFD").replace(/[\u0300-\u0301\u0308]/g, "");

function tokensDe(formula) {
  const texto = String(formula ?? "").trim();
  if (!texto) return { error: "La fórmula es obligatoria." };
  const tokens = [];
  let posicion = 0;
  while (posicion < texto.length) {
    TOKEN.lastIndex = posicion;
    const encontrado = TOKEN.exec(texto);
    if (!encontrado) return { error: "La fórmula contiene un símbolo no válido." };
    tokens.push(encontrado[1]);
    posicion = TOKEN.lastIndex;
  }
  return { tokens };
}

function calcular(tokens, valores = {}, comprobarValores = false) {
  let posicion = 0;
  const usadas = new Set();
  let error = null;
  const fallar = (mensaje) => { if (!error) error = mensaje; return 0; };
  const mirar = () => tokens[posicion];
  const tomar = () => tokens[posicion++];

  function primaria() {
    const token = tomar();
    if (token === undefined) return fallar("La fórmula está incompleta.");
    if (token === "(") {
      const valor = expresion();
      if (tomar() !== ")") return fallar("Los paréntesis no son válidos.");
      return valor;
    }
    if (/^\d/.test(token)) return Number(token);
    if (NOMBRE.test(token)) {
      if (FUNCIONES.has(clave(token))) {
        if (tomar() !== "(") return fallar("La raíz necesita paréntesis.");
        const valor = expresion();
        if (tomar() !== ")") return fallar("Los paréntesis no son válidos.");
        if (comprobarValores && valor < 0) return fallar("No se puede calcular la raíz de un número negativo.");
        return comprobarValores ? Math.sqrt(valor) : 1;
      }
      usadas.add(clave(token));
      if (!comprobarValores) return 1;
      const valor = valores[clave(token)];
      return Number.isFinite(valor) ? valor : fallar(`Falta un valor numérico para ${token}.`);
    }
    return fallar("Falta un valor en la fórmula.");
  }

  function potencia() {
    const izquierda = primaria();
    if (mirar() !== "^") return izquierda;
    tomar();
    const resultado = izquierda ** unaria();
    return comprobarValores && !Number.isFinite(resultado)
      ? fallar("La potencia produce una operación inválida.") : resultado;
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
      if (comprobarValores && operador === "/" && derecha === 0) return fallar("No se puede dividir por cero.");
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
  if (!error && posicion < tokens.length) error = "Falta un operador entre valores.";
  if (!error && comprobarValores && !Number.isFinite(resultado)) error = "La operación no produce un resultado válido.";
  return { resultado, usadas: [...usadas], error };
}

export function analizarFormula(formula) {
  const leida = tokensDe(formula);
  if (leida.error) return { error: leida.error, usadas: [] };
  return calcular(leida.tokens);
}

export const validarFormula = (formula) => analizarFormula(formula).error;

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

export function errorDeVariables(variables = []) {
  const vistas = new Set();
  for (const variable of limpiarVariables(variables)) {
    if (!NOMBRE.test(variable.nombre) || FUNCIONES.has(clave(variable.nombre))) {
      return "Cada variable necesita un nombre sin espacios y distinto de sqrt o raiz.";
    }
    const nombre = clave(variable.nombre);
    if (vistas.has(nombre)) return `El nombre ${variable.nombre} está repetido.`;
    vistas.add(nombre);
    if (variable.valor !== null && !Number.isFinite(variable.valor)) return `El valor de ${variable.nombre} debe ser numérico.`;
    if (variable.tipo === "constante" && variable.valor === null) return `La constante ${variable.nombre} necesita un valor.`;
  }
  return null;
}

export function errorDeDependencias(variables = [], dependencias = []) {
  const nombres = new Set(limpiarVariables(variables).map((variable) => clave(variable.nombre)));
  const ecuaciones = new Set();
  for (const dependencia of limpiarDependencias(dependencias)) {
    if (!NOMBRE.test(dependencia.nombre) || FUNCIONES.has(clave(dependencia.nombre))) {
      return "Cada dependencia necesita un nombre sin espacios y distinto de sqrt o raiz.";
    }
    const nombre = clave(dependencia.nombre);
    if (nombres.has(nombre)) return `El nombre ${dependencia.nombre} está repetido.`;
    nombres.add(nombre);
    if (ecuaciones.has(dependencia.ecuacion_id)) return "La misma ecuación no puede agregarse dos veces.";
    ecuaciones.add(dependencia.ecuacion_id);
  }
  return null;
}

export function nuevaEcuacion({ nombre, formula, descripcion = "", categoria = "", variables = [], dependencias = [], unidad_resultado = "" }) {
  const nombreLimpio = String(nombre ?? "").trim();
  const formulaLimpia = String(formula ?? "").trim();
  if (!nombreLimpio) return { error: "El nombre es obligatorio.", campo: "nombre" };
  const analisis = analizarFormula(formulaLimpia);
  if (analisis.error) return { error: analisis.error, campo: "formula" };
  const limpias = limpiarVariables(variables);
  const errorVariables = errorDeVariables(limpias);
  if (errorVariables) return { error: errorVariables, campo: "variables" };
  const dependenciasLimpias = limpiarDependencias(dependencias);
  const errorDependencias = errorDeDependencias(limpias, dependenciasLimpias);
  if (errorDependencias) return { error: errorDependencias, campo: "dependencias" };
  const definidas = new Set([...limpias.map((variable) => clave(variable.nombre)), ...dependenciasLimpias.map((d) => clave(d.nombre))]);
  const indefinida = analisis.usadas.find((usada) => !definidas.has(usada));
  if (indefinida) return { error: `La variable ${indefinida} se usa en la fórmula pero no está definida.`, campo: "formula" };
  return { ecuacion: {
    nombre: nombreLimpio, formula: formulaLimpia,
    descripcion: String(descripcion ?? "").trim(), categoria: String(categoria ?? "").trim(),
    variables: limpias, dependencias: dependenciasLimpias, unidad_resultado: String(unidad_resultado ?? "").trim(),
  } };
}

export function resolverEcuacion(ecuacion, entradas = {}) {
  const variables = limpiarVariables(ecuacion?.variables ?? []);
  const valores = {};
  for (const variable of variables) {
    const recibido = variable.tipo === "constante" ? variable.valor : entradas[variable.id];
    if (recibido === "" || recibido == null) return { error: `Ingresá un valor para ${variable.nombre}.`, campo: variable.id };
    const numero = Number(recibido);
    if (!Number.isFinite(numero)) return { error: `${variable.nombre} necesita un valor numérico.`, campo: variable.id };
    valores[clave(variable.nombre)] = numero;
  }
  const leida = tokensDe(ecuacion?.formula);
  if (leida.error) return { error: leida.error };
  const calculada = calcular(leida.tokens, valores, true);
  return calculada.error ? { error: calculada.error } : { resultado: calculada.resultado };
}

export function ordenarEcuaciones(ecuacion, ecuaciones = []) {
  const porId = new Map(ecuaciones.map((actual) => [actual.id, actual]));
  if (ecuacion?.id) porId.set(ecuacion.id, ecuacion);
  const visitando = new Set();
  const visitadas = new Set();
  const orden = [];

  function visitar(actual) {
    if (!actual) return "Una ecuación utilizada ya no existe.";
    if (visitando.has(actual.id)) return "Existe una dependencia circular.";
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

export function entradasDeEcuacionEncadenada(ecuacion, ecuaciones = []) {
  const cadena = ordenarEcuaciones(ecuacion, ecuaciones);
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

export function resolverEcuacionEncadenada(ecuacion, ecuaciones = [], entradas = {}) {
  const cadena = ordenarEcuaciones(ecuacion, ecuaciones);
  if (cadena.error) return cadena;
  const resultados = new Map();
  const intermedios = [];

  for (const actual of cadena.orden) {
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
    const salida = resolverEcuacion({ ...actual, variables: [...(actual.variables ?? []), ...calculadas] }, valores);
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
