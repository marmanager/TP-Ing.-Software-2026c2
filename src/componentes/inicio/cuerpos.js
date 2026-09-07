"use client";

// El contenido de cada módulo del Inicio.
//
// Todos reciben lo mismo: el filtro elegido y cuántas filas entran según el
// alto. Si hay más de las que entran, la última línea dice cuántas quedaron y
// lleva a la sección completa: nunca se esconde información sin avisar.

import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { estaAbierto, ORDEN_ESTADOS, pesos, quienLoTiene } from "@/lib/estados";
import { ESTADOS } from "@/lib/estados";
import { etiquetaEstado } from "@/lib/presets";
import { horaYMinutos, diaLargo } from "@/lib/fechas";
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

function YMas({ cuantos, href, que }) {
  if (cuantos <= 0) return null;
  return (
    <li className="border-t border-borde">
      <Link
        href={href}
        className="flex min-h-12 items-center gap-2 px-4 font-bold text-azul sm:px-6"
      >
        <Icono nombre="mas" className="size-5" />
        Ver {cuantos} {que} más
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
      <span className={`flex items-center gap-1.5 font-bold text-etiqueta ${color}`}>
        <Icono nombre={icono} className="size-5" />
        {titulo}
      </span>
      <span className="font-titulo font-extrabold text-subtitulo">{cuanto}</span>
      <span className="truncate text-apoyo text-tinta-suave">{detalle}</span>
    </Link>
  );
}

function CuerpoPendientes() {
  const { casos, insumos } = useDatos();

  const abiertos = casos.filter(estaAbierto);
  const esperando = abiertos.filter((c) => c.estado === "esperando");
  const listos = abiertos.filter((c) => c.estado === "revision_final");
  const llegados = insumos.filter((i) => i.estado === "llegado");
  const casoDelInsumo = casos.find((c) => c.id === llegados[0]?.caso_id);

  return (
    <div className="flex flex-wrap gap-2 p-2 sm:p-4">
      <Numerito
        href="/casos"
        icono="reloj"
        color="text-espera"
        titulo="Esperan tu respuesta"
        cuanto={`${esperando.length} ${esperando.length === 1 ? "caso" : "casos"}`}
        detalle={esperando.length ? "Falta que conteste el cliente." : "No hay ninguno."}
      />
      <Numerito
        href="/inventario"
        icono="camion"
        color="text-terracota"
        titulo="Insumos que llegaron"
        cuanto={`${llegados.length} ${llegados.length === 1 ? "pedido" : "pedidos"}`}
        detalle={
          casoDelInsumo
            ? `${llegados[0].nombre} del caso ${casoDelInsumo.numero}.`
            : "No llegó nada nuevo."
        }
      />
      <Numerito
        href="/casos"
        icono="listo"
        color="text-completo"
        titulo="Listos para entregar"
        cuanto={`${listos.length} ${listos.length === 1 ? "caso" : "casos"}`}
        detalle={listos.length ? "Falta avisarle al cliente." : "Ninguno pasó el control."}
      />
    </div>
  );
}

// ---------- casos ----------

function CuerpoCasos({ filtro, filas }) {
  const { casos, clientes, empleados, negocio } = useDatos();

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
          ? "Todavía no hay casos. Abrí el primero desde el botón de arriba."
          : `No hay ninguno en ${etiquetaEstado(negocio?.rubro, filtro).toLowerCase()}.`}
      </SinNada>
    );
  }

  return (
    <ul>
      {elegidos.slice(0, filas).map((caso) => {
        const cliente = clientes.find((c) => c.id === caso.cliente_id);
        return (
          <Fila key={caso.id} href={`/casos/${caso.id}`}>
            <Barra estado={caso.estado} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">
                Caso {caso.numero} · {caso.servicio}
              </span>
              <span className="block truncate text-apoyo text-tinta-suave">
                {cliente?.nombre ?? "Sin cliente"} · {caso.que_falta}
              </span>
            </span>
            <span className="hidden shrink-0 text-apoyo text-tinta-suave sm:block">
              {quienLoTiene(caso, empleados)}
            </span>
          </Fila>
        );
      })}
      <YMas cuantos={elegidos.length - filas} href="/casos" que="casos" />
    </ul>
  );
}

// ---------- agenda ----------

function CuerpoAgenda({ filtro, filas }) {
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
          ? "No hay turnos sin confirmar."
          : filtro === "semana"
            ? "No hay turnos en los próximos siete días."
            : "No hay turnos para hoy."}
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
              {horaYMinutos(t.empieza_en)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{t.motivo}</span>
              <span className="block truncate text-apoyo text-tinta-suave">
                {cliente?.nombre ?? "Sin cliente"}
                {filtro !== "hoy" && ` · ${diaLargo(t.empieza_en).toLowerCase()}`}
              </span>
            </span>
            {t.estado === "agendado" && (
              <span className="shrink-0 text-apoyo text-espera">Sin confirmar</span>
            )}
          </Fila>
        );
      })}
      <YMas cuantos={elegidos.length - filas} href="/agenda" que="turnos" />
    </ul>
  );
}

