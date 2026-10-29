"use client";

// Guardia de rutas (SCRUM-5).
//
// Decide, según el estado de la sesión, si se ve una pantalla de entrada o el
// sistema completo con su navegación, y manda a la persona a donde corresponde:
//   sin entrar             -> /bienvenida
//   entró, falta confirmar -> /confirma-tu-mail
//   entró, sin negocio     -> /negocios, que ofrece crear uno
//   recién entró           -> /negocios, que elige o entra directo
//   entró y con negocio    -> el sistema

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { useDatos } from "@/lib/datos";
import { bloquea, RUTAS_SIN_SUSCRIPCION } from "@/lib/suscripcion";
import { ContextoSuscripcion, useSuscripcion } from "@/lib/useSuscripcion";
import { BarraLateral, BarraCelular } from "./Navegacion";
import PantallaEntrada from "./PantallaEntrada";
import Aviso from "./Aviso";
import FranjaDeVisita from "./FranjaDeVisita";
import FranjaDeVistaMaestra from "./FranjaDeVistaMaestra";
import SelectorDeVistaMaestra from "./SelectorDeVistaMaestra";
import Link from "next/link";
import { LISTA_MODULOS, LISTA_SUBMODULOS, estaPrendido, hijosActivos, traducirModulo } from "@/lib/modulos";
import { Cargando, Vacio } from "./ui";
import { seguirAlSistema } from "@/lib/tema";

// Pantallas a las que se llega sin haber entrado. "confirma-tu-mail" está
// acá porque con la verificación prendida el alta no deja sesión abierta.
const RUTAS_ENTRADA = [
  "/iniciar-sesion",
  "/crear-cuenta",
  "/recuperar-contrasena",
  "/nueva-contrasena",
  "/confirma-tu-mail",
];
const RUTA_NEGOCIO = "/crear-negocio";
const RUTA_CONFIRMAR = "/confirma-tu-mail";
// "¿A qué negocio entrás?" (docs/multinegocio.md). Se puede abrir con o sin
// negocio activo, y va con el marco de las pantallas de entrada.
const RUTA_NEGOCIOS = "/negocios";

// La landing es lo primero que ve quien todavía no tiene cuenta. No entra en
// RUTAS_ENTRADA porque no comparte el marco: las pantallas de entrada son una
// columna angosta y centrada, y la landing va a sangre completa.
const RUTA_BIENVENIDA = "/bienvenida";

// Elegir un plan y el mes de prueba (lib/suscripcion.js).
const RUTA_PLANES = "/planes";
const RUTA_PRUEBA = "/prueba";

// "/unirme/<código>" se abre desde el link de una invitación, así que tiene
// que ser alcanzable en cualquier estado: sin cuenta, con cuenta y sin
// negocio, o con negocio. La pantalla explica qué pasa en cada caso.
const esInvitacion = (ruta) => ruta.startsWith("/unirme");

// "/seguimiento/<código>" es la pantalla que abre el cliente del negocio
// desde un link de WhatsApp (SCRUM-68). No es una pantalla de entrada ni
// lleva a ninguna: quien la abre no tiene cuenta, no la va a tener, y
// pedirle que inicie sesión sería volver al teléfono que no para de sonar.
//
// Se va antes que todo lo demás, incluso antes de esperar a que resuelva la
// sesión: la pantalla no necesita nada de acá y mostrarle un "cargando" a
// quien viene de afuera es hacerlo esperar por algo que no le importa.
const esSeguimiento = (ruta) => ruta.startsWith("/seguimiento");

// "/turnos/<código>" es la otra pantalla pública: la agenda del negocio, para
// que un cliente pida turno solo (024). Mismas reglas que la de seguimiento,
// y por el mismo motivo: quien la abre no tiene cuenta y no la va a tener.
const esAgendaPublica = (ruta) => ruta.startsWith("/turnos");

// "/n/<código>" es la landing del negocio (docs/landing-por-negocio.md): lo
// que ve un cliente desde el Instagram del negocio. Mismas reglas que las dos
// anteriores. Con la barra: "/n" a secas agarraría también "/negocio",
// "/negocios" y "/nueva-contrasena", y el sistema se quedaría sin navegación.
const esLanding = (ruta) => ruta.startsWith("/n/");

