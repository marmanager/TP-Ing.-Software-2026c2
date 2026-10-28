"use client";

// "Mi negocio" — la configuración del negocio (SCRUM-88).
//
// El rubro no se cambia de taquito: se elige al crear el negocio, y acá se
// muestra como un dato. Cambiarlo es posible —alguien se pudo equivocar al
// registrarse— pero pasa por una confirmación que dice qué se toca y qué no.
//
// Los módulos tienen pantalla propia: acá queda el resumen y el enlace.

import { useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, quienPuede } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import {
  RUBROS,
  preset,
  ejemplosDe,
  comoSeIdentifica,
  mayuscula,
  vocabulario,
} from "@/lib/presets";
import { LISTA_MODULOS, estaPrendido, hijosActivos, traducirModulo } from "@/lib/modulos";
import { DIAS, cortoDelDia, normalizarHorarios } from "@/lib/horarios";
import { paisInicial, telefonoLegible } from "@/lib/telefono";
import CampoTelefono, { useTelefono } from "@/componentes/CampoTelefono";
import { achicar, revisarArchivo } from "@/lib/imagen";
import Icono from "@/componentes/Icono";
import Frase from "@/componentes/Frase";
import ConexionMercadoPago from "@/componentes/ConexionMercadoPago";
import SedesVinculadas from "@/componentes/SedesVinculadas";
import VincularGoogleCalendar from "@/componentes/VincularGoogleCalendar";
import ConfiguracionEstados from "@/componentes/ConfiguracionEstados";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion } from "@/componentes/ui";
import ResumenRecordatorios from "@/componentes/ResumenRecordatorios";
import BorrarNegocio from "@/componentes/BorrarNegocio";

