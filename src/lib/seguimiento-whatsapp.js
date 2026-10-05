export const SEGUIMIENTO_VACIO = { enviar: false, dias: "", mensaje: "", mensajeGuardado: null };

export function telefonoWhatsAppValido(telefono) {
  const limpio = String(telefono ?? "").trim().replace(/[\s()+.-]/g, "");
  return /^[1-9]\d{7,14}$/.test(limpio);
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
