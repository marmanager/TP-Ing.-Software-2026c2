"use client";

// El Asistente (src/lib/asistente.js): un chat para preguntar cómo se usa la
// app, contar un problema o pedir que configure el negocio.
//
// Lo que propone cambiar no se aplica solo: aparece en una tarjeta con lo
// que va a cambiar y dos botones. Sólo "Aplicar" escribe, y escribe por las
// mismas acciones que usan las pantallas de Mi negocio.
//
// La conversación queda en este navegador, una por negocio.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { textoDeError } from "@/lib/idioma";
import { puede } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import { useTitulo } from "@/lib/useTitulo";
import {
  armarContexto,
  borrarConversacion,
  cambiosDePropuesta,
  conversar,
  describirPropuesta,
  formularioDeEcuacion,
  guardarConversacion,
  igualA,
  leerConversacion,
  leerVariable,
  partirTexto,
  prendidoEn,
} from "@/lib/asistente";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, TituloPantalla } from "@/componentes/ui";

const SUGERENCIAS = ["modulos", "noVeo", "estados", "ecuaciones", "personalizable"];

export default function Asistente() {
  const datos = useDatos();
  const { cargando, negocio, casos } = datos;
  const { usuario, sesion } = useAuth();
  const { t, idioma } = useIdioma();
  useTitulo(t("asistente.titulo"));

  const negocioId = negocio?.id;
  const [conversacion, setConversacion] = useState([]);
  const [borrador, setBorrador] = useState("");
  const [pensando, setPensando] = useState(false);
  const [aplicando, setAplicando] = useState(null);
  const [agregando, setAgregando] = useState(null);
  const [error, setError] = useState(null);
  const fin = useRef(null);
  const campo = useRef(null);

  // La conversación de este negocio, la que quedó en el navegador.
  useEffect(() => {
    setConversacion(leerConversacion(negocioId));
    setError(null);
  }, [negocioId]);

  useEffect(() => {
    fin.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [conversacion.length, pensando]);

  if (cargando) return <Cargando />;

  const puedeConfigurar = puede(usuario, "configurar_negocio");
  // Crear ecuaciones pide lo mismo que la pantalla de Ecuaciones.
  const puedeEcuaciones = puede(usuario, "armar_presupuesto");
  const ecuacionesPrendido = prendidoEn("ecuaciones", negocio?.modulos_activos ?? []);
  const guardadas = datos.ecuaciones ?? [];
  const tieneCasos = (casos?.length ?? 0) > 0;

  const actualizar = (nueva) => {
    setConversacion(nueva);
    guardarConversacion(negocioId, nueva);
  };
  // Sobre la última versión: agregar varias ecuaciones seguidas no pisa lo
  // que cambió la anterior.
  const actualizarCon = (cambio) => setConversacion((previa) => {
    const nueva = cambio(previa);
    guardarConversacion(negocioId, nueva);
    return nueva;
  });

  async function mandarMensaje(texto) {
    const limpio = texto.trim();
    if (!limpio || pensando) return;
    const conLaPregunta = [...conversacion, { rol: "usuario", texto: limpio }];
    actualizar(conLaPregunta);
    setBorrador("");
    setError(null);
    setPensando(true);
    const contexto = armarContexto({ negocio, tieneCasos, pantalla: "/asistente", ecuaciones: guardadas, idioma, t });
    const r = await conversar(conLaPregunta, contexto, sesion?.access_token);
    setPensando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const { texto: respuesta, propuesta, ecuaciones } = r.datos;
    actualizar([...conLaPregunta, {
      rol: "asistente",
      texto: respuesta,
      ...(propuesta ? { propuesta, estado: "pendiente" } : {}),
      ...(ecuaciones?.length ? { ecuaciones: ecuaciones.map((e) => ({ ...e, estado: "pendiente" })) } : {}),
    }]);
    campo.current?.focus();
  }

  // Cambia el estado de la propuesta del mensaje i y suma lo que pasó, para
  // que el asistente lo sepa en el próximo mensaje.
  const cerrarPropuesta = (i, estado, aviso) => {
    const nueva = conversacion.map((m, j) => (j === i ? { ...m, estado } : m));
    actualizar([...nueva, { rol: "asistente", texto: aviso }]);
  };

  async function aplicar(i) {
    const { propuesta } = conversacion[i];
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

  // Cambia una ecuación propuesta (la k del mensaje i).
  const cambiarEcuacion = (i, k, cambios) => actualizarCon((previa) => previa.map((m, j) => (
    j === i ? { ...m, ecuaciones: m.ecuaciones.map((e, l) => (l === k ? { ...e, ...cambios } : e)) } : m
  )));

  // Por la misma acción que la pantalla de Ecuaciones. "confirmarVariante"
  // es el "Agregar igualmente" de una que ya existe con la misma fórmula.
  async function agregarEcuacion(i, k, { confirmarVariante = false } = {}) {
    const ecuacion = conversacion[i].ecuaciones[k];
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
    const lista = conversacion[i].ecuaciones;
    for (let k = 0; k < lista.length; k++) {
      if (lista[k].estado === "pendiente" && !igualA(lista[k], datos.ecuaciones ?? [])) await agregarEcuacion(i, k);
    }
  }

  function empezarDeNuevo() {
    borrarConversacion(negocioId);
    setConversacion([]);
    setError(null);
    campo.current?.focus();
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TituloPantalla apoyo={t("asistente.apoyo")}>{t("asistente.titulo")}</TituloPantalla>
        {conversacion.length > 0 && (
          <Boton variante="plano" icono="deshacer" onClick={empezarDeNuevo} disabled={pensando}>
            {t("asistente.empezarDeNuevo")}
          </Boton>
        )}
      </div>

      {conversacion.length === 0 && (
        <section className="mb-6 rounded-tarjeta border border-borde bg-tarjeta p-4 sm:p-6">
          <p className="flex items-center gap-2 font-bold text-subtitulo">
            <Icono nombre="chat" className="size-6" />
            {t("asistente.vacioTitulo")}
          </p>
          <p className="mt-2 text-tinta-media">{t("asistente.vacioTexto")}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {SUGERENCIAS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => mandarMensaje(t(`asistente.sugerencias.${s}`))}
                  className="min-h-12 rounded-full border-2 border-borde-fuerte bg-tarjeta px-4 py-2 text-left font-bold text-azul hover:bg-azul-claro"
                >
                  {t(`asistente.sugerencias.${s}`)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ol className="grid gap-4" aria-live="polite">
        {conversacion.map((m, i) => (
          <li key={i} className={m.rol === "usuario" ? "flex justify-end" : "flex justify-start"}>
            <div className="max-w-[min(42rem,100%)]">
              <p className={`mb-1 text-etiqueta font-bold text-tinta-suave ${m.rol === "usuario" ? "text-right" : ""}`}>
                {m.rol === "usuario" ? t("asistente.vos") : t("asistente.nombre")}
              </p>
              <div
                className={
                  m.rol === "usuario"
                    ? "whitespace-pre-wrap rounded-tarjeta bg-azul px-4 py-3 text-white"
                    : "rounded-tarjeta border border-borde bg-tarjeta px-4 py-3"
                }
              >
                {m.rol === "usuario" ? m.texto : <TextoDelAsistente texto={m.texto} />}
              </div>
              {m.ecuaciones?.length > 0 && (
                <EcuacionesPropuestas
                  ecuaciones={m.ecuaciones}
                  guardadas={guardadas}
                  puedeEcuaciones={puedeEcuaciones}
                  moduloPrendido={ecuacionesPrendido}
                  agregando={agregando}
                  prefijo={i}
                  ocupado={agregando !== null || pensando}
                  alAgregar={(k, opciones) => agregarEcuacion(i, k, opciones)}
                  alAgregarTodas={() => agregarTodas(i)}
                  t={t}
                />
              )}
              {m.propuesta && (
                <Propuesta
                  mensaje={m}
                  renglones={describirPropuesta(m.propuesta, negocio, { idioma, t })}
                  puedeConfigurar={puedeConfigurar}
                  aplicando={aplicando === i}
                  ocupado={aplicando !== null || pensando}
                  alAplicar={() => aplicar(i)}
                  alDescartar={() => cerrarPropuesta(i, "descartada", t("asistente.avisoDescartado"))}
                  t={t}
                />
              )}
            </div>
          </li>
        ))}
        {pensando && (
          <li className="flex justify-start">
            <p className="flex items-center gap-2 rounded-tarjeta border border-borde bg-tarjeta px-4 py-3 text-tinta-media">
              <span className="inline-block size-3 animate-pulse rounded-full bg-azul" aria-hidden="true" />
              {t("asistente.pensando")}
            </p>
          </li>
        )}
      </ol>
      <div ref={fin} />

      {error && (
        <div className="mt-4">
          <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>
        </div>
      )}

      <form
        className="sticky bottom-20 mt-6 rounded-tarjeta border-2 border-borde bg-fondo p-3 md:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          mandarMensaje(borrador);
        }}
      >
        <label htmlFor="mensaje-asistente" className="mb-1 block font-bold">
          {t("asistente.escribir")}
        </label>
        <p id="ayuda-asistente" className="mb-2 text-apoyo text-tinta-suave">
          {t("asistente.escribirAyuda")}
        </p>
        <div className="flex items-end gap-2">
          <textarea
            id="mensaje-asistente"
            ref={campo}
            rows={2}
            maxLength={2000}
            value={borrador}
            aria-describedby="ayuda-asistente"
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                mandarMensaje(borrador);
              }
            }}
            className="min-h-12 w-full resize-y rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 py-3 text-cuerpo"
          />
          <Boton
            type="submit"
            variante="principal"
            icono="flecha"
            disabled={pensando || !borrador.trim()}
          >
            {t("asistente.enviar")}
          </Boton>
        </div>
      </form>
    </>
  );
}

