"use client";

// "Cuándo atendés" — los días y horarios del negocio.
//
// De acá sale la lista de turnos que se le van a ofrecer a un cliente para
// que pida solo. Todo lo que se elige en esta pantalla se convierte en
// horarios concretos en la pantalla pública, así que la pantalla muestra el
// resultado mientras se configura: cuántos turnos por día salen y a qué hora
// arranca y termina cada tramo. Elegir "turnos de 45 minutos" sin ver que
// eso deja un hueco muerto al final del día es fácil.
//
// Pantalla propia y no una sección más de "Mi negocio", por lo mismo que los
// módulos: son seis decisiones y cada una tiene su porqué. Se llega desde
// "Mi negocio", no desde la navegación: el menú es para trabajar.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import {
  ANTICIPACIONES,
  HORIZONTE_DE_FABRICA,
  HORIZONTES,
  DIAS,
  DURACIONES,
  HORARIOS_DE_FABRICA,
  horariosListos,
  huecosDelDia,
  normalizarHorarios,
  problemasDeHorarios,
} from "@/lib/horarios";
import { linkDeWhatsApp } from "@/lib/seguimiento";
import Icono from "@/componentes/Icono";
import {
  Boton,
  Campo,
  Cargando,
  Tarjeta,
  TituloPantalla,
  TituloSeccion,
} from "@/componentes/ui";

const comoHora = (fecha) =>
  `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, "0")}`;

