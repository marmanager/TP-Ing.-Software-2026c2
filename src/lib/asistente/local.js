import { tCastellano } from "../idioma.js";
import { analizarFormula, nuevaEcuacion, resolverEcuacion } from "../ecuaciones.js";
import { queFalta } from "../estados.js";
import { estaPrendido, hijosActivos, LISTA_MODULOS, LISTA_SUBMODULOS } from "../modulos.js";
import { preset } from "../presets.js";
import { respuestaAsistente } from "./contratos.js";

const texto = (valor) => String(valor ?? "").trim();
const normal = (valor) => texto(valor).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const contiene = (valor, palabras) => palabras.some((palabra) => normal(valor).includes(normal(palabra)));
const si = (valor) => valor === true || ["si", "sí", "yes"].includes(normal(valor));
const no = (valor) => valor === false || ["no"].includes(normal(valor));
const idVariable = (nombre) => `asistente-${nombre}`;
const variable = (nombre, descripcion, unidad = "", tipo = "variable", valor = null) => ({
  id: idVariable(nombre), tipo, nombre, descripcion, unidad, valor,
});

const PALABRAS_MODULO = {
  agenda: ["turno", "reserva", "cita", "visita", "appointment", "booking"],
  inventario: ["stock", "repuesto", "insumo", "producto", "material", "inventory"],
  presupuesto: ["presupuesto", "cotizacion", "aprobacion", "approval", "quote"],
  equipo: ["tecnico", "medico", "responsable", "equipo", "empleado", "team", "staff"],
  ecuaciones: ["formula", "calculo", "ecuacion", "matemat", "formula", "calculation"],
  dashboard: ["informe", "metrica", "rendimiento", "estadistica", "report", "metric"],
};

/**
 * Recomienda módulos sin cambiar la configuración recibida.
 * @param {{descripcion?: string, personas?: number|string, turnos?: boolean|string, stock?: boolean|string,
 * presupuestos?: boolean|string, sedes?: boolean|string, rubro?: string, idioma?: string}} entrada
 * @param {Function} t
 */
export function recomendarModulos(entrada = {}, t = tCastellano) {
  const descripcion = texto(entrada.descripcion);
  const personas = Number(entrada.personas) || null;
  const decidido = (valor, inferido) => no(valor) ? false : si(valor) || inferido;
  const pistas = {
    agenda: decidido(entrada.turnos, contiene(descripcion, PALABRAS_MODULO.agenda)),
    inventario: decidido(entrada.stock, contiene(descripcion, PALABRAS_MODULO.inventario)),
    presupuesto: decidido(entrada.presupuestos, contiene(descripcion, PALABRAS_MODULO.presupuesto)),
    equipo: (personas != null && personas > 1) || contiene(descripcion, PALABRAS_MODULO.equipo),
    ecuaciones: contiene(descripcion, PALABRAS_MODULO.ecuaciones),
    dashboard: contiene(descripcion, PALABRAS_MODULO.dashboard),
  };
  const unipersonal = personas === 1 || contiene(descripcion, ["trabajo solo", "trabajo sola", "unipersonal", "solo yo"]);
  if (unipersonal && !contiene(descripcion, PALABRAS_MODULO.equipo)) pistas.equipo = false;
  const variasSedes = decidido(entrada.sedes, contiene(descripcion, ["varias sedes", "dos sedes", "sucursales", "locations"]));
  if (variasSedes) pistas.inventario = true;

  const deRubro = new Set(preset(entrada.rubro, entrada.idioma).modulos ?? []);
  const modulos = LISTA_MODULOS.map((modulo) => {
    const recomendado = Boolean(pistas[modulo.clave]);
    const nivel = recomendado ? "recomendado" : deRubro.has(modulo.clave) ? "opcional" : "no_necesario";
    return {
      clave: modulo.clave,
      nivel,
      motivo: recomendado
        ? t(`asistente.modulos.motivos.${modulo.clave}`)
        : nivel === "opcional"
          ? t("asistente.modulos.motivoRubro")
          : t("asistente.modulos.motivoNoMencionado"),
    };
  });
  const submodulos = LISTA_SUBMODULOS.map((submodulo) => ({
    clave: submodulo.clave,
    padre: submodulo.padre,
    nivel:
      (submodulo.padre === "agenda" && pistas.agenda && ["turnos", "calendario"].includes(submodulo.clave)) ||
      (submodulo.padre === "inventario" && pistas.inventario && ["stock", "en_camino"].includes(submodulo.clave)) ||
      (variasSedes && ["sedes", "en_camino_sedes"].includes(submodulo.clave))
        ? "recomendado"
        : "no_necesario",
  }));
  const inicio = ["pendientes", "casos"];
  if (pistas.agenda) inicio.push("agenda");
  if (pistas.inventario) inicio.push("inventario");
  if (pistas.presupuesto) inicio.push("aprobar");
  if (pistas.equipo) inicio.push("equipo");
  if (pistas.dashboard) inicio.push("dashboard");
  inicio.push("historial");

  const hayDato = descripcion || personas || [entrada.turnos, entrada.stock, entrada.presupuestos, entrada.sedes].some((x) => si(x) || no(x));
  const hayPista = Object.values(pistas).some(Boolean) || variasSedes;
  return respuestaAsistente({
    estado: !hayDato || !hayPista ? "falta_informacion" : "listo",
    propuesta: { modulos, submodulos, inicio, variasSedes },
    explicacion: hayPista ? t("asistente.modulos.explicacion") : t("asistente.modulos.sinPistas"),
    preguntas: hayPista ? [] : [t("asistente.modulos.pregunta")],
  });
}

