// Íconos de trazo simple, sin relleno (cartilla, sección 06).
//
// Van como SVG inline y no como fuente de íconos a propósito: una fuente
// puede fallar y dejar la palabra "check_circle" escrita en pantalla, y un
// lector de pantalla la lee siempre. Son doce íconos, no hace falta más.
//
// Regla de la cartilla: nunca un botón que sea sólo un ícono. Siempre va
// la palabra al lado, por eso el svg es aria-hidden. Las excepciones,
// decididas en equipo, son abrir y cerrar la barra lateral y el ojo de los
// campos de contraseña: esos botones llevan aria-label y title, que dicen lo
// que hacen.

const TRAZOS = {
  // SVG de Bootstrap Icons (MIT); licencia en docs/licencias/bootstrap-icons.txt.
  whatsapp: <path fill="currentColor" stroke="none" d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />,
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  carpeta: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  persona: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    </>
  ),
  personas: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" />
      <path d="M18 14.5c2.2.7 3.8 2.7 3.8 5.5" />
    </>
  ),
  "persona-mas": (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.3 3.1-6 7-6 1.2 0 2.3.2 3.3.7" />
      <path d="M18 14v6M15 17h6" />
    </>
  ),
  "persona-check": (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.3 3.1-6 7-6 .9 0 1.8.1 2.6.4" />
      <path d="M14.5 17.5l2 2 4-4" />
    </>
  ),
  tienda: (
    <>
      <path d="M3 9h18" />
      <path d="M5 9v11h14V9" />
      <path d="M5 9 6.5 4h11L19 9" />
      <path d="M9 20v-5h6v5" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  cajas: (
    <>
      <path d="M3 8l9-4 9 4-9 4z" />
      <path d="M3 8v8l9 4 9-4V8" />
      <path d="M12 12v8" />
    </>
  ),
  llave: (
    <path d="M17.5 3.5a5 5 0 0 0-6.3 6.3L4 17l3 3 7.2-7.2a5 5 0 0 0 6.3-6.3l-3 3-2.5-.5-.5-2.5z" />
  ),
  // Mostrar u ocultar lo que se escribe en un campo de contraseña.
  ojo: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "ojo-tachado": (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  // Una ventana con la franja de la izquierda marcada: la barra lateral.
  // Abre y cierra la barra en la computadora.
  panel: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 4.5v15" />
    </>
  ),
  // Cuatro cuadrados: "todas las secciones", el lugar "Más" de la barra del
  // celular. No es el "+", que en el sistema quiere decir "agregar".
  secciones: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  // Un reloj con la flecha para atrás: lo que ya pasó. Distinto de "reloj",
  // que es un reloj de arena y quiere decir "esperando".
  historial: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3 3.5v4h4" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  reloj: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3v3.5c0 1.5 1.3 2.6 2.7 3.6.9.6.9 1.2 0 1.8C9.3 12.9 8 14 8 15.5V21" />
      <path d="M16 3v3.5c0 1.5-1.3 2.6-2.7 3.6-.9.6-.9 1.2 0 1.8 1.4 1 2.7 2.1 2.7 3.6V21" />
    </>
  ),
  nota: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  listo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.8 2.8L16 10" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  "flecha-izq": <path d="M14.5 6l-6 6 6 6" />,
  "flecha-der": <path d="M9.5 6l6 6-6 6" />,
  diagnostico: (
    <>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
      <path d="M8 6H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  camion: (
    <>
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  chat: <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />,
  telefono: (
    <path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z" />
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  tacho: (
    <>
      <path d="M4 7h16M10 4h4" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  volver: <path d="M15 19l-7-7 7-7" />,
  "flecha-abajo": <path d="M6 9l6 6 6-6" />,
  "flecha-arriba": <path d="M6 15l6-6 6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  // Un círculo vacío: el par del tilde. Juntos dicen hecho y todavía no
  // sin que haga falta el color.
  circulo: <circle cx="12" cy="12" r="8.5" />,
  cruz: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  deshacer: (
    <>
      <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
      <path d="M8 5L4 9l4 4" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17.4v.2" />
    </>
  ),
  sobre: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  copiar: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M15 5H5a2 2 0 0 0-2 2v10" />
    </>
  ),
  salir: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </>
  ),
  // La sección 06 no quiere engranajes sueltos, así que éste nunca va solo:
  // siempre lleva la palabra "Ajustes" al lado, y sólo aparece acomodando
  // la pantalla de inicio.
  tuerca: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.9a7.9 7.9 0 0 0 0-3.8l2-1.5-2-3.4-2.3 1a7.9 7.9 0 0 0-3.3-1.9L13.5 2h-3l-.3 2.3a7.9 7.9 0 0 0-3.3 1.9l-2.3-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 3.8l-2 1.5 2 3.4 2.3-1a7.9 7.9 0 0 0 3.3 1.9l.3 2.3h3l.3-2.3a7.9 7.9 0 0 0 3.3-1.9l2.3 1 2-3.4z" />
    </>
  ),
  // Tres líneas que se achican hacia abajo, como un embudo: el ícono de
  // filtros de siempre. Va a la derecha de la palabra "Filtros".
  filtro: <path d="M4 7h16M7 12h10M10 17h4" />,
  // Una persona dentro de un círculo: la cuenta de quien entró (Mi perfil).
  // Distinto de "persona", que es el de Clientes: en el mismo menú, dos
  // íconos iguales obligan a leer la palabra para saber cuál es cuál.
  cuenta: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.2 18.4c1.3-2.2 3.4-3.4 5.8-3.4s4.5 1.2 5.8 3.4" />
    </>
  ),
  // Apunta a la derecha. En el seguimiento une un estado con el siguiente; en
  // celular, donde los estados van apilados, se gira con CSS para que apunte
  // abajo, en vez de tener un segundo ícono.
  flecha: <path d="M4 12h15M13 6l6 6-6 6" />,
  // El mango en diagonal y las cerdas en la punta de abajo. Va sobre la foto
  // del negocio mientras se la edita, y es la única vez en todo el sistema
  // que un botón queda sin palabra al lado: encima de la foto no entra. Por
  // eso ese botón lleva aria-label, que es lo que lee un lector de pantalla.
  pincel: (
    <>
      <path d="M20.3 3.7a2.3 2.3 0 0 0-3.3 0l-7.6 7.6 3.3 3.3 7.6-7.6a2.3 2.3 0 0 0 0-3.3z" />
      <path d="M9.4 11.3 5.9 14.8a4.2 4.2 0 0 0-1.2 2.4c-.1.9-.7 1.5-1.6 1.9 1.2 1 2.7 1.6 4.3 1.6a4.6 4.6 0 0 0 4.6-4.6c0-.5.2-1 .5-1.4z" />
    </>
  ),
};

export default function Icono({ nombre, className = "size-6" }) {
  const trazo = TRAZOS[nombre];
  if (!trazo) return null;

  return (
    <svg
      viewBox={nombre === "whatsapp" ? "0 0 16 16" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className + " shrink-0"}
      aria-hidden="true"
      focusable="false"
    >
      {trazo}
    </svg>
  );
}
