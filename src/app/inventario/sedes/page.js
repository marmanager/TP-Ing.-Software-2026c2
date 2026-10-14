"use client";

// "Todas las sedes": el inventario de las sedes vinculadas, junto
// (docs/red-de-sedes.md). Sólo se mira: para cambiar algo se entra a esa sede.
//
// Ancho, una tabla con una columna por sede; angosto, una tarjeta por
// producto, porque una tabla con varias sedes no entra en un celular.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import { vocabulario } from "@/lib/presets";
import { filtrarProductos, presentacion } from "@/lib/inventario";
import { inventarioDeSedes } from "@/lib/sedes";
import Buscador from "@/componentes/Buscador";
import Icono from "@/componentes/Icono";
import Pestanas from "@/componentes/Pestanas";
import { PILDORA, PILDORA_NO, PILDORA_SI } from "@/componentes/Producto";
import { Cargando, ErrorGeneral, Vacio } from "@/componentes/ui";

export default function TodasLasSedes() {
  const { usuario, sesion } = useAuth();
  const { negocio } = useDatos();
  const token = sesion?.access_token;
  const [respuesta, setRespuesta] = useState(null);
  const [texto, setTexto] = useState("");
  const [soloFaltantes, setSoloFaltantes] = useState(false);
  useTitulo("Todas las sedes");

  useEffect(() => {
    let vivo = true;
    inventarioDeSedes(token).then((r) => {
      if (vivo) setRespuesta(r);
    });
    return () => {
      vivo = false;
    };
  }, [token, negocio?.id]);

  const { articulo } = vocabulario(negocio?.rubro);

  let cuerpo;
  if (!respuesta) {
    cuerpo = <Cargando />;
  } else if (!respuesta.ok) {
    cuerpo = <ErrorGeneral>{respuesta.error}</ErrorGeneral>;
  } else if (respuesta.sedes.length < 2) {
    cuerpo = (
      <Vacio icono="tienda" titulo="Todavía no hay otras sedes para mostrar">
        Acá aparecen las sedes vinculadas con ésta donde tenés acceso.{" "}
        {puede(usuario?.rol, "vincularSedes") ? (
          <>
            Se vinculan desde{" "}
            <Link href="/negocio#sedes" className="font-bold text-azul">
              Mi negocio
            </Link>
            .
          </>
        ) : (
          QUIEN_PUEDE.vincularSedes
        )}
      </Vacio>
    );
  } else {
    const { sedes } = respuesta;
    // Los productos ya vienen agrupados por la API (qué es "el mismo
    // producto" lo decide ella, con la misma regla que el stock).
    const visibles = filtrarProductos(respuesta.productos, { texto }).filter(
      (p) => !soloFaltantes || p.falta_en_alguna
    );
    const nombreDe = (s) => (s.id === negocio?.id ? `${s.nombre} (ésta)` : s.nombre);

    cuerpo = (
      <>
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <Buscador
            id="sedes-buscar"
            etiqueta={`Buscar ${articulo.un()}`}
            ayuda="Por nombre, marca, modelo o categoría."
            valor={texto}
            alCambiar={setTexto}
          />
          <button
            type="button"
            aria-pressed={soloFaltantes}
            onClick={() => setSoloFaltantes((v) => !v)}
            className={`${PILDORA} ${soloFaltantes ? PILDORA_SI : PILDORA_NO}`}
          >
            <Icono nombre="alerta" className="size-5" />
            Sólo lo que falta en alguna sede
          </button>
        </div>

        {visibles.length === 0 ? (
          <Vacio icono="cajas" titulo="No hay nada que coincida">
            Probá con otra búsqueda o sacá el filtro.
          </Vacio>
        ) : (
          <div className="@container">
            <table className="hidden w-full border-collapse overflow-hidden rounded-tarjeta border border-borde bg-tarjeta @3xl:table">
              <thead>
                <tr className="border-b border-borde text-left">
                  <th scope="col" className="p-4">{articulo.segun("Producto", "Insumo")}</th>
                  {sedes.map((s) => (
                    <th key={s.id} scope="col" className="p-4">{nombreDe(s)}</th>
                  ))}
                  <th scope="col" className="p-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p, i) => (
                  <tr key={i} className="border-b border-borde last:border-b-0">
                    <th scope="row" className="p-4 text-left font-bold">
                      {p.nombre}
                      <Detalle p={p} />
                    </th>
                    {sedes.map((s) => (
                      <td key={s.id} className="p-4">
                        <Celda celda={p.por_sede[s.id]} />
                      </td>
                    ))}
                    <td className="p-4 font-bold tabular-nums">
                      {p.total} {presentacion(p, p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="grid gap-3 @3xl:hidden">
              {visibles.map((p, i) => (
                <li key={i} className="rounded-tarjeta border border-borde bg-tarjeta p-4">
                  <p className="font-bold">{p.nombre}</p>
                  <Detalle p={p} />
                  <dl className="mt-3 grid gap-1">
                    {sedes.map((s) => (
                      <div key={s.id} className="flex flex-wrap gap-x-2">
                        <dt className="text-tinta-media">{nombreDe(s)}:</dt>
                        <dd>
                          <Celda celda={p.por_sede[s.id]} />
                        </dd>
                      </div>
                    ))}
                    <div className="flex gap-x-2 font-bold">
                      <dt>Total:</dt>
                      <dd className="tabular-nums">
                        {p.total} {presentacion(p, p.total)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-tinta-media">Para cambiar algo, entrá a esa sede.</p>
      </>
    );
  }

  return (
    <>
      <Pestanas padre="inventario" />
      <h1 className="text-pantalla">Todas las sedes</h1>
      <p className="mt-1 mb-6 max-w-[65ch] text-tinta-media">
        Lo que hay en cada sede vinculada, sin cambiar de negocio.
      </p>
      {cuerpo}
    </>
  );
}

function Detalle({ p }) {
  const detalle = [p.marca, p.modelo].filter(Boolean).join(" · ");
  return detalle ? <span className="block text-apoyo font-normal text-tinta-suave">{detalle}</span> : null;
}

// "—" cuando esa sede no lo tiene: no es que se acabó, es que nunca lo cargó.
// "bajo" va con color, ícono y palabra (cartilla).
function Celda({ celda }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      {celda.cantidad === null ? (
        <span className="text-tinta-suave"><span aria-hidden="true">—</span><span className="sr-only">no lo tiene</span></span>
      ) : (
        <span className="font-bold tabular-nums">{celda.cantidad}</span>
      )}
      {celda.bajo && (
        <span className="inline-flex items-center gap-1 font-bold text-espera">
          <Icono nombre="alerta" className="size-4" />
          bajo
        </span>
      )}
      {celda.en_camino > 0 && <span className="text-tinta-media">+{celda.en_camino} en camino</span>}
    </span>
  );
}
