// El Asistente de la barra lateral (/asistente).
//
// Conversa con la API (POST /v1/asistente), que le pregunta a un modelo de IA.
// El modelo contesta y, si la persona pidió cambiar la configuración del
// negocio, devuelve una PROPUESTA. Acá no se aplica nada solo: la pantalla
// la muestra y se aplica recién cuando la persona toca "Aplicar".
//
// Lo que se puede proponer es lo que el negocio ya configura a mano, con el
// rubro "personalizable" como esqueleto: prender y apagar módulos y sus
// pantallas, el nombre y el ícono de los cinco estados, cómo se nombran los
// casos, y el rubro mientras no haya casos.
//
// La conversación vive en el navegador (localStorage), una por negocio. No
// se guarda en la base.
//
// Las funciones de acá son puras, salvo conversar() y el almacenamiento: las
// prueba pruebas/asistente.test.js.

import { mandar } from "./api.js";
import { mismaExpresion } from "./ecuaciones.js";
import { ORDEN_ESTADOS } from "./estados.js";
import { tCastellano } from "./idioma.js";
import { LISTA_MODULOS, MODULOS, SUBMODULOS, alternarModulo, estaPrendido, hijosActivos, hijosDe, traducirModulo } from "./modulos.js";
import { configuracionEstadosValida, configuracionInicialEstados, presentacionEstado } from "./presentacion-estados.js";
import { RUBROS, preset } from "./presets.js";

// Lo que se guarda de una conversación y lo que viaja a la API. La API lee
// sólo los últimos 20 mensajes; los demás quedan para que la persona los vea.
export const MAX_GUARDADOS = 60;
const MAX_TEXTO = 2000;

const recortar = (texto, max) => String(texto ?? "").trim().slice(0, max);

// ------------------------------------------------------------
// El contexto: cómo está el negocio, para que el modelo proponga con sentido
// ------------------------------------------------------------

// Si una clave (módulo o pantalla de adentro) está prendida.
export function prendidoEn(clave, activos = []) {
  const sub = SUBMODULOS[clave];
  if (sub) return hijosActivos(sub.padre, activos).some((h) => h.clave === clave);
  return estaPrendido(clave, activos);
}

export function armarContexto({ negocio, tieneCasos = false, pantalla, ecuaciones = [], idioma = "es", t = tCastellano }) {
  const activos = negocio?.modulos_activos ?? [];
  const modulos = LISTA_MODULOS.flatMap((m) => [m, ...hijosDe(m.clave)]).map((m) => {
    const traducido = traducirModulo(m, t);
    return {
      clave: m.clave,
      nombre: recortar(traducido.nombre, 80),
      padre: m.padre ?? null,
      queHace: recortar(traducido.queHace, 800),
      prendido: prendidoEn(m.clave, activos),
      ...(m.aPedido ? { aPedido: true } : {}),
    };
  });
  const estados = ORDEN_ESTADOS.map((clave) => {
    const { nombre, icono } = presentacionEstado(negocio, clave, idioma);
    return { clave, nombre: recortar(nombre, 40), icono };
  });
  const rubros = RUBROS.map((r) => {
    const p = preset(r.clave, idioma);
    return { clave: r.clave, nombre: recortar(p.nombre, 80), queEs: recortar(p.queEs, 300) };
  });
  return {
    ...(pantalla ? { pantalla: recortar(pantalla, 200) } : {}),
    rubro: negocio?.rubro ?? "taller",
    tieneCasos: Boolean(tieneCasos),
    nombrarCasos: negocio?.nombrar_casos ?? "numero",
    modulos,
    estados,
    rubros,
    // Las que ya guardó, para que no las proponga de nuevo.
    ecuaciones: ecuaciones.slice(0, 50).map((e) => ({
      nombre: recortar(e.nombre, 200),
      formula: recortar(e.formula, 2000),
      ...(e.categoria ? { categoria: recortar(e.categoria, 100) } : {}),
    })),
  };
}

// ------------------------------------------------------------
// Aplicar una propuesta
// ------------------------------------------------------------

// La lista de módulos después de la propuesta. Pasa por alternarModulo(),
// que es quien sabe las reglas (los de fábrica, los hijos, el último hijo):
// acá sólo se decide qué tocar. Primero se apaga y después se prende.
//
// Prender una pantalla de un módulo apagado prende primero el módulo: una
// pantalla no existe sin su padre.
export function modulosConPropuesta(activos = [], { prender = [], apagar = [] } = {}) {
  let lista = [...activos];
  for (const clave of apagar) {
    if (prendidoEn(clave, lista)) lista = alternarModulo(clave, lista);
  }
  for (const clave of prender) {
    const padre = SUBMODULOS[clave]?.padre;
    if (padre && !prendidoEn(padre, lista)) lista = alternarModulo(padre, lista);
    if (!prendidoEn(clave, lista)) lista = alternarModulo(clave, lista);
  }
  return lista;
}

