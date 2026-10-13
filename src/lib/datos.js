"use client";

// La capa de datos del front: lo que las pantallas leen y las acciones que
// cambian algo. Todo pasa por la API (src/lib/api.js), con la sesión de quien
// está usando el sistema; las reglas las decide la API y acá se refleja lo
// que contesta. Las pantallas no llaman a la API directo: usan estas
// funciones (pruebas/fronteras.test.js).

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { preset } from "./presets";
import { productoParaLaApi } from "./inventario";
import { sePuedeMarcarHecho } from "./estados";
import { normalizarInicio } from "./inicio";
import { respuestaDeLaApi, seguimientoDeLaApi } from "./seguimiento.js";
import { agendaDeLaApi } from "./horarios.js";
import { pagosEnLinea } from "./pagos.js";
import { API, mandar, nuevaClave, parchar, quitar, reemplazar, traer } from "./api.js";
import { turnoParaLaApi } from "./turnos.js";
import { reemplazarUnicoPorId, unicosPorId } from "./listas.js";
import { erroresSeguimiento, seguimientoParaLaApi } from "./seguimiento-whatsapp.js";
import {
  MEDIOS_DEL_LOCAL,
  MEDIOS_EN_LINEA,
  conCobro as ponerCobro,
  montoDeCobroValido,
  sePuedeAnular,
} from "./cobros.js";
import { mismaExpresion, nuevaEcuacion } from "./ecuaciones.js";

const VACIO = {
  negocio: null,
  empleados: [],
  clientes: [],
  casos: [],
  pasos: [],
  eventos: [],
  insumos: [],
  turnos: [],
  invitaciones: [],
  // Los cobros de cada caso (025). Un caso puede tener varios.
  cobros: [],
  // La foto de cada compañero de negocio que cargó una (034), como
  // [{ usuario_id, foto }]. Se cruza con empleado.usuario_id en Equipo.
  fotosEquipo: [],
  ecuaciones: [],
};

const Contexto = createContext(null);

const nuevoId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id" + Math.random().toString(36).slice(2);

// Buscar un caso compartido, desde afuera del sistema.
//
// Es una función suelta y no una acción del proveedor a propósito: la
// pantalla pública no tiene sesión, ni negocio, ni nada del contexto que
// useDatos() necesita. Quien la abre no es del negocio.
//
// Si la API no contesta, se dice eso: el link puede andar en un rato, y
// decir que "ya no sirve" sería mentira.
export async function buscarSeguimiento(codigo) {
  if (!API) return { sirve: false };
  const s = seguimientoDeLaApi(await traer(`/publico/seguimiento/${encodeURIComponent(codigo)}`));
  if (s.sirve) return s;
  return s.problema ? { sirve: false, problema: s.problema } : { sirve: false };
}

// La respuesta del cliente a un paso del presupuesto, desde el link
// (SCRUM-68, segunda parte).
//
// Va al lado de buscarSeguimiento() y por el mismo motivo: quien contesta no
// tiene sesión ni negocio, así que no puede pasar por el proveedor.
//
// Devuelve { ok } o { ok: false, motivo }. El motivo está escrito para el
// cliente y se muestra tal cual.
export async function responderDesdeElLink(codigo, pasoId, respuesta) {
  if (!API) return { ok: false, motivo: "Por ahora no se puede contestar desde acá. Hablá con el negocio." };
  return respuestaDeLaApi(await mandar(
    `/publico/seguimiento/${encodeURIComponent(codigo)}/pasos/${encodeURIComponent(pasoId)}/respuesta`,
    { respuesta }
  ));
}

// Los horarios de un negocio y sus turnos tomados, desde afuera del sistema.
//
// Suelta y no acción del proveedor, igual que buscarSeguimiento(): quien abre
// el link de la agenda no tiene sesión ni negocio. La agenda viene de la API
// con los huecos ya armados (agendaDeLaApi). Si la API no contesta, se dice
// eso y no "el link no sirve", que sería mentira.
export async function buscarAgenda(codigo) {
  if (!API) return { sirve: false };
  const r = await traer(`/publico/agenda/${encodeURIComponent(codigo)}`);
  if (r.ok) return agendaDeLaApi(r.datos);
  if (r.error.codigo !== "agenda_no_encontrada") return { sirve: false, problema: r.error.mensaje };
  return { sirve: false };
}

// Pedir el turno. Devuelve { ok } o { ok: false, motivo }, con el motivo
// escrito para que el cliente lo lea tal cual. La que decide si ese horario
// se puede pedir es la API.
export async function reservarTurno({ codigo, cuando, motivo, nombre, telefono }) {
  if (!API) return { ok: false, motivo: "Por ahora no se puede pedir turno desde acá. Llamá al negocio." };
  const r = await mandar(`/publico/agenda/${encodeURIComponent(codigo)}/turnos`, {
    empieza_en: new Date(cuando).toISOString(),
    motivo,
    nombre,
    telefono: telefono || null,
  });
  if (r.ok) return { ok: true, cuando: r.datos.cuando, minutos: r.datos.minutos };
  return { ok: false, motivo: r.error.mensaje };
}

// Un negocio guardado antes de que existieran los módulos no trae la lista.
// En ese caso valen los del preset de su rubro: si dejáramos la lista vacía,
// la navegación se quedaría sin secciones de golpe.
//
// Una lista vacía de verdad sí se respeta: es alguien que apagó todo a mano,
// y siempre puede volver a prenderlos desde "Mi negocio".
const conModulos = (negocio) =>
  negocio && !Array.isArray(negocio.modulos_activos)
    ? { ...negocio, modulos_activos: preset(negocio.rubro).modulos ?? [] }
    : negocio;

