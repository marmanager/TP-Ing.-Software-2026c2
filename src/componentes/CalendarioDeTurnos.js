"use client";

// El calendario para elegir un turno: un mes con los días que tienen lugar
// marcados y los demás tachados, y debajo, del día que se toca, sus horarios
// libres partidos en mañana y tarde. Lo usan la pantalla pública de pedir
// turno y la landing del negocio.
//
// Recibe los días con lugar tal cual salen de src/lib/horarios.js
// ([{ fecha, huecos }]) y no puede venir vacío: quien lo usa muestra antes el
// "no queda ningún horario libre". `elegido` es el horario puesto, en ISO
// (o null); `onElegir` avisa con el ISO del horario que tocaron, o con null
// cuando cambian de mes o de día, porque lo que había elegido ya no se ve.
// El mes y el día que se miran son de acá adentro: a quien lo usa sólo le
// importa qué horario quedó puesto.
//
// `nivel` es el de sus títulos ("Qué día" y el día elegido; las franjas van
// uno más abajo). En /turnos/[codigo] cuelgan del título de la pantalla (2);
// en la landing, del de la sección "Sacar turno" (3).

import { useState } from "react";
import { enFranjas, mesesConLugar, semanasDelMes } from "@/lib/horarios";
import { DIAS_DE_LA_SEMANA, MES_CORTO, MES_LARGO } from "@/lib/calendario";
import { diaPasado } from "@/lib/fechas";
import Icono from "@/componentes/Icono";

export const comoHora = (fecha) =>
  `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, "0")}`;