// Los cinco estados después de la propuesta, listos para guardar. null si no
// quedan válidos (no debería pasar: la API ya limpió la propuesta).
export function estadosConPropuesta(negocio, cambios = [], idioma = "es") {
  const config = configuracionInicialEstados(negocio, idioma);
  for (const { clave, nombre, icono } of cambios) {
    if (!config[clave]) continue;
    config[clave] = {
      nombre: nombre?.trim() || config[clave].nombre,
      icono: icono || config[clave].icono,
    };
  }
  return configuracionEstadosValida(config) ? config : null;
}

// Lo que hay que guardar, en la forma de datos.aplicarConfiguracion(). Sólo
// lo que cambia.
export function cambiosDePropuesta(propuesta, negocio, idioma = "es") {
  const cambios = {};
  if (propuesta?.prender?.length || propuesta?.apagar?.length) {
    const activos = negocio?.modulos_activos ?? [];
    const nuevos = modulosConPropuesta(activos, propuesta);
    if (JSON.stringify(nuevos) !== JSON.stringify(activos)) {
      cambios.modulos = nuevos;
      // En qué orden se pidieron: así entran sus tarjetas al Inicio.
      cambios.prendidos = [...(propuesta.prender ?? [])];
    }
  }
  if (propuesta?.estados?.length) {
    const estados = estadosConPropuesta(negocio, propuesta.estados, idioma);
    if (estados) cambios.estados = estados;
  }
  if (propuesta?.nombrarCasos) cambios.nombrar_casos = propuesta.nombrarCasos;
  if (propuesta?.rubro) cambios.rubro = propuesta.rubro;
  return cambios;
}

// Los renglones que ve la persona antes de decidir, en su idioma.
export function describirPropuesta(propuesta, negocio, { idioma = "es", t = tCastellano } = {}) {
  const nombre = (clave) => traducirModulo(MODULOS[clave] ?? SUBMODULOS[clave], t)?.nombre ?? clave;
  const lista = (claves) => claves.map(nombre).join(", ");
  const renglones = [];
  if (propuesta?.prender?.length) renglones.push(t("asistente.cambios.prender", { modulos: lista(propuesta.prender) }));
  if (propuesta?.apagar?.length) renglones.push(t("asistente.cambios.apagar", { modulos: lista(propuesta.apagar) }));
  for (const { clave, nombre: nuevo, icono } of propuesta?.estados ?? []) {
    const actual = presentacionEstado(negocio, clave, idioma)?.nombre ?? clave;
    if (nuevo) renglones.push(t("asistente.cambios.estadoNombre", { antes: actual, despues: nuevo }));
    if (icono) {
      renglones.push(t("asistente.cambios.estadoIcono", { estado: nuevo ?? actual, icono: t(`casos.iconos.${icono}`, {}, icono) }));
    }
  }
  if (propuesta?.nombrarCasos) {
    const identificador = preset(negocio?.rubro, idioma).identificador?.enFrase ?? "";
    renglones.push(t("asistente.cambios.nombrar", {
      modo: t(`negocio.nombres.${propuesta.nombrarCasos}`, { identificador }, propuesta.nombrarCasos).toLowerCase(),
    }));
  }
  if (propuesta?.rubro) renglones.push(t("asistente.cambios.rubro", { rubro: preset(propuesta.rubro, idioma).nombre }));
  return renglones;
}

// ------------------------------------------------------------
// La conversación
// ------------------------------------------------------------
// Cada mensaje: { rol: "usuario" | "asistente", texto, propuesta?, estado? }.
// "estado" es lo que pasó con la propuesta: "pendiente", "aplicada" o
// "descartada".

export function mensajesParaLaApi(conversacion = []) {
  return conversacion
    .filter((m) => (m.rol === "usuario" || m.rol === "asistente") && recortar(m.texto, MAX_TEXTO))
    .slice(-MAX_GUARDADOS)
    .map((m) => ({ rol: m.rol, texto: recortar(m.texto, MAX_TEXTO) }));
}

