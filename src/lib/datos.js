"use client";

// Capa de datos con dos backends.
//
// Si hay credenciales de Supabase, lee y escribe contra la base.
// Si no las hay, guarda todo en el navegador (el modo de ejemplo).
// Las pantallas no se enteran de la diferencia: usan siempre estas funciones.
//
// Sirve para que los cuatro puedan clonar y levantar el proyecto sin esperar
// a que alguien reparta las claves, y para que la demo no dependa del wifi.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { comoSeIdentifica, preset, queFaltaPara } from "./presets";
import { pesos } from "./estados";
import { normalizarInicio } from "./inicio";
import { quienEscribe } from "./permisos";
import { construirSemilla } from "./semilla";

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
};

const Contexto = createContext(null);

const nuevoId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id" + Math.random().toString(36).slice(2);

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

// Lee sólo lo del negocio del usuario. El filtro por negocio_id es para no
// traer de más: el aislamiento de verdad lo hacen las políticas RLS
// (supabase/005_rls.sql), que ya no devolverían nada de otro negocio aunque
// acá pidiéramos todo.
async function leerDeSupabase(negocioId) {
  const [negocio, empleados, clientes, casos, insumos, turnos, invitaciones] =
    await Promise.all([
      supabase.from("negocio").select("*").eq("id", negocioId).maybeSingle(),
      supabase.from("empleado").select("*").eq("negocio_id", negocioId),
      supabase.from("cliente").select("*").eq("negocio_id", negocioId),
      supabase.from("caso").select("*").eq("negocio_id", negocioId),
      supabase.from("insumo").select("*").eq("negocio_id", negocioId),
      supabase.from("turno").select("*").eq("negocio_id", negocioId),
      supabase.from("invitacion").select("*").eq("negocio_id", negocioId),
    ]);

  const conError = [negocio, empleados, clientes, casos, insumos, turnos].find((r) => r.error);
  if (conError) throw conError.error;

  // "paso" y "evento" cuelgan del caso, no del negocio.
  const idsCaso = (casos.data ?? []).map((c) => c.id);
  let pasos = [];
  let eventos = [];
  if (idsCaso.length) {
    const [p, ev] = await Promise.all([
      supabase.from("paso").select("*").in("caso_id", idsCaso),
      supabase.from("evento").select("*").in("caso_id", idsCaso),
    ]);
    if (p.error) throw p.error;
    if (ev.error) throw ev.error;
    pasos = p.data ?? [];
    eventos = ev.data ?? [];
  }

  return {
    negocio: conModulos(negocio.data ?? null),
    empleados: empleados.data ?? [],
    clientes: clientes.data ?? [],
    casos: casos.data ?? [],
    pasos,
    eventos,
    insumos: insumos.data ?? [],
    turnos: turnos.data ?? [],
    // Si la migración de invitaciones todavía no corrió, el resto anda igual.
    invitaciones: invitaciones.error ? [] : (invitaciones.data ?? []),
  };
}

