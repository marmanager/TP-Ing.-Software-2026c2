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
import { useRouter } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import { ORDEN_ESTADOS, ESTADOS } from "@/lib/estados";
import { RUBROS, preset, ejemplosDe } from "@/lib/presets";
import { LISTA_MODULOS } from "@/lib/modulos";
import { contrasenaValida, telefonoValido } from "@/lib/validaciones";
import { achicar, revisarArchivo } from "@/lib/imagen";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Cargando, Tarjeta, TituloSeccion } from "@/componentes/ui";

export default function MiNegocio() {
  const router = useRouter();
  const datos = useDatos();
  const { cargando, negocio, casos, clientes, insumos, turnos } = datos;
  const { esDemo, usuario, cerrarSesion, definirContrasena } = useAuth();
  useTitulo("Mi negocio");

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
    telefono: "",
    foto: null,
  });
  const [menuFoto, setMenuFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);
  const [achicandoFoto, setAchicandoFoto] = useState(false);

  const LARGO_DESCRIPCION = 140;

  function abrirEdicion() {
    // Se cierra el otro editor de la pantalla: dos formularios abiertos
    // dejarían dos botones azules a la vez, y la cartilla permite uno solo.
    // Además nadie edita dos cosas distintas al mismo tiempo.
    cerrarCambioDeContrasena();
    setBorrador({
      nombre: negocio?.nombre ?? "",
      descripcion: negocio?.descripcion ?? "",
      telefono: negocio?.telefono ?? "",
      foto: negocio?.foto ?? null,
    });
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
  const errorTelefono =
    borrador.telefono.trim() && !telefonoValido(borrador.telefono)
      ? "El teléfono no es válido. Escribilo con característica y sin el 0 ni el 15:"
      : null;

  const motivoFicha = !borrador.nombre.trim()
    ? "falta el nombre"
    : borrador.descripcion.length > LARGO_DESCRIPCION
      ? "la descripción es muy larga"
      : errorTelefono
        ? "el teléfono no es válido"
        : achicandoFoto
          ? "achicando la foto"
          : null;

  function guardarFicha() {
    datos.guardarNegocio(borrador);
    setEditandoFicha(false);
    setMenuFoto(false);
    datos.avisarExito("Listo, los datos de tu negocio quedaron guardados.");
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

  // Cambiar la contraseña con la sesión abierta (SCRUM-32). Es la misma
  // definirContrasena() que usa el mail de recuperación: Supabase pide la
  // sesión, no la contraseña vieja, y acá la sesión ya está.
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);
  const [borrandoTodo, setBorrandoTodo] = useState(false);
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [errorContrasena, setErrorContrasena] = useState(null);
  const [guardandoContrasena, setGuardandoContrasena] = useState(false);

  // Se pide dos veces porque no se ve lo que se escribe: sin repetirla, un
  // dedazo deja a alguien afuera de su propia cuenta y sin forma de saberlo
  // hasta el próximo ingreso.
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
    datos.avisarExito("Listo, tu contraseña quedó cambiada.");
  }

  async function salir() {
    await cerrarSesion();
    router.replace("/iniciar-sesion");
  }

  if (cargando) return <Cargando />;

  const actual = preset(negocio?.rubro);
  const modulosActivos = negocio?.modulos_activos ?? [];
  // Configurar el negocio es del dueño, y la base también lo rechaza.
  const puedeConfigurar = puede(usuario?.rol, "configurarNegocio");
  const prendidos = LISTA_MODULOS.filter((m) => modulosActivos.includes(m.clave));
  const nuevo = rubroElegido ? preset(rubroElegido) : null;

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
    datos.avisarExito(`Listo. Tu negocio ahora es ${nuevo.nombre.toLowerCase()}.`);
    cerrarCambioDeRubro();
  }

  return (
    <>
      <h1 className="text-pantalla">Mi negocio</h1>
      <p className="mt-1 mb-6 max-w-[65ch] text-tinta-media">
        Cómo se llaman las cosas en tu oficio, y qué tenés cargado hasta ahora.
      </p>

      {/* En el celular esta pantalla son varias pantallas de scroll, y para
          llegar a la contraseña, que está al final, había que pasar por los
          estados, los módulos y el rubro todas las veces (auditoría, H6). */}
      <nav aria-label="En esta pantalla" className="mb-8">
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {[
            ["#estados", "Los estados"],
            ["#modulos", "Los módulos"],
            ["#rubro", "El rubro"],
            ["#cuenta", "Mi cuenta"],
          ].map(([href, texto]) => (
            <li key={href}>
              <a href={href} className="inline-flex min-h-12 items-center font-bold text-azul">
                {texto}
              </a>
            </li>
          ))}
        </ul>
      </nav>

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
                aria-label="Cambiar la foto del negocio"
                aria-expanded={menuFoto}
                onClick={() => setMenuFoto((v) => !v)}
                className="absolute -right-2 -bottom-2 flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-tarjeta bg-azul text-white hover:bg-azul-apretado"
              >
                <Icono nombre="pincel" className="size-5" />
              </button>
            )}
          </div>

          <div className="mr-auto">
            {editandoFicha ? (
              <p className="font-bold text-cuerpo">Los datos de tu negocio</p>
            ) : (
              <>
                <p className="font-titulo font-extrabold text-subtitulo">{negocio?.nombre}</p>
                <p className="text-tinta-media">{actual.nombre}</p>
                {negocio?.descripcion && (
                  <p className="mt-1 max-w-[65ch] text-tinta-media">{negocio.descripcion}</p>
                )}
                {negocio?.telefono && (
                  <p className="mt-1 text-tinta-media">Teléfono {negocio.telefono}</p>
                )}
              </>
            )}
          </div>

          {puedeConfigurar && !editandoFicha && (
            <Boton icono="pincel" onClick={abrirEdicion}>
              Editar
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

        {editandoFicha && (
          <div className="mt-6 max-w-[560px]">
            <Campo
              id="negocio-nombre"
              etiqueta="¿Cómo se llama tu negocio?"
              ayuda="Como lo ven vos y tu equipo, arriba de la navegación."
              value={borrador.nombre}
              onChange={(e) => setBorrador((b) => ({ ...b, nombre: e.target.value }))}
            />
            <Campo
              id="negocio-descripcion"
              etiqueta="Una línea sobre el negocio"
              ayuda={`Opcional. Lo que el rubro no dice. Ejemplo: ${ejemplosDe(negocio?.rubro).descripcion}.`}
              error={
                borrador.descripcion.length > LARGO_DESCRIPCION
                  ? `Son ${borrador.descripcion.length} caracteres y entran ${LARGO_DESCRIPCION}.`
                  : null
              }
              value={borrador.descripcion}
              onChange={(e) => setBorrador((b) => ({ ...b, descripcion: e.target.value }))}
            />

            {/* El teléfono del negocio, que no es el de nadie en particular:
                es el del cartel. Lo ve el cliente en el link de seguimiento,
                para poder preguntar antes de aprobar un presupuesto
                (SCRUM-68). */}
            <Campo
              id="negocio-telefono"
              etiqueta="Teléfono del negocio"
              ayuda="Opcional. Con característica, sin el 0 ni el 15. Lo va a ver el cliente en el link de seguimiento, para poder preguntarte antes de aprobar algo."
              error={errorTelefono}
              ejemplo="341 456 7890"
              value={borrador.telefono}
              onChange={(e) => setBorrador((b) => ({ ...b, telefono: e.target.value }))}
              inputMode="tel"
              autoComplete="tel"
            />

            <div className="flex flex-wrap gap-3">
              <Boton variante="principal" icono="check" motivo={motivoFicha} onClick={guardarFicha}>
                Guardar
              </Boton>
              <Boton variante="plano" onClick={cancelarEdicion}>
                Cancelar
              </Boton>
            </div>
          </div>
        )}

        <dl className="mt-6 grid gap-4 @lg:grid-cols-4">
          {[
            ["Casos", casos.length],
            ["Clientes", clientes.length],
            ["Insumos", insumos.length],
            ["Turnos", turnos.length],
          ].map(([que, cuanto]) => (
            <div key={que}>
              <dt className="text-apoyo text-tinta-suave">{que}</dt>
              <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">{cuanto}</dd>
            </div>
          ))}
        </dl>
      </Tarjeta>

      <TituloSeccion id="estados">Cómo se llaman los estados en tu rubro</TituloSeccion>
      <ul className="mb-12 overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
        {ORDEN_ESTADOS.map((estado) => {
          const e = ESTADOS[estado];
          return (
            <li
              key={estado}
              className="flex flex-wrap items-center gap-4 border-b border-borde p-4 last:border-b-0"
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-etiqueta ${e.fondo} ${e.texto}`}
              >
                <Icono nombre={e.icono} className="size-5" />
                {actual.etiquetas[estado]}
              </span>
              <p className="min-w-0 flex-1 text-tinta-media">{e.significado}</p>
            </li>
          );
        })}
      </ul>

      <TituloSeccion id="modulos">Módulos</TituloSeccion>
      <Tarjeta className="mb-12">
        <p className="text-tinta-media">
          Tenés{" "}
          <span className="font-bold text-tinta">
            {prendidos.length} de {LISTA_MODULOS.length}
          </span>{" "}
          módulos prendidos.
        </p>
        <p className="mt-1 max-w-[65ch] text-apoyo text-tinta-suave">
          {prendidos.length
            ? prendidos.map((m) => m.nombre).join(" · ")
            : "Ninguno. Estás usando sólo Inicio, Casos, Clientes y Mi negocio."}
        </p>
        <div className="mt-4">
          <Link
            href="/negocio/modulos"
            className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
          >
            <Icono nombre="cajas" />
            {puedeConfigurar ? "Ver y cambiar los módulos" : "Ver los módulos"}
          </Link>
        </div>
      </Tarjeta>

      <TituloSeccion id="rubro">El rubro de tu negocio</TituloSeccion>
      <Tarjeta className="mb-12">
        {!cambiandoRubro ? (
          <>
            <p className="max-w-[65ch] text-tinta-media">
              Tu negocio es <span className="font-bold text-tinta">{actual.nombre}</span>. El
              rubro cambia cómo se llaman los estados y qué motivos te ofrecemos al abrir un
              caso.
            </p>
            {rubroFijo ? (
              <p className="mt-2 max-w-[65ch] text-apoyo text-tinta-suave">
                Queda fijo desde que abriste el primer caso: los casos que ya tenés
                están cargados con las palabras de{" "}
                {actual.nombre.toLowerCase()}, con {actual.identificador.enFrase} y
                todo, y cambiarle el nombre al rubro no los convierte en otra cosa.
              </p>
            ) : puedeConfigurar ? (
              <div className="mt-4">
                <Boton icono="tienda" onClick={() => setCambiandoRubro(true)}>
                  Cambiar el rubro
                </Boton>
              </div>
            ) : (
              <p className="mt-2 text-apoyo text-tinta-suave">
                {QUIEN_PUEDE.configurarNegocio}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mb-4 max-w-[65ch] text-tinta-media">
              Elegí el rubro nuevo. Te vamos a mostrar qué cambia antes de aplicarlo.
            </p>

            <ul className="grid gap-3 @2xl:grid-cols-3">
              {RUBROS.map((r) => {
                const marcado = r.clave === (rubroElegido ?? negocio?.rubro);
                return (
                  <li key={r.clave}>
                    <button
                      type="button"
                      aria-pressed={marcado}
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
                  ¿Cambiar el rubro a {nuevo.nombre.toLowerCase()}?
                </p>

                <p className="mt-4 font-bold text-cuerpo">Qué cambia</p>
                <ul className="mt-1 flex flex-col gap-1 text-tinta-media">
                  <li>
                    Los cinco estados pasan a llamarse como en {nuevo.nombre.toLowerCase()}:
                    «{actual.etiquetas.en_proceso}» pasa a decir «{nuevo.etiquetas.en_proceso}
                    », «{actual.etiquetas.completado}» pasa a «{nuevo.etiquetas.completado}».
                  </li>
                  <li>
                    Con qué se identifica cada caso: «{actual.identificador.nombre}» pasa a
                    ser «{nuevo.identificador.nombre}».
                  </li>
                  <li>
                    Cómo se llama quien hace el trabajo: «{actual.roles.tecnico}» pasa a
                    «{nuevo.roles.tecnico}».
                  </li>
                  <li>Los motivos y los ejemplos que te ofrecemos al cargar algo.</li>
                </ul>

                <p className="mt-4 font-bold text-cuerpo">Qué no cambia</p>
                <ul className="mt-1 flex flex-col gap-1 text-tinta-media">
                  <li>Los módulos que tenés prendidos.</li>
                </ul>

                <p className="mt-4 max-w-[65ch] text-tinta-media">
                  Se puede cambiar sólo hasta que abras el primer caso. Después queda
                  fijo.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Boton icono="check" onClick={confirmarRubro}>
                    Cambiar el rubro
                  </Boton>
                  <Boton variante="plano" onClick={cerrarCambioDeRubro}>
                    Dejarlo como está
                  </Boton>
                </div>
              </div>
            )}

            {(!nuevo || nuevo.clave === negocio?.rubro) && (
              <div className="mt-6">
                <Boton variante="plano" onClick={cerrarCambioDeRubro}>
                  Dejarlo como está
                </Boton>
              </div>
            )}
          </>
        )}
      </Tarjeta>

      {/* Lo de la persona, separado de lo del negocio. La contraseña es de
          quien entró, no del negocio: en un negocio con tres cuentas, buscar
          la propia dentro de la configuración compartida no es donde nadie
          la busca (auditoría, H2). */}
      <div className="mt-16 border-t-2 border-borde pt-10">
        <TituloSeccion id="cuenta" className="mb-1">
          Mi cuenta
        </TituloSeccion>
        <p className="mb-4 max-w-[65ch] text-tinta-media">
          Es tuya, no del negocio: con qué entrás y tu contraseña.
        </p>
        <Tarjeta>
          {esDemo ? (
            <>
              <p className="flex items-center gap-2 font-bold text-espera">
                <Icono nombre="alerta" className="size-6" />
                Estás en el modo de ejemplo
              </p>
              <p className="mt-2 max-w-[65ch] text-tinta-media">
                Lo que cargues vive sólo en este navegador y no lo ve nadie más. Al salir
                volvés a la pantalla de entrada.
              </p>
              {/* Borrar todo estaba al lado de salir, con el mismo aspecto, y
                  borraba sin preguntar (auditoría, H5). Ahora dice qué se
                  pierde antes. */}
              {borrandoTodo ? (
                <div className="mt-4 rounded-tarjeta bg-superficie p-4">
                  <p className="font-bold text-cuerpo">¿Borrar todo lo que cargaste?</p>
                  <p className="mt-1 max-w-[65ch] text-tinta-media">
                    Se pierden el negocio, los casos, los clientes, la agenda y el
                    inventario de este navegador, y volvés a empezar desde crear el
                    negocio. No se puede deshacer.
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
            </>
          ) : (
            <>
              <p className="text-tinta-media">
                {usuario?.nombre ? (
                  <>
                    Entraste como{" "}
                    <span className="font-bold text-tinta">{usuario.nombre}</span>, con{" "}
                    {usuario.email}.
                  </>
                ) : (
                  <>
                    Entraste con{" "}
                    <span className="font-bold text-tinta">{usuario?.email ?? "tu cuenta"}</span>.
                  </>
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Boton
                  icono="llave"
                  onClick={() =>
                    cambiandoContrasena
                      ? cerrarCambioDeContrasena()
                      : (cancelarEdicion(), setCambiandoContrasena(true))
                  }
                >
                  {cambiandoContrasena ? "Mejor no" : "Cambiar la contraseña"}
                </Boton>
                <Boton icono="salir" onClick={salir}>
                  Cerrar sesión
                </Boton>
              </div>

              {cambiandoContrasena && (
                <div className="mt-6 border-t border-borde pt-6">
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
                    error={
                      repetida && contrasena !== repetida ? "Las dos no son iguales." : null
                    }
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

                  <Boton
                    variante="principal"
                    icono="check"
                    motivo={guardandoContrasena ? "guardando" : motivoContrasena}
                    onClick={guardarContrasena}
                  >
                    Cambiar la contraseña
                  </Boton>
                </div>
              )}
            </>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
