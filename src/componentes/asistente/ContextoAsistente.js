"use client";

// El estado del Asistente (src/lib/asistente.js), compartido por toda la app.
//
// Vive en el marco (Guardia), no en una pantalla: así la conversación sigue
// abierta mientras la persona va de Mi negocio a Casos o a Ecuaciones, y una
// respuesta que llega a mitad de camino no se pierde. El panel chico y la
// pantalla completa son dos formas de mirar la MISMA conversación.
//
// "modo" es cómo se ve: "cerrado" (sólo el botón para abrirlo), "panel" (al
// costado, con la pantalla de trabajo a la vista) o "completo" (todo el
// ancho, para leer tranquilo). Si quedó abierto o cerrado se recuerda en este
// navegador; es una comodidad de cada persona, no algo del negocio.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { textoDeError } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";
import {
  armarContexto,
  borrarConversacion,
  cambiosDePropuesta,
  conversar,
  formularioDeEcuacion,
  guardarConversacion,
  igualA,
  leerConversacion,
} from "@/lib/asistente";

const Contexto = createContext(null);

const LLAVE_MODO = "marmanager.asistente-modo";
const MODOS = ["cerrado", "panel", "completo"];

export function useAsistente() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useAsistente va adentro de <ProveedorAsistente>");
  return valor;
}

