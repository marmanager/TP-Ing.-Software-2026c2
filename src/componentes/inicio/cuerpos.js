"use client";

// El contenido de cada módulo del Inicio.
//
// Todos reciben lo mismo: el filtro elegido y cuántas filas entran según el
// alto. Si hay más de las que entran, la última línea dice cuántas quedaron y
// lleva a la sección completa: nunca se esconde información sin avisar.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { destinoDashboard, periodoDashboard } from "@/lib/dashboard";
import { formatoNumero } from "@/lib/formatoNumero";
import { useDatos } from "@/lib/datos";
import { useIdioma } from "@/lib/useIdioma";
import { presentacion } from "@/lib/inventario";
import {
  casosPorAprobar,
  estaAbierto,
  ORDEN_ESTADOS,
  queFalta,
  pesos,
  quienLoTiene,
} from "@/lib/estados";
import { ESTADOS } from "@/lib/estados";
import { mayuscula, vocabulario } from "@/lib/presets";
import { presentacionEstado } from "@/lib/presentacion-estados";
import { horaYMinutos, diaLargo, cuando } from "@/lib/fechas";
import { filtrarHistorial } from "@/lib/historial";
import { estadoDeTurno } from "@/lib/turnos";
import { hijosActivos } from "@/lib/modulos";
import { casoEnFrase, lineaDelCaso, subtituloDelCaso, tituloDelCaso } from "@/lib/nombres";
import { telefonoLegible } from "@/lib/telefono";
import Icono from "@/componentes/Icono";

// ---------- piezas compartidas ----------

function SinNada({ children }) {
  return <p className="px-4 py-3 text-tinta-media sm:px-6">{children}</p>;
}

function Fila({ href, children }) {
  return (
    <li className="border-b border-borde last:border-b-0">
      <Link
        href={href}
        className="flex min-h-12 items-center gap-3 px-4 py-2.5 hover:bg-superficie sm:px-6"
      >
        {children}
      </Link>
    </li>
  );
}

// "clave" es inicio.ymas.<clave> (casos, turnos...); "palabra" es articulo.palabra
// del rubro: en castellano va siempre en plural, como estaba; en inglés concuerda con la cantidad.
function YMas({ cuantos, href, clave, palabra }) {
  const { idioma, t } = useIdioma();
  if (cuantos <= 0) return null;
  return (
    <li className="border-t border-borde">
      <Link
        href={href}
        className="flex min-h-12 items-center gap-2 px-4 font-bold text-azul sm:px-6"
      >
        <Icono nombre="mas" className="size-5" />
        {palabra ? t("inicio.ymas.palabra", { n: cuantos, palabra: idioma === "es" ? palabra(2) : palabra(cuantos) }) : t(`inicio.ymas.${clave}`, { n: cuantos })}
      </Link>
    </li>
  );
}

// Barrita de color a la izquierda: el estado se reconoce de reojo.
function Barra({ estado }) {
  return (
    <span
      className={`h-8 w-1.5 shrink-0 rounded-full ${ESTADOS[estado]?.barra ?? "bg-borde"}`}
      aria-hidden="true"
    />
  );
}

// ---------- pendientes ----------

function Numerito({ href, icono, color, titulo, cuanto, detalle }) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-campo p-3 hover:bg-superficie"
    >
      {/* Celular: título a la izquierda y número a la derecha, en una línea.
          Desde sm: apilados, como estaban. */}
      <span className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5">
        <span className={`flex min-w-0 items-center gap-1.5 font-bold text-etiqueta ${color}`}>
          <Icono nombre={icono} className="size-5 shrink-0" />
          {titulo}
        </span>
        <span className="shrink-0 whitespace-nowrap font-titulo font-extrabold text-subtitulo">
          {cuanto}
        </span>
      </span>
      {/* Sin truncate: acá el texto explica el número y no hay nada que
          tocar para leerlo completo. */}
      <span className="text-apoyo text-tinta-suave [overflow-wrap:anywhere]">{detalle}</span>
    </Link>
  );
}

