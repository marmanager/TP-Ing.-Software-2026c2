"use client";

// El mes de prueba: a dónde llega quien lo empieza desde Planes, y adonde
// puede volver para ver cuánto le queda. Va sin la barra de navegación.

import { useRouter } from "next/navigation";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { diasQueQuedan } from "@/lib/suscripcion";
import { useSuscripcionCompartida } from "@/lib/useSuscripcion";
import { Boton, Cargando, Tarjeta, TituloPantalla } from "@/componentes/ui";

const fecha = (iso, locale) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long" });

export default function Prueba() {
  const { locale, t } = useIdioma();
  useTitulo(t("cuenta.suscripcion.prueba"));
  const router = useRouter();
  const { cargando, datos } = useSuscripcionCompartida();

  if (cargando) return <div className="mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8"><Cargando /></div>;

  const hasta = datos?.prueba?.hasta;
  const dias = diasQueQuedan(hasta);
  const activa = datos?.motivo === "prueba";

  return (
    <div className="mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8">
      {activa ? (
        <>
          <TituloPantalla apoyo={t("prueba.queda", { n: dias, fecha: fecha(hasta, locale) })}>
            {t("prueba.activo")}
          </TituloPantalla>
          <Tarjeta>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>{t("prueba.todo")}</li>
              <li>{t("prueba.sinTarjeta")}</li>
              <li>{t("prueba.alTerminar")}</li>
            </ul>
          </Tarjeta>
          <div className="mt-6 flex flex-wrap gap-3">
            <Boton variante="principal" onClick={() => router.push("/")}>{t("planes.irALaApp")}</Boton>
            <Boton onClick={() => router.push("/planes")}>{t("prueba.elegirAhora")}</Boton>
          </div>
        </>
      ) : (
        <>
          <TituloPantalla
            apoyo={hasta ? t("prueba.termino", { fecha: fecha(hasta, locale) }) : t("prueba.empezar")}
          >
            {hasta ? t("planes.encabezado.termino") : t("prueba.noEmpezaste")}
          </TituloPantalla>
          <Boton variante="principal" onClick={() => router.push("/planes")}>{t("cuenta.suscripcion.verPlanes")}</Boton>
        </>
      )}
    </div>
  );
}
