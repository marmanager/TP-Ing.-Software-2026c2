"use client";

// Roles (docs/roles.md). La lista de roles del negocio: cuántas personas tiene
// cada uno y, al tocarlo, sus permisos. El rol Dueño va primero y no se edita.

import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { nombreDelRol, puede, quienPuede } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "@/componentes/Icono";
import { Cargando, Tarjeta, TituloPantalla, Vacio } from "@/componentes/ui";

export default function Roles() {
  const datos = useDatos();
  const { usuario, haySupabase } = useAuth();
  const { t } = useIdioma();
  useTitulo(t("negocio.roles.titulo"));
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
        <TituloPantalla>{t("negocio.roles.titulo")}</TituloPantalla>
        <Vacio icono="candado" titulo={t("negocio.roles.requiere")}>
          {t("negocio.roles.requiereTexto")}
        </Vacio>
      </>
    );
  }
  if (sinRoles) return <Cargando />;

  return (
    <>
      <Volver />
      <TituloPantalla apoyo={t("negocio.roles.apoyo")}>{t("negocio.roles.titulo")}</TituloPantalla>

      {puedeManejar ? (
        <Link
          href="/negocio/roles/nuevo"
          data-testid="roles-crear"
          className="mb-8 inline-flex min-h-12 items-center gap-2 rounded-campo bg-azul px-6 font-bold text-white"
        >
          <Icono nombre="mas" />
          {t("negocio.roles.crear")}
        </Link>
      ) : (
        <p className="mb-8 text-tinta-media">{quienPuede("manejar_roles", t)}</p>
      )}

      <ul className="grid gap-4">
        {datos.roles.map((r) => (
          <li key={r.id}>
            <Link href={`/negocio/roles/${r.id}`} className="block min-h-12">
              <Tarjeta className="flex items-center justify-between gap-4">
                <span>
                  <span className="block font-bold">{nombreDelRol(r, t)}</span>
                  <span className="block text-tinta-media">
                    {r.es_duenio
                      ? t("negocio.roles.todosLosPermisos")
                      : t("negocio.roles.permisos", { n: r.permisos.length })}
                    {" · "}
                    {t("negocio.roles.personas", { n: r.personas })}
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
  const { t } = useIdioma();
  return (
    <Link href="/negocio" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
      <Icono nombre="volver" />
      {t("negocio.volver")}
    </Link>
  );
}