function CuerpoPendientes() {
  const { idioma, t } = useIdioma();
  const { casos, insumos, negocio } = useDatos();
  // Esta tarjeta es del núcleo y está en cualquier negocio, pero uno de sus
  // tres números es del Inventario. Con esa pantalla apagada el número
  // llevaba a algo que el negocio decidió no tener. Es la única tarjeta que
  // cruza a otra sección: las demás sólo linkean a la suya, y ésas ya se
  // esconden solas con su módulo.
  const conEnCamino = hijosActivos("inventario", negocio?.modulos_activos ?? []).some(
    (h) => h.clave === "en_camino"
  );
  const { articulo } = vocabulario(negocio?.rubro, idioma);

  const abiertos = casos.filter(estaAbierto);
  const esperando = abiertos.filter((c) => c.estado === "esperando");
  const listos = abiertos.filter((c) => c.estado === "revision_final");
  // Este número contaba "lo que llegó", un estado que nada produce: marcar
  // que llegó pasa el insumo directo al stock. Daba siempre cero. Ahora
  // cuenta lo que está en camino (SCRUM-113), que es lo que se mira a la
  // mañana: qué falta que llegue, y para qué caso.
  const enCamino = insumos.filter((i) => i.estado === "pedido");
  const casoDelPrimero = casos.find((c) => c.id === enCamino[0]?.caso_id);

  return (
    <div className="flex flex-col divide-y divide-borde p-2 sm:flex-row sm:flex-wrap sm:gap-2 sm:divide-y-0 sm:p-4">
      <Numerito
        href="/casos"
        icono="reloj"
        color="text-espera"
        titulo={t("inicio.pendientes.esperanTitulo")}
        cuanto={t("inicio.pendientes.casos", { n: esperando.length })}
        detalle={esperando.length ? t("inicio.pendientes.faltaContestar") : t("inicio.pendientes.ninguno")}
      />
      {conEnCamino && (
        <Numerito
          href="/inventario/en-camino"
          icono="camion"
          color="text-terracota"
          titulo={t("inicio.pendientes.enCamino", { palabra: mayuscula(articulo.palabra(2)) })}
          cuanto={articulo.cuantos(enCamino.length)}
          detalle={
            enCamino.length === 0
              ? t("inicio.pendientes.nadaPorLlegar")
              : casoDelPrimero
                ? t("inicio.pendientes.paraElCaso", { nombre: enCamino[0].nombre, caso: casoEnFrase(casoDelPrimero, t) })
                : t("inicio.pendientes.paraElStock", { nombre: enCamino[0].nombre })
          }
        />
      )}
      <Numerito
        href="/casos"
        icono="listo"
        color="text-completo"
        titulo={t("inicio.pendientes.listosTitulo")}
        cuanto={t("inicio.pendientes.casos", { n: listos.length })}
        detalle={listos.length ? t("inicio.pendientes.faltaAvisar") : t("inicio.pendientes.ningunoControl")}
      />
    </div>
  );
}

// ---------- casos ----------

