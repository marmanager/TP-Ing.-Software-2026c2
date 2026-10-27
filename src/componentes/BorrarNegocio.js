"use client";

// Eliminar el negocio (docs/roles.md). Sólo lo ve quien lo creó. Pide escribir
// el nombre del negocio: es irreversible y borra todo lo cargado.

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { Boton, Campo, ErrorGeneral, Tarjeta, TituloSeccion } from "@/componentes/ui";

export default function BorrarNegocio() {
  const { usuario } = useAuth();
  const { t } = useIdioma();
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
      setError(r?.error ?? { mensaje: "" });
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
      <TituloSeccion>{t("cuenta.borrar.titulo")}</TituloSeccion>
      <p className="mb-4 text-tinta-media">
        {t("cuenta.borrar.texto")}
      </p>
      {!abierto ? (
        <Boton variante="peligro" icono="tacho" onClick={() => setAbierto(true)}>{t("cuenta.borrar.titulo")}</Boton>
      ) : (
        <>
          {error && <ErrorGeneral>{textoDeError(t, error) || t("cuenta.borrar.fallo")}</ErrorGeneral>}
          <Campo
            id="confirmar-nombre"
            etiqueta={t("cuenta.borrar.confirmar", { nombre: negocio.nombre })}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Boton
              variante="peligro"
              icono="tacho"
              onClick={borrar}
              disabled={eliminando}
              motivo={!eliminando && nombre.trim() !== negocio.nombre.trim() ? t("cuenta.borrar.noCoincide") : null}
            >
              {eliminando ? t("cuenta.borrar.eliminando") : t("cuenta.borrar.definitivo")}
            </Boton>
            <Boton variante="borde" onClick={cancelar} disabled={eliminando}>{t("cuenta.borrar.cancelar")}</Boton>
          </div>
        </>
      )}
    </Tarjeta>
  );
}
