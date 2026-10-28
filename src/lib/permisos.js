// Qué puede hacer un rol (docs/roles.md).
//
// El catálogo es el mismo que la base (supabase/057_roles.sql) y la API
// (src/compartido/permisos.ts), con las mismas claves en el mismo orden: la
// prueba lo verifica contra la 057. Acá sólo sirve para no ofrecer botones
// que van a rechazar: **la que manda es la base**. Esconder un botón no
// protege nada.
//
// Los textos son formales e impersonales (docs/roles.md, "Textos").

import { tCastellano } from "./idioma.js";

export const GRUPOS = ["Casos", "Presupuesto", "Cobros", "Clientes", "Agenda", "Inventario", "Sedes", "Equipo", "Negocio"];

export const PERMISOS = [
  { clave: "ver_todos_los_casos", grupo: "Casos", nombre: "Ver todos los casos", descripcion: "Ver todos los casos del negocio. Sin este permiso, solo los casos asignados." },
  { clave: "crear_casos", grupo: "Casos", nombre: "Abrir casos", descripcion: "Abrir casos nuevos.", implica: ["ver_todos_los_casos"] },
  { clave: "avanzar_casos", grupo: "Casos", nombre: "Trabajar los casos", descripcion: "Cambiar el estado, editar los datos, anotar y compartir el seguimiento." },
  { clave: "asignar_casos", grupo: "Casos", nombre: "Asignar casos", descripcion: "Elegir o cambiar el responsable de un caso." },
  { clave: "entregar_y_reabrir", grupo: "Casos", nombre: "Entregar y reabrir", descripcion: "Entregar casos, reabrirlos y configurar los mensajes de WhatsApp." },
  { clave: "armar_presupuesto", grupo: "Presupuesto", nombre: "Armar el presupuesto", descripcion: "Agregar, editar y quitar pasos, montos, descuentos y ecuaciones." },
  { clave: "aprobar_por_el_cliente", grupo: "Presupuesto", nombre: "Responder por el cliente", descripcion: "Aprobar o rechazar pasos en nombre del cliente." },
  { clave: "cobrar", grupo: "Cobros", nombre: "Cobrar", descripcion: "Registrar y anular cobros, y generar el QR o link de pago." },
  { clave: "conectar_mercadopago", grupo: "Cobros", nombre: "Conectar Mercado Pago", descripcion: "Vincular y desvincular la cuenta de cobro del negocio." },
  { clave: "ver_clientes", grupo: "Clientes", nombre: "Ver clientes", descripcion: "Ver la lista de clientes y sus datos." },
  { clave: "editar_clientes", grupo: "Clientes", nombre: "Editar clientes", descripcion: "Agregar y modificar clientes.", implica: ["ver_clientes"] },
  { clave: "ver_agenda", grupo: "Agenda", nombre: "Ver la agenda", descripcion: "Ver los turnos." },
  { clave: "manejar_turnos", grupo: "Agenda", nombre: "Manejar turnos", descripcion: "Dar, mover, cancelar y marcar turnos, con sus recordatorios.", implica: ["ver_agenda"] },
  { clave: "ver_inventario", grupo: "Inventario", nombre: "Ver el inventario", descripcion: "Ver productos y stock." },
  { clave: "editar_inventario", grupo: "Inventario", nombre: "Editar el inventario", descripcion: "Cargar productos, cambiar el stock y hacer pedidos.", implica: ["ver_inventario"] },
  { clave: "ver_inventario_de_sedes", grupo: "Inventario", nombre: "Ver el inventario de las sedes", descripcion: "Ver el inventario conjunto de las sedes vinculadas donde se es miembro." },
  { clave: "ver_sedes_vinculadas", grupo: "Sedes", nombre: "Ver las sedes vinculadas", descripcion: "Entrar en modo solo lectura a las sedes vinculadas donde no se es miembro." },
  { clave: "vincular_sedes", grupo: "Sedes", nombre: "Vincular sedes", descripcion: "Vincular y desvincular este negocio con otras sedes." },
  { clave: "sumar_al_equipo", grupo: "Equipo", nombre: "Sumar al equipo", descripcion: "Manejar el link de ingreso y aprobar o rechazar pedidos." },
  { clave: "sacar_del_equipo", grupo: "Equipo", nombre: "Sacar del equipo", descripcion: "Quitar personas del equipo." },
  { clave: "manejar_roles", grupo: "Equipo", nombre: "Manejar roles", descripcion: "Crear, editar y asignar roles, solo con permisos incluidos en el rol propio." },
  { clave: "configurar_negocio", grupo: "Negocio", nombre: "Configurar el negocio", descripcion: "Datos, horarios, módulos, Inicio, landing y links públicos de la agenda." },
  { clave: "ver_historial", grupo: "Negocio", nombre: "Ver el historial", descripcion: "Ver la pantalla Historial del negocio." },
  { clave: "copia_de_seguridad", grupo: "Negocio", nombre: "Manejar la copia de seguridad", descripcion: "Hacer copias del negocio, configurar la copia automática y restablecer una copia." },
];

const CLAVES = new Set(PERMISOS.map((p) => p.clave));

