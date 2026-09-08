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
import { Vacio } from "./ui";

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

// "/unirme/<código>" se abre desde el link de una invitación, así que tiene
// que ser alcanzable en cualquier estado: sin cuenta, con cuenta y sin
// negocio, o con negocio. La pantalla explica qué pasa en cada caso.
const esInvitacion = (ruta) => ruta.startsWith("/unirme");

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

  const hayEntrada = esDemo || Boolean(sesion);
  const tieneNegocio = esDemo ? Boolean(negocio) : Boolean(usuario?.negocio_id);

  // A dónde tendría que estar parada la persona según su estado.
  const esperando = cargando || datosCargando;

  let destino = null;
  if (!esperando) {
    if (!hayEntrada) {
      if (!RUTAS_ENTRADA.includes(ruta) && !esInvitacion(ruta)) destino = "/iniciar-sesion";
    } else if (recuperando && ruta === "/nueva-contrasena") {
      destino = null;
    } else if (!esDemo && necesitaConfirmarMail) {
      if (ruta !== RUTA_CONFIRMAR) destino = RUTA_CONFIRMAR;
    } else if (!tieneNegocio) {
      if (ruta !== RUTA_NEGOCIO && !esInvitacion(ruta)) destino = RUTA_NEGOCIO;
    } else if (RUTAS_ENTRADA.includes(ruta)) {
      // Con negocio ya creado, /crear-negocio se puede visitar (avisa que ya
      // hay uno); las demás pantallas de entrada llevan al inicio.
      destino = "/";
    }
  }

  useEffect(() => {
    if (destino && destino !== ruta) router.replace(destino);
  }, [destino, ruta, router]);

  if (esperando || (destino && destino !== ruta)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-tinta-suave"
        role="status"
      >
        Cargando…
      </div>
    );
  }

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
      <div className="flex min-h-screen">
        <BarraLateral />
        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8">
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