export function ProveedorAsistente({ children }) {
  const datos = useDatos();
  const { negocio, casos } = datos;
  const { sesion } = useAuth();
  const { t, idioma } = useIdioma();
  const ruta = usePathname();

  const negocioId = negocio?.id;
  const [modo, setModo] = useState("cerrado");
  // Sube cada vez que la PERSONA abre o agranda el panel. El panel mueve el
  // foco al campo sólo entonces: si se abre solo al cargar (porque quedó
  // abierto), no le saca el foco a la pantalla de trabajo.
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const [conversacion, setConversacion] = useState([]);
  const [pensando, setPensando] = useState(false);
  const [aplicando, setAplicando] = useState(null);
  const [agregando, setAgregando] = useState(null);
  const [error, setError] = useState(null);
  // La última versión, para las acciones que terminan después de un await.
  const ultima = useRef(conversacion);
  ultima.current = conversacion;

  // Se lee después de montar: en el servidor no hay localStorage.
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(LLAVE_MODO);
      if (MODOS.includes(guardado)) setModo(guardado === "completo" ? "panel" : guardado);
    } catch {
      // Sin almacenamiento arranca cerrado.
    }
  }, []);

  const cambiarModo = useCallback((nuevo) => {
    setModo(nuevo);
    if (nuevo !== "cerrado") setPedidoDeFoco((n) => n + 1);
    try {
      // La pantalla completa se recuerda como panel: al volver a entrar, la
      // pantalla de trabajo tiene que verse.
      if (nuevo === "cerrado") window.localStorage.removeItem(LLAVE_MODO);
      else window.localStorage.setItem(LLAVE_MODO, "panel");
    } catch {
      // Si no se puede guardar, igual cambia; sólo no se recuerda.
    }
  }, []);

  // La conversación de este negocio, la que quedó en el navegador.
  useEffect(() => {
    setConversacion(leerConversacion(negocioId));
    setError(null);
  }, [negocioId]);

  // Siempre sobre la última versión: una respuesta que llega tarde, o varias
  // ecuaciones agregadas seguidas, no pisan lo que cambió mientras tanto.
  const actualizarCon = useCallback((cambio) => setConversacion((previa) => {
    const nueva = cambio(previa);
    guardarConversacion(negocioId, nueva);
    return nueva;
  }), [negocioId]);

  const tieneCasos = (casos?.length ?? 0) > 0;
  const guardadas = datos.ecuaciones ?? [];

  async function mandarMensaje(texto) {
    const limpio = texto.trim();
    if (!limpio || pensando) return false;
    const conLaPregunta = [...ultima.current, { rol: "usuario", texto: limpio }];
    actualizarCon(() => conLaPregunta);
    setError(null);
    setPensando(true);
    // "pantalla" es dónde está la persona ahora: con el panel abierto al
    // costado, "esto" casi siempre es lo que tiene delante.
    const contexto = armarContexto({ negocio, tieneCasos, pantalla: ruta, ecuaciones: guardadas, idioma, t });
    const r = await conversar(conLaPregunta, contexto, sesion?.access_token);
    setPensando(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    const { texto: respuesta, propuesta, ecuaciones } = r.datos;
    actualizarCon((previa) => [...previa, {
      rol: "asistente",
      texto: respuesta,
      ...(propuesta ? { propuesta, estado: "pendiente" } : {}),
      ...(ecuaciones?.length ? { ecuaciones: ecuaciones.map((e) => ({ ...e, estado: "pendiente" })) } : {}),
    }]);
    return true;
  }

  // Cambia el estado de la propuesta del mensaje i y suma lo que pasó, para
  // que el asistente lo sepa en el próximo mensaje.
  const cerrarPropuesta = (i, estado, aviso) => actualizarCon((previa) => [
    ...previa.map((m, j) => (j === i ? { ...m, estado } : m)),
    { rol: "asistente", texto: aviso },
  ]);

  async function aplicar(i) {
    const { propuesta } = ultima.current[i];
    if (propuesta.rubro && tieneCasos) {
      setError({ codigo: "rubro_fijo", mensaje: t("asistente.rubroConCasos") });
      return;
    }
    const cambios = cambiosDePropuesta(propuesta, negocio, idioma);
    if (!Object.keys(cambios).length) {
      cerrarPropuesta(i, "aplicada", t("asistente.sinCambios"));
      return;
    }
    setAplicando(i);
    setError(null);
    const r = await datos.aplicarConfiguracion(cambios);
    setAplicando(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    cerrarPropuesta(i, "aplicada", t("asistente.avisoAplicado"));
  }

  const descartar = (i) => cerrarPropuesta(i, "descartada", t("asistente.avisoDescartado"));

  // Cambia una ecuación propuesta (la k del mensaje i).
  const cambiarEcuacion = (i, k, cambios) => actualizarCon((previa) => previa.map((m, j) => (
    j === i ? { ...m, ecuaciones: m.ecuaciones.map((e, l) => (l === k ? { ...e, ...cambios } : e)) } : m
  )));

  // Por la misma acción que la pantalla de Ecuaciones. "confirmarVariante"
  // es el "Agregar igualmente" de una que ya existe con la misma fórmula.
  async function agregarEcuacion(i, k, { confirmarVariante = false } = {}) {
    const ecuacion = ultima.current[i].ecuaciones[k];
    setAgregando(`${i}-${k}`);
    setError(null);
    const r = await datos.crearEcuacion(formularioDeEcuacion(ecuacion, { confirmarVariante }));
    setAgregando(null);
    if (r.ok) return cambiarEcuacion(i, k, { estado: "agregada", error: null }), true;
    if (r.duplicada) return cambiarEcuacion(i, k, { estado: "duplicada", error: null }), false;
    cambiarEcuacion(i, k, { estado: "error", error: typeof r.error === "string" ? r.error : textoDeError(t, r.error) });
    return false;
  }

  async function agregarTodas(i) {
    const lista = ultima.current[i].ecuaciones;
    for (let k = 0; k < lista.length; k++) {
      if (lista[k].estado === "pendiente" && !igualA(lista[k], datos.ecuaciones ?? [])) await agregarEcuacion(i, k);
    }
  }

  function empezarDeNuevo() {
    borrarConversacion(negocioId);
    setConversacion([]);
    setError(null);
  }

  const valor = {
    modo,
    pedidoDeFoco,
    abrir: () => cambiarModo("panel"),
    cerrar: () => cambiarModo("cerrado"),
    agrandar: () => cambiarModo("completo"),
    achicar: () => cambiarModo("panel"),
    cambiarModo,
    conversacion,
    pensando,
    aplicando,
    agregando,
    error,
    mandarMensaje,
    aplicar,
    descartar,
    agregarEcuacion,
    agregarTodas,
    empezarDeNuevo,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

// Para quien sólo necesita abrirlo (el botón de "Más" en el celular, la
// dirección vieja /asistente) sin depender del resto.
export function useAbrirAsistente() {
  const { cambiarModo } = useAsistente();
  return useMemo(() => ({
    abrir: () => cambiarModo("panel"),
    agrandar: () => cambiarModo("completo"),
  }), [cambiarModo]);
}
