"use client";

// Un cliente que escribió por WhatsApp y nadie lo vio: quién, su último
// mensaje, cuántos mandó, de qué caso habla y cuándo. Una fila por cliente,
// no por mensaje: el que manda quince no llena la pantalla.
//
// La usan el bloque del Inicio y la bandeja. En la bandeja se despliega para
// leer los últimos mensajes; lo anterior está en la ficha.

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useIdioma } from "@/lib/useIdioma";
import { cuando } from "@/lib/fechas";
import { loQueEscribio } from "@/lib/recordatorios";
import { casoEnFrase } from "@/lib/nombres";
import { telefonoLegible } from "@/lib/telefono";
import Icono from "@/componentes/Icono";
import { Boton } from "@/componentes/ui";

// Desplegada, se leen los últimos; los demás, en la ficha.
const A_LA_VISTA = 3;

// Los links de la fila desplegada, con pinta de botón con borde (el azul
// lleno es uno solo por pantalla).
const IR = "inline-flex min-h-12 items-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-4 font-bold text-azul hover:bg-azul-claro";

export default function FilaDeRespuestas({ grupo, verlo, desplegable = false }) {
  const { clientes, casos } = useDatos();
  const { idioma, locale, t } = useIdioma();
  const lang = { t, locale, idioma };
  const [abierta, setAbierta] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const cliente = grupo.clienteId ? clientes.find((c) => c.id === grupo.clienteId) : null;
  const caso = grupo.casoId ? casos.find((c) => c.id === grupo.casoId) : null;
  const quien = cliente?.nombre
    ?? (grupo.telefono ? t("respuestas.noEsCliente", { telefono: telefonoLegible(grupo.telefono) }) : t("respuestas.numeroDesconocido"));
  const ultimo = loQueEscribio(grupo.ultima, lang);
  const ficha = cliente ? `/clientes/${cliente.id}` : null;

  async function marcar() {
    setMarcando(true);
    const r = await verlo(grupo);
    // Si salió bien la fila se va sola; si no, el aviso ya lo dijo.
    if (!r?.ok) setMarcando(false);
  }

  const cabeza = (
    <span className="min-w-0 flex-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate font-bold">{quien}</span>
        <span className="shrink-0 text-apoyo text-tinta-suave">{cuando(grupo.ultima.enviado_en, locale, t)}</span>
      </span>
      <span className={`block truncate ${ultimo.literal ? "text-tinta" : "text-tinta-media"}`}>
        {ultimo.literal ? `“${ultimo.texto}”` : ultimo.texto}
      </span>
      <span className="block truncate text-apoyo text-tinta-suave">
        {t("respuestas.mensajes", { n: grupo.cantidad })}
        {caso && ` · ${casoEnFrase(caso, t)}`}
      </span>
    </span>
  );

  return (
    <li data-respuestas-de={grupo.clave} className="border-b border-borde last:border-b-0">
      <div className="flex items-start gap-3 px-4 py-3 sm:px-6">
        {desplegable ? (
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-left"
          >
            {cabeza}
            <Icono nombre={abierta ? "flecha-arriba" : "flecha-abajo"} className="mt-1 size-5 shrink-0 text-tinta-suave" />
          </button>
        ) : ficha ? (
          <Link href={ficha} className="flex min-w-0 flex-1 hover:text-azul">{cabeza}</Link>
        ) : (
          cabeza
        )}
        <Boton variante="borde" icono="check" motivo={marcando ? t("respuestas.marcando") : null} onClick={marcar} className="shrink-0">
          {t("respuestas.yaLoVi")}
        </Boton>
      </div>

      {desplegable && abierta && (
        <div className="px-4 pb-4 sm:px-6">
          {grupo.cantidad > A_LA_VISTA && (
            <p className="mb-2 text-apoyo text-tinta-suave">
              {t("respuestas.anteriores", { n: grupo.cantidad - A_LA_VISTA })}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {grupo.mensajes.slice(-A_LA_VISTA).map((m) => {
              const escrito = loQueEscribio(m, lang);
              return (
                <li key={m.id} className="max-w-[65ch] rounded-campo bg-superficie px-3 py-2">
                  <p className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${escrito.literal ? "" : "text-tinta-media"}`}>{escrito.texto}</p>
                  <p className="text-apoyo text-tinta-suave">{cuando(m.enviado_en, locale, t)}</p>
                </li>
              );
            })}
          </ul>
          {/* Dos destinos distintos, y se nota: cada uno con su ícono (la
              persona, la carpeta) y diciendo a quién o a qué lleva. */}
          <div className="mt-3 flex flex-wrap gap-3">
            {ficha && (
              <Link href={ficha} className={IR}>
                <Icono nombre="persona" className="size-5" />
                {t("respuestas.irALaFicha", { nombre: cliente.nombre.split(" ")[0] })}
              </Link>
            )}
            {caso && (
              <Link href={`/casos/${caso.id}`} className={IR}>
                <Icono nombre="carpeta" className="size-5" />
                {t("respuestas.irAlCaso", { caso: casoEnFrase(caso, t) })}
              </Link>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// La marca de las listas de Casos y Clientes: sólo el ícono, ni el texto ni
// cuántos. El detalle está en el caso o en la ficha.
export function MarcaSinVer() {
  const { t } = useIdioma();
  return (
    <span title={t("respuestas.sinVer")} className="ml-2 inline-flex align-middle text-azul">
      <Icono nombre="chat" className="size-5" />
      <span className="sr-only">{t("respuestas.sinVer")}</span>
    </span>
  );
}
