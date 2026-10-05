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

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { nombreDeLaCuenta } from "./ingreso-google.js";
import { alPedirConSesion, alVencerLaSesion, API, mandar, quitar, reemplazar, traer } from "./api.js";
import {
  borrar as borrarSesion,
  guardar as guardarSesion,
  leer as leerSesion,
  sesionDeRespuesta,
  sesionDelFragmento,
  sesionParaLaApp,
  tokenVigente,
} from "./sesion.js";

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

export function AuthProvider({ children }) {
  const hayCuentas = Boolean(API);
  const [sesion, setSesion] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [esDemo, setEsDemo] = useState(false);
  // Se prende cuando la persona entró por el enlace de "recuperar contraseña",
  // para dejarla llegar a /nueva-contrasena aunque ya tenga sesión y negocio.
  const [recuperando, setRecuperando] = useState(false);
  // La API resuelve si Google está habilitado y devuelve un error legible si
  // la configuración externa todavía no está completa.
  const hayGoogle = hayCuentas;

  // Toda llamada autenticada pasa por acá antes de salir. Así usa el token
  // vigente aunque otra llamada lo haya renovado, y mantiene el estado de
  // React al día para las rutas internas de Google Calendar.
  useEffect(() => {
    alPedirConSesion(async () => {
      const token = await tokenVigente();
      const propia = leerSesion();
      if (!token || !propia) {
        setSesion(null);
        setUsuario(null);
        return null;
      }
      setSesion((actual) => actual?.access_token === token ? actual : sesionParaLaApp(propia));
      return token;
    });
    alVencerLaSesion(() => {
      borrarSesion();
      setSesion(null);
      setUsuario(null);
      setRecuperando(false);
    });
    return () => {
      alPedirConSesion(null);
      alVencerLaSesion(null);
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
    const token = accessToken ?? await tokenVigente();
    if (token) {
      const r = await traer("/cuenta", token);
      if (r.ok && r.datos.usuario) return r.datos.usuario;
    }
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

    if (!hayCuentas) {
      setCargando(false);
      return () => {
        vivo = false;
      };
    }

    (async () => {
      const deLaVuelta = sesionDelFragmento(window.location.hash);
      if (deLaVuelta) {
        guardarSesion(null, deLaVuelta);
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }

      const token = await tokenVigente();
      if (!vivo) return;
      if (!token) {
        setSesion(null);
        setUsuario(null);
        setCargando(false);
        return;
      }

      const cuenta = await traer("/cuenta", token);
      if (!vivo) return;
      if (!cuenta.ok) {
        if (cuenta.error.codigo === "sesion_vencida") borrarSesion();
        setSesion(null);
        setUsuario(null);
        setCargando(false);
        return;
      }

      const guardada = leerSesion();
      const propia = {
        ...guardada,
        auth_usuario: cuenta.datos.auth_usuario,
        recuperando: deLaVuelta?.recuperando ?? guardada?.recuperando ?? false,
      };
      guardarSesion(null, propia);
      setSesion(sesionParaLaApp(propia));
      setUsuario(cuenta.datos.usuario ?? null);
      setRecuperando(Boolean(propia.recuperando));
      setCargando(false);
    })();

    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!sesion?.access_token || !usuario?.negocio_id || esDemo) return;
    let activo = true;
    let timer;
    (async () => {
      try {
        const token = await tokenVigente();
        if (!token) return;
        const headers = { authorization: `Bearer ${token}` };
        const response = await fetch("/api/google-calendar", { headers });
        const status = await response.json();
        if (!activo || !status.conectado) return;
        const sincronizar = async () => {
          const vigente = await tokenVigente();
          if (!vigente) return;
          return fetch("/api/google-calendar", {
            method: "POST",
            headers: { authorization: `Bearer ${vigente}`, "content-type": "application/json" },
            body: JSON.stringify({ action: "sync" }),
          }).catch(() => {});
        };
        await sincronizar();
        if (activo) timer = setInterval(sincronizar, 60_000);
      } catch { /* La agenda funciona aunque Google esté desconectado. */ }
    })();
    return () => { activo = false; clearInterval(timer); };
  }, [sesion?.access_token, usuario?.negocio_id, esDemo]);

  const acciones = useMemo(
    () => ({
      // Devuelven { ok: true, ... } o { ok: false, error: "texto ya listo" }.

      async tokenActual() {
        return tokenVigente();
      },

      async crearCuenta({ nombre, email, telefono, contrasena }) {
        if (!hayCuentas)
          return {
            ok: false,
            error:
              "Para crear una cuenta hace falta conectar la base de Supabase. Mientras tanto podés entrar sin cuenta y probar el sistema.",
          };
        const r = await mandar("/cuentas", { nombre, email, telefono, contrasena });
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        if (r.datos.necesita_confirmar) {
          try { window.localStorage.setItem(LLAVE_MAIL, email.trim()); } catch {}
          return { ok: true, necesitaConfirmar: true, email: email.trim() };
        }
        if (r.datos.token && r.datos.refresh_token) {
          const propia = sesionDeRespuesta(r.datos);
          guardarSesion(null, propia);
          setSesion(sesionParaLaApp(propia));
          setUsuario(r.datos.usuario ?? null);
        }
        return { ok: true, necesitaConfirmar: false };
      },

      async iniciarSesion({ email, contrasena }) {
        if (!hayCuentas)
          return {
            ok: false,
            error:
              "Para iniciar sesión hace falta conectar la base de Supabase. Mientras tanto podés entrar sin cuenta y probar el sistema.",
          };
        const r = await mandar("/sesiones", { email, contrasena });
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        const propia = sesionDeRespuesta(r.datos);
        guardarSesion(null, propia);
        setSesion(sesionParaLaApp(propia));
        setUsuario(r.datos.usuario ?? null);
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
        if (!hayCuentas)
          return {
            ok: false,
            error:
              "Para entrar con Google hace falta conectar la base de Supabase. Mientras tanto podés entrar sin cuenta y probar el sistema.",
          };
        window.localStorage.removeItem(LLAVE_DEMO);
        const r = await mandar("/sesiones/google", {});
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        window.location.assign(r.datos.url);
        return { ok: true };
      },

      async cerrarSesion() {
        if (esDemo) {
          window.localStorage.removeItem(LLAVE_DEMO);
          setEsDemo(false);
          return { ok: true };
        }
        if (sesion?.access_token) await quitar("/sesiones", sesion.access_token);
        borrarSesion();
        setSesion(null);
        setUsuario(null);
        setRecuperando(false);
        return { ok: true };
      },

      entrarComoDemo() {
        borrarSesion();
        window.localStorage.setItem(LLAVE_DEMO, "1");
        setEsDemo(true);
        setSesion(null);
        setUsuario(null);
        setCargando(false);
        return { ok: true };
      },

      async pedirResetContrasena(email) {
        if (!hayCuentas)
          return { ok: false, error: "Para recuperar la contraseña hace falta conectar la base de Supabase." };
        await mandar("/sesiones/recuperar", { email });
        return { ok: true };
      },

      // "anterior" es la contraseña de ahora, para cambiarla desde Mi perfil:
      // la API la comprueba. Desde el link del mail de recuperación no hay
      // anterior, y la API lo reconoce por cómo se abrió la sesión.
      async definirContrasena(nueva, { anterior } = {}) {
        if (!hayCuentas) return { ok: false, error: "No hay una sesión abierta." };
        const r = await mandar("/sesiones/contrasena",
          { contrasena: nueva, ...(anterior ? { contrasena_actual: anterior } : {}) }, sesion?.access_token);
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        const propia = leerSesion();
        if (propia) guardarSesion(null, { ...propia, recuperando: false });
        setRecuperando(false);
        return { ok: true };
      },

      async reenviarConfirmacion(email) {
        if (!hayCuentas) return { ok: false, error: "No hay una sesión abierta." };
        const r = await mandar("/cuentas/confirmacion", { email });
        return r.ok ? { ok: true } : { ok: false, error: r.error.mensaje };
      },

      // Los negocios de la cuenta (docs/multinegocio.md): uno por cada ficha
      // de equipo que tiene. Sin la 038 corrida la función no existe y da
      // ok: false; quien la usa sigue como antes, con el negocio activo.
      async misNegocios() {
        if (!hayCuentas) return { ok: false, error: "No hay una sesión abierta." };
        const r = await traer("/cuenta/negocios", sesion?.access_token);
        return r.ok ? { ok: true, negocios: r.datos.negocios ?? [] } : { ok: false, error: r.error.mensaje };
      },

      // Pasa la cuenta a otro de sus negocios. La base verifica que tenga
      // ficha ahí y copia el rol de esa ficha (038). Después se vuelve a leer
      // la fila de usuario, y con eso datos.js carga el negocio nuevo.
      async entrarAlNegocio(negocioId) {
        if (!hayCuentas) return { ok: false, error: "No hay una sesión abierta." };
        const r = await mandar("/cuenta/negocio", { negocio_id: negocioId }, sesion?.access_token);
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user, sesion.access_token));
        return { ok: true };
      },

      // El predeterminado y el Inicio rápido: valen para la cuenta, en todos
      // los dispositivos, por eso van a la base y no al navegador.
      async guardarPreferenciasDeEntrada({ predeterminado, inicioRapido }) {
        if (!hayCuentas) return { ok: false, error: "No hay una sesión abierta." };
        const r = await reemplazar("/cuenta/preferencias", {
          predeterminado: predeterminado ?? null,
          inicio_rapido: Boolean(inicioRapido),
        }, sesion?.access_token);
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user, sesion.access_token));
        return { ok: true };
      },

      // Guarda el perfil de quien entró (SCRUM-118): nombre, teléfono y foto,
      // y el nombre también en su ficha del equipo. Lo hace una función de la
      // base (034) en una sola operación, porque la ficha sólo la puede tocar
      // el dueño y el historial firma con ella. Después vuelve a leer la fila,
      // así todo lo que muestra el usuario queda al día.
      async guardarPerfil({ nombre, telefono, foto }) {
        if (!hayCuentas) return { ok: false, error: "No hay una sesión abierta." };
        const r = await reemplazar("/cuenta/perfil", { nombre, telefono, foto: foto ?? null }, sesion?.access_token);
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        if (sesion?.user) setUsuario(await traerUsuario(sesion.user, sesion.access_token));
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
        if (!hayCuentas) {
          return { ok: false, error: "Para usar una invitación hace falta conectar la base de Supabase." };
        }
        const r = await traer(`/publico/invitaciones/${encodeURIComponent(codigo)}`);
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        const fila = r.datos.invitacion;
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
        if (!hayCuentas) {
          return { ok: false, error: "Para usar una invitación hace falta conectar la base de Supabase." };
        }
        const r = await mandar(`/invitaciones/${encodeURIComponent(codigo)}/aceptar`, { nombre: nombre ?? null }, sesion?.access_token);
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        olvidarInvitacion();
        const refrescado = await traerUsuario(sesion.user, sesion.access_token);
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
    haySupabase: hayCuentas,
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
