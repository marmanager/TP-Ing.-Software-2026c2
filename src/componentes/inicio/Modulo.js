"use client";

// Un módulo del Inicio: el marco, el encabezado y su contenido.
//
// Acomodando, el módulo se comporta como una imagen en un documento: se
// agarra del medio y se lleva a cualquier lado, y se le cambia el tamaño
// tirando de la esquina punteada de abajo a la derecha.
//
// Al módulo seleccionado le aparece "Ajustes" arriba a la derecha. Ahí adentro
// —en la misma tarjeta, sin bajar a buscar un panel— se le cambia el tamaño,
// se elige qué muestra y se lo saca. Se sale con el mismo botón o con Escape.
//
// Arrastrar no puede ser la única forma de acomodar: hay gente que usa la
// aplicación sólo con el teclado, y en un celular no hay grilla que arrastrar.
// Por eso lo mismo se hace con las flechas (y con Shift para el tamaño) y con
// los botones de Ajustes.

import Link from "next/link";
import { CATALOGO, COLUMNAS, MAX_ALTO, filasPara, traducirDelCatalogo } from "@/lib/inicio";
import { useIdioma } from "@/lib/useIdioma";
import { CUERPOS } from "./cuerpos";
import Icono from "@/componentes/Icono";
import { Boton } from "@/componentes/ui";

// La esquina punteada de la que se tira para cambiar el tamaño.
function ManijaDeTamano({ alAgarrar }) {
  return (
    <span
      onPointerDown={alAgarrar}
      // El teclado hace lo mismo con Shift y las flechas, y Ajustes con
      // botones, así que esta esquina es sólo para el mouse y el dedo.
      aria-hidden="true"
      className="absolute right-0 bottom-0 flex size-11 cursor-nwse-resize touch-none items-end justify-end p-1.5 text-borde-fuerte hover:text-azul"
    >
      <svg viewBox="0 0 12 12" className="size-5" fill="currentColor">
        <circle cx="10" cy="10" r="1.2" />
        <circle cx="6" cy="10" r="1.2" />
        <circle cx="2" cy="10" r="1.2" />
        <circle cx="10" cy="6" r="1.2" />
        <circle cx="6" cy="6" r="1.2" />
        <circle cx="10" cy="2" r="1.2" />
      </svg>
    </span>
  );
}

