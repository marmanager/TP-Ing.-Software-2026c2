"use client";

// "Recordatorios por WhatsApp" — los mensajes que le llegan solos al cliente.
//
// Son dos (R-4b): el de después de entregar, que ya existía y hasta ahora
// sólo se veía al cerrar un caso, y el de antes del turno. Cada uno con su
// interruptor, su plazo y su texto.
//
// Pantalla propia y no una sección más de "Mi negocio", igual que horarios y
// módulos: los dos juntos son seis campos, el máximo de la cartilla para una
// pantalla, y Mi negocio ya tiene su botón azul. Acá hay uno solo, que
// guarda los dos y manda sólo lo que cambió: apagar uno no toca el otro.
//
// El texto sugerido según el rubro lo arma la API (sugeridaTurno): llega en
// la configuración y se edita. Con la agenda apagada, el de turnos no se ve:
// no se configura algo que no se usa.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import { estaPrendido } from "@/lib/modulos";
import { vocabulario } from "@/lib/presets";
import {
  cambiosDeRecordatorios,
  cuandoSaleEnPalabras,
  erroresDelRecordatorio,
  recordatoriosDeLaApi,
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

export default function Recordatorios() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  useTitulo("Recordatorios por WhatsApp");

  const [guardado, setGuardado] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [error, setError] = useState(null);
  const [leyendo, setLeyendo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [intento, setIntento] = useState(0);
  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = negocio?.id;

  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    setLeyendo(true);
    setError(null);
    (async () => {
      const r = await acciones.current.consultarSeguimiento();
      if (!vivo) return;
      setLeyendo(false);
      if (!r.ok) return setError(r.error);
      const editable = recordatoriosDeLaApi(r.configuracion);
      setGuardado(editable);
      setBorrador(editable);
    })();
    return () => { vivo = false; };
  }, [negocioId, intento]);

  if (cargando || (leyendo && !error)) return <Cargando />;

  const puedeConfigurar = puede(usuario, "entregar_y_reabrir");
  const conAgenda = estaPrendido("agenda", negocio?.modulos_activos ?? []);
  const { cita } = vocabulario(negocio?.rubro);
  const antesDe = `Antes ${cita.segun("del", "de la")} ${cita.palabra()}`;

  const volver = (
    <Link href="/negocio" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
      <Icono nombre="volver" />
      Volver a Mi negocio
    </Link>
  );

  if (!borrador) {
    return (
      <>
        {volver}
        <TituloPantalla>Recordatorios por WhatsApp</TituloPantalla>
        <ErrorGeneral>{error}</ErrorGeneral>
        <Boton className="mt-4" onClick={() => setIntento((n) => n + 1)}>Volver a cargar</Boton>
      </>
    );
  }

  // Los errores sólo cuentan para lo prendido: lo apagado no se manda.
  const erroresDe = (tipo) => (borrador[tipo].activo ? erroresDelRecordatorio({ tipo, ...borrador[tipo] }) : {});
  const errores = { cierre: erroresDe("cierre"), turno: conAgenda ? erroresDe("turno") : {} };
  const cambios = cambiosDeRecordatorios(guardado, conAgenda ? borrador : { ...borrador, turno: guardado.turno });
  const hayCambios = Object.keys(cambios).length > 0;

  const motivo = guardando
    ? "se está guardando"
    : errores.cierre.mensaje || errores.turno.mensaje
      ? "falta el texto del mensaje"
      : errores.cierre.plazo || errores.turno.plazo
        ? "revisá el plazo"
        : !hayCambios
          ? "no cambiaste nada"
          : null;

  const cambiar = (tipo, que) => setBorrador((b) => ({ ...b, [tipo]: { ...b[tipo], ...que } }));

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await datos.configurarSeguimiento(cambios);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    const editable = recordatoriosDeLaApi(r.configuracion);
    setGuardado(editable);
    setBorrador(editable);
    const prendidos = [
      editable.cierre.activo && "el de después de entregar",
      conAgenda && editable.turno.activo && `el de antes ${cita.segun("del", "de la")} ${cita.palabra()}`,
    ].filter(Boolean);
    datos.avisarExito(
      prendidos.length
        ? `Listo. Quedaron prendidos ${prendidos.join(" y ")}.`
        : "Listo. Los recordatorios quedaron apagados."
    );
  }

  return (
    <>
      {volver}
      <TituloPantalla apoyo="Mensajes que le llegan solos al cliente por WhatsApp. Prendé los que quieras usar.">
        Recordatorios por WhatsApp
      </TituloPantalla>

      {!puedeConfigurar && (
        <p className="mb-6 max-w-[65ch] text-tinta-media">{QUIEN_PUEDE.entregar_y_reabrir}</p>
      )}

      <fieldset disabled={!puedeConfigurar || guardando}>
        <Recordatorio
          id="cierre"
          titulo="Después de entregar"
          interruptor="Mensaje después de entregar"
          ayudaInterruptor="Al entregar cada caso elegís si se lo mandás."
          valor={borrador.cierre}
          errores={errores.cierre}
          frase={cuandoSaleEnPalabras({ tipo: "cierre", plazo: borrador.cierre.plazo, rubro: negocio?.rubro })}
          etiquetaPlazo="¿Cuántos días después de entregar?"
          ayudaPlazo="Poné 0 para mandarlo apenas entregás."
          max={3650}
          min={0}
          alCambiar={(que) => cambiar("cierre", que)}
        />

        {conAgenda && (
          <Recordatorio
            id="turno"
            titulo={antesDe}
            interruptor={`Recordatorio ${cita.segun("del", "de la")} ${cita.palabra()}`}
            ayudaInterruptor={`Le llega a cada cliente con teléfono que tenga ${cita.un()} anotad${cita.segun("o", "a")}.`}
            valor={borrador.turno}
            errores={errores.turno}
            frase={cuandoSaleEnPalabras({ tipo: "turno", plazo: borrador.turno.plazo, rubro: negocio?.rubro })}
            etiquetaPlazo="¿Cuántas horas antes?"
            ayudaPlazo="24 es el día anterior, a la misma hora. Hasta 168, una semana."
            max={168}
            min={1}
            alCambiar={(que) => cambiar("turno", que)}
          />
        )}
      </fieldset>

      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      {puedeConfigurar && (
        <BotonPrincipalFijo icono="check" motivo={motivo} onClick={guardar}>
          Guardar los recordatorios
        </BotonPrincipalFijo>
      )}
    </>
  );
}

