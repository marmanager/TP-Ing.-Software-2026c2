"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { misCasosEnLanding } from "@/lib/datos";
import { elDia } from "@/lib/fechas";
import { comoSeIdentifica } from "@/lib/presets";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Boton } from "@/componentes/ui";
import Ingreso from "./Ingreso";

// "Mis casos", en la landing: los casos abiertos del cliente, cada uno con su
// estado y un link a su seguimiento, que es donde se ve todo lo demás. Los
// terminados no vienen (lo decide la base).
//
// Sin entrar, en su lugar va el Ingreso. Si la llave venció, se vuelve al
// Ingreso diciendo por qué: si no, la persona vería aparecer el formulario
// de golpe sin entender qué hizo mal.
export default function SeccionMisCasos({ codigo, negocio, entrado, setEntrado }) {
  const [aviso, setAviso] = useState(null);

  // Estable, porque la lista lo usa en su efecto: si cambiara en cada dibujo,
  // la lista volvería a pedir los casos cada vez.
  const alVencer = useCallback(
    (mensaje) => {
      setAviso(mensaje);
      setEntrado(false);
    },
    [setEntrado]
  );

  if (!entrado) {
    return (
      <Ingreso
        codigo={codigo}
        negocio={negocio}
        boton="Ver mis casos"
        aviso={aviso}
        alEntrar={() => {
          setAviso(null);
          setEntrado(true);
        }}
      />
    );
  }

  return <Lista codigo={codigo} negocio={negocio} alVencer={alVencer} />;
}

// Aparte de la sección para que cada vez que se entra arranque de cero: si
// alguien sale y entra otra persona en el mismo celular, no ve ni por un
// momento la lista de la anterior.
function Lista({ codigo, negocio, alVencer }) {
  const [casos, setCasos] = useState(null);
  const [problema, setProblema] = useState(null);
  const [vuelta, setVuelta] = useState(0);
  const ident = comoSeIdentifica(negocio.rubro);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await misCasosEnLanding(codigo);
      if (!vivo) return;
      if (r.ok) setCasos(r.casos);
      else if (r.codigo === "llave_vencida") alVencer(r.mensaje);
      else setProblema(r.mensaje);
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
          <span>{problema}</span>
        </p>
        <Boton
          icono="deshacer"
          className="mt-4"
          onClick={() => {
            setProblema(null);
            setVuelta((v) => v + 1);
          }}
        >
          Probar de nuevo
        </Boton>
      </div>
    );
  }

  if (!casos) {
    return (
      <p role="status" className="mt-2 text-tinta-media">
        Buscando tus casos…
      </p>
    );
  }

  if (casos.length === 0) {
    return (
      <p className="mt-2 max-w-[65ch] text-tinta-media">
        No tenés casos abiertos en {negocio.nombre}. Los que ya terminaron no aparecen acá.
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
                {c.servicio || `Caso ${c.numero}`}
              </p>
              {c.identificador && (
                <p className="text-tinta-media">
                  {ident.nombre} {c.identificador}
                </p>
              )}
              <p className="text-apoyo text-tinta-suave">
                Caso {c.numero} · Entró {elDia(c.abierto_en)}
              </p>
            </div>
            <ChipEstado estado={c.estado} rubro={negocio.rubro} configuracion={negocio.estados} />
          </div>
          {c.seguimiento_codigo && (
            <Link
              href={`/seguimiento/${c.seguimiento_codigo}`}
              aria-describedby={`caso-${c.numero}`}
              className="mt-2 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              Ver cómo viene
              <Icono nombre="flecha" className="size-5" />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
