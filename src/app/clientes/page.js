"use client";

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { estaAbierto } from "@/lib/estados";
import { telefonoValido } from "@/lib/validaciones";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

export default function Clientes() {
  const { cargando, clientes, casos, agregarCliente, avisarExito } = useDatos();
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tocado, setTocado] = useState(false);
  useTitulo("Clientes");

  if (cargando) return <Cargando />;

  const texto = busqueda.trim().toLowerCase();
  const visibles = clientes
    .filter((c) => !texto || c.nombre.toLowerCase().includes(texto) || (c.telefono ?? "").includes(texto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const errorTelefono =
    tocado && telefono.trim() && !telefonoValido(telefono)
      ? "El teléfono no es válido. Escribilo con característica y sin el 0 ni el 15:"
      : null;

  const motivo = !nombre.trim()
    ? "falta el nombre"
    : !telefono.trim() || !telefonoValido(telefono)
      ? "falta el teléfono"
      : null;

  function guardar() {
    agregarCliente({ nombre: nombre.trim(), telefono: telefono.trim() });
    avisarExito(`Listo. ${nombre.trim()} ya está en la lista de clientes.`);
    setNombre("");
    setTelefono("");
    setTocado(false);
    setAbierto(false);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">Clientes</h1>
          <p className="mt-1 text-tinta-media">
            Todo el que alguna vez trajo un trabajo, con su teléfono a mano.
          </p>
        </div>
        <Boton icono="persona-mas" onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cerrar el alta" : "Dar de alta un cliente"}
        </Boton>
      </div>

      {abierto && (
        <Tarjeta className="mb-8 max-w-[560px]">
          <TituloSeccion>Nuevo cliente</TituloSeccion>
          <Campo
            id="nuevo-nombre"
            etiqueta="Nombre del cliente"
            ayuda="Como lo vas a buscar después. Ejemplo: Marcela Suárez."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Campo
            id="nuevo-telefono"
            etiqueta="Teléfono del cliente"
            ayuda="Con característica, sin el 0 ni el 15."
            error={errorTelefono}
            ejemplo="341 456 7890"
            exito={
              telefono.trim() && telefonoValido(telefono)
                ? "Listo. Le vamos a poder avisar por WhatsApp."
                : null
            }
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onBlur={() => setTocado(true)}
            inputMode="tel"
          />
          <Boton variante="principal" icono="check" motivo={motivo} onClick={guardar}>
            Guardar el cliente
          </Boton>
        </Tarjeta>
      )}

      <label htmlFor="buscar-cliente" className="block font-bold text-cuerpo">
        Buscar un cliente
      </label>
      <p className="mt-1 text-apoyo text-tinta-suave">Por nombre o por teléfono.</p>
      <input
        id="buscar-cliente"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Marcela, 341…"
        className="mt-2 mb-6 block min-h-12 w-full max-w-[560px] rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo placeholder:text-tinta-suave"
      />

      {visibles.length === 0 ? (
        <Vacio icono="persona" titulo="Todavía no hay clientes cargados">
          Cuando abras un caso, el cliente se da de alta solo.
        </Vacio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((cliente) => {
            const suyos = casos.filter((c) => c.cliente_id === cliente.id);
            const abiertos = suyos.filter(estaAbierto).length;
            return (
              <li key={cliente.id}>
                <Tarjeta className="h-full">
                  <p className="font-bold text-subtitulo">{cliente.nombre}</p>
                  {cliente.telefono && (
                    <a
                      href={`tel:${cliente.telefono.replace(/\s/g, "")}`}
                      className="mt-1 inline-flex min-h-12 items-center gap-2 text-azul"
                    >
                      <Icono nombre="telefono" className="size-5" />
                      {cliente.telefono}
                    </a>
                  )}
                  <p className="mt-1 text-tinta-media">
                    {suyos.length} {suyos.length === 1 ? "caso" : "casos"}
                    {abiertos > 0 && ` · ${abiertos} sin cerrar`}
                  </p>
                  {cliente.notas && (
                    <p className="mt-2 text-apoyo text-tinta-suave">{cliente.notas}</p>
                  )}
                  {suyos.length > 0 && (
                    <Link
                      href={`/casos/${suyos[0].id}`}
                      className="mt-3 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
                    >
                      <Icono nombre="carpeta" className="size-5" />
                      Ver su último caso
                    </Link>
                  )}
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
