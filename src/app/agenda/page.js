"use client";

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede } from "@/lib/permisos";
import { ejemplosDe } from "@/lib/presets";
import { estaAbierto } from "@/lib/estados";
import { diaLargo, horaYMinutos, paraInput } from "@/lib/fechas";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

const TONO = {
  agendado: "text-tinta-media",
  confirmado: "text-completo",
  cancelado: "text-tinta-suave line-through",
  atendido: "text-tinta-suave",
};

export default function Agenda() {
  const datos = useDatos();
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario?.rol, "cargarDatos");
  const { cargando, turnos, clientes, casos, negocio } = datos;
  const [abierto, setAbierto] = useState(false);
  // El turno que se está por cancelar, esperando la confirmación.
  const [cancelando, setCancelando] = useState(null);
  const [form, setForm] = useState({
    nombreCliente: "",
    telefono: "",
    motivo: "",
    empiezaEn: "",
  });
  useTitulo("Agenda");

  if (cargando) return <Cargando />;

  const proximos = turnos
    .filter((t) => new Date(t.empieza_en) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.empieza_en) - new Date(b.empieza_en));

  // Agrupados por día, para leer la semana de un vistazo.
  const porDia = proximos.reduce((acc, t) => {
    const clave = new Date(t.empieza_en).toDateString();
    (acc[clave] ??= []).push(t);
    return acc;
  }, {});

  // Si el nombre coincide con alguien ya cargado, se le suma el turno a esa
  // ficha; si no, se da de alta el cliente junto con el turno.
  const yaEsCliente = clientes.find(
    (c) => c.nombre.toLowerCase() === form.nombreCliente.trim().toLowerCase()
  );

  const motivoApagado = !form.motivo.trim()
    ? "falta el motivo"
    : !form.empiezaEn
      ? "falta el día y la hora"
      : null;

  function guardar() {
    datos.agregarTurno({ ...form, clienteId: yaEsCliente?.id ?? null });
    datos.avisarExito(`Listo. El turno de ${form.motivo.trim()} quedó anotado.`);
    setForm({ nombreCliente: "", telefono: "", motivo: "", empiezaEn: "" });
    setAbierto(false);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">Agenda</h1>
          <p className="mt-1 text-tinta-media">Quién viene, cuándo y para qué.</p>
        </div>
        {puedeCargar && (
        <Boton icono="mas" onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cerrar el alta" : "Anotar un turno"}
        </Boton>
        )}
      </div>

      {abierto && puedeCargar && (
        <Tarjeta className="mb-8 max-w-[560px]">
          <TituloSeccion>Nuevo turno</TituloSeccion>

          <Campo
            id="turno-cliente"
            etiqueta="Para quién"
            ayuda="Si todavía no está cargado, escribí su nombre igual: lo damos de alta con el turno."
            exito={yaEsCliente ? `Ya es cliente. Le sumamos este turno a ${yaEsCliente.nombre}.` : null}
            value={form.nombreCliente}
            onChange={(e) => setForm({ ...form, nombreCliente: e.target.value })}
            list="clientes-de-la-agenda"
            autoComplete="off"
          />
          <datalist id="clientes-de-la-agenda">
            {clientes.map((c) => (
              <option key={c.id} value={c.nombre} />
            ))}
          </datalist>

          {/* El teléfono sólo si es alguien nuevo: al que ya está cargado no
              hay que volver a pedírselo. */}
          {form.nombreCliente.trim() && !yaEsCliente && (
            <Campo
              id="turno-telefono"
              etiqueta="Su teléfono"
              ayuda="Opcional. Sirve para avisarle si hay que mover el turno."
              ejemplo="341 456 7890"
              type="tel"
              inputMode="tel"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          )}

          <Campo
            id="turno-motivo"
            etiqueta="Para qué viene"
            ayuda={`Con las palabras del cliente. Ejemplo: ${ejemplosDe(negocio?.rubro).turno}.`}
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
          />
          <Campo
            id="turno-cuando"
            etiqueta="Qué día y a qué hora"
            ayuda="Se puede cambiar después."
            type="datetime-local"
            min={paraInput()}
            value={form.empiezaEn}
            onChange={(e) => setForm({ ...form, empiezaEn: e.target.value })}
          />
          <Boton variante="principal" icono="check" motivo={motivoApagado} onClick={guardar}>
            Guardar el turno
          </Boton>
        </Tarjeta>
      )}

      {proximos.length === 0 ? (
        <Vacio icono="calendario" titulo="No hay turnos anotados">
          Anotá el primero y va a aparecer acá, ordenado por día.
        </Vacio>
      ) : (
        Object.entries(porDia).map(([clave, delDia]) => (
          <section key={clave} className="mb-10">
            <TituloSeccion className="first-letter:uppercase">
              {diaLargo(delDia[0].empieza_en)}
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
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center gap-4 border-b border-borde p-4 last:border-b-0"
                  >
                    <p className="w-20 font-titulo font-extrabold text-subtitulo tabular-nums">
                      {horaYMinutos(t.empieza_en)}
                    </p>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold ${cancelado ? TONO.cancelado : ""}`}>{t.motivo}</p>
                      <p className="text-tinta-media">
                        {cliente?.nombre ?? "Sin cliente todavía"}
                        {caso && (
                          <>
                            {" · "}
                            <Link href={`/casos/${caso.id}`} className="text-azul">
                              caso {caso.numero}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>

                    <p className={`flex items-center gap-1.5 font-bold text-etiqueta ${TONO[t.estado]}`}>
                      <Icono
                        nombre={
                          t.estado === "confirmado"
                            ? "listo"
                            : t.estado === "cancelado"
                              ? "cruz"
                              : t.estado === "atendido"
                                ? "persona-check"
                                : "reloj"
                        }
                        className="size-5"
                      />
                      {t.estado === "agendado"
                        ? "Sin confirmar"
                        : t.estado === "confirmado"
                          ? "Confirmado"
                          : t.estado === "cancelado"
                            ? "Cancelado"
                            : "Ya vino"}
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
                      <div className="w-full rounded-tarjeta bg-superficie p-4">
                        <p className="font-bold text-cuerpo">
                          ¿Cancelar el turno de {cliente?.nombre ?? "esta persona"} de las{" "}
                          {horaYMinutos(t.empieza_en)}?
                        </p>
                        <p className="mt-1 text-tinta-media">
                          Queda en la agenda como cancelado. Si te equivocaste, se deshace
                          desde el aviso.
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
                                `Listo. Cancelamos el turno de ${cliente?.nombre ?? "esa persona"} de las ${horaYMinutos(t.empieza_en)}.`,
                                { deshacer: () => datos.cambiarEstadoTurno(t.id, antes) }
                              );
                              setCancelando(null);
                            }}
                          >
                            Sí, cancelarlo
                          </Boton>
                          <Boton
                            variante="plano"
                            className="w-full sm:w-auto"
                            onClick={() => setCancelando(null)}
                          >
                            Dejarlo como está
                          </Boton>
                        </div>
                      </div>
                    )}

                    {/* En celular las acciones van apiladas y a todo el ancho,
                        con 8 px entre una y otra: en una fila de 360 px se
                        partían en cuatro líneas desordenadas y quedaban
                        pegadas (auditoría, Responsive). */}
                    {!cancelado && t.estado !== "atendido" && cancelando !== t.id && (
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                        {t.estado === "agendado" && (
                          <Boton
                            icono="check"
                            className="w-full sm:w-auto"
                            onClick={() => datos.cambiarEstadoTurno(t.id, "confirmado")}
                          >
                            Confirmar
                          </Boton>
                        )}

                        {suCaso ? (
                          <Boton
                            icono="persona-check"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              datos.marcarTurnoAtendido(t.id, suCaso.id);
                              datos.avisarExito(
                                `Listo. Queda anotado que ${cliente?.nombre ?? "la persona"} vino por el caso ${suCaso.numero}.`
                              );
                            }}
                          >
                            Vino a buscarlo
                          </Boton>
                        ) : (
                          <Link href={`/casos/nuevo?turno=${t.id}`}>
                            <span className="flex min-h-12 w-full items-center justify-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-4 font-bold text-azul text-etiqueta hover:bg-azul-claro sm:w-auto sm:justify-start">
                              <Icono nombre="carpeta" />
                              Vino · abrirle el caso
                            </span>
                          </Link>
                        )}

                        <Boton
                          variante="peligro"
                          icono="cruz"
                          className="w-full sm:w-auto"
                          onClick={() => setCancelando(t.id)}
                        >
                          Cancelar el turno
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
                        onClick={() => {
                          datos.desmarcarTurnoAtendido(t.id);
                          // Si quedó en pantalla el "queda anotado que vino",
                          // se va con esto: acabamos de decir lo contrario.
                          datos.descartarExito();
                        }}
                      >
                        No había venido
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
