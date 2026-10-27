"use client";

// Planes: lo primero que ve un negocio nuevo, y adonde vuelve cuando no tiene
// suscripción ni prueba (Guardia). Va sin la barra de navegación.
//
// Arriba, el mes gratis si todavía se puede usar (una vez por cuenta, sin
// tarjeta). Abajo, Básico y Pro, mensual o anual (el anual son 10 meses).
// Al pie, la moneda: los precios están en dólares y Mercado Pago cobra en
// pesos al oficial del día en que se suscribe.
//
// Elige el dueño. El resto del equipo ve los planes y a quién pedírselo.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { agruparPlanes, ahorroAnual, diasQueQuedan, monto } from "@/lib/suscripcion";
import { useSuscripcionCompartida } from "@/lib/useSuscripcion";
import { Boton, Cargando, ErrorGeneral, Tarjeta, TituloPantalla, TituloSeccion } from "@/componentes/ui";

// Dos botones, uno prendido: Mensual / Anual y USD / ARS.
function Eleccion({ etiqueta, opciones, valor, onChange }) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex flex-wrap gap-2">
      {opciones.map(({ clave, texto, motivo }) => (
        <button
          key={clave}
          type="button"
          aria-pressed={valor === clave}
          disabled={Boolean(motivo)}
          title={motivo ?? undefined}
          onClick={() => onChange(clave)}
          className={`min-h-12 cursor-pointer rounded-campo border px-4 font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
            valor === clave
              ? "border-azul bg-azul text-white"
              : "border-borde-fuerte bg-superficie text-tinta hover:bg-azul-claro"
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

function encabezado(datos, t) {
  const dias = diasQueQuedan(datos?.prueba?.hasta);
  if (datos?.motivo === "pago") return [t("planes.encabezado.pago"), t("planes.encabezado.pagoApoyo")];
  if (datos?.motivo === "prueba") return [t("planes.encabezado.prueba"), t("planes.encabezado.pruebaApoyo", { n: dias })];
  if (datos?.motivo === "acceso_libre") return [t("planes.encabezado.libre"), t("planes.encabezado.libreApoyo")];
  if (datos?.prueba?.hasta) return [t("planes.encabezado.termino"), t("planes.encabezado.terminoApoyo")];
  return [t("planes.encabezado.nuevo"), t("planes.encabezado.nuevoApoyo")];
}

export default function Planes() {
  const { t, locale } = useIdioma();
  useTitulo(t("planes.titulo"));
  const router = useRouter();
  const { usuario } = useAuth();
  const { datos, traerPlanes, empezarPrueba, suscribirse } = useSuscripcionCompartida();
  const esDuenio = Boolean(usuario?.es_duenio);

  const [planes, setPlanes] = useState(null);
  const [periodo, setPeriodo] = useState("mensual");
  const [moneda, setMoneda] = useState("USD");
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    traerPlanes().then((r) => {
      if (!vivo) return;
      if (r.ok) setPlanes(r.datos);
      else setError(r.error);
    });
    return () => { vivo = false; };
  }, [traerPlanes]);

  async function probar() {
    setOcupado("prueba");
    setError(null);
    const r = await empezarPrueba();
    if (r.ok) return router.push("/prueba");
    setOcupado(null);
    setError(r.error);
  }

  async function elegir(precio) {
    setOcupado(precio.id);
    setError(null);
    const r = await suscribirse(precio.id);
    if (r.ok) return window.location.assign(r.url);
    setOcupado(null);
    setError(r.error);
  }

  const [titulo, apoyo] = encabezado(datos, t);
  const lista = agruparPlanes(planes?.precios);
  const sinPesos = !planes?.dolar;

  return (
    <div className="mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8">
      <TituloPantalla apoyo={apoyo}>{titulo}</TituloPantalla>

      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

      {datos?.prueba?.disponible && (
        <Tarjeta className="mb-8 border-azul">
          <p className="text-subtitulo font-bold">{t("planes.gratis.titulo")}</p>
          <p className="mt-1 text-tinta-media">
            {t("planes.gratis.texto")}
          </p>
          <Boton variante="principal" className="mt-4" onClick={probar} disabled={ocupado !== null}>
            {ocupado === "prueba" ? t("planes.gratis.empezando") : t("planes.gratis.empezar")}
          </Boton>
        </Tarjeta>
      )}

      <TituloSeccion>{t("planes.titulo")}</TituloSeccion>
      <Eleccion
        etiqueta={t("planes.cadaCuanto")}
        valor={periodo}
        onChange={setPeriodo}
        opciones={[
          { clave: "mensual", texto: t("planes.mensual") },
          { clave: "anual", texto: t("planes.anual") },
        ]}
      />

      {!planes && !error ? (
        <div className="mt-6"><Cargando filas={2} /></div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {lista.map((p) => {
            const precio = p[periodo];
            const texto = monto(precio, moneda, locale);
            const ahorro = periodo === "anual" ? ahorroAnual(p.mensual, p.anual, moneda, locale) : null;
            return (
              <Tarjeta key={p.plan} className="flex flex-col">
                <p className="text-subtitulo font-bold">{p.plan}</p>
                <p className="mt-1 text-tinta-media">{p.descripcion}</p>
                <p className="mt-4 text-pantalla">
                  {texto ?? "—"}
                  <span className="text-cuerpo text-tinta-media"> {periodo === "anual" ? t("planes.porAnio") : t("planes.porMes")}</span>
                </p>
                {ahorro && <p className="mt-1 font-bold text-completo">{t("planes.ahorro", { ahorro })}</p>}
                {esDuenio && precio && (
                  <Boton
                    variante="principal"
                    className="mt-6 self-start"
                    onClick={() => elegir(precio)}
                    disabled={ocupado !== null || datos?.motivo === "pago"}
                  >
                    {ocupado === precio.id ? t("planes.abriendo") : t("planes.elegir", { plan: p.plan })}
                  </Boton>
                )}
              </Tarjeta>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-apoyo text-tinta-suave">
        {t("planes.impuestos")}
      </p>

      {!esDuenio && (
        <p className="mt-6 font-bold">{t("planes.pedileAlDuenio")}</p>
      )}

      <div className="mt-10 border-t border-borde pt-6">
        <p className="mb-3 text-apoyo text-tinta-suave">{t("planes.verPreciosEn")}</p>
        <Eleccion
          etiqueta={t("planes.moneda")}
          valor={moneda}
          onChange={setMoneda}
          opciones={[
            { clave: "USD", texto: t("planes.dolares") },
            { clave: "ARS", texto: t("planes.pesos"), motivo: sinPesos ? t("planes.sinCotizacion") : null },
          ]}
        />
        <p className="mt-3 text-apoyo text-tinta-suave">
          {planes?.dolar
            ? `${t("planes.dolarOficial", { monto: planes.dolar.toLocaleString(locale) })} `
            : ""}
          {t("planes.mercadoPago")}
        </p>
      </div>

      {datos?.activa && (
        <Boton className="mt-8" onClick={() => router.push("/")}>{t("planes.irALaApp")}</Boton>
      )}
    </div>
  );
}
