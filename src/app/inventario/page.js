"use client";

// "En stock", la primera pantalla del Inventario: lo que hay y cuánto queda.
//
// Lo pedido que todavía no llegó vive en "En camino" (inventario/en-camino),
// que es su propio submódulo desde SCRUM-113.
//
// Los textos nombran lo que se guarda con la palabra del rubro —"producto" en
// un taller, "insumo" en un consultorio— a través de vocabulario(), en
// presets.js. Ninguna palabra del oficio se escribe a mano en esta pantalla.
//
// Lo que no es de pantalla —cuándo dos productos son el mismo, qué categorías
// hay, cómo se lee una caja— está en lib/inventario.js, con sus pruebas.

import { useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede } from "@/lib/permisos";
import { mayuscula, vocabulario } from "@/lib/presets";
import { hijosActivos } from "@/lib/modulos";
import {
  alternarFiltro,
  buscarEnCategorias,
  buscarIgual,
  cuantosFiltros,
  enTotal,
  filtrarProductos,
  filtrosDisponibles,
  limpiarProducto,
  motivoDelProducto,
  porCategoria,
  presentacion,
  soloVigentes,
} from "@/lib/inventario";
import Icono from "@/componentes/Icono";
import Pestanas from "@/componentes/Pestanas";
import {
  CamposDeProducto,
  EdicionDeProducto,
  PILDORA,
  PILDORA_NO,
  PILDORA_SI,
  PRODUCTO_VACIO,
} from "@/componentes/Producto";
import { Boton, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

export default function Inventario() {
  const datos = useDatos();
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario?.rol, "cargarDatos");
  const { cargando, insumos, negocio } = datos;
  const [abierto, setAbierto] = useState(false);
  // Cómo se mira el stock: todos juntos, o agrupados por categoría.
  //
  // ponytail: no se guarda; volver a entrar arranca en la lista. Igual que
  // "Mensual / Semanal" del Calendario.
  const [vista, setVista] = useState("productos");
  // Buscar y filtrar (SCRUM-81). Cada vista tiene su propia búsqueda: buscan
  // cosas distintas —Productos mira marca y modelo, Categorías no—, y "Bosch"
  // escrito en una dejaría la otra vacía sin razón a la vista. Los filtros
  // son sólo de la vista Productos.
  const [busquedaProductos, setBusquedaProductos] = useState("");
  const [busquedaCategorias, setBusquedaCategorias] = useState("");
  const [elegidos, setElegidos] = useState({});
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  useTitulo("Inventario");

  if (cargando) return <Cargando />;

  const { articulo } = vocabulario(negocio?.rubro);
  const enStock = insumos.filter((i) => i.estado === "en_stock");
  const bajos = enStock.filter((i) => i.cantidad <= i.minimo);

  // Los filtros salen de lo que tienen cargado los productos, y de lo elegido
  // se queda sólo lo que todavía existe (lib/inventario.js).
  const grupos = filtrosDisponibles(enStock);
  const activos = soloVigentes(elegidos, grupos);
  const nFiltros = cuantosFiltros(activos);
  const visibles = filtrarProductos(enStock, { texto: busquedaProductos, elegidos: activos });
  const filtrando = busquedaProductos.trim() !== "" || nFiltros > 0;
  const limpiarTodo = () => {
    setBusquedaProductos("");
    setElegidos({});
  };

  const categorias = porCategoria(enStock);
  const totalDe = new Map(categorias.map((g) => [g.categoria, g.productos.length]));
  const categoriasVisibles = buscarEnCategorias(categorias, busquedaCategorias);
  // "Conviene pedir más" lleva a pedirlo, si el negocio tiene dónde.
  const conEnCamino = hijosActivos("inventario", negocio?.modulos_activos ?? []).some(
    (h) => h.clave === "en_camino"
  );

  const fila = (i, { conCategoria }) => (
    <FilaDeStock
      key={i.id}
      insumo={i}
      conCategoria={conCategoria}
      puedeCargar={puedeCargar}
      conEnCamino={conEnCamino}
    />
  );

  return (
    <>
      <Pestanas padre="inventario" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">Inventario</h1>
          <p className="mt-1 text-tinta-media">
            Lo que tenés y lo que está por debajo del mínimo.
          </p>
        </div>
        {/* El mismo arreglo que "Anotar un turno": mientras el alta está
            abierta el botón se apaga en su lugar, en gris, y dice por qué. No
            cambia de texto ni cierra el alta: el lugar de "Agregar" siempre
            hace lo mismo, y no se pueden abrir dos. Salir es "Cancelar". */}
        {puedeCargar && (
          <Boton
            icono="mas"
            motivo={abierto ? `ya estás agregando ${articulo.segun("uno", "una")}` : null}
            onClick={() => setAbierto(true)}
          >
            Agregar {articulo.un()}
          </Boton>
        )}
      </div>

      {abierto && puedeCargar && <AltaDeProducto alCerrar={() => setAbierto(false)} />}

      {enStock.length === 0 ? (
        <Vacio icono="cajas" titulo="Todavía no hay nada cargado">
          Agregá lo que más usás y te avisamos cuando esté por acabarse.
        </Vacio>
      ) : (
        <>
          {/* Las dos maneras de mirar el stock. Van debajo del alta y arriba
              de la lista porque cambian la lista, no la pantalla. */}
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Cómo ver el stock">
            {[
              ["productos", mayuscula(articulo.palabra(2)), "cajas"],
              ["categorias", "Categorías", "secciones"],
            ].map(([clave, palabra, icono]) => (
              <button
                key={clave}
                type="button"
                aria-pressed={vista === clave}
                onClick={() => setVista(clave)}
                className={`${PILDORA} ${vista === clave ? PILDORA_SI : PILDORA_NO}`}
              >
                <Icono nombre={icono} className="size-5" />
                {palabra}
              </button>
            ))}
          </div>

          {vista === "productos" ? (
            <>
              {/* La búsqueda y, a su derecha, "Filtros". El botón sólo aparece
                  si hay algo para filtrar: sin marcas, modelos ni categorías
                  cargadas, no haría nada. */}
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <Buscador
                  id="buscar-producto"
                  etiqueta={`Buscar ${articulo.un()}`}
                  ayuda="Por nombre, marca, modelo o categoría."
                  valor={busquedaProductos}
                  alCambiar={setBusquedaProductos}
                />
                {grupos.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={filtrosAbiertos}
                    aria-controls="panel-filtros"
                    onClick={() => setFiltrosAbiertos((v) => !v)}
                    className={`${PILDORA} ${filtrosAbiertos || nFiltros > 0 ? PILDORA_SI : PILDORA_NO}`}
                  >
                    {/* La palabra a la izquierda y el ícono a la derecha, como
                        se ve este botón en cualquier lado. */}
                    Filtros{nFiltros > 0 && ` · ${nFiltros}`}
                    <Icono nombre="filtro" className="size-5" />
                  </button>
                )}
              </div>

              {/* El panel se abre debajo, no flotando: en el celular un menú
                  flotante tapa la lista que se está filtrando. Queda abierto
                  mientras se eligen, porque se elige más de uno. */}
              {filtrosAbiertos && grupos.length > 0 && (
                <div
                  id="panel-filtros"
                  className="mb-6 rounded-tarjeta border border-borde bg-tarjeta p-4 sm:p-6"
                >
                  {grupos.map((g) => (
                    <div
                      key={g.clave}
                      role="group"
                      aria-labelledby={`filtro-${g.clave}`}
                      className="mb-4 last:mb-0"
                    >
                      <p id={`filtro-${g.clave}`} className="mb-2 font-bold text-cuerpo">
                        {g.titulo}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {g.opciones.map((o) => {
                          const elegido = activos[g.clave]?.includes(o.valor) ?? false;
                          return (
                            <button
                              key={o.valor}
                              type="button"
                              aria-pressed={elegido}
                              onClick={() => setElegidos((e) => alternarFiltro(e, g.clave, o.valor))}
                              className={`${PILDORA} ${elegido ? PILDORA_SI : PILDORA_NO}`}
                            >
                              {elegido && <Icono nombre="check" className="size-5" />}
                              {o.etiqueta}
                              <span className="font-normal text-tinta-suave">{o.cuantos}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {nFiltros > 0 && (
                    <Boton variante="plano" icono="cruz" onClick={() => setElegidos({})}>
                      Sacar los filtros
                    </Boton>
                  )}
                </div>
              )}

              <TituloSeccion>
                Lo que tenés{bajos.length > 0 && ` · ${bajos.length} por debajo del mínimo`}
              </TituloSeccion>

              {/* Cuánto se está viendo, para que una lista corta no se lea como
                  un stock que se vació. */}
              {filtrando && visibles.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-tinta-media">
                    {visibles.length} de {articulo.cuantos(enStock.length)}
                  </p>
                  <Boton variante="plano" icono="cruz" onClick={limpiarTodo}>
                    Ver todo
                  </Boton>
                </div>
              )}

              {visibles.length === 0 ? (
                <Vacio icono="buscar" titulo={`No hay ${articulo.palabra(2)} que coincidan`}>
                  Probá con otra palabra o sacá algún filtro.
                  <span className="mt-4 block">
                    <Boton icono="cruz" onClick={limpiarTodo}>
                      Ver todo
                    </Boton>
                  </span>
                </Vacio>
              ) : (
                <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
                  {visibles.map((i) => fila(i, { conCategoria: true }))}
                </ul>
              )}
            </>
          ) : (
            <>
              {/* En Categorías sólo se busca, sin filtros. Si lo escrito es un
                  producto, aparece su categoría con ese producto: es la
                  respuesta a "¿dónde puse la bujía?". */}
              <div className="mb-4">
                <Buscador
                  id="buscar-categoria"
                  etiqueta="Buscar una categoría"
                  ayuda={`Si escribís el nombre de ${articulo.un()}, aparece la categoría donde está.`}
                  valor={busquedaCategorias}
                  alCambiar={setBusquedaCategorias}
                />
              </div>

              <TituloSeccion>
                Lo que tenés{bajos.length > 0 && ` · ${bajos.length} por debajo del mínimo`}
              </TituloSeccion>

              {categoriasVisibles.length === 0 ? (
                <Vacio icono="buscar" titulo="Ninguna categoría coincide">
                  Ni el nombre de una categoría ni el de {articulo.un()}.
                  <span className="mt-4 block">
                    <Boton icono="cruz" onClick={() => setBusquedaCategorias("")}>
                      Ver todas
                    </Boton>
                  </span>
                </Vacio>
              ) : (
                categoriasVisibles.map((g) => {
                  const total = totalDe.get(g.categoria) ?? g.productos.length;
                  return (
                    <section key={g.categoria} className="mb-8" aria-label={g.categoria}>
                      <h3 className="mb-2 flex items-center gap-2 font-bold text-subtitulo">
                        {g.categoria}
                        {/* Si la búsqueda dejó algunos, dice de cuántos: "1 de 4"
                            no se confunde con una categoría de uno solo. */}
                        <span className="font-normal text-etiqueta text-tinta-suave">
                          ·{" "}
                          {g.productos.length < total
                            ? `${g.productos.length} de ${articulo.cuantos(total)}`
                            : articulo.cuantos(total)}
                        </span>
                      </h3>
                      <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
                        {/* Adentro de su categoría no hace falta volver a decirla. */}
                        {g.productos.map((i) => fila(i, { conCategoria: false }))}
                      </ul>
                    </section>
                  );
                })
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------
// El buscador (SCRUM-81)
// ------------------------------------------------------------
// El mismo que el de Casos: etiqueta a la vista, la lupa adentro del campo, y
// una cruz para borrar de un toque. Borrar letra por letra en el teclado de un
// celular son doce toques para volver a la lista completa; la cruz es uno, y
// devuelve el foco al campo para escribir otra cosa (auditoría, H3).

function Buscador({ id, etiqueta, ayuda, valor, alCambiar }) {
  const campo = useRef(null);
  return (
    <div className="min-w-64 flex-1">
      <label htmlFor={id} className="block font-bold text-cuerpo">
        {etiqueta}
      </label>
      {ayuda && <p className="mt-1 text-apoyo text-tinta-suave">{ayuda}</p>}
      <div className="relative mt-2">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tinta-suave">
          <Icono nombre="buscar" />
        </span>
        <input
          id={id}
          ref={campo}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          autoComplete="off"
          className="block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta pl-13 pr-14 text-cuerpo placeholder:text-tinta-suave"
        />
        {valor && (
          <button
            type="button"
            aria-label="Borrar la búsqueda"
            onClick={() => {
              alCambiar("");
              campo.current?.focus();
            }}
            className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-campo text-tinta-media hover:text-tinta"
          >
            <Icono nombre="cruz" />
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// El alta de un producto
// ------------------------------------------------------------
// Los campos son los de componentes/Producto.js, los mismos que pedir y editar.

function AltaDeProducto({ alCerrar }) {
  const datos = useDatos();
  const { insumos, negocio } = datos;
  const [form, setForm] = useState(PRODUCTO_VACIO);
  // Mientras la API contesta, el botón no se puede volver a tocar: un
  // segundo toque sería otro pedido y sumaría dos veces.
  const [guardando, setGuardando] = useState(false);

  const { articulo } = vocabulario(negocio?.rubro);
  const cambiar = (que) => setForm((f) => ({ ...f, ...que }));
  const enCaja = form.unidad === "caja";

  // Si lo que se está escribiendo ya está en el stock, se avisa ANTES de
  // guardar: se va a sumar ahí. Es lo que pasa con "Ya es cliente" en el alta
  // de un turno.
  const producto = limpiarProducto(form);
  const igual = producto.nombre ? buscarIgual(insumos, producto) : null;

  const motivo = guardando
    ? "se está guardando"
    : (motivoDelProducto(form) ?? (igual && producto.cantidad < 1 ? "falta cuántos agregás" : null));

  async function guardar() {
    setGuardando(true);
    const r = await datos.agregarInsumo(form);
    setGuardando(false);
    // Si no se pudo, el aviso ya lo dio datos.js; el formulario queda abierto
    // con lo escrito, para volver a probar.
    if (!r) return;
    datos.avisarExito(
      r.sumado
        ? `Listo. Sumaste ${r.insumo.cantidad - r.antes} a ${r.insumo.nombre}: ahora hay ${r.insumo.cantidad} ${presentacion(r.insumo, r.insumo.cantidad)}.`
        : `Listo. ${r.insumo.nombre} ya está en el inventario.`
    );
    alCerrar();
  }

  return (
    <Tarjeta className="mb-8 max-w-[640px]">
      <TituloSeccion>
        {articulo.segun("Nuevo", "Nueva")} {articulo.palabra()}
      </TituloSeccion>

      {/* Si ya existe, el mínimo es el que ya tiene: lo que se está haciendo
          es reponer, no volver a configurarlo. */}
      <CamposDeProducto
        prefijo="prod"
        form={form}
        cambiar={cambiar}
        etiquetaCantidad={
          igual ? (enCaja ? "Cuántas cajas agregás" : "Cuántos agregás") : enCaja ? "Cuántas cajas tenés" : "Cuántos tenés"
        }
        ayudaCantidad={igual ? "Se suman a los que ya hay." : "El número de ahora."}
        conMinimo={!igual}
      />

      {/* Dos iguales no son dos filas: se suman. Se avisa acá, antes de
          tocar Guardar, y el botón dice lo que va a pasar. */}
      {igual && (
        <p className="mb-6 flex items-start gap-2 rounded-campo bg-azul-claro p-3 font-bold text-azul">
          <Icono nombre="cajas" className="mt-0.5 size-5 shrink-0" />
          <span>
            Ya lo tenés: hay {igual.cantidad} {presentacion(igual, igual.cantidad)}. Lo que
            cargues se suma ahí, no se crea {articulo.segun("otro", "otra")}.
          </span>
        </p>
      )}

      {/* Guardar y cancelar juntos, al pie. Cancelar va en rojo con el tacho
          porque tira lo escrito, y eso no tiene vuelta. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton
          variante="principal"
          icono="check"
          motivo={motivo}
          className="w-full sm:w-auto"
          onClick={guardar}
        >
          {igual ? "Sumarlo a lo que hay" : `Guardar ${articulo.el()}`}
        </Boton>
        <Boton variante="peligro" icono="tacho" className="w-full sm:w-auto" onClick={alCerrar}>
          Cancelar
        </Boton>
      </div>
    </Tarjeta>
  );
}

// ------------------------------------------------------------
// Una fila del stock
// ------------------------------------------------------------
// La usan las dos vistas, "Productos" y "Categorías": es la misma fila, y
// copiarla para cada una era garantía de que se despegaran.
//
// La cantidad se ve pero no se toca desde la lista: el − y el + la cambiaban
// de un toque sin querer, y el tacho estaba a la vista. Todo se cambia, y se
// borra, desde "Editar", que pregunta antes de borrar.
function FilaDeStock({ insumo: i, conCategoria, puedeCargar, conEnCamino }) {
  const [editando, setEditando] = useState(false);

  const bajo = i.cantidad <= i.minimo;
  const total = enTotal(i);
  const detalle = [i.marca, i.modelo].filter(Boolean).join(" · ");

  return (
    <li className="flex flex-wrap items-center gap-4 border-b border-borde p-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{i.nombre}</p>
        {(detalle || (conCategoria && i.categoria)) && (
          <p className="text-apoyo text-tinta-suave">
            {detalle}
            {detalle && conCategoria && i.categoria && " · "}
            {conCategoria && i.categoria}
          </p>
        )}
        {i.descripcion && <p className="text-apoyo text-tinta-suave">{i.descripcion}</p>}
        {bajo && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 font-bold text-espera text-etiqueta">
            <Icono nombre="alerta" className="size-5" />
            Quedan {i.cantidad} {presentacion(i, i.cantidad)}. Conviene pedir más.
            {/* Llega a "En camino" con todos los datos de este producto: al
                llegar, se suma a éste y no queda otra fila. */}
            {conEnCamino && puedeCargar && (
              <Link
                href={`/inventario/en-camino?reponer=${encodeURIComponent(i.id)}`}
                className="text-azul underline underline-offset-2"
              >
                Pedirlo
              </Link>
            )}
          </p>
        )}
      </div>

      <p className="flex items-baseline gap-2">
        <span className="font-titulo font-extrabold text-subtitulo tabular-nums">{i.cantidad}</span>
        <span className="whitespace-nowrap text-apoyo text-tinta-suave">
          {presentacion(i, i.cantidad)}
          {total !== null && <span className="block">{total} en total</span>}
        </span>
      </p>

      {puedeCargar && (
        <Boton icono="pincel" motivo={editando ? "lo estás editando" : null} onClick={() => setEditando(true)}>
          Editar
        </Boton>
      )}

      {editando && <EdicionDeProducto insumo={i} alCerrar={() => setEditando(false)} />}
    </li>
  );
}
