"use client";

// "Mi perfil" — lo de la persona, aparte de lo del negocio (SCRUM-118).
//
// Antes esto vivía al pie de Mi negocio, como "Mi cuenta". La contraseña es de
// quien entró, no del negocio: en un negocio con tres cuentas, buscar la propia
// dentro de la configuración compartida no es donde nadie la busca (auditoría,
// H2). Acá quedan los datos de la persona, su foto, su contraseña y sus
// negocios: en cuál está, y a cuál entra al iniciar sesión.
//
// La foto y el nombre los ve todo el equipo, en la pantalla Equipo: se leen de
// la cuenta en vivo, no son una copia. Por eso guardar pasa por una función de
// la base (034) que cambia la cuenta y la ficha del equipo juntas.
//
// El mail se muestra pero no se edita: cambiarlo en Supabase manda una
// confirmación a la dirección nueva, y ese ida y vuelta es otro trabajo.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { nombreDelRol } from "@/lib/permisos";
import { motivoParaEntrar } from "@/lib/vista-maestra";
import { useTitulo } from "@/lib/useTitulo";
import { estadoDeLaContrasena, motivoDeContrasenaNueva } from "@/lib/validaciones";
import { paisInicial, telefonoLegible } from "@/lib/telefono";
import CampoTelefono, { useTelefono } from "@/componentes/CampoTelefono";
import { achicar, revisarArchivo } from "@/lib/imagen";
import Icono from "@/componentes/Icono";
import { Boton, Campo, CampoContrasena, Cargando, ErrorGeneral, Tarjeta, TituloSeccion } from "@/componentes/ui";
import Suscripcion from "./Suscripcion";
import TusNegocios from "./TusNegocios";
import Tema from "./Tema";
import SelectorIdioma from "@/componentes/SelectorIdioma";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";

