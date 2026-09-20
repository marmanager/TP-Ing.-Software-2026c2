"use client";

// "Cómo viene lo tuyo" — el seguimiento público de un caso (SCRUM-68).
//
// Es la pantalla que ataca el problema que dio origen al proyecto: que el
// teléfono no pare de sonar. El negocio manda un link por WhatsApp y el
// cliente mira solo, sin llamar a nadie.
//
// Es también la más expuesta de todo el sistema, y la única que abre gente
// que nunca vio la aplicación: sin cuenta, desde el celular, sin contexto y
// sin nadie al lado para explicarle. De ahí las decisiones de acá abajo.
//
//   Lo primero y más grande es el estado, porque es lo único que se vino a
//   buscar. Justo abajo, si hay algo esperando su respuesta, la decisión.
//   Todo lo demás está más abajo, para quien quiera mirar.
//
//   No hay navegación, ni barra lateral, ni un solo enlace que lleve a una
//   pantalla del sistema. No hay a dónde ir: esto no es la puerta de entrada
//   a nada, es la respuesta a una pregunta.
//
//   Todo lo que necesita explicación está explicado en la misma pantalla, en
//   una frase. No hay ayuda, no hay tutorial y no hay a quién preguntarle.
//
// Qué se muestra y qué no lo decide src/lib/seguimiento.js, y del lado de la
// base ver_seguimiento() en supabase/018_seguimiento.sql. Acá no se filtra
// nada: lo que llega es lo que se puede mostrar.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { buscarSeguimiento, responderDesdeElLink } from "@/lib/datos";
import { ESTADOS, pesos } from "@/lib/estados";
import { comoSeIdentifica, etiquetaEstado } from "@/lib/presets";
import {
  QUE_SIGNIFICA,
  lineaDeEstados,
  linkDeLlamada,
  linkDeWhatsAppA,
  mensajeDeConsulta,
  totalAprobado,
} from "@/lib/seguimiento";
import { cuantoHace, diaPasado, elDia } from "@/lib/fechas";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Boton, Cargando } from "@/componentes/ui";

