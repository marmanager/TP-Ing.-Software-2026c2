"use client";

// Un producto del inventario: sus campos y su edición.
//
// Los campos son los mismos en los tres lugares donde se carga uno —el alta
// en "En stock", pedirlo en "En camino" y "Editar"—, porque lo pedido termina
// en el mismo estante que lo que ya había: al llegar se suma a uno igual por
// nombre, marca, modelo y cómo viene, y sin esos datos nunca coincidía.
//
// Lo que no es de pantalla (cuándo dos son el mismo, qué falta para guardar)
// está en lib/inventario.js, con sus pruebas.

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { ejemplosDe, vocabulario } from "@/lib/presets";
import { casoEnFrase } from "@/lib/nombres";
import {
  categoriaExistente,
  categoriasDisponibles,
  formDeProducto,
  igualAlEditar,
  limpiarProducto,
  motivoDelProducto,
  presentacion,
} from "@/lib/inventario";
import Icono from "./Icono";
import { Boton, Campo } from "./ui";

export const PILDORA =
  "flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-etiqueta";
export const PILDORA_SI = "border-azul bg-azul-claro font-bold text-azul";
export const PILDORA_NO = "border-borde bg-tarjeta text-tinta-media hover:bg-superficie";

export const PRODUCTO_VACIO = {
  nombre: "",
  marca: "",
  modelo: "",
  categoria: "",
  cantidad: "",
  minimo: "",
  unidad: "unidad",
  porCaja: "",
};

