// La suscripción del negocio (/v1/suscripcion de la API).
//
// Paga el dueño y entra todo el equipo. Hay acceso con un pago activo, en el
// mes de prueba (una vez por cuenta, sin tarjeta) o con un mail de
// ACCESO_LIBRE de la API. Quién tiene acceso lo decide la API: acá sólo se
// decide qué mostrar con lo que contesta.
//
// Los planes están en dólares. Mercado Pago cobra en pesos, al dólar oficial
// del momento en que se suscribe: la API manda los dos montos.
//
// EL TECHO: el bloqueo es de pantalla. El front habla directo con Supabase,
// así que quien sepa de qué se trata puede saltarlo. Para cerrarlo de verdad
// habría que pedir la suscripción en las políticas RLS.

// Se bloquea sólo si la API dijo, con todas las letras, que no hay acceso.
// Si no contestó (sin conexión, sin API configurada), se deja pasar: una
// caída de la API no debería dejar a todos afuera.
export const bloquea = (datos) => datos?.activa === false;

// A dónde se puede ir sin suscripción: lo necesario para elegir un plan,
// empezar la prueba, cambiar de negocio o unirse a uno.
export const RUTAS_SIN_SUSCRIPCION = ["/planes", "/prueba", "/perfil", "/negocios", "/crear-negocio"];

// Mercado Pago manda a una dirección https. Cualquier otra cosa no se abre.
export function urlDePago(url) {
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// Los precios de la API (uno por plan y período) juntados por plan, del más
// barato al más caro (el Básico a la izquierda y el Pro a la derecha, sin
// depender del orden en que la base los devuelva):
// [{ plan, descripcion, mensual, anual }].
export function agruparPlanes(precios = []) {
  const planes = [];
  for (const p of precios) {
    let plan = planes.find((x) => x.plan === p.plan);
    if (!plan) planes.push((plan = { plan: p.plan, descripcion: p.descripcion, mensual: null, anual: null }));
    plan[p.periodo] = p;
  }
  return planes.sort((a, b) => (a.mensual?.usd ?? Infinity) - (b.mensual?.usd ?? Infinity));
}

// Un monto en la moneda elegida, o null si en pesos no hay cotización.
export function monto(precio, moneda) {
  if (!precio) return null;
  if (moneda === "USD") return `USD ${precio.usd.toLocaleString("es-AR")}`;
  return precio.ars == null ? null : `$ ${precio.ars.toLocaleString("es-AR")}`;
}

// Cuánto se ahorra con el anual frente a doce mensuales, en la misma forma
// que monto(). null si falta alguno de los dos o no hay ahorro.
export function ahorroAnual(mensual, anual, moneda) {
  if (!mensual || !anual) return null;
  const ahorro = {
    usd: mensual.usd * 12 - anual.usd,
    ars: mensual.ars == null || anual.ars == null ? null : mensual.ars * 12 - anual.ars,
  };
  return ahorro.usd > 0 ? monto(ahorro, moneda) : null;
}

// Los días que le quedan a la prueba, redondeando para arriba: con medio día
// por delante, todavía queda "1 día". Nunca negativo.
export function diasQueQuedan(hasta, ahora = Date.now()) {
  const fin = new Date(hasta).getTime();
  if (!Number.isFinite(fin)) return 0;
  return Math.max(0, Math.ceil((fin - ahora) / 86_400_000));
}
