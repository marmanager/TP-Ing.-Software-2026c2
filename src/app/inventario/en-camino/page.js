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
import { useIdioma } from "@/lib/useIdioma";
import { conElementos } from "@/lib/conElementos";
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
  const puedeCargar = puede(usuario, "editar_inventario");
  const { cargando, insumos, casos, clientes, negocio } = datos;
  const pedido = useSearchParams();
  const casoPedido = pedido.get("caso");
  const nombrePedido = pedido.get("pedir");
  const reponer = pedido.get("reponer");
  const { idioma, t } = useIdioma();
  useTitulo(t("inventario.enCamino.pestana"));

  // Si se llegó con algo para pedir, el formulario arranca abierto y cargado:
  // se vino a pedir, no a mirar.
  const [abierto, setAbierto] = useState(Boolean(casoPedido || nombrePedido || reponer));

  if (cargando) return <Cargando />;

  const { articulo } = vocabulario(negocio?.rubro, idioma);
  const titulo = t("inventario.enCamino.titulo", { palabra: mayuscula(articulo.palabra(2)) });

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
        ? t("inventario.enCamino.llegoAlStock", { nombre: i.nombre })
        : despues?.estado === "en_proceso"
          ? t("inventario.enCamino.llegoYSigue", { nombre: i.nombre, caso: casoEnFrase(caso, t) })
          : t("inventario.enCamino.llegoYEspera", { nombre: i.nombre, caso: casoEnFrase(caso, t) })
    );
  }

  return (
    <>
      <Pestanas padre="inventario" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">{titulo}</h1>
          <p className="mt-1 text-tinta-media">
            {t("inventario.enCamino.apoyo")}
          </p>
        </div>
        {/* El mismo arreglo que "Anotar un turno": mientras hay un pedido a
            medio escribir el botón se apaga en su lugar y dice por qué, en
            vez de cambiar de texto. Salir es "Cancelar", abajo. */}
        {puedeCargar && (
          <Boton
            icono="mas"
            motivo={abierto ? t(`inventario.enCamino.yaPidiendo.${articulo.segun("m", "f")}`) : null}
            onClick={() => setAbierto(true)}
          >
            {t("inventario.enCamino.pedir", { articulo: articulo.un() })}
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
          <TituloSeccion>{t("inventario.enCamino.llegaronTitulo")}</TituloSeccion>
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
                          {caso
                            ? conElementos(t("inventario.enCamino.esDelCaso"), {
                                enlace: (
                                  <Link href={`/casos/${caso.id}`} className="font-bold text-azul">
                                    {casoEnFrase(caso, t)}
                                  </Link>
                                ),
                              })
                            : t("inventario.enCamino.llegoSinUso")}
                        </p>
                      </div>
                      <Boton icono="cajas" onClick={() => llego(i)}>
                        {t("inventario.enCamino.guardarEnStock")}
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
        <Vacio icono="camion" titulo={t("inventario.enCamino.vacioTitulo", { palabra: articulo.palabra(2) })}>
          {t(puedeCargar ? "inventario.enCamino.vacioConPermiso" : "inventario.enCamino.vacioSinPermiso", {
            articulo: articulo.un(),
          })}
        </Vacio>
      ) : (
        <>
          <TituloSeccion>
            {t("inventario.enCamino.sinLlegar", { cuantos: mayuscula(articulo.cuantos(pedidos.length)) })}
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
  const { idioma, t } = useIdioma();
  const [form, setForm] = useState(inicial);
  const [casoElegido, setCasoElegido] = useState(casoInicial ?? PARA_EL_STOCK);
  // Mientras la API contesta, el botón no se puede volver a tocar: un
  // segundo toque sería otro pedido.
  const [guardando, setGuardando] = useState(false);
  const cambiar = (que) => setForm((f) => ({ ...f, ...que }));

  const { articulo } = vocabulario(negocio?.rubro, idioma);
  const enCaja = form.unidad === "caja";
  const abiertos = casos.filter(estaAbierto);
  const clienteDe = (caso) => clientes.find((c) => c.id === caso?.cliente_id);
  // Un ?caso= que no es de un caso abierto no se elige solo: pedir para un
  // caso cerrado no lo reabre, y dejarlo elegido sería prometer lo contrario.
  const casoId = abiertos.some((c) => c.id === casoElegido) ? casoElegido : PARA_EL_STOCK;

  const producto = limpiarProducto(form);
  const igual = producto.nombre ? buscarIgual(insumos, producto) : null;
  const motivo = guardando
    ? t("inventario.guardandoMotivo")
    : motivoDelProducto(form, { desdeUno: true }, t);

  async function pedir() {
    setGuardando(true);
    const insumo = await datos.pedirInsumo({ ...form, casoId: casoId || null });
    setGuardando(false);
    if (!insumo) return;
    const caso = casos.find((c) => c.id === casoId);
    datos.avisarExito(
      caso
        ? t("inventario.enCamino.pedidoParaCaso", { nombre: insumo.nombre, caso: casoEnFrase(caso, t) })
        : t("inventario.enCamino.pedidoParaStock", { nombre: insumo.nombre })
    );
    alCerrar();
  }

  return (
    <Tarjeta className="mb-8 max-w-[640px]">
      <TituloSeccion>{t("inventario.enCamino.pedir", { articulo: articulo.un() })}</TituloSeccion>

      <CamposDeProducto
        prefijo="pedir"
        form={form}
        cambiar={cambiar}
        etiquetaCantidad={t(enCaja ? "inventario.producto.cuantasCajasPedis" : "inventario.producto.cuantosPedis")}
        ayudaCantidad={t("inventario.producto.desdeUno")}
        conMinimo={!igual}
      />

      {igual && (
        <p className="mb-6 flex items-start gap-2 rounded-campo bg-azul-claro p-3 font-bold text-azul">
          <Icono nombre="cajas" className="mt-0.5 size-5 shrink-0" />
          <span>
            {t("inventario.enCamino.yaTenesEnStock", {
              n: igual.cantidad,
              presentacion: presentacion(igual, igual.cantidad, t),
            })}
          </span>
        </p>
      )}

      <Campo
        id="pedir-caso"
        etiqueta={t("inventario.enCamino.paraQue")}
        ayuda={t("inventario.enCamino.paraQueAyuda")}
      >
        <select
          id="pedir-caso"
          aria-describedby="pedir-caso-ayuda"
          value={casoId}
          onChange={(e) => setCasoElegido(e.target.value)}
          className="mt-2 block w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 min-h-12 text-cuerpo"
        >
          <option value={PARA_EL_STOCK}>{t("inventario.enCamino.paraReponerOpcion")}</option>
          {abiertos.map((c) => (
            // En un desplegable no hay letra chica: el número va entre
            // paréntesis cuando el caso tiene nombre. Un solo texto, que
            // es lo único que un <option> sabe mostrar.
            <option key={c.id} value={c.id}>
              {`${tituloDelCaso(c, t)}${subtituloDelCaso(c, t) ? ` (${subtituloDelCaso(c, t)})` : ""} · ${lineaDelCaso(c, clienteDe(c)?.nombre ?? t("inventario.enCamino.sinCliente"), t)}`}
            </option>
          ))}
        </select>
      </Campo>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton variante="principal" icono="check" motivo={motivo} className="w-full sm:w-auto" onClick={pedir}>
          {t("inventario.enCamino.pedirlo")}
        </Boton>
        <Boton variante="peligro" icono="tacho" className="w-full sm:w-auto" onClick={alCerrar}>
          {t("casos.comun.cancelar")}
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
  const { t } = useIdioma();
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
                  · {i.cantidad} {presentacion(i, i.cantidad, t)}
                </span>
              )}
            </p>
            {detalle && <p className="text-apoyo text-tinta-suave">{detalle}</p>}
            <p className="text-tinta-media">
              {caso ? (
                <>
                  {conElementos(t("inventario.enCamino.paraElCaso"), {
                    enlace: (
                      <Link href={`/casos/${caso.id}`} className="font-bold text-azul">
                        {casoEnFrase(caso, t)}
                      </Link>
                    ),
                  })}
                  {cliente && cliente.nombre !== tituloDelCaso(caso, t) && ` · ${cliente.nombre}`}
                </>
              ) : (
                t("inventario.enCamino.paraReponer")
              )}
            </p>
          </div>
          {puedeCargar && (
            <div className="flex flex-wrap gap-2">
              <Boton icono="pincel" motivo={editando ? t("inventario.editandoMotivo") : null} onClick={() => setEditando(true)}>
                {t("inventario.editar")}
              </Boton>
              <Boton icono="check" onClick={alLlegar}>
                {t("inventario.enCamino.marcarLlego")}
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
