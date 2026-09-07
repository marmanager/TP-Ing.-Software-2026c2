"use client";

// "Equipo" — quién atiende los trabajos (SCRUM-18).
//
// Un empleado no necesita cuenta: el taller chico quiere anotar a Diego como
// responsable sin que Diego use el sistema. Invitar a alguien a entrar con su
// propia cuenta es otra cosa, y viene después (SCRUM-34).
//
// Los tres roles son fijos porque la base no acepta otros; cómo se llaman sale
// del preset del rubro.

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { estaAbierto } from "@/lib/estados";
import { ORDEN_ROLES, etiquetaRol } from "@/lib/presets";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

export default function Equipo() {
  const datos = useDatos();
  const { cargando, empleados, casos, negocio, avisarExito } = datos;
  useTitulo("Equipo");

  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("tecnico");
  const [sacando, setSacando] = useState(null);

  if (cargando) return <Cargando />;

  const rubro = negocio?.rubro;
  const sinAsignar = casos.filter((c) => estaAbierto(c) && !c.responsable_id);
  const motivo = !nombre.trim() ? "falta el nombre" : null;

  function guardar() {
    const persona = nombre.trim();
    datos.agregarEmpleado({ nombre: persona, rol });
    avisarExito(`Listo. ${persona} ya puede quedar como responsable de un caso.`);
    setNombre("");
    setRol("tecnico");
    setAbierto(false);
  }

  function sacar(persona) {
    const suyos = casos.filter((c) => c.responsable_id === persona.id && estaAbierto(c));
    datos.eliminarEmpleado(persona.id);
    avisarExito(
      suyos.length
        ? `${persona.nombre} salió del equipo. Sus ${suyos.length} ${suyos.length === 1 ? "caso quedó" : "casos quedaron"} sin responsable.`
        : `${persona.nombre} salió del equipo.`
    );
    setSacando(null);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">Equipo</h1>
          <p className="mt-1 max-w-[65ch] text-tinta-media">
            Quién está trabajando en qué. No hace falta que tengan cuenta: alcanza con
            anotarlos para poder asignarles un caso.
          </p>
        </div>
        <Boton icono="persona-mas" onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cerrar el alta" : "Sumar a alguien"}
        </Boton>
      </div>

      {abierto && (
        <Tarjeta className="mb-8 max-w-[560px]">
          <TituloSeccion>Alguien nuevo en el equipo</TituloSeccion>
          <Campo
            id="nuevo-nombre"
            etiqueta="Cómo se llama"
            ayuda="Como lo vas a reconocer en la lista de casos. Ejemplo: Diego."
            autoComplete="off"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />

          <div className="mb-6">
            <label htmlFor="nuevo-rol" className="block font-bold text-cuerpo">
              Qué hace
            </label>
            <p className="mt-1 text-apoyo text-tinta-suave">
              Por ahora sirve para saber quién es quién. Los permisos vienen después.
            </p>
            <select
              id="nuevo-rol"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="mt-2 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
            >
              {ORDEN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {etiquetaRol(rubro, r)}
                </option>
              ))}
            </select>
          </div>

          <Boton variante="principal" icono="check" motivo={motivo} onClick={guardar}>
            Sumarlo al equipo
          </Boton>
        </Tarjeta>
      )}

      {empleados.length === 0 ? (
        <Vacio icono="personas" titulo="Todavía no hay nadie cargado">
          Sumá a las personas que atienden los trabajos y vas a poder asignarles casos.
        </Vacio>
      ) : (
        <ul className="mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {empleados.map((e) => {
            const suyos = casos.filter((c) => c.responsable_id === e.id && estaAbierto(c));
            return (
              <li key={e.id}>
                <Tarjeta className="h-full">
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 items-center justify-center rounded-full bg-superficie text-tinta-media">
                      <Icono nombre="persona" />
                    </span>
                    <p className="font-bold text-subtitulo">{e.nombre}</p>
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor={`rol-${e.id}`}
                      className="block font-bold text-etiqueta text-tinta-media"
                    >
                      Qué hace
                    </label>
                    <select
                      id={`rol-${e.id}`}
                      value={e.rol}
                      onChange={(ev) => {
                        datos.cambiarRolEmpleado(e.id, ev.target.value);
                        avisarExito(
                          `${e.nombre} ahora figura como ${etiquetaRol(rubro, ev.target.value).toLowerCase()}.`
                        );
                      }}
                      className="mt-1 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
                    >
                      {ORDEN_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {etiquetaRol(rubro, r)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className="mt-4 text-tinta-media">
                    {suyos.length === 0
                      ? "No tiene ningún caso ahora."
                      : `Tiene ${suyos.length} ${suyos.length === 1 ? "caso" : "casos"} sin cerrar.`}
                  </p>

                  {suyos.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {suyos.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/casos/${c.id}`}
                            className="flex min-h-12 items-center gap-2 text-azul"
                          >
                            <Icono nombre="carpeta" className="size-5" />
                            Caso {c.numero} · {c.servicio}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {sacando === e.id ? (
                    <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                      <p className="font-bold text-cuerpo">¿Sacar a {e.nombre} del equipo?</p>
                      <p className="mt-1 text-tinta-media">
                        {suyos.length
                          ? `Sus ${suyos.length} ${suyos.length === 1 ? "caso queda" : "casos quedan"} sin responsable. No se borra ningún caso.`
                          : "No tiene casos abiertos, así que no cambia nada más."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Boton variante="peligro" icono="tacho" onClick={() => sacar(e)}>
                          Sacar del equipo
                        </Boton>
                        <Boton variante="plano" onClick={() => setSacando(null)}>
                          Dejarlo
                        </Boton>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <Boton variante="plano" icono="tacho" onClick={() => setSacando(e.id)}>
                        Sacar del equipo
                      </Boton>
                    </div>
                  )}
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      {sinAsignar.length > 0 && (
        <>
          <TituloSeccion>Casos que no tiene nadie</TituloSeccion>
          <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
            {sinAsignar.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-borde p-4 last:border-b-0"
              >
                <div>
                  <Link href={`/casos/${c.id}`} className="font-bold text-azul">
                    Caso {c.numero}
                  </Link>
                  <p className="text-tinta-media">{c.servicio}</p>
                </div>
                <ChipEstado estado={c.estado} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
