"use client";

// La sección 05 de la bienvenida: Remi como aparece adentro de la app, con
// una charla que se escribe sola (docs/bienvenida-modulos-y-remi.md).
//
// No es Remi de verdad: POST /v1/asistente pide sesión y negocio. Es un guion
// (CHARLAS_DE_REMI) que copia el panel real —los globos, "Pensando…" y las
// tarjetas, con los textos de asistente.*— sin depender de él: sus piezas
// piden sesión y negocio, y un cambio adentro de la app no tiene que romper
// la landing.
//
// Corre sólo mientras se ve y se puede pausar: algo que se actualiza solo
// por más de 5 segundos necesita cómo frenarlo (WCAG 2.2.2). La animación va
// aria-hidden —un chat que cambia solo, leído en voz alta, es un caos— y las
// tres charlas quedan escritas abajo para el lector de pantalla.

import { useEffect, useRef, useState } from "react";
import Icono from "@/componentes/Icono";
import { describirPropuesta, leerVariable, partirTexto } from "@/lib/asistente";
import { CHARLAS_DE_REMI, estadoDeLaCharla } from "@/lib/bienvenida";
import { ESTADOS } from "@/lib/estados";
import { MODULOS, traducirModulo } from "@/lib/modulos";
import { useIdioma } from "@/lib/useIdioma";

const BOTON = "inline-flex min-h-12 items-center justify-center gap-2 rounded-campo px-5 text-cuerpo font-bold";
const PRINCIPAL = `${BOTON} bg-azul text-white`;
const NEUTRO = `${BOTON} border-2 border-borde-fuerte bg-tarjeta text-tinta`;

// Las variables de la ecuación de ejemplo, como las interpreta Remi.
const VARIABLES = [
  { clave: "horas", unidad: "h" },
  { clave: "tarifa", unidad: "$/h" },
  { clave: "repuestos", unidad: "$" },
  { clave: "iva", tipo: "constante", valor: 0.21 },
];

// Los casos de la pantalla de atrás, atenuada: está para contar que Remi se
// abre encima de cualquier pantalla, no para leerse.
const DE_FONDO = [
  { numero: 251, estado: "nuevo", cliente: "Marcela Suárez" },
  { numero: 248, estado: "en_proceso", cliente: "Hugo Peralta" },
  { numero: 246, estado: "esperando", cliente: "Silvina Roldán" },
  { numero: 243, estado: "revision_final", cliente: "Ariel Castro" },
];

