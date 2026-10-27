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
import { telefonoLegible } from "@/lib/telefono";
import { cuandoContesto, linkParaContestar, loQueEscribio, respuestasPendientes } from "@/lib/recordatorios";
import { casoEnFrase } from "@/lib/nombres";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Tarjeta, TituloPantalla, Vacio } from "@/componentes/ui";

const POR_PAGINA = 50;

export default function Respuestas() {
  const datos = useDatos();
  const { cargando, clientes, turnos, casos } = datos;
  useTitulo("Respuestas por WhatsApp");

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
      <TituloPantalla apoyo="Lo que te contestaron los clientes y todavía no se resolvió solo. Leelo y contestales desde tu WhatsApp.">
        Respuestas por WhatsApp
      </TituloPantalla>

      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      {leidas !== null && pendientes.length === 0 && !siguiente && (
        <Vacio icono="chat" titulo="No hay respuestas para leer">
          Cuando un cliente conteste algo que no sea confirmar o cancelar su turno, va a aparecer acá.
        </Vacio>
      )}

      {pendientes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {pendientes.map((r) => {
            const cliente = clientes.find((c) => c.id === r.cliente_id);
            const caso = r.caso_id ? casos.find((c) => c.id === r.caso_id) : null;
            const escrito = loQueEscribio(r);
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
                      `${telefonoLegible(r.telefono)} (no está entre tus clientes)`
                    ) : (
                      "Un número que no está entre tus clientes"
                    )}
                  </p>
                  <p className="text-apoyo text-tinta-suave">
                    Te escribió {cuandoContesto(r)}
                    {caso && (
                      <>
                        {" · "}
                        <Link href={`/casos/${caso.id}`} className="text-azul">
                          {casoEnFrase(caso)}
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
                      Contestarle por WhatsApp
                    </a>
                  ) : (
                    <p className="mt-4 text-tinta-media">
                      Para contestarle desde acá falta su teléfono con código de país.
                    </p>
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
            <p className="mb-3 text-tinta-media">
              En las {leidas.length} respuestas más viejas no quedó nada sin resolver. Hay más para mirar.
            </p>
          )}
          <Boton variante="plano" icono="flecha-abajo" motivo={leyendo ? "cargando" : null} onClick={() => leerPagina(siguiente)}>
            Ver más respuestas
          </Boton>
        </div>
      )}
    </>
  );
}
