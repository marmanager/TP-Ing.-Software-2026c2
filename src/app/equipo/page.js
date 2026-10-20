"use client";

// "Equipo" — quién atiende los trabajos (SCRUM-18).
//
// El equipo son cuentas aprobadas: alguien entra con el link del equipo, pide
// entrar y el dueño lo acepta (docs/equipo-por-link.md). Ya no se cargan
// personas a mano, sin cuenta.
//
// Los roles son los del negocio (docs/roles.md): cada uno con sus permisos.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, queCambiaConElRol, QUIEN_PUEDE, rolesQuePuedeDar } from "@/lib/permisos";
import { estaAbierto } from "@/lib/estados";
import { lineaDelCaso, subtituloDelCaso, tituloDelCaso } from "@/lib/nombres";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import SumarAlEquipo from "@/componentes/SumarAlEquipo";
import { Boton, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

const CASOS_A_LA_VISTA = 3;

export default function Equipo() {
  const datos = useDatos();
  const { cargando, empleados, casos, negocio, avisarExito, fotosEquipo } = datos;
  const { usuario } = useAuth();
  useTitulo("Equipo");

  // Cambiar el rol y sacar gente son permisos distintos. La base también los
  // controla; acá sólo evitamos ofrecer un botón que va a fallar.
  const puedeCambiarRol = puede(usuario, "manejar_roles");
  const puedeSacar = puede(usuario, "sacar_del_equipo");

  const [verTodosDe, setVerTodosDe] = useState(null);
  const [sacando, setSacando] = useState(null);
  // El cambio de rol de alguien con cuenta, esperando que se confirme:
  // { id, rol }. Desde la 037 el rol da los permisos, y el cambio se confirma
  // diciendo qué gana y qué pierde la persona (auditoría, H5).
  const [cambiandoRol, setCambiandoRol] = useState(null);

  // Se vuelven a pedir si una recarga de los datos los dejó sin leer.
  const sinRoles = !datos.roles;
  useEffect(() => {
    if (sinRoles) datos.cargarRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinRoles]);

  if (cargando) return <Cargando />;

  const rolDe = (id) => datos.roles?.find((r) => r.id === id);
  const ofrecidos = rolesQuePuedeDar(usuario, datos.roles);
  const sinAsignar = casos.filter((c) => estaAbierto(c) && !c.responsable_id);

  function sacar(persona) {
    const suyos = casos.filter((c) => c.responsable_id === persona.id && estaAbierto(c));
    datos.eliminarEmpleado(persona.id);
    avisarExito(
      suyos.length
        ? `${persona.nombre} salió del equipo. Sus ${suyos.length} ${suyos.length === 1 ? "caso quedó" : "casos quedaron"} sin responsable.`
        : `${persona.nombre} salió del equipo.`
    );
    setSacando(null);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">Equipo</h1>
          <p className="mt-1 max-w-[65ch] text-tinta-media">
            {puedeCambiarRol || puedeSacar
              ? "Quién está trabajando en qué. Para sumar a alguien, mandale el link del equipo."
              : `Quién está trabajando en qué. ${QUIEN_PUEDE.manejar_roles}`}
          </p>
        </div>
      </div>

      <SumarAlEquipo />

      {empleados.length === 0 ? (
        <Vacio icono="personas" titulo="Todavía no hay nadie cargado">
          Mandá el link del equipo al grupo y aceptá a quienes pidan entrar.
        </Vacio>
      ) : (
        <ul className="mb-12 grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
          {empleados.map((e) => {
            const suyos = casos.filter((c) => c.responsable_id === e.id && estaAbierto(c));
            // La foto que la persona cargó en su perfil (SCRUM-118), leída de
            // su cuenta y no copiada a la ficha: si la cambia, acá se ve la
            // nueva. Ya no se cargan fichas a mano (las que quedaban se borran
            // con la 051): si no hay foto, queda el ícono.
            const foto = e.usuario_id
              ? fotosEquipo.find((f) => f.usuario_id === e.usuario_id)?.foto
              : null;
            // La ficha propia: desde la 038 el dueño también tiene una. No se
            // cambia el rol ni se saca a sí mismo —la base lo rechaza (036,
            // 037)—, y un botón que no funciona no se muestra.
            const esVos = Boolean(e.usuario_id) && e.usuario_id === usuario?.id;
            // Quien creó el negocio: nadie le cambia el rol ni lo saca —la
            // base lo rechaza (038)—.
            const esFundador = Boolean(e.usuario_id) && e.usuario_id === negocio?.creado_por;
            const intocable = esVos || esFundador;
            return (
              <li key={e.id}>
                <Tarjeta className="h-full">
                  <div className="flex items-center gap-3">
                    {/* Sin texto alternativo: el nombre está al lado. */}
                    {foto ? (
                      <img src={foto} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta-media">
                        <Icono nombre="persona" />
                      </span>
                    )}
                    <p className="font-bold text-subtitulo">{e.nombre}</p>
                    {esVos && (
                      <span className="shrink-0 rounded-full bg-azul-claro px-3 py-1 text-apoyo font-bold text-azul">
                        Vos
                      </span>
                    )}
                  </div>

                  {puedeCambiarRol && !intocable && ofrecidos.some((r) => r.id === e.rol_id) ? (
                    <div className="mt-4">
                      <label
                        htmlFor={`rol-${e.id}`}
                        className="block font-bold text-etiqueta text-tinta-media"
                      >
                        Qué hace
                      </label>
                      {/* Con cuenta, el rol da los permisos (037): elegir otro no
                          lo cambia todavía, abre la confirmación de abajo. Sin
                          cuenta —una ficha cargada a mano— es sólo el nombre
                          con el que figura, y cambia directo como siempre. */}
                      <select
                        id={`rol-${e.id}`}
                        value={e.rol_id}
                        onChange={(ev) => {
                          const nuevo = ev.target.value;
                          if (e.usuario_id) {
                            setCambiandoRol({ id: e.id, rol: nuevo });
                            return;
                          }
                          datos.cambiarRolEmpleado(e.id, nuevo);
                          avisarExito(`${e.nombre} ahora figura como ${rolDe(nuevo).nombre}.`);
                        }}
                        className="mt-1 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
                      >
                        {ofrecidos.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>

                      {cambiandoRol?.id === e.id && (
                        <ConfirmarRol
                          persona={e}
                          antes={rolDe(e.rol_id)}
                          despues={rolDe(cambiandoRol.rol)}
                          alConfirmar={() => {
                            datos.cambiarRolEmpleado(e.id, cambiandoRol.rol);
                            avisarExito(
                              `${e.nombre} tiene ahora el rol ${rolDe(cambiandoRol.rol).nombre}.`
                            );
                            setCambiandoRol(null);
                          }}
                          alCancelar={() => setCambiandoRol(null)}
                        />
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-apoyo text-tinta-suave">
                      {rolDe(e.rol_id)?.nombre}
                      {esFundador && !esVos && " · Creó el negocio"}
                    </p>
                  )}

                  <p className="mt-4 text-tinta-media">
                    {suyos.length === 0
                      ? "No tiene ningún caso ahora."
                      : `Tiene ${suyos.length} ${suyos.length === 1 ? "caso" : "casos"} sin cerrar.`}
                  </p>

                  {/* Tres casos y el resto a pedido: alguien con siete
                      casos tenía una tarjeta del triple de alto que las otras
                      y rompía la grilla (auditoría, H8). */}
                  {suyos.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {(verTodosDe === e.id ? suyos : suyos.slice(0, CASOS_A_LA_VISTA)).map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/casos/${c.id}`}
                            className="flex min-h-12 items-center gap-2 text-azul"
                          >
                            <Icono nombre="carpeta" className="size-5" />
                            {tituloDelCaso(c)}
                            {lineaDelCaso(c) && ` · ${lineaDelCaso(c)}`}
                            {subtituloDelCaso(c) && (
                              <span className="text-apoyo text-tinta-suave">{subtituloDelCaso(c)}</span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {suyos.length > CASOS_A_LA_VISTA && (
                    <Boton
                      variante="plano"
                      className="mt-1"
                      onClick={() => setVerTodosDe((v) => (v === e.id ? null : e.id))}
                    >
                      {verTodosDe === e.id
                        ? "Mostrar menos"
                        : `y ${suyos.length - CASOS_A_LA_VISTA} más`}
                    </Boton>
                  )}

                  {/* El tope de la 063: a alguien con cuenta se lo saca sólo si su
                      rol es uno que se podría dar (un Dueño, sólo otro Dueño). */}
                  {!puedeSacar || intocable || (e.usuario_id && !ofrecidos.some((r) => r.id === e.rol_id))
                    ? null : sacando === e.id ? (
                    <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                      <p className="font-bold text-cuerpo">¿Sacar a {e.nombre} del equipo?</p>
                      {/* Con cuenta, sacarlo también le quita el acceso (036): es
                          lo más importante que pasa, y va primero. */}
                      {e.usuario_id && (
                        <p className="mt-1 font-bold text-tinta">
                          Su cuenta deja de poder entrar a este negocio.
                        </p>
                      )}
                      <p className="mt-1 text-tinta-media">
                        {suyos.length
                          ? `Sus ${suyos.length} ${suyos.length === 1 ? "caso queda" : "casos quedan"} sin responsable. No se borra ningún caso.`
                          : e.usuario_id
                            ? "No tiene casos abiertos."
                            : "No tiene casos abiertos, así que no cambia nada más."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Boton variante="peligro" icono="tacho" onClick={() => sacar(e)}>
                          Sacar del equipo
                        </Boton>
                        <Boton variante="plano" onClick={() => setSacando(null)}>
                          Dejarlo
                        </Boton>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <Boton variante="plano" icono="tacho" onClick={() => setSacando(e.id)}>
                        Sacar del equipo
                      </Boton>
                    </div>
                  )}
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      {sinAsignar.length > 0 && (
        <>
          <TituloSeccion>Casos que no tiene nadie</TituloSeccion>
          <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
            {sinAsignar.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-borde p-4 last:border-b-0"
              >
                <div>
                  <Link href={`/casos/${c.id}`} className="font-bold text-azul">
                    {tituloDelCaso(c)}
                  </Link>
                  {subtituloDelCaso(c) && (
                    <span className="ml-2 text-apoyo text-tinta-suave">{subtituloDelCaso(c)}</span>
                  )}
                  {lineaDelCaso(c) && <p className="text-tinta-media">{lineaDelCaso(c)}</p>}
                </div>
                <ChipEstado estado={c.estado} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------
// Confirmar un cambio de rol (037)
// ------------------------------------------------------------
// Desde la 037 el rol de la ficha da los permisos, y el cambio se confirma
// diciendo qué gana y qué pierde la persona: en un desplegable de celular el
// dedo elige otra opción sin querer (auditoría, H5). Lo que sale de las dos
// listas lo decide queCambiaConElRol(), en lib/permisos.js, con pruebas.
//
// Van como lista y no en una oración: las frases de los permisos ya tienen
// comas adentro, y unidas se mezclarían.
//
// Bajar a alguien —que pierda algo— va en rojo, como "Sacar del equipo": deja
// a una persona sin poder hacer parte de su trabajo.
function ConfirmarRol({ persona, antes, despues, alConfirmar, alCancelar }) {
  const { gana, pierde } = queCambiaConElRol(antes, despues);
  return (
    <div className="mt-3 rounded-tarjeta bg-superficie p-4">
      <p className="font-bold text-cuerpo">
        ¿Pasar a {persona.nombre} al rol {despues.nombre}?
      </p>
      {pierde.length > 0 && (
        <>
          <p className="mt-2 font-bold text-tinta">Permisos que se quitan</p>
          <ul className="ml-5 list-disc text-tinta-media">
            {pierde.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {gana.length > 0 && (
        <>
          <p className="mt-2 font-bold text-tinta">Permisos que se agregan</p>
          <ul className="ml-5 list-disc text-tinta-media">
            {gana.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Boton variante={pierde.length > 0 ? "peligro" : "borde"} icono="check" onClick={alConfirmar}>
          Sí, cambiarlo
        </Boton>
        <Boton variante="plano" onClick={alCancelar}>
          Dejarlo como está
        </Boton>
      </div>
    </div>
  );
}
