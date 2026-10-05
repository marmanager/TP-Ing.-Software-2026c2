"use client";

// Sesión y cuentas (SCRUM-5).
//
// Dos modos, igual que la capa de datos:
//   - Con credenciales de Supabase: cuentas reales (email + contraseña).
//   - Sin credenciales: el modo de ejemplo, que entra sin contraseña y guarda
//     todo en el navegador. Así el equipo clona y levanta el proyecto sin
//     esperar a que alguien reparta las claves (ver README).
//
// La tabla `usuario` liga la cuenta con su negocio, y de ahí cuelgan todas
// las políticas de Row Level Security (supabase/005_rls.sql y 008_permisos.sql).

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase, haySupabase, formasDeEntrar } from "./supabase";
import { errorAlSalirHaciaGoogle, googleActivado, nombreDeLaCuenta, origenDeIngreso } from "./ingreso-google.js";
import { mandar, quitar, reemplazar, traer, usaLaApi } from "./api.js";

const LLAVE_DEMO = "marmanager.demo.v1";
const LLAVE_MAIL = "marmanager.mail-a-confirmar";
const LLAVE_INVITACION = "marmanager.invitacion";
const Contexto = createContext(null);

// Si alguien llegó por una invitación y tuvo que crearse la cuenta primero,
// nos guardamos el código para no hacerle buscar el link de nuevo.
//
// Va en localStorage y no en sessionStorage a propósito: el enlace del mail
// de confirmación abre una pestaña NUEVA, y sessionStorage no cruza pestañas.
// Con sessionStorage el código se perdía justo en el momento en que hacía
// falta, y la persona caía en "Crear tu negocio" sin forma de volver.
export function recordarInvitacion(codigo) {
  try {
    window.localStorage.setItem(LLAVE_INVITACION, codigo);
  } catch {
    // Si el navegador no deja guardar, siempre queda volver a abrir el link.
  }
}

export function invitacionPendiente() {
  try {
    return window.localStorage.getItem(LLAVE_INVITACION);
  } catch {
    return null;
  }
}

export function olvidarInvitacion() {
  try {
    window.localStorage.removeItem(LLAVE_INVITACION);
  } catch {
    // No pasa nada: en el peor caso se vuelve a ofrecer una invitación usada,
    // y la pantalla de unirme avisa que ya no sirve.
  }
}

// A qué mail hay que confirmar. Se guarda al crear la cuenta, porque en ese
// momento todavía no hay sesión de donde sacarlo. En localStorage por lo
// mismo: la confirmación se abre en otra pestaña.
export function mailAConfirmar() {
  try {
    return window.localStorage.getItem(LLAVE_MAIL);
  } catch {
    return null;
  }
}

export function olvidarMail() {
  try {
    window.localStorage.removeItem(LLAVE_MAIL);
  } catch {
    // Si no se puede borrar, lo peor que pasa es repetir el aviso de que
    // el mail quedó confirmado.
  }
}