function TextoDelAsistente({ texto }) {
  return (
    <div className="grid gap-2">
      {partirTexto(texto).map((bloque, i) =>
        bloque.tipo === "lista" ? (
          <ul key={i} className="grid list-disc gap-1 pl-5">
            {bloque.items.map((item, j) => (
              <li key={j}><Tramos tramos={item} /></li>
            ))}
          </ul>
        ) : (
          <p key={i}><Tramos tramos={bloque.tramos} /></p>
        )
      )}
    </div>
  );
}

function Tramos({ tramos }) {
  return tramos.map((tramo, i) => (tramo.negrita ? <strong key={i}>{tramo.texto}</strong> : <span key={i}>{tramo.texto}</span>));
}

function Propuesta({ mensaje, renglones, puedeConfigurar, aplicando, ocupado, alAplicar, alDescartar, t }) {
  const { estado } = mensaje;
  return (
    <div
      className={[
        "mt-2 rounded-tarjeta border-2 p-4",
        estado === "pendiente" ? "border-azul bg-azul-claro" : "border-borde bg-superficie",
      ].join(" ")}
    >
      <p className="flex items-center gap-2 font-bold">
        <Icono nombre={estado === "aplicada" ? "listo" : estado === "descartada" ? "cruz" : "tienda"} className="size-5" />
        {t("asistente.propuestaTitulo")}
      </p>
      <ul className="mt-2 grid list-disc gap-1 pl-6">
        {renglones.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      {estado === "pendiente" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton
            variante="principal"
            icono="listo"
            onClick={alAplicar}
            disabled={ocupado}
            motivo={puedeConfigurar ? undefined : t("asistente.sinPermiso")}
          >
            {aplicando ? t("asistente.aplicando") : t("asistente.aplicar")}
          </Boton>
          <Boton variante="neutro" icono="cruz" onClick={alDescartar} disabled={ocupado}>
            {t("asistente.descartar")}
          </Boton>
        </div>
      )}
      {estado === "aplicada" && <p className="mt-3 font-bold text-etiqueta text-azul">{t("asistente.aplicada")}</p>}
      {estado === "descartada" && <p className="mt-3 font-bold text-etiqueta text-tinta-media">{t("asistente.descartada")}</p>}
    </div>
  );
}

