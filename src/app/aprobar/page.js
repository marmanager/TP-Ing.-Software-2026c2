"use client";

// "Pendientes de aprobación" — los casos donde falta que el cliente conteste.
// No es una pantalla vacía: es la misma consulta del Inicio filtrada por
// los pasos que todavía esperan respuesta.
//
// Cada caso dice también qué pasa con el aviso automático del presupuesto
// (R-5b): cuándo le llega al cliente o si ya se le avisó. El aviso sale una
// sola vez, así que es lo que hay que saber para decidir a quién llamar.

import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { conElementos } from "@/lib/conElementos";
import { casosPorAprobar, pesos } from "@/lib/estados";
import { cuantoHace, diasDesde } from "@/lib/fechas";
import { avisoDelPresupuesto } from "@/lib/recordatorios";
import { lineaDelCaso, subtituloDelCaso, tituloDelCaso } from "@/lib/nombres";
import ChipEstado from "@/componentes/ChipEstado";
import { telefonoLegible, telefonoParaLlamar } from "@/lib/telefono";
import Icono from "@/componentes/Icono";
import { Cargando, Tarjeta, Vacio } from "@/componentes/ui";

export default function AAprobar() {
  const { cargando, casos, clientes, pasos } = useDatos();
  const { t, locale, idioma } = useIdioma();
  useTitulo(t("aprobar.titulo"));

  if (cargando) return <Cargando />;

  const conPendientes = casosPorAprobar(casos, pasos);

  const total = conPendientes.reduce((s, x) => s + x.plata, 0);
  const ahora = Date.now();

  return (
    <>
      <h1 className="text-pantalla">{t("aprobar.titulo")}</h1>
      <p className="mt-1 mb-8 max-w-[65ch] text-tinta-media">
        {t("aprobar.apoyo")}
      </p>

      {conPendientes.length === 0 ? (
        <Vacio icono="listo" titulo={t("aprobar.vacioTitulo")}>
          {t("aprobar.vacioTexto")}
        </Vacio>
      ) : (
        <>
          <div className="mb-6 rounded-tarjeta border border-borde bg-superficie p-4 sm:p-6">
            <p className="text-tinta-media">{t("aprobar.enTotal")}</p>
            <p className="font-titulo font-extrabold text-dato text-espera tabular-nums">
              {pesos(total, locale)}
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {conPendientes.map(({ caso, cuantos, plata, esperandoDesde }) => {
              const cliente = clientes.find((c) => c.id === caso.cliente_id);
              // Una semana sin respuesta es el momento de levantar el teléfono.
              const hayQueInsistir = diasDesde(esperandoDesde) >= 7;
              const aviso = avisoDelPresupuesto({ caso, cliente, ahora }, { t, locale, idioma });
              return (
                <li key={caso.id}>
                  <Tarjeta>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-titulo font-extrabold text-ident">{tituloDelCaso(caso, t)}</p>
                        {subtituloDelCaso(caso, t) && (
                          <p className="text-apoyo text-tinta-suave">{subtituloDelCaso(caso, t)}</p>
                        )}
                        <p className="text-tinta-media">{lineaDelCaso(caso, cliente?.nombre, t)}</p>
                      </div>
                      <ChipEstado estado={caso.estado} />
                    </div>

                    <p className="mt-3">
                      {conElementos(t("aprobar.pasosPor"), {
                        pasos: <span className="font-bold">{t("aprobar.pasos", { n: cuantos })}</span>,
                        monto: <span className="font-bold tabular-nums">{pesos(plata, locale)}</span>,
                      })}
                    </p>
                    <p
                      className={`flex items-center gap-1.5 ${hayQueInsistir ? "font-bold text-espera" : "text-tinta-media"}`}
                    >
                      {hayQueInsistir && <Icono nombre="alerta" className="size-5" />}
                      {t(hayQueInsistir ? "aprobar.seLoMandasteInsistir" : "aprobar.seLoMandaste", {
                        cuando: cuantoHace(esperandoDesde, t),
                      })}
                    </p>
                    {aviso && (
                      <p
                        className={`mt-1 flex max-w-[65ch] items-start gap-2 ${aviso.estado === "fallido" ? "font-bold text-rojo" : "text-tinta-media"}`}
                      >
                        <Icono nombre={aviso.estado === "fallido" ? "alerta" : "whatsapp"} className="mt-1 size-5 shrink-0" />
                        <span>{aviso.frase}</span>
                      </p>
                    )}

                    {/* Esta pantalla existe para decidir a quién insistirle:
                        el teléfono va acá y no a dos pantallas de distancia
                        (auditoría, H7). */}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/casos/${caso.id}/pasos`}
                        className="inline-flex min-h-12 items-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-azul hover:bg-azul-claro"
                      >
                        <Icono nombre="nota" />
                        {t("aprobar.verLosPasos")}
                      </Link>
                      {cliente?.telefono && (
                        <a
                          href={`tel:${telefonoParaLlamar(cliente.telefono)}`}
                          className="inline-flex min-h-12 items-center gap-2 px-3 font-bold text-azul hover:bg-azul-claro"
                        >
                          <Icono nombre="telefono" />
                          {t("aprobar.llamar", { telefono: telefonoLegible(cliente.telefono) })}
                        </a>
                      )}
                    </div>
                  </Tarjeta>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
