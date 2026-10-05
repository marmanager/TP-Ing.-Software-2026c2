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

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { etiquetaRol } from "@/lib/presets";
import { estadoDeLaContrasena, motivoDeContrasenaNueva, telefonoValido } from "@/lib/validaciones";
import { achicar, revisarArchivo } from "@/lib/imagen";
import FilaNegocio from "@/componentes/FilaNegocio";
import Icono from "@/componentes/Icono";
import { Boton, Campo, CampoContrasena, Cargando, Tarjeta, TituloSeccion } from "@/componentes/ui";
import TusNegocios from "./TusNegocios";

export default function MiPerfil() {
  const router = useRouter();
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { esDemo, sesion, usuario, cerrarSesion, definirContrasena, guardarPerfil, pedirResetContrasena } =
    useAuth();
  useTitulo("Mi perfil");

  // Editar el perfil, sobre un borrador como la ficha del negocio: "Cancelar"
  // deshace de verdad, y la foto no se guarda hasta tocar "Guardar".
  //
  // El input de archivo está escondido: el que trae el navegador no se puede
  // llevar a los 48 px de área táctil que pide la cartilla.
  const inputFoto = useRef(null);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState({ nombre: "", telefono: "", foto: null });
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

  // Sólo en el modo de ejemplo.
  const [borrandoTodo, setBorrandoTodo] = useState(false);

  if (cargando) return <Cargando />;

  function abrirEdicion() {
    // Dos formularios abiertos dejarían dos botones azules a la vez, y la
    // cartilla permite uno solo. Además nadie edita dos cosas a la vez.
    cerrarCambioDeContrasena();
    setBorrador({
      nombre: usuario?.nombre ?? "",
      telefono: usuario?.telefono ?? "",
      foto: usuario?.foto ?? null,
    });
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
  const errorTelefono =
    borrador.telefono.trim() && !telefonoValido(borrador.telefono)
      ? "El teléfono no es válido. Escribilo con característica y sin el 0 ni el 15:"
      : null;

  const motivoPerfil = !borrador.nombre.trim()
    ? "falta tu nombre"
    : errorTelefono
      ? "el teléfono no es válido"
      : achicandoFoto
        ? "achicando la foto"
        : guardando
          ? "guardando"
          : null;

  async function guardar() {
    setGuardando(true);
    setErrorPerfil(null);
    const r = await guardarPerfil(borrador);
    setGuardando(false);
    if (!r.ok) return setErrorPerfil(r.error);
    // La base ya cambió la cuenta y la ficha; esto lo refleja en Equipo sin
    // tener que recargar.
    datos.reflejarMiPerfil(usuario.id, {
      nombre: borrador.nombre.trim(),
      foto: borrador.foto,
    });
    cancelarEdicion();
    datos.avisarExito("Listo, tu perfil quedó guardado.");
  }

  async function elegirFoto(e) {
    const archivo = e.target.files?.[0];
    // Se vacía antes de hacer nada: si no, elegir dos veces el mismo archivo
    // no dispara este evento la segunda vez y parece que no anduvo.
    e.target.value = "";

    const problema = revisarArchivo(archivo);
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

  const motivoContrasena = guardandoContrasena
    ? "guardando"
    : contrasenaPor === "anterior" && !anterior
      ? "falta tu contraseña anterior"
      : motivoDeContrasenaNueva(contrasena, repetida);

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
    datos.avisarExito(
      creando
        ? "Listo, ya tenés contraseña. Desde ahora también podés entrar con tu mail."
        : "Listo, tu contraseña quedó cambiada."
    );
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
    setMailMandado(usuario?.email ?? "tu mail");
  }

  async function salir() {
    await cerrarSesion();
    router.replace("/iniciar-sesion");
  }

  const foto = editando ? borrador.foto : usuario?.foto;

  // "tiene", "no tiene" o "no se sabe" (lib/validaciones.js). Si no se sabe,
  // no se afirma nada: ni los puntos ni "no tenés una". El botón es "Cambiar
  // contraseña", y su opción "Por mail" sirve tenga o no.
  const estadoContrasena = estadoDeLaContrasena(sesion?.user, { recienCreada });
  const tieneContrasena = estadoContrasena !== "no tiene";

  return (
    <>
      <h1 className="text-pantalla">Mi perfil</h1>
      <p className="mt-1 mb-6 max-w-[65ch] text-tinta-media">
        Lo tuyo, aparte de lo del negocio: tus datos, tu foto y tu contraseña.
      </p>

      {esDemo ? (
        <Tarjeta className="mb-12">
          <p className="flex items-center gap-2 font-bold text-espera">
            <Icono nombre="alerta" className="size-6" />
            Estás en el modo de ejemplo
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            Acá no hay una cuenta: lo que cargues vive sólo en este navegador y no lo ve
            nadie más. Al salir volvés a la pantalla de entrada.
          </p>
          {/* Borrar todo dice qué se pierde antes de hacerlo (auditoría, H5). */}
          {borrandoTodo ? (
            <div className="mt-4 rounded-tarjeta bg-superficie p-4">
              <p className="font-bold text-cuerpo">¿Borrar todo lo que cargaste?</p>
              <p className="mt-1 max-w-[65ch] text-tinta-media">
                Se pierden el negocio, los casos, los clientes, la agenda y el inventario
                de este navegador, y volvés a empezar desde crear el negocio. No se puede
                deshacer.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Boton
                  variante="peligro"
                  icono="tacho"
                  onClick={() => {
                    setBorrandoTodo(false);
                    datos.reiniciar();
                  }}
                >
                  Sí, borrar todo
                </Boton>
                <Boton variante="plano" onClick={() => setBorrandoTodo(false)}>
                  Dejarlo como está
                </Boton>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              <Boton icono="salir" onClick={salir}>
                Salir del modo de ejemplo
              </Boton>
              <Boton variante="plano" icono="tacho" onClick={() => setBorrandoTodo(true)}>
                Borrar todo y empezar de nuevo
              </Boton>
            </div>
          )}
        </Tarjeta>
      ) : (
        <>
          <TituloSeccion id="cuenta">Tu cuenta</TituloSeccion>
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
                    aria-label="Cambiar tu foto"
                    aria-expanded={menuFoto}
                    onClick={() => setMenuFoto((v) => !v)}
                    className="absolute -right-2 -bottom-2 flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-tarjeta bg-azul text-white hover:bg-azul-apretado"
                  >
                    <Icono nombre="pincel" className="size-5" />
                  </button>
                )}
              </div>

              <div className="mr-auto min-w-0">
                {editando ? (
                  <p className="font-bold text-cuerpo">Tus datos</p>
                ) : (
                  <>
                    <p className="font-titulo font-extrabold text-subtitulo">
                      {usuario?.nombre || "Sin nombre todavía"}
                    </p>
                    {usuario?.rol && (
                      <p className="text-tinta-media">
                        {etiquetaRol(negocio?.rubro, usuario.rol)}
                        {negocio?.nombre && ` en ${negocio.nombre}`}
                      </p>
                    )}
                  </>
                )}
              </div>

              {!editando && (
                <Boton icono="pincel" onClick={abrirEdicion}>
                  Editar
                </Boton>
              )}
            </div>

            {/* Las dos opciones del pincel. "Eliminar" sólo aparece si hay
                algo que eliminar. */}
            {editando && menuFoto && (
              <div className="mt-3 flex flex-wrap gap-2 border-l-2 border-borde pl-3">
                <Boton
                  icono="cuenta"
                  motivo={achicandoFoto ? "achicando la foto" : null}
                  onClick={() => inputFoto.current?.click()}
                >
                  Elegir foto
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
                    Eliminar
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
                  etiqueta="Tu nombre"
                  ayuda="Como te ve el equipo. Con este nombre queda firmado lo que hacés en el historial."
                  autoComplete="name"
                  value={borrador.nombre}
                  onChange={(e) => setBorrador((b) => ({ ...b, nombre: e.target.value }))}
                />
                <Campo
                  id="perfil-telefono"
                  etiqueta="Tu teléfono"
                  ayuda="Opcional. Con característica, sin el 0 ni el 15."
                  error={errorTelefono}
                  ejemplo="341 456 7890"
                  inputMode="tel"
                  autoComplete="tel"
                  value={borrador.telefono}
                  onChange={(e) => setBorrador((b) => ({ ...b, telefono: e.target.value }))}
                />
                {/* El mail se ve pero no se toca: es con lo que entrás. */}
                <p className="mb-6 text-tinta-media">
                  Entrás con <span className="font-bold text-tinta">{usuario?.email}</span>. El
                  mail no se cambia desde acá.
                </p>

                {errorPerfil && (
                  <p className="mb-4 flex items-start gap-2 font-bold text-rojo">
                    <Icono nombre="alerta" className="size-6" />
                    <span>{errorPerfil}</span>
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Boton variante="principal" icono="check" motivo={motivoPerfil} onClick={guardar}>
                    Guardar
                  </Boton>
                  <Boton variante="plano" onClick={cancelarEdicion}>
                    Cancelar
                  </Boton>
                </div>

                {/* La contraseña, sólo desde "Editar": afuera, a un toque, se la
                    cambiaba cualquiera que encontrara la sesión abierta. Es un
                    guardado aparte del de arriba, y por eso su botón no es azul:
                    habría dos azules a la vez. */}
                <div className="mt-8 border-t border-borde pt-6">
                  <p className="font-bold text-cuerpo">Tu contraseña</p>
                  {estadoContrasena === "tiene" && (
                    <p className="mt-1 text-tinta-media">
                      <span aria-hidden="true">••••••••</span>
                      <span className="sr-only">Guardada</span>
                    </p>
                  )}
                  {estadoContrasena === "no tiene" && (
                    <p className="mt-1 text-tinta-media">
                      Todavía no tenés una: entrás con Google. Si la creás, también vas a poder entrar
                      con tu mail.
                    </p>
                  )}

                  {mailMandado && (
                    <p role="status" className="mt-3 flex items-start gap-2 font-bold text-completo">
                      <Icono nombre="sobre" className="mt-0.5 size-6" />
                      <span>
                        Te mandamos un mail a {mailMandado}. Tocá «Restablecer contraseña» y elegí la
                        nueva. El link sirve una sola vez.
                      </span>
                    </p>
                  )}

                  {contrasenaPor === "anterior" || contrasenaPor === "crear" ? (
                    <div className="mt-4">
                      {contrasenaPor === "anterior" && (
                        <CampoContrasena
                          id="contrasena-anterior"
                          etiqueta="Tu contraseña anterior"
                          ayuda="La que usás ahora para entrar."
                          autoComplete="current-password"
                          value={anterior}
                          onChange={(e) => {
                            setAnterior(e.target.value);
                            setErrorContrasena(null);
                          }}
                        />
                      )}
                      <CampoContrasena
                        id="contrasena-nueva"
                        etiqueta="Tu contraseña nueva"
                        ayuda={
                          contrasenaPor === "crear"
                            ? "Al menos 8 caracteres. Vas a poder entrar con tu mail y esta contraseña, o con Google."
                            : "Al menos 8 caracteres. Desde que la cambiás, entrás con esta."
                        }
                        autoComplete="new-password"
                        value={contrasena}
                        onChange={(e) => {
                          setContrasena(e.target.value);
                          setErrorContrasena(null);
                        }}
                      />
                      <CampoContrasena
                        id="contrasena-repetida"
                        etiqueta="Escribila de nuevo"
                        error={repetida && contrasena !== repetida ? "Las dos no son iguales." : null}
                        exito={repetida && contrasena === repetida ? "Coinciden." : null}
                        autoComplete="new-password"
                        value={repetida}
                        onChange={(e) => {
                          setRepetida(e.target.value);
                          setErrorContrasena(null);
                        }}
                      />
                      {errorContrasena && (
                        <p className="mb-4 flex items-start gap-2 font-bold text-rojo">
                          <Icono nombre="alerta" className="size-6" />
                          <span>{errorContrasena}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <Boton icono="check" motivo={motivoContrasena} onClick={guardarContrasena}>
                          {contrasenaPor === "crear" ? "Crear la contraseña" : "Cambiar la contraseña"}
                        </Boton>
                        <Boton variante="plano" onClick={cerrarCambioDeContrasena}>
                          Mejor no
                        </Boton>
                      </div>
                    </div>
                  ) : (
                    <div className="relative mt-3 inline-block">
                      {/* Sin contraseña se crea acá mismo; con contraseña, se
                          elige cómo cambiarla. */}
                      <Boton
                        icono="llave"
                        motivo={mandandoMail ? "mandando el mail" : null}
                        aria-expanded={tieneContrasena ? contrasenaPor === "menu" : undefined}
                        onClick={() => {
                          setMailMandado(null);
                          setErrorContrasena(null);
                          if (!tieneContrasena) setContrasenaPor("crear");
                          else setContrasenaPor((p) => (p === "menu" ? null : "menu"));
                        }}
                      >
                        {tieneContrasena ? "Cambiar contraseña" : "Crear una contraseña"}
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
                                <span className="block font-bold">Por mail</span>
                                <span className="block text-apoyo text-tinta-media">
                                  Te llega un link para elegir la nueva.
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
                                <span className="block font-bold">Con la contraseña anterior</span>
                                <span className="block text-apoyo text-tinta-media">
                                  La escribís, y después la nueva dos veces.
                                </span>
                              </span>
                            </button>
                          </li>
                        </ul>
                      )}
                      {errorContrasena && (
                        <p className="mt-3 flex items-start gap-2 font-bold text-rojo">
                          <Icono nombre="alerta" className="size-6" />
                          <span>{errorContrasena}</span>
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
                    <dt className="text-apoyo text-tinta-suave">Mail</dt>
                    <dd className="break-words">{usuario?.email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-apoyo text-tinta-suave">Teléfono</dt>
                    <dd>{usuario?.telefono || "Sin cargar"}</dd>
                  </div>
                  <div>
                    <dt className="text-apoyo text-tinta-suave">Contraseña</dt>
                    {/* Sin botón acá afuera: se cambia desde "Editar". */}
                    <dd>
                      {estadoContrasena === "tiene" ? (
                        <>
                          <span aria-hidden="true">••••••••</span>
                          <span className="sr-only">Guardada</span>
                        </>
                      ) : estadoContrasena === "no tiene" ? (
                        "Todavía no tenés: entrás con Google"
                      ) : (
                        "Se cambia desde Editar"
                      )}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </Tarjeta>
        </>
      )}

      {/* Con cuenta, todos sus negocios (docs/multinegocio.md). En el modo de
          ejemplo hay uno solo y no hay cuenta a la que atar otro. */}
      <TituloSeccion id="negocios">{esDemo ? "Tu negocio" : "Tus negocios"}</TituloSeccion>
      {esDemo ? (
        negocio && (
          <Link href="/negocio" className="mb-12 block">
            <Tarjeta className="flex items-center gap-3 hover:bg-superficie">
              <FilaNegocio negocio={negocio} />
              <span className="font-bold text-azul">Ir a Mi negocio</span>
            </Tarjeta>
          </Link>
        )
      ) : (
        <TusNegocios />
      )}

      {!esDemo && (
        <Boton icono="salir" onClick={salir}>
          Cerrar sesión
        </Boton>
      )}
    </>
  );
}
