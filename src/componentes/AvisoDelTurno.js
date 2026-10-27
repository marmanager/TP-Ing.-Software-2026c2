"use client";

// Qué pasa con el recordatorio por WhatsApp de un turno (R-4b), en una línea
// debajo del cliente: cuándo le llega, que ya le llegó, o que no se pudo
// mandar y qué hacer. Si no va a tener, por qué, y si falta el teléfono, el
// camino a la ficha para cargarlo.
//
// Las frases salen de lib/recordatorios.js. El error del proveedor no se
// muestra nunca: avisoEnPalabras() lo traduce a qué hacer.
//
// Si el cliente pidió no recibir avisos (R-8b), se dice sin alerta: no es
// algo que el negocio tenga que arreglar, y completar el teléfono no
// cambiaría nada.

import Link from "next/link";
import { avisoDelTurno, avisoEnPalabras, motivoDelRecordatorio, porQueNoHayAviso } from "@/lib/recordatorios";
import { turnoEnPie } from "@/lib/turnos";
import { vocabulario } from "@/lib/presets";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "./Icono";

// Cada estado con su color, su ícono y su palabra (cartilla, sección 02).
const COMO_SE_VE = {
  programado: { icono: "whatsapp", clase: "text-tinta-media" },
  enviado: { icono: "listo", clase: "text-completo" },
  fallido: { icono: "alerta", clase: "font-bold text-rojo" },
};

export default function AvisoDelTurno({ turno, cliente, rubro, recordatorioActivo, ahora }) {
  const { idioma, locale, t } = useIdioma();
  const lang = { t, locale, idioma };
  if (!turnoEnPie(turno)) return null;

  const enPalabras = avisoEnPalabras({ aviso: avisoDelTurno(turno), ahora }, lang);
  const fichaDelCliente = cliente && (
    <Link href={`/clientes/${cliente.id}`} className="inline-flex min-h-12 items-center font-bold text-azul">
      {t("agenda.aviso.completarTelefono")}
    </Link>
  );

  if (enPalabras) {
    const { icono, clase } = COMO_SE_VE[enPalabras.estado];
    return (
      <div data-aviso={enPalabras.estado} className="mt-1">
        <p className={`flex items-start gap-1.5 text-etiqueta ${clase}`}>
          <Icono nombre={icono} className="mt-0.5 size-5 shrink-0" />
          <span>{enPalabras.frase}</span>
        </p>
        {enPalabras.estado === "fallido" && fichaDelCliente}
      </div>
    );
  }

  // Sin aviso. Con el recordatorio apagado no hay nada que señalar: no se
  // espera que llegue.
  if (!recordatorioActivo) return null;

  const falta = porQueNoHayAviso({ turno, cliente, rubro }, lang);
  if (falta?.motivo === "baja_de_avisos") {
    return (
      <p data-aviso={falta.motivo} className="mt-1 flex items-start gap-1.5 text-etiqueta text-tinta-media">
        <Icono nombre="whatsapp" className="mt-0.5 size-5 shrink-0" />
        <span>{falta.frase}</span>
      </p>
    );
  }
  if (falta) {
    return (
      <div data-aviso={falta.motivo} className="mt-1">
        <p className="flex items-start gap-1.5 text-etiqueta text-espera">
          <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
          <span>{falta.frase}</span>
        </p>
        {falta.motivo === "sin_telefono" && fichaDelCliente}
      </div>
    );
  }

  // Lo que dijo la API al anotarlo o moverlo (por ejemplo, que ya no llegaba
  // a tiempo), mientras siga en pantalla.
  //
  // Si se anotó cuando el cliente no recibía avisos y la baja ya se
  // revirtió, la frase de la API quedó vieja: se dice qué pasa ahora.
  if (turno.recordatorio?.motivo === "baja_de_avisos") {
    return (
      <p data-aviso="anotado_en_baja" className="mt-1 text-etiqueta text-tinta-media">
        {t(`agenda.aviso.anotadoEnBaja.${vocabulario(rubro, idioma).cita.segun("m", "f")}`)}
      </p>
    );
  }
  const porQue = turno.recordatorio?.mensaje && motivoDelRecordatorio(turno.recordatorio, lang);
  return porQue ? (
    <p data-aviso={turno.recordatorio.motivo} className="mt-1 text-etiqueta text-tinta-media">{porQue}</p>
  ) : null;
}
