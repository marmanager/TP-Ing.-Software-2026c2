"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede } from "@/lib/permisos";
import { estaAbierto } from "@/lib/estados";
import { estadoDeTurno } from "@/lib/turnos";
import { diaLargo, horaYMinutos } from "@/lib/fechas";
import { casoEnFrase } from "@/lib/nombres";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "@/componentes/Icono";
import AltaDeTurno from "@/componentes/AltaDeTurno";
import AvisoDelTurno from "@/componentes/AvisoDelTurno";
import MoverTurno from "@/componentes/MoverTurno";
import Pestanas from "@/componentes/Pestanas";
import { Boton, Cargando, TituloSeccion, Vacio } from "@/componentes/ui";

export default function Agenda() {
  const datos = useDatos();
  const { locale, t: tr } = useIdioma();
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario, "manejar_turnos");
  const { cargando, turnos, clientes, casos } = datos;
  const [abierto, setAbierto] = useState(false);
  // El turno que se está por cancelar, esperando la confirmación.
  const [cancelando, setCancelando] = useState(null);
  // La agenda mira para adelante. Los que ya pasaron se piden aparte: sirven
  // para saber si alguien faltó la semana pasada (auditoría, H7).
  const [cuando, setCuando] = useState("proximos");
  // El turno al que se le está cambiando la hora.
  const [moviendo, setMoviendo] = useState(null);
  useTitulo(tr("agenda.titulo"));

  // Si el recordatorio de turnos está prendido (R-4b): sólo entonces tiene
  // sentido señalar el turno que no lo va a recibir.
  const [recordatorioActivo, setRecordatorioActivo] = useState(false);
  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = datos.negocio?.id;
  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    acciones.current.consultarSeguimiento().then((r) => {
      if (vivo && r.ok) setRecordatorioActivo(Boolean(r.configuracion.turno?.activo));
    });
    return () => { vivo = false; };
  }, [negocioId]);

  if (cargando) return <Cargando />;
  const ahora = Date.now();

  const arrancaHoy = new Date(new Date().toDateString());
  const proximos =
    cuando === "pasados"
      ? turnos
          .filter((t) => new Date(t.empieza_en) < arrancaHoy)
          // Los pasados, del más reciente al más viejo: lo de ayer importa
          // más que lo del mes pasado.
          .sort((a, b) => new Date(b.empieza_en) - new Date(a.empieza_en))
      : turnos
          .filter((t) => new Date(t.empieza_en) >= arrancaHoy)
          .sort((a, b) => new Date(a.empieza_en) - new Date(b.empieza_en));

  // Agrupados por día, para leer la semana de un vistazo. Como "proximos" ya
  // viene ordenado —para adelante, o para atrás si se miran los pasados—, los
  // días salen en ese mismo orden.
  const porDia = proximos.reduce((acc, t) => {
    const clave = new Date(t.empieza_en).toDateString();
    (acc[clave] ??= []).push(t);
    return acc;
  }, {});

  return (
    <>
      <Pestanas padre="agenda" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">{tr("agenda.titulo")}</h1>
          <p className="mt-1 text-tinta-media">{tr("agenda.subtitulo")}</p>
        </div>
        {/* Mientras hay un alta abierta el botón se apaga en vez de cambiar
            de texto: queda en el mismo lugar, en gris, diciendo por qué no se
            puede (cartilla: un botón apagado dice por qué). Así no se abren
            dos altas, y el lugar de "Anotar un turno" siempre hace lo mismo.
            Salir del alta es "Cancelar", abajo del formulario. */}
        {puedeCargar && (
          <Boton
            icono="mas"
            motivo={abierto ? tr("agenda.anotando") : null}
            onClick={() => setAbierto(true)}
            data-testid="agenda-anotar"
          >
            {tr("agenda.anotar")}
          </Boton>
        )}
      </div>

      {abierto && puedeCargar && (
        <AltaDeTurno
          className="mb-8"
          alGuardar={() => setAbierto(false)}
          alCancelar={() => setAbierto(false)}
        />
      )}

      {/* La agenda mira para adelante; los que ya pasaron se piden. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ["proximos", tr("agenda.proximos")],
          ["pasados", tr("agenda.pasados")],
        ].map(([clave, palabra]) => (
          <button
            key={clave}
            type="button"
            aria-pressed={cuando === clave}
            onClick={() => setCuando(clave)}
            className={[
              "min-h-12 cursor-pointer rounded-full border-2 px-4 text-etiqueta",
              cuando === clave
                ? "border-azul bg-azul-claro font-bold text-azul"
                : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
            ].join(" ")}
          >
            {palabra}
          </button>
        ))}
      </div>

      {proximos.length === 0 ? (
        <Vacio icono="calendario" titulo={tr("agenda.vacio.titulo")}>
          {cuando === "pasados" ? tr("agenda.vacio.pasados") : tr("agenda.vacio.proximos")}
        </Vacio>
      ) : (
        Object.entries(porDia).map(([clave, delDia]) => (
          <section key={clave} className="mb-10">
            <TituloSeccion className="first-letter:uppercase">
              {diaLargo(delDia[0].empieza_en, locale, tr)}
            </TituloSeccion>
            <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
              {delDia.map((t) => {
                const cliente = clientes.find((c) => c.id === t.cliente_id);
                const caso = casos.find((c) => c.id === t.caso_id);
                const cancelado = t.estado === "cancelado";
                // El caso abierto que ya tiene esta persona, si tiene alguno:
                // entonces el turno es para retirarlo o seguirlo, no para
                // abrir uno nuevo.
                const suCaso =
                  t.cliente_id &&
                  casos.find((c) => c.cliente_id === t.cliente_id && estaAbierto(c));
                return (
                  // En celular es una grilla de dos columnas: arriba la hora y
                  // el estado en una sola línea, debajo el texto a todo el
                  // ancho y al final las acciones. Con el flex de antes el
                  // texto (flex-1) se achicaba hasta quedar una palabra por
                  // línea. Desde sm vuelve la fila horizontal de siempre.
                  // Todos los hijos llevan order-* porque en una grilla los
                  // que no lo tienen se colocarían antes que los que sí.
                  <li
                    key={t.id}
                    data-turno={t.id}
                    className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2 border-b border-borde p-4 last:border-b-0 sm:flex sm:flex-wrap sm:items-center sm:gap-4"
                  >
                    <p className="order-1 font-titulo font-extrabold text-subtitulo tabular-nums sm:order-none sm:w-20">
                      {horaYMinutos(t.empieza_en, locale)}
                    </p>
                    {/* min-w-0 deja que el texto se encoja en vez de empujar
                        la tarjeta, y overflow-wrap corta lo que no tiene
                        espacios. Desde sm arranca de 16rem y no de 0: con
                        base 0 las acciones nunca bajaban de línea y el texto
                        quedaba de dos letras de ancho, estirado para abajo.
                        Así, si no entra todo, las acciones pasan abajo. */}
                    <div className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1 sm:flex-[1_1_16rem]">
                      <p
                        className={`font-bold [overflow-wrap:anywhere] ${cancelado ? estadoDeTurno("cancelado", tr).texto : ""}`}
                      >
                        {t.motivo}
                      </p>
                      <p className="text-tinta-media [overflow-wrap:anywhere]">
                        {cliente?.nombre ?? tr("agenda.sinCliente")}
                        {/* Un turno que pidió el cliente desde el link no lo
                            vio nadie del negocio todavía: no hubo llamada, no
                            hubo mostrador. Se nota hasta que alguien lo
                            confirma, que es el momento en que deja de ser
                            nuevo (024). */}
                        {t.origen === "cliente" && t.estado === "agendado" && (
                          <>
                            {" · "}
                            <span className="font-bold text-azul">{tr("agenda.pidioPorLink")}</span>
                          </>
                        )}
                        {caso && (
                          <>
                            {" · "}
                            <Link href={`/casos/${caso.id}`} className="text-azul">
                              {casoEnFrase(caso, tr)}
                            </Link>
                          </>
                        )}
                      </p>
                      <AvisoDelTurno
                        turno={t}
                        cliente={cliente}
                        rubro={datos.negocio?.rubro}
                        recordatorioActivo={recordatorioActivo}
                        ahora={ahora}
                      />
                    </div>

                    {/* El estado con su color, su ícono y su palabra, del
                        vocabulario de turnos (lib/turnos.js). */}
                    <p
                      className={`order-2 flex items-center gap-1.5 whitespace-nowrap font-bold text-etiqueta sm:order-none ${estadoDeTurno(t.estado, tr).texto}`}
                    >
                      <Icono nombre={estadoDeTurno(t.estado, tr).icono} className="size-5" />
                      {estadoDeTurno(t.estado, tr).palabra}
                    </p>

                    {/* "Vino" quiere decir dos cosas según el turno, y el
                        sistema lo deduce en vez de preguntarlo: si la persona
                        ya tiene un caso abierto, el turno es para retirarlo o
                        para seguirlo, y no hay que abrir nada; si no tiene
                        ninguno, viene a dejar un trabajo. Así el alta no gana
                        un sexto campo que casi siempre se contestaría igual. */}
                    {/* Cancelar pide confirmación con el nombre y la hora, y
                        después se puede deshacer desde el aviso: antes estaba
                        pegado a "Confirmar", en rojo, y errarle al dedo
                        cancelaba el turno de otra persona sin ninguna red
                        (auditoría, H5). */}
                    {cancelando === t.id && (
                      <div className="order-4 col-span-2 w-full rounded-tarjeta bg-superficie p-4 sm:order-none sm:col-span-1">
                        <p className="font-bold text-cuerpo">
                          {tr("agenda.cancelar.pregunta", {
                            nombre: cliente?.nombre ?? tr("agenda.cancelar.estaPersona"),
                            hora: horaYMinutos(t.empieza_en, locale),
                          })}
                        </p>
                        <p className="mt-1 text-tinta-media">
                          {tr("agenda.cancelar.queda")}
                        </p>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <Boton
                            variante="peligro"
                            icono="cruz"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              const antes = t.estado;
                              datos.cambiarEstadoTurno(t.id, "cancelado");
                              datos.avisarExito(
                                tr("agenda.cancelar.listo", {
                                  nombre: cliente?.nombre ?? tr("agenda.cancelar.esaPersona"),
                                  hora: horaYMinutos(t.empieza_en, locale),
                                }),
                                { deshacer: () => datos.cambiarEstadoTurno(t.id, antes) }
                              );
                              setCancelando(null);
                            }}
                          >
                            {tr("agenda.cancelar.si")}
                          </Boton>
                          <Boton
                            variante="plano"
                            className="w-full sm:w-auto"
                            onClick={() => setCancelando(null)}
                          >
                            {tr("agenda.cancelar.no")}
                          </Boton>
                        </div>
                      </div>
                    )}

                    {/* En celular las acciones van apiladas y a todo el ancho,
                        con 8 px entre una y otra: en una fila de 360 px se
                        partían en cuatro líneas desordenadas y quedaban
                        pegadas (auditoría, Responsive). */}
                    {/* Como el resto de los hijos de la grilla, lleva su
                        order-* para quedar debajo del texto en celular. */}
                    {moviendo === t.id && (
                      <div className="order-4 col-span-2 w-full sm:order-none sm:col-span-1">
                        <MoverTurno turno={t} alTerminar={() => setMoviendo(null)} />
                      </div>
                    )}

                    {!cancelado && t.estado !== "atendido" && cancelando !== t.id && moviendo !== t.id && (
                      <div className="order-4 col-span-2 flex w-full flex-col gap-2 sm:order-none sm:col-span-1 sm:w-auto sm:flex-row sm:flex-wrap">
                        {t.estado === "agendado" && (
                          <Boton
                            icono="check"
                            className="w-full sm:w-auto"
                            onClick={() => datos.cambiarEstadoTurno(t.id, "confirmado")}
                          >
                            {tr("agenda.confirmar")}
                          </Boton>
                        )}

                        {suCaso ? (
                          <Boton
                            icono="persona-check"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              datos.marcarTurnoAtendido(t.id, suCaso.id);
                              datos.avisarExito(
                                tr("agenda.vinoPorCaso", {
                                  nombre: cliente?.nombre ?? tr("agenda.laPersona"),
                                  caso: casoEnFrase(suCaso, tr),
                                })
                              );
                            }}
                          >
                            {tr("agenda.vinoABuscarlo")}
                          </Boton>
                        ) : (
                          <Link href={`/casos/nuevo?turno=${t.id}`}>
                            <span className="flex min-h-12 w-full items-center justify-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-4 font-bold text-azul text-etiqueta hover:bg-azul-claro sm:w-auto sm:justify-start">
                              <Icono nombre="carpeta" />
                              {tr("agenda.vinoAbrirCaso")}
                            </span>
                          </Link>
                        )}

                        {puedeCargar && (
                          <Boton
                            icono="calendario"
                            className="w-full sm:w-auto"
                            data-testid="turno-cambiar-hora"
                            onClick={() => { setCancelando(null); setMoviendo(t.id); }}
                          >
                            {tr("agenda.cambiarHora")}
                          </Boton>
                        )}

                        <Boton
                          variante="peligro"
                          icono="cruz"
                          className="w-full sm:w-auto"
                          onClick={() => setCancelando(t.id)}
                        >
                          {tr("agenda.cancelarTurno")}
                        </Boton>
                      </div>
                    )}

                    {/* Marcar que vino se puede deshacer. El caso
                        que haya salido del turno no se toca: existe por su
                        cuenta y se cierra desde el caso. */}
                    {t.estado === "atendido" && (
                      <Boton
                        variante="plano"
                        icono="deshacer"
                        className="order-4 col-span-2 w-full sm:order-none sm:col-span-1 sm:w-auto"
                        onClick={() => {
                          datos.desmarcarTurnoAtendido(t.id);
                          // Si quedó en pantalla el "queda anotado que vino",
                          // se va con esto: acabamos de decir lo contrario.
                          datos.descartarExito();
                        }}
                      >
                        {tr("agenda.noHabiaVenido")}
                      </Boton>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}