"use client";

// "Lo que hablamos por WhatsApp" en la ficha de un cliente (FRONT-2): lo que
// le mandamos, a la derecha, y lo que escribió, a la izquierda, como un chat,
// con un separador cuando cambia el día o el caso. Cómo se arma está en
// conversacion() (lib/recordatorios.js), con sus pruebas.
//
// Se ven los últimos A_LA_VISTA y el resto se abre de a DE_A (y se vuelve a
// cerrar con "Mostrar sólo los últimos"), pidiendo otra
// página a la API cuando hace falta: un cliente que escribió cincuenta veces
// no tapa sus casos, que vienen abajo. Los mensajes van en una caja de alto
// fijo con scroll adentro, que abre en el último: abrir los anteriores no
// estira la ficha, y el lugar para contestar queda siempre a la vista. "Sólo lo que escribió" esconde
// nuestros avisos. Aunque haya pedido la baja, lo que dijo se muestra: la
// baja es de lo que se le manda.
//
// La lee quien ve la cola de avisos (entregar_y_reabrir), como pide la API.
// Sin mensajes no hay sección, como "Le toca volver".
//
// Al pie se le contesta (FRONT-3): con texto libre mientras dure la ventana
// de 24 horas de WhatsApp desde su último mensaje, y si no, con el chat de su
// número desde el teléfono del negocio (ventanaParaEscribir).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { puede } from "@/lib/permisos";
import { conversacion, ventanaParaEscribir } from "@/lib/recordatorios";
import Icono from "@/componentes/Icono";
import { Boton, Campo, TituloSeccion } from "@/componentes/ui";

const A_LA_VISTA = 6;
const DE_A = 10;
const POR_PAGINA = 30;

