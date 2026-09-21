"use client";

// "Ver cómo va un caso" (cartilla, sección 08).
//
// La abren el encargado y el equipo muchas veces por día, casi siempre desde
// el celular. Identificador, estado y "qué falta" tienen que entrar en la
// primera pantalla, sin scrollear.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { useTitulo } from "@/lib/useTitulo";
import {
  AL_PASAR_A,
  ESTADOS,
  avanceDePasos,
  estaAbierto,
  pesos,
  queFalta,
  quedoTrabajoPendiente,
  quienLoTieneEnPalabras,
  sePuedeMarcarHecho,
} from "@/lib/estados";
import { cuando, cuantoHace, haceCuanto } from "@/lib/fechas";
import { queFaltaPara, comoSeIdentifica, etiquetaEstado } from "@/lib/presets";
import { cobroValido, montoCobrado } from "@/lib/validaciones";
import { cobrosConLoDeAntes, cobrosDelCaso, cuentaDelCaso, descuentoDelCaso } from "@/lib/cobros";
import SelectorEstado from "@/componentes/SelectorEstado";
import SeccionCobros, { ElegirMedio, fraseDeLaCuenta } from "@/componentes/Cobros";
import Icono from "@/componentes/Icono";
import {
  Boton,
  Campo,
  Cargando,
  ErrorGeneral,
  Tarjeta,
  TituloSeccion,
  Vacio,
} from "@/componentes/ui";
import {
  linkDeSeguimiento,
  linkDeWhatsApp,
  mensajeDeLoHecho,
} from "@/lib/seguimiento";

const EVENTOS_A_LA_VISTA = 5;

