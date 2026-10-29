"use client";

// "Respuestas por WhatsApp" (R-10b): lo que los clientes contestaron a los
// avisos y no resolvió nada solo, para leerlo y contestar a mano.
//
// Un "sí" o un "no" que la API anotó en un turno ya se ve en la agenda, y un
// BAJA en la ficha del cliente: acá no se repiten. Si la bandeja mostrara
// todo, nadie la miraría. Cuál resolvió algo lo decide
// respuestasPendientes(), en lib/recordatorios.js.
//
// Van de la más vieja a la más nueva, que es como pagina la API: es una
// fila de cosas por atender, y la que espera hace más va primero. La API no
// guarda cuáles se leyeron, así que no hay "marcar como leída".

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { telefonoLegible } from "@/lib/telefono";
import { cuandoContesto, linkParaContestar, loQueEscribio, respuestasPendientes } from "@/lib/recordatorios";
import { casoEnFrase } from "@/lib/nombres";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Tarjeta, TituloPantalla, Vacio } from "@/componentes/ui";

const POR_PAGINA = 50;

export default function Respuestas() {
  const datos = useDatos();
  const { cargando, clientes, turnos, casos } = datos;
  const { idioma, locale, t } = useIdioma();
  const lang = { t, locale, idioma };
  useTitulo(t("respuestas.titulo"));

  // Lo leído hasta ahora, en el orden de la API, y el cursor de la página
  // que sigue (null si no hay más).
  const [leidas, setLeidas] = useState(null);
  const [siguiente, setSiguiente] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState(null);

  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = datos.negocio?.id;

  const leerPagina = async (cursor) => {
    setLeyendo(true);
    setError(null);
    const r = await acciones.current.leerRespuestas({ limite: POR_PAGINA, cursor });
    setLeyendo(false);
    if (!r.ok) return setError(r.error);
    setLeidas((antes) => [...(cursor ? antes ?? [] : []), ...r.respuestas]);
    setSiguiente(r.siguiente);
  };

  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    acciones.current.leerRespuestas({ limite: POR_PAGINA }).then((r) => {
      if (!vivo) return;
      if (!r.ok) return setError(r.error);
      setLeidas(r.respuestas);
      setSiguiente(r.siguiente);
    });
    return () => { vivo = false; };
  }, [negocioId]);

  if (cargando || (leidas === null && !error)) return <Cargando />;

  const pendientes = respuestasPendientes({ respuestas: leidas, turnos, clientes });

  return (
    <>
      <TituloPantalla apoyo={t("respuestas.apoyo")}>{t("respuestas.titulo")}</TituloPantalla>

      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

      {leidas !== null && pendientes.length === 0 && !siguiente && (
        <Vacio icono="chat" titulo={t("respuestas.vacioTitulo")}>
          {t("respuestas.vacioTexto")}
        </Vacio>
      )}

      {pendientes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {pendientes.map((r) => {
            const cliente = clientes.find((c) => c.id === r.cliente_id);
            const caso = r.caso_id ? casos.find((c) => c.id === r.caso_id) : null;
            const escrito = loQueEscribio(r, lang);
            const link = linkParaContestar(cliente?.telefono ?? r.telefono);
            return (
              <li key={r.id} data-respuesta-pendiente={r.id}>
                <Tarjeta>
                  <p className="font-bold text-cuerpo [overflow-wrap:anywhere]">
                    {cliente ? (
                      <Link href={`/clientes/${cliente.id}`} className="text-azul">
                        {cliente.nombre}
                      </Link>
                    ) : r.telefono ? (
                      t("respuestas.noEsCliente", { telefono: telefonoLegible(r.telefono) })
                    ) : (
                      t("respuestas.numeroDesconocido")
                    )}
                  </p>
                  <p className="text-apoyo text-tinta-suave">
                    {t("respuestas.teEscribio", { cuando: cuandoContesto(r, lang) })}
                    {caso && (
                      <>
                        {" · "}
                        <Link href={`/casos/${caso.id}`} className="text-azul">
                          {casoEnFrase(caso, t)}
                        </Link>
                      </>
                    )}
                  </p>
                  {/* Tal cual lo escribió: sin recortar ni corregir. */}
                  {escrito.literal ? (
                    <blockquote className="mt-3 max-w-[65ch] whitespace-pre-wrap border-l-4 border-borde-fuerte pl-3 text-cuerpo [overflow-wrap:anywhere]">
                      {escrito.texto}
                    </blockquote>
                  ) : (
                    <p className="mt-3 text-tinta-media">{escrito.texto}</p>
                  )}
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-4 font-bold text-azul text-etiqueta hover:bg-azul-claro"
                    >
                      <Icono nombre="whatsapp" />
                      {t("respuestas.contestar")}
                    </a>
                  ) : (
                    <p className="mt-4 text-tinta-media">{t("respuestas.sinTelefono")}</p>
                  )}
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      {siguiente && (
        <div className="mt-6">
          {pendientes.length === 0 && (
            <p className="mb-3 text-tinta-media">{t("respuestas.nadaEnLasViejas", { n: leidas.length })}</p>
          )}
          <Boton variante="plano" icono="flecha-abajo" motivo={leyendo ? t("respuestas.cargando") : null} onClick={() => leerPagina(siguiente)}>
            {t("respuestas.verMas")}
          </Boton>
        </div>
      )}
    </>
  );
}
