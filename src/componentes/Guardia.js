"use client";

// Guardia de rutas (SCRUM-5).
//
// Decide, según el estado de la sesión, si se ve una pantalla de entrada o el
// sistema completo con su navegación, y manda a la persona a donde corresponde:
//   sin entrar            -> /iniciar-sesion
//   entró, falta confirmar -> /confirma-tu-mail
//   entró, sin negocio     -> /crear-negocio
//   entró y con negocio    -> el sistema

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { BarraLateral, BarraCelular } from "./Navegacion";
import PantallaEntrada from "./PantallaEntrada";
import Aviso from "./Aviso";
import Link from "next/link";
import { LISTA_MODULOS } from "@/lib/modulos";
import { Cargando, Vacio } from "./ui";

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

// La landing es lo primero que ve quien todavía no tiene cuenta. No entra en
// RUTAS_ENTRADA porque no comparte el marco: las pantallas de entrada son una
// columna angosta y centrada, y la landing va a sangre completa.
const RUTA_BIENVENIDA = "/bienvenida";

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
  return (
    LISTA_MODULOS.find(
      (m) => (ruta === m.ruta || ruta.startsWith(m.ruta + "/")) && !activos.includes(m.clave)
    ) ?? null
  );
};

export default function Guardia({ children }) {
  const { cargando, esDemo, sesion, usuario, necesitaConfirmarMail, recuperando } = useAuth();
  // En modo de ejemplo el negocio vive en el navegador, no en la cuenta.
  const { cargando: datosCargando, negocio } = useDatos();
  const ruta = usePathname();
  const router = useRouter();

  const publica = esSeguimiento(ruta);
  const hayEntrada = esDemo || Boolean(sesion);
  const tieneNegocio = esDemo ? Boolean(negocio) : Boolean(usuario?.negocio_id);

  // A dónde tendría que estar parada la persona según su estado.
  const esperando = cargando || datosCargando;

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
    } else if (!esDemo && necesitaConfirmarMail) {
      if (ruta !== RUTA_CONFIRMAR) destino = RUTA_CONFIRMAR;
    } else if (!tieneNegocio) {
      if (ruta !== RUTA_NEGOCIO && !esInvitacion(ruta)) destino = RUTA_NEGOCIO;
    } else if (RUTAS_ENTRADA.includes(ruta) || ruta === RUTA_BIENVENIDA) {
      // Con negocio ya creado, /crear-negocio se puede visitar (avisa que ya
      // hay uno); las demás pantallas de entrada, y la landing, llevan al
      // inicio: a quien ya entró no hay nada que contarle.
      destino = "/";
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
    (!esDemo && necesitaConfirmarMail) ||
    !tieneNegocio ||
    RUTAS_ENTRADA.includes(ruta) ||
    ruta === RUTA_NEGOCIO ||
    esInvitacion(ruta);

  if (enEntrada) return <PantallaEntrada>{children}</PantallaEntrada>;

  // Con la navegación puesta, así se puede ir a otro lado sin volver atrás.
  const apagado = moduloApagado(ruta, negocio);

  return (
    <>
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
        Ir al contenido
      </a>
      <div className="flex min-h-screen">
        <BarraLateral />
        <main
          id="contenido"
          tabIndex={-1}
          className="min-w-0 flex-1 pb-[calc(var(--alto-barra,4rem)+1rem)] focus:outline-none md:pb-0"
        >
          {/* "@container": las grillas de las pantallas eligen sus columnas por el
                ancho de ESTE bloque y no por el de la ventana. En escritorio la
                barra lateral se lleva 256 px, y con los puntos de quiebre de la
                ventana quedaban tarjetas apretadas entre 768 y 1024 px
                (auditoría, Responsive). */}
            <div className="@container mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8">
            <Aviso />
            {apagado ? (
              <Vacio icono="tuerca" titulo={`Tu negocio no tiene ${apagado.nombre}`}>
                {apagado.descripcion} Si te sirve, se prende desde{" "}
                <Link href="/negocio/modulos" className="font-bold text-azul">
                  Mi negocio
                </Link>
                , y lo que ya tengas cargado sigue estando.
              </Vacio>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
      <BarraCelular />
    </>
  );
}
