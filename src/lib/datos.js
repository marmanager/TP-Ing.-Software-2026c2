"use client";

// Capa de datos con dos backends.
//
// Si hay credenciales de Supabase, lee y escribe contra la base.
// Si no las hay, usa los datos de ejemplo y los guarda en el navegador.
// Las pantallas no se enteran de la diferencia: usan siempre estas funciones.
//
// Sirve para que los cuatro puedan clonar y levantar el proyecto sin esperar
// a que alguien reparta las claves, y para que la demo no dependa del wifi.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { preset, queFaltaPara } from "./presets";
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

// Lee sólo lo del negocio del usuario. No es aislamiento real (eso son las
// políticas RLS del Sprint 2): la clave anónima sigue pudiendo leer todo,
// pero las pantallas ya trabajan con un solo negocio a la vez.
async function leerDeSupabase(negocioId) {
  const [negocio, empleados, clientes, casos, insumos, turnos] = await Promise.all([
    supabase.from("negocio").select("*").eq("id", negocioId).maybeSingle(),
    supabase.from("empleado").select("*").eq("negocio_id", negocioId),
    supabase.from("cliente").select("*").eq("negocio_id", negocioId),
    supabase.from("caso").select("*").eq("negocio_id", negocioId),
    supabase.from("insumo").select("*").eq("negocio_id", negocioId),
    supabase.from("turno").select("*").eq("negocio_id", negocioId),
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

      // Modo de ejemplo: datos de muestra guardados en el navegador.
      if (esDemo) {
        const guardado =
          typeof window !== "undefined" ? window.localStorage.getItem(LLAVE) : null;
        if (!vivo) return;
        const local = guardado ? JSON.parse(guardado) : construirSemilla();
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

    const anotar = (casoId, titulo, detalle, icono = "carpeta", autor = "Mostrador") => {
      const evento = {
        id: nuevoId(),
        caso_id: casoId,
        titulo,
        detalle,
        autor,
        icono,
        ocurrido_en: new Date().toISOString(),
      };
      setDatos((d) => ({ ...d, eventos: [evento, ...d.eventos] }));
      escribir("evento", evento, { insertar: true });
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
      abrirCaso({ clienteId, nombreCliente, telefono, servicio, responsableId }) {
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
          estado: responsableId ? "en_proceso" : "nuevo",
          responsable_id: responsableId || null,
          que_falta: queFaltaPara(
            datos.negocio?.rubro,
            responsableId ? "en_proceso" : "nuevo"
          ),
          abierto_en: new Date().toISOString(),
        };
        const evento = {
          id: nuevoId(),
          caso_id: caso.id,
          titulo: "Caso abierto",
          detalle: servicio + ".",
          autor: "Mostrador",
          icono: "carpeta",
          ocurrido_en: caso.abierto_en,
        };

        setDatos((d) => ({
          ...d,
          clientes: cliente
            ? [...d.clientes, cliente]
            : telefono
              ? d.clientes.map((c) => (c.id === idCliente ? { ...c, telefono } : c))
              : d.clientes,
          casos: [caso, ...d.casos],
          eventos: [evento, ...d.eventos],
        }));

        if (cliente) escribir("cliente", cliente, { insertar: true });
        else if (telefono) escribir("cliente", { id: idCliente, telefono });
        escribir("caso", caso, { insertar: true });
        escribir("evento", evento, { insertar: true });

        return caso;
      },

      asignarResponsable(casoId, empleadoId) {
        const persona = datos.empleados.find((e) => e.id === empleadoId);
        parchearCaso(casoId, {
          responsable_id: empleadoId,
          estado: "en_proceso",
          que_falta: queFaltaPara(datos.negocio?.rubro, "en_proceso"),
        });
        anotar(casoId, "Asignaron el caso", `Lo va a atender ${persona?.nombre ?? "alguien del equipo"}.`, "persona-mas", "Mostrador");
      },

      cambiarEstado(casoId, estado, queFalta, textoHistorial) {
        parchearCaso(casoId, { estado, que_falta: queFalta });
        anotar(casoId, textoHistorial.titulo, textoHistorial.detalle, textoHistorial.icono);
      },

      // ---------- pasos del presupuesto ----------
      // Aprobar, rechazar y volver atrás escriben los tres en la base.
      // Así "Volver atrás" sobrevive a un F5, en vez de vivir sólo en memoria.
      responderPaso(pasoId, estado) {
        const paso = datos.pasos.find((p) => p.id === pasoId);
        if (!paso) return;

        setDatos((d) => ({
          ...d,
          pasos: d.pasos.map((p) => (p.id === pasoId ? { ...p, estado } : p)),
        }));
        escribir("paso", { id: pasoId, estado });

        const dicho = {
          aprobado: "Lo aprobó el cliente",
          rechazado: "El cliente no lo hace",
          esperando: "Volvieron atrás la respuesta",
        }[estado];
        anotar(paso.caso_id, dicho, `${paso.nombre} · $${Number(paso.monto).toLocaleString("es-AR")}`, estado === "aprobado" ? "listo" : "nota", "Encargado");
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
          anotar(insumo.caso_id, "Llegó el insumo", `${insumo.nombre}. Ya se puede seguir.`, "camion", "Mostrador");
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

      // ---------- clientes ----------
      agregarCliente({ nombre, telefono, notas }) {
        const cliente = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          nombre,
          telefono,
          notas: notas || "",
        };
        setDatos((d) => ({ ...d, clientes: [...d.clientes, cliente] }));
        escribir("cliente", cliente, { insertar: true });
      },

      // ---------- agenda ----------
      agregarTurno({ clienteId, motivo, empiezaEn, minutos }) {
        const turno = {
          id: nuevoId(),
          negocio_id: datos.negocio.id,
          cliente_id: clienteId || null,
          caso_id: null,
          motivo,
          empieza_en: new Date(empiezaEn).toISOString(),
          minutos: Number(minutos) || 60,
          estado: "agendado",
        };
        setDatos((d) => ({ ...d, turnos: [...d.turnos, turno] }));
        escribir("turno", turno, { insertar: true });
      },

      cambiarEstadoTurno(turnoId, estado) {
        setDatos((d) => ({
          ...d,
          turnos: d.turnos.map((t) => (t.id === turnoId ? { ...t, estado } : t)),
        }));
        escribir("turno", { id: turnoId, estado });
      },

      // ---------- negocio ----------
      // Crea el negocio al terminar el alta (SCRUM-12). Sólo con Supabase:
      // el modo de ejemplo ya trae un negocio armado.
      //
      // Va por crear_mi_negocio() y no por un insert suelto: así el negocio
      // y su vínculo con la cuenta se crean juntos o no se crean, y la tabla
      // `negocio` puede quedar sin política de insert (ver 005_rls.sql).
      async crearNegocio({ nombre, rubro }) {
        if (!enSupabase()) {
          return {
            ok: false,
            error: "Para crear un negocio hace falta conectar la base de Supabase.",
          };
        }
        const { data, error } = await supabase.rpc("crear_mi_negocio", {
          p_nombre: nombre,
          p_rubro: rubro,
          p_modulos: preset(rubro).modulos ?? [],
        });
        if (error) return { ok: false, error: "No se pudo crear el negocio: " + error.message };
        return { ok: true, id: data };
      },

      cambiarRubro(rubro) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, rubro } }));
        escribir("negocio", { id: datos.negocio?.id, rubro });
      },

      // Prende y apaga módulos (SCRUM-38). Recibe la lista completa nueva.
      cambiarModulos(claves) {
        setDatos((d) => ({ ...d, negocio: { ...d.negocio, modulos_activos: claves } }));
        escribir("negocio", { id: datos.negocio?.id, modulos_activos: claves });
      },

      // Vuelve al estado inicial conocido. Se usa antes de la demo.
      reiniciar() {
        if (fuente !== "local") {
          setAviso("Estás conectado a Supabase: para reiniciar, corré supabase/002_seed.sql.");
          return;
        }
        window.localStorage.removeItem(LLAVE);
        setDatos(construirSemilla());
      },

      avisarExito: (texto) => setExito(texto),
      descartarAviso: () => setAviso(null),
      descartarExito: () => setExito(null),
    };
  }, [datos, fuente]);

  const valor = { ...datos, cargando, fuente, aviso, exito, ...acciones };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDatos() {
  const v = useContext(Contexto);
  if (!v) throw new Error("useDatos tiene que usarse adentro de <DatosProvider>");
  return v;
}
