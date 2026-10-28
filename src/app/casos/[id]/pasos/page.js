"use client";

// "Aprobar los pasos de un caso" (cartilla, secciones 08 y 09).
//
// La decisión que más plata mueve. La revisa el encargado con el cliente al
// lado, o el cliente en su celular.
//
// Reglas que esta pantalla tiene que cumplir:
// - Cada paso es una tarjeta con nombre común, para qué sirve y monto grande.
// - Dos botones por paso, de 52 px como mínimo y con 10 px en medio, para no
//   equivocarse de dedo.
// - El estado de cada paso va escrito con ícono y palabra, no sólo con color.
// - El total siempre visible, separado en aprobado y esperando respuesta.
// - Rechazar se puede deshacer. Aprobar NO: lo que el cliente aceptó es un
//   acuerdo y queda fijo. La cartilla dice que las dos cosas se deshacen;
//   esto la contradice por decisión del equipo (ver 015_paso_aprobado_fijo.sql).
//   Como no tiene vuelta, aprobar pide confirmación.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { puede, quienPuede } from "@/lib/permisos";
import { montoValido } from "@/lib/validaciones";
import { estaAbierto, pesos, totalesDeCaso } from "@/lib/estados";
import { cuantoHace } from "@/lib/fechas";
import { ejemplosDe } from "@/lib/presets";
import { casoEnFrase, lineaDelCaso, subtituloDelCaso, tituloDelCaso } from "@/lib/nombres";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { linkDeSeguimiento, linkDeWhatsApp } from "@/lib/seguimiento";
import {
  Boton,
  Campo,
  Cargando,
  ErrorGeneral,
  Tarjeta,
  TituloSeccion,
  Vacio,
} from "@/componentes/ui";

// El texto de cada uno sale del diccionario (casos.pasos.dicho.<estado>).
const DICHO = {
  aprobado: { icono: "listo", color: "text-completo" },
  rechazado: { icono: "cruz", color: "text-tinta-suave" },
  esperando: { icono: "reloj", color: "text-espera" },
};