// ------------------------------------------------------------
// Los campos
// ------------------------------------------------------------
// `prefijo` hace únicos los id: puede haber un alta y una edición abiertas a
// la vez. La cantidad dice distinto según dónde ("Cuántos tenés", "Cuántos
// pedís", "Cuántos hay"), y el mínimo se esconde cuando lo cargado se va a
// sumar a uno que ya existe: ése conserva el suyo.
export function CamposDeProducto({ prefijo, form, cambiar, etiquetaCantidad, ayudaCantidad, conMinimo = true }) {
  const { insumos, negocio } = useDatos();
  // Las categorías recién creadas con "+ Nueva" que todavía no usa ningún
  // producto. Se guardan de verdad cuando se guarda el producto que las usa.
  const [agregadas, setAgregadas] = useState([]);
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState("");
  const [avisoCategoria, setAvisoCategoria] = useState(null);

  const { articulo } = vocabulario(negocio?.rubro);
  const enCaja = form.unidad === "caja";
  const categorias = categoriasDisponibles(negocio?.rubro, insumos, agregadas);
  const id = (que) => `${prefijo}-${que}`;

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

  return (
    <>
      <Campo
        id={id("nombre")}
        etiqueta="Qué es"
        ayuda={`Con el nombre que usan en el mostrador. Ejemplo: ${ejemplosDe(negocio?.rubro).insumo}.`}
        value={form.nombre}
        onChange={(e) => cambiar({ nombre: e.target.value })}
        list={id("conocidos")}
        autoComplete="off"
      />
      {/* Lo que ya hay, para elegirlo en vez de escribirlo de otra manera. */}
      <datalist id={id("conocidos")}>
        {[...new Set(insumos.filter((i) => i.estado === "en_stock").map((i) => i.nombre))].map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="grid gap-x-4 @md:grid-cols-2">
        <Campo
          id={id("marca")}
          etiqueta="Marca"
          ayuda="Opcional."
          value={form.marca}
          onChange={(e) => cambiar({ marca: e.target.value })}
          autoComplete="off"
        />
        <Campo
          id={id("modelo")}
          etiqueta="Modelo"
          ayuda="Opcional."
          value={form.modelo}
          onChange={(e) => cambiar({ modelo: e.target.value })}
          autoComplete="off"
        />
      </div>

      {/* La categoría: las del rubro, las que ya usa el negocio, y "+ Nueva"
          al lado para la que no se nos ocurrió. Se crea ahí mismo. */}
      <div className="mb-6">
        <label htmlFor={creando ? id("categoria-nueva") : id("categoria")} className="block font-bold text-cuerpo">
          Categoría
        </label>
        <p id={id("categoria-ayuda")} className="mt-1 text-etiqueta text-tinta-media">
          Opcional. Sirve para ver el stock agrupado.
        </p>

        {creando ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id={id("categoria-nueva")}
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
            <Boton icono="check" motivo={!nueva.trim() ? "falta el nombre" : null} onClick={crearCategoria}>
              Agregar
            </Boton>
            <Boton variante="plano" icono="cruz" onClick={() => setCreando(false)}>
              No
            </Boton>
          </div>
        ) : (
          <div className="mt-2 flex gap-2">
            <select
              id={id("categoria")}
              aria-describedby={id("categoria-ayuda")}
              value={form.categoria}
              onChange={(e) => {
                cambiar({ categoria: e.target.value });
                setAvisoCategoria(null);
              }}
              className="block min-h-12 min-w-0 flex-1 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
            >
              <option value="">Sin categoría</option>
              {/* La que ya tiene un producto que se edita aparece aunque ya no
                  la use nadie más. */}
              {[...new Set([...categorias, ...(form.categoria ? [form.categoria] : [])])].map((c) => (
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
        <p className="font-bold text-cuerpo" id={id("viene")}>
          Cómo viene
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby={id("viene")}>
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
          id={id("por-caja")}
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
          id={id("cantidad")}
          etiqueta={etiquetaCantidad}
          ayuda={ayudaCantidad}
          type="number"
          min="0"
          inputMode="numeric"
          value={form.cantidad}
          onChange={(e) => cambiar({ cantidad: e.target.value })}
        />
        {conMinimo && (
          <Campo
            id={id("minimo")}
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
    </>
  );
}

// ------------------------------------------------------------
// Editar un producto
// ------------------------------------------------------------
// Se abre con el "Editar" de cada fila, en "En stock" y en "En camino". Es la
// única manera de cambiar la cantidad o borrar: el − y el + de la lista
// cambiaban el stock de un toque sin querer, y el tacho estaba a la vista.
//
// Si un producto del stock queda igual a otro, se avisa antes de guardar y
// el botón dice "Juntarlos": queda el que ya estaba, con su mínimo y su
// categoría, y se le suma la cantidad. Un pedido no se junta, y su caso se
// ve pero no se cambia: para otro caso, se borra y se pide de nuevo.
export function EdicionDeProducto({ insumo, alCerrar }) {
  const datos = useDatos();
  const { insumos, casos } = datos;
  const [form, setForm] = useState(() => formDeProducto(insumo));
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const cambiar = (que) => setForm((f) => ({ ...f, ...que }));

  const pedido = insumo.estado === "pedido";
  const enCaja = form.unidad === "caja";
  const caso = pedido ? casos.find((c) => c.id === insumo.caso_id) : null;
  const igual = igualAlEditar(insumos, insumo, form);
  const nombre = insumo.nombre.toLowerCase();
  const motivo = guardando ? "se está guardando" : motivoDelProducto(form, { desdeUno: pedido });

  async function guardar() {
    setGuardando(true);
    const r = await datos.editarInsumo(insumo.id, form);
    setGuardando(false);
    // Si no se pudo, el aviso ya lo dio datos.js; queda abierto con lo escrito.
    if (!r) return;
    datos.avisarExito(
      r.borrado
        ? `Listo. Quedaron juntos: hay ${r.insumo.cantidad} ${presentacion(r.insumo, r.insumo.cantidad)} de ${r.insumo.nombre}.`
        : `Listo. Guardaste los cambios de ${r.insumo.nombre}.`
    );
    alCerrar();
  }

  function borrar() {
    datos.eliminarInsumo(insumo.id);
    alCerrar();
  }

  return (
    <div className="@container w-full rounded-tarjeta border border-borde bg-superficie p-4">
      {pedido && (
        <p className="mb-4 text-tinta-media">
          {caso ? (
            <>
              Es para el{" "}
              <Link href={`/casos/${caso.id}`} className="font-bold text-azul">
                {casoEnFrase(caso)}
              </Link>
              . Para pedirlo para otro, borralo y pedilo de nuevo.
            </>
          ) : (
            "Es para reponer el stock."
          )}
        </p>
      )}

      <CamposDeProducto
        prefijo={`editar-${insumo.id}`}
        form={form}
        cambiar={cambiar}
        etiquetaCantidad={
          pedido ? (enCaja ? "Cuántas cajas pedís" : "Cuántos pedís") : enCaja ? "Cuántas cajas hay" : "Cuántos hay"
        }
        ayudaCantidad={pedido ? "Desde 1." : "El número de ahora, después de contar."}
        conMinimo={!igual}
      />

      {igual && (
        <p className="mb-6 flex items-start gap-2 rounded-campo bg-azul-claro p-3 font-bold text-azul">
          <Icono nombre="cajas" className="mt-0.5 size-5 shrink-0" />
          <span>
            Ya hay otro igual, con {igual.cantidad} {presentacion(igual, igual.cantidad)}. Al guardar se
            juntan en uno: quedan {igual.cantidad + limpiarProducto(form).cantidad}.
          </span>
        </p>
      )}

      {borrando ? (
        <div className="flex flex-wrap items-center gap-2 rounded-campo bg-tarjeta p-3">
          <p className="flex-1">
            {!pedido
              ? `¿Querés borrar ${nombre} del inventario? Se pierde el número que tenías cargado.`
              : caso
                ? `¿Querés borrar el pedido de ${nombre}? El ${casoEnFrase(caso)} sigue esperando: si ya no hace falta, cambialo desde el caso.`
                : `¿Querés borrar el pedido de ${nombre}?`}
          </p>
          <Boton variante="peligro" icono="tacho" onClick={borrar}>
            Sí, borrarlo
          </Boton>
          <Boton variante="plano" onClick={() => setBorrando(false)}>
            Dejarlo como está
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Boton variante="principal" icono="check" motivo={motivo} className="w-full sm:w-auto" onClick={guardar}>
            {igual ? "Juntarlos" : "Guardar los cambios"}
          </Boton>
          <Boton variante="plano" className="w-full sm:w-auto" onClick={alCerrar}>
            Cancelar
          </Boton>
          {/* Borrar va aparte, a la derecha, y pregunta antes. */}
          <Boton
            variante="peligro"
            icono="tacho"
            className="w-full sm:ml-auto sm:w-auto"
            disabled={guardando}
            onClick={() => setBorrando(true)}
          >
            Borrar
          </Boton>
        </div>
      )}
    </div>
  );
}
