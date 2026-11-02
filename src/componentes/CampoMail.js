"use client";

// El mail de un cliente nuevo, en las altas (083). Siempre opcional: no se le
// pide a cada cliente que viene. Si lo dejan, sirve para mandarle los avisos
// por mail; sin teléfono, sus avisos arrancan por ahí.

import { useState } from "react";
import { emailValido } from "@/lib/recordatorios";
import { useIdioma } from "@/lib/useIdioma";
import { Campo } from "@/componentes/ui";

export function useMail() {
  const [valor, setValor] = useState("");
  const [tocado, setTocado] = useState(false);
  const escrito = valor.trim();
  return {
    valor, setValor, setTocado,
    // null si no hay o no sirve: un mail mal escrito no se manda.
    email: emailValido(escrito) ? escrito : null,
    malo: !!escrito && !emailValido(escrito),
    tocado,
    vaciar: () => { setValor(""); setTocado(false); },
  };
}

export default function CampoMail({ id, mail }) {
  const { t } = useIdioma();
  return (
    <Campo
      id={id}
      etiqueta={t("clientes.mailNuevo")}
      ayuda={t("clientes.mailNuevoAyuda")}
      type="email"
      inputMode="email"
      autoComplete="off"
      value={mail.valor}
      error={mail.tocado && mail.malo ? t("clientes.ficha.mailNoSirve") : null}
      onChange={(e) => mail.setValor(e.target.value)}
      onBlur={() => mail.setTocado(true)}
    />
  );
}
