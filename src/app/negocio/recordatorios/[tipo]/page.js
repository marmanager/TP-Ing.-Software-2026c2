"use client";

// Un recordatorio por WhatsApp, para editarlo: su interruptor, su plazo y su
// texto. Tres campos, con su botón, que guarda sólo este: los otros no se
// escriben (cambiosDelRecordatorio).
//
// Es la misma pantalla para todos los tipos. Lo que cambia de uno a otro —el
// nombre, la unidad del plazo, su rango, la frase de cuándo sale— está en
// lib/recordatorios.js: sumar un recordatorio no toca esta pantalla.
//
// El texto sugerido según el rubro lo arma la API: llega en la
// configuración y se edita.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, quienPuede } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { estaPrendido } from "@/lib/modulos";
import {
  cambiosDelRecordatorio,
  cuandoSaleEnPalabras,
  erroresDelRecordatorio,
  esTipoDeRecordatorio,
  ofreceCanal,
  recordatoriosDeLaApi,
  textosDelRecordatorio,
} from "@/lib/recordatorios";
import Icono from "@/componentes/Icono";
import {
  Boton,
  BotonPrincipalFijo,
  Campo,
  Cargando,
  ErrorGeneral,
  Interruptor,
  Tarjeta,
  TituloPantalla,
} from "@/componentes/ui";

