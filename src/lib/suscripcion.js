// La suscripción del negocio (GET y POST /v1/suscripcion de la API).
//
// Paga el dueño y entra todo el equipo; los mails de ACCESO_LIBRE de la API
// entran sin pagar. Quién tiene acceso lo decide la API: acá sólo se decide
// qué mostrar con lo que contesta.
//
// EL TECHO: el bloqueo es de pantalla. El front habla directo con Supabase,
// así que quien sepa de qué se trata puede saltarlo. Para cerrarlo de verdad
// habría que pedir la suscripción en las políticas RLS.

// Se bloquea sólo si la API dijo, con todas las letras, que no hay acceso.
// Si no contestó (sin conexión, sin API configurada), se deja pasar: una
// caída de la API no debería dejar a todos afuera.
export const bloquea = (datos) => datos?.activa === false;

// A dónde se puede ir sin suscripción: lo necesario para pagar, cambiar de
// negocio o unirse a uno.
export const RUTAS_SIN_SUSCRIPCION = ["/perfil", "/negocios", "/crear-negocio"];

// Mercado Pago manda a una dirección https. Cualquier otra cosa no se abre.
export function urlDePago(url) {
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