// Suma el tiempo sólo mientras la charla se ve y no está en pausa. Pausar
// congela el tiempo: al seguir, retoma donde estaba.
function usarCharla() {
  const caja = useRef(null);
  const corrido = useRef(0);
  const [visible, setVisible] = useState(false);
  const [pausada, setPausada] = useState(false);
  const [estado, setEstado] = useState(() => estadoDeLaCharla(0));

  useEffect(() => {
    const el = caja.current;
    if (!el || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    // Si llegan varias entradas juntas (un deslizamiento rápido), la que vale
    // es la última.
    const io = new IntersectionObserver((es) => setVisible(es.at(-1).isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || pausada) return;
    let anterior = performance.now();
    let pedido = requestAnimationFrame(function avanzar(ahora) {
      // Con la pestaña de fondo no hay cuadros: al volver, no se saltea la charla.
      corrido.current += Math.min(ahora - anterior, 100);
      anterior = ahora;
      const nuevo = estadoDeLaCharla(corrido.current);
      setEstado((e) => (e.charla === nuevo.charla && e.pasos === nuevo.pasos ? e : nuevo));
      pedido = requestAnimationFrame(avanzar);
    });
    return () => cancelAnimationFrame(pedido);
  }, [visible, pausada]);

  return { caja, estado, pausada, alternar: () => setPausada((p) => !p) };
}

function Texto({ texto }) {
  return partirTexto(texto).map((b, i) =>
    b.tipo === "lista" ? (
      <ul key={i} className="list-disc pl-6">
        {b.items.map((tramos, k) => (
          <li key={k}>
            <Tramos tramos={tramos} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={i}>
        <Tramos tramos={b.tramos} />
      </p>
    )
  );
}

function Tramos({ tramos }) {
  return tramos.map((t, i) => (t.negrita ? <strong key={i}>{t.texto}</strong> : <span key={i}>{t.texto}</span>));
}

// Lo de abajo de la tarjeta: el botón, apretado mientras "se aplica", y
// después lo que quedó hecho, como en el panel real.
function Desenlace({ toque, hecho, hechoTexto, boton, apretado, icono, descartar }) {
  if (hecho) return <p className="mt-3 text-etiqueta font-bold text-azul">{hechoTexto}</p>;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {/* El toque se marca con el anillo y no con bg-azul-apretado: en modo
          oscuro ese fondo es celeste y el texto blanco no se lee. */}
      <span className={`${PRINCIPAL} ${toque ? "ring-4 ring-azul/25" : ""}`}>
        <Icono nombre={icono} className="size-6" />
        {toque ? apretado : boton}
      </span>
      {descartar && !toque && (
        <span className={NEUTRO}>
          <Icono nombre="cruz" className="size-6" />
          {descartar}
        </span>
      )}
    </div>
  );
}

function Propuesta({ prender, toque, hecho, t, idioma }) {
  const renglones = describirPropuesta({ prender }, null, { idioma, t });
  return (
    <div className={`mt-2 rounded-tarjeta border-2 p-4 ${hecho ? "border-borde bg-superficie" : "border-azul bg-azul-claro"}`}>
      <p className="flex items-center gap-2 font-bold">
        <Icono nombre={hecho ? "listo" : "tienda"} className="size-5" />
        {t("asistente.propuestaTitulo")}
      </p>
      <ul className="mt-2 grid list-disc gap-1 pl-6">
        {renglones.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <Desenlace
        toque={toque}
        hecho={hecho}
        hechoTexto={t("asistente.aplicada")}
        boton={t("asistente.aplicar")}
        apretado={t("asistente.aplicando")}
        icono="listo"
        descartar={t("asistente.descartar")}
      />
    </div>
  );
}

function Ecuacion({ toque, hecho, t, locale }) {
  const E = (k) => t(`acceso.landing.modulos.pantallas.ecuaciones.${k}`);
  const nombre = E("nombre");
  return (
    <div className={`mt-2 rounded-tarjeta border-2 p-4 ${hecho ? "border-borde bg-superficie" : "border-azul bg-azul-claro"}`}>
      <p className="flex items-center gap-2 font-bold">
        <Icono nombre={hecho ? "listo" : "nota"} className="size-5" />
        {nombre}
      </p>
      <p className="mt-2 overflow-x-auto rounded-campo bg-tarjeta px-3 py-2 font-mono text-cuerpo">
        {nombre} = {E("formula")}
      </p>
      <p className="mt-3 text-etiqueta font-bold text-tinta-media">{t("asistente.ecuaciones.interpreto")}</p>
      <ul className="mt-1 grid gap-1">
        {VARIABLES.map((v) => (
          <li key={v.clave} className="flex flex-wrap gap-x-2">
            <span className="font-mono font-bold">
              {leerVariable({
                nombre: t(`acceso.landing.modulos.pantallas.ecuaciones.nombres.${v.clave}`),
                unidad: v.tipo === "constante" ? "" : v.unidad,
                tipo: v.tipo,
                valor: v.valor?.toLocaleString(locale),
              })}
            </span>
            {v.tipo === "constante" && (
              <span className="text-etiqueta text-terracota">{t("asistente.ecuaciones.constante")}</span>
            )}
            <span className="text-tinta-media">— {t(`acceso.landing.remi.variables.${v.clave}`)}</span>
          </li>
        ))}
      </ul>
      <Desenlace
        toque={toque}
        hecho={hecho}
        hechoTexto={t("asistente.ecuaciones.agregada")}
        boton={t("asistente.ecuaciones.agregar")}
        apretado={t("asistente.ecuaciones.agregando")}
        icono="mas"
      />
    </div>
  );
}

// Los mensajes de una charla hasta el paso `pasos`. Se usa para la charla
// que corre y, invisible, para reservar el alto de la más larga.
function Mensajes({ charla, pasos, pausada, pregunta, respuesta, t, idioma, locale }) {
  const tarjeta = { toque: pasos === 5, hecho: pasos >= 6, t };
  return (
    <>
      <li className="mensaje flex justify-end">
        <div className="max-w-[90%]">
          <p className="mb-1 text-right text-etiqueta font-bold text-tinta-suave">{t("asistente.vos")}</p>
          <p className="break-words rounded-tarjeta bg-azul px-4 py-3 text-white">{pregunta(charla)}</p>
        </div>
      </li>

      {pasos === 2 && (
        <li className="mensaje flex justify-start">
          <p className="flex items-center gap-2 rounded-tarjeta border border-borde bg-tarjeta px-4 py-3 text-tinta-media">
            {/* En pausa no titila: la pausa frena todo lo que se mueve. */}
            <span aria-hidden className={`inline-block size-3 rounded-full bg-azul ${pausada ? "" : "animate-pulse"}`} />
            {t("asistente.pensando")}
          </p>
        </li>
      )}

      {pasos >= 3 && (
        <li className="mensaje">
          <p className="mb-1 text-etiqueta font-bold text-tinta-suave">{t("asistente.nombre")}</p>
          <div className="grid gap-2 break-words rounded-tarjeta border border-borde bg-tarjeta px-4 py-3">
            <Texto texto={respuesta(charla)} />
          </div>
          {pasos >= 4 && (
            <div className="mensaje">
              {charla.tarjeta.tipo === "propuesta" ? (
                <Propuesta prender={charla.tarjeta.prender} idioma={idioma} {...tarjeta} />
              ) : (
                <Ecuacion locale={locale} {...tarjeta} />
              )}
            </div>
          )}
        </li>
      )}
    </>
  );
}

export default function ChatDeRemi() {
  const { t, idioma, locale } = useIdioma();
  const { caja, estado, pausada, alternar } = usarCharla();
  const L = (clave, vars) => t(`acceso.landing.remi.${clave}`, vars);

  const nombreDe = (clave) => traducirModulo(MODULOS[clave], t).nombre;
  const nombres = {
    agenda: nombreDe("agenda"),
    inventario: nombreDe("inventario"),
    equipo: nombreDe("equipo"),
    aplicar: t("asistente.aplicar"),
  };
  const pregunta = (c) => L(`charlas.${c.clave}.pregunta`);
  const respuesta = (c) => L(`charlas.${c.clave}.respuesta`, nombres);

  const textos = { pregunta, respuesta, t, idioma, locale };

  return (
    <>
      <div
        ref={caja}
        className="overflow-hidden rounded-tarjeta border border-borde-fuerte bg-superficie xl:grid xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      >
        <div aria-hidden className="hidden p-6 opacity-45 xl:block">
          <p className="font-titulo text-[26px]/[30px] font-extrabold tracking-[-0.02em]">
            {t("acceso.landing.recorte.titulo")}
          </p>
          <div className="mt-5 grid gap-3">
            {DE_FONDO.map((c) => (
              <div key={c.numero} className="flex overflow-hidden rounded-tarjeta border border-borde-fuerte bg-tarjeta">
                <i className={`w-1.5 shrink-0 ${ESTADOS[c.estado].barra}`} />
                <span className="flex flex-col px-4 py-3 tabular-nums">
                  <span className="font-titulo text-subtitulo font-extrabold">
                    {t("acceso.landing.recorte.numero", { n: c.numero })}
                  </span>
                  <span className="text-apoyo text-tinta-suave">{c.cliente}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col bg-fondo xl:border-l xl:border-borde-fuerte">
          <div className="flex items-center gap-3 border-b border-borde bg-tarjeta px-4 py-3">
            <img src="/asistente.png" alt="" width={192} height={192} className="size-9 rounded-full bg-azul-claro" />
            <span className="text-subtitulo font-bold">{t("asistente.nombre")}</span>
            <button
              type="button"
              onClick={alternar}
              className="ml-auto inline-flex min-h-12 cursor-pointer items-center rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-etiqueta font-bold text-tinta transition-colors duration-100 hover:bg-superficie"
            >
              {pausada ? L("seguir") : L("pausar")}
            </button>
          </div>

          {/* La charla que corre y, debajo y en la misma celda, las tres
              en su paso más alto (la tarjeta con sus botones), invisibles:
              la caja toma siempre el alto de la más larga, en cualquier
              ancho e idioma, y el cierre de abajo no salta cada vez que
              cambia la charla. Los fantasmas no llevan "charla", así que no
              animan. */}
          <div aria-hidden className="grid flex-1">
            {CHARLAS_DE_REMI.map((c) => (
              <ol key={c.clave} className="invisible col-start-1 row-start-1 grid content-start gap-4 px-4 py-5">
                <Mensajes charla={c} pasos={4} {...textos} />
              </ol>
            ))}
            <ol key={estado.charla} className="charla col-start-1 row-start-1 grid content-start gap-4 px-4 py-5">
              <Mensajes charla={CHARLAS_DE_REMI[estado.charla]} pasos={estado.pasos} pausada={pausada} {...textos} />
            </ol>
          </div>

          <p className="mx-4 mb-4 rounded-campo border border-dashed border-borde-fuerte bg-tarjeta px-4 py-3 text-apoyo text-tinta-suave">
            {L("ejemplo")}
          </p>
        </div>
      </div>

      {/* Las tres charlas, quietas, para el lector de pantalla: con la
          tarjeta ya resuelta, que es lo que la sección quiere contar
          (Remi propone y la persona decide). Salen de las mismas piezas
          que se ven, así que no pueden desfasarse. */}
      <div className="sr-only">
        <h3>{L("transcripcion")}</h3>
        {CHARLAS_DE_REMI.map((c) => (
          <dl key={c.clave}>
            <dt>{t("asistente.vos")}</dt>
            <dd>{pregunta(c)}</dd>
            <dt>{t("asistente.nombre")}</dt>
            <dd>{respuesta(c).replaceAll("**", "")}</dd>
            <dd>
              {c.tarjeta.tipo === "propuesta" ? (
                <Propuesta prender={c.tarjeta.prender} idioma={idioma} hecho t={t} />
              ) : (
                <Ecuacion locale={locale} hecho t={t} />
              )}
            </dd>
          </dl>
        ))}
      </div>
    </>
  );
}
