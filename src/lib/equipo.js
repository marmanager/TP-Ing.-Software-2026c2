// Sumar gente al equipo con un link (docs/equipo-por-link.md).
//
// Las llamadas a la API, con el token de la sesión, y el mensaje que va al
// grupo de WhatsApp. Quién puede lo decide la base.

import { mandar, traer } from "./api.js";
import { tCastellano } from "./idioma.js";

// El error se devuelve entero ({ codigo, mensaje }): la pantalla lo traduce
// con textoDeError al dibujar. Un texto suelto también se muestra tal cual.
const conError = (r) => ({ ok: false, error: r.error });

export const linkDeInvitacion = (codigo, origen) => `${origen}/unirme/${codigo}`;

// Lo que se manda al grupo: sale en el idioma de quien lo manda.
export const mensajeDeInvitacion = (nombreDelNegocio, link, t = tCastellano) =>
  t("equipo.mensajeDeInvitacion", { negocio: nombreDelNegocio, link });

export async function linkDeEquipo(token) {
  const r = await traer("/equipo/link", token);
  return r.ok ? { ok: true, link: r.datos.link } : conError(r);
}

export async function cambiarLinkDeEquipo(token) {
  const r = await mandar("/equipo/link", {}, token);
  return r.ok ? { ok: true, link: r.datos.link } : conError(r);
}

export async function pedidosDeIngreso(token) {
  const r = await traer("/equipo/pedidos", token);
  return r.ok ? { ok: true, pedidos: r.datos.pedidos } : conError(r);
}

export async function aprobarPedido(id, rolId, token) {
  const r = await mandar(`/equipo/pedidos/${encodeURIComponent(id)}/aprobar`, { rol_id: rolId }, token);
  return r.ok ? { ok: true, empleados: r.datos.empleados } : conError(r);
}

export async function rechazarPedido(id, token) {
  const r = await mandar(`/equipo/pedidos/${encodeURIComponent(id)}/rechazar`, {}, token);
  return r.ok ? { ok: true } : conError(r);
}

export async function pedirEntrar(codigo, nombre, token) {
  const r = await mandar(`/invitaciones/${encodeURIComponent(codigo)}/pedir`, { nombre: nombre || null }, token);
  return r.ok ? { ok: true, negocio: r.datos.negocio_nombre, estado: r.datos.estado } : conError(r);
}

export async function misPedidos(token) {
  const r = await traer("/cuenta/pedidos", token);
  return r.ok ? { ok: true, pedidos: r.datos.pedidos } : conError(r);
}
