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

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, quienPuede } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import {
  ANTICIPACIONES,
  HORIZONTE_DE_FABRICA,
  HORIZONTES,
  DIAS,
  DURACIONES,
  HORARIOS_DE_FABRICA,
  horariosListos,
  huecosDelDia,
  nombreDelDia,
  normalizarHorarios,
  palabraDeAnticipacion,
  palabraDeHorizonte,
  problemasDeHorarios,
} from "@/lib/horarios";
import Icono from "@/componentes/Icono";
import Frase from "@/componentes/Frase";
import LinkCompartido from "@/componentes/LinkCompartido";
import {
  Boton,
  Cargando,
  Tarjeta,
  TituloPantalla,
  TituloSeccion,
} from "@/componentes/ui";

const comoHora = (fecha) =>
  `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, "0")}`;

// Las palabras del link para pedir turno. El bloque en sí es el de
// LinkCompartido, el mismo del editor de la landing. El mensaje de WhatsApp lo
// manda el negocio: sale en su idioma.
const textosDelLink = (t) => ({
  etiqueta: t("negocio.horarios.link.etiqueta"),
  explicacion: t("negocio.horarios.link.explicacion"),
  armar: t("negocio.horarios.link.armar"),
  armado: t("negocio.horarios.link.armado"),
  whatsapp: (nombre, link) => t("negocio.horarios.link.whatsapp", { nombre, link }),
  dejar: t("negocio.horarios.link.dejar"),
  pregunta: t("negocio.horarios.link.pregunta"),
  aviso: t("negocio.horarios.link.aviso"),
  cortado: t("negocio.horarios.link.cortado"),
});

