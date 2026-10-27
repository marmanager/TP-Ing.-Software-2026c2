"use client";

// El calendario del mes (submódulo "calendario" de la Agenda).
//
// LA PANTALLA CAMBIA SEGÚN CÓMO ESTÉ EL TELÉFONO, Y ES A PROPÓSITO.
//
// En la computadora y con el teléfono acostado se ve el mes entero. Parado,
// se ve un día solo, con un botón para pasar al siguiente y un selector para
// saltar a cualquier otro. El motivo no es que la grilla no entre —entraría
// apretada— sino que son dos trabajos distintos: mirar el mes para planificar
// es algo que se hace sentado; el que abre el teléfono en el taller quiere
// saber qué le queda hoy. Darle la grilla del mes ahí es hacerle apuntar a
// una casilla de 40 px para leer lo que ya sabía.
//
// Las dos vistas se dibujan siempre y el navegador esconde una con
// "display:none", así que la que está escondida tampoco existe para un lector
// de pantalla. Al girar el teléfono cambia sola, sin recargar y sin perder el
// día que estabas mirando: el estado es uno solo para las dos.
//
// QUÉ NO HACE: nada. Acá sólo se mira. Anotar, confirmar, cancelar y marcar
// que alguien vino se hacen todos en Turnos, que es una sola pantalla y un
// solo lugar donde buscarlos. Tener el alta en los dos lados obligaba a
// mantener dos veces el mismo formulario y sus avisos, y dejaba al usuario
// con dos lugares donde anotar lo mismo sin ninguna diferencia entre ellos.

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { estadoDeTurno, turnoEnPie } from "@/lib/turnos";
import { diaLargo, horaYMinutos } from "@/lib/fechas";
import { normalizarHorarios, semanasDelMes } from "@/lib/horarios";
import { casoEnFrase } from "@/lib/nombres";
import { conElementos } from "@/lib/conElementos";
import { useIdioma } from "@/lib/useIdioma";
import {
  diasDeLaSemana,
  mesLargo,
  aniosOfrecidos,
  claveDia,
  deClaveDia,
  mesAnterior,
  mesSiguiente,
  semanaDe,
  sumarDias,
  tituloDeSemana,
  turnosPorDia,
} from "@/lib/calendario";
import Icono from "@/componentes/Icono";
import Pestanas from "@/componentes/Pestanas";
import VincularGoogleCalendar from "@/componentes/VincularGoogleCalendar";
import SemanaDeTurnos from "@/componentes/SemanaDeTurnos";
import { Boton, Cargando, Vacio } from "@/componentes/ui";

const CAMPO =
  "mt-1 block rounded-campo border-2 border-borde-fuerte bg-tarjeta px-3 min-h-12 text-cuerpo";

// Los selectores de mes y año miden lo que mide su contenido.
const CLASE_SELECT = CAMPO;

// El de elegir día, en cambio, va a todo el ancho: con el teléfono parado es
// el control principal de la pantalla y la cartilla pide ancho completo.
const CLASE_FECHA = `${CAMPO} w-full`;

// El mes se ve en la computadora y con el teléfono acostado; el día, con el
// teléfono parado. "max-height:480px" es como este código viene diciendo
// "teléfono acostado" desde la auditoría (ui.js, Navegacion.js).
const SOLO_MES = "hidden md:block [@media(max-height:480px)]:block";
const SOLO_DIA = "block md:hidden [@media(max-height:480px)]:hidden";