export default function MiPerfil() {
  const router = useRouter();
  const { t } = useIdioma();
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const {
    sesion,
    usuario,
    cerrarSesion,
    definirContrasena,
    guardarPerfil,
    pedirResetContrasena,
    misNegocios,
    entrarAVistaMaestra,
  } = useAuth();
  useTitulo(t("cuenta.titulo"));

  // Editar el perfil, sobre un borrador como la ficha del negocio: "Cancelar"
  // deshace de verdad, y la foto no se guarda hasta tocar "Guardar".
  //
  // El input de archivo está escondido: el que trae el navegador no se puede
  // llevar a los 48 px de área táctil que pide la cartilla.
  const inputFoto = useRef(null);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState({ nombre: "", foto: null });
  // El teléfono va aparte, en el campo con selector de país (B-1b), que
  // arranca en el país del negocio.
  const paisNegocio = paisInicial(datos.negocio);
  const tel = useTelefono("", paisNegocio);
  const [menuFoto, setMenuFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);
  const [achicandoFoto, setAchicandoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState(null);

  // La contraseña (SCRUM-32), sólo desde "Editar".
  // - Sin contraseña (entra sólo con Google): se crea acá mismo, nueva y
  //   repetida. La API lo deja si entró con Google hace poco.
  // - Con contraseña: un menú chico con dos caminos, por mail (un link para
  //   elegir la nueva) o escribiendo la anterior, que la API comprueba.
  // "contrasenaPor": null (cerrado), "crear", "menu" o "anterior".
  const [contrasenaPor, setContrasenaPor] = useState(null);
  // Recién creada: hasta que la sesión se vuelva a leer, la cuenta todavía
  // dice que no tiene, y la pantalla tiene que pasar a "Cambiar contraseña".
  const [recienCreada, setRecienCreada] = useState(false);
  const [anterior, setAnterior] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [errorContrasena, setErrorContrasena] = useState(null);
  const [guardandoContrasena, setGuardandoContrasena] = useState(false);
  const [mailMandado, setMailMandado] = useState(null);
  const [mandandoMail, setMandandoMail] = useState(false);

  // Los negocios de la cuenta, pedidos una sola vez acá para "Tus negocios" y
  // para el botón de vista maestra. null = todavía no llegó. Sin base (modo de
  // ejemplo) o sin la 038, misNegocios() da ok: false: la lista queda vacía y
  // el botón apagado dice que hace falta más de un negocio.
  const [negocios, setNegocios] = useState(null);
  const [sinLista, setSinLista] = useState(false);
  const [errorVista, setErrorVista] = useState(null);
  useEffect(() => {
    let vivo = true;
    misNegocios().then((r) => {
      if (!vivo) return;
      if (r.ok) setNegocios(r.negocios);
      else setSinLista(true);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enVista = Boolean(usuario?.vista_maestra_desde);
  async function entrarAVista() {
    setErrorVista(null);
    const r = await entrarAVistaMaestra();
    if (r.ok) router.push("/");
    else setErrorVista(r.error);
  }

  // En vista maestra guardar los datos escribiría en la ficha del equipo, y la
  // base lo rechaza: se apaga con el motivo antes de que lo intenten.
  const motivoEnVista = enVista ? t("vistaMaestra.perfilApagado") : null;

  if (cargando) return <Cargando />;

  function abrirEdicion() {
    // Dos formularios abiertos dejarían dos botones azules a la vez, y la
    // cartilla permite uno solo. Además nadie edita dos cosas a la vez.
    cerrarCambioDeContrasena();
    setBorrador({
      nombre: usuario?.nombre ?? "",
      foto: usuario?.foto ?? null,
    });
    tel.cargar(usuario?.telefono ?? "");
    setErrorFoto(null);
    setErrorPerfil(null);
    setMenuFoto(false);
    setEditando(true);
  }

  function cancelarEdicion() {
    setEditando(false);
    setMenuFoto(false);
    setErrorFoto(null);
    setErrorPerfil(null);
    cerrarCambioDeContrasena();
  }

  // El teléfono es opcional, pero si se escribe tiene que servir.
  const errorTelefono = !tel.vacio && !tel.armado.ok ? tel.armado.mensaje : null;

  const motivoPerfil = !borrador.nombre.trim()
    ? t("cuenta.faltaNombre")
    : errorTelefono
      ? t("cuenta.telefonoInvalido")
      : achicandoFoto
        ? t("cuenta.achicando")
        : guardando
          ? t("cuenta.guardando")
          : null;

  async function guardar() {
    setGuardando(true);
    setErrorPerfil(null);
    const r = await guardarPerfil({ ...borrador, telefono: tel.vacio ? "" : tel.telefono });
    setGuardando(false);
    if (!r.ok) return setErrorPerfil(r.error);
    // La base ya cambió la cuenta y la ficha; esto lo refleja en Equipo sin
    // tener que recargar.
    datos.reflejarMiPerfil(usuario.id, {
      nombre: borrador.nombre.trim(),
      foto: borrador.foto,
    });
    cancelarEdicion();
    datos.avisarExito(t("cuenta.exitoPerfil"));
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
      const chica = await achicar(archivo, t);
      setBorrador((b) => ({ ...b, foto: chica }));
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setAchicandoFoto(false);
    }
  }

  const motivoContrasena = guardandoContrasena
    ? t("cuenta.guardando")
    : contrasenaPor === "anterior" && !anterior
      ? t("cuenta.faltaAnterior")
      : motivoDeContrasenaNueva(contrasena, repetida, t);

  function cerrarCambioDeContrasena() {
    setContrasenaPor(null);
    setAnterior("");
    setContrasena("");
    setRepetida("");
    setErrorContrasena(null);
    setMailMandado(null);
  }

  async function guardarContrasena() {
    const creando = contrasenaPor === "crear";
    setGuardandoContrasena(true);
    const r = await definirContrasena(contrasena, creando ? {} : { anterior });
    setGuardandoContrasena(false);
    if (!r.ok) return setErrorContrasena(r.error);
    cerrarCambioDeContrasena();
    if (creando) setRecienCreada(true);
    datos.avisarExito(creando ? t("cuenta.exitoCreada") : t("cuenta.exitoCambiada"));
  }

  // El mismo mail que "Me olvidé la contraseña": un link que se usa una sola
  // vez y lleva a elegir la nueva.
  async function mandarMailDeContrasena() {
    setErrorContrasena(null);
    setMandandoMail(true);
    const r = await pedirResetContrasena(usuario?.email ?? "");
    setMandandoMail(false);
    setContrasenaPor(null);
    if (!r.ok) return setErrorContrasena(r.error);
    setMailMandado(usuario?.email ?? t("cuenta.tuMail"));
  }

  async function salir() {
    await cerrarSesion();
    router.replace("/iniciar-sesion");
  }

  const foto = editando ? borrador.foto : usuario?.foto;

  // La frase lleva el mail en negrita adentro: se escribe entera, con un
  // marcador {mail}, y se parte ahí; no se arma pegando pedazos traducidos.
  const [antesDelMail, despuesDelMail] = t("cuenta.entras").split("{mail}");

  // "tiene", "no tiene" o "no se sabe" (lib/validaciones.js). Si no se sabe,
  // no se afirma nada: ni los puntos ni "no tenés una". El botón es "Cambiar
  // contraseña", y su opción "Por mail" sirve tenga o no.
  const estadoContrasena = estadoDeLaContrasena(sesion?.user, { recienCreada });
  const tieneContrasena = estadoContrasena !== "no tiene";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-pantalla">{t("cuenta.titulo")}</h1>
        {/* Arriba a la derecha (docs/vista-maestra.md). Borde y no azul: el
            botón azul de la pantalla es el de guardar los datos. */}
        <Boton
          icono="ojo"
          onClick={entrarAVista}
          motivo={motivoParaEntrar({ enVista, cantidad: negocios?.length ?? 0 }, t)}
          data-testid="entrar-vista-maestra"
        >
          {t("vistaMaestra.entrar")}
        </Boton>
      </div>
      {errorVista && <ErrorGeneral>{textoDeError(t, errorVista)}</ErrorGeneral>}
      <p className="mt-1 mb-6 max-w-[65ch] text-tinta-media">
        {t("cuenta.apoyo")}
      </p>

      <>
          <TituloSeccion id="cuenta">{t("cuenta.tuCuenta")}</TituloSeccion>
          <Tarjeta className="mb-12">
            {/* El input vive afuera de los dos modos: si se desmontara al
                entrar en edición, el archivo elegido no llegaría a ningún lado. */}
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              onChange={elegirFoto}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative shrink-0">
                {/* Sin texto alternativo: tu nombre está al lado, y describir
                    la foto otra vez se lo haría decir dos veces a un lector
                    de pantalla. Redonda, como las personas en Equipo. */}
                {foto ? (
                  <img src={foto} alt="" className="size-16 rounded-full object-cover" />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-full bg-superficie text-tinta-media">
                    <Icono nombre="cuenta" className="size-8" />
                  </span>
                )}

                {/* El pincel sobre la foto, como en la ficha del negocio. Es
                    un botón sin palabra al lado —encima de la foto no entra—,
                    así que lleva aria-label. */}
                {editando && (
                  <button
                    type="button"
                    aria-label={t("cuenta.cambiarFoto")}
                    aria-expanded={menuFoto}
                    disabled={enVista}
                    onClick={() => setMenuFoto((v) => !v)}
                    className="absolute -right-2 -bottom-2 flex size-9 cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50 justify-center rounded-full border-2 border-tarjeta bg-azul text-white hover:bg-azul-apretado"
                  >
                    <Icono nombre="pincel" className="size-5" />
                  </button>
                )}
              </div>

              <div className="mr-auto min-w-0">
                {editando ? (
                  <p className="font-bold text-cuerpo">{t("cuenta.tusDatos")}</p>
                ) : (
                  <>
                    <p className="font-titulo font-extrabold text-subtitulo">
                      {usuario?.nombre || t("cuenta.sinNombre")}
                    </p>
                    {usuario?.rol_nombre && (
                      <p className="text-tinta-media">
                        {negocio?.nombre
                          ? t("cuenta.rolEn", { rol: nombreDelRol(usuario.rol_nombre, t), negocio: negocio.nombre })
                          : nombreDelRol(usuario.rol_nombre, t)}
                      </p>
                    )}
                  </>
                )}
              </div>

              {!editando && (
                <Boton icono="pincel" onClick={abrirEdicion}>
                  {t("cuenta.editar")}
                </Boton>
              )}
            </div>

            {/* Las dos opciones del pincel. "Eliminar" sólo aparece si hay
                algo que eliminar. */}
            {editando && menuFoto && (
              <div className="mt-3 flex flex-wrap gap-2 border-l-2 border-borde pl-3">
                <Boton
                  icono="cuenta"
                  motivo={achicandoFoto ? t("cuenta.achicando") : null}
                  onClick={() => inputFoto.current?.click()}
                >
                  {t("cuenta.elegirFoto")}
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
                    {t("cuenta.eliminar")}
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

            {editando ? (
              <div className="mt-6 max-w-[560px]">
                <Campo
                  id="perfil-nombre"
                  etiqueta={t("cuenta.nombre")}
                  ayuda={t("cuenta.nombreAyuda")}
                  autoComplete="name"
                  value={borrador.nombre}
                  disabled={enVista}
                  onChange={(e) => setBorrador((b) => ({ ...b, nombre: e.target.value }))}
                />
                <CampoTelefono
                  id="perfil-telefono"
                  etiqueta={t("cuenta.telefono")}
                  ayuda={t("cuenta.telefonoAyuda")}
                  paisPorDefecto={paisNegocio}
                  error={errorTelefono}
                  valor={tel.valor}
                  onChange={tel.setValor}
                  disabled={enVista}
                />
                {/* El mail se ve pero no se toca: es con lo que entrás. */}
                <p className="mb-6 text-tinta-media">
                  {antesDelMail}
                  <span className="font-bold text-tinta">{usuario?.email}</span>
                  {despuesDelMail}
                </p>

                {errorPerfil && (
                  <p className="mb-4 flex items-start gap-2 font-bold text-rojo">
                    <Icono nombre="alerta" className="size-6" />
                    <span>{textoDeError(t, errorPerfil)}</span>
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Boton variante="principal" icono="check" motivo={motivoEnVista ?? motivoPerfil} onClick={guardar}>
                    {t("cuenta.guardar")}
                  </Boton>
                  <Boton variante="plano" onClick={cancelarEdicion}>
                    {t("cuenta.cancelar")}
                  </Boton>
                </div>

                {/* La contraseña, sólo desde "Editar": afuera, a un toque, se la
                    cambiaba cualquiera que encontrara la sesión abierta. Es un
                    guardado aparte del de arriba, y por eso su botón no es azul:
                    habría dos azules a la vez. */}
                <div className="mt-8 border-t border-borde pt-6">
                  <p className="font-bold text-cuerpo">{t("cuenta.contrasena.titulo")}</p>
                  {estadoContrasena === "tiene" && (
                    <p className="mt-1 text-tinta-media">
                      <span aria-hidden="true">••••••••</span>
                      <span className="sr-only">{t("cuenta.contrasena.guardada")}</span>
                    </p>
                  )}
                  {estadoContrasena === "no tiene" && (
                    <p className="mt-1 text-tinta-media">
                      {t("cuenta.contrasena.noTiene")}
                    </p>
                  )}

                  {mailMandado && (
                    <p role="status" className="mt-3 flex items-start gap-2 font-bold text-completo">
                      <Icono nombre="sobre" className="mt-0.5 size-6" />
                      <span>
                        {t("cuenta.mailMandado", { mail: mailMandado })}
                      </span>
                    </p>
                  )}

                  {contrasenaPor === "anterior" || contrasenaPor === "crear" ? (
                    <div className="mt-4">
                      {contrasenaPor === "anterior" && (
                        <CampoContrasena
                          id="contrasena-anterior"
                          etiqueta={t("cuenta.contrasena.anterior")}
                          ayuda={t("cuenta.contrasena.anteriorAyuda")}
                          autoComplete="current-password"
                          value={anterior}
                          disabled={enVista}
                          onChange={(e) => {
                            setAnterior(e.target.value);
                            setErrorContrasena(null);
                          }}
                        />
                      )}
                      <CampoContrasena
                        id="contrasena-nueva"
                        etiqueta={t("cuenta.contrasena.nueva")}
                        ayuda={
                          contrasenaPor === "crear"
                            ? t("cuenta.contrasena.nuevaAyudaCrear")
                            : t("cuenta.contrasena.nuevaAyudaCambiar")
                        }
                        autoComplete="new-password"
                        value={contrasena}
                        disabled={enVista}
                        onChange={(e) => {
                          setContrasena(e.target.value);
                          setErrorContrasena(null);
                        }}
                      />
                      <CampoContrasena
                        id="contrasena-repetida"
                        etiqueta={t("cuenta.contrasena.repetida")}
                        error={repetida && contrasena !== repetida ? t("cuenta.contrasena.noIguales") : null}
                        exito={repetida && contrasena === repetida ? t("cuenta.contrasena.coinciden") : null}
                        autoComplete="new-password"
                        value={repetida}
                        disabled={enVista}
                        onChange={(e) => {
                          setRepetida(e.target.value);
                          setErrorContrasena(null);
                        }}
                      />
                      {errorContrasena && (
                        <p className="mb-4 flex items-start gap-2 font-bold text-rojo">
                          <Icono nombre="alerta" className="size-6" />
                          <span>{textoDeError(t, errorContrasena)}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <Boton icono="check" motivo={motivoEnVista ?? motivoContrasena} onClick={guardarContrasena}>
                          {contrasenaPor === "crear" ? t("cuenta.contrasena.crearLa") : t("cuenta.contrasena.cambiarLa")}
                        </Boton>
                        <Boton variante="plano" onClick={cerrarCambioDeContrasena}>
                          {t("cuenta.contrasena.mejorNo")}
                        </Boton>
                      </div>
                    </div>
                  ) : (
                    <div className="relative mt-3 inline-block">
                      {/* Sin contraseña se crea acá mismo; con contraseña, se
                          elige cómo cambiarla. */}
                      <Boton
                        icono="llave"
                        motivo={motivoEnVista ?? (mandandoMail ? t("cuenta.mandandoMail") : null)}
                        aria-expanded={tieneContrasena ? contrasenaPor === "menu" : undefined}
                        onClick={() => {
                          setMailMandado(null);
                          setErrorContrasena(null);
                          if (!tieneContrasena) setContrasenaPor("crear");
                          else setContrasenaPor((p) => (p === "menu" ? null : "menu"));
                        }}
                      >
                        {tieneContrasena ? t("cuenta.contrasena.cambiar") : t("cuenta.contrasena.crearUna")}
                      </Boton>
                      {/* Las dos formas, en un menú chico que se abre debajo. */}
                      {contrasenaPor === "menu" && (
                        <ul className="absolute top-full left-0 z-20 mt-2 flex w-max flex-col gap-1 rounded-tarjeta border border-borde bg-tarjeta p-2 shadow-lg">
                          <li>
                            <button
                              type="button"
                              onClick={mandarMailDeContrasena}
                              className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-campo px-3 text-left hover:bg-superficie"
                            >
                              <Icono nombre="sobre" />
                              <span>
                                <span className="block font-bold">{t("cuenta.contrasena.porMail")}</span>
                                <span className="block text-apoyo text-tinta-media">
                                  {t("cuenta.contrasena.porMailTexto")}
                                </span>
                              </span>
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={() => setContrasenaPor("anterior")}
                              className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-campo px-3 text-left hover:bg-superficie"
                            >
                              <Icono nombre="llave" />
                              <span>
                                <span className="block font-bold">{t("cuenta.contrasena.conAnterior")}</span>
                                <span className="block text-apoyo text-tinta-media">
                                  {t("cuenta.contrasena.conAnteriorTexto")}
                                </span>
                              </span>
                            </button>
                          </li>
                        </ul>
                      )}
                      {errorContrasena && (
                        <p className="mt-3 flex items-start gap-2 font-bold text-rojo">
                          <Icono nombre="alerta" className="size-6" />
                          <span>{textoDeError(t, errorContrasena)}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-apoyo text-tinta-suave">{t("cuenta.ficha.mail")}</dt>
                    <dd className="break-words">{usuario?.email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-apoyo text-tinta-suave">{t("cuenta.ficha.telefono")}</dt>
                    <dd>{telefonoLegible(usuario?.telefono) || t("cuenta.ficha.sinCargar")}</dd>
                  </div>
                  <div>
                    <dt className="text-apoyo text-tinta-suave">{t("cuenta.ficha.contrasena")}</dt>
                    {/* Sin botón acá afuera: se cambia desde "Editar". */}
                    <dd>
                      {estadoContrasena === "tiene" ? (
                        <>
                          <span aria-hidden="true">••••••••</span>
                          <span className="sr-only">{t("cuenta.contrasena.guardada")}</span>
                        </>
                      ) : estadoContrasena === "no tiene" ? (
                        t("cuenta.ficha.noTieneCorto")
                      ) : (
                        t("cuenta.ficha.seCambia")
                      )}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </Tarjeta>
      </>

      {/* Todos los negocios de la cuenta (docs/multinegocio.md). */}
      <TituloSeccion id="negocios">{t("cuenta.negocios.seccion")}</TituloSeccion>
      <TusNegocios negocios={negocios} sinLista={sinLista} />

      <TituloSeccion id="tema">{t("cuenta.tema.seccion")}</TituloSeccion>
      <Tema />

      <TituloSeccion id="suscripcion">{t("cuenta.suscripcion.seccion")}</TituloSeccion>
      <Suscripcion />

      <TituloSeccion id="idioma">{t("idioma.titulo")}</TituloSeccion>
      <Tarjeta className="mb-12">
        <p className="mb-2 text-tinta-media">{t("idioma.apoyo")}</p>
        <SelectorIdioma />
      </Tarjeta>

      <Boton icono="salir" onClick={salir}>
        {t("cuenta.cerrarSesion")}
      </Boton>
    </>
  );
}
