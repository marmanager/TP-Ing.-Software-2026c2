"use client";

import { useState } from "react";
import { recomendarModulos } from "@/lib/asistente";
import { alternarModulo, estaPrendido, hijosActivos, LISTA_MODULOS, LISTA_SUBMODULOS, traducirModulo } from "@/lib/modulos";
import { agregar, CATALOGO, INICIO_POR_DEFECTO, normalizarInicio, traducirDelCatalogo } from "@/lib/inicio";
import { Boton, Campo } from "@/componentes/ui";
import PanelAsistente from "./Panel";

const inicial = { descripcion: "", personas: "", turnos: "", stock: "", presupuestos: "", sedes: "" };

export default function RecomendadorModulos({ datos, puedeConfigurar, quienPuede, idioma, t, alCerrar }) {
  const activos = datos.negocio?.modulos_activos ?? [];
  const [form, setForm] = useState(inicial);
  const [resultado, setResultado] = useState(null);
  const [elegidos, setElegidos] = useState(new Set());
  const [confirmando, setConfirmando] = useState(false);

  function analizar() {
    const r = recomendarModulos({ ...form, rubro: datos.negocio?.rubro, idioma }, t);
    setResultado(r);
    setElegidos(new Set([
      ...LISTA_MODULOS.filter((m) => estaPrendido(m.clave, activos)).map((m) => m.clave),
      ...LISTA_MODULOS.flatMap((m) => hijosActivos(m.clave, activos).map((h) => h.clave)),
      ...r.propuesta.modulos.filter((m) => m.nivel === "recomendado").map((m) => m.clave),
      ...r.propuesta.submodulos.filter((m) => m.nivel === "recomendado").map((m) => m.clave),
    ]));
    setConfirmando(false);
  }

  function alternar(clave) {
    setElegidos((antes) => {
      const copia = new Set(antes);
      if (copia.has(clave)) copia.delete(clave); else copia.add(clave);
      return copia;
    });
    setConfirmando(false);
  }

  function aplicar() {
    let siguientes = [...activos];
    for (const item of LISTA_MODULOS) {
      if (estaPrendido(item.clave, siguientes) !== elegidos.has(item.clave)) siguientes = alternarModulo(item.clave, siguientes);
    }
    for (const item of LISTA_SUBMODULOS) {
      const prendido = estaPrendido(item.padre, siguientes) && (LISTA_SUBMODULOS.filter((x) => x.padre === item.padre).some((x) => siguientes.includes(x.clave)) ? siguientes.includes(item.clave) : !item.aPedido);
      if (prendido !== elegidos.has(item.clave)) siguientes = alternarModulo(item.clave, siguientes);
    }
    let inicio = normalizarInicio(INICIO_POR_DEFECTO.filter((m) => resultado.propuesta.inicio.includes(m.clave)));
    for (const clave of resultado.propuesta.inicio) if (!inicio.some((m) => m.clave === clave)) inicio = agregar(inicio, clave);
    datos.cambiarModulos(siguientes);
    datos.cambiarInicio(inicio);
    datos.avisarExito(t("asistente.modulos.aplicado"));
    alCerrar();
  }

  const etiquetaNivel = (nivel) => t(`asistente.modulos.${nivel === "recomendado" ? "recomendado" : nivel === "opcional" ? "opcional" : "noNecesario"}`);
  return (
    <PanelAsistente titulo={t("asistente.modulos.titulo")} apoyo={t("asistente.modulos.apoyo")} t={t} className="mb-8">
      {!resultado ? (
        <>
          <Campo id="asistente-negocio" etiqueta={t("asistente.modulos.descripcion")} ayuda={t("asistente.modulos.ejemplo")}>
            <textarea id="asistente-negocio" className="mt-2 min-h-28 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 py-3" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} autoFocus />
          </Campo>
          <Campo id="asistente-personas" etiqueta={t("asistente.modulos.personas")} type="number" min="1" value={form.personas} onChange={(e) => setForm({ ...form, personas: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            {["turnos", "stock", "presupuestos", "sedes"].map((campo) => (
              <label key={campo} className="block font-bold">
                <span>{t(`asistente.modulos.${campo}`)}</span>
                <select value={form[campo]} onChange={(e) => setForm({ ...form, [campo]: e.target.value })} className="mt-2 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-3 font-normal">
                  <option value="">{t("asistente.modulos.sinDefinir")}</option>
                  <option value="si">{t("asistente.modulos.si")}</option>
                  <option value="no">{t("asistente.modulos.no")}</option>
                </select>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><Boton variante="borde" data-testid="asistente-modulos-analizar" onClick={analizar}>{t("asistente.analizar")}</Boton><Boton variante="plano" onClick={alCerrar}>{t("asistente.cancelar")}</Boton></div>
        </>
      ) : (
        <>
          <p role="status" className="mb-4 text-tinta-media">{resultado.explicacion}</p>
          {!!resultado.preguntas.length && <ul className="mb-4 list-disc pl-5 text-espera">{resultado.preguntas.map((p) => <li key={p}>{p}</li>)}</ul>}
          <ul className="grid gap-3">
            {resultado.propuesta.modulos.map((propuesta) => {
              const modulo = traducirModulo(LISTA_MODULOS.find((m) => m.clave === propuesta.clave), t);
              return <li key={propuesta.clave} className="rounded-campo border border-borde p-3">
                <label className="flex min-h-12 cursor-pointer items-start gap-3"><input className="mt-1 size-5" type="checkbox" checked={elegidos.has(propuesta.clave)} onChange={() => alternar(propuesta.clave)} /><span><strong>{modulo.nombre}</strong><span className="ml-2 text-etiqueta text-tinta-suave">{etiquetaNivel(propuesta.nivel)}</span><span className="mt-1 block text-tinta-media">{propuesta.motivo}</span></span></label>
                {resultado.propuesta.submodulos.filter((s) => s.padre === propuesta.clave && (s.nivel === "recomendado" || elegidos.has(propuesta.clave))).map((sub) => {
                  const nombre = traducirModulo(LISTA_SUBMODULOS.find((s) => s.clave === sub.clave), t).nombre;
                  return <label key={sub.clave} className="ml-8 flex min-h-10 items-center gap-2 text-etiqueta"><input type="checkbox" checked={elegidos.has(sub.clave)} onChange={() => alternar(sub.clave)} />{nombre}</label>;
                })}
              </li>;
            })}
          </ul>
          <p className="mt-5 font-bold">{t("asistente.modulos.inicio")}</p>
          <p className="mt-1 text-tinta-media">{resultado.propuesta.inicio.map((clave) => traducirDelCatalogo(CATALOGO[clave], t)?.nombre ?? clave).join(" · ")}</p>
          {!puedeConfigurar && <p className="mt-4 rounded-campo bg-espera-fondo p-3 text-espera">{t("asistente.modulos.sinPermiso", { quienPuede })}</p>}
          {confirmando && <p role="alert" className="mt-4 rounded-campo border border-espera bg-espera-fondo p-3 font-bold text-espera">{t("asistente.modulos.resumen")}: {elegidos.size}.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Boton variante="borde" data-testid="asistente-modulos-aplicar" motivo={!puedeConfigurar ? t("asistente.modulos.sinPermiso", { quienPuede }) : null} onClick={() => confirmando ? aplicar() : setConfirmando(true)}>{confirmando ? t("asistente.modulos.confirmar") : t("asistente.modulos.aplicar")}</Boton>
            <Boton variante="plano" onClick={() => { setResultado(null); setConfirmando(false); }}>{t("asistente.modulos.volver")}</Boton>
          </div>
        </>
      )}
    </PanelAsistente>
  );
}

