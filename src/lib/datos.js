"use client";

// Capa de datos con dos modos.
//
// Las cuentas reales leen y escriben por la API. El modo de ejemplo guarda
// todo en el navegador.
// Las pantallas no se enteran de la diferencia: usan siempre estas funciones.
//
// Sirve para que los cuatro puedan clonar y levantar el proyecto sin esperar
// a que alguien reparta las claves, y para que la demo no dependa del wifi.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { comoSeIdentifica, preset, queFaltaPara, vocabulario } from "./presets";
import { buscarIgual, igualAlEditar, limpiarProducto, productoParaLaApi } from "./inventario";
import {
  FIRMA_DEL_CLIENTE,
  alLlegarInsumo,
  alPedirInsumo,
  elClienteDestraba,
  elClienteVolvioADarTrabajo,
  pesos,
  sePuedeMarcarHecho,
} from "./estados";
import { normalizarInicio } from "./inicio";
import { nombreInicial } from "./nombres.js";
import { quienEscribe } from "./permisos";
import { construirSemilla } from "./semilla";
import { ESPERA_AL_CLIENTE, casoPublico, respuestaDeLaApi, seguimientoDeLaApi } from "./seguimiento.js";
import { agendaDeLaApi, agendaPublica, huecoSigueLibre, normalizarHorarios } from "./horarios.js";
import { anularPagoEnLinea, pagosEnLinea, pedirPagoEnLinea } from "./pagos.js";
import { API, mandar, nuevaClave, parchar, quitar, reemplazar, traer } from "./api.js";
import { turnoParaLaApi } from "./turnos.js";
import { erroresSeguimiento, seguimientoParaLaApi } from "./seguimiento-whatsapp.js";
import {
  MEDIOS_DEL_LOCAL,
  MEDIOS_EN_LINEA,
  conCobro as ponerCobro,
  medioDe,
  montoDeCobroValido,
  sePuedeAnular,
} from "./cobros.js";

// Campos que el modo de ejemplo conserva en localStorage.
const COLUMNAS_NUEVAS_DE_INSUMO = ["marca", "modelo", "por_caja", "categoria"];

const LLAVE = "marmanager.datos.v1";
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
};

const Contexto = createContext(null);

const datosLocales = () => {
  try {
    const guardado = window.localStorage.getItem(LLAVE);
    return guardado ? JSON.parse(guardado) : null;
  } catch {
    return null;
  }
};

const nuevoId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id" + Math.random().toString(36).slice(2);

// El código del link que se le manda al cliente, para el modo de ejemplo.
// Con Supabase lo genera la base (018_seguimiento.sql); acá no hay base, así
// que lo genera el navegador con el mismo generador criptográfico que usan
// las claves, no con Math.random(): un código adivinable haría que el link
// deje de ser secreto, que es lo único que lo protege.
const codigoAlAzar = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

// Buscar un caso compartido, desde afuera del sistema.
//
// Es una función suelta y no una acción del proveedor a propósito: la
// pantalla pública no tiene sesión, ni negocio, ni nada del contexto que
// useDatos() necesita. Quien la abre no es del negocio.
//
// Las dos fuentes devuelven el mismo objeto: con Supabase lo recorta la base
// campo por campo, y en el modo de ejemplo lo recorta casoPublico(). El
// recorte del modo de ejemplo no protege nada —los datos ya están en ese
// navegador— pero tiene que dar lo mismo, o la pantalla mostraría una cosa
// distinta según dónde corra.
export async function buscarSeguimiento(codigo) {
  // Primero el navegador: un link creado en modo de ejemplo no debe esperar
  // que despierte el servidor para mostrar datos que ya están acá.
  //
  // Buscar de más no abre nada: el código del navegador sólo existe en ese
  // navegador, y el de la base no aparece acá.
  // En el modo de ejemplo la visita NO queda registrada, así que del lado
  // del negocio el caso va a decir siempre "todavía no lo abrió". Es a
  // propósito: el proveedor de datos guarda el estado entero del navegador
  // cada vez que cambia, y escribir la visita desde acá sería escribir sobre
  // lo mismo desde dos lados. Con la base conectada la anota la API, que
  // pasa por ver_seguimiento(), que es donde corresponde.
  //
  // Aunque la API no haya contestado se mira igual acá: un link del modo de
  // ejemplo no depende de la API y tiene que abrirse lo mismo.
  const local = datosLocales();
  if (local) {
    const seguimiento = casoPublico({ codigo, ...local });
    if (seguimiento.sirve) return seguimiento;
  }

  let problema = null;
  if (API) {
    const s = seguimientoDeLaApi(await traer(`/publico/seguimiento/${encodeURIComponent(codigo)}`));
    if (s.sirve) return s;
    problema = s.problema ?? null;
  }
  // Si la API no contestó, se dice eso: el link puede andar en un rato.
  return problema ? { sirve: false, problema } : { sirve: false };
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
  const local = datosLocales();
  const esLocal = local?.casos?.some((c) => c.seguimiento_codigo === codigo);
  if (!esLocal && API) {
    const r = await mandar(
      `/publico/seguimiento/${encodeURIComponent(codigo)}/pasos/${encodeURIComponent(pasoId)}/respuesta`,
      { respuesta }
    );
    // "seguimiento_no_encontrado" es la API diciendo "ese código no es mío".
    // Puede ser un link del modo de ejemplo abierto en un navegador que
    // además tiene la API: hay que seguir buscando abajo, igual que la
    // búsqueda.
    //
    // Cualquier otra respuesta es de la API y manda: si dice que el paso ya
    // estaba contestado, se muestra eso y no se busca en ningún otro lado.
    if (r.ok || r.error.codigo !== "seguimiento_no_encontrado") return respuestaDeLaApi(r);
  }

  // Modo de ejemplo. Acá sí se escribe en el navegador, a diferencia de la
  // visita: esto pasa cuando la persona toca un botón, mucho después de que
  // el proveedor de datos terminó de cargar y guardar. La visita, en cambio,
  // se registraría justo durante esa carga, y los dos se pisarían.
  try {
    if (!local) return { ok: false, motivo: "Este link ya no sirve. Pedile uno nuevo al negocio." };
    const d = local;

    const caso = (d.casos ?? []).find((c) => c.seguimiento_codigo === codigo);
    if (!caso) return { ok: false, motivo: "Este link ya no sirve. Pedile uno nuevo al negocio." };
    if (caso.estado === "completado") {
      return {
        ok: false,
        motivo: "Este trabajo ya se entregó. Si querés agregar algo, hablá con el negocio.",
      };
    }

    const paso = (d.pasos ?? []).find((p) => p.id === pasoId && p.caso_id === caso.id);
    if (!paso) return { ok: false, motivo: "Ese paso ya no está en el presupuesto." };
    if (paso.estado === "aprobado") return { ok: false, motivo: "Ese paso ya estaba aprobado." };
    if (paso.estado === "rechazado") return { ok: false, motivo: "Ese paso ya lo habías contestado." };

    const ahora = new Date().toISOString();
    d.pasos = d.pasos.map((p) =>
      p.id === pasoId
        ? { ...p, estado: respuesta, aprobado_en: respuesta === "aprobado" ? ahora : p.aprobado_en }
        : p
    );
    d.eventos = [
      {
        id: nuevoId(),
        caso_id: caso.id,
        tipo: "plata",
        titulo:
          respuesta === "aprobado"
            ? "Lo aprobó el cliente desde el link"
            : "El cliente no lo hace, contestó desde el link",
        detalle: `${paso.nombre} · ${pesos(paso.monto)}`,
        autor: FIRMA_DEL_CLIENTE,
        icono: respuesta === "aprobado" ? "listo" : "nota",
        monto: Number(paso.monto),
        estado: null,
        ocurrido_en: ahora,
      },
      ...(d.eventos ?? []),
    ];

    // El caso se mueve solo en dos casos, los mismos que hace la base en
    // 022_el_cliente_destraba.sql: cuando ya no queda nada esperando su
    // respuesta, y cuando aprueba algo nuevo sobre un caso que ya estaba
    // controlado.
    const porQueSeMueve = elClienteDestraba(caso, {
      pasos: d.pasos,
      insumos: d.insumos ?? [],
    })
      ? {
          titulo: "El cliente terminó de contestar",
          detalle: "Ya no queda nada esperando su respuesta.",
        }
      : elClienteVolvioADarTrabajo(caso, respuesta)
        ? {
            titulo: "El cliente aprobó algo más",
            detalle: "El caso vuelve al trabajo: el control ya no alcanza.",
          }
        : null;

    if (porQueSeMueve) {
      d.casos = d.casos.map((c) =>
        c.id === caso.id ? { ...c, estado: "en_proceso", que_falta: "Hacer el trabajo" } : c
      );
      d.eventos = [
        {
          id: nuevoId(),
          caso_id: caso.id,
          tipo: "estado",
          titulo: porQueSeMueve.titulo,
          detalle: porQueSeMueve.detalle,
          autor: FIRMA_DEL_CLIENTE,
          icono: "llave",
          monto: null,
          estado: "en_proceso",
          ocurrido_en: ahora,
        },
        ...d.eventos,
      ];
    }

    window.localStorage.setItem(LLAVE, JSON.stringify(d));
    return { ok: true };
  } catch {
    return { ok: false, motivo: "No pudimos guardar tu respuesta. Probá de nuevo." };
  }
}

