"use client";

// "Crear tu negocio" (SCRUM-12).
//
// Segundo y último paso del alta: nombre del negocio y preset del rubro.
// El preset renombra los estados y decide qué módulos vienen prendidos
// (SCRUM-23/25). No se puede seguir sin elegir un rubro (SCRUM-24).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, invitacionPendiente } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { RUBROS, preset } from "@/lib/presets";
import { modulosDe } from "@/lib/modulos";
import { Boton, Campo, Tarjeta, TituloPantalla } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function CrearNegocio() {
  const router = useRouter();
  const { esDemo, usuario, anotarNegocio } = useAuth();
  const { crearNegocio } = useDatos();
  useTitulo("Crear tu negocio");

  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);
  // Si llegó por una invitación y se creó la cuenta en el camino, capaz no
  // quiere un negocio propio sino sumarse al que lo invitó.
  const [invitacion, setInvitacion] = useState(null);

  useEffect(() => setInvitacion(invitacionPendiente()), []);

  if (esDemo) {
    return <YaHayNegocio texto="Estás en el modo de ejemplo, que ya trae un negocio armado." />;
  }
  if (usuario?.negocio_id) {
    return <YaHayNegocio texto="Ya tenés un negocio creado." />;
  }

  const elegido = rubro ? preset(rubro) : null;
  const motivo = !nombre.trim()
    ? "falta el nombre"
    : !rubro
      ? "elegí un rubro"
      : enviando
        ? "creando…"
        : null;

  async function crear() {
    setErrorGeneral(null);
    setEnviando(true);
    const creado = await crearNegocio({ nombre: nombre.trim(), rubro });
    setEnviando(false);
    if (!creado.ok) {
      setErrorGeneral(creado.error);
      return;
    }
    anotarNegocio(creado.id);
    router.replace("/");
  }

  return (
    <>
      <TituloPantalla apoyo="Un paso y entrás. Todo esto lo cambiás después desde Mi negocio.">
        Crear tu negocio
      </TituloPantalla>

      {invitacion && (
        <Tarjeta className="mb-6">
          <p className="flex items-start gap-2 font-bold text-cuerpo">
            <Icono nombre="personas" className="mt-0.5 size-6" />
            <span>¿Venías por una invitación?</span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            Si alguien te invitó a su negocio, no hace falta que crees uno propio.
          </p>
          <div className="mt-4">
            <Link
              href={`/unirme/${invitacion}`}
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="volver" />
              Volver a la invitación
            </Link>
          </div>
        </Tarjeta>
      )}

      <Tarjeta>
        <Campo
          id="nombre"
          etiqueta="¿Cómo se llama tu negocio?"
          ayuda="Como lo van a ver vos y tu equipo. Ejemplo: Taller Sur."
          autoComplete="off"
          value={nombre}
          onChange={(e) => {
            setErrorGeneral(null);
            setNombre(e.target.value);
          }}
        />

        <p className="font-bold text-cuerpo">¿A qué se dedica?</p>
        <p className="mt-1 mb-3 text-apoyo text-tinta-suave">
          Elegí el más parecido. Cambia cómo se llaman los estados y qué te ofrece el
          sistema; después lo ajustás.
        </p>
        <ul className="grid gap-3">
          {RUBROS.map((r) => {
            const sel = r.clave === rubro;
            return (
              <li key={r.clave}>
                <button
                  type="button"
                  aria-pressed={sel}
                  onClick={() => {
                    setErrorGeneral(null);
                    setRubro(r.clave);
                  }}
                  className={[
                    "flex w-full flex-col rounded-tarjeta border-2 p-4 text-left",
                    sel
                      ? "border-azul bg-azul-claro"
                      : "border-borde bg-tarjeta hover:bg-superficie",
                  ].join(" ")}
                >
                  <span
                    className={`flex items-center gap-2 font-bold text-subtitulo ${sel ? "text-azul" : ""}`}
                  >
                    {sel && <Icono nombre="listo" className="size-6" />}
                    {r.nombre}
                  </span>
                  <span className="mt-1 text-tinta-media">{r.queEs}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {elegido && (
          <div className="mt-6 rounded-tarjeta bg-superficie p-4">
            <p className="font-bold text-cuerpo">Con «{elegido.nombre}» vas a arrancar con:</p>
            <ul className="mt-2 flex flex-col gap-2">
              {modulosDe(elegido.modulos).map((m) => (
                <li key={m.clave} className="flex items-start gap-2 text-tinta-media">
                  <Icono nombre={m.icono} className="mt-0.5 size-5" />
                  <span>
                    <span className="font-bold text-tinta">{m.nombre}</span> · {m.descripcion}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-apoyo text-tinta-suave">
              Los prendés y apagás cuando quieras desde Mi negocio.
            </p>
          </div>
        )}

        {errorGeneral && (
          <p className="mt-6 flex items-start gap-2 font-bold text-rojo text-etiqueta">
            <Icono nombre="alerta" className="mt-px size-5" />
            <span>{errorGeneral}</span>
          </p>
        )}

        <div className="mt-6">
          <Boton
            variante="principal"
            icono="check"
            motivo={motivo}
            onClick={crear}
            className="min-h-14 w-full"
          >
            Crear el negocio
          </Boton>
        </div>
      </Tarjeta>
    </>
  );
}

function YaHayNegocio({ texto }) {
  return (
    <>
      <TituloPantalla>Crear tu negocio</TituloPantalla>
      <Tarjeta>
        <p className="text-tinta-media">{texto}</p>
        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
          >
            <Icono nombre="volver" />
            Ir a Hoy
          </Link>
        </div>
      </Tarjeta>
    </>
  );
}
