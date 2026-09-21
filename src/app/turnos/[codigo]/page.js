"use client";

// "Pedir un turno" — la pantalla pública de la agenda.
//
// La abre gente que nunca vio la aplicación, desde un link que el negocio
// puso en su Instagram o mandó por WhatsApp. Sin cuenta, sin instalar nada,
// casi siempre desde el celular.
//
// Es la segunda pantalla pública del sistema y sigue las mismas reglas que la
// de seguimiento: sin navegación, sin nada que lleve adentro del sistema, y
// todo lo que necesita explicación explicado ahí mismo.
//
// LA DECISIÓN DE FORMA:
// Primero el día, después la hora, después los datos. Tres pasos y no un
// formulario entero, porque elegir el horario es lo que la persona vino a
// hacer y pedirle el nombre antes de mostrarle si hay lugar es pedirle que
// trabaje antes de saber si sirve de algo.
//
// Los días van en un calendario de un mes, como el de cualquier aplicación
// de turnos: los días con lugar marcados, los demás tachados. Tocás un día y
// abajo aparecen sólo sus horarios, partidos en mañana y tarde. Antes era una
// tarjeta por día con todos sus horarios, y con tres semanas de agenda la
// pantalla se volvía una lista interminable donde no se encontraba nada.
//
// Los horarios que se ofrecen los calcula src/lib/horarios.js con lo que
// manda la base: los horarios del negocio y los turnos ya tomados. La base
// vuelve a hacer la cuenta al reservar, porque lo que llega del navegador no
// se puede creer.

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { buscarAgenda, reservarTurno } from "@/lib/datos";
import {
  enFranjas,
  huecosLibres,
  mesesConLugar,
  normalizarHorarios,
  semanasDelMes,
} from "@/lib/horarios";
import { preset } from "@/lib/presets";
import { diaPasado } from "@/lib/fechas";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando } from "@/componentes/ui";

const comoHora = (fecha) =>
  `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, "0")}`;