// Lo que interpretó el asistente, una tarjeta por ecuación, para revisarla
// antes de agregarla.
function EcuacionesPropuestas({ ecuaciones, guardadas, puedeEcuaciones, moduloPrendido, agregando, prefijo, ocupado, alAgregar, alAgregarTodas, t }) {
  const pendientes = ecuaciones.filter((e) => e.estado === "pendiente" && !igualA(e, guardadas));
  const sinPermiso = puedeEcuaciones ? undefined : t("asistente.ecuaciones.sinPermiso");
  return (
    <div className="mt-2 grid gap-3">
      {ecuaciones.map((e, k) => {
        const igual = e.estado === "pendiente" || e.estado === "duplicada" ? igualA(e, guardadas) : null;
        const repetida = e.estado === "duplicada" || Boolean(igual);
        const estaAgregando = agregando === `${prefijo}-${k}`;
        return (
          <article
            key={k}
            className={[
              "rounded-tarjeta border-2 p-4",
              e.estado === "agregada" ? "border-borde bg-superficie" : "border-azul bg-azul-claro",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-bold">
                <Icono nombre={e.estado === "agregada" ? "listo" : "nota"} className="size-5" />
                {e.nombre}
              </p>
              {e.categoria && (
                <span className="rounded-full bg-tarjeta px-3 py-1 text-etiqueta font-bold text-tinta-media">{e.categoria}</span>
              )}
            </div>

            <p className="mt-2 overflow-x-auto rounded-campo bg-tarjeta px-3 py-2 font-mono text-cuerpo">
              {e.nombre} = {e.formula}
              {e.unidad_resultado && <span className="text-tinta-media"> [{e.unidad_resultado}]</span>}
            </p>
            {e.descripcion && <p className="mt-2 text-tinta-media">{e.descripcion}</p>}

            {e.variables?.length > 0 && (
              <>
                <p className="mt-3 text-etiqueta font-bold text-tinta-media">{t("asistente.ecuaciones.interpreto")}</p>
                <ul className="mt-1 grid gap-1">
                  {e.variables.map((v) => (
                    <li key={v.nombre} className="flex flex-wrap gap-x-2">
                      <span className="font-mono font-bold">{leerVariable(v)}</span>
                      {v.tipo === "constante" && <span className="text-etiqueta text-terracota">{t("asistente.ecuaciones.constante")}</span>}
                      {v.descripcion && <span className="text-tinta-media">— {v.descripcion}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {repetida && e.estado !== "agregada" && (
              <p className="mt-3 flex items-center gap-1.5 text-etiqueta font-bold text-terracota">
                <Icono nombre="alerta" className="size-5" />
                {igual ? t("asistente.ecuaciones.repetida", { nombre: igual }) : t("asistente.ecuaciones.repetidaSinNombre")}
              </p>
            )}
            {e.estado === "error" && e.error && <p className="mt-3 font-bold text-etiqueta text-rojo">{e.error}</p>}

            {e.estado === "agregada" ? (
              <p className="mt-3 flex flex-wrap items-center gap-2 font-bold text-etiqueta text-azul">
                {t("asistente.ecuaciones.agregada")}
                {moduloPrendido && <Link href="/ecuaciones" className="underline">{t("asistente.ecuaciones.ver")}</Link>}
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Boton
                  variante={repetida ? "borde" : "principal"}
                  icono="mas"
                  onClick={() => alAgregar(k, { confirmarVariante: repetida })}
                  disabled={ocupado}
                  motivo={sinPermiso}
                >
                  {estaAgregando
                    ? t("asistente.ecuaciones.agregando")
                    : repetida ? t("asistente.ecuaciones.agregarIgual") : t("asistente.ecuaciones.agregar")}
                </Boton>
              </div>
            )}
          </article>
        );
      })}

      {pendientes.length > 1 && puedeEcuaciones && (
        <div>
          <Boton variante="principal" icono="mas" onClick={alAgregarTodas} disabled={ocupado}>
            {t("asistente.ecuaciones.agregarTodas", { n: pendientes.length })}
          </Boton>
        </div>
      )}
      {!moduloPrendido && <p className="text-apoyo text-tinta-suave">{t("asistente.ecuaciones.moduloApagado")}</p>}
    </div>
  );
}
