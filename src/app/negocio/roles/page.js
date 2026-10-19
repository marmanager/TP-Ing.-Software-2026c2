"use client";

// Roles (docs/roles.md). La lista de roles del negocio: cuántas personas tiene
// cada uno y, al tocarlo, sus permisos. El rol Dueño va primero y no se edita.

import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import Icono from "@/componentes/Icono";
import { Cargando, Tarjeta, TituloPantalla, Vacio } from "@/componentes/ui";

export default function Roles() {
  const datos = useDatos();
  const { usuario, haySupabase } = useAuth();
  useTitulo("Roles");
  const puedeManejar = puede(usuario, "manejar_roles");
  const sinRoles = !datos.roles;

  // Se vuelven a pedir si una recarga de los datos los dejó sin leer.
  useEffect(() => {
    if (haySupabase && sinRoles) datos.cargarRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [haySupabase, sinRoles]);

  if (!haySupabase) {
    return (
      <>
        <Volver />
        <TituloPantalla>Roles</TituloPantalla>
        <Vacio icono="candado" titulo="Requiere una cuenta">
          Los roles se asignan a personas del equipo, y sumar personas requiere una cuenta.
        </Vacio>
      </>
    );
  }
  if (sinRoles) return <Cargando />;

  return (
    <>
      <Volver />
      <TituloPantalla apoyo="Qué puede hacer cada persona del equipo.">Roles</TituloPantalla>

      {puedeManejar ? (
        <Link
          href="/negocio/roles/nuevo"
          className="mb-8 inline-flex min-h-12 items-center gap-2 rounded-campo bg-azul px-6 font-bold text-white"
        >
          <Icono nombre="mas" />
          Crear un rol
        </Link>
      ) : (
        <p className="mb-8 text-tinta-media">{QUIEN_PUEDE.manejar_roles}</p>
      )}

      <ul className="grid gap-4">
        {datos.roles.map((r) => (
          <li key={r.id}>
            <Link href={`/negocio/roles/${r.id}`} className="block min-h-12">
              <Tarjeta className="flex items-center justify-between gap-4">
                <span>
                  <span className="block font-bold">{r.nombre}</span>
                  <span className="block text-tinta-media">
                    {r.es_duenio
                      ? "Tiene todos los permisos"
                      : `${r.permisos.length} ${r.permisos.length === 1 ? "permiso" : "permisos"}`}
                    {" · "}
                    {r.personas === 1 ? "1 persona" : `${r.personas} personas`}
                  </span>
                </span>
                <Icono nombre={r.es_duenio ? "candado" : "flecha"} />
              </Tarjeta>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Volver() {
  return (
    <Link href="/negocio" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
      <Icono nombre="volver" />
      Volver a Mi negocio
    </Link>
  );
}
