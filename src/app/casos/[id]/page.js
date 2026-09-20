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
import { ESTADOS, estaAbierto, pesos, queFalta, quienLoTieneEnPalabras } from "@/lib/estados";
import { cuando, cuantoHace, haceCuanto } from "@/lib/fechas";
import { queFaltaPara, comoSeIdentifica, ejemplosDe } from "@/lib/presets";
import { cobroValido, montoCobrado } from "@/lib/validaciones";
import {
  linkDeSeguimiento,
  linkDeWhatsApp,
  mensajeDeWhatsApp,
} from "@/lib/seguimiento";
import SelectorEstado from "@/componentes/SelectorEstado";
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

const EVENTOS_A_LA_VISTA = 5;

export default function VerCaso() {
  const { id } = useParams();
  const datos = useDatos();
  const { cargando, casos, clientes, empleados, pasos, eventos, insumos, negocio } = datos;
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario?.rol, "cargarDatos");
  const [eligiendo, setEligiendo] = useState(false);
  // Diagnóstico, identificador del rubro y notas sueltas (SCRUM-50/51/52).
  const [editandoDiag, setEditandoDiag] = useState(false);
  const [diagnostico, setDiagnostico] = useState("");
  const [editandoIdent, setEditandoIdent] = useState(false);
  const [identificador, setIdentificador] = useState("");
  const [anotando, setAnotando] = useState(false);
  const [historialEntero, setHistorialEntero] = useState(false);
  const [nota, setNota] = useState("");
  // Entregar abre el cobro en vez de cerrar de una (SCRUM-74).
  const [entregando, setEntregando] = useState(false);
  const [cobro, setCobro] = useState("");

  const caso = casos.find((c) => c.id === id);
  useTitulo(caso ? `Caso ${caso.numero}` : "Caso");

  if (cargando) return <Cargando />;
  if (!caso) {
    return (
      <Vacio icono="buscar" titulo="No encontramos ese caso">
        Puede que lo hayan borrado. <Link href="/casos" className="font-bold text-azul">Volver a los casos</Link>.
      </Vacio>
    );
  }

  const cliente = clientes.find((c) => c.id === caso.cliente_id);
  const mios = pasos.filter((p) => p.caso_id === caso.id).sort((a, b) => a.orden - b.orden);
  const historial = eventos
    .filter((e) => e.caso_id === caso.id)
    .sort((a, b) => new Date(b.ocurrido_en) - new Date(a.ocurrido_en));
  const insumosDelCaso = insumos.filter((i) => i.caso_id === caso.id);

  const aprobado = mios.filter((p) => p.estado === "aprobado").reduce((s, p) => s + Number(p.monto), 0);
  const esperando = mios.filter((p) => p.estado === "esperando");
  const barra = ESTADOS[caso.estado].barra;
  const comoIdent = comoSeIdentifica(negocio?.rubro);
  const falta = queFalta(caso, { rubro: negocio?.rubro, pasos, insumos, cliente });
  const aprobados = mios.filter((p) => p.estado === "aprobado");

  // Un caso cerrado es el registro de lo que pasó, no un borrador: no se le
  // cambian el diagnóstico ni los pasos sin volver a abrirlo primero. No queda
  // nada trabado, porque volver a abrirlo está a un toque acá abajo.
  const abierto = estaAbierto(caso);
  const sePuedeEditar = puedeCargar && abierto;

  return (
    <>
      <Link href="/casos" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
        <Icono nombre="volver" />
        Volver a los casos
      </Link>

      {/* Lo importante, sin scrollear: identificador, estado y qué falta.

          La tarjeta NO lleva overflow-hidden: el desplegable del estado sale
          de sus bordes y quedaba cortado al medio. El recorte estaba sólo
          para que la barra de color respetara las esquinas, así que la barra
          se redondea sola y el problema desaparece de raíz —si no, cualquier
          menú que se abra acá adentro vuelve a cortarse. */}
      <div className="rounded-tarjeta border border-borde bg-tarjeta">
        <div className={`h-1.5 w-full rounded-t-tarjeta ${barra}`} aria-hidden="true" />
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-ident">
                Caso {caso.numero}
                {caso.identificador && (
                  <span className="text-tinta-media"> · {caso.identificador}</span>
                )}
              </h1>
              <p className="mt-1 text-tinta-media">
                {caso.servicio}
                {cliente && ` · ${cliente.nombre}`}
              </p>
            </div>
            {/* El estado se cambia donde se lee. Antes había que leerlo acá
                arriba, bajar hasta "Cómo sigue" y buscar cuál de tres botones
                correspondía; ahora se toca el chip y se elige.

                Sólo mueve el caso entre los estados abiertos: entregar abre
                el formulario de cobro y tiene su botón, y de un caso cerrado
                se sale por "Volver a abrirlo". */}
            <SelectorEstado
              estado={caso.estado}
              rubro={negocio?.rubro}
              sePuedeCambiar={sePuedeEditar}
              alElegir={(nuevo, dice) =>
                datos.cambiarEstado(
                  caso.id,
                  nuevo,
                  queFaltaPara(negocio?.rubro, nuevo),
                  dice
                )
              }
            />
          </div>

          <p className="mt-4 text-cuerpo">
            {/* Derivado de los pasos y los insumos, no de lo guardado: así
                dice el próximo paso y no repite el chip de arriba. Se fue
                también la aclaración entre paréntesis del rubro: con un texto
                específico pasó a ser ruido, y en control final las dos salían
                del mismo lugar y se leía "Control antes de entregar (Control
                antes de entregar)". */}
            <span className="font-bold">Qué falta:</span> {falta}
          </p>

          {/* Cada dato dice qué es con palabras, y el ícono acompaña. Antes
              la palabra estaba sólo para el lector de pantalla: un ícono de
              persona al lado de "Diego" no decía si Diego era el cliente o
              quien hace el trabajo (auditoría, H2; cartilla: ícono y palabra
              juntos). */}
          <ul className="mt-4 grid gap-2 text-tinta-media @3xl:grid-cols-3">
            {/* Asignar no es un cambio de estado, así que no va en el
                desplegable: va acá, al lado de a quién reemplaza. */}
            <li className="flex flex-wrap items-center gap-2">
              <Icono nombre="persona" className="size-5" />
              <span>{quienLoTieneEnPalabras(caso, empleados)}</span>
              {sePuedeEditar && (
                <div className="relative">
                  <Boton
                    variante="plano"
                    icono="persona-mas"
                    onClick={() => setEligiendo((v) => !v)}
                  >
                    {caso.responsable_id ? "Cambiar" : "Asignar"}
                  </Boton>
                  {eligiendo && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {empleados.map((e) => (
                        <li key={e.id}>
                          <Boton
                            variante="plano"
                            icono="persona"
                            onClick={() => {
                              datos.asignarResponsable(caso.id, e.id);
                              setEligiendo(false);
                            }}
                          >
                            {e.nombre}
                          </Boton>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
            <li className="flex items-center gap-2">
              <Icono nombre="reloj" className="size-5" />
              <span>{haceCuanto(caso.abierto_en)}</span>
            </li>
            {/* El teléfono es lo único de esta lista que se toca, y llamar
                al cliente es lo que se hace apurado y con una mano. Como
                enlace suelto en medio del renglón medía 26 px de alto: la
                cartilla pide 48, así que el área táctil es todo el renglón y
                no sólo los dígitos. */}
            {cliente?.telefono && (
              <li>
                <a
                  href={`tel:${cliente.telefono.replace(/\s/g, "")}`}
                  className="-mx-2 inline-flex min-h-12 items-center gap-2 rounded-campo px-2 hover:bg-azul-claro"
                >
                  <Icono nombre="telefono" className="size-5 text-azul" />
                  <span className="text-tinta-media">
                    Teléfono <span className="font-bold text-azul">{cliente.telefono}</span>
                  </span>
                </a>
              </li>
            )}
          </ul>

          {/* El identificador —la patente, el DNI, el número de serie— es
              cómo se reconoce el caso, no un diagnóstico: vive acá arriba, al
              lado del número, y se carga y se corrige acá. Antes estaba bajo
              un título que habla de lo que se encontró al revisar, y había
              que acordarse de dónde estaba (auditoría, H2). */}
          {editandoIdent && sePuedeEditar ? (
            <div className="mt-4 max-w-[320px]">
              <Campo
                id="identificador"
                etiqueta={comoIdent.nombre}
                ayuda={`Con esto lo vas a poder buscar después. Ejemplo: ${comoIdent.ejemplo}.`}
                autoComplete="off"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <Boton
                  icono="check"
                  motivo={!identificador.trim() ? `falta ${comoIdent.enFrase}` : null}
                  onClick={() => {
                    datos.ponerIdentificador(caso.id, identificador.trim());
                    // "Cambiamos" y no "quedó corregida": el artículo de
                    // enFrase cambia con el rubro y el adjetivo no concuerda
                    // ("corregida la patente", pero "corregido el DNI").
                    datos.avisarExito(
                      caso.identificador
                        ? `Listo. Cambiamos ${comoIdent.enFrase} del caso ${caso.numero}.`
                        : `Listo. El caso ${caso.numero} ya tiene ${comoIdent.enFrase}.`
                    );
                    setEditandoIdent(false);
                  }}
                >
                  Guardar
                </Boton>
                <Boton variante="plano" onClick={() => setEditandoIdent(false)}>
                  Dejarlo
                </Boton>
              </div>
            </div>
          ) : (
            sePuedeEditar && (
              <div className="mt-2">
                <Boton
                  variante="plano"
                  icono="nota"
                  onClick={() => {
                    setIdentificador(caso.identificador ?? "");
                    setEditandoIdent(true);
                  }}
                >
                  {caso.identificador
                    ? `Corregir ${comoIdent.enFrase}`
                    : `Cargar ${comoIdent.enFrase}`}
                </Boton>
              </div>
            )
          )}

          {/* Un único botón azul: el que casi siempre se va a tocar.
              Aparece siempre, también sin pasos: si no, a un caso recién
              abierto no habría por dónde armarle el presupuesto. */}
          <Link href={`/casos/${caso.id}/pasos`} className="mt-6 block sm:inline-block">
            <span className="flex min-h-14 items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado sm:min-h-12">
              <Icono nombre="nota" />
              {esperando.length > 0 && abierto
                ? `Ver ${esperando.length === 1 ? "el paso" : `los ${esperando.length} pasos`} a aprobar`
                : mios.length > 0
                  ? "Ver los pasos del caso"
                  : sePuedeEditar
                    ? "Armar el presupuesto"
                    : "Ver el presupuesto"}
            </span>
          </Link>

          {/* Lo que el cliente ya aprobó, que es la lista de trabajo del
              técnico. Estaba un toque más adentro, en la pantalla de los
              pasos, y es lo primero que se viene a mirar. */}
          {aprobados.length > 0 && (
            <div className="mt-6">
              <p className="font-bold text-cuerpo">
                Lo que hay que hacer{" "}
                <span className="font-normal text-apoyo text-tinta-suave">
                  {aprobados.length} {aprobados.length === 1 ? "paso aprobado" : "pasos aprobados"}
                </span>
              </p>
              <ul className="mt-2 divide-y divide-borde rounded-campo border border-borde">
                {aprobados.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-4 px-4 py-3">
                    <span className="flex min-w-0 items-start gap-2">
                      <Icono nombre="listo" className="size-5 shrink-0 text-completo" />
                      <span className="min-w-0">
                        <span className="block font-bold">{p.nombre}</span>
                        {p.descripcion && (
                          <span className="block text-apoyo text-tinta-suave">
                            {p.descripcion}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">{pesos(p.monto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mios.length > 0 && (
            <p className="mt-3 text-tinta-media">
              Aprobado hasta ahora <span className="font-bold text-tinta">{pesos(aprobado)}</span>.
            </p>
          )}

          {/* Se compara con != null y no con un if a secas: cobrar cero es un
              dato, y `0` a secas se leería como "no hay nada que mostrar".
              El Number() es porque la base devuelve numeric como texto. */}
          {caso.cobrado != null && (
            <p className="mt-1 text-tinta-media">
              Cobrado{" "}
              <span className="font-bold text-tinta">{pesos(Number(caso.cobrado))}</span>
              {/* La guarda va sobre la fecha y no sobre cuando(): cuando(null)
                  devuelve el 1 de enero de 1970 y cuando(undefined) explota. */}
              {caso.cobrado_en ? ` · ${cuando(caso.cobrado_en)}` : ""}
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
      {abierto && insumosDelCaso.some((i) => i.estado !== "en_stock") && (
        <div className="mt-12 flex flex-wrap items-start gap-3">
          {insumosDelCaso
            .filter((i) => i.estado !== "en_stock")
            .map((i) => (
              <Boton key={i.id} icono="camion" onClick={() => datos.marcarInsumoLlegado(i.id)}>
                Marcar que llegó {i.nombre.toLowerCase()}
              </Boton>
            ))}
        </div>
      )}

      {abierto && (
        <div className="mt-8 border-t border-borde pt-6">
          <h3 className="text-subtitulo font-bold">Terminar el caso</h3>

          {/* Cerrar se puede desde cualquier estado abierto, no sólo después
              del control final: un trabajo puede terminarse antes de lo
              previsto —el cliente lo pasa a buscar, no tenía nada— y obligar
              a caminar toda la cadena para reflejarlo sería mentirle al
              estado. El botón dice lo que hace: entrega Y cierra (cartilla,
              sección 06). Va destacado sólo cuando es lo que sigue. */}
          {!entregando && (
            <div className="mt-3">
              <Boton
                variante={caso.estado === "revision_final" ? "borde" : "plano"}
                icono="listo"
                onClick={() => {
                  // Viene precargado con lo que el cliente aprobó, que es lo
                  // que casi siempre se cobra. Si cobró otra cosa, lo pisa y
                  // listo: escribir el número de nuevo es más trabajo que
                  // corregirlo.
                  setCobro(aprobado > 0 ? String(aprobado) : "");
                  setEntregando(true);
                }}
              >
                Entregar y cerrar
              </Boton>
            </div>
          )}

          {/* El cobro se registra acá y no en una pantalla aparte: entregar y
              cobrar son un solo momento en el mostrador, y es el único en que
              alguien tiene el número delante. Se puede entregar sin
              registrarlo —una garantía, algo que se cobró por afuera—, y por
              eso el campo vacío también cierra el caso. */}
          {entregando && (
            <Tarjeta className="mt-3 w-full">
              <Campo
                id="cobro"
                etiqueta="¿Cuánto cobraste?"
                ayuda="Con números y sin puntos. Si no cobrás acá, dejalo vacío: el caso se entrega igual."
                ejemplo="120000"
                error={!cobroValido(cobro) ? "El monto va con números y sin puntos." : null}
                inputMode="numeric"
                value={cobro}
                onChange={(e) => setCobro(e.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <Boton
                  icono="listo"
                  motivo={!cobroValido(cobro) ? "revisá el monto" : null}
                  onClick={() => {
                    const monto = montoCobrado(cobro);
                    datos.cambiarEstado(
                      caso.id,
                      "completado",
                      queFaltaPara(negocio?.rubro, "completado"),
                      {
                        titulo: "Entregaron el trabajo",
                        detalle:
                          monto === null
                            ? "El caso queda cerrado."
                            : `El caso queda cerrado. Cobraron ${pesos(monto)}.`,
                        icono: "listo",
                      },
                      { cobrado: monto, cobrado_en: monto === null ? null : new Date().toISOString() }
                    );
                    datos.avisarExito(
                      monto === null
                        ? `Listo. El caso ${caso.numero} quedó entregado.`
                        : `Listo. El caso ${caso.numero} quedó entregado y cobrado.`
                    );
                    setEntregando(false);
                  }}
                >
                  Entregar y cerrar
                </Boton>
                <Boton variante="plano" onClick={() => setEntregando(false)}>
                  Mejor no
                </Boton>
              </div>
            </Tarjeta>
          )}
        </div>
      )}

      {caso.estado === "completado" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="w-full max-w-[65ch] text-tinta-media">
            Este caso ya se entregó y se cerró. Mientras siga cerrado no se le
            cambian los pasos ni el diagnóstico.
          </p>
          {/* Nada es definitivo: se puede haber cerrado de más. */}
          <Boton
            variante="plano"
            icono="deshacer"
            onClick={() =>
              datos.cambiarEstado(
                caso.id,
                "en_proceso",
                queFaltaPara(negocio?.rubro, "en_proceso"),
                {
                  titulo: "Volvieron a abrir el caso",
                  detalle: "Se había cerrado antes de tiempo.",
                  icono: "deshacer",
                }
              )
            }
          >
            Volver a abrirlo
          </Boton>
        </div>
      )}

      {/* La respuesta a "¿cómo va lo mío?" sin que nadie atienda el
          teléfono (SCRUM-68). Va acá, entre las acciones y los datos: es una
          acción sobre el caso, no un dato del caso. */}
      {puedeCargar && (
        <CompartirConElCliente
          caso={caso}
          cliente={cliente}
          negocio={negocio}
          datos={datos}
          porContestar={esperando.length}
        />
      )}

      {/* El historial cuenta la historia: qué pasó, cuándo y quién lo hizo. */}
      {/* Lo que pidió el cliente está arriba en "servicio". Acá va lo que
          encontramos al revisar, que es otra cosa. */}
      <TituloSeccion className="mt-12">El diagnóstico</TituloSeccion>
      <Tarjeta>
        {!abierto && puedeCargar && (
          <p className="mb-4 max-w-[65ch] text-tinta-media">
            El caso está cerrado, así que esto queda como quedó. Si hay algo que
            corregir, volvé a abrirlo arriba y cerralo de nuevo después.
          </p>
        )}
        <p className="font-bold text-cuerpo">Qué encontramos</p>
        {editandoDiag && sePuedeEditar ? (
          <div className="mt-2">
            <label htmlFor="diagnostico" className="sr-only">
              Qué encontramos
            </label>
            <p className="mt-1 mb-2 text-apoyo text-tinta-suave">
              Con tus palabras, como se lo explicarías al cliente.
            </p>
            <textarea
              id="diagnostico"
              rows={4}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder={ejemplosDe(negocio?.rubro).diagnostico}
              className="block w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta p-4 text-cuerpo placeholder:text-tinta-suave"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <Boton
                icono="check"
                motivo={!diagnostico.trim() ? "falta escribir qué encontraron" : null}
                onClick={() => {
                  datos.cargarDiagnostico(caso.id, diagnostico.trim());
                  datos.avisarExito(`Listo. El diagnóstico del caso ${caso.numero} quedó anotado.`);
                  setEditandoDiag(false);
                }}
              >
                Guardar el diagnóstico
              </Boton>
              <Boton variante="plano" onClick={() => setEditandoDiag(false)}>
                Dejarlo
              </Boton>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <p className="max-w-[65ch] text-tinta-media">
              {caso.diagnostico || "Todavía nadie escribió qué se encontró al revisar."}
            </p>
            {sePuedeEditar && (
              <div className="mt-2">
                <Boton
                  variante="plano"
                  icono="diagnostico"
                  onClick={() => {
                    setDiagnostico(caso.diagnostico ?? "");
                    setEditandoDiag(true);
                  }}
                >
                  {caso.diagnostico ? "Corregir el diagnóstico" : "Cargar el diagnóstico"}
                </Boton>
              </div>
            )}
          </div>
        )}
      </Tarjeta>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <TituloSeccion className="mb-0">Lo que pasó con este caso</TituloSeccion>
        {puedeCargar && (
          <Boton icono="nota" onClick={() => setAnotando((v) => !v)}>
            {anotando ? "Cerrar" : "Anotar algo"}
          </Boton>
        )}
      </div>

      {/* Una nota suelta se agrega al historial: no pisa nada de lo anterior. */}
      {anotando && puedeCargar && (
        <Tarjeta className="mb-4">
          <label htmlFor="nota" className="block font-bold text-cuerpo">
            Qué querés dejar anotado
          </label>
          <p className="mt-1 mb-2 text-apoyo text-tinta-suave">
            Queda en el historial con la fecha. No borra ni cambia lo de antes.
          </p>
          <textarea
            id="nota"
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="La clienta avisó que lo pasa a buscar el martes."
            className="block w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta p-4 text-cuerpo placeholder:text-tinta-suave"
          />
          <div className="mt-3">
            <Boton
              icono="check"
              motivo={!nota.trim() ? "falta escribir la nota" : null}
              onClick={() => {
                datos.anotarNota(caso.id, nota.trim());
                datos.avisarExito("Listo, quedó anotado en el historial.");
                setNota("");
                setAnotando(false);
              }}
            >
              Anotarlo
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
                {cuando(e.ocurrido_en)} · {e.autor}
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
              ? "Mostrar sólo lo último"
              : `Ver todo lo que pasó (${historial.length})`}
          </Boton>
        </div>
      )}
    </>
  );
}

// Compartir el estado con el cliente (SCRUM-68).
//
// Un link por caso. Se arma de una: nadie va a usar esto si primero hay que
// configurar algo, con el cliente esperando del otro lado del teléfono.
//
// Tocar "Compartir" dos veces devuelve el mismo link. Uno nuevo cada vez
// dejaría muerto el que el negocio ya mandó por WhatsApp, y el cliente se
// quedaría mirando una pantalla que le dice que su link no sirve.
function CompartirConElCliente({ caso, cliente, negocio, datos, porContestar = 0 }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [cortando, setCortando] = useState(false);
  // El origen sale del navegador y no de una constante: así el link anda
  // igual en localhost, en la compu de al lado y el día que esto se publique.
  // Se lee en un efecto porque en el servidor no hay window.
  const [origen, setOrigen] = useState("");
  const campo = useRef(null);

  useEffect(() => setOrigen(window.location.origin), []);

  const codigo = caso.seguimiento_codigo ?? null;
  const link = codigo && origen ? linkDeSeguimiento(origen, codigo) : "";

  async function compartir() {
    setError(null);
    setGenerando(true);
    const r = await datos.compartirCaso(caso.id);
    setGenerando(false);
    if (!r.ok) return setError(r.error);
    datos.avisarExito("Listo. El link ya anda: copialo o mandalo por WhatsApp.");
  }

  async function cortar() {
    setError(null);
    setCortando(false);
    const r = await datos.dejarDeCompartirCaso(caso.id);
    if (!r.ok) return setError(r.error);
    datos.avisarExito("Listo. Ese link dejó de funcionar.");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      datos.avisarExito("Copiamos el link. Pegalo donde lo quieras mandar.");
    } catch {
      // Sin permiso para el portapapeles queda seleccionado, que es lo que
      // hace falta para copiarlo a mano. Decir "no se pudo" y nada más
      // dejaría a la persona sin salida.
      campo.current?.select();
      datos.avisarExito("Quedó seleccionado. Copialo con Ctrl+C.");
    }
  }

  return (
    <>
      <TituloSeccion className="mt-12">Contarle al cliente cómo va</TituloSeccion>
      <Tarjeta>
        {error && <ErrorGeneral>{error}</ErrorGeneral>}

        {!codigo ? (
          <>
            <p className="max-w-[65ch] text-tinta-media">
              Le mandás un link y mira solo en qué estado está lo suyo, sin llamar y sin
              instalar nada. Ve el estado, por dónde va y lo que aprobó.
            </p>
            <p className="mt-2 max-w-[65ch] text-tinta-media">
              <span className="font-bold text-tinta">
                Y puede aprobar o rechazar desde ahí los pasos que esperan respuesta.
              </span>{" "}
              Lo que aprueba queda aprobado, igual que si lo cargaras vos, y el historial
              dice que lo contestó él. No ve el diagnóstico, ni las notas internas, ni
              quién lo está atendiendo.
            </p>
            <div className="mt-4">
              <Boton
                icono="sobre"
                motivo={generando ? "armando el link" : null}
                onClick={compartir}
              >
                Armar el link para {cliente?.nombre?.split(" ")[0] ?? "el cliente"}
              </Boton>
            </div>
          </>
        ) : (
          <>
            <Campo
              id="link-seguimiento"
              etiqueta="El link del cliente"
              ayuda="Es el mismo siempre. Podés mandarlo las veces que quieras."
              value={link}
              readOnly
              ref={campo}
              onFocus={(ev) => ev.target.select()}
            />

            <div className="-mt-2 flex flex-wrap gap-3">
              <Boton icono="copiar" onClick={copiar}>
                Copiar el link
              </Boton>
              {/* wa.me es un link común: abre WhatsApp con el mensaje ya
                  escrito, sin integración y sin servidor. Sin número, porque
                  el que lo toca es el negocio y elige a quién mandárselo
                  desde su propia agenda. */}
              <a
                href={linkDeWhatsApp(
                  mensajeDeWhatsApp({
                    negocioNombre: negocio?.nombre ?? "tu negocio",
                    identificador: caso.identificador,
                    servicio: caso.servicio,
                    link,
                  })
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 font-bold text-cuerpo text-tinta hover:bg-superficie"
              >
                <Icono nombre="sobre" />
                Mandarlo por WhatsApp
              </a>
            </div>

            {/* Qué puede hacer con el link que tiene. Si hay pasos esperando,
                los puede contestar desde ahí, y eso cambia si conviene
                llamarlo o esperar. */}
            {porContestar > 0 && (
              <p className="mt-4 flex items-start gap-2 text-tinta-media">
                <Icono nombre="nota" className="mt-0.5 size-5 shrink-0" />
                <span>
                  Desde el link puede contestar{" "}
                  <span className="font-bold text-tinta">
                    {porContestar === 1 ? "el paso" : `los ${porContestar} pasos`}
                  </span>{" "}
                  que {porContestar === 1 ? "espera" : "esperan"} su respuesta.
                </span>
              </p>
            )}

            {/* Si lo abrió alguna vez, cuándo fue la última. Es lo que dice
                si hace falta llamarlo o si ya se enteró solo. */}
            <p className="mt-4 flex items-start gap-2 text-tinta-media">
              <Icono
                nombre={caso.seguimiento_visto_en ? "listo" : "reloj"}
                className="mt-0.5 size-5 shrink-0"
              />
              <span>
                {caso.seguimiento_visto_en
                  ? `Lo abrió por última vez ${cuantoHace(caso.seguimiento_visto_en)}.`
                  : "Todavía no lo abrió."}
              </span>
            </p>

            {cortando ? (
              <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                <p className="font-bold text-cuerpo">¿Dejar de compartirlo?</p>
                <p className="mt-1 max-w-[65ch] text-tinta-media">
                  El link que ya mandaste deja de funcionar ahora mismo, y el cliente va a
                  ver que no sirve. Podés armar uno nuevo cuando quieras.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Boton variante="peligro" icono="tacho" onClick={cortar}>
                    Sí, dejar de compartirlo
                  </Boton>
                  <Boton variante="plano" onClick={() => setCortando(false)}>
                    Seguir compartiéndolo
                  </Boton>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <Boton variante="plano" icono="tacho" onClick={() => setCortando(true)}>
                  Dejar de compartirlo
                </Boton>
              </div>
            )}
          </>
        )}
      </Tarjeta>
    </>
  );
}