// ---------- inventario ----------

function CuerpoInventario({ filtro, filas }) {
  const { insumos, casos } = useDatos();

  const elegidos = insumos.filter((i) => {
    if (filtro === "llegaron") return i.estado === "llegado";
    if (filtro === "todo") return true;
    return i.estado === "en_stock" && i.cantidad <= i.minimo;
  });

  if (elegidos.length === 0) {
    return (
      <SinNada>
        {filtro === "llegaron"
          ? "No llegó ningún pedido."
          : filtro === "todo"
            ? "Todavía no hay insumos cargados."
            : "No hay nada por debajo del mínimo."}
      </SinNada>
    );
  }

  return (
    <ul>
      {elegidos.slice(0, filas).map((i) => {
        const caso = casos.find((c) => c.id === i.caso_id);
        const bajo = i.estado === "en_stock" && i.cantidad <= i.minimo;
        return (
          <Fila key={i.id} href="/inventario">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{i.nombre}</span>
              <span className="block truncate text-apoyo text-tinta-suave">
                {i.estado === "llegado"
                  ? caso
                    ? `Llegó. Es del caso ${caso.numero}.`
                    : "Llegó y todavía nadie lo usó."
                  : i.estado === "pedido"
                    ? "Pedido, todavía no llegó."
                    : `Quedan ${i.cantidad} ${i.unidad}.`}
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
      <YMas cuantos={elegidos.length - filas} href="/inventario" que="insumos" />
    </ul>
  );
}

// ---------- a aprobar ----------

function CuerpoAprobar({ filas }) {
  const { casos, clientes, pasos } = useDatos();

  const conPendientes = casos
    .map((caso) => {
      const pendientes = pasos.filter((p) => p.caso_id === caso.id && p.estado === "esperando");
      return { caso, cuantos: pendientes.length, plata: pendientes.reduce((s, p) => s + Number(p.monto), 0) };
    })
    .filter((x) => x.cuantos > 0)
    .sort((a, b) => b.plata - a.plata);

  if (conPendientes.length === 0) {
    return <SinNada>No hay nada esperando respuesta del cliente.</SinNada>;
  }

  const total = conPendientes.reduce((s, x) => s + x.plata, 0);

  return (
    <>
      <p className="px-4 pt-3 text-apoyo text-tinta-suave sm:px-6">Esperando respuesta</p>
      <p className="px-4 pb-3 font-titulo font-extrabold text-subtitulo text-espera tabular-nums sm:px-6">
        {pesos(total)}
      </p>
      <ul className="border-t border-borde">
        {conPendientes.slice(0, filas).map(({ caso, cuantos, plata }) => {
          const cliente = clientes.find((c) => c.id === caso.cliente_id);
          return (
            <Fila key={caso.id} href={`/casos/${caso.id}/pasos`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  Caso {caso.numero} · {cliente?.nombre ?? "Sin cliente"}
                </span>
                <span className="block text-apoyo text-tinta-suave">
                  {cuantos} {cuantos === 1 ? "paso" : "pasos"} sin contestar
                </span>
              </span>
              <span className="shrink-0 font-bold tabular-nums">{pesos(plata)}</span>
            </Fila>
          );
        })}
        <YMas cuantos={conPendientes.length - filas} href="/aprobar" que="casos" />
      </ul>
    </>
  );
}

// ---------- equipo ----------

function CuerpoEquipo({ filas }) {
  const { empleados, casos } = useDatos();

  if (empleados.length === 0) {
    return <SinNada>Todavía no hay nadie cargado en el equipo.</SinNada>;
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
            {cuantos === 0 ? "Sin casos" : `${cuantos} ${cuantos === 1 ? "caso" : "casos"}`}
          </span>
        </Fila>
      ))}
      <YMas cuantos={conCarga.length - filas} href="/equipo" que="personas" />
    </ul>
  );
}

// ---------- clientes ----------

function CuerpoClientes({ filtro, filas }) {
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
          ? "Ningún cliente tiene casos sin cerrar."
          : "Todavía no hay clientes cargados."}
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
                {cliente.telefono || "Sin teléfono"}
              </span>
            </span>
            {cuantos > 0 && (
              <span className="shrink-0 text-tinta-media">
                {cuantos} sin cerrar
              </span>
            )}
          </Fila>
        );
      })}
      <YMas cuantos={elegidos.length - filas} href="/clientes" que="clientes" />
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
};
