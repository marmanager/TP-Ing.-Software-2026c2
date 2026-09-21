"use client";

// La semana en franjas horarias, como la de Google Calendar: una columna por
// día, las horas al costado, y cada turno dibujado donde empieza y del alto
// que ocupa.
//
// POR QUÉ CADA TURNO ES UN BOTÓN. No hay acciones en el Calendario —anotar,
// confirmar y cancelar viven en Turnos—, pero un bloque suelto que no se puede
// enfocar deja la grilla entera fuera del alcance del teclado y del lector de
// pantalla. Tocar un turno elige su día, que es lo que hace también una
// casilla del mes, y así la lista de abajo muestra ese día completo con todo
// lo que en la franja no entra.
//
// LOS CANCELADOS NO SE DIBUJAN. Un turno cancelado ya no ocupa ese horario, y
// pintarlo diría que el negocio está ocupado cuando está libre. Es el mismo
// criterio que usa la base en el índice "turno_horario_unico" (023), que
// también deja afuera a los cancelados. Siguen estando en Turnos, que es donde
// importa que se sepa que estaban.

import {
  DIAS_DE_LA_SEMANA,
  acomodarEnCarriles,
  claveDia,
  duracionDe,
  rangoDeHoras,
} from "@/lib/calendario";
import { estadoDeTurno } from "@/lib/turnos";
import { horaYMinutos } from "@/lib/fechas";
import Icono from "./Icono";

// El turno que da el negocio mide siempre el área táctil mínima de la
// cartilla, 48 px. De ahí sale la escala: un negocio que da turnos de 15
// minutos tiene la grilla más alta que uno que los da de una hora, y en los
// dos el turno de siempre se puede tocar con el dedo.
//
// La separación se suma a la escala en vez de restarse del bloque: si se
// restara, el turno de media hora quedaría en 46 px y ya no llegaría a los 48
// que pide la cartilla.
const ALTO_DEL_TURNO = 48;
const SEPARACION = 2;

const enHora = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

export default function SemanaDeTurnos({ dias, porDia, horarios, elegido, onDia, hoy }) {
  const porDefecto = horarios?.minutos ?? 30;
  const pxPorMinuto = (ALTO_DEL_TURNO + SEPARACION) / porDefecto;

  const delaSemana = dias.flatMap((d) =>
    (porDia.get(claveDia(d)) ?? []).filter((t) => t.estado !== "cancelado")
  );

  const abre = horarios ? enMinutos(horarios.desde) : 9 * 60;
  const cierra = horarios ? enMinutos(horarios.hasta) : 18 * 60;
  const { desde, hasta } = rangoDeHoras(delaSemana, { abre, cierra, porDefecto });

  const alto = (hasta - desde) * pxPorMinuto;
  const horas = [];
  for (let m = desde; m <= hasta; m += 60) horas.push(m);

  const claveHoy = claveDia(hoy);

  return (
    <div>
      {/* Las columnas de la cabecera y las del cuerpo se definen una sola vez
          en cada grilla, con el mismo reparto, así los días quedan alineados
          con sus franjas. */}
      <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-px">
        <div />
        {dias.map((d) => {
          const clave = claveDia(d);
          const esHoy = clave === claveHoy;
          const esEste = clave === elegido;
          return (
            <button
              key={clave}
              type="button"
              aria-pressed={esEste}
              onClick={() => onDia(clave)}
              className={[
                "flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-campo px-1",
                esEste
                  ? "bg-azul-claro font-bold text-azul"
                  : esHoy
                    ? "font-bold text-tinta"
                    : "text-tinta-media hover:bg-superficie",
              ].join(" ")}
            >
              <span className="text-apoyo">{DIAS_DE_LA_SEMANA[(d.getDay() + 6) % 7]}</span>
              <span className="text-cuerpo tabular-nums">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-1 grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-px">
        {/* Las horas, al costado. Cada rótulo se apoya en su línea. */}
        <div className="relative" style={{ height: alto }} aria-hidden="true">
          {horas.map((m) => (
            <span
              key={m}
              className="absolute right-2 -translate-y-1/2 text-apoyo tabular-nums text-tinta-suave"
              style={{ top: (m - desde) * pxPorMinuto }}
            >
              {enHora(m)}
            </span>
          ))}
        </div>

        {dias.map((d) => {
          const clave = claveDia(d);
          const delDia = (porDia.get(clave) ?? []).filter((t) => t.estado !== "cancelado");
          const puestos = acomodarEnCarriles(delDia, porDefecto);
          const esEste = clave === elegido;

          return (
            <div
              key={clave}
              className={[
                "relative border-l border-borde",
                esEste ? "bg-azul-claro/40" : "",
              ].join(" ")}
              style={{ height: alto }}
            >
              {/* Las líneas de cada hora, atrás de los turnos. */}
              {horas.map((m) => (
                <div
                  key={m}
                  className="absolute inset-x-0 border-t border-borde"
                  style={{ top: (m - desde) * pxPorMinuto }}
                  aria-hidden="true"
                />
              ))}

              {puestos.map((b) => {
                const t = b.turno;
                const est = estadoDeTurno(t.estado);
                // Lo pidió un cliente por el link y todavía no lo confirmó
                // nadie: es lo único de la semana que pide que alguien actúe.
                const sinVer = t.origen === "cliente" && t.estado === "agendado";
                // Recortado contra el piso de la grilla: un turno que se pasa
                // de la medianoche no puede dibujarse afuera del recuadro.
                const finVisible = Math.min(b.hasta, hasta);

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onDia(clave)}
                    title={`${horaYMinutos(t.empieza_en)} · ${t.motivo}`}
                    aria-label={[
                      horaYMinutos(t.empieza_en),
                      `${duracionDe(t, porDefecto)} minutos`,
                      t.motivo,
                      est.palabra,
                      sinVer ? "lo pidió por el link" : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    className={[
                      "absolute overflow-hidden rounded-campo px-1.5 py-0.5 text-left",
                      "cursor-pointer text-apoyo leading-tight",
                      sinVer
                        ? "border-2 border-azul bg-azul-claro text-azul"
                        : "border border-borde-fuerte bg-tarjeta text-tinta",
                    ].join(" ")}
                    style={{
                      top: (b.desde - desde) * pxPorMinuto,
                      height: Math.max(0, (finVisible - b.desde) * pxPorMinuto - SEPARACION),
                      left: `${(b.carril / b.carriles) * 100}%`,
                      width: `calc(${(1 / b.carriles) * 100}% - ${SEPARACION}px)`,
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <Icono nombre={est.icono} className={`size-4 shrink-0 ${est.texto}`} />
                      <span className="truncate font-bold tabular-nums">
                        {horaYMinutos(t.empieza_en)}
                      </span>
                    </span>
                    <span className="block truncate">{t.motivo}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// "09:30" a 570. Vive acá y no en calendario.js porque lo único que lo
// necesita es esta grilla; horarios.js tiene el suyo, privado, por lo mismo.
function enMinutos(hhmm) {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}
