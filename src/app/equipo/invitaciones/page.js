"use client";

// "Invitar a alguien" (SCRUM-34, 36, 47 y 48).
//
// Se crea un link con un código y se comparte por donde quieras: copiado,
// por WhatsApp o por mail. El mail lo manda tu propio correo, no el sistema:
// que lo mandara el sistema pediría una clave secreta y código de servidor,
// que este proyecto no tiene.
//
// Sólo el dueño puede invitar, y eso lo hace cumplir la base (007_invitaciones.sql), no
// esconder el botón.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { ORDEN_ROLES, etiquetaRol } from "@/lib/presets";
import { cuando } from "@/lib/fechas";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando, Tarjeta, TituloPantalla, TituloSeccion, Vacio } from "@/componentes/ui";

export default function Invitaciones() {
  const datos = useDatos();
  const { cargando, negocio, invitaciones, avisarExito } = datos;
  const { esDemo, usuario } = useAuth();
  useTitulo("Invitar a alguien");

  const [rol, setRol] = useState("tecnico");
  const [usos, setUsos] = useState("1");
  const [dias, setDias] = useState("7");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState(null);
  const [reciente, setReciente] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [origen, setOrigen] = useState("");

  // El navegador es el único que sabe en qué dirección está corriendo.
  useEffect(() => setOrigen(window.location.origin), []);

  if (cargando) return <Cargando />;

  const rubro = negocio?.rubro;
  const esDuenio = usuario?.rol === "duenio";
  const linkDe = (codigo) => `${origen}/unirme/${codigo}`;
  const mensajeDe = (codigo) =>
    `Te invito a sumarte a ${negocio?.nombre} para que veamos juntos los trabajos. Entrá acá: ${linkDe(codigo)}`;

  const vivas = invitaciones.filter(
    (i) => !i.anulada && new Date(i.vence_en) > new Date() && i.usos < i.usos_maximos
  );

  const motivo = creando
    ? "creando el link…"
    : Number(usos) < 1
      ? "el link tiene que servir al menos una vez"
      : Number(dias) < 1
        ? "tiene que durar al menos un día"
        : null;

  async function crear() {
    setError(null);
    setCreando(true);
    const r = await datos.crearInvitacion({ rol, usosMaximos: usos, dias });
    setCreando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setReciente(r.invitacion);
    setCopiado(false);
  }

  async function copiar(codigo) {
    try {
      await navigator.clipboard.writeText(linkDe(codigo));
      setCopiado(true);
    } catch {
      setError("El navegador no dejó copiar. Marcá el link con el dedo y copialo a mano.");
    }
  }

  const volver = (
    <Link
      href="/equipo"
      className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
    >
      <Icono nombre="volver" />
      Volver al equipo
    </Link>
  );

  if (esDemo) {
    return (
      <>
        {volver}
        <TituloPantalla>Invitar a alguien</TituloPantalla>
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">
            En el modo de ejemplo no se puede invitar: hace falta que las dos personas
            tengan una cuenta de verdad.
          </p>
        </Tarjeta>
      </>
    );
  }

  if (!esDuenio) {
    return (
      <>
        {volver}
        <TituloPantalla>Invitar a alguien</TituloPantalla>
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">
            Sumar gente al negocio lo hace el dueño. Pedile a quien creó el negocio que
            te mande el link.
          </p>
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      {volver}
      <TituloPantalla apoyo="Le pasás un link y entra con su propia cuenta.">
        Invitar a alguien
      </TituloPantalla>

      <Tarjeta className="mb-12 max-w-[560px]">
        <TituloSeccion>Un link nuevo</TituloSeccion>

        <div className="mb-6">
          <label htmlFor="rol" className="block font-bold text-cuerpo">
            Con qué rol entra
          </label>
          <p className="mt-1 text-apoyo text-tinta-suave">
            Lo podés cambiar después desde el equipo.
          </p>
          <select
            id="rol"
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

        <Campo
          id="usos"
          etiqueta="Cuántas personas pueden usarlo"
          ayuda="Con 1 alcanza para invitar a una sola persona."
          type="number"
          inputMode="numeric"
          min="1"
          value={usos}
          onChange={(e) => setUsos(e.target.value)}
        />

        <Campo
          id="dias"
          etiqueta="Cuántos días vale"
          ayuda="Pasado ese plazo el link deja de servir, aunque no lo haya usado nadie."
          type="number"
          inputMode="numeric"
          min="1"
          value={dias}
          onChange={(e) => setDias(e.target.value)}
        />

        {error && (
          <p className="mb-6 flex items-start gap-2 font-bold text-rojo text-etiqueta">
            <Icono nombre="alerta" className="mt-px size-5" />
            <span>{error}</span>
          </p>
        )}

        <Boton variante="principal" icono="persona-mas" motivo={motivo} onClick={crear}>
          Crear el link
        </Boton>

        {reciente && (
          <div className="mt-6 rounded-tarjeta bg-superficie p-4">
            <p className="font-bold text-cuerpo">Listo. Pasale este link:</p>
            <p className="mt-2 break-all rounded-campo bg-tarjeta p-3 text-apoyo text-tinta-media">
              {linkDe(reciente.codigo)}
            </p>
            {copiado && (
              <p className="mt-2 flex items-center gap-1.5 font-bold text-etiqueta text-completo">
                <Icono nombre="listo" className="size-5" />
                Copiado. Pegalo donde quieras.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <Boton icono="copiar" onClick={() => copiar(reciente.codigo)}>
                Copiar el link
              </Boton>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(mensajeDe(reciente.codigo))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-cuerpo text-azul hover:bg-azul-claro"
              >
                <Icono nombre="chat" />
                Mandar por WhatsApp
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent(`Te invito a ${negocio?.nombre}`)}&body=${encodeURIComponent(mensajeDe(reciente.codigo))}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-cuerpo text-azul hover:bg-azul-claro"
              >
                <Icono nombre="sobre" />
                Mandar por mail
              </a>
            </div>
          </div>
        )}
      </Tarjeta>

      <TituloSeccion>Links que andan</TituloSeccion>
      {vivas.length === 0 ? (
        <Vacio icono="persona-mas" titulo="No hay ningún link dando vueltas">
          Cuando crees uno va a aparecer acá, para que puedas volver a copiarlo o darlo
          de baja.
        </Vacio>
      ) : (
        <ul className="grid gap-3">
          {vivas.map((i) => (
            <li key={i.id}>
              <Tarjeta>
                <p className="font-bold text-subtitulo">
                  Entra como {etiquetaRol(rubro, i.rol).toLowerCase()}
                </p>
                <p className="mt-1 text-tinta-media">
                  Lo usaron {i.usos} de {i.usos_maximos}{" "}
                  {i.usos_maximos === 1 ? "vez" : "veces"} · vence el{" "}
                  {cuando(i.vence_en).toLowerCase()}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Boton icono="copiar" onClick={() => copiar(i.codigo)}>
                    Copiar el link
                  </Boton>
                  <Boton
                    variante="plano"
                    icono="cruz"
                    onClick={() => {
                      datos.anularInvitacion(i.id);
                      avisarExito("Listo. Ese link ya no sirve para entrar.");
                    }}
                  >
                    Dar de baja
                  </Boton>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
