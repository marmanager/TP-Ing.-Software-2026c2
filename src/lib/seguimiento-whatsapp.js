import { normalizarTelefono } from "./telefono.js";

export const SEGUIMIENTO_VACIO = { enviar: false, dias: "", mensaje: "", mensajeGuardado: null };

// Si a este teléfono le puede llegar un WhatsApp: tiene que tener el código
// de país (B-1b). Antes aceptaba de 8 a 15 dígitos, y un 3414567890 pasaba:
// el sistema ofrecía mandar un mensaje que WhatsApp no sabe adónde llevar.
export function telefonoWhatsAppValido(telefono) {
  return normalizarTelefono(telefono).ok;
}

export function erroresSeguimiento(valor) {
  if (!valor?.enviar) return {};
  const dias = String(valor.dias ?? "");
  return {
    ...(!/^\d+$/.test(dias) || Number(dias) > 3650
      ? { dias: "Elegí una cantidad de días enteros entre 0 y 3650." } : {}),
    ...(!valor.mensaje?.trim()
      ? { mensaje: "Escribí el mensaje que va a recibir el cliente." }
      : valor.mensaje.trim().length > 3000
        ? { mensaje: "El mensaje no puede superar 3000 caracteres." } : {}),
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