function Recordatorio({
  id, titulo, interruptor, ayudaInterruptor, valor, errores, frase,
  etiquetaPlazo, ayudaPlazo, min, max, alCambiar,
}) {
  const plazoValido = !errores.plazo && String(valor.plazo).trim() !== "";
  return (
    <Tarjeta className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-seccion">
        <Icono nombre="whatsapp" className="size-6 text-completo" />
        {titulo}
      </h2>
      <Interruptor
        prendido={valor.activo}
        onChange={(activo) => alCambiar({ activo })}
        ayuda={ayudaInterruptor}
      >
        {interruptor}
      </Interruptor>

      {valor.activo && (
        <div className="mt-6">
          {plazoValido && (
            <p id={`${id}-frase`} className="mb-6 max-w-[65ch] font-bold text-tinta">
              {frase}
            </p>
          )}
          <Campo
            id={`${id}-plazo`}
            etiqueta={etiquetaPlazo}
            ayuda={ayudaPlazo}
            type="number" min={min} max={max} step="1" inputMode="numeric"
            value={valor.plazo}
            error={errores.plazo}
            onChange={(e) => alCambiar({ plazo: e.target.value })}
          />
          <Campo
            id={`${id}-mensaje`}
            etiqueta="Lo que le llega al cliente"
            ayuda="Viene con una sugerencia según tu rubro. Cambiala como quieras."
            error={errores.mensaje}
          >
            <textarea
              id={`${id}-mensaje`}
              rows={4}
              maxLength={3000}
              value={valor.mensaje}
              onChange={(e) => alCambiar({ mensaje: e.target.value })}
              aria-invalid={errores.mensaje ? "true" : undefined}
              aria-describedby={[`${id}-mensaje-ayuda`, errores.mensaje && `${id}-mensaje-error`].filter(Boolean).join(" ")}
              className={`mt-2 block w-full resize-y rounded-campo border-2 bg-tarjeta p-4 text-cuerpo ${errores.mensaje ? "border-rojo" : "border-borde-fuerte"}`}
            />
          </Campo>
        </div>
      )}
    </Tarjeta>
  );
}