function CuerpoCasos({ filtro, filas }) {
  const { idioma, t } = useIdioma();
  const { casos, clientes, empleados, negocio, pasos, insumos } = useDatos();

  const elegidos = casos
    .filter((c) => {
      if (filtro === "todos") return true;
      if (filtro === "abiertos" || !filtro) return estaAbierto(c);
      return c.estado === filtro;
    })
    .sort((a, b) => ORDEN_ESTADOS.indexOf(a.estado) - ORDEN_ESTADOS.indexOf(b.estado));

  if (elegidos.length === 0) {
    return (
      <SinNada>
        {filtro === "todos" || filtro === "abiertos"
          ? t("inicio.casos.vacio")
          : t("inicio.casos.ningunoEn", { estado: presentacionEstado(negocio, filtro, idioma).nombre.toLowerCase() })}
      </SinNada>
    );
  }

  return (
    <ul>
      {elegidos.slice(0, filas).map((caso) => {
        const cliente = clientes.find((c) => c.id === caso.cliente_id);
        // El nombre arriba con el número en chiquito, y abajo el cliente
        // sólo si el caso no se llama ya así (SCRUM-119).
        const titulo = tituloDelCaso(caso, t);
        const quien =
          cliente?.nombre === titulo ? null : (cliente?.nombre ?? t("inicio.sinCliente"));
        return (
          <Fila key={caso.id} href={`/casos/${caso.id}`}>
            <Barra estado={caso.estado} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">
                {titulo}
                {lineaDelCaso(caso, undefined, t) && ` · ${lineaDelCaso(caso, undefined, t)}`}
                {subtituloDelCaso(caso, t) && (
                  <span className="font-normal text-apoyo text-tinta-suave"> · {subtituloDelCaso(caso, t)}</span>
                )}
              </span>
              <span className="block truncate text-apoyo text-tinta-suave">
                {quien && `${quien} · `}
                {queFalta(caso, { rubro: negocio?.rubro, pasos, insumos, cliente, idioma }, t)}
              </span>
            </span>
            <span className="hidden shrink-0 text-apoyo text-tinta-suave sm:block">
              {quienLoTiene(caso, empleados, t)}
            </span>
          </Fila>
        );
      })}
      <YMas cuantos={elegidos.length - filas} href="/casos" clave="casos" />
    </ul>
  );
}

// ---------- agenda ----------

// En castellano el día va en minúscula entero ("miércoles 28 de octubre"). En
// inglés sólo "today" y "tomorrow": "Wednesday, October 28" lleva mayúsculas.
const enMinusculas = (dia, idioma) => (idioma === "es" || !/[\s,]/.test(dia) ? dia.toLowerCase() : dia);

