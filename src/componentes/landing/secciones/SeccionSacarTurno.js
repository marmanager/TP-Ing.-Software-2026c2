"use client";

import { useEffect, useRef, useState } from "react";
import { agendaDeLanding, reservarEnLanding } from "@/lib/datos";
import { diaLargo } from "@/lib/fechas";
import { normalizarHorarios } from "@/lib/horarios";
import { leerLlave } from "@/lib/llave-landing";
import { comoSeIdentifica, preset } from "@/lib/presets";
import CalendarioDeTurnos, { comoHora } from "@/componentes/CalendarioDeTurnos";
import Icono from "@/componentes/Icono";
import { Boton, Campo, ErrorGeneral } from "@/componentes/ui";

// "Sacar turno", en la landing: lo mismo que la pantalla pública de pedir
// turno (/turnos/[codigo]), que es el modelo. Primero el día y la hora,
// después los datos: mostrar si hay lugar antes de pedirle nada a nadie.
//
// Lo distinto es quién pide. Si entró, el turno va a su nombre y sólo se le
// pregunta para qué viene. Si no, es el registro: nombre, teléfono y el
// identificador del rubro, y al salir el turno queda adentro (la llave del
// registro la guarda reservarEnLanding), así que "Mis turnos" lo muestra sin
// que tenga que entrar aparte.
//
// "vencida" es que la llave venció (al pedir acá o en otra sección) y todavía
// no volvió a entrar. Ya entró alguna vez, así que es cliente: en lugar del
// registro, que lo dejaría dos veces, se lo manda al Ingreso, y lo que eligió
// queda acá para cuando vuelva.
//
// El calendario no acepta una lista vacía de días: antes de dibujarlo, cada
// vez (también después de volver a pedir la agenda), se mira si queda algo.

// Los "no" que son del horario: se lo ganaron, ya no se ofrece o el negocio
// sacó sus horarios. Ahí lo que está viendo quedó viejo y se vuelve a pedir.
// Los demás (un dato que falta, muchos intentos) se arreglan en el formulario
// sin perder el horario elegido.
const DEL_HORARIO = ["turno_ocupado", "horario_no_disponible", "agenda_sin_horarios"];

