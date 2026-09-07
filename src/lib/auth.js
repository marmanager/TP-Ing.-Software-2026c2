"use client";

// Sesión y cuentas (SCRUM-5).
//
// Dos modos, igual que la capa de datos:
//   - Con credenciales de Supabase: cuentas reales (email + contraseña).
//   - Sin credenciales: sólo el modo de ejemplo, que entra sin contraseña con
//     los datos de muestra del navegador. Así el equipo clona y levanta el
//     proyecto sin esperar a que alguien reparta las claves (ver README).
//
// El aislamiento por negocio con Row Level Security queda para el Sprint 2:
// hoy la clave anónima lee y escribe todo, y el negocio del usuario se
// resuelve del lado del cliente con la tabla `usuario`.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, haySupabase } from "./supabase";

const LLAVE_DEMO = "marmanager.demo.v1";
const LLAVE_MAIL = "marmanager.mail-a-confirmar";
const Contexto = createContext(null);

// A qué mail hay que confirmar. Se guarda al crear la cuenta, porque en ese
// momento todavía no hay sesión de donde sacarlo. Vive sólo en esta pestaña.
export function mailAConfirmar() {
  try {
    return window.sessionStorage.getItem(LLAVE_MAIL);
  } catch {
    return null;
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

  // Trae (o crea) la fila de `usuario` que liga la cuenta con su negocio.
  async function traerUsuario(user) {
    if (!user) return null;
    const sinBase = {
      id: user.id,
      email: user.email ?? null,
      telefono: user.user_metadata?.telefono ?? null,
      nombre: user.user_metadata?.nombre ?? null,
      negocio_id: null,
    };
    const { data, error } = await supabase
      .from("usuario")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return sinBase; // la tabla puede no existir todavía
    if (data) return data;
    await supabase.from("usuario").insert(sinBase);
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
      setUsuario(data.session ? await traerUsuario(data.session.user) : null);
      setCargando(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (evento, s) => {
      if (!vivo) return;
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
      setSesion(s ?? null);
      setUsuario(s ? await traerUsuario(s.user) : null);
      setCargando(false);
    });

    return () => {
      vivo = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const acciones = useMemo(
    () => ({
      // Devuelven { ok: true, ... } o { ok: false, error: "texto ya listo" }.

      async crearCuenta({ email, telefono, contrasena }) {
        if (!haySupabase)
          return {
            ok: false,
            error:
              "Para crear una cuenta hace falta conectar la base de Supabase. Mientras tanto podés entrar con los datos de ejemplo.",
          };
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: contrasena,
          options: { data: { telefono: telefono.trim() } },
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
        // La crea traerUsuario() en el primer ingreso, con el teléfono que
        // viaja en los datos de la cuenta.
        if (!data.session) {
          try {
            window.sessionStorage.setItem(LLAVE_MAIL, email.trim());
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
              "Para iniciar sesión hace falta conectar la base de Supabase. Mientras tanto podés entrar con los datos de ejemplo.",
          };
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: contrasena,
        });
        if (error) return { ok: false, error: traducir(error) };
        return { ok: true };
      },

      async cerrarSesion() {
        if (esDemo) {
          window.localStorage.removeItem(LLAVE_DEMO);
          setEsDemo(false);
          return { ok: true };
        }
        await supabase.auth.signOut();
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
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + "/nueva-contrasena",
        });
        // No decimos si el mail existe o no.
        return { ok: true };
      },

      async definirContrasena(nueva) {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        const { error } = await supabase.auth.updateUser({ password: nueva });
        if (error) return { ok: false, error: traducir(error) };
        setRecuperando(false);
        return { ok: true };
      },

      async reenviarConfirmacion(email) {
        if (!haySupabase) return { ok: false, error: "No hay una sesión de Supabase abierta." };
        const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
        if (error) return { ok: false, error: traducir(error) };
        return { ok: true };
      },

      // La usa "Crear negocio" (SCRUM-12) al volver de crear_mi_negocio().
      // El vínculo en la base ya lo dejó hecho esa función; acá sólo se
      // refresca lo que hay en pantalla, para no leer de nuevo.
      anotarNegocio(negocioId) {
        setUsuario((u) => (u ? { ...u, negocio_id: negocioId } : u));
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
    ...acciones,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth() {
  const v = useContext(Contexto);
  if (!v) throw new Error("useAuth tiene que usarse adentro de <AuthProvider>");
  return v;
}