export default function VerCaso() {
  const { id } = useParams();
  const datos = useDatos();
  const { cargando, casos, clientes, empleados, pasos, eventos, insumos, negocio } = datos;
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario?.rol, "cargarDatos");
  const [eligiendo, setEligiendo] = useState(false);
  // Identificador del rubro y notas sueltas (SCRUM-51/52). El diagnóstico
  // vive ahora en la pantalla de los pasos.
  const [editandoIdent, setEditandoIdent] = useState(false);
  const [identificador, setIdentificador] = useState("");
  const [anotando, setAnotando] = useState(false);
  const [historialEntero, setHistorialEntero] = useState(false);
  const [nota, setNota] = useState("");
  // Entregar abre el cobro en vez de cerrar de una (SCRUM-74). El monto no
  // arranca editable: confirmar lo aprobado es lo que pasa casi siempre, y
  // cambiarlo pide un toque más y su propio aviso.
  const [entregando, setEntregando] = useState(false);
  const [cambiandoCobro, setCambiandoCobro] = useState(false);
  // Lo que la base contestó cuando no se pudo marcar un paso.
  const [errorPaso, setErrorPaso] = useState(null);
  const [cobro, setCobro] = useState("");
  // Cómo pagó lo que se cobra al entregar, y lo que contestó la base si no
  // se pudo anotar (025).
  const [medioEntrega, setMedioEntrega] = useState("efectivo");
  const [errorEntrega, setErrorEntrega] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  // Si cobra menos de lo que falta: ¿el resto lo paga después, o no se le
  // cobra? Sin esta pregunta, todo lo que no se cobra queda como deuda.
  const [elResto, setElResto] = useState("despues");

  const caso = casos.find((c) => c.id === id);
  useTitulo(caso ? `Caso ${caso.numero}` : "Caso");

  if (cargando) return <Cargando />;
  if (!caso) {
    return (
      <Vacio icono="buscar" titulo="No encontramos ese caso">
        Puede que lo hayan borrado. <Link href="/casos" className="font-bold text-azul">Volver a los casos</Link>.
      </Vacio>
    );
  }

  const cliente = clientes.find((c) => c.id === caso.cliente_id);
  const mios = pasos.filter((p) => p.caso_id === caso.id).sort((a, b) => a.orden - b.orden);
  const historial = eventos
    .filter((e) => e.caso_id === caso.id)
    .sort((a, b) => new Date(b.ocurrido_en) - new Date(a.ocurrido_en));
  const insumosDelCaso = insumos.filter((i) => i.caso_id === caso.id);

  const aprobado = mios.filter((p) => p.estado === "aprobado").reduce((s, p) => s + Number(p.monto), 0);
  const esperando = mios.filter((p) => p.estado === "esperando");
  const barra = ESTADOS[caso.estado].barra;
  const comoIdent = comoSeIdentifica(negocio?.rubro);
  const falta = queFalta(caso, { rubro: negocio?.rubro, pasos, insumos, cliente });
  const aprobados = mios.filter((p) => p.estado === "aprobado");
  const avance = avanceDePasos(mios);
  // Los cobros de este caso y la cuenta contra lo aprobado (025). Un caso
  // puede tener varios: una seña y el resto.
  const cobrosDeEste = cobrosConLoDeAntes(cobrosDelCaso(datos.cobros ?? [], caso.id), caso);
  const descuento = descuentoDelCaso(caso, aprobado);
  const cuenta = cuentaDelCaso({ aprobado, cobros: cobrosDeEste, descuento });

  // Marcar el propio trabajo no es mover plata, así que el técnico también
  // puede — pero sólo sobre un caso que tiene asignado, que es la misma
  // frontera que ya usa la tabla "caso". La base hace cumplir las dos reglas
  // (021_paso_hecho.sql); esto es para no ofrecer un botón que va a fallar.
  const miFicha = empleados.find((e) => e.usuario_id === usuario?.id) ?? null;
  const puedoMarcar =
    puedeCargar || Boolean(miFicha && caso.responsable_id === miFicha.id);

  // Un caso cerrado es el registro de lo que pasó, no un borrador: no se le
  // cambian el diagnóstico ni los pasos sin volver a abrirlo primero. No queda
  // nada trabado, porque volver a abrirlo está a un toque acá abajo.
  const abierto = estaAbierto(caso);
  const sePuedeEditar = puedeCargar && abierto;

  return (
    <>
      <Link href="/casos" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
        <Icono nombre="volver" />
        Volver a los casos
      </Link>

      {/* Lo importante, sin scrollear: identificador, estado y qué falta.

          La tarjeta NO lleva overflow-hidden: el desplegable del estado sale
          de sus bordes y quedaba cortado al medio. El recorte estaba sólo
          para que la barra de color respetara las esquinas, así que la barra
          se redondea sola y el problema desaparece de raíz —si no, cualquier
          menú que se abra acá adentro vuelve a cortarse. */}
      <div className="rounded-tarjeta border border-borde bg-tarjeta">
        <div className={`h-1.5 w-full rounded-t-tarjeta ${barra}`} aria-hidden="true" />
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-ident">
                Caso {caso.numero}
                {caso.identificador && (
                  <span className="text-tinta-media"> · {caso.identificador}</span>
                )}
              </h1>
              <p className="mt-1 text-tinta-media">
                {caso.servicio}
                {cliente && ` · ${cliente.nombre}`}
              </p>
            </div>
            {/* El estado se cambia donde se lee. Antes había que leerlo acá
                arriba, bajar hasta "Cómo sigue" y buscar cuál de tres botones
                correspondía; ahora se toca el chip y se elige.

                Sólo mueve el caso entre los estados abiertos: entregar abre
                el formulario de cobro y tiene su botón, y de un caso cerrado
                se sale por "Volver a abrirlo". */}
            <SelectorEstado
              estado={caso.estado}
              rubro={negocio?.rubro}
              sePuedeCambiar={sePuedeEditar}
              alElegir={(nuevo, dice) =>
                datos.cambiarEstado(
                  caso.id,
                  nuevo,
                  queFaltaPara(negocio?.rubro, nuevo),
                  dice
                )
              }
            />
          </div>

          <p className="mt-4 text-cuerpo">
            {/* Derivado de los pasos y los insumos, no de lo guardado: así
                dice el próximo paso y no repite el chip de arriba. Se fue
                también la aclaración entre paréntesis del rubro: con un texto
                específico pasó a ser ruido, y en control final las dos salían
                del mismo lugar y se leía "Control antes de entregar (Control
                antes de entregar)". */}
            <span className="font-bold">Qué falta:</span> {falta}
          </p>

          {/* Los datos del caso, cada uno con su nombre arriba y su valor
              abajo. Antes eran frases sueltas con un ícono adelante, en tres
              columnas, y lo que se abría —elegir a quién asignarle— crecía
              adentro de su celda: la grilla se deformaba, los nombres del
              equipo quedaban flotando en el medio de la nada y los otros dos
              datos se iban al costado.

              Ahora la lista no se mueve: lo que se abre va abajo, a lo ancho
              de la tarjeta. Y el identificador dejó de ser un enlace suelto
              perdido al final para ser un dato más, en el lugar donde alguien
              lo va a buscar. */}
          <dl className="mt-5 grid gap-x-6 gap-y-4 @2xl:grid-cols-2">
            <Dato icono="persona" que="Quién lo tiene">
              {quienLoTieneEnPalabras(caso, empleados)}
              {sePuedeEditar && (
                <div className="mt-1 -ml-3">
                  <Boton
                    variante="plano"
                    icono="persona-mas"
                    onClick={() => setEligiendo((v) => !v)}
                  >
                    {caso.responsable_id ? "Cambiar quién lo atiende" : "Asignar a alguien"}
                  </Boton>
                </div>
              )}
            </Dato>

            <Dato icono="nota" que={comoIdent.nombre}>
              {caso.identificador || (
                <span className="text-tinta-suave">Sin cargar</span>
              )}
              {sePuedeEditar && !editandoIdent && (
                <div className="mt-1 -ml-3">
                  <Boton
                    variante="plano"
                    icono="nota"
                    onClick={() => {
                      setIdentificador(caso.identificador ?? "");
                      setEditandoIdent(true);
                    }}
                  >
                    {caso.identificador ? "Corregir" : `Cargar ${comoIdent.enFrase}`}
                  </Boton>
                </div>
              )}
            </Dato>

            <Dato icono="reloj" que="Cuándo entró">
              {haceCuanto(caso.abierto_en)}
            </Dato>

            {/* El teléfono es lo único de esta lista que se toca, y llamar al
                cliente es lo que se hace apurado y con una mano: el área
                táctil es todo el renglón y no sólo los dígitos. */}
            {cliente?.telefono && (
              <Dato icono="telefono" que="Teléfono">
                <a
                  href={`tel:${cliente.telefono.replace(/\s/g, "")}`}
                  className="-mx-2 inline-flex min-h-12 items-center rounded-campo px-2 font-bold text-azul hover:bg-azul-claro"
                >
                  {cliente.telefono}
                </a>
              </Dato>
            )}

            {/* Compartido o no, sin botones: los controles viven en la
                pantalla de los pasos, que es donde está lo que se manda. Acá
                alcanza con saber si el cliente ya lo miró, que es lo que dice
                si hace falta llamarlo. */}
            {caso.seguimiento_codigo && (
              <Dato icono="sobre" que="El link del cliente">
                {caso.seguimiento_visto_en
                  ? `Lo abrió ${cuantoHace(caso.seguimiento_visto_en)}`
                  : "Compartido, todavía no lo abrió"}
              </Dato>
            )}
          </dl>

          {/* Lo que se abre, abajo y a lo ancho. Adentro de la grilla
              deformaba la fila entera. */}
          {eligiendo && sePuedeEditar && (
            <div className="mt-4 rounded-tarjeta bg-superficie p-4">
              <p className="font-bold text-cuerpo">¿Quién lo va a atender?</p>
              {empleados.length === 0 ? (
                <p className="mt-1 max-w-[65ch] text-tinta-media">
                  Todavía no hay nadie cargado en el equipo. Se agrega desde{" "}
                  <Link href="/equipo" className="font-bold text-azul">
                    Equipo
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <p className="mt-1 max-w-[65ch] text-tinta-media">
                    Al elegir a alguien, el caso pasa a{" "}
                    {etiquetaEstado(negocio?.rubro, "en_proceso").toLowerCase()}.
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2.5">
                    {empleados.map((e) => (
                      <li key={e.id}>
                        <Boton
                          variante={e.id === caso.responsable_id ? "borde" : "neutro"}
                          icono="persona"
                          onClick={() => {
                            datos.asignarResponsable(caso.id, e.id);
                            datos.avisarExito(`Listo. El caso ${caso.numero} lo atiende ${e.nombre}.`);
                            setEligiendo(false);
                          }}
                        >
                          {e.nombre}
                        </Boton>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-3">
                <Boton variante="plano" onClick={() => setEligiendo(false)}>
                  Dejarlo como está
                </Boton>
              </div>
            </div>
          )}

          {/* El identificador —la patente, el DNI, el número de serie— es
              cómo se reconoce el caso, no un diagnóstico: vive acá arriba, al
              lado del número, y se carga y se corrige acá (auditoría, H2). */}
          {editandoIdent && sePuedeEditar && (
            <div className="mt-4 max-w-[320px]">
              <Campo
                id="identificador"
                etiqueta={comoIdent.nombre}
                ayuda={`Con esto lo vas a poder buscar después. Ejemplo: ${comoIdent.ejemplo}.`}
                autoComplete="off"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <Boton
                  icono="check"
                  motivo={!identificador.trim() ? `falta ${comoIdent.enFrase}` : null}
                  onClick={() => {
                    datos.ponerIdentificador(caso.id, identificador.trim());
                    // "Cambiamos" y no "quedó corregida": el artículo de
                    // enFrase cambia con el rubro y el adjetivo no concuerda
                    // ("corregida la patente", pero "corregido el DNI").
                    datos.avisarExito(
                      caso.identificador
                        ? `Listo. Cambiamos ${comoIdent.enFrase} del caso ${caso.numero}.`
                        : `Listo. El caso ${caso.numero} ya tiene ${comoIdent.enFrase}.`
                    );
                    setEditandoIdent(false);
                  }}
                >
                  Guardar
                </Boton>
                <Boton variante="plano" onClick={() => setEditandoIdent(false)}>
                  Dejarlo
                </Boton>
              </div>
            </div>
          )}

          {/* Un único botón azul: el que casi siempre se va a tocar.
              Aparece siempre, también sin pasos: si no, a un caso recién
              abierto no habría por dónde armarle el presupuesto. */}
          <Link href={`/casos/${caso.id}/pasos`} className="mt-6 block sm:inline-block">
            <span className="flex min-h-14 items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado sm:min-h-12">
              <Icono nombre="nota" />
              {esperando.length > 0 && abierto
                ? `Ver ${esperando.length === 1 ? "el paso" : `los ${esperando.length} pasos`} a aprobar`
                : mios.length > 0
                  ? "Ver los pasos del caso"
                  : sePuedeEditar
                    ? "Armar el presupuesto"
                    : "Ver el presupuesto"}
            </span>
          </Link>

          {/* Lo que el cliente ya aprobó, que es la lista de trabajo del
              técnico. Estaba un toque más adentro, en la pantalla de los
              pasos, y es lo primero que se viene a mirar. */}
          {aprobados.length > 0 && (
            <div className="mt-6">
              <p className="font-bold text-cuerpo">
                Lo que hay que hacer{" "}
                <span className="font-normal text-apoyo text-tinta-suave">
                  {avance.hechos} de {avance.aprobados} hechos
                </span>
              </p>
              <ul className="mt-2 divide-y divide-borde rounded-campo border border-borde">
                {aprobados.map((p) => {
                  const hecho = Boolean(p.hecho_en);
                  const sePuede = puedoMarcar && sePuedeMarcarHecho(p, caso);

                  /* Hecho y pendiente se distinguen por tres cosas y no sólo
                     por el color: el ícono cambia de círculo vacío a tilde,
                     aparece la palabra "Hecho" y el nombre se pone gris. En
                     blanco y negro se sigue leyendo (cartilla, 02). */
                  const adentro = (
                    <>
                      <span
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                          hecho ? "bg-completo-fondo text-completo" : "bg-superficie text-tinta-suave"
                        }`}
                      >
                        <Icono nombre={hecho ? "listo" : "circulo"} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block font-bold ${hecho ? "text-tinta-suave line-through" : ""}`}
                        >
                          {p.nombre}
                        </span>
                        {hecho ? (
                          <span className="block text-apoyo font-bold text-completo">Hecho</span>
                        ) : (
                          p.descripcion && (
                            <span className="block text-apoyo text-tinta-suave">
                              {p.descripcion}
                            </span>
                          )
                        )}
                      </span>
                      <span className="shrink-0 font-bold tabular-nums">{pesos(p.monto)}</span>
                    </>
                  );

                  return (
                    <li key={p.id}>
                      {sePuede ? (
                        <button
                          type="button"
                          aria-pressed={hecho}
                          aria-label={
                            hecho
                              ? `«${p.nombre}» está hecho. Tocá para desmarcarlo.`
                              : `Marcar «${p.nombre}» como hecho.`
                          }
                          onClick={async () => {
                            const r = await datos.marcarPasoHecho(p.id, !hecho);
                            if (!r.ok) return setErrorPaso(r.error);
                            setErrorPaso(null);
                            if (r.cambio && !hecho) datos.avisarExito(`Listo. «${p.nombre}» quedó hecho.`);
                          }}
                          className="flex w-full min-h-12 cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-superficie"
                        >
                          {adentro}
                        </button>
                      ) : (
                        <div className="flex items-start gap-3 px-4 py-3">{adentro}</div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {errorPaso && (
                <div className="mt-3">
                  <ErrorGeneral>{errorPaso}</ErrorGeneral>
                </div>
              )}

              {/* El camino de vuelta (flujo, punto 10). Se controló todo y
                  justo ahí apareció otra cosa: se sumó un paso, el cliente
                  lo aprobó, y el caso quedó diciendo "control final" con
                  trabajo nuevo adentro.

                  Acá se avisa y se ofrece volver, no se corrige solo: puede
                  ser que el paso nuevo se haga después de entregar, y eso lo
                  decide quien está mirando. Cuando el que aprueba es el
                  cliente desde el link no hay nadie mirando, y ahí sí el
                  caso vuelve solo (022_el_cliente_destraba.sql). */}
              {quedoTrabajoPendiente(caso, mios) && abierto && (
                <div className="mt-3 rounded-tarjeta border-2 border-espera bg-espera-fondo p-4">
                  <p className="flex items-start gap-2 font-bold text-cuerpo text-espera">
                    <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                    <span>Quedó trabajo sin hacer</span>
                  </p>
                  <p className="mt-1 max-w-[65ch] text-tinta-media">
                    El caso figura en {etiquetaEstado(negocio?.rubro, "revision_final")}, pero{" "}
                    {avance.faltan === 1
                      ? "hay un paso aprobado sin hacer"
                      : `hay ${avance.faltan} pasos aprobados sin hacer`}
                    . El control se hizo sobre otro trabajo.
                  </p>
                  <div className="mt-4">
                    <Boton
                      icono="llave"
                      onClick={() =>
                        datos.cambiarEstado(
                          caso.id,
                          "en_proceso",
                          queFaltaPara(negocio?.rubro, "en_proceso"),
                          AL_PASAR_A.en_proceso
                        )
                      }
                    >
                      Volverlo a {etiquetaEstado(negocio?.rubro, "en_proceso")}
                    </Boton>
                  </div>
                </div>
              )}

              {/* Lo ofrece, no lo hace solo: terminar el trabajo y decidir que
                  está para controlar son dos cosas, y la segunda la decide
                  una persona. */}
              {avance.todoHecho && abierto && caso.estado !== "revision_final" && (
                <div className="mt-3 rounded-tarjeta bg-superficie p-4">
                  <p className="font-bold text-cuerpo">Terminaste todo lo aprobado</p>
                  <p className="mt-1 max-w-[65ch] text-tinta-media">
                    Los {avance.aprobados} pasos están hechos. Si ya está para controlar
                    antes de entregar, pasalo a {etiquetaEstado(negocio?.rubro, "revision_final")}.
                  </p>
                  <div className="mt-4">
                    <Boton
                      icono="nota"
                      onClick={() =>
                        datos.cambiarEstado(
                          caso.id,
                          "revision_final",
                          queFaltaPara(negocio?.rubro, "revision_final"),
                          AL_PASAR_A.revision_final
                        )
                      }
                    >
                      Pasarlo a {etiquetaEstado(negocio?.rubro, "revision_final")}
                    </Boton>
                  </div>
                </div>
              )}
            </div>
          )}

          {mios.length > 0 && (
            <p className="mt-3 text-tinta-media">
              Aprobado hasta ahora <span className="font-bold text-tinta">{pesos(aprobado)}</span>.
            </p>
          )}

          {/* Se compara con != null y no con un if a secas: cobrar cero es un
              dato, y `0` a secas se leería como "no hay nada que mostrar".
              El Number() es porque la base devuelve numeric como texto. */}
          {caso.cobrado != null && (
            <p className="mt-1 text-tinta-media">
              Cobrado{" "}
              <span className="font-bold text-tinta">{pesos(Number(caso.cobrado))}</span>
              {/* La guarda va sobre la fecha y no sobre cuando(): cuando(null)
                  devuelve el 1 de enero de 1970 y cuando(undefined) explota. */}
              {caso.cobrado_en ? ` · ${cuando(caso.cobrado_en)}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Lo que queda acá NO son cambios de estado: esos se hacen desde el
          desplegable del chip, arriba, donde el estado se lee.

          Marcar que un insumo llegó es una acción sobre el insumo —cambia su
          estado, no el del caso— y por eso sobrevive a la desaparición de
          "Cómo sigue". Antes estaba mezclada con los pasajes y parecía una
          más del montón. */}
      {abierto && insumosDelCaso.some((i) => i.estado !== "en_stock") && (
        <div className="mt-12 flex flex-wrap items-start gap-3">
          {insumosDelCaso
            .filter((i) => i.estado !== "en_stock")
            .map((i) => (
              <Boton key={i.id} icono="camion" onClick={() => datos.marcarInsumoLlegado(i.id)}>
                Marcar que llegó {i.nombre.toLowerCase()}
              </Boton>
            ))}
        </div>
      )}

      {/* Contarle al cliente que ya está (flujo, punto 9). Va antes de
          "Terminar el caso" porque es lo que se hace justo antes: primero se
          le avisa, después viene a buscarlo y recién ahí se entrega. */}
      {/* Lo que se cobró y lo que falta. Va antes de avisarle y de
          entregar porque es lo que se mira justo antes: si dejó una seña,
          cuánto le queda por pagar. */}
      <SeccionCobros
        caso={caso}
        aprobado={aprobado}
        cobros={cobrosDeEste}
        descuento={descuento}
        puedeCargar={puedeCargar}
        datos={datos}
      />

      {puedeCargar && (caso.estado === "revision_final" || caso.estado === "completado") && (
        <AvisarleQueEstaListo
          caso={caso}
          cliente={cliente}
          negocio={negocio}
          datos={datos}
          aprobados={aprobados}
        />
      )}

      {/* Cerrar el caso y volver a abrirlo: las dos puntas de lo mismo, en
          el mismo lugar de la pantalla y con el mismo peso.

          Van después de "avisarle que ya está" porque ese es el orden en que
          pasa: primero se le avisa, después viene a buscarlo, y recién ahí se
          entrega. Antes estaban antes, y encima con una pinta distinta de la
          de todas las demás secciones: un título suelto con una línea arriba
          en vez de la tarjeta con título que usa el resto. */}
      {abierto ? (
        <>
          <TituloSeccion className="mt-12">Terminar el caso</TituloSeccion>
          <Tarjeta>
            {/* Cerrar se puede desde cualquier estado abierto, no sólo después
                del control final: un trabajo puede terminarse antes de lo
                previsto —el cliente lo pasa a buscar, no tenía nada— y obligar
                a caminar toda la cadena para reflejarlo sería mentirle al
                estado. El botón dice lo que hace: entrega Y cierra (cartilla,
                sección 06). Va destacado sólo cuando es lo que sigue. */}
            {!entregando ? (
              <>
                <p className="max-w-[65ch] text-tinta-media">
                  Se lo entregás {cliente?.nombre ? `a ${cliente.nombre.split(" ")[0]}` : "al cliente"},
                  anotás lo que te pagó y el caso queda cerrado. Si te paga después,
                  queda anotado lo que falta cobrar. Mientras esté cerrado no se le
                  tocan los pasos ni el diagnóstico.
                </p>
                <div className="mt-4">
                  <Boton
                    variante={caso.estado === "revision_final" ? "borde" : "neutro"}
                    icono="listo"
                    onClick={() => {
                      // Viene precargado con lo que falta cobrar, que es lo
                      // que casi siempre se cobra: lo aprobado, menos la seña
                      // si dejó una.
                      setCobro(cuenta.falta > 0 ? String(cuenta.falta) : "");
                      setCambiandoCobro(cuenta.falta === 0 && cobrosDeEste.length === 0);
                      setMedioEntrega("efectivo");
                      setElResto("despues");
                      setErrorEntrega(null);
                      setEntregando(true);
                    }}
                  >
                    Entregar y cerrar
                  </Boton>
                </div>
              </>
            ) : (
              /* El cobro se registra acá y no en una pantalla aparte:
                 entregar y cobrar son un solo momento en el mostrador, y es
                 el único en que alguien tiene el número delante. Se puede
                 entregar sin cobrar —te paga después, o es una garantía—, y
                 por eso el campo vacío también cierra el caso. */
              <>
                <p className="flex items-start gap-2 rounded-campo bg-espera-fondo p-4 text-espera">
                  <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                  <span>
                    <span className="font-bold">Vas a cerrar el caso.</span> Lo que
                    anotes acá queda registrado como lo que cobraste. Si te paga
                    después, lo anotás en Cobros cuando pase.
                  </span>
                </p>

                {/* Si ya dejó algo (una seña), se dice antes que nada: el
                    monto de abajo es lo que falta, no el total. */}
                {cobrosDeEste.length > 0 && (
                  <p className="mt-4 text-tinta-media">
                    Ya te pagó <span className="font-bold text-tinta">{pesos(cuenta.pagado)}</span>
                    {cuenta.pendiente > 0 && (
                      <>
                        {" "}y se espera un pago de{" "}
                        <span className="font-bold text-tinta">{pesos(cuenta.pendiente)}</span>
                      </>
                    )}
                    {aprobado > 0 && <> de {pesos(aprobado)} aprobados</>}.
                  </p>
                )}

                {/* El monto no arranca editable: en la enorme mayoría de los
                    casos se cobra lo que falta, y lo que hay que hacer es
                    confirmar, no escribir. Cambiarlo es la excepción y pide un
                    toque más, con su propio aviso. */}
                {!cambiandoCobro ? (
                  <div className="mt-4">
                    {cuenta.falta > 0 ? (
                      <>
                        <p className="text-tinta-media">Vas a anotar que cobraste</p>
                        <p className="font-titulo font-extrabold text-dato tabular-nums">
                          {pesos(cuenta.falta)}
                        </p>
                        <p className="mt-1 max-w-[65ch] text-tinta-media">
                          {cobrosDeEste.length > 0
                            ? "Es lo que falta de lo aprobado."
                            : `Es lo que ${cliente?.nombre?.split(" ")[0] ?? "el cliente"} aprobó.`}
                        </p>
                      </>
                    ) : (
                      (() => {
                        const frase = fraseDeLaCuenta(cuenta);
                        return (
                          frase && (
                            <p className={`flex items-start gap-2 font-bold ${frase.color}`}>
                              <Icono nombre={frase.icono} className="mt-0.5 size-6 shrink-0" />
                              <span>{frase.texto}</span>
                            </p>
                          )
                        );
                      })()
                    )}
                    <div className="mt-3">
                      <Boton
                        variante="plano"
                        icono="nota"
                        onClick={() => {
                          if (cuenta.falta === 0) setCobro("");
                          setCambiandoCobro(true);
                        }}
                      >
                        {cuenta.falta > 0 ? "Cobré otra cosa" : "Cobré algo más"}
                      </Boton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    {cuenta.falta > 0 && (
                      <p className="mb-3 flex items-start gap-2 rounded-campo bg-espera-fondo p-3 text-espera">
                        <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
                        <span>
                          Estás cambiando el monto. Falta cobrar{" "}
                          <span className="font-bold">{pesos(cuenta.falta)}</span>
                          {montoCobrado(cobro) != null && montoCobrado(cobro) !== cuenta.falta
                            ? `, y estás anotando ${pesos(montoCobrado(cobro))}.`
                            : "."}
                        </span>
                      </p>
                    )}
                    <Campo
                      id="cobro"
                      etiqueta="¿Cuánto cobraste?"
                      ayuda={
                        cobrosDeEste.length > 0
                          ? "Con números y sin puntos. Si hoy no te paga nada más, dejalo vacío: el caso se entrega igual."
                          : "Con números y sin puntos. Si te paga después, dejalo vacío: el caso se entrega igual. Si no le cobrás nada, poné 0."
                      }
                      ejemplo="120000"
                      error={!cobroValido(cobro) ? "El monto va con números y sin puntos." : null}
                      inputMode="numeric"
                      value={cobro}
                      onChange={(e) => setCobro(e.target.value)}
                    />
                  </div>
                )}

                {/* Cómo pagó, sólo si hay plata que anotar. */}
                {cobroValido(cobro) && montoCobrado(cobro) > 0 && (
                  <div className="mb-6">
                    <ElegirMedio valor={medioEntrega} alElegir={setMedioEntrega} />
                  </div>
                )}

                {/* Cobró menos de lo que faltaba (incluido 0): ¿y el resto?
                    Con el campo vacío no se pregunta: vacío es "hoy no se
                    anota nada", y lo que falta sigue faltando. */}
                {cobroValido(cobro) &&
                  montoCobrado(cobro) != null &&
                  cuenta.falta > 0 &&
                  montoCobrado(cobro) < cuenta.falta && (
                    <fieldset className="mb-6">
                      <legend className="mb-2 font-bold text-cuerpo">
                        ¿Y los {pesos(cuenta.falta - montoCobrado(cobro))} que faltan?
                      </legend>
                      <ul className="flex flex-wrap gap-2.5">
                        {[
                          { valor: "despues", palabra: "Me los paga después" },
                          { valor: "no_se_cobra", palabra: "No se los cobro" },
                        ].map((o) => {
                          const puesta = o.valor === elResto;
                          return (
                            <li key={o.valor}>
                              <button
                                type="button"
                                aria-pressed={puesta}
                                onClick={() => setElResto(o.valor)}
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
                    </fieldset>
                  )}

                {errorEntrega && (
                  <p role="alert" className="mb-4 flex items-start gap-2 font-bold text-rojo">
                    <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                    <span>{errorEntrega}</span>
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Boton
                    icono="listo"
                    motivo={
                      cerrando ? "guardando" : !cobroValido(cobro) ? "revisá el monto" : null
                    }
                    onClick={async () => {
                      const monto = montoCobrado(cobro);
                      setErrorEntrega(null);

                      // Primero el cobro, después el cierre: si el cobro no
                      // se pudo anotar, el caso no se cierra como si se
                      // hubiera cobrado.
                      if (monto > 0) {
                        setCerrando(true);
                        const r = await datos.registrarCobro({
                          casoId: caso.id,
                          monto,
                          medio: medioEntrega,
                        });
                        setCerrando(false);
                        if (!r.ok) return setErrorEntrega(r.error);
                      }

                      // Lo que queda después de lo que se cobra hoy. Si se
                      // eligió no cobrarlo, pasa a descuento y no se debe.
                      const restoAntes = Math.max(0, cuenta.falta - (monto > 0 ? monto : 0));
                      const descuenta = monto != null && restoAntes > 0 && elResto === "no_se_cobra";
                      const resto = descuenta ? 0 : restoAntes;

                      // El 0 de SCRUM-74: se entregó sin cobrar nada. Sólo
                      // tiene sentido en un caso sin cobros; con una seña,
                      // "0 hoy" no es "no se cobró nada".
                      const sinCobrarNada = monto === 0 && cobrosDeEste.length === 0;

                      datos.cambiarEstado(
                        caso.id,
                        "completado",
                        queFaltaPara(negocio?.rubro, "completado"),
                        {
                          titulo: "Entregaron el trabajo",
                          detalle:
                            "El caso queda cerrado." +
                            (monto > 0 ? ` Cobraron ${pesos(monto)}.` : "") +
                            (sinCobrarNada && descuenta ? " No se cobró nada." : "") +
                            (descuenta && !sinCobrarNada ? ` No le cobran ${pesos(restoAntes)}.` : "") +
                            (resto > 0 ? ` Falta cobrar ${pesos(resto)}.` : ""),
                          icono: "listo",
                        },
                        {
                          ...(sinCobrarNada && descuenta
                            ? { cobrado: 0, cobrado_en: new Date().toISOString() }
                            : {}),
                          ...(descuenta ? { descuento: cuenta.descuento + restoAntes } : {}),
                        }
                      );
                      datos.avisarExito(
                        resto > 0
                          ? `Listo. El caso ${caso.numero} quedó entregado. Falta cobrar ${pesos(resto)}.`
                          : monto > 0
                            ? `Listo. El caso ${caso.numero} quedó entregado y cobrado.`
                            : `Listo. El caso ${caso.numero} quedó entregado.`
                      );
                      setEntregando(false);
                    }}
                  >
                    Sí, entregar y cerrar
                  </Boton>
                  <Boton variante="plano" onClick={() => setEntregando(false)}>
                    Mejor no
                  </Boton>
                </div>
              </>
            )}
          </Tarjeta>
        </>
      ) : (
        <>
          <TituloSeccion className="mt-12">El caso está cerrado</TituloSeccion>
          <Tarjeta>
            <p className="max-w-[65ch] text-tinta-media">
              Se entregó{caso.cobrado != null ? ` y se cobró ${pesos(Number(caso.cobrado))}` : ""}.
              {aprobado > 0 && cuenta.falta > 0 && (
                <>
                  {" "}
                  <span className="font-bold text-espera">
                    Falta cobrar {pesos(cuenta.falta)}
                  </span>
                  : lo anotás en Cobros cuando te pague.
                </>
              )}{" "}
              Mientras siga cerrado no se le cambian los pasos ni el diagnóstico.
            </p>
            {/* Nada es definitivo: se puede haber cerrado de más. Es la única
                acción que queda en un caso cerrado, así que se ve como un
                botón y no como un enlace perdido al final. */}
            {puedeCargar && (
              <div className="mt-4">
                <Boton
                  variante="neutro"
                  icono="deshacer"
                  onClick={() =>
                    datos.cambiarEstado(
                      caso.id,
                      "en_proceso",
                      queFaltaPara(negocio?.rubro, "en_proceso"),
                      {
                        titulo: "Volvieron a abrir el caso",
                        detalle: "Se había cerrado antes de tiempo.",
                        icono: "deshacer",
                      }
                    )
                  }
                >
                  Volver a abrirlo
                </Boton>
              </div>
            )}
          </Tarjeta>
        </>
      )}

      {/* El diagnóstico se mudó a la pantalla de los pasos (flujo, 3.2).
          Revisar y presupuestar son el mismo momento de trabajo, y estaban
          partidos en dos pantallas: se escribía acá qué se encontró y había
          que irse a otro lado a cargar lo que hay que hacer con eso. */}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <TituloSeccion className="mb-0">Lo que pasó con este caso</TituloSeccion>
        {puedeCargar && (
          <Boton icono="nota" onClick={() => setAnotando((v) => !v)}>
            {anotando ? "Cerrar" : "Anotar algo"}
          </Boton>
        )}
      </div>

      {/* Una nota suelta se agrega al historial: no pisa nada de lo anterior. */}
      {anotando && puedeCargar && (
        <Tarjeta className="mb-4">
          <label htmlFor="nota" className="block font-bold text-cuerpo">
            Qué querés dejar anotado
          </label>
          <p className="mt-1 mb-2 text-apoyo text-tinta-suave">
            Queda en el historial con la fecha. No borra ni cambia lo de antes.
          </p>
          <textarea
            id="nota"
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="La clienta avisó que lo pasa a buscar el martes."
            className="block w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta p-4 text-cuerpo placeholder:text-tinta-suave"
          />
          <div className="mt-3">
            <Boton
              icono="check"
              motivo={!nota.trim() ? "falta escribir la nota" : null}
              onClick={() => {
                datos.anotarNota(caso.id, nota.trim());
                datos.avisarExito("Listo, quedó anotado en el historial.");
                setNota("");
                setAnotando(false);
              }}
            >
              Anotarlo
            </Boton>
          </div>
        </Tarjeta>
      )}

      {/* Los cinco más recientes, y el resto a pedido. Un caso de dos
          semanas deja veinte eventos, y en el celular todo lo que estaba
          debajo quedaba a un scroll que nadie hace (auditoría, H8). */}
      <ol className="flex flex-col gap-6">
        {(historialEntero ? historial : historial.slice(0, EVENTOS_A_LA_VISTA)).map((e) => (
          <li key={e.id} className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta-media">
              <Icono nombre={e.icono} className="size-5" />
            </span>
            <div className="min-w-0 flex-1 border-b border-borde pb-4">
              <p className="font-bold">{e.titulo}</p>
              <p className="text-apoyo text-tinta-suave">
                {cuando(e.ocurrido_en)} · {e.autor}
              </p>
              {e.detalle && <p className="mt-1 text-tinta-media">{e.detalle}</p>}
            </div>
          </li>
        ))}
      </ol>
      {historial.length > EVENTOS_A_LA_VISTA && (
        <div className="mt-4">
          <Boton
            variante="plano"
            icono={historialEntero ? "volver" : "mas"}
            onClick={() => setHistorialEntero((v) => !v)}
          >
            {historialEntero
              ? "Mostrar sólo lo último"
              : `Ver todo lo que pasó (${historial.length})`}
          </Boton>
        </div>
      )}
    </>
  );
}

// "Ya está listo" — el aviso al cliente cuando el trabajo pasó el control
// (flujo, punto 9).
//
// Es el hermano de "Mandarle los pasos al cliente" de la pantalla de pasos:
// mismo patrón, mismo link, otro momento. Aquel se manda cuando hay que
// decidir; este, cuando ya se hizo.
//
// Usa el link que ya existe y lo arma si todavía no hay ninguno, en el mismo
// toque: si hubiera que ir a compartirlo primero, avisar dejaría de ser una
// sola acción y nadie lo usaría con el mostrador lleno.
function AvisarleQueEstaListo({ caso, cliente, negocio, datos, aprobados }) {
  const [abierto, setAbierto] = useState(false);
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState(null);
  const [origen, setOrigen] = useState("");

  useEffect(() => setOrigen(window.location.origin), []);

  const entregado = caso.estado === "completado";
  const codigo = caso.seguimiento_codigo ?? null;
  const link = codigo && origen ? linkDeSeguimiento(origen, codigo) : "";

  const mensaje = mensajeDeLoHecho({
    negocioNombre: negocio?.nombre ?? "tu negocio",
    clienteNombre: cliente?.nombre?.split(" ")[0] ?? null,
    identificador: caso.identificador,
    servicio: caso.servicio,
    estadoEnPalabras: etiquetaEstado(negocio?.rubro, caso.estado),
    entregado,
    pasos: aprobados.map((p) => ({ nombre: p.nombre, hecho: Boolean(p.hecho_en) })),
    link,
  });

  async function preparar() {
    setError(null);
    if (codigo) return setAbierto((v) => !v);

    // Sin link todavía: se arma ahora. compartirCaso() devuelve el mismo
    // código si ya hubiera uno, así que nunca se genera uno nuevo por error
    // y el que el cliente ya tenga sigue andando.
    setArmando(true);
    const r = await datos.compartirCaso(caso.id);
    setArmando(false);
    if (!r.ok) return setError(r.error);
    setAbierto(true);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      datos.avisarExito("Listo. Copiamos el aviso: pegalo en la conversación con el cliente.");
    } catch {
      const pre = document.getElementById("aviso-listo");
      if (pre) window.getSelection()?.selectAllChildren(pre);
      datos.avisarExito("No pudimos copiarlo solos. Quedó marcado: copialo con el menú del teléfono.");
    }
  }

  return (
    <>
      <TituloSeccion className="mt-12">
        {entregado ? "Contarle qué se le hizo" : "Avisarle que ya está"}
      </TituloSeccion>
      <Tarjeta>
        {error && <ErrorGeneral>{error}</ErrorGeneral>}

        <p className="max-w-[65ch] text-tinta-media">
          {entregado
            ? "Un resumen de lo que se le hizo, con el link para que lo tenga a mano."
            : `El trabajo está controlado. Avisale a ${cliente?.nombre?.split(" ")[0] ?? "tu cliente"} que puede venir a buscarlo.`}
        </p>

        <div className="mt-4">
          <Boton
            icono="chat"
            motivo={armando ? "armando el link" : null}
            onClick={preparar}
          >
            {abierto ? "Cerrar" : entregado ? "Armar el resumen" : "Armar el aviso"}
          </Boton>
        </div>

        {abierto && (
          <div className="mt-4 rounded-tarjeta border border-borde bg-superficie p-4">
            <p className="font-bold">Esto es lo que le va a llegar</p>
            <pre
              id="aviso-listo"
              className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-campo bg-tarjeta p-4 font-cuerpo text-etiqueta text-tinta-media"
            >
              {mensaje}
            </pre>

            <div className="mt-3 flex flex-wrap gap-3">
              <Boton icono="copiar" onClick={copiar}>
                Copiar el aviso
              </Boton>
              <a
                href={linkDeWhatsApp(mensaje)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 font-bold text-cuerpo text-tinta hover:bg-superficie"
              >
                <Icono nombre="chat" />
                Mandarlo por WhatsApp
              </a>
            </div>
          </div>
        )}
      </Tarjeta>
    </>
  );
}

// Un dato del caso: el nombre arriba, el valor abajo, el ícono al costado.
//
// El nombre va SIEMPRE, también cuando el valor se explica solo. Un ícono de
// persona al lado de "Diego" no dice si Diego es el cliente o quien hace el
// trabajo (auditoría, H2), y "hace 14 días" sin nombre no dice de qué.
function Dato({ icono, que, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icono nombre={icono} className="mt-1 size-5 shrink-0 text-tinta-suave" />
      <div className="min-w-0">
        <dt className="text-apoyo text-tinta-suave">{que}</dt>
        <dd className="text-cuerpo text-tinta">{children}</dd>
      </div>
    </div>
  );
}
