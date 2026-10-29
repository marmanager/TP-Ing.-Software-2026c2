"use client";

// "Ver cómo va un caso" (cartilla, sección 08).
//
// La abren el encargado y el equipo muchas veces por día, casi siempre desde
// el celular. Identificador, estado y "qué falta" tienen que entrar en la
// primera pantalla, sin scrollear.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { conElementos } from "@/lib/conElementos";
import {
  AL_PASAR_A,
  ESTADOS,
  avanceDePasos,
  estaAbierto,
  pesos,
  queFalta,
  quedoTrabajoPendiente,
  quienLoTieneEnPalabras,
  sePuedeMarcarHecho,
} from "@/lib/estados";
import { cuando, cuantoHace, diaDeArgentina, diaEnPalabras, haceCuanto } from "@/lib/fechas";
import { cadaCuantoVuelve, comoSeIdentifica, vocabulario } from "@/lib/presets";
import {
  avisoAlAnotarVolver,
  avisoDeVolver,
  errorDeVolverEn,
  fechaSugerida,
  intervaloDeducido,
} from "@/lib/recordatorios";
import { useRecordatorioVolver } from "@/lib/useRecordatorioVolver";
import { presentacionEstado } from "@/lib/presentacion-estados";
import { hijosActivos } from "@/lib/modulos";
import { casoEnFrase, lineaDelCaso, subtituloDelCaso, tituloDelCaso } from "@/lib/nombres";
import { cobroValido, montoCobrado } from "@/lib/validaciones";
import { cobrosConLoDeAntes, cobrosDelCaso, cuentaDelCaso, descuentoDelCaso } from "@/lib/cobros";
import SelectorEstado from "@/componentes/SelectorEstado";
import SeguimientoWhatsApp from "@/componentes/SeguimientoWhatsApp";
import CuandoVuelve from "@/componentes/CuandoVuelve";
import ListaDeRespuestas from "@/componentes/ListaDeRespuestas";
import { erroresSeguimiento, linkDelAvisoDeAvance, SEGUIMIENTO_VACIO, telefonoWhatsAppValido } from "@/lib/seguimiento-whatsapp";
import SeccionCobros, { ElegirMedio, fraseDeLaCuenta } from "@/componentes/Cobros";
import { telefonoLegible, telefonoParaLlamar } from "@/lib/telefono";
import Icono from "@/componentes/Icono";
import {
  Boton,
  Campo,
  Cargando,
  ErrorGeneral,
  Tarjeta,
  TituloSeccion,
  Vacio,
} from "@/componentes/ui";
import {
  linkDeSeguimiento,
  linkDeWhatsApp,
  mensajeDeLoHecho,
} from "@/lib/seguimiento";

const EVENTOS_A_LA_VISTA = 5;

// Los campos de la entrega que se cargan en el primer paso, el del cobro: si
// la API rechaza uno, el error se muestra ahí.
const CAMPOS_DEL_COBRO = ["monto", "medio", "resto"];

