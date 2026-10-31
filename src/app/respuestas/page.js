"use client";

// "Respuestas por WhatsApp" (R-10b): lo que los clientes escribieron y nadie
// vio todavía, de a un cliente por fila. Se llega desde el bloque "Te
// contestaron" del Inicio: no está en la barra lateral.
//
// Un "sí" o un "no" que la API anotó en un turno ya se ve en la agenda, y un
// BAJA en la ficha del cliente: acá no se repiten. Si la bandeja mostrara
// todo, nadie la miraría. Cuál resolvió algo lo decide
// respuestasPendientes(), en lib/recordatorios.js.
//
// Una fila por cliente, no por mensaje (agruparPorCliente): el que escribió
// último va arriba. Se despliega para leer los últimos mensajes, y "Ya lo
// vi" lo saca de acá, del Inicio y de las marcas de Casos y Clientes.

import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { useRespuestasSinVer } from "@/lib/useRespuestasSinVer";
import FilaDeRespuestas from "@/componentes/FilaDeRespuestas";
import { Cargando, ErrorGeneral, TituloPantalla, Vacio } from "@/componentes/ui";

export default function Respuestas() {
  const { cargando } = useDatos();
  const { t } = useIdioma();
  const { autorizado, leyendo, error, completas, grupos, verlo } = useRespuestasSinVer();
  useTitulo(t("respuestas.titulo"));

  if (cargando || leyendo) return <Cargando />;

  return (
    <>
      <TituloPantalla apoyo={t("respuestas.apoyo")}>{t("respuestas.titulo")}</TituloPantalla>

      {!autorizado && <ErrorGeneral>{t("respuestas.sinPermiso")}</ErrorGeneral>}
      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

      {autorizado && !error && grupos.length === 0 && (
        <Vacio icono="chat" titulo={t("respuestas.vacioTitulo")}>
          {t("respuestas.vacioTexto")}
        </Vacio>
      )}

      {grupos.length > 0 && (
        <>
          <p className="mb-3 text-tinta-media">{t("respuestas.clientes", { n: grupos.length })}</p>
          <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
            {grupos.map((g) => (
              <FilaDeRespuestas key={g.clave} grupo={g} verlo={verlo} desplegable />
            ))}
          </ul>
        </>
      )}

      {!completas && <p className="mt-4 text-apoyo text-tinta-suave">{t("respuestas.incompletas")}</p>}
    </>
  );
}
