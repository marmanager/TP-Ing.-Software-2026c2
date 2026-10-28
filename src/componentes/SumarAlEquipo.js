"use client";

// "Sumar gente al equipo" y "Quieren entrar" (docs/equipo-por-link.md).
//
// Un solo link por negocio, para mandar al grupo de WhatsApp. Quien lo usa no
// entra: queda pendiente hasta que alguien con sumar_al_equipo
// lo acepta y le da un rol. La base vuelve a controlar todo; acá sólo se
// muestra lo que se puede hacer.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { cuando } from "@/lib/fechas";
import { nombreDelRol, puede, rolPorDefecto, rolesQuePuedeDar } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
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
  const { idioma, locale, t } = useIdioma();
  // La fecha en medio de una frase: en castellano va toda en minúscula ("hoy
  // 10:00", "26 de octubre"); en inglés sólo "today" y "yesterday" ("October 26").
  const fechaEnFrase = (iso) => {
    const f = cuando(iso, locale, t);
    return idioma === "es" ? f.toLowerCase() : f.replace(/^(Today|Yesterday)/, (w) => w.toLowerCase());
  };
  const { usuario, sesion } = useAuth();
  const { negocio, avisarExito, reemplazarEmpleados, roles: rolesDelNegocio } = useDatos();
  const token = sesion?.access_token;
  const hayToken = Boolean(token); // el efecto depende de si hay, no de su valor: un refresco de sesión no reinicia la pantalla
  const puedeSumar = puede(usuario, "sumar_al_equipo");
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
  // Lo que se manda al grupo sale en el idioma de quien lo manda.
  const mensaje = url ? mensajeDeInvitacion(negocio?.nombre ?? t("equipo.sumar.tuNegocio"), url, t) : "";
  const roles = rolesQuePuedeDar(usuario, rolesDelNegocio);
  // Sin elegir otro, entra con el rol de menos permisos; nunca Dueño de entrada.
  const porDefecto = rolPorDefecto(roles);
  const elegidoPara = (p) => rolDe[p.id] ?? porDefecto ?? "";

  async function cambiarLink() {
    setOcupado(true);
    setError(null);
    const r = await cambiarLinkDeEquipo(token);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setLink(r.link);
    setConfirmandoCambio(false);
    avisarExito(link ? t("equipo.sumar.linkAnteriorNoSirve") : t("equipo.sumar.linkNuevo"));
  }

  async function copiar() {
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      avisarExito(t("equipo.sumar.copiado"));
    } catch {
      setError(t("equipo.sumar.noPudimosCopiar"));
    }
  }

  async function aceptar(p) {
    const rolId = elegidoPara(p);
    if (!rolId) return;
    setOcupado(true);
    setError(null);
    const r = await aprobarPedido(p.id, rolId, token);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    reemplazarEmpleados(r.empleados);
    setPedidos((lista) => lista.filter((x) => x.id !== p.id));
    avisarExito(t("equipo.sumar.rolAsignado", { nombre: p.nombre, rol: nombreDelRol(roles.find((x) => x.id === rolId), t) }));
  }

  async function rechazar(p) {
    setOcupado(true);
    setError(null);
    const r = await rechazarPedido(p.id, token);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setPedidos((lista) => lista.filter((x) => x.id !== p.id));
    avisarExito(t("equipo.sumar.rechazado", { nombre: p.nombre }));
  }

  return (
    <>
      <Tarjeta className="mb-8">
        <TituloSeccion>{t("equipo.sumar.titulo")}</TituloSeccion>
        {linkFallo ? (
          // No se pudo saber si hay link: no se ofrece crear ni cambiar, que
          // anularía uno ya compartido.
          <Boton variante="plano" onClick={() => setIntento((n) => n + 1)}>
            {t("equipo.sumar.reintentar")}
          </Boton>
        ) : link === undefined ? (
          <p className="text-tinta-media">{t("equipo.sumar.buscando")}</p>
        ) : !link ? (
          <>
            <p className="mb-4 max-w-[65ch] text-tinta-media">
              {t("equipo.sumar.sinLink")}
            </p>
            <Boton icono="mas" motivo={ocupado ? t("equipo.sumar.creando") : null} onClick={cambiarLink} data-testid="equipo-link-crear">
              {t("equipo.sumar.crear")}
            </Boton>
          </>
        ) : (
          <>
            <p className="max-w-[65ch] break-all font-bold" data-link-del-equipo>
              {url}
            </p>
            <p className="mt-1 text-tinta-media">{t("equipo.sumar.vence", { cuando: fechaEnFrase(link.vence_en) })}</p>
            {confirmandoCambio ? (
              <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                <p className="font-bold">{t("equipo.sumar.cambiarPregunta")}</p>
                <p className="mt-1 max-w-[65ch] text-tinta-media">
                  {t("equipo.sumar.cambiarAviso")}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Boton variante="peligro" motivo={ocupado ? t("equipo.sumar.cambiando") : null} onClick={cambiarLink} data-testid="equipo-link-cambiar-confirmar">
                    {t("equipo.sumar.siCambiar")}
                  </Boton>
                  <Boton variante="plano" disabled={ocupado} onClick={() => setConfirmandoCambio(false)}>
                    {t("equipo.sumar.dejarComoEsta")}
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
                  {t("equipo.sumar.whatsapp")}
                </a>
                <Boton icono="copiar" onClick={copiar}>
                  {t("equipo.sumar.copiar")}
                </Boton>
                <Boton variante="plano" onClick={() => setConfirmandoCambio(true)} data-testid="equipo-link-cambiar">
                  {t("equipo.sumar.cambiar")}
                </Boton>
              </div>
            )}
          </>
        )}
        {error && (
          <div className="mt-4">
            <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>
          </div>
        )}
      </Tarjeta>

      {pedidosFallo && (
        <>
          <TituloSeccion>{t("equipo.sumar.quierenEntrar")}</TituloSeccion>
          <div className="mb-8">
            <ErrorGeneral>{t("equipo.sumar.pedidosFallo")}</ErrorGeneral>
            {!linkFallo && (
              <div className="mt-4">
                <Boton variante="plano" onClick={() => setIntento((n) => n + 1)}>
                  {t("equipo.sumar.reintentar")}
                </Boton>
              </div>
            )}
          </div>
        </>
      )}

      {pedidos.length > 0 && (
        <>
          <TituloSeccion>{t("equipo.sumar.quierenEntrarN", { n: pedidos.length })}</TituloSeccion>
          <ul className="mb-8 grid gap-3">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Tarjeta>
                  <p className="font-bold">{p.nombre}</p>
                  <p className="text-tinta-media">
                    {p.email
                      ? t("equipo.sumar.pidioEntrarConMail", { email: p.email, cuando: fechaEnFrase(p.creada_en) })
                      : t("equipo.sumar.pidioEntrar", { cuando: fechaEnFrase(p.creada_en) })}
                  </p>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div>
                      <label htmlFor={`rol-pedido-${p.id}`} className="block font-bold text-cuerpo">
                        {t("equipo.sumar.entraComo")}
                      </label>
                      <select
                        id={`rol-pedido-${p.id}`}
                        value={elegidoPara(p)}
                        onChange={(e) => setRolDe((r) => ({ ...r, [p.id]: e.target.value }))}
                        className="mt-2 block min-h-12 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
                      >
                        <option value="">{t("equipo.sumar.elegirRol")}</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {nombreDelRol(r, t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Boton icono="check" motivo={ocupado ? t("equipo.sumar.esperando") : !elegidoPara(p) ? t("equipo.sumar.elegirUnRol") : null} onClick={() => aceptar(p)} data-testid="equipo-pedido-aceptar">
                      {t("equipo.sumar.aceptar")}
                    </Boton>
                    <Boton variante="peligro" disabled={ocupado} onClick={() => rechazar(p)}>
                      {t("equipo.sumar.rechazar")}
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