// `implica`: el permiso de mirar sin el cual otro no sirve (abrir un caso
// muestra los casos; editar clientes, la lista). guardar_rol (060) los suma
// en la base; el editor los prende con el que los implica.
export function conImplicados(lista) {
  const todos = new Set(lista);
  for (const p of PERMISOS) if (todos.has(p.clave)) for (const i of p.implica ?? []) todos.add(i);
  return PERMISOS.filter((p) => todos.has(p.clave)).map((p) => p.clave);
}

// El permiso prendido en `lista` que trae a `clave` con él, o null.
export function implicadoPor(lista, clave) {
  return PERMISOS.find((p) => p.implica?.includes(clave) && lista.includes(p.clave)) ?? null;
}

export const PERMISOS_DE_MIRAR = ["ver_todos_los_casos", "ver_clientes", "ver_agenda", "ver_inventario", "ver_historial"];

// `quien` es el usuario de la sesión o una fila de mis_negocios(): cualquier
// cosa con es_duenio y permisos. Sin datos (la cuenta todavía no cargó) no se
// ofrece nada.
export function puede(quien, clave) {
  if (!CLAVES.has(clave)) return false;
  return Boolean(quien?.es_duenio) || Boolean(quien?.permisos?.includes(clave));
}

// El permiso con su nombre y su descripción en el idioma de t. El catálogo de
// arriba es el contrato con la API (las claves); los textos para mostrar salen
// del diccionario (permisos.catalogo.<clave>.*), y sin t, en castellano.
export const traducirPermiso = (p, t = tCastellano) => ({
  ...p,
  nombre: t(`permisos.catalogo.${p.clave}.nombre`, {}, p.nombre),
  descripcion: t(`permisos.catalogo.${p.clave}.descripcion`, {}, p.descripcion),
});

// El nombre de un grupo ("Casos", "Equipo"…). La clave del grupo es el texto
// de fábrica en castellano: se muestra traducido, nunca se guarda.
export const nombreDelGrupo = (grupo, t = tCastellano) => t(`permisos.grupos.${grupo}`, {}, grupo);

// Para explicar por qué un control está apagado.
export const quienPuede = (clave, t = tCastellano) => {
  const p = PERMISOS.find((x) => x.clave === clave);
  return t("permisos.quienPuede", { nombre: p ? traducirPermiso(p, t).nombre : clave });
};

// Los roles que trae el negocio de fábrica (supabase/053_roles.sql, los mismos
// nombres que el preset de cada rubro), en castellano y en inglés. Lo que la
// base guarda es el texto: un rol cuyo nombre es uno de estos, en cualquiera de
// los dos idiomas, es de fábrica y se muestra en el idioma de quien mira
// (permisos.roles.<clave>). Uno que el negocio creó, o renombró a otra cosa,
// se muestra como lo escribió. El Dueño es de fábrica siempre.
const ROLES_DE_FABRICA = {
  duenio: ["dueno", "owner"],
  encargado: ["encargado", "manager"],
  mecanico: ["mecanico", "mechanic"],
  profesional: ["profesional", "professional"],
  tecnico: ["tecnico", "technician"],
  colaborador: ["colaborador", "collaborator"],
};

const sinTildes = (s) =>
  String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

// "rol" es la fila del rol, o sólo su nombre (lo que trae la cuenta).
export function nombreDelRol(rol, t = tCastellano) {
  const nombre = typeof rol === "string" ? rol : rol?.nombre ?? "";
  const clave = rol?.es_duenio
    ? "duenio"
    : Object.keys(ROLES_DE_FABRICA).find((c) => ROLES_DE_FABRICA[c].includes(sinTildes(nombre)));
  return clave ? t(`permisos.roles.${clave}`, {}, nombre) : nombre;
}

export const QUIEN_PUEDE = Object.fromEntries(PERMISOS.map((p) => [p.clave, quienPuede(p.clave)]));

const efectivos = (rol) => (rol?.es_duenio ? PERMISOS.map((p) => p.clave) : rol?.permisos ?? []);

// Qué gana y qué pierde alguien al pasar de un rol a otro. Para la
// confirmación de Equipo: "Permisos que se agregan" / "Permisos que se quitan".
export function queCambiaConElRol(antes, despues, t = tCastellano) {
  const a = new Set(efectivos(antes));
  const d = new Set(efectivos(despues));
  return {
    gana: PERMISOS.filter((p) => !a.has(p.clave) && d.has(p.clave)).map((p) => traducirPermiso(p, t).descripcion),
    pierde: PERMISOS.filter((p) => a.has(p.clave) && !d.has(p.clave)).map((p) => traducirPermiso(p, t).descripcion),
  };
}

// Los roles que alguien puede dar: los que no tienen nada que su rol no tenga.
// El rol Dueño, sólo un Dueño. La base lo vuelve a controlar (060).
export function rolesQuePuedeDar(quien, roles) {
  const mios = new Set(efectivos(quien));
  return (roles ?? []).filter((r) =>
    r.es_duenio ? Boolean(quien?.es_duenio) : r.permisos.every((p) => mios.has(p))
  );
}

// El rol con el que entra un pedido si nadie elige otro: el de menos permisos
// que no sea Dueño (el primero si empatan), o null. Nunca un Dueño.
export function rolPorDefecto(roles) {
  let elegido = null;
  for (const r of roles ?? []) {
    if (!r.es_duenio && (!elegido || r.permisos.length < elegido.permisos.length)) elegido = r;
  }
  return elegido?.id ?? null;
}
