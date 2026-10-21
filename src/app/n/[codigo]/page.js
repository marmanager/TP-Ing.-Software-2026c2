"use client";

// La landing de un negocio: su página pública, la que pone en su Instagram o
// manda por WhatsApp (docs/landing-por-negocio.md).
//
// La abre gente que nunca vio la aplicación, casi siempre desde el celular,
// y sigue las reglas de las otras pantallas públicas (/seguimiento,
// /turnos): sin navegación, sin nada que lleve adentro del sistema, y todo lo
// que necesita explicación explicado ahí mismo. Lo distinto es que se pinta
// con los colores y la letra que eligió el negocio (Lienzo), y que el cliente
// puede entrar —con su identificador y los últimos 4 números de su teléfono—
// para ver lo suyo.
//
// Qué secciones aparecen y en qué orden lo decide estadoDeSecciones()
// (src/lib/landing.js) con lo que manda la API: el orden que guardó el
// negocio, sus módulos y si publicó horarios. Cada sección es un componente
// de src/componentes/landing/secciones/.
//
// "entrado" vive acá y no en cada sección: entrar desde una sección abre
// todas las que muestran lo del cliente, y salir las cierra todas. Por lo
// mismo, el Ingreso lo pone la página y hay uno solo: va en la primera de las
// secciones privadas (Mis casos o Mis turnos, según el orden) y la otra,
// mientras no entró, lleva hasta él. Dos formularios iguales en la misma
// página harían pensar que son dos cosas distintas.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { buscarLanding, salirDeLanding } from "@/lib/datos";
import { estadoDeSecciones } from "@/lib/landing";
import { leerLlave } from "@/lib/llave-landing";
import Icono from "@/componentes/Icono";
import Lienzo from "@/componentes/landing/Lienzo";
import SelectorIdioma from "@/componentes/SelectorIdioma";
import Ingreso from "@/componentes/landing/secciones/Ingreso";
import SeccionMisCasos from "@/componentes/landing/secciones/SeccionMisCasos";
import SeccionMisTurnos from "@/componentes/landing/secciones/SeccionMisTurnos";
import SeccionNegocio from "@/componentes/landing/secciones/SeccionNegocio";
import SeccionSacarTurno from "@/componentes/landing/secciones/SeccionSacarTurno";
import { Boton, Cargando } from "@/componentes/ui";

// Una sección, un componente.
const COMPONENTES = {
  negocio: SeccionNegocio,
  sacar_turno: SeccionSacarTurno,
  mis_casos: SeccionMisCasos,
  mis_turnos: SeccionMisTurnos,
};

// Las que muestran lo del cliente: sin entrar, en su lugar va el Ingreso (o
// el camino hasta él). Con qué botón se entra y qué se ve al entrar.
const PRIVADAS = {
  mis_casos: { boton: "Ver mis casos", que: "tus casos" },
  mis_turnos: { boton: "Ver mis turnos", que: "tus turnos" },
};

