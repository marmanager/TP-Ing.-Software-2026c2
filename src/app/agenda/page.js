"use client";

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede } from "@/lib/permisos";
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
  const { cargando, turnos, clientes, casos } = datos;
  const [abierto, setAbierto] = useState(false);
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
            ayuda="Con las palabras del cliente. Ejemplo: cambio de aceite."
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

                    {!cancelado && (
                      <div className="flex gap-2">
                        {t.estado === "agendado" && (
                          <Boton
                            icono="check"
                            onClick={() => datos.cambiarEstadoTurno(t.id, "confirmado")}
                          >
                            Confirmar
                          </Boton>
                        )}
                        <Boton
                          variante="peligro"
                          icono="cruz"
                          onClick={() => datos.cambiarEstadoTurno(t.id, "cancelado")}
                        >
                          Cancelar
                        </Boton>
                      </div>
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
