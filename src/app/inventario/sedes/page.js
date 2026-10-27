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
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { conElementos } from "@/lib/conElementos";
import { puede, quienPuede } from "@/lib/permisos";
import { mayuscula, vocabulario } from "@/lib/presets";
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
  const { idioma, t } = useIdioma();
  useTitulo(t("inventario.sedes.titulo"));

  useEffect(() => {
    let vivo = true;
    inventarioDeSedes(token).then((r) => {
      if (vivo) setRespuesta(r);
    });
    return () => {
      vivo = false;
    };
  }, [token, negocio?.id]);

  const { articulo } = vocabulario(negocio?.rubro, idioma);

  let cuerpo;
  if (!respuesta) {
    cuerpo = <Cargando />;
  } else if (!respuesta.ok) {
    cuerpo = <ErrorGeneral>{textoDeError(t, respuesta.error)}</ErrorGeneral>;
  } else if (respuesta.sedes.length < 2) {
    cuerpo = (
      <Vacio icono="tienda" titulo={t("inventario.sedes.vacioTitulo")}>
        {t("inventario.sedes.vacioTexto")}{" "}
        {puede(usuario, "vincular_sedes") ? (
          conElementos(t("inventario.sedes.vacioVincular"), {
            enlace: (
              <Link href="/negocio#sedes" className="font-bold text-azul">
                {t("inventario.sedes.miNegocio")}
              </Link>
            ),
          })
        ) : (
          quienPuede("vincular_sedes", t)
        )}
      </Vacio>
    );
  } else {
    const { sedes } = respuesta;
    // Los productos ya vienen agrupados por la API (qué es "el mismo
    // producto" lo decide ella, con la misma regla que el stock).
    const visibles = filtrarProductos(respuesta.productos, { texto, rubro: negocio?.rubro, idioma }).filter(
      (p) => !soloFaltantes || p.falta_en_alguna
    );
    const nombreDe = (s) => (s.id === negocio?.id ? t("inventario.sedes.esta", { nombre: s.nombre }) : s.nombre);

    cuerpo = (
      <>
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <Buscador
            id="sedes-buscar"
            etiqueta={t("inventario.buscar", { articulo: articulo.un() })}
            ayuda={t("inventario.buscarAyuda")}
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
            {t("inventario.sedes.soloFaltan")}
          </button>
        </div>

        {visibles.length === 0 ? (
          <Vacio icono="cajas" titulo={t("inventario.sedes.nadaTitulo")}>
            {t("inventario.sedes.nadaTexto")}
          </Vacio>
        ) : (
          <div className="@container">
            <table className="hidden w-full border-collapse overflow-hidden rounded-tarjeta border border-borde bg-tarjeta @3xl:table">
              <thead>
                <tr className="border-b border-borde text-left">
                  <th scope="col" className="p-4">{mayuscula(articulo.palabra())}</th>
                  {sedes.map((s) => (
                    <th key={s.id} scope="col" className="p-4">{nombreDe(s)}</th>
                  ))}
                  <th scope="col" className="p-4">{t("inventario.total")}</th>
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
                      {p.total} {presentacion(p, p.total, t)}
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
                      <dt>{t("inventario.total")}:</dt>
                      <dd className="tabular-nums">
                        {p.total} {presentacion(p, p.total, t)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-tinta-media">{t("inventario.sedes.paraCambiar")}</p>
      </>
    );
  }

  return (
    <>
      <Pestanas padre="inventario" />
      <h1 className="text-pantalla">{t("inventario.sedes.titulo")}</h1>
      <p className="mt-1 mb-6 max-w-[65ch] text-tinta-media">
        {t("inventario.sedes.apoyo")}
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
  const { t } = useIdioma();
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      {celda.cantidad === null ? (
        <span className="text-tinta-suave"><span aria-hidden="true">—</span><span className="sr-only">{t("inventario.sedes.noLoTiene")}</span></span>
      ) : (
        <span className="font-bold tabular-nums">{celda.cantidad}</span>
      )}
      {celda.bajo && (
        <span className="inline-flex items-center gap-1 font-bold text-espera">
          <Icono nombre="alerta" className="size-4" />
          {t("inventario.sedes.bajo")}
        </span>
      )}
      {celda.en_camino > 0 && (
        <span className="text-tinta-media">{t("inventario.sedes.enCamino", { n: celda.en_camino })}</span>
      )}
    </span>
  );
}