// Devuelve { ok, datos: { texto, propuesta } } o { ok: false, error }, como
// toda la frontera. El modelo puede tardar: se le da más tiempo que al resto.
export function conversar(conversacion, contexto, token, opciones = {}) {
  return mandar("/asistente", { mensajes: mensajesParaLaApi(conversacion), contexto }, token, { segundos: 45, ...opciones });
}

// ------------------------------------------------------------
// Dónde queda guardada: en el navegador, una por negocio
// ------------------------------------------------------------
// El almacenamiento puede no estar (ventana privada, sitio bloqueado): ahí la
// conversación dura lo que dura la pantalla, y nada se rompe.

const claveDe = (negocioId) => `asistente:${negocioId}`;

export function leerConversacion(negocioId, almacen = globalThis.localStorage) {
  if (!negocioId) return [];
  try {
    const leida = JSON.parse(almacen?.getItem(claveDe(negocioId)) ?? "[]");
    return Array.isArray(leida)
      ? leida.filter((m) => (m?.rol === "usuario" || m?.rol === "asistente") && typeof m.texto === "string")
      : [];
  } catch {
    return [];
  }
}

export function guardarConversacion(negocioId, conversacion, almacen = globalThis.localStorage) {
  if (!negocioId) return;
  try {
    almacen?.setItem(claveDe(negocioId), JSON.stringify(conversacion.slice(-MAX_GUARDADOS)));
  } catch {
    // Sin lugar o sin permiso: sigue en memoria.
  }
}

export function borrarConversacion(negocioId, almacen = globalThis.localStorage) {
  if (!negocioId) return;
  try {
    almacen?.removeItem(claveDe(negocioId));
  } catch {
    // Nada que hacer.
  }
}

// ------------------------------------------------------------
// El texto del asistente
// ------------------------------------------------------------
// El modelo escribe con un poco de Markdown: listas con "-" y **negritas**.
// Se parte en bloques y tramos para dibujarlos con elementos de React, sin
// meter HTML de afuera en la página.

export function partirTexto(texto = "") {
  const bloques = [];
  for (const renglon of String(texto).split("\n")) {
    const item = renglon.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      const ultimo = bloques.at(-1);
      if (ultimo?.tipo === "lista") ultimo.items.push(tramos(item[1]));
      else bloques.push({ tipo: "lista", items: [tramos(item[1])] });
    } else if (renglon.trim()) {
      bloques.push({ tipo: "parrafo", tramos: tramos(renglon.trim()) });
    }
  }
  return bloques;
}

function tramos(renglon) {
  return renglon.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((parte) => (
    parte.startsWith("**") && parte.endsWith("**") && parte.length > 4
      ? { negrita: true, texto: parte.slice(2, -2) }
      : { negrita: false, texto: parte }
  ));
}

// ------------------------------------------------------------
// Las ecuaciones que arma
// ------------------------------------------------------------
// La API las devuelve ya limpias (nombre, fórmula, variables con sus
// unidades). Se agregan de a una, cuando la persona toca "Agregar", por la
// misma acción que usa la pantalla de Ecuaciones: datos.crearEcuacion().

// El formulario de crearEcuacion(). Cada variable necesita su id.
export function formularioDeEcuacion(ecuacion, { confirmarVariante = false } = {}) {
  return {
    nombre: ecuacion.nombre,
    formula: ecuacion.formula,
    descripcion: ecuacion.descripcion ?? "",
    categoria: ecuacion.categoria ?? "",
    unidad_resultado: ecuacion.unidad_resultado ?? "",
    variables: (ecuacion.variables ?? []).map((v, i) => ({
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${i}`,
      tipo: v.tipo === "constante" ? "constante" : "variable",
      nombre: v.nombre,
      descripcion: v.descripcion ?? "",
      valor: v.valor ?? null,
      unidad: v.unidad ?? "",
    })),
    dependencias: [],
    confirmarVariante,
  };
}

// Si el negocio ya tiene una ecuación con la misma fórmula: el nombre de esa.
export function igualA(ecuacion, guardadas = []) {
  return guardadas.find((g) => mismaExpresion(g.formula, ecuacion.formula))?.nombre ?? null;
}

// Cómo se lee una variable en la tarjeta: «tarifa = 15000 $/h» o «horas (h)».
export function leerVariable(v) {
  const unidad = v.unidad ? ` ${v.unidad}` : "";
  if (v.tipo === "constante") return `${v.nombre} = ${v.valor}${unidad}`;
  return v.unidad ? `${v.nombre} (${v.unidad})` : v.nombre;
}
