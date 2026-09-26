"use client";

// "En stock", la primera pantalla del Inventario: lo que hay y cuánto queda.
//
// Lo pedido que todavía no llegó se mudó a "En camino"
// (inventario/en-camino), que es su propio submódulo desde SCRUM-113.
//
// Los textos nombran lo que se guarda con la palabra del rubro —"repuesto" en
// un taller, "insumo" en un consultorio— a través de vocabulario(), en
// presets.js. Ninguna palabra del oficio se escribe a mano en esta pantalla.

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede } from "@/lib/permisos";
import { ejemplosDe, vocabulario } from "@/lib/presets";
import { hijosActivos } from "@/lib/modulos";
import Icono from "@/componentes/Icono";
import Pestanas from "@/componentes/Pestanas";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

export default function Inventario() {
  const datos = useDatos();
  const { usuario } = useAuth();
  const puedeCargar = puede(usuario?.rol, "cargarDatos");
  const { cargando, insumos, negocio } = datos;
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "", cantidad: "", minimo: "", unidad: "unidad" });
  const [porBorrar, setPorBorrar] = useState(null);
  // El insumo cuya cantidad se está escribiendo a mano, y lo escrito.
  const [contando, setContando] = useState(null);
  const [cuantos, setCuantos] = useState("");
  useTitulo("Inventario");

  if (cargando) return <Cargando />;

  const { articulo } = vocabulario(negocio?.rubro);
  const enStock = insumos.filter((i) => i.estado === "en_stock");
  const bajos = enStock.filter((i) => i.cantidad <= i.minimo);
  // "Conviene pedir más" lleva a pedirlo, si el negocio tiene dónde.
  const conEnCamino = hijosActivos("inventario", negocio?.modulos_activos ?? []).some(
    (h) => h.clave === "en_camino"
  );

  const motivo = !form.nombre.trim() ? "falta el nombre" : null;

  function guardar() {
    datos.agregarInsumo(form);
    datos.avisarExito(`Listo. ${form.nombre.trim()} ya está en el inventario.`);
    setForm({ nombre: "", descripcion: "", cantidad: "", minimo: "", unidad: "unidad" });
    setAbierto(false);
  }

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
        {puedeCargar && (
        <Boton icono="mas" onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cerrar el alta" : `Agregar ${articulo.un()}`}
        </Boton>
        )}
      </div>

      {abierto && puedeCargar && (
        <Tarjeta className="mb-8 max-w-[560px]">
          <TituloSeccion>
            {articulo.segun("Nuevo", "Nueva")} {articulo.palabra()}
          </TituloSeccion>
          <Campo
            id="ins-nombre"
            etiqueta="Qué es"
            ayuda={`Con el nombre que usan en el mostrador. Ejemplo: ${ejemplosDe(negocio?.rubro).insumo}.`}
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <div className="grid gap-4 @md:grid-cols-2">
            <Campo
              id="ins-cantidad"
              etiqueta="Cuántos tenés"
              ayuda="El número de ahora."
              type="number"
              min="0"
              inputMode="numeric"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            />
            <Campo
              id="ins-minimo"
              etiqueta="Avisame cuando queden"
              ayuda="Debajo de este número te avisamos."
              type="number"
              min="0"
              inputMode="numeric"
              value={form.minimo}
              onChange={(e) => setForm({ ...form, minimo: e.target.value })}
            />
          </div>
          <Boton variante="principal" icono="check" motivo={motivo} onClick={guardar}>
            Guardar {articulo.el()}
          </Boton>
        </Tarjeta>
      )}

      <TituloSeccion>
        Lo que tenés{bajos.length > 0 && ` · ${bajos.length} por debajo del mínimo`}
      </TituloSeccion>

      {enStock.length === 0 ? (
        <Vacio icono="cajas" titulo="Todavía no hay nada cargado">
          Agregá lo que más usás y te avisamos cuando esté por acabarse.
        </Vacio>
      ) : (
        <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
          {enStock.map((i) => {
            const bajo = i.cantidad <= i.minimo;
            return (
              <li
                key={i.id}
                className="flex flex-wrap items-center gap-4 border-b border-borde p-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{i.nombre}</p>
                  {i.descripcion && <p className="text-apoyo text-tinta-suave">{i.descripcion}</p>}
                  {bajo && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 font-bold text-espera text-etiqueta">
                      <Icono nombre="alerta" className="size-5" />
                      Quedan {i.cantidad}. Conviene pedir más.
                      {/* Antes el aviso no llevaba a ningún lado: decía
                          "pedí más" y no había dónde. Llega a "En camino"
                          con el nombre ya puesto. */}
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

                {/* Los botones se ven como un signo, pero el lector de
                    pantalla tiene que oír qué hacen y sobre qué: "menos",
                    solo, no dice menos de qué (auditoría, accesibilidad). El
                    número se anuncia al cambiar, así se sabe cómo quedó. */}
                <div className="flex items-center gap-2">
                  <Boton
                    className="min-w-12 px-0"
                    aria-label={`Quitar uno de ${i.nombre.toLowerCase()}`}
                    onClick={() => datos.ajustarCantidad(i.id, -1)}
                    disabled={i.cantidad === 0}
                  >
                    −
                  </Boton>
                  {contando === i.id ? (
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      inputMode="numeric"
                      aria-label={`La cantidad de ${i.nombre.toLowerCase()}`}
                      value={cuantos}
                      onChange={(e) => setCuantos(e.target.value)}
                      onBlur={() => {
                        datos.fijarCantidad(i.id, cuantos);
                        setContando(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setContando(null);
                      }}
                      className="w-20 rounded-campo border-2 border-azul bg-tarjeta px-2 py-1 text-center font-titulo font-extrabold text-subtitulo tabular-nums"
                    />
                  ) : (
                    /* Tocar el número lo vuelve escribible: después de un
                       inventario físico se pasa de 3 a 40 de una (auditoría,
                       H7). Los botones de a uno siguen para los ajustes
                       chicos de todos los días. */
                    <button
                      type="button"
                      aria-live="polite"
                      aria-label={`Escribir la cantidad de ${i.nombre.toLowerCase()}. Ahora hay ${i.cantidad}`}
                      onClick={() => {
                        setCuantos(String(i.cantidad));
                        setContando(i.id);
                      }}
                      className="w-20 cursor-pointer rounded-campo py-1 text-center font-titulo font-extrabold text-subtitulo tabular-nums hover:bg-superficie"
                    >
                      {i.cantidad}
                    </button>
                  )}
                  <Boton
                    className="min-w-12 px-0"
                    aria-label={`Sumar uno de ${i.nombre.toLowerCase()}`}
                    onClick={() => datos.ajustarCantidad(i.id, 1)}
                  >
                    +
                  </Boton>
                  <span className="w-16 text-apoyo text-tinta-suave">{i.unidad}</span>
                </div>

                {porBorrar === i.id ? (
                  <div className="flex w-full flex-wrap items-center gap-2 rounded-campo bg-superficie p-3">
                    <p className="flex-1">
                      ¿Querés borrar {i.nombre.toLowerCase()} del inventario? Se pierde el
                      número que tenías cargado.
                    </p>
                    <Boton
                      variante="peligro"
                      icono="tacho"
                      onClick={() => {
                        datos.eliminarInsumo(i.id);
                        setPorBorrar(null);
                      }}
                    >
                      Sí, borrarlo
                    </Boton>
                    <Boton variante="plano" onClick={() => setPorBorrar(null)}>
                      Dejarlo como está
                    </Boton>
                  </div>
                ) : (
                  <Boton variante="peligro" icono="tacho" onClick={() => setPorBorrar(i.id)}>
                    Borrar
                  </Boton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
