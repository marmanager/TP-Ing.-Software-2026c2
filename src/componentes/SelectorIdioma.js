"use client";

// Elegir el idioma (docs/idiomas.md). Queda en una cookie de este
// dispositivo, como el tema; router.refresh() vuelve a pedir la pantalla
// para que el layout la dibuje en el idioma nuevo sin perder lo escrito.
//
// Cada opción es una bandera y el código del idioma (ES, EN). Las banderas
// son SVG propios y no emoji: Windows no dibuja las banderas emoji y
// mostraría las letras "AR" y "US". El nombre completo va en el aria-label,
// en su propio idioma, para que quien usa lector de pantalla no escuche
// sólo "ES".

import { useRouter } from "next/navigation";
import { IDIOMAS, NOMBRES_IDIOMA, cookieDeIdioma } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";

function BanderaArgentina() {
  return (
    <svg viewBox="0 0 24 16" width="24" height="16" aria-hidden className="shrink-0 rounded-[2px]">
      <rect width="24" height="16" fill="#74ACDF" />
      <rect y="5.33" width="24" height="5.34" fill="#fff" />
      <circle cx="12" cy="8" r="1.7" fill="#F6B40E" />
    </svg>
  );
}

function BanderaEstadosUnidos() {
  return (
    <svg viewBox="0 0 24 16" width="24" height="16" aria-hidden className="shrink-0 rounded-[2px]">
      <rect width="24" height="16" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} y={i * 2.46} width="24" height="1.23" fill="#B22234" />
      ))}
      <rect width="10.4" height="8.6" fill="#3C3B6E" />
    </svg>
  );
}

const BANDERAS = { es: BanderaArgentina, en: BanderaEstadosUnidos };

export default function SelectorIdioma() {
  const router = useRouter();
  const { idioma, t } = useIdioma();

  function elegir(nuevo) {
    if (nuevo === idioma) return;
    document.cookie = cookieDeIdioma(nuevo);
    router.refresh();
  }

  return (
    <div role="group" aria-label={t("idioma.titulo")} className="flex flex-wrap items-center gap-x-1">
      {IDIOMAS.map((clave) => {
        const Bandera = BANDERAS[clave];
        return (
          <button
            key={clave}
            type="button"
            lang={clave}
            aria-label={NOMBRES_IDIOMA[clave]}
            aria-pressed={idioma === clave}
            onClick={() => elegir(clave)}
            className="inline-flex min-h-12 items-center gap-2 px-2 font-bold text-azul aria-pressed:underline aria-pressed:underline-offset-4"
          >
            <Bandera />
            <span aria-hidden>{clave.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