function nombreDeFrase(frase) {
  const encontrado = frase.match(/(?:vino|cliente|patient|customer)\s+([A-ZÁÉÍÓÚÜÑ][\p{L}'-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}'-]+){1,3})(?=\s+(?:con|por|porque|para|tel|telefono|teléfono)|[,.]|$)/iu);
  return encontrado?.[1]?.trim() ?? "";
}

function responsableDeFrase(frase, empleados) {
  const parte = frase.match(/(?:atender|atiende|responsable|con)\s+(?:a\s+)?([\p{L}' -]+?)(?=[.,]|$)/iu)?.[1] ?? "";
  if (!parte) return { id: "", ambiguo: false };
  const buscado = normal(parte);
  const coinciden = (empleados ?? []).filter((e) => {
    const nombre = normal(e.nombre);
    return nombre === buscado || nombre.split(" ").includes(buscado) || buscado.split(" ").includes(nombre);
  });
  return coinciden.length === 1 ? { id: coinciden[0].id, ambiguo: false } : { id: "", ambiguo: coinciden.length > 1 };
}

/** Extrae campos de un alta; nunca crea el caso. */
export function extraerAltaCaso({ frase = "", empleados = [], rubro = "personalizable", identificador = "" } = {}, t = tCastellano) {
  const original = texto(frase);
  if (!original) return respuestaAsistente({ estado: "falta_informacion", explicacion: t("asistente.alta.vacio"), preguntas: [t("asistente.alta.pregunta")] });
  const telefono = original.match(/(?:\+?\d[\d ()-]{6,}\d)/)?.[0]?.replace(/[^\d+]/g, "") ?? "";
  const patente = original.match(/\b(?:[A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\s?\d{3})\b/i)?.[0]?.replace(/\s/g, "").toUpperCase() ?? "";
  const dni = original.match(/\b(?:DNI\s*)?(\d{7,8})\b/i)?.[1] ?? "";
  const serie = original.match(/(?:serie|serial|n[uú]mero)\s+([\w-]{3,})/i)?.[1] ?? "";
  const id = identificador || (rubro === "taller" ? patente : rubro === "medicina" ? dni : serie || patente || dni);
  let servicio = original.match(/(?:\bpor\s+(?:un|una|el|la)?\s*|\bporque\s+|\bpara\s+)(.+?)(?=\.\s*(?:lo|la)\s+va\s+a\s+atender|[.!?]|$)/i)?.[1]?.trim() ?? "";
  servicio = servicio.replace(/^(?:un|una|el|la)\s+/i, "");
  const responsable = responsableDeFrase(original, empleados);
  const propuesta = { nombre: nombreDeFrase(original), telefono, identificador: id, servicio, responsable: responsable.id };
  const faltantes = Object.entries(propuesta).filter(([clave, valor]) => clave !== "responsable" && !valor).map(([clave]) => clave);
  return respuestaAsistente({
    estado: Object.values(propuesta).some(Boolean) ? (faltantes.length ? "falta_informacion" : "listo") : "no_entendido",
    propuesta: { ...propuesta, faltantes },
    explicacion: Object.values(propuesta).some(Boolean) ? t("asistente.alta.encontrado") : t("asistente.alta.noEntendido"),
    preguntas: [
      ...faltantes.map((campo) => t(`asistente.alta.faltantes.${campo}`)),
      ...(responsable.ambiguo ? [t("asistente.alta.responsableAmbiguo")] : []),
    ],
  });
}

/** Combina sólo sobre campos vacíos y devuelve conflictos para revisión. */
export function reconciliarAlta(actual = {}, propuesta = {}) {
  const valores = { ...actual };
  const conflictos = [];
  for (const campo of ["nombre", "telefono", "identificador", "servicio", "responsable"]) {
    const sugerido = propuesta[campo];
    if (!sugerido) continue;
    if (actual[campo] && actual[campo] !== sugerido) conflictos.push({ campo, actual: actual[campo], sugerido });
    else valores[campo] = sugerido;
  }
  return { valores, conflictos };
}

/** Crea una ecuación sólo para los patrones locales documentados. */
export function proponerEcuacion(explicacion, t = tCastellano) {
  const frase = normal(explicacion);
  let ecuacion = null;
  const tarifa = frase.match(/horas?\s+por\s+([\d.,]+)/)?.[1]?.replace(/\./g, "").replace(",", ".");
  const margen = frase.match(/(?:con|mas|más)\s+(\d+(?:[.,]\d+)?)\s*%\s+de\s+margen/)?.[1]?.replace(",", ".");
  if (contiene(frase, ["material"]) && contiene(frase, ["hora"]) && tarifa) {
    ecuacion = {
      nombre: t("asistente.ecuaciones.precio.nombre"), descripcion: texto(explicacion),
      formula: margen ? "(materiales + horas * tarifa_hora) * (1 + margen / 100)" : "materiales + horas * tarifa_hora",
      variables: [
        variable("materiales", t("asistente.ecuaciones.precio.materiales"), "$"),
        variable("horas", t("asistente.ecuaciones.precio.horas"), "h"),
        variable("tarifa_hora", t("asistente.ecuaciones.precio.tarifa"), "$/h", "constante", Number(tarifa)),
        ...(margen ? [variable("margen", t("asistente.ecuaciones.precio.margen"), "%", "constante", Number(margen))] : []),
      ], dependencias: [], unidad_resultado: "$", categoria: t("asistente.ecuaciones.precio.categoria"),
    };
  } else if (contiene(frase, ["metro cuadrado", "metros cuadrados", "superficie"]) && contiene(frase, ["ancho"]) && contiene(frase, ["alto"])) {
    ecuacion = {
      nombre: t("asistente.ecuaciones.superficie.nombre"), descripcion: texto(explicacion), formula: "ancho * alto",
      variables: [variable("ancho", t("asistente.ecuaciones.superficie.ancho"), "m"), variable("alto", t("asistente.ecuaciones.superficie.alto"), "m")],
      dependencias: [], unidad_resultado: "m²", categoria: t("asistente.ecuaciones.superficie.categoria"),
    };
  } else if (contiene(frase, ["pintura"]) && contiene(frase, ["rendimiento"])) {
    ecuacion = {
      nombre: t("asistente.ecuaciones.pintura.nombre"), descripcion: texto(explicacion), formula: "superficie / rendimiento",
      variables: [variable("superficie", t("asistente.ecuaciones.pintura.superficie"), "m²"), variable("rendimiento", t("asistente.ecuaciones.pintura.rendimiento"), "m²/l")],
      dependencias: [], unidad_resultado: "l", categoria: t("asistente.ecuaciones.pintura.categoria"),
    };
  }
  if (!ecuacion) return respuestaAsistente({ estado: texto(explicacion) ? "no_entendido" : "falta_informacion", explicacion: t("asistente.ecuaciones.noEntendido"), preguntas: [t("asistente.ecuaciones.ejemplos")] });
  const validada = nuevaEcuacion(ecuacion, [], t);
  return validada.error
    ? respuestaAsistente({ estado: "no_entendido", explicacion: validada.error })
    : respuestaAsistente({ estado: "listo", propuesta: validada.ecuacion, explicacion: t("asistente.ecuaciones.lista"), suposiciones: margen ? [t("asistente.ecuaciones.margenSupuesto")] : [] });
}

export function explicarEcuacion(ecuacion, t = tCastellano) {
  const analisis = analizarFormula(ecuacion?.formula, t);
  if (analisis.error) return respuestaAsistente({ estado: "no_entendido", explicacion: analisis.error });
  const nombres = (ecuacion.variables ?? []).map((v) => v.descripcion || v.nombre).join(", ");
  const unidades = new Set((ecuacion.variables ?? []).map((v) => v.unidad).filter(Boolean));
  return respuestaAsistente({
    estado: "listo",
    propuesta: { formula: ecuacion.formula, variables: analisis.usadas },
    explicacion: t("asistente.ecuaciones.explicacion", { formula: ecuacion.formula, variables: nombres || t("asistente.ecuaciones.sinVariables"), unidad: ecuacion.unidad_resultado || t("asistente.ecuaciones.sinUnidad") }),
    suposiciones: unidades.size > 1 && !ecuacion.unidad_resultado ? [t("asistente.ecuaciones.revisarUnidades")] : [],
  });
}

export function revisarEcuacion(ecuacion, t = tCastellano) {
  const analisis = analizarFormula(ecuacion?.formula, t);
  if (!analisis.error) return respuestaAsistente({ estado: "listo", explicacion: t("asistente.ecuaciones.sinErrores") });
  const formula = texto(ecuacion?.formula);
  const abre = [...formula].filter((x) => x === "(").length;
  const cierra = [...formula].filter((x) => x === ")").length;
  if (abre > cierra) {
    const correccion = formula + ")".repeat(abre - cierra);
    if (!analizarFormula(correccion, t).error) return respuestaAsistente({ estado: "no_entendido", propuesta: { formula: correccion }, explicacion: t("asistente.ecuaciones.correccionParentesis", { formula: correccion }) });
  }
  return respuestaAsistente({ estado: "no_entendido", explicacion: analisis.error });
}

export function prepararResolucion(ecuacion, frase, t = tCastellano) {
  const numeros = [...texto(frase).matchAll(/(-?\d+(?:[.,]\d+)?)\s*([^\d,.;]*)/g)].map((m) => ({ valor: Number(m[1].replace(",", ".")), unidad: normal(m[2]) }));
  const entradas = {};
  const usadas = new Set();
  for (const v of (ecuacion?.variables ?? []).filter((x) => x.tipo !== "constante")) {
    const indice = numeros.findIndex((n, i) => !usadas.has(i) && (!v.unidad || n.unidad.includes(normal(v.unidad).split("/")[0]) || normal(frase).includes(normal(v.nombre))));
    if (indice >= 0) { entradas[v.id] = numeros[indice].valor; usadas.add(indice); }
  }
  const resuelta = resolverEcuacion(ecuacion, entradas, t);
  return resuelta.error
    ? respuestaAsistente({ estado: "falta_informacion", propuesta: { entradas }, explicacion: resuelta.error })
    : respuestaAsistente({ estado: "listo", propuesta: { entradas, resultado: resuelta.resultado }, explicacion: t("asistente.ecuaciones.resultado", { resultado: resuelta.resultado, unidad: ecuacion.unidad_resultado ?? "" }) });
}

/** Acciones contextuales del caso. */
export function asistirCaso(accion, contexto = {}, t = tCastellano) {
  const { caso = {}, cliente, empleados = [], pasos = [], insumos = [], eventos = [], respuestas = [], rubro, idioma = "es", nota = "" } = contexto;
  const mios = pasos.filter((p) => p.caso_id === caso.id);
  const productos = insumos.filter((i) => i.caso_id === caso.id && i.estado !== "en_stock");
  const responsable = empleados.find((e) => e.id === caso.responsable_id)?.nombre;
  const falta = queFalta(caso, { rubro, pasos, insumos, cliente, idioma }, t);
  if (accion === "resumen") {
    const ahora = new Date(contexto.ahora ?? Date.now()).getTime();
    const propios = eventos.filter((e) => e.caso_id === caso.id).slice().sort((a, b) => Date.parse(b.ocurrido_en) - Date.parse(a.ocurrido_en));
    const ultimos = propios.slice(0, 2).map((e) => e.titulo || e.detalle).filter(Boolean).join("; ") || t("asistente.caso.sinEventos");
    return respuestaAsistente({ estado: "listo", propuesta: { texto: t("asistente.caso.resumenTexto", { estado: contexto.estadoNombre || caso.estado, dias: Math.max(0, Math.floor((ahora - Date.parse(caso.abierto_en || ahora)) / 86400000)), responsable: responsable || t("asistente.caso.sinResponsable"), pasos: mios.length, aprobaciones: mios.filter((p) => p.estado === "esperando").length, productos: productos.length, eventos: propios.length, ultimos }) }, explicacion: t("asistente.caso.soloDatos") });
  }
  if (accion === "falta") return respuestaAsistente({ estado: "listo", propuesta: { texto: falta }, explicacion: t("asistente.caso.reglaReal") });
  if (accion === "proximo") return respuestaAsistente({ estado: "listo", propuesta: { texto: falta }, explicacion: t("asistente.caso.proximoExplicacion") });
  if (accion === "mensaje") return respuestaAsistente({ estado: cliente?.nombre ? "listo" : "falta_informacion", propuesta: { texto: t("asistente.caso.mensajeBorrador", { nombre: cliente?.nombre || t("casos.comun.elCliente"), caso: caso.nombre || caso.numero || "", estado: caso.estado, falta }) }, explicacion: t("asistente.caso.borrador") });
  if (accion === "nota") {
    const partes = texto(nota).split(/\n|[.;]+/).map((x) => x.trim()).filter(Boolean);
    const propuesta = partes.map((parte, i) => ({ id: `borrador-${i + 1}`, nombre: parte.replace(/\$?\s*[\d.]+(?:,\d+)?/g, "").trim(), monto: Number(parte.match(/\$?\s*([\d.]+(?:,\d+)?)/)?.[1]?.replace(/\./g, "").replace(",", ".")) || null }));
    return respuestaAsistente({ estado: propuesta.length ? "listo" : "falta_informacion", propuesta, explicacion: propuesta.length ? t("asistente.caso.pasosBorrador") : t("asistente.caso.faltaNota") });
  }
  if (accion === "respuesta") {
    const ultima = texto(respuestas.at(-1)?.texto ?? respuestas.at(-1)?.respuesta ?? respuestas.at(-1));
    if (!ultima) return respuestaAsistente({ estado: "falta_informacion", explicacion: t("asistente.caso.sinRespuesta") });
    const clasificacion = contiene(ultima, ["si", "sí", "apruebo", "dale", "ok", "yes"]) ? "aprobacion" : contiene(ultima, ["no", "rechazo", "cancel", "not"]) ? "rechazo" : "sin_clasificar";
    return respuestaAsistente({ estado: clasificacion === "sin_clasificar" ? "no_entendido" : "listo", propuesta: { clasificacion, texto: ultima }, explicacion: t(`asistente.caso.clasificacion.${clasificacion}`) });
  }
  return respuestaAsistente({ explicacion: t("asistente.caso.noEntendido") });
}

const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const elemento = (titulo, href, detalle = "") => ({ titulo, href, detalle });

/** Responde consultas cerradas con filtros verificables. */
export function consultarInicio(consulta, datos = {}, t = tCastellano) {
  const q = normal(consulta);
  if (!q) return respuestaAsistente({ estado: "falta_informacion", explicacion: t("asistente.inicio.vacio") });
  const { casos = [], pasos = [], insumos = [], turnos = [], empleados = [], cobros = [], modulosActivos = [], permisos = {}, ahora = new Date() } = datos;
  let items = [], criterio = "", permiso = true;
  const casosAbiertos = casos.filter((c) => c.estado !== "completado");
  if (contiene(q, ["resolver hoy", "resolve today"])) {
    const esperando = casosAbiertos.filter((c) => c.estado === "esperando");
    const bajos = estaPrendido("inventario", modulosActivos) && permisos.inventario !== false ? insumos.filter((i) => i.estado === "en_stock" && Number(i.cantidad) <= Number(i.minimo)) : [];
    const deHoy = estaPrendido("agenda", modulosActivos) && permisos.agenda !== false ? turnos.filter((x) => mismoDia(x.empieza_en, ahora) && !["cancelado", "atendido"].includes(x.estado)) : [];
    items = [...esperando.map((c) => elemento(c.nombre || `#${c.numero}`, `/casos/${c.id}`, t("asistente.inicio.esperando"))), ...bajos.map((i) => elemento(i.nombre, "/inventario", t("asistente.inicio.bajoMinimo"))), ...deHoy.map((x) => elemento(x.motivo, "/agenda", new Date(x.empieza_en).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })))];
    criterio = t("asistente.inicio.criterios.hoy");
  } else if (contiene(q, ["detenid", "esperando", "stuck", "waiting"])) {
    items = casosAbiertos.filter((c) => c.estado === "esperando").map((c) => elemento(c.nombre || `#${c.numero}`, `/casos/${c.id}`)); criterio = t("asistente.inicio.criterios.esperando");
  } else if (contiene(q, ["aprobacion", "aprobación", "approval"])) {
    permiso = estaPrendido("presupuesto", modulosActivos);
    const ids = new Set(pasos.filter((p) => p.estado === "esperando").map((p) => p.caso_id));
    items = casosAbiertos.filter((c) => ids.has(c.id)).map((c) => elemento(c.nombre || `#${c.numero}`, `/casos/${c.id}`)); criterio = t("asistente.inicio.criterios.aprobacion");
  } else if (contiene(q, ["stock", "minimo", "mínimo", "low inventory"])) {
    permiso = estaPrendido("inventario", modulosActivos) && permisos.inventario !== false;
    items = insumos.filter((i) => i.estado === "en_stock" && Number(i.cantidad) <= Number(i.minimo)).map((i) => elemento(i.nombre, "/inventario", `${i.cantidad} / ${i.minimo}`)); criterio = t("asistente.inicio.criterios.stock");
  } else if (contiene(q, ["turno", "cita", "appointment"])) {
    permiso = estaPrendido("agenda", modulosActivos) && permisos.agenda !== false;
    items = turnos.filter((x) => new Date(x.empieza_en) >= new Date(ahora) && !["cancelado", "atendido"].includes(x.estado)).slice().sort((a, b) => Date.parse(a.empieza_en) - Date.parse(b.empieza_en)).slice(0, 10).map((x) => elemento(x.motivo, "/agenda", new Date(x.empieza_en).toLocaleString())); criterio = t("asistente.inicio.criterios.turnos");
  } else if (contiene(q, ["carga", "integrante", "equipo", "workload"])) {
    permiso = estaPrendido("equipo", modulosActivos);
    items = empleados.map((e) => elemento(e.nombre, "/equipo", t("asistente.inicio.casosCantidad", { n: casosAbiertos.filter((c) => c.responsable_id === e.id).length }))); criterio = t("asistente.inicio.criterios.carga");
  } else if (contiene(q, ["sin responsable", "unassigned"])) {
    items = casosAbiertos.filter((c) => !c.responsable_id).map((c) => elemento(c.nombre || `#${c.numero}`, `/casos/${c.id}`)); criterio = t("asistente.inicio.criterios.sinResponsable");
  } else if (contiene(q, ["cobro", "actividad", "semana", "mes", "payment", "activity"])) {
    permiso = permisos.cobros !== false;
    const dias = contiene(q, ["mes", "month"]) ? 31 : 7;
    const desde = new Date(ahora).getTime() - dias * 86400000;
    items = cobros.filter((c) => Date.parse(c.creado_en || c.ocurrido_en) >= desde).map((c) => elemento(t("asistente.inicio.cobro"), c.caso_id ? `/casos/${c.caso_id}` : "/dashboard", String(c.monto ?? ""))); criterio = t("asistente.inicio.criterios.periodo", { dias });
  } else return respuestaAsistente({ estado: "no_entendido", explicacion: t("asistente.inicio.noEntendido") });
  if (!permiso) return respuestaAsistente({ estado: "falta_informacion", propuesta: { items: [], criterio }, explicacion: t("asistente.inicio.noDisponible") });
  return respuestaAsistente({ estado: "listo", propuesta: { items, criterio }, explicacion: items.length ? t("asistente.inicio.encontrados", { n: items.length }) : t("asistente.inicio.noEncontre") });
}

/** Prepara, sin ejecutar, un alta de Agenda o Inventario. */
export function prepararAccion(tipo, frase, t = tCastellano) {
  const original = texto(frase);
  if (!original) return respuestaAsistente({ estado: "falta_informacion", explicacion: t("asistente.acciones.vacio") });
  if (tipo === "agenda") {
    const nombreCliente = original.match(/(?:turno|cita|appointment)\s+(?:para|for)\s+([\p{L}' -]+?)(?=\s+(?:mañana|hoy|el|a las|para)|[,.;]|$)/iu)?.[1]?.trim() ?? "";
    const hora = original.match(/(?:a las|at)\s+(\d{1,2})(?::(\d{2}))?/i);
    const fecha = new Date();
    if (contiene(original, ["mañana", "tomorrow"])) fecha.setDate(fecha.getDate() + 1);
    if (hora) fecha.setHours(Number(hora[1]), Number(hora[2] || 0), 0, 0);
    const motivos = [...original.matchAll(/(?:\bpor\b|\bfor\b)\s+([^,.]+)$/gi)];
    const motivo = motivos.at(-1)?.[1]?.trim() ?? "";
    const pad = (n) => String(n).padStart(2, "0");
    const fechaLocal = `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
    const propuesta = { nombreCliente, motivo, empiezaEn: hora ? fechaLocal : "" };
    const faltantes = Object.entries(propuesta).filter(([, v]) => !v).map(([k]) => k);
    return respuestaAsistente({ estado: faltantes.length ? "falta_informacion" : "listo", propuesta: { ...propuesta, faltantes }, explicacion: t("asistente.acciones.revisar") });
  }
  const cantidad = Number(original.match(/\b(\d+)\b/)?.[1]) || "";
  const nombre = original.match(/(?:agregar|cargar|sumar|comprar|add|stock)\s+(?:\d+\s+)?(.+?)(?=\s+(?:mínimo|minimo|marca|modelo)|[,.;]|$)/i)?.[1]?.trim() ?? "";
  const minimo = Number(original.match(/m[ií]nimo\s+(\d+)/i)?.[1]) || "";
  const propuesta = { nombre, cantidad: cantidad ? String(cantidad) : "", minimo: minimo ? String(minimo) : "", marca: "", modelo: "", categoria: "", unidad: "unidad", porCaja: "" };
  const faltantes = ["nombre", "cantidad"].filter((k) => !propuesta[k]);
  return respuestaAsistente({ estado: faltantes.length ? "falta_informacion" : "listo", propuesta: { ...propuesta, faltantes }, explicacion: t("asistente.acciones.revisar") });
}