export default function ConversacionDelCliente({ clienteId, nombre, telefono, rubro, porMail = false }) {
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
  const [ventanaHasta, setVentanaHasta] = useState(null);

  const acciones = useRef(datos);
  acciones.current = datos;

  // Dónde dejar el scroll de la caja después de dibujar: abajo de todo (al
  // abrir, al mandar, al filtrar) o en el mismo mensaje que se estaba leyendo
  // cuando se suman los anteriores arriba (se guarda la distancia al fondo).
  const caja = useRef(null);
  const ajuste = useRef({ modo: "fondo" });
  useLayoutEffect(() => {
    const el = caja.current;
    const { modo, desdeElFondo } = ajuste.current;
    if (!el || !modo) return;
    el.scrollTop = modo === "fondo" ? el.scrollHeight : el.scrollHeight - desdeElFondo;
    ajuste.current = { modo: null };
  });
  const quedarseEnElMensaje = () => {
    const el = caja.current;
    if (el) ajuste.current = { modo: "mantener", desdeElFondo: el.scrollHeight - el.scrollTop };
  };
  const irAlFondo = () => { ajuste.current = { modo: "fondo" }; };

  useEffect(() => {
    if (!autorizado || !clienteId) return;
    let vivo = true;
    setMensajes(null);
    setCuantos(A_LA_VISTA);
    irAlFondo();
    acciones.current.leerConversacion(clienteId, { limite: POR_PAGINA }).then((r) => {
      if (!vivo) return;
      if (!r.ok) return setError(r.error);
      setMensajes(r.mensajes);
      setSiguiente(r.siguiente);
      setPendientes(r.pendientes);
      setVentanaHasta(r.ventanaHasta);
    });
    return () => { vivo = false; };
  }, [autorizado, clienteId]);

  // Desde el caso se llega con #conversacion-whatsapp, pero la sección
  // aparece recién cuando llegan los mensajes: ahí se baja hasta ella.
  const hayMensajes = Boolean(mensajes?.length);
  useEffect(() => {
    if (hayMensajes && window.location.hash === "#conversacion-whatsapp") {
      document.getElementById("conversacion-whatsapp")?.scrollIntoView({ block: "start" });
    }
  }, [hayMensajes]);

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
    quedarseEnElMensaje();
    if (filtrados.length >= cuantos + DE_A || !siguiente) return setCuantos((n) => n + DE_A);
    setLeyendo(true);
    const r = await acciones.current.leerConversacion(clienteId, { limite: POR_PAGINA, cursor: siguiente });
    setLeyendo(false);
    if (!r.ok) return setError(r.error);
    quedarseEnElMensaje();
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
    // El id es el destino del link "Ver la conversación" del caso.
    <section id="conversacion-whatsapp" data-respuestas-del-cliente className="mb-12 scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <TituloSeccion>{t("recordatorios.conversacion.titulo")}</TituloSeccion>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 text-tinta-media">
            <input type="checkbox" checked={soloSuyo} onChange={(e) => { irAlFondo(); setSoloSuyo(e.target.checked); }} className="size-5 accent-azul" />
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
        <div
          ref={caja}
          tabIndex={0}
          role="region"
          aria-label={t("recordatorios.conversacion.titulo")}
          data-conversacion-caja
          className="-mx-2 max-h-[26rem] overflow-y-auto overscroll-contain px-2"
        >
        {(hayMas || cuantos > A_LA_VISTA) && (
          <div className="mb-3 flex flex-wrap justify-center gap-2">
            {hayMas && (
              <Boton variante="plano" icono="flecha-arriba" motivo={leyendo ? t("recordatorios.conversacion.cargando") : null} onClick={verAnteriores}>
                {t("recordatorios.conversacion.verAnteriores")}
              </Boton>
            )}
            {cuantos > A_LA_VISTA && (
              <Boton variante="plano" icono="flecha-abajo" onClick={() => { irAlFondo(); setCuantos(A_LA_VISTA); }}>
                {t("recordatorios.conversacion.soloLosUltimos")}
              </Boton>
            )}
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

        {/* A un cliente de mail no se le escribe por WhatsApp desde acá
            (083): lo que contestó antes queda a la vista. */}
        {porMail ? (
          <p data-conversacion-por-mail className="mt-4 flex max-w-[65ch] items-start gap-2 text-tinta-media">
            <Icono nombre="sobre" className="mt-0.5 size-5 shrink-0" />
            <span>{t("recordatorios.conversacion.porMail")}</span>
          </p>
        ) : (
        <Escribir
          clienteId={clienteId}
          nombre={nombre}
          telefono={telefono}
          ventanaHasta={ventanaHasta}
          escribio={mensajes.some((m) => m.de === "cliente")}
          // Lo último que pasó fue nuestro "retomar": falta que conteste.
          esperandoRetomar={mensajes[0]?.de === "negocio" && mensajes[0]?.tipo === "retomar"}
          alMandar={(mensaje) => {
            // Lo nuevo arriba, como lo manda la API: queda último en el chat.
            irAlFondo();
            setMensajes((antes) => [mensaje, ...antes]);
            setCuantos((n) => n + 1);
            setPendientes(0);
          }}
          alCerrarse={() => setVentanaHasta(null)}
        />
        )}
      </div>
    </section>
  );
}

// El pie de la conversación: el campo para contestarle, o por qué no se
// puede y su chat desde el teléfono del negocio.
function Escribir({ clienteId, nombre, telefono, ventanaHasta, escribio, esperandoRetomar, alMandar, alCerrarse }) {
  const datos = useDatos();
  const { idioma, locale, t } = useIdioma();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState(null);
  const [mandando, setMandando] = useState(false);
  const [retomando, setRetomando] = useState(false);
  // Sin la plantilla de retomar aprobada no se ofrece más (queda wa.me).
  const [sinRetomar, setSinRetomar] = useState(false);
  const ventana = ventanaParaEscribir({ ventanaHasta, telefono, escribio }, { t, locale, idioma });
  const primerNombre = nombre?.split(" ")[0] ?? "";

  async function mandar() {
    if (!texto.trim()) return setError(t("recordatorios.conversacion.falta"));
    setMandando(true);
    const r = await datos.mandarWhatsapp(clienteId, texto.trim());
    setMandando(false);
    if (!r.ok) {
      // Se cerró mientras escribía: se pasa a la otra forma, sin perder el texto.
      if (r.error?.codigo === "ventana_cerrada") return alCerrarse();
      return setError(textoDeError(t, r.error));
    }
    setTexto("");
    alMandar(r.mensaje);
    datos.avisarExito(t("recordatorios.conversacion.mandado", { nombre: primerNombre }));
  }

  // Pasadas las 24 horas: la plantilla para retomar (API-4). Cuando conteste,
  // la ventana se abre de nuevo y vuelve el campo para escribir.
  async function retomar() {
    setError(null);
    setRetomando(true);
    const r = await datos.retomarConversacion(clienteId);
    setRetomando(false);
    if (!r.ok) {
      if (r.error?.codigo === "plantilla_no_configurada") return setSinRetomar(true);
      return setError(textoDeError(t, r.error));
    }
    alMandar(r.mensaje);
    datos.avisarExito(t("recordatorios.conversacion.retomado", { nombre: primerNombre }));
  }

  if (!ventana.abierta && esperandoRetomar) {
    return (
      <div data-escribir="esperando" className="mt-4 border-t border-borde pt-4">
        <p className="flex items-start gap-2 text-tinta-media">
          <Icono nombre="reloj" className="mt-0.5 size-5 shrink-0" />
          <span>{t("recordatorios.conversacion.esperandoRetomar", { nombre: primerNombre })}</span>
        </p>
      </div>
    );
  }

  if (!ventana.abierta) {
    return (
      <div data-escribir="cerrada" className="mt-4 border-t border-borde pt-4">
        <p className="font-bold">{ventana.frase}</p>
        <p className="mt-1 max-w-[65ch] text-tinta-media">{ventana.porQue}</p>
        {escribio && !sinRetomar && (
          <div className="mt-3">
            <Boton variante="principal" icono="chat" motivo={retomando ? t("recordatorios.conversacion.mandando") : null} onClick={retomar}>
              {t("recordatorios.conversacion.retomar")}
            </Boton>
            <p className="mt-1 max-w-[65ch] text-apoyo text-tinta-suave">{t("recordatorios.conversacion.retomarAyuda")}</p>
          </div>
        )}
        {error && <p className="mt-2 font-bold text-rojo">{error}</p>}
        {ventana.link ? (
          <a
            href={ventana.link}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-4 font-bold text-azul hover:bg-azul-claro"
          >
            <Icono nombre="whatsapp" />
            {t("recordatorios.conversacion.ventana.desdeTuWhatsapp")}
          </a>
        ) : (
          <p className="mt-2 text-tinta-media">{ventana.sinLink}</p>
        )}
      </div>
    );
  }

  return (
    <div data-escribir="abierta" className="mt-4 border-t border-borde pt-4">
      <Campo
        id="whatsapp-a-mano"
        etiqueta={t("recordatorios.conversacion.escribile", { nombre: primerNombre })}
        ayuda={ventana.frase}
        error={error}
      >
        <textarea
          id="whatsapp-a-mano"
          rows={3}
          maxLength={4000}
          value={texto}
          placeholder={t("recordatorios.conversacion.ejemplo")}
          onChange={(e) => {
            setTexto(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? "true" : undefined}
          className={`mt-2 block w-full resize-y rounded-campo border-2 bg-tarjeta p-4 text-cuerpo ${error ? "border-rojo" : "border-borde-fuerte"}`}
        />
      </Campo>
      <div className="-mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-apoyo text-tinta-suave">
          {t("recordatorios.conversacion.firma", { negocio: datos.negocio?.nombre ?? "" })}
        </p>
        <Boton variante="principal" icono="chat" motivo={mandando ? t("recordatorios.conversacion.mandando") : null} onClick={mandar}>
          {t("recordatorios.conversacion.mandar")}
        </Boton>
      </div>
    </div>
  );
}
