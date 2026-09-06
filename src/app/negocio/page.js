"use client";

// "Mi negocio" — acá vive el preset del rubro.
//
// Cambiar de rubro renombra los estados y trae otros motivos frecuentes.
// No toca los datos: los casos siguen diciendo lo que decían. Es un
// diccionario de etiquetas, no un motor de configuración.

import { useRouter } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { ORDEN_ESTADOS, ESTADOS } from "@/lib/estados";
import { RUBROS, preset } from "@/lib/presets";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, Tarjeta, TituloSeccion } from "@/componentes/ui";

export default function MiNegocio() {
  const router = useRouter();
  const datos = useDatos();
  const { cargando, negocio, fuente, casos, clientes, insumos, turnos } = datos;
  const { esDemo, usuario, cerrarSesion } = useAuth();
  useTitulo("Mi negocio");

  async function salir() {
    await cerrarSesion();
    router.replace("/iniciar-sesion");
  }

  if (cargando) return <Cargando />;

  const actual = preset(negocio?.rubro);

  return (
    <>
      <h1 className="text-pantalla">Mi negocio</h1>
      <p className="mt-1 mb-8 max-w-[65ch] text-tinta-media">
        Cómo se llaman las cosas en tu oficio, y qué tenés cargado hasta ahora.
      </p>

      <Tarjeta className="mb-8">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-campo bg-azul text-white">
            <Icono nombre="tienda" />
          </span>
          <div>
            <p className="font-titulo font-extrabold text-subtitulo">{negocio?.nombre}</p>
            <p className="text-tinta-media">{actual.nombre}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            ["Casos", casos.length],
            ["Clientes", clientes.length],
            ["Insumos", insumos.length],
            ["Turnos", turnos.length],
          ].map(([que, cuanto]) => (
            <div key={que}>
              <dt className="text-apoyo text-tinta-suave">{que}</dt>
              <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">{cuanto}</dd>
            </div>
          ))}
        </dl>
      </Tarjeta>

      <TituloSeccion>El rubro de tu negocio</TituloSeccion>
      <p className="-mt-2 mb-4 max-w-[65ch] text-tinta-media">
        Cambia cómo se llaman los estados y qué motivos te ofrecemos al abrir un caso.
        Los casos que ya tenés no se tocan.
      </p>

      <ul className="mb-8 grid gap-3 sm:grid-cols-3">
        {RUBROS.map((r) => {
          const elegido = r.clave === negocio?.rubro;
          return (
            <li key={r.clave}>
              <button
                type="button"
                aria-pressed={elegido}
                onClick={() => datos.cambiarRubro(r.clave)}
                className={[
                  "h-full w-full cursor-pointer rounded-tarjeta border-2 p-4 text-left sm:p-6",
                  elegido
                    ? "border-azul bg-azul-claro"
                    : "border-borde bg-tarjeta hover:bg-superficie",
                ].join(" ")}
              >
                <span
                  className={`flex items-center gap-2 font-bold text-subtitulo ${elegido ? "text-azul" : ""}`}
                >
                  {elegido && <Icono nombre="listo" className="size-6" />}
                  {r.nombre}
                </span>
                <span className="mt-1 block text-tinta-media">{r.queEs}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <TituloSeccion>Cómo se llaman los estados en tu rubro</TituloSeccion>
      <ul className="mb-12 overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
        {ORDEN_ESTADOS.map((estado) => {
          const e = ESTADOS[estado];
          return (
            <li
              key={estado}
              className="flex flex-wrap items-center gap-4 border-b border-borde p-4 last:border-b-0"
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-etiqueta ${e.fondo} ${e.texto}`}
              >
                <Icono nombre={e.icono} className="size-5" />
                {actual.etiquetas[estado]}
              </span>
              <p className="min-w-0 flex-1 text-tinta-media">{e.significado}</p>
            </li>
          );
        })}
      </ul>

      <TituloSeccion>De dónde salen los datos</TituloSeccion>
      <Tarjeta>
        {fuente === "supabase" ? (
          <>
            <p className="flex items-center gap-2 font-bold text-completo">
              <Icono nombre="listo" className="size-6" />
              Conectado a la base de Supabase
            </p>
            <p className="mt-2 text-tinta-media">
              Todo lo que cargues queda guardado en la base y lo ven los demás. Para volver
              al estado inicial, corré <code className="rounded bg-superficie px-1.5">supabase/002_seed.sql</code>.
            </p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 font-bold text-espera">
              <Icono nombre="alerta" className="size-6" />
              Estás viendo los datos de ejemplo
            </p>
            <p className="mt-2 max-w-[65ch] text-tinta-media">
              Se guardan en este navegador, así que lo que cargues sobrevive a un F5 pero no
              lo ve nadie más. Para conectar la base de verdad, copiá{" "}
              <code className="rounded bg-superficie px-1.5">.env.example</code> a{" "}
              <code className="rounded bg-superficie px-1.5">.env.local</code> con las dos
              claves de Supabase.
            </p>
            <div className="mt-4">
              <Boton icono="deshacer" onClick={datos.reiniciar}>
                Volver a los datos de ejemplo
              </Boton>
            </div>
          </>
        )}
      </Tarjeta>

      <TituloSeccion className="mt-12">Tu cuenta</TituloSeccion>
      <Tarjeta>
        {esDemo ? (
          <>
            <p className="flex items-center gap-2 font-bold text-espera">
              <Icono nombre="alerta" className="size-6" />
              Estás en el modo de ejemplo
            </p>
            <p className="mt-2 max-w-[65ch] text-tinta-media">
              Los datos son de muestra y viven en este navegador. Al salir volvés a la
              pantalla de entrada.
            </p>
            <div className="mt-4">
              <Boton icono="salir" onClick={salir}>
                Salir del modo de ejemplo
              </Boton>
            </div>
          </>
        ) : (
          <>
            <p className="text-tinta-media">
              Entraste con{" "}
              <span className="font-bold text-tinta">{usuario?.email ?? "tu cuenta"}</span>.
            </p>
            <div className="mt-4">
              <Boton icono="salir" onClick={salir}>
                Cerrar sesión
              </Boton>
            </div>
          </>
        )}
      </Tarjeta>
    </>
  );
}
