"use client";

// El mail del cliente y por dónde le llegan los avisos automáticos (083,
// docs/avisos-por-mail-plan.md, FRONT-1). El canal es uno solo: todos sus
// avisos van por WhatsApp o todos por mail. Cada opción dice a dónde llega,
// así se ve antes de elegir. Elegir mail sin mail cargado se puede (el aviso
// no se programa, con su motivo), pero se dice al lado.

import { useState } from "react";
import { useDatos } from "@/lib/datos";
import { useIdioma } from "@/lib/useIdioma";
import { telefonoLegible } from "@/lib/telefono";
import { emailValido } from "@/lib/recordatorios";
import Icono from "@/componentes/Icono";
import { Boton, Campo } from "@/componentes/ui";

export default function CanalDelCliente({ cliente, puedeCargar }) {
  const datos = useDatos();
  const { t } = useIdioma();
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [email, setEmail] = useState("");
  const [tocado, setTocado] = useState(false);

  const canal = cliente.canal === "email" ? "email" : "whatsapp";
  const conMail = emailValido(cliente.email);
  const escrito = email.trim();
  const errorEmail = tocado && escrito && !emailValido(escrito) ? t("clientes.ficha.mailNoSirve") : null;

  // "Le llega a" en un renglón y la dirección en el siguiente, entera: un
  // mail largo partido en cualquier letra ("gmail.c / om") no se leía. Si no
  // entra, termina en "…" y se lee completo arriba, en "Mail".
  const opciones = [
    { canal: "whatsapp", icono: "whatsapp", nombre: t("clientes.ficha.canalWhatsapp"),
      prefijo: t("clientes.ficha.canalLeLlegaAl"),
      destino: cliente.telefono ? telefonoLegible(cliente.telefono) : null, falta: t("clientes.ficha.sinTelefono") },
    { canal: "email", icono: "sobre", nombre: t("clientes.ficha.canalMail"),
      prefijo: t("clientes.ficha.canalLeLlegaA"),
      destino: conMail ? cliente.email : null, falta: t("clientes.ficha.sinMail") },
  ];

  return (
    <>
      <p className="mt-6 font-bold text-cuerpo">{t("clientes.ficha.mail")}</p>
      {corrigiendo && puedeCargar ? (
        <div className="mt-2 max-w-[360px]">
          <Campo
            id="email"
            etiqueta={t("clientes.ficha.mail")}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            error={errorEmail}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTocado(true)}
            autoFocus
          />
          <div className="flex flex-wrap gap-3">
            <Boton
              icono="check"
              data-testid="cliente-mail-guardar"
              motivo={escrito && !emailValido(escrito) ? t("clientes.ficha.mailNoSirve") : null}
              onClick={() => {
                datos.corregirEmail(cliente.id, escrito || null);
                datos.avisarExito(escrito
                  ? t("clientes.ficha.mailGuardado", { nombre: cliente.nombre, email: escrito })
                  : t("clientes.ficha.mailSacado", { nombre: cliente.nombre }));
                setCorrigiendo(false);
              }}
            >
              {t("clientes.ficha.guardarMail")}
            </Boton>
            <Boton variante="plano" onClick={() => setCorrigiendo(false)}>
              {t("clientes.ficha.dejarComoEstaba")}
            </Boton>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {cliente.email ? (
            <a href={`mailto:${cliente.email}`} className="inline-flex min-h-12 items-center gap-2 text-azul [overflow-wrap:anywhere]">
              <Icono nombre="sobre" className="size-5" />
              {cliente.email}
            </a>
          ) : (
            <p className="text-tinta-media">{t("clientes.ficha.sinMail")}</p>
          )}
          {puedeCargar && (
            <Boton
              variante="plano"
              icono="nota"
              data-testid="cliente-mail-corregir"
              onClick={() => {
                setEmail(cliente.email ?? "");
                setTocado(!!cliente.email);
                setCorrigiendo(true);
              }}
            >
              {t(cliente.email ? "clientes.ficha.corregirMail" : "clientes.ficha.cargarMail")}
            </Boton>
          )}
        </div>
      )}

      <fieldset className="mt-6 max-w-[760px]" data-canal-del-cliente>
        <legend className="font-bold text-cuerpo">{t("clientes.ficha.canal")}</legend>
        <p className="mt-1 text-etiqueta text-tinta-media">{t("clientes.ficha.canalAyuda")}</p>
        <div className="mt-3 grid gap-3 @lg:grid-cols-[repeat(2,minmax(0,1fr))]">
          {opciones.map((o) => {
            const elegida = canal === o.canal;
            return (
              <label
                key={o.canal}
                data-canal={o.canal}
                className={`flex gap-3 rounded-campo border-2 p-4 ${puedeCargar ? "cursor-pointer" : ""} ${elegida ? "border-azul bg-azul-claro" : "border-borde bg-tarjeta"}`}
              >
                <input
                  type="radio"
                  name="canal-del-cliente"
                  value={o.canal}
                  checked={elegida}
                  disabled={!puedeCargar}
                  onChange={() => {
                    datos.cambiarCanal(cliente.id, o.canal);
                    datos.avisarExito(t(`clientes.ficha.canalCambiado.${o.canal}`, { nombre: cliente.nombre }));
                  }}
                  className="mt-1 size-5 shrink-0 accent-azul"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-bold">
                    <Icono nombre={o.icono} className="size-5" />
                    {o.nombre}
                  </span>
                  {o.destino ? (
                    <>
                      <span className="mt-1 block text-etiqueta text-tinta-media">{o.prefijo}</span>
                      <span className="block truncate text-etiqueta text-tinta" title={o.destino}>{o.destino}</span>
                    </>
                  ) : (
                    <span className="mt-1 block text-etiqueta text-tinta-media">{o.falta}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        {canal === "email" && !conMail && (
          <p data-canal-sin-mail className="mt-3 flex items-start gap-2 text-tinta-media">
            <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
            <span>{t("clientes.ficha.canalSinMail")}</span>
          </p>
        )}
      </fieldset>
    </>
  );
}
