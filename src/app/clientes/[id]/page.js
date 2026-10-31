"use client";

// La ficha de un cliente (SCRUM-58, y auditoría de diseño, H7).
//
// Todo lo que trajo, del más reciente al más viejo, y su teléfono a mano. El
// teléfono se corrige acá: antes, uno mal cargado no se podía arreglar en
// ningún lado. Y para ver el historial de alguien que vino cinco veces había
// que buscarlo caso por caso.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { puede } from "@/lib/permisos";
import { estaAbierto, pesos } from "@/lib/estados";
import { comoSeIdentifica, mayuscula, vocabulario } from "@/lib/presets";
import { diaDeArgentina, diaEnPalabras, diaLargo, elDia, horaYMinutos } from "@/lib/fechas";
import { avisoDeLaProximaVisita, bajaDeAvisos, errorAlRevertirBaja, respuestasDelCliente } from "@/lib/recordatorios";
import { useRecordatorioVolver } from "@/lib/useRecordatorioVolver";
import {
  fraseTelefonoIncompleto,
  paisInicial,
  telefonoIncompleto,
  telefonoLegible,
  telefonoParaLlamar,
} from "@/lib/telefono";
import { saldoDelCaso } from "@/lib/cobros";
import { lineaDelCaso, subtituloDelCaso, tituloDelCaso } from "@/lib/nombres";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";
import CampoTelefono, { useTelefono } from "@/componentes/CampoTelefono";
import ListaDeRespuestas from "@/componentes/ListaDeRespuestas";