export default function Horarios() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  const { idioma, locale, t } = useIdioma();
  useTitulo(t("negocio.horarios.titulo"));
  // Un día en medio de una frase: en castellano va en minúscula, en inglés no.
  const nombreEnFrase = (diaJs) => (idioma === "es" ? nombreDelDia(diaJs, locale).toLowerCase() : nombreDelDia(diaJs, locale));

  // Se edita sobre un borrador, igual que la ficha del negocio: así
  // "Cancelar" deshace de verdad y nadie deja la agenda a medio configurar
  // por irse de la pantalla.
  const [borrador, setBorrador] = useState(null);

  if (cargando) return <Cargando />;

  const puedeConfigurar = puede(usuario, "configurar_negocio");
  const guardado = normalizarHorarios(negocio?.horarios);
  const actual = borrador ?? guardado;
  const editando = borrador !== null;

  const problemas = problemasDeHorarios(actual, t);
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
        {t("negocio.volver")}
      </Link>

      <TituloPantalla apoyo={t("negocio.horarios.apoyo")}>
        {t("negocio.horarios.titulo")}
      </TituloPantalla>

      {!puedeConfigurar ? (
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">{quienPuede("configurar_negocio", t)}</p>
          {guardado ? (
            <p className="mt-3 text-tinta-media">
              <Frase
                texto={t("negocio.horarios.hoyAtendes", { desde: guardado.desde, hasta: guardado.hasta })}
                partes={{
                  dias: (
                    <span className="font-bold text-tinta">
                      {DIAS.filter((d) => guardado.dias.includes(d.clave))
                        .map((d) => nombreEnFrase(d.diaJs))
                        .join(", ")}
                    </span>
                  ),
                }}
              />
            </p>
          ) : (
            <p className="mt-3 text-tinta-media">{t("negocio.horarios.sinHorarios")}</p>
          )}
        </Tarjeta>
      ) : (
        <>
          {!guardado && !editando && (
            <Tarjeta className="mb-8">
              <p className="flex items-start gap-2 font-bold text-cuerpo text-espera">
                <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                <span>{t("negocio.horarios.sinConfigTitulo")}</span>
              </p>
              <p className="mt-2 max-w-[65ch] text-tinta-media">
                {t("negocio.horarios.sinConfigTexto")}
              </p>
              <div className="mt-4">
                <Boton icono="calendario" onClick={() => setBorrador(HORARIOS_DE_FABRICA)}>
                  {t("negocio.horarios.configurarMis")}
                </Boton>
              </div>
            </Tarjeta>
          )}

          {(guardado || editando) && (
            <>
              <TituloSeccion>{t("negocio.horarios.queDias")}</TituloSeccion>
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
                          {nombreDelDia(d.diaJs, locale)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Tarjeta>

              <TituloSeccion>{t("negocio.horarios.enQueHorario")}</TituloSeccion>
              <Tarjeta className="mb-8">
                <div className="flex flex-wrap items-end gap-4">
                  <Hora
                    id="desde"
                    etiqueta={t("negocio.horarios.abris")}
                    value={actual?.desde ?? "09:00"}
                    onChange={(v) => cambiar({ desde: v })}
                  />
                  <Hora
                    id="hasta"
                    etiqueta={t("negocio.horarios.cerras")}
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
                    {t("negocio.horarios.cortas")}
                  </button>

                  {actual?.corte && (
                    <div className="mt-3 flex flex-wrap items-end gap-4">
                      <Hora
                        id="corte-desde"
                        etiqueta={t("negocio.horarios.cerras")}
                        value={actual.corte.desde}
                        onChange={(v) => cambiar({ corte: { ...actual.corte, desde: v } })}
                      />
                      <Hora
                        id="corte-hasta"
                        etiqueta={t("negocio.horarios.volves")}
                        value={actual.corte.hasta}
                        onChange={(v) => cambiar({ corte: { ...actual.corte, hasta: v } })}
                      />
                    </div>
                  )}
                </div>
              </Tarjeta>

              <TituloSeccion>{t("negocio.horarios.cadaCuanto")}</TituloSeccion>
              <Tarjeta className="mb-8">
                <p className="mb-3 max-w-[65ch] text-tinta-media">
                  {t("negocio.horarios.cadaCuantoTexto")}
                </p>
                <Elegir
                  opciones={DURACIONES.map((m) => ({ valor: m, palabra: t("negocio.horarios.minutos", { m }) }))}
                  valor={actual?.minutos ?? 30}
                  alElegir={(v) => cambiar({ minutos: v })}
                />
              </Tarjeta>

              <TituloSeccion>{t("negocio.horarios.anticipacion")}</TituloSeccion>
              <Tarjeta className="mb-8">
                <p className="mb-3 max-w-[65ch] text-tinta-media">
                  {t("negocio.horarios.anticipacionTexto")}
                </p>
                <Elegir
                  opciones={ANTICIPACIONES.map((a) => ({ valor: a.horas, palabra: palabraDeAnticipacion(a.horas, t) }))}
                  valor={actual?.anticipacionHoras ?? 2}
                  alElegir={(v) => cambiar({ anticipacionHoras: v })}
                />
              </Tarjeta>

              <TituloSeccion>{t("negocio.horarios.hasta")}</TituloSeccion>
              <Tarjeta className="mb-8">
                <p className="mb-3 max-w-[65ch] text-tinta-media">
                  {t("negocio.horarios.hastaTexto")}
                </p>
                <Elegir
                  opciones={HORIZONTES.map((x) => ({ valor: x.dias, palabra: palabraDeHorizonte(x.dias, t) }))}
                  valor={actual?.horizonteDias ?? HORIZONTE_DE_FABRICA}
                  alElegir={(v) => cambiar({ horizonteDias: v })}
                />
              </Tarjeta>

              {/* En qué se convierte todo lo de arriba. Es lo único que
                  contesta "¿entonces qué va a ver el cliente?" sin tener que
                  guardar y abrir la otra pantalla. */}
              <TituloSeccion>{t("negocio.horarios.enQueQueda")}</TituloSeccion>
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
                      <Frase
                        texto={t("negocio.horarios.ejemplo", {
                          desde: comoHora(ejemplo.huecos[0]),
                          hasta: comoHora(ejemplo.huecos[ejemplo.huecos.length - 1]),
                        })}
                        partes={{
                          dia: <span className="font-bold text-tinta">{nombreEnFrase(ejemplo.fecha.getDay())}</span>,
                          turnos: (
                            <span className="font-bold text-tinta">
                              {t("negocio.horarios.ejemploTurnos", { n: ejemplo.huecos.length })}
                            </span>
                          ),
                        }}
                      />
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
                    {t("negocio.horarios.ningunTurno")}
                  </p>
                )}
              </Tarjeta>

              {/* El link con el que la gente pide turno. Va acá, abajo de los
                  horarios, porque no tiene sentido repartirlo antes de saber
                  cuándo atendés: lo primero que vería alguien sería una
                  pantalla sin horarios. */}
              {!editando && horariosListos(actual) && (
                <>
                  <TituloSeccion>{t("negocio.horarios.linkTitulo")}</TituloSeccion>
                  <LinkCompartido
                    id="link-agenda"
                    codigo={negocio?.agenda_codigo}
                    ruta="/turnos/"
                    icono="calendario"
                    nombre={negocio?.nombre}
                    compartir={datos.compartirAgenda}
                    dejarDeCompartir={datos.dejarDeCompartirAgenda}
                    textos={textosDelLink(t)}
                  />
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
                      datos.avisarExito(t("negocio.horarios.guardado"));
                      setBorrador(null);
                    }}
                  >
                    {t("negocio.horarios.guardar")}
                  </Boton>
                  <Boton variante="plano" onClick={() => setBorrador(null)}>
                    {t("casos.comun.cancelar")}
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
