"use client";

import { useEffect, useState } from "react";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { nombreDeModulo } from "@/lib/modulos";
import Frase from "@/componentes/Frase";
import {
  entradasDeEcuacionEncadenada, errorDeVariables, filtrarEcuaciones,
  nombreParaDependencia, ordenarEcuaciones, resolverEcuacionEncadenada, variablesHeredadas,
} from "@/lib/ecuaciones";
import { Boton, Campo, Cargando, ErrorGeneral, Tarjeta, TituloPantalla, TituloSeccion, Vacio } from "@/componentes/ui";

const vacia = () => ({ nombre: "", formula: "", descripcion: "", categoria: "", unidad_resultado: "", variables: [], dependencias: [] });
const idNuevo = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const CLASE_ENTRADA = "mt-2 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 py-3";

export default function Ecuaciones() {
  const { locale, t } = useIdioma();
  const datos = useDatos();
  const [pantalla, setPantalla] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [orden, setOrden] = useState("nombre");
  const [borrando, setBorrando] = useState(null);
  const [errorBorrado, setErrorBorrado] = useState(null);
  useTitulo(nombreDeModulo("ecuaciones", t));

  if (datos.cargando) return <Cargando />;

  const ecuaciones = datos.ecuaciones ?? [];
  const categorias = [...new Set(ecuaciones.map((e) => e.categoria).filter(Boolean))].toSorted((a, b) => a.localeCompare(b, locale));
  const visibles = filtrarEcuaciones(ecuaciones, { busqueda, categoria, orden });

  const cerrar = () => setPantalla(null);
  const guardar = async (form, confirmarVariante) => {
    const accion = pantalla?.tipo === "editar" ? datos.editarEcuacion(pantalla.ecuacion.id, { ...form, confirmarVariante })
      : datos.crearEcuacion({ ...form, confirmarVariante });
    const resultado = await accion;
    if (resultado.ok) {
      cerrar();
      datos.avisarExito(pantalla?.tipo === "editar" ? t("ecuaciones.actualizadaOk") : t("ecuaciones.guardadaOk"));
    }
    return resultado;
  };

  async function eliminar(ecuacion) {
    const resultado = await datos.eliminarEcuacion(ecuacion.id);
    if (resultado.ok) {
      setBorrando(null);
      setErrorBorrado(null);
      datos.avisarExito(t("ecuaciones.eliminadaOk"));
    } else {
      setErrorBorrado({ id: ecuacion.id, error: resultado.error, dependientes: resultado.dependientes });
    }
  }

  if (pantalla?.tipo === "resolver") return <Resolver ecuacion={pantalla.ecuacion} ecuaciones={ecuaciones} alCerrar={cerrar} />;
  if (pantalla) return <Editor inicial={pantalla.ecuacion} ecuaciones={ecuaciones} titulo={pantalla.tipo === "editar" ? t("ecuaciones.editarTitulo") : t("ecuaciones.crear")} alGuardar={guardar} alCancelar={cerrar} />;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <TituloPantalla apoyo={t("ecuaciones.apoyo")}>{nombreDeModulo("ecuaciones", t)}</TituloPantalla>
      <Boton variante="principal" icono="mas" onClick={() => setPantalla({ tipo: "crear", ecuacion: vacia() })}>{t("ecuaciones.crear")}</Boton>

      <TituloSeccion className="mt-10">{t("ecuaciones.guardadas")}</TituloSeccion>
      {!ecuaciones.length ? (
        <Vacio titulo={t("ecuaciones.vacioTitulo")}>{t("ecuaciones.vacio")}</Vacio>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Campo id="buscar-ecuacion" etiqueta={t("ecuaciones.buscar")} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <Campo id="filtrar-categoria" etiqueta={t("ecuaciones.categoria")}>
              <select id="filtrar-categoria" className={CLASE_ENTRADA} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">{t("ecuaciones.todas")}</option>
                {categorias.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Campo>
            <Campo id="ordenar-ecuaciones" etiqueta={t("ecuaciones.ordenar")}>
              <select id="ordenar-ecuaciones" className={CLASE_ENTRADA} value={orden} onChange={(e) => setOrden(e.target.value)}>
                <option value="nombre">{t("ecuaciones.ordenNombre")}</option>
                <option value="categoria">{t("ecuaciones.categoria")}</option>
              </select>
            </Campo>
          </div>

          {!visibles.length ? (
            <Vacio titulo={t("ecuaciones.sinCoincidenciasTitulo")}>{t("ecuaciones.sinCoincidencias")}</Vacio>
          ) : (
            <ul className="space-y-3">
              {visibles.map((ecuacion) => (
                <li key={ecuacion.id}>
                  <Tarjeta>
                    <button type="button" className="w-full text-left" onClick={() => setPantalla({ tipo: "resolver", ecuacion })}>
                      <p className="font-bold text-subtitulo text-azul">{ecuacion.nombre}</p>
                      <p className="mt-1 break-all font-mono">{ecuacion.formula}</p>
                      {ecuacion.categoria && <p className="mt-2 text-etiqueta text-tinta-media">{ecuacion.categoria}</p>}
                    </button>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Boton variante="borde" onClick={() => setPantalla({ tipo: "resolver", ecuacion })}>{t("ecuaciones.resolver")}</Boton>
                      <Boton variante="plano" onClick={() => setPantalla({ tipo: "editar", ecuacion })}>{t("ecuaciones.editar")}</Boton>
                      <Boton variante="plano" onClick={() => setPantalla({ tipo: "crear", ecuacion: {
                        ...ecuacion, id: undefined, nombre: t("ecuaciones.copia", { nombre: ecuacion.nombre }),
                        variables: (ecuacion.variables ?? []).map((v) => ({ ...v, id: idNuevo() })),
                      } })}>{t("ecuaciones.duplicar")}</Boton>
                      <Boton variante="peligro" onClick={() => { setBorrando(ecuacion.id); setErrorBorrado(null); }}>{t("ecuaciones.eliminar")}</Boton>
                    </div>
                    {borrando === ecuacion.id && (
                      <div className="mt-4 rounded-campo bg-superficie p-4">
                        <p>{t("ecuaciones.confirmarEliminar", { nombre: ecuacion.nombre })}</p>
                        {errorBorrado?.id === ecuacion.id && <div role="alert" className="mt-3 rounded-campo bg-rojo/5 p-3 text-rojo">
                          <p>{textoDeError(t, errorBorrado.error)}</p>
                          {!!errorBorrado.dependientes?.length && <p className="mt-1">{t("ecuaciones.primeroQuitar", { nombres: errorBorrado.dependientes.join(", ") })}</p>}
                        </div>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Boton variante="peligro" onClick={() => eliminar(ecuacion)}>{t("ecuaciones.siEliminar")}</Boton>
                          <Boton variante="plano" onClick={() => setBorrando(null)}>{t("ecuaciones.dejarla")}</Boton>
                        </div>
                      </div>
                    )}
                  </Tarjeta>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function Editor({ inicial, ecuaciones, titulo, alGuardar, alCancelar }) {
  const { t } = useIdioma();
  const [form, setForm] = useState({ ...vacia(), ...inicial, variables: inicial?.variables ?? [], dependencias: inicial?.dependencias ?? [] });
  const [errores, setErrores] = useState({});
  const [duplicada, setDuplicada] = useState(false);
  const [editandoVariable, setEditandoVariable] = useState(null);
  const [variable, setVariable] = useState({ tipo: "variable", nombre: "", descripcion: "", valor: "", unidad: "" });
  const [ecuacionElegida, setEcuacionElegida] = useState("");
  const heredadas = variablesHeredadas(form, ecuaciones, t).variables ?? [];

  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); setErrores((e) => ({ ...e, [campo]: null, general: null })); setDuplicada(false); };
  const insertar = (texto) => cambiar("formula", `${form.formula}${texto}`);

  async function guardar(confirmarVariante = false) {
    setErrores({}); setDuplicada(false);
    const resultado = await alGuardar(form, confirmarVariante);
    if (resultado.duplicada) return setDuplicada(true);
    if (!resultado.ok) {
      const mensaje = textoDeError(t, resultado.error);
      setErrores(resultado.campo ? { [resultado.campo]: mensaje } : { general: mensaje });
    }
  }

  function editarVariable(v = null) {
    setEditandoVariable(v?.id ?? "nueva");
    setVariable(v ? { ...v, valor: v.valor ?? "" } : { tipo: "variable", nombre: "", descripcion: "", valor: "", unidad: "" });
    setErrores((e) => ({ ...e, variables: null }));
  }

  function guardarVariable() {
    const nueva = { ...variable, id: editandoVariable === "nueva" ? idNuevo() : editandoVariable };
    const lista = editandoVariable === "nueva" ? [...form.variables, nueva] : form.variables.map((v) => v.id === editandoVariable ? nueva : v);
    const error = errorDeVariables(lista, t);
    if (error) return setErrores((e) => ({ ...e, variables: error }));
    cambiar("variables", lista);
    setEditandoVariable(null);
  }

  function agregarDependencia() {
    const elegida = ecuaciones.find((e) => e.id === ecuacionElegida);
    if (!elegida) return;
    const ocupados = [...form.variables, ...form.dependencias].map((item) => item.nombre);
    cambiar("dependencias", [...form.dependencias, {
      ecuacion_id: elegida.id,
      nombre: nombreParaDependencia(elegida, ocupados),
    }]);
    setEcuacionElegida("");
    setErrores((e) => ({ ...e, dependencias: null }));
  }

  const teclas = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "^", "+", "(", ")", "sqrt("];

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <TituloPantalla apoyo={t("ecuaciones.editor.apoyo")}>{titulo}</TituloPantalla>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} noValidate>
        <Tarjeta>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Campo id="ecuacion-nombre" etiqueta={t("ecuaciones.editor.nombre")} value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)} error={errores.nombre} autoFocus />
            <Campo id="ecuacion-categoria" etiqueta={t("ecuaciones.categoria")} value={form.categoria ?? ""} onChange={(e) => cambiar("categoria", e.target.value)} />
          </div>
          <Campo id="ecuacion-descripcion" etiqueta={t("ecuaciones.editor.descripcion")}>
            <textarea id="ecuacion-descripcion" value={form.descripcion ?? ""} onChange={(e) => cambiar("descripcion", e.target.value)} className={`${CLASE_ENTRADA} min-h-24`} />
          </Campo>
          <Campo id="ecuacion-unidad" etiqueta={t("ecuaciones.editor.unidadResultado")} ayuda={t("ecuaciones.editor.unidadAyuda")} value={form.unidad_resultado ?? ""} onChange={(e) => cambiar("unidad_resultado", e.target.value)} />
        </Tarjeta>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
          <Tarjeta>
            <TituloSeccion>{t("ecuaciones.editor.calculadora")}</TituloSeccion>
            <Campo id="ecuacion-formula" etiqueta={t("ecuaciones.editor.formula")} ayuda={t("ecuaciones.editor.formulaAyuda")} value={form.formula} onChange={(e) => cambiar("formula", e.target.value)} error={errores.formula} />
            <div className="grid grid-cols-4 gap-2" aria-label={t("ecuaciones.editor.teclasAria")}>
              {teclas.map((tecla) => <Boton key={tecla} variante="neutro" className={tecla === "sqrt(" ? "col-span-2" : ""} onClick={() => insertar(tecla)}>{tecla === "sqrt(" ? t("ecuaciones.editor.raiz") : tecla}</Boton>)}
              <Boton variante="plano" className="col-span-2" onClick={() => cambiar("formula", form.formula.slice(0, -1))}>{t("ecuaciones.editor.borrarUltimo")}</Boton>
              <Boton variante="plano" className="col-span-2" onClick={() => cambiar("formula", "")}>{t("ecuaciones.editor.limpiar")}</Boton>
            </div>
          </Tarjeta>

          <Tarjeta>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TituloSeccion>{t("ecuaciones.editor.variables")}</TituloSeccion>
              {!editandoVariable && <Boton variante="borde" icono="mas" onClick={() => editarVariable()}>{t("ecuaciones.editor.agregar")}</Boton>}
            </div>
            {errores.variables && <ErrorGeneral>{errores.variables}</ErrorGeneral>}
            {editandoVariable && (
              <div className="mb-4 rounded-campo bg-superficie p-4">
                <Campo id="variable-tipo" etiqueta={t("ecuaciones.editor.tipo")}>
                  <select id="variable-tipo" className={CLASE_ENTRADA} value={variable.tipo} onChange={(e) => setVariable((v) => ({ ...v, tipo: e.target.value }))}>
                    <option value="variable">{t("ecuaciones.editor.tipoVariable")}</option><option value="constante">{t("ecuaciones.editor.tipoConstante")}</option>
                  </select>
                </Campo>
                <Campo id="variable-nombre" etiqueta={t("ecuaciones.editor.nombreVar")} ayuda={t("ecuaciones.editor.nombreVarAyuda")} value={variable.nombre} onChange={(e) => setVariable((v) => ({ ...v, nombre: e.target.value }))} />
                <Campo id="variable-descripcion" etiqueta={t("ecuaciones.editor.descripcion")} value={variable.descripcion} onChange={(e) => setVariable((v) => ({ ...v, descripcion: e.target.value }))} />
                <div className="grid gap-x-3 sm:grid-cols-2">
                  <Campo id="variable-valor" etiqueta={variable.tipo === "constante" ? t("ecuaciones.editor.valor") : t("ecuaciones.editor.valorInicial")} ayuda={variable.tipo === "variable" ? t("ecuaciones.editor.opcional") : undefined} type="number" step="any" value={variable.valor} onChange={(e) => setVariable((v) => ({ ...v, valor: e.target.value }))} />
                  <Campo id="variable-unidad" etiqueta={t("ecuaciones.editor.unidad")} ayuda={t("ecuaciones.editor.opcional")} value={variable.unidad} onChange={(e) => setVariable((v) => ({ ...v, unidad: e.target.value }))} />
                </div>
                <div className="flex flex-wrap gap-2"><Boton variante="borde" onClick={guardarVariable}>{t("ecuaciones.editor.guardarVariable")}</Boton><Boton variante="plano" onClick={() => setEditandoVariable(null)}>{t("ecuaciones.editor.cancelar")}</Boton></div>
              </div>
            )}
            {!form.variables.length ? <p className="text-tinta-media">{t("ecuaciones.editor.ninguna")}</p> : (
              <ul className="space-y-2">
                {form.variables.map((v) => <li key={v.id} className="rounded-campo border border-borde p-3">
                  <p className="font-bold">{v.nombre} <span className="font-normal text-tinta-media">· {v.tipo === "constante" ? t("ecuaciones.editor.tipoConstanteMin") : t("ecuaciones.editor.tipoVariableMin")}{v.unidad ? ` · ${v.unidad}` : ""}</span></p>
                  {v.descripcion && <p className="text-etiqueta text-tinta-media">{v.descripcion}</p>}
                  <div className="mt-2 flex flex-wrap gap-2"><Boton variante="plano" onClick={() => insertar(v.nombre)}>{t("ecuaciones.editor.insertar")}</Boton><Boton variante="plano" onClick={() => editarVariable(v)}>{t("ecuaciones.editar")}</Boton><Boton variante="peligro" onClick={() => cambiar("variables", form.variables.filter((x) => x.id !== v.id))}>{t("ecuaciones.eliminar")}</Boton></div>
                </li>)}
              </ul>
            )}
            <div className="mt-6 border-t border-borde pt-5">
              <TituloSeccion>{t("ecuaciones.editor.calculadas")}</TituloSeccion>
              <p className="mb-3 text-etiqueta text-tinta-media">{t("ecuaciones.editor.calculadasApoyo")}</p>
              {errores.dependencias && <ErrorGeneral>{errores.dependencias}</ErrorGeneral>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <select aria-label={t("ecuaciones.editor.elegirAria")} className={CLASE_ENTRADA} value={ecuacionElegida} onChange={(e) => setEcuacionElegida(e.target.value)}>
                  <option value="">{t("ecuaciones.editor.elegir")}</option>
                  {ecuaciones.filter((e) => e.id !== inicial?.id && !form.dependencias.some((d) => d.ecuacion_id === e.id))
                    .map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
                <Boton variante="borde" onClick={agregarDependencia} disabled={!ecuacionElegida}>{t("ecuaciones.editor.agregar")}</Boton>
              </div>
              {!!form.dependencias.length && <ul className="mt-3 space-y-2">
                {form.dependencias.map((dependencia) => {
                  const origen = ecuaciones.find((e) => e.id === dependencia.ecuacion_id);
                  return <li key={dependencia.ecuacion_id} className="rounded-campo border-2 border-azul bg-azul-claro p-3">
                    <p className="font-bold">{origen?.nombre ?? t("ecuaciones.editor.noDisponible")} <span className="font-normal text-azul">· {t("ecuaciones.editor.calculada")}</span></p>
                    <p className="text-etiqueta text-tinta-media"><Frase texto={t("ecuaciones.editor.seUsaComo", { nombre: "{nombre}" })} partes={{ nombre: <code>{dependencia.nombre}</code> }} /></p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Boton variante="plano" onClick={() => insertar(dependencia.nombre)}>{t("ecuaciones.editor.insertar")}</Boton>
                      <Boton variante="peligro" onClick={() => cambiar("dependencias", form.dependencias.filter((d) => d.ecuacion_id !== dependencia.ecuacion_id))}>{t("ecuaciones.eliminar")}</Boton>
                    </div>
                  </li>;
                })}
              </ul>}
              {!!heredadas.length && <div className="mt-4">
                <p className="mb-2 font-bold">{t("ecuaciones.editor.heredadas")}</p>
                <ul className="space-y-2">
                  {heredadas.map((v) => <li key={`${v.ecuacion}-${v.id}`} className="rounded-campo border border-borde bg-superficie p-3">
                    <p className="font-bold">{v.nombre} <span className="font-normal text-tinta-media">· {t("ecuaciones.editor.tipoDe", { tipo: v.tipo === "constante" ? t("ecuaciones.editor.tipoConstanteMin") : t("ecuaciones.editor.tipoVariableMin"), ecuacion: v.ecuacion })}{v.unidad ? ` · ${v.unidad}` : ""}</span></p>
                    {v.descripcion && <p className="text-etiqueta text-tinta-media">{v.descripcion}</p>}
                    <Boton variante="plano" className="mt-2" onClick={() => insertar(v.nombre)}>{t("ecuaciones.editor.insertar")}</Boton>
                  </li>)}
                </ul>
              </div>}
            </div>
          </Tarjeta>
        </div>

        {errores.general && <ErrorGeneral>{errores.general}</ErrorGeneral>}
        {duplicada && <div role="alert" className="mt-4 rounded-campo bg-azul-claro p-4 text-azul"><p className="font-bold">{t("ecuaciones.editor.duplicada")}</p><p className="mt-1">{t("ecuaciones.editor.duplicadaApoyo")}</p><div className="mt-3 flex gap-2"><Boton onClick={() => setDuplicada(false)}>{t("ecuaciones.editor.seguir")}</Boton><Boton variante="borde" onClick={() => guardar(true)}>{t("ecuaciones.editor.variante")}</Boton></div></div>}
        <div className="mt-6 flex flex-wrap gap-2"><Boton type="submit" variante="principal">{t("ecuaciones.editor.guardar")}</Boton><Boton onClick={alCancelar}>{t("ecuaciones.editor.cancelar")}</Boton></div>
      </form>
    </main>
  );
}

function Resolver({ ecuacion, ecuaciones, alCerrar }) {
  const { locale, t } = useIdioma();
  const preparacion = entradasDeEcuacionEncadenada(ecuacion, ecuaciones, t);
  const variables = preparacion.entradas ?? [];
  const cadena = ordenarEcuaciones(ecuacion, ecuaciones, t);
  const constantes = (cadena.orden ?? [ecuacion]).flatMap((actual) =>
    (actual.variables ?? [])
      .filter((variable) => variable.tipo === "constante")
      .map((variable) => ({ ...variable, ecuacion: actual.nombre })),
  );
  const iniciales = Object.fromEntries(variables.map((v) => [v.id, v.valor ?? ""]));
  const [entradas, setEntradas] = useState(iniciales);
  const [salida, setSalida] = useState(null);
  const [mostrarErrores, setMostrarErrores] = useState(false);

  const calcular = (valores = entradas, mostrar = true) => {
    const resultado = preparacion.error ? preparacion : resolverEcuacionEncadenada(ecuacion, ecuaciones, valores, t);
    setSalida(resultado);
    if (mostrar) setMostrarErrores(true);
  };

  useEffect(() => {
    const completas = variables.every((v) => entradas[v.id] !== "");
    if (completas) calcular(entradas, false); else setSalida(null);
  }, [entradas]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <TituloPantalla apoyo={ecuacion.formula}>{ecuacion.nombre}</TituloPantalla>
      <Tarjeta>
        <TituloSeccion>{t("ecuaciones.resolverPantalla.valores")}</TituloSeccion>
        {constantes.map((v) => (
          <p key={`${v.ecuacion}-${v.id}`} className="mb-3 rounded-campo bg-superficie p-3">
            <strong>{v.nombre}</strong>: {v.valor}{v.unidad ? ` ${v.unidad}` : ""} <span className="text-tinta-media">· {t("ecuaciones.resolverPantalla.constanteDe", { ecuacion: v.ecuacion })}</span>
          </p>
        ))}
        {variables.map((v) => (
          <Campo key={v.id} id={`resolver-${v.id}`} etiqueta={`${v.nombre}${v.unidad ? ` (${v.unidad})` : ""}`} ayuda={v.descripcion || t("ecuaciones.resolverPantalla.entradaDe", { ecuacion: v.ecuacion })} type="number" step="any" value={entradas[v.id]} onChange={(e) => { setMostrarErrores(true); setEntradas((actual) => ({ ...actual, [v.id]: e.target.value })); }} error={mostrarErrores && salida?.campo === v.id ? salida.error : undefined} />
        ))}
        {mostrarErrores && salida?.error && !salida.campo && <ErrorGeneral>{salida.error}</ErrorGeneral>}
        {salida && !salida.error && <div aria-live="polite" className="mb-6 rounded-tarjeta bg-azul-claro p-5"><p className="text-etiqueta text-tinta-media">{t("ecuaciones.resolverPantalla.resultado")}</p><p className="mt-1 text-pantalla text-azul">{new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(salida.resultado)}{ecuacion.unidad_resultado ? ` ${ecuacion.unidad_resultado}` : ""}</p></div>}
        {!!salida?.intermedios?.length && <div className="mb-6">
          <TituloSeccion>{t("ecuaciones.resolverPantalla.intermedios")}</TituloSeccion>
          <ul className="space-y-2">{salida.intermedios.map((intermedio) => <li key={intermedio.id} className="rounded-campo bg-superficie p-3"><strong>{intermedio.nombre}:</strong> {new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(intermedio.resultado)}{intermedio.unidad ? ` ${intermedio.unidad}` : ""}</li>)}</ul>
        </div>}
        <div className="flex flex-wrap gap-2"><Boton variante="principal" onClick={() => calcular()}>{t("ecuaciones.resolverPantalla.calcular")}</Boton><Boton onClick={alCerrar}>{t("ecuaciones.resolverPantalla.volver")}</Boton></div>
      </Tarjeta>
    </main>
  );
}