export default function Seguimiento() {
  const { codigo } = useParams();
  const [mirando, setMirando] = useState(true);
  const [caso, setCaso] = useState(null);
  // Cuál paso está preguntando, y qué se le va a contestar.
  const [decidiendo, setDecidiendo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [problema, setProblema] = useState(null);
  // Lo que se acaba de contestar, para el comprobante: qué, cuánto, qué se
  // respondió y en cuánto quedó el total. Se guarda al contestar porque
  // después el paso ya no está en la lista de la que salió.
  const [contestado, setContestado] = useState(null);

  // El título de la pestaña no usa useTitulo(): ese hook cuelga el nombre
  // del negocio de quien está usando el sistema, y acá quien mira no tiene
  // negocio. El nombre que corresponde es el del que mandó el link.
  useEffect(() => {
    document.title = caso?.negocio_nombre
      ? `Cómo viene lo tuyo · ${caso.negocio_nombre}`
      : "Cómo viene lo tuyo";
  }, [caso]);

  // Después de contestar se vuelve a pedir el caso entero en vez de
  // remendar lo que hay en pantalla: así lo que se dibuja sale siempre del
  // mismo lugar, y si mientras tanto el negocio movió algo, se ve.
  const traer = useCallback(async () => {
    const r = await buscarSeguimiento(codigo);
    setCaso(r);
    setMirando(false);
  }, [codigo]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await buscarSeguimiento(codigo);
      if (!vivo) return;
      setCaso(r);
      setMirando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [codigo]);

  async function contestar(paso, respuesta) {
    const totalYa = totalAprobado(caso?.pasos ?? []);
    setProblema(null);
    setGuardando(true);
    const r = await responderDesdeElLink(codigo, paso.id, respuesta);
    setGuardando(false);
    setDecidiendo(null);

    if (!r.ok) {
      setProblema(r.motivo);
      // Se vuelve a pedir igual: si el paso ya estaba contestado, lo que hay
      // en pantalla quedó viejo y mostrarlo otra vez sería mentir.
      await traer();
      return;
    }

    setContestado({
      nombre: paso.nombre,
      monto: paso.monto,
      respuesta,
      total: respuesta === "aprobado" ? totalYa + Number(paso.monto || 0) : totalYa,
    });
    await traer();
  }

  if (mirando) {
    return (
      <Marco>
        <Cargando filas={2} />
      </Marco>
    );
  }

  // El link no sirve. Da lo mismo si nunca existió, si el negocio lo dio de
  // baja o si el caso ya no está: contarle la diferencia a quien lo abre
  // sería confirmarle que alguna vez fue bueno (criterio 15).
  //
  // Sin "error 404", sin "link vencido" y sin culpar a nadie: dice qué pasó
  // y qué hacer, que es lo único que sirve del otro lado (cartilla, 07).
  if (!caso?.sirve) {
    return (
      <Marco>
        <div className="rounded-tarjeta border border-borde bg-tarjeta p-6">
          <p className="flex items-start gap-3 font-titulo font-extrabold text-seccion">
            <Icono nombre="alerta" className="mt-1 size-7 shrink-0 text-espera" />
            <span>Este link ya no sirve</span>
          </p>
          <p className="mt-3 max-w-[65ch] text-tinta-media">
            Puede ser que esté cortado, que se haya copiado de más o que el
            negocio lo haya dado de baja. Pedile uno nuevo a quien te lo mandó
            y vas a poder seguir mirando desde ahí.
          </p>
        </div>
      </Marco>
    );
  }

  const e = ESTADOS[caso.estado];
  const comoIdent = comoSeIdentifica(caso.rubro);
  const pasos = caso.pasos ?? [];
  const porResponder = caso.por_responder ?? [];
  const total = totalAprobado(pasos);
  const linea = lineaDeEstados(caso.estado, caso.linea ?? [], { abiertoEn: caso.abierto_en });

  return (
    <Marco negocio={caso.negocio_nombre}>
      {/* El estado, lo más grande de la pantalla. Color, ícono y palabra: si
          se imprime en blanco y negro se sigue entendiendo (cartilla, 02). */}
      <div className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
        <div className={`h-2 w-full ${e.barra}`} aria-hidden="true" />
        <div className="p-5 sm:p-6">
          {caso.cliente_nombre && (
            <p className="text-tinta-media">Hola {caso.cliente_nombre},</p>
          )}
          <h1 className="mt-1 text-ident">
            {caso.identificador ? (
              <>
                {comoIdent.nombre} {caso.identificador}
              </>
            ) : (
              <>Lo que dejaste en {caso.negocio_nombre}</>
            )}
          </h1>
          {caso.servicio && <p className="mt-1 text-tinta-media">{caso.servicio}</p>}

          <div className="mt-5">
            <ChipEstado estado={caso.estado} rubro={caso.rubro} grande />
          </div>
          <p className="mt-3 max-w-[65ch] text-cuerpo">{QUE_SIGNIFICA[caso.estado]}</p>

          {/* Por qué tarda. Es la pregunta que trae a esta pantalla, así que
              cuando hay respuesta va acá arriba y no escondida abajo. */}
          {caso.que_falta && (
            <p className="mt-4 flex items-start gap-2 rounded-campo bg-espera-fondo p-4 text-espera">
              <Icono nombre="reloj" className="mt-0.5 size-6 shrink-0" />
              <span>
                <span className="font-bold">Se está esperando:</span> {caso.que_falta}
              </span>
            </p>
          )}

          <p className="mt-5 text-apoyo text-tinta-suave">
            Última novedad {cuantoHace(caso.actualizado_en ?? caso.abierto_en)}. Cada
            vez que abrís este link ves cómo está en ese momento.
          </p>
        </div>
      </div>

      {/* El comprobante de lo que acaba de contestar. Repite qué y cuánto,
          porque el renglón que se tocó desapareció de la pantalla y sin esto
          no queda ninguna constancia de qué se aprobó.

          role="status" para que un lector de pantalla lo diga solo. */}
      {contestado && (
        <div
          role="status"
          className={`mt-4 overflow-hidden rounded-tarjeta border-2 ${
            contestado.respuesta === "aprobado"
              ? "border-completo bg-completo-fondo"
              : "border-borde-fuerte bg-superficie"
          }`}
        >
          <div className="p-4 sm:p-5">
            <p
              className={`flex items-center gap-2 font-titulo font-extrabold text-subtitulo ${
                contestado.respuesta === "aprobado" ? "text-completo" : "text-tinta"
              }`}
            >
              <Icono
                nombre={contestado.respuesta === "aprobado" ? "listo" : "check"}
                className="size-7 shrink-0"
              />
              {contestado.respuesta === "aprobado"
                ? "Listo, quedó aprobado"
                : "Listo, anotamos que no"}
            </p>

            <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="min-w-0 font-bold text-cuerpo">«{contestado.nombre}»</span>
              <span className="font-bold tabular-nums">{pesos(contestado.monto)}</span>
            </p>

            <p className="mt-2 max-w-[65ch] text-tinta-media">
              {contestado.respuesta === "aprobado" ? (
                <>
                  {caso.negocio_nombre} ya lo ve y lo va a hacer. Con este, lo que
                  aprobaste hasta ahora suma{" "}
                  <span className="font-bold text-tinta">{pesos(contestado.total)}</span>.
                </>
              ) : (
                <>
                  No lo van a hacer y no te lo van a cobrar. Lo que aprobaste sigue
                  siendo <span className="font-bold text-tinta">{pesos(contestado.total)}</span>
                  . Si cambiás de idea, pedíselo a {caso.negocio_nombre}.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {problema && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-campo bg-espera-fondo p-4 font-bold text-espera"
        >
          <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
          <span>{problema}</span>
        </p>
      )}

      {/* Lo que espera su respuesta, arriba de todo lo demás: es lo único de
          esta pantalla que le pide algo, y es lo que destraba el trabajo.

          Aprobar desde acá es definitivo, igual que cuando lo carga el
          mostrador: la base no deja tocar un paso aprobado
          (015_paso_aprobado_fijo.sql). Por eso pregunta antes, con el monto
          escrito, y de a uno: un "aprobar todo" convierte cinco decisiones
          con plata en un solo dedazo. */}
      {porResponder.length > 0 && (
        <>
          <h2 className="mt-10 mb-1 text-seccion">Falta que contestes</h2>
          <p className="mb-3 max-w-[65ch] text-tinta-media">
            {porResponder.length === 1
              ? "Hay un trabajo esperando tu respuesta."
              : `Hay ${porResponder.length} trabajos esperando tu respuesta.`}{" "}
            Contestá de a uno. Lo que aprobás se hace y se cobra; lo que no, no.
          </p>

          <ul className="flex flex-col gap-3">
            {porResponder.map((paso) => {
              const preguntando = decidiendo?.id === paso.id ? decidiendo.respuesta : null;

              return (
                <li
                  key={paso.id}
                  className="overflow-hidden rounded-tarjeta border-2 border-espera bg-tarjeta"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="min-w-0 font-bold text-subtitulo">{paso.nombre}</p>
                      <p className="font-titulo font-extrabold text-subtitulo tabular-nums">
                        {pesos(paso.monto)}
                      </p>
                    </div>
                    {/* Lo que el negocio escribió para explicárselo, o el
                        aviso de que no escribió nada. El hueco callado era
                        peor: se lee como si no hubiera nada que saber. */}
                    {paso.descripcion ? (
                      <p className="mt-2 max-w-[65ch] text-tinta-media">{paso.descripcion}</p>
                    ) : (
                      <p className="mt-2 max-w-[65ch] text-tinta-media">
                        {caso.negocio_nombre} no dejó una explicación de este trabajo. Si
                        no te queda claro qué te van a hacer, preguntale antes de
                        aprobar.
                      </p>
                    )}

                    {preguntando === "aprobado" ? (
                      <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                        <p className="font-bold text-subtitulo">
                          ¿Aprobás «{paso.nombre}»?
                        </p>

                        {/* Dos renglones, y cada uno contesta una pregunta
                            distinta: cuánto, y qué pasa cuando decís que sí.
                            Antes era una sola frase que las mezclaba.

                            Qué es el trabajo NO va acá: la explicación del
                            negocio está en la tarjeta, arriba, y sigue a la
                            vista mientras se lee esto. Repetirla era hacer
                            leer dos veces lo mismo. */}
                        <dl className="mt-3 flex flex-col gap-2">
                          <div>
                            <dt className="font-bold text-cuerpo">Cuánto te van a cobrar</dt>
                            <dd className="max-w-[65ch] text-tinta-media">
                              <span className="font-bold text-tinta tabular-nums">
                                {pesos(paso.monto)}
                              </span>{" "}
                              por este trabajo. Con este, lo que aprobaste pasa de{" "}
                              {pesos(total)} a{" "}
                              <span className="font-bold text-tinta tabular-nums">
                                {pesos(total + Number(paso.monto || 0))}
                              </span>
                              .
                            </dd>
                          </div>
                          <div>
                            <dt className="font-bold text-cuerpo">Qué pasa después</dt>
                            <dd className="max-w-[65ch] text-tinta-media">
                              {caso.negocio_nombre} lo va a empezar a hacer. Desde esta
                              pantalla no vas a poder volver atrás: si cambiás de idea,
                              tenés que hablarlo con ellos.
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Boton
                            variante="principal"
                            icono="listo"
                            motivo={guardando ? "guardando" : null}
                            className="min-h-14 w-full sm:min-h-12 sm:w-auto"
                            onClick={() => contestar(paso, "aprobado")}
                          >
                            Sí, lo apruebo
                          </Boton>
                          <Boton variante="plano" onClick={() => setDecidiendo(null)}>
                            Todavía no
                          </Boton>
                        </div>
                      </div>
                    ) : preguntando === "rechazado" ? (
                      <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                        <p className="font-bold text-subtitulo">
                          ¿Decís que no a «{paso.nombre}»?
                        </p>
                        <p className="mt-3 max-w-[65ch] text-tinta-media">
                          No lo van a hacer y no te van a cobrar esos {pesos(paso.monto)}:
                          lo que aprobaste sigue siendo{" "}
                          <span className="font-bold text-tinta tabular-nums">
                            {pesos(total)}
                          </span>
                          . Si más adelante cambiás de idea, pedíselo a{" "}
                          {caso.negocio_nombre} y te lo vuelven a ofrecer.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Boton
                            variante="neutro"
                            motivo={guardando ? "guardando" : null}
                            className="min-h-14 w-full sm:min-h-12 sm:w-auto"
                            onClick={() => contestar(paso, "rechazado")}
                          >
                            Sí, no lo hago
                          </Boton>
                          <Boton variante="plano" onClick={() => setDecidiendo(null)}>
                            Volver atrás
                          </Boton>
                        </div>
                      </div>
                    ) : (
                      /* 52 px de alto y 10 px en medio, como en la pantalla
                         del mostrador: para no equivocarse de dedo. */
                      <div className="mt-4 flex gap-2.5">
                        <Boton
                          variante="principal"
                          className="min-h-13 flex-1"
                          onClick={() => {
                            setProblema(null);
                            setContestado(null);
                            setDecidiendo({ id: paso.id, respuesta: "aprobado" });
                          }}
                        >
                          Lo apruebo
                        </Boton>
                        <Boton
                          variante="neutro"
                          className="min-h-13 flex-1"
                          onClick={() => {
                            setProblema(null);
                            setContestado(null);
                            setDecidiendo({ id: paso.id, respuesta: "rechazado" });
                          }}
                        >
                          No lo hago
                        </Boton>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {porResponder.length > 1 && (
            <p className="mt-3 max-w-[65ch] text-apoyo text-tinta-suave">
              Si aprobás todo, son {pesos(totalAprobado(porResponder))} más de lo que ya
              venías aprobando.
            </p>
          )}

          {/* La salida para el que no está seguro. Sin esto, dudar significa
              cerrar la pantalla y buscar el número del negocio en algún
              lado, que es volver al teléfono que esto vino a evitar, pero
              peor: ahora además hay una decisión con plata esperando.

              Va acá abajo y no arriba: primero lo que tiene que decidir,
              después la ayuda para decidirlo. */}
          <div className="mt-6 rounded-tarjeta border border-borde bg-tarjeta p-4 sm:p-5">
            <p className="font-bold text-subtitulo">¿No estás seguro?</p>
            <p className="mt-1 max-w-[65ch] text-tinta-media">
              Preguntale a {caso.negocio_nombre} antes de decidir. Mientras no
              contestes no se hace nada, y el link te va a seguir esperando acá.
            </p>

            {caso.negocio_telefono ? (
              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <a
                  href={linkDeWhatsAppA(
                    caso.negocio_telefono,
                    mensajeDeConsulta({
                      clienteNombre: caso.cliente_nombre,
                      identificador: caso.identificador,
                      servicio: caso.servicio,
                      numero: caso.numero,
                      paso: porResponder.length === 1 ? porResponder[0].nombre : null,
                    })
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-5 font-bold text-cuerpo text-tinta hover:bg-superficie"
                >
                  <Icono nombre="chat" />
                  Escribirle por WhatsApp
                </a>
                {/* El número escrito al lado y no sólo en el enlace: en una
                    computadora "Llamar" puede no hacer nada, y ahí lo que
                    salva es poder leerlo y marcarlo a mano. */}
                <a
                  href={linkDeLlamada(caso.negocio_telefono)}
                  className="inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-5 font-bold text-cuerpo text-tinta hover:bg-superficie"
                >
                  <Icono nombre="telefono" />
                  Llamar al {caso.negocio_telefono}
                </a>
              </div>
            ) : (
              <p className="mt-2 max-w-[65ch] text-apoyo text-tinta-suave">
                Escribile o llamalo por donde venís hablando con ellos.
              </p>
            )}
          </div>
        </>
      )}

      {/* Por dónde pasó y qué falta. Los cinco pasos siempre, también los que
          todavía no llegaron: saber cuánto queda es parte de la respuesta. */}
      <h2 className="mt-10 mb-3 text-seccion">Por dónde va</h2>
      <ol className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
        {linea.map((paso) => {
          const p = ESTADOS[paso.estado];
          return (
            <li
              key={paso.estado}
              className={`flex items-start gap-3 border-b border-borde p-4 last:border-b-0 ${
                paso.pendiente ? "text-tinta-suave" : ""
              }`}
            >
              <span
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                  paso.pendiente ? "bg-superficie text-tinta-suave" : `${p.fondo} ${p.texto}`
                }`}
              >
                <Icono nombre={paso.pasado ? "listo" : p.icono} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block ${paso.actual ? "font-bold text-cuerpo" : ""}`}>
                  {etiquetaEstado(caso.rubro, paso.estado)}
                  {paso.actual && (
                    <>
                      {" "}
                      <span className="font-normal text-tinta-media">· acá está ahora</span>
                    </>
                  )}
                </span>
                {/* Sin fecha no se dice nada. Decir "ya pasó" sería afirmar
                    que el caso estuvo en esa etapa, y no siempre es cierto: un
                    caso puede saltear etapas, y los anteriores a esta versión
                    no tienen las fechas guardadas. El tilde ya dice que quedó
                    atrás; poner palabras encima sería inventar. */}
                {(paso.cuando || paso.pendiente) && (
                  <span className="block text-apoyo text-tinta-suave">
                    {paso.cuando ? diaPasado(paso.cuando) : "Todavía no"}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Lo que aprobó, y nada más: los pasos que todavía no contestó o que
          rechazó no están ni en la lista ni en el total. Si no aprobó nada,
          la sección entera no aparece: una sección vacía se lee como algo que
          falta cargar. */}
      {pasos.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-seccion">Lo que aprobaste</h2>
          <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
            {pasos.map((paso, i) => (
              <li
                key={`${paso.nombre}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-borde p-4 last:border-b-0"
              >
                <span className="min-w-0">{paso.nombre}</span>
                <span className="font-bold tabular-nums">{pesos(paso.monto)}</span>
              </li>
            ))}
            <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-superficie p-4">
              <span className="font-bold text-cuerpo">Total aprobado</span>
              <span className="font-titulo font-extrabold text-subtitulo tabular-nums">
                {pesos(total)}
              </span>
            </li>
          </ul>
          <p className="mt-2 max-w-[65ch] text-apoyo text-tinta-suave">
            Es lo que aceptaste hasta ahora. Si te ofrecieron algo más y todavía no
            contestaste, no está contado acá.
          </p>
        </>
      )}

      <p className="mt-10 max-w-[65ch] text-apoyo text-tinta-suave">
        Entró {elDia(caso.abierto_en)}
        {caso.numero ? ` · Caso ${caso.numero}` : ""}. Si algo no coincide, hablá
        directamente con {caso.negocio_nombre}.
      </p>
    </Marco>
  );
}

// El marco de la pantalla. A sangre completa, sin la navegación del sistema
// y con una columna angosta: se abre casi siempre en un celular, y en una
// pantalla grande una línea de texto de punta a punta no se lee.
function Marco({ negocio, children }) {
  return (
    <div className="min-h-screen bg-fondo">
      <header className="border-b border-borde bg-tarjeta">
        <div className="mx-auto flex w-full max-w-[640px] items-center gap-3 px-4 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
            <Icono nombre="tienda" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-titulo font-extrabold text-subtitulo leading-tight">
              {negocio ?? "Seguimiento"}
            </p>
            <p className="text-apoyo text-tinta-suave">Cómo viene lo tuyo</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
