// La red de sedes, del lado de la aplicación (docs/red-de-sedes.md).
//
// Las llamadas a la API, con el token de la sesión, y qué negocios ofrecer
// para vincular. Quién puede y qué se ve lo decide la base; esto sólo evita
// ofrecer lo que va a rechazar.

import { mandar, quitar, traer } from "./api.js";
import { puede } from "./permisos.js";

// El error de la API, con su código: la pantalla lo traduce con textoDeError.
const conError = (r) => ({ ok: false, error: r.error });

export async function misSedes(token) {
  const r = await traer("/sedes", token);
  return r.ok ? { ok: true, sedes: r.datos.sedes } : conError(r);
}

export async function vincularSede(negocioId, token) {
  const r = await mandar("/sedes", { negocio_id: negocioId }, token);
  return r.ok ? { ok: true, sedes: r.datos.sedes } : conError(r);
}

export async function desvincularSede(token) {
  const r = await quitar("/sedes", token);
  return r.ok ? { ok: true, sedes: r.datos.sedes } : conError(r);
}

// Entrar de visita (sólo lectura) a una sede de la red donde no se es miembro.
export async function visitarSede(id, token) {
  const r = await mandar(`/sedes/${id}/visita`, {}, token);
  return r.ok ? { ok: true } : conError(r);
}

export async function inventarioDeSedes(token) {
  const r = await traer("/inventario/sedes", token);
  return r.ok ? { ok: true, sedes: r.datos.sedes, productos: r.datos.productos ?? [] } : conError(r);
}

// Los negocios de la cuenta (mis_negocios, con su rol en cada uno) que se
// pueden sumar a la red: no el activo, no los que ya están, y sólo donde el
// rol puede vincular.
export const candidatosParaVincular = (negocios = [], sedes = [], activoId) =>
  negocios.filter(
    (n) => n.id !== activoId && !sedes.some((s) => s.id === n.id) && puede(n, "vincular_sedes")
  );
