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
import { contrasenaValida, telefonoValido } from "@/lib/validaciones";
import { achicar, revisarArchivo } from "@/lib/imagen";
import FilaNegocio from "@/componentes/FilaNegocio";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion } from "@/componentes/ui";
import TusNegocios from "./TusNegocios";

export default function MiPerfil() {
  const router = useRouter();
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { esDemo, sesion, usuario, cerrarSesion, definirContrasena, guardarPerfil } = useAuth();
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

  // Cambiar la contraseña con la sesión abierta (SCRUM-32). Supabase pide la
  // sesión, no la contraseña vieja, y acá la sesión ya está.
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [errorContrasena, setErrorContrasena] = useState(null);
  const [guardandoContrasena, setGuardandoContrasena] = useState(false);

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

  // Se pide dos veces porque no se ve lo que se escribe: sin repetirla, un
  // dedazo deja a alguien afuera de su propia cuenta.
  const motivoContrasena = !contrasenaValida(contrasena)
    ? "necesita 8 caracteres o más"
    : contrasena !== repetida
      ? "repetila igual abajo"
      : null;

  function cerrarCambioDeContrasena() {
    setCambiandoContrasena(false);
    setContrasena("");
    setRepetida("");
    setErrorContrasena(null);
  }

  async function guardarContrasena() {
    setGuardandoContrasena(true);
    const r = await definirContrasena(contrasena);
    setGuardandoContrasena(false);
    if (!r.ok) return setErrorContrasena(r.error);
    cerrarCambioDeContrasena();
    datos.avisarExito("Listo, tu contraseña quedó guardada.");
  }

  async function salir() {
    await cerrarSesion();
    router.replace("/iniciar-sesion");
  }

  const foto = editando ? borrador.foto : usuario?.foto;

  // Quien entró sólo con Google no tiene contraseña: mostrarle puntos sería
  // decirle que tiene una. Si no se sabe con qué entró, se asume la de
  // siempre.
  const proveedores = sesion?.user?.app_metadata?.providers;
  const soloGoogle = Array.isArray(proveedores) && !proveedores.includes("email");

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
                    <dd className="flex flex-wrap items-center gap-x-3">
                      {soloGoogle ? (
                        <span>Entrás con Google</span>
                      ) : (
                        <>
                          <span aria-hidden="true">••••••••</span>
                          <span className="sr-only">Guardada</span>
                        </>
                      )}
                      {!cambiandoContrasena && (
                        <Boton
                          variante="plano"
                          icono="llave"
                          onClick={() => setCambiandoContrasena(true)}
                        >
                          {soloGoogle ? "Crear una" : "Cambiarla"}
                        </Boton>
                      )}
                    </dd>
                  </div>
                </dl>

                {cambiandoContrasena && (
                  <div className="mt-6 max-w-[560px] border-t border-borde pt-6">
                    {/* Los mismos dos campos de antes (SCRUM-32), que vivían en
                        su propia sección. */}
                    <Campo
                      id="contrasena-nueva"
                      etiqueta="Tu contraseña nueva"
                      ayuda="Al menos 8 caracteres. Desde que la cambiás, entrás con esta."
                      type="password"
                      autoComplete="new-password"
                      value={contrasena}
                      onChange={(e) => {
                        setContrasena(e.target.value);
                        setErrorContrasena(null);
                      }}
                    />
                    <Campo
                      id="contrasena-repetida"
                      etiqueta="Escribila de nuevo"
                      error={repetida && contrasena !== repetida ? "Las dos no son iguales." : null}
                      exito={repetida && contrasena === repetida ? "Coinciden." : null}
                      type="password"
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
                      <Boton
                        variante="principal"
                        icono="check"
                        motivo={guardandoContrasena ? "guardando" : motivoContrasena}
                        onClick={guardarContrasena}
                      >
                        {soloGoogle ? "Crear la contraseña" : "Cambiar la contraseña"}
                      </Boton>
                      <Boton variante="plano" onClick={cerrarCambioDeContrasena}>
                        Mejor no
                      </Boton>
                    </div>
                  </div>
                )}
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