export default function CalendarioDeTurnos({ dias, elegido, onElegir, nivel = 2 }) {
  const Titulo = `h${nivel}`;
  const Franja = `h${nivel + 1}`;
  // El día que está mirando, como toDateString(). null = el primero que
  // tenga lugar.
  const [dia, setDia] = useState(null);
  // El mes que está mirando: su lugar en la lista de meses con lugar.
  const [cualMes, setCualMes] = useState(0);

  const meses = mesesConLugar(dias);
  const posMes = Math.max(0, Math.min(cualMes, meses.length - 1));
  const mes = meses[posMes];
  const delMes = mes
    ? dias.filter((d) => d.fecha.getFullYear() === mes.anio && d.fecha.getMonth() === mes.mes)
    : [];
  // Si el día elegido no es de este mes, se muestra el primero con lugar del
  // mes: al pasar de mes siempre hay algo abajo, nunca una tarjeta vacía.
  const delDia = delMes.find((d) => d.fecha.toDateString() === dia) ?? delMes[0];
  const conLugar = new Set(dias.map((d) => d.fecha.toDateString()));
  const franjas = delDia ? enFranjas(delDia.huecos) : [];

  return (
    <>
      <Titulo className="mt-8 mb-3 text-seccion">Qué día</Titulo>
      <Calendario
        mes={mes}
        antes={meses[posMes - 1]}
        despues={meses[posMes + 1]}
        onMes={(paso) => {
          setCualMes(posMes + paso);
          onElegir(null);
        }}
        conLugar={conLugar}
        ultimo={dias[dias.length - 1].fecha}
        puesto={delDia?.fecha.toDateString()}
        onDia={(clave) => {
          if (clave !== delDia?.fecha.toDateString()) onElegir(null);
          setDia(clave);
        }}
      />

      <div className="mt-6 rounded-tarjeta border border-borde bg-tarjeta p-4 sm:p-5">
        <Titulo className="text-subtitulo font-bold first-letter:uppercase">
          {diaPasado(delDia.fecha)}
        </Titulo>
        <p className="text-tinta-media">
          {delDia.huecos.length === 1
            ? "Queda 1 horario libre."
            : `Quedan ${delDia.huecos.length} horarios libres.`}
        </p>

        {franjas.map((f) => (
          <div key={f.nombre} className="mt-4">
            {/* font-titulo explícito: globals.css se la da a h1, h2 y h3, y
                con nivel 3 esto es un h4. */}
            <Franja className="mb-2 font-titulo font-bold text-tinta-media">{f.nombre}</Franja>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {f.huecos.map((h) => {
                const puesto = elegido && h.getTime() === new Date(elegido).getTime();
                return (
                  <li key={h.getTime()}>
                    <button
                      type="button"
                      aria-pressed={Boolean(puesto)}
                      aria-label={`${diaPasado(delDia.fecha)} a las ${comoHora(h)}`}
                      onClick={() => onElegir(h.toISOString())}
                      className={[
                        "flex min-h-12 w-full cursor-pointer items-center justify-center gap-1.5 rounded-campo border-2 font-bold text-cuerpo tabular-nums",
                        puesto
                          ? "border-azul bg-azul-claro text-azul"
                          : "border-borde-fuerte bg-tarjeta text-tinta hover:bg-superficie",
                      ].join(" ")}
                    >
                      {puesto && <Icono nombre="listo" className="size-5 shrink-0" />}
                      {comoHora(h)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

// Los nombres de los meses y de los días se mudaron a lib/calendario.js: los
// usa también el calendario del negocio, y dos copias se despegan sola una de
// la otra.

// El calendario de un mes. Los días con lugar son botones, marcados; los
// demás van tachados y no se tocan. Abajo, en palabras, qué quiere decir
// cada cosa: el tachado solo no alcanza para saber por qué no se puede.
function Calendario({ mes, antes, despues, onMes, conLugar, puesto, onDia, ultimo }) {
  // "Octubre 2026", sin el "de": con el "de" no entra en una línea al lado
  // de las flechas.
  const titulo =
    new Intl.DateTimeFormat("es-AR", { month: "long" }).format(new Date(mes.anio, mes.mes, 1)) +
    " " +
    mes.anio;

  return (
    <div className="rounded-tarjeta border border-borde bg-tarjeta px-2 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-2 pl-2">
        <p className="font-titulo font-extrabold text-subtitulo first-letter:uppercase">
          {titulo}
        </p>
        {/* Las flechas llevan el nombre del mes al que van: la cartilla no
            deja botones que sean sólo un ícono. Una flecha que no lleva a
            ningún mes con lugar no se muestra; queda el hueco, para que la
            otra no salte de lugar. */}
        <div className="flex gap-1">
          {antes ? (
            <button
              type="button"
              aria-label={`Ver ${MES_LARGO[antes.mes]}`}
              onClick={() => onMes(-1)}
              className="flex min-h-12 min-w-16 cursor-pointer items-center justify-center gap-0.5 rounded-campo px-2 font-bold text-azul hover:bg-azul-claro"
            >
              <Icono nombre="flecha-izq" className="size-5 shrink-0" />
              {MES_CORTO[antes.mes]}
            </button>
          ) : (
            <span className="min-w-16" aria-hidden="true" />
          )}
          {despues ? (
            <button
              type="button"
              aria-label={`Ver ${MES_LARGO[despues.mes]}`}
              onClick={() => onMes(1)}
              className="flex min-h-12 min-w-16 cursor-pointer items-center justify-center gap-0.5 rounded-campo px-2 font-bold text-azul hover:bg-azul-claro"
            >
              {MES_CORTO[despues.mes]}
              <Icono nombre="flecha-der" className="size-5 shrink-0" />
            </button>
          ) : (
            <span className="min-w-16" aria-hidden="true" />
          )}
        </div>
      </div>

      <table className="w-full table-fixed border-collapse text-center">
        <thead>
          <tr>
            {DIAS_DE_LA_SEMANA.map((d) => (
              <th key={d} scope="col" className="pb-1 text-apoyo font-normal text-tinta-suave">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanasDelMes(mes.anio, mes.mes).map((semana, i) => (
            <tr key={i}>
              {semana.map((fecha, j) => {
                if (!fecha) return <td key={j} />;
                const clave = fecha.toDateString();
                const numero = fecha.getDate();

                if (!conLugar.has(clave)) {
                  return (
                    <td key={j} className="py-0.5">
                      <span
                        className="mx-auto flex size-11 items-center justify-center text-cuerpo tabular-nums text-tinta-suave line-through"
                        aria-label={`${numero}, sin lugar`}
                      >
                        {numero}
                      </span>
                    </td>
                  );
                }

                const esEste = clave === puesto;
                return (
                  <td key={j} className="py-0.5">
                    <button
                      type="button"
                      aria-pressed={esEste}
                      aria-label={diaPasado(fecha)}
                      onClick={() => onDia(clave)}
                      className={[
                        "mx-auto flex size-12 cursor-pointer items-center justify-center rounded-full font-bold text-cuerpo tabular-nums",
                        esEste
                          ? "bg-azul text-white"
                          : "bg-azul-claro text-azul hover:ring-2 hover:ring-azul",
                      ].join(" ")}
                    >
                      {numero}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 pl-2 text-apoyo text-tinta-media">
        <span className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-full bg-azul-claro ring-1 ring-azul" />
          Hay lugar
        </span>
        <span className="flex items-center gap-2">
          <span className="text-tinta-suave line-through">15</span>
          No se puede pedir
        </span>
      </p>
      {/* Sin esto, las dos últimas semanas tachadas parecen un negocio
          lleno, cuando lo que pasa es que todavía no se dan turnos para
          esos días. */}
      <p className="mt-1 pl-2 text-apoyo text-tinta-media">
        Se dan turnos hasta el {diaPasado(ultimo).toLowerCase()}.
      </p>
    </div>
  );
}
