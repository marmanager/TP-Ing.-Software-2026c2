// Las e2e entran con una cuenta de verdad, sembrada por la API
// (POST /v1/pruebas/semilla, MIGRACION.md de la API, sección 10), en vez de
// cargar datos en el navegador. Corre del lado de WebdriverIO (Node), nunca
// en la página: la clave de siembra no llega al navegador.
//
// Necesita, en .env.local (wdio.conf.js lo lee como Next):
//   E2E_API_URL          la API con la siembra prendida (por defecto http://localhost:4000)
//   E2E_SEMILLA_CLAVE    la misma SEMILLA_CLAVE del .env de esa API
//
// Cada cuenta sembrada se anota y se borra al terminar (limpiarSembradas,
// en el `after` de wdio.conf.js).

const API = (process.env.E2E_API_URL || "http://localhost:4000").replace(/\/+$/, "").replace(/\/v1$/, "");
const CLAVE = process.env.E2E_SEMILLA_CLAVE || "";

const sembradas = [];

async function pedir(ruta, cuerpo) {
  if (!CLAVE) {
    throw new Error("Falta E2E_SEMILLA_CLAVE en .env.local: es la SEMILLA_CLAVE de la API que siembra.");
  }
  let respuesta;
  try {
    respuesta = await fetch(`${API}/v1${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Semilla-Clave": CLAVE },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error(`La API no contesta en ${API}. Levantala con SEMILLA_CLAVE (npm run dev en la API, con PORT=4000).`);
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !datos?.ok) {
    const motivo = datos?.error?.mensaje ?? `HTTP ${respuesta.status}`;
    throw new Error(`La siembra falló (${ruta}): ${motivo}. ¿La API de ${API} tiene SEMILLA_CLAVE?`);
  }
  return datos.datos;
}

// Una cuenta nueva con el escenario: "taller-completo", "taller-sin-casos"
// o "sin-negocio". Devuelve lo mismo que entrar (token, refresh_token,
// vence_en, auth_usuario) más ids: el uuid de cada clave del escenario.
export async function sembrar(escenario = "taller-completo") {
  const datos = await pedir("/pruebas/semilla", { escenario });
  sembradas.push(datos.auth_usuario.id);
  return datos;
}

export async function limpiarSembradas() {
  const pendientes = sembradas.splice(0);
  const fallidas = [];
  for (const usuario_id of pendientes) {
    await pedir("/pruebas/semilla/limpiar", { usuario_id }).catch(() => fallidas.push(usuario_id));
  }
  if (fallidas.length) console.warn(`No se pudieron borrar ${fallidas.length} cuentas sembradas: ${fallidas.join(", ")}`);
}
