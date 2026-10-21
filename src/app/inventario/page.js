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

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { puede } from "@/lib/permisos";
import { mayuscula, vocabulario } from "@/lib/presets";
import { hijosActivos } from "@/lib/modulos";
import {
  alternarFiltro,
  buscarEnCategorias,
  buscarIgual,
  categoriaEnIdioma,
  categoriaExistente,
  categoriasDisponibles,
  claveDeCategoria,
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
import Buscador from "@/componentes/Buscador";
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
  const puedeCargar = puede(usuario, "editar_inventario");
  const { cargando, insumos, negocio } = datos;
  const [abierto, setAbierto] = useState(false);
  const [editandoCategorias, setEditandoCategorias] = useState(false);
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
  const { idioma, t } = useIdioma();
  useTitulo(t("inventario.titulo"));

  if (cargando) return <Cargando />;

  const rubro = negocio?.rubro;
  const { articulo } = vocabulario(rubro, idioma);
  const enStock = insumos.filter((i) => i.estado === "en_stock");
  const bajos = enStock.filter((i) => i.cantidad <= i.minimo);

  // Los filtros salen de lo que tienen cargado los productos, y de lo elegido
  // se queda sólo lo que todavía existe (lib/inventario.js).
  const grupos = filtrosDisponibles(enStock, { rubro, idioma, t });
  const activos = soloVigentes(elegidos, grupos);
  const nFiltros = cuantosFiltros(activos);
  const visibles = filtrarProductos(enStock, { texto: busquedaProductos, elegidos: activos, rubro, idioma });
  const filtrando = busquedaProductos.trim() !== "" || nFiltros > 0;
  const limpiarTodo = () => {
    setBusquedaProductos("");
    setElegidos({});
  };

  const categorias = porCategoria(enStock, { rubro, idioma, t });
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
          <h1 className="text-pantalla">{t("inventario.titulo")}</h1>
          <p className="mt-1 text-tinta-media">
            {t("inventario.apoyo")}
          </p>
        </div>
        {/* El mismo arreglo que "Anotar un turno": mientras el alta está
            abierta el botón se apaga en su lugar, en gris, y dice por qué. No
            cambia de texto ni cierra el alta: el lugar de "Agregar" siempre
            hace lo mismo, y no se pueden abrir dos. Salir es "Cancelar". */}
        {/* En Categorías el lugar del botón es para editar la lista: agregar
            un producto ya está en la otra vista. */}
        {puedeCargar && vista === "categorias" ? (
          <Boton
            icono="pincel"
            motivo={editandoCategorias ? t("inventario.yaLasEditas") : null}
            onClick={() => setEditandoCategorias(true)}
          >
            {t("inventario.editarCategorias")}
          </Boton>
        ) : (
          puedeCargar && (
            <Boton
              icono="mas"
              motivo={abierto ? t(`inventario.yaAgregando.${articulo.segun("m", "f")}`) : null}
              onClick={() => setAbierto(true)}
            >
              {t("inventario.agregar", { articulo: articulo.un() })}
            </Boton>
          )
        )}
      </div>

      {abierto && puedeCargar && vista === "productos" && <AltaDeProducto alCerrar={() => setAbierto(false)} />}
      {editandoCategorias && puedeCargar && vista === "categorias" && (
        <EdicionDeCategorias alCerrar={() => setEditandoCategorias(false)} />
      )}

      {enStock.length === 0 ? (
        <Vacio icono="cajas" titulo={t("inventario.vacioTitulo")}>
          {t("inventario.vacioTexto")}
        </Vacio>
      ) : (
        <>
          {/* Las dos maneras de mirar el stock. Van debajo del alta y arriba
              de la lista porque cambian la lista, no la pantalla. */}
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t("inventario.comoVer")}>
            {[
              ["productos", mayuscula(articulo.palabra(2)), "cajas"],
              ["categorias", t("inventario.vistaCategorias"), "secciones"],
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
                  etiqueta={t("inventario.buscar", { articulo: articulo.un() })}
                  ayuda={t("inventario.buscarAyuda")}
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
                    {t("inventario.filtros")}{nFiltros > 0 && ` · ${nFiltros}`}
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
                      {t("inventario.sacarFiltros")}
                    </Boton>
                  )}
                </div>
              )}

              <TituloSeccion>
                {bajos.length > 0
                  ? t("inventario.loQueTenesBajos", { n: bajos.length })
                  : t("inventario.loQueTenes")}
              </TituloSeccion>

              {/* Cuánto se está viendo, para que una lista corta no se lea como
                  un stock que se vació. */}
              {filtrando && visibles.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-tinta-media">
                    {t("inventario.cuantosDe", { n: visibles.length, total: articulo.cuantos(enStock.length) })}
                  </p>
                  <Boton variante="plano" icono="cruz" onClick={limpiarTodo}>
                    {t("inventario.verTodo")}
                  </Boton>
                </div>
              )}

              {visibles.length === 0 ? (
                <Vacio icono="buscar" titulo={t("inventario.sinCoincidenciaTitulo", { palabra: articulo.palabra(2) })}>
                  {t("inventario.sinCoincidenciaTexto")}
                  <span className="mt-4 block">
                    <Boton icono="cruz" onClick={limpiarTodo}>
                      {t("inventario.verTodo")}
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
                  etiqueta={t("inventario.buscarCategoria")}
                  ayuda={t("inventario.buscarCategoriaAyuda", { articulo: articulo.un() })}
                  valor={busquedaCategorias}
                  alCambiar={setBusquedaCategorias}
                />
              </div>

              <TituloSeccion>
                {bajos.length > 0
                  ? t("inventario.loQueTenesBajos", { n: bajos.length })
                  : t("inventario.loQueTenes")}
              </TituloSeccion>

              {categoriasVisibles.length === 0 ? (
                <Vacio icono="buscar" titulo={t("inventario.ningunaTitulo")}>
                  {t("inventario.ningunaTexto", { articulo: articulo.un() })}
                  <span className="mt-4 block">
                    <Boton icono="cruz" onClick={() => setBusquedaCategorias("")}>
                      {t("inventario.verTodas")}
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
                            ? t("inventario.cuantosDe", { n: g.productos.length, total: articulo.cuantos(total) })
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
// El alta de un producto
// ------------------------------------------------------------
// Los campos son los de componentes/Producto.js, los mismos que pedir y editar.

function AltaDeProducto({ alCerrar }) {
  const datos = useDatos();
  const { insumos, negocio } = datos;
  const { idioma, t } = useIdioma();
  const [form, setForm] = useState(PRODUCTO_VACIO);
  // Mientras la API contesta, el botón no se puede volver a tocar: un
  // segundo toque sería otro pedido y sumaría dos veces.
  const [guardando, setGuardando] = useState(false);

  const { articulo } = vocabulario(negocio?.rubro, idioma);
  const cambiar = (que) => setForm((f) => ({ ...f, ...que }));
  const enCaja = form.unidad === "caja";

  // Si lo que se está escribiendo ya está en el stock, se avisa ANTES de
  // guardar: se va a sumar ahí. Es lo que pasa con "Ya es cliente" en el alta
  // de un turno.
  const producto = limpiarProducto(form);
  const igual = producto.nombre ? buscarIgual(insumos, producto) : null;

  const motivo = guardando
    ? t("inventario.guardandoMotivo")
    : (motivoDelProducto(form, {}, t) ?? (igual && producto.cantidad < 1 ? t("inventario.alta.faltaCuantos") : null));

  async function guardar() {
    setGuardando(true);
    const r = await datos.agregarInsumo(form);
    setGuardando(false);
    // Si no se pudo, el aviso ya lo dio datos.js; el formulario queda abierto
    // con lo escrito, para volver a probar.
    if (!r) return;
    datos.avisarExito(
      r.sumado
        ? t("inventario.alta.sumado", {
            n: r.insumo.cantidad - r.antes,
            nombre: r.insumo.nombre,
            total: r.insumo.cantidad,
            presentacion: presentacion(r.insumo, r.insumo.cantidad, t),
          })
        : t("inventario.alta.agregado", { nombre: r.insumo.nombre })
    );
    alCerrar();
  }

  return (
    <Tarjeta className="mb-8 max-w-[640px]">
      <TituloSeccion>
        {t(`inventario.alta.nuevo.${articulo.segun("m", "f")}`, { palabra: articulo.palabra() })}
      </TituloSeccion>

      {/* Si ya existe, el mínimo es el que ya tiene: lo que se está haciendo
          es reponer, no volver a configurarlo. */}
      <CamposDeProducto
        prefijo="prod"
        form={form}
        cambiar={cambiar}
        etiquetaCantidad={t(
          igual
            ? enCaja ? "inventario.alta.cuantasCajasAgregas" : "inventario.alta.cuantosAgregas"
            : enCaja ? "inventario.alta.cuantasCajasTenes" : "inventario.alta.cuantosTenes"
        )}
        ayudaCantidad={t(igual ? "inventario.alta.sumanAHay" : "inventario.alta.numeroAhora")}
        conMinimo={!igual}
      />

      {/* Dos iguales no son dos filas: se suman. Se avisa acá, antes de
          tocar Guardar, y el botón dice lo que va a pasar. */}
      {igual && (
        <p className="mb-6 flex items-start gap-2 rounded-campo bg-azul-claro p-3 font-bold text-azul">
          <Icono nombre="cajas" className="mt-0.5 size-5 shrink-0" />
          <span>
            {t(`inventario.alta.yaLoTenes.${articulo.segun("m", "f")}`, {
              n: igual.cantidad,
              presentacion: presentacion(igual, igual.cantidad, t),
            })}
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
          {igual ? t("inventario.alta.sumarlo") : t("inventario.alta.guardar", { articulo: articulo.el() })}
        </Boton>
        <Boton variante="peligro" icono="tacho" className="w-full sm:w-auto" onClick={alCerrar}>
          {t("casos.comun.cancelar")}
        </Boton>
      </div>
    </Tarjeta>
  );
}

// ------------------------------------------------------------
// Editar categorías
// ------------------------------------------------------------
// La lista entera: las que ofrece el alta de un producto. Se borra y se
// agrega sobre un borrador, y recién "Guardar" la manda. Lo que tenía una
// categoría borrada queda en "Sin categoría" (lo hace la API), y se avisa
// en la fila antes de guardar.

function EdicionDeCategorias({ alCerrar }) {
  const datos = useDatos();
  const { insumos, negocio } = datos;
  const { idioma, t } = useIdioma();
  const [lista, setLista] = useState(() =>
    categoriasDisponibles(negocio?.rubro, insumos, [], datos.categorias, idioma)
  );
  const [nueva, setNueva] = useState("");
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const { articulo } = vocabulario(negocio?.rubro, idioma);
  // Contar por la clave de la categoría: lo guardado como "Filtros" cuenta en "Filters".
  const cuantos = (c) =>
    insumos.filter((i) => claveDeCategoria(i.categoria, negocio?.rubro) === claveDeCategoria(c, negocio?.rubro)).length;
  const borradas = categoriasDisponibles(negocio?.rubro, insumos, [], datos.categorias, idioma).filter(
    (c) => !categoriaExistente(c, lista, negocio?.rubro)
  );
  const quedanSin = borradas.reduce((n, c) => n + cuantos(c), 0);

  function agregar() {
    const texto = nueva.trim().replace(/\s+/g, " ");
    if (!texto) return;
    const existente = categoriaExistente(texto, lista, negocio?.rubro);
    setAviso(existente ? { categoria: existente } : null);
    if (!existente) setLista((l) => [...l, texto]);
    setNueva("");
  }

  async function guardar() {
    setGuardando(true);
    const ok = await datos.guardarCategorias(lista);
    setGuardando(false);
    if (!ok) return;
    datos.avisarExito(t("inventario.categorias.guardadas"));
    alCerrar();
  }

  return (
    <Tarjeta className="mb-8 max-w-[640px]">
      <TituloSeccion>{t("inventario.editarCategorias")}</TituloSeccion>

      {lista.length === 0 ? (
        <p className="mb-4 text-tinta-media">{t("inventario.categorias.ninguna")}</p>
      ) : (
        <ul className="mb-4 overflow-hidden rounded-tarjeta border border-borde">
          {lista.map((c) => {
            const n = cuantos(c);
            return (
              <li key={c} className="flex flex-wrap items-center gap-3 border-b border-borde p-3 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{c}</span>
                  {n > 0 && <span className="text-apoyo text-tinta-suave"> · {articulo.cuantos(n)}</span>}
                </span>
                <Boton
                  variante="peligro"
                  icono="tacho"
                  aria-label={t("inventario.categorias.borrarAria", { categoria: c })}
                  onClick={() => setLista((l) => l.filter((x) => x !== c))}
                >
                  {t("inventario.categorias.borrar")}
                </Boton>
              </li>
            );
          })}
        </ul>
      )}

      <label htmlFor="categoria-nueva-lista" className="block font-bold text-cuerpo">
        {t("inventario.categorias.nueva")}
      </label>
      <div className="mt-2 mb-4 flex flex-wrap gap-2">
        <input
          id="categoria-nueva-lista"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder={t("inventario.categorias.ejemplo")}
          maxLength={60}
          className="block min-h-12 min-w-0 flex-1 rounded-campo border-2 border-borde bg-tarjeta px-4 text-cuerpo"
        />
        <Boton icono="mas" motivo={!nueva.trim() ? t("ui.validaciones.faltaNombre") : null} onClick={agregar}>
          {t("inventario.categorias.agregar")}
        </Boton>
      </div>
      {aviso && <p className="mb-4 font-bold text-azul">{t("inventario.categorias.yaEstaba", aviso)}</p>}

      {quedanSin > 0 && (
        <p className="mb-6 flex items-start gap-2 rounded-campo bg-azul-claro p-3 font-bold text-azul">
          <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
          <span>
            {t("inventario.categorias.quedanSin", {
              cuantos: articulo.cuantos(quedanSin),
              sinCategoria: t("inventario.sinCategoria"),
            })}
          </span>
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton
          variante="principal"
          icono="check"
          motivo={guardando ? t("inventario.guardandoMotivo") : null}
          className="w-full sm:w-auto"
          onClick={guardar}
        >
          {t("inventario.categorias.guardar")}
        </Boton>
        <Boton variante="plano" className="w-full sm:w-auto" onClick={alCerrar}>
          {t("casos.comun.cancelar")}
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
//
// En celular la fila es una columna —el nombre y el aviso a todo el ancho,
// después la cantidad, después "Editar"— y desde sm vuelve a ser la fila de
// siempre. Antes eran tres bloques en una sola fila, con el texto en flex-1:
// el texto se achicaba hasta quedar una palabra por línea y el aviso de
// "Conviene pedir más", que es lo que hay que leer, se estiraba hacia abajo.
function FilaDeStock({ insumo: i, conCategoria, puedeCargar, conEnCamino }) {
  const [editando, setEditando] = useState(false);
  const { negocio } = useDatos();
  const { idioma, t } = useIdioma();
  const categoria = i.categoria ? categoriaEnIdioma(i.categoria, negocio?.rubro, idioma) : i.categoria;

  const bajo = i.cantidad <= i.minimo;
  const total = enTotal(i);
  const detalle = [i.marca, i.modelo].filter(Boolean).join(" · ");

  return (
    <li className="flex flex-col gap-3 border-b border-borde p-4 last:border-b-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      {/* min-w-0 deja que el texto se encoja en vez de empujar la fila, y
          overflow-wrap corta lo que no tiene espacios. El flex-1 es sólo
          desde sm: en una columna significaría "crecer hacia abajo". */}
      <div className="min-w-0 sm:flex-1">
        <p className="font-bold [overflow-wrap:anywhere]">{i.nombre}</p>
        {(detalle || (conCategoria && categoria)) && (
          <p className="text-apoyo text-tinta-suave [overflow-wrap:anywhere]">
            {detalle}
            {detalle && conCategoria && categoria && " · "}
            {conCategoria && categoria}
          </p>
        )}
        {i.descripcion && (
          <p className="text-apoyo text-tinta-suave [overflow-wrap:anywhere]">{i.descripcion}</p>
        )}
        {bajo && (
          // El ícono queda al lado de la primera línea y el texto, con el
          // "Pedirlo" adentro, fluye a su lado: antes cada pieza era un ítem
          // de la fila y el ícono se quedaba solo en una línea.
          <p className="mt-1 flex items-start gap-1.5 font-bold text-espera text-etiqueta">
            <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
            <span className="min-w-0">
              {t("inventario.fila.quedan", { n: i.cantidad, presentacion: presentacion(i, i.cantidad, t) })}{" "}
              {/* Llega a "En camino" con todos los datos de este producto: al
                  llegar, se suma a éste y no queda otra fila. */}
              {conEnCamino && puedeCargar && (
                <Link
                  href={`/inventario/en-camino?reponer=${encodeURIComponent(i.id)}`}
                  className="text-azul underline underline-offset-2"
                >
                  {t("inventario.fila.pedirlo")}
                </Link>
              )}
            </span>
          </p>
        )}
      </div>

      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-titulo font-extrabold text-subtitulo tabular-nums">{i.cantidad}</span>
        <span className="min-w-0 text-apoyo text-tinta-suave [overflow-wrap:anywhere] sm:whitespace-nowrap">
          {presentacion(i, i.cantidad, t)}
          {total !== null && <span className="block">{t("inventario.fila.enTotal", { n: total })}</span>}
        </span>
      </p>

      {puedeCargar && (
        <Boton
          icono="pincel"
          className="w-full sm:w-auto"
          motivo={editando ? t("inventario.editandoMotivo") : null}
          onClick={() => setEditando(true)}
        >
          {t("inventario.editar")}
        </Boton>
      )}

      {editando && <EdicionDeProducto insumo={i} alCerrar={() => setEditando(false)} />}
    </li>
  );
}