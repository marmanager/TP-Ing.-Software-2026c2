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
  acceso: {
    marca: "Tu negocio, en orden",
    pie: "Sistema de gestión de casos para negocios de servicio.",
    separadorO: "o con tu mail",
    abriendoGoogle: "abriendo Google…",
    google: {
      cancelo: "No se completó el ingreso con Google. Si fue sin querer, probá de nuevo.",
      noActivado: "El ingreso con Google todavía no está activado. Por ahora entrá con tu mail y tu contraseña.",
      fallo: "No pudimos entrar con Google. Probá de nuevo o entrá con tu mail y tu contraseña.",
    },
    ingreso: {
      titulo: "Iniciar sesión",
      apoyo: "Entrá para ver los casos de tu negocio.",
      conGoogle: "Entrar con Google",
      mail: "Tu mail",
      contrasena: "Tu contraseña",
      mostrar: "Mostrar la contraseña",
      ocultar: "Ocultar la contraseña",
      olvide: "Me olvidé la contraseña",
      faltaMail: "falta el mail",
      faltaContrasena: "falta la contraseña",
      entrando: "entrando…",
      sinApi: "El sistema todavía no está conectado a la API: por ahora no se puede entrar.",
      sinCuenta: "¿No tenés cuenta?",
      crearUna: "Creá una",
    },
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
    sin_sesion: "No hay una sesión abierta.",
    sin_api_crear: "Para crear una cuenta hace falta que el sistema esté conectado a la API.",
    sin_api_entrar: "Para iniciar sesión hace falta que el sistema esté conectado a la API.",
    sin_api_google: "Para entrar con Google hace falta que el sistema esté conectado a la API.",
    sin_api_recuperar: "Para recuperar la contraseña hace falta que el sistema esté conectado a la API.",
    sin_api_invitacion: "Para usar una invitación hace falta que el sistema esté conectado a la API.",
    link_no_existe: "Este link no existe. Fijate que esté completo.",
    credenciales_invalidas: "El mail o la contraseña no coinciden.",
    mail_sin_confirmar: "Todavía no confirmaste el mail.",
    cuenta_existente: "Ya hay una cuenta con ese mail. Probá iniciar sesión.",
    auth_rechazado: "No se pudo completar. Revisá los datos y probá de nuevo.",
    volver_a_entrar: "Por seguridad, volvé a entrar con Google y creala enseguida.",
    falta_contrasena_actual: "Falta tu contraseña anterior.",
    contrasena_actual_incorrecta: "La contraseña anterior no es correcta.",
  },
};
