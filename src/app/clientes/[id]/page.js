"use client";

// La ficha de un cliente (SCRUM-58, y auditoría de diseño, H7).
//
// Todo lo que trajo, del más reciente al más viejo, y su teléfono a mano. El
// teléfono se corrige acá: antes, uno mal cargado no se podía arreglar en
// ningún lado. Y para ver el historial de alguien que vino cinco veces había
// que buscarlo caso por caso.

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede } from "@/lib/permisos";
import { estaAbierto, pesos } from "@/lib/estados";
import { comoSeIdentifica, mayuscula, vocabulario } from "@/lib/presets";
import { diaDeArgentina, diaEnPalabras, diaLargo, elDia, horaYMinutos } from "@/lib/fechas";
import { bajaDeAvisos, proximaVisita } from "@/lib/recordatorios";
import { telefonoValido } from "@/lib/validaciones";
import { saldoDelCaso } from "@/lib/cobros";
import { lineaDelCaso, subtituloDelCaso, tituloDelCaso } from "@/lib/nombres";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

export default function FichaDeCliente() {
  const { id } = useParams();
  const datos = useDatos();
  const { cargando, clientes, casos, turnos, negocio, pasos, cobros } = datos;
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario?.rol, "cargarDatos");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [tocado, setTocado] = useState(false);
  const [revirtiendo, setRevirtiendo] = useState(false);
  const [errorBaja, setErrorBaja] = useState(null);

  const cliente = clientes.find((c) => c.id === id);
  useTitulo(cliente ? cliente.nombre : "Cliente");

  if (cargando) return <Cargando />;
  if (!cliente) {
    return (
      <Vacio icono="buscar" titulo="No encontramos a ese cliente">
        <Link href="/clientes" className="font-bold text-azul">
          Volver a los clientes
        </Link>
        .
      </Vacio>
    );
  }

  const comoIdent = comoSeIdentifica(negocio?.rubro);
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
  const diaDeVolver = proximaVisita(suyos, diaDeArgentina());
  const proximaVuelta = diaDeVolver && {
    dia: diaDeVolver,
    caso: suyos.find((c) => c.volver_en === diaDeVolver),
  };

  // Si pidió no recibir avisos (R-8a), cuándo y qué quiere decir.
  const baja = bajaDeAvisos({ cliente, rubro: negocio?.rubro });
  const { cita } = vocabulario(negocio?.rubro);

  const proximos = turnos
    .filter((t) => t.cliente_id === cliente.id && t.estado !== "cancelado")
    .filter((t) => new Date(t.empieza_en) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.empieza_en) - new Date(b.empieza_en));

  const errorTelefono =
    tocado && telefono.trim() && !telefonoValido(telefono)
      ? "El teléfono no es válido. Escribilo con característica y sin el 0 ni el 15:"
      : null;

  return (
    <>
      <Link
        href="/clientes"
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        Volver a los clientes
      </Link>

      <h1 className="text-pantalla">{cliente.nombre}</h1>
      <p className="mt-1 mb-8 text-tinta-media">
        {cliente.confirmado === false
          ? "Pidió un turno y todavía no vino."
          : primero
            ? `Cliente desde ${elDia(primero.abierto_en)}.`
            : "Todavía no trajo ningún trabajo."}
      </p>

      <Tarjeta className="mb-12">
        <p className="font-bold text-cuerpo">Teléfono</p>
        {corrigiendo && puedeCargar ? (
          <div className="mt-2 max-w-[360px]">
            <Campo
              id="telefono"
              etiqueta="Teléfono"
              ayuda="Con característica, sin el 0 ni el 15."
              error={errorTelefono}
              ejemplo="341 456 7890"
              inputMode="tel"
              autoComplete="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              onBlur={() => setTocado(true)}
            />
            <div className="flex flex-wrap gap-3">
              <Boton
                icono="check"
                motivo={
                  !telefono.trim()
                    ? "falta el teléfono"
                    : !telefonoValido(telefono)
                      ? "el teléfono no es válido"
                      : null
                }
                onClick={() => {
                  datos.corregirTelefono(cliente.id, telefono.trim());
                  datos.avisarExito(
                    `Listo. El teléfono de ${cliente.nombre} ahora es ${telefono.trim()}.`
                  );
                  setCorrigiendo(false);
                }}
              >
                Guardar el teléfono
              </Boton>
              <Boton variante="plano" onClick={() => setCorrigiendo(false)}>
                Dejarlo como estaba
              </Boton>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {cliente.telefono ? (
              <a
                href={`tel:${cliente.telefono.replace(/\s/g, "")}`}
                className="inline-flex min-h-12 items-center gap-2 text-azul"
              >
                <Icono nombre="telefono" className="size-5" />
                {cliente.telefono}
              </a>
            ) : (
              <p className="text-tinta-media">No tiene teléfono cargado.</p>
            )}
            {puedeCargar && (
              <Boton
                variante="plano"
                icono="nota"
                onClick={() => {
                  setTelefono(cliente.telefono ?? "");
                  setTocado(false);
                  setCorrigiendo(true);
                }}
              >
                {cliente.telefono ? "Corregir el teléfono" : "Cargar el teléfono"}
              </Boton>
            )}
          </div>
        )}

        {/* La baja de avisos (R-8b). No es un error: el cliente ejerció un
            derecho, y la ficha lo informa sin rojo ni ícono de alerta.
            Revertirla es para cuando el cliente pide volver, y el botón lo
            aclara al lado en vez de preguntar "¿está seguro?". */}
        {baja && (
          <div data-baja-de-avisos className="mt-6 max-w-[65ch]">
            <p className="font-bold text-cuerpo">Avisos por WhatsApp</p>
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
                  motivo={revirtiendo ? "guardando" : null}
                  onClick={async () => {
                    setErrorBaja(null);
                    setRevirtiendo(true);
                    const r = await datos.revertirBajaDeAvisos(cliente.id);
                    setRevirtiendo(false);
                    if (!r.ok) return setErrorBaja(r.error);
                    datos.avisarExito(
                      proximos.length
                        ? `Listo. ${cliente.nombre} va a volver a recibir avisos. ${mayuscula(cita.el(2))} que ya tenía no tienen recordatorio: si ${cita.segun("los", "las")} movés, se programa.`
                        : `Listo. ${cliente.nombre} va a volver a recibir avisos.`
                    );
                  }}
                >
                  Volver a mandarle avisos
                </Boton>
                <p className="mt-2 text-apoyo text-tinta-suave">
                  Usalo sólo si el cliente te pidió volver a recibirlos. Queda anotado quién lo hizo.
                </p>
                {errorBaja && (
                  <p role="alert" className="mt-2 flex items-start gap-2 font-bold text-rojo">
                    <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
                    {errorBaja}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {cliente.notas && (
          <>
            <p className="mt-6 font-bold text-cuerpo">Notas</p>
            <p className="mt-1 max-w-[65ch] text-tinta-media">{cliente.notas}</p>
          </>
        )}

        <dl className="mt-6 grid gap-4 @lg:grid-cols-3">
          <div>
            <dt className="text-apoyo text-tinta-suave">Casos</dt>
            <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">
              {suyos.length}
            </dd>
          </div>
          <div>
            <dt className="text-apoyo text-tinta-suave">Sin cerrar</dt>
            <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">
              {abiertos}
            </dd>
          </div>
          <div>
            <dt className="text-apoyo text-tinta-suave">Le cobraste</dt>
            <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">
              {cobrados.length ? pesos(cobradoTotal) : "Nada registrado"}
            </dd>
          </div>
          {debe > 0 && (
            <div>
              <dt className="text-apoyo text-tinta-suave">Te debe</dt>
              <dd className="font-titulo font-extrabold text-subtitulo tabular-nums text-espera">
                {pesos(debe)}
              </dd>
            </div>
          )}
        </dl>
      </Tarjeta>

      {proximos.length > 0 && (
        <>
          <TituloSeccion>Tiene turno</TituloSeccion>
          <ul className="mb-12 overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
            {proximos.map((t) => (
              <li key={t.id} className="border-b border-borde last:border-b-0">
                <Link href="/agenda" className="flex min-h-14 items-center gap-3 px-4 hover:bg-superficie">
                  <Icono nombre="calendario" className="size-5 text-tinta-media" />
                  <span className="flex-1">
                    <span className="font-bold first-letter:uppercase">
                      {diaLargo(t.empieza_en)} a las {horaYMinutos(t.empieza_en)}
                    </span>{" "}
                    · {t.motivo}
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
          <TituloSeccion>Le toca volver</TituloSeccion>
          <Link
            href={`/casos/${proximaVuelta.caso.id}`}
            className="mb-12 flex min-h-14 items-center gap-3 rounded-tarjeta border border-borde bg-tarjeta px-4 hover:bg-superficie"
          >
            <Icono nombre="calendario" className="size-5 text-tinta-media" />
            <span className="flex-1">
              <span className="font-bold">El {diaEnPalabras(proximaVuelta.dia)}</span>{" "}
              · {tituloDelCaso(proximaVuelta.caso)}
            </span>
          </Link>
        </>
      )}

      <TituloSeccion>Lo que trajo</TituloSeccion>
      {suyos.length === 0 ? (
        <Vacio icono="carpeta" titulo="Todavía no hay casos">
          Cuando le abras el primero, aparece acá con los que vengan después.
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
                        {tituloDelCaso(c)}
                        {lineaDelCaso(c) && ` · ${lineaDelCaso(c)}`}
                        {subtituloDelCaso(c) && (
                          <span className="ml-2 font-normal text-apoyo text-tinta-suave">
                            {subtituloDelCaso(c)}
                          </span>
                        )}
                      </p>
                      <p className="text-tinta-media">
                        {c.identificador && `${comoIdent.nombre} ${c.identificador} · `}
                        Abierto {elDia(c.abierto_en)}
                        {c.cobrado != null && ` · Cobrado ${pesos(Number(c.cobrado))}`}
                        {c.estado === "completado" && saldos.get(c.id)?.falta > 0 && (
                          <span className="font-bold text-espera">
                            {` · Falta cobrar ${pesos(saldos.get(c.id).falta)}`}
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