export default function Horarios() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  useTitulo("Cuándo atendés");

  // Se edita sobre un borrador, igual que la ficha del negocio: así
  // "Cancelar" deshace de verdad y nadie deja la agenda a medio configurar
  // por irse de la pantalla.
  const [borrador, setBorrador] = useState(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [errorLink, setErrorLink] = useState(null);
  const [cortando, setCortando] = useState(false);
  // Lo mismo, para el link del calendario (027). Son dos links distintos con
  // dos interruptores distintos, así que cada uno lleva su propio estado.
  const [armandoIcs, setArmandoIcs] = useState(false);
  const [errorIcs, setErrorIcs] = useState(null);
  const [cortandoIcs, setCortandoIcs] = useState(false);
  // El origen sale del navegador: así el link anda igual en localhost y el
  // día que esto se publique.
  const [origen, setOrigen] = useState("");
  useEffect(() => setOrigen(window.location.origin), []);

  if (cargando) return <Cargando />;

  const puedeConfigurar = puede(usuario?.rol, "configurarNegocio");
  const guardado = normalizarHorarios(negocio?.horarios);
  const actual = borrador ?? guardado;
  const editando = borrador !== null;

  const problemas = problemasDeHorarios(actual);
  const linkAgenda =
    origen && negocio?.agenda_codigo ? origen + "/turnos/" + negocio.agenda_codigo : "";
  const origenCalendario = process.env.NEXT_PUBLIC_APP_URL || origen;
  const linkIcs =
    origenCalendario && negocio?.ics_codigo
      ? origenCalendario + "/calendario/" + negocio.ics_codigo + ".ics"
      : "";
  // Apple Calendar y Outlook abren la suscripción solos con "webcal://".
  // Google no lo entiende y pide la dirección pegada a mano, así que la de
  // arriba se muestra igual.
  const linkWebcal = linkIcs.replace(/^https?:/, "webcal:");
  // Sin base no hay servidor que sirva el archivo: los turnos viven en este
  // navegador. Ahí lo que se puede es bajarlo de una vez.
  const hayBase = datos.fuente === "supabase";
  const cambiar = (que) => setBorrador((b) => ({ ...(b ?? guardado ?? HORARIOS_DE_FABRICA), ...que }));

  const alternarDia = (clave) => {
    const dias = actual?.dias ?? [];
    cambiar({
      dias: dias.includes(clave) ? dias.filter((d) => d !== clave) : [...dias, clave],
    });
  };

  // Un día cualquiera en el que se atienda, para mostrar en qué se convierte
  // la configuración. Sin esto hay que guardar, abrir la página pública y
  // contar los turnos a mano.
  const ejemplo = (() => {
    if (!actual || problemas.length > 0) return null;
    const hoy = new Date();
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      const huecos = huecosDelDia(fecha, actual);
      if (huecos.length > 0) return { fecha, huecos };
    }
    return null;
  })();

  return (
    <>
      <Link
        href="/negocio"
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        Volver a Mi negocio
      </Link>

      <TituloPantalla apoyo="Los días y horas en los que das turnos. Es lo que va a ver un cliente cuando quiera pedir uno.">
        Cuándo atendés
      </TituloPantalla>

      {!puedeConfigurar ? (
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">{QUIEN_PUEDE.configurarNegocio}</p>
          {guardado ? (
            <p className="mt-3 text-tinta-media">
              Hoy atendés{" "}
              <span className="font-bold text-tinta">
                {DIAS.filter((d) => guardado.dias.includes(d.clave))
                  .map((d) => d.nombre.toLowerCase())
                  .join(", ")}
              </span>{" "}
              de {guardado.desde} a {guardado.hasta}.
            </p>
          ) : (
            <p className="mt-3 text-tinta-media">Todavía no hay horarios configurados.</p>
          )}
        </Tarjeta>
      ) : (
        <>
          {!guardado && !editando && (
            <Tarjeta className="mb-8">
              <p className="flex items-start gap-2 font-bold text-cuerpo text-espera">
                <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                <span>Todavía no configuraste tus horarios</span>
              </p>
              <p className="mt-2 max-w-[65ch] text-tinta-media">
                Hasta que lo hagas, tus clientes no pueden pedir turno solos. Te
                dejamos abajo un horario de arranque —de lunes a viernes, de 9 a 18,
                cortando al mediodía— para que lo ajustes en vez de empezar de cero.
              </p>
              <div className="mt-4">
                <Boton icono="calendario" onClick={() => setBorrador(HORARIOS_DE_FABRICA)}>
                  Configurar mis horarios
                </Boton>
              </div>
            </Tarjeta>
          )}

          {(guardado || editando) && (
            <>
              <TituloSeccion>Qué días atendés</TituloSeccion>
              <Tarjeta className="mb-8">
                <ul className="flex flex-wrap gap-2.5">
                  {DIAS.map((d) => {
                    const puesto = (actual?.dias ?? []).includes(d.clave);
                    return (
                      <li key={d.clave}>
                        <button
                          type="button"
                          aria-pressed={puesto}
                          onClick={() => alternarDia(d.clave)}
                          className={[
                            "flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 px-4 font-bold text-cuerpo",
                            puesto
                              ? "border-azul bg-azul-claro text-azul"
                              : "border-borde-fuerte bg-tarjeta text-tinta hover:bg-superficie",
                          ].join(" ")}
                        >
                          {/* Tilde y palabra, no sólo el color: en blanco y
                              negro se tiene que seguir entendiendo cuáles
                              están puestos (cartilla, 02). */}
                          <Icono nombre={puesto ? "listo" : "circulo"} className="size-5" />
                          {d.nombre}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Tarjeta>

              <TituloSeccion>En qué horario</TituloSeccion>
              <Tarjeta className="mb-8">
                <div className="flex flex-wrap items-end gap-4">
                  <Hora
                    id="desde"
                    etiqueta="Abrís a las"
                    value={actual?.desde ?? "09:00"}
                    onChange={(v) => cambiar({ desde: v })}
                  />
                  <Hora
                    id="hasta"
                    etiqueta="Cerrás a las"
                    value={actual?.hasta ?? "18:00"}
                    onChange={(v) => cambiar({ hasta: v })}
                  />
                </div>

                <div className="mt-6 border-t border-borde pt-4">
                  <button
                    type="button"
                    aria-pressed={Boolean(actual?.corte)}
                    onClick={() =>
                      cambiar({
                        corte: actual?.corte ? null : { desde: "13:00", hasta: "16:00" },
                      })
                    }
                    className="flex min-h-12 cursor-pointer items-center gap-2 font-bold text-cuerpo text-azul"
                  >
                    <Icono
                      nombre={actual?.corte ? "listo" : "circulo"}
                      className="size-6"
                    />
                    Cortás al mediodía
                  </button>

                  {actual?.corte && (
                    <div className="mt-3 flex flex-wrap items-end gap-4">
                      <Hora
                        id="corte-desde"
                        etiqueta="Cerrás a las"
                        value={actual.corte.desde}
                        onChange={(v) => cambiar({ corte: { ...actual.corte, desde: v } })}
                      />
                      <Hora
                        id="corte-hasta"
                        etiqueta="Volvés a las"
                        value={actual.corte.hasta}
                        onChange={(v) => cambiar({ corte: { ...actual.corte, hasta: v } })}
                      />
                    </div>
                  )}
                </div>
              </Tarjeta>

              <TituloSeccion>Cada cuánto das un turno</TituloSeccion>
              <Tarjeta className="mb-8">
                <p className="mb-3 max-w-[65ch] text-tinta-media">
                  No es cuánto va a durar el trabajo —eso no se sabe de antemano—
                  sino cada cuánto entra alguien. Un auto puede quedarse tres días;
                  el lugar que ocupa en la agenda es este.
                </p>
                <Elegir
                  opciones={DURACIONES.map((m) => ({ valor: m, palabra: `${m} minutos` }))}
                  valor={actual?.minutos ?? 30}
                  alElegir={(v) => cambiar({ minutos: v })}
                />
              </Tarjeta>

              <TituloSeccion>Con cuánta anticipación te pueden pedir</TituloSeccion>
              <Tarjeta className="mb-8">
                <p className="mb-3 max-w-[65ch] text-tinta-media">
                  Para que nadie pida un turno para dentro de diez minutos y no haya
                  quién lo atienda.
                </p>
                <Elegir
                  opciones={ANTICIPACIONES.map((a) => ({ valor: a.horas, palabra: a.palabra }))}
                  valor={actual?.anticipacionHoras ?? 2}
                  alElegir={(v) => cambiar({ anticipacionHoras: v })}
                />
              </Tarjeta>

              <TituloSeccion>Hasta cuándo te pueden pedir</TituloSeccion>
              <Tarjeta className="mb-8">
                <p className="mb-3 max-w-[65ch] text-tinta-media">
                  Cuánto para adelante se ve en el calendario. Más allá de eso los
                  días aparecen tachados, para que nadie se anote para una fecha en
                  la que todavía no sabés si vas a abrir.
                </p>
                <Elegir
                  opciones={HORIZONTES.map((x) => ({ valor: x.dias, palabra: x.palabra }))}
                  valor={actual?.horizonteDias ?? HORIZONTE_DE_FABRICA}
                  alElegir={(v) => cambiar({ horizonteDias: v })}
                />
              </Tarjeta>

              {/* En qué se convierte todo lo de arriba. Es lo único que
                  contesta "¿entonces qué va a ver el cliente?" sin tener que
                  guardar y abrir la otra pantalla. */}
              <TituloSeccion>En qué queda</TituloSeccion>
              <Tarjeta className="mb-8">
                {problemas.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {problemas.map((p) => (
                      <li key={p} className="flex items-start gap-2 font-bold text-espera">
                        <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                ) : ejemplo ? (
                  <>
                    <p className="text-tinta-media">
                      Un{" "}
                      <span className="font-bold text-tinta">
                        {DIAS.find((d) => d.diaJs === ejemplo.fecha.getDay())?.nombre.toLowerCase()}
                      </span>{" "}
                      das{" "}
                      <span className="font-bold text-tinta">
                        {ejemplo.huecos.length} turnos
                      </span>
                      , de {comoHora(ejemplo.huecos[0])} a{" "}
                      {comoHora(ejemplo.huecos[ejemplo.huecos.length - 1])}.
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {ejemplo.huecos.map((h) => (
                        <li
                          key={h.getTime()}
                          className="rounded-campo bg-superficie px-3 py-1.5 font-bold text-etiqueta text-tinta-media tabular-nums"
                        >
                          {comoHora(h)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-tinta-media">
                    Con estos días no sale ningún turno en los próximos siete días.
                  </p>
                )}
              </Tarjeta>

              {/* El link con el que la gente pide turno. Va acá, abajo de los
                  horarios, porque no tiene sentido repartirlo antes de saber
                  cuándo atendés: lo primero que vería alguien sería una
                  pantalla sin horarios. */}
              {!editando && horariosListos(actual) && (
                <>
                  <TituloSeccion>El link para pedir turno</TituloSeccion>
                  <Tarjeta className="mb-8">
                    {errorLink && (
                      <p className="mb-3 flex items-start gap-2 font-bold text-rojo">
                        <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                        <span>{errorLink}</span>
                      </p>
                    )}

                    {!negocio?.agenda_codigo ? (
                      <>
                        <p className="max-w-[65ch] text-tinta-media">
                          Un link para poner en tu Instagram, en tu WhatsApp o donde
                          quieras. Quien lo abra ve los horarios que te quedan libres
                          y se anota solo, sin llamarte y sin crear ninguna cuenta.
                        </p>
                        <div className="mt-4">
                          <Boton
                            icono="calendario"
                            motivo={compartiendo ? "armando el link" : null}
                            onClick={async () => {
                              setErrorLink(null);
                              setCompartiendo(true);
                              const r = await datos.compartirAgenda();
                              setCompartiendo(false);
                              if (!r.ok) return setErrorLink(r.error);
                              datos.avisarExito(
                                "Listo. Ya podés repartir el link para pedir turno."
                              );
                            }}
                          >
                            Armar el link
                          </Boton>
                        </div>
                      </>
                    ) : (
                      <>
                        <Campo
                          id="link-agenda"
                          etiqueta="El link de tu agenda"
                          ayuda="Es el mismo siempre. Podés repartirlo donde quieras."
                          value={linkAgenda}
                          readOnly
                          onFocus={(ev) => ev.target.select()}
                        />

                        <div className="-mt-2 flex flex-wrap gap-3">
                          <Boton
                            icono="copiar"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(linkAgenda);
                                datos.avisarExito(
                                  "Copiamos el link. Pegalo donde lo quieras poner."
                                );
                              } catch {
                                document.getElementById("link-agenda")?.select();
                                datos.avisarExito("Quedó seleccionado. Copialo con Ctrl+C.");
                              }
                            }}
                          >
                            Copiar el link
                          </Boton>
                          <a
                            href={linkDeWhatsApp(
                              "Hola, te escribimos de " +
                                (negocio?.nombre ?? "tu negocio") +
                                ". Podés pedir tu turno acá, sin llamar: " +
                                linkAgenda
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 font-bold text-cuerpo text-tinta hover:bg-superficie"
                          >
                            <Icono nombre="chat" />
                            Mandarlo por WhatsApp
                          </a>
                        </div>

                        {cortando ? (
                          <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                            <p className="font-bold text-cuerpo">
                              ¿Dejar de compartir la agenda?
                            </p>
                            <p className="mt-1 max-w-[65ch] text-tinta-media">
                              El link deja de funcionar ahora mismo y nadie va a poder
                              pedir turno por ahí. Los turnos que ya te pidieron quedan
                              como están.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <Boton
                                variante="peligro"
                                icono="tacho"
                                onClick={async () => {
                                  setCortando(false);
                                  const r = await datos.dejarDeCompartirAgenda();
                                  if (!r.ok) return setErrorLink(r.error);
                                  datos.avisarExito("Listo. Ese link dejó de funcionar.");
                                }}
                              >
                                Sí, dejar de compartirla
                              </Boton>
                              <Boton variante="plano" onClick={() => setCortando(false)}>
                                Seguir compartiéndola
                              </Boton>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <Boton
                              variante="plano"
                              icono="tacho"
                              onClick={() => setCortando(true)}
                            >
                              Dejar de compartir la agenda
                            </Boton>
                          </div>
                        )}
                      </>
                    )}
                  </Tarjeta>

                  {/* ---------- El calendario del dueño (027) ---------- */}
                  <TituloSeccion>Tus turnos en tu calendario</TituloSeccion>
                  <Tarjeta className="mb-8">
                    {errorIcs && (
                      <p className="mb-3 flex items-start gap-2 font-bold text-rojo">
                        <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                        <span>{errorIcs}</span>
                      </p>
                    )}

                    {!negocio?.ics_codigo ? (
                      <>
                        <p className="max-w-[65ch] text-tinta-media">
                          Los turnos que tenés acá, adentro del calendario que ya usás en
                          el celular: el de Google, el de Apple o el de Outlook. Te
                          suscribís una vez y aparecen solos, sin entrar al sistema.
                        </p>
                        <p className="mt-3 flex max-w-[65ch] items-start gap-2 text-tinta-media">
                          <Icono nombre="llave" className="mt-0.5 size-5 shrink-0" />
                          <span>
                            Es un link secreto y es tuyo: el que lo tenga ve todos tus
                            turnos con el nombre, el motivo y el teléfono de cada cliente.
                            No lo repartas. Si se te escapa, lo das de baja acá y deja de
                            servir en el momento.
                          </span>
                        </p>
                        <div className="mt-4">
                          <Boton
                            icono="calendario"
                            motivo={armandoIcs ? "armando el link" : null}
                            onClick={async () => {
                              setErrorIcs(null);
                              setArmandoIcs(true);
                              const r = await datos.compartirCalendario();
                              setArmandoIcs(false);
                              if (!r.ok) return setErrorIcs(r.error);
                              datos.avisarExito(
                                "Listo. Ya podés cargarlo en tu calendario."
                              );
                            }}
                          >
                            Armar el link del calendario
                          </Boton>
                        </div>
                      </>
                    ) : (
                      <>
                        <Campo
                          id="link-ics"
                          etiqueta="El link de tu calendario"
                          ayuda="Es sólo para vos. No lo repartas: muestra los teléfonos de tus clientes."
                          value={linkIcs}
                          readOnly
                          onFocus={(ev) => ev.target.select()}
                        />

                        <div className="-mt-2 flex flex-wrap gap-3">
                          <Boton
                            icono="copiar"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(linkIcs);
                                datos.avisarExito("Copiamos el link. Pegalo en tu calendario.");
                              } catch {
                                document.getElementById("link-ics")?.select();
                                datos.avisarExito("Quedó seleccionado. Copialo con Ctrl+C.");
                              }
                            }}
                          >
                            Copiar el link
                          </Boton>
                          {/* Apple y Outlook abren la suscripción solos con
                              este esquema. Google no lo entiende, y para ése
                              está el link de arriba y el instructivo. */}
                          <a
                            href={linkWebcal}
                            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 font-bold text-cuerpo text-tinta hover:bg-superficie"
                          >
                            <Icono nombre="calendario" />
                            Abrirlo en mi calendario
                          </a>
                        </div>

                        <div className="mt-2 rounded-tarjeta bg-superficie p-4">
                          <p className="font-bold text-cuerpo">Cómo se carga en Google</p>
                          <ol className="mt-2 max-w-[65ch] list-decimal pl-5 text-tinta-media">
                            <li>Entrá a Google Calendar desde una computadora.</li>
                            <li>
                              A la izquierda, al lado de «Otros calendarios», tocá el más
                              y elegí «Suscribirse a un calendario».
                            </li>
                            <li>Pegá el link de arriba y confirmá.</li>
                          </ol>
                          <p className="mt-3 max-w-[65ch] text-apoyo text-tinta-suave">
                            Los turnos aparecen también en el celular, con la misma cuenta.
                            Google relee el calendario cuando quiere —suele tardar unas
                            horas— así que un turno recién anotado puede no aparecer al
                            toque. En el de Apple se elige cada cuánto releer.
                          </p>
                        </div>

                        {!hayBase && (
                          <p className="mt-3 flex max-w-[65ch] items-start gap-2 text-tinta-media">
                            <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
                            <span>
                              En el modo de ejemplo tus turnos viven en este navegador y no
                              hay servidor que los publique, así que el link todavía no
                              trae nada. Anda con las claves de Supabase cargadas.
                            </span>
                          </p>
                        )}

                        {cortandoIcs ? (
                          <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                            <p className="font-bold text-cuerpo">
                              ¿Sacar la agenda de tu calendario?
                            </p>
                            <p className="mt-1 max-w-[65ch] text-tinta-media">
                              El link deja de funcionar ahora mismo. Los turnos que ya se
                              copiaron a tu calendario quedan ahí hasta que lo borres de tu
                              lista de calendarios, y no se actualizan más.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <Boton
                                variante="peligro"
                                icono="tacho"
                                onClick={async () => {
                                  setCortandoIcs(false);
                                  const r = await datos.dejarDeCompartirCalendario();
                                  if (!r.ok) return setErrorIcs(r.error);
                                  datos.avisarExito("Listo. Ese link dejó de funcionar.");
                                }}
                              >
                                Sí, dar de baja el link
                              </Boton>
                              <Boton variante="plano" onClick={() => setCortandoIcs(false)}>
                                Dejarlo como está
                              </Boton>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <Boton
                              variante="plano"
                              icono="tacho"
                              onClick={() => setCortandoIcs(true)}
                            >
                              Dar de baja el link del calendario
                            </Boton>
                          </div>
                        )}
                      </>
                    )}
                  </Tarjeta>
                </>
              )}

              {editando && (
                <div className="flex flex-wrap gap-3">
                  <Boton
                    variante="principal"
                    icono="check"
                    motivo={problemas.length > 0 ? problemas[0] : null}
                    onClick={() => {
                      datos.guardarHorarios(borrador);
                      datos.avisarExito("Listo, tus horarios quedaron guardados.");
                      setBorrador(null);
                    }}
                  >
                    Guardar los horarios
                  </Boton>
                  <Boton variante="plano" onClick={() => setBorrador(null)}>
                    Cancelar
                  </Boton>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

// Una hora. Es un <input type="time"> del navegador y no uno nuestro: el del
// sistema operativo ya sabe de relojes de 12 y 24 horas, y en el celular
// abre la rueda en vez del teclado.
function Hora({ id, etiqueta, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="block font-bold text-cuerpo">
        {etiqueta}
      </label>
      <input
        id={id}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 block min-h-12 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo tabular-nums"
      />
    </div>
  );
}

// Elegir uno entre pocos. No es un <select> por lo mismo de siempre: con
// cinco opciones cortas se ven todas de una y se tocan de una.
function Elegir({ opciones, valor, alElegir }) {
  return (
    <ul className="flex flex-wrap gap-2.5">
      {opciones.map((o) => {
        const puesta = o.valor === valor;
        return (
          <li key={o.valor}>
            <button
              type="button"
              aria-pressed={puesta}
              onClick={() => alElegir(o.valor)}
              className={[
                "flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 px-4 font-bold text-cuerpo",
                puesta
                  ? "border-azul bg-azul-claro text-azul"
                  : "border-borde-fuerte bg-tarjeta text-tinta hover:bg-superficie",
              ].join(" ")}
            >
              {puesta && <Icono nombre="listo" className="size-5" />}
              {o.palabra}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
