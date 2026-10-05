"use client";

// "En camino": lo que se pidió y todavía no llegó (SCRUM-113).
//
// Es el submódulo "en_camino" del Inventario. El dolor más grande que salió de
// las entrevistas con talleres es éste: pedir los repuestos de cada auto y
// acordarse de cuál está esperando qué, que hoy resuelven a mano en Excel.
//
// QUÉ HABÍA Y QUÉ FALTABA. Todo lo de después de pedir ya estaba: el caso dice
// "Que llegue «…»", la lista de casos ofrece "Marcar que llegó", y el cliente
// no puede destrabar un caso al que le falta una pieza. Lo que no existía era
// la manera de pedir: ninguna parte del sistema creaba un pedido, y la sección
// que los listaba estaba siempre vacía. Esta pantalla es esa mitad.
//
// Se pide con los mismos datos que el alta de "En stock" (componentes/
// Producto.js): al llegar, lo pedido se suma a uno igual del stock por nombre,
// marca, modelo y cómo viene, y sin esos datos nunca coincidía.
//
// Se llega también desde un caso ("Pedir un repuesto para este caso") con el
// caso ya elegido, y desde "En stock" cuando algo baja del mínimo, con ese
// producto ya cargado. Por eso lee ?caso=, ?reponer= y ?pedir= de la dirección.
//
// Las palabras del oficio salen de vocabulario(): en un taller se piden
// repuestos y en un consultorio, insumos.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede } from "@/lib/permisos";
import { estaAbierto } from "@/lib/estados";
import { mayuscula, vocabulario } from "@/lib/presets";
import { casoEnFrase, lineaDelCaso, subtituloDelCaso, tituloDelCaso } from "@/lib/nombres";
import { buscarIgual, formDeProducto, limpiarProducto, motivoDelProducto, presentacion } from "@/lib/inventario";
import Icono from "@/componentes/Icono";
import Pestanas from "@/componentes/Pestanas";
import { CamposDeProducto, EdicionDeProducto, PRODUCTO_VACIO } from "@/componentes/Producto";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

// Sin caso elegido, el pedido es para reponer el stock.
const PARA_EL_STOCK = "";

// useSearchParams necesita un límite de Suspense para que la pantalla se
// pueda armar de antemano. Es el mismo arreglo que /casos/nuevo.
export default function EnCamino() {
  return (
    <Suspense fallback={<Cargando />}>
      <Pantalla />
    </Suspense>
  );
}

