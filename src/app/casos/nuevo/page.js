"use client";

// "Abrir un caso nuevo" (cartilla, sección 08).
//
// La usa el mostrador, apurado, con el cliente enfrente.
// Objetivo: menos de un minuto.
//
// La cartilla pide cuatro campos: cliente, teléfono, qué necesita y quién lo
// va a atender. Acá van cinco, y el quinto es a propósito: el identificador
// del rubro —la patente, el DNI, el número de serie— es lo más certero que
// tenemos para reconocer el caso después. Un nombre se escribe de diez formas
// distintas; una patente, no. Y se lo tiene enfrente al abrirlo, así que no
// cuesta el minuto que la cartilla quiere cuidar.
//
// Sigue dentro de la regla general de la sección 05: nunca más de seis campos.

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { preset, comoSeIdentifica } from "@/lib/presets";
import { telefonoValido } from "@/lib/validaciones";
import { horaYMinutos } from "@/lib/fechas";
import { Boton, BotonPrincipalFijo, Campo, Cargando } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

// useSearchParams necesita un límite de Suspense para que la pantalla se
// pueda seguir generando estática. Adentro no hay nada que esperar: el turno
// se lee del navegador y el formulario se dibuja igual.
export default function CasoNuevo() {
  return (
    <Suspense fallback={<Cargando />}>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  const router = useRouter();
  const { cargando, clientes, empleados, turnos, negocio, abrirCaso, avisarExito } =
    useDatos();
  useTitulo("Abrir un caso nuevo");

  // El caso puede salir de un turno: alguien pidió hora, vino, y esto es lo
  // que venía a hacer. En ese caso el nombre, el teléfono y el motivo ya
  // están anotados y no se vuelven a pedir (cartilla, sección 08: el alta
  // tiene que entrar en un minuto).
  const idTurno = useSearchParams().get("turno");
  const turno = turnos.find((t) => t.id === idTurno) ?? null;
  const delTurno = turno ? clientes.find((c) => c.id === turno.cliente_id) : null;

  const [nombre, setNombre] = useState(delTurno?.nombre ?? "");
  const [telefono, setTelefono] = useState(delTurno?.telefono ?? "");
  const [identificador, setIdentificador] = useState("");
  const [servicio, setServicio] = useState(turno?.motivo ?? "");
  const [responsable, setResponsable] = useState("");
  const [tocado, setTocado] = useState({});

  if (cargando) return <Cargando />;

  const motivos = preset(negocio?.rubro).motivos;
  const comoIdent = comoSeIdentifica(negocio?.rubro);
  const yaEsCliente = clientes.find(
    (c) => c.nombre.toLowerCase() === nombre.trim().toLowerCase()
  );

  const errorTelefono =
    tocado.telefono && telefono.trim() && !telefonoValido(telefono)
      ? "El teléfono no es válido. Escribilo con característica y sin el 0 ni el 15:"
      : null;

  // El botón apagado dice por qué está apagado, no sólo que lo está.
  const motivoApagado = !nombre.trim()
    ? "falta el nombre"
    : !telefono.trim() || !telefonoValido(telefono)
      ? "falta el teléfono"
      : !identificador.trim()
        ? `falta ${comoIdent.enFrase}`
        : !servicio.trim()
          ? "falta qué necesita"
          : null;

  function guardar() {
    const caso = abrirCaso({
      clienteId: yaEsCliente?.id ?? null,
      nombreCliente: nombre.trim(),
      telefono: telefono.trim(),
      servicio: servicio.trim(),
      identificador: identificador.trim(),
      responsableId: responsable || null,
      turnoId: turno?.id ?? null,
    });
    avisarExito(`Listo. El caso de ${nombre.trim()} ya está en la lista de hoy.`);
    router.push(`/casos/${caso.id}`);
  }

  return (
    <>
      <Link
        href="/"
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        Volver a los casos
      </Link>

      <h1 className="text-pantalla">Abrir un caso nuevo</h1>
      <p className="mt-1 max-w-[65ch] text-tinta-media">
        Con esto alcanza para empezar. El diagnóstico y el presupuesto se cargan después.
      </p>
      {turno && (
        <p className="mt-3 max-w-[65ch] rounded-tarjeta border border-borde bg-superficie p-4 text-tinta-media">
          Sale del turno de {horaYMinutos(turno.empieza_en)}. Lo que ya estaba
          anotado viene cargado; revisalo por si cambió algo. Al guardar, el
          turno queda marcado como que la persona vino.
        </p>
      )}
      <div className="mb-8" />

      <div className="max-w-[560px]">
        <Campo
          id="cliente"
          etiqueta="Nombre del cliente"
          ayuda="Como lo vas a buscar después. Ejemplo: Marcela Suárez."
          exito={yaEsCliente ? `Ya es cliente. Le vamos a sumar este caso a ${yaEsCliente.nombre}.` : null}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          list="clientes-conocidos"
          autoComplete="off"
        />
        <datalist id="clientes-conocidos">
          {clientes.map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>

        <Campo
          id="telefono"
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
          onBlur={() => setTocado((t) => ({ ...t, telefono: true }))}
          inputMode="tel"
          autoComplete="tel"
        />

        {/* El identificador va acá y no "después": es lo más certero que
            tenemos para reconocer el caso, y se lo tiene enfrente. La
            sección 08 de la cartilla pide cuatro campos en el alta; este es
            un quinto, decidido a propósito. */}
        <Campo
          id="identificador"
          etiqueta={comoIdent.nombre}
          ayuda={`Con esto lo vas a encontrar después, sin depender de cómo se escriba el nombre. Ejemplo: ${comoIdent.ejemplo}.`}
          autoComplete="off"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
        />

        <div className="mb-6">
          <label htmlFor="servicio" className="block font-bold text-cuerpo">
            Qué necesita
          </label>
          <p className="mt-1 text-apoyo text-tinta-suave">
            Con las palabras del cliente. Podés elegir uno de los de siempre.
          </p>
          <input
            id="servicio"
            value={servicio}
            onChange={(e) => setServicio(e.target.value)}
            className="mt-2 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo placeholder:text-tinta-suave"
            placeholder="Un ruido raro cuando frena"
          />
          <ul className="mt-3 flex flex-wrap gap-2">
            {motivos.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  onClick={() => setServicio(m)}
                  className={[
                    "min-h-12 cursor-pointer rounded-full border-2 px-4 text-etiqueta",
                    servicio === m
                      ? "border-azul bg-azul-claro font-bold text-azul"
                      : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
                  ].join(" ")}
                >
                  {m}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <label htmlFor="responsable" className="block font-bold text-cuerpo">
            Quién lo va a atender
          </label>
          <p className="mt-1 text-apoyo text-tinta-suave">
            Si todavía no sabés, dejalo sin asignar y lo elegís después.
          </p>
          <select
            id="responsable"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            className="mt-2 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
          >
            <option value="">Todavía no sé</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>

        <BotonPrincipalFijo icono="check" motivo={motivoApagado} onClick={guardar}>
          Guardar el caso
        </BotonPrincipalFijo>
      </div>
    </>
  );
}