// Los botones de acá no usan <Boton> porque necesitan ser angostos: en una
// tarjeta de dos columnas, el relleno de un botón normal los parte en dos
// líneas. Igual respetan los 48 px de alto y llevan su palabra.
function BotonChico({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={[
        "min-h-12 flex-1 cursor-pointer rounded-campo border-2 px-2 font-bold text-etiqueta",
        props.disabled
          ? "border-borde bg-superficie text-tinta-suave"
          : "border-azul bg-tarjeta text-azul hover:bg-azul-claro",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Medida({ etiqueta, valor, alAchicar, alAgrandar, puedeAchicar, puedeAgrandar }) {
  const { t } = useIdioma();
  return (
    <div>
      <span className="block font-bold text-etiqueta">{etiqueta}</span>
      <div className="mt-1 flex items-center gap-2">
        <BotonChico onClick={alAchicar} disabled={!puedeAchicar}>
          {t("inicio.ajustes.menos")}
        </BotonChico>
        <span className="w-14 shrink-0 text-center text-etiqueta text-tinta-media tabular-nums">
          {valor}
        </span>
        <BotonChico onClick={alAgrandar} disabled={!puedeAgrandar}>
          {t("inicio.ajustes.mas")}
        </BotonChico>
      </div>
    </div>
  );
}

function Ajustes({ config, def, acciones, esPrimero, esUltimo }) {
  const { t } = useIdioma();
  const { clave, ancho, alto, x } = config;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <p className="text-apoyo text-tinta-suave">{def.queMuestra}</p>

      <Medida
        etiqueta={t("inicio.ajustes.ancho")}
        valor={t("inicio.ajustes.deTotal", { n: ancho, total: COLUMNAS })}
        alAchicar={() => acciones.redimensionar(clave, ancho - 1, alto)}
        alAgrandar={() => acciones.redimensionar(clave, ancho + 1, alto)}
        puedeAchicar={ancho > 1}
        puedeAgrandar={x + ancho < COLUMNAS}
      />
      <Medida
        etiqueta={t("inicio.ajustes.alto")}
        valor={t("inicio.ajustes.deTotal", { n: alto, total: MAX_ALTO })}
        alAchicar={() => acciones.redimensionar(clave, ancho, alto - 1)}
        alAgrandar={() => acciones.redimensionar(clave, ancho, alto + 1)}
        puedeAchicar={alto > 1}
        puedeAgrandar={alto < MAX_ALTO}
      />

      {/* En celular no hay grilla que arrastrar: se sube y se baja. */}
      <div className="md:hidden">
        <span className="block font-bold text-etiqueta">{t("inicio.ajustes.lugar")}</span>
        <div className="mt-1 flex items-center gap-2">
          <BotonChico onClick={() => acciones.intercambiar(clave, -1)} disabled={esPrimero}>
            {t("inicio.ajustes.subir")}
          </BotonChico>
          <BotonChico onClick={() => acciones.intercambiar(clave, 1)} disabled={esUltimo}>
            {t("inicio.ajustes.bajar")}
          </BotonChico>
        </div>
      </div>

      {def.filtros && (
        <div>
          <label htmlFor={`filtro-${clave}`} className="block font-bold text-etiqueta">
            {t("inicio.ajustes.queMuestra")}
          </label>
          <select
            id={`filtro-${clave}`}
            value={config.filtro ?? def.filtros[0].clave}
            onChange={(e) => acciones.cambiarFiltro(clave, e.target.value)}
            className="mt-1 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-3 text-etiqueta"
          >
            {def.filtros.map((f) => (
              <option key={f.clave} value={f.clave}>
                {f.palabra}
              </option>
            ))}
          </select>
        </div>
      )}

      <Boton
        variante="peligro"
        icono="tacho"
        className="min-h-12"
        onClick={() => acciones.quitar(clave)}
      >
        {t("inicio.ajustes.sacar")}
      </Boton>
    </div>
  );
}

export default function Modulo({
  config,
  acomodando,
  seleccionado,
  ajustando,
  agarrado,
  esPrimero,
  esUltimo,
  acciones,
  alSeleccionar,
  alAlternarAjustes,
  alAgarrarParaMover,
  alAgarrarParaRedimensionar,
  alTeclado,
}) {
  const { t } = useIdioma();
  const def = traducirDelCatalogo(CATALOGO[config.clave], t);
  if (!def) return null;

  const Cuerpo = CUERPOS[config.clave];

  const marco = acomodando
    ? seleccionado
      ? "border-2 border-azul ring-3 ring-azul/25"
      : "border-2 border-dashed border-borde-fuerte hover:border-azul"
    : "border border-borde";

  return (
    <section
      // El lugar en la grilla viaja en variables: en celular el CSS las
      // ignora y todo cae en una sola columna.
      style={{
        "--x": config.x,
        "--y": config.y,
        "--ancho": config.ancho,
        "--alto": config.alto,
      }}
      className={[
        "modulo-ubicado relative flex flex-col overflow-hidden rounded-tarjeta bg-tarjeta",
        marco,
        agarrado ? "modulo-agarrado" : "",
        acomodando ? "cursor-grab touch-none select-none" : "",
      ].join(" ")}
      {...(acomodando
        ? {
            tabIndex: 0,
            "aria-roledescription": t("inicio.modulo.acomodable"),
            "aria-label": t("inicio.modulo.etiqueta", { nombre: def.nombre, columna: config.x + 1, fila: config.y + 1, ancho: config.ancho, alto: config.alto }),
            onPointerDown: alAgarrarParaMover,
            onClick: alSeleccionar,
            onFocus: alSeleccionar,
            onKeyDown: alTeclado,
          }
        : {
            "aria-label": def.nombre,
          })}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-borde px-4 py-3 sm:px-6">
        <h3 className="flex min-w-0 items-center gap-2 font-cuerpo font-bold text-subtitulo">
          <Icono nombre={def.icono} className="size-6 text-tinta-media" />
          <span className="truncate">{def.nombre}</span>
        </h3>

        {acomodando && seleccionado && (
          <button
            type="button"
            onClick={alAlternarAjustes}
            aria-expanded={ajustando}
            className="flex min-h-12 shrink-0 cursor-pointer items-center gap-1.5 rounded-campo px-2 font-bold text-azul text-etiqueta hover:bg-azul-claro"
          >
            <Icono nombre={ajustando ? "cruz" : "tuerca"} className="size-6" />
            {ajustando ? t("inicio.modulo.cerrar") : t("inicio.modulo.ajustes")}
          </button>
        )}

        {!acomodando && def.ruta && (
          <Link
            href={def.ruta}
            className="flex min-h-12 shrink-0 items-center font-bold text-azul text-etiqueta"
          >
            {t("inicio.modulo.verTodo")}
          </Link>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {ajustando ? (
          <Ajustes
            config={config}
            def={def}
            acciones={acciones}
            esPrimero={esPrimero}
            esUltimo={esUltimo}
          />
        ) : (
          // Acomodando se ve el contenido de verdad —para saber qué se está
          // moviendo— pero no se puede tocar: el clic agarra el módulo.
          <div
            className={acomodando ? "pointer-events-none" : ""}
            aria-hidden={acomodando ? "true" : undefined}
          >
            <Cuerpo filtro={config.filtro} filas={filasPara(config.alto)} />
          </div>
        )}
      </div>

      {acomodando && !ajustando && (
        <ManijaDeTamano alAgarrar={alAgarrarParaRedimensionar} />
      )}
    </section>
  );
}