function Pantalla() {
  const datos = useDatos();
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario?.rol, "cargarDatos");
  const { cargando, insumos, casos, clientes, negocio } = datos;
  const pedido = useSearchParams();
  const casoPedido = pedido.get("caso");
  const nombrePedido = pedido.get("pedir");
  const reponer = pedido.get("reponer");
  useTitulo("En camino");

  // Si se llegó con algo para pedir, el formulario arranca abierto y cargado:
  // se vino a pedir, no a mirar.
  const [abierto, setAbierto] = useState(Boolean(casoPedido || nombrePedido || reponer));

  if (cargando) return <Cargando />;

  const { articulo } = vocabulario(negocio?.rubro);
  const titulo = `${mayuscula(articulo.palabra(2))} en camino`;

  const pedidos = insumos.filter((i) => i.estado === "pedido");
  // "Llegado" es el paso intermedio que pensó el diseño original —llegó y
  // todavía no se usó— pero hoy nada lo produce: marcar que llegó lo pasa
  // directo al stock. Se sigue mostrando por si quedó alguno de antes.
  const llegados = insumos.filter((i) => i.estado === "llegado");

  const casoDe = (id) => casos.find((c) => c.id === id);
  const clienteDe = (caso) => clientes.find((c) => c.id === caso?.cliente_id);

  // Lo que arranca escrito: el producto del stock que bajó del mínimo, con
  // todos sus datos y de a uno; o el nombre que vino en la dirección.
  const paraReponer = insumos.find((i) => i.id === reponer && i.estado === "en_stock");
  const inicial = paraReponer
    ? formDeProducto(paraReponer, { cantidad: 1 })
    : { ...PRODUCTO_VACIO, nombre: nombrePedido ?? "", cantidad: "1" };

  async function llego(i) {
    const caso = casoDe(i.caso_id);
    const despues = await datos.marcarInsumoLlegado(i.id);
    datos.avisarExito(
      !caso
        ? `Listo. ${i.nombre} ya está en el stock.`
        : despues?.estado === "en_proceso"
          ? `Listo. Llegó ${i.nombre} y el ${casoEnFrase(caso)} ya puede seguir.`
          : `Listo. Llegó ${i.nombre}. El ${casoEnFrase(caso)} sigue esperando otra cosa.`
    );
  }

  return (
    <>
      <Pestanas padre="inventario" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">{titulo}</h1>
          <p className="mt-1 text-tinta-media">
            Lo que pediste y todavía no llegó, con el caso que lo espera.
          </p>
        </div>
        {/* El mismo arreglo que "Anotar un turno": mientras hay un pedido a
            medio escribir el botón se apaga en su lugar y dice por qué, en
            vez de cambiar de texto. Salir es "Cancelar", abajo. */}
        {puedeCargar && (
          <Boton
            icono="mas"
            motivo={abierto ? `ya estás pidiendo ${articulo.segun("uno", "una")}` : null}
            onClick={() => setAbierto(true)}
          >
            Pedir {articulo.un()}
          </Boton>
        )}
      </div>

      {abierto && puedeCargar && (
        <FormularioDePedido
          key={reponer ?? nombrePedido ?? casoPedido ?? ""}
          inicial={inicial}
          casoInicial={casoPedido}
          alCerrar={() => setAbierto(false)}
        />
      )}

      {llegados.length > 0 && (
        <>
          <TituloSeccion>Llegaron y hay que usarlos</TituloSeccion>
          <ul className="mb-10 flex flex-col gap-3">
            {llegados.map((i) => {
              const caso = casoDe(i.caso_id);
              return (
                <li key={i.id}>
                  <Tarjeta className="border-l-4 border-l-terracota">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-subtitulo">{i.nombre}</p>
                        <p className="text-tinta-media">
                          {caso ? (
                            <>
                              Es del{" "}
                              <Link href={`/casos/${caso.id}`} className="font-bold text-azul">
                                {casoEnFrase(caso)}
                              </Link>
                              . Marcarlo destraba el trabajo.
                            </>
                          ) : (
                            "Llegó y todavía nadie lo usó."
                          )}
                        </p>
                      </div>
                      <Boton icono="cajas" onClick={() => llego(i)}>
                        Guardarlo en stock
                      </Boton>
                    </div>
                  </Tarjeta>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {pedidos.length === 0 ? (
        <Vacio icono="camion" titulo={`No hay ${articulo.palabra(2)} en camino`}>
          {puedeCargar
            ? `Cuando pidas ${articulo.un()} para un caso, va a aparecer acá hasta que llegue, y el caso va a quedar esperándolo.`
            : `Cuando alguien pida ${articulo.un()}, va a aparecer acá hasta que llegue.`}
        </Vacio>
      ) : (
        <>
          <TituloSeccion>
            {mayuscula(articulo.cuantos(pedidos.length))} sin llegar
          </TituloSeccion>
          <ul className="flex flex-col gap-3">
            {pedidos.map((i) => (
              <FilaDePedido
                key={i.id}
                insumo={i}
                caso={casoDe(i.caso_id)}
                cliente={clienteDe(casoDe(i.caso_id))}
                puedeCargar={puedeCargar}
                alLlegar={() => llego(i)}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------
// Pedir
// ------------------------------------------------------------
// Los mismos campos que el alta de "En stock", más "Para qué". Si en el stock
// ya hay uno igual, se avisa que al llegar se suma ahí, y el mínimo no se
// pregunta: queda el que ya tiene.
function FormularioDePedido({ inicial, casoInicial, alCerrar }) {
  const datos = useDatos();
  const { insumos, casos, clientes, negocio } = datos;
  const [form, setForm] = useState(inicial);
  const [casoElegido, setCasoElegido] = useState(casoInicial ?? PARA_EL_STOCK);
  // Mientras la API contesta, el botón no se puede volver a tocar: un
  // segundo toque sería otro pedido.
  const [guardando, setGuardando] = useState(false);
  const cambiar = (que) => setForm((f) => ({ ...f, ...que }));

  const { articulo } = vocabulario(negocio?.rubro);
  const enCaja = form.unidad === "caja";
  const abiertos = casos.filter(estaAbierto);
  const clienteDe = (caso) => clientes.find((c) => c.id === caso?.cliente_id);
  // Un ?caso= que no es de un caso abierto no se elige solo: pedir para un
  // caso cerrado no lo reabre, y dejarlo elegido sería prometer lo contrario.
  const casoId = abiertos.some((c) => c.id === casoElegido) ? casoElegido : PARA_EL_STOCK;

  const producto = limpiarProducto(form);
  const igual = producto.nombre ? buscarIgual(insumos, producto) : null;
  const motivo = guardando ? "se está guardando" : motivoDelProducto(form, { desdeUno: true });

  async function pedir() {
    setGuardando(true);
    const insumo = await datos.pedirInsumo({ ...form, casoId: casoId || null });
    setGuardando(false);
    if (!insumo) return;
    const caso = casos.find((c) => c.id === casoId);
    datos.avisarExito(
      caso
        ? `Listo. Pediste ${insumo.nombre} para el ${casoEnFrase(caso)}, que queda esperándolo.`
        : `Listo. Pediste ${insumo.nombre} para reponer el stock.`
    );
    alCerrar();
  }

  return (
    <Tarjeta className="mb-8 max-w-[640px]">
      <TituloSeccion>Pedir {articulo.un()}</TituloSeccion>

      <CamposDeProducto
        prefijo="pedir"
        form={form}
        cambiar={cambiar}
        etiquetaCantidad={enCaja ? "Cuántas cajas pedís" : "Cuántos pedís"}
        ayudaCantidad="Desde 1."
        conMinimo={!igual}
      />

      {igual && (
        <p className="mb-6 flex items-start gap-2 rounded-campo bg-azul-claro p-3 font-bold text-azul">
          <Icono nombre="cajas" className="mt-0.5 size-5 shrink-0" />
          <span>
            Ya tenés {igual.cantidad} {presentacion(igual, igual.cantidad)} en stock. Cuando llegue, se
            suma ahí.
          </span>
        </p>
      )}

      <Campo
        id="pedir-caso"
        etiqueta="Para qué"
        ayuda="Si es para un caso, el caso queda esperándolo hasta que marques que llegó."
      >
        <select
          id="pedir-caso"
          aria-describedby="pedir-caso-ayuda"
          value={casoId}
          onChange={(e) => setCasoElegido(e.target.value)}
          className="mt-2 block w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 min-h-12 text-cuerpo"
        >
          <option value={PARA_EL_STOCK}>Para reponer el stock</option>
          {abiertos.map((c) => (
            // En un desplegable no hay letra chica: el número va entre
            // paréntesis cuando el caso tiene nombre. Un solo texto, que
            // es lo único que un <option> sabe mostrar.
            <option key={c.id} value={c.id}>
              {`${tituloDelCaso(c)}${subtituloDelCaso(c) ? ` (${subtituloDelCaso(c)})` : ""} · ${lineaDelCaso(c, clienteDe(c)?.nombre ?? "sin cliente")}`}
            </option>
          ))}
        </select>
      </Campo>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton variante="principal" icono="check" motivo={motivo} className="w-full sm:w-auto" onClick={pedir}>
          Pedirlo
        </Boton>
        <Boton variante="peligro" icono="tacho" className="w-full sm:w-auto" onClick={alCerrar}>
          Cancelar
        </Boton>
      </div>
    </Tarjeta>
  );
}

// ------------------------------------------------------------
// Un pedido
// ------------------------------------------------------------
// "Marcar que llegó" es lo de todos los días. "Editar" cambia los datos y la
// cantidad, y es el único lugar desde donde se borra, preguntando antes.
function FilaDePedido({ insumo: i, caso, cliente, puedeCargar, alLlegar }) {
  const [editando, setEditando] = useState(false);
  const detalle = [i.marca, i.modelo].filter(Boolean).join(" · ");

  return (
    <li>
      <Tarjeta className="border-l-4 border-l-espera">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold text-subtitulo">
              {i.nombre}
              {(i.cantidad > 1 || i.unidad === "caja") && (
                <span className="font-normal text-tinta-media">
                  {" "}
                  · {i.cantidad} {presentacion(i, i.cantidad)}
                </span>
              )}
            </p>
            {detalle && <p className="text-apoyo text-tinta-suave">{detalle}</p>}
            <p className="text-tinta-media">
              {caso ? (
                <>
                  Para el{" "}
                  <Link href={`/casos/${caso.id}`} className="font-bold text-azul">
                    {casoEnFrase(caso)}
                  </Link>
                  {cliente && cliente.nombre !== tituloDelCaso(caso) && ` · ${cliente.nombre}`}
                </>
              ) : (
                "Para reponer el stock."
              )}
            </p>
          </div>
          {puedeCargar && (
            <div className="flex flex-wrap gap-2">
              <Boton icono="pincel" motivo={editando ? "lo estás editando" : null} onClick={() => setEditando(true)}>
                Editar
              </Boton>
              <Boton icono="check" onClick={alLlegar}>
                Marcar que llegó
              </Boton>
            </div>
          )}
        </div>
        {editando && (
          <div className="mt-4">
            <EdicionDeProducto insumo={i} alCerrar={() => setEditando(false)} />
          </div>
        )}
      </Tarjeta>
    </li>
  );
}