export default function Landing() {
  const { codigo } = useParams();
  const [mirando, setMirando] = useState(true);
  const [pagina, setPagina] = useState(null);
  const [entrado, setEntrado] = useState(false);
  // Por qué se le vuelven a pedir los datos (la llave venció). Lo muestra el
  // Ingreso, aunque la que se dio cuenta haya sido otra sección, y mientras
  // está, "Sacar turno" no ofrece registrarse: lo manda al Ingreso.
  const [aviso, setAviso] = useState(null);
  // Cuántos turnos sacó desde que abrió la página: "Mis turnos" se vuelve a
  // pedir cada vez que cambia.
  const [reservas, setReservas] = useState(0);
  // Cuántas veces salió. Las secciones llevan esto de key: salir las arranca
  // de cero, y en un celular prestado el que sigue no ve la confirmación del
  // turno ni el nombre y el teléfono que escribió el anterior.
  const [salidas, setSalidas] = useState(0);
  // Al entrar, al salir o cuando la llave vence, lo que tenía el foco (el
  // botón de entrar, el de salir, el de pedir el turno) desaparece o se
  // apaga, y el foco quedaría en la nada: quien usa lector de pantalla no se
  // entera de qué cambió. Va al título de la sección del Ingreso, que es
  // donde está lo nuevo: lo suyo recién abierto, o el Ingreso otra vez con el
  // aviso de por qué. Cuenta las veces y no es un sí o no, así dos seguidas también lo
  // mueven. (Registrarse sacando turno no lo mueve: la confirmación del turno
  // se anuncia sola, con role="status".)
  const [foco, setFoco] = useState(0);

  // Estables, porque las listas los usan en sus efectos: si cambiaran en cada
  // dibujo, volverían a pedir los datos cada vez.
  const alEntrar = useCallback(() => {
    setAviso(null);
    setEntrado(true);
  }, []);
  const alVencer = useCallback((mensaje) => {
    setAviso(mensaje);
    setEntrado(false);
    setFoco((n) => n + 1);
  }, []);
  const alReservar = useCallback(() => setReservas((n) => n + 1), []);

  useEffect(() => {
    if (foco) document.querySelector("[data-titulo-del-ingreso]")?.focus();
  }, [foco]);
  const entrarConDatos = useCallback(() => {
    alEntrar();
    setFoco((n) => n + 1);
  }, [alEntrar]);

  useEffect(() => {
    document.title = pagina?.negocio?.nombre ?? "La página del negocio";
  }, [pagina]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await buscarLanding(codigo);
      if (!vivo) return;
      setPagina(r);
      // La llave se lee recién acá, en el navegador: en el servidor no hay
      // sessionStorage, y la primera pantalla tiene que ser la misma en los dos.
      setEntrado(Boolean(leerLlave(codigo)));
      setMirando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [codigo]);

  function salir() {
    salirDeLanding(codigo);
    setEntrado(false);
    setSalidas((n) => n + 1);
    setFoco((n) => n + 1);
  }

  if (mirando) {
    return (
      <Marco>
        <Cargando filas={2} />
      </Marco>
    );
  }

  // No es lo mismo que el link no sirva que no haber podido preguntar: si la
  // API no contestó, se dice eso, y el link puede andar en un rato.
  if (!pagina?.sirve && pagina?.problema) {
    return (
      <Marco>
        <Tarjetita titulo="No pudimos abrir la página del negocio">{pagina.problema}</Tarjetita>
      </Marco>
    );
  }

  // Da lo mismo si nunca existió o si el negocio dejó de compartirla:
  // contarle la diferencia a quien lo abre no le sirve de nada.
  if (!pagina?.sirve) {
    return (
      <Marco>
        <Tarjetita titulo="Este link ya no sirve">
          Puede ser que esté cortado, que se haya copiado de más o que el negocio
          lo haya dado de baja. Pedile uno nuevo a quien te lo mandó.
        </Tarjetita>
      </Marco>
    );
  }

  const { negocio, landing, modulos_activos, horarios } = pagina;
  const secciones = estadoDeSecciones(landing.orden, modulos_activos, Boolean(horarios)).filter(
    (s) => s.visible
  );
  const conIngreso = secciones.find((s) => PRIVADAS[s.clave]);
  // Un solo botón principal por pantalla: si se puede sacar turno, es "Pedir
  // el turno", que es a lo que viene la mayoría; el de entrar va con borde.
  const conTurno = secciones.some((s) => s.clave === "sacar_turno");

  return (
    <Lienzo landing={landing}>
      <Marco
        negocio={negocio}
        accion={
          // Cerrar la pestaña también es salir (la llave vive en
          // sessionStorage); el botón es para un celular prestado.
          entrado && (
            <Boton variante="plano" icono="salir" onClick={salir}>
              Salir
            </Boton>
          )
        }
      >
        <div className="flex flex-col gap-6">
          {secciones.map(({ clave, nombre }) => {
            const Seccion = COMPONENTES[clave];
            const delIngreso = clave === conIngreso?.clave;
            return (
              <section
                key={clave}
                aria-labelledby={`seccion-${clave}`}
                className="rounded-tarjeta border border-borde bg-tarjeta p-5 sm:p-6"
              >
                {/* Los mismos títulos que la vista previa del editor: lo que
                    el negocio vio ahí es lo que ve su cliente. El de la
                    sección del Ingreso recibe el foco al entrar, al salir y
                    cuando vence la llave (ver "foco"). */}
                <h2
                  id={`seccion-${clave}`}
                  tabIndex={delIngreso ? -1 : undefined}
                  data-titulo-del-ingreso={delIngreso ? "" : undefined}
                  className="text-seccion focus:outline-none"
                >
                  {nombre}
                </h2>
                {PRIVADAS[clave] && !entrado ? (
                  delIngreso ? (
                    <Ingreso
                      codigo={codigo}
                      negocio={negocio}
                      boton={PRIVADAS[clave].boton}
                      aviso={aviso}
                      principal={!conTurno}
                      alEntrar={entrarConDatos}
                    />
                  ) : (
                    // Siempre está más abajo que el Ingreso: el Ingreso va en
                    // la primera de las dos.
                    <>
                      <p className="mt-2 max-w-[65ch] text-tinta-media">
                        Para ver {PRIVADAS[clave].que}, entrá con tus datos en «{conIngreso.nombre}», más
                        arriba.
                      </p>
                      <a href="#ingreso" className="mt-2 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
                        <Icono nombre="llave" className="size-5" />
                        Ir a poner mis datos
                      </a>
                    </>
                  )
                ) : (
                  <Seccion
                    key={salidas}
                    codigo={codigo}
                    negocio={negocio}
                    horarios={horarios}
                    entrado={entrado}
                    vencida={Boolean(aviso)}
                    alEntrar={alEntrar}
                    alVencer={alVencer}
                    alReservar={alReservar}
                    reservas={reservas}
                  />
                )}
              </section>
            );
          })}
        </div>
      </Marco>
    </Lienzo>
  );
}

