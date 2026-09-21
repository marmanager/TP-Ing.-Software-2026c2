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
// Acá sólo se anota lo que se cobró en el local —efectivo, transferencia,
// tarjeta—, que nace pagado porque la plata ya está en la mano. El cobro por
// link o QR es la pieza siguiente y pasa por la API de pagos.

import { useState } from "react";
import {
  MEDIOS,
  MEDIOS_DEL_LOCAL,
  cuentaDelCaso,
  estadoDeCobro,
  medioDe,
  montoDeCobroValido,
  montoSugerido,
  sePuedeAnular,
} from "@/lib/cobros";
import { pesos } from "@/lib/estados";
import { cuando } from "@/lib/fechas";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Tarjeta, TituloSeccion } from "@/componentes/ui";

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

export default function SeccionCobros({ caso, aprobado, cobros, descuento, puedeCargar, datos }) {
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

  const cuenta = cuentaDelCaso({ aprobado, cobros, descuento });
  const frase = fraseDeLaCuenta(cuenta);

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

  async function anular(cobro) {
    const r = await datos.anularCobro(cobro.id, motivo.trim() || null);
    if (!r.ok) return setError(r.error);
    datos.avisarExito(`Listo. Anulamos el cobro de ${pesos(Number(cobro.monto))}.`);
    setAnulando(null);
    setMotivo("");
  }

  return (
    <>
      <TituloSeccion className="mt-12">Cobros</TituloSeccion>
      <Tarjeta>
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
                <li key={c.id} className="py-4">
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
                        Anular este cobro
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

        {puedeCargar &&
          (!anotando ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Boton icono="mas" onClick={abrir}>
                Anotar un cobro
              </Boton>
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
