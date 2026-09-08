"use client";

// "Ver cómo va un caso" (cartilla, sección 08).
//
// La abren el encargado y el equipo muchas veces por día, casi siempre desde
// el celular. Identificador, estado y "qué falta" tienen que entrar en la
// primera pantalla, sin scrollear.

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { useTitulo } from "@/lib/useTitulo";
import { ESTADOS, estaAbierto, pesos, quienLoTiene } from "@/lib/estados";
import { cuando, haceCuanto } from "@/lib/fechas";
import { preset, queFaltaPara, comoSeIdentifica } from "@/lib/presets";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

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
  const [nota, setNota] = useState("");

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
  const explica = preset(negocio?.rubro).explica[caso.estado];
  const comoIdent = comoSeIdentifica(negocio?.rubro);

  // Un caso cerrado es el registro de lo que pasó, no un borrador: no se le
  // cambian el diagnóstico ni los pasos sin volver a abrirlo primero. No queda
  // nada trabado, porque volver a abrirlo está a un toque acá abajo.
  const abierto = estaAbierto(caso);
  const sePuedeEditar = puedeCargar && abierto;

  return (
    <>
      <Link href="/" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
        <Icono nombre="volver" />
        Volver a los casos
      </Link>

      {/* Lo importante, sin scrollear: identificador, estado y qué falta. */}
      <div className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
        <div className={`h-1.5 w-full ${barra}`} aria-hidden="true" />
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-ident">Caso {caso.numero}</h1>
              <p className="mt-1 text-tinta-media">
                {caso.servicio}
                {cliente && ` · ${cliente.nombre}`}
              </p>
            </div>
            <ChipEstado estado={caso.estado} />
          </div>

          <p className="mt-4 text-cuerpo">
            <span className="font-bold">Qué falta:</span> {caso.que_falta}
            {explica && <span className="text-tinta-media"> ({explica})</span>}
          </p>

          <dl className="mt-4 grid gap-2 text-tinta-media sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Icono nombre="persona" className="size-5" />
              <dt className="sr-only">Quién lo tiene</dt>
              <dd>{quienLoTiene(caso, empleados)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Icono nombre="reloj" className="size-5" />
              <dt className="sr-only">Desde cuándo</dt>
              <dd>{haceCuanto(caso.abierto_en)}</dd>
            </div>
            {cliente?.telefono && (
              <div className="flex items-center gap-2">
                <Icono nombre="telefono" className="size-5" />
                <dt className="sr-only">Teléfono</dt>
                <dd>
                  <a href={`tel:${cliente.telefono.replace(/\s/g, "")}`} className="text-azul">
                    {cliente.telefono}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {/* Un único botón azul: el que casi siempre se va a tocar.
              Aparece siempre, también sin pasos: si no, a un caso recién
              abierto no habría por dónde armarle el presupuesto. */}
          <Link href={`/casos/${caso.id}/pasos`} className="mt-6 block sm:inline-block">
            <span className="flex min-h-14 items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado sm:min-h-12">
              <Icono nombre="nota" />
              {esperando.length > 0 && abierto
                ? `Ver los ${esperando.length} pasos a aprobar`
                : mios.length > 0
                  ? "Ver los pasos del caso"
                  : sePuedeEditar
                    ? "Armar el presupuesto"
                    : "Ver el presupuesto"}
            </span>
          </Link>

          {mios.length > 0 && (
            <p className="mt-3 text-tinta-media">
              Aprobado hasta ahora <span className="font-bold text-tinta">{pesos(aprobado)}</span>.
            </p>
          )}
        </div>
      </div>

      {/* Hacer avanzar el caso. Los estados son un ciclo de vida, no adorno. */}
      <TituloSeccion className="mt-12">Cómo sigue</TituloSeccion>
      <div className="flex flex-wrap gap-3">
        {caso.estado === "nuevo" && (
          <div className="relative">
            <Boton icono="persona-mas" onClick={() => setEligiendo((v) => !v)}>
              Asignar responsable
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

        {caso.estado === "en_proceso" && (
          <Boton
            icono="reloj"
            onClick={() =>
              datos.cambiarEstado(caso.id, "esperando", "Espera respuesta del cliente", {
                titulo: "Quedó esperando",
                detalle: "Falta que el cliente conteste.",
                icono: "reloj",
              })
            }
          >
            Marcar que espera al cliente
          </Boton>
        )}

        {caso.estado === "en_proceso" && (
          <Boton
            icono="listo"
            onClick={() =>
              datos.cambiarEstado(caso.id, "revision_final", queFaltaPara(negocio?.rubro, "revision_final"), {
                titulo: "Terminó el trabajo",
                detalle: "Pasa al control final.",
                icono: "nota",
              })
            }
          >
            Marcar el trabajo terminado
          </Boton>
        )}

        {caso.estado === "esperando" &&
          insumosDelCaso
            .filter((i) => i.estado !== "en_stock")
            .map((i) => (
              <Boton key={i.id} icono="camion" onClick={() => datos.marcarInsumoLlegado(i.id)}>
                Marcar que llegó {i.nombre.toLowerCase()}
              </Boton>
            ))}

        {caso.estado === "esperando" && (
          <Boton
            icono="llave"
            onClick={() =>
              datos.cambiarEstado(caso.id, "en_proceso", queFaltaPara(negocio?.rubro, "en_proceso"), {
                titulo: "Volvió al trabajo",
                detalle: "Se destrabó lo que estaba esperando.",
                icono: "llave",
              })
            }
          >
            Retomar el trabajo
          </Boton>
        )}

        {/* Cerrar se puede desde cualquier estado abierto, no sólo después
            del control final: un trabajo puede terminarse antes de lo
            previsto —el cliente lo pasa a buscar, no tenía nada— y obligar a
            caminar toda la cadena para reflejarlo sería mentirle al estado.
            El botón dice lo que hace: entrega Y cierra (cartilla, sección 06). */}
        {caso.estado !== "completado" && (
          <Boton
            icono="listo"
            onClick={() =>
              datos.cambiarEstado(
                caso.id,
                "completado",
                queFaltaPara(negocio?.rubro, "completado"),
                {
                  titulo: "Entregaron el trabajo",
                  detalle: "El caso queda cerrado.",
                  icono: "listo",
                }
              )
            }
          >
            Entregar y cerrar
          </Boton>
        )}

        {caso.estado === "completado" && (
          <>
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
          </>
        )}
      </div>

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
        <p className="font-bold text-cuerpo">{comoIdent.nombre}</p>
        {editandoIdent && sePuedeEditar ? (
          <div className="mt-2 max-w-[320px]">
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
                  datos.avisarExito(
                    `Listo. El caso ${caso.numero} ya tiene ${comoIdent.enFrase}.`
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
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="text-tinta-media">
              {caso.identificador ||
                `Todavía no cargaron ${comoIdent.enFrase}.`}
            </p>
            {sePuedeEditar && (
              <Boton
                variante="plano"
                icono="nota"
                onClick={() => {
                  setIdentificador(caso.identificador ?? "");
                  setEditandoIdent(true);
                }}
              >
                {caso.identificador
                  ? "Cambiarlo"
                  : `Cargar ${comoIdent.enFrase}`}
              </Boton>
            )}
          </div>
        )}

        <p className="mt-6 font-bold text-cuerpo">Qué encontramos</p>
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
              placeholder="La correa está flojo y las pastillas al límite."
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

      <ol className="flex flex-col gap-6">
        {historial.map((e) => (
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
    </>
  );
}
