// La vista maestra, del lado de la aplicación (docs/vista-maestra.md).
//
// Qué muestra el selector, qué atajo va a qué negocio, y qué se prende o
// apaga. Qué es de la cuenta y qué no se puede apagar lo decide la base (076):
// esto sólo evita ofrecer lo que va a rechazar.

import { mandar, quitar, reemplazar, traer } from "./api.js";

const porOrden = (a, b) => a.orden - b.orden;

export const delSelector = (negocios = []) => negocios.filter((n) => n.prendido).sort(porOrden);

// Alt+1…Alt+9 → el negocio de esa posición del selector. Se mira event.code y
// no event.key: en la Mac, Option+1 escribe "¡" y con otra distribución de
// teclado el número puede estar en otro lado.
export function negocioDelAtajo(evento, selector) {
  if (!evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return null;
  const numero = /^Digit([1-9])$/.exec(evento.code ?? "")?.[1];
  return numero ? (selector[Number(numero) - 1]?.id ?? null) : null;
}

// El que se está mirando no se apaga (decisión 9): el interruptor ya dice por
// qué, y la base igual lo rechaza.
export function conPrendido(negocios, id, prendido, mirandoId) {
  if (!prendido && id === mirandoId) return negocios;
  return negocios.map((n) => (n.id === id ? { ...n, prendido } : n));
}

export function conGrupo(negocios, grupo, prender, mirandoId) {
  const delGrupo = new Set(grupo.negocios);
  return negocios.map((n) => (delGrupo.has(n.id) ? { ...n, prendido: prender || n.id === mirandoId } : n));
}

export function estadoDelGrupo(negocios, grupo) {
  const suyos = negocios.filter((n) => grupo.negocios.includes(n.id));
  if (suyos.length && suyos.every((n) => n.prendido)) return "prendido";
  if (suyos.some((n) => n.prendido)) return "mezclado";
  return "apagado";
}

const renumerar = (lista) => lista.map((n, i) => ({ ...n, orden: i }));

// Subir (-1) o bajar (+1) un lugar: lo mismo que arrastrar, para quien usa
// teclado o lector de pantalla.
export function mover(negocios, id, paso) {
  const lista = [...negocios].sort(porOrden);
  const i = lista.findIndex((n) => n.id === id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= lista.length) return renumerar(lista);
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return renumerar(lista);
}

// Soltar uno arrastrado encima de otro: queda en el lugar de ése.
export function moverA(negocios, id, destinoId) {
  const lista = [...negocios].sort(porOrden);
  const desde = lista.findIndex((n) => n.id === id);
  const hasta = lista.findIndex((n) => n.id === destinoId);
  if (desde < 0 || hasta < 0) return renumerar(lista);
  const [movido] = lista.splice(desde, 1);
  lista.splice(hasta, 0, movido);
  return renumerar(lista);
}

export const paraGuardar = (negocios) => [...negocios].sort(porOrden).map(({ id, prendido }) => ({ id, prendido }));

export function motivoParaEntrar({ enVista, cantidad }, t) {
  if (enVista) return t("vistaMaestra.yaEstas");
  if (cantidad < 2) return t("vistaMaestra.faltanNegocios");
  return null;
}

export const hayUrgencia = (u) => Boolean(u && (u.casos_atrasados > 0 || u.stock_bajo > 0));

// --- Las llamadas a la API, con el token de la sesión ---

const conVista = (r) => (r.ok ? { ok: true, vista: r.datos } : { ok: false, error: r.error });

export const verVistaMaestra = async (token) => conVista(await traer("/vista-maestra", token));

export const guardarNegociosDeVista = async (negocios, token) =>
  conVista(await reemplazar("/vista-maestra/negocios", { negocios: paraGuardar(negocios) }, token));

export const crearGrupo = async ({ nombre, negocios }, token) =>
  conVista(await mandar("/vista-maestra/grupos", { nombre, negocios }, token));

export const cambiarGrupo = async (id, { nombre, negocios }, token) =>
  conVista(await reemplazar(`/vista-maestra/grupos/${id}`, { nombre, negocios }, token));

export const borrarGrupo = async (id, token) => conVista(await quitar(`/vista-maestra/grupos/${id}`, token));