export default function PedirTurno() {
  const { codigo } = useParams();
  const [mirando, setMirando] = useState(true);
  const [agenda, setAgenda] = useState(null);

  // El día que está mirando, como toDateString(). null = el primero que
  // tenga lugar.
  const [dia, setDia] = useState(null);
  // El mes que está mirando: su lugar en la lista de meses con lugar.
  const [cualMes, setCualMes] = useState(0);
  const [elegido, setElegido] = useState(null);
  const datosRef = useRef(null);
  const [motivo, setMotivo] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [problema, setProblema] = useState(null);
  const [listo, setListo] = useState(null);

  useEffect(() => {
    document.title = agenda?.negocio_nombre
      ? `Pedir un turno · ${agenda.negocio_nombre}`
      : "Pedir un turno";
  }, [agenda]);

  const traer = useCallback(async () => {
    const r = await buscarAgenda(codigo);
    setAgenda(r);
    setMirando(false);
  }, [codigo]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await buscarAgenda(codigo);
      if (vivo) {
        setAgenda(r);
        setMirando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [codigo]);

  const hayElegido = Boolean(elegido);
  useEffect(() => {
    if (hayElegido) datosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hayElegido]);

  async function pedir() {
    setProblema(null);
    setGuardando(true);
    const r = await reservarTurno({
      codigo,
      cuando: elegido,
      motivo: motivo.trim(),
      nombre: nombre.trim(),
      telefono: telefono.trim(),
    });
    setGuardando(false);

    if (!r.ok) {
      setProblema(r.motivo);
      // Si el horario se lo ganaron, la lista que está viendo quedó vieja.
      await traer();
      setElegido(null);
      return;
    }

    setListo({ cuando: new Date(r.cuando), motivo: motivo.trim() });
  }

  if (mirando) {
    return (
      <Marco>
        <Cargando filas={2} />
      </Marco>
    );
  }

  if (!agenda?.sirve) {
    return (
      <Marco>
        <Tarjetita titulo="Este link ya no sirve" icono="alerta">
          Puede ser que esté cortado, que se haya copiado de más o que el negocio
          lo haya dado de baja. Pedile uno nuevo a quien te lo mandó.
        </Tarjetita>
      </Marco>
    );
  }

  const horarios = normalizarHorarios(agenda.horarios);

  // Ya reservó: de acá no se sigue a ningún lado. Lo único que queda es la
  // constancia de qué pidió y para cuándo.
  if (listo) {
    return (
      <Marco negocio={agenda.negocio_nombre}>
        <div className="overflow-hidden rounded-tarjeta border-2 border-completo bg-completo-fondo">
          <div className="p-5 sm:p-6">
            <p className="flex items-center gap-2 font-titulo font-extrabold text-seccion text-completo">
              <Icono nombre="listo" className="size-7 shrink-0" />
              Listo, quedaste anotado
            </p>
            <p className="mt-4 font-titulo font-extrabold text-ident first-letter:uppercase">
              {diaPasado(listo.cuando)} a las {comoHora(listo.cuando)}
            </p>
            <p className="mt-1 text-tinta-media">{listo.motivo}</p>
            <p className="mt-4 max-w-[65ch] text-tinta-media">
              {agenda.negocio_nombre} ya lo ve en su agenda. Si no podés venir,
              avisales así le dan el lugar a otro.
            </p>
            {agenda.negocio_telefono && (
              <p className="mt-2 text-tinta-media">
                Su teléfono es{" "}
                <a
                  href={`tel:${agenda.negocio_telefono.replace(/\s/g, "")}`}
                  className="font-bold text-azul"
                >
                  {agenda.negocio_telefono}
                </a>
                .
              </p>
            )}
          </div>
        </div>
      </Marco>
    );
  }

  if (!horarios) {
    return (
      <Marco negocio={agenda.negocio_nombre}>
        <Tarjetita titulo="Todavía no hay horarios publicados" icono="reloj">
          {agenda.negocio_nombre} todavía no cargó los días y horas en los que
          atiende, así que por acá no se puede pedir turno. Escribiles o llamalos
          como venías haciendo.
        </Tarjetita>
      </Marco>
    );
  }

  const dias = huecosLibres({
    horarios,
    turnos: (agenda.ocupados ?? []).map((o) => ({ ...o, estado: "agendado" })),
    dias: 21,
  });

  const meses = mesesConLugar(dias);
  const posMes = Math.max(0, Math.min(cualMes, meses.length - 1));
  const mes = meses[posMes];
  const delMes = mes
    ? dias.filter((d) => d.fecha.getFullYear() === mes.anio && d.fecha.getMonth() === mes.mes)
    : [];
  // Si el día elegido no es de este mes, se muestra el primero con lugar del
  // mes: al pasar de mes siempre hay algo abajo, nunca una tarjeta vacía.
  const delDia = delMes.find((d) => d.fecha.toDateString() === dia) ?? delMes[0];
  const conLugar = new Set(dias.map((d) => d.fecha.toDateString()));
  const franjas = delDia ? enFranjas(delDia.huecos) : [];

  const motivos = preset(agenda.rubro).motivos;
  const faltan = !elegido
    ? "elegí un horario"
    : !motivo.trim()
      ? "contanos para qué venís"
      : !nombre.trim()
        ? "falta tu nombre"
        : null;

  return (
    <Marco negocio={agenda.negocio_nombre}>
      <h1 className="text-ident">Pedir un turno</h1>
      <p className="mt-1 max-w-[65ch] text-tinta-media">
        Elegí el día y la hora que te queden bien. Te anotás acá mismo, sin
        llamar y sin crear ninguna cuenta.
      </p>

      {problema && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-campo bg-espera-fondo p-4 font-bold text-espera"
        >
          <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
          <span>{problema}</span>
        </p>
      )}

      {dias.length === 0 ? (
        <div className="mt-6">
          <Tarjetita titulo="No queda ningún horario libre" icono="reloj">
            Por ahora {agenda.negocio_nombre} no tiene lugar en las próximas tres
            semanas. Probá más adelante o escribiles directamente.
          </Tarjetita>
        </div>
      ) : (
        <>
          <h2 className="mt-8 mb-3 text-seccion">Qué día</h2>
          <Calendario
            mes={mes}
            antes={meses[posMes - 1]}
            despues={meses[posMes + 1]}
            onMes={(paso) => {
              setCualMes(posMes + paso);
              setElegido(null);
            }}
            conLugar={conLugar}
            ultimo={dias[dias.length - 1].fecha}
            puesto={delDia?.fecha.toDateString()}
            onDia={(clave) => {
              if (clave !== delDia?.fecha.toDateString()) setElegido(null);
              setDia(clave);
            }}
          />

          <div className="mt-6 rounded-tarjeta border border-borde bg-tarjeta p-4 sm:p-5">
            <h2 className="text-subtitulo font-bold first-letter:uppercase">
              {diaPasado(delDia.fecha)}
            </h2>
            <p className="text-tinta-media">
              {delDia.huecos.length === 1
                ? "Queda 1 horario libre."
                : `Quedan ${delDia.huecos.length} horarios libres.`}
            </p>

            {franjas.map((f) => (
              <div key={f.nombre} className="mt-4">
                <h3 className="mb-2 font-bold text-tinta-media">{f.nombre}</h3>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {f.huecos.map((h) => {
                    const puesto = elegido && h.getTime() === new Date(elegido).getTime();
                    return (
                      <li key={h.getTime()}>
                        <button
                          type="button"
                          aria-pressed={Boolean(puesto)}
                          aria-label={`${diaPasado(delDia.fecha)} a las ${comoHora(h)}`}
                          onClick={() => {
                            setProblema(null);
                            setElegido(h.toISOString());
                          }}
                          className={[
                            "flex min-h-12 w-full cursor-pointer items-center justify-center gap-1.5 rounded-campo border-2 font-bold text-cuerpo tabular-nums",
                            puesto
                              ? "border-azul bg-azul-claro text-azul"
                              : "border-borde-fuerte bg-tarjeta text-tinta hover:bg-superficie",
                          ].join(" ")}
                        >
                          {puesto && <Icono nombre="listo" className="size-5 shrink-0" />}
                          {comoHora(h)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Los datos recién cuando ya eligió: pedirle el nombre antes de que
              sepa si hay lugar es pedirle que trabaje sin saber si sirve. */}
          {elegido && (
            <>
              <h2 ref={datosRef} className="mt-10 mb-1 scroll-mt-4 text-seccion">
                Tus datos
              </h2>
              <p className="mb-4 max-w-[65ch] text-tinta-media">
                Pediste el turno para{" "}
                <span className="font-bold text-tinta">
                  {diaPasado(new Date(elegido)).toLowerCase()} a las{" "}
                  {comoHora(new Date(elegido))}
                </span>
                . Son {horarios.minutos} minutos.
              </p>

              <div className="rounded-tarjeta border border-borde bg-tarjeta p-4 sm:p-5">
                <Campo
                  id="motivo"
                  etiqueta="¿Para qué venís?"
                  ayuda="Con tus palabras. Sirve para que sepan qué preparar."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  autoComplete="off"
                />
                <div className="-mt-3 mb-6">
                  <ul className="flex flex-wrap gap-2">
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
                </div>

                <Campo
                  id="nombre"
                  etiqueta="Tu nombre"
                  ayuda="Para saber quién viene."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name"
                />
                <Campo
                  id="telefono"
                  etiqueta="Tu teléfono"
                  ayuda="Opcional, pero es por donde te van a avisar si pasa algo."
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />

                <Boton
                  variante="principal"
                  icono="calendario"
                  className="min-h-14 w-full sm:min-h-12 sm:w-auto"
                  motivo={guardando ? "anotándote" : faltan}
                  onClick={pedir}
                >
                  Pedir el turno
                </Boton>
              </div>
            </>
          )}
        </>
      )}
    </Marco>
  );
}

const DIAS_DE_LA_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// El calendario de un mes. Los días con lugar son botones, marcados; los
// demás van tachados y no se tocan. Abajo, en palabras, qué quiere decir
// cada cosa: el tachado solo no alcanza para saber por qué no se puede.
function Calendario({ mes, antes, despues, onMes, conLugar, puesto, onDia, ultimo }) {
  // "Octubre 2026", sin el "de": con el "de" no entra en una línea al lado
  // de las flechas.
  const titulo =
    new Intl.DateTimeFormat("es-AR", { month: "long" }).format(new Date(mes.anio, mes.mes, 1)) +
    " " +
    mes.anio;

  return (
    <div className="rounded-tarjeta border border-borde bg-tarjeta px-2 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-2 pl-2">
        <p className="font-titulo font-extrabold text-subtitulo first-letter:uppercase">
          {titulo}
        </p>
        {/* Las flechas llevan el nombre del mes al que van: la cartilla no
            deja botones que sean sólo un ícono. Una flecha que no lleva a
            ningún mes con lugar no se muestra; queda el hueco, para que la
            otra no salte de lugar. */}
        <div className="flex gap-1">
          {antes ? (
            <button
              type="button"
              aria-label={`Ver ${MES_LARGO[antes.mes]}`}
              onClick={() => onMes(-1)}
              className="flex min-h-12 min-w-16 cursor-pointer items-center justify-center gap-0.5 rounded-campo px-2 font-bold text-azul hover:bg-azul-claro"
            >
              <Icono nombre="flecha-izq" className="size-5 shrink-0" />
              {MES_CORTO[antes.mes]}
            </button>
          ) : (
            <span className="min-w-16" aria-hidden="true" />
          )}
          {despues ? (
            <button
              type="button"
              aria-label={`Ver ${MES_LARGO[despues.mes]}`}
              onClick={() => onMes(1)}
              className="flex min-h-12 min-w-16 cursor-pointer items-center justify-center gap-0.5 rounded-campo px-2 font-bold text-azul hover:bg-azul-claro"
            >
              {MES_CORTO[despues.mes]}
              <Icono nombre="flecha-der" className="size-5 shrink-0" />
            </button>
          ) : (
            <span className="min-w-16" aria-hidden="true" />
          )}
        </div>
      </div>

      <table className="w-full table-fixed border-collapse text-center">
        <thead>
          <tr>
            {DIAS_DE_LA_SEMANA.map((d) => (
              <th key={d} scope="col" className="pb-1 text-apoyo font-normal text-tinta-suave">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanasDelMes(mes.anio, mes.mes).map((semana, i) => (
            <tr key={i}>
              {semana.map((fecha, j) => {
                if (!fecha) return <td key={j} />;
                const clave = fecha.toDateString();
                const numero = fecha.getDate();

                if (!conLugar.has(clave)) {
                  return (
                    <td key={j} className="py-0.5">
                      <span
                        className="mx-auto flex size-11 items-center justify-center text-cuerpo tabular-nums text-tinta-suave line-through"
                        aria-label={`${numero}, sin lugar`}
                      >
                        {numero}
                      </span>
                    </td>
                  );
                }

                const esEste = clave === puesto;
                return (
                  <td key={j} className="py-0.5">
                    <button
                      type="button"
                      aria-pressed={esEste}
                      aria-label={diaPasado(fecha)}
                      onClick={() => onDia(clave)}
                      className={[
                        "mx-auto flex size-12 cursor-pointer items-center justify-center rounded-full font-bold text-cuerpo tabular-nums",
                        esEste
                          ? "bg-azul text-white"
                          : "bg-azul-claro text-azul hover:ring-2 hover:ring-azul",
                      ].join(" ")}
                    >
                      {numero}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 pl-2 text-apoyo text-tinta-media">
        <span className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-full bg-azul-claro ring-1 ring-azul" />
          Hay lugar
        </span>
        <span className="flex items-center gap-2">
          <span className="text-tinta-suave line-through">15</span>
          No se puede pedir
        </span>
      </p>
      {/* Sin esto, las dos últimas semanas tachadas parecen un negocio
          lleno, cuando lo que pasa es que todavía no se dan turnos para
          esos días. */}
      <p className="mt-1 pl-2 text-apoyo text-tinta-media">
        Se dan turnos hasta el {diaPasado(ultimo).toLowerCase()}.
      </p>
    </div>
  );
}

function Tarjetita({ titulo, icono, children }) {
  return (
    <div className="rounded-tarjeta border border-borde bg-tarjeta p-6">
      <p className="flex items-start gap-3 font-titulo font-extrabold text-seccion">
        <Icono nombre={icono} className="mt-1 size-7 shrink-0 text-espera" />
        <span>{titulo}</span>
      </p>
      <p className="mt-3 max-w-[65ch] text-tinta-media">{children}</p>
    </div>
  );
}

// El mismo marco que la pantalla de seguimiento: a sangre completa, sin la
// navegación del sistema, columna angosta porque se abre en un celular.
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
              {negocio ?? "Pedir un turno"}
            </p>
            <p className="text-apoyo text-tinta-suave">Pedir un turno</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
