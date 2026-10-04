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
import { ejemplosDe, mayuscula, vocabulario } from "@/lib/presets";
import { hijosActivos } from "@/lib/modulos";
import {
  alternarFiltro,
  buscarEnCategorias,
  buscarIgual,
  categoriaExistente,
  categoriasDisponibles,
  cuantosFiltros,
  enTotal,
  filtrarProductos,
  filtrosDisponibles,
  limpiarProducto,
  porCategoria,
  presentacion,
  soloVigentes,
} from "@/lib/inventario";
import Icono from "@/componentes/Icono";
import Pestanas from "@/componentes/Pestanas";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

const PILDORA =
  "flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-etiqueta";
const PILDORA_SI = "border-azul bg-azul-claro font-bold text-azul";
const PILDORA_NO = "border-borde bg-tarjeta text-tinta-media hover:bg-superficie";

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

const VACIO = {
  nombre: "",
  marca: "",
  modelo: "",
  categoria: "",
  cantidad: "",
  minimo: "",
  unidad: "unidad",
  porCaja: "",
};

function AltaDeProducto({ alCerrar }) {
  const datos = useDatos();
  const { insumos, negocio } = datos;
  const [form, setForm] = useState(VACIO);
  // Las categorías recién creadas con "+ Nueva" que todavía no usa ningún
  // producto. Se guardan de verdad cuando se guarda el producto que las usa.
  const [agregadas, setAgregadas] = useState([]);
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState("");
  const [avisoCategoria, setAvisoCategoria] = useState(null);
  // Mientras la API contesta, el botón no se puede volver a tocar: un
  // segundo toque sería otro pedido y sumaría dos veces.
  const [guardando, setGuardando] = useState(false);

  const { articulo } = vocabulario(negocio?.rubro);
  const cambiar = (que) => setForm((f) => ({ ...f, ...que }));
  const enCaja = form.unidad === "caja";
  const categorias = categoriasDisponibles(negocio?.rubro, insumos, agregadas);

  // Si lo que se está escribiendo ya está en el stock, se avisa ANTES de
  // guardar: se va a sumar ahí. Es lo que pasa con "Ya es cliente" en el alta
  // de un turno.
  const producto = limpiarProducto(form);
  const igual = producto.nombre ? buscarIgual(insumos, producto) : null;

  const porCajaValido = Number.isInteger(Number(form.porCaja)) && Number(form.porCaja) >= 1;
  const motivo = guardando
    ? "se está guardando"
    : !form.nombre.trim()
    ? "falta el nombre"
    : enCaja && !porCajaValido
      ? "falta cuántos vienen en cada caja"
      : igual && producto.cantidad < 1
        ? "falta cuántos agregás"
        : null;

  function crearCategoria() {
    const texto = nueva.trim().replace(/\s+/g, " ");
    if (!texto) return;
    // "tornillos" al lado de "Tornillos" es la misma: se elige la que hay.
    const existente = categoriaExistente(texto, categorias);
    if (existente) {
      cambiar({ categoria: existente });
      setAvisoCategoria(`«${existente}» ya estaba. La dejamos elegida.`);
    } else {
      setAgregadas((a) => [...a, texto]);
      cambiar({ categoria: texto });
      setAvisoCategoria(`Listo. «${texto}» queda guardada con ${articulo.el()}.`);
    }
    setNueva("");
    setCreando(false);
  }

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

      <Campo
        id="prod-nombre"
        etiqueta="Qué es"
        ayuda={`Con el nombre que usan en el mostrador. Ejemplo: ${ejemplosDe(negocio?.rubro).insumo}.`}
        value={form.nombre}
        onChange={(e) => cambiar({ nombre: e.target.value })}
        list="prod-conocidos"
        autoComplete="off"
      />
      {/* Lo que ya hay, para elegirlo en vez de escribirlo de otra manera. */}
      <datalist id="prod-conocidos">
        {[...new Set(insumos.filter((i) => i.estado === "en_stock").map((i) => i.nombre))].map(
          (n) => (
            <option key={n} value={n} />
          )
        )}
      </datalist>

      <div className="grid gap-x-4 @md:grid-cols-2">
        <Campo
          id="prod-marca"
          etiqueta="Marca"
          ayuda="Opcional."
          value={form.marca}
          onChange={(e) => cambiar({ marca: e.target.value })}
          autoComplete="off"
        />
        <Campo
          id="prod-modelo"
          etiqueta="Modelo"
          ayuda="Opcional."
          value={form.modelo}
          onChange={(e) => cambiar({ modelo: e.target.value })}
          autoComplete="off"
        />
      </div>

      {/* La categoría: las del rubro, las que ya usa el negocio, y "+ Nueva"
          al lado para la que no se nos ocurrió. Se crea ahí mismo, sin salir
          del alta. */}
      <div className="mb-6">
        <label htmlFor={creando ? "prod-categoria-nueva" : "prod-categoria"} className="block font-bold text-cuerpo">
          Categoría
        </label>
        <p id="prod-categoria-ayuda" className="mt-1 text-etiqueta text-tinta-media">
          Opcional. Sirve para ver el stock agrupado.
        </p>

        {creando ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="prod-categoria-nueva"
              autoFocus
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") crearCategoria();
                if (e.key === "Escape") setCreando(false);
              }}
              placeholder="Juntas, correas, cables…"
              className="block min-h-12 min-w-0 flex-1 rounded-campo border-2 border-azul bg-tarjeta px-4 text-cuerpo"
            />
            <Boton
              icono="check"
              motivo={!nueva.trim() ? "falta el nombre" : null}
              onClick={crearCategoria}
            >
              Agregar
            </Boton>
            <Boton variante="plano" icono="cruz" onClick={() => setCreando(false)}>
              No
            </Boton>
          </div>
        ) : (
          <div className="mt-2 flex gap-2">
            <select
              id="prod-categoria"
              aria-describedby="prod-categoria-ayuda"
              value={form.categoria}
              onChange={(e) => {
                cambiar({ categoria: e.target.value });
                setAvisoCategoria(null);
              }}
              className="block min-h-12 min-w-0 flex-1 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Boton
              icono="mas"
              className="shrink-0 px-4"
              onClick={() => {
                setAvisoCategoria(null);
                setCreando(true);
              }}
            >
              Nueva
            </Boton>
          </div>
        )}
        {avisoCategoria && (
          <p className="mt-2 flex items-start gap-2 font-bold text-completo text-etiqueta">
            <Icono nombre="listo" className="mt-px size-5" />
            <span>{avisoCategoria}</span>
          </p>
        )}
      </div>

      {/* Cómo viene. Una caja de cien tornillos se cuenta en cajas, que es
          como se cuenta en el estante; el total de tornillos sale solo. */}
      <div className="mb-6">
        <p className="font-bold text-cuerpo" id="prod-viene">
          Cómo viene
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="prod-viene">
          {[
            ["unidad", "Suelto"],
            ["caja", "En caja"],
          ].map(([clave, palabra]) => (
            <button
              key={clave}
              type="button"
              aria-pressed={form.unidad === clave}
              onClick={() => cambiar({ unidad: clave })}
              className={`${PILDORA} ${form.unidad === clave ? PILDORA_SI : PILDORA_NO}`}
            >
              {palabra}
            </button>
          ))}
        </div>
      </div>

      {enCaja && (
        <Campo
          id="prod-por-caja"
          etiqueta="Cuántos vienen en cada caja"
          type="number"
          min="1"
          inputMode="numeric"
          value={form.porCaja}
          onChange={(e) => cambiar({ porCaja: e.target.value })}
        />
      )}

      <div className="grid gap-x-4 @md:grid-cols-2">
        <Campo
          id="prod-cantidad"
          etiqueta={
            igual ? (enCaja ? "Cuántas cajas agregás" : "Cuántos agregás") : enCaja ? "Cuántas cajas tenés" : "Cuántos tenés"
          }
          ayuda={igual ? "Se suman a los que ya hay." : "El número de ahora."}
          type="number"
          min="0"
          inputMode="numeric"
          value={form.cantidad}
          onChange={(e) => cambiar({ cantidad: e.target.value })}
        />
        {/* Si ya existe, el mínimo es el que ya tiene: lo que se está
            haciendo es reponer, no volver a configurarlo. */}
        {!igual && (
          <Campo
            id="prod-minimo"
            etiqueta="Avisame cuando queden"
            ayuda={enCaja ? "En cajas. Debajo de este número te avisamos." : "Debajo de este número te avisamos."}
            type="number"
            min="0"
            inputMode="numeric"
            value={form.minimo}
            onChange={(e) => cambiar({ minimo: e.target.value })}
          />
        )}
      </div>

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
// Cada fila lleva su propio estado de "escribiendo la cantidad" y "¿borrar?".
// Antes vivían arriba, en la pantalla, con el id de la fila; acá adentro es
// lo mismo con menos cables.
function FilaDeStock({ insumo: i, conCategoria, puedeCargar, conEnCamino }) {
  const datos = useDatos();
  const [contando, setContando] = useState(false);
  const [cuantos, setCuantos] = useState("");
  const [borrando, setBorrando] = useState(false);

  const bajo = i.cantidad <= i.minimo;
  const enCaja = i.unidad === "caja";
  const total = enTotal(i);
  const nombre = i.nombre.toLowerCase();
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
            {/* Antes el aviso no llevaba a ningún lado: decía "pedí más" y no
                había dónde. Llega a "En camino" con el nombre ya puesto. */}
            {conEnCamino && puedeCargar && (
              <Link
                href={`/inventario/en-camino?pedir=${encodeURIComponent(i.nombre)}`}
                className="text-azul underline underline-offset-2"
              >
                Pedirlo
              </Link>
            )}
          </p>
        )}
      </div>

      {/* Los botones se ven como un signo, pero el lector de pantalla tiene
          que oír qué hacen y sobre qué: "menos", solo, no dice menos de qué
          (auditoría, accesibilidad). En caja se suma y se resta de a una caja,
          y lo dice. */}
      <div className="flex items-center gap-2">
        <Boton
          className="min-w-12 px-0"
          aria-label={enCaja ? `Quitar una caja de ${nombre}` : `Quitar uno de ${nombre}`}
          onClick={() => datos.ajustarCantidad(i.id, -1)}
          disabled={i.cantidad === 0}
        >
          −
        </Boton>
        {contando ? (
          <input
            autoFocus
            type="number"
            min="0"
            inputMode="numeric"
            aria-label={`La cantidad de ${nombre}`}
            value={cuantos}
            onChange={(e) => setCuantos(e.target.value)}
            onBlur={() => {
              datos.fijarCantidad(i.id, cuantos);
              setContando(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setContando(false);
            }}
            className="w-20 rounded-campo border-2 border-azul bg-tarjeta px-2 py-1 text-center font-titulo font-extrabold text-subtitulo tabular-nums"
          />
        ) : (
          /* Tocar el número lo vuelve escribible: después de un inventario
             físico se pasa de 3 a 40 de una (auditoría, H7). Los botones de a
             uno siguen para los ajustes chicos de todos los días. */
          <button
            type="button"
            aria-live="polite"
            aria-label={`Escribir la cantidad de ${nombre}. Ahora hay ${i.cantidad} ${presentacion(i, i.cantidad)}`}
            onClick={() => {
              setCuantos(String(i.cantidad));
              setContando(true);
            }}
            className="w-20 cursor-pointer rounded-campo py-1 text-center font-titulo font-extrabold text-subtitulo tabular-nums hover:bg-superficie"
          >
            {i.cantidad}
          </button>
        )}
        <Boton
          className="min-w-12 px-0"
          aria-label={enCaja ? `Sumar una caja de ${nombre}` : `Sumar uno de ${nombre}`}
          onClick={() => datos.ajustarCantidad(i.id, 1)}
        >
          +
        </Boton>
        <span className="whitespace-nowrap text-apoyo text-tinta-suave">
          {presentacion(i, i.cantidad)}
          {total !== null && <span className="block">{total} en total</span>}
        </span>
      </div>

      {borrando ? (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-campo bg-superficie p-3">
          <p className="flex-1">
            ¿Querés borrar {nombre} del inventario? Se pierde el número que tenías cargado.
          </p>
          <Boton
            variante="peligro"
            icono="tacho"
            onClick={() => {
              datos.eliminarInsumo(i.id);
              setBorrando(false);
            }}
          >
            Sí, borrarlo
          </Boton>
          <Boton variante="plano" onClick={() => setBorrando(false)}>
            Dejarlo como está
          </Boton>
        </div>
      ) : (
        <Boton variante="peligro" icono="tacho" onClick={() => setBorrando(true)}>
          Borrar
        </Boton>
      )}
    </li>
  );
}
