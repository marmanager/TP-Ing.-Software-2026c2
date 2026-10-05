// La sesión de la persona, guardada por el front y no por el SDK de
// Supabase: el token para hablar con la API, el refresh token para
// renovarlo y cuándo vence (en segundos, como lo da Supabase).
//
// Nada de acá tira una excepción: un storage bloqueado (modo privado, sin
// permisos) se comporta como un storage vacío.
//
// Los tests están en pruebas/sesion.test.js.

import { mandar } from "./api.js";

export const LLAVE = "marmanager.sesion.v1";

// Faltando menos que esto para que venza, el token se renueva antes de usarlo.
const MARGEN_SEGUNDOS = 60;

// Lo que deja Supabase en la URL al volver de Google, del link de
// confirmación o del de recuperación. El provider_token (el de Google) no se
// guarda: el front no lo necesita.
export function sesionDelFragmento(hash) {
  const p = new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
  const token = p.get("access_token");
  if (!token || p.has("error")) return null;
  return {
    token,
    refresh_token: p.get("refresh_token"),
    vence_en: Number(p.get("expires_at")),
    recuperando: p.get("type") === "recovery",
  };
}

// La API devuelve los tokens con nombres propios del contrato. El resto del
// front todavía consume la forma histórica de Supabase (`access_token` y
// `user`), así que este módulo hace de adaptador mientras se retiran los
// accesos directos restantes.
export function sesionDeRespuesta(datos, { recuperando = false } = {}) {
  if (!datos?.token) return null;
  return {
    token: datos.token,
    refresh_token: datos.refresh_token ?? null,
    vence_en: Number(datos.vence_en),
    auth_usuario: datos.auth_usuario ?? null,
    recuperando,
  };
}

export function sesionParaLaApp(sesion) {
  if (!sesion?.token) return null;
  return {
    access_token: sesion.token,
    refresh_token: sesion.refresh_token ?? null,
    expires_at: sesion.vence_en,
    user: sesion.auth_usuario ?? null,
  };
}

// Sin storage explícito se usa el localStorage del navegador; en el
// servidor no existe y la ReferenceError cae en el mismo catch.
const conStorage = (storage, fn) => {
  try {
    return fn(storage ?? localStorage);
  } catch {
    return null;
  }
};

export const leer = (storage) => conStorage(storage, (s) => JSON.parse(s.getItem(LLAVE)));
export const guardar = (storage, sesion) => conStorage(storage, (s) => (s.setItem(LLAVE, JSON.stringify(sesion)), sesion));
export const borrar = (storage) => conStorage(storage, (s) => s.removeItem(LLAVE));

// El pedido de renovación va sin token (el vencido no sirve) y sin el aviso
// de sesión vencida: si falla, tokenVigente borra la sesión y devuelve null.
const renovarEnLaApi = (refresh_token) =>
  mandar("/sesiones/renovar", { refresh_token }, null, { avisarSiVence: false });

// Supabase rota el refresh token: dos renovaciones a la vez con el mismo
// dejarían a una afuera. Por eso las llamadas simultáneas comparten esta.
let renovando = null;

// El token para mandarle a la API, renovado si está por vencer. null si no
// hay sesión o si no se pudo renovar.
//
// Lee el storage en cada llamada: así usa lo que renovó otra pestaña.
// ponytail: sin escuchar 'storage' ni timer; se renueva cuando se pide un
// token. Si hace falta renovar con la pestaña quieta, agregar un timer acá.
export async function tokenVigente({ storage, ahora = Date.now() / 1000, renovar = renovarEnLaApi } = {}) {
  const sesion = leer(storage);
  if (!sesion?.token) return null;
  if (sesion.vence_en - ahora > MARGEN_SEGUNDOS) return sesion.token;

  renovando ??= renovarYGuardar(sesion, storage, renovar).finally(() => {
    renovando = null;
  });
  return renovando;
}

async function renovarYGuardar(sesion, storage, renovar) {
  const r = await renovar(sesion.refresh_token);
  if (!r?.ok || !r.datos?.token) {
    borrar(storage);
    return null;
  }
  // Renovar devuelve sólo tokens. Conservamos el usuario de Auth y la marca
  // de recuperación que ya estaban guardados.
  const nueva = { ...sesion, ...r.datos };
  guardar(storage, nueva);
  return nueva.token;
}
