// Las pantallas de ejemplo de la sección 04 de la bienvenida, una por módulo
// (docs/bienvenida-modulos-y-remi.md). Son capturas, no pantallas: igual que
// el recorte de Casos, los controles se dibujan pero no se tocan, y las
// acciones van en azul plano y sin caja.
//
// Los rótulos que la app ya tiene (los estados de un turno, el nombre de cada
// pantalla, las categorías de Estadísticas) salen de sus claves; los nombres
// propios y los números van escritos acá, como en el recorte.

import Icono from "@/componentes/Icono";
import { SUBMODULOS, traducirModulo } from "@/lib/modulos";
import { estadoDeTurno } from "@/lib/turnos";

const SOLAPA = "inline-flex h-10 items-center rounded-full px-3.5 text-etiqueta font-bold";
const SOLAPA_ELEGIDA = `${SOLAPA} border-2 border-azul bg-azul-claro text-azul`;
const SOLAPA_SUELTA = `${SOLAPA} border border-borde bg-tarjeta text-tinta-media`;
const ACCION = "inline-flex items-center gap-1.5 text-etiqueta font-bold text-azul";
const RENGLON = "border-t border-borde py-3";

function Marco({ icono, titulo, children }) {
  return (
    <div className="rounded-tarjeta border border-borde-fuerte bg-tarjeta p-4 md:p-6">
      <p className="flex items-center gap-2.5 font-titulo text-[22px]/[26px] font-extrabold tracking-[-0.01em] md:text-[26px]/[30px]">
        <Icono nombre={icono} className="size-6 shrink-0 text-tinta-media" />
        {titulo}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Solapas({ nombres }) {
  return (
    <div className="flex flex-wrap gap-2">
      {nombres.map((n, i) => (
        <span key={n} className={i === 0 ? SOLAPA_ELEGIDA : SOLAPA_SUELTA}>
          {n}
        </span>
      ))}
    </div>
  );
}

const pantalla = (clave, t) => traducirModulo(SUBMODULOS[clave], t).nombre;

/* ---------------------------------------------------------------- agenda */

// Son entre las 11 y las 11:30: Marcela ya vino (y es el caso 251 del
// recorte, «Ruido raro»), Lucía está confirmada y todavía no llegó (por eso
// está en «Todavía no vinieron» de Clientes) y el de la tarde lo pidieron
// por el link. Las acciones son las claves de la pantalla de verdad.
const TURNOS = [
  { hora: "09:00", que: "acceso.landing.casos.nuevo.asunto", quien: "Marcela Suárez", estado: "atendido" },
  { hora: "11:30", que: "acceso.landing.modulos.pantallas.agenda.t1", quien: "Lucía Pérez", estado: "confirmado", accion: "agenda.vinoAbrirCaso" },
  { hora: "15:00", que: "acceso.landing.modulos.pantallas.agenda.t2", porLink: true, estado: "agendado", accion: "agenda.confirmar" },
];

// "lo pidió por el link" va en la app después de un " · ": acá va solo.
const conMayuscula = (s, locale) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

function Agenda({ t, P, locale }) {
  return (
    <>
      <Solapas nombres={[pantalla("turnos", t), pantalla("calendario", t)]} />
      <p className="mt-5 mb-1 text-apoyo font-bold tracking-[0.06em] text-tinta-suave">{P("agenda.hoy")}</p>
      {TURNOS.map((turno) => {
        const estado = estadoDeTurno(turno.estado, t);
        return (
          <div
            key={turno.hora}
            className={`${RENGLON} grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-2 md:grid-cols-[64px_minmax(0,1fr)_auto_auto] md:items-center md:gap-x-5`}
          >
            <span className="font-titulo text-subtitulo font-extrabold tabular-nums">{turno.hora}</span>
            <span>
              <span className="block text-cuerpo font-bold">{t(turno.que)}</span>
              <span className="block text-apoyo text-tinta-suave">
                {turno.porLink ? conMayuscula(t("agenda.pidioPorLink"), locale) : turno.quien}
              </span>
            </span>
            <span className={`col-start-2 inline-flex items-center gap-1.5 text-etiqueta font-bold md:col-start-auto ${estado.texto}`}>
              <Icono nombre={estado.icono} className="size-5" />
              {estado.palabra}
            </span>
            {turno.accion ? (
              <span className={`col-start-2 md:col-start-auto ${ACCION}`}>{t(turno.accion)}</span>
            ) : (
              <span className="hidden md:block" />
            )}
          </div>
        );
      })}
    </>
  );
}

/* -------------------------------------------------------------- clientes */

const CLIENTES = [
  { nombre: "Marcela Suárez", telefono: "11 5555-1234", casos: 3 },
  { nombre: "Hugo Peralta", telefono: "11 4444-9876", casos: 1 },
];

function Clientes({ t, P }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CLIENTES.map((c) => (
        <div key={c.nombre} className="rounded-tarjeta border border-borde p-4">
          <p className="text-cuerpo font-bold">{c.nombre}</p>
          <p className="text-apoyo text-tinta-suave tabular-nums">
            {c.telefono} · {t("clientes.casos", { n: c.casos })}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <span className={ACCION}>
              <Icono nombre="whatsapp" className="size-5" />
              {P("clientes.whatsapp")}
            </span>
            <span className={ACCION}>
              <Icono nombre="telefono" className="size-5" />
              {P("clientes.llamar")}
            </span>
          </p>
        </div>
      ))}
      <div className="rounded-tarjeta border border-dashed border-borde-fuerte p-4 sm:col-span-2">
        <p className="text-apoyo font-bold text-tinta-suave">{t("clientes.porVenirTitulo")}</p>
        <p className="text-cuerpo text-tinta-media">Lucía Pérez</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ inventario */

function Inventario({ t, P }) {
  return (
    <>
      <p className="text-apoyo font-bold tracking-[0.06em] text-tinta-suave">{pantalla("stock", t)}</p>
      <div className={`${RENGLON} mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1`}>
        <span>
          <span className="block text-cuerpo font-bold">{P("inventario.pastillas")}</span>
          <span className="block text-apoyo text-tinta-suave tabular-nums">
            {P("inventario.quedanMinimo", { n: 2, minimo: 4 })}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-etiqueta font-bold text-espera">
          <Icono nombre="alerta" className="size-5" />
          {P("inventario.bajo")}
        </span>
      </div>
      <div className={RENGLON}>
        <span className="block text-cuerpo font-bold">{P("inventario.aceite")}</span>
        <span className="block text-apoyo text-tinta-suave tabular-nums">{P("inventario.quedan", { n: 12 })}</span>
      </div>

      {/* Lo que está en camino es lo que espera el caso 246 del recorte, y
          la acción es la misma que muestra su fila allá arriba. */}
      <p className="mt-4 text-apoyo font-bold tracking-[0.06em] text-tinta-suave">{pantalla("en_camino", t)}</p>
      <div className={`${RENGLON} mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1`}>
        <span>
          <span className="block text-cuerpo font-bold">{P("inventario.filtro")}</span>
          <span className="block text-apoyo text-tinta-suave tabular-nums">
            {P("inventario.paraCaso", { n: 246 })}
          </span>
        </span>
        <span className={ACCION}>
          <Icono nombre="check" className="size-5" />
          {t("inventario.enCamino.marcarLlego")}
        </span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ ecuaciones */

// Los valores del ejemplo. Los valores y el resultado salen de acá: escritos
// a mano, un día alguien cambia la tarifa y el número queda mintiendo.
const PRECIO = { horas: 3, tarifa: 25000, repuestos: 48000, iva: 0.21 };
const PRECIO_FINAL = Math.round((PRECIO.horas * PRECIO.tarifa + PRECIO.repuestos) * (1 + PRECIO.iva));

function Ecuaciones({ P, locale }) {
  return (
    <>
      <p className="text-cuerpo font-bold">{P("ecuaciones.nombre")}</p>
      <p className="mt-2 overflow-x-auto rounded-campo bg-superficie px-3 py-2 font-mono text-cuerpo">
        {P("ecuaciones.formula")}
      </p>
      <p className="mt-2 text-apoyo text-tinta-suave tabular-nums">
        {P("ecuaciones.valores", {
          horas: PRECIO.horas,
          tarifa: PRECIO.tarifa.toLocaleString(locale),
          repuestos: PRECIO.repuestos.toLocaleString(locale),
          iva: Math.round(PRECIO.iva * 100),
        })}
      </p>
      <p className="mt-3 font-titulo text-dato font-black tracking-[-0.02em] tabular-nums">
        ${PRECIO_FINAL.toLocaleString(locale)}
      </p>
      <p className="mt-3 inline-flex items-center gap-2 border-t border-borde pt-3 text-etiqueta font-bold text-terracota">
        <Icono nombre="nota" className="size-5" />
        {P("ecuaciones.listas")}
      </p>
    </>
  );
}

/* ---------------------------------------------------------------- lienzo */

const HERRAMIENTAS = ["lapiz", "pincel", "linea", "flecha", "rectangulo", "circulo", "borrador"];
const COLORES = ["bg-tinta", "bg-rojo", "bg-azul", "bg-completo"];

function Lienzo({ P }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {HERRAMIENTAS.map((h, i) => (
          <span
            key={h}
            className={`inline-flex size-10 items-center justify-center rounded-campo ${
              i === 0 ? "border-2 border-azul bg-azul-claro text-azul" : "border border-borde text-tinta-media"
            }`}
          >
            <Icono nombre={h} className="size-5" />
          </span>
        ))}
        <span className="ml-1 flex gap-1.5">
          {COLORES.map((c) => (
            <i key={c} className={`size-6 rounded-full ${c} ${c === "bg-rojo" ? "ring-2 ring-offset-2 ring-rojo" : ""}`} />
          ))}
        </span>
      </div>
      {/* El dibujo: un motor visto de costado y una flecha a la junta que
          pierde. Trazos de mano, sin relleno: es lo que haría el dueño en
          el mostrador. */}
      <div className="relative mt-3 h-44 overflow-hidden rounded-campo border border-borde bg-tarjeta">
        <svg aria-hidden viewBox="0 0 400 176" className="absolute inset-0 size-full" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <g className="text-tinta">
            <path d="M60 120 L60 70 L110 70 L120 55 L200 55 L210 70 L250 70 L250 120 Z" />
            <path d="M80 120 L80 140 M230 120 L230 140 M50 140 L260 140" />
            <path d="M150 55 L150 40 L180 40 L180 55" />
          </g>
          <g className="text-rojo">
            <path d="M330 60 C300 70 275 85 262 108" />
            <path d="M262 108 L262 94 M262 108 L275 101" />
            <path d="M240 128 C246 132 244 138 238 140" strokeWidth="2.5" />
          </g>
        </svg>
        <span className="absolute top-6 right-4 max-w-[45%] text-right font-titulo text-etiqueta font-extrabold text-rojo">
          {P("lienzo.nota")}
        </span>
      </div>
      <p className={`mt-3 ${ACCION}`}>
        <Icono nombre="flecha-abajo" className="size-5" />
        {P("lienzo.bajar")}
      </p>
    </>
  );
}

/* ---------------------------------------------------------- estadísticas */

// Los casos de cada semana del mes; suman los del recuadro.
const SEMANAS = [8, 13, 11, 10];
const CASOS_DEL_MES = SEMANAS.reduce((a, b) => a + b, 0);
const COBRADO = 2380000;

function Estadisticas({ t, P, locale }) {
  const mayor = Math.max(...SEMANAS);
  return (
    <>
      <Solapas nombres={["resumen", "casos", "cobros"].map((c) => t(`dashboard.categorias.${c}.nombre`))} />
      <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
        <span>
          <span className="block text-apoyo text-tinta-suave">{P("dashboard.casosDelMes")}</span>
          <span className="font-titulo text-dato font-black tracking-[-0.02em] tabular-nums">{CASOS_DEL_MES}</span>
        </span>
        <span>
          <span className="block text-apoyo text-tinta-suave">{P("dashboard.cobrado")}</span>
          <span className="font-titulo text-dato font-black tracking-[-0.02em] tabular-nums">
            ${COBRADO.toLocaleString(locale)}
          </span>
        </span>
      </div>
      <p className="mt-5 text-apoyo font-bold text-tinta-suave">{P("dashboard.porSemana")}</p>
      {/* Barras de CSS y no recharts: es una captura, y la librería de
          gráficos no tiene nada que hacer en la landing. Las barras son
          spans vacíos: el lector de pantalla lee sólo los números. */}
      <div className="mt-2 flex h-28 items-end gap-3 border-b border-borde-fuerte">
        {SEMANAS.map((n, i) => (
          <span key={i} className="flex h-full flex-1 flex-col justify-end">
            <span className="text-center text-apoyo font-bold tabular-nums text-tinta-media">{n}</span>
            <span className="mt-1 rounded-t-[6px] bg-azul" style={{ height: `${(n / mayor) * 70}%` }} />
          </span>
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- todas */

const PANTALLAS = {
  agenda: Agenda,
  clientes: Clientes,
  inventario: Inventario,
  ecuaciones: Ecuaciones,
  lienzo: Lienzo,
  dashboard: Estadisticas,
};

export default function PantallaDeModulo({ clave, icono, nombre, t, locale }) {
  const Pantalla = PANTALLAS[clave];
  const P = (k, vars) => t(`acceso.landing.modulos.pantallas.${k}`, vars);
  return (
    <Marco icono={icono} titulo={nombre}>
      <Pantalla t={t} P={P} locale={locale} />
    </Marco>
  );
}