// La pantalla de un módulo apagado se sigue pudiendo escribir en la barra de
// direcciones: un favorito viejo, un link que alguien pasó, el módulo apagado
// hace un rato. No alcanza con sacarlo de la navegación.
//
// No manda a otro lado: rebotar sin decir nada deja a la persona convencida
// de que el sistema se rompió. Explica qué pasó y ofrece prenderlo, que es
// lo que quería hacer.
const moduloApagado = (ruta, negocio) => {
  if (!negocio) return null;
  const activos = negocio.modulos_activos ?? [];

  // El módulo entero apagado se lleva también sus pantallas de adentro:
  // "/agenda" y "/agenda/calendario" caen las dos por "/agenda".
  const padre = LISTA_MODULOS.find(
    (m) => (ruta === m.ruta || ruta.startsWith(m.ruta + "/")) && !estaPrendido(m.clave, activos)
  );
  if (padre) return padre;

  // Y una pantalla apagada con su módulo prendido: la Agenda está, pero este
  // negocio no usa el Calendario. Mismo cartel, mismo camino para prenderlo.
  //
  // Acá la ruta se compara exacta. Con startsWith, "/agenda" —que es la ruta
  // de Turnos— sería el principio de "/agenda/calendario" y apagar Turnos
  // apagaría de rebote el Calendario.
  return (
    LISTA_SUBMODULOS.find(
      (s) =>
        ruta === s.ruta &&
        estaPrendido(s.padre, activos) &&
        !hijosActivos(s.padre, activos).some((h) => h.clave === s.clave)
    ) ?? null
  );
};

