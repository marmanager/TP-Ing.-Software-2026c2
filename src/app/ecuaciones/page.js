"use client";

import { useState } from "react";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import {
  Boton,
  Campo,
  Cargando,
  ErrorGeneral,
  Tarjeta,
  TituloPantalla,
  TituloSeccion,
  Vacio,
} from "@/componentes/ui";

const VACIA = { nombre: "", formula: "", descripcion: "", categoria: "" };

export default function Ecuaciones() {
  const datos = useDatos();
  const [form, setForm] = useState(VACIA);
  const [creando, setCreando] = useState(false);
  const [errores, setErrores] = useState({});
  const [duplicada, setDuplicada] = useState(false);
  useTitulo("Ecuaciones personalizadas");

  const cambiar = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => ({ ...actual, [campo]: null, general: null }));
    setDuplicada(false);
  };

  async function guardar(confirmarVariante = false) {
    setErrores({});
    setDuplicada(false);
    const resultado = await datos.crearEcuacion({ ...form, confirmarVariante });
    if (resultado.duplicada) {
      setDuplicada(true);
      return;
    }
    if (!resultado.ok) {
      setErrores(resultado.campo ? { [resultado.campo]: resultado.error } : { general: resultado.error });
      return;
    }
    setForm(VACIA);
    setCreando(false);
    datos.avisarExito("Listo. La ecuación quedó guardada.");
  }

  const cancelar = () => {
    setForm(VACIA);
    setErrores({});
    setDuplicada(false);
    setCreando(false);
  };

  if (datos.cargando) return <Cargando />;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <TituloPantalla apoyo="Guardá fórmulas para volver a usarlas más adelante.">
        Ecuaciones personalizadas
      </TituloPantalla>

      {!creando ? (
        <>
          <Boton variante="principal" icono="mas" onClick={() => setCreando(true)}>
            Crear una ecuación
          </Boton>
          <TituloSeccion className="mt-10">Ecuaciones guardadas</TituloSeccion>
          {!datos.ecuaciones.length ? (
            <Vacio titulo="No hay ecuaciones guardadas">Creá la primera para verla acá.</Vacio>
          ) : (
            <ul className="space-y-3">
              {datos.ecuaciones.map((ecuacion) => (
                <li key={ecuacion.id}>
                  <Tarjeta>
                    <p className="font-bold">{ecuacion.nombre}</p>
                    <p className="mt-1 font-mono">{ecuacion.formula}</p>
                    {ecuacion.descripcion && <p className="mt-2 text-tinta-media">{ecuacion.descripcion}</p>}
                  </Tarjeta>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Tarjeta>
          <TituloSeccion>Crear una ecuación</TituloSeccion>
          <form onSubmit={(e) => { e.preventDefault(); guardar(); }} noValidate>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Campo
                id="ecuacion-nombre"
                etiqueta="Nombre"
                value={form.nombre}
                onChange={(e) => cambiar("nombre", e.target.value)}
                error={errores.nombre}
                autoFocus
              />
              <Campo
                id="ecuacion-categoria"
                etiqueta="Categoría"
                value={form.categoria}
                onChange={(e) => cambiar("categoria", e.target.value)}
                error={errores.categoria}
              />
            </div>
            <Campo
              id="ecuacion-formula"
              etiqueta="Fórmula"
              ayuda="Usá números, variables y +, -, *, /, ^ y paréntesis."
              value={form.formula}
              onChange={(e) => cambiar("formula", e.target.value)}
              error={errores.formula}
            />
            <Campo id="ecuacion-descripcion" etiqueta="Descripción" error={errores.descripcion}>
              <textarea
                id="ecuacion-descripcion"
                value={form.descripcion}
                onChange={(e) => cambiar("descripcion", e.target.value)}
                aria-invalid={errores.descripcion ? "true" : undefined}
                aria-describedby={errores.descripcion ? "ecuacion-descripcion-error" : undefined}
                className={`mt-2 block min-h-24 w-full rounded-campo border-2 bg-tarjeta px-4 py-3 ${errores.descripcion ? "border-rojo" : "border-borde-fuerte"}`}
              />
            </Campo>

            {errores.general && <ErrorGeneral>{errores.general}</ErrorGeneral>}
            {duplicada && (
              <div role="alert" className="mb-6 rounded-campo bg-azul-claro p-4 text-azul">
                <p className="font-bold">Ya existe una ecuación con la misma expresión y el mismo orden.</p>
                <p className="mt-1">Podés seguir editando o guardarla como una variante.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Boton onClick={() => setDuplicada(false)}>Seguir editando</Boton>
                  <Boton variante="borde" onClick={() => guardar(true)}>Guardar variante</Boton>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Boton type="submit" variante="principal">Guardar ecuación</Boton>
              <Boton onClick={cancelar}>Cancelar</Boton>
            </div>
          </form>
        </Tarjeta>
      )}
    </main>
  );
}