export default function FichaDeCliente() {
  const { id } = useParams();
  const datos = useDatos();
  const { cargando, clientes, casos, turnos, negocio, pasos, cobros } = datos;
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario, "editar_clientes");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const paisNegocio = paisInicial(negocio);
  const tel = useTelefono("", paisNegocio);
  const [tocado, setTocado] = useState(false);
  const [revirtiendo, setRevirtiendo] = useState(false);
  const [errorBaja, setErrorBaja] = useState(null);
  const recordatorioVolver = useRecordatorioVolver();
  const { idioma, locale, t } = useIdioma();

  const cliente = clientes.find((c) => c.id === id);
  useTitulo(cliente ? cliente.nombre : t("clientes.ficha.titulo"));

  // Lo que contestó por WhatsApp (R-10b). La API no filtra por cliente: se
  // leen las del negocio y se quedan las suyas. Aunque haya pedido la baja,
  // lo que dijo antes se muestra: la baja es de lo que se le manda.
  const [respuestas, setRespuestas] = useState(null);
  const [respuestasIncompletas, setRespuestasIncompletas] = useState(false);
  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = negocio?.id;
  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    acciones.current.leerTodasLasRespuestas().then((r) => {
      if (!vivo) return;
      setRespuestas(r.ok ? r.respuestas : { error: textoDeError(t, r.error) });
      setRespuestasIncompletas(r.ok && !r.completas);
    });
    return () => { vivo = false; };
  }, [negocioId]);

  if (cargando) return <Cargando />;
  if (!cliente) {
    return (
      <Vacio icono="buscar" titulo={t("clientes.ficha.noEncontrado")}>
        <Link href="/clientes" className="font-bold text-azul">
          {t("clientes.ficha.volver")}
        </Link>
        .
      </Vacio>
    );
  }

  const comoIdent = comoSeIdentifica(negocio?.rubro, idioma);
  const suyos = casos
    .filter((c) => c.cliente_id === cliente.id)
    .sort((a, b) => new Date(b.abierto_en) - new Date(a.abierto_en));
  const abiertos = suyos.filter(estaAbierto).length;
  const primero = suyos[suyos.length - 1];

  // Lo que se le cobró sale de los casos entregados que registraron cobro.
  // Un caso entregado sin cobro registrado no suma cero: no suma.
  const cobrados = suyos.filter((c) => c.cobrado != null);
  const cobradoTotal = cobrados.reduce((s, c) => s + Number(c.cobrado), 0);

  // Lo que todavía debe, caso por caso (025). Sólo donde se sabe: un caso
  // entregado antes de los cobros sin nada anotado no cuenta como deuda.
  const saldos = new Map(
    suyos.map((c) => [c.id, saldoDelCaso({ caso: c, pasos: pasos ?? [], cobros: cobros ?? [] })])
  );
  // Sólo de los entregados: en uno abierto, lo que falta se cobra al entregar.
  const debe = suyos
    .filter((c) => c.estado === "completado")
    .reduce((s, c) => s + (saldos.get(c.id)?.falta ?? 0), 0);

  // Se calcula con los casos que ya están en memoria: no hace falta pedir
  // nada más a la API.
  // Con su aviso por WhatsApp (R-2b): cuándo le llega o por qué no.
  const proximaVuelta = avisoDeLaProximaVisita({
    casos: suyos, cliente, volver: recordatorioVolver, hoy: diaDeArgentina(),
  }, { t, locale, idioma });

  // Si pidió no recibir avisos (R-8a), cuándo y qué quiere decir.
  const baja = bajaDeAvisos({ cliente, rubro: negocio?.rubro }, { t, locale, idioma });

  // Lo que contestó, con cuándo en el idioma de quien mira.
  const suyasRespuestas = respuestas?.error ? [] : respuestasDelCliente({ respuestas, clienteId: cliente.id }, { t, locale, idioma });
  const { cita } = vocabulario(negocio?.rubro, idioma);

  const proximos = turnos
    .filter((turno) => turno.cliente_id === cliente.id && turno.estado !== "cancelado")
    .filter((turno) => new Date(turno.empieza_en) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.empieza_en) - new Date(b.empieza_en));

  const errorTelefono = tocado && !tel.vacio && !tel.armado.ok ? tel.armado.mensaje : null;
  const incompleto = telefonoIncompleto(cliente);

  return (
    <>
      <Link
        href="/clientes"
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        {t("clientes.ficha.volver")}
      </Link>

      <h1 className="text-pantalla">{cliente.nombre}</h1>
      <p className="mt-1 mb-8 text-tinta-media">
        {cliente.confirmado === false
          ? t("clientes.ficha.pidioTurno")
          : primero
            ? t("clientes.ficha.desde", { dia: elDia(primero.abierto_en, locale, t) })
            : t("clientes.ficha.sinTrabajos")}
      </p>

      <Tarjeta className="mb-12">
        <p className="font-bold text-cuerpo">{t("clientes.ficha.telefono")}</p>
        {corrigiendo && puedeCargar ? (
          <div className="mt-2 max-w-[360px]">
            <CampoTelefono
              id="telefono"
              etiqueta={t("clientes.ficha.telefono")}
              paisPorDefecto={paisNegocio}
              error={errorTelefono}
              exito={tel.armado.ok ? t("clientes.telefonoListo") : null}
              valor={tel.valor}
              onChange={tel.setValor}
              onBlur={() => setTocado(true)}
              autoFocus
            />
            <div className="flex flex-wrap gap-3">
              <Boton
                icono="check"
                data-testid="cliente-telefono-guardar"
                motivo={tel.vacio ? t("ui.validaciones.faltaTelefono") : !tel.armado.ok ? t("clientes.ficha.telefonoNoSirve") : null}
                onClick={() => {
                  datos.corregirTelefono(cliente.id, tel.telefono);
                  datos.avisarExito(
                    t("clientes.ficha.telefonoGuardado", { nombre: cliente.nombre, telefono: telefonoLegible(tel.telefono) })
                  );
                  setCorrigiendo(false);
                }}
              >
                {t("clientes.ficha.guardarTelefono")}
              </Boton>
              <Boton variante="plano" onClick={() => setCorrigiendo(false)}>
                {t("clientes.ficha.dejarComoEstaba")}
              </Boton>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {cliente.telefono ? (
              <a
                href={`tel:${telefonoParaLlamar(cliente.telefono)}`}
                className="inline-flex min-h-12 items-center gap-2 text-azul"
              >
                <Icono nombre="telefono" className="size-5" />
                {telefonoLegible(cliente.telefono)}
              </a>
            ) : (
              <p className="text-tinta-media">{t("clientes.ficha.sinTelefono")}</p>
            )}
            {puedeCargar && (
              <Boton
                variante="plano"
                icono="nota"
                data-testid="cliente-telefono-corregir"
                onClick={() => {
                  // Uno de antes, sin país, arranca en el país del negocio
                  // con sus dígitos: casi siempre es confirmar y guardar.
                  tel.cargar(cliente.telefono ?? "");
                  setTocado(!!cliente.telefono);
                  setCorrigiendo(true);
                }}
              >
                {t(cliente.telefono ? "clientes.ficha.corregirTelefono" : "clientes.ficha.cargarTelefono")}
              </Boton>
            )}
          </div>
        )}

        {/* Un teléfono de antes de B-1b, sin código de país: no le llegan
            los WhatsApp. No es un error del cliente; se dice qué falta. */}
        {incompleto && !corrigiendo && (
          <p data-telefono-incompleto className="mt-2 flex max-w-[65ch] items-start gap-2 text-tinta-media">
            <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
            <span>{fraseTelefonoIncompleto(t)}</span>
          </p>
        )}

        {/* La baja de avisos (R-8b). No es un error: el cliente ejerció un
            derecho, y la ficha lo informa sin rojo ni ícono de alerta.
            Revertirla es para cuando el cliente pide volver, y el botón lo
            aclara al lado en vez de preguntar "¿está seguro?". */}
        {baja && (
          <div data-baja-de-avisos className="mt-6 max-w-[65ch]">
            <p className="font-bold text-cuerpo">{t("clientes.ficha.avisosWhatsapp")}</p>
            <p className="mt-1 flex items-start gap-2 text-tinta-media">
              <Icono nombre="whatsapp" className="mt-0.5 size-5 shrink-0" />
              <span>
                {baja.frase} {baja.consecuencia}
              </span>
            </p>
            {puedeCargar && (
              <div className="mt-3">
                <Boton
                  icono="deshacer"
                  data-testid="cliente-volver-avisos"
                  motivo={revirtiendo ? "guardando" : null}
                  onClick={async () => {
                    setErrorBaja(null);
                    setRevirtiendo(true);
                    const r = await datos.revertirBajaDeAvisos(cliente.id);
                    setRevirtiendo(false);
                    if (!r.ok) return setErrorBaja(r.errorOriginal ? errorAlRevertirBaja(r.errorOriginal, { t, locale, idioma }) : r.error);
                    datos.avisarExito(
                      proximos.length
                        ? t(`clientes.ficha.avisosVuelvenConTurnos.${cita.segun("m", "f")}`, {
                            nombre: cliente.nombre,
                            laCita: mayuscula(cita.el(2)),
                          })
                        : t("clientes.ficha.avisosVuelven", { nombre: cliente.nombre })
                    );
                  }}
                >
                  {t("clientes.ficha.volverAvisos")}
                </Boton>
                <p className="mt-2 text-apoyo text-tinta-suave">
                  {t("clientes.ficha.usalo")}
                </p>
                {errorBaja && (
                  <p role="alert" className="mt-2 flex items-start gap-2 font-bold text-rojo">
                    <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
                    {textoDeError(t, errorBaja)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {cliente.notas && (
          <>
            <p className="mt-6 font-bold text-cuerpo">{t("clientes.ficha.notas")}</p>
            <p className="mt-1 max-w-[65ch] text-tinta-media">{cliente.notas}</p>
          </>
        )}

        <dl className="mt-6 grid gap-4 @lg:grid-cols-3">
          <div>
            <dt className="text-apoyo text-tinta-suave">{t("clientes.ficha.casos")}</dt>
            <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">
              {suyos.length}
            </dd>
          </div>
          <div>
            <dt className="text-apoyo text-tinta-suave">{t("clientes.ficha.sinCerrar")}</dt>
            <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">
              {abiertos}
            </dd>
          </div>
          <div>
            <dt className="text-apoyo text-tinta-suave">{t("clientes.ficha.leCobraste")}</dt>
            <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">
              {cobrados.length ? pesos(cobradoTotal, locale) : t("clientes.ficha.nadaRegistrado")}
            </dd>
          </div>
          {debe > 0 && (
            <div>
              <dt className="text-apoyo text-tinta-suave">{t("clientes.ficha.teDebe")}</dt>
              <dd className="font-titulo font-extrabold text-subtitulo tabular-nums text-espera">
                {pesos(debe, locale)}
              </dd>
            </div>
          )}
        </dl>
      </Tarjeta>

      {proximos.length > 0 && (
        <>
          <TituloSeccion>{t("clientes.ficha.tieneTurno")}</TituloSeccion>
          <ul className="mb-12 overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
            {proximos.map((turno) => (
              <li key={turno.id} className="border-b border-borde last:border-b-0">
                {/* py-3: en celular la fecha y el motivo ocupan dos líneas, y
                    sin aire arriba y abajo quedaban pegadas al borde. */}
                <Link href="/agenda" className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-superficie">
                  <Icono nombre="calendario" className="size-5 shrink-0 text-tinta-media" />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <span className="font-bold first-letter:uppercase">
                      {t("turnos.cuando", {
                        dia: diaLargo(turno.empieza_en, locale, t),
                        hora: horaYMinutos(turno.empieza_en, locale),
                      })}
                    </span>{" "}
                    · {turno.motivo}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Cuándo le toca volver (R-1b): la más cercana que no pasó, de entre
          sus casos. Un cliente sin fecha no tiene sección: una vacía no
          dice nada que sirva. */}
      {proximaVuelta && (
        <>
          <TituloSeccion>{t("clientes.ficha.leToca")}</TituloSeccion>
          <Link
            href={`/casos/${proximaVuelta.caso.id}`}
            className="mb-12 flex min-h-14 items-center gap-3 rounded-tarjeta border border-borde bg-tarjeta px-4 py-3 hover:bg-superficie"
          >
            <Icono nombre="calendario" className="size-5 shrink-0 text-tinta-media" />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <span className="font-bold">
                {t("clientes.ficha.elDia", { dia: diaEnPalabras(proximaVuelta.dia, locale) })}
              </span>{" "}
              · {tituloDelCaso(proximaVuelta.caso, t)}
              {proximaVuelta.aviso && (
                <span className="mt-1 flex items-start gap-2 text-tinta-media">
                  <Icono nombre="whatsapp" className="mt-1 size-5 shrink-0" />
                  <span>{proximaVuelta.aviso.frase}</span>
                </span>
              )}
            </span>
          </Link>
        </>
      )}

      {/* Lo que contestó por WhatsApp (R-10b), de lo más nuevo a lo más
          viejo. Sin respuestas no hay sección, como "Le toca volver". */}
      {respuestas?.error ? (
        <>
          <TituloSeccion>{t("clientes.ficha.loQueTeContesto")}</TituloSeccion>
          <p className="mb-12 text-tinta-media">{textoDeError(t, respuestas.error)}</p>
        </>
      ) : (
        suyasRespuestas.length > 0 && (
          <section data-respuestas-del-cliente className="mb-12">
            <TituloSeccion>{t("clientes.ficha.loQueTeContesto")}</TituloSeccion>
            {/* Los últimos tres; el resto, de a diez, para que no tape sus casos. */}
            <ListaDeRespuestas respuestas={suyasRespuestas} rubro={negocio?.rubro} primeros={3} />
            {respuestasIncompletas && (
              <p className="mt-2 text-apoyo text-tinta-suave">{t("clientes.ficha.respuestasIncompletas")}</p>
            )}
          </section>
        )
      )}

      <TituloSeccion>{t("clientes.ficha.loQueTrajo")}</TituloSeccion>
      {suyos.length === 0 ? (
        <Vacio icono="carpeta" titulo={t("clientes.ficha.sinCasos")}>
          {t("clientes.ficha.sinCasosTexto")}
        </Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {suyos.map((c) => (
            <li key={c.id}>
              <Link href={`/casos/${c.id}`} className="block">
                <Tarjeta className="hover:bg-superficie">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* Sin pasar el cliente: ya estamos en su ficha. */}
                      <p className="font-bold text-cuerpo">
                        {tituloDelCaso(c, t)}
                        {lineaDelCaso(c, undefined, t) && ` · ${lineaDelCaso(c, undefined, t)}`}
                        {subtituloDelCaso(c, t) && (
                          <span className="ml-2 font-normal text-apoyo text-tinta-suave">
                            {subtituloDelCaso(c, t)}
                          </span>
                        )}
                      </p>
                      <p className="text-tinta-media">
                        {c.identificador && `${comoIdent.nombre} ${c.identificador} · `}
                        {t("clientes.ficha.abierto", { dia: elDia(c.abierto_en, locale, t) })}
                        {c.cobrado != null && ` · ${t("clientes.ficha.cobrado", { monto: pesos(Number(c.cobrado), locale) })}`}
                        {c.estado === "completado" && saldos.get(c.id)?.falta > 0 && (
                          <span className="font-bold text-espera">
                            {` · ${t("clientes.ficha.faltaCobrar", { monto: pesos(saldos.get(c.id).falta, locale) })}`}
                          </span>
                        )}
                      </p>
                    </div>
                    <ChipEstado estado={c.estado} />
                  </div>
                </Tarjeta>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