export default function Guardia({ children }) {
  const { t } = useIdioma();
  const { cargando, sesion, usuario, necesitaConfirmarMail, recuperando } = useAuth();
  const { cargando: datosCargando, negocio } = useDatos();
  const suscripcion = useSuscripcion();
  const ruta = usePathname();
  const router = useRouter();

  // Guardia está en todas las pantallas: acá se escucha el cambio de tema
  // del sistema, para quien eligió seguirlo.
  useEffect(seguirAlSistema, []);

  const publica = esSeguimiento(ruta) || esAgendaPublica(ruta) || esLanding(ruta);
  const hayEntrada = Boolean(sesion);
  const tieneNegocio = Boolean(usuario?.negocio_id);

  // A dónde tendría que estar parada la persona según su estado.
  const esperando = cargando || datosCargando || suscripcion.cargando;

  let destino = null;
  if (!esperando && !publica) {
    if (!hayEntrada) {
      // Sin cuenta, lo primero es la landing y no el formulario: quien llega
      // por primera vez todavía no sabe qué es esto.
      if (
        !RUTAS_ENTRADA.includes(ruta) &&
        !esInvitacion(ruta) &&
        ruta !== RUTA_BIENVENIDA
      )
        destino = RUTA_BIENVENIDA;
    } else if (recuperando && ruta === "/nueva-contrasena") {
      destino = null;
    } else if (necesitaConfirmarMail) {
      if (ruta !== RUTA_CONFIRMAR) destino = RUTA_CONFIRMAR;
    } else if (!tieneNegocio) {
      // Una cuenta sin negocio activo elige entre los suyos o crea uno.
      if (ruta !== RUTA_NEGOCIO && ruta !== RUTA_NEGOCIOS && !esInvitacion(ruta))
        destino = RUTA_NEGOCIOS;
    } else if (RUTAS_ENTRADA.includes(ruta) || ruta === RUTA_BIENVENIDA) {
      // Con sesión y negocio, estar en una pantalla de entrada es haber
      // iniciado sesión recién —así se vuelve de Google—: toca elegir
      // negocio. /crear-negocio y /negocios se pueden visitar teniendo negocio.
      destino = RUTA_NEGOCIOS;
    } else if (
      bloquea(suscripcion.datos) &&
      !RUTAS_SIN_SUSCRIPCION.includes(ruta) &&
      !esInvitacion(ruta)
    ) {
      // Sin suscripción ni prueba, el negocio va a elegir un plan. Es también
      // lo primero que ve después de crear el negocio.
      destino = RUTA_PLANES;
    }
  }

  useEffect(() => {
    if (destino && destino !== ruta) router.replace(destino);
  }, [destino, ruta, router]);

  // Sin marco, sin navegación y sin esperar a la sesión.
  if (publica) return children;

  if (esperando || (destino && destino !== ruta)) {
    return (
      <div className="mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8">
        <Cargando />
      </div>
    );
  }

  // La landing se dibuja sola: sin la columna de PantallaEntrada, sin la
  // navegación del sistema y sin el ancho de hoja. Va antes que todo lo
  // demás porque quien la mira, por definición, no tiene sesión.
  if (ruta === RUTA_BIENVENIDA) return children;

  const enEntrada =
    !hayEntrada ||
    necesitaConfirmarMail ||
    !tieneNegocio ||
    RUTAS_ENTRADA.includes(ruta) ||
    ruta === RUTA_NEGOCIO ||
    ruta === RUTA_NEGOCIOS ||
    esInvitacion(ruta);

  if (enEntrada) return <PantallaEntrada>{children}</PantallaEntrada>;

  // Planes y Prueba van sin la navegación: con el negocio bloqueado, cada
  // link de la barra rebotaría de vuelta acá.
  if (ruta === RUTA_PLANES || ruta === RUTA_PRUEBA) {
    return <ContextoSuscripcion.Provider value={suscripcion}>{children}</ContextoSuscripcion.Provider>;
  }

  // Con la navegación puesta, así se puede ir a otro lado sin volver atrás.
  const apagado = traducirModulo(moduloApagado(ruta, negocio), t);
  // La frase lleva el enlace adentro: se escribe entera, con un marcador
  // {enlace}, y se parte ahí; no se arma pegando pedazos traducidos. El
  // nombre y la descripción del módulo vienen de modulos.js.
  const [antesDelEnlace, despuesDelEnlace] = apagado
    ? t("ui.moduloApagado.texto", { descripcion: apagado.descripcion }).split("{enlace}")
    : [];

  return (
    <ContextoSuscripcion.Provider value={suscripcion}>
      {/* Lo primero de la página, para quien usa teclado o lector de
          pantalla: sin esto, en cada pantalla había que pasar por las nueve
          secciones de la barra antes de llegar a lo que se vino a hacer
          (auditoría, accesibilidad). Queda corrido fuera de la vista hasta que
          recibe el foco, y ahí baja arriba a la izquierda, con el anillo de
          foco de siempre. Corrido y no oculto: el lector de pantalla lo lee. */}
      <a
        href="#contenido"
        className="fixed top-3 left-3 z-50 -translate-y-[200%] whitespace-nowrap rounded-campo bg-azul px-4 py-3 font-bold text-white focus:translate-y-0"
      >
        {t("ui.irAlContenido")}
      </a>
      <div className="flex min-h-screen">
        <BarraLateral />
        <main
          id="contenido"
          tabIndex={-1}
          className="min-w-0 flex-1 pb-[calc(var(--alto-barra,4rem)+1rem)] focus:outline-none md:pb-0"
        >
          <FranjaDeVisita />
          <FranjaDeVistaMaestra />
          <SelectorDeVistaMaestra />
          {/* "@container": las grillas de las pantallas eligen sus columnas por el
                ancho de ESTE bloque y no por el de la ventana. En escritorio la
                barra lateral se lleva 256 px, y con los puntos de quiebre de la
                ventana quedaban tarjetas apretadas entre 768 y 1024 px
                (auditoría, Responsive). */}
            <div className={`@container mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8${usuario?.vista_maestra_desde ? " md:pr-64" : ""}`}>
            <Aviso />
            {apagado ? (
              <Vacio icono="tuerca" titulo={t("ui.moduloApagado.titulo", { nombre: apagado.nombre })}>
                {antesDelEnlace}
                <Link href="/negocio/modulos" className="font-bold text-azul">
                  {t("ui.moduloApagado.enlace")}
                </Link>
                {despuesDelEnlace}
              </Vacio>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
      <BarraCelular />
    </ContextoSuscripcion.Provider>
  );
}
