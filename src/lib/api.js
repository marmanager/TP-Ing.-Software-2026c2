// La frontera: el único lugar del front que habla con la API.
//
// Acá adentro vive todo lo feo de la red —códigos HTTP, JSON, tiempos de
// espera, reintentos— y de acá no sale. Quien llama recibe siempre lo mismo
// que devuelve cualquier acción del sistema:
//
//   { ok: true,  datos }                      (y "siguiente" si es una lista)
//   { ok: false, error: { codigo, mensaje } }
//
// "mensaje" ya está escrito para mostrarlo tal cual en pantalla, y "codigo"
// es lo único sobre lo que se puede ramificar: el texto puede cambiar mañana
// sin avisar, el código no.
//
// NUNCA tira una excepción. Quien la llama no tiene que envolver nada en un
// try, igual que hoy no lo hace con las acciones de datos.js.
//
// LO QUE NO HACE, A PROPÓSITO:
//   · No guarda estado ni caché: eso es de datos.js.
//   · No sabe qué es un caso, un cobro ni un turno. Recibe una ruta.
//   · No decide reglas de negocio: las decide la API.
//   · No valida la forma de la respuesta. Si llega un campo que no conocemos,
//     se ignora: así la API puede agregar campos sin romper el front.
//
// El contrato está en docs/api.md y, completo, en MIGRACION.md del repo de
// la API. Los tests están en pruebas/api.test.js.

// La raíz de la API, sin la barra final. Es pública, como la de Supabase:
// viaja al navegador.
//
// Durante la transición, NEXT_PUBLIC_API_URL en Vercel todavía apunta a
// ".../payments", que es lo que usa pagos.js. Por eso se le saca ese final:
// así la misma variable sirve con el valor viejo y con la raíz, y el día que
// se cambie en Vercel no hay que tocar código (MIGRACION.md, sección 9).
export function raizDeLaApi(valor) {
  return String(valor ?? "").trim().replace(/\/+$/, "").replace(/\/(payments|v1)$/, "") || null;
}

export const RAIZ = raizDeLaApi(process.env.NEXT_PUBLIC_API_URL);

// Lo nuevo vive bajo /v1: las rutas que se le pasan a api() son "/insumos",
// no "/v1/insumos".
export const API = RAIZ ? `${RAIZ}/v1` : null;

// ------------------------------------------------------------
// El interruptor
// ------------------------------------------------------------
// El front migra a la API de a un recurso por vez. Hasta que se prende un
// recurso, sus acciones de datos.js siguen hablando con Supabase como
// siempre; prenderlo o apagarlo es cambiar una variable en Vercel, sin
// tocar código.
//
//   NEXT_PUBLIC_API_RECURSOS=inventario          sólo el inventario
//   NEXT_PUBLIC_API_RECURSOS=inventario,turnos   los dos
//   (vacía)                                      nada pasa por la API
export function recursosPrendidos(valor) {
  return new Set(
    String(valor ?? "")
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean)
  );
}

const PRENDIDOS = recursosPrendidos(process.env.NEXT_PUBLIC_API_RECURSOS);

// Sin dirección de la API no hay nada que prender.
export const usaLaApi = (recurso, { prendidos = PRENDIDOS, base = API } = {}) =>
  Boolean(base) && prendidos.has(recurso);

// Cuánto se espera antes de dar por perdido un pedido. La API duerme cuando
// no tiene tráfico y el primer pedido tarda, pero una pantalla colgada para
// siempre es peor que un "no pudimos conectarnos".
const SEGUNDOS = 15;

// Las frases para cuando la API no contestó con las suyas. Son del mismo
// estilo que el resto del sistema: dicen qué pasó y qué hacer.
const PORQUE = {
  401: { codigo: "sesion_vencida", mensaje: "Tu sesión venció. Volvé a entrar y probá de nuevo." },
  403: { codigo: "sin_permiso", mensaje: "No tenés permiso para hacer eso." },
  404: { codigo: "no_esta", mensaje: "Eso ya no está." },
  409: { codigo: "choque", mensaje: "Alguien más lo cambió mientras tanto. Volvé a abrirlo." },
  422: { codigo: "datos_invalidos", mensaje: "Revisá los datos: hay algo que no está bien." },
  429: { codigo: "muchos_intentos", mensaje: "Probá de nuevo en un minuto: se hicieron muchos intentos seguidos." },
};

const SIN_CONEXION = {
  codigo: "sin_conexion",
  mensaje: "No pudimos conectarnos. Fijate que tengas internet y volvé a probar.",
};

const SE_ROMPIO = {
  codigo: "error_interno",
  mensaje: "No pudimos completar la operación. Probá de nuevo en un rato.",
};

// Qué hacer cuando la API dice que la sesión venció. Lo engancha el
// proveedor de autenticación al arrancar: así la persona no se queda tocando
// botones que fallan sin entender por qué.
let avisarQueVencio = null;
export function alVencerLaSesion(fn) {
  avisarQueVencio = fn;
}

// Auth instala esta función cuando la sesión vive en nuestro almacén. Antes
// de cada pedido autenticado renueva el token si hace falta. El pedido de
// renovación no lleva token, por lo que no vuelve a entrar acá.
let prepararToken = null;
export function alPedirConSesion(fn) {
  prepararToken = fn;
}