export function DatosProvider({ children }) {
  const { esDemo, usuario, cargando: authCargando } = useAuth();
  const [datos, setDatos] = useState(VACIO);
  const [cargando, setCargando] = useState(true);
  const [fuente, setFuente] = useState("local");
  const [aviso, setAviso] = useState(null);
  // Confirmamos con el dato que la persona acaba de escribir, así sabe que
  // guardó lo correcto (cartilla, sección 07).
  const [exito, setExito] = useState(null);
  // Lo que deshace la acción que se acaba de confirmar, si se puede deshacer.
  // Vive mientras el aviso esté en pantalla: el "Deshacer" está donde ocurrió
  // la acción, no en un menú (auditoría, H3).
  const [deshacerExito, setDeshacerExito] = useState(null);

  // Carga inicial. Corre sólo en el navegador, así no hay diferencia entre
  // lo que renderiza el servidor y lo que renderiza el cliente. Espera a que
  // la sesión resuelva y carga según el modo (ejemplo o Supabase).
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
        setDatos(VACIO);
        setFuente("supabase");
        setCargando(false);
        return;
      }

      // Cuenta real con negocio: se lee de Supabase, sólo lo de ese negocio.
      try {
        const traido = await leerDeSupabase(usuario.negocio_id);
        if (!vivo) return;
        if (traido.negocio) {
          setDatos(traido);
          setFuente("supabase");
          setCargando(false);
          return;
        }
        setAviso(
          "Tu negocio todavía no aparece en la base. Esperá unos segundos y volvé a entrar."
        );
        setDatos(VACIO);
        setFuente("supabase");
        setCargando(false);
      } catch (e) {
        if (!vivo) return;
        setAviso(
          "No se pudo leer la base de Supabase. Fijate la conexión y volvé a entrar."
        );
        setDatos(VACIO);
        setFuente("supabase");
        setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [authCargando, esDemo, usuario]);

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
    const enSupabase = () => fuente === "supabase" && supabase;

    // Aplica el cambio en pantalla ya, y lo manda a la base si la hay.
    const escribir = async (tabla, fila, { insertar = false } = {}) => {
      if (!enSupabase()) return;
      const q = supabase.from(tabla);
      const { error } = insertar ? await q.insert(fila) : await q.update(fila).eq("id", fila.id);
      if (error) setAviso("No se pudo guardar en la base: " + error.message);
    };

    const borrar = async (tabla, id) => {
      if (!enSupabase()) return;
      const { error } = await supabase.from(tabla).delete().eq("id", id);
      if (error) setAviso("No se pudo borrar en la base: " + error.message);
    };

    // Quién firma el historial. La regla vive en permisos.js y tiene test.
    const firma = () => quienEscribe({ esDemo, usuario, empleados: datos.empleados });

    // Escribe una fila que trae columnas agregadas por una migración nueva.
    // Si la base todavía no tiene esas columnas, la fila se guarda igual sin
    // ellas: que falte correr una migración no puede dejar un caso sin
    // historial, ni perder la respuesta de un cliente. Así se hizo también
    // con las invitaciones.
    const escribirConColumnasNuevas = async (tabla, fila, columnas, { insertar = false } = {}) => {
      if (!enSupabase()) return;
      const mandar = (f) =>
        insertar
          ? supabase.from(tabla).insert(f)
          : supabase.from(tabla).update(f).eq("id", f.id);

      const { error } = await mandar(fila);
      if (!error) return;

      const faltaColumna =
        error.code === "PGRST204" ||
        error.code === "42703" ||
        columnas.some((c) => (error.message ?? "").includes(c));
      if (!faltaColumna) {
        setAviso("No se pudo guardar en la base: " + error.message);
        return;
      }

      const sinColumnasNuevas = Object.fromEntries(
        Object.entries(fila).filter(([clave]) => !columnas.includes(clave))
      );
      const reintento = await mandar(sinColumnasNuevas);
      if (reintento.error) setAviso("No se pudo guardar en la base: " + reintento.error.message);
    };

    // tipo y monto nacen en 014_evento_tipo.sql.
    const escribirEvento = (evento) =>
      escribirConColumnasNuevas("evento", evento, ["tipo", "monto"], { insertar: true });

    // No recibe autor: si se pudiera pasar de afuera, volverían los
    // personajes. Lo firma siempre quien está usando el sistema.
    //
    // "tipo" es obligatorio en la práctica: es lo que usa el historial del
    // negocio para filtrar (lib/historial.js). Un evento sin tipo sólo se ve
    // en "Todo". "monto" va en los de plata.
    const nuevoEvento = ({ casoId, tipo, titulo, detalle, icono = "carpeta", monto = null, cuando }) => ({
      id: nuevoId(),
      caso_id: casoId,
      tipo,
      titulo,
      detalle,
      autor: firma(),
      icono,
      monto: monto === null ? null : Number(monto),
      ocurrido_en: cuando ?? new Date().toISOString(),
    });

    const anotar = (datosDelEvento) => {
      const evento = nuevoEvento(datosDelEvento);
      setDatos((d) => ({ ...d, eventos: [evento, ...d.eventos] }));
      escribirEvento(evento);
      return evento;
    };

    const parchearCaso = (casoId, cambios) => {
      setDatos((d) => ({
        ...d,
        casos: d.casos.map((c) => (c.id === casoId ? { ...c, ...cambios } : c)),
      }));
      escribir("caso", { id: casoId, ...cambios });
    };

    return {
      // ---------- casos ----------
      // Devuelve el caso creado para que la pantalla de alta pueda navegar a él.
      abrirCaso({
        clienteId,
        nombreCliente,
        telefono,
        servicio,
        identificador,
        responsableId,
        turnoId = null,
      }) {
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
        const caso = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          numero,
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

      asignarResponsable(casoId, empleadoId) {
        const persona = datos.empleados.find((e) => e.id === empleadoId);
        parchearCaso(casoId, {
          responsable_id: empleadoId,
          estado: "en_proceso",
          que_falta: queFaltaPara(datos.negocio?.rubro, "en_proceso"),
        });
        anotar({
          casoId,
          tipo: "estado",
          titulo: "Asignaron el caso",
          detalle: `Lo va a atender ${persona?.nombre ?? "alguien del equipo"}.`,
          icono: "persona-mas",
        });
      },

      // ---------- diagnóstico e identificador (SCRUM-50 y SCRUM-51) ----------
      // "servicio" es lo que pidió el cliente; "diagnostico" es lo que se
      // encontró al revisar. Son dos cosas distintas y las dos quedan.
      cargarDiagnostico(casoId, diagnostico) {
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
      ponerIdentificador(casoId, identificador) {
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

      // Una nota suelta en el historial (SCRUM-52). No pisa nada: el
      // historial se agrega, nunca se reescribe.
      anotarNota(casoId, texto) {
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
      cambiarEstado(casoId, estado, queFalta, textoHistorial, tambien = {}) {
        parchearCaso(casoId, { estado, que_falta: queFalta, ...tambien });
        anotar({
          casoId,
          tipo: estado === "completado" ? "entrega" : "estado",
          titulo: textoHistorial.titulo,
          detalle: textoHistorial.detalle,
          icono: textoHistorial.icono,
        });
      },

      // ---------- pasos del presupuesto ----------
      // Armar el presupuesto es sumar pasos de a uno (SCRUM-59). Cada paso
      // nace esperando la respuesta del cliente: el presupuesto se aprueba
      // parte por parte, nunca todo junto.
      agregarPaso({ casoId, nombre, descripcion, monto }) {
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
      eliminarPaso(pasoId) {
        const paso = datos.pasos.find((p) => p.id === pasoId);
        if (!paso || paso.estado !== "esperando") return;

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
      responderPaso(pasoId, estado) {
        const paso = datos.pasos.find((p) => p.id === pasoId);
        if (!paso || paso.estado === "aprobado") return;

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
      marcarInsumoLlegado(insumoId) {
        const insumo = datos.insumos.find((i) => i.id === insumoId);
        if (!insumo) return;
        setDatos((d) => ({
          ...d,
          insumos: d.insumos.map((i) =>
            i.id === insumoId ? { ...i, estado: "en_stock", caso_id: null } : i
          ),
        }));
        escribir("insumo", { id: insumoId, estado: "en_stock", caso_id: null });

        if (insumo.caso_id) {
          parchearCaso(insumo.caso_id, {
            estado: "en_proceso",
            que_falta: queFaltaPara(datos.negocio?.rubro, "en_proceso"),
          });
          anotar({
            casoId: insumo.caso_id,
            tipo: "estado",
            titulo: "Llegó el insumo",
            detalle: `${insumo.nombre}. Ya se puede seguir.`,
            icono: "camion",
          });
        }
      },

      agregarInsumo({ nombre, descripcion, cantidad, minimo, unidad }) {
        const insumo = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          nombre,
          descripcion,
          cantidad: Number(cantidad) || 0,
          minimo: Number(minimo) || 0,
          unidad: unidad || "unidad",
          estado: "en_stock",
          caso_id: null,
        };
        setDatos((d) => ({ ...d, insumos: [...d.insumos, insumo] }));
        escribir("insumo", insumo, { insertar: true });
      },

      // Escribir la cantidad directo. Después de un inventario físico hay
      // que pasar de 3 a 40, y de a uno son treinta y siete toques, cada uno
      // con su escritura a la base (auditoría, H7).
      fijarCantidad(insumoId, cantidad) {
        const limpia = Math.max(0, Math.floor(Number(cantidad) || 0));
        setDatos((d) => ({
          ...d,
          insumos: d.insumos.map((i) => (i.id === insumoId ? { ...i, cantidad: limpia } : i)),
        }));
        escribir("insumo", { id: insumoId, cantidad: limpia });
      },

      ajustarCantidad(insumoId, delta) {
        const insumo = datos.insumos.find((i) => i.id === insumoId);
        if (!insumo) return;
        const cantidad = Math.max(0, insumo.cantidad + delta);
        setDatos((d) => ({
          ...d,
          insumos: d.insumos.map((i) => (i.id === insumoId ? { ...i, cantidad } : i)),
        }));
        escribir("insumo", { id: insumoId, cantidad });
      },

      eliminarInsumo(insumoId) {
        setDatos((d) => ({ ...d, insumos: d.insumos.filter((i) => i.id !== insumoId) }));
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
        escribir("empleado", empleado, { insertar: true });
        return empleado;
      },

      // OJO AL CAMBIAR ESTO. Hoy el rol del empleado es sólo el nombre con
      // el que figura en la lista: quién puede qué sale de usuario.rol, que
      // mira la base con mi_rol() (008_permisos.sql). Por eso el desplegable
      // cambia el rol sin preguntar nada.
      //
      // El día que este rol dé permisos, el cambio tiene que pedir
      // confirmación diciendo qué gana y qué pierde esa persona: en un
      // desplegable de celular el dedo arrastra y elige otra opción sin
      // querer (auditoría, H5).
      cambiarRolEmpleado(empleadoId, rol) {
        setDatos((d) => ({
          ...d,
          empleados: d.empleados.map((e) => (e.id === empleadoId ? { ...e, rol } : e)),
        }));
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
        borrar("empleado", empleadoId);
      },

      // ---------- invitaciones ----------
      // El código lo genera la base, no el navegador: tiene que ser difícil
      // de adivinar y no depender de lo que corra en la máquina de nadie.
      async crearInvitacion({ rol, usosMaximos, dias }) {
        if (!enSupabase()) {
          return {
            ok: false,
            error: "Para invitar a alguien hace falta conectar la base de Supabase.",
          };
        }
        const vence = new Date();
        vence.setDate(vence.getDate() + (Number(dias) || 7));

        const { data, error } = await supabase
          .from("invitacion")
          .insert({
            negocio_id: datos.negocio.id,
            rol: rol || "tecnico",
            usos_maximos: Number(usosMaximos) || 1,
            vence_en: vence.toISOString(),
          })
          .select("*")
          .single();

        if (error) {
          return {
            ok: false,
            error:
              "No se pudo crear la invitación. Sólo el dueño del negocio puede invitar gente.",
          };
        }
        setDatos((d) => ({ ...d, invitaciones: [data, ...d.invitaciones] }));
        return { ok: true, invitacion: data };
      },

      // No se borra: se anula, así queda el rastro de a quién se invitó.
      anularInvitacion(id) {
        setDatos((d) => ({
          ...d,
          invitaciones: d.invitaciones.map((i) =>
            i.id === id ? { ...i, anulada: true } : i
          ),
        }));
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
        escribir("cliente", cliente, { insertar: true });
      },

      // Corregir el teléfono desde la ficha del cliente. Antes, uno mal
      // cargado no se podía arreglar en ningún lado.
      corregirTelefono(clienteId, telefono) {
        setDatos((d) => ({
          ...d,
          clientes: d.clientes.map((c) => (c.id === clienteId ? { ...c, telefono } : c)),
        }));
        escribir("cliente", { id: clienteId, telefono });
      },

      // ---------- agenda ----------
      // El cliente se puede dar de alta desde acá: alguien llama para pedir
      // turno y todavía no está cargado. No tiene sentido obligar a salir a
      // otra pantalla para poder anotarlo.
      //
      // Cuánto dura el turno no se pide: en un taller no se sabe de antemano,
      // y un número inventado no sirve para nada.
      agregarTurno({ clienteId, nombreCliente, telefono, motivo, empiezaEn }) {
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
        escribir("turno", { id: turnoId, estado: "confirmado", caso_id: null });
      },

      cambiarEstadoTurno(turnoId, estado) {
        setDatos((d) => ({
          ...d,
          turnos: d.turnos.map((t) => (t.id === turnoId ? { ...t, estado } : t)),
        }));
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
        if (!enSupabase()) {
          const negocio = {
            id: nuevoId(),
            nombre,
            rubro,
            modulos_activos: preset(rubro).modulos ?? [],
          };
          setDatos((d) => ({ ...d, negocio }));
          return { ok: true, id: negocio.id };
        }
        const { data, error } = await supabase.rpc("crear_mi_negocio", {
          p_nombre: nombre,
          p_rubro: rubro,
          p_modulos: preset(rubro).modulos ?? [],
        });
        if (error) return { ok: false, error: "No se pudo crear el negocio: " + error.message };
        return { ok: true, id: data };
      },

      // El rubro se cambia sólo mientras el negocio no tiene casos (SCRUM-90):
      // sirve para corregir una elección equivocada al crearlo, no para pasar
      // un taller con patentes cargadas a consultorio. La base lo rechaza
      // igual (013_rubro_fijo.sql); esto evita llegar hasta ahí.
      cambiarRubro(rubro) {
        if (datos.casos.length > 0) return false;
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, rubro } }));
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
      guardarNegocio({ nombre, descripcion, foto }) {
        const cambios = {
          nombre: nombre.trim(),
          // Vacío es que no hay descripción, no una descripción en blanco.
          descripcion: descripcion.trim() || null,
          foto: foto ?? null,
        };
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, ...cambios } }));
        escribir("negocio", { id: datos.negocio?.id, ...cambios });
      },

      // Prende y apaga módulos (SCRUM-38). Recibe la lista completa nueva.
      cambiarModulos(claves) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, modulos_activos: claves } }));
        escribir("negocio", { id: datos.negocio?.id, modulos_activos: claves });
      },

      // Cómo quedó acomodada la pantalla de Inicio. Recibe la lista completa,
      // igual que los módulos: qué se ve, en qué orden, de qué tamaño y con
      // qué filtro.
      cambiarInicio(config) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, inicio: config } }));
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