export default function SeccionSacarTurno({ codigo, negocio, entrado, vencida, alEntrar, alVencer, alReservar }) {
  const ident = comoSeIdentifica(negocio.rubro);
  const motivos = preset(negocio.rubro).motivos;
  const [agenda, setAgenda] = useState(null);
  const [vuelta, setVuelta] = useState(0);
  const [elegido, setElegido] = useState(null);
  const datosRef = useRef(null);
  const [motivo, setMotivo] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [problema, setProblema] = useState(null);
  const [listo, setListo] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await agendaDeLanding(codigo);
      if (vivo) setAgenda(r);
    })();
    return () => {
      vivo = false;
    };
  }, [codigo, vuelta]);

  // Los datos aparecen debajo del calendario: en el celular quedan fuera de
  // la pantalla si no se baja hasta ellos.
  const hayElegido = Boolean(elegido);
  useEffect(() => {
    if (hayElegido) datosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hayElegido]);

  async function pedir() {
    setProblema(null);
    setGuardando(true);
    const r = await reservarEnLanding(codigo, {
      cuando: elegido,
      motivo: motivo.trim(),
      ...(entrado ? {} : { nombre, telefono, identificador }),
    });
    setGuardando(false);

    if (!r.ok) {
      if (r.codigo === "llave_vencida") return alVencer(r.mensaje);
      setProblema(r.mensaje);
      if (DEL_HORARIO.includes(r.codigo)) {
        setElegido(null);
        setVuelta((v) => v + 1);
      }
      return;
    }

    // Se mira la llave y no sólo que haya salido: un navegador que no deja
    // guardarla lo dejaría "adentro" sin poder ver nada.
    const adentro = !entrado && Boolean(leerLlave(codigo));
    setListo({ cuando: new Date(r.cuando), motivo: motivo.trim(), adentro });
    if (adentro) alEntrar();
    alReservar();
    // El horario que tomó ya no está libre.
    setVuelta((v) => v + 1);
  }

  if (listo) {
    return (
      <div className="mt-2">
        {/* Con borde verde y no fondo verde: el texto de las cajas lo elige
            el negocio y sobre un fondo que no es el suyo puede no leerse. */}
        <div role="status" className="rounded-tarjeta border-2 border-completo bg-tarjeta p-5">
          <p className="flex items-center gap-2 font-titulo font-extrabold text-subtitulo">
            <Icono nombre="listo" className="size-7 shrink-0 text-completo" />
            Listo, quedaste anotado
          </p>
          <p className="mt-3 font-titulo font-extrabold text-ident first-letter:uppercase">
            {diaLargo(listo.cuando)} a las {comoHora(listo.cuando)}
          </p>
          <p className="mt-1 text-tinta-media">{listo.motivo}</p>
          <p className="mt-3 max-w-[65ch] text-tinta-media">
            {negocio.nombre} ya lo ve en su agenda. Si no podés venir, avisale así le dan el lugar a otro.
          </p>
          {listo.adentro && (
            <p className="mt-3 max-w-[65ch] text-tinta-media">
              Ya quedaste adentro: tus turnos están en «Mis turnos». Otro día volvés a entrar con{" "}
              {ident.enFrase} y los últimos 4 números de tu teléfono.
            </p>
          )}
        </div>
        <Boton
          icono="calendario"
          className="mt-4"
          onClick={() => {
            setListo(null);
            setElegido(null);
            setMotivo("");
          }}
        >
          Sacar otro turno
        </Boton>
      </div>
    );
  }

  if (!agenda) {
    return (
      <p role="status" className="mt-2 text-tinta-media">
        Buscando los horarios libres…
      </p>
    );
  }

  // Si la API no contestó, el link puede andar en un rato: se ofrece probar
  // de nuevo. Si dice que la landing ya no está, no hay nada que reintentar.
  if (!agenda.sirve) {
    return (
      <div className="mt-2">
        <p role="alert" className="flex items-start gap-2 font-bold text-rojo">
          <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
          <span>
            {agenda.problema ??
              `Por ahora no se puede sacar turno por acá. Escribile o llamá a ${negocio.nombre}.`}
          </span>
        </p>
        {agenda.problema && (
          <Boton
            icono="deshacer"
            className="mt-4"
            onClick={() => {
              setAgenda(null);
              setVuelta((v) => v + 1);
            }}
          >
            Probar de nuevo
          </Boton>
        )}
      </div>
    );
  }

  const minutos = normalizarHorarios(agenda.horarios)?.minutos;
  const falta = !motivo.trim()
    ? "contanos para qué venís"
    : entrado
      ? null
      : vencida
        ? "primero entrá de nuevo con tus datos"
        : !nombre.trim()
          ? "falta tu nombre"
          : telefono.replace(/\D/g, "").length < 4
            ? "falta tu teléfono"
            : !identificador.trim()
              ? `falta ${ident.enFrase}`
              : null;

  return (
    <>
      <p className="mt-2 max-w-[65ch] text-tinta-media">
        Elegí el día y la hora que te queden bien y te anotás acá mismo, sin llamar.
      </p>

      {/* Sin horario elegido, el problema va arriba: el formulario ya no
          está (se lo ganaron y hay que elegir otro). */}
      {problema && !elegido && (
        <div className="mt-4">
          <ErrorGeneral>{problema}</ErrorGeneral>
        </div>
      )}

      {agenda.dias.length === 0 ? (
        <p className="mt-4 flex items-start gap-2 text-tinta-media">
          <Icono nombre="reloj" className="mt-0.5 size-5 shrink-0" />
          <span>
            <span className="font-bold text-tinta">No queda ningún horario libre.</span> Por ahora{" "}
            {negocio.nombre} no tiene lugar en los días que abrió para sacar turno. Probá más adelante o
            escribile directamente.
          </span>
        </p>
      ) : (
        <>
          {/* Nivel 3: cuelga del título de la sección, que es un h2. */}
          <CalendarioDeTurnos
            nivel={3}
            dias={agenda.dias}
            elegido={elegido}
            onElegir={(cuando) => {
              if (cuando) setProblema(null);
              setElegido(cuando);
            }}
          />

          {elegido && (
            <>
              <h3 ref={datosRef} className="mt-8 mb-1 scroll-mt-4 text-seccion">
                Tus datos
              </h3>
              <p className="mb-4 max-w-[65ch] text-tinta-media">
                Pediste el turno para{" "}
                <span className="font-bold text-tinta">
                  {diaLargo(elegido).toLowerCase()} a las {comoHora(new Date(elegido))}
                </span>
                .{minutos ? ` Son ${minutos} minutos.` : ""}
              </p>

              <Campo
                id="turno-motivo"
                etiqueta="¿Para qué venís?"
                ayuda="Con tus palabras. Sirve para que sepan qué preparar."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                autoComplete="off"
              />
              {motivos.length > 0 && (
                <ul className="-mt-3 mb-6 flex flex-wrap gap-2">
                  {motivos.map((m) => (
                    <li key={m}>
                      <button
                        type="button"
                        onClick={() => setMotivo(m)}
                        className={[
                          "min-h-12 cursor-pointer rounded-full border-2 px-4 text-etiqueta",
                          motivo === m
                            ? "border-azul bg-azul-claro font-bold text-azul"
                            : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
                        ].join(" ")}
                      >
                        {m}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!entrado && vencida && (
                <p className="mb-6 flex items-start gap-2 rounded-campo bg-espera-fondo p-4 text-espera">
                  <Icono nombre="reloj" className="mt-0.5 size-5 shrink-0" />
                  <span>
                    <span className="font-bold">Pasó un rato desde que entraste.</span>{" "}
                    <a href="#ingreso" className="font-bold underline">
                      Entrá de nuevo con tus datos
                    </a>{" "}
                    y pedí el turno: lo que elegiste queda acá.
                  </span>
                </p>
              )}

              {!entrado && !vencida && (
                <>
                  {/* Quien ya es cliente y no entró se registraría de nuevo
                      y quedaría dos veces: mejor que entre. */}
                  <p className="mb-6 max-w-[65ch] text-tinta-media">
                    Si ya sos cliente de {negocio.nombre},{" "}
                    <a href="#ingreso" className="font-bold text-azul underline">
                      entrá con tus datos
                    </a>{" "}
                    y no hace falta que los pongas acá.
                  </p>
                  <Campo
                    id="turno-nombre"
                    etiqueta="Tu nombre"
                    ayuda="Para saber quién viene."
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoComplete="name"
                  />
                  <Campo
                    id="turno-telefono"
                    etiqueta="Tu teléfono"
                    ayuda="Por acá te avisan si pasa algo. Con los últimos 4 números vas a poder volver a entrar."
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  <Campo
                    id="turno-identificador"
                    etiqueta={ident.nombre}
                    ayuda={`Por ejemplo: ${ident.ejemplo}. Con esto y tu teléfono volvés a entrar a ver tus turnos y tus casos.`}
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    maxLength={40}
                    autoComplete="off"
                    autoCapitalize="characters"
                  />
                </>
              )}

              {problema && <ErrorGeneral>{problema}</ErrorGeneral>}

              <Boton
                variante="principal"
                icono="calendario"
                className="min-h-14 w-full sm:min-h-12 sm:w-auto"
                motivo={guardando ? "anotándote" : falta}
                onClick={pedir}
              >
                Pedir el turno
              </Boton>
            </>
          )}
        </>
      )}
    </>
  );
}
