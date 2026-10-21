"use client";

// Los cobros de un caso, en la pantalla del caso (025).
//
// Un caso puede tener varios cobros: una seña al dejar el auto y el resto al
// retirarlo. Esta sección los muestra en orden, dice cuánto falta contra lo
// aprobado y deja anotar uno nuevo o anular uno mal anotado.
//
// Se puede cobrar con el caso abierto (una seña) y también cerrado: el
// cliente se llevó el auto y vuelve a pagar el resto otro día.
//
// Dos maneras de cobrar:
//   · Anotar lo que ya se cobró en el local —efectivo, transferencia,
//     tarjeta—, que nace pagado porque la plata ya está en la mano.
//   · Pedir un pago por link (para mandárselo) o por QR (para mostrarlo en
//     el mostrador). Eso pasa por la API de pagos (src/lib/pagos.js): el
//     cobro queda "esperando el pago" y pasa a pagado cuando el medio de pago
//     le avisa a la API. Mientras tanto, la pantalla pregunta cada tanto.

import { useEffect, useState } from "react";
import {
  MEDIOS_DEL_LOCAL,
  MEDIOS_EN_LINEA,
  hayPagosEnCamino,
  mensajeDePago,
  montoParaPedir,
  cuentaDelCaso,
  estadoDeCobro,
  montoDeCobroValido,
  montoSugerido,
  palabraDelCobro,
  palabraDelMedio,
  sePuedeAnular,
} from "@/lib/cobros";
import { pesos } from "@/lib/estados";
import { cuando } from "@/lib/fechas";
import { textoDeError } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";
import { conElementos } from "@/lib/conElementos";
import { linkDeWhatsApp, linkDeWhatsAppA } from "@/lib/seguimiento";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Tarjeta, TituloSeccion } from "@/componentes/ui";

// La cuenta en una frase, según cómo esté. Es lo primero que se lee: el
// número suelto no dice si está bien o si falta algo.
//
// `t` y `locale` son los de quien mira (useIdioma): la plata sigue en pesos y
// sólo cambia cómo se escribe.
export function fraseDeLaCuenta(cuenta, t, locale) {
  const p = (n) => pesos(n, locale);
  switch (cuenta.situacion) {
    case "sin_cobrar":
      return cuenta.total > 0
        ? { texto: t("casos.cobros.frase.sinCobrarFalta", { falta: p(cuenta.falta) }), icono: "reloj", color: "text-espera" }
        : { texto: t("casos.cobros.frase.sinCobrar"), icono: "reloj", color: "text-tinta-media" };
    case "parcial":
      return { texto: t("casos.cobros.frase.parcial", { falta: p(cuenta.falta) }), icono: "reloj", color: "text-espera" };
    case "esperando_pagos":
      return {
        texto: t("casos.cobros.frase.esperandoPagos", { pendiente: p(cuenta.pendiente) }),
        icono: "reloj",
        color: "text-espera",
      };
    case "completo":
      return { texto: t("casos.cobros.frase.completo"), icono: "listo", color: "text-completo" };
    case "con_descuento":
      return cuenta.pagado > 0
        ? {
            texto: t("casos.cobros.frase.conDescuento", { pagado: p(cuenta.pagado), descuento: p(cuenta.descuento) }),
            icono: "listo",
            color: "text-completo",
          }
        : { texto: t("casos.cobros.frase.saldado"), icono: "listo", color: "text-completo" };
    case "de_mas":
      return {
        texto: t("casos.cobros.frase.deMas", { demas: p(cuenta.deMas) }),
        icono: "listo",
        color: "text-completo",
      };
    case "sin_presupuesto":
      return {
        texto: t("casos.cobros.frase.sinPresupuesto"),
        icono: "nota",
        color: "text-tinta-media",
      };
    default:
      return null;
  }
}

