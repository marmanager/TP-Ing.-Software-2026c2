"use client";

import { useState } from "react";
import { useDatos } from "@/lib/datos";
import { ORDEN_ESTADOS, ESTADOS, significadoDeEstado } from "@/lib/estados";
import { useIdioma } from "@/lib/useIdioma";
import {
  ICONOS_DE_ESTADO,
  configuracionEstadosValida,
  configuracionInicialEstados,
  presentacionEstado,
} from "@/lib/presentacion-estados";
import Icono from "./Icono";
import { Boton, Campo, Tarjeta } from "./ui";

export default function ConfiguracionEstados({ puedeConfigurar }) {
  const datos = useDatos();
  const { t, idioma } = useIdioma();
  const { negocio } = datos;
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(() => configuracionInicialEstados(negocio, idioma));

  function abrir() {
    setBorrador(configuracionInicialEstados(negocio, idioma));
    setEditando(true);
  }

  function cambiar(estado, campo, valor) {
    setBorrador((actual) => ({
      ...actual,
      [estado]: { ...actual[estado], [campo]: valor },
    }));
  }

  function guardar() {
    if (!configuracionEstadosValida(borrador)) return;
    const limpios = Object.fromEntries(
      ORDEN_ESTADOS.map((estado) => [estado, {
        nombre: borrador[estado].nombre.trim(),
        icono: borrador[estado].icono,
      }])
    );
    datos.cambiarPresentacionEstados(limpios);
    setEditando(false);
    datos.avisarExito(t("casos.configEstados.guardado"));
  }

  if (editando) return (
    <Tarjeta className="mb-12">
      <div className="mb-6">
        <p className="font-bold text-cuerpo">{t("casos.configEstados.titulo")}</p>
        <p className="mt-1 max-w-[65ch] text-tinta-media">
          {t("casos.configEstados.apoyo")}
        </p>
      </div>

      <div className="grid gap-5">
        {ORDEN_ESTADOS.map((estado, indice) => {
          const base = ESTADOS[estado];
          const visual = borrador[estado];
          return (
            <fieldset key={estado} className="rounded-tarjeta border border-borde p-4">
              <legend className="px-2 font-bold">{t("casos.configEstados.estado", { n: indice + 1 })}</legend>
              <div className="grid items-end gap-4 md:grid-cols-[minmax(240px,1fr)_minmax(210px,.7fr)]">
                <Campo
                  id={`estado-${estado}-nombre`}
                  etiqueta={t("casos.configEstados.nombre")}
                  ayuda={significadoDeEstado(estado, t)}
                  error={!visual.nombre.trim()
                    ? t("casos.configEstados.sinNombre")
                    : visual.nombre.trim().length > 40 ? t("casos.configEstados.largo") : null}
                  value={visual.nombre}
                  maxLength={41}
                  onChange={(e) => cambiar(estado, "nombre", e.target.value)}
                />
                <label className="mb-4 block" htmlFor={`estado-${estado}-icono`}>
                  <span className="mb-2 block font-bold">{t("casos.configEstados.icono")}</span>
                  <span className="flex min-h-12 items-center gap-3 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-3 focus-within:border-azul">
                    <Icono nombre={visual.icono} className={`size-6 ${base.texto}`} />
                    <select
                      id={`estado-${estado}-icono`}
                      value={visual.icono}
                      onChange={(e) => cambiar(estado, "icono", e.target.value)}
                      className="min-h-11 flex-1 cursor-pointer bg-transparent text-tinta outline-none"
                    >
                      {ICONOS_DE_ESTADO.map((clave) => (
                        <option key={clave} value={clave}>{t(`casos.iconos.${clave}`)}</option>
                      ))}
                    </select>
                  </span>
                </label>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Boton
          variante="principal"
          icono="check"
          motivo={configuracionEstadosValida(borrador) ? null : t("casos.configEstados.revisar")}
          onClick={guardar}
        >
          {t("casos.configEstados.guardar")}
        </Boton>
        <Boton variante="plano" onClick={() => setEditando(false)}>{t("casos.comun.cancelar")}</Boton>
      </div>
    </Tarjeta>
  );

  return (
    <>
      {puedeConfigurar && (
        <div className="mb-4">
          <Boton icono="pincel" onClick={abrir}>{t("casos.configEstados.configurar")}</Boton>
        </div>
      )}
      <ul className="mb-12 overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
        {ORDEN_ESTADOS.map((estado) => {
          const e = presentacionEstado(negocio, estado, idioma);
          return (
            // En celular el estado arriba y lo que significa debajo, a todo el
            // ancho: al lado del estado (con el texto en flex-1) quedaba una
            // columna angosta de dos o tres palabras por línea. Desde sm
            // vuelve la fila.
            <li
              key={estado}
              className="flex flex-col items-start gap-2 border-b border-borde p-4 last:border-b-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
            >
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-etiqueta ${e.fondo} ${e.texto}`}>
                <Icono nombre={e.icono} className="size-5" />
                {e.nombre}
              </span>
              <p className="min-w-0 text-tinta-media sm:flex-1">{significadoDeEstado(estado, t)}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