// Una clave por intento, para los POST que crean algo o mueven plata.
// Reintentar con la misma clave devuelve la misma respuesta en vez de cobrar
// dos veces (docs/api.md, "Idempotencia").
export const nuevaClave = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ------------------------------------------------------------
// El pedido
// ------------------------------------------------------------
// Devuelve { ok, datos, siguiente } o { ok: false, error }.
//
// "fetcher" y "base" se reemplazan en los tests: así se prueba todo el
// comportamiento sin levantar nada ni pegarle a la API de verdad.
export async function api(
  ruta,
  {
    metodo = "GET",
    cuerpo,
    token,
    idempotencia,
    segundos = SEGUNDOS,
    fetcher = typeof fetch === "function" ? fetch : null,
    base = API,
    reintentar,
    // El pedido que renueva la sesión lo apaga: si falla, lo resuelve quien
    // renueva (src/lib/sesion.js), no el aviso general.
    avisarSiVence = true,
  } = {}
) {
  if (!base) {
    return {
      ok: false,
      error: {
        codigo: "sin_api",
        mensaje: "La aplicación todavía no está conectada al servidor. Avisale a quien la configuró.",
      },
    };
  }

  let tokenPreparado = token;
  if (token && prepararToken) {
    try {
      tokenPreparado = await prepararToken(token);
    } catch {
      tokenPreparado = null;
    }
    if (!tokenPreparado) {
      if (avisarSiVence && avisarQueVencio) avisarQueVencio();
      return { ok: false, error: { ...PORQUE[401] } };
    }
  }

  // Un GET perdido se puede repetir sin consecuencias. Un POST, sólo si
  // lleva clave de idempotencia: sin ella, repetir podría cobrar dos veces.
  const sePuedeRepetir = reintentar ?? (metodo === "GET" || Boolean(idempotencia));

  const opciones = { metodo, cuerpo, token: tokenPreparado, idempotencia, segundos, fetcher, base, avisarSiVence };
  let respuesta = await unIntento(ruta, opciones);
  if (!respuesta.ok && respuesta.reintentable && sePuedeRepetir) {
    respuesta = await unIntento(ruta, opciones);
  }

  // "reintentable" es cosa de acá adentro: no sale a la pantalla.
  const { reintentable, ...limpia } = respuesta;
  return limpia;
}

async function unIntento(ruta, { metodo, cuerpo, token, idempotencia, segundos, fetcher, base, avisarSiVence }) {
  const cortar = typeof AbortController === "function" ? new AbortController() : null;
  const reloj = cortar ? setTimeout(() => cortar.abort(), segundos * 1000) : null;

  let r;
  try {
    r = await fetcher(`${base}${ruta}`, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencia ? { "Idempotency-Key": idempotencia } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: cortar?.signal,
    });
  } catch {
    // Sin internet, la API caída, o se acabó el tiempo. Para quien mira la
    // pantalla es lo mismo, y conviene no contar la diferencia.
    return { ok: false, error: { ...SIN_CONEXION }, reintentable: true };
  } finally {
    if (reloj) clearTimeout(reloj);
  }

  const pedido = leerCabecera(r, "x-request-id");

  let cuerpoDeLaRespuesta = null;
  try {
    cuerpoDeLaRespuesta = await r.json();
  } catch {
    // Puede no haber cuerpo (204), o la API puede estar devolviendo HTML
    // —el error de un proxy, por ejemplo—. Se decide por el código.
  }

  if (r.ok && cuerpoDeLaRespuesta?.ok) {
    return {
      ok: true,
      datos: cuerpoDeLaRespuesta.datos,
      ...(cuerpoDeLaRespuesta.siguiente ? { siguiente: cuerpoDeLaRespuesta.siguiente } : {}),
    };
  }

  if (r.status === 401 && avisarSiVence && avisarQueVencio) avisarQueVencio();

  // Si la API contestó con su error, manda el suyo: está escrito para esta
  // situación y es mejor que cualquier frase genérica de acá.
  const suyo = cuerpoDeLaRespuesta?.error;
  const elError = suyo?.mensaje
    ? { codigo: suyo.codigo ?? "error", mensaje: suyo.mensaje, ...(suyo.campo ? { campo: suyo.campo } : {}), ...(suyo.detalles ? { detalles: suyo.detalles } : {}) }
    : { ...(PORQUE[r.status] ?? SE_ROMPIO) };

  return {
    ok: false,
    error: { ...elError, ...(pedido ? { pedido } : {}) },
    // Lo que falló del lado del servidor se puede reintentar; lo que falló
    // porque el pedido estaba mal, no: reintentarlo da el mismo error.
    reintentable: r.status >= 500,
  };
}

const leerCabecera = (r, nombre) => {
  try {
    return r.headers?.get?.(nombre) ?? null;
  } catch {
    return null;
  }
};

// ------------------------------------------------------------
// Atajos
// ------------------------------------------------------------
// Para que una acción de datos.js quede en tres renglones: llamar,
// actualizar la lista en memoria y devolver.
export const traer = (ruta, token, opciones) => api(ruta, { token, ...opciones });

export const mandar = (ruta, cuerpo, token, opciones) =>
  api(ruta, { metodo: "POST", cuerpo, token, ...opciones });

export const parchar = (ruta, cuerpo, token, opciones) =>
  api(ruta, { metodo: "PATCH", cuerpo, token, ...opciones });

// PUT: se manda la cosa entera, no sólo lo que cambia (los horarios, por ejemplo).
export const reemplazar = (ruta, cuerpo, token, opciones) =>
  api(ruta, { metodo: "PUT", cuerpo, token, ...opciones });

export const quitar = (ruta, token, opciones) => api(ruta, { metodo: "DELETE", token, ...opciones });