// Los números de la cuenta, uno al lado del otro. "Esperando el pago" y
// "De más" aparecen sólo cuando hay.
export function ResumenCuenta({ cuenta }) {
  const { t, locale } = useIdioma();
  const cifras = [
    { clave: "aprobado", valor: cuenta.total },
    { clave: "cobrado", valor: cuenta.pagado },
    cuenta.pendiente > 0 && { clave: "esperando", valor: cuenta.pendiente },
    cuenta.descuento > 0 && { clave: "noSeCobra", valor: cuenta.descuento },
    { clave: "falta", valor: cuenta.falta },
  ].filter(Boolean);

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      {cifras.map((c) => (
        <div key={c.clave}>
          <dt className="text-apoyo text-tinta-suave">{t(`casos.cobros.cifras.${c.clave}`)}</dt>
          <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">{pesos(c.valor, locale)}</dd>
        </div>
      ))}
    </dl>
  );
}

// Cómo pagó: los tres medios del local, como botones que se eligen.
export function ElegirMedio({ valor, alElegir }) {
  const { t } = useIdioma();
  return (
    <fieldset>
      <legend className="mb-2 font-bold text-cuerpo">{t("casos.cobros.comoPago")}</legend>
      <ul className="flex flex-wrap gap-2.5">
        {MEDIOS_DEL_LOCAL.map((clave) => {
          const puesto = clave === valor;
          return (
            <li key={clave}>
              <button
                type="button"
                aria-pressed={puesto}
                onClick={() => alElegir(clave)}
                className={[
                  "flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 px-4 font-bold text-cuerpo",
                  puesto
                    ? "border-azul bg-azul-claro text-azul"
                    : "border-borde-fuerte bg-tarjeta text-tinta hover:bg-superficie",
                ].join(" ")}
              >
                {puesto && <Icono nombre="listo" className="size-5" />}
                {palabraDelMedio(clave, t)}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

// Cada cuánto se le pregunta a la base si entró un pago por link.
const CADA_CUANTO = 10000;

export default function SeccionCobros({
  caso,
  aprobado,
  cobros,
  descuento,
  puedeCargar,
  // El descuento es del presupuesto (armar_presupuesto), no del cobro.
  puedeDescontar = false,
  datos,
  cliente = null,
  negocio = null,
}) {
  const { t, locale } = useIdioma();
  const [anotando, setAnotando] = useState(false);
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [anulando, setAnulando] = useState(null);
  const [motivo, setMotivo] = useState("");
  // "No le cobro lo que falta" pide confirmación: es plata que se resigna.
  const [descontando, setDescontando] = useState(false);

  // Pedir un pago por link o QR.
  const [pidiendo, setPidiendo] = useState(false);
  const [montoPedido, setMontoPedido] = useState("");
  const [medioPedido, setMedioPedido] = useState("link");
  const [mercadoPagoConectado, setMercadoPagoConectado] = useState(null);
  const [vinculadoAhora, setVinculadoAhora] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mp") !== "conectado") return;
    window.sessionStorage.removeItem("marmanager.mp-desde");
    setVinculadoAhora(true);
    document.getElementById("cobros")?.scrollIntoView({ block: "start" });
    window.history.replaceState(null, "", window.location.pathname + "#cobros");
  }, []);

  const cuenta = cuentaDelCaso({ aprobado, cobros, descuento });
  const frase = fraseDeLaCuenta(cuenta, t, locale);
  const enLinea = datos.pagosEnLinea ?? { disponible: false, motivo: null };
  useEffect(() => {
    let vivo = true;
    datos.estadoMercadoPago().then(r => {
      if (vivo) setMercadoPagoConectado(Boolean(r.ok && r.conectado));
    });
    return () => { vivo = false; };
  }, [caso.id]);

  async function conectarMercadoPago() {
    setError(null);
    try {
      const r = await datos.conectarMercadoPago();
      if (!r.ok) throw new Error(textoDeError(t, r.error));
      window.sessionStorage.setItem("marmanager.mp-desde", caso.id);
      window.location.assign(r.url);
    } catch (e) { setError(e.message); }
  }

  // Un pago por link entra del otro lado: el medio de pago le avisa a la API
  // y la API escribe la base. Acá no llega solo, así que mientras haya uno
  // esperando se pregunta cada tanto, y también al volver a la pestaña.
  const esperandoAlgo = hayPagosEnCamino(cobros);
  useEffect(() => {
    if (!esperandoAlgo) return;
    let vivo = true;
    const mirar = async () => {
      await datos.conciliarCobrosMercadoPago(caso.id);
      const r = await datos.refrescarCobros(caso.id);
      if (vivo && r?.pagados?.length) {
        const total = r.pagados.reduce((s, c) => s + Number(c.monto), 0);
        datos.avisarExito(t("casos.cobros.entroPago", { monto: pesos(total, locale) }));
      }
    };
    const reloj = setInterval(mirar, CADA_CUANTO);
    window.addEventListener("focus", mirar);
    mirar();
    return () => {
      vivo = false;
      clearInterval(reloj);
      window.removeEventListener("focus", mirar);
    };
    // datos cambia en cada render; lo que importa es el caso y si hay algo
    // esperando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esperandoAlgo, caso.id]);

  // Un caso cerrado con SCRUM-74 que registró un número pero no tiene cobros
  // en la tabla: el 0 de "se entregó sin cobrar", sin nada aprobado contra
  // qué compararlo. Con algo aprobado, la cuenta ya lo dice ("no se cobra").
  const soloElNumeroViejo = cobros.length === 0 && caso.cobrado != null && aprobado === 0;

  // Sin presupuesto, sin cobros y sin permiso para anotar: no hay nada que
  // mostrar.
  if (!puedeCargar && !puedeDescontar && cobros.length === 0 && aprobado === 0 && !soloElNumeroViejo) return null;

  function abrir() {
    const sugerido = montoSugerido(cuenta);
    setMonto(sugerido ? String(sugerido) : "");
    setMedio("efectivo");
    setNota("");
    setError(null);
    setPidiendo(false);
    setAnotando(true);
  }

  async function anotar() {
    setError(null);
    setGuardando(true);
    const r = await datos.registrarCobro({
      casoId: caso.id,
      monto: Number(monto),
      medio,
      nota: nota.trim() || null,
    });
    setGuardando(false);
    if (!r.ok) return setError(textoDeError(t, r.error));
    datos.avisarExito(t("casos.cobros.anotamos", {
      monto: pesos(Number(monto), locale),
      medio: palabraDelMedio(medio, t).toLowerCase(),
    }));
    setAnotando(false);
  }

  function abrirPedido() {
    const sugerido = montoParaPedir(cuenta);
    setMontoPedido(sugerido ? String(sugerido) : "");
    setMedioPedido("link");
    setError(null);
    setAnotando(false);
    setPidiendo(true);
  }

  async function pedir() {
    setError(null);
    setGuardando(true);
    const r = await datos.pedirCobroEnLinea({
      casoId: caso.id,
      monto: Number(montoPedido),
      medio: medioPedido,
    });
    setGuardando(false);
    if (!r.ok) return setError(textoDeError(t, r.error));
    datos.avisarExito(
      medioPedido === "qr"
        ? t("casos.cobros.mostraleQr")
        : t("casos.cobros.mandaleLink")
    );
    setPidiendo(false);
    if (r.cobro?.id) {
      setTimeout(() => document.getElementById(`cobro-${r.cobro.id}`)?.scrollIntoView({ block: "center" }), 0);
    }
  }

  async function anular(cobro) {
    const r = await datos.anularCobro(cobro.id, motivo.trim() || null);
    if (!r.ok) return setError(textoDeError(t, r.error));
    datos.avisarExito(t("casos.cobros.anulamos", { monto: pesos(Number(cobro.monto), locale) }));
    setAnulando(null);
    setMotivo("");
  }

  return (
    <>
      <div id="cobros" className="scroll-mt-6"><TituloSeccion className="mt-12">{t("casos.cobros.titulo")}</TituloSeccion></div>
      <Tarjeta>
        {vinculadoAhora && (
          <p role="status" className="mb-4 rounded-campo bg-completo-fondo p-3 font-bold text-completo">
            {t("casos.cobros.mercadoPagoVinculado")}
          </p>
        )}
        {soloElNumeroViejo ? (
          <p className="text-tinta-media">
            {Number(caso.cobrado) === 0 ? (
              t("casos.cobros.entregadoSinCobrar")
            ) : (
              conElementos(t("casos.cobros.cobradoMonto"), {
                monto: <span className="font-bold text-tinta">{pesos(Number(caso.cobrado), locale)}</span>,
              })
            )}
            {caso.cobrado_en ? ` · ${cuando(caso.cobrado_en, locale, t)}` : ""}
          </p>
        ) : (
          <>
            <ResumenCuenta cuenta={cuenta} />
            {frase && (
              <p className={`mt-4 flex items-start gap-2 font-bold ${frase.color}`}>
                <Icono nombre={frase.icono} className="mt-0.5 size-6 shrink-0" />
                <span>{frase.texto}</span>
              </p>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 font-bold text-rojo">
            <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {cobros.length > 0 && (
          <ul className="mt-5 divide-y divide-borde border-t border-borde">
            {cobros.map((c) => {
              const e = estadoDeCobro(c.estado);
              return (
                <li key={c.id} id={`cobro-${c.id}`} className="py-4 scroll-mt-6">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className={`font-bold text-cuerpo tabular-nums ${c.estado === "anulado" ? "text-tinta-suave line-through" : ""}`}>
                        {pesos(Number(c.monto), locale)}
                      </p>
                      <p className="text-tinta-media">
                        {palabraDelMedio(c.medio, t)} · {cuando(c.pagado_en ?? c.creado_en, locale, t)}
                        {c.nota ? ` · ${c.nota}` : ""}
                      </p>
                      {c.estado === "anulado" && c.motivo_anulacion && (
                        <p className="text-tinta-suave">{t("casos.cobros.porQueSeAnulo", { motivo: c.motivo_anulacion })}</p>
                      )}
                    </div>
                    <p className={`flex items-center gap-1.5 font-bold ${e.texto.replace("line-through", "")}`}>
                      <Icono nombre={e.icono} className="size-5 shrink-0" />
                      {palabraDelCobro(c.estado, t)}
                    </p>
                  </div>

                  {c.estado === "pendiente" && MEDIOS_EN_LINEA.includes(c.medio) && (
                    <PagoEnCamino
                      cobro={c}
                      datos={datos}
                      cliente={cliente}
                      negocio={negocio}
                    />
                  )}

                  {puedeCargar && sePuedeAnular(c) && anulando !== c.id && (
                    <div className="mt-2">
                      <Boton
                        variante="plano"
                        icono="cruz"
                        onClick={() => {
                          setAnulando(c.id);
                          setMotivo("");
                          setError(null);
                        }}
                      >
                        {c.estado === "pendiente" ? t("casos.cobros.cancelarPedido") : t("casos.cobros.anularCobro")}
                      </Boton>
                    </div>
                  )}

                  {anulando === c.id && (
                    <div className="mt-3 rounded-tarjeta bg-superficie p-4">
                      <p className="font-bold text-cuerpo">{t("casos.cobros.anularPregunta", { monto: pesos(Number(c.monto), locale) })}</p>
                      <p className="mt-1 max-w-[65ch] text-tinta-media">
                        {t("casos.cobros.anularTexto")}
                      </p>
                      <div className="mt-4">
                        <Campo
                          id={`motivo-${c.id}`}
                          etiqueta={t("casos.cobros.porQue")}
                          ayuda={t("casos.cobros.porQueAyuda")}
                          value={motivo}
                          onChange={(ev) => setMotivo(ev.target.value)}
                        />
                      </div>
                      <div className="-mt-2 flex flex-wrap gap-3">
                        <Boton variante="peligro" icono="cruz" onClick={() => anular(c)}>
                          {t("casos.cobros.siAnularlo")}
                        </Boton>
                        <Boton variante="plano" onClick={() => setAnulando(null)}>
                          {t("casos.comun.mejorNo")}
                        </Boton>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Lo que no se le cobra. Va con confirmación, y se puede volver
            atrás: descontar de más por error no puede quedar para siempre. */}
        {puedeDescontar && descontando && (
          <div className="mt-5 rounded-tarjeta bg-superficie p-4">
            <p className="font-bold text-cuerpo">{t("casos.cobros.noLeCobrasPregunta", { monto: pesos(cuenta.falta, locale) })}</p>
            <p className="mt-1 max-w-[65ch] text-tinta-media">
              {t("casos.cobros.noLeCobrasTexto")}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Boton
                variante="neutro"
                icono="listo"
                onClick={() => {
                  datos.cambiarDescuento(caso.id, cuenta.descuento + cuenta.falta);
                  datos.avisarExito(t("casos.cobros.noSeCobran", { monto: pesos(cuenta.falta, locale) }));
                  setDescontando(false);
                }}
              >
                {t("casos.cobros.siNoSeLoCobro")}
              </Boton>
              <Boton variante="plano" onClick={() => setDescontando(false)}>
                {t("casos.comun.mejorNo")}
              </Boton>
            </div>
          </div>
        )}

        {puedeCargar && pidiendo && (
          <div className="mt-5 rounded-tarjeta border border-borde p-4 sm:p-5">
            <p className="mb-4 font-bold text-subtitulo">{t("casos.cobros.pedirUnPago")}</p>
            <Campo
              id="monto-pedido"
              etiqueta={t("casos.cobros.cuantoLePedis")}
              ayuda={
                cuenta.falta > 0
                  ? t("casos.cobros.cuantoLePedisFalta", { falta: pesos(cuenta.falta, locale) })
                  : t("casos.cobros.conNumeros")
              }
              ejemplo="60000"
              inputMode="numeric"
              error={
                montoPedido.trim() && !montoDeCobroValido(montoPedido)
                  ? t("casos.cobros.montoInvalido")
                  : null
              }
              value={montoPedido}
              onChange={(ev) => setMontoPedido(ev.target.value)}
            />
            <fieldset>
              <legend className="mb-2 font-bold text-cuerpo">{t("casos.cobros.comoTeVaAPagar")}</legend>
              <ul className="flex flex-wrap gap-2.5">
                {[
                  { valor: "link", palabra: t("casos.cobros.conUnLink") },
                  { valor: "qr", palabra: t("casos.cobros.conUnQr") },
                ].map((o) => {
                  const puesto = o.valor === medioPedido;
                  return (
                    <li key={o.valor}>
                      <button
                        type="button"
                        aria-pressed={puesto}
                        onClick={() => setMedioPedido(o.valor)}
                        className={[
                          "flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 px-4 font-bold text-cuerpo",
                          puesto
                            ? "border-azul bg-azul-claro text-azul"
                            : "border-borde-fuerte bg-tarjeta text-tinta hover:bg-superficie",
                        ].join(" ")}
                      >
                        {puesto && <Icono nombre="listo" className="size-5" />}
                        {o.palabra}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            <div className="mt-6 flex flex-wrap gap-3">
              <Boton
                icono="listo"
                motivo={
                  guardando ? t("casos.cobros.armandoElPedido") : !montoDeCobroValido(montoPedido) ? t("casos.cobros.faltaElMonto") : null
                }
                onClick={pedir}
              >
                {t("casos.cobros.pedirElPago")}
              </Boton>
              <Boton variante="plano" onClick={() => setPidiendo(false)}>
                {t("casos.comun.mejorNo")}
              </Boton>
            </div>
          </div>
        )}

        {(puedeCargar || puedeDescontar) &&
          (!anotando ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {puedeCargar && (
                <Boton icono="mas" onClick={abrir}>
                  {t("casos.cobros.anotarUnCobro")}
                </Boton>
              )}
              {puedeCargar && enLinea.disponible && mercadoPagoConectado === false && (
                <Boton variante="plano" onClick={conectarMercadoPago}>
                  {t("casos.cobros.vincularMercadoPago")}
                </Boton>
              )}
              {/* Con todo cobrado o pedido no hay nada que pedir. Sin
                  presupuesto aprobado sí: no hay contra qué comparar. */}
              {puedeCargar && !pidiendo && (cuenta.falta > 0 || cuenta.total === 0) && (
                <Boton
                  variante="neutro"
                  icono="sobre"
                  motivo={!enLinea.disponible ? enLinea.motivo :
                    !mercadoPagoConectado ? t("casos.cobros.primeroVincular") : null}
                  onClick={abrirPedido}
                >
                  {t("casos.cobros.pedirPorLinkOQr")}
                </Boton>
              )}
              {puedeDescontar && cuenta.falta > 0 && cuenta.total > 0 && !descontando && (
                <Boton variante="plano" icono="nota" onClick={() => setDescontando(true)}>
                  {t("casos.cobros.noLeCobro")}
                </Boton>
              )}
              {puedeDescontar && cuenta.descuento > 0 && (
                <Boton
                  variante="plano"
                  icono="deshacer"
                  onClick={() => {
                    datos.cambiarDescuento(caso.id, 0, { antes: cuenta.descuento });
                    datos.avisarExito(t("casos.cobros.descuentoSacado"));
                  }}
                >
                  {t("casos.cobros.sacarDescuento")}
                </Boton>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-tarjeta border border-borde p-4 sm:p-5">
              <p className="mb-4 font-bold text-subtitulo">{t("casos.cobros.anotarUnCobro")}</p>
              <Campo
                id="monto-cobro"
                etiqueta={t("casos.cobros.cuantoTePago")}
                ayuda={
                  cuenta.falta > 0
                    ? t("casos.cobros.cuantoTePagoFalta", { falta: pesos(cuenta.falta, locale) })
                    : t("casos.cobros.conNumeros")
                }
                ejemplo="20000"
                inputMode="numeric"
                error={monto.trim() && !montoDeCobroValido(monto) ? t("casos.cobros.montoInvalido") : null}
                value={monto}
                onChange={(ev) => setMonto(ev.target.value)}
              />
              <ElegirMedio valor={medio} alElegir={setMedio} />
              <div className="mt-6">
                <Campo
                  id="nota-cobro"
                  etiqueta={t("casos.cobros.nota")}
                  ayuda={t("casos.cobros.notaAyuda")}
                  value={nota}
                  onChange={(ev) => setNota(ev.target.value)}
                />
              </div>
              <div className="-mt-2 flex flex-wrap gap-3">
                <Boton
                  icono="listo"
                  motivo={
                    guardando ? t("casos.cobros.anotando") : !montoDeCobroValido(monto) ? t("casos.cobros.faltaElMonto") : null
                  }
                  onClick={anotar}
                >
                  {t("casos.cobros.anotarElCobro")}
                </Boton>
                <Boton variante="plano" onClick={() => setAnotando(false)}>
                  {t("casos.comun.mejorNo")}
                </Boton>
              </div>
            </div>
          ))}
      </Tarjeta>
    </>
  );
}

// Un pedido de pago que todavía no se pagó: el link para mandar, el QR para
// mostrar y hasta cuándo vale.
function PagoEnCamino({ cobro, datos, cliente, negocio }) {
  const { t, locale } = useIdioma();
  // Lo manda el negocio: sale en su idioma.
  const mensaje = cobro.link
    ? mensajeDePago({ negocio: negocio?.nombre, cliente: cliente?.nombre, monto: cobro.monto, link: cobro.link }, t, locale)
    : null;
  const whatsapp = mensaje
    ? (cliente?.telefono && linkDeWhatsAppA(cliente.telefono, mensaje)) || linkDeWhatsApp(mensaje)
    : null;

  return (
    <div className="mt-3 rounded-tarjeta bg-superficie p-4">
      {cobro.medio === "qr" ? (
        cobro.qr_imagen ? (
          <div>
            <p className="mb-2 font-bold text-cuerpo">{t("casos.cobros.mostraleEsteQr")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cobro.qr_imagen}
              alt={t("casos.cobros.qrAlt", { monto: pesos(Number(cobro.monto), locale) })}
              className="size-56 rounded-campo bg-white p-2"
            />
          </div>
        ) : (
          <p className="text-tinta-media">{t("casos.cobros.qrNoLlego")}</p>
        )
      ) : cobro.link ? (
        <>
          <p className="mb-1 font-bold text-cuerpo">{t("casos.cobros.elLinkParaPagar")}</p>
          <p className="break-all text-tinta-media">{cobro.link}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Boton
              variante="neutro"
              icono="copiar"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(cobro.link);
                  datos.avisarExito(t("casos.cobros.linkCopiado"));
                } catch {
                  datos.avisarExito(t("casos.cobros.linkNoCopiado"));
                }
              }}
            >
              {t("casos.comun.copiarLink")}
            </Boton>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 font-bold text-cuerpo text-tinta hover:bg-superficie"
              >
                <Icono nombre="chat" />
                {t("casos.comun.mandarWhatsapp")}
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="text-tinta-media">{t("casos.cobros.linkNoLlego")}</p>
      )}

      {cobro.vence_en && (
        <p className="mt-3 text-tinta-media">{t("casos.cobros.vence", { cuando: cuando(cobro.vence_en, locale, t) })}</p>
      )}
    </div>
  );
}
