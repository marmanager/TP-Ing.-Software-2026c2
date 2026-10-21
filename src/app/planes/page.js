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
import { agruparPlanes, ahorroAnual, diasQueQuedan, monto } from "@/lib/suscripcion";
import { useSuscripcionCompartida } from "@/lib/useSuscripcion";
import { Boton, Cargando, ErrorGeneral, Tarjeta, TituloPantalla, TituloSeccion } from "@/componentes/ui";

// Dos botones, uno prendido: Mensual / Anual y USD / ARS.
function Eleccion({ etiqueta, opciones, valor, onChange }) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex rounded-campo border border-borde p-1">
      {opciones.map(({ clave, texto, motivo }) => (
        <button
          key={clave}
          type="button"
          aria-pressed={valor === clave}
          disabled={Boolean(motivo)}
          title={motivo ?? undefined}
          onClick={() => onChange(clave)}
          className={`min-h-12 rounded-campo px-4 font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
            valor === clave ? "bg-azul text-white" : "text-tinta-media"
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

function encabezado(datos) {
  const dias = diasQueQuedan(datos?.prueba?.hasta);
  if (datos?.motivo === "pago") return ["El negocio ya tiene la suscripción activa", "Podés seguir usando la app con todo tu equipo."];
  if (datos?.motivo === "prueba") return ["Estás en tu mes de prueba", `Te quedan ${dias} ${dias === 1 ? "día" : "días"}. Si querés, ya podés elegir un plan.`];
  if (datos?.motivo === "acceso_libre") return ["Elegí un plan", "Tu cuenta usa la app sin suscripción (acceso de desarrollo)."];
  if (datos?.prueba?.hasta) return ["Tu mes de prueba terminó", "Para seguir usando la app, elegí un plan."];
  return ["Elegí cómo empezar", "Todo el sistema, para vos y tu equipo."];
}

export default function Planes() {
  useTitulo("Planes");
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

  const [titulo, apoyo] = encabezado(datos);
  const lista = agruparPlanes(planes?.precios);
  const sinPesos = !planes?.dolar;

  return (
    <div className="mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8">
      <TituloPantalla apoyo={apoyo}>{titulo}</TituloPantalla>

      {error && <ErrorGeneral>{error.mensaje}</ErrorGeneral>}

      {datos?.prueba?.disponible && (
        <Tarjeta className="mb-8 border-azul">
          <p className="text-subtitulo font-bold">Probá gratis un mes</p>
          <p className="mt-1 text-tinta-media">
            Todo el sistema, para todo tu equipo, durante 30 días. No te pedimos tarjeta: cuando
            termine, elegís un plan para seguir.
          </p>
          <Boton variante="principal" className="mt-4" onClick={probar} disabled={ocupado !== null}>
            {ocupado === "prueba" ? "Empezando…" : "Empezar mi mes gratis"}
          </Boton>
        </Tarjeta>
      )}

      <TituloSeccion>Planes</TituloSeccion>
      <Eleccion
        etiqueta="Cada cuánto se paga"
        valor={periodo}
        onChange={setPeriodo}
        opciones={[
          { clave: "mensual", texto: "Mensual" },
          { clave: "anual", texto: "Anual · 2 meses gratis" },
        ]}
      />

      {!planes && !error ? (
        <div className="mt-6"><Cargando filas={2} /></div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {lista.map((p) => {
            const precio = p[periodo];
            const texto = monto(precio, moneda);
            const ahorro = periodo === "anual" ? ahorroAnual(p.mensual, p.anual, moneda) : null;
            return (
              <Tarjeta key={p.plan} className="flex flex-col">
                <p className="text-subtitulo font-bold">{p.plan}</p>
                <p className="mt-1 text-tinta-media">{p.descripcion}</p>
                <p className="mt-4 text-pantalla">
                  {texto ?? "—"}
                  <span className="text-cuerpo text-tinta-media"> / {periodo === "anual" ? "año" : "mes"}</span>
                </p>
                {ahorro && <p className="mt-1 font-bold text-completo">Ahorrás {ahorro} por año</p>}
                {esDuenio && precio && (
                  <Boton
                    variante="principal"
                    className="mt-6 self-start"
                    onClick={() => elegir(precio)}
                    disabled={ocupado !== null || datos?.motivo === "pago"}
                  >
                    {ocupado === precio.id ? "Abriendo Mercado Pago…" : `Elegir ${p.plan}`}
                  </Boton>
                )}
              </Tarjeta>
            );
          })}
        </div>
      )}

      {!esDuenio && (
        <p className="mt-6 font-bold">Pedile al dueño del negocio que elija un plan.</p>
      )}

      <div className="mt-10 border-t border-borde pt-6">
        <p className="mb-3 text-apoyo text-tinta-suave">Ver los precios en</p>
        <Eleccion
          etiqueta="Moneda"
          valor={moneda}
          onChange={setMoneda}
          opciones={[
            { clave: "USD", texto: "Dólares (USD)" },
            { clave: "ARS", texto: "Pesos (ARS)", motivo: sinPesos ? "Ahora no tenemos la cotización del dólar" : null },
          ]}
        />
        <p className="mt-3 text-apoyo text-tinta-suave">
          {planes?.dolar
            ? `Dólar oficial: $ ${planes.dolar.toLocaleString("es-AR")}. `
            : ""}
          Mercado Pago cobra en pesos, al dólar oficial del día en que te suscribís.
        </p>
      </div>

      {datos?.activa && (
        <Boton className="mt-8" onClick={() => router.push("/")}>Ir a la app</Boton>
      )}
    </div>
  );
}
