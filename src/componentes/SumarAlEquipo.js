"use client";

// "Sumar gente al equipo" y "Quieren entrar" (docs/equipo-por-link.md).
//
// Un solo link por negocio, para mandar al grupo de WhatsApp. Quien lo usa no
// entra: queda pendiente hasta que alguien con sumarAlEquipo (hoy, el dueño)
// lo acepta y le da un rol. La base vuelve a controlar todo; acá sólo se
// muestra lo que se puede hacer.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { cuando } from "@/lib/fechas";
import { puede, rolesQuePuedeDar } from "@/lib/permisos";
import { etiquetaRol } from "@/lib/presets";
import {
  aprobarPedido,
  cambiarLinkDeEquipo,
  linkDeEquipo,
  linkDeInvitacion,
  mensajeDeInvitacion,
  pedidosDeIngreso,
  rechazarPedido,
} from "@/lib/equipo";
import Icono from "./Icono";
import { Boton, ErrorGeneral, Tarjeta, TituloSeccion } from "./ui";

export default function SumarAlEquipo() {
  const { usuario, sesion } = useAuth();
  const { negocio, avisarExito, reemplazarEmpleados } = useDatos();
  const token = sesion?.access_token;
  const hayToken = Boolean(token); // el efecto depende de si hay, no de su valor: un refresco de sesión no reinicia la pantalla
  const puedeSumar = puede(usuario?.rol, "sumarAlEquipo");
  const [link, setLink] = useState(undefined); // undefined: cargando; null: no hay
  const [linkFallo, setLinkFallo] = useState(false); // no se pudo saber si hay link
  const [pedidos, setPedidos] = useState([]);
  const [pedidosFallo, setPedidosFallo] = useState(false);
  const [intento, setIntento] = useState(0); // "Reintentar" lo sube para volver a cargar
  const [rolDe, setRolDe] = useState({});
  const [confirmandoCambio, setConfirmandoCambio] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [origen, setOrigen] = useState("");

  useEffect(() => {
    setOrigen(window.location.origin);
  }, []);

  useEffect(() => {
    if (!puedeSumar || !hayToken) return;
    let vivo = true;
    // Nada del negocio anterior (ni de un intento anterior) queda en pantalla.
    setLink(undefined);
    setLinkFallo(false);
    setPedidos([]);
    setPedidosFallo(false);
    setRolDe({});
    setError(null);
    Promise.all([linkDeEquipo(token), pedidosDeIngreso(token)]).then(([l, p]) => {
      if (!vivo) return;
      if (l.ok) setLink(l.link);
      else {
        setLinkFallo(true);
        setError(l.error);
      }
      if (p.ok) setPedidos(p.pedidos);
      else setPedidosFallo(true);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeSumar, hayToken, negocio?.id, intento]);

  if (!puedeSumar) return null;

  const url = link && origen ? linkDeInvitacion(link.codigo, origen) : null;
  const mensaje = url ? mensajeDeInvitacion(negocio?.nombre ?? "tu negocio", url) : "";
  const roles = rolesQuePuedeDar(usuario?.rol);

  async function cambiarLink() {
    setOcupado(true);
    setError(null);
    const r = await cambiarLinkDeEquipo(token);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setLink(r.link);
    setConfirmandoCambio(false);
    avisarExito(link ? "Listo. El link anterior ya no sirve." : "Listo. Ya tenés el link del equipo.");
  }

  async function copiar() {
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      avisarExito("Listo. Copiaste el link.");
    } catch {
      setError("No pudimos copiarlo. Mantené apretado el link para copiarlo a mano.");
    }
  }

  async function aceptar(p) {
    const rol = rolDe[p.id] ?? "tecnico";
    setOcupado(true);
    setError(null);
    const r = await aprobarPedido(p.id, rol, token);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    reemplazarEmpleados(r.empleados);
    setPedidos((lista) => lista.filter((x) => x.id !== p.id));
    avisarExito(`Listo. ${p.nombre} entró como ${etiquetaRol(negocio?.rubro, rol).toLowerCase()}.`);
  }

  async function rechazar(p) {
    setOcupado(true);
    setError(null);
    const r = await rechazarPedido(p.id, token);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setPedidos((lista) => lista.filter((x) => x.id !== p.id));
    avisarExito(`Listo. Rechazaste el pedido de ${p.nombre}.`);
  }

  return (
    <>
      <Tarjeta className="mb-8">
        <TituloSeccion>Sumar gente al equipo</TituloSeccion>
        {linkFallo ? (
          // No se pudo saber si hay link: no se ofrece crear ni cambiar, que
          // anularía uno ya compartido.
          <Boton variante="plano" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Boton>
        ) : link === undefined ? (
          <p className="text-tinta-media">Buscando el link del equipo…</p>
        ) : !link ? (
          <>
            <p className="mb-4 max-w-[65ch] text-tinta-media">
              Un solo link para mandar al grupo. Quien lo use te pide entrar, y vos elegís si lo
              aceptás y con qué rol.
            </p>
            <Boton icono="mas" motivo={ocupado ? "creando" : null} onClick={cambiarLink}>
              Crear el link del equipo
            </Boton>
          </>
        ) : (
          <>
            <p className="max-w-[65ch] break-all font-bold" data-link-del-equipo>
              {url}
            </p>
            <p className="mt-1 text-tinta-media">Vence: {cuando(link.vence_en).toLowerCase()}.</p>
            {confirmandoCambio ? (
              <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                <p className="font-bold">¿Cambiar el link?</p>
                <p className="mt-1 max-w-[65ch] text-tinta-media">
                  El link anterior deja de funcionar. Los que ya entraron siguen adentro.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Boton variante="peligro" motivo={ocupado ? "cambiando" : null} onClick={cambiarLink}>
                    Sí, cambiarlo
                  </Boton>
                  <Boton variante="plano" disabled={ocupado} onClick={() => setConfirmandoCambio(false)}>
                    Dejarlo como está
                  </Boton>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-cuerpo text-azul hover:bg-azul-claro"
                >
                  <Icono nombre="chat" />
                  Compartir por WhatsApp
                </a>
                <Boton icono="copiar" onClick={copiar}>
                  Copiar el link
                </Boton>
                <Boton variante="plano" onClick={() => setConfirmandoCambio(true)}>
                  Cambiar el link
                </Boton>
              </div>
            )}
          </>
        )}
        {error && (
          <div className="mt-4">
            <ErrorGeneral>{error}</ErrorGeneral>
          </div>
        )}
      </Tarjeta>

      {pedidosFallo && (
        <>
          <TituloSeccion>Quieren entrar</TituloSeccion>
          <div className="mb-8">
            <ErrorGeneral>No pudimos traer los pedidos para entrar. Probá de nuevo.</ErrorGeneral>
            {!linkFallo && (
              <div className="mt-4">
                <Boton variante="plano" onClick={() => setIntento((n) => n + 1)}>
                  Reintentar
                </Boton>
              </div>
            )}
          </div>
        </>
      )}

      {pedidos.length > 0 && (
        <>
          <TituloSeccion>Quieren entrar ({pedidos.length})</TituloSeccion>
          <ul className="mb-8 grid gap-3">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Tarjeta>
                  <p className="font-bold">{p.nombre}</p>
                  <p className="text-tinta-media">
                    {p.email ? `${p.email} · ` : ""}pidió entrar: {cuando(p.creada_en).toLowerCase()}
                  </p>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div>
                      <label htmlFor={`rol-pedido-${p.id}`} className="block font-bold text-cuerpo">
                        Entra como
                      </label>
                      <select
                        id={`rol-pedido-${p.id}`}
                        value={rolDe[p.id] ?? "tecnico"}
                        onChange={(e) => setRolDe((r) => ({ ...r, [p.id]: e.target.value }))}
                        className="mt-2 block min-h-12 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {etiquetaRol(negocio?.rubro, r)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Boton icono="check" motivo={ocupado ? "esperando" : null} onClick={() => aceptar(p)}>
                      Aceptar
                    </Boton>
                    <Boton variante="peligro" disabled={ocupado} onClick={() => rechazar(p)}>
                      Rechazar
                    </Boton>
                  </div>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
