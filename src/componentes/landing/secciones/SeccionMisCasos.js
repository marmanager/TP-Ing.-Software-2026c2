"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { misCasosEnLanding } from "@/lib/datos";
import { elDia } from "@/lib/fechas";
import { comoSeIdentifica } from "@/lib/presets";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Boton } from "@/componentes/ui";

// "Mis casos", en la landing: los casos abiertos del cliente, cada uno con su
// estado y un link a su seguimiento, que es donde se ve todo lo demás. Los
// terminados no vienen (lo decide la base).
//
// La página la dibuja sólo cuando el cliente entró (sin entrar, en su lugar
// va el Ingreso), así que cada vez que se entra arranca de cero: si alguien
// sale y entra otra persona en el mismo celular, no ve ni por un momento la
// lista de la anterior. Si la llave venció, alVencer() vuelve al Ingreso
// diciendo por qué.
export default function SeccionMisCasos({ codigo, negocio, alVencer }) {
  const { idioma, locale, t } = useIdioma();
  const [casos, setCasos] = useState(null);
  const [problema, setProblema] = useState(null);
  const [vuelta, setVuelta] = useState(0);
  const ident = comoSeIdentifica(negocio.rubro, idioma);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await misCasosEnLanding(codigo);
      if (!vivo) return;
      if (r.ok) setCasos(r.casos);
      else if (r.codigo === "llave_vencida") alVencer({ codigo: r.codigo, mensaje: r.mensaje });
      else setProblema({ codigo: r.codigo, mensaje: r.mensaje });
    })();
    return () => {
      vivo = false;
    };
  }, [codigo, vuelta, alVencer]);

  if (problema) {
    return (
      <div className="mt-2">
        <p role="alert" className="flex items-start gap-2 font-bold text-rojo">
          <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
          <span>{textoDeError(t, problema)}</span>
        </p>
        <Boton
          icono="deshacer"
          className="mt-4"
          onClick={() => {
            setProblema(null);
            setVuelta((v) => v + 1);
          }}
        >
          {t("landing.casos.probar")}
        </Boton>
      </div>
    );
  }

  if (!casos) {
    return (
      <p role="status" className="mt-2 text-tinta-media">
        {t("landing.casos.buscando")}
      </p>
    );
  }

  if (casos.length === 0) {
    return (
      <p className="mt-2 max-w-[65ch] text-tinta-media">
        {t("landing.casos.ninguno", { negocio: negocio.nombre })}
      </p>
    );
  }

  return (
    <ul className="mt-2 divide-y divide-borde">
      {casos.map((c) => (
        <li key={c.seguimiento_codigo ?? c.numero} className="py-4 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div id={`caso-${c.numero}`} className="min-w-0">
              <p className="font-titulo font-extrabold text-subtitulo">
                {c.servicio || t("casos.nombre.caso", { numero: c.numero })}
              </p>
              {c.identificador && (
                <p className="text-tinta-media">
                  {ident.nombre} {c.identificador}
                </p>
              )}
              <p className="text-apoyo text-tinta-suave">
                {t("landing.casos.entro", { numero: c.numero, dia: elDia(c.abierto_en, locale, t) })}
              </p>
            </div>
            <ChipEstado estado={c.estado} rubro={negocio.rubro} configuracion={negocio.estados} />
          </div>
          {c.seguimiento_codigo && (
            <Link
              href={`/seguimiento/${c.seguimiento_codigo}`}
              aria-describedby={`caso-${c.numero}`}
              data-testid={`landing-caso-seguimiento-${c.numero}`}
              className="mt-2 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              {t("landing.casos.verComoViene")}
              <Icono nombre="flecha" className="size-5" />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