export default function VerCaso() {
  const { id } = useParams();
  const datos = useDatos();
  const { t, idioma, locale } = useIdioma();
  const { cargando, casos, clientes, empleados, pasos, eventos, insumos, negocio } = datos;
  const { usuario } = useAuth();
  // Cada bloque pide el permiso que le exige la base (058): trabajar el caso y
  // compartirlo, entregar y reabrir, cobrar, pedir insumos y asignar.
  const puedeCargar = puede(usuario, "avanzar_casos");
  const puedeEntregar = puede(usuario, "entregar_y_reabrir");
  const puedeCobrar = puede(usuario, "cobrar");
  // Pedir algo para el caso o marcar que llegó también mueve el caso: la API
  // pide los dos permisos.
  const puedePedir = puede(usuario, "editar_inventario") && puede(usuario, "avanzar_casos");
  const puedeDescontar = puede(usuario, "armar_presupuesto");
  const puedeAsignar = puede(usuario, "asignar_casos");
  const [eligiendo, setEligiendo] = useState(false);
  // Identificador del rubro y notas sueltas (SCRUM-51/52). El diagnóstico
  // vive ahora en la pantalla de los pasos.
  const [editandoIdent, setEditandoIdent] = useState(false);
  const [identificador, setIdentificador] = useState("");
  // Editar el caso: su nombre y lo que pidió el cliente (SCRUM-119). Sobre
  // un borrador, como la ficha de Mi negocio: "Cancelar" deshace de verdad.
  const [editandoCaso, setEditandoCaso] = useState(false);
  const [borradorCaso, setBorradorCaso] = useState({ nombre: "", servicio: "" });
  const [anotando, setAnotando] = useState(false);
  const [historialEntero, setHistorialEntero] = useState(false);
  const [nota, setNota] = useState("");
  // Entregar abre el cobro en vez de cerrar de una (SCRUM-74). El monto no
  // arranca editable: confirmar lo aprobado es lo que pasa casi siempre, y
  // cambiarlo pide un toque más y su propio aviso.
  const [entregando, setEntregando] = useState(false);
  const [cambiandoCobro, setCambiandoCobro] = useState(false);
  // Lo que la base contestó cuando no se pudo marcar un paso.
  const [errorPaso, setErrorPaso] = useState(null);
  const [cobro, setCobro] = useState("");
  // Cómo pagó lo que se cobra al entregar, y lo que contestó la base si no
  // se pudo anotar (025).
  const [medioEntrega, setMedioEntrega] = useState("efectivo");
  const [errorEntrega, setErrorEntrega] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  const [notificarCliente, setNotificarCliente] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  // Generar el link desde "Notificar", para que el aviso de avance lo lleve (R-11).
  const [generandoLink, setGenerandoLink] = useState(false);
  const [errorLink, setErrorLink] = useState(null);
  const [seguimientoEntrega, setSeguimientoEntrega] = useState(SEGUIMIENTO_VACIO);
  // Cuándo le toca volver (R-1b): al entregar, y para corregirlo después.
  const [volverEn, setVolverEn] = useState("");
  const [corrigiendoVolver, setCorrigiendoVolver] = useState(false);
  const [guardandoVolver, setGuardandoVolver] = useState(false);
  const [errorVolver, setErrorVolver] = useState(null);
  // Cómo está el aviso de que le toca volver (R-2b): para decir, al anotar
  // la fecha, si se le va a avisar, y en el caso cerrado, cuándo sale.
  const recordatorioVolver = useRecordatorioVolver();
  // La entrega va en dos pasos: 1 el cobro, 2 lo que pasa después.
  const [pasoEntrega, setPasoEntrega] = useState(1);

  // Al cambiar de paso, el foco va al título del paso nuevo: con teclado o
  // lector de pantalla, si no, se queda en un botón que ya no se ve.
  useEffect(() => {
    document.getElementById(`paso-entrega-${pasoEntrega}`)?.focus();
  }, [pasoEntrega]);

  useEffect(() => {
    setNotificarCliente(false);
    setEntregando(false);
    setSeguimientoEntrega(SEGUIMIENTO_VACIO);
    setCorrigiendoVolver(false);
  }, [id]);
  // Si cobra menos de lo que falta: ¿el resto lo paga después, o no se le
  // cobra? Sin esta pregunta, todo lo que no se cobra queda como deuda.
  const [elResto, setElResto] = useState("despues");

  // Lo que el cliente contestó a los avisos de este caso (R-10b), con el
  // aviso que contestaba cada vez. En el orden de la API, del primero al
  // último, como se lee una conversación; "Ver más" trae los siguientes.
  const [respuestas, setRespuestas] = useState({ lista: [], siguiente: null, error: null });
  // Las acciones cambian con cada dato nuevo: con la de la última vuelta,
  // el efecto corre al cambiar de caso y no con cada cambio de la pantalla.
  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = negocio?.id;
  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    setRespuestas({ lista: [], siguiente: null, error: null });
    acciones.current.leerRespuestasDelCaso(id, { limite: 50 }).then((r) => {
      if (!vivo) return;
      setRespuestas(r.ok ? { lista: r.respuestas, siguiente: r.siguiente, error: null } : { lista: [], siguiente: null, error: textoDeError(t, r.error) });
    });
    return () => { vivo = false; };
  }, [id, negocioId]);
  const verMasRespuestas = async () => {
    const r = await acciones.current.leerRespuestasDelCaso(id, { limite: 50, cursor: respuestas.siguiente });
    setRespuestas((antes) =>
      r.ok ? { lista: [...antes.lista, ...r.respuestas], siguiente: r.siguiente, error: null } : { ...antes, error: textoDeError(t, r.error) }
    );
  };

  const caso = casos.find((c) => c.id === id);
  useTitulo(caso ? tituloDelCaso(caso, t) : t("casos.detalle.caso"));

  if (cargando) return <Cargando />;
  if (!caso) {
    return (
      <Vacio icono="buscar" titulo={t("casos.detalle.noEncontrado")}>
        {conElementos(t("casos.detalle.noEsta"), {
          enlace: <Link href="/casos" className="font-bold text-azul">{t("casos.volver")}</Link>,
        })}
      </Vacio>
    );
  }

  const cliente = clientes.find((c) => c.id === caso.cliente_id);
  const nombreEstado = (estado) => presentacionEstado(negocio, estado, idioma).nombre;
  const puedeNotificar = telefonoWhatsAppValido(cliente?.telefono);
  // Sin link, el aviso de avance sale sin él: se dice antes y se ofrece generarlo.
  const sinLinkEnElAviso = notificarCliente && puedeNotificar ? linkDelAvisoDeAvance({ caso, pasos }, t) : null;
  const errorSeguimientoEntrega = Object.values(erroresSeguimiento(seguimientoEntrega, t))[0];

  // El día de hoy en Argentina, el mismo que usa la API para decidir si una
  // fecha ya pasó. Las fechas de volver son días, no instantes.
  const hoy = diaDeArgentina();
  const motivoVolver = errorDeVolverEn(volverEn, hoy, { t });
  // Qué va a pasar con el aviso de la fecha que se está anotando, y qué
  // pasó con el del caso cerrado.
  const avisoAlAnotar = motivoVolver ? null : avisoAlAnotarVolver({ volverEn, volver: recordatorioVolver, cliente, hoy }, { t, locale, idioma });
  const avisoVolver = avisoDeVolver({ caso, cliente, volver: recordatorioVolver, hoy }, { t, locale, idioma });
  // Sólo para un rubro sin intervalo típico: si el cliente ya vino tres
  // veces o más con un ritmo parejo, se le ofrece esa fecha.
  const sugerenciaVolver = cadaCuantoVuelve(negocio?.rubro)
    ? null
    : intervaloDeducido(
        casos.filter((c) => c.cliente_id === caso.cliente_id && c.id !== caso.id).map((c) => diaDeArgentina(c.abierto_en)),
        hoy
      );

  async function generarLinkDelAviso() {
    if (generandoLink) return;
    setErrorLink(null);
    setGenerandoLink(true);
    try {
      // compartirCaso() devuelve el mismo código si ya hubiera uno: nunca
      // genera otro, y el que el cliente tenga sigue andando.
      const r = await datos.compartirCaso(caso.id);
      if (!r.ok) return setErrorLink(textoDeError(t, r.error));
      datos.avisarExito(r.quedaEsperando
        ? t("casos.detalle.linkGeneradoEsperando")
        : t("casos.detalle.linkGenerado"));
    } finally {
      setGenerandoLink(false);
    }
  }

  async function cambiarEstadoDelCaso(nuevo) {
    if (cambiandoEstado || cerrando) return;
    setCambiandoEstado(true);
    try {
      await datos.cambiarEstado(caso.id, nuevo, {
        notificarCliente: notificarCliente && puedeNotificar,
      });
    } finally {
      setCambiandoEstado(false);
    }
  }
  const mios = pasos.filter((p) => p.caso_id === caso.id).sort((a, b) => a.orden - b.orden);
  const historial = eventos
    .filter((e) => e.caso_id === caso.id)
    .sort((a, b) => new Date(b.ocurrido_en) - new Date(a.ocurrido_en));
  const insumosDelCaso = insumos.filter((i) => i.caso_id === caso.id);

  const aprobado = mios.filter((p) => p.estado === "aprobado").reduce((s, p) => s + Number(p.monto), 0);
  const esperando = mios.filter((p) => p.estado === "esperando");
  const barra = ESTADOS[caso.estado].barra;
  const comoIdent = comoSeIdentifica(negocio?.rubro, idioma);
  const falta = queFalta(caso, { rubro: negocio?.rubro, pasos, insumos, cliente, idioma }, t);
  const aprobados = mios.filter((p) => p.estado === "aprobado");
  const avance = avanceDePasos(mios);
  // Los cobros de este caso y la cuenta contra lo aprobado (025). Un caso
  // puede tener varios: una seña y el resto.
  const cobrosDeEste = cobrosConLoDeAntes(cobrosDelCaso(datos.cobros ?? [], caso.id), caso);
  const descuento = descuentoDelCaso(caso, aprobado);
  const cuenta = cuentaDelCaso({ aprobado, cobros: cobrosDeEste, descuento });

  // Marcar el propio trabajo no es mover plata, así que el técnico también
  // puede — pero sólo sobre un caso que tiene asignado, que es la misma
  // frontera que ya usa la tabla "caso". La base hace cumplir las dos reglas
  // (021_paso_hecho.sql); esto es para no ofrecer un botón que va a fallar.
  const miFicha = empleados.find((e) => e.usuario_id === usuario?.id) ?? null;
  const puedoMarcar =
    puedeCargar || Boolean(miFicha && caso.responsable_id === miFicha.id);

  // Un caso cerrado es el registro de lo que pasó, no un borrador: no se le
  // cambian el diagnóstico ni los pasos sin volver a abrirlo primero. No queda
  // nada trabado, porque volver a abrirlo está a un toque acá abajo.
  const abierto = estaAbierto(caso);
  const sePuedeEditar = puedeCargar && abierto;
  const sePuedeAsignar = puedeAsignar && abierto;

  // Cómo se lee el encabezado (SCRUM-119). Lo que ya dice el título no se
  // repite en las líneas de abajo.
  const titulo = tituloDelCaso(caso, t);
  const subtitulo = subtituloDelCaso(caso, t);
  const identDistinto = caso.identificador && caso.identificador !== titulo;
  const lineaDeAbajo = lineaDelCaso(caso, cliente?.nombre, t);

  function abrirEdicionCaso() {
    setBorradorCaso({ nombre: caso.nombre ?? "", servicio: caso.servicio ?? "" });
    setEditandoCaso(true);
  }

  function guardarEdicionCaso() {
    datos.editarCaso(caso.id, borradorCaso);
    setEditandoCaso(false);
    datos.avisarExito(t("casos.detalle.actualizado"));
  }

  // Lo que pidió el cliente no puede quedar vacío; el nombre sí, y vacío
  // quiere decir que el caso vuelve a verse con su número.
  const motivoEdicionCaso = !borradorCaso.servicio.trim() ? t("casos.detalle.faltaServicio") : null;

  // Para "Pedir un repuesto para este caso": la palabra del rubro, y si el
  // negocio tiene la pantalla "En camino" adonde lleva.
  const { articulo } = vocabulario(negocio?.rubro, idioma);
  const conEnCamino = hijosActivos("inventario", negocio?.modulos_activos ?? []).some(
    (h) => h.clave === "en_camino"
  );

  return (
    <>
      <Link href="/casos" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
        <Icono nombre="volver" />
        {t("casos.volver")}
      </Link>

      {/* Lo importante, sin scrollear: identificador, estado y qué falta.

          La tarjeta NO lleva overflow-hidden: el desplegable del estado sale
          de sus bordes y quedaba cortado al medio. El recorte estaba sólo
          para que la barra de color respetara las esquinas, así que la barra
          es el borde de arriba de la tarjeta (más grueso y de color): un
          borde sigue la curva solo, y cualquier menú que se abra acá adentro
          ya no se corta. */}
      <div
        className="rounded-tarjeta border border-borde bg-tarjeta"
        style={{ borderTopWidth: 6, borderTopColor: `var(--color-${barra.slice(3)})` }}
      >
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* El nombre es el título, y el número queda abajo en chiquito
                (SCRUM-119). Lo que ya dice el título no se repite abajo: un
                caso nombrado por la patente no dice "AB 123 CD · AB 123 CD",
                ni uno nombrado por el cliente lo nombra dos veces. */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-ident">
                  {titulo}
                  {identDistinto && (
                    <span className="text-tinta-media"> · {caso.identificador}</span>
                  )}
                </h1>
                {sePuedeEditar && !editandoCaso && (
                  <Boton variante="plano" icono="pincel" onClick={abrirEdicionCaso}>
                    {t("casos.detalle.editar")}
                  </Boton>
                )}
              </div>
              {subtitulo && <p className="text-apoyo text-tinta-suave">{subtitulo}</p>}
              {lineaDeAbajo && <p className="mt-1 text-tinta-media">{lineaDeAbajo}</p>}
            </div>
            {/* El estado se cambia donde se lee. Antes había que leerlo acá
                arriba, bajar hasta "Cómo sigue" y buscar cuál de tres botones
                correspondía; ahora se toca el chip y se elige.

                Sólo mueve el caso entre los estados abiertos: entregar abre
                el formulario de cobro y tiene su botón, y de un caso cerrado
                se sale por "Volver a abrirlo". */}
            <div>
              <div className="flex flex-wrap items-center gap-3">
                {sePuedeEditar && (
                  <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 font-bold text-etiqueta">
                    <input
                      type="checkbox"
                      checked={notificarCliente && puedeNotificar}
                      disabled={!puedeNotificar || cambiandoEstado || cerrando}
                      onChange={(e) => setNotificarCliente(e.target.checked)}
                      aria-describedby="notificar-estado-ayuda"
                      className="size-5 accent-azul"
                    />
                    <span className="inline-flex items-center gap-1">
                      <Icono nombre="whatsapp" className="size-6 text-completo" />
                      <span>{t("casos.detalle.notificar")}</span>
                    </span>
                  </label>
                )}
                <SelectorEstado
                  estado={caso.estado}
                  negocio={negocio}
                  sePuedeCambiar={sePuedeEditar && !cambiandoEstado && !cerrando}
                  alElegir={cambiarEstadoDelCaso}
                />
              </div>
              {sePuedeEditar && (
                <p id="notificar-estado-ayuda" className="mt-1 max-w-[36ch] text-apoyo text-tinta-media">
                  {!puedeNotificar ? t("casos.detalle.notificarFalta")
                    : t("casos.detalle.notificarAyuda")}
                </p>
              )}
              {sePuedeEditar && sinLinkEnElAviso && (
                <div className="mt-2 max-w-[36ch]">
                  <p className="flex items-start gap-2 text-tinta-media">
                    <Icono nombre="sobre" className="mt-1 size-5 shrink-0" />
                    <span>{sinLinkEnElAviso.frase}</span>
                  </p>
                  {sinLinkEnElAviso.consecuencia && (
                    <p className="mt-1 text-apoyo text-tinta-media">{sinLinkEnElAviso.consecuencia}</p>
                  )}
                  {errorLink && (
                    <p role="alert" className="mt-1 flex items-start gap-2 font-bold text-rojo">
                      <Icono nombre="alerta" className="mt-1 size-5 shrink-0" />
                      <span>{errorLink}</span>
                    </p>
                  )}
                  <Boton
                    className="mt-2"
                    icono="sobre"
                    motivo={generandoLink ? t("casos.detalle.generandolo") : cambiandoEstado ? t("casos.detalle.cambiandoEstado") : null}
                    onClick={generarLinkDelAviso}
                  >
                    {sinLinkEnElAviso.boton}
                  </Boton>
                </div>
              )}
            </div>
          </div>

          {/* Editar el caso (SCRUM-119). Guardar va con borde y no azul: esta
              pantalla ya tiene su botón azul, el del presupuesto, y la cartilla
              permite uno solo. */}
          {editandoCaso && sePuedeEditar && (
            <div className="mt-6 max-w-[560px] border-t border-borde pt-6">
              <Campo
                id="caso-nombre"
                etiqueta={t("casos.detalle.nombreDelCaso")}
                ayuda={t("casos.detalle.nombreDelCasoAyuda", { numero: caso.numero })}
                maxLength={80}
                autoComplete="off"
                value={borradorCaso.nombre}
                onChange={(e) => setBorradorCaso((b) => ({ ...b, nombre: e.target.value }))}
              />
              <Campo
                id="caso-servicio"
                etiqueta={t("casos.detalle.servicio")}
                ayuda={t("casos.detalle.servicioAyuda")}
                autoComplete="off"
                value={borradorCaso.servicio}
                onChange={(e) => setBorradorCaso((b) => ({ ...b, servicio: e.target.value }))}
              />
              <div className="flex flex-wrap gap-3">
                <Boton icono="check" motivo={motivoEdicionCaso} onClick={guardarEdicionCaso}>
                  {t("casos.comun.guardar")}
                </Boton>
                <Boton variante="plano" onClick={() => setEditandoCaso(false)}>
                  {t("casos.comun.cancelar")}
                </Boton>
              </div>
            </div>
          )}

          <p className="mt-4 text-cuerpo">
            {/* Derivado de los pasos y los insumos, no de lo guardado: así
                dice el próximo paso y no repite el chip de arriba. Se fue
                también la aclaración entre paréntesis del rubro: con un texto
                específico pasó a ser ruido, y en control final las dos salían
                del mismo lugar y se leía "Control antes de entregar (Control
                antes de entregar)". */}
            <span className="font-bold">{t("casos.detalle.queFalta")}</span> {falta}
          </p>

          {/* Los datos del caso, cada uno con su nombre arriba y su valor
              abajo. Antes eran frases sueltas con un ícono adelante, en tres
              columnas, y lo que se abría —elegir a quién asignarle— crecía
              adentro de su celda: la grilla se deformaba, los nombres del
              equipo quedaban flotando en el medio de la nada y los otros dos
              datos se iban al costado.

              Ahora la lista no se mueve: lo que se abre va abajo, a lo ancho
              de la tarjeta. Y el identificador dejó de ser un enlace suelto
              perdido al final para ser un dato más, en el lugar donde alguien
              lo va a buscar. */}
          <dl className="mt-5 grid gap-x-6 gap-y-4 @2xl:grid-cols-2">
            <Dato icono="persona" que={t("casos.detalle.quienLoTiene")}>
              {quienLoTieneEnPalabras(caso, empleados, t)}
              {sePuedeAsignar && (
                <div className="mt-1 -ml-3">
                  <Boton
                    variante="plano"
                    icono="persona-mas"
                    data-testid="caso-asignar"
                    onClick={() => setEligiendo((v) => !v)}
                  >
                    {caso.responsable_id ? t("casos.detalle.cambiarQuien") : t("casos.detalle.asignarAlguien")}
                  </Boton>
                </div>
              )}
            </Dato>

            <Dato icono="nota" que={comoIdent.nombre}>
              {caso.identificador || (
                <span className="text-tinta-suave">{t("casos.detalle.sinCargar")}</span>
              )}
              {sePuedeEditar && !editandoIdent && (
                <div className="mt-1 -ml-3">
                  <Boton
                    variante="plano"
                    icono="nota"
                    onClick={() => {
                      setIdentificador(caso.identificador ?? "");
                      setEditandoIdent(true);
                    }}
                  >
                    {caso.identificador ? t("casos.detalle.corregir") : t("casos.detalle.cargar", { identificador: comoIdent.enFrase })}
                  </Boton>
                </div>
              )}
            </Dato>

            <Dato icono="reloj" que={t("casos.detalle.cuandoEntro")}>
              {haceCuanto(caso.abierto_en, t)}
            </Dato>

            {/* El teléfono es lo único de esta lista que se toca, y llamar al
                cliente es lo que se hace apurado y con una mano: el área
                táctil es todo el renglón y no sólo los dígitos. */}
            {cliente?.telefono && (
              <Dato icono="telefono" que={t("casos.detalle.telefono")}>
                <a
                  href={`tel:${telefonoParaLlamar(cliente.telefono)}`}
                  className="-mx-2 inline-flex min-h-12 items-center rounded-campo px-2 font-bold text-azul hover:bg-azul-claro"
                >
                  {telefonoLegible(cliente.telefono)}
                </a>
              </Dato>
            )}

            {/* Compartido o no, sin botones: los controles viven en la
                pantalla de los pasos, que es donde está lo que se manda. Acá
                alcanza con saber si el cliente ya lo miró, que es lo que dice
                si hace falta llamarlo. */}
            {caso.seguimiento_codigo && (
              <Dato icono="sobre" que={t("casos.detalle.linkDelCliente")}>
                {caso.seguimiento_visto_en
                  ? t("casos.detalle.loAbrio", { cuando: cuantoHace(caso.seguimiento_visto_en, t) })
                  : t("casos.detalle.compartido")}
              </Dato>
            )}
          </dl>

          {/* Lo que se abre, abajo y a lo ancho. Adentro de la grilla
              deformaba la fila entera. */}
          {eligiendo && sePuedeAsignar && (
            <div className="mt-4 rounded-tarjeta bg-superficie p-4">
              <p className="font-bold text-cuerpo">{t("casos.detalle.quienLoVaAAtender")}</p>
              {empleados.length === 0 ? (
                <p className="mt-1 max-w-[65ch] text-tinta-media">
                  {conElementos(t("casos.detalle.sinEquipo"), {
                    enlace: (
                      <Link href="/equipo" className="font-bold text-azul">
                        {t("casos.detalle.equipo")}
                      </Link>
                    ),
                  })}
                </p>
              ) : (
                <>
                  <p className="mt-1 max-w-[65ch] text-tinta-media">
                    {t("casos.detalle.alElegir", { estado: nombreEstado("en_proceso").toLowerCase() })}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2.5">
                    {empleados.map((e) => (
                      <li key={e.id}>
                        <Boton
                          variante={e.id === caso.responsable_id ? "borde" : "neutro"}
                          icono="persona"
                          data-testid={`caso-asignar-opcion-${e.nombre}`}
                          onClick={() => {
                            datos.asignarResponsable(caso.id, e.id);
                            datos.avisarExito(t("casos.detalle.loAtiende", { caso: casoEnFrase(caso, t), nombre: e.nombre }));
                            setEligiendo(false);
                          }}
                        >
                          {e.nombre}
                        </Boton>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-3">
                <Boton variante="plano" onClick={() => setEligiendo(false)}>
                  {t("casos.detalle.dejarloComoEsta")}
                </Boton>
              </div>
            </div>
          )}

          {/* El identificador —la patente, el DNI, el número de serie— es
              cómo se reconoce el caso, no un diagnóstico: vive acá arriba, al
              lado del número, y se carga y se corrige acá (auditoría, H2). */}
          {editandoIdent && sePuedeEditar && (
            <div className="mt-4 max-w-[320px]">
              <Campo
                id="identificador"
                etiqueta={comoIdent.nombre}
                ayuda={t("casos.detalle.identificadorAyuda", { ejemplo: comoIdent.ejemplo })}
                autoComplete="off"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <Boton
                  icono="check"
                  motivo={!identificador.trim() ? t("casos.detalle.faltaIdentificador", { identificador: comoIdent.enFrase }) : null}
                  onClick={() => {
                    datos.ponerIdentificador(caso.id, identificador.trim());
                    // "Cambiamos" y no "quedó corregida": el artículo de
                    // enFrase cambia con el rubro y el adjetivo no concuerda
                    // ("corregida la patente", pero "corregido el DNI").
                    datos.avisarExito(
                      caso.identificador
                        ? t("casos.detalle.identificadorCambiado", { identificador: comoIdent.enFrase, caso: casoEnFrase(caso, t) })
                        : t("casos.detalle.identificadorCargado", { identificador: comoIdent.enFrase, caso: casoEnFrase(caso, t) })
                    );
                    setEditandoIdent(false);
                  }}
                >
                  {t("casos.comun.guardar")}
                </Boton>
                <Boton variante="plano" onClick={() => setEditandoIdent(false)}>
                  {t("casos.comun.dejarlo")}
                </Boton>
              </div>
            </div>
          )}

          {/* Un único botón azul: el que casi siempre se va a tocar.
              Aparece siempre, también sin pasos: si no, a un caso recién
              abierto no habría por dónde armarle el presupuesto. */}
          <Link href={`/casos/${caso.id}/pasos`} className="mt-6 block sm:inline-block">
            <span className="flex min-h-14 items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado sm:min-h-12">
              <Icono nombre="nota" />
              {esperando.length > 0 && abierto
                ? t("casos.detalle.verPasosAAprobar", { n: esperando.length })
                : mios.length > 0
                  ? t("casos.detalle.verPasos")
                  : sePuedeEditar
                    ? t("casos.detalle.armarPresupuesto")
                    : t("casos.detalle.verPresupuesto")}
            </span>
          </Link>

          {/* Lo que el cliente ya aprobó, que es la lista de trabajo del
              técnico. Estaba un toque más adentro, en la pantalla de los
              pasos, y es lo primero que se viene a mirar. */}
          {aprobados.length > 0 && (
            <div className="mt-6">
              <p className="font-bold text-cuerpo">
                {t("casos.detalle.loQueHayQueHacer")}{" "}
                <span className="font-normal text-apoyo text-tinta-suave">
                  {t("casos.detalle.hechos", { hechos: avance.hechos, aprobados: avance.aprobados })}
                </span>
              </p>
              <ul className="mt-2 divide-y divide-borde rounded-campo border border-borde">
                {aprobados.map((p) => {
                  const hecho = Boolean(p.hecho_en);
                  const sePuede = puedoMarcar && sePuedeMarcarHecho(p, caso);

                  /* Hecho y pendiente se distinguen por tres cosas y no sólo
                     por el color: el ícono cambia de círculo vacío a tilde,
                     aparece la palabra "Hecho" y el nombre se pone gris. En
                     blanco y negro se sigue leyendo (cartilla, 02). */
                  const adentro = (
                    <>
                      <span
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                          hecho ? "bg-completo-fondo text-completo" : "bg-superficie text-tinta-suave"
                        }`}
                      >
                        <Icono nombre={hecho ? "listo" : "circulo"} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block font-bold ${hecho ? "text-tinta-suave line-through" : ""}`}
                        >
                          {p.nombre}
                        </span>
                        {hecho ? (
                          <span className="block text-apoyo font-bold text-completo">{t("casos.detalle.hecho")}</span>
                        ) : (
                          p.descripcion && (
                            <span className="block text-apoyo text-tinta-suave">
                              {p.descripcion}
                            </span>
                          )
                        )}
                      </span>
                      <span className="shrink-0 font-bold tabular-nums">{pesos(p.monto, locale)}</span>
                    </>
                  );

                  return (
                    <li key={p.id}>
                      {sePuede ? (
                        <button
                          type="button"
                          aria-pressed={hecho}
                          aria-label={
                            hecho
                              ? t("casos.detalle.estaHecho", { nombre: p.nombre })
                              : t("casos.detalle.marcarHecho", { nombre: p.nombre })
                          }
                          onClick={async () => {
                            const r = await datos.marcarPasoHecho(p.id, !hecho);
                            if (!r.ok) return setErrorPaso(textoDeError(t, r.error));
                            setErrorPaso(null);
                            if (r.cambio && !hecho) datos.avisarExito(t("casos.detalle.quedoHecho", { nombre: p.nombre }));
                          }}
                          className="flex w-full min-h-12 cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-superficie"
                        >
                          {adentro}
                        </button>
                      ) : (
                        <div className="flex items-start gap-3 px-4 py-3">{adentro}</div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {errorPaso && (
                <div className="mt-3">
                  <ErrorGeneral>{errorPaso}</ErrorGeneral>
                </div>
              )}

              {/* El camino de vuelta (flujo, punto 10). Se controló todo y
                  justo ahí apareció otra cosa: se sumó un paso, el cliente
                  lo aprobó, y el caso quedó diciendo "control final" con
                  trabajo nuevo adentro.

                  Acá se avisa y se ofrece volver, no se corrige solo: puede
                  ser que el paso nuevo se haga después de entregar, y eso lo
                  decide quien está mirando. Cuando el que aprueba es el
                  cliente desde el link no hay nadie mirando, y ahí sí el
                  caso vuelve solo (022_el_cliente_destraba.sql). */}
              {quedoTrabajoPendiente(caso, mios) && abierto && (
                <div className="mt-3 rounded-tarjeta border-2 border-espera bg-espera-fondo p-4">
                  <p className="flex items-start gap-2 font-bold text-cuerpo text-espera">
                    <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                    <span>{t("casos.detalle.quedoTrabajo")}</span>
                  </p>
                  <p className="mt-1 max-w-[65ch] text-tinta-media">
                    {t("casos.detalle.quedoTrabajoTexto", { estado: nombreEstado("revision_final"), n: avance.faltan })}
                  </p>
                  <div className="mt-4">
                    <Boton
                      icono="llave"
                      motivo={cambiandoEstado || cerrando ? t("casos.comun.guardando") : null}
                      onClick={() =>
                        cambiarEstadoDelCaso("en_proceso", AL_PASAR_A.en_proceso)
                      }
                    >
                      {t("casos.detalle.volverloA", { estado: nombreEstado("en_proceso") })}
                    </Boton>
                  </div>
                </div>
              )}

              {/* Lo ofrece, no lo hace solo: terminar el trabajo y decidir que
                  está para controlar son dos cosas, y la segunda la decide
                  una persona. */}
              {avance.todoHecho && abierto && caso.estado !== "revision_final" && (
                <div className="mt-3 rounded-tarjeta bg-superficie p-4">
                  <p className="font-bold text-cuerpo">{t("casos.detalle.terminasteTodo")}</p>
                  <p className="mt-1 max-w-[65ch] text-tinta-media">
                    {t("casos.detalle.terminasteTodoTexto", { n: avance.aprobados, estado: nombreEstado("revision_final") })}
                  </p>
                  <div className="mt-4">
                    <Boton
                      icono="nota"
                      motivo={cambiandoEstado || cerrando ? t("casos.comun.guardando") : null}
                      onClick={() =>
                        cambiarEstadoDelCaso("revision_final", AL_PASAR_A.revision_final)
                      }
                    >
                      {t("casos.detalle.pasarloA", { estado: nombreEstado("revision_final") })}
                    </Boton>
                  </div>
                </div>
              )}
            </div>
          )}

          {mios.length > 0 && (
            <p className="mt-3 text-tinta-media">
              {conElementos(t("casos.detalle.aprobadoHastaAhora"), {
                monto: <span className="font-bold text-tinta">{pesos(aprobado, locale)}</span>,
              })}
            </p>
          )}

          {/* Se compara con != null y no con un if a secas: cobrar cero es un
              dato, y `0` a secas se leería como "no hay nada que mostrar".
              El Number() es porque la base devuelve numeric como texto. */}
          {caso.cobrado != null && (
            <p className="mt-1 text-tinta-media">
              {conElementos(t("casos.cobros.cobradoMonto"), {
                monto: <span className="font-bold text-tinta">{pesos(Number(caso.cobrado), locale)}</span>,
              })}
              {/* La guarda va sobre la fecha y no sobre cuando(): cuando(null)
                  devuelve el 1 de enero de 1970 y cuando(undefined) explota. */}
              {caso.cobrado_en ? ` · ${cuando(caso.cobrado_en, locale, t)}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Lo que queda acá NO son cambios de estado: esos se hacen desde el
          desplegable del chip, arriba, donde el estado se lee.

          Marcar que un insumo llegó es una acción sobre el insumo —cambia su
          estado, no el del caso— y por eso sobrevive a la desaparición de
          "Cómo sigue". Antes estaba mezclada con los pasajes y parecía una
          más del montón. */}
      {/* Pedir algo para este caso (SCRUM-113) va al lado de marcar que
          llegó: son las dos puntas de lo mismo. Lleva a "En camino" con el
          caso ya elegido, y sólo si el negocio tiene esa pantalla. */}
      {abierto && puedePedir &&
        (insumosDelCaso.some((i) => i.estado !== "en_stock") || conEnCamino) && (
        <div className="mt-12 flex flex-wrap items-start gap-3">
          {insumosDelCaso
            .filter((i) => i.estado !== "en_stock")
            .map((i) => (
              <Boton key={i.id} icono="camion" onClick={() => datos.marcarInsumoLlegado(i.id)}>
                {t("casos.detalle.marcarLlego", { nombre: i.nombre.toLowerCase() })}
              </Boton>
            ))}
          {conEnCamino && (
            <Link
              href={`/inventario/en-camino?caso=${caso.id}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-cuerpo text-azul hover:bg-azul-claro"
            >
              <Icono nombre="mas" className="size-6" />
              {t("casos.detalle.pedirParaElCaso", { articulo: articulo.un() })}
            </Link>
          )}
        </div>
      )}

      {/* Contarle al cliente que ya está (flujo, punto 9). Va antes de
          "Terminar el caso" porque es lo que se hace justo antes: primero se
          le avisa, después viene a buscarlo y recién ahí se entrega. */}
      {/* Lo que se cobró y lo que falta. Va antes de avisarle y de
          entregar porque es lo que se mira justo antes: si dejó una seña,
          cuánto le queda por pagar. */}
      <SeccionCobros
        caso={caso}
        aprobado={aprobado}
        cobros={cobrosDeEste}
        descuento={descuento}
        puedeCargar={puedeCobrar}
        puedeDescontar={puedeDescontar}
        datos={datos}
        cliente={cliente}
        negocio={negocio}
      />

      {puedeCargar && (caso.estado === "revision_final" || caso.estado === "completado") && (
        <AvisarleQueEstaListo
          caso={caso}
          cliente={cliente}
          negocio={negocio}
          datos={datos}
          aprobados={aprobados}
        />
      )}

      {/* Cerrar el caso y volver a abrirlo: las dos puntas de lo mismo, en
          el mismo lugar de la pantalla y con el mismo peso.

          Van después de "avisarle que ya está" porque ese es el orden en que
          pasa: primero se le avisa, después viene a buscarlo, y recién ahí se
          entrega. Antes estaban antes, y encima con una pinta distinta de la
          de todas las demás secciones: un título suelto con una línea arriba
          en vez de la tarjeta con título que usa el resto. */}
      {abierto && !puedeEntregar ? null : abierto ? (
        <>
          <TituloSeccion className="mt-12">{t("casos.detalle.terminar")}</TituloSeccion>
          <Tarjeta>
            {/* Cerrar se puede desde cualquier estado abierto, no sólo después
                del control final: un trabajo puede terminarse antes de lo
                previsto —el cliente lo pasa a buscar, no tenía nada— y obligar
                a caminar toda la cadena para reflejarlo sería mentirle al
                estado. El botón dice lo que hace: entrega Y cierra (cartilla,
                sección 06). Va destacado sólo cuando es lo que sigue. */}
            {!entregando ? (
              <>
                <p className="max-w-[65ch] text-tinta-media">
                  {cliente?.nombre
                    ? t("casos.detalle.entregaTexto", { nombre: cliente.nombre.split(" ")[0] })
                    : t("casos.detalle.entregaTextoSinNombre")}
                </p>
                <div className="mt-4">
                  <Boton
                    variante={caso.estado === "revision_final" ? "borde" : "neutro"}
                    icono="listo"
                    data-testid="caso-entregar"
                    onClick={() => {
                      // Viene precargado con lo que falta cobrar, que es lo
                      // que casi siempre se cobra: lo aprobado, menos la seña
                      // si dejó una.
                      setCobro(cuenta.falta > 0 ? String(cuenta.falta) : "");
                      setCambiandoCobro(cuenta.falta === 0 && cobrosDeEste.length === 0);
                      setMedioEntrega("efectivo");
                      setElResto("despues");
                      setErrorEntrega(null);
                      setSeguimientoEntrega(SEGUIMIENTO_VACIO);
                      // Ya cargada con la fecha típica del rubro: casi
                      // siempre es la que le acaban de decir al cliente.
                      setVolverEn(fechaSugerida({ rubro: negocio?.rubro, hoy }) ?? "");
                      setPasoEntrega(1);
                      setEntregando(true);
                    }}
                  >
                    {t("casos.detalle.entregar")}
                  </Boton>
                </div>
              </>
            ) : (
              /* El cobro se registra acá y no en una pantalla aparte:
                 entregar y cobrar son un solo momento en el mostrador, y es
                 el único en que alguien tiene el número delante. Se puede
                 entregar sin cobrar —te paga después, o es una garantía—, y
                 por eso el campo vacío también cierra el caso.

                 Va en dos pasos —el cobro, y lo que pasa después de
                 entregar— porque junto pasaba los seis campos por pantalla de
                 la cartilla (sección 05). Nada se guarda hasta el final: el
                 segundo paso manda todo en una sola entrega, como pide la API
                 (cobro, cierre y cuándo vuelve en la misma operación). Los
                 dos pasos quedan montados y se esconde el que no se ve, así
                 volver al cobro no borra lo que se escribió. */
              <>
              <div hidden={pasoEntrega !== 1}>
                <p
                  id="paso-entrega-1"
                  tabIndex={-1}
                  className="mb-4 font-bold text-etiqueta text-tinta-media outline-none"
                >
                  {t("casos.detalle.paso1")}
                </p>
                <p className="flex items-start gap-2 rounded-campo bg-espera-fondo p-4 text-espera">
                  <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                  <span>
                    <span className="font-bold">{t("casos.detalle.vasACerrar")}</span>{" "}
                    {t("casos.detalle.vasACerrarTexto")}
                  </span>
                </p>

                {/* Si ya dejó algo (una seña), se dice antes que nada: el
                    monto de abajo es lo que falta, no el total. */}
                {cobrosDeEste.length > 0 && (
                  <p className="mt-4 text-tinta-media">
                    {conElementos(
                      t(
                        cuenta.pendiente > 0
                          ? aprobado > 0 ? "casos.detalle.yaPagoPendienteAprobado" : "casos.detalle.yaPagoPendiente"
                          : aprobado > 0 ? "casos.detalle.yaPagoAprobado" : "casos.detalle.yaPago",
                        { aprobado: pesos(aprobado, locale) }
                      ),
                      {
                        pagado: <span className="font-bold text-tinta">{pesos(cuenta.pagado, locale)}</span>,
                        pendiente: <span className="font-bold text-tinta">{pesos(cuenta.pendiente, locale)}</span>,
                      }
                    )}
                  </p>
                )}

                {/* El monto no arranca editable: en la enorme mayoría de los
                    casos se cobra lo que falta, y lo que hay que hacer es
                    confirmar, no escribir. Cambiarlo es la excepción y pide un
                    toque más, con su propio aviso. */}
                {!cambiandoCobro ? (
                  <div className="mt-4">
                    {cuenta.falta > 0 ? (
                      <>
                        <p className="text-tinta-media">{t("casos.detalle.vasAAnotar")}</p>
                        <p className="font-titulo font-extrabold text-dato tabular-nums">
                          {pesos(cuenta.falta, locale)}
                        </p>
                        <p className="mt-1 max-w-[65ch] text-tinta-media">
                          {cobrosDeEste.length > 0
                            ? t("casos.detalle.esLoQueFalta")
                            : t("casos.detalle.esLoQueAprobo", { nombre: cliente?.nombre?.split(" ")[0] ?? t("casos.comun.elCliente") })}
                        </p>
                      </>
                    ) : (
                      (() => {
                        const frase = fraseDeLaCuenta(cuenta, t, locale);
                        return (
                          frase && (
                            <p className={`flex items-start gap-2 font-bold ${frase.color}`}>
                              <Icono nombre={frase.icono} className="mt-0.5 size-6 shrink-0" />
                              <span>{frase.texto}</span>
                            </p>
                          )
                        );
                      })()
                    )}
                    <div className="mt-3">
                      <Boton
                        variante="plano"
                        icono="nota"
                        data-testid="caso-cobro-otra-cosa"
                        onClick={() => {
                          if (cuenta.falta === 0) setCobro("");
                          setCambiandoCobro(true);
                        }}
                      >
                        {cuenta.falta > 0 ? t("casos.detalle.cobreOtraCosa") : t("casos.detalle.cobreAlgoMas")}
                      </Boton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    {cuenta.falta > 0 && (
                      <p className="mb-3 flex items-start gap-2 rounded-campo bg-espera-fondo p-3 text-espera">
                        <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
                        <span>
                          {conElementos(
                            montoCobrado(cobro) != null && montoCobrado(cobro) !== cuenta.falta
                              ? t("casos.detalle.cambiandoMontoAnotando", { monto: pesos(montoCobrado(cobro), locale) })
                              : t("casos.detalle.cambiandoMonto"),
                            { falta: <span className="font-bold">{pesos(cuenta.falta, locale)}</span> }
                          )}
                        </span>
                      </p>
                    )}
                    <Campo
                      id="cobro"
                      etiqueta={t("casos.detalle.cuantoCobraste")}
                      ayuda={
                        cobrosDeEste.length > 0
                          ? t("casos.detalle.cuantoCobrasteAyuda")
                          : t("casos.detalle.cuantoCobrasteAyudaPrimero")
                      }
                      ejemplo="120000"
                      error={!cobroValido(cobro) ? t("casos.detalle.montoInvalido") : null}
                      inputMode="numeric"
                      value={cobro}
                      onChange={(e) => setCobro(e.target.value)}
                    />
                  </div>
                )}

                {/* Cómo pagó, sólo si hay plata que anotar. */}
                {cobroValido(cobro) && montoCobrado(cobro) > 0 && (
                  <div className="mb-6">
                    <ElegirMedio valor={medioEntrega} alElegir={setMedioEntrega} />
                  </div>
                )}

                {/* Cobró menos de lo que faltaba (incluido 0): ¿y el resto?
                    Con el campo vacío no se pregunta: vacío es "hoy no se
                    anota nada", y lo que falta sigue faltando. */}
                {cobroValido(cobro) &&
                  montoCobrado(cobro) != null &&
                  cuenta.falta > 0 &&
                  montoCobrado(cobro) < cuenta.falta && (
                    <fieldset className="mb-6">
                      <legend className="mb-2 font-bold text-cuerpo">
                        {t("casos.detalle.yLosQueFaltan", { monto: pesos(cuenta.falta - montoCobrado(cobro), locale) })}
                      </legend>
                      <ul className="flex flex-wrap gap-2.5">
                        {[
                          { valor: "despues", palabra: t("casos.detalle.mePagaDespues") },
                          { valor: "no_se_cobra", palabra: t("casos.detalle.noSeLosCobro") },
                        ].map((o) => {
                          const puesta = o.valor === elResto;
                          return (
                            <li key={o.valor}>
                              <button
                                type="button"
                                aria-pressed={puesta}
                                onClick={() => setElResto(o.valor)}
                                className={[
                                  "flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 px-4 font-bold text-cuerpo",
                                  puesta
                                    ? "border-azul bg-azul-claro text-azul"
                                    : "border-borde-fuerte bg-tarjeta text-tinta hover:bg-superficie",
                                ].join(" ")}
                              >
                                {puesta && <Icono nombre="listo" className="size-5" />}
                                {o.palabra}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </fieldset>
                  )}

                {errorEntrega && (
                  <p role="alert" className="mb-4 flex items-start gap-2 font-bold text-rojo">
                    <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                    <span>{errorEntrega}</span>
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Boton
                    icono="flecha"
                    motivo={!cobroValido(cobro) ? t("casos.detalle.revisaElMonto") : null}
                    data-testid="caso-entrega-siguiente"
                    onClick={() => {
                      setErrorEntrega(null);
                      setPasoEntrega(2);
                    }}
                  >
                    {t("casos.detalle.siguiente")}
                  </Boton>
                  <Boton variante="plano" onClick={() => setEntregando(false)}>
                    {t("casos.comun.mejorNo")}
                  </Boton>
                </div>
              </div>

              <div hidden={pasoEntrega !== 2}>
                <p
                  id="paso-entrega-2"
                  tabIndex={-1}
                  className="mb-4 font-bold text-etiqueta text-tinta-media outline-none"
                >
                  {t("casos.detalle.paso2")}
                </p>

                <CuandoVuelve
                  valor={volverEn}
                  alCambiar={setVolverEn}
                  hoy={hoy}
                  sugerencia={sugerenciaVolver}
                  error={motivoVolver}
                  aviso={avisoAlAnotar}
                  disabled={cerrando || cambiandoEstado}
                />

                {puedeCargar && (
                  <SeguimientoWhatsApp
                    key={caso.id}
                    datos={datos}
                    telefono={cliente?.telefono}
                    valor={seguimientoEntrega}
                    alCambiar={setSeguimientoEntrega}
                    guardando={cerrando || cambiandoEstado}
                  />
                )}

                {errorEntrega && (
                  <p role="alert" className="mb-4 flex items-start gap-2 font-bold text-rojo">
                    <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                    <span>{errorEntrega}</span>
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Boton
                    icono="listo"
                    data-testid="caso-entrega-confirmar"
                    motivo={
                      cerrando || cambiandoEstado ? t("casos.comun.guardando")
                        : !cobroValido(cobro) ? t("casos.detalle.revisaElMonto")
                          : motivoVolver ? motivoVolver
                            : errorSeguimientoEntrega ? t("casos.detalle.revisaElSeguimiento") : null
                    }
                    onClick={async () => {
                      const monto = montoCobrado(cobro);
                      setErrorEntrega(null);

                      setCerrando(true);
                      const r = await datos.entregarCaso({
                        casoId: caso.id,
                        monto,
                        medio: medioEntrega,
                        resto: elResto,
                        seguimiento: seguimientoEntrega,
                        volverEn,
                      });
                      setCerrando(false);
                      if (!r.ok) {
                        // Un error del cobro se muestra en el paso del
                        // cobro, al lado de lo que hay que corregir.
                        if (CAMPOS_DEL_COBRO.includes(r.campo)) setPasoEntrega(1);
                        return setErrorEntrega(textoDeError(t, r.error));
                      }
                      const entregado = r.falta > 0
                        ? t("casos.detalle.entregadoFalta", { caso: casoEnFrase(caso, t), falta: pesos(r.falta, locale) })
                        : monto > 0
                          ? t("casos.detalle.entregadoCobrado", { caso: casoEnFrase(caso, t) })
                          : t("casos.detalle.entregado", { caso: casoEnFrase(caso, t) });
                      // Si el cliente pidió no recibir avisos, se dice acá
                      // mismo: es parte de cómo quedó, no un problema.
                      datos.avisarExito(r.noSeAviso ? `${entregado} ${r.noSeAviso}` : entregado);
                      setEntregando(false);
                    }}
                  >
                    {t("casos.detalle.siEntregarYCerrar")}
                  </Boton>
                  <Boton
                    variante="plano"
                    icono="volver"
                    data-testid="caso-entrega-volver"
                    motivo={cerrando ? t("casos.comun.guardando") : null}
                    onClick={() => {
                      setErrorEntrega(null);
                      setPasoEntrega(1);
                    }}
                  >
                    {t("casos.detalle.volverAlCobro")}
                  </Boton>
                </div>
              </div>
              </>
            )}
          </Tarjeta>
        </>
      ) : (
        <>
          <TituloSeccion className="mt-12">{t("casos.detalle.cerrado")}</TituloSeccion>
          <Tarjeta>
            <p className="max-w-[65ch] text-tinta-media">
              {caso.cobrado != null
                ? t("casos.detalle.seEntregoCobro", { monto: pesos(Number(caso.cobrado), locale) })
                : t("casos.detalle.seEntrego")}
              {aprobado > 0 && cuenta.falta > 0 && (
                <>
                  {" "}
                  {conElementos(t("casos.detalle.faltaCobrarResto"), {
                    falta: (
                      <span className="font-bold text-espera">
                        {t("casos.detalle.faltaCobrar", { monto: pesos(cuenta.falta, locale) })}
                      </span>
                    ),
                  })}
                </>
              )}{" "}
              {t("casos.detalle.cerradoNoSeCambia")}
            </p>
            {/* Nada es definitivo: se puede haber cerrado de más. Es la única
                acción que queda en un caso cerrado, así que se ve como un
                botón y no como un enlace perdido al final. */}
            {/* Cuándo le toca volver (R-1b): se anota al entregar y se
                corrige acá, con el caso cerrado. Es lo único que la API deja
                cambiar en un caso entregado. */}
            <div className="mt-6 border-t border-borde pt-6">
              {!corrigiendoVolver ? (
                <>
                  <p className="text-cuerpo">
                    {caso.volver_en ? (
                      conElementos(t("casos.detalle.leTocaVolver"), {
                        fecha: <span className="font-bold">{diaEnPalabras(caso.volver_en, locale)}</span>,
                      })
                    ) : (
                      t("casos.detalle.noAnotasteVolver")
                    )}
                  </p>
                  {/* Cuándo le sale el aviso, o por qué no sale (R-2b). Con
                      la baja no se dice nada: la ficha ya lo dice. */}
                  {avisoVolver && (
                    <p className="mt-2 flex max-w-[65ch] items-start gap-2 text-tinta-media">
                      <Icono nombre="whatsapp" className="mt-1 size-5 shrink-0" />
                      <span>{avisoVolver.frase}</span>
                    </p>
                  )}
                  {puedeCargar && (
                    <div className="mt-3">
                      <Boton
                        variante="borde"
                        icono="calendario"
                        data-testid="caso-volver-fecha"
                        onClick={() => {
                          setVolverEn(caso.volver_en ?? "");
                          setErrorVolver(null);
                          setCorrigiendoVolver(true);
                        }}
                      >
                        {caso.volver_en ? t("casos.detalle.cambiarFecha") : t("casos.detalle.anotarCuandoVuelve")}
                      </Boton>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <CuandoVuelve
                    id="volver-en-cerrado"
                    valor={volverEn}
                    alCambiar={setVolverEn}
                    hoy={hoy}
                    sugerencia={sugerenciaVolver}
                    error={motivoVolver}
                    aviso={avisoAlAnotar}
                    disabled={guardandoVolver}
                  />
                  {errorVolver && (
                    <p role="alert" className="mb-4 flex items-start gap-2 font-bold text-rojo">
                      <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                      <span>{errorVolver}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Boton
                      variante="borde"
                      icono="listo"
                      data-testid="caso-volver-fecha-guardar"
                      motivo={guardandoVolver ? t("casos.comun.guardando") : motivoVolver}
                      onClick={async () => {
                        setErrorVolver(null);
                        setGuardandoVolver(true);
                        const r = await datos.corregirVolverEn(caso.id, volverEn);
                        setGuardandoVolver(false);
                        if (!r.ok) return setErrorVolver(textoDeError(t, r.error));
                        datos.avisarExito(
                          r.caso.volver_en
                            ? t("casos.detalle.fechaGuardada", { fecha: diaEnPalabras(r.caso.volver_en, locale) })
                            : t("casos.detalle.fechaSacada")
                        );
                        setCorrigiendoVolver(false);
                      }}
                    >
                      {t("casos.detalle.guardarFecha")}
                    </Boton>
                    <Boton
                      variante="plano"
                      motivo={guardandoVolver ? t("casos.comun.guardando") : null}
                      onClick={() => setCorrigiendoVolver(false)}
                    >
                      {t("casos.comun.mejorNo")}
                    </Boton>
                  </div>
                </>
              )}
            </div>

            {puedeEntregar && (
              <div className="mt-4">
                <Boton
                  variante="neutro"
                  icono="deshacer"
                  data-testid="caso-reabrir"
                  onClick={() =>
                    datos.cambiarEstado(caso.id, "en_proceso")
                  }
                >
                  {t("casos.detalle.volverAAbrirlo")}
                </Boton>
              </div>
            )}
          </Tarjeta>
        </>
      )}

      {/* El diagnóstico se mudó a la pantalla de los pasos (flujo, 3.2).
          Revisar y presupuestar son el mismo momento de trabajo, y estaban
          partidos en dos pantallas: se escribía acá qué se encontró y había
          que irse a otro lado a cargar lo que hay que hacer con eso. */}

      {/* Sin respuestas no hay sección: una vacía no dice nada que sirva. */}
      {(respuestas.lista.length > 0 || respuestas.error) && (
        <section data-respuestas-del-caso className="mt-12">
          <TituloSeccion>Lo que contestó el cliente</TituloSeccion>
          {respuestas.lista.length > 0 && <ListaDeRespuestas respuestas={respuestas.lista} rubro={negocio?.rubro} />}
          {respuestas.error && <p className="mt-2 text-tinta-media">{respuestas.error}</p>}
          {respuestas.siguiente && (
            <Boton variante="plano" icono="flecha-abajo" className="mt-3" onClick={verMasRespuestas}>
              Ver más respuestas
            </Boton>
          )}
        </section>
      )}

      {/* mb-4: en celular el botón baja a su propia línea y quedaba pegado
          a la nota o al historial que siguen. */}
      <div className="mt-12 mb-4 flex flex-wrap items-center justify-between gap-3">
        <TituloSeccion className="mb-0">{t("casos.detalle.loQuePaso")}</TituloSeccion>
        {puedeCargar && (
          <Boton icono="nota" onClick={() => setAnotando((v) => !v)}>
            {anotando ? t("casos.comun.cerrar") : t("casos.detalle.anotarAlgo")}
          </Boton>
        )}
      </div>

      {/* Una nota suelta se agrega al historial: no pisa nada de lo anterior. */}
      {anotando && puedeCargar && (
        <Tarjeta className="mb-4">
          <label htmlFor="nota" className="block font-bold text-cuerpo">
            {t("casos.detalle.queQueresAnotar")}
          </label>
          <p className="mt-1 mb-2 text-apoyo text-tinta-suave">
            {t("casos.detalle.notaApoyo")}
          </p>
          <textarea
            id="nota"
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={t("casos.detalle.notaEjemplo")}
            className="block w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta p-4 text-cuerpo placeholder:text-tinta-suave"
          />
          <div className="mt-3">
            <Boton
              icono="check"
              motivo={!nota.trim() ? t("casos.detalle.faltaNota") : null}
              onClick={() => {
                datos.anotarNota(caso.id, nota.trim());
                datos.avisarExito(t("casos.detalle.notaAnotada"));
                setNota("");
                setAnotando(false);
              }}
            >
              {t("casos.detalle.anotarlo")}
            </Boton>
          </div>
        </Tarjeta>
      )}

      {/* Los cinco más recientes, y el resto a pedido. Un caso de dos
          semanas deja veinte eventos, y en el celular todo lo que estaba
          debajo quedaba a un scroll que nadie hace (auditoría, H8). */}
      <ol className="flex flex-col gap-6">
        {(historialEntero ? historial : historial.slice(0, EVENTOS_A_LA_VISTA)).map((e) => (
          <li key={e.id} className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta-media">
              <Icono nombre={e.icono} className="size-5" />
            </span>
            <div className="min-w-0 flex-1 border-b border-borde pb-4">
              <p className="font-bold">{e.titulo}</p>
              <p className="text-apoyo text-tinta-suave">
                {cuando(e.ocurrido_en, locale, t)} · {e.autor}
              </p>
              {e.detalle && <p className="mt-1 text-tinta-media">{e.detalle}</p>}
            </div>
          </li>
        ))}
      </ol>
      {historial.length > EVENTOS_A_LA_VISTA && (
        <div className="mt-4">
          <Boton
            variante="plano"
            icono={historialEntero ? "volver" : "mas"}
            onClick={() => setHistorialEntero((v) => !v)}
          >
            {historialEntero
              ? t("casos.detalle.mostrarLoUltimo")
              : t("casos.detalle.verTodo", { n: historial.length })}
          </Boton>
        </div>
      )}
    </>
  );
}

// "Ya está listo" — el aviso al cliente cuando el trabajo pasó el control
// (flujo, punto 9).
//
// Es el hermano de "Mandarle los pasos al cliente" de la pantalla de pasos:
// mismo patrón, mismo link, otro momento. Aquel se manda cuando hay que
// decidir; este, cuando ya se hizo.
//
// Usa el link que ya existe y lo arma si todavía no hay ninguno, en el mismo
// toque: si hubiera que ir a compartirlo primero, avisar dejaría de ser una
// sola acción y nadie lo usaría con el mostrador lleno.
function AvisarleQueEstaListo({ caso, cliente, negocio, datos, aprobados }) {
  const { t, idioma } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState(null);
  const [origen, setOrigen] = useState("");

  useEffect(() => setOrigen(window.location.origin), []);

  const entregado = caso.estado === "completado";
  const codigo = caso.seguimiento_codigo ?? null;
  const link = codigo && origen ? linkDeSeguimiento(origen, codigo) : "";

  // Lo manda el negocio: sale en el idioma de quien lo arma.
  const mensaje = mensajeDeLoHecho({
    negocioNombre: negocio?.nombre ?? t("casos.comun.tuNegocio"),
    clienteNombre: cliente?.nombre?.split(" ")[0] ?? null,
    identificador: caso.identificador,
    servicio: caso.servicio,
    estadoEnPalabras: presentacionEstado(negocio, caso.estado, idioma).nombre,
    entregado,
    pasos: aprobados.map((p) => ({ nombre: p.nombre, hecho: Boolean(p.hecho_en) })),
    link,
  }, t);

  async function preparar() {
    setError(null);
    if (codigo) return setAbierto((v) => !v);

    // Sin link todavía: se arma ahora. compartirCaso() devuelve el mismo
    // código si ya hubiera uno, así que nunca se genera uno nuevo por error
    // y el que el cliente ya tenga sigue andando.
    setArmando(true);
    const r = await datos.compartirCaso(caso.id);
    setArmando(false);
    if (!r.ok) return setError(textoDeError(t, r.error));
    setAbierto(true);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      datos.avisarExito(t("casos.aviso.copiado"));
    } catch {
      const pre = document.getElementById("aviso-listo");
      if (pre) window.getSelection()?.selectAllChildren(pre);
      datos.avisarExito(t("casos.comun.noPudimosCopiar"));
    }
  }

  return (
    <>
      <TituloSeccion className="mt-12">
        {entregado ? t("casos.aviso.contarle") : t("casos.aviso.avisarle")}
      </TituloSeccion>
      <Tarjeta>
        {error && <ErrorGeneral>{error}</ErrorGeneral>}

        <p className="max-w-[65ch] text-tinta-media">
          {entregado
            ? t("casos.aviso.resumenApoyo")
            : t("casos.aviso.listoApoyo", { nombre: cliente?.nombre?.split(" ")[0] ?? t("casos.comun.tuCliente") })}
        </p>

        <div className="mt-4">
          <Boton
            icono="chat"
            motivo={armando ? t("casos.aviso.armandoLink") : null}
            onClick={preparar}
          >
            {abierto ? t("casos.comun.cerrar") : entregado ? t("casos.aviso.armarResumen") : t("casos.aviso.armarAviso")}
          </Boton>
        </div>

        {abierto && (
          <div className="mt-4 rounded-tarjeta border border-borde bg-superficie p-4">
            <p className="font-bold">{t("casos.comun.esteEsElMensaje")}</p>
            <pre
              id="aviso-listo"
              className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-campo bg-tarjeta p-4 font-cuerpo text-etiqueta text-tinta-media"
            >
              {mensaje}
            </pre>

            <div className="mt-3 flex flex-wrap gap-3">
              <Boton icono="copiar" onClick={copiar}>
                {t("casos.aviso.copiar")}
              </Boton>
              <a
                href={linkDeWhatsApp(mensaje)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 font-bold text-cuerpo text-tinta hover:bg-superficie"
              >
                <Icono nombre="chat" />
                {t("casos.comun.mandarWhatsapp")}
              </a>
            </div>
          </div>
        )}
      </Tarjeta>
    </>
  );
}

// Un dato del caso: el nombre arriba, el valor abajo, el ícono al costado.
//
// El nombre va SIEMPRE, también cuando el valor se explica solo. Un ícono de
// persona al lado de "Diego" no dice si Diego es el cliente o quien hace el
// trabajo (auditoría, H2), y "hace 14 días" sin nombre no dice de qué.
function Dato({ icono, que, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icono nombre={icono} className="mt-1 size-5 shrink-0 text-tinta-suave" />
      <div className="min-w-0">
        <dt className="text-apoyo text-tinta-suave">{que}</dt>
        <dd className="text-cuerpo text-tinta">{children}</dd>
      </div>
    </div>
  );
}
