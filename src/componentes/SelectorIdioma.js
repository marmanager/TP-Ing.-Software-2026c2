"use client";

// Elegir el idioma (docs/idiomas.md). Queda en una cookie de este
// dispositivo, como el tema; router.refresh() vuelve a pedir la pantalla
// para que el layout la dibuje en el idioma nuevo sin perder lo escrito.

import { useRouter } from "next/navigation";
import { IDIOMAS, NOMBRES_IDIOMA, cookieDeIdioma } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";

export default function SelectorIdioma() {
  const router = useRouter();
  const { idioma, t } = useIdioma();

  function elegir(nuevo) {
    if (nuevo === idioma) return;
    document.cookie = cookieDeIdioma(nuevo);
    router.refresh();
  }

  return (
    <div role="group" aria-label={t("idioma.titulo")} className="flex flex-wrap gap-x-4">
      {IDIOMAS.map((clave) => (
        <button
          key={clave}
          type="button"
          lang={clave}
          aria-pressed={idioma === clave}
          onClick={() => elegir(clave)}
          className="inline-flex min-h-12 items-center font-bold text-azul aria-pressed:underline aria-pressed:underline-offset-4"
        >
          {NOMBRES_IDIOMA[clave]}
        </button>
      ))}
    </div>
  );
}
