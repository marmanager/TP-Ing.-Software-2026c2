"use client";

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede } from "@/lib/permisos";
import { estaAbierto } from "@/lib/estados";
import { paisInicial, telefonoIncompleto, telefonoLegible, telefonoParaLlamar } from "@/lib/telefono";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";
import CampoTelefono, { useTelefono } from "@/componentes/CampoTelefono";

export default function Clientes() {
  const { cargando, clientes, casos, negocio, agregarCliente, avisarExito } = useDatos();
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario?.rol, "cargarDatos");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const paisNegocio = paisInicial(negocio);
  const tel = useTelefono("", paisNegocio);
  const [tocado, setTocado] = useState(false);
  useTitulo("Clientes");

  if (cargando) return <Cargando />;

  const texto = busqueda.trim().toLowerCase();
  const visibles = clientes
    .filter((c) => !texto || c.nombre.toLowerCase().includes(texto) || porTelefono(c.telefono, texto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // Quien pidió un turno y todavía no vino va aparte: la lista de clientes
  // sirve para encontrar a alguien que ya estuvo, y mezclarlos la ensucia.
  // Pasan a la lista de arriba solos, cuando se les abre el primer caso.
  const vinieron = visibles.filter((c) => c.confirmado !== false);
  const porVenir = visibles.filter((c) => c.confirmado === false);

  const errorTelefono = tocado && !tel.vacio && !tel.armado.ok ? tel.armado.mensaje : null;

  const motivo = !nombre.trim()
    ? "falta el nombre"
    : !tel.armado.ok
      ? "falta el teléfono"
      : null;

  function guardar() {
    agregarCliente({ nombre: nombre.trim(), telefono: tel.telefono });
    avisarExito(`Listo. ${nombre.trim()} ya está en la lista de clientes.`);
    setNombre("");
    tel.cargar("");
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
        {puedeCargar && (
          <Boton icono="persona-mas" onClick={() => setAbierto((v) => !v)}>
            {abierto ? "Cerrar el alta" : "Dar de alta un cliente"}
          </Boton>
        )}
      </div>

      {abierto && puedeCargar && (
        <Tarjeta className="mb-8 max-w-[560px]">
          <TituloSeccion>Nuevo cliente</TituloSeccion>
          <Campo
            id="nuevo-nombre"
            etiqueta="Nombre del cliente"
            ayuda="Como lo vas a buscar después. Ejemplo: Marcela Suárez."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <CampoTelefono
            id="nuevo-telefono"
            etiqueta="Teléfono del cliente"
            paisPorDefecto={paisNegocio}
            error={errorTelefono}
            exito={tel.armado.ok ? "Listo. Le vamos a poder avisar por WhatsApp." : null}
            valor={tel.valor}
            onChange={tel.setValor}
            onBlur={() => setTocado(true)}
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

      {/* Con las tarjetas en varias columnas no se percibe si el resultado
          son tres o treinta (auditoría, H1). */}
      {texto && clientes.length > 0 && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-tinta-media">
          <span>
            <span className="font-bold text-tinta">{visibles.length}</span>{" "}
            {visibles.length === 1 ? "cliente" : "clientes"} con «{busqueda.trim()}», de{" "}
            {clientes.length}
          </span>
          <Boton variante="plano" icono="cruz" onClick={() => setBusqueda("")}>
            Ver todos
          </Boton>
        </p>
      )}

      {vinieron.length === 0 && porVenir.length === 0 ? (
        <Vacio icono="persona" titulo="Todavía no hay clientes cargados">
          Cuando abras un caso, el cliente se da de alta solo.
        </Vacio>
      ) : (
        <ul className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
          {vinieron.map((cliente) => {
            const suyos = casos.filter((c) => c.cliente_id === cliente.id);
            const abiertos = suyos.filter(estaAbierto).length;
            // El más reciente de verdad: la lista de casos no viene ordenada,
            // y el enlace decía "último" pero abría el primero que hubiera,
            // sin forma de darse cuenta de que era uno viejo (auditoría, H2).
            const ultimo = suyos.reduce(
              (mas, c) => (!mas || new Date(c.abierto_en) > new Date(mas.abierto_en) ? c : mas),
              null
            );
            return (
              <li key={cliente.id}>
                <Tarjeta className="h-full">
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="inline-flex min-h-12 items-center gap-2 font-bold text-subtitulo text-azul"
                  >
                    {cliente.nombre}
                    <Icono nombre="volver" className="size-5 rotate-180" />
                  </Link>
                  {cliente.telefono && <TelefonoDelCliente cliente={cliente} />}
                  <p className="mt-1 text-tinta-media">
                    {suyos.length} {suyos.length === 1 ? "caso" : "casos"}
                    {abiertos > 0 && ` · ${abiertos} sin cerrar`}
                  </p>
                  {cliente.avisos_baja_en && <NoRecibeAvisos />}
                  {cliente.notas && (
                    <p className="mt-2 text-apoyo text-tinta-suave">{cliente.notas}</p>
                  )}
                  {ultimo && (
                    <Link
                      href={`/casos/${ultimo.id}`}
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

      {porVenir.length > 0 && (
        <>
          <TituloSeccion className="mt-12">Todavía no vinieron</TituloSeccion>
          <p className="-mt-2 mb-4 max-w-[65ch] text-tinta-media">
            Pidieron un turno pero todavía no aparecieron. Pasan a la lista de arriba
            solos cuando les abras el primer caso.
          </p>
          <ul className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
            {porVenir.map((cliente) => (
              <li key={cliente.id}>
                <Tarjeta className="h-full border-dashed">
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="inline-flex min-h-12 items-center gap-2 font-bold text-subtitulo text-azul"
                  >
                    {cliente.nombre}
                    <Icono nombre="volver" className="size-5 rotate-180" />
                  </Link>
                  {cliente.telefono && <TelefonoDelCliente cliente={cliente} />}
                  <p className="mt-1 flex items-center gap-1.5 text-etiqueta text-tinta-suave">
                    <Icono nombre="reloj" className="size-5" />
                    Tiene turno, todavía no vino
                  </p>
                  {cliente.avisos_baja_en && <NoRecibeAvisos />}
                </Tarjeta>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// Que pidió no recibir avisos (R-8b), para verlo sin abrir cada ficha. Es un
// dato, no una alerta: color de apoyo, con ícono y palabra (cartilla, 02).
function NoRecibeAvisos() {
  return (
    <p data-baja-de-avisos className="mt-1 flex items-center gap-1.5 text-etiqueta text-tinta-suave">
      <Icono nombre="whatsapp" className="size-5" />
      Pidió no recibir avisos
    </p>
  );
}

// Buscar por teléfono: "341 456" encuentra el 5493414567890 guardado.
function porTelefono(telefono, texto) {
  const buscado = texto.replace(/\D/g, "");
  return !!buscado && String(telefono ?? "").replace(/\D/g, "").includes(buscado);
}

// El teléfono legible, con el código separado. Uno de antes, sin país, lo
// dice: así no le llegan los WhatsApp, y se corrige desde la ficha.
function TelefonoDelCliente({ cliente }) {
  return (
    <>
      <a
        href={`tel:${telefonoParaLlamar(cliente.telefono)}`}
        className="mt-1 inline-flex min-h-12 items-center gap-2 text-azul"
      >
        <Icono nombre="telefono" className="size-5" />
        {telefonoLegible(cliente.telefono)}
      </a>
      {telefonoIncompleto(cliente) && (
        <p className="flex items-center gap-1.5 text-etiqueta text-tinta-media">
          <Icono nombre="alerta" className="size-5" />
          Le falta el código de país
        </p>
      )}
    </>
  );
}