function CuerpoAgenda({ filtro, filas }) {
  const { idioma, locale, t: tr } = useIdioma();
  const { turnos, clientes } = useDatos();

  const arrancaHoy = new Date();
  arrancaHoy.setHours(0, 0, 0, 0);
  const hastaManana = new Date(arrancaHoy);
  hastaManana.setDate(hastaManana.getDate() + 1);
  const hastaLaSemana = new Date(arrancaHoy);
  hastaLaSemana.setDate(hastaLaSemana.getDate() + 7);

  const elegidos = turnos
    .filter((t) => {
      if (t.estado === "cancelado") return false;
      const cuando = new Date(t.empieza_en);
      if (cuando < arrancaHoy) return false;
      if (filtro === "sin_confirmar") return t.estado === "agendado" && cuando < hastaLaSemana;
      if (filtro === "semana") return cuando < hastaLaSemana;
      return cuando < hastaManana;
    })
    .sort((a, b) => new Date(a.empieza_en) - new Date(b.empieza_en));

  if (elegidos.length === 0) {
    return (
      <SinNada>
        {filtro === "sin_confirmar"
          ? tr("inicio.agenda.sinConfirmar")
          : filtro === "semana"
            ? tr("inicio.agenda.semana")
            : tr("inicio.agenda.hoy")}
      </SinNada>
    );
  }

  return (
    <ul>
      {elegidos.slice(0, filas).map((t) => {
        const cliente = clientes.find((c) => c.id === t.cliente_id);
        return (
          <Fila key={t.id} href="/agenda">
            <span className="w-14 shrink-0 font-titulo font-extrabold tabular-nums">
              {horaYMinutos(t.empieza_en, locale)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{t.motivo}</span>
              <span className="block truncate text-apoyo text-tinta-suave">
                {cliente?.nombre ?? tr("inicio.sinCliente")}
                {filtro !== "hoy" && ` · ${enMinusculas(diaLargo(t.empieza_en, locale, tr), idioma)}`}
              </span>
            </span>
            {t.estado === "agendado" && (
              <span className="shrink-0 text-apoyo text-espera">
                {estadoDeTurno("agendado", tr).palabra}
              </span>
            )}
          </Fila>
        );
      })}
      <YMas cuantos={elegidos.length - filas} href="/agenda" clave="turnos" />
    </ul>
  );
}

// ---------- inventario ----------

function CuerpoInventario({ filtro, filas }) {
  const { idioma, t } = useIdioma();
  const { insumos, casos, negocio } = useDatos();
  const { articulo } = vocabulario(negocio?.rubro, idioma);
  // Lo pedido se mudó a "En camino" (SCRUM-113): una fila de algo pedido que
  // siguiera llevando a "En stock" llevaría a una pantalla donde no está.
  const adonde = (i) =>
    i.estado === "pedido" || i.estado === "llegado" ? "/inventario/en-camino" : "/inventario";

  const elegidos = insumos.filter((i) => {
    if (filtro === "llegaron") return i.estado === "llegado";
    if (filtro === "todo") return true;
    return i.estado === "en_stock" && i.cantidad <= i.minimo;
  });

  if (elegidos.length === 0) {
    return (
      <SinNada>
        {filtro === "llegaron"
          ? t("inicio.inventario.llegaron")
          : filtro === "todo"
            ? t(`inicio.inventario.todo.${articulo.segun("m", "f")}`, { palabra: articulo.palabra(2) })
            : t("inicio.inventario.bajo")}
      </SinNada>
    );
  }

  return (
    <ul>
      {elegidos.slice(0, filas).map((i) => {
        const caso = casos.find((c) => c.id === i.caso_id);
        const bajo = i.estado === "en_stock" && i.cantidad <= i.minimo;
        return (
          <Fila key={i.id} href={adonde(i)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{i.nombre}</span>
              <span className="block truncate text-apoyo text-tinta-suave">
                {i.estado === "llegado"
                  ? caso
                    ? t("inicio.inventario.llegoDelCaso", { caso: casoEnFrase(caso, t) })
                    : t("inicio.inventario.llegoSinUso")
                  : i.estado === "pedido"
                    ? t("inicio.inventario.pedido")
                    : t("inicio.inventario.quedan", { cantidad: i.cantidad, unidad: presentacion(i, i.cantidad, t) })}
              </span>
            </span>
            {bajo ? (
              <span className="flex shrink-0 items-center gap-1 font-bold text-espera text-etiqueta">
                <Icono nombre="alerta" className="size-5" />
                {i.cantidad}
              </span>
            ) : (
              <span className="shrink-0 font-titulo font-extrabold tabular-nums">
                {i.cantidad}
              </span>
            )}
          </Fila>
        );
      })}
      <YMas cuantos={elegidos.length - filas} href="/inventario" palabra={articulo.palabra} />
    </ul>
  );
}

// ---------- a aprobar ----------

function CuerpoAprobar({ filas }) {
  const { locale, t } = useIdioma();
  const { casos, clientes, pasos } = useDatos();

  const conPendientes = casosPorAprobar(casos, pasos);

  if (conPendientes.length === 0) {
    return <SinNada>{t("inicio.aprobar.nada")}</SinNada>;
  }

  const total = conPendientes.reduce((s, x) => s + x.plata, 0);

  return (
    <>
      <p className="px-4 pt-3 text-apoyo text-tinta-suave sm:px-6">{t("inicio.aprobar.esperando")}</p>
      <p className="px-4 pb-3 font-titulo font-extrabold text-subtitulo text-espera tabular-nums sm:px-6">
        {pesos(total, locale)}
      </p>
      <ul className="border-t border-borde">
        {conPendientes.slice(0, filas).map(({ caso, cuantos, plata }) => {
          const cliente = clientes.find((c) => c.id === caso.cliente_id);
          const titulo = tituloDelCaso(caso, t);
          const quien =
            cliente?.nombre === titulo ? null : (cliente?.nombre ?? t("inicio.sinCliente"));
          return (
            <Fila key={caso.id} href={`/casos/${caso.id}/pasos`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {titulo}
                  {quien && ` · ${quien}`}
                  {subtituloDelCaso(caso, t) && (
                    <span className="font-normal text-apoyo text-tinta-suave"> · {subtituloDelCaso(caso, t)}</span>
                  )}
                </span>
                <span className="block text-apoyo text-tinta-suave">
                  {t("inicio.aprobar.pasos", { n: cuantos })}
                </span>
              </span>
              <span className="shrink-0 font-bold tabular-nums">{pesos(plata, locale)}</span>
            </Fila>
          );
        })}
        <YMas cuantos={conPendientes.length - filas} href="/aprobar" clave="casos" />
      </ul>
    </>
  );
}

// ---------- equipo ----------

function CuerpoEquipo({ filas }) {
  const { t } = useIdioma();
  const { empleados, casos } = useDatos();

  if (empleados.length === 0) {
    return <SinNada>{t("inicio.equipo.nadie")}</SinNada>;
  }

  const conCarga = empleados
    .map((e) => ({
      empleado: e,
      cuantos: casos.filter((c) => c.responsable_id === e.id && estaAbierto(c)).length,
    }))
    .sort((a, b) => b.cuantos - a.cuantos);

  return (
    <ul>
      {conCarga.slice(0, filas).map(({ empleado, cuantos }) => (
        <Fila key={empleado.id} href="/equipo">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta-media">
            <Icono nombre="persona" className="size-5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-bold">{empleado.nombre}</span>
          <span className="shrink-0 text-tinta-media">
            {cuantos === 0 ? t("inicio.equipo.sinCasos") : t("inicio.equipo.casos", { n: cuantos })}
          </span>
        </Fila>
      ))}
      <YMas cuantos={conCarga.length - filas} href="/equipo" clave="personas" />
    </ul>
  );
}

// ---------- clientes ----------

function CuerpoClientes({ filtro, filas }) {
  const { t } = useIdioma();
  const { clientes, casos } = useDatos();

  const abiertosDe = (id) => casos.filter((c) => c.cliente_id === id && estaAbierto(c)).length;

  const elegidos =
    filtro === "con_abiertos"
      ? clientes.filter((c) => abiertosDe(c.id) > 0)
      : [...clientes].reverse();

  if (elegidos.length === 0) {
    return (
      <SinNada>
        {filtro === "con_abiertos"
          ? t("inicio.clientes.ninguno")
          : t("inicio.clientes.vacio")}
      </SinNada>
    );
  }

  return (
    <ul>
      {elegidos.slice(0, filas).map((cliente) => {
        const cuantos = abiertosDe(cliente.id);
        return (
          <Fila key={cliente.id} href="/clientes">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{cliente.nombre}</span>
              <span className="block truncate text-apoyo text-tinta-suave">
                {telefonoLegible(cliente.telefono) || t("inicio.clientes.sinTelefono")}
              </span>
            </span>
            {cuantos > 0 && (
              <span className="shrink-0 text-tinta-media">
                {t("inicio.clientes.sinCerrar", { n: cuantos })}
              </span>
            )}
          </Fila>
        );
      })}
      <YMas cuantos={elegidos.length - filas} href="/clientes" clave="clientes" />
    </ul>
  );
}

// ---------- historial ----------

function CuerpoHistorial({ filtro, filas }) {
  const { locale, t } = useIdioma();
  const { eventos, casos } = useDatos();
  const elegidos = filtrarHistorial(eventos, { tipo: filtro });

  if (elegidos.length === 0) {
    return (
      <SinNada>
        {eventos.length === 0
          ? t("inicio.historial.vacio")
          : t("inicio.historial.nada")}
      </SinNada>
    );
  }

  return (
    <ul>
      {elegidos.slice(0, filas).map((e) => {
        const caso = casos.find((c) => c.id === e.caso_id);
        return (
          <Fila key={e.id} href={caso ? `/casos/${caso.id}` : "/historial"}>
            <Icono nombre={e.icono} className="size-5 text-tinta-media" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">
                {e.titulo}
                {caso && ` · ${tituloDelCaso(caso, t)}`}
              </span>
              <span className="block truncate text-apoyo text-tinta-suave">
                {cuando(e.ocurrido_en, locale, t)} · {e.autor}
              </span>
            </span>
            {e.tipo === "plata" && e.monto !== null && e.monto !== undefined && (
              <span className="shrink-0 font-bold tabular-nums">{pesos(e.monto, locale)}</span>
            )}
          </Fila>
        );
      })}
      <YMas cuantos={elegidos.length - filas} href="/historial" clave="eventos" />
    </ul>
  );
}

// ---------- estadísticas ----------

// El Resumen del dashboard (mismas cuentas, mismo permiso), una fila por dato.
function CuerpoEstadisticas({ filas }) {
  const { locale, t } = useIdioma();
  const { negocio, consultarResumenDashboard } = useDatos();
  const { usuario } = useAuth();
  const consultar = useRef(consultarResumenDashboard);
  consultar.current = consultarResumenDashboard;
  const [periodo] = useState(() => periodoDashboard());
  const [respuesta, setRespuesta] = useState(null);
  const activos = negocio?.modulos_activos ?? [];
  const autorizado = puede(usuario, "ver_todos_los_casos");

  useEffect(() => {
    if (!autorizado) return;
    let vigente = true;
    consultar.current({ desde: periodo.desde, hasta: periodo.hasta })
      .then((r) => vigente && setRespuesta(r))
      .catch(() => vigente && setRespuesta({ ok: false }));
    return () => { vigente = false; };
  }, [autorizado, negocio?.id, periodo]);

  if (!autorizado) return <SinNada>{t("dashboard.sinPermiso")}</SinNada>;
  if (!respuesta) return <SinNada>…</SinNada>;
  if (!respuesta.ok) return <SinNada>{t("dashboard.resumen.noPudimos")}</SinNada>;

  const resumen = respuesta.resumen;
  const datos = [
    { clave: "total_cobrado", categoria: "cobros", plata: true },
    { clave: "clientes_nuevos", categoria: "clientes" },
    { clave: "casos_abiertos", categoria: "casos" },
    { clave: "productos_reponer", categoria: "inventario" },
  ].filter((d) => resumen[d.clave] != null && destinoDashboard(d.categoria, activos));

  const valor = (d) =>
    d.plata
      ? formatoNumero(locale, { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(resumen[d.clave])
      : formatoNumero(locale).format(resumen[d.clave]);

  return (
    <ul>
      {datos.slice(0, filas).map((d) => (
        <Fila key={d.clave} href="/dashboard">
          <span className="min-w-0 flex-1 truncate font-bold">{t(`dashboard.resumen.${d.clave}.nombre`)}</span>
          <span className="shrink-0 font-titulo font-extrabold tabular-nums">{valor(d)}</span>
        </Fila>
      ))}
      <YMas cuantos={datos.length - filas} href="/dashboard" clave="datos" />
    </ul>
  );
}

// Qué componente le toca a cada módulo del catálogo.
export const CUERPOS = {
  pendientes: CuerpoPendientes,
  casos: CuerpoCasos,
  agenda: CuerpoAgenda,
  inventario: CuerpoInventario,
  aprobar: CuerpoAprobar,
  equipo: CuerpoEquipo,
  clientes: CuerpoClientes,
  historial: CuerpoHistorial,
  dashboard: CuerpoEstadisticas,
};