// Un mensaje dice qué hacer, no sólo que algo falló (cartilla, sección 07).
function traducir(error) {
  const m = (error?.message || "").toLowerCase();
  if (m.includes("invalid login credentials"))
    return "El mail o la contraseña no coinciden. Fijate que no tengas el bloqueo de mayúsculas puesto.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already"))
    return "Ya hay una cuenta con ese mail. Probá iniciar sesión.";
  if (m.includes("email not confirmed"))
    return "Todavía no confirmaste el mail. Buscá el mensaje que te mandamos y tocá el enlace.";
  if (m.includes("password should be at least") || m.includes("password should contain"))
    return "La contraseña necesita al menos 8 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "Ese mail no tiene forma de mail. Por ejemplo: nombre@taller.com.";
  if (m.includes("for security purposes") || m.includes("rate limit") || m.includes("too many"))
    return "Probá de nuevo en un minuto: se hicieron muchos intentos seguidos.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "No se pudo conectar. Fijate que tengas internet y volvé a probar.";
  return "No se pudo completar. Probá de nuevo en un rato.";
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [esDemo, setEsDemo] = useState(false);
  // Se prende cuando la persona entró por el enlace de "recuperar contraseña",
  // para dejarla llegar a /nueva-contrasena aunque ya tenga sesión y negocio.
  const [recuperando, setRecuperando] = useState(false);
  // Si "Entrar con Google" está activado en Supabase. Hasta saberlo, no.
  const [hayGoogle, setHayGoogle] = useState(false);
  // Id de la cuenta cargada en `usuario`; el callback de onAuthStateChange
  // vive con el alcance del montaje y no vería el estado al día.
  const idCargado = useRef(null);
  useEffect(() => {
    idCargado.current = usuario?.id ?? null;
  }, [usuario]);

  useEffect(() => {
    let vivo = true;
    formasDeEntrar().then((formas) => {
      if (vivo) setHayGoogle(googleActivado(formas));
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Trae (o crea) la fila de `usuario` que liga la cuenta con su negocio.
  async function traerUsuario(user, accessToken = null) {
    if (!user) return null;
    const sinBase = {
      id: user.id,
      email: user.email ?? null,
      telefono: user.user_metadata?.telefono ?? null,
      // Con mail y contraseña viene como "nombre"; con Google, como
      // "full_name" (ingreso-google.js).
      nombre: nombreDeLaCuenta(user.user_metadata),
      negocio_id: null,
      rol: "duenio",
    };
    if (usaLaApi("auth")) {
      const token = accessToken ?? (await supabase.auth.getSession()).data?.session?.access_token;
      if (token) {
        const r = await traer("/cuenta", token);
        if (r.ok && r.datos.usuario) return r.datos.usuario;
      }
      return sinBase;
    }
    const { data, error } = await supabase
      .from("usuario")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return sinBase; // la tabla puede no existir todavía
    if (data) return data;
    // Sin negocio_id ni rol: la base no deja que una cuenta los elija
    // (035_usuario_blindado.sql), y rechaza el alta entera si los nombra,
    // aunque vayan vacíos. Nacen con sus valores por defecto —sin negocio,
    // rol 'duenio'—, que son los mismos que dice sinBase.
    const { id, email, telefono, nombre } = sinBase;
    await supabase.from("usuario").insert({ id, email, telefono, nombre });
    return sinBase;
  }

  useEffect(() => {
    let vivo = true;

    // Modo de ejemplo: no necesita Supabase.
    const demo =
      typeof window !== "undefined" && window.localStorage.getItem(LLAVE_DEMO) === "1";
    if (demo) {
      setEsDemo(true);
      setCargando(false);
      return () => {
        vivo = false;
      };
    }

    if (!haySupabase) {
      setCargando(false);
      return () => {
        vivo = false;
      };
    }

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      setSesion(data.session ?? null);
      setUsuario(data.session ? await traerUsuario(data.session.user, data.session.access_token) : null);
      setCargando(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (!vivo) return;
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
      setSesion(s ?? null);
      if (!s) {
        setUsuario(null);
        setCargando(false);
        return;
      }
      // Supabase avisa SIGNED_IN cada vez que la pestaña vuelve al frente (y
      // TOKEN_REFRESHED al renovar la sesión). Releer la cuenta ahí cambiaba
      // solo de negocio si se había cambiado en otro dispositivo, y pasaba
      // por "cargando", borrando lo que se estaba escribiendo. Si ya es la
      // misma cuenta, no se toca nada: lo que cambia la cuenta desde este
      // dispositivo ya la relee, y lo de otro dispositivo lo detecta datos.js
      // y lo avisa (docs/multinegocio.md).
      if (s.user.id === idCargado.current) return;
      // Supabase puede bloquear las llamadas hechas dentro de este callback.
      // Esperamos al siguiente ciclo antes de consultar la tabla usuario.
      setCargando(true);
      setTimeout(async () => {
        try {
          const perfil = await traerUsuario(s.user, s.access_token);
          if (vivo) setUsuario(perfil);
        } catch (error) {
          console.error("No se pudo cargar el usuario:", error);
        } finally {
          if (vivo) setCargando(false);
        }
      }, 0);
    });

    return () => {
      vivo = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sesion?.access_token || !usuario?.negocio_id || esDemo) return;
    let activo = true;
    let timer;
    const headers = { authorization: `Bearer ${sesion.access_token}` };
    (async () => {
      try {
        const response = await fetch("/api/google-calendar", { headers });
        const status = await response.json();
        if (!activo || !status.conectado) return;
        const sincronizar = () => fetch("/api/google-calendar", {
          method: "POST", headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ action: "sync" }),
        }).catch(() => {});
        await sincronizar();
        if (activo) timer = setInterval(sincronizar, 60_000);
      } catch { /* La agenda funciona aunque Google esté desconectado. */ }
    })();
    return () => { activo = false; clearInterval(timer); };
  }, [sesion?.access_token, usuario?.negocio_id, esDemo]);

  const acciones = useMemo(
    () => ({
      // Devuelven { ok: true, ... } o { ok: false, error: "texto ya listo" }.

      async crearCuenta({ nombre, email, telefono, contrasena }) {
        if (!haySupabase)
          return {
            ok: false,
            error:
              "Para crear una cuenta hace falta conectar la base de Supabase. Mientras tanto podés entrar sin cuenta y probar el sistema.",
          };
        if (usaLaApi("auth")) {
          const r = await mandar("/cuentas", { nombre, email, telefono, contrasena });
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          if (r.datos.necesita_confirmar) {
            try { window.localStorage.setItem(LLAVE_MAIL, email.trim()); } catch {}
            return { ok: true, necesitaConfirmar: true, email: email.trim() };
          }
          if (r.datos.token && r.datos.refresh_token) {
            await supabase.auth.setSession({ access_token: r.datos.token, refresh_token: r.datos.refresh_token });
          }
          return { ok: true, necesitaConfirmar: false };
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: contrasena,
          // Viajan en los datos de la cuenta porque todavía no hay sesión y
          // las políticas piden una: traerUsuario() los baja a la tabla
          // `usuario` en el primer ingreso.
          options: { data: { nombre: nombre.trim(), telefono: telefono.trim() } },
        });
        if (error) return { ok: false, error: traducir(error) };
        // Supabase devuelve un usuario sin identidades cuando el mail ya existe.
        if (
          data.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          return { ok: false, error: "Ya hay una cuenta con ese mail. Probá iniciar sesión." };
        }
        // La fila de `usuario` no se crea acá: con la verificación de mail
        // prendida todavía no hay sesión, y las políticas de RLS piden una.
        // La crea traerUsuario() en el primer ingreso, con el nombre y el
        // teléfono que viajan en los datos de la cuenta.
        if (!data.session) {
          try {
            window.localStorage.setItem(LLAVE_MAIL, email.trim());
          } catch {
            // Si el navegador no deja guardar, la pantalla de confirmación
            // muestra el texto sin el mail y se sigue entendiendo.
          }
          return { ok: true, necesitaConfirmar: true, email: email.trim() };
        }
        return { ok: true, necesitaConfirmar: false };
      },

      async iniciarSesion({ email, contrasena }) {
        if (!haySupabase)
          return {
            ok: false,
            error:
              "Para iniciar sesión hace falta conectar la base de Supabase. Mientras tanto podés entrar sin cuenta y probar el sistema.",
          };
        if (usaLaApi("auth")) {
          const r = await mandar("/sesiones", { email, contrasena });
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          const { error } = await supabase.auth.setSession({
            access_token: r.datos.token,
            refresh_token: r.datos.refresh_token,
          });
          if (error) return { ok: false, error: traducir(error) };
          setUsuario(r.datos.usuario ?? null);
          return { ok: true };
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: contrasena,
        });
        if (error) return { ok: false, error: traducir(error) };
        return { ok: true };
      },

      // Entrar con Google. Sirve igual para entrar y para crear la cuenta: si
      // no existe, Supabase la crea. Sale de la página hacia Google y vuelve
      // a /iniciar-sesion con la sesión puesta; de ahí la Guardia la lleva a
      // donde corresponda (crear el negocio, o Inicio). Una invitación
      // pendiente sobrevive al viaje porque está guardada en el navegador.
      //
      // Pide sólo quién es la persona: NO conecta Google Calendar, que es un
      // permiso aparte (src/lib/google-calendar-server.js).
      async entrarConGoogle() {
        if (!haySupabase)
          return {
            ok: false,
            error:
              "Para entrar con Google hace falta conectar la base de Supabase. Mientras tanto podés entrar sin cuenta y probar el sistema.",
          };
        window.localStorage.removeItem(LLAVE_DEMO);
        if (usaLaApi("auth")) {
          const r = await mandar("/sesiones/google", {});
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          window.location.assign(r.datos.url);
          return { ok: true };
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: origenDeIngreso(window.location.origin) + "/iniciar-sesion",
            // Que siempre pregunte con qué cuenta: en la compu del local puede
            // haber una cuenta de Google abierta que no es la de esta persona.
            queryParams: { prompt: "select_account" },
          },
        });
        if (error) return { ok: false, error: errorAlSalirHaciaGoogle(error) };
        return { ok: true };
      },

      async cerrarSesion() {
        if (esDemo) {
          window.localStorage.removeItem(LLAVE_DEMO);
          setEsDemo(false);
          return { ok: true };
        }
        if (usaLaApi("auth") && sesion?.access_token) {
          await quitar("/sesiones", sesion.access_token);
        }
        await supabase.auth.signOut({ scope: "local" });
        setSesion(null);
        setUsuario(null);
        setRecuperando(false);
        return { ok: true };
      },

      entrarComoDemo() {
        window.localStorage.setItem(LLAVE_DEMO, "1");
        setEsDemo(true);
        setSesion(null);
        setUsuario(null);
        setCargando(false);
        return { ok: true };
      },

      async pedirResetContrasena(email) {
        if (!haySupabase)
          return { ok: false, error: "Para recuperar la contraseña hace falta conectar la base de Supabase." };
        if (usaLaApi("auth")) {
          await mandar("/sesiones/recuperar", { email });
          return { ok: true };
        }
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: origenDeIngreso(window.location.origin) + "/nueva-contrasena",
        });
        // No decimos si el mail existe o no.
        return { ok: true };
      },

      async definirContrasena(nueva) {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        if (usaLaApi("auth")) {
          const r = await mandar("/sesiones/contrasena", { contrasena: nueva }, sesion?.access_token);
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          setRecuperando(false);
          return { ok: true };
        }
        const { error } = await supabase.auth.updateUser({ password: nueva });
        if (error) return { ok: false, error: traducir(error) };
        setRecuperando(false);
        return { ok: true };
      },

      async reenviarConfirmacion(email) {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        if (usaLaApi("auth")) {
          const r = await mandar("/cuentas/confirmacion", { email });
          return r.ok ? { ok: true } : { ok: false, error: r.error.mensaje };
        }
        const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
        if (error) return { ok: false, error: traducir(error) };
        return { ok: true };
      },

      // Los negocios de la cuenta (docs/multinegocio.md): uno por cada ficha
      // de equipo que tiene. Sin la 038 corrida la función no existe y da
      // ok: false; quien la usa sigue como antes, con el negocio activo.
      async misNegocios() {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        if (usaLaApi("auth")) {
          const r = await traer("/cuenta/negocios", sesion?.access_token);
          return r.ok ? { ok: true, negocios: r.datos.negocios ?? [] } : { ok: false, error: r.error.mensaje };
        }
        const { data, error } = await supabase.rpc("mis_negocios");
        if (error) return { ok: false, error: traducir(error) };
        return { ok: true, negocios: data ?? [] };
      },

      // Pasa la cuenta a otro de sus negocios. La base verifica que tenga
      // ficha ahí y copia el rol de esa ficha (038). Después se vuelve a leer
      // la fila de usuario, y con eso datos.js carga el negocio nuevo.
      async entrarAlNegocio(negocioId) {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        if (usaLaApi("auth")) {
          const r = await mandar("/cuenta/negocio", { negocio_id: negocioId }, sesion?.access_token);
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          if (sesion?.user) setUsuario(await traerUsuario(sesion.user, sesion.access_token));
          return { ok: true };
        }
        const { error } = await supabase.rpc("entrar_al_negocio", { p_negocio: negocioId });
        if (error) {
          return { ok: false, error: error.code === "P0001" ? error.message : traducir(error) };
        }
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user));
        return { ok: true };
      },

      // El predeterminado y el Inicio rápido: valen para la cuenta, en todos
      // los dispositivos, por eso van a la base y no al navegador.
      async guardarPreferenciasDeEntrada({ predeterminado, inicioRapido }) {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        if (usaLaApi("auth")) {
          const r = await reemplazar("/cuenta/preferencias", {
            predeterminado: predeterminado ?? null,
            inicio_rapido: Boolean(inicioRapido),
          }, sesion?.access_token);
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          if (sesion?.user) setUsuario(await traerUsuario(sesion.user, sesion.access_token));
          return { ok: true };
        }
        const { error } = await supabase.rpc("guardar_preferencias_de_entrada", {
          p_predeterminado: predeterminado ?? null,
          p_inicio_rapido: Boolean(inicioRapido),
        });
        if (error) {
          return { ok: false, error: error.code === "P0001" ? error.message : traducir(error) };
        }
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user));
        return { ok: true };
      },

      // Guarda el perfil de quien entró (SCRUM-118): nombre, teléfono y foto,
      // y el nombre también en su ficha del equipo. Lo hace una función de la
      // base (034) en una sola operación, porque la ficha sólo la puede tocar
      // el dueño y el historial firma con ella. Después vuelve a leer la fila,
      // así todo lo que muestra el usuario queda al día.
      async guardarPerfil({ nombre, telefono, foto }) {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        if (usaLaApi("auth")) {
          const r = await reemplazar("/cuenta/perfil", { nombre, telefono, foto: foto ?? null }, sesion?.access_token);
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          if (sesion?.user) setUsuario(await traerUsuario(sesion.user, sesion.access_token));
          return { ok: true };
        }
        const { error } = await supabase.rpc("guardar_mi_perfil", {
          p_nombre: nombre,
          p_telefono: telefono,
          p_foto: foto ?? null,
        });
        // P0001 es un `raise exception` de la función: esos mensajes ya están
        // escritos para la persona ("Falta tu nombre.") y van tal cual. Lo
        // demás —sin internet, o la 034 sin correr— pasa por traducir(), así
        // nadie lee "Could not find the function" en inglés.
        if (error) {
          return { ok: false, error: error.code === "P0001" ? error.message : traducir(error) };
        }
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user));
        return { ok: true };
      },

      // Vuelve a leer la fila de `usuario`. Se usa después de aceptar una
      // invitación o de crear un negocio, donde cambian el negocio y el rol
      // de una sola vez.
      async refrescarUsuario() {
        if (!sesion?.user) return { ok: false };
        const u = await traerUsuario(sesion.user, sesion.access_token);
        setUsuario(u);
        return { ok: true, usuario: u };
      },

      // Mira una invitación con sólo el código, sin pertenecer al negocio.
      async verInvitacion(codigo) {
        if (!haySupabase) {
          return { ok: false, error: "Para usar una invitación hace falta conectar la base de Supabase." };
        }
        if (usaLaApi("auth")) {
          const r = await traer(`/publico/invitaciones/${encodeURIComponent(codigo)}`);
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          const fila = r.datos.invitacion;
          if (!fila) return { ok: false, error: "Este link no existe. Fijate que esté completo." };
          return { ok: true, negocio: fila.negocio_nombre, rol: fila.rol, sirve: fila.sirve, motivo: fila.motivo };
        }
        const { data, error } = await supabase.rpc("ver_invitacion", { p_codigo: codigo });
        if (error) return { ok: false, error: traducir(error) };
        const fila = Array.isArray(data) ? data[0] : data;
        if (!fila) return { ok: false, error: "Este link no existe. Fijate que esté completo." };
        return {
          ok: true,
          negocio: fila.negocio_nombre,
          rol: fila.rol,
          sirve: fila.sirve,
          motivo: fila.motivo,
        };
      },

      async aceptarInvitacion(codigo, nombre) {
        if (!haySupabase) {
          return { ok: false, error: "Para usar una invitación hace falta conectar la base de Supabase." };
        }
        if (usaLaApi("auth")) {
          const r = await mandar(`/invitaciones/${encodeURIComponent(codigo)}/aceptar`, { nombre: nombre ?? null }, sesion?.access_token);
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          olvidarInvitacion();
          const refrescado = await traerUsuario(sesion.user, sesion.access_token);
          setUsuario(refrescado);
          return { ok: true };
        }
        const { error } = await supabase.rpc("aceptar_invitacion", {
          p_codigo: codigo,
          p_nombre: nombre ?? null,
        });
        // Los mensajes de esta función ya están escritos para leerse.
        if (error) return { ok: false, error: error.message };
        olvidarInvitacion();
        const refrescado = await traerUsuario(sesion.user);
        setUsuario(refrescado);
        return { ok: true };
      },
    }),
    [esDemo, sesion]
  );

  const necesitaConfirmarMail = Boolean(
    !esDemo && sesion?.user && !sesion.user.email_confirmed_at && !sesion.user.confirmed_at
  );

  const valor = {
    sesion,
    usuario,
    esDemo,
    recuperando,
    cargando,
    necesitaConfirmarMail,
    haySupabase,
    hayGoogle,
    ...acciones,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth() {
  const v = useContext(Contexto);
  if (!v) throw new Error("useAuth tiene que usarse adentro de <AuthProvider>");
  return v;
}
