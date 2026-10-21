"use client";

import { useEffect, useState } from "react";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import {
  entradasDeEcuacionEncadenada, errorDeVariables, filtrarEcuaciones,
  nombreParaDependencia, ordenarEcuaciones, resolverEcuacionEncadenada, variablesHeredadas,
} from "@/lib/ecuaciones";
import { Boton, Campo, Cargando, ErrorGeneral, Tarjeta, TituloPantalla, TituloSeccion, Vacio } from "@/componentes/ui";

const vacia = () => ({ nombre: "", formula: "", descripcion: "", categoria: "", unidad_resultado: "", variables: [], dependencias: [] });
const idNuevo = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const CLASE_ENTRADA = "mt-2 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 py-3";

export default function Ecuaciones() {
  const datos = useDatos();
  const [pantalla, setPantalla] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [orden, setOrden] = useState("nombre");
  const [borrando, setBorrando] = useState(null);
  const [errorBorrado, setErrorBorrado] = useState(null);
  useTitulo("Ecuaciones personalizadas");

  if (datos.cargando) return <Cargando />;

  const ecuaciones = datos.ecuaciones ?? [];
  const categorias = [...new Set(ecuaciones.map((e) => e.categoria).filter(Boolean))].toSorted((a, b) => a.localeCompare(b, "es"));
  const visibles = filtrarEcuaciones(ecuaciones, { busqueda, categoria, orden });

  const cerrar = () => setPantalla(null);
  const guardar = async (form, confirmarVariante) => {
    const accion = pantalla?.tipo === "editar" ? datos.editarEcuacion(pantalla.ecuacion.id, { ...form, confirmarVariante })
      : datos.crearEcuacion({ ...form, confirmarVariante });
    const resultado = await accion;
    if (resultado.ok) {
      cerrar();
      datos.avisarExito(pantalla?.tipo === "editar" ? "Listo. La ecuación quedó actualizada." : "Listo. La ecuación quedó guardada.");
    }
    return resultado;
  };

  async function eliminar(ecuacion) {
    const resultado = await datos.eliminarEcuacion(ecuacion.id);
    if (resultado.ok) {
      setBorrando(null);
      setErrorBorrado(null);
      datos.avisarExito("La ecuación fue eliminada.");
    } else {
      setErrorBorrado({ id: ecuacion.id, mensaje: resultado.error, dependientes: resultado.dependientes });
    }
  }

  if (pantalla?.tipo === "resolver") return <Resolver ecuacion={pantalla.ecuacion} ecuaciones={ecuaciones} alCerrar={cerrar} />;
  if (pantalla) return <Editor inicial={pantalla.ecuacion} ecuaciones={ecuaciones} titulo={pantalla.tipo === "editar" ? "Editar ecuación" : "Crear una ecuación"} alGuardar={guardar} alCancelar={cerrar} />;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <TituloPantalla apoyo="Guardá fórmulas, encontralas y resolvelas cuando las necesites.">Ecuaciones personalizadas</TituloPantalla>
      <Boton variante="principal" icono="mas" onClick={() => setPantalla({ tipo: "crear", ecuacion: vacia() })}>Crear una ecuación</Boton>

      <TituloSeccion className="mt-10">Ecuaciones guardadas</TituloSeccion>
      {!ecuaciones.length ? (
        <Vacio titulo="No hay ecuaciones guardadas">Creá la primera para verla acá.</Vacio>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Campo id="buscar-ecuacion" etiqueta="Buscar por nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <Campo id="filtrar-categoria" etiqueta="Categoría">
              <select id="filtrar-categoria" className={CLASE_ENTRADA} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas</option>
                {categorias.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Campo>
            <Campo id="ordenar-ecuaciones" etiqueta="Ordenar por">
              <select id="ordenar-ecuaciones" className={CLASE_ENTRADA} value={orden} onChange={(e) => setOrden(e.target.value)}>
                <option value="nombre">Nombre</option>
                <option value="categoria">Categoría</option>
              </select>
            </Campo>
          </div>

          {!visibles.length ? (
            <Vacio titulo="No hay coincidencias">Probá con otro nombre o categoría.</Vacio>
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
                      <Boton variante="borde" onClick={() => setPantalla({ tipo: "resolver", ecuacion })}>Resolver</Boton>
                      <Boton variante="plano" onClick={() => setPantalla({ tipo: "editar", ecuacion })}>Editar</Boton>
                      <Boton variante="plano" onClick={() => setPantalla({ tipo: "crear", ecuacion: {
                        ...ecuacion, id: undefined, nombre: `${ecuacion.nombre} (copia)`,
                        variables: (ecuacion.variables ?? []).map((v) => ({ ...v, id: idNuevo() })),
                      } })}>Duplicar</Boton>
                      <Boton variante="peligro" onClick={() => { setBorrando(ecuacion.id); setErrorBorrado(null); }}>Eliminar</Boton>
                    </div>
                    {borrando === ecuacion.id && (
                      <div className="mt-4 rounded-campo bg-superficie p-4">
                        <p>¿Querés eliminar “{ecuacion.nombre}”?</p>
                        {errorBorrado?.id === ecuacion.id && <div role="alert" className="mt-3 rounded-campo bg-rojo/5 p-3 text-rojo">
                          <p>{errorBorrado.mensaje}</p>
                          {!!errorBorrado.dependientes?.length && <p className="mt-1">Primero quitá la dependencia en: {errorBorrado.dependientes.join(", ")}.</p>}
                        </div>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Boton variante="peligro" onClick={() => eliminar(ecuacion)}>Sí, eliminarla</Boton>
                          <Boton variante="plano" onClick={() => setBorrando(null)}>Dejarla como está</Boton>
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
  const [form, setForm] = useState({ ...vacia(), ...inicial, variables: inicial?.variables ?? [], dependencias: inicial?.dependencias ?? [] });
  const [errores, setErrores] = useState({});
  const [duplicada, setDuplicada] = useState(false);
  const [editandoVariable, setEditandoVariable] = useState(null);
  const [variable, setVariable] = useState({ tipo: "variable", nombre: "", descripcion: "", valor: "", unidad: "" });
  const [ecuacionElegida, setEcuacionElegida] = useState("");
  const heredadas = variablesHeredadas(form, ecuaciones).variables ?? [];

  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); setErrores((e) => ({ ...e, [campo]: null, general: null })); setDuplicada(false); };
  const insertar = (texto) => cambiar("formula", `${form.formula}${texto}`);

  async function guardar(confirmarVariante = false) {
    setErrores({}); setDuplicada(false);
    const resultado = await alGuardar(form, confirmarVariante);
    if (resultado.duplicada) return setDuplicada(true);
    if (!resultado.ok) setErrores(resultado.campo ? { [resultado.campo]: resultado.error } : { general: resultado.error });
  }

  function editarVariable(v = null) {
    setEditandoVariable(v?.id ?? "nueva");
    setVariable(v ? { ...v, valor: v.valor ?? "" } : { tipo: "variable", nombre: "", descripcion: "", valor: "", unidad: "" });
    setErrores((e) => ({ ...e, variables: null }));
  }

  function guardarVariable() {
    const nueva = { ...variable, id: editandoVariable === "nueva" ? idNuevo() : editandoVariable };
    const lista = editandoVariable === "nueva" ? [...form.variables, nueva] : form.variables.map((v) => v.id === editandoVariable ? nueva : v);
    const error = errorDeVariables(lista);
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
      <TituloPantalla apoyo="Definí la fórmula y las variables que usa.">{titulo}</TituloPantalla>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} noValidate>
        <Tarjeta>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Campo id="ecuacion-nombre" etiqueta="Nombre" value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)} error={errores.nombre} autoFocus />
            <Campo id="ecuacion-categoria" etiqueta="Categoría" value={form.categoria ?? ""} onChange={(e) => cambiar("categoria", e.target.value)} />
          </div>
          <Campo id="ecuacion-descripcion" etiqueta="Descripción">
            <textarea id="ecuacion-descripcion" value={form.descripcion ?? ""} onChange={(e) => cambiar("descripcion", e.target.value)} className={`${CLASE_ENTRADA} min-h-24`} />
          </Campo>
          <Campo id="ecuacion-unidad" etiqueta="Unidad del resultado" ayuda="Opcional. Por ejemplo: $, kg o m²." value={form.unidad_resultado ?? ""} onChange={(e) => cambiar("unidad_resultado", e.target.value)} />
        </Tarjeta>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
          <Tarjeta>
            <TituloSeccion>Calculadora científica</TituloSeccion>
            <Campo id="ecuacion-formula" etiqueta="Fórmula" ayuda="Usá las teclas o escribí. La raíz se escribe sqrt(...)." value={form.formula} onChange={(e) => cambiar("formula", e.target.value)} error={errores.formula} />
            <div className="grid grid-cols-4 gap-2" aria-label="Teclas de la calculadora">
              {teclas.map((tecla) => <Boton key={tecla} variante="neutro" className={tecla === "sqrt(" ? "col-span-2" : ""} onClick={() => insertar(tecla)}>{tecla === "sqrt(" ? "√ raíz" : tecla}</Boton>)}
              <Boton variante="plano" className="col-span-2" onClick={() => cambiar("formula", form.formula.slice(0, -1))}>Borrar último</Boton>
              <Boton variante="plano" className="col-span-2" onClick={() => cambiar("formula", "")}>Limpiar</Boton>
            </div>
          </Tarjeta>

          <Tarjeta>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TituloSeccion>Variables y constantes</TituloSeccion>
              {!editandoVariable && <Boton variante="borde" icono="mas" onClick={() => editarVariable()}>Agregar</Boton>}
            </div>
            {errores.variables && <ErrorGeneral>{errores.variables}</ErrorGeneral>}
            {editandoVariable && (
              <div className="mb-4 rounded-campo bg-superficie p-4">
                <Campo id="variable-tipo" etiqueta="Tipo">
                  <select id="variable-tipo" className={CLASE_ENTRADA} value={variable.tipo} onChange={(e) => setVariable((v) => ({ ...v, tipo: e.target.value }))}>
                    <option value="variable">Variable</option><option value="constante">Constante</option>
                  </select>
                </Campo>
                <Campo id="variable-nombre" etiqueta="Nombre" ayuda="Sin espacios. Por ejemplo: precio o cantidad." value={variable.nombre} onChange={(e) => setVariable((v) => ({ ...v, nombre: e.target.value }))} />
                <Campo id="variable-descripcion" etiqueta="Descripción" value={variable.descripcion} onChange={(e) => setVariable((v) => ({ ...v, descripcion: e.target.value }))} />
                <div className="grid gap-x-3 sm:grid-cols-2">
                  <Campo id="variable-valor" etiqueta={variable.tipo === "constante" ? "Valor" : "Valor inicial"} ayuda={variable.tipo === "variable" ? "Opcional." : undefined} type="number" step="any" value={variable.valor} onChange={(e) => setVariable((v) => ({ ...v, valor: e.target.value }))} />
                  <Campo id="variable-unidad" etiqueta="Unidad" ayuda="Opcional." value={variable.unidad} onChange={(e) => setVariable((v) => ({ ...v, unidad: e.target.value }))} />
                </div>
                <div className="flex flex-wrap gap-2"><Boton variante="borde" onClick={guardarVariable}>Guardar variable</Boton><Boton variante="plano" onClick={() => setEditandoVariable(null)}>Cancelar</Boton></div>
              </div>
            )}
            {!form.variables.length ? <p className="text-tinta-media">Todavía no definiste ninguna.</p> : (
              <ul className="space-y-2">
                {form.variables.map((v) => <li key={v.id} className="rounded-campo border border-borde p-3">
                  <p className="font-bold">{v.nombre} <span className="font-normal text-tinta-media">· {v.tipo}{v.unidad ? ` · ${v.unidad}` : ""}</span></p>
                  {v.descripcion && <p className="text-etiqueta text-tinta-media">{v.descripcion}</p>}
                  <div className="mt-2 flex flex-wrap gap-2"><Boton variante="plano" onClick={() => insertar(v.nombre)}>Insertar</Boton><Boton variante="plano" onClick={() => editarVariable(v)}>Editar</Boton><Boton variante="peligro" onClick={() => cambiar("variables", form.variables.filter((x) => x.id !== v.id))}>Eliminar</Boton></div>
                </li>)}
              </ul>
            )}
            <div className="mt-6 border-t border-borde pt-5">
              <TituloSeccion>Ecuaciones calculadas</TituloSeccion>
              <p className="mb-3 text-etiqueta text-tinta-media">Usá el resultado de otra ecuación como parte de esta fórmula.</p>
              {errores.dependencias && <ErrorGeneral>{errores.dependencias}</ErrorGeneral>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <select aria-label="Ecuación para utilizar" className={CLASE_ENTRADA} value={ecuacionElegida} onChange={(e) => setEcuacionElegida(e.target.value)}>
                  <option value="">Elegí una ecuación</option>
                  {ecuaciones.filter((e) => e.id !== inicial?.id && !form.dependencias.some((d) => d.ecuacion_id === e.id))
                    .map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
                <Boton variante="borde" onClick={agregarDependencia} disabled={!ecuacionElegida}>Agregar</Boton>
              </div>
              {!!form.dependencias.length && <ul className="mt-3 space-y-2">
                {form.dependencias.map((dependencia) => {
                  const origen = ecuaciones.find((e) => e.id === dependencia.ecuacion_id);
                  return <li key={dependencia.ecuacion_id} className="rounded-campo border-2 border-azul bg-azul-claro p-3">
                    <p className="font-bold">{origen?.nombre ?? "Ecuación no disponible"} <span className="font-normal text-azul">· Ecuación calculada</span></p>
                    <p className="text-etiqueta text-tinta-media">Se usa en la fórmula como <code>{dependencia.nombre}</code>.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Boton variante="plano" onClick={() => insertar(dependencia.nombre)}>Insertar</Boton>
                      <Boton variante="peligro" onClick={() => cambiar("dependencias", form.dependencias.filter((d) => d.ecuacion_id !== dependencia.ecuacion_id))}>Eliminar</Boton>
                    </div>
                  </li>;
                })}
              </ul>}
              {!!heredadas.length && <div className="mt-4">
                <p className="mb-2 font-bold">Variables disponibles de las ecuaciones utilizadas</p>
                <ul className="space-y-2">
                  {heredadas.map((v) => <li key={`${v.ecuacion}-${v.id}`} className="rounded-campo border border-borde bg-superficie p-3">
                    <p className="font-bold">{v.nombre} <span className="font-normal text-tinta-media">· {v.tipo} de {v.ecuacion}{v.unidad ? ` · ${v.unidad}` : ""}</span></p>
                    {v.descripcion && <p className="text-etiqueta text-tinta-media">{v.descripcion}</p>}
                    <Boton variante="plano" className="mt-2" onClick={() => insertar(v.nombre)}>Insertar</Boton>
                  </li>)}
                </ul>
              </div>}
            </div>
          </Tarjeta>
        </div>

        {errores.general && <ErrorGeneral>{errores.general}</ErrorGeneral>}
        {duplicada && <div role="alert" className="mt-4 rounded-campo bg-azul-claro p-4 text-azul"><p className="font-bold">Ya existe una ecuación con la misma expresión y el mismo orden.</p><p className="mt-1">Podés cancelar o guardarla como una variante.</p><div className="mt-3 flex gap-2"><Boton onClick={() => setDuplicada(false)}>Seguir editando</Boton><Boton variante="borde" onClick={() => guardar(true)}>Guardar variante</Boton></div></div>}
        <div className="mt-6 flex flex-wrap gap-2"><Boton type="submit" variante="principal">Guardar ecuación</Boton><Boton onClick={alCancelar}>Cancelar</Boton></div>
      </form>
    </main>
  );
}

function Resolver({ ecuacion, ecuaciones, alCerrar }) {
  const { locale } = useIdioma();
  const preparacion = entradasDeEcuacionEncadenada(ecuacion, ecuaciones);
  const variables = preparacion.entradas ?? [];
  const cadena = ordenarEcuaciones(ecuacion, ecuaciones);
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
    const resultado = preparacion.error ? preparacion : resolverEcuacionEncadenada(ecuacion, ecuaciones, valores);
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
        <TituloSeccion>Valores</TituloSeccion>
        {constantes.map((v) => (
          <p key={`${v.ecuacion}-${v.id}`} className="mb-3 rounded-campo bg-superficie p-3">
            <strong>{v.nombre}</strong>: {v.valor}{v.unidad ? ` ${v.unidad}` : ""} <span className="text-tinta-media">· Constante de {v.ecuacion}</span>
          </p>
        ))}
        {variables.map((v) => (
          <Campo key={v.id} id={`resolver-${v.id}`} etiqueta={`${v.nombre}${v.unidad ? ` (${v.unidad})` : ""}`} ayuda={v.descripcion || `Entrada de ${v.ecuacion}.`} type="number" step="any" value={entradas[v.id]} onChange={(e) => { setMostrarErrores(true); setEntradas((actual) => ({ ...actual, [v.id]: e.target.value })); }} error={mostrarErrores && salida?.campo === v.id ? salida.error : undefined} />
        ))}
        {mostrarErrores && salida?.error && !salida.campo && <ErrorGeneral>{salida.error}</ErrorGeneral>}
        {salida && !salida.error && <div aria-live="polite" className="mb-6 rounded-tarjeta bg-azul-claro p-5"><p className="text-etiqueta text-tinta-media">Resultado</p><p className="mt-1 text-pantalla text-azul">{new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(salida.resultado)}{ecuacion.unidad_resultado ? ` ${ecuacion.unidad_resultado}` : ""}</p></div>}
        {!!salida?.intermedios?.length && <div className="mb-6">
          <TituloSeccion>Resultados intermedios</TituloSeccion>
          <ul className="space-y-2">{salida.intermedios.map((intermedio) => <li key={intermedio.id} className="rounded-campo bg-superficie p-3"><strong>{intermedio.nombre}:</strong> {new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(intermedio.resultado)}{intermedio.unidad ? ` ${intermedio.unidad}` : ""}</li>)}</ul>
        </div>}
        <div className="flex flex-wrap gap-2"><Boton variante="principal" onClick={() => calcular()}>Calcular</Boton><Boton onClick={alCerrar}>Volver al listado</Boton></div>
      </Tarjeta>
    </main>
  );
}