export default function MiNegocio() {
  const datos = useDatos();
  const { cargando, negocio, casos, clientes, insumos, turnos } = datos;
  const { usuario } = useAuth();
  const { idioma, locale, t } = useIdioma();
  useTitulo(t("negocio.titulo"));

  // Cambiar el rubro va en dos pasos: elegir y confirmar.
  const [cambiandoRubro, setCambiandoRubro] = useState(false);
  const [rubroElegido, setRubroElegido] = useState(null);

  // La ficha del negocio: nombre, descripción y foto (SCRUM-30).
  //
  // Se edita sobre un borrador y no sobre el dato en vivo. Es lo que hace que
  // "Cancelar" pueda deshacer de verdad: si la foto se guardara al elegirla,
  // cancelar la dejaría cambiada igual.
  //
  // El input de archivo está escondido: el que trae el navegador no se puede
  // llevar a los 48 px de área táctil que pide la cartilla, así que lo
  // dispara un botón de los nuestros.
  const inputFoto = useRef(null);
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [borrador, setBorrador] = useState({
    nombre: "",
    descripcion: "",
    foto: null,
  });
  // El teléfono va aparte, en el campo con selector de país (B-1b).
  const paisNegocio = paisInicial(negocio);
  const tel = useTelefono("", paisNegocio);
  const [menuFoto, setMenuFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);
  const [achicandoFoto, setAchicandoFoto] = useState(false);

  const LARGO_DESCRIPCION = 140;

  function abrirEdicion() {
    setBorrador({
      nombre: negocio?.nombre ?? "",
      descripcion: negocio?.descripcion ?? "",
      foto: negocio?.foto ?? null,
    });
    tel.cargar(negocio?.telefono ?? "");
    setErrorFoto(null);
    setMenuFoto(false);
    setEditandoFicha(true);
  }

  function cancelarEdicion() {
    setEditandoFicha(false);
    setMenuFoto(false);
    setErrorFoto(null);
  }

  // El teléfono es opcional, pero si se escribe tiene que servir: uno mal
  // cargado deja al cliente con un botón que no llama a nadie, y eso es peor
  // que no ofrecerlo.
  const errorTelefono = !tel.vacio && !tel.armado.ok ? tel.armado.mensaje : null;

  const motivoFicha = !borrador.nombre.trim()
    ? t("ui.validaciones.faltaNombre")
    : borrador.descripcion.length > LARGO_DESCRIPCION
      ? t("negocio.ficha.descripcionMuyLarga")
      : errorTelefono
        ? t("negocio.ficha.telefonoInvalido")
        : achicandoFoto
          ? t("negocio.ficha.achicando")
          : null;

  function guardarFicha() {
    datos.guardarNegocio({ ...borrador, telefono: tel.vacio ? "" : tel.telefono });
    setEditandoFicha(false);
    setMenuFoto(false);
    datos.avisarExito(t("negocio.ficha.guardado"));
  }

  async function elegirFoto(e) {
    const archivo = e.target.files?.[0];
    // Se vacía antes de hacer nada: si no, elegir dos veces el mismo archivo
    // no dispara este evento la segunda vez y parece que no anduvo.
    e.target.value = "";

    const problema = revisarArchivo(archivo, t);
    if (problema) return setErrorFoto(problema);

    setErrorFoto(null);
    setAchicandoFoto(true);
    try {
      const chica = await achicar(archivo);
      setBorrador((b) => ({ ...b, foto: chica }));
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setAchicandoFoto(false);
    }
  }

  if (cargando) return <Cargando />;

  const actual = preset(negocio?.rubro, idioma);
  const modulosActivos = negocio?.modulos_activos ?? [];
  // Configurar el negocio es del dueño, y la base también lo rechaza.
  const puedeConfigurar = puede(usuario, "configurar_negocio");
  const prendidos = LISTA_MODULOS.filter((m) => estaPrendido(m.clave, modulosActivos)).map((m) => traducirModulo(m, t));
  const nuevo = rubroElegido ? preset(rubroElegido, idioma) : null;
  const horarios = normalizarHorarios(negocio?.horarios);
  // "Insumos" se escribía a mano: en un taller esa palabra es "productos".
  // Sale del preset del rubro, como en el resto de las pantallas.
  const { articulo } = vocabulario(negocio?.rubro, idioma);

  // Cómo nacen los nombres de los casos (SCRUM-119). Un negocio de antes de
  // esta opción no la tiene guardada: es "por número", como siempre fue.
  const comoIdent = comoSeIdentifica(negocio?.rubro, idioma);
  const nombrarCasos = negocio?.nombrar_casos ?? "numero";
  const opcionesDeNombre = [
    ["numero", t("negocio.nombres.numero")],
    ["cliente", t("negocio.nombres.cliente")],
    ["identificador", t("negocio.nombres.identificador", { identificador: comoIdent.enFrase })],
    ["servicio", t("negocio.nombres.servicio")],
  ];
  // El número de ejemplo es el que de verdad le toca al próximo caso.
  const proximoNumero = Math.max(0, ...casos.map((c) => c.numero)) + 1;
  const resaltado = (texto) => <span className="font-bold text-tinta">{texto}</span>;
  const ejemploDeNombre = {
    numero: (
      <Frase
        texto={t("negocio.nombres.ejNumero")}
        partes={{ nombre: resaltado(t("casos.nombre.caso", { numero: proximoNumero })) }}
      />
    ),
    cliente: t("negocio.nombres.ejCliente"),
    identificador: (
      <Frase
        texto={t("negocio.nombres.ejIdentificador", { identificador: comoIdent.enFrase })}
        partes={{ ejemplo: resaltado(comoIdent.ejemplo) }}
      />
    ),
    servicio: (
      <Frase
        texto={t("negocio.nombres.ejServicio")}
        partes={{ ejemplo: resaltado(ejemplosDe(negocio?.rubro, idioma).servicio) }}
      />
    ),
  }[nombrarCasos];

  function elegirNombrarCasos(modo) {
    if (!puedeConfigurar || modo === nombrarCasos) return;
    datos.cambiarNombrarCasos(modo);
    datos.avisarExito(t("negocio.nombres.listo"));
  }

  function cerrarCambioDeRubro() {
    setCambiandoRubro(false);
    setRubroElegido(null);
  }

  // El rubro queda fijo desde el primer caso (SCRUM-90). Antes se puede
  // cambiar, porque equivocarse al elegirlo al crear el negocio tiene que
  // tener arreglo. Después no: los casos ya están cargados con las palabras
  // de ese oficio —patentes, mecánicos, motivos— y cambiarle el nombre a
  // todo no los convierte en casos de otro oficio.
  const rubroFijo = casos.length > 0;

  function confirmarRubro() {
    if (!datos.cambiarRubro(rubroElegido)) return;
    datos.avisarExito(t("negocio.rubro.listo", { rubro: nuevo.nombre.toLowerCase() }));
    cerrarCambioDeRubro();
  }

  return (
    <>
      <h1 className="text-pantalla">{t("negocio.titulo")}</h1>
      <p className="mt-1 mb-6 max-w-[65ch] text-tinta-media">
        {t("negocio.apoyo")}
      </p>

      <Tarjeta className="mb-12">
        {/* El input vive afuera de los dos modos: si se desmontara al entrar
            en edición, el explorador de archivos se abriría sobre un elemento
            que ya no está y el archivo elegido no llegaría a ningún lado. */}
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          onChange={elegirFoto}
          className="hidden"
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative shrink-0">
            {/* Sin texto alternativo: el nombre del negocio está al lado, y
                describirla otra vez se lo haría decir dos veces a un lector
                de pantalla. */}
            {(editandoFicha ? borrador.foto : negocio?.foto) ? (
              <img
                src={editandoFicha ? borrador.foto : negocio.foto}
                alt=""
                className="size-12 rounded-campo object-cover"
              />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-campo bg-azul text-white">
                <Icono nombre="tienda" />
              </span>
            )}

            {/* El pincel sobre la foto. Es el único botón sin palabra al lado
                en todo el sistema —encima de la foto no entra—, así que lleva
                aria-label y un área táctil que sigue siendo tocable. */}
            {editandoFicha && (
              <button
                type="button"
                aria-label={t("negocio.ficha.cambiarFoto")}
                aria-expanded={menuFoto}
                data-testid="negocio-foto-cambiar"
                onClick={() => setMenuFoto((v) => !v)}
                className="absolute -right-2 -bottom-2 flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-tarjeta bg-azul text-white hover:bg-azul-apretado"
              >
                <Icono nombre="pincel" className="size-5" />
              </button>
            )}
          </div>

          <div className="mr-auto">
            {editandoFicha ? (
              <p className="font-bold text-cuerpo">{t("negocio.ficha.datos")}</p>
            ) : (
              <>
                <p className="font-titulo font-extrabold text-subtitulo">{negocio?.nombre}</p>
                <p className="text-tinta-media">{actual.nombre}</p>
                {negocio?.descripcion && (
                  <p className="mt-1 max-w-[65ch] text-tinta-media">{negocio.descripcion}</p>
                )}
                {negocio?.telefono && (
                  <p className="mt-1 text-tinta-media">{t("negocio.ficha.telefono", { telefono: telefonoLegible(negocio.telefono) })}</p>
                )}
              </>
            )}
          </div>

          {puedeConfigurar && !editandoFicha && (
            <Boton icono="pincel" onClick={abrirEdicion} data-testid="negocio-editar">
              {t("negocio.ficha.editar")}
            </Boton>
          )}
        </div>

        {/* Las dos opciones del pincel. "Eliminar" sólo aparece si hay algo
            que eliminar: ofrecer sacar una foto que no está es una puerta que
            no lleva a ningún lado. */}
        {editandoFicha && menuFoto && (
          <div className="mt-3 flex flex-wrap gap-2 border-l-2 border-borde pl-3">
            <Boton
              icono="tienda"
              motivo={achicandoFoto ? t("negocio.ficha.achicando") : null}
              onClick={() => inputFoto.current?.click()}
            >
              {t("negocio.ficha.elegirFoto")}
            </Boton>
            {borrador.foto && (
              <Boton
                variante="plano"
                icono="tacho"
                onClick={() => {
                  setBorrador((b) => ({ ...b, foto: null }));
                  setErrorFoto(null);
                  setMenuFoto(false);
                }}
              >
                {t("negocio.ficha.eliminarFoto")}
              </Boton>
            )}
          </div>
        )}

        {errorFoto && (
          <p className="mt-3 flex items-start gap-2 font-bold text-rojo">
            <Icono nombre="alerta" className="size-6" />
            <span>{errorFoto}</span>
          </p>
        )}

        {editandoFicha && (
          <div className="mt-6 max-w-[560px]">
            <Campo
              id="negocio-nombre"
              etiqueta={t("negocio.ficha.nombre")}
              ayuda={t("negocio.ficha.nombreAyuda")}
              value={borrador.nombre}
              onChange={(e) => setBorrador((b) => ({ ...b, nombre: e.target.value }))}
            />
            <Campo
              id="negocio-descripcion"
              etiqueta={t("negocio.ficha.descripcion")}
              ayuda={t("negocio.ficha.descripcionAyuda", { ejemplo: ejemplosDe(negocio?.rubro, idioma).descripcion })}
              error={
                borrador.descripcion.length > LARGO_DESCRIPCION
                  ? t("negocio.ficha.descripcionLarga", { n: borrador.descripcion.length, max: LARGO_DESCRIPCION })
                  : null
              }
              value={borrador.descripcion}
              onChange={(e) => setBorrador((b) => ({ ...b, descripcion: e.target.value }))}
            />

            {/* El teléfono del negocio, que no es el de nadie en particular:
                es el del cartel. Lo ve el cliente en el link de seguimiento,
                para poder preguntar antes de aprobar un presupuesto
                (SCRUM-68). */}
            <CampoTelefono
              id="negocio-telefono"
              etiqueta={t("negocio.ficha.telefonoEtiqueta")}
              ayuda={t("negocio.ficha.telefonoAyuda")}
              paisPorDefecto={paisNegocio}
              error={errorTelefono}
              valor={tel.valor}
              onChange={tel.setValor}
            />

            <div className="flex flex-wrap gap-3">
              <Boton variante="principal" icono="check" motivo={motivoFicha} onClick={guardarFicha} data-testid="negocio-guardar">
                {t("negocio.ficha.guardar")}
              </Boton>
              <Boton variante="plano" onClick={cancelarEdicion}>
                {t("casos.comun.cancelar")}
              </Boton>
            </div>
          </div>
        )}

        {/* Cuatro cifras cortas: en celular van de a dos, y desde que la
            tarjeta es ancha (@lg) en una sola fila de cuatro. Apiladas una
            por línea ocupaban media pantalla para decir muy poco. La línea de
            arriba las separa de la ficha, para que no parezcan parte de ella. */}
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-borde pt-5 @lg:grid-cols-4">
          {[
            [t("negocio.ficha.casos"), casos.length],
            [t("negocio.ficha.clientes"), clientes.length],
            [mayuscula(articulo.palabra(2)), insumos.length],
            [t("negocio.ficha.turnos"), turnos.length],
          ].map(([que, cuanto]) => (
            <div key={que} className="min-w-0">
              <dt className="text-apoyo text-tinta-suave">{que}</dt>
              <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">{cuanto}</dd>
            </div>
          ))}
        </dl>
      </Tarjeta>

      <TituloSeccion id="integraciones">{t("negocio.integraciones")}</TituloSeccion>
      {puede(usuario, "conectar_mercadopago") && <ConexionMercadoPago />}
      <VincularGoogleCalendar comoIntegracion />

      {/* La red de sedes (docs/red-de-sedes.md): con el submódulo prendido. */}
      {hijosActivos("inventario", modulosActivos).some((h) => h.clave === "sedes") && (
        <>
          <TituloSeccion id="sedes">{t("negocio.sedes")}</TituloSeccion>
          <SedesVinculadas />
        </>
      )}

      <TituloSeccion id="estados">{t("negocio.estados")}</TituloSeccion>
      <ConfiguracionEstados puedeConfigurar={puedeConfigurar} />

      {/* Con qué nombre nace cada caso nuevo (SCRUM-119). Se guarda al
          tocar: sólo cambia los casos que se abran después, así que no hay
          nada que confirmar ni nada que se pierda. */}
      <TituloSeccion id="nombres">{t("negocio.nombres.titulo")}</TituloSeccion>
      <Tarjeta className="mb-12">
        <p className="max-w-[65ch] text-tinta-media">
          {t("negocio.nombres.apoyo")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {opcionesDeNombre.map(([clave, palabra]) => (
            <button
              key={clave}
              type="button"
              aria-pressed={nombrarCasos === clave}
              disabled={!puedeConfigurar}
              onClick={() => elegirNombrarCasos(clave)}
              className={[
                "min-h-12 rounded-full border-2 px-4 text-etiqueta",
                puedeConfigurar ? "cursor-pointer" : "cursor-not-allowed",
                nombrarCasos === clave
                  ? "border-azul bg-azul-claro font-bold text-azul"
                  : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
              ].join(" ")}
            >
              {palabra}
            </button>
          ))}
        </div>
        {ejemploDeNombre && <p className="mt-4 text-tinta-media">{ejemploDeNombre}</p>}
        {!puedeConfigurar && (
          <p className="mt-2 text-apoyo text-tinta-suave">{quienPuede("configurar_negocio", t)}</p>
        )}
      </Tarjeta>

      <TituloSeccion id="modulos">{t("negocio.modulosResumen.titulo")}</TituloSeccion>
      <Tarjeta className="mb-12">
        <p className="text-tinta-media">
          <Frase
            texto={t("negocio.modulosResumen.tenes")}
            partes={{
              cuantos: (
                <span className="font-bold text-tinta">
                  {prendidos.length} {t("negocio.modulosResumen.de")} {LISTA_MODULOS.length}
                </span>
              ),
            }}
          />
        </p>
        <p className="mt-1 max-w-[65ch] text-apoyo text-tinta-suave">
          {prendidos.length
            ? prendidos.map((m) => m.nombre).join(" · ")
            : t("negocio.modulosResumen.ninguno")}
        </p>
        <div className="mt-4">
          <Link
            href="/negocio/modulos"
            className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
          >
            <Icono nombre="cajas" />
            {puedeConfigurar ? t("negocio.modulosResumen.verCambiar") : t("negocio.modulosResumen.ver")}
          </Link>
        </div>
      </Tarjeta>

      {/* La lista de roles la puede mirar cualquier miembro; sólo se edita con
          manejar_roles (docs/roles.md). */}
      <TituloSeccion id="roles">{t("negocio.roles.titulo")}</TituloSeccion>
      <Tarjeta className="mb-12">
        <p className="max-w-[65ch] text-tinta-media">{t("negocio.roles.apoyo")}</p>
        <div className="mt-4">
          <Link
            href="/negocio/roles"
            className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
          >
            <Icono nombre="llave" />
            {puede(usuario, "manejar_roles") ? t("negocio.roles.verManejar") : t("negocio.roles.ver")}
          </Link>
        </div>
      </Tarjeta>

      {/* La landing la arma sólo el dueño: el resto del equipo no tiene nada
          que hacer en esa pantalla. */}
      {puedeConfigurar && (
        <>
          <TituloSeccion id="landing">{t("negocio.landing.titulo")}</TituloSeccion>
          <Tarjeta className="mb-12">
            <p className="max-w-[65ch] text-tinta-media">
              {t("negocio.landing.apoyo")}
            </p>
            <div className="mt-4">
              <Link
                href="/negocio/landing"
                data-testid="negocio-landing-armar"
                className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
              >
                <Icono nombre="pincel" />
                {t("negocio.landing.armar")}
              </Link>
            </div>
          </Tarjeta>
        </>
      )}

      {/* Cuándo atiende. Sólo si la agenda está prendida: sin agenda no hay
          turnos que dar, y configurar horarios sería configurar algo que no
          se usa. */}
      {estaPrendido("agenda", modulosActivos) && (
        <>
          <TituloSeccion id="horarios">{t("negocio.horarios.titulo")}</TituloSeccion>
          <Tarjeta className="mb-12">
            {horarios ? (
              <>
                <p className="text-tinta-media">
                  <Frase
                    texto={
                      horarios.corte
                        ? t("negocio.horarios.atiendesConCorte", {
                            desde: horarios.desde,
                            hasta: horarios.hasta,
                            corteDesde: horarios.corte.desde,
                            corteHasta: horarios.corte.hasta,
                          })
                        : t("negocio.horarios.atiendes", { desde: horarios.desde, hasta: horarios.hasta })
                    }
                    partes={{
                      dias: (
                        <span className="font-bold text-tinta">
                          {DIAS.filter((d) => horarios.dias.includes(d.clave))
                            .map((d) => cortoDelDia(d.diaJs, locale))
                            .join(" · ") || t("negocio.horarios.ningunDia")}
                        </span>
                      ),
                    }}
                  />
                </p>
                <p className="mt-1 max-w-[65ch] text-apoyo text-tinta-suave">
                  {t("negocio.horarios.turnosDe", { minutos: horarios.minutos })}
                </p>
              </>
            ) : (
              <p className="max-w-[65ch] text-tinta-media">
                {t("negocio.horarios.sinConfigurar")}
              </p>
            )}
            <div className="mt-4">
              <Link
                href="/negocio/horarios"
                className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
              >
                <Icono nombre="calendario" />
                {puedeConfigurar
                  ? horarios
                    ? t("negocio.horarios.verCambiar")
                    : t("negocio.horarios.configurar")
                  : t("negocio.horarios.ver")}
              </Link>
            </div>
          </Tarjeta>
        </>
      )}

      {/* Los mensajes que le llegan solos al cliente (R-4b): el de después
          de entregar y, con la agenda prendida, el de antes del turno. Se
          editan en su pantalla, como los horarios. */}
      <TituloSeccion id="recordatorios">{t("negocio.recordatorios.titulo")}</TituloSeccion>
      <ResumenRecordatorios puedeConfigurar={puede(usuario, "entregar_y_reabrir")} />

      <TituloSeccion id="rubro">{t("negocio.rubro.titulo")}</TituloSeccion>
      <Tarjeta className="mb-12">
        {!cambiandoRubro ? (
          <>
            <p className="max-w-[65ch] text-tinta-media">
              <Frase
                texto={t("negocio.rubro.esTuNegocio")}
                partes={{ rubro: <span className="font-bold text-tinta">{actual.nombre}</span> }}
              />
            </p>
            {rubroFijo ? (
              <p className="mt-2 max-w-[65ch] text-apoyo text-tinta-suave">
                {t("negocio.rubro.fijo", { rubro: actual.nombre.toLowerCase(), identificador: actual.identificador.enFrase })}
              </p>
            ) : puedeConfigurar ? (
              <div className="mt-4">
                <Boton icono="tienda" onClick={() => setCambiandoRubro(true)} data-testid="negocio-rubro-cambiar">
                  {t("negocio.rubro.cambiar")}
                </Boton>
              </div>
            ) : (
              <p className="mt-2 text-apoyo text-tinta-suave">
                {quienPuede("configurar_negocio", t)}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mb-4 max-w-[65ch] text-tinta-media">
              {t("negocio.rubro.elegir")}
            </p>

            <ul className="grid gap-3 @2xl:grid-cols-3">
              {RUBROS.map((rubroEs) => {
                const r = preset(rubroEs.clave, idioma);
                const marcado = r.clave === (rubroElegido ?? negocio?.rubro);
                return (
                  <li key={r.clave}>
                    <button
                      type="button"
                      aria-pressed={marcado}
                      data-testid={`rubro-${r.clave}`}
                      onClick={() => setRubroElegido(r.clave)}
                      className={[
                        "h-full w-full cursor-pointer rounded-tarjeta border-2 p-4 text-left",
                        marcado
                          ? "border-azul bg-azul-claro"
                          : "border-borde bg-tarjeta hover:bg-superficie",
                      ].join(" ")}
                    >
                      <span
                        className={`flex items-center gap-2 font-bold text-subtitulo ${marcado ? "text-azul" : ""}`}
                      >
                        {marcado && <Icono nombre="listo" className="size-6" />}
                        {r.nombre}
                      </span>
                      <span className="mt-1 block text-tinta-media">{r.queEs}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {nuevo && nuevo.clave !== negocio?.rubro && (
              <div className="mt-6 rounded-tarjeta bg-superficie p-4">
                <p className="font-bold text-subtitulo">
                  {t("negocio.rubro.pregunta", { rubro: nuevo.nombre.toLowerCase() })}
                </p>

                <p className="mt-4 font-bold text-cuerpo">{t("negocio.rubro.queCambia")}</p>
                <ul className="mt-1 flex flex-col gap-1 text-tinta-media">
                  <li>
                    {t("negocio.rubro.cambiaEstados", {
                      rubro: nuevo.nombre.toLowerCase(),
                      antesProceso: actual.etiquetas.en_proceso,
                      ahoraProceso: nuevo.etiquetas.en_proceso,
                      antesCompletado: actual.etiquetas.completado,
                      ahoraCompletado: nuevo.etiquetas.completado,
                    })}
                  </li>
                  <li>
                    {t("negocio.rubro.cambiaIdent", {
                      antes: actual.identificador.nombre,
                      ahora: nuevo.identificador.nombre,
                    })}
                  </li>
                  <li>{t("negocio.rubro.cambiaMotivos")}</li>
                </ul>

                <p className="mt-4 font-bold text-cuerpo">{t("negocio.rubro.queNoCambia")}</p>
                <ul className="mt-1 flex flex-col gap-1 text-tinta-media">
                  <li>{t("negocio.rubro.noCambiaModulos")}</li>
                </ul>

                <p className="mt-4 max-w-[65ch] text-tinta-media">
                  {t("negocio.rubro.soloHasta")}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Boton icono="check" onClick={confirmarRubro} data-testid="negocio-rubro-confirmar">
                    {t("negocio.rubro.cambiar")}
                  </Boton>
                  <Boton variante="plano" onClick={cerrarCambioDeRubro}>
                    {t("negocio.rubro.dejarlo")}
                  </Boton>
                </div>
              </div>
            )}

            {(!nuevo || nuevo.clave === negocio?.rubro) && (
              <div className="mt-6">
                <Boton variante="plano" onClick={cerrarCambioDeRubro}>
                  {t("negocio.rubro.dejarlo")}
                </Boton>
              </div>
            )}
          </>
        )}
      </Tarjeta>

      <BorrarNegocio />
    </>
  );
}