export default function Calendario() {
  const datos = useDatos();
  const { locale, t: tr } = useIdioma();
  const { cargando, turnos, clientes, casos, negocio } = datos;
  useTitulo(tr("agenda.calendario.titulo"));
  const enlaceATurnos = (
    <Link href="/agenda" className="font-bold text-azul">
      {tr("agenda.titulo")}
    </Link>
  );

  const hoy = new Date();
  const [elegido, setElegido] = useState(() => claveDia(hoy));
  const [mirando, setMirando] = useState(() => ({
    anio: hoy.getFullYear(),
    mes: hoy.getMonth(),
  }));
  // Cómo se mira: el mes entero o la semana en franjas horarias. Arranca en
  // el mes, que es la vista de "cómo viene lo que viene".
  //
  // ponytail: no se guarda. Volver a entrar arranca en el mes de nuevo.
  // Guardarlo es una columna más en "negocio" o una preferencia por persona,
  // y todavía nadie pidió que se acuerde.
  const [vista, setVista] = useState("mes");

  if (cargando) return <Cargando />;

  const porDia = turnosPorDia(turnos);
  const delDia = porDia.get(elegido) ?? [];
  const fechaElegida = deClaveDia(elegido);
  const anios = aniosOfrecidos(turnos, hoy);
  const claveHoy = claveDia(hoy);
  const horarios = normalizarHorarios(negocio?.horarios);
  const laSemana = semanaDe(fechaElegida);
  const enSemana = vista === "semana";

  // Elegir un día del mes que no se está mirando —desde el selector de día
  // del teléfono— arrastra el mes con él: si no, la grilla se quedaría en
  // otro lado al girar el teléfono.
  function irA(clave) {
    setElegido(clave);
    const f = deClaveDia(clave);
    setMirando({ anio: f.getFullYear(), mes: f.getMonth() });
  }

  const correrDia = (cuantos) => irA(claveDia(sumarDias(fechaElegida, cuantos)));

  return (
    <>
      <Pestanas padre="agenda" />

      <div className="mb-6">
        <h1 className="text-pantalla">{tr("agenda.calendario.titulo")}</h1>
        <p className="mt-1 text-tinta-media">{tr("agenda.calendario.subtitulo")}</p>
        <VincularGoogleCalendar />
      </div>

      {/* ---------- El mes o la semana ---------- */}
      <section className={SOLO_MES} aria-label={enSemana ? tr("agenda.calendario.laSemana") : tr("agenda.calendario.elMes")}>
        {/* Cómo se mira. Va arriba de los controles de navegación porque
            decide qué controles son: en el mes se elige mes y año, en la
            semana se elige un día y se corre de a siete. */}
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["mes", tr("agenda.calendario.mensual"), "calendario"],
            ["semana", tr("agenda.calendario.semanal"), "reloj"],
          ].map(([clave, palabra, icono]) => (
            <button
              key={clave}
              type="button"
              aria-pressed={vista === clave}
              onClick={() => setVista(clave)}
              className={[
                "flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-etiqueta",
                vista === clave
                  ? "border-azul bg-azul-claro font-bold text-azul"
                  : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
              ].join(" ")}
            >
              <Icono nombre={icono} className="size-5" />
              {palabra}
            </button>
          ))}
        </div>

        {enSemana ? (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-2">
              <div>
                <label
                  htmlFor="cal-semana"
                  className="block font-bold text-etiqueta text-tinta-media"
                >
                  {tr("agenda.calendario.semanaDel")}
                </label>
                <input
                  id="cal-semana"
                  type="date"
                  className={CLASE_SELECT}
                  value={elegido}
                  onChange={(e) => e.target.value && irA(e.target.value)}
                />
              </div>

              <div className="flex gap-1">
                <Boton
                  variante="plano"
                  icono="flecha-izq"
                  aria-label={tr("agenda.calendario.verSemanaAnterior")}
                  onClick={() => correrDia(-7)}
                >
                  {tr("agenda.calendario.anterior")}
                </Boton>
                <Boton
                  variante="plano"
                  icono="flecha-der"
                  aria-label={tr("agenda.calendario.verSemanaSiguiente")}
                  onClick={() => correrDia(7)}
                >
                  {tr("agenda.calendario.siguiente")}
                </Boton>
              </div>
            </div>

            <h2 className="mb-3 text-seccion first-letter:uppercase">
              {tituloDeSemana(laSemana, locale, tr)}
            </h2>

            <SemanaDeTurnos
              dias={laSemana}
              porDia={porDia}
              horarios={horarios}
              elegido={elegido}
              onDia={setElegido}
              hoy={hoy}
            />

            <p className="mt-3 text-apoyo text-tinta-suave">
              {conElementos(tr("agenda.calendario.notaSemana"), { enlace: enlaceATurnos })}
            </p>
          </>
        ) : (
          <>
        {/* Los dos selectores miden lo que mide su contenido y no se estiran:
            estirados, "septiembre" se llevaba media pantalla para decir una
            palabra, y lo que importa —la grilla— empezaba más abajo.

            "Anterior" y "Siguiente" van planos, sin recuadro: son el paso de
            al lado, no dos acciones que compitan con la grilla por la
            atención. Antes decían "Antes" y "Después", que en una pantalla
            que además tiene "Los que vienen / Los que ya pasaron" se leían
            como si hablaran del tiempo y no del mes. */}
        <div className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-2">
          <div>
            <label htmlFor="cal-mes" className="block font-bold text-etiqueta text-tinta-media">
              {tr("agenda.calendario.mes")}
            </label>
            <select
              id="cal-mes"
              className={`${CLASE_SELECT} first-letter:uppercase`}
              value={mirando.mes}
              onChange={(e) => setMirando({ ...mirando, mes: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {mesLargo(i, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cal-anio" className="block font-bold text-etiqueta text-tinta-media">
              {tr("agenda.calendario.anio")}
            </label>
            <select
              id="cal-anio"
              className={CLASE_SELECT}
              value={mirando.anio}
              onChange={(e) => setMirando({ ...mirando, anio: Number(e.target.value) })}
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-1">
            <Boton
              variante="plano"
              icono="flecha-izq"
              aria-label={tr("agenda.calendario.verMes", { mes: mesLargo(mesAnterior(mirando).mes, locale), anio: mesAnterior(mirando).anio })}
              onClick={() => setMirando(mesAnterior(mirando))}
            >
              {tr("agenda.calendario.anterior")}
            </Boton>
            <Boton
              variante="plano"
              icono="flecha-der"
              aria-label={tr("agenda.calendario.verMes", { mes: mesLargo(mesSiguiente(mirando).mes, locale), anio: mesSiguiente(mirando).anio })}
              onClick={() => setMirando(mesSiguiente(mirando))}
            >
              {tr("agenda.calendario.siguiente")}
            </Boton>
          </div>
        </div>

        <table className="w-full table-fixed border-collapse text-center">
          <caption className="sr-only">
            {tr("agenda.calendario.caption", { mes: mesLargo(mirando.mes, locale), anio: mirando.anio })}
          </caption>
          <thead>
            <tr>
              {diasDeLaSemana(locale).map((d) => (
                <th key={d} scope="col" className="pb-1 text-apoyo font-normal text-tinta-suave">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanasDelMes(mirando.anio, mirando.mes).map((semana, i) => (
              <tr key={i}>
                {semana.map((fecha, j) => {
                  if (!fecha) return <td key={j} />;

                  const clave = claveDia(fecha);
                  const suyos = porDia.get(clave) ?? [];
                  const enPie = suyos.filter(turnoEnPie);
                  // Los que pidió un cliente por el link y todavía no confirmó
                  // nadie del negocio: es lo único del calendario que pide
                  // que alguien haga algo.
                  const sinVer = enPie.filter(
                    (t) => t.origen === "cliente" && t.estado === "agendado"
                  );
                  const esHoy = clave === claveHoy;
                  const esEste = clave === elegido;

                  return (
                    <td key={j} className="py-0.5 align-top">
                      <button
                        type="button"
                        aria-pressed={esEste}
                        aria-label={[
                          diaLargo(fecha, locale, tr),
                          tr("agenda.calendario.turnos", { n: enPie.length }),
                          sinVer.length ? tr("agenda.calendario.sinConfirmar", { n: sinVer.length }) : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                        onClick={() => setElegido(clave)}
                        className={[
                          "mx-auto flex min-h-12 w-full max-w-[3.5rem] cursor-pointer flex-col",
                          "items-center justify-center gap-0.5 rounded-campo border-2 px-1 py-1",
                          esEste
                            ? "border-azul bg-azul-claro font-bold text-azul"
                            : esHoy
                              ? "border-borde-fuerte bg-tarjeta text-tinta"
                              : "border-transparent text-tinta-media hover:bg-superficie",
                        ].join(" ")}
                      >
                        <span className="text-cuerpo tabular-nums">{fecha.getDate()}</span>
                        {/* El número de turnos en palabras y no sólo un punto
                            de color: impreso en blanco y negro se sigue
                            entendiendo (cartilla). El "·" de los que nadie
                            confirmó va además del número, nunca en su lugar. */}
                        <span
                          className={[
                            "text-apoyo tabular-nums leading-none",
                            enPie.length === 0
                              ? "invisible"
                              : sinVer.length
                                ? "font-bold text-azul"
                                : "text-tinta-suave",
                          ].join(" ")}
                        >
                          {enPie.length || 0}
                          {sinVer.length ? " ·" : ""}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

            <p className="mt-3 text-apoyo text-tinta-suave">
              {tr("agenda.calendario.notaMes")}
            </p>
          </>
        )}
      </section>

      {/* ---------- El día, con el teléfono parado ---------- */}
      <section className={SOLO_DIA} aria-label={tr("agenda.calendario.elDia")}>
        <div className="mb-4">
          <label htmlFor="cal-dia" className="block font-bold text-etiqueta text-tinta-media">
            {tr("agenda.calendario.queDia")}
          </label>
          <input
            id="cal-dia"
            type="date"
            className={CLASE_FECHA}
            value={elegido}
            onChange={(e) => e.target.value && irA(e.target.value)}
          />
        </div>

        <div className="mb-6 flex gap-2">
          <Boton
            className="flex-1"
            icono="flecha-izq"
            aria-label={tr("agenda.calendario.verDiaAnterior")}
            onClick={() => correrDia(-1)}
          >
            {tr("fechas.ayer")}
          </Boton>
          <Boton
            className="flex-1"
            icono="flecha-der"
            aria-label={tr("agenda.calendario.verDiaSiguiente")}
            onClick={() => correrDia(1)}
          >
            {tr("fechas.manana")}
          </Boton>
        </div>
      </section>

      {/* ---------- Los turnos del día elegido ---------- */}
      {/* Uno solo para las dos vistas: es el mismo día y la misma lista. */}
      <section aria-labelledby="cal-titulo-dia" className="mt-8">
        <h2 id="cal-titulo-dia" className="text-seccion first-letter:uppercase">
          {diaLargo(fechaElegida, locale, tr)}
        </h2>

        {delDia.length === 0 ? (
          <div className="mt-4">
            <Vacio icono="calendario" titulo={tr("agenda.calendario.sinTurnos")}>
              {conElementos(tr("agenda.calendario.sinTurnosTexto"), { enlace: enlaceATurnos })}
            </Vacio>
          </div>
        ) : (
          <ul className="mt-4 overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
            {delDia.map((t) => {
              const cliente = clientes.find((c) => c.id === t.cliente_id);
              const caso = casos.find((c) => c.id === t.caso_id);
              const cancelado = t.estado === "cancelado";

              return (
                // Como en Turnos: en celular una grilla de dos columnas, con
                // la hora y el estado arriba en una línea y el texto debajo a
                // todo el ancho. Desde sm vuelve la fila de siempre. Todos
                // los hijos llevan order-*, porque en una grilla los que no
                // lo tienen se colocarían antes que los que sí.
                <li
                  key={t.id}
                  className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2 border-b border-borde p-4 last:border-b-0 sm:flex sm:flex-wrap sm:items-center sm:gap-4"
                >
                  <p className="order-1 font-titulo font-extrabold text-subtitulo tabular-nums sm:order-none sm:w-20">
                    {horaYMinutos(t.empieza_en, locale)}
                  </p>
                  <div className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1 sm:flex-1">
                    <p
                      className={`font-bold [overflow-wrap:anywhere] ${cancelado ? estadoDeTurno("cancelado", tr).texto : ""}`}
                    >
                      {t.motivo}
                    </p>
                    <p className="text-tinta-media [overflow-wrap:anywhere]">
                      {cliente?.nombre ?? tr("agenda.sinCliente")}
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
                  </div>

                  {/* En celular el estado va arriba, al lado de la hora: en
                      375 px compartir la línea con el motivo le dejaba al
                      motivo una columna de tres letras (auditoría,
                      Responsive), y en un renglón propio al final se perdía. */}
                  <p
                    className={`order-2 flex items-center gap-1.5 whitespace-nowrap font-bold text-etiqueta sm:order-none ${estadoDeTurno(t.estado, tr).texto}`}
                  >
                    <Icono nombre={estadoDeTurno(t.estado, tr).icono} className="size-5" />
                    {estadoDeTurno(t.estado, tr).palabra}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {/* Confirmar, cancelar y marcar que vino están en Turnos, no acá. El
            link lo dice en vez de hacer que alguien lo descubra. */}
        {delDia.length > 0 && (
          <p className="mt-3 text-apoyo text-tinta-suave">
            {conElementos(tr("agenda.calendario.paraAnotar"), { enlace: enlaceATurnos })}
          </p>
        )}
      </section>
    </>
  );
}
