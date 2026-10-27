"use client";

// "Historial" (SCRUM-75): todo lo que pasó en el negocio.
//
// Cada caso ya tiene su historial en su pantalla. Esta junta el de todos,
// para contestar las preguntas que no son de un caso solo: qué entró esta
// semana, qué se entregó, cuánta plata se movió en cada paso.
//
// Se filtra por período y por tipo. El tipo lo guarda cada evento (ver
// lib/historial.js).
//
// Un técnico ve sólo lo de sus casos: la base no le manda los eventos de
// los demás.

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { puede, quienPuede } from "@/lib/permisos";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { pesos } from "@/lib/estados";
import { diaPasado, horaYMinutos } from "@/lib/fechas";
import { casoEnFrase, tituloDelCaso } from "@/lib/nombres";
import {
  LISTA_PERIODOS,
  LISTA_TIPOS,
  agruparPorDia,
  filtrarHistorial,
  plataAprobada,
  resumirHistorial,
} from "@/lib/historial";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, TituloSeccion, Vacio } from "@/componentes/ui";

function Opcion({ elegida, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={elegida}
      onClick={onClick}
      className={[
        "min-h-12 cursor-pointer rounded-full border-2 px-4 text-etiqueta",
        elegida
          ? "border-azul bg-azul-claro font-bold text-azul"
          : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function Historial() {
  const { cargando, eventos, casos, clientes, pasos } = useDatos();
  const { usuario } = useAuth();
  const { t, locale } = useIdioma();
  useTitulo(t("historial.titulo"));

  const [periodo, setPeriodo] = useState("semana");
  const [tipo, setTipo] = useState("todo");
  // Para reconstruir un reclamo: lo que pasó con un caso solo, sin recorrer
  // el historial general a ojo (auditoría, H7).
  const [soloCaso, setSoloCaso] = useState(null);

  if (cargando) return <Cargando />;
  if (!puede(usuario, "ver_historial")) {
    return <Vacio icono="candado" titulo={t("historial.titulo")}>{quienPuede("ver_historial", t)}</Vacio>;
  }

  // El resumen mira el período entero, sin el filtro de tipo: si no, al
  // elegir "Plata" diría que entraron cero casos, que no es cierto.
  const delPeriodo = filtrarHistorial(eventos, { periodo });
  const { entraron, entregados } = resumirHistorial(delPeriodo);
  const aprobado = plataAprobada(pasos, { periodo });
  const visibles = filtrarHistorial(eventos, { periodo, tipo }).filter(
    (e) => !soloCaso || e.caso_id === soloCaso
  );
  const casoElegido = soloCaso ? casos.find((c) => c.id === soloCaso) : null;
  const clienteElegido =
    casoElegido && clientes.find((c) => c.id === casoElegido.cliente_id);
  const dias = agruparPorDia(visibles);

  const numeros = [
    [t("historial.entraron"), entraron, t("historial.casos", { n: entraron })],
    [t("historial.seEntregaron"), entregados, t("historial.casos", { n: entregados })],
  ];

  return (
    <>
      <h1 className="text-pantalla">{t("historial.titulo")}</h1>
      <p className="mt-1 mb-8 max-w-[65ch] text-tinta-media">
        {t("historial.apoyo")}
      </p>

      {/* Los dos grupos de filtros parecían hacer lo mismo, y uno cambia los
          números y el otro no. El período ya estaba arriba, junto a los
          números que gobierna, y "Qué mostrar" abajo, pegado a la lista: lo
          que faltaba era decirlo (auditoría, H8). */}
      <fieldset className="mb-4">
        <legend className="mb-2 font-bold text-cuerpo">
          {t("historial.desdeCuando")}{" "}
          <span className="font-normal text-tinta-media">{t("historial.desdeCuandoApoyo")}</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {LISTA_PERIODOS.map((p) => (
            <Opcion key={p.clave} elegida={periodo === p.clave} onClick={() => setPeriodo(p.clave)}>
              {t(`historial.periodos.${p.clave}`)}
            </Opcion>
          ))}
        </div>
      </fieldset>

      {/* En celular los dos números van de a dos y la plata abajo, a todo el
          ancho: apiladas una por línea, las tres tarjetas ocupaban la
          pantalla entera antes de llegar a la lista. */}
      <dl className="mb-8 grid grid-cols-2 gap-3 @xl:grid-cols-3">
        {numeros.map(([que, cuanto, unidad]) => (
          <div key={que} className="min-w-0 rounded-tarjeta border border-borde bg-tarjeta p-4">
            <dt className="text-tinta-media">{que}</dt>
            <dd className="font-titulo font-extrabold text-dato tabular-nums">
              {cuanto} <span className="text-cuerpo font-normal text-tinta-media">{unidad}</span>
            </dd>
          </div>
        ))}
        {/* La plata que los clientes dijeron que sí. Sale de los pasos: lo
            aprobado ya no se deshace, así que cada paso cuenta una vez. */}
        <div className="col-span-2 rounded-tarjeta border border-borde bg-tarjeta p-4 @xl:col-span-1">
          <dt className="text-tinta-media">{t("historial.aprobaron")}</dt>
          <dd className="font-titulo font-extrabold text-dato text-completo tabular-nums">
            {pesos(aprobado.total, locale)}
          </dd>
          <dd className="text-apoyo text-tinta-suave">
            {aprobado.pasos === 0
              ? t("historial.ningunPaso")
              : t("historial.enPasos", { n: aprobado.pasos })}
          </dd>
        </div>
      </dl>

      <fieldset className="mb-8">
        <legend className="mb-2 font-bold text-cuerpo">
          {t("historial.queMostrar")}{" "}
          <span className="font-normal text-tinta-media">
            {t("historial.queMostrarApoyo")}
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          <Opcion elegida={tipo === "todo"} onClick={() => setTipo("todo")}>
            {t("historial.todo")}
          </Opcion>
          {LISTA_TIPOS.map((tp) => (
            <Opcion key={tp.clave} elegida={tipo === tp.clave} onClick={() => setTipo(tp.clave)}>
              {t(`historial.tipos.${tp.clave}`)}
            </Opcion>
          ))}
        </div>
      </fieldset>

      {casoElegido && (
        <p className="mb-4 flex flex-wrap items-center gap-3">
          <span className="font-bold text-cuerpo">
            {/* "de Hugo Peralta" sólo si el caso no se llama ya así. */}
            {clienteElegido && clienteElegido.nombre !== tituloDelCaso(casoElegido, t)
              ? t("historial.soloElDe", { caso: casoEnFrase(casoElegido, t), cliente: clienteElegido.nombre })
              : t("historial.soloEl", { caso: casoEnFrase(casoElegido, t) })}
          </span>
          <Boton variante="plano" icono="cruz" onClick={() => setSoloCaso(null)}>
            {t("historial.verTodo")}
          </Boton>
        </p>
      )}

      {dias.length === 0 ? (
        <Vacio icono="historial" titulo={t("historial.vacioTitulo")}>
          {eventos.length === 0
            ? t("historial.vacioSinEventos")
            : t("historial.vacioConEventos")}
        </Vacio>
      ) : (
        dias.map(({ clave, dia, eventos: delDia }) => (
          <section key={clave} className="mb-10">
            <TituloSeccion className="first-letter:uppercase">{diaPasado(dia, locale, t)}</TituloSeccion>
            <ol className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
              {delDia.map((e) => {
                const caso = casos.find((c) => c.id === e.caso_id);
                const cliente = caso && clientes.find((c) => c.id === caso.cliente_id);
                return (
                  <li
                    key={e.id}
                    className="flex items-start border-b border-borde last:border-b-0"
                  >
                    <Link
                      href={caso ? `/casos/${caso.id}` : "/casos"}
                      className="flex min-w-0 flex-1 items-start gap-3 p-4 hover:bg-superficie"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta-media">
                        <Icono nombre={e.icono} className="size-5" />
                      </span>
                      {/* En celular la plata va debajo del texto: a su lado,
                          con el ícono y el botón de filtrar, al texto le
                          quedaba una columna de dos palabras. Desde sm vuelve
                          a la derecha. */}
                      <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                        <span className="min-w-0 sm:flex-1">
                          <span className="block font-bold [overflow-wrap:anywhere]">{e.titulo}</span>
                          {e.detalle && (
                            <span className="block text-tinta-media">{e.detalle}</span>
                          )}
                          <span className="mt-1 block text-apoyo text-tinta-suave">
                            {!caso
                              ? t("historial.linea", { hora: horaYMinutos(e.ocurrido_en, locale), autor: e.autor })
                              : cliente && cliente.nombre !== tituloDelCaso(caso, t)
                                ? t("historial.lineaCasoCliente", {
                                    hora: horaYMinutos(e.ocurrido_en, locale),
                                    autor: e.autor,
                                    caso: tituloDelCaso(caso, t),
                                    cliente: cliente.nombre,
                                  })
                                : t("historial.lineaCaso", {
                                    hora: horaYMinutos(e.ocurrido_en, locale),
                                    autor: e.autor,
                                    caso: tituloDelCaso(caso, t),
                                  })}
                          </span>
                        </span>
                        {e.tipo === "plata" && e.monto !== null && e.monto !== undefined && (
                          <span className="shrink-0 font-titulo font-extrabold text-subtitulo tabular-nums">
                            {pesos(e.monto, locale)}
                          </span>
                        )}
                      </span>
                    </Link>
                    {/* Afuera del enlace: un botón adentro de un enlace no se
                        puede tocar por separado. */}
                    {caso && !soloCaso && (
                      <button
                        type="button"
                        aria-label={t("historial.verSoloLoDel", { caso: casoEnFrase(caso, t) })}
                        onClick={() => setSoloCaso(caso.id)}
                        className="flex min-h-12 w-12 shrink-0 cursor-pointer items-center justify-center self-center rounded-campo text-tinta-media hover:bg-superficie hover:text-azul"
                      >
                        <Icono nombre="buscar" className="size-5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </>
  );
}