export function DatosProvider({ children }) {
  const { usuario, sesion, cargando: authCargando } = useAuth();
  const [datos, setDatos] = useState(VACIO);
  const [cargando, setCargando] = useState(true);
  // Sube de a uno para pedir que se vuelva a leer todo. No guarda datos: es
  // la manera de volver a correr el efecto de carga sin escribir la lectura
  // dos veces, una para entrar y otra para refrescar.
  const [refresco, setRefresco] = useState(0);
  const [aviso, setAviso] = useState(null);
  // Confirmamos con el dato que la persona acaba de escribir, así sabe que
  // guardó lo correcto (cartilla, sección 07).
  const [exito, setExito] = useState(null);
  // Lo que deshace la acción que se acaba de confirmar, si se puede deshacer.
  // Vive mientras el aviso esté en pantalla: el "Deshacer" está donde ocurrió
  // la acción, no en un menú (auditoría, H3).
  const [deshacerExito, setDeshacerExito] = useState(null);
  // De qué negocio es lo que hay en pantalla. Al cambiar de negocio, hasta
  // tener el nuevo se muestra "cargando" y no lo del anterior.
  const cargadoDe = useRef(null);
  // Si desde otro dispositivo la cuenta pasó a otro negocio (o la sacaron de
  // éste): { nombre } del nuevo, o nombre null. Ver docs/multinegocio.md.
  const [otroNegocio, setOtroNegocio] = useState(null);

  // Carga inicial. Corre sólo en el navegador, así no hay diferencia entre
  // lo que renderiza el servidor y lo que renderiza el cliente. Espera a que
  // la sesión resuelva.
  useEffect(() => {
    let vivo = true;
    if (authCargando) {
      return () => {
        vivo = false;
      };
    }

    (async () => {
      // Sin entrar: no hay nada que cargar. La Guardia manda a iniciar sesión.
      if (!usuario) {
        if (!vivo) return;
        cargadoDe.current = null;
        setOtroNegocio(null);
        setDatos(VACIO);
        setCargando(false);
        return;
      }

      // Cuenta todavía sin negocio: la Guardia manda a crearlo.
      if (!usuario.negocio_id) {
        if (!vivo) return;
        cargadoDe.current = null;
        setOtroNegocio(null);
        setDatos(VACIO);
        setCargando(false);
        return;
      }

      // Cuenta con negocio: se lee de la API, sólo lo de ese negocio.
      if (cargadoDe.current !== usuario.negocio_id) setCargando(true);
      try {
        const r = await traer("/datos", sesion?.access_token);
        if (!r.ok) throw new Error(r.error.mensaje);
        const traido = {
          ...r.datos,
          casos: unicosPorId(r.datos.casos),
          negocio: conModulos(r.datos.negocio),
        };
        if (!vivo) return;
        if (traido.negocio) {
          cargadoDe.current = usuario.negocio_id;
          setOtroNegocio(null);
          setDatos(traido);
            setCargando(false);
          return;
        }

        // La base ya no deja ver este negocio. Si es porque la cuenta está en
        // otro —se cambió desde otro dispositivo— o porque la sacaron, lo
        // que hay en pantalla queda, con un cartel para recargar: cambiar
        // solo podría llevarse algo que se estaba escribiendo. Mientras
        // tanto la base rechaza lo que se intente guardar acá.
        // Si la API falla, se sigue como si no hubiera respuesta: el aviso
        // genérico de abajo, o el cartel sin el nombre del negocio.
        const cuenta = await traer("/cuenta", sesion?.access_token);
        if (!vivo) return;
        const ahora = cuenta.ok ? cuenta.datos.usuario : null;
        if (ahora && ahora.negocio_id !== usuario.negocio_id) {
          // /cuenta/negocios devuelve las filas de mis_negocios en { negocios }.
          const suyos = await traer("/cuenta/negocios", sesion?.access_token);
          if (!vivo) return;
          setOtroNegocio({
            nombre: suyos.ok
              ? suyos.datos.negocios?.find((n) => n.id === ahora.negocio_id)?.nombre ?? null
              : null,
          });
          setCargando(false);
          return;
        }

        setAviso(
          "Tu negocio todavía no aparece en la base. Esperá unos segundos y volvé a entrar."
        );
        setDatos(VACIO);
        setCargando(false);
      } catch {
        if (!vivo) return;
        setAviso(
          "No se pudo leer el servidor. Fijate la conexión y volvé a entrar."
        );
        setDatos(VACIO);
        setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [authCargando, usuario, sesion?.access_token, refresco]);

  // Volver a leer cuando la pestaña vuelve al frente.
  //
  // Los datos se leían una sola vez, al entrar. Con los turnos que pide el
  // cliente por el link (024) eso dejó de alcanzar: el turno lo crea otra
  // persona, en otro navegador, y del lado del negocio la pantalla seguía
  // mostrando lo de hace dos horas sin ninguna señal de estar vieja.
  //
  // "visibilitychange" y no un reloj que pregunta cada tanto: el momento en
  // que a alguien le importa que esté al día es cuando vuelve a mirar. Un
  // intervalo gastaría pedidos toda la tarde con la pestaña de fondo, y
  // seguiría llegando tarde justo cuando la persona vuelve.
  //
  // ponytail: refresco al volver el foco, no en vivo. Si hiciera falta que un
  // turno aparezca sin tocar nada, el camino es Supabase Realtime sobre la
  // tabla "turno".
  useEffect(() => {
    if (typeof document === "undefined") return;
    const alVolver = () => {
      if (document.visibilityState === "visible") setRefresco((n) => n + 1);
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  const acciones = useMemo(() => {
    // La sesión de quien está usando el sistema: la API actúa como esa persona.
    const tokenDeSesion = async () => sesion?.access_token ?? null;

    // Para los cambios que ya se ven en pantalla antes de que conteste la API
    // (sumar uno, escribir la cantidad, borrar): se mandan por atrás, y si la
    // API dice que no, se avisa con su mensaje y se vuelve a leer todo, para
    // que la pantalla no quede mostrando algo que no pasó. Un 409 "choque"
    // (otro lo cambió mientras tanto) es eso mismo: aviso y lo último.
    //
    // "alSalir" recibe lo que contestó la API: la fila como quedó, con su
    // actualizado_en nuevo, para que el próximo cambio no choque contra uno
    // propio.
    const enLaApi = async (pedir, alSalir) => {
      const r = await pedir(await tokenDeSesion());
      if (r.ok) return alSalir?.(r.datos);
      setAviso(r.error.mensaje);
      setRefresco((n) => n + 1);
    };

    // La versión que se ve en pantalla (actualizado_en). Con ella la API sabe
    // si otro cambió la fila mientras tanto (409); sin ella, escribe igual.
    const version = (lista, id) => lista.find((x) => x.id === id)?.actualizado_en;
    const ponerFila = (lista, fila) => lista.map((x) => (x.id === fila.id ? fila : x));
    const ponerNegocio = (negocio) => setDatos((d) => ({ ...d, negocio: conModulos(negocio) }));
    // La base cambió el negocio (un código, los horarios) y la API no lo
    // devuelve entero: no se sabe su actualizado_en nuevo, así que el próximo
    // cambio va sin versión en vez de chocar contra uno propio.
    const sinVersionDelNegocio = (cambios) =>
      setDatos((d) => ({ ...d, negocio: { ...d.negocio, ...cambios, actualizado_en: undefined } }));

    const incorporarCasoApi = ({ caso, cliente, turno, evento, eventos = [] }) => setDatos((d) => ({
      ...d,
      casos: caso ? reemplazarUnicoPorId(d.casos, caso) : unicosPorId(d.casos),
      clientes: cliente ? (d.clientes.some((x) => x.id === cliente.id)
        ? d.clientes.map((x) => x.id === cliente.id ? cliente : x) : [...d.clientes, cliente]) : d.clientes,
      turnos: turno ? d.turnos.map((x) => x.id === turno.id ? turno : x) : d.turnos,
      eventos: [...(evento ? [evento] : []), ...eventos, ...d.eventos],
    }));

    const llamarCasos = async (ruta, cuerpo, { metodo = "POST", idempotencia } = {}) => {
      const token = await tokenDeSesion();
      const opciones = { token, ...(idempotencia ? { idempotencia } : {}) };
      return metodo === "PATCH" ? parchar(ruta, cuerpo, token)
        : metodo === "DELETE" ? quitar(ruta, token)
          : mandar(ruta, cuerpo, token, opciones);
    };

    return {
      ecuaciones: datos.ecuaciones ?? [],
      async crearEcuacion(form) {
        const creada = nuevaEcuacion(form);
        if (creada.error) return { ok: false, error: creada.error, campo: creada.campo };
        const duplicada = datos.ecuaciones?.find((e) => mismaExpresion(e.formula, creada.ecuacion.formula));
        if (duplicada && !form.confirmarVariante) {
          return { ok: false, duplicada: true };
        }
        const r = await mandar("/ecuaciones", {
          ...creada.ecuacion,
          confirmar_variante: Boolean(form.confirmarVariante),
        }, await tokenDeSesion(), { idempotencia: nuevaClave() });
        if (!r.ok) {
          if (r.error.codigo === "ecuacion_duplicada") return { ok: false, duplicada: true };
          return { ok: false, error: r.error.mensaje, campo: r.error.campo };
        }
        setDatos((d) => ({ ...d, ecuaciones: [r.datos.ecuacion, ...(d.ecuaciones ?? [])] }));
        return { ok: true, ecuacion: r.datos.ecuacion };
      },
      async editarEcuacion(id, form) {
        const editada = nuevaEcuacion(form);
        if (editada.error) return { ok: false, error: editada.error, campo: editada.campo };
        const duplicada = datos.ecuaciones?.find((e) => e.id !== id && mismaExpresion(e.formula, editada.ecuacion.formula));
        if (duplicada && !form.confirmarVariante) return { ok: false, duplicada: true };
        const r = await parchar(`/ecuaciones/${encodeURIComponent(id)}`, {
          ...editada.ecuacion,
          confirmar_variante: Boolean(form.confirmarVariante),
        }, await tokenDeSesion());
        if (!r.ok) {
          if (r.error.codigo === "ecuacion_duplicada") return { ok: false, duplicada: true };
          return { ok: false, error: r.error.mensaje, campo: r.error.campo };
        }
        setDatos((d) => ({ ...d, ecuaciones: ponerFila(d.ecuaciones ?? [], r.datos.ecuacion) }));
        return { ok: true, ecuacion: r.datos.ecuacion };
      },
      async eliminarEcuacion(id) {
        const r = await quitar(`/ecuaciones/${encodeURIComponent(id)}`, await tokenDeSesion());
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        setDatos((d) => ({ ...d, ecuaciones: (d.ecuaciones ?? []).filter((e) => e.id !== id) }));
        return { ok: true };
      },
      // ---------- casos ----------
      // Devuelve el caso creado para que la pantalla de alta pueda navegar a él.
      async abrirCaso({
        clienteId,
        nombreCliente,
        telefono,
        servicio,
        identificador,
        responsableId,
        turnoId = null,
      }) {
        const r = await llamarCasos("/casos", {
          servicio, identificador: identificador || null, responsable_id: responsableId || null,
          turno_id: turnoId, ...(clienteId
            ? { cliente_id: clienteId, telefono: telefono || null }
            : { cliente: { nombre: nombreCliente, telefono: telefono || null } }),
        }, { idempotencia: nuevaClave() });
        if (!r.ok) { setAviso(r.error.mensaje); return null; }
        incorporarCasoApi(r.datos);
        return r.datos.caso;
      },

      async asignarResponsable(casoId, empleadoId) {
        const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/asignar`, { responsable_id: empleadoId });
        if (!r.ok) return setAviso(r.error.mensaje);
        incorporarCasoApi(r.datos); return r.datos.caso;
      },

      // ---------- diagnóstico e identificador (SCRUM-50 y SCRUM-51) ----------
      // "servicio" es lo que pidió el cliente; "diagnostico" es lo que se
      // encontró al revisar. Son dos cosas distintas y las dos quedan.
      async cargarDiagnostico(casoId, diagnostico) {
        const actual = datos.casos.find((c) => c.id === casoId);
        const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}`, { diagnostico, actualizado_en: actual?.actualizado_en }, { metodo: "PATCH" });
        if (!r.ok) return setAviso(r.error.mensaje);
        incorporarCasoApi(r.datos); return r.datos.caso;
      },

      // Cambiar el identificador también va al historial. Es el dato por el
      // que se busca el caso: si alguien lo cambia y no queda rastro, quien
      // lo buscaba por el anterior no tiene dónde enterarse. Por eso el
      // valor viejo va en el detalle y no se pierde.
      async ponerIdentificador(casoId, identificador) {
        const actual = datos.casos.find((c) => c.id === casoId);
        const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}`, { identificador, actualizado_en: actual?.actualizado_en }, { metodo: "PATCH" });
        if (!r.ok) return setAviso(r.error.mensaje);
        incorporarCasoApi(r.datos); return r.datos.caso;
      },

      // Editar el caso (SCRUM-119): el nombre y lo que pidió el cliente. Los
      // dos juntos y en una sola escritura, porque en la pantalla son un solo
      // "Guardar". Cada cambio queda en el historial, como la patente.
      async editarCaso(casoId, { nombre, servicio }) {
        const caso = datos.casos.find((c) => c.id === casoId);
        if (!caso) return;
        const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}`, {
          nombre: nombre.trim() || null, servicio: servicio.trim(), actualizado_en: caso.actualizado_en,
        }, { metodo: "PATCH" });
        if (!r.ok) return setAviso(r.error.mensaje);
        incorporarCasoApi(r.datos); return r.datos.caso;
      },

      // Una nota suelta en el historial (SCRUM-52). No pisa nada: el
      // historial se agrega, nunca se reescribe.
      async anotarNota(casoId, texto) {
        const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/notas`, { texto }, { idempotencia: nuevaClave() });
        if (!r.ok) return setAviso(r.error.mensaje);
        incorporarCasoApi({ evento: r.datos }); return r.datos;
      },

      // "tambien" son columnas del caso que ese mismo cambio de estado deja
      // escritas. Hoy la usa una sola pantalla: al entregar se registra el
      // cobro (SCRUM-74), y cerrar y cobrar son una sola cosa para el negocio.
      // Va acá y no en una función aparte para que sea una sola escritura a la
      // base: dos dejarían el caso cerrado y sin cobro si la segunda falla.
      //
      // Entregar es un cambio de estado, pero en el historial va aparte: es
      // lo que más se quiere contar ("cuándo terminan", dice SCRUM-75).
      // Mover el caso de estado desde el desplegable, o reabrirlo si estaba
      // entregado. Entregar no pasa por acá: es cobrar y cerrar en un gesto,
      // y tiene su acción (entregarCaso).
      async cambiarEstado(casoId, estado, { notificarCliente = false } = {}) {
        const ruta = datos.casos.find((c) => c.id === casoId)?.estado === "completado"
          ? `/casos/${encodeURIComponent(casoId)}/reabrir` : `/casos/${encodeURIComponent(casoId)}/estado`;
        const r = await llamarCasos(ruta, ruta.endsWith("/estado")
          ? { estado, notificar_cliente: Boolean(notificarCliente) } : {});
        if (!r.ok) return setAviso(r.error.mensaje);
        incorporarCasoApi(r.datos);
        if (r.datos.notificacion?.estado === "fallido") {
          setAviso("El estado se cambió, pero no pudimos enviar el aviso por WhatsApp.");
        } else if (r.datos.notificacion) {
          setDeshacerExito(null);
          setExito(r.datos.notificacion.estado === "enviado"
            ? "Listo, se cambió el estado y se le avisó al cliente por WhatsApp."
            : "Listo, se cambió el estado y el aviso por WhatsApp quedó pendiente de envío.");
        }
        return r.datos.caso;
      },

      // ---------- cobros (025) ----------
      //
      // Anotar un pago que ya pasó en el local: efectivo, transferencia o
      // tarjeta. Nace pagado. Un caso puede tener varios (una seña y el
      // resto), y caso.cobrado pasa a ser la suma: en la base lo mantiene un
      // trigger, acá lo recalcula conCobro() con la misma cuenta.
      //
      // Los cobros por link o QR no pasan por acá: los pide la API de pagos
      // y los marca pagados ella, cuando el medio de pago confirma.
      async registrarCobro({ casoId, monto, medio, nota = null }) {
        const caso = datos.casos.find((c) => c.id === casoId);
        if (!caso) return { ok: false, error: "Ese caso ya no está." };
        if (!montoDeCobroValido(String(monto ?? ""))) {
          return { ok: false, error: "El monto va con números, sin puntos, y mayor que cero." };
        }
        if (!MEDIOS_DEL_LOCAL.includes(medio)) {
          return { ok: false, error: "Los cobros por link o QR se piden desde el sistema de pagos." };
        }

        const r = await mandar(`/casos/${encodeURIComponent(casoId)}/cobros`, {
          monto: Number(monto), medio, nota,
        }, await tokenDeSesion(), { idempotencia: nuevaClave() });
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        const nuevo = r.datos.cobro ?? r.datos;
        setDatos((d) => ponerCobro(d, nuevo));
        if (r.datos.evento) setDatos((d) => ({ ...d, eventos: [r.datos.evento, ...d.eventos] }));
        return { ok: true, cobro: nuevo };
      },

      // Lo que no se le cobra: un descuento, una cortesía, una garantía. Va
      // en el caso y no como cobro, porque no es plata que entra. "monto" es
      // el descuento total que queda (0 lo saca).
      async cambiarDescuento(casoId, monto, { antes = 0 } = {}) {
        const nuevo = Math.max(0, Number(monto) || 0);
        const r = await reemplazar(`/casos/${encodeURIComponent(casoId)}/descuento`, { monto: nuevo }, await tokenDeSesion());
        if (!r.ok) { setAviso(r.error.mensaje); return { ok: false, error: r.error.mensaje }; }
        setDatos((d) => ({ ...d, casos: d.casos.map((c) => c.id === casoId ? r.datos.caso ?? r.datos : c) }));
        if (r.datos.evento) setDatos((d) => ({ ...d, eventos: [r.datos.evento, ...d.eventos] }));
        return { ok: true };
      },

      // ---------- pagos por link o QR (la API de pagos) ----------
      //
      // Si se pueden pedir pagos por link o QR (hace falta la API). Lo lee la
      // pantalla para decidir si ofrece el botón o lo muestra apagado con el
      // motivo.
      pagosEnLinea: pagosEnLinea(),

      async estadoMercadoPago() {
        const token = await tokenDeSesion();
        if (!token) return { ok: false, error: "Tu sesión venció. Volvé a entrar y probá de nuevo." };
        const r = await traer("/cobros/mercadopago/status", token);
        return r.ok ? { ok: true, conectado: Boolean(r.datos?.conectado) }
          : { ok: false, error: r.error.mensaje };
      },

      async conectarMercadoPago() {
        const token = await tokenDeSesion();
        if (!token) return { ok: false, error: "Tu sesión venció. Volvé a entrar y probá de nuevo." };
        const r = await mandar("/cobros/mercadopago/conectar", {}, token);
        return r.ok ? { ok: true, url: r.datos.url } : { ok: false, error: r.error.mensaje };
      },

      async desvincularMercadoPago() {
        const token = await tokenDeSesion();
        if (!token) return { ok: false, error: "Tu sesión venció. Volvé a entrar y probá de nuevo." };
        const r = await quitar("/cobros/mercadopago/vinculacion", token);
        return r.ok ? { ok: true } : { ok: false, error: r.error.mensaje };
      },

      async conciliarCobrosMercadoPago(casoId) {
        const token = await tokenDeSesion();
        if (!token) return { ok: false, error: "Tu sesión venció. Volvé a entrar y probá de nuevo." };
        const r = await mandar(`/casos/${encodeURIComponent(casoId)}/cobros/conciliar`, {}, token);
        return r.ok ? { ok: true, ...r.datos } : { ok: false, error: r.error.mensaje };
      },

      // Pedir un pago: la API arma el link o el QR y guarda el cobro
      // "pendiente". Pasa a pagado sólo cuando el medio de pago le avisa a la
      // API; acá nunca.
      async pedirCobroEnLinea({ casoId, monto, medio }) {
        const caso = datos.casos.find((c) => c.id === casoId);
        if (!caso) return { ok: false, error: "Ese caso ya no está." };
        if (!montoDeCobroValido(String(monto ?? ""))) {
          return { ok: false, error: "El monto va con números, sin puntos, y mayor que cero." };
        }
        if (!MEDIOS_EN_LINEA.includes(medio)) return { ok: false, error: "Elegí link o QR." };

        if (!pagosEnLinea().disponible) return { ok: false, error: "Todavía no está conectado el sistema de pagos." };

        const token = await tokenDeSesion();
        if (!token) return { ok: false, error: "Tu sesión venció. Volvé a entrar y probá de nuevo." };
        const r = await mandar(`/casos/${encodeURIComponent(casoId)}/cobros/en-linea`, {
          monto: Number(monto), medio,
        }, token, { idempotencia: nuevaClave() });
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        const nuevo = r.datos.cobro;
        setDatos((d) => ponerCobro(d, nuevo));
        // El renglón del historial lo anota la API y lo devuelve.
        if (r.datos.evento) setDatos((d) => ({ ...d, eventos: [r.datos.evento, ...d.eventos] }));
        return { ok: true, cobro: nuevo };
      },

      // Volver a leer los cobros de un caso: lo que cambió del otro lado
      // (un pago que entró por link) no llega solo. Devuelve los que pasaron
      // a pagado desde la última vez, para que la pantalla lo pueda contar.
      async refrescarCobros(casoId) {
        const r = await traer(`/casos/${encodeURIComponent(casoId)}/cobros`, await tokenDeSesion());
        if (!r.ok) return { ok: false, pagados: [] };
        const nuevos = r.datos ?? [];
        const antes = new Map(datos.cobros.filter((c) => c.caso_id === casoId).map((c) => [c.id, c.estado]));
        const pagados = nuevos.filter((c) => c.estado === "pagado" && antes.get(c.id) === "pendiente");
        setDatos((d) => nuevos.reduce(
          (actual, cobro) => ponerCobro(actual, cobro),
          { ...d, cobros: d.cobros.filter((c) => c.caso_id !== casoId) }
        ));
        return { ok: true, pagados };
      },

      // Corregir un cobro mal anotado. No se borra: queda anulado, y el
      // historial dice quién y por qué. Un pago por link que ya entró no se
      // anula: se devuelve desde el medio de pago.
      async anularCobro(cobroId, motivo = null) {
        const cobro = datos.cobros.find((c) => c.id === cobroId);
        if (!cobro) return { ok: false, error: "Ese cobro ya no está." };
        if (!sePuedeAnular(cobro)) {
          return {
            ok: false,
            error:
              cobro.estado === "pagado"
                ? "Ese pago ya entró por el medio de pago. Para devolverlo, hay que hacerlo desde ahí."
                : "Ese cobro ya no cuenta: no hay nada que anular.",
          };
        }

        // Si era un pedido por link o QR, la API además lo da de baja en el
        // medio de pago: si no, el cliente todavía podría pagarlo.
        const r = await mandar(`/cobros/${encodeURIComponent(cobroId)}/anular`, { motivo },
          await tokenDeSesion(), { idempotencia: nuevaClave() });
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        const anulado = r.datos.cobro;
        setDatos((d) => ponerCobro(d, anulado));
        if (r.datos.evento) setDatos((d) => ({ ...d, eventos: [r.datos.evento, ...d.eventos] }));
        return { ok: true, cobro: anulado };
      },

      // El mensaje de seguimiento por WhatsApp que se manda al entregar.
      async consultarSeguimiento() {
        const r = await traer("/negocio/seguimiento", await tokenDeSesion());
        return r.ok ? { ok: true, configuracion: r.datos } : { ok: false, error: r.error.mensaje };
      },

      async configurarSeguimiento(cambios) {
        const r = await parchar("/negocio/seguimiento", cambios, await tokenDeSesion());
        return r.ok ? { ok: true, configuracion: r.datos } : { ok: false, error: r.error.mensaje };
      },

      // Entregar: cobrar y cerrar en un gesto. La API guarda cobro,
      // descuento, cierre e historial en la misma transacción.
      async entregarCaso({ casoId, monto, medio, resto, seguimiento }) {
        const error = Object.values(erroresSeguimiento(seguimiento))[0];
        if (error) return { ok: false, error };
        const r = await mandar(`/casos/${encodeURIComponent(casoId)}/entregar`, {
          monto: monto == null ? null : Number(monto),
          medio: Number(monto) > 0 ? medio : null,
          resto,
          ...seguimientoParaLaApi(seguimiento),
        }, await tokenDeSesion(), { idempotencia: nuevaClave() });
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        setDatos((d) => {
          let siguiente = { ...d, casos: d.casos.map((c) => c.id === casoId ? r.datos.caso : c) };
          if (r.datos.cobro) siguiente = ponerCobro(siguiente, r.datos.cobro);
          if (r.datos.evento) siguiente = { ...siguiente, eventos: [r.datos.evento, ...siguiente.eventos] };
          return siguiente;
        });
        const avisos = [];
        if (seguimiento?.enviar && !r.datos.seguimiento) {
          avisos.push("El caso se cerró, pero no se programó el mensaje: el seguimiento está desactivado en el negocio.");
        } else if (r.datos.seguimiento?.estado === "fallido") {
          avisos.push("El caso se cerró, pero no pudimos enviar el mensaje de seguimiento por WhatsApp.");
        }
        // El borrador conserva el texto guardado al abrir el formulario. Sólo
        // actualizamos el predeterminado después de usarlo en un cierre confirmado.
        if (seguimiento?.enviar && r.datos.seguimiento
          && typeof seguimiento.mensajeGuardado === "string"
          && seguimiento.mensaje.trim() !== seguimiento.mensajeGuardado.trim()) {
          const actualizado = await parchar("/negocio/seguimiento", {
            mensaje: seguimiento.mensaje.trim(),
          }, await tokenDeSesion());
          if (!actualizado.ok) {
            avisos.push(`El caso se cerró, pero no pudimos guardar el mensaje para los próximos casos. ${actualizado.error.mensaje}`);
          }
        }
        if (avisos.length) setAviso(avisos.join(" "));
        return { ok: true, ...r.datos };
      },

      // Marcar que un paso aprobado ya se hizo, o desmarcarlo (flujo, 7).
      //
      // "estado" dice qué contestó el cliente y "hecho_en" qué hizo el
      // negocio: marcar no toca la respuesta del cliente, que sigue siendo
      // un acuerdo cerrado.
      //
      // Marcar algo ya marcado no hace nada y no escribe un evento repetido:
      // dos dedos sobre el mismo botón no pueden mover la hora en que se
      // terminó el trabajo ni llenar el historial de líneas iguales.
      //
      // Con la base conectada pasa por marcar_paso_hecho(), que es lo que le
      // deja hacer esto al técnico: 008_permisos.sql no lo deja tocar la
      // tabla "paso" —mover plata es del dueño y del encargado— y marcar el
      // propio trabajo no es mover plata (021_paso_hecho.sql).
      async marcarPasoHecho(pasoId, hecho) {
        const paso = datos.pasos.find((p) => p.id === pasoId);
        if (!paso) return { ok: false, error: "Ese paso ya no está en el presupuesto." };

        const caso = datos.casos.find((c) => c.id === paso.caso_id);
        if (!sePuedeMarcarHecho(paso, caso)) {
          return {
            ok: false,
            error:
              caso?.estado === "completado"
                ? "El caso ya se entregó. Volvé a abrirlo si hay algo que corregir."
                : "Sólo se marca lo que el cliente aprobó.",
          };
        }

        // Ya estaba como se lo quiere dejar: no hay nada que escribir.
        if (Boolean(paso.hecho_en) === Boolean(hecho)) return { ok: true, cambio: false };

        const r = await llamarCasos(`/pasos/${encodeURIComponent(pasoId)}/hecho`, { hecho: Boolean(hecho) });
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        setDatos((d) => ({ ...d,
          pasos: d.pasos.map((x) => x.id === pasoId ? r.datos.paso : x),
          eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos,
        }));
        return { ok: true, cambio: r.datos.cambio };
      },

      // ---------- compartir el estado con el cliente (SCRUM-68) ----------
      // Devuelve siempre el mismo código para el mismo caso. Tocar
      // "Compartir" dos veces no puede invalidar el link que el negocio ya
      // mandó por WhatsApp.
      //
      // Mandar el link es pasarle la pelota al cliente, así que el caso queda
      // esperando su respuesta. Si no, el tablero seguiría diciendo que el
      // trabajo avanza mientras en realidad no se puede hacer nada hasta que
      // conteste, y "A aprobar" no lo mostraría.
      //
      // Son dos escrituras y no una: el código lo genera la base con su
      // propia función, y el estado va por el camino de siempre, con sus
      // permisos y su evento en el historial. Si la segunda fallara, el link
      // ya anda y el estado se puede mover a mano.
      async compartirCaso(casoId) {
        const caso = datos.casos.find((c) => c.id === casoId);
        if (!caso) return { ok: false, error: "No encontramos ese caso." };
        if (caso.seguimiento_codigo) return { ok: true, codigo: caso.seguimiento_codigo };

        const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/compartir`, {});
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        incorporarCasoApi(r.datos);
        return { ok: true, codigo: r.datos.codigo, quedaEsperando: r.datos.queda_esperando };
      },

      // El link anterior deja de funcionar en el mismo momento. La fecha de
      // la última visita se va con él: es de ese link, no del caso.
      async dejarDeCompartirCaso(casoId) {
        const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/dejar-de-compartir`, {});
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        setDatos((d) => ({ ...d, casos: d.casos.map((c) => c.id === casoId
          ? { ...c, seguimiento_codigo: null, seguimiento_visto_en: null } : c) }));
        return { ok: true };
      },

      // ---------- pasos del presupuesto ----------
      // Armar el presupuesto es sumar pasos de a uno (SCRUM-59). Cada paso
      // nace esperando la respuesta del cliente: el presupuesto se aprueba
      // parte por parte, nunca todo junto.
      async agregarPaso({ casoId, nombre, descripcion, monto }) {
        const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/pasos`,
          { nombre, descripcion: descripcion || null, monto: Number(monto) }, { idempotencia: nuevaClave() });
        if (!r.ok) { setAviso(r.error.mensaje); return null; }
        setDatos((d) => ({ ...d, pasos: [...d.pasos, r.datos.paso],
          eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos }));
        return r.datos.paso;
      },

      // Sólo se borra lo que todavía está esperando respuesta. Un rechazado
      // primero vuelve a esperar respuesta; uno aprobado no se borra nunca,
      // porque es un acuerdo con el cliente (015_paso_aprobado_fijo.sql).
      async eliminarPaso(pasoId) {
        const paso = datos.pasos.find((p) => p.id === pasoId);
        if (!paso || paso.estado !== "esperando") return;

        const r = await llamarCasos(`/pasos/${encodeURIComponent(pasoId)}`, undefined, { metodo: "DELETE" });
        if (!r.ok) return setAviso(r.error.mensaje);
        setDatos((d) => ({ ...d, pasos: d.pasos.filter((p) => p.id !== pasoId),
          eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos }));
        return r.datos.id;
      },

      // Aprobar, rechazar y volver a esperar respuesta escriben los tres en
      // la base, así sobreviven a un F5 en vez de vivir sólo en memoria.
      //
      // Lo que el cliente aprobó ya no se cambia: es un acuerdo. Lo rechazado
      // sí puede volver a esperar respuesta, porque el cliente puede cambiar
      // de idea sobre algo que no había aceptado. La base lo hace cumplir
      // también (015_paso_aprobado_fijo.sql).
      //
      // "aprobado_en" es cuándo dijo que sí. Como no se deshace, el
      // historial suma con eso la plata aprobada en un período.
      async responderPaso(pasoId, estado) {
        const paso = datos.pasos.find((p) => p.id === pasoId);
        if (!paso || paso.estado === "aprobado") return;

        const r = await llamarCasos(`/pasos/${encodeURIComponent(pasoId)}/responder`, { estado });
        if (!r.ok) return setAviso(r.error.mensaje);
        setDatos((d) => ({ ...d, pasos: d.pasos.map((p) => p.id === pasoId ? r.datos.paso : p),
          eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos }));
        return r.datos.paso;
      },

      // ---------- inventario ----------
      // Llegó lo que se había pedido. El caso se destraba SÓLO si ya no le
      // falta nada: la regla vive en alLlegarInsumo() (estados.js), que tiene
      // prueba. Antes se pasaba a "en proceso" siempre, aunque faltara otra
      // pieza o el caso estuviera cerrado.
      async marcarInsumoLlegado(insumoId) {
        const insumo = datos.insumos.find((i) => i.id === insumoId);
        if (!insumo) return null;
        const r = await llamarCasos(`/insumos/${encodeURIComponent(insumoId)}/llego`, {}, { idempotencia: nuevaClave() });
        if (!r.ok) { setAviso(r.error.mensaje); return null; }
        setDatos((d) => ({ ...d,
          insumos: r.datos.sumado ? d.insumos.filter((i) => i.id !== insumoId).map((i) => i.id === r.datos.insumo.id ? r.datos.insumo : i)
            : d.insumos.map((i) => i.id === insumoId ? r.datos.insumo : i),
          casos: r.datos.caso ? d.casos.map((c) => c.id === r.datos.caso.id ? r.datos.caso : c) : d.casos,
          eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos,
        }));
        return r.datos.despues;
      },

      // Pedir algo para un caso, o para reponer el stock (SCRUM-113).
      //
      // Es la mitad que faltaba: todo lo de después —que el caso diga qué le
      // falta, "Marcar que llegó" en la lista, que el cliente no lo pueda
      // destrabar— ya estaba hecho y esperaba pedidos que nadie podía crear.
      //
      // Un pedido es un insumo en estado "pedido". Con caso, el caso queda
      // esperándolo (alPedirInsumo, en estados.js, decide cómo). Sin caso es
      // reponer el stock: al llegar pasa a "Lo que tenés".
      // Con los mismos datos que el alta de un producto: al llegar se busca
      // uno igual en el stock por nombre, marca, modelo y cómo viene.
      async pedirInsumo({ casoId, ...form }) {
        const r = await llamarCasos("/insumos/pedidos", { ...productoParaLaApi(form), caso_id: casoId || null }, { idempotencia: nuevaClave() });
        if (!r.ok) { setAviso(r.error.mensaje); return null; }
        setDatos((d) => ({ ...d, insumos: [...d.insumos, r.datos.insumo],
          casos: r.datos.caso ? d.casos.map((c) => c.id === r.datos.caso.id ? r.datos.caso : c) : d.casos,
          eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos }));
        return r.datos.insumo;
      },

      // Agregar un producto al stock. Si ya hay uno igual —mismo nombre, marca,
      // modelo y presentación, escritos como sea (mismoProducto, en
      // lib/inventario.js)— se suma a ése en vez de crear otra fila: dos filas
      // de lo mismo hacen que ninguno de los dos números sea el del estante.
      //
      // Devuelve qué pasó, para que la pantalla lo diga: { sumado, insumo,
      // antes }. "antes" es cuánto había, sólo si se sumó.
      //
      // Con el inventario por la API, la regla la decide la API (que ve el
      // stock de verdad, no el que tiene esta pestaña): se espera su
      // respuesta y recién ahí se muestra. Si dice que no, avisa y devuelve
      // null. La clave de idempotencia hace que un reintento por mala
      // conexión no sume dos veces.
      async agregarInsumo(form) {
        const r = await mandar("/insumos", productoParaLaApi(form), await tokenDeSesion(), {
          idempotencia: nuevaClave(),
        });
        if (!r.ok) {
          setAviso(r.error.mensaje);
          return null;
        }
        const { sumado, insumo, antes } = r.datos;
        // Si se sumó a uno que esta pestaña no tenía (lo cargó otra persona
        // hace un rato), se agrega; si ya estaba, se reemplaza.
        setDatos((d) => ({
          ...d,
          insumos: d.insumos.some((i) => i.id === insumo.id)
            ? d.insumos.map((i) => (i.id === insumo.id ? insumo : i))
            : [...d.insumos, insumo],
        }));
        return { sumado, insumo, antes };
      },

      // El "Editar" de cada producto: todos sus datos y la cantidad exacta.
      // Reemplaza al − y al + de la lista, que cambiaban el stock de un toque
      // sin querer. Si uno del stock queda igual a otro, se juntan en el que
      // ya estaba (igualAlEditar); "borrado" dice cuál se fue.
      //
      // Espera a la API antes de mostrar: si se juntan, lo decide ella con el
      // stock de verdad. Devuelve { insumo, borrado }, o null si no se pudo
      // (el aviso ya se dio).
      async editarInsumo(insumoId, form) {
        const actual = datos.insumos.find((i) => i.id === insumoId);
        if (!actual) return null;
        const r = await reemplazar(`/insumos/${insumoId}`,
          { ...productoParaLaApi(form), actualizado_en: actual.actualizado_en }, await tokenDeSesion());
        if (!r.ok) {
          setAviso(r.error.mensaje);
          if (r.error.codigo === "choque") setRefresco((n) => n + 1);
          return null;
        }
        const resultado = r.datos;
        const { insumo, borrado } = resultado;
        setDatos((d) => ({
          ...d,
          insumos: d.insumos
            .filter((i) => i.id !== borrado)
            .map((i) => (i.id === insumo.id ? insumo : i)),
        }));
        return resultado;
      },

      eliminarInsumo(insumoId) {
        setDatos((d) => ({ ...d, insumos: d.insumos.filter((i) => i.id !== insumoId) }));
        enLaApi((token) => quitar(`/insumos/${insumoId}`, token));
        return;
      },

      // ---------- equipo ----------
      // Un empleado es quien puede quedar como responsable de un caso. No
      // necesita cuenta: el taller chico quiere anotar a Diego sin que Diego
      // use el sistema. Atarlo a una cuenta es de la invitación (SCRUM-34).
      agregarEmpleado({ nombre, rol }) {
        const empleado = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          nombre,
          rol: rol || "tecnico",
        };
        setDatos((d) => ({ ...d, empleados: [...d.empleados, empleado] }));
        enLaApi(async (token) => {
          const r = await mandar("/equipo", { nombre, rol: rol || "tecnico" }, token, {
            idempotencia: nuevaClave(),
          });
          if (r.ok) {
            setDatos((d) => ({
              ...d,
              empleados: d.empleados.map((e) => (e.id === empleado.id ? r.datos.empleado : e)),
            }));
          }
          return r;
        });
        return empleado;
      },

      // OJO AL CAMBIAR ESTO. Desde la 037 el rol de la ficha es el que da los
      // permisos: si la ficha es de una cuenta, la base pasa este rol a
      // usuario.rol, que es de donde lee mi_rol() (008_permisos.sql). Antes
      // era sólo el nombre con el que figuraba en la lista.
      //
      // Por eso Equipo, antes de llamar acá por alguien con cuenta, pide
      // confirmación diciendo qué gana y qué pierde esa persona: en un
      // desplegable de celular el dedo arrastra y elige otra opción sin
      // querer (auditoría, H5). Una ficha sin cuenta sigue siendo sólo un
      // nombre y cambia directo.
      cambiarRolEmpleado(empleadoId, rol) {
        setDatos((d) => ({
          ...d,
          empleados: d.empleados.map((e) => (e.id === empleadoId ? { ...e, rol } : e)),
        }));
        enLaApi((token) => parchar(`/equipo/${empleadoId}/rol`, { rol, actualizado_en: version(datos.empleados, empleadoId) }, token),
          ({ empleado }) => setDatos((d) => ({ ...d, empleados: ponerFila(d.empleados, empleado) })));
        return;
      },

      // Los casos que tenía quedan sin responsable, no se borran: la base los
      // pone en null sola (on delete set null).
      eliminarEmpleado(empleadoId) {
        setDatos((d) => ({
          ...d,
          empleados: d.empleados.filter((e) => e.id !== empleadoId),
          casos: d.casos.map((c) =>
            c.responsable_id === empleadoId ? { ...c, responsable_id: null } : c
          ),
        }));
        enLaApi((token) => mandar(`/equipo/${empleadoId}/sacar`, {}, token));
        return;
      },

      // ---------- invitaciones ----------
      // El código lo genera la base, no el navegador: tiene que ser difícil
      // de adivinar y no depender de lo que corra en la máquina de nadie.
      async crearInvitacion({ rol, usosMaximos, dias }) {
        const vence = new Date();
        vence.setDate(vence.getDate() + (Number(dias) || 7));

        const r = await mandar(
          "/invitaciones",
          {
            rol: rol || "tecnico",
            usos_maximos: Number(usosMaximos) || 1,
            vence_en: vence.toISOString(),
          },
          await tokenDeSesion(),
          { idempotencia: nuevaClave() }
        );
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        setDatos((d) => ({ ...d, invitaciones: [r.datos.invitacion, ...d.invitaciones] }));
        return { ok: true, invitacion: r.datos.invitacion };
      },

      // No se borra: se anula, así queda el rastro de a quién se invitó.
      anularInvitacion(id) {
        setDatos((d) => ({
          ...d,
          invitaciones: d.invitaciones.map((i) =>
            i.id === id ? { ...i, anulada: true } : i
          ),
        }));
        enLaApi((token) => mandar(`/invitaciones/${id}/anular`, {}, token));
        return;
      },

      // ---------- clientes ----------
      agregarCliente({ nombre, telefono, notas }) {
        const cliente = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          nombre,
          telefono,
          notas: notas || "",
          // Alguien lo escribió a propósito: no hay nada que confirmar.
          confirmado: true,
        };
        setDatos((d) => ({ ...d, clientes: [...d.clientes, cliente] }));
        enLaApi(async (token) => {
          const r = await mandar("/clientes", { nombre, telefono, notas: notas || "" }, token, {
            idempotencia: nuevaClave(),
          });
          if (r.ok) {
            setDatos((d) => ({
              ...d,
              clientes: d.clientes.map((c) => (c.id === cliente.id ? r.datos.cliente : c)),
            }));
          }
          return r;
        });
        return cliente;
      },

      // Corregir el teléfono desde la ficha del cliente. Antes, uno mal
      // cargado no se podía arreglar en ningún lado.
      corregirTelefono(clienteId, telefono) {
        setDatos((d) => ({
          ...d,
          clientes: d.clientes.map((c) => (c.id === clienteId ? { ...c, telefono } : c)),
        }));
        enLaApi((token) => parchar(`/clientes/${clienteId}`, { telefono, actualizado_en: version(datos.clientes, clienteId) }, token),
          ({ cliente }) => setDatos((d) => ({ ...d, clientes: ponerFila(d.clientes, cliente) })));
        return;
      },

      // ---------- agenda ----------
      // El cliente se puede dar de alta desde acá: alguien llama para pedir
      // turno y todavía no está cargado. No tiene sentido obligar a salir a
      // otra pantalla para poder anotarlo.
      //
      // Cuánto dura el turno no se pide: en un taller no se sabe de antemano,
      // y un número inventado no sirve para nada.
      //
      // Devuelve { ok: true } o null si no se pudo (el aviso ya se dio).
      //
      // Con los turnos por la API se espera su respuesta: si el horario ya
      // está tomado, la API lo dice ("Ya hay un turno a esa hora") y el turno
      // no aparece. Antes aparecía igual y después fallaba la base. La clave
      // de idempotencia hace que un reintento no anote dos turnos.
      async agregarTurno({ clienteId, nombreCliente, telefono, motivo, empiezaEn }) {
        const r = await mandar(
          "/turnos",
          turnoParaLaApi({ clienteId, nombreCliente, telefono, motivo, empiezaEn }),
          await tokenDeSesion(),
          { idempotencia: nuevaClave() }
        );
        if (!r.ok) {
          setAviso(r.error.mensaje);
          return null;
        }
        const { turno, cliente } = r.datos;
        setDatos((d) => ({
          ...d,
          clientes: cliente ? [...d.clientes, cliente] : d.clientes,
          turnos: [...d.turnos, turno],
        }));
        return { ok: true };
      },

      // "Vino a buscarlo": el turno era por un trabajo que ya estaba en
      // curso, así que no abre ningún caso; sólo deja constancia de que la
      // persona vino, y de por cuál de sus casos.
      marcarTurnoAtendido(turnoId, casoId = null) {
        setDatos((d) => ({
          ...d,
          turnos: d.turnos.map((t) =>
            t.id === turnoId ? { ...t, estado: "atendido", caso_id: casoId } : t
          ),
        }));
        enLaApi((token) => mandar(`/turnos/${turnoId}/atender`, { caso_id: casoId }, token), (turno) => setDatos((d) => ({ ...d, turnos: ponerFila(d.turnos, turno) })));
        return;
      },

      // Marcar que vino se puede deshacer. El caso que haya salido
      // del turno no se toca: existe por su cuenta y se cierra desde el caso.
      desmarcarTurnoAtendido(turnoId) {
        setDatos((d) => ({
          ...d,
          turnos: d.turnos.map((t) =>
            t.id === turnoId ? { ...t, estado: "confirmado", caso_id: null } : t
          ),
        }));
        enLaApi((token) => mandar(`/turnos/${turnoId}/desatender`, {}, token), (turno) => setDatos((d) => ({ ...d, turnos: ponerFila(d.turnos, turno) })));
        return;
      },

      // Confirmar, cancelar, y el "Deshacer" que vuelve al estado de antes.
      // Deshacer una cancelación puede chocar con otro turno que tomó el
      // lugar: con la API, el aviso lo dice y la agenda se vuelve a leer.
      cambiarEstadoTurno(turnoId, estado) {
        setDatos((d) => ({
          ...d,
          turnos: d.turnos.map((t) => (t.id === turnoId ? { ...t, estado } : t)),
        }));
        enLaApi((token) => parchar(`/turnos/${turnoId}`, { estado, actualizado_en: version(datos.turnos, turnoId) }, token),
          (turno) => setDatos((d) => ({ ...d, turnos: ponerFila(d.turnos, turno) })));
        return;
      },

      // ---------- negocio ----------
      // Crea el negocio al terminar el alta (SCRUM-12). La API lo crea junto
      // con su vínculo con la cuenta (crear_mi_negocio): los dos o ninguno.
      async crearNegocio({ nombre, rubro }) {
        const r = await mandar(
          "/negocios",
          { nombre, rubro, modulos: preset(rubro).modulos ?? [] },
          await tokenDeSesion(),
          { idempotencia: nuevaClave() }
        );
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        return { ok: true, id: r.datos.id };
      },

      // El rubro se cambia sólo mientras el negocio no tiene casos (SCRUM-90):
      // sirve para corregir una elección equivocada al crearlo, no para pasar
      // un taller con patentes cargadas a consultorio. La base lo rechaza
      // igual (013_rubro_fijo.sql); esto evita llegar hasta ahí.
      cambiarRubro(rubro) {
        if (datos.casos.length > 0) return false;
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, rubro } }));
        enLaApi((token) => parchar("/negocio", { rubro, actualizado_en: datos.negocio?.actualizado_en }, token), ({ negocio }) => ponerNegocio(negocio));
        return true;
      },

      // Lo que se edita de la ficha del negocio: el nombre, la descripción y
      // la foto (SCRUM-30). Los tres juntos y en una sola escritura, porque
      // en la pantalla son un solo "Guardar".
      //
      // Guardar de a uno dejaría a medias una edición que la persona ve como
      // una sola: el nombre cambiado y la foto no, si la segunda falla.
      //
      // La foto viene como data URL ya achicado por src/lib/imagen.js, o null
      // para volver al ícono.
      guardarNegocio({ nombre, descripcion, foto, telefono }) {
        const cambios = {
          nombre: nombre.trim(),
          // Vacío es que no hay descripción, no una descripción en blanco.
          descripcion: descripcion.trim() || null,
          foto: foto ?? null,
          // El teléfono nace en 020_telefono_del_negocio.sql: en una base sin
          // esa migración la ficha se guarda igual, sin él.
          telefono: (telefono ?? "").trim() || null,
        };
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, ...cambios } }));
        enLaApi((token) => parchar("/negocio", { ...cambios, actualizado_en: datos.negocio?.actualizado_en }, token), ({ negocio }) => ponerNegocio(negocio));
        return;
      },

      // Compartir la agenda: el link con el que un cliente pide turno solo
      // (024). Devuelve siempre el mismo código: uno nuevo dejaría muerto el
      // que el negocio ya puso en su perfil de Instagram.
      async compartirAgenda() {
        if (datos.negocio?.agenda_codigo)
          return { ok: true, codigo: datos.negocio.agenda_codigo };

        const r = await mandar("/negocio/agenda/compartir", {}, await tokenDeSesion());
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        sinVersionDelNegocio({ agenda_codigo: r.datos.codigo });
        return { ok: true, codigo: r.datos.codigo };
      },

      async dejarDeCompartirAgenda() {
        const r = await mandar("/negocio/agenda/dejar-de-compartir", {}, await tokenDeSesion());
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        sinVersionDelNegocio({ agenda_codigo: null });
        return { ok: true };
      },

      // El link del calendario (027). Es otro código y otro interruptor que el
      // de pedir turno, porque muestran cosas distintas a gente distinta: aquél
      // sólo horarios ocupados para cualquiera, éste los turnos con nombre y
      // teléfono para el dueño.
      async compartirCalendario() {
        if (datos.negocio?.ics_codigo)
          return { ok: true, codigo: datos.negocio.ics_codigo };

        const r = await mandar("/negocio/calendario/compartir", {}, await tokenDeSesion());
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        sinVersionDelNegocio({ ics_codigo: r.datos.codigo });
        return { ok: true, codigo: r.datos.codigo };
      },

      async dejarDeCompartirCalendario() {
        const r = await mandar("/negocio/calendario/dejar-de-compartir", {}, await tokenDeSesion());
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        sinVersionDelNegocio({ ics_codigo: null });
        return { ok: true };
      },

      // Los días y horas en los que el negocio da turnos (023). De acá sale
      // lo que se le ofrece a un cliente para pedir uno solo.
      //
      // Con los turnos por la API, se ven al instante y van por atrás; la API
      // los valida (los mismos problemas que muestra la pantalla) y los
      // devuelve limpios, que es lo que queda en memoria.
      guardarHorarios(horarios) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, horarios } }));
        (async () => {
          const r = await reemplazar("/negocio/horarios", horarios, await tokenDeSesion());
          if (!r.ok) {
            setAviso(r.error.mensaje);
            setRefresco((n) => n + 1);
            return;
          }
          sinVersionDelNegocio({ horarios: r.datos.horarios });
        })();
        return;
      },

      // Después de guardar el perfil (SCRUM-118). No escribe nada en la base:
      // guardar_mi_perfil() ya cambió la cuenta y la ficha. Acá sólo se
      // refleja en memoria, para que Equipo muestre el nombre y la foto nuevos
      // sin tener que recargar la pantalla.
      reflejarMiPerfil(usuarioId, { nombre, foto }) {
        setDatos((d) => ({
          ...d,
          empleados: d.empleados.map((e) =>
            e.usuario_id === usuarioId ? { ...e, nombre } : e
          ),
          fotosEquipo: [
            ...d.fotosEquipo.filter((f) => f.usuario_id !== usuarioId),
            ...(foto ? [{ usuario_id: usuarioId, foto }] : []),
          ],
        }));
      },

      // Con qué nace el nombre de los casos nuevos (SCRUM-119). No toca los
      // que ya existen: esos se editan de a uno desde el caso.
      cambiarNombrarCasos(modo) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, nombrar_casos: modo } }));
        enLaApi((token) => parchar("/negocio", { nombrar_casos: modo, actualizado_en: datos.negocio?.actualizado_en }, token), ({ negocio }) => ponerNegocio(negocio));
        return;
      },

      // Cómo se muestran los cinco estados del flujo. Las claves siguen
      // siendo las mismas; sólo cambian el nombre y el símbolo visibles.
      cambiarPresentacionEstados(estados) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, estados } }));
        enLaApi((token) => parchar("/negocio", { estados, actualizado_en: datos.negocio?.actualizado_en }, token), ({ negocio }) => ponerNegocio(negocio));
      },

      // Prende y apaga módulos (SCRUM-38). Recibe la lista completa nueva.
      cambiarModulos(claves) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, modulos_activos: claves } }));
        enLaApi((token) => reemplazar("/negocio/modulos", { valor: claves }, token), ({ negocio }) => negocio && ponerNegocio(negocio));
        return;
      },

      // Cómo quedó acomodada la pantalla de Inicio. Recibe la lista completa,
      // igual que los módulos: qué se ve, en qué orden, de qué tamaño y con
      // qué filtro.
      cambiarInicio(config) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, inicio: config } }));
        enLaApi((token) => reemplazar("/negocio/inicio", { valor: config }, token), ({ negocio }) => negocio && ponerNegocio(negocio));
        return;
      },

      // avisarExito("Listo…", { deshacer: () => … }) suma un botón "Deshacer"
      // al aviso. El setter recibe una función que devuelve la función, porque
      // si se le pasa la función directo React la ejecuta.
      avisarExito: (texto, { deshacer = null } = {}) => {
        setExito(texto);
        setDeshacerExito(() => deshacer);
      },
      descartarAviso: () => setAviso(null),
      descartarExito: () => {
        setExito(null);
        setDeshacerExito(null);
      },
    };
  }, [datos, sesion]);

  // El Inicio se sirve ya normalizado: las pantallas nunca ven una
  // configuración a medias guardada por una versión anterior.
  const valor = {
    ...datos,
    inicio: normalizarInicio(datos.negocio?.inicio),
    cargando,
    aviso,
    otroNegocio,
    exito,
    deshacerExito,
    ...acciones,
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDatos() {
  const v = useContext(Contexto);
  if (!v) throw new Error("useDatos tiene que usarse adentro de <DatosProvider>");
  return v;
}
