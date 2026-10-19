"use client";

// Eliminar el negocio (docs/roles.md). Sólo lo ve quien lo creó. Pide escribir
// el nombre del negocio: es irreversible y borra todo lo cargado.

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { Boton, Campo, ErrorGeneral, Tarjeta, TituloSeccion } from "@/componentes/ui";

export default function BorrarNegocio() {
  const { usuario } = useAuth();
  const datos = useDatos();
  const { negocio } = datos;
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  if (!negocio || negocio.creado_por !== usuario?.id) return null;

  async function borrar() {
    if (eliminando) return;
    setError(null);
    setEliminando(true);
    const r = await datos.borrarNegocio(nombre);
    if (r?.ok) window.location.assign("/");
    else {
      setError(r?.error ?? "No se pudo eliminar el negocio.");
      setEliminando(false);
    }
  }

  function cancelar() {
    setAbierto(false);
    setNombre("");
    setError(null);
  }

  return (
    <Tarjeta className="mt-12 border-rojo">
      <TituloSeccion>Eliminar el negocio</TituloSeccion>
      <p className="mb-4 text-tinta-media">
        Se eliminan el negocio y todo lo cargado: casos, clientes, agenda, inventario, cobros y equipo. No se puede deshacer.
      </p>
      {!abierto ? (
        <Boton variante="peligro" icono="tacho" onClick={() => setAbierto(true)}>Eliminar el negocio</Boton>
      ) : (
        <>
          {error && <ErrorGeneral>{error}</ErrorGeneral>}
          <Campo
            id="confirmar-nombre"
            etiqueta={`Para confirmar, escriba «${negocio.nombre}»`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Boton
              variante="peligro"
              icono="tacho"
              onClick={borrar}
              disabled={eliminando}
              motivo={!eliminando && nombre.trim() !== negocio.nombre.trim() ? "el nombre no coincide" : null}
            >
              {eliminando ? "Eliminando" : "Eliminar definitivamente"}
            </Boton>
            <Boton variante="borde" onClick={cancelar} disabled={eliminando}>Cancelar</Boton>
          </div>
        </>
      )}
    </Tarjeta>
  );
}