function Tarjetita({ titulo, children }) {
  return (
    <div className="rounded-tarjeta border border-borde bg-tarjeta p-6">
      <p className="flex items-start gap-3 font-titulo font-extrabold text-seccion">
        <Icono nombre="alerta" className="mt-1 size-7 shrink-0 text-espera" />
        <span>{titulo}</span>
      </p>
      <p className="mt-3 max-w-[65ch] text-tinta-media">{children}</p>
    </div>
  );
}

// El marco de las otras pantallas públicas, con el logo del negocio si lo
// cargó y su nombre como título: es su página. Mientras carga, o si el link
// no sirve, todavía no se sabe de quién es y va sin nombre.
function Marco({ negocio, accion, children }) {
  return (
    <div className="min-h-screen bg-fondo">
      <header className="border-b border-borde bg-tarjeta">
        <div className="mx-auto flex w-full max-w-[640px] items-center gap-3 px-4 py-4">
          {negocio?.foto ? (
            <img src={negocio.foto} alt="" className="size-12 shrink-0 rounded-campo object-cover" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
              <Icono nombre="tienda" />
            </span>
          )}
          {/* Se parte en renglones y no se corta: es el nombre del negocio, y
              en un celular "Taller Mecánico Hermanos…" no dice de quién es. */}
          <h1 className="min-w-0 flex-1 break-words font-titulo font-extrabold text-subtitulo leading-tight">
            {negocio?.nombre ?? "La página del negocio"}
          </h1>
          {accion}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-8">
        {children}
        <div className="mt-4">
          <SelectorIdioma />
        </div>
      </main>
    </div>
  );
}
