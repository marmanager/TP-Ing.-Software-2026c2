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
    clienteId: "",
    motivo: "",
    empiezaEn: "",
    minutos: "60",
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

  const motivoApagado = !form.motivo.trim()
    ? "falta el motivo"
    : !form.empiezaEn
      ? "falta el día y la hora"
      : null;

  function guardar() {
    datos.agregarTurno(form);
    datos.avisarExito(`Listo. El turno de ${form.motivo.trim()} quedó anotado.`);
    setForm({ clienteId: "", motivo: "", empiezaEn: "", minutos: "60" });
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

          <div className="mb-6">
            <label htmlFor="turno-cliente" className="block font-bold text-cuerpo">
              Para quién
            </label>
            <p className="mt-1 text-apoyo text-tinta-suave">
              Si es alguien nuevo, dejalo sin elegir y lo cargás cuando llegue.
            </p>
            <select
              id="turno-cliente"
              value={form.clienteId}
              onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
              className="mt-2 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
            >
              <option value="">Todavía no sé</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

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
          <Campo
            id="turno-minutos"
            etiqueta="Cuánto va a durar"
            ayuda="En minutos. Sirve para no superponer dos turnos."
            type="number"
            min="15"
            step="15"
            inputMode="numeric"
            value={form.minutos}
            onChange={(e) => setForm({ ...form, minutos: e.target.value })}
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
                        {cliente?.nombre ?? "Sin cliente todavía"} · {t.minutos} min
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
