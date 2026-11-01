"use client";

// La biblioteca de ecuaciones (lib/biblioteca-ecuaciones.js): las fórmulas que
// vienen con la app, por categoría. Se recorre, se marcan las que sirven y se
// agregan juntas a las ecuaciones del negocio.
//
// Las categorías del rubro del negocio van primero y lo dicen. Las que el
// negocio ya tiene guardadas (misma fórmula) se ven, pero no se pueden marcar:
// guardarlas otra vez sería una variante que nadie pidió.

import { useMemo, useState } from "react";
import { useDatos } from "@/lib/datos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { bibliotecaEn, filtrarBiblioteca, ordenarParaElRubro, paraGuardar, yaGuardada } from "@/lib/biblioteca-ecuaciones";
import Icono from "./Icono";
import { Boton, BotonPrincipalFijo, Campo, Tarjeta, TituloPantalla, TituloSeccion, Vacio } from "./ui";

export default function BibliotecaDeEcuaciones({ alVolver, alTerminar }) {
  const { idioma, t } = useIdioma();
  const datos = useDatos();
  const ecuaciones = datos.ecuaciones ?? [];
  const categorias = useMemo(
    () => ordenarParaElRubro(bibliotecaEn(idioma), datos.negocio?.rubro),
    [idioma, datos.negocio?.rubro],
  );
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [elegidas, setElegidas] = useState(() => new Set());
  const [abierta, setAbierta] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [fallidas, setFallidas] = useState([]);

  const visibles = filtrarBiblioteca(categorias, { busqueda, categoria });
  const porClave = new Map(categorias.flatMap((c) => c.ecuaciones).map((e) => [e.clave, e]));
  const disponibles = (lista) => lista.filter((e) => !yaGuardada(e, ecuaciones));

  const alternar = (clave) => setElegidas((actual) => {
    const nuevas = new Set(actual);
    if (nuevas.has(clave)) nuevas.delete(clave); else nuevas.add(clave);
    return nuevas;
  });
  const marcarTodas = (lista, marcar) => setElegidas((actual) => {
    const nuevas = new Set(actual);
    for (const e of disponibles(lista)) if (marcar) nuevas.add(e.clave); else nuevas.delete(e.clave);
    return nuevas;
  });

  // De a una y en orden: cada alta pasa por crearEcuacion, que valida, avisa
  // si ya existe y suma la fila al listado. Las que fallan quedan marcadas
  // para reintentar; las demás se desmarcan.
  async function agregar() {
    setGuardando(true);
    setFallidas([]);
    let agregadas = 0;
    const errores = [];
    for (const clave of elegidas) {
      const plantilla = porClave.get(clave);
      if (!plantilla) continue;
      const resultado = await datos.crearEcuacion(paraGuardar(plantilla));
      if (resultado.ok) agregadas += 1;
      else if (!resultado.duplicada) errores.push({ clave, nombre: plantilla.nombre, error: resultado.error });
    }
    setGuardando(false);
    if (!errores.length) {
      if (agregadas) datos.avisarExito(t("ecuaciones.biblioteca.agregadasOk", { n: agregadas }));
      alTerminar();
      return;
    }
    setFallidas(errores);
    setElegidas(new Set(errores.map((e) => e.clave)));
  }

  const cuantas = elegidas.size;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <TituloPantalla apoyo={t("ecuaciones.biblioteca.apoyo")}>{t("ecuaciones.biblioteca.titulo")}</TituloPantalla>
      <Boton variante="plano" icono="flecha-izq" onClick={alVolver}>{t("ecuaciones.biblioteca.volver")}</Boton>

      <div className="mt-6">
        <Campo id="buscar-en-biblioteca" etiqueta={t("ecuaciones.biblioteca.buscar")} ayuda={t("ecuaciones.biblioteca.buscarAyuda")}
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      <nav aria-label={t("ecuaciones.biblioteca.categoriasAria")} className="mb-8">
        <ul className="flex flex-wrap gap-2">
          {[{ clave: "", nombre: t("ecuaciones.todas"), icono: "secciones" }, ...categorias].map((c) => {
            const elegida = categoria === c.clave;
            return (
              <li key={c.clave || "todas"}>
                <button type="button" aria-pressed={elegida} onClick={() => setCategoria(c.clave)}
                  data-testid={`biblioteca-categoria-${c.clave || "todas"}`}
                  className={[
                    "flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-etiqueta",
                    elegida ? "border-azul bg-azul-claro font-bold text-azul" : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
                  ].join(" ")}>
                  <Icono nombre={c.icono} className="size-5" />
                  {c.nombre}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {!visibles.length ? (
        <Vacio icono="buscar" titulo={t("ecuaciones.sinCoincidenciasTitulo")}>{t("ecuaciones.biblioteca.sinCoincidencias")}</Vacio>
      ) : visibles.map((c) => {
        const libres = disponibles(c.ecuaciones);
        const todasMarcadas = libres.length > 0 && libres.every((e) => elegidas.has(e.clave));
        return (
          <section key={c.clave} className="mb-10" aria-labelledby={`biblioteca-${c.clave}`}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <TituloSeccion id={`biblioteca-${c.clave}`} className="flex items-center gap-2">
                  <Icono nombre={c.icono} className="size-6" />
                  {c.nombre}
                  {c.delRubro && <span className="rounded-full bg-azul-claro px-3 py-1 text-etiqueta font-bold text-azul">{t("ecuaciones.biblioteca.paraTuRubro")}</span>}
                </TituloSeccion>
                <p className="text-tinta-media">{c.queEs}</p>
              </div>
              {!!libres.length && (
                <Boton variante="plano" onClick={() => marcarTodas(c.ecuaciones, !todasMarcadas)}>
                  {todasMarcadas ? t("ecuaciones.biblioteca.desmarcarTodas") : t("ecuaciones.biblioteca.marcarTodas")}
                </Boton>
              )}
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {c.ecuaciones.map((e) => (
                <li key={e.clave}>
                  <Plantilla ecuacion={e} guardada={yaGuardada(e, ecuaciones)} elegida={elegidas.has(e.clave)}
                    abierta={abierta === e.clave} alAlternar={() => alternar(e.clave)}
                    alAbrir={() => setAbierta((a) => (a === e.clave ? null : e.clave))} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {!!fallidas.length && (
        <div role="alert" className="mb-6 rounded-campo bg-rojo/5 p-4 text-rojo">
          <p className="font-bold">{t("ecuaciones.biblioteca.noSeAgregaron")}</p>
          <ul className="mt-1 list-disc pl-5">
            {fallidas.map((f) => <li key={f.clave}><strong>{f.nombre}:</strong> {textoDeError(t, f.error)}</li>)}
          </ul>
        </div>
      )}

      <BotonPrincipalFijo onClick={agregar} disabled={guardando} data-testid="biblioteca-agregar"
        motivo={!cuantas ? t("ecuaciones.biblioteca.elegiAlguna") : undefined}>
        {guardando ? t("ecuaciones.biblioteca.agregando") : t("ecuaciones.biblioteca.agregar", { n: cuantas })}
      </BotonPrincipalFijo>
    </main>
  );
}

function Plantilla({ ecuacion, guardada, elegida, abierta, alAlternar, alAbrir }) {
  const { t } = useIdioma();
  const id = `plantilla-${ecuacion.clave.replace("/", "-")}`;
  return (
    <Tarjeta className={`h-full ${elegida ? "border-2 border-azul" : ""}`}>
      <label htmlFor={id} className={`flex gap-3 ${guardada ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <input id={id} type="checkbox" className="mt-1 size-6 shrink-0 accent-azul" checked={elegida}
          disabled={Boolean(guardada)} onChange={alAlternar} data-testid={`biblioteca-elegir-${ecuacion.clave}`} />
        <span className="min-w-0">
          <span className="block font-bold text-subtitulo text-azul">{ecuacion.nombre}</span>
          <span className="mt-1 block break-all font-mono">
            {ecuacion.formula}{ecuacion.unidad_resultado ? <span className="font-cuerpo text-tinta-media"> → {ecuacion.unidad_resultado}</span> : null}
          </span>
          <span className="mt-1 block text-tinta-media">{ecuacion.descripcion}</span>
          {guardada && (
            <span className="mt-2 inline-flex items-center gap-1 text-etiqueta font-bold text-completo">
              <Icono nombre="check" className="size-4" />
              {t("ecuaciones.biblioteca.yaLaTenes", { nombre: guardada.nombre })}
            </span>
          )}
        </span>
      </label>
      <Boton variante="plano" className="mt-2" aria-expanded={abierta} aria-controls={`${id}-variables`} onClick={alAbrir}>
        {abierta ? t("ecuaciones.biblioteca.ocultarVariables") : t("ecuaciones.biblioteca.verVariables", { n: ecuacion.variables.length })}
      </Boton>
      {abierta && (
        <ul id={`${id}-variables`} className="mt-2 space-y-2">
          {ecuacion.variables.map((variable) => (
            <li key={variable.nombre} className="rounded-campo bg-superficie p-3">
              <p className="font-bold">
                <code>{variable.nombre}</code>
                <span className="font-normal text-tinta-media">
                  {" · "}{variable.tipo === "constante"
                    ? t("ecuaciones.biblioteca.constanteVale", { valor: variable.valor })
                    : t("ecuaciones.editor.tipoVariableMin")}
                  {variable.unidad ? ` · ${variable.unidad}` : ""}
                </span>
              </p>
              {variable.descripcion && <p className="text-etiqueta text-tinta-media">{variable.descripcion}</p>}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}
