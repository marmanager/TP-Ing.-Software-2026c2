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
// Se llega también desde un caso ("Pedir un repuesto para este caso") con el
// caso ya elegido, y desde "En stock" cuando algo baja del mínimo, con el
// nombre ya puesto. Por eso lee ?caso= y ?pedir= de la dirección.
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
import { ejemplosDe, mayuscula, vocabulario } from "@/lib/presets";
import Icono from "@/componentes/Icono";
import Pestanas from "@/componentes/Pestanas";
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
  useTitulo("En camino");

  // Si se llegó con algo para pedir, el formulario arranca abierto y cargado:
  // se vino a pedir, no a mirar.
  const vinoAPedir = Boolean(casoPedido || nombrePedido);
  const [abierto, setAbierto] = useState(vinoAPedir);
  const vacio = { nombre: nombrePedido ?? "", cantidad: "1", casoId: casoPedido ?? PARA_EL_STOCK };
  const [form, setForm] = useState(vacio);

  if (cargando) return <Cargando />;

  const { articulo } = vocabulario(negocio?.rubro);
  const titulo = `${mayuscula(articulo.palabra(2))} en camino`;

  const pedidos = insumos.filter((i) => i.estado === "pedido");
  // "Llegado" es el paso intermedio que pensó el diseño original —llegó y
  // todavía no se usó— pero hoy nada lo produce: marcar que llegó lo pasa
  // directo al stock. Se sigue mostrando por si quedó alguno de antes.
  const llegados = insumos.filter((i) => i.estado === "llegado");

  const abiertos = casos.filter(estaAbierto);
  const casoDe = (id) => casos.find((c) => c.id === id);
  const clienteDe = (caso) => clientes.find((c) => c.id === caso?.cliente_id);
  // Un ?caso= que no es de un caso abierto no se elige solo: pedir para un
  // caso cerrado no lo reabre, y dejarlo elegido sería prometer lo contrario.
  const casoElegible = (id) => abiertos.some((c) => c.id === id);
  const casoId = casoElegible(form.casoId) ? form.casoId : PARA_EL_STOCK;

  const cantidadValida = Number.isInteger(Number(form.cantidad)) && Number(form.cantidad) >= 1;
  const motivo = !form.nombre.trim()
    ? "falta qué pedir"
    : !cantidadValida
      ? "la cantidad va en números, desde 1"
      : null;

  function cerrar() {
    setForm({ nombre: "", cantidad: "1", casoId: PARA_EL_STOCK });
    setAbierto(false);
  }

  function pedir() {
    const nombre = form.nombre.trim();
    datos.pedirInsumo({ nombre, cantidad: form.cantidad, casoId: casoId || null });
    const caso = casoDe(casoId);
    datos.avisarExito(
      caso
        ? `Listo. Pediste ${nombre} para el caso ${caso.numero}, que queda esperándolo.`
        : `Listo. Pediste ${nombre} para reponer el stock.`
    );
    cerrar();
  }

  function llego(i) {
    const caso = casoDe(i.caso_id);
    const despues = datos.marcarInsumoLlegado(i.id);
    datos.avisarExito(
      !caso
        ? `Listo. ${i.nombre} ya está en el stock.`
        : despues?.estado === "en_proceso"
          ? `Listo. Llegó ${i.nombre} y el caso ${caso.numero} ya puede seguir.`
          : `Listo. Llegó ${i.nombre}. El caso ${caso.numero} sigue esperando otra cosa.`
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
        <Tarjeta className="mb-8 max-w-[560px]">
          <TituloSeccion>
            Pedir {articulo.un()}
          </TituloSeccion>

          <Campo
            id="pedir-nombre"
            etiqueta="Qué"
            ayuda={`Con el nombre que usan en el mostrador. Ejemplo: ${ejemplosDe(negocio?.rubro).insumo}.`}
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            list="pedir-conocidos"
            autoComplete="off"
          />
          {/* Lo que ya está en el inventario, para no escribir dos veces lo
              mismo de dos maneras. */}
          <datalist id="pedir-conocidos">
            {[...new Set(insumos.map((i) => i.nombre))].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <Campo
            id="pedir-cantidad"
            etiqueta="Cuántos"
            type="number"
            min="1"
            inputMode="numeric"
            value={form.cantidad}
            onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
          />

          <Campo
            id="pedir-caso"
            etiqueta="Para qué"
            ayuda="Si es para un caso, el caso queda esperándolo hasta que marques que llegó."
          >
            <select
              id="pedir-caso"
              aria-describedby="pedir-caso-ayuda"
              value={casoId}
              onChange={(e) => setForm({ ...form, casoId: e.target.value })}
              className="mt-2 block w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 min-h-12 text-cuerpo"
            >
              <option value={PARA_EL_STOCK}>Para reponer el stock</option>
              {abiertos.map((c) => (
                <option key={c.id} value={c.id}>
                  Caso {c.numero} · {clienteDe(c)?.nombre ?? "sin cliente"} · {c.servicio}
                </option>
              ))}
            </select>
          </Campo>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Boton
              variante="principal"
              icono="check"
              motivo={motivo}
              className="w-full sm:w-auto"
              onClick={pedir}
            >
              Pedirlo
            </Boton>
            <Boton variante="peligro" icono="tacho" className="w-full sm:w-auto" onClick={cerrar}>
              Cancelar
            </Boton>
          </div>
        </Tarjeta>
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
                                caso {caso.numero}
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
            {pedidos.map((i) => {
              const caso = casoDe(i.caso_id);
              return (
                <li key={i.id}>
                  <Tarjeta className="border-l-4 border-l-espera">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-subtitulo">
                          {i.nombre}
                          {i.cantidad > 1 && (
                            <span className="font-normal text-tinta-media"> · {i.cantidad}</span>
                          )}
                        </p>
                        <p className="text-tinta-media">
                          {caso ? (
                            <>
                              Para el{" "}
                              <Link href={`/casos/${caso.id}`} className="font-bold text-azul">
                                caso {caso.numero}
                              </Link>
                              {clienteDe(caso) && ` · ${clienteDe(caso).nombre}`}
                            </>
                          ) : (
                            "Para reponer el stock."
                          )}
                        </p>
                      </div>
                      {puedeCargar && (
                        <Boton icono="check" onClick={() => llego(i)}>
                          Marcar que llegó
                        </Boton>
                      )}
                    </div>
                  </Tarjeta>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
