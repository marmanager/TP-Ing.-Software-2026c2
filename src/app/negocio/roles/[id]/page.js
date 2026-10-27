"use client";

// Un rol: su nombre y sus permisos, agrupados como en el catálogo. Un permiso
// que el rol propio no tiene se muestra apagado y dice por qué (cartilla:
// un control apagado explica el motivo). La base vuelve a controlar todo (060).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import {
  conImplicados,
  GRUPOS,
  implicadoPor,
  nombreDelGrupo,
  nombreDelRol,
  PERMISOS,
  puede,
  quienPuede,
  rolesQuePuedeDar,
  traducirPermiso,
} from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import Icono from "@/componentes/Icono";
import {
  Boton,
  BotonPrincipalFijo,
  Campo,
  Cargando,
  ErrorGeneral,
  Interruptor,
  TituloPantalla,
  TituloSeccion,
  Vacio,
} from "@/componentes/ui";

export default function EditarRol() {
  const { id } = useParams();
  const router = useRouter();
  const datos = useDatos();
  const { usuario } = useAuth();
  const { t } = useIdioma();
  const nuevo = id === "nuevo";
  const rol = nuevo ? null : datos.roles?.find((r) => r.id === id);
  useTitulo(nuevo ? t("negocio.roles.crear") : rol ? nombreDelRol(rol, t) : t("negocio.roles.rol"));

  const [nombre, setNombre] = useState("");
  const [permisos, setPermisos] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const sinRoles = !datos.roles;
  useEffect(() => {
    if (sinRoles) datos.cargarRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinRoles]);
  // Se carga una vez por rol: si los datos se vuelven a leer (la pestaña vuelve
  // al frente), lo que se estaba editando no se pisa.
  const idDelRol = rol?.id;
  useEffect(() => {
    if (rol) {
      setNombre(rol.nombre);
      setPermisos(rol.permisos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDelRol]);

  if (sinRoles) return <Cargando />;
  if (!nuevo && !rol) {
    return (
      <>
        <Volver />
        <Vacio icono="candado" titulo={t("negocio.roles.noExiste")}>
          {t("negocio.roles.noExisteTexto")}
        </Vacio>
      </>
    );
  }

  const esPropio = !nuevo && rol.id === usuario?.rol_id;
  // Un rol con permisos que el propio no tiene tampoco se toca (060).
  const excedeAlPropio = !nuevo && rolesQuePuedeDar(usuario, [rol]).length === 0;
  const soloLectura = !puede(usuario, "manejar_roles") || rol?.es_duenio || esPropio || excedeAlPropio;
  const motivoGeneral = rol?.es_duenio
    ? t("negocio.roles.duenioFijo")
    : esPropio
      ? t("negocio.roles.propioFijo")
      : !puede(usuario, "manejar_roles")
        ? quienPuede("manejar_roles", t)
        : excedeAlPropio
          ? t("negocio.roles.excede")
          : null;

  // Prender uno prende también el de mirar que va con él (060 hace lo mismo).
  const alternar = (clave, prendido) =>
    setPermisos((l) => (prendido ? conImplicados([...l, clave]) : l.filter((c) => c !== clave)));

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await datos.guardarRol({ id: nuevo ? null : id, nombre, permisos });
    setGuardando(false);
    if (r.ok) router.push("/negocio/roles");
    else setError(r.error);
  }

  async function eliminar() {
    setError(null);
    const r = await datos.borrarRol(id);
    if (r.ok) router.push("/negocio/roles");
    else setError(r.error);
  }

  return (
    <>
      <Volver />

      <TituloPantalla apoyo={motivoGeneral ?? t("negocio.roles.apoyoDefecto")}>
        {nuevo ? t("negocio.roles.crear") : nombreDelRol(rol, t)}
      </TituloPantalla>

      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

      {nuevo && !soloLectura && (
        <div className="mb-6">
          <label htmlFor="copiar-de" className="block font-bold text-cuerpo">{t("negocio.roles.copiarDe")}</label>
          <select
            id="copiar-de"
            className="mt-2 min-h-12 w-full rounded-campo border-2 border-borde bg-tarjeta px-4"
            defaultValue=""
            onChange={(e) => {
              const origen = datos.roles.find((r) => r.id === e.target.value);
              // Sólo los que se pueden dar: copiar el Dueño trae los propios.
              if (origen) setPermisos(conImplicados(origen.permisos.filter((c) => puede(usuario, c))));
            }}
          >
            <option value="">{t("negocio.roles.sinPermisos")}</option>
            {datos.roles.map((r) => (
              <option key={r.id} value={r.id}>{nombreDelRol(r, t)}</option>
            ))}
          </select>
        </div>
      )}

      {!soloLectura && (
        <Campo
          id="nombre-del-rol"
          etiqueta={t("negocio.roles.nombre")}
          ejemplo={t("negocio.roles.nombreEjemplo")}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
        />
      )}

      {GRUPOS.map((grupo) => (
        <section key={grupo} className="mb-8">
          <TituloSeccion>{nombreDelGrupo(grupo, t)}</TituloSeccion>
          <ul className="grid gap-2">
            {PERMISOS.filter((p) => p.grupo === grupo).map((p) => traducirPermiso(p, t)).map((p) => {
              // Lo trae otro que está prendido: queda prendido y fijo mientras tanto.
              const incluidoPor = !soloLectura && !rol?.es_duenio && implicadoPor(permisos, p.clave);
              return (
                <li key={p.clave}>
                  <Interruptor
                    prendido={rol?.es_duenio || permisos.includes(p.clave) || Boolean(incluidoPor)}
                    onChange={(v) => alternar(p.clave, v)}
                    ayuda={p.descripcion}
                    palabras={[t("negocio.roles.desactivado"), t("negocio.roles.activado")]}
                    disabled={soloLectura}
                    motivo={
                      soloLectura ? null
                        : !puede(usuario, p.clave) ? t("negocio.roles.noIncluido")
                          : incluidoPor ? t("negocio.roles.incluidoPor", { nombre: traducirPermiso(incluidoPor, t).nombre })
                            : null
                    }
                  >
                    {p.nombre}
                  </Interruptor>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {!soloLectura && (
        <>
          {!nuevo && (
            <Boton
              icono="tacho"
              onClick={eliminar}
              className="mb-8"
              motivo={rol.personas > 0 ? t("negocio.roles.asignado", { n: rol.personas }) : null}
            >
              {t("negocio.roles.eliminar")}
            </Boton>
          )}
          <BotonPrincipalFijo
            onClick={guardar}
            disabled={guardando}
            motivo={!nombre.trim() ? t("ui.validaciones.faltaNombre") : null}
          >
            {guardando ? t("negocio.roles.guardando") : t("negocio.roles.guardar")}
          </BotonPrincipalFijo>
        </>
      )}
    </>
  );
}

function Volver() {
  const { t } = useIdioma();
  return (
    <Link href="/negocio/roles" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
      <Icono nombre="volver" />
      {t("negocio.roles.volver")}
    </Link>
  );
}
