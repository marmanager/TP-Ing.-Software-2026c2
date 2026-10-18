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
// todas las que muestran lo del cliente, y salir las cierra todas.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { buscarLanding, salirDeLanding } from "@/lib/datos";
import { estadoDeSecciones } from "@/lib/landing";
import { leerLlave } from "@/lib/llave-landing";
import Icono from "@/componentes/Icono";
import Lienzo from "@/componentes/landing/Lienzo";
import SeccionMisCasos from "@/componentes/landing/secciones/SeccionMisCasos";
import SeccionNegocio from "@/componentes/landing/secciones/SeccionNegocio";
import { Boton, Cargando } from "@/componentes/ui";

// Una sección, un componente. "Sacar turno" y "Mis turnos" todavía no tienen
// el suyo (la Tarea 8 del plan los suma acá): mientras tanto no se dibujan,
// aunque estadoDeSecciones() diga que corresponden.
const COMPONENTES = {
  negocio: SeccionNegocio,
  mis_casos: SeccionMisCasos,
  sacar_turno: null,
  mis_turnos: null,
};

export default function Landing() {
  const { codigo } = useParams();
  const [mirando, setMirando] = useState(true);
  const [pagina, setPagina] = useState(null);
  const [entrado, setEntrado] = useState(false);

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
    (s) => s.visible && COMPONENTES[s.clave]
  );

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
            return (
              <section
                key={clave}
                aria-labelledby={`seccion-${clave}`}
                className="rounded-tarjeta border border-borde bg-tarjeta p-5 sm:p-6"
              >
                {/* Los mismos títulos que la vista previa del editor: lo que
                    el negocio vio ahí es lo que ve su cliente. */}
                <h2 id={`seccion-${clave}`} className="text-seccion">
                  {nombre}
                </h2>
                <Seccion
                  codigo={codigo}
                  negocio={negocio}
                  horarios={horarios}
                  entrado={entrado}
                  setEntrado={setEntrado}
                />
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
          <h1 className="min-w-0 flex-1 truncate font-titulo font-extrabold text-subtitulo leading-tight">
            {negocio?.nombre ?? "La página del negocio"}
          </h1>
          {accion}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
