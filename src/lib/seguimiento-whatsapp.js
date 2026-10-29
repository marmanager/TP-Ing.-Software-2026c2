import { normalizarTelefono } from "./telefono.js";
import { tCastellano } from "./idioma.js";

export const SEGUIMIENTO_VACIO = { enviar: false, dias: "", mensaje: "", mensajeGuardado: null };

// Si a este teléfono le puede llegar un WhatsApp: tiene que tener el código
// de país (B-1b). Antes aceptaba de 8 a 15 dígitos, y un 3414567890 pasaba:
// el sistema ofrecía mandar un mensaje que WhatsApp no sabe adónde llevar.
export function telefonoWhatsAppValido(telefono) {
  return normalizarTelefono(telefono).ok;
}

export function erroresSeguimiento(valor, t = tCastellano) {
  if (!valor?.enviar) return {};
  const dias = String(valor.dias ?? "");
  return {
    ...(!/^\d+$/.test(dias) || Number(dias) > 3650
      ? { dias: t("casos.seguimiento.errorDias") } : {}),
    ...(!valor.mensaje?.trim()
      ? { mensaje: t("casos.seguimiento.errorMensaje") }
      : valor.mensaje.trim().length > 3000
        ? { mensaje: t("casos.seguimiento.errorLargo") } : {}),
  };
}

export function seguimientoParaLaApi(valor) {
  if (!valor?.enviar) return { seguimiento: false };
  return {
    seguimiento: true,
    seguimiento_dias: Number(valor.dias),
    seguimiento_mensaje: valor.mensaje.trim(),
  };
}

// El aviso de avance ("Notificar" al cambiar el estado) lleva el link de
// seguimiento que el caso ya tiene: lo suma la API al mandarlo (R-11). Sin
// link sale igual, sin él, y esto es lo que se dice antes, con el botón para
// generarlo. null si el caso ya tiene link.
//
// Generarlo es compartir el caso: si tiene pasos sin contestar y no está
// esperando, queda esperando la respuesta del cliente (compartir() de la
// API). Se dice antes, no después.
export function linkDelAvisoDeAvance({ caso, pasos = [] }, t = tCastellano) {
  if (!caso || caso.seguimiento_codigo) return null;
  const quedaEsperando = caso.estado !== "esperando"
    && pasos.some((p) => p.caso_id === caso.id && p.estado === "esperando");
  return {
    frase: t("casos.seguimiento.sinLink"),
    boton: t("casos.seguimiento.generar"),
    consecuencia: quedaEsperando ? t("casos.seguimiento.quedaEsperando") : null,
  };
}