export default function AprobarPasos() {
  const { id } = useParams();
  const datos = useDatos();
  const { t, idioma, locale } = useIdioma();
  const { cargando, casos, clientes, pasos, negocio, responderPaso } = datos;
  const { usuario } = useAuth();
  const [mostrandoMensaje, setMostrandoMensaje] = useState(false);
  // De dónde sale el link que se le manda al cliente. Se lee en un efecto
  // porque en el servidor no hay window.
  const [origen, setOrigen] = useState("");
  useEffect(() => setOrigen(window.location.origin), []);

  // Armar el presupuesto: se suman pasos de a uno (SCRUM-59).
  const [armando, setArmando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [tocado, setTocado] = useState(false);
  const [sacando, setSacando] = useState(null);
  // "Corregir el presupuesto": mientras está prendido aparece, en cada paso
  // que todavía espera respuesta, la opción de sacarlo. Antes estaba en cada
  // tarjeta: con seis pasos eran dieciocho botones en la pantalla donde hay
  // que decidir sobre plata, y sacar un paso es raro (auditoría, H8).
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [aprobando, setAprobando] = useState(null);
  // El diagnóstico, que hasta acá vivía en el detalle del caso (flujo, 3.2).
  // Revisar y presupuestar son el mismo momento: se mira el auto, se escribe
  // qué tiene, y de eso salen los pasos. Estaban en dos pantallas.
  const [editandoDiag, setEditandoDiag] = useState(false);
  const [diagnostico, setDiagnostico] = useState("");

  // Armar el presupuesto, contestar por el cliente y compartir el seguimiento
  // son permisos distintos. Quien no tiene ninguno ve los pasos, porque son la
  // lista de lo que hay que hacer.
  const puedeArmar = puede(usuario, "armar_presupuesto");
  const puedeResponder = puede(usuario, "aprobar_por_el_cliente");
  // El diagnóstico es un dato del caso y el link es el seguimiento: la base
  // los deja con "avanzar_casos".
  const puedeAvanzar = puede(usuario, "avanzar_casos");

  const caso = casos.find((c) => c.id === id);
  useTitulo(caso ? t("casos.pasos.tituloDe", { caso: tituloDelCaso(caso, t) }) : t("casos.pasos.titulo"));

  if (cargando) return <Cargando />;
  if (!caso) {
    return (
      <Vacio icono="buscar" titulo={t("casos.detalle.noEncontrado")}>
        <Link href="/casos" className="font-bold text-azul">{t("casos.volver")}</Link>.
      </Vacio>
    );
  }

  const cliente = clientes.find((c) => c.id === caso.cliente_id);
  const mios = pasos.filter((p) => p.caso_id === caso.id).sort((a, b) => a.orden - b.orden);
  const { aprobado, esperando, todo, cuantosEsperan } = totalesDeCaso(mios);

  // Con el caso cerrado el presupuesto se lee, no se toca: sumar o aprobar un
  // paso después de entregado cambiaría lo que ya se cobró. Para eso está
  // volver a abrir el caso, que es una sola acción y queda en el historial.
  const abierto = estaAbierto(caso);
  const sePuedeArmar = puedeArmar && abierto;
  const sePuedeResponder = puedeResponder && abierto;
  const sePuedeAvanzar = puedeAvanzar && abierto;

  // Lo manda el negocio: sale en su idioma y con los números a su manera.
  const mensaje = [
    t("casos.pasos.mensaje.hola", { nombre: cliente?.nombre ?? "", numero: caso.numero, servicio: caso.servicio }),
    "",
    ...mios.map(
      (p) =>
        `${p.estado === "aprobado" ? "✓" : p.estado === "rechazado" ? "✗" : "•"} ${p.nombre} — ${pesos(p.monto, locale)}${p.descripcion ? `\n   ${p.descripcion}` : ""}`
    ),
    "",
    t("casos.pasos.mensaje.aprobadoHasta", { monto: pesos(aprobado, locale) }),
    t("casos.pasos.mensaje.esperandoTu", { monto: pesos(esperando, locale) }),
    t("casos.pasos.mensaje.todoElCaso", { monto: pesos(todo, locale) }),
    "",
    t("casos.pasos.mensaje.deAUno"),
    // Si el caso está compartido, el mensaje lleva el link: ahí mismo puede
    // contestar, en vez de tener que escribir la respuesta a mano y que
    // alguien del mostrador la cargue después (SCRUM-68).
    ...(caso.seguimiento_codigo && origen
      ? ["", t("casos.pasos.mensaje.podesContestar", { link: linkDeSeguimiento(origen, caso.seguimiento_codigo) })]
      : []),
  ].join("\n");

  const errorMonto =
    tocado && monto.trim() && !montoValido(monto)
      ? t("casos.pasos.errorMonto")
      : null;

  const motivoPaso = !nombre.trim()
    ? t("casos.pasos.faltaQueHacer")
    : !monto.trim()
      ? t("casos.pasos.faltaCuanto")
      : !montoValido(monto)
        ? t("casos.pasos.montoSinPuntos")
        : null;

  async function sumarPaso() {
    const que = nombre.trim();
    const paso = await datos.agregarPaso({
      casoId: caso.id,
      nombre: que,
      descripcion: descripcion.trim(),
      monto,
    });
    if (!paso) return;
    datos.avisarExito(t("casos.pasos.pasoSumado", { nombre: que }));
    setNombre("");
    setDescripcion("");
    setMonto("");
    setTocado(false);
    // El formulario queda abierto y vacío: un presupuesto son varios pasos y
    // se cargan de corrido. Cada uno aparece en la lista de arriba apenas se
    // guarda, así se ve crecer sin tener que volver a abrir nada.
    document.getElementById("paso-nombre")?.focus();
  }

  // Cierra el formulario y tira lo que se estaba escribiendo. Los pasos que ya
  // se sumaron no se tocan: cada uno quedó guardado al tocar "Sumar el paso".
  function cancelarPasos() {
    setArmando(false);
    setNombre("");
    setDescripcion("");
    setMonto("");
    setTocado(false);
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <Link
        href={`/casos/${caso.id}`}
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        {t("casos.pasos.volverAlCaso")}
      </Link>

      <h1 className="text-ident">{tituloDelCaso(caso, t)}</h1>
      {subtituloDelCaso(caso, t) && (
        <p className="text-apoyo text-tinta-suave">{subtituloDelCaso(caso, t)}</p>
      )}
      <p className="mt-1 text-tinta-media">{lineaDelCaso(caso, cliente?.nombre, t)}</p>
      <div className="mt-3">
        <ChipEstado estado={caso.estado} />
      </div>
      {cuantosEsperan > 0 && abierto && (
        <p className="mt-3 text-cuerpo">
          {t("casos.pasos.faltaQueApruebe", { nombre: cliente?.nombre ?? t("casos.comun.elCliente"), n: cuantosEsperan })}
        </p>
      )}

      {/* Primero qué se encontró, después qué hay que hacer con eso: es el
          orden en que pasa, y el que hace que los pasos se escriban mirando
          el diagnóstico y no de memoria. */}
      <TituloSeccion className="mt-10">{t("casos.pasos.diagnostico")}</TituloSeccion>
      <Tarjeta className="mb-6">
        {!abierto && (puedeArmar || puedeResponder) && (
          <p className="mb-4 max-w-[65ch] text-tinta-media">
            {t("casos.pasos.cerradoDiag")}
          </p>
        )}
        <p className="font-bold text-cuerpo">{t("casos.pasos.queEncontramos")}</p>

        {editandoDiag && sePuedeAvanzar ? (
          <div className="mt-2">
            <label htmlFor="diagnostico" className="sr-only">
              {t("casos.pasos.queEncontramos")}
            </label>
            <p className="mt-1 mb-2 text-etiqueta text-tinta-media">
              {t("casos.pasos.conTusPalabras")}
            </p>
            {/* Lo que ya estaba viene cargado en el campo, no en blanco: así
                ampliar es escribir abajo y no se pisa nada sin querer. El
                aviso está igual, porque guardar reemplaza. */}
            {caso.diagnostico && (
              <p className="mb-2 flex items-start gap-2 rounded-campo bg-espera-fondo p-3 text-espera">
                <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
                <span>
                  {t("casos.pasos.cambiandoDiag")}
                </span>
              </p>
            )}
            <textarea
              id="diagnostico"
              rows={4}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder={ejemplosDe(negocio?.rubro, idioma).diagnostico}
              className="block w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta p-4 text-cuerpo placeholder:text-tinta-suave"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <Boton
                icono="check"
                motivo={!diagnostico.trim() ? t("casos.pasos.faltaDiag") : null}
                onClick={() => {
                  datos.cargarDiagnostico(caso.id, diagnostico.trim());
                  datos.avisarExito(t("casos.pasos.diagGuardado", { caso: casoEnFrase(caso, t) }));
                  setEditandoDiag(false);
                }}
              >
                {t("casos.pasos.guardarDiag")}
              </Boton>
              <Boton variante="plano" onClick={() => setEditandoDiag(false)}>
                {t("casos.comun.dejarlo")}
              </Boton>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <p className="max-w-[65ch] text-tinta-media">
              {caso.diagnostico || t("casos.pasos.nadieEscribio")}
            </p>
            {/* Una sola acción acá, y con forma de botón: dos enlaces azules
                uno abajo del otro no se distinguían entre sí. Lo que había al
                lado —"armar un paso con esto"— se fue: ahora el diagnóstico
                aparece al lado del formulario del paso, que es donde sirve. */}
            {sePuedeAvanzar && (
              <div className="mt-3">
                <Boton
                  variante="neutro"
                  icono="diagnostico"
                  onClick={() => {
                    setDiagnostico(caso.diagnostico ?? "");
                    setEditandoDiag(true);
                  }}
                >
                  {caso.diagnostico ? t("casos.pasos.corregirDiag") : t("casos.pasos.cargarDiag")}
                </Boton>
              </div>
            )}
          </div>
        )}
      </Tarjeta>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <TituloSeccion className="mb-0">
          {abierto ? t("casos.pasos.pasosAAprobar") : t("casos.pasos.losPasos")}
        </TituloSeccion>
        {sePuedeArmar && (
          <div className="flex flex-wrap gap-2">
            {/* El mismo arreglo que "Agregar" en inventario: mientras el
                formulario está abierto el botón se apaga en su lugar y dice
                por qué, en vez de cambiar a "Cerrar". Salir es "Cancelar", al
                pie del formulario, al lado de "Sumar el paso" (SCRUM-126). */}
            <Boton
              icono="mas"
              motivo={armando ? t("casos.pasos.yaEstasSumando") : null}
              onClick={() => setArmando(true)}
            >
              {t("casos.pasos.sumarUno")}
            </Boton>
            {mios.some((p) => p.estado === "esperando") && (
              <Boton
                variante="plano"
                icono={corrigiendo ? "check" : "tacho"}
                onClick={() => {
                  setCorrigiendo((v) => !v);
                  setSacando(null);
                }}
              >
                {corrigiendo ? t("casos.pasos.listoTermine") : t("casos.pasos.corregirPresupuesto")}
              </Boton>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 mb-4 text-tinta-media">
        {corrigiendo
          ? t("casos.pasos.sacaLosQueSobren")
          : !abierto
          ? t("casos.pasos.yaSeEntrego")
          : puedeResponder
            ? t("casos.pasos.seApruebaDeAUno")
            : t("casos.pasos.esLoQueHayQueHacer", { quienPuede: quienPuede("aprobar_por_el_cliente", t) })}
      </p>

      {!abierto && (puedeArmar || puedeResponder) && (
        <Tarjeta className="mb-6">
          <p className="font-bold text-cuerpo">{t("casos.pasos.casoCerrado")}</p>
          <p className="mt-1 max-w-[65ch] text-tinta-media">
            {t("casos.pasos.casoCerradoTexto")}
          </p>
          <Link
            href={`/casos/${caso.id}`}
            className="mt-3 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
          >
            <Icono nombre="deshacer" />
            {t("casos.pasos.irAlCaso")}
          </Link>
        </Tarjeta>
      )}

      {armando && sePuedeArmar && (
        <Tarjeta className="mb-6">
          <TituloSeccion>{t("casos.pasos.sumarPasos")}</TituloSeccion>
          <p className="-mt-2 mb-4 text-apoyo text-tinta-suave">
            {t("casos.pasos.sumarPasosApoyo")}
          </p>

          {/* Lo que se encontró, acá al lado mientras se escribe. De un
              diagnóstico salen varios pasos —"está todo roto" son cuatro
              cosas— y tenerlo a la vista es lo que hace que se acuerden todas
              sin volver a subir a leerlo.

              Es una referencia, no una acción: qué pasos salen de esto lo
              decide quien lo escribe. */}
          {caso.diagnostico && (
            <div className="mb-6 rounded-campo border-l-4 border-borde-fuerte bg-superficie p-4">
              <p className="flex items-center gap-2 font-bold text-etiqueta text-tinta-media">
                <Icono nombre="diagnostico" className="size-5" />
                {t("casos.pasos.loQueEncontraste")}
              </p>
              <p className="mt-1 max-w-[65ch] text-tinta-media">{caso.diagnostico}</p>
            </div>
          )}
          <Campo
            id="paso-nombre"
            etiqueta={t("casos.pasos.queHayQueHacer")}
            ayuda={t("casos.pasos.queHayQueHacerAyuda", { ejemplo: ejemplosDe(negocio?.rubro, idioma).paso })}
            autoComplete="off"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Campo
            id="paso-descripcion"
            etiqueta={t("casos.pasos.porQueConviene")}
            ayuda={t("casos.pasos.porQueConvieneAyuda")}
            autoComplete="off"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <Campo
            id="paso-monto"
            etiqueta={t("casos.pasos.cuantoSale")}
            ayuda={t("casos.pasos.cuantoSaleAyuda")}
            error={errorMonto}
            ejemplo="120000"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            onBlur={() => setTocado(true)}
          />
          {/* Cancelar va con borde neutro y no en rojo con el tacho, como en
              inventario. Allá se carga un producto y cancelar lo aborta; acá
              el formulario queda abierto para cargar varios de corrido, y
              cerrarlo es el final normal. Un tacho rojo al lado de la lista de
              pasos recién cargados se leería como "borra los pasos", y no los
              borra: sólo tira lo que se estaba escribiendo. */}
          <div className="flex flex-wrap gap-3">
            <Boton variante="principal" icono="check" motivo={motivoPaso} onClick={sumarPaso}>
              {t("casos.pasos.sumarElPaso")}
            </Boton>
            <Boton variante="plano" onClick={cancelarPasos}>
              {t("casos.comun.cancelar")}
            </Boton>
          </div>
        </Tarjeta>
      )}

      {mios.length === 0 ? (
        <Vacio icono="nota" titulo={t("casos.pasos.todaviaNoHay")}>
          {sePuedeArmar
            ? t("casos.pasos.armaElPresupuesto")
            : t("casos.pasos.cuandoSeArme")}
        </Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {mios.map((paso) => {
            const dicho = DICHO[paso.estado];
            return (
              <li key={paso.id}>
                <Tarjeta>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-cuerpo font-bold text-cuerpo">{paso.nombre}</h3>
                    <span className="font-titulo font-extrabold text-subtitulo tabular-nums">
                      {pesos(paso.monto, locale)}
                    </span>
                  </div>
                  {paso.descripcion && (
                    <p className="mt-1 text-tinta-media">{paso.descripcion}</p>
                  )}

                  <p className={`mt-3 flex items-center gap-2 font-bold text-etiqueta ${dicho.color}`}>
                    <Icono nombre={dicho.icono} className="size-5" />
                    {t(`casos.pasos.dicho.${paso.estado}`)}
                  </p>

                  {paso.estado === "aprobado" ? (
                    <p className="mt-1 text-apoyo text-tinta-suave">
                      {t("casos.pasos.esUnAcuerdo")}
                    </p>
                  ) : paso.estado === "esperando" ? (
                    <>
                      {!sePuedeResponder ? null : aprobando === paso.id ? (
                        <div className="mt-3 rounded-tarjeta bg-superficie p-4">
                          <p className="font-bold text-cuerpo">
                            {t("casos.pasos.apruebaPregunta", { nombre: paso.nombre, monto: pesos(paso.monto, locale) })}
                          </p>
                          <p className="mt-1 text-tinta-media">
                            {t("casos.pasos.noSePuedeVolver")}
                          </p>
                          {/* Esto se carga desde el mostrador, en nombre del
                              cliente: el que aprueba no es el que está
                              tocando el botón. Queda escrito como que lo
                              aprobó él, así que el aviso va antes y no
                              después. */}
                          <p className="mt-3 flex items-start gap-2 rounded-campo bg-espera-fondo p-3 text-espera">
                            <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                            <span>
                              <span className="font-bold">{t("casos.pasos.contestandoPor")}</span>{" "}
                              {t("casos.pasos.contestandoPorTexto", {
                                nombre: cliente?.nombre?.split(" ")[0] ?? t("casos.comun.elCliente"),
                                monto: pesos(paso.monto, locale),
                              })}
                            </span>
                          </p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <Boton
                              variante="principal"
                              icono="listo"
                              onClick={() => {
                                responderPaso(paso.id, "aprobado");
                                datos.avisarExito(
                                  t("casos.pasos.pasoAprobado", { nombre: paso.nombre, monto: pesos(paso.monto, locale) })
                                );
                                setAprobando(null);
                              }}
                            >
                              {t("casos.pasos.siLoAprueba")}
                            </Boton>
                            <Boton variante="plano" onClick={() => setAprobando(null)}>
                              {t("casos.pasos.todaviaNo")}
                            </Boton>
                          </div>
                        </div>
                      ) : (
                        /* 52 px de alto, 10 px en medio: para no equivocarse de dedo. */
                        <div className="mt-3 flex gap-2.5">
                          <Boton
                            variante="principal"
                            className="min-h-13 flex-1"
                            onClick={() => {
                              setSacando(null);
                              setAprobando(paso.id);
                            }}
                          >
                            {t("casos.pasos.loAprueba")}
                          </Boton>
                          {/* Neutro y no rojo: rechazar se puede deshacer. El
                              rojo queda para sacar un paso, que borra. */}
                          <Boton
                            variante="neutro"
                            className="min-h-13 flex-1"
                            onClick={() => responderPaso(paso.id, "rechazado")}
                          >
                            {t("casos.pasos.noLoHace")}
                          </Boton>
                        </div>
                      )}

                      {/* Sacar un paso sólo se puede mientras espera respuesta:
                          después sería borrar algo que el cliente ya contestó. */}
                      {aprobando === paso.id || !corrigiendo || !sePuedeArmar ? null : sacando === paso.id ? (
                        <div className="mt-3 rounded-tarjeta bg-superficie p-4">
                          <p className="font-bold text-cuerpo">
                            {t("casos.pasos.sacarPregunta", { nombre: paso.nombre })}
                          </p>
                          <p className="mt-1 text-tinta-media">
                            {t("casos.pasos.sacarTexto", { monto: pesos(paso.monto, locale) })}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <Boton
                              variante="peligro"
                              icono="tacho"
                              onClick={() => {
                                datos.eliminarPaso(paso.id);
                                datos.avisarExito(t("casos.pasos.pasoSacado", { nombre: paso.nombre }));
                                setSacando(null);
                              }}
                            >
                              {t("casos.pasos.sacarlo")}
                            </Boton>
                            <Boton variante="plano" onClick={() => setSacando(null)}>
                              {t("casos.comun.dejarlo")}
                            </Boton>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 border-t border-borde pt-1">
                          <Boton
                            variante="plano"
                            icono="tacho"
                            onClick={() => setSacando(paso.id)}
                          >
                            {t("casos.pasos.sacarDelPresupuesto")}
                          </Boton>
                        </div>
                      )}
                    </>
                  ) : !sePuedeResponder ? null : (
                    /* Sólo llega acá un paso rechazado: el cliente puede
                       cambiar de idea sobre algo que no había aceptado. */
                    <div className="mt-3">
                      <Boton
                        variante="plano"
                        icono="deshacer"
                        onClick={() => responderPaso(paso.id, "esperando")}
                      >
                        {t("casos.pasos.volverAEsperar")}
                      </Boton>
                    </div>
                  )}
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      {/* En celular el total se queda a la vista mientras se recorre la lista:
          la conversación sobre plata pasa entera mirando los pasos, y el
          número que se discute estaba recién al final (auditoría, H1). Va
          clavado encima de la barra de secciones; el detalle completo sigue
          abajo. En escritorio la lista entra y no hace falta. */}
      {mios.length > 0 && (
        <div
          aria-hidden="true"
          className="sticky bottom-[calc(var(--alto-barra,4rem)+0.5rem)] z-10 mt-4 flex justify-between gap-4 rounded-tarjeta border border-borde bg-tarjeta px-4 py-3 shadow-lg md:hidden"
        >
          <p>
            <span className="block text-apoyo text-tinta-media">{t("casos.pasos.aprobado")}</span>
            <span className="font-bold tabular-nums">{pesos(aprobado, locale)}</span>
          </p>
          <p className="text-right text-espera">
            <span className="block text-apoyo">{t("casos.pasos.esperandoRespuesta")}</span>
            <span className="font-bold tabular-nums">{pesos(esperando, locale)}</span>
          </p>
        </div>
      )}

      {/* La plata siempre a la vista, separada en aprobado y esperando. */}
      {mios.length > 0 && (
        <div className="mt-6 rounded-tarjeta border border-borde bg-superficie p-4 sm:p-6">
          <dl className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <dt>{t("casos.pasos.aprobadoHastaAhora")}</dt>
              <dd className="font-bold tabular-nums">{pesos(aprobado, locale)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-espera">
              <dt>{t("casos.pasos.esperandoRespuesta")}</dt>
              <dd className="font-bold tabular-nums">{pesos(esperando, locale)}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-borde pt-3">
              <dt className="font-bold">{t("casos.pasos.todoElCaso")}</dt>
              <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">
                {pesos(todo, locale)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* El único botón azul de la pantalla, y ahora manda de verdad: arma
          el link del cliente —el mismo de la pantalla pública— y lo deja
          listo para copiar o mandar por WhatsApp con el presupuesto entero
          escrito. Antes sólo mostraba un texto para copiar a mano.

          Vive acá y no en la pantalla del caso porque lo que se manda es
          esto: el presupuesto. Allá quedó el renglón que dice si ya está
          compartido y si el cliente lo abrió. */}
      {mios.length > 0 && puedeAvanzar && (
        <MandarleElLink
          caso={caso}
          cliente={cliente}
          datos={datos}
          mensaje={mensaje}
          origen={origen}
          abierto={mostrandoMensaje}
          alAbrir={setMostrandoMensaje}
        />
      )}
    </div>
  );
}

// Mandarle el presupuesto al cliente, con el link para que lo conteste.
//
// Es el mismo link de seguimiento que ve el estado del caso (SCRUM-68), y el
// mensaje es el detalle de los pasos con el link al final: el cliente lee
// todo en WhatsApp y, si quiere, entra y contesta ahí mismo.
//
// El link se arma la primera vez que se toca el botón, sin pasos intermedios
// ni configuración: nadie va a usar esto si primero hay que preparar algo,
// con el cliente esperando del otro lado del teléfono.
function MandarleElLink({ caso, cliente, datos, mensaje, origen, abierto, alAbrir }) {
  const { t } = useIdioma();
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [cortando, setCortando] = useState(false);

  const codigo = caso.seguimiento_codigo ?? null;
  const link = codigo && origen ? linkDeSeguimiento(origen, codigo) : "";

  async function mandar() {
    setError(null);
    if (codigo) return alAbrir((v) => !v);

    setGenerando(true);
    const r = await datos.compartirCaso(caso.id);
    setGenerando(false);
    if (!r.ok) return setError(textoDeError(t, r.error));

    alAbrir(true);
    datos.avisarExito(
      r.quedaEsperando
        ? t("casos.pasos.linkListoEsperando")
        : t("casos.pasos.linkListo")
    );
  }

  async function cortar() {
    setError(null);
    setCortando(false);
    const r = await datos.dejarDeCompartirCaso(caso.id);
    if (!r.ok) return setError(textoDeError(t, r.error));
    alAbrir(false);
    datos.avisarExito(t("casos.pasos.linkCortado"));
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      datos.avisarExito(t("casos.pasos.mensajeCopiado"));
    } catch {
      // Sin permiso para el portapapeles queda marcado, que es lo que hace
      // falta para copiarlo a mano. Seleccionar varias líneas en un celular
      // era la parte más difícil de toda la tarea (auditoría, H7).
      const pre = document.getElementById("mensaje-cliente");
      if (pre) window.getSelection()?.selectAllChildren(pre);
      datos.avisarExito(t("casos.comun.noPudimosCopiar"));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={mandar}
        data-testid="pasos-mandar"
        className="mt-6 flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado"
      >
        <Icono nombre="chat" />
        {generando
          ? t("casos.pasos.armandoLink")
          : codigo
            ? abierto
              ? t("casos.comun.cerrar")
              : t("casos.pasos.mandarPasos")
            : t("casos.pasos.mandarPasos")}
      </button>

      {error && (
        <div className="mt-3">
          <ErrorGeneral>{error}</ErrorGeneral>
        </div>
      )}

      {abierto && codigo && (
        <div className="mt-3 rounded-tarjeta border border-borde bg-tarjeta p-4">
          <Campo
            id="link-seguimiento"
            etiqueta={t("casos.pasos.linkDelCliente")}
            ayuda={t("casos.pasos.linkApoyo")}
            value={link}
            readOnly
            onFocus={(ev) => ev.target.select()}
          />

          <div className="-mt-2 flex flex-wrap gap-3">
            <Boton icono="copiar" onClick={copiar}>
              {t("casos.pasos.copiarMensaje")}
            </Boton>
            {/* wa.me es un link común: abre WhatsApp con el mensaje ya
                escrito, sin integración y sin servidor. Sin número, porque el
                que lo toca es el negocio y elige el contacto en su agenda. */}
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

          <p className="mt-4 flex items-start gap-2 text-tinta-media">
            <Icono
              nombre={caso.seguimiento_visto_en ? "listo" : "reloj"}
              className="mt-0.5 size-5 shrink-0"
            />
            <span>
              {caso.seguimiento_visto_en
                ? t("casos.pasos.loAbrioUltima", { cuando: cuantoHace(caso.seguimiento_visto_en, t) })
                : t("casos.pasos.todaviaNoLoAbrio")}
            </span>
          </p>

          <p className="mt-4 font-bold">{t("casos.comun.esteEsElMensaje")}</p>
          <pre
            id="mensaje-cliente"
            className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-campo bg-superficie p-4 font-cuerpo text-etiqueta text-tinta-media"
          >
            {mensaje}
          </pre>

          {cortando ? (
            <div className="mt-4 rounded-tarjeta bg-superficie p-4">
              <p className="font-bold text-cuerpo">{t("casos.pasos.dejarDeCompartirPregunta")}</p>
              <p className="mt-1 max-w-[65ch] text-tinta-media">
                {t("casos.pasos.dejarDeCompartirTexto", {
                  nombre: cliente?.nombre?.split(" ")[0] ?? t("casos.comun.elCliente"),
                })}
              </p>
              {/* Desde la landing el cliente ve sus casos abiertos, y la
                  base le arma un link nuevo al que no tenga: cortar este no
                  se lo esconde. Mejor que el negocio lo sepa antes de cortar.
                  Un caso terminado no está en la landing: ahí no se dice. */}
              {datos.negocio?.landing_codigo && estaAbierto(caso) && (
                <p className="mt-2 max-w-[65ch] text-tinta-media">
                  {t("casos.pasos.landing")}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <Boton variante="peligro" icono="tacho" onClick={cortar} data-testid="pasos-dejar-confirmar">
                  {t("casos.pasos.siDejar")}
                </Boton>
                <Boton variante="plano" onClick={() => setCortando(false)}>
                  {t("casos.pasos.seguirCompartiendo")}
                </Boton>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <Boton variante="plano" icono="tacho" onClick={() => setCortando(true)} data-testid="pasos-dejar">
                {t("casos.pasos.dejarDeCompartir")}
              </Boton>
            </div>
          )}
        </div>
      )}
    </>
  );
}
