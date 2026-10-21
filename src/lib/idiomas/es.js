// Los textos de la app en castellano (docs/idiomas.md). Es la fuente: toda
// clave existe acá, y lo que falta en inglés se ve con este texto.
//
// Se agrupan como las rutas: casos.nuevo.titulo, inventario.sedes.vacio. Un
// plural es { one, other } con {n} adentro.

export default {
  idioma: {
    titulo: "Idioma",
    apoyo: "En qué idioma ves la app en este dispositivo.",
  },
  errores: {
    sesion_vencida: "Tu sesión venció. Volvé a entrar y probá de nuevo.",
    sin_permiso: "No tenés permiso para hacer eso.",
    no_esta: "Eso ya no está.",
    choque: "Alguien más lo cambió mientras tanto. Volvé a abrirlo.",
    datos_invalidos: "Revisá los datos: hay algo que no está bien.",
    muchos_intentos: "Probá de nuevo en un minuto: se hicieron muchos intentos seguidos.",
    sin_conexion: "No pudimos conectarnos. Fijate que tengas internet y volvé a probar.",
    error_interno: "No pudimos completar la operación. Probá de nuevo en un rato.",
    sin_api: "La aplicación todavía no está conectada al servidor. Avisale a quien la configuró.",
  },
};
