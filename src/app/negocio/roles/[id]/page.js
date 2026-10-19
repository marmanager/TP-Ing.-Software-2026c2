"use client";

// Un rol: su nombre y sus permisos, agrupados como en el catálogo. Un permiso
// que el rol propio no tiene se muestra apagado y dice por qué (cartilla:
// un control apagado explica el motivo). La base vuelve a controlar todo (056).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { GRUPOS, PERMISOS, puede, QUIEN_PUEDE, rolesQuePuedeDar } from "@/lib/permisos";
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
  const nuevo = id === "nuevo";
  const rol = nuevo ? null : datos.roles?.find((r) => r.id === id);
  useTitulo(nuevo ? "Crear un rol" : rol?.nombre ?? "Rol");

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
        <Vacio icono="candado" titulo="Este rol ya no existe">
          Puede que se haya eliminado. La lista de roles muestra los que hay.
        </Vacio>
      </>
    );
  }

  const esPropio = !nuevo && rol.id === usuario?.rol_id;
  // Un rol con permisos que el propio no tiene tampoco se toca (056).
  const excedeAlPropio = !nuevo && rolesQuePuedeDar(usuario, [rol]).length === 0;
  const soloLectura = !puede(usuario, "manejar_roles") || rol?.es_duenio || esPropio || excedeAlPropio;
  const motivoGeneral = rol?.es_duenio
    ? "El rol Dueño no se modifica."
    : esPropio
      ? "El rol propio no se modifica."
      : !puede(usuario, "manejar_roles")
        ? QUIEN_PUEDE.manejar_roles
        : excedeAlPropio
          ? "Este rol tiene permisos que el rol propio no incluye."
          : null;

  const alternar = (clave, prendido) =>
    setPermisos((l) => (prendido ? [...l, clave] : l.filter((c) => c !== clave)));

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

      <TituloPantalla apoyo={motivoGeneral ?? "Active los permisos que corresponden a este rol."}>
        {nuevo ? "Crear un rol" : rol.nombre}
      </TituloPantalla>

      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      {nuevo && !soloLectura && (
        <div className="mb-6">
          <label htmlFor="copiar-de" className="block font-bold text-cuerpo">Copiar los permisos de otro rol</label>
          <select
            id="copiar-de"
            className="mt-2 min-h-12 w-full rounded-campo border-2 border-borde bg-tarjeta px-4"
            defaultValue=""
            onChange={(e) => {
              const origen = datos.roles.find((r) => r.id === e.target.value);
              // Sólo los que se pueden dar: copiar el Dueño trae los propios.
              if (origen) setPermisos(origen.permisos.filter((c) => puede(usuario, c)));
            }}
          >
            <option value="">Empezar sin permisos</option>
            {datos.roles.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {!soloLectura && (
        <Campo
          id="nombre-del-rol"
          etiqueta="Nombre del rol"
          ejemplo="Recepción"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
        />
      )}

      {GRUPOS.map((grupo) => (
        <section key={grupo} className="mb-8">
          <TituloSeccion>{grupo}</TituloSeccion>
          <ul className="grid gap-2">
            {PERMISOS.filter((p) => p.grupo === grupo).map((p) => (
              <li key={p.clave}>
                <Interruptor
                  prendido={rol?.es_duenio || permisos.includes(p.clave)}
                  onChange={(v) => alternar(p.clave, v)}
                  ayuda={p.descripcion}
                  palabras={["Desactivado", "Activado"]}
                  disabled={soloLectura}
                  motivo={!soloLectura && !puede(usuario, p.clave) ? "Este permiso no está incluido en su rol" : null}
                >
                  {p.nombre}
                </Interruptor>
              </li>
            ))}
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
              motivo={rol.personas > 0 ? `asignado a ${rol.personas} ${rol.personas === 1 ? "persona" : "personas"}` : null}
            >
              Eliminar el rol
            </Boton>
          )}
          <BotonPrincipalFijo
            onClick={guardar}
            disabled={guardando}
            motivo={!nombre.trim() ? "falta el nombre" : null}
          >
            {guardando ? "Guardando" : "Guardar el rol"}
          </BotonPrincipalFijo>
        </>
      )}
    </>
  );
}

function Volver() {
  return (
    <Link href="/negocio/roles" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
      <Icono nombre="volver" />
      Volver a Roles
    </Link>
  );
}
