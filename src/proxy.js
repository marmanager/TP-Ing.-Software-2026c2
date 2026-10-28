// El idioma de los links públicos (docs/idioma-en-links-publicos.md):
// /turnos/<código>?idioma=en y /n/<código>?idioma=en guardan la cookie y
// vuelven a la dirección sin el parámetro. El layout raíz ya lee la cookie.

import { NextResponse } from "next/server";
import { IDIOMAS, cookieDeIdioma } from "@/lib/idioma";

export function proxy(request) {
  const idioma = request.nextUrl.searchParams.get("idioma");
  if (!IDIOMAS.includes(idioma)) return NextResponse.next();

  const limpia = request.nextUrl.clone();
  limpia.searchParams.delete("idioma");
  const respuesta = NextResponse.redirect(limpia);
  respuesta.headers.append("set-cookie", cookieDeIdioma(idioma));
  return respuesta;
}

export const config = { matcher: ["/turnos/:codigo", "/n/:codigo"] };
