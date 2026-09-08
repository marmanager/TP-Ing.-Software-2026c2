"use client";

// "Mi negocio" — la configuración del negocio (SCRUM-88).
//
// El rubro no se cambia de taquito: se elige al crear el negocio, y acá se
// muestra como un dato. Cambiarlo es posible —alguien se pudo equivocar al
// registrarse— pero pasa por una confirmación que dice qué se toca y qué no.
//
// Los módulos tienen pantalla propia: acá queda el resumen y el enlace.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import { ORDEN_ESTADOS, ESTADOS } from "@/lib/estados";
import { RUBROS, preset } from "@/lib/presets";
import { LISTA_MODULOS } from "@/lib/modulos";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, Tarjeta, TituloSeccion } from "@/componentes/ui";

export default function MiNegocio() {
  const router = useRouter();
  const datos = useDatos();
  const { cargando, negocio, casos, clientes, insumos, turnos } = datos;
  const { esDemo, usuario, cerrarSesion } = useAuth();
  useTitulo("Mi negocio");

  // Cambiar el rubro va en dos pasos: elegir y confirmar.
  const [cambiandoRubro, setCambiandoRubro] = useState(false);
  const [rubroElegido, setRubroElegido] = useState(null);

  async function salir() {
    await cerrarSesion();
    router.replace("/iniciar-sesion");
  }

  if (cargando) return <Cargando />;

  const actual = preset(negocio?.rubro);
  const modulosActivos = negocio?.modulos_activos ?? [];
  // Configurar el negocio es del dueño, y la base también lo rechaza.
  const puedeConfigurar = puede(usuario?.rol, "configurarNegocio");
  const prendidos = LISTA_MODULOS.filter((m) => modulosActivos.includes(m.clave));
  const nuevo = rubroElegido ? preset(rubroElegido) : null;

  function cerrarCambioDeRubro() {
    setCambiandoRubro(false);
    setRubroElegido(null);
  }

  function confirmarRubro() {
    datos.cambiarRubro(rubroElegido);
    datos.avisarExito(`Listo. Tu negocio ahora es ${nuevo.nombre.toLowerCase()}.`);
    cerrarCambioDeRubro();
  }

  return (
    <>
      <h1 className="text-pantalla">Mi negocio</h1>
      <p className="mt-1 mb-8 max-w-[65ch] text-tinta-media">
        Cómo se llaman las cosas en tu oficio, y qué tenés cargado hasta ahora.
      </p>

      <Tarjeta className="mb-12">
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

      <TituloSeccion>Módulos</TituloSeccion>
      <Tarjeta className="mb-12">
        <p className="text-tinta-media">
          Tenés{" "}
          <span className="font-bold text-tinta">
            {prendidos.length} de {LISTA_MODULOS.length}
          </span>{" "}
          módulos prendidos.
        </p>
        <p className="mt-1 max-w-[65ch] text-apoyo text-tinta-suave">
          {prendidos.length
            ? prendidos.map((m) => m.nombre).join(" · ")
            : "Ninguno. Estás usando sólo Inicio, Casos, Clientes y Mi negocio."}
        </p>
        <div className="mt-4">
          <Link
            href="/negocio/modulos"
            className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
          >
            <Icono nombre="cajas" />
            {puedeConfigurar ? "Ver y cambiar los módulos" : "Ver los módulos"}
          </Link>
        </div>
      </Tarjeta>

      <TituloSeccion>El rubro de tu negocio</TituloSeccion>
      <Tarjeta className="mb-12">
        {!cambiandoRubro ? (
          <>
            <p className="max-w-[65ch] text-tinta-media">
              Tu negocio es <span className="font-bold text-tinta">{actual.nombre}</span>. El
              rubro cambia cómo se llaman los estados y qué motivos te ofrecemos al abrir un
              caso.
            </p>
            {puedeConfigurar ? (
              <div className="mt-4">
                <Boton icono="tienda" onClick={() => setCambiandoRubro(true)}>
                  Cambiar el rubro
                </Boton>
              </div>
            ) : (
              <p className="mt-2 text-apoyo text-tinta-suave">
                {QUIEN_PUEDE.configurarNegocio}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mb-4 max-w-[65ch] text-tinta-media">
              Elegí el rubro nuevo. Te vamos a mostrar qué cambia antes de aplicarlo.
            </p>

            <ul className="grid gap-3 sm:grid-cols-3">
              {RUBROS.map((r) => {
                const marcado = r.clave === (rubroElegido ?? negocio?.rubro);
                return (
                  <li key={r.clave}>
                    <button
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => setRubroElegido(r.clave)}
                      className={[
                        "h-full w-full cursor-pointer rounded-tarjeta border-2 p-4 text-left",
                        marcado
                          ? "border-azul bg-azul-claro"
                          : "border-borde bg-tarjeta hover:bg-superficie",
                      ].join(" ")}
                    >
                      <span
                        className={`flex items-center gap-2 font-bold text-subtitulo ${marcado ? "text-azul" : ""}`}
                      >
                        {marcado && <Icono nombre="listo" className="size-6" />}
                        {r.nombre}
                      </span>
                      <span className="mt-1 block text-tinta-media">{r.queEs}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {nuevo && nuevo.clave !== negocio?.rubro && (
              <div className="mt-6 rounded-tarjeta bg-superficie p-4">
                <p className="font-bold text-subtitulo">
                  ¿Cambiar el rubro a {nuevo.nombre.toLowerCase()}?
                </p>

                <p className="mt-4 font-bold text-cuerpo">Qué cambia</p>
                <ul className="mt-1 flex flex-col gap-1 text-tinta-media">
                  <li>
                    Los cinco estados pasan a llamarse como en {nuevo.nombre.toLowerCase()}:
                    «{actual.etiquetas.en_proceso}» pasa a decir «{nuevo.etiquetas.en_proceso}
                    », «{actual.etiquetas.completado}» pasa a «{nuevo.etiquetas.completado}».
                  </li>
                  <li>Los motivos que te ofrecemos al abrir un caso.</li>
                </ul>

                <p className="mt-4 font-bold text-cuerpo">Qué no cambia</p>
                <ul className="mt-1 flex flex-col gap-1 text-tinta-media">
                  <li>Los casos que ya tenés: mismo texto, mismo estado, misma plata.</li>
                  <li>Los módulos que tenés prendidos.</li>
                </ul>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Boton icono="check" onClick={confirmarRubro}>
                    Cambiar el rubro
                  </Boton>
                  <Boton variante="plano" onClick={cerrarCambioDeRubro}>
                    Dejarlo como está
                  </Boton>
                </div>
              </div>
            )}

            {(!nuevo || nuevo.clave === negocio?.rubro) && (
              <div className="mt-6">
                <Boton variante="plano" onClick={cerrarCambioDeRubro}>
                  Dejarlo como está
                </Boton>
              </div>
            )}
          </>
        )}
      </Tarjeta>

      <TituloSeccion>Tu cuenta</TituloSeccion>
      <Tarjeta>
        {esDemo ? (
          <>
            <p className="flex items-center gap-2 font-bold text-espera">
              <Icono nombre="alerta" className="size-6" />
              Estás en el modo de ejemplo
            </p>
            <p className="mt-2 max-w-[65ch] text-tinta-media">
              Lo que cargues vive sólo en este navegador y no lo ve nadie más. Al salir
              volvés a la pantalla de entrada.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Boton icono="deshacer" onClick={datos.reiniciar}>
                Borrar todo y empezar de nuevo
              </Boton>
              <Boton icono="salir" onClick={salir}>
                Salir del modo de ejemplo
              </Boton>
            </div>
          </>
        ) : (
          <>
            <p className="text-tinta-media">
              {usuario?.nombre ? (
                <>
                  Entraste como{" "}
                  <span className="font-bold text-tinta">{usuario.nombre}</span>, con{" "}
                  {usuario.email}.
                </>
              ) : (
                <>
                  Entraste con{" "}
                  <span className="font-bold text-tinta">{usuario?.email ?? "tu cuenta"}</span>.
                </>
              )}
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
