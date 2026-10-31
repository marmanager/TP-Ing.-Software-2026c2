"use client";

// "Lo que hablamos por WhatsApp" en la ficha de un cliente (FRONT-2): lo que
// le mandamos, a la derecha, y lo que escribió, a la izquierda, como un chat,
// con un separador cuando cambia el día o el caso. Cómo se arma está en
// conversacion() (lib/recordatorios.js), con sus pruebas.
//
// Se ven los últimos A_LA_VISTA y el resto se abre de a DE_A, pidiendo otra
// página a la API cuando hace falta: un cliente que escribió cincuenta veces
// no tapa sus casos, que vienen abajo. "Sólo lo que escribió" esconde
// nuestros avisos. Aunque haya pedido la baja, lo que dijo se muestra: la
// baja es de lo que se le manda.
//
// La lee quien ve la cola de avisos (entregar_y_reabrir), como pide la API.
// Sin mensajes no hay sección, como "Le toca volver".

import { useEffect, useRef, useState } from "react";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { puede } from "@/lib/permisos";
import { conversacion } from "@/lib/recordatorios";
import { Boton, TituloSeccion } from "@/componentes/ui";

const A_LA_VISTA = 6;
const DE_A = 10;
const POR_PAGINA = 30;

export default function ConversacionDelCliente({ clienteId, rubro }) {
  const datos = useDatos();
  const { casos } = datos;
  const { usuario } = useAuth();
  const { idioma, locale, t } = useIdioma();
  const autorizado = puede(usuario, "entregar_y_reabrir");

  // Del más nuevo al más viejo, como los manda la API.
  const [mensajes, setMensajes] = useState(null);
  const [siguiente, setSiguiente] = useState(null);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState(null);
  const [cuantos, setCuantos] = useState(A_LA_VISTA);
  const [soloSuyo, setSoloSuyo] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const acciones = useRef(datos);
  acciones.current = datos;

  useEffect(() => {
    if (!autorizado || !clienteId) return;
    let vivo = true;
    setMensajes(null);
    setCuantos(A_LA_VISTA);
    acciones.current.leerConversacion(clienteId, { limite: POR_PAGINA }).then((r) => {
      if (!vivo) return;
      if (!r.ok) return setError(r.error);
      setMensajes(r.mensajes);
      setSiguiente(r.siguiente);
      setPendientes(r.pendientes);
    });
    return () => { vivo = false; };
  }, [autorizado, clienteId]);

  if (!autorizado) return null;
  if (error) {
    return (
      <section data-respuestas-del-cliente className="mb-12">
        <TituloSeccion>{t("recordatorios.conversacion.titulo")}</TituloSeccion>
        <p className="text-tinta-media">{textoDeError(t, error)}</p>
      </section>
    );
  }
  if (!mensajes || mensajes.length === 0) return null;

  const filtrados = soloSuyo ? mensajes.filter((m) => m.de === "cliente") : mensajes;
  const visibles = filtrados.slice(0, cuantos);
  const hayMas = filtrados.length > cuantos || Boolean(siguiente);
  const filas = conversacion({ mensajes: visibles, casos, rubro }, { t, locale, idioma });

  async function verAnteriores() {
    if (filtrados.length >= cuantos + DE_A || !siguiente) return setCuantos((n) => n + DE_A);
    setLeyendo(true);
    const r = await acciones.current.leerConversacion(clienteId, { limite: POR_PAGINA, cursor: siguiente });
    setLeyendo(false);
    if (!r.ok) return setError(r.error);
    setMensajes((antes) => [...antes, ...r.mensajes]);
    setSiguiente(r.siguiente);
    setCuantos((n) => n + DE_A);
  }

  async function yaLoVi() {
    setMarcando(true);
    const r = await acciones.current.marcarRespuestasVistas({ clienteId });
    setMarcando(false);
    if (r.ok) setPendientes(0);
  }

  return (
    <section data-respuestas-del-cliente className="mb-12">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <TituloSeccion>{t("recordatorios.conversacion.titulo")}</TituloSeccion>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 text-tinta-media">
            <input type="checkbox" checked={soloSuyo} onChange={(e) => setSoloSuyo(e.target.checked)} className="size-5 accent-azul" />
            {t("recordatorios.conversacion.soloSuyo")}
          </label>
          {pendientes > 0 && (
            <Boton variante="borde" icono="check" motivo={marcando ? t("respuestas.marcando") : null} onClick={yaLoVi}>
              {t("respuestas.yaLoVi")}
            </Boton>
          )}
        </div>
      </div>

      <div className="rounded-tarjeta border border-borde bg-tarjeta px-4 py-4 sm:px-6">
        {hayMas && (
          <div className="mb-3 flex justify-center">
            <Boton variante="plano" icono="flecha-arriba" motivo={leyendo ? t("recordatorios.conversacion.cargando") : null} onClick={verAnteriores}>
              {t("recordatorios.conversacion.verAnteriores")}
            </Boton>
          </div>
        )}
        <ol className="flex flex-col gap-3">
          {filas.map((f) =>
            f.tipo === "separador" ? (
              <li key={f.clave} className="py-1 text-center text-apoyo text-tinta-suave">{f.frase}</li>
            ) : (
              <li
                key={f.clave}
                data-mensaje={f.delNegocio ? "negocio" : "cliente"}
                className={`flex flex-col ${f.delNegocio ? "items-end" : "items-start"}`}
              >
                {f.etiqueta && <span className="mb-1 text-apoyo text-tinta-suave">{f.etiqueta}</span>}
                <p
                  className={[
                    "max-w-[80%] whitespace-pre-wrap rounded-tarjeta px-4 py-2 [overflow-wrap:anywhere]",
                    f.delNegocio ? "bg-azul-claro text-tinta" : "bg-superficie text-tinta",
                    f.escrito.literal ? "" : "text-tinta-media",
                  ].join(" ")}
                >
                  {f.escrito.texto}
                </p>
                <span className="mt-1 text-apoyo text-tinta-suave">
                  {f.hora}
                  {f.nota && <> · <span className="text-completo">{f.nota}</span></>}
                </span>
              </li>
            )
          )}
        </ol>
      </div>
    </section>
  );
}