export default function Recordatorio() {
  const { tipo } = useParams();
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  const { idioma, locale, t } = useIdioma();
  const lang = { t, locale, idioma };

  const [guardado, setGuardado] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [error, setError] = useState(null);
  const [leyendo, setLeyendo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [intento, setIntento] = useState(0);
  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = negocio?.id;

  const valido = esTipoDeRecordatorio(tipo);
  const textos = textosDelRecordatorio(tipo, negocio?.rubro, lang);
  useTitulo(valido ? textos.nombre : t("negocio.recordatorios.titulo"));

  useEffect(() => {
    if (!negocioId || !valido) return;
    let vivo = true;
    setLeyendo(true);
    setError(null);
    (async () => {
      const r = await acciones.current.consultarSeguimiento();
      if (!vivo) return;
      setLeyendo(false);
      if (!r.ok) return setError(r.error);
      const editable = recordatoriosDeLaApi(r.configuracion)[tipo] ?? null;
      setGuardado(editable);
      setBorrador(editable);
    })();
    return () => { vivo = false; };
  }, [negocioId, tipo, valido, intento]);

  const volver = (
    <Link href="/negocio/recordatorios" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
      <Icono nombre="volver" />
      {t("negocio.recordatorios.volver")}
    </Link>
  );

  const conAgenda = estaPrendido("agenda", negocio?.modulos_activos ?? []);
  // Un tipo que no existe, que la API no tiene, o el de turnos sin agenda:
  // no hay nada que configurar acá.
  const noEsta = !valido || (!cargando && !leyendo && !error && !guardado) || (tipo === "turno" && !cargando && !conAgenda);

  if (noEsta) {
    return (
      <>
        {volver}
        <TituloPantalla>{t("negocio.recordatorios.titulo")}</TituloPantalla>
        <p className="max-w-[65ch] text-tinta-media">
          {t("negocio.recordatorios.noDisponible")}
        </p>
      </>
    );
  }

  if (cargando || (leyendo && !error)) return <Cargando />;

  if (!borrador) {
    return (
      <>
        {volver}
        <TituloPantalla>{textos.nombre}</TituloPantalla>
        <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>
        <Boton className="mt-4" onClick={() => setIntento((n) => n + 1)}>{t("negocio.recordatorios.recargar")}</Boton>
      </>
    );
  }

  const puedeConfigurar = puede(usuario, "entregar_y_reabrir");
  // Los errores sólo cuentan si está prendido: lo apagado no se manda.
  const errores = borrador.activo ? erroresDelRecordatorio({ tipo, ...borrador }, lang) : {};
  const cambios = cambiosDelRecordatorio(tipo, guardado, borrador);

  const motivo = guardando
    ? t("negocio.recordatorios.guardando")
    : errores.mensaje
      ? t("negocio.recordatorios.faltaMensaje")
      : errores.plazo
        ? t("negocio.recordatorios.revisaPlazo")
        : !Object.keys(cambios).length
          ? t("negocio.recordatorios.nadaCambio")
          : null;

  const cambiar = (que) => setBorrador((b) => ({ ...b, ...que }));
  const plazoValido = !erroresDelRecordatorio({ tipo, ...borrador }, lang).plazo;

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await datos.configurarSeguimiento(cambios);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    const editable = recordatoriosDeLaApi(r.configuracion)[tipo] ?? borrador;
    setGuardado(editable);
    setBorrador(editable);
    datos.avisarExito(
      editable.activo
        ? t("negocio.recordatorios.listoPrendido", {
            nombre: textos.nombre,
            cuando: cuandoSaleEnPalabras({ tipo, plazo: editable.plazo, rubro: negocio?.rubro }, lang),
          })
        : t("negocio.recordatorios.listoApagado", { nombre: textos.nombre })
    );
  }

  return (
    <>
      {volver}
      <TituloPantalla apoyo={t("negocio.recordatorios.apoyoTipo")}>
        {textos.nombre}
      </TituloPantalla>

      {!puedeConfigurar && (
        <p className="mb-6 max-w-[65ch] text-tinta-media">{quienPuede("entregar_y_reabrir", t)}</p>
      )}

      <fieldset disabled={!puedeConfigurar || guardando}>
        <Tarjeta className="mb-8">
          <Interruptor
            prendido={borrador.activo}
            onChange={(activo) => cambiar({ activo })}
            testid={`recordatorio-${tipo}-interruptor`}
            ayuda={textos.ayudaInterruptor}
          >
            {textos.interruptor}
          </Interruptor>

          {borrador.activo && (
            <div className="mt-6">
              {plazoValido && (
                <p id={`${tipo}-frase`} className="mb-6 max-w-[65ch] font-bold text-tinta">
                  {cuandoSaleEnPalabras({ tipo, plazo: borrador.plazo, rubro: negocio?.rubro }, lang)}
                </p>
              )}
              <Campo
                id={`${tipo}-plazo`}
                etiqueta={textos.etiquetaPlazo}
                ayuda={textos.ayudaPlazo}
                type="number" min={textos.min} max={textos.max} step="1" inputMode="numeric"
                value={borrador.plazo}
                error={errores.plazo}
                onChange={(e) => cambiar({ plazo: e.target.value })}
              />
              {ofreceCanal(tipo) && (
                <Campo
                  id={`${tipo}-canal`}
                  etiqueta={t("negocio.recordatorios.canal")}
                  ayuda={t("negocio.recordatorios.canalAyuda")}
                >
                  <select
                    id={`${tipo}-canal`}
                    aria-describedby={`${tipo}-canal-ayuda`}
                    value={borrador.canal}
                    onChange={(e) => cambiar({ canal: e.target.value })}
                    data-testid={`recordatorio-${tipo}-canal`}
                    className="mt-2 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
                  >
                    <option value="whatsapp">{t("negocio.recordatorios.canalWhatsapp")}</option>
                    <option value="email">{t("negocio.recordatorios.canalEmail")}</option>
                  </select>
                </Campo>
              )}
              <Campo
                id={`${tipo}-mensaje`}
                etiqueta={t("negocio.recordatorios.mensaje")}
                ayuda={t("negocio.recordatorios.mensajeAyuda")}
                error={errores.mensaje}
              >
                <textarea
                  id={`${tipo}-mensaje`}
                  rows={4}
                  maxLength={3000}
                  value={borrador.mensaje}
                  onChange={(e) => cambiar({ mensaje: e.target.value })}
                  aria-invalid={errores.mensaje ? "true" : undefined}
                  aria-describedby={[`${tipo}-mensaje-ayuda`, errores.mensaje && `${tipo}-mensaje-error`].filter(Boolean).join(" ")}
                  className={`mt-2 block w-full resize-y rounded-campo border-2 bg-tarjeta p-4 text-cuerpo ${errores.mensaje ? "border-rojo" : "border-borde-fuerte"}`}
                />
              </Campo>
            </div>
          )}
        </Tarjeta>
      </fieldset>

      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

      {puedeConfigurar && (
        <BotonPrincipalFijo icono="check" motivo={motivo} onClick={guardar} data-testid="recordatorio-guardar">
          {t("negocio.recordatorios.guardar")}
        </BotonPrincipalFijo>
      )}
    </>
  );
}
