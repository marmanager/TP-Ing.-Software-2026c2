"use client";

// Copia de seguridad (docs/copia-de-seguridad.md). Guardar cómo está el negocio
// y volver a ese punto. Sólo la ve quien tiene copia_de_seguridad (de fábrica,
// el dueño); la base y la API lo vuelven a comprobar.
//
// Arriba, la copia automática (prendida o no, y a qué hora) y el botón de
// hacer una ahora. Abajo, las últimas copias, cada una con su Restablecer, que
// pide confirmar ahí mismo diciendo qué se pierde y qué no cambia.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, quienPuede } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { cuando } from "@/lib/fechas";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Interruptor, Tarjeta, TituloPantalla, TituloSeccion, Vacio, claseDeEntrada } from "@/componentes/ui";

const HORAS = Array.from({ length: 24 }, (_, h) => h);

export default function CopiaDeSeguridad() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  const { locale, t } = useIdioma();
  useTitulo(t("negocio.copias.titulo"));

  const [estado, setEstado] = useState(null);
  const [automatica, setAutomatica] = useState(false);
  const [hora, setHora] = useState(4);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [intento, setIntento] = useState(0);
  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = negocio?.id;
  const permitido = puede(usuario, "copia_de_seguridad");

  const recibir = (r) => {
    setEstado(r);
    setAutomatica(r.automatica);
    setHora(r.hora);
  };

  useEffect(() => {
    if (!negocioId || !permitido) return;
    let vivo = true;
    setError(null);
    (async () => {
      const r = await acciones.current.cargarCopias();
      if (!vivo) return;
      if (!r.ok) return setError(r.error);
      recibir(r.copias);
    })();
    return () => { vivo = false; };
  }, [negocioId, permitido, intento]);

  const volver = (
    <Link href="/negocio" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
      <Icono nombre="volver" />
      {t("negocio.copias.volver")}
    </Link>
  );

  if (cargando) return <Cargando />;

  if (!permitido) {
    return (
      <>
        {volver}
        <TituloPantalla>{t("negocio.copias.titulo")}</TituloPantalla>
        <Vacio icono="candado" titulo={t("negocio.copias.titulo")}>{quienPuede("copia_de_seguridad", t)}</Vacio>
      </>
    );
  }

  if (!estado) {
    return (
      <>
        {volver}
        <TituloPantalla>{t("negocio.copias.titulo")}</TituloPantalla>
        {error ? (
          <>
            <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>
            <Boton className="mt-4" onClick={() => setIntento((n) => n + 1)}>{t("negocio.copias.recargar")}</Boton>
          </>
        ) : (
          <Cargando />
        )}
      </>
    );
  }

  // Una acción a la vez; el resultado va a la pantalla o al error.
  async function hacer(cual, accion, textoAviso) {
    if (ocupado) return;
    setOcupado(cual);
    setError(null);
    setAviso(null);
    const r = await accion();
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    if (r.copias) recibir(r.copias);
    setAviso(textoAviso);
    return r;
  }

  const guardar = () =>
    hacer("guardar", () => acciones.current.configurarCopias({ automatica, hora }), t("negocio.copias.guardado"));

  const hacerAhora = () => hacer("hacer", () => acciones.current.hacerCopia(), t("negocio.copias.hecha"));

  async function restablecer(copia) {
    const r = await hacer("restablecer", () => acciones.current.restablecerCopia(copia.id), t("negocio.copias.restablecida"));
    if (r?.ok) setTimeout(() => window.location.reload(), 1500);
    else setConfirmando(null);
  }

  const sinCambios = automatica === estado.automatica && hora === estado.hora;

  return (
    <>
      {volver}
      <TituloPantalla apoyo={t("negocio.copias.apoyo")}>{t("negocio.copias.titulo")}</TituloPantalla>

      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}
      {aviso && <p role="status" className="mb-4 font-bold text-completo">{aviso}</p>}

      <Tarjeta className="mb-8">
        <Interruptor prendido={automatica} onChange={setAutomatica} ayuda={t("negocio.copias.automaticaAyuda")}>
          {t("negocio.copias.automatica")}
        </Interruptor>

        <div className="mt-4">
          <label htmlFor="hora-de-la-copia" className="block font-bold">{t("negocio.copias.hora")}</label>
          <p className="mb-2 text-tinta-media">{t("negocio.copias.horaAyuda")}</p>
          {/* Un <select>: son 24 horas, no entran todas a la vista como opciones sueltas. */}
          <select
            id="hora-de-la-copia"
            value={hora}
            onChange={(e) => setHora(Number(e.target.value))}
            className={`${claseDeEntrada({})} max-w-40`}
          >
            {HORAS.map((h) => (
              <option key={h} value={h}>{t("negocio.copias.horaValor", { hora: String(h).padStart(2, "0") })}</option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Boton variante="principal" icono="check" onClick={guardar} disabled={Boolean(ocupado) || sinCambios}>
            {t("negocio.copias.guardar")}
          </Boton>
          <Boton icono="historial" onClick={hacerAhora} disabled={Boolean(ocupado)}>
            {ocupado === "hacer" ? t("negocio.copias.haciendo") : t("negocio.copias.hacerAhora")}
          </Boton>
        </div>
      </Tarjeta>

      <TituloSeccion>{t("negocio.copias.lasCopias")}</TituloSeccion>
      {estado.copias.length === 0 ? (
        <Vacio icono="historial" titulo={t("negocio.copias.ninguna")}>{t("negocio.copias.ningunaTexto")}</Vacio>
      ) : (
        <ul className="grid gap-4">
          {estado.copias.map((c) => (
            <li key={c.id}>
              <FilaDeCopia
                copia={c}
                confirmando={confirmando === c.id}
                ocupado={ocupado}
                alPedir={() => setConfirmando(c.id)}
                alCancelar={() => setConfirmando(null)}
                alConfirmar={() => restablecer(c)}
                fecha={cuando(c.creada_en, locale, t)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FilaDeCopia({ copia, fecha, confirmando, ocupado, alPedir, alCancelar, alConfirmar }) {
  const { t } = useIdioma();
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="block font-bold">{fecha}</span>
          <span className="block text-tinta-media">{t(`negocio.copias.origen.${copia.origen}`)}</span>
        </span>
        {copia.restablecible && !confirmando && (
          <Boton icono="deshacer" onClick={alPedir} disabled={Boolean(ocupado)}>
            {t("negocio.copias.restablecer")}
          </Boton>
        )}
      </div>

      {!copia.restablecible && <p className="mt-3 text-tinta-media">{t("negocio.copias.noSePuede")}</p>}

      {confirmando && (
        <div role="alertdialog" aria-labelledby={`confirmar-${copia.id}`} className="mt-4 border-t-2 border-borde pt-4">
          <h2 id={`confirmar-${copia.id}`} className="mb-2 text-subtitulo font-bold">
            {t("negocio.copias.confirmarTitulo", { fecha })}
          </h2>
          <ul className="mb-4 grid max-w-[65ch] gap-2 text-tinta-media">
            <li>{t("negocio.copias.confirmarPierde")}</li>
            <li>{t("negocio.copias.confirmarQueda")}</li>
            <li>{t("negocio.copias.confirmarDeshacer")}</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Boton variante="peligro" icono="deshacer" onClick={alConfirmar} disabled={Boolean(ocupado)}>
              {ocupado === "restablecer" ? t("negocio.copias.restableciendo") : t("negocio.copias.confirmarSi")}
            </Boton>
            <Boton variante="neutro" onClick={alCancelar} disabled={Boolean(ocupado)}>
              {t("negocio.copias.confirmarNo")}
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}
