"use client";

// "Abrir un caso nuevo" (cartilla, sección 08).
//
// La usa el mostrador, apurado, con el cliente enfrente.
// Objetivo: menos de un minuto.
//
// Cuatro campos como máximo: cliente, teléfono, qué necesita y quién lo va a
// atender. El resto se completa después.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { preset } from "@/lib/presets";
import { telefonoValido } from "@/lib/validaciones";
import { Boton, BotonPrincipalFijo, Campo, Cargando } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function CasoNuevo() {
  const router = useRouter();
  const { cargando, clientes, empleados, negocio, abrirCaso, avisarExito } = useDatos();
  useTitulo("Abrir un caso nuevo");

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [servicio, setServicio] = useState("");
  const [responsable, setResponsable] = useState("");
  const [tocado, setTocado] = useState({});

  if (cargando) return <Cargando />;

  const motivos = preset(negocio?.rubro).motivos;
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
      : !servicio.trim()
        ? "falta qué necesita"
        : null;

  function guardar() {
    const caso = abrirCaso({
      clienteId: yaEsCliente?.id ?? null,
      nombreCliente: nombre.trim(),
      telefono: telefono.trim(),
      servicio: servicio.trim(),
      responsableId: responsable || null,
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
      <p className="mt-1 mb-8 max-w-[65ch] text-tinta-media">
        Con esto alcanza para empezar. El diagnóstico y el presupuesto se cargan después.
      </p>

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
