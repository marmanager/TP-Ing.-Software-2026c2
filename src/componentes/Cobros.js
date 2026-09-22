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
  MEDIOS,
  MEDIOS_DEL_LOCAL,
  MEDIOS_EN_LINEA,
  hayPagosEnCamino,
  mensajeDePago,
  montoParaPedir,
  cuentaDelCaso,
  estadoDeCobro,
  medioDe,
  montoDeCobroValido,
  montoSugerido,
  sePuedeAnular,
} from "@/lib/cobros";
import { pesos } from "@/lib/estados";
import { cuando } from "@/lib/fechas";
import { linkDeWhatsApp, linkDeWhatsAppA } from "@/lib/seguimiento";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Tarjeta, TituloSeccion } from "@/componentes/ui";
import { useAuth } from "@/lib/auth";
import { API_PAGOS } from "@/lib/pagos";

// La cuenta en una frase, según cómo esté. Es lo primero que se lee: el
// número suelto no dice si está bien o si falta algo.
export function fraseDeLaCuenta(cuenta) {
  switch (cuenta.situacion) {
    case "sin_cobrar":
      return cuenta.total > 0
        ? { texto: `Todavía no se cobró nada. Falta ${pesos(cuenta.falta)}.`, icono: "reloj", color: "text-espera" }
        : { texto: "Todavía no se cobró nada.", icono: "reloj", color: "text-tinta-media" };
    case "parcial":
      return { texto: `Falta cobrar ${pesos(cuenta.falta)}.`, icono: "reloj", color: "text-espera" };
    case "esperando_pagos":
      return {
        texto: `Lo que falta ya se pidió: se espera un pago de ${pesos(cuenta.pendiente)}.`,
        icono: "reloj",
        color: "text-espera",
      };
    case "completo":
      return { texto: "Está todo cobrado.", icono: "listo", color: "text-completo" };
    case "con_descuento":
      return cuenta.pagado > 0
        ? {
            texto: `Está saldado: se cobraron ${pesos(cuenta.pagado)} y no se le cobran ${pesos(cuenta.descuento)}.`,
            icono: "listo",
            color: "text-completo",
          }
        : { texto: "No se le cobra: está saldado sin pagar nada.", icono: "listo", color: "text-completo" };
    case "de_mas":
      return {
        texto: `Está todo cobrado, y ${pesos(cuenta.deMas)} más de lo aprobado.`,
        icono: "listo",
        color: "text-completo",
      };
    case "sin_presupuesto":
      return {
        texto: "No hay pasos aprobados: lo cobrado no se compara con nada.",
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
  const cifras = [
    { etiqueta: "Aprobado", valor: cuenta.total },
    { etiqueta: "Cobrado", valor: cuenta.pagado },
    cuenta.pendiente > 0 && { etiqueta: "Esperando el pago", valor: cuenta.pendiente },
    cuenta.descuento > 0 && { etiqueta: "No se cobra", valor: cuenta.descuento },
    { etiqueta: "Falta", valor: cuenta.falta },
  ].filter(Boolean);

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      {cifras.map((c) => (
        <div key={c.etiqueta}>
          <dt className="text-apoyo text-tinta-suave">{c.etiqueta}</dt>
          <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">{pesos(c.valor)}</dd>
        </div>
      ))}
    </dl>
  );
}

// Cómo pagó: los tres medios del local, como botones que se eligen.
export function ElegirMedio({ valor, alElegir }) {
  return (
    <fieldset>
      <legend className="mb-2 font-bold text-cuerpo">¿Cómo te pagó?</legend>
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
                {MEDIOS[clave].palabra}
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
  datos,
  cliente = null,
  negocio = null,
}) {
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
  const { sesion } = useAuth();
  const [mercadoPagoConectado, setMercadoPagoConectado] = useState(null);
  const [vinculadoAhora, setVinculadoAhora] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mp") !== "conectado") return;
    setVinculadoAhora(true);
    document.getElementById("cobros")?.scrollIntoView({ block: "start" });
    window.history.replaceState(null, "", window.location.pathname + "#cobros");
  }, []);

  const cuenta = cuentaDelCaso({ aprobado, cobros, descuento });
  const frase = fraseDeLaCuenta(cuenta);
  const enLinea = datos.pagosEnLinea ?? { disponible: false, simulado: false, motivo: null };
  useEffect(() => {
    if (!API_PAGOS || !sesion?.access_token || enLinea.simulado) return;
    let vivo = true;
    fetch(`${API_PAGOS}/mercadopago/status`, {
      headers: { Authorization: `Bearer ${sesion.access_token}` },
    }).then(r => r.json()).then(r => {
      if (vivo) setMercadoPagoConectado(Boolean(r.ok && r.conectado));
    }).catch(() => { if (vivo) setMercadoPagoConectado(false); });
    return () => { vivo = false; };
  }, [sesion?.access_token, enLinea.simulado]);

  async function conectarMercadoPago() {
    setError(null);
    try {
      const response = await fetch(`${API_PAGOS}/mercadopago/connect`, {
        method: "POST", headers: { Authorization: `Bearer ${sesion.access_token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.motivo || "No se pudo vincular Mercado Pago.");
      window.sessionStorage.setItem("marmanager.mp-caso", caso.id);
      window.location.assign(data.url);
    } catch (e) { setError(e.message); }
  }

  // Un pago por link entra del otro lado: el medio de pago le avisa a la API
  // y la API escribe la base. Acá no llega solo, así que mientras haya uno
  // esperando se pregunta cada tanto, y también al volver a la pestaña.
  const esperandoAlgo = hayPagosEnCamino(cobros) && !enLinea.simulado;
  useEffect(() => {
    if (!esperandoAlgo) return;
    let vivo = true;
    const mirar = async () => {
      if (API_PAGOS && sesion?.access_token) {
        try {
          await fetch(`${API_PAGOS}/casos/${caso.id}/conciliar-cobros`, {
            method: "POST", headers: { Authorization: `Bearer ${sesion.access_token}` },
          });
        } catch { /* El webhook sigue funcionando aunque falle esta consulta. */ }
      }
      const r = await datos.refrescarCobros(caso.id);
      if (vivo && r?.pagados?.length) {
        const total = r.pagados.reduce((s, c) => s + Number(c.monto), 0);
        datos.avisarExito(`Entró el pago de ${pesos(total)}.`);
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
  if (!puedeCargar && cobros.length === 0 && aprobado === 0 && !soloElNumeroViejo) return null;

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
    if (!r.ok) return setError(r.error);
    datos.avisarExito(`Listo. Anotamos ${pesos(Number(monto))} en ${medioDe(medio).palabra.toLowerCase()}.`);
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
    if (!r.ok) return setError(r.error);
    datos.avisarExito(
      medioPedido === "qr"
        ? "Listo. Mostrale el QR para que pague."
        : "Listo. Mandale el link para que pague."
    );
    setPidiendo(false);
    if (r.cobro?.id) {
      setTimeout(() => document.getElementById(`cobro-${r.cobro.id}`)?.scrollIntoView({ block: "center" }), 0);
    }
  }

  async function anular(cobro) {
    const r = await datos.anularCobro(cobro.id, motivo.trim() || null);
    if (!r.ok) return setError(r.error);
    datos.avisarExito(`Listo. Anulamos el cobro de ${pesos(Number(cobro.monto))}.`);
    setAnulando(null);
    setMotivo("");
  }

  return (
    <>
      <div id="cobros" className="scroll-mt-6"><TituloSeccion className="mt-12">Cobros</TituloSeccion></div>
      <Tarjeta>
        {vinculadoAhora && (
          <p role="status" className="mb-4 rounded-campo bg-completo-fondo p-3 font-bold text-completo">
            Mercado Pago quedó vinculado. Ya podés pedir pagos por link o QR.
          </p>
        )}
        {soloElNumeroViejo ? (
          <p className="text-tinta-media">
            {Number(caso.cobrado) === 0 ? (
              "Se entregó sin cobrar nada."
            ) : (
              <>
                Cobrado <span className="font-bold text-tinta">{pesos(Number(caso.cobrado))}</span>
              </>
            )}
            {caso.cobrado_en ? ` · ${cuando(caso.cobrado_en)}` : ""}
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
                        {pesos(Number(c.monto))}
                      </p>
                      <p className="text-tinta-media">
                        {medioDe(c.medio).palabra} · {cuando(c.pagado_en ?? c.creado_en)}
                        {c.nota ? ` · ${c.nota}` : ""}
                      </p>
                      {c.estado === "anulado" && c.motivo_anulacion && (
                        <p className="text-tinta-suave">Por qué se anuló: {c.motivo_anulacion}</p>
                      )}
                    </div>
                    <p className={`flex items-center gap-1.5 font-bold ${e.texto.replace("line-through", "")}`}>
                      <Icono nombre={e.icono} className="size-5 shrink-0" />
                      {e.palabra}
                    </p>
                  </div>

                  {c.estado === "pendiente" && MEDIOS_EN_LINEA.includes(c.medio) && (
                    <PagoEnCamino
                      cobro={c}
                      simulado={enLinea.simulado || c.proveedor === "simulado"}
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
                        {c.estado === "pendiente" ? "Cancelar este pedido de pago" : "Anular este cobro"}
                      </Boton>
                    </div>
                  )}

                  {anulando === c.id && (
                    <div className="mt-3 rounded-tarjeta bg-superficie p-4">
                      <p className="font-bold text-cuerpo">¿Anular el cobro de {pesos(Number(c.monto))}?</p>
                      <p className="mt-1 max-w-[65ch] text-tinta-media">
                        Deja de contar como cobrado, pero no se borra: queda en la lista
                        como anulado, con tu nombre en el historial.
                      </p>
                      <div className="mt-4">
                        <Campo
                          id={`motivo-${c.id}`}
                          etiqueta="¿Por qué? (si querés)"
                          ayuda="Por ejemplo: se anotó dos veces."
                          value={motivo}
                          onChange={(ev) => setMotivo(ev.target.value)}
                        />
                      </div>
                      <div className="-mt-2 flex flex-wrap gap-3">
                        <Boton variante="peligro" icono="cruz" onClick={() => anular(c)}>
                          Sí, anularlo
                        </Boton>
                        <Boton variante="plano" onClick={() => setAnulando(null)}>
                          Mejor no
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
        {puedeCargar && descontando && (
          <div className="mt-5 rounded-tarjeta bg-superficie p-4">
            <p className="font-bold text-cuerpo">¿No le cobrás los {pesos(cuenta.falta)} que faltan?</p>
            <p className="mt-1 max-w-[65ch] text-tinta-media">
              Deja de figurar como plata por cobrar: queda como un descuento. Si
              después te paga igual, lo anotás como un cobro más.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Boton
                variante="neutro"
                icono="listo"
                onClick={() => {
                  datos.cambiarDescuento(caso.id, cuenta.descuento + cuenta.falta);
                  datos.avisarExito(`Listo. No se le cobran ${pesos(cuenta.falta)}.`);
                  setDescontando(false);
                }}
              >
                Sí, no se lo cobro
              </Boton>
              <Boton variante="plano" onClick={() => setDescontando(false)}>
                Mejor no
              </Boton>
            </div>
          </div>
        )}

        {puedeCargar && pidiendo && (
          <div className="mt-5 rounded-tarjeta border border-borde p-4 sm:p-5">
            <p className="mb-4 font-bold text-subtitulo">Pedir un pago</p>
            {enLinea.simulado && (
              <p className="mb-4 flex items-start gap-2 rounded-campo bg-superficie p-3 text-tinta-media">
                <Icono nombre="nota" className="mt-0.5 size-5 shrink-0" />
                <span>
                  Estás en el modo de ejemplo: el pago se simula. Con el sistema de
                  pagos conectado, acá se arma un link o un QR de verdad.
                </span>
              </p>
            )}
            <Campo
              id="monto-pedido"
              etiqueta="¿Cuánto le pedís?"
              ayuda={
                cuenta.falta > 0
                  ? `Con números y sin puntos. Falta cobrar ${pesos(cuenta.falta)}.`
                  : "Con números y sin puntos."
              }
              ejemplo="60000"
              inputMode="numeric"
              error={
                montoPedido.trim() && !montoDeCobroValido(montoPedido)
                  ? "El monto va con números, sin puntos, y mayor que cero."
                  : null
              }
              value={montoPedido}
              onChange={(ev) => setMontoPedido(ev.target.value)}
            />
            <fieldset>
              <legend className="mb-2 font-bold text-cuerpo">¿Cómo te va a pagar?</legend>
              <ul className="flex flex-wrap gap-2.5">
                {[
                  { valor: "link", palabra: "Con un link que le mando" },
                  { valor: "qr", palabra: "Con un QR, acá en el local" },
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
                  guardando ? "armando el pedido" : !montoDeCobroValido(montoPedido) ? "falta el monto" : null
                }
                onClick={pedir}
              >
                Pedir el pago
              </Boton>
              <Boton variante="plano" onClick={() => setPidiendo(false)}>
                Mejor no
              </Boton>
            </div>
          </div>
        )}

        {puedeCargar &&
          (!anotando ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Boton icono="mas" onClick={abrir}>
                Anotar un cobro
              </Boton>
              {enLinea.disponible && !enLinea.simulado && mercadoPagoConectado === false && (
                <Boton variante="plano" onClick={conectarMercadoPago}>
                  Vincular Mercado Pago
                </Boton>
              )}
              {/* Con todo cobrado o pedido no hay nada que pedir. Sin
                  presupuesto aprobado sí: no hay contra qué comparar. */}
              {!pidiendo && (cuenta.falta > 0 || cuenta.total === 0) && (
                <Boton
                  variante="neutro"
                  icono="sobre"
                  motivo={!enLinea.disponible ? enLinea.motivo :
                    !enLinea.simulado && !mercadoPagoConectado ? "primero vinculá Mercado Pago" : null}
                  onClick={abrirPedido}
                >
                  Pedir un pago por link o QR
                </Boton>
              )}
              {cuenta.falta > 0 && cuenta.total > 0 && !descontando && (
                <Boton variante="plano" icono="nota" onClick={() => setDescontando(true)}>
                  No le cobro lo que falta
                </Boton>
              )}
              {cuenta.descuento > 0 && (
                <Boton
                  variante="plano"
                  icono="deshacer"
                  onClick={() => {
                    datos.cambiarDescuento(caso.id, 0, { antes: cuenta.descuento });
                    datos.avisarExito("Listo. Lo que faltaba vuelve a figurar como por cobrar.");
                  }}
                >
                  Sacar el descuento
                </Boton>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-tarjeta border border-borde p-4 sm:p-5">
              <p className="mb-4 font-bold text-subtitulo">Anotar un cobro</p>
              <Campo
                id="monto-cobro"
                etiqueta="¿Cuánto te pagó?"
                ayuda={
                  cuenta.falta > 0
                    ? `Con números y sin puntos. Falta cobrar ${pesos(cuenta.falta)}; si es una seña, poné lo que te dio.`
                    : "Con números y sin puntos."
                }
                ejemplo="20000"
                inputMode="numeric"
                error={monto.trim() && !montoDeCobroValido(monto) ? "El monto va con números, sin puntos, y mayor que cero." : null}
                value={monto}
                onChange={(ev) => setMonto(ev.target.value)}
              />
              <ElegirMedio valor={medio} alElegir={setMedio} />
              <div className="mt-6">
                <Campo
                  id="nota-cobro"
                  etiqueta="Nota (si querés)"
                  ayuda="Por ejemplo: seña, o el número de la transferencia."
                  value={nota}
                  onChange={(ev) => setNota(ev.target.value)}
                />
              </div>
              <div className="-mt-2 flex flex-wrap gap-3">
                <Boton
                  icono="listo"
                  motivo={
                    guardando ? "anotando" : !montoDeCobroValido(monto) ? "falta el monto" : null
                  }
                  onClick={anotar}
                >
                  Anotar el cobro
                </Boton>
                <Boton variante="plano" onClick={() => setAnotando(false)}>
                  Mejor no
                </Boton>
              </div>
            </div>
          ))}
      </Tarjeta>
    </>
  );
}

// Un pedido de pago que todavía no se pagó: el link para mandar, el QR para
// mostrar y hasta cuándo vale. En el modo de ejemplo, los botones para hacer
// de cuenta que el medio de pago avisó.
function PagoEnCamino({ cobro, simulado, datos, cliente, negocio }) {
  const mensaje = cobro.link
    ? mensajeDePago({ negocio: negocio?.nombre, cliente: cliente?.nombre, monto: cobro.monto, link: cobro.link })
    : null;
  const whatsapp = mensaje
    ? (cliente?.telefono && linkDeWhatsAppA(cliente.telefono, mensaje)) || linkDeWhatsApp(mensaje)
    : null;

  return (
    <div className="mt-3 rounded-tarjeta bg-superficie p-4">
      {simulado ? (
        <>
          <p className="max-w-[65ch] text-tinta-media">
            Simulación: con el sistema de pagos conectado, acá aparece{" "}
            {cobro.medio === "qr" ? "el QR para que lo escanee" : "el link para mandarle"}.
            Hacé de cuenta que el medio de pago avisó:
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Boton variante="neutro" icono="listo" onClick={() => datos.simularPago(cobro.id, "pagado")}>
              Simular que pagó
            </Boton>
            <Boton variante="plano" icono="reloj" onClick={() => datos.simularPago(cobro.id, "vencido")}>
              Simular que venció
            </Boton>
          </div>
        </>
      ) : cobro.medio === "qr" ? (
        cobro.qr_imagen ? (
          <div>
            <p className="mb-2 font-bold text-cuerpo">Mostrale este QR para que pague</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cobro.qr_imagen}
              alt={`QR para pagar ${pesos(Number(cobro.monto))}`}
              className="size-56 rounded-campo bg-white p-2"
            />
          </div>
        ) : (
          <p className="text-tinta-media">El QR todavía no llegó del medio de pago. Esperá unos segundos.</p>
        )
      ) : cobro.link ? (
        <>
          <p className="mb-1 font-bold text-cuerpo">El link para pagar</p>
          <p className="break-all text-tinta-media">{cobro.link}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Boton
              variante="neutro"
              icono="copiar"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(cobro.link);
                  datos.avisarExito("Copiamos el link. Pegalo donde quieras mandarlo.");
                } catch {
                  datos.avisarExito("No pudimos copiarlo solo. Seleccionalo y copialo a mano.");
                }
              }}
            >
              Copiar el link
            </Boton>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 font-bold text-cuerpo text-tinta hover:bg-superficie"
              >
                <Icono nombre="chat" />
                Mandarlo por WhatsApp
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="text-tinta-media">El link todavía no llegó del medio de pago. Esperá unos segundos.</p>
      )}

      {cobro.vence_en && (
        <p className="mt-3 text-tinta-media">Vence: {cuando(cobro.vence_en)}.</p>
      )}
    </div>
  );
}
