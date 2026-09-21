// Estado inicial del modo de ejemplo: vacío.
//
// Antes acá vivía un taller inventado con diez casos, clientes y patentes.
// Se sacó a propósito: lo que se muestra es un ingreso real, y un sistema con
// datos falsos adentro confunde más de lo que ayuda.
//
// El modo de ejemplo arranca sin negocio y pasa por "Crear tu negocio" como
// cualquier cuenta. La única diferencia es dónde se guarda: el navegador en
// vez de Supabase.

export function construirSemilla() {
  return {
    negocio: null,
    empleados: [],
    clientes: [],
    casos: [],
    pasos: [],
    eventos: [],
    insumos: [],
    turnos: [],
    invitaciones: [],
  };
}