// Los horarios de un negocio y sus turnos tomados, desde afuera del sistema.
//
// Suelta y no acción del proveedor, igual que buscarSeguimiento(): quien abre
// el link de la agenda no tiene sesión ni negocio. Y busca en los dos lados
// por lo mismo: un link armado en modo de ejemplo no está en la base.
//
// Con los turnos por la API, la agenda viene de la API con los huecos ya
// armados (agendaDeLaApi). Si la API no conoce el código, se sigue buscando
// en el navegador: puede ser un link del modo de ejemplo. Si la API no
// contesta, se dice eso y no "el link no sirve", que sería mentira.
export async function buscarAgenda(codigo) {
  const local = datosLocales();
  if (local?.negocio?.agenda_codigo === codigo) {
    return agendaPublica({ codigo, negocio: local.negocio, turnos: local.turnos ?? [] });
  }

  if (API) {
    const r = await traer(`/publico/agenda/${encodeURIComponent(codigo)}`);
    if (r.ok) return agendaDeLaApi(r.datos);
    if (r.error.codigo !== "agenda_no_encontrada") return { sirve: false, problema: r.error.mensaje };
  }

  return { sirve: false };
}

// Pedir el turno. Devuelve { ok } o { ok: false, motivo }, con el motivo
// escrito para que el cliente lo lea tal cual.
//
// Con los turnos por la API, la que decide si ese horario se puede pedir es
// la API, y sus mensajes son los mismos de siempre. Un código que la API no
// conoce sigue al modo de ejemplo, igual que con la base.
export async function reservarTurno({ codigo, cuando, motivo, nombre, telefono }) {
  const local = datosLocales();
  const esLocal = local?.negocio?.agenda_codigo === codigo;
  if (!esLocal && API) {
    const r = await mandar(`/publico/agenda/${encodeURIComponent(codigo)}/turnos`, {
      empieza_en: new Date(cuando).toISOString(),
      motivo,
      nombre,
      telefono: telefono || null,
    });
    if (r.ok) return { ok: true, cuando: r.datos.cuando, minutos: r.datos.minutos };
    if (r.error.codigo !== "agenda_no_encontrada") return { ok: false, motivo: r.error.mensaje };
  }

  // Modo de ejemplo. Vuelve a hacer las mismas comprobaciones que la base,
  // porque entre que vio la lista y tocó el botón pudo pasar cualquier cosa.
  try {
    if (!local) return { ok: false, motivo: "Este link ya no sirve. Pedile uno nuevo al negocio." };
    const d = local;

    if (!d.negocio || d.negocio.agenda_codigo !== codigo) {
      return { ok: false, motivo: "Este link ya no sirve. Pedile uno nuevo al negocio." };
    }
    if (!d.negocio.horarios) {
      return { ok: false, motivo: "El negocio todavía no publicó sus horarios." };
    }
    if (!nombre?.trim()) return { ok: false, motivo: "Necesitamos tu nombre para anotarte." };
    if (!motivo?.trim()) return { ok: false, motivo: "Contanos para qué venís." };

    if (!huecoSigueLibre({ cuando, horarios: d.negocio.horarios, turnos: d.turnos ?? [] })) {
      return { ok: false, motivo: "Justo te lo ganaron. Elegí otro horario." };
    }

    const minutos = normalizarHorarios(d.negocio.horarios).minutos;
    const cliente = {
      id: nuevoId(),
      negocio_id: d.negocio.id,
      nombre: nombre.trim(),
      telefono: telefono?.trim() || null,
      notas: "",
      // Pidió turno, pero todavía no vino: se confirma cuando se le abre el
      // primer caso. Es la misma marca que usa el mostrador.
      confirmado: false,
    };
    d.clientes = [...(d.clientes ?? []), cliente];
    d.turnos = [
      ...(d.turnos ?? []),
      {
        id: nuevoId(),
        negocio_id: d.negocio.id,
        cliente_id: cliente.id,
        caso_id: null,
        motivo: motivo.trim(),
        empieza_en: new Date(cuando).toISOString(),
        estado: "agendado",
        origen: "cliente",
        minutos_reservados: minutos,
      },
    ];

    window.localStorage.setItem(LLAVE, JSON.stringify(d));
    return { ok: true, cuando: new Date(cuando).toISOString(), minutos };
  } catch {
    return { ok: false, motivo: "No pudimos anotarte. Probá de nuevo." };
  }
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
  const { esDemo, usuario, sesion, cargando: authCargando } = useAuth();
  const [datos, setDatos] = useState(VACIO);
  const [cargando, setCargando] = useState(true);
  const [fuente, setFuente] = useState("local");
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
  // la sesión resuelva y carga según el modo (ejemplo o API).
  useEffect(() => {
    let vivo = true;
    if (authCargando) {
      return () => {
        vivo = false;
      };
    }

    (async () => {
      // Sin entrar: no hay nada que cargar. La Guardia manda a iniciar sesión.
      if (!esDemo && !usuario) {
        if (!vivo) return;
        cargadoDe.current = null;
        setOtroNegocio(null);
        setDatos(VACIO);
        setCargando(false);
        return;
      }

      // Modo de ejemplo: lo que haya cargado esta persona en su navegador.
      if (esDemo) {
        const guardado =
          typeof window !== "undefined" ? window.localStorage.getItem(LLAVE) : null;
        if (!vivo) return;
        // Sobre VACIO, para que a una copia guardada antes de que existiera
        // una lista no le falte la clave y rompa la pantalla que la usa.
        const local = guardado
          ? { ...VACIO, ...JSON.parse(guardado) }
          : construirSemilla();
        setDatos({ ...local, negocio: conModulos(local.negocio) });
        setFuente("local");
        setCargando(false);
        return;
      }

      // Cuenta real todavía sin negocio: la Guardia manda a crearlo.
      if (!usuario.negocio_id) {
        if (!vivo) return;
        cargadoDe.current = null;
        setOtroNegocio(null);
        setDatos(VACIO);
        setFuente("api");
        setCargando(false);
        return;
      }

      // Cuenta real con negocio: se lee de la API, sólo lo de ese negocio.
      if (cargadoDe.current !== usuario.negocio_id) setCargando(true);
      try {
        const r = await traer("/datos", sesion?.access_token);
        if (!r.ok) throw new Error(r.error.mensaje);
        const traido = { ...r.datos, negocio: conModulos(r.datos.negocio) };
        if (!vivo) return;
        if (traido.negocio) {
          cargadoDe.current = usuario.negocio_id;
          setOtroNegocio(null);
          setDatos(traido);
          setFuente("api");
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
        setFuente("api");
        setCargando(false);
      } catch (e) {
        if (!vivo) return;
        setAviso(
          "No se pudo leer el servidor. Fijate la conexión y volvé a entrar."
        );
        setDatos(VACIO);
        setFuente("api");
        setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [authCargando, esDemo, usuario, sesion?.access_token, refresco]);

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
  // tabla "turno" —que no anda en el modo de ejemplo, donde no hay servidor—.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const alVolver = () => {
      if (document.visibilityState === "visible") setRefresco((n) => n + 1);
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  // En modo local, todo lo que se toca queda guardado en el navegador.
  useEffect(() => {
    if (cargando || fuente !== "local" || !datos.negocio) return;
    try {
      window.localStorage.setItem(LLAVE, JSON.stringify(datos));
    } catch {
      // Si el navegador no deja guardar, la sesión sigue andando en memoria.
    }
  }, [datos, cargando, fuente]);

  const acciones = useMemo(() => {
    const enServidor = () => fuente === "api";

    // En el modo de ejemplo alcanza con el cambio optimista: el efecto de
    // arriba lo guarda en localStorage. En una cuenta real cada acción usa su
    // endpoint de la API.
    const escribir = () => {};
    const borrar = () => {};

    // La sesión de quien está usando el sistema, para llamar a la API de
    // pagos como esa persona (docs/api-pagos.md).
    const tokenDeSesion = async () => sesion?.access_token ?? null;

    const porLaApi = () => enServidor();

    // Para los cambios que ya se ven en pantalla antes de que conteste la API
    // (sumar uno, escribir la cantidad, borrar): se mandan por atrás, y si la
    // API dice que no, se avisa con su mensaje y se vuelve a leer todo, para
    // que la pantalla no quede mostrando algo que no pasó.
    const enLaApi = async (pedir) => {
      const r = await pedir(await tokenDeSesion());
      if (r.ok) return;
      setAviso(r.error.mensaje);
      setRefresco((n) => n + 1);
    };

    // Quién firma el historial. La regla vive en permisos.js y tiene test.
    const firma = () => quienEscribe({ esDemo, usuario, empleados: datos.empleados });

    const escribirConColumnasNuevas = () => {};

    // tipo y monto nacen en 014_evento_tipo.sql; estado, en 018_seguimiento.sql.
    const escribirEvento = (evento) =>
      escribirConColumnasNuevas("evento", evento, ["tipo", "monto", "estado"], {
        insertar: true,
      });

    // No recibe autor: si se pudiera pasar de afuera, volverían los
    // personajes. Lo firma siempre quien está usando el sistema.
    //
    // "tipo" es obligatorio en la práctica: es lo que usa el historial del
    // negocio para filtrar (lib/historial.js). Un evento sin tipo sólo se ve
    // en "Todo". "monto" va en los de plata.
    // "estado" es a qué estado pasó el caso, y va sólo en los eventos que lo
    // mueven. El título cuenta lo mismo con palabras, pero escritas para
    // adentro del negocio: la línea de tiempo que ve el cliente necesita el
    // estado pelado, porque las palabras se las pone el preset de su rubro
    // (SCRUM-68).
    const nuevoEvento = ({
      casoId,
      tipo,
      titulo,
      detalle,
      icono = "carpeta",
      monto = null,
      estado = null,
      cuando,
    }) => ({
      id: nuevoId(),
      caso_id: casoId,
      tipo,
      titulo,
      detalle,
      autor: firma(),
      icono,
      monto: monto === null ? null : Number(monto),
      estado,
      ocurrido_en: cuando ?? new Date().toISOString(),
    });

    const anotar = (datosDelEvento) => {
      const evento = nuevoEvento(datosDelEvento);
      setDatos((d) => ({ ...d, eventos: [evento, ...d.eventos] }));
      escribirEvento(evento);
      return evento;
    };

    // "descuento" nace en 025_cobros.sql: si la base todavía no lo tiene,
    // el resto del cambio (cerrar el caso, por ejemplo) se guarda igual.
    const parchearCaso = (casoId, cambios) => {
      setDatos((d) => ({
        ...d,
        casos: d.casos.map((c) => (c.id === casoId ? { ...c, ...cambios } : c)),
      }));
      escribirConColumnasNuevas("caso", { id: casoId, ...cambios }, ["descuento"]);
    };

    const incorporarCasoApi = ({ caso, cliente, turno, evento, eventos = [] }) => setDatos((d) => ({
      ...d,
      casos: caso ? (d.casos.some((x) => x.id === caso.id)
        ? d.casos.map((x) => x.id === caso.id ? caso : x) : [caso, ...d.casos]) : d.casos,
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
      // El interruptor de MIGRACION.md. Las pantallas sólo lo usan durante
      // la transición para no mezclar una entrega nueva con las escrituras
      // antiguas a Supabase.
      casosPorApi: porLaApi("casos"),
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
        if (porLaApi("casos")) {
          const r = await llamarCasos("/casos", {
            servicio, identificador: identificador || null, responsable_id: responsableId || null,
            turno_id: turnoId, ...(clienteId
              ? { cliente_id: clienteId, telefono: telefono || null }
              : { cliente: { nombre: nombreCliente, telefono: telefono || null } }),
          }, { idempotencia: nuevaClave() });
          if (!r.ok) { setAviso(r.error.mensaje); return null; }
          incorporarCasoApi(r.datos);
          return r.datos.caso;
        }
        // El cliente se puede dar de alta desde la misma pantalla: el mostrador
        // está apurado y con el cliente enfrente.
        const cliente = clienteId
          ? null
          : {
              id: nuevoId(),
              negocio_id: datos.negocio.id,
              nombre: nombreCliente,
              telefono,
              notas: "",
            };
        const idCliente = clienteId ?? cliente.id;

        const numero = Math.max(0, ...datos.casos.map((c) => c.numero)) + 1;

        // El nombre con el que nace, según lo elegido en Mi negocio (SCRUM-119).
        // Si el cliente ya existía se usa su nombre guardado y no lo que se
        // tipeó: el alta lo reconoce sin mirar mayúsculas, y "hugo peralta"
        // tiene que dar un caso que se llame "Hugo Peralta".
        const nombreDelCliente = clienteId
          ? datos.clientes.find((c) => c.id === clienteId)?.nombre
          : nombreCliente;
        const nombre = nombreInicial(datos.negocio?.nombrar_casos, {
          cliente: nombreDelCliente,
          identificador,
          servicio,
        });

        const caso = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          numero,
          nombre,
          cliente_id: idCliente,
          servicio,
          identificador: identificador || null,
          estado: responsableId ? "en_proceso" : "nuevo",
          responsable_id: responsableId || null,
          que_falta: queFaltaPara(
            datos.negocio?.rubro,
            responsableId ? "en_proceso" : "nuevo"
          ),
          abierto_en: new Date().toISOString(),
        };
        const evento = nuevoEvento({
          casoId: caso.id,
          tipo: "entro",
          titulo: "Caso abierto",
          detalle: servicio + ".",
          icono: "carpeta",
          cuando: caso.abierto_en,
        });

        // Abrir un caso es la prueba de que la persona vino: si estaba
        // anotada desde un turno y nunca había aparecido, queda confirmada.
        const porConfirmar = datos.clientes.find(
          (c) => c.id === idCliente && c.confirmado === false
        );

        // Si el caso sale de un turno, ese turno queda atendido y apuntando
        // acá: la agenda deja de pedir que se confirme algo que ya pasó, y
        // desde el turno se llega al trabajo que salió de él.
        const delTurno = turnoId
          ? { caso_id: caso.id, estado: "atendido" }
          : null;

        setDatos((d) => ({
          ...d,
          clientes: cliente
            ? [...d.clientes, cliente]
            : d.clientes.map((c) =>
                c.id === idCliente
                  ? { ...c, ...(telefono ? { telefono } : {}), confirmado: true }
                  : c
              ),
          casos: [caso, ...d.casos],
          eventos: [evento, ...d.eventos],
          turnos: delTurno
            ? d.turnos.map((t) => (t.id === turnoId ? { ...t, ...delTurno } : t))
            : d.turnos,
        }));

        // En orden y esperando cada una: el caso apunta al cliente, y la
        // política de `evento` exige que su caso ya exista. Si salieran las
        // tres a la vez, la base podría recibirlas al revés y rechazarlas.
        (async () => {
          if (cliente) await escribir("cliente", cliente, { insertar: true });
          else if (telefono || porConfirmar)
            await escribir("cliente", {
              id: idCliente,
              ...(telefono ? { telefono } : {}),
              confirmado: true,
            });
          await escribir("caso", caso, { insertar: true });
          await escribirEvento(evento);
          // Último: el turno apunta al caso, así que el caso ya tiene que estar.
          if (delTurno) await escribir("turno", { id: turnoId, ...delTurno });
        })();

        return caso;
      },

      async asignarResponsable(casoId, empleadoId) {
        if (porLaApi("casos")) {
          const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/asignar`, { responsable_id: empleadoId });
          if (!r.ok) return setAviso(r.error.mensaje);
          incorporarCasoApi(r.datos); return r.datos.caso;
        }
        const persona = datos.empleados.find((e) => e.id === empleadoId);
        parchearCaso(casoId, {
          responsable_id: empleadoId,
          estado: "en_proceso",
          que_falta: queFaltaPara(datos.negocio?.rubro, "en_proceso"),
        });
        anotar({
          casoId,
          tipo: "estado",
          // Asignar mueve el caso a "en proceso", así que el evento lleva el
          // estado: es lo que la línea de tiempo del cliente usa para poner
          // la fecha de esa etapa (021/018). Sin esto, un caso que arrancó
          // por acá se veía sin fecha en "está en el taller".
          estado: "en_proceso",
          titulo: "Asignaron el caso",
          detalle: `Lo va a atender ${persona?.nombre ?? "alguien del equipo"}.`,
          icono: "persona-mas",
        });
      },

      // ---------- diagnóstico e identificador (SCRUM-50 y SCRUM-51) ----------
      // "servicio" es lo que pidió el cliente; "diagnostico" es lo que se
      // encontró al revisar. Son dos cosas distintas y las dos quedan.
      async cargarDiagnostico(casoId, diagnostico) {
        if (porLaApi("casos")) {
          const actual = datos.casos.find((c) => c.id === casoId);
          const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}`, { diagnostico, actualizado_en: actual?.actualizado_en }, { metodo: "PATCH" });
          if (!r.ok) return setAviso(r.error.mensaje);
          incorporarCasoApi(r.datos); return r.datos.caso;
        }
        const antes = datos.casos.find((c) => c.id === casoId)?.diagnostico;
        parchearCaso(casoId, { diagnostico });
        anotar({
          casoId,
          tipo: "nota",
          titulo: antes ? "Corrigieron el diagnóstico" : "Cargaron el diagnóstico",
          detalle: diagnostico,
          icono: "diagnostico",
        });
      },

      // Cambiar el identificador también va al historial. Es el dato por el
      // que se busca el caso: si alguien lo cambia y no queda rastro, quien
      // lo buscaba por el anterior no tiene dónde enterarse. Por eso el
      // valor viejo va en el detalle y no se pierde.
      async ponerIdentificador(casoId, identificador) {
        if (porLaApi("casos")) {
          const actual = datos.casos.find((c) => c.id === casoId);
          const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}`, { identificador, actualizado_en: actual?.actualizado_en }, { metodo: "PATCH" });
          if (!r.ok) return setAviso(r.error.mensaje);
          incorporarCasoApi(r.datos); return r.datos.caso;
        }
        const antes = datos.casos.find((c) => c.id === casoId)?.identificador;
        if (antes === identificador) return;

        parchearCaso(casoId, { identificador });

        const comoIdent = comoSeIdentifica(datos.negocio?.rubro);
        anotar({
          casoId,
          tipo: "nota",
          titulo: antes ? `Corrigieron ${comoIdent.enFrase}` : `Cargaron ${comoIdent.enFrase}`,
          detalle: antes ? `${identificador}. Antes decía ${antes}.` : identificador,
          icono: "nota",
        });
      },

      // Editar el caso (SCRUM-119): el nombre y lo que pidió el cliente. Los
      // dos juntos y en una sola escritura, porque en la pantalla son un solo
      // "Guardar". Cada cambio queda en el historial, como la patente.
      async editarCaso(casoId, { nombre, servicio }) {
        const caso = datos.casos.find((c) => c.id === casoId);
        if (!caso) return;
        if (porLaApi("casos")) {
          const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}`, {
            nombre: nombre.trim() || null, servicio: servicio.trim(), actualizado_en: caso.actualizado_en,
          }, { metodo: "PATCH" });
          if (!r.ok) return setAviso(r.error.mensaje);
          incorporarCasoApi(r.datos); return r.datos.caso;
        }

        const cambios = {
          // Vacío es "sin nombre": el caso vuelve a verse como "Caso 271".
          nombre: nombre.trim() || null,
          servicio: servicio.trim(),
        };
        // Lo que pidió el cliente no puede quedar vacío: pisarlo con nada
        // perdería el dato. La pantalla ya no deja, esto es por si acaso.
        if (!cambios.servicio) return;

        const nombreAntes = caso.nombre?.trim() || null;
        const cambioNombre = nombreAntes !== cambios.nombre;
        const cambioServicio = caso.servicio !== cambios.servicio;
        if (!cambioNombre && !cambioServicio) return;

        parchearCaso(casoId, cambios);

        if (cambioNombre) {
          anotar({
            casoId,
            tipo: "nota",
            titulo: cambios.nombre ? "Le cambiaron el nombre al caso" : "Le sacaron el nombre al caso",
            detalle: cambios.nombre
              ? `${cambios.nombre}. Antes era ${nombreAntes ?? `Caso ${caso.numero}`}.`
              : `Vuelve a verse como Caso ${caso.numero}. Antes era ${nombreAntes}.`,
            icono: "nota",
          });
        }
        if (cambioServicio) {
          anotar({
            casoId,
            tipo: "nota",
            titulo: "Corrigieron lo que necesita",
            detalle: `${cambios.servicio}. Antes decía ${caso.servicio}.`,
            icono: "nota",
          });
        }
      },

      // Una nota suelta en el historial (SCRUM-52). No pisa nada: el
      // historial se agrega, nunca se reescribe.
      async anotarNota(casoId, texto) {
        if (porLaApi("casos")) {
          const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/notas`, { texto }, { idempotencia: nuevaClave() });
          if (!r.ok) return setAviso(r.error.mensaje);
          incorporarCasoApi({ evento: r.datos }); return r.datos;
        }
        anotar({ casoId, tipo: "nota", titulo: "Anotaron algo", detalle: texto, icono: "nota" });
      },

      // "tambien" son columnas del caso que ese mismo cambio de estado deja
      // escritas. Hoy la usa una sola pantalla: al entregar se registra el
      // cobro (SCRUM-74), y cerrar y cobrar son una sola cosa para el negocio.
      // Va acá y no en una función aparte para que sea una sola escritura a la
      // base: dos dejarían el caso cerrado y sin cobro si la segunda falla.
      //
      // Entregar es un cambio de estado, pero en el historial va aparte: es
      // lo que más se quiere contar ("cuándo terminan", dice SCRUM-75).
      async cambiarEstado(casoId, estado, queFalta, textoHistorial, tambien = {}, { notificarCliente = false } = {}) {
        if (porLaApi("casos") && estado !== "completado") {
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
        }
        parchearCaso(casoId, { estado, que_falta: queFalta, ...tambien });
        anotar({
          casoId,
          tipo: estado === "completado" ? "entrega" : "estado",
          titulo: textoHistorial.titulo,
          detalle: textoHistorial.detalle,
          icono: textoHistorial.icono,
          estado,
        });
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

        let nuevo;
        let eventoDeLaApi = null;
        if (porLaApi("casos")) {
          const r = await mandar(`/casos/${encodeURIComponent(casoId)}/cobros`, {
            monto: Number(monto), medio, nota,
          }, await tokenDeSesion(), { idempotencia: nuevaClave() });
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          nuevo = r.datos.cobro ?? r.datos;
          eventoDeLaApi = r.datos.evento ?? null;
        } else {
          const ahora = new Date().toISOString();
          nuevo = {
            id: nuevoId(),
            negocio_id: datos.negocio.id,
            caso_id: casoId,
            monto: Number(monto),
            medio,
            estado: "pagado",
            nota: nota?.trim() || null,
            creado_en: ahora,
            pagado_en: ahora,
          };
        }

        setDatos((d) => ponerCobro(d, nuevo, { adoptarLoViejo: !enServidor(), nuevoId }));
        if (eventoDeLaApi) setDatos((d) => ({ ...d, eventos: [eventoDeLaApi, ...d.eventos] }));
        else if (!porLaApi("casos")) anotar({
          casoId,
          tipo: "plata",
          titulo: "Cobraron",
          detalle: `${pesos(Number(monto))} · ${medioDe(medio).palabra}`,
          icono: "listo",
          monto: Number(monto),
        });
        return { ok: true, cobro: nuevo };
      },

      // Lo que no se le cobra: un descuento, una cortesía, una garantía. Va
      // en el caso y no como cobro, porque no es plata que entra. "monto" es
      // el descuento total que queda (0 lo saca).
      async cambiarDescuento(casoId, monto, { antes = 0 } = {}) {
        const nuevo = Math.max(0, Number(monto) || 0);
        if (porLaApi("casos")) {
          const r = await reemplazar(`/casos/${encodeURIComponent(casoId)}/descuento`, { monto: nuevo }, await tokenDeSesion());
          if (!r.ok) { setAviso(r.error.mensaje); return { ok: false, error: r.error.mensaje }; }
          setDatos((d) => ({ ...d, casos: d.casos.map((c) => c.id === casoId ? r.datos.caso ?? r.datos : c) }));
          if (r.datos.evento) setDatos((d) => ({ ...d, eventos: [r.datos.evento, ...d.eventos] }));
          return { ok: true };
        }
        parchearCaso(casoId, { descuento: nuevo });
        anotar({
          casoId,
          tipo: "plata",
          titulo: nuevo > 0 ? "No le cobran una parte" : "Sacaron el descuento",
          detalle:
            nuevo > 0
              ? `Descuento de ${pesos(nuevo)}.`
              : `Ya no se descuentan ${pesos(Number(antes))}: vuelve a figurar como por cobrar.`,
          icono: nuevo > 0 ? "nota" : "deshacer",
          monto: nuevo > 0 ? nuevo : Number(antes),
        });
        return { ok: true };
      },

      // ---------- pagos por link o QR (la API de pagos) ----------
      //
      // Qué se puede hoy: de verdad (hay API), simulado (modo de ejemplo) o
      // nada (Supabase sin API todavía). Lo lee la pantalla para decidir si
      // ofrece el botón o lo muestra apagado con el motivo.
      pagosEnLinea: pagosEnLinea({ esDemo }),

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

        const enLinea = pagosEnLinea({ esDemo });
        if (!enLinea.disponible) return { ok: false, error: "Todavía no está conectado el sistema de pagos." };

        let nuevo;
        let eventoDeLaApi = null;
        if (enLinea.simulado) {
          const ahora = new Date();
          nuevo = {
            id: nuevoId(),
            negocio_id: datos.negocio.id,
            caso_id: casoId,
            monto: Number(monto),
            medio,
            estado: "pendiente",
            proveedor: "simulado",
            link: null,
            vence_en: new Date(ahora.getTime() + 3 * 86400000).toISOString(),
            creado_en: ahora.toISOString(),
          };
        } else {
          const token = await tokenDeSesion();
          if (!token) return { ok: false, error: "Tu sesión venció. Volvé a entrar y probá de nuevo." };
          if (porLaApi("casos")) {
            const r = await mandar(`/casos/${encodeURIComponent(casoId)}/cobros/en-linea`, {
              monto: Number(monto), medio,
            }, token, { idempotencia: nuevaClave() });
            if (!r.ok) return { ok: false, error: r.error.mensaje };
            nuevo = r.datos.cobro;
            eventoDeLaApi = r.datos.evento ?? null;
          } else {
            const r = await pedirPagoEnLinea({ casoId, monto, medio, token });
            if (!r.ok) return { ok: false, error: r.error };
            nuevo = r.cobro;
            eventoDeLaApi = r.evento;
          }
        }

        setDatos((d) => ponerCobro(d, nuevo, { nuevoId }));
        // Por /v1 el renglón lo anota la API y lo devuelve: anotarlo acá
        // también lo dejaba repetido en el historial. Sólo el modo de ejemplo,
        // que no tiene API, lo anota el front.
        if (eventoDeLaApi) setDatos((d) => ({ ...d, eventos: [eventoDeLaApi, ...d.eventos] }));
        else if (enLinea.simulado && !datos.cobros.some((c) => c.id === nuevo.id)) anotar({
          casoId,
          tipo: "plata",
          titulo: medio === "qr" ? "Pidieron un pago con QR" : "Pidieron un pago por link",
          detalle: `${pesos(Number(monto))} · esperando el pago`,
          icono: "reloj",
          monto: Number(monto),
        });
        return { ok: true, cobro: nuevo };
      },

      // Sólo en el modo de ejemplo: hacer de cuenta que el medio de pago
      // avisó. Con la API, esto lo hace el webhook del lado del servidor.
      simularPago(cobroId, resultado = "pagado") {
        if (!pagosEnLinea({ esDemo }).simulado) return { ok: false };
        const cobro = datos.cobros.find((c) => c.id === cobroId);
        if (!cobro || cobro.estado !== "pendiente") return { ok: false };
        const ahora = new Date().toISOString();
        const nuevo = {
          ...cobro,
          estado: resultado,
          pagado_en: resultado === "pagado" ? ahora : null,
        };
        setDatos((d) => ponerCobro(d, nuevo, { nuevoId }));
        anotar({
          casoId: cobro.caso_id,
          tipo: "plata",
          titulo:
            resultado === "pagado"
              ? "Entró un pago"
              : resultado === "vencido"
                ? "Venció un pedido de pago"
                : "No pasó un pago",
          detalle: `${pesos(Number(cobro.monto))} · ${medioDe(cobro.medio).palabra}`,
          icono: resultado === "pagado" ? "listo" : "alerta",
          monto: Number(cobro.monto),
        });
        return { ok: true };
      },

      // Volver a leer los cobros de un caso: lo que cambió del otro lado
      // (un pago que entró por link) no llega solo. Devuelve los que pasaron
      // a pagado desde la última vez, para que la pantalla lo pueda contar.
      async refrescarCobros(casoId) {
        if (!enServidor()) return { ok: true, pagados: [] };
        const r = await traer(`/casos/${encodeURIComponent(casoId)}/cobros`, await tokenDeSesion());
        if (!r.ok) return { ok: false, pagados: [] };
        const nuevos = r.datos ?? [];
        const antes = new Map(datos.cobros.filter((c) => c.caso_id === casoId).map((c) => [c.id, c.estado]));
        const pagados = nuevos.filter((c) => c.estado === "pagado" && antes.get(c.id) === "pendiente");
        setDatos((d) => nuevos.reduce(
          (actual, cobro) => ponerCobro(actual, cobro, { nuevoId }),
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

        let anulado;
        const enLinea = pagosEnLinea({ esDemo });
        let eventoDeLaApi = null;
        if (porLaApi("casos") && !enLinea.simulado) {
          const r = await mandar(`/cobros/${encodeURIComponent(cobroId)}/anular`, { motivo },
            await tokenDeSesion(), { idempotencia: nuevaClave() });
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          anulado = r.datos.cobro;
          eventoDeLaApi = r.datos.evento ?? null;
        } else if (cobro.estado === "pendiente" && MEDIOS_EN_LINEA.includes(cobro.medio) && !enLinea.simulado) {
          // Además de anularlo en la tabla hay que dar de baja el link en el
          // medio de pago: si no, el cliente todavía podría pagarlo. Eso lo
          // hace la API, que es la única que habla con él.
          const token = await tokenDeSesion();
          const r = await anularPagoEnLinea({ cobroId, motivo, token });
          if (!r.ok) return { ok: false, error: r.error };
          anulado = r.cobro;
        } else {
          anulado = {
            ...cobro,
            estado: "anulado",
            anulado_en: new Date().toISOString(),
            motivo_anulacion: motivo?.trim() || null,
          };
        }

        setDatos((d) => ponerCobro(d, anulado, { nuevoId }));
        if (eventoDeLaApi) setDatos((d) => ({ ...d, eventos: [eventoDeLaApi, ...d.eventos] }));
        else if (!porLaApi("casos")) anotar({
          casoId: cobro.caso_id,
          tipo: "plata",
          titulo: "Anularon un cobro",
          detalle:
            `${pesos(Number(cobro.monto))} · ${medioDe(cobro.medio).palabra}` +
            (motivo?.trim() ? ` · ${motivo.trim()}` : ""),
          icono: "cruz",
          monto: Number(cobro.monto),
        });
        return { ok: true, cobro: anulado };
      },

      // La API guarda cobro, descuento, cierre e historial en la misma
      // transacción. Esta acción sólo existe en el camino nuevo; el formulario
      // conserva abajo el camino anterior mientras el interruptor esté apagado.
      async consultarSeguimiento() {
        const r = await traer("/negocio/seguimiento", await tokenDeSesion());
        return r.ok ? { ok: true, configuracion: r.datos } : { ok: false, error: r.error.mensaje };
      },

      async configurarSeguimiento(cambios) {
        const r = await parchar("/negocio/seguimiento", cambios, await tokenDeSesion());
        return r.ok ? { ok: true, configuracion: r.datos } : { ok: false, error: r.error.mensaje };
      },

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
          if (r.datos.cobro) siguiente = ponerCobro(siguiente, r.datos.cobro, { nuevoId });
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

        let cuando = hecho ? new Date().toISOString() : null;

        if (porLaApi("casos")) {
          const r = await llamarCasos(`/pasos/${encodeURIComponent(pasoId)}/hecho`, { hecho: Boolean(hecho) });
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          setDatos((d) => ({ ...d,
            pasos: d.pasos.map((x) => x.id === pasoId ? r.datos.paso : x),
            eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos,
          }));
          return { ok: true, cambio: r.datos.cambio };
        }

        setDatos((d) => ({
          ...d,
          pasos: d.pasos.map((x) => (x.id === pasoId ? { ...x, hecho_en: cuando } : x)),
        }));

        anotar({
          casoId: paso.caso_id,
          tipo: "estado",
          titulo: hecho ? "Terminaron un paso" : "Volvieron atrás un paso terminado",
          detalle: `${paso.nombre} · ${pesos(paso.monto)}`,
          icono: hecho ? "listo" : "deshacer",
        });

        return { ok: true, cambio: true };
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

        if (porLaApi("casos")) {
          const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/compartir`, {});
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          incorporarCasoApi(r.datos);
          return { ok: true, codigo: r.datos.codigo, quedaEsperando: r.datos.queda_esperando };
        }

        // Mandar el link deja el caso esperando al cliente SÓLO si hay algo
        // que el cliente tenga que contestar. Es lo que pasa cuando se manda
        // el presupuesto, que es de donde salió esta regla.
        //
        // No es lo que pasa cuando se comparte para avisar que el trabajo ya
        // está: ahí no se espera nada de él, y mover el caso a "esperando"
        // sería decir que la pelota es suya cuando no hay nada que contestar
        // —y encima saca al caso de control final, que es donde tiene que
        // estar hasta que lo vengan a buscar—.
        const hayQueContestar = datos.pasos.some(
          (p) => p.caso_id === casoId && p.estado === "esperando"
        );
        const quedaEsperando =
          hayQueContestar && caso.estado !== "completado" && caso.estado !== "esperando";
        const pasarAEsperando = () => {
          if (!quedaEsperando) return;
          parchearCaso(casoId, {
            estado: "esperando",
            que_falta: ESPERA_AL_CLIENTE,
          });
          anotar({
            casoId,
            tipo: "estado",
            estado: "esperando",
            titulo: "Le compartieron el link al cliente",
            detalle: "El caso queda esperando su respuesta.",
            icono: "reloj",
          });
        };

        const codigo = codigoAlAzar();
        parchearCaso(casoId, { seguimiento_codigo: codigo, seguimiento_visto_en: null });
        pasarAEsperando();
        return { ok: true, codigo, quedaEsperando };
      },

      // El link anterior deja de funcionar en el mismo momento. La fecha de
      // la última visita se va con él: es de ese link, no del caso.
      async dejarDeCompartirCaso(casoId) {
        if (porLaApi("casos")) {
          const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/dejar-de-compartir`, {});
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          setDatos((d) => ({ ...d, casos: d.casos.map((c) => c.id === casoId
            ? { ...c, seguimiento_codigo: null, seguimiento_visto_en: null } : c) }));
          return { ok: true };
        }
        parchearCaso(casoId, { seguimiento_codigo: null, seguimiento_visto_en: null });
        return { ok: true };
      },

      // ---------- pasos del presupuesto ----------
      // Armar el presupuesto es sumar pasos de a uno (SCRUM-59). Cada paso
      // nace esperando la respuesta del cliente: el presupuesto se aprueba
      // parte por parte, nunca todo junto.
      async agregarPaso({ casoId, nombre, descripcion, monto }) {
        if (porLaApi("casos")) {
          const r = await llamarCasos(`/casos/${encodeURIComponent(casoId)}/pasos`,
            { nombre, descripcion: descripcion || null, monto: Number(monto) }, { idempotencia: nuevaClave() });
          if (!r.ok) { setAviso(r.error.mensaje); return null; }
          setDatos((d) => ({ ...d, pasos: [...d.pasos, r.datos.paso],
            eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos }));
          return r.datos.paso;
        }
        const delCaso = datos.pasos.filter((p) => p.caso_id === casoId);
        const paso = {
          id: nuevoId(),
          caso_id: casoId,
          nombre,
          descripcion: descripcion || "",
          monto: Number(monto),
          estado: "esperando",
          orden: Math.max(0, ...delCaso.map((p) => p.orden ?? 0)) + 1,
          // Desde cuándo el cliente tiene la pelota. En Supabase lo pone la
          // base sola (creado_en default now()); acá hay que escribirlo, o el
          // modo de ejemplo se quedaría sin la fecha.
          creado_en: new Date().toISOString(),
        };
        setDatos((d) => ({ ...d, pasos: [...d.pasos, paso] }));
        escribir("paso", paso, { insertar: true });
        anotar({
          casoId,
          tipo: "plata",
          titulo: "Sumaron un paso al presupuesto",
          detalle: `${nombre} · ${pesos(monto)}`,
          icono: "nota",
          monto,
        });
        return paso;
      },

      // Sólo se borra lo que todavía está esperando respuesta. Un rechazado
      // primero vuelve a esperar respuesta; uno aprobado no se borra nunca,
      // porque es un acuerdo con el cliente (015_paso_aprobado_fijo.sql).
      async eliminarPaso(pasoId) {
        const paso = datos.pasos.find((p) => p.id === pasoId);
        if (!paso || paso.estado !== "esperando") return;

        if (porLaApi("casos")) {
          const r = await llamarCasos(`/pasos/${encodeURIComponent(pasoId)}`, undefined, { metodo: "DELETE" });
          if (!r.ok) return setAviso(r.error.mensaje);
          setDatos((d) => ({ ...d, pasos: d.pasos.filter((p) => p.id !== pasoId),
            eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos }));
          return r.datos.id;
        }

        setDatos((d) => ({ ...d, pasos: d.pasos.filter((p) => p.id !== pasoId) }));
        borrar("paso", pasoId);
        anotar({
          casoId: paso.caso_id,
          tipo: "plata",
          titulo: "Sacaron un paso del presupuesto",
          detalle: `${paso.nombre} · ${pesos(paso.monto)}`,
          icono: "nota",
          monto: paso.monto,
        });
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

        if (porLaApi("casos")) {
          const r = await llamarCasos(`/pasos/${encodeURIComponent(pasoId)}/responder`, { estado });
          if (!r.ok) return setAviso(r.error.mensaje);
          setDatos((d) => ({ ...d, pasos: d.pasos.map((p) => p.id === pasoId ? r.datos.paso : p),
            eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos }));
          return r.datos.paso;
        }

        const cambios =
          estado === "aprobado"
            ? { estado, aprobado_en: new Date().toISOString() }
            : { estado };

        setDatos((d) => ({
          ...d,
          pasos: d.pasos.map((p) => (p.id === pasoId ? { ...p, ...cambios } : p)),
        }));
        escribirConColumnasNuevas("paso", { id: pasoId, ...cambios }, ["aprobado_en"]);

        const dicho = {
          aprobado: "Lo aprobó el cliente",
          rechazado: "El cliente no lo hace",
          esperando: "Volvieron atrás la respuesta",
        }[estado];
        anotar({
          casoId: paso.caso_id,
          tipo: "plata",
          titulo: dicho,
          detalle: `${paso.nombre} · ${pesos(paso.monto)}`,
          icono: estado === "aprobado" ? "listo" : "nota",
          monto: paso.monto,
        });
      },

      // ---------- inventario ----------
      // Llegó lo que se había pedido. El caso se destraba SÓLO si ya no le
      // falta nada: la regla vive en alLlegarInsumo() (estados.js), que tiene
      // prueba. Antes se pasaba a "en proceso" siempre, aunque faltara otra
      // pieza o el caso estuviera cerrado.
      async marcarInsumoLlegado(insumoId) {
        const insumo = datos.insumos.find((i) => i.id === insumoId);
        if (!insumo) return null;
        if (porLaApi("casos")) {
          const r = await llamarCasos(`/insumos/${encodeURIComponent(insumoId)}/llego`, {}, { idempotencia: nuevaClave() });
          if (!r.ok) { setAviso(r.error.mensaje); return null; }
          setDatos((d) => ({ ...d,
            insumos: r.datos.sumado ? d.insumos.filter((i) => i.id !== insumoId).map((i) => i.id === r.datos.insumo.id ? r.datos.insumo : i)
              : d.insumos.map((i) => i.id === insumoId ? r.datos.insumo : i),
            casos: r.datos.caso ? d.casos.map((c) => c.id === r.datos.caso.id ? r.datos.caso : c) : d.casos,
            eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos,
          }));
          return r.datos.despues;
        }
        const rubro = datos.negocio?.rubro;
        const { articulo } = vocabulario(rubro);

        // Al llegar pasa al stock. Si en el stock ya hay uno igual, se le suma
        // y el pedido desaparece: es la misma regla que el alta, y sin ella
        // cada reposición dejaba una fila más del mismo producto.
        const igual = buscarIgual(datos.insumos, { ...insumo, estado: "en_stock" });
        const llegar = (lista) =>
          igual
            ? lista
                .filter((i) => i.id !== insumoId)
                .map((i) => (i.id === igual.id ? { ...i, cantidad: i.cantidad + insumo.cantidad } : i))
            : lista.map((i) => (i.id === insumoId ? { ...i, estado: "en_stock", caso_id: null } : i));
        const insumosDespues = llegar(datos.insumos);

        setDatos((d) => ({ ...d, insumos: llegar(d.insumos) }));
        if (igual) {
          escribir("insumo", { id: igual.id, cantidad: igual.cantidad + insumo.cantidad });
          borrar("insumo", insumoId);
        } else {
          escribir("insumo", { id: insumoId, estado: "en_stock", caso_id: null });
        }

        if (!insumo.caso_id) return null;
        const caso = datos.casos.find((c) => c.id === insumo.caso_id);
        const despues = alLlegarInsumo(caso, {
          rubro,
          pasos: datos.pasos,
          insumos: insumosDespues,
          cliente: datos.clientes.find((c) => c.id === caso?.cliente_id),
        });

        // Igual se anota que llegó, aunque el caso no se mueva: es lo que
        // pasó, y el historial es de lo que pasó.
        anotar({
          casoId: insumo.caso_id,
          tipo: "estado",
          titulo: `Llegó ${articulo.el()}`,
          detalle: despues?.cambiaEstado
            ? `${insumo.nombre}. Ya se puede seguir.`
            : `${insumo.nombre}.`,
          icono: "camion",
          // El estado va sólo si cambió: es lo que dibuja la línea de tiempo
          // que ve el cliente, y un punto sin cambio la ensuciaría.
          estado: despues?.cambiaEstado ? despues.estado : null,
        });
        if (despues) {
          parchearCaso(insumo.caso_id, { estado: despues.estado, que_falta: despues.que_falta });
        }
        // Devuelve qué pasó con el caso, para que la pantalla pueda decir si
        // ya puede seguir o si sigue esperando otra cosa. null si no se tocó.
        return despues;
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
        if (porLaApi("casos")) {
          const r = await llamarCasos("/insumos/pedidos", { ...productoParaLaApi(form), caso_id: casoId || null }, { idempotencia: nuevaClave() });
          if (!r.ok) { setAviso(r.error.mensaje); return null; }
          setDatos((d) => ({ ...d, insumos: [...d.insumos, r.datos.insumo],
            casos: r.datos.caso ? d.casos.map((c) => c.id === r.datos.caso.id ? r.datos.caso : c) : d.casos,
            eventos: r.datos.evento ? [r.datos.evento, ...d.eventos] : d.eventos }));
          return r.datos.insumo;
        }
        const rubro = datos.negocio?.rubro;
        const { articulo } = vocabulario(rubro);
        const producto = limpiarProducto(form);
        const insumo = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          descripcion: null,
          ...producto,
          cantidad: Math.max(1, producto.cantidad),
          estado: "pedido",
          caso_id: casoId || null,
        };
        setDatos((d) => ({ ...d, insumos: [...d.insumos, insumo] }));
        escribir("insumo", insumo, { insertar: true });

        if (!casoId) return insumo;
        const caso = datos.casos.find((c) => c.id === casoId);
        const despues = alPedirInsumo(caso, {
          rubro,
          pasos: datos.pasos,
          insumos: [...datos.insumos, insumo],
          cliente: datos.clientes.find((c) => c.id === caso?.cliente_id),
        });
        if (!despues) return insumo;

        parchearCaso(casoId, { estado: despues.estado, que_falta: despues.que_falta });
        anotar({
          casoId,
          tipo: "estado",
          titulo: `Se pidió ${articulo.el()}`,
          detalle: `${insumo.nombre}. El caso queda esperándolo.`,
          icono: "camion",
          estado: despues.cambiaEstado ? despues.estado : null,
        });
        return insumo;
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
        if (porLaApi("inventario")) {
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
        }

        const producto = limpiarProducto(form);
        const igual = buscarIgual(datos.insumos, producto);

        if (igual) {
          const cantidad = igual.cantidad + producto.cantidad;
          setDatos((d) => ({
            ...d,
            insumos: d.insumos.map((i) => (i.id === igual.id ? { ...i, cantidad } : i)),
          }));
          escribir("insumo", { id: igual.id, cantidad });
          return { sumado: true, insumo: { ...igual, cantidad }, antes: igual.cantidad };
        }

        const insumo = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          descripcion: null,
          ...producto,
          estado: "en_stock",
          caso_id: null,
        };
        setDatos((d) => ({ ...d, insumos: [...d.insumos, insumo] }));
        // Si la base todavía no tiene las columnas nuevas (031 y 032), el
        // producto se guarda igual, sin ellas.
        escribirConColumnasNuevas("insumo", insumo, COLUMNAS_NUEVAS_DE_INSUMO, { insertar: true });
        return { sumado: false, insumo, antes: null };
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
        let resultado;
        if (porLaApi("inventario")) {
          const r = await reemplazar(`/insumos/${insumoId}`, productoParaLaApi(form), await tokenDeSesion());
          if (!r.ok) {
            setAviso(r.error.mensaje);
            return null;
          }
          resultado = r.datos;
        } else {
          const producto = limpiarProducto(form);
          const igual = igualAlEditar(datos.insumos, actual, form);
          resultado = igual
            ? { insumo: { ...igual, cantidad: igual.cantidad + producto.cantidad }, borrado: insumoId }
            : {
                insumo: {
                  ...actual,
                  ...producto,
                  cantidad: actual.estado === "pedido" ? Math.max(1, producto.cantidad) : producto.cantidad,
                },
                borrado: null,
              };
        }
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
        if (porLaApi("inventario")) {
          enLaApi((token) => quitar(`/insumos/${insumoId}`, token));
          return;
        }
        borrar("insumo", insumoId);
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
        if (porLaApi("equipo")) {
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
        }
        escribir("empleado", empleado, { insertar: true });
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
        if (porLaApi("equipo")) {
          enLaApi((token) => parchar(`/equipo/${empleadoId}/rol`, { rol }, token));
          return;
        }
        escribir("empleado", { id: empleadoId, rol });
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
        if (porLaApi("equipo")) {
          enLaApi((token) => mandar(`/equipo/${empleadoId}/sacar`, {}, token));
          return;
        }
        borrar("empleado", empleadoId);
      },

      // ---------- invitaciones ----------
      // El código lo genera la base, no el navegador: tiene que ser difícil
      // de adivinar y no depender de lo que corra en la máquina de nadie.
      async crearInvitacion({ rol, usosMaximos, dias }) {
        if (!enServidor()) {
          return {
            ok: false,
            error: "Las invitaciones no están disponibles en el modo de ejemplo.",
          };
        }
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
        if (porLaApi("equipo")) {
          enLaApi((token) => mandar(`/invitaciones/${id}/anular`, {}, token));
          return;
        }
        escribir("invitacion", { id, anulada: true });
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
        if (porLaApi("clientes")) {
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
        }
        escribir("cliente", cliente, { insertar: true });
        return cliente;
      },

      // Corregir el teléfono desde la ficha del cliente. Antes, uno mal
      // cargado no se podía arreglar en ningún lado.
      corregirTelefono(clienteId, telefono) {
        setDatos((d) => ({
          ...d,
          clientes: d.clientes.map((c) => (c.id === clienteId ? { ...c, telefono } : c)),
        }));
        if (porLaApi("clientes")) {
          enLaApi((token) => parchar(`/clientes/${clienteId}`, { telefono }, token));
          return;
        }
        escribir("cliente", { id: clienteId, telefono });
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
        if (porLaApi("turnos")) {
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
        }

        const cliente =
          clienteId || !nombreCliente?.trim()
            ? null
            : {
                id: nuevoId(),
                negocio_id: datos.negocio.id,
                nombre: nombreCliente.trim(),
                telefono: telefono?.trim() || null,
                notas: "",
                // Pidió un turno, pero todavía no vino. Se confirma cuando se
                // le abre el primer caso.
                confirmado: false,
              };

        const turno = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          cliente_id: clienteId || cliente?.id || null,
          caso_id: null,
          motivo,
          empieza_en: new Date(empiezaEn).toISOString(),
          estado: "agendado",
        };

        setDatos((d) => ({
          ...d,
          clientes: cliente ? [...d.clientes, cliente] : d.clientes,
          turnos: [...d.turnos, turno],
        }));

        // En orden: el turno apunta al cliente por clave foránea.
        (async () => {
          if (cliente) await escribir("cliente", cliente, { insertar: true });
          await escribir("turno", turno, { insertar: true });
        })();
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
        if (porLaApi("turnos")) {
          enLaApi((token) => mandar(`/turnos/${turnoId}/atender`, { caso_id: casoId }, token));
          return;
        }
        escribir("turno", { id: turnoId, estado: "atendido", caso_id: casoId });
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
        if (porLaApi("turnos")) {
          enLaApi((token) => mandar(`/turnos/${turnoId}/desatender`, {}, token));
          return;
        }
        escribir("turno", { id: turnoId, estado: "confirmado", caso_id: null });
      },

      // Confirmar, cancelar, y el "Deshacer" que vuelve al estado de antes.
      // Deshacer una cancelación puede chocar con otro turno que tomó el
      // lugar: con la API, el aviso lo dice y la agenda se vuelve a leer.
      cambiarEstadoTurno(turnoId, estado) {
        setDatos((d) => ({
          ...d,
          turnos: d.turnos.map((t) => (t.id === turnoId ? { ...t, estado } : t)),
        }));
        if (porLaApi("turnos")) {
          enLaApi((token) => parchar(`/turnos/${turnoId}`, { estado }, token));
          return;
        }
        escribir("turno", { id: turnoId, estado });
      },

      // ---------- negocio ----------
      // Crea el negocio al terminar el alta (SCRUM-12), en los dos modos: el
      // de ejemplo también empieza sin negocio y pasa por esta misma pantalla.
      //
      // Con Supabase va por crear_mi_negocio() y no por un insert suelto: así el negocio
      // y su vínculo con la cuenta se crean juntos o no se crean, y la tabla
      // `negocio` puede quedar sin política de insert (ver 005_rls.sql).
      async crearNegocio({ nombre, rubro }) {
        // En modo de ejemplo el negocio se arma en el navegador. Es el mismo
        // paso que con una cuenta real: sin negocio no hay dónde colgar los
        // casos, los clientes ni el inventario.
        if (!enServidor()) {
          const negocio = {
            id: nuevoId(),
            nombre,
            rubro,
            modulos_activos: preset(rubro).modulos ?? [],
          };
          setDatos((d) => ({ ...d, negocio }));
          return { ok: true, id: negocio.id };
        }
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
        if (porLaApi("negocio")) {
          enLaApi((token) => parchar("/negocio", { rubro }, token));
          return true;
        }
        escribir("negocio", { id: datos.negocio?.id, rubro });
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
        if (porLaApi("negocio")) {
          enLaApi((token) => parchar("/negocio", cambios, token));
          return;
        }
        escribirConColumnasNuevas("negocio", { id: datos.negocio?.id, ...cambios }, [
          "telefono",
        ]);
      },

      // Compartir la agenda: el link con el que un cliente pide turno solo
      // (024). Devuelve siempre el mismo código: uno nuevo dejaría muerto el
      // que el negocio ya puso en su perfil de Instagram.
      async compartirAgenda() {
        if (datos.negocio?.agenda_codigo)
          return { ok: true, codigo: datos.negocio.agenda_codigo };

        if (porLaApi("negocio")) {
          const r = await mandar("/negocio/agenda/compartir", {}, await tokenDeSesion());
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          setDatos((d) => ({ ...d, negocio: { ...d.negocio, agenda_codigo: r.datos.codigo } }));
          return { ok: true, codigo: r.datos.codigo };
        }

        const codigo = codigoAlAzar();
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, agenda_codigo: codigo } }));
        return { ok: true, codigo };
      },

      async dejarDeCompartirAgenda() {
        if (porLaApi("negocio")) {
          const r = await mandar("/negocio/agenda/dejar-de-compartir", {}, await tokenDeSesion());
          if (!r.ok) return { ok: false, error: r.error.mensaje };
        }
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, agenda_codigo: null } }));
        return { ok: true };
      },

      // El link del calendario (027). Es otro código y otro interruptor que el
      // de pedir turno, porque muestran cosas distintas a gente distinta: aquél
      // sólo horarios ocupados para cualquiera, éste los turnos con nombre y
      // teléfono para el dueño.
      async compartirCalendario() {
        if (!enServidor())
          return { ok: false, error: "Para generar un link que Google pueda leer, iniciá sesión con una cuenta." };
        if (datos.negocio?.ics_codigo)
          return { ok: true, codigo: datos.negocio.ics_codigo };

        if (porLaApi("negocio")) {
          const r = await mandar("/negocio/calendario/compartir", {}, await tokenDeSesion());
          if (!r.ok) return { ok: false, error: r.error.mensaje };
          setDatos((d) => ({ ...d, negocio: { ...d.negocio, ics_codigo: r.datos.codigo } }));
          return { ok: true, codigo: r.datos.codigo };
        }

        return { ok: false, error: "No se pudo generar el link del calendario." };
      },

      async dejarDeCompartirCalendario() {
        if (porLaApi("negocio")) {
          const r = await mandar("/negocio/calendario/dejar-de-compartir", {}, await tokenDeSesion());
          if (!r.ok) return { ok: false, error: r.error.mensaje };
        }
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, ics_codigo: null } }));
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
        if (porLaApi("turnos")) {
          (async () => {
            const r = await reemplazar("/negocio/horarios", horarios, await tokenDeSesion());
            if (!r.ok) {
              setAviso(r.error.mensaje);
              setRefresco((n) => n + 1);
              return;
            }
            setDatos((d) => ({ ...d, negocio: { ...d.negocio, horarios: r.datos.horarios } }));
          })();
          return;
        }
        escribirConColumnasNuevas("negocio", { id: datos.negocio?.id, horarios }, [
          "horarios",
        ]);
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
        if (porLaApi("negocio")) {
          enLaApi((token) => parchar("/negocio", { nombrar_casos: modo }, token));
          return;
        }
        escribir("negocio", { id: datos.negocio?.id, nombrar_casos: modo });
      },

      // Prende y apaga módulos (SCRUM-38). Recibe la lista completa nueva.
      cambiarModulos(claves) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, modulos_activos: claves } }));
        if (porLaApi("negocio")) {
          enLaApi((token) => reemplazar("/negocio/modulos", { valor: claves }, token));
          return;
        }
        escribir("negocio", { id: datos.negocio?.id, modulos_activos: claves });
      },

      // Cómo quedó acomodada la pantalla de Inicio. Recibe la lista completa,
      // igual que los módulos: qué se ve, en qué orden, de qué tamaño y con
      // qué filtro.
      cambiarInicio(config) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, inicio: config } }));
        if (porLaApi("negocio")) {
          enLaApi((token) => reemplazar("/negocio/inicio", { valor: config }, token));
          return;
        }
        escribir("negocio", { id: datos.negocio?.id, inicio: config });
      },

      // Borra todo lo cargado en el navegador y deja el modo de ejemplo como
      // recién empezado, sin negocio. Sirve para volver a mostrar el alta.
      reiniciar() {
        if (fuente !== "local") {
          setAviso("Esto sólo se puede en el modo de ejemplo. Tus datos en Supabase no se tocan.");
          return;
        }
        window.localStorage.removeItem(LLAVE);
        setDatos(construirSemilla());
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
  }, [datos, fuente, esDemo, usuario]);

  // El Inicio se sirve ya normalizado: las pantallas nunca ven una
  // configuración a medias guardada por una versión anterior.
  const valor = {
    ...datos,
    inicio: normalizarInicio(datos.negocio?.inicio),
    cargando,
    fuente,
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
