// La pantalla de Inicio armada por módulos.
//
// Cada módulo es una feature del sistema asomada en la pantalla de entrada:
// los casos, la agenda, el inventario. El usuario elige cuáles ve, dónde los
// pone, de qué tamaño y con qué filtro.
//
// Cada módulo tiene un lugar propio en una grilla de seis columnas: x, y,
// ancho y alto en celdas. No es una pila ni una lista ordenada, así que dos
// módulos pueden ir uno al lado del otro, o uno abajo a la derecha del otro,
// como se le cante a cada uno.
//
// Lo único que el sistema no deja es que dos se pisen: cuando uno se mete
// donde hay otro, el otro baja. Eso lo hace resolver().
//
// Mientras se acomoda la pantalla, los huecos verticales se ven: el módulo
// queda donde lo soltaste. Al guardar se recortan y todo sube a apoyarse, que
// es compactar(). Así se arma mirando lo que uno hace, y se usa prolijo.
//
// Esas dos funciones son la única parte complicada de este archivo, y por eso
// están probadas de punta a punta en pruebas/inicio.test.js.
//
// Acá no hay nada de React ni de pantalla: son datos y funciones puras.
// En celular la grilla no existe —una sola columna, sección 04 de la
// cartilla— y los módulos se leen en el orden en que quedaron: de arriba
// hacia abajo y de izquierda a derecha.

export const COLUMNAS = 6;
export const MAX_ALTO = 6;

// Alto de una celda, en píxeles. Tiene que coincidir con el --alto-fila de
// globals.css: es la misma medida contada dos veces, una para la pantalla y
// otra para saber cuántas celdas se arrastró el mouse.
export const ALTO_FILA = 112;
export const SEPARACION = 16;

// Cuántas filas de contenido entran según el alto. Es lo que de verdad
// importa: no cuántos píxeles mide, sino cuánto se ve sin abrir la sección.
export const filasPara = (alto) => Math.max(1, alto * 2 - 1);

// El catálogo. Sumar un módulo nuevo es agregar una entrada acá y su cuerpo
// en componentes/inicio/cuerpos.js.
//
// "modulo" es de qué módulo del negocio depende (los de lib/modulos.js). Si
// ese módulo está apagado en Mi negocio, éste no se puede poner en el Inicio.
export const CATALOGO = {
  pendientes: {
    clave: "pendientes",
    nombre: "Necesitan que hagas algo",
    icono: "alerta",
    ruta: null,
    modulo: null,
    queMuestra: "Lo que está esperando una decisión tuya, en tres números.",
    ancho: 6,
    alto: 1,
    filtros: null,
  },
  casos: {
    clave: "casos",
    nombre: "Casos",
    icono: "carpeta",
    ruta: "/casos",
    modulo: null,
    queMuestra: "Los trabajos que tenés, con su estado y qué falta en cada uno.",
    ancho: 4,
    alto: 2,
    filtros: [
      { clave: "abiertos", palabra: "Sin cerrar" },
      { clave: "todos", palabra: "Todos" },
      { clave: "nuevo", palabra: "Recién anotados" },
      { clave: "en_proceso", palabra: "En el taller" },
      { clave: "esperando", palabra: "Esperando" },
      { clave: "revision_final", palabra: "En control final" },
    ],
  },
  agenda: {
    clave: "agenda",
    nombre: "Agenda",
    icono: "calendario",
    ruta: "/agenda",
    modulo: "agenda",
    queMuestra: "Quién viene y a qué hora.",
    ancho: 2,
    alto: 1,
    filtros: [
      { clave: "hoy", palabra: "Sólo hoy" },
      { clave: "semana", palabra: "Los próximos siete días" },
      { clave: "sin_confirmar", palabra: "Sin confirmar" },
    ],
  },
  inventario: {
    clave: "inventario",
    nombre: "Inventario",
    icono: "cajas",
    ruta: "/inventario",
    modulo: "inventario",
    queMuestra: "Lo que se está por acabar y lo que llegó.",
    ancho: 2,
    alto: 1,
    filtros: [
      { clave: "bajo", palabra: "Por debajo del mínimo" },
      { clave: "llegaron", palabra: "Los que llegaron" },
      { clave: "todo", palabra: "Todo lo que tenés" },
    ],
  },
  aprobar: {
    clave: "aprobar",
    nombre: "A aprobar",
    icono: "persona-check",
    ruta: "/aprobar",
    modulo: "presupuesto",
    queMuestra: "Los pasos que el cliente todavía no contestó, y cuánta plata son.",
    ancho: 3,
    alto: 2,
    filtros: null,
  },
  equipo: {
    clave: "equipo",
    nombre: "Equipo",
    icono: "personas",
    ruta: "/equipo",
    modulo: "equipo",
    queMuestra: "Qué tiene entre manos cada uno.",
    ancho: 3,
    alto: 1,
    filtros: null,
  },
  clientes: {
    clave: "clientes",
    nombre: "Clientes",
    icono: "persona",
    ruta: "/clientes",
    modulo: null,
    queMuestra: "Los últimos que trajeron un trabajo, con el teléfono a mano.",
    ancho: 3,
    alto: 1,
    filtros: [
      { clave: "ultimos", palabra: "Los últimos" },
      { clave: "con_abiertos", palabra: "Con casos sin cerrar" },
    ],
  },
};

export const LISTA_CATALOGO = Object.values(CATALOGO);

// Cómo arranca la pantalla si nadie la tocó: lo urgente arriba y ancho, los
// casos grandes a la izquierda, y a la derecha, en columna, lo del día.
export const INICIO_POR_DEFECTO = [
  { clave: "pendientes", x: 0, y: 0, ancho: 6, alto: 2, filtro: null },
  { clave: "casos", x: 0, y: 2, ancho: 4, alto: 3, filtro: "abiertos" },
  { clave: "agenda", x: 4, y: 2, ancho: 2, alto: 2, filtro: "hoy" },
  { clave: "inventario", x: 4, y: 4, ancho: 2, alto: 1, filtro: "bajo" },
];

const entre = (n, minimo, maximo) => Math.min(maximo, Math.max(minimo, n));

// Un lugar puede ser cero (la primera fila, la primera columna).
const esLugar = (n) => Number.isInteger(n) && n >= 0;

// Un tamaño, no: un módulo de ancho cero no existe. Si viene así, es un dato
// roto y vale más el tamaño del catálogo que achicarlo a una celda.
const esMedida = (n) => Number.isInteger(n) && n >= 1;

const filtroPorDefecto = (clave) => CATALOGO[clave]?.filtros?.[0]?.clave ?? null;

// Dos módulos se pisan si se superponen en las dos direcciones a la vez.
export const sePisan = (a, b) =>
  a.clave !== b.clave &&
  a.x < b.x + b.ancho &&
  a.x + a.ancho > b.x &&
  a.y < b.y + b.alto &&
  a.y + a.alto > b.y;

// Acomoda la grilla. Los módulos se procesan de arriba hacia abajo y cada uno
// se apoya en el primer lugar libre. Al que ya está apoyado no lo mueve nadie,
// así que esto siempre termina y siempre da el mismo resultado.
//
// El módulo "clavado" —el que se está arrastrando— gana los empates: si lo
// soltás justo encima de otro que arranca en la misma fila, se queda con el
// lugar y el otro se acomoda alrededor.
//
// "subir" es la diferencia entre las dos formas de acomodar. Ver resolver()
// y compactar(), que es de donde se usa.
function acomodar(layout, { clavada = null, subir }) {
  const orden = [...layout].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.clave === clavada) return -1;
    if (b.clave === clavada) return 1;
    return a.x - b.x;
  });

  const puestos = [];

  for (const m of orden) {
    const item = { ...m };
    // Subiendo, cada módulo arranca la búsqueda desde la primera fila, así
    // que termina apoyado lo más arriba que pueda. Si no, arranca desde
    // donde lo dejaron y sólo baja si le pisa a alguien.
    if (subir) item.y = 0;
    let vueltas = 0;
    while (puestos.some((p) => sePisan(item, p)) && vueltas++ < 500) item.y += 1;
    puestos.push(item);
  }

  // De arriba hacia abajo y de izquierda a derecha: es el orden en que se
  // leen, y el que usa el celular cuando todo pasa a una sola columna.
  return puestos.sort((a, b) => a.y - b.y || a.x - b.x);
}

// Saca las superposiciones y nada más. Es lo que se usa MIENTRAS se acomoda:
// el módulo queda donde lo soltaste, y si dejás un vacío en el medio, se ve.
// Estás armando la pantalla y tenés que ver lo que estás haciendo.
export const resolver = (layout, clavada = null) =>
  acomodar(layout, { clavada, subir: false });

// Además, sube todo lo que se pueda: no quedan huecos verticales. Es lo que
// se hace AL GUARDAR y al leer la configuración, para que la pantalla de
// todos los días quede prolija aunque se haya acomodado a los tirones.
//
// A lo ancho no pasa: si dejaste una columna libre a la izquierda, se
// respeta. Eso es una decisión de quien acomodó la pantalla, no un descuido.
export const compactar = (layout) => acomodar(layout, { subir: true });

// Un negocio guardado antes de que el Inicio fuera configurable no trae nada,
// y uno guardado con la versión anterior trae los tamaños pero no el lugar.
// Los dos casos caen acá: se completa lo que falte y se resuelve, así ninguna
// pantalla ve nunca una grilla con módulos pisados.
export function normalizarInicio(guardado) {
  if (!Array.isArray(guardado)) return compactar(INICIO_POR_DEFECTO.map((m) => ({ ...m })));

  // Sin lugar guardado, se apilan en el orden en que venían.
  let proximaFila = 0;

  const limpio = guardado
    .filter((m) => m && CATALOGO[m.clave])
    .map((m) => {
      const def = CATALOGO[m.clave];
      const ancho = esMedida(m.ancho) ? entre(m.ancho, 1, COLUMNAS) : def.ancho;
      const alto = esMedida(m.alto) ? entre(m.alto, 1, MAX_ALTO) : def.alto;
      const tieneLugar = esLugar(m.x) && esLugar(m.y);

      const item = {
        clave: m.clave,
        x: tieneLugar ? entre(m.x, 0, COLUMNAS - ancho) : 0,
        y: tieneLugar ? m.y : proximaFila,
        ancho,
        alto,
        filtro: m.filtro ?? filtroPorDefecto(m.clave),
      };

      if (!tieneLugar) proximaFila += alto;
      return item;
    });

  return compactar(limpio);
}

// Los que se pueden mostrar: sólo los que dependen de un módulo prendido.
// Si alguien apaga el inventario en Mi negocio, su módulo del Inicio deja de
// aparecer, pero no se borra de la configuración: si lo vuelve a prender,
// vuelve donde estaba.
export const visibles = (config, modulosActivos = []) =>
  config.filter((m) => {
    const necesita = CATALOGO[m.clave]?.modulo;
    return !necesita || modulosActivos.includes(necesita);
  });

// Los que se pueden agregar: están en el catálogo, su módulo está prendido,
// y todavía no están puestos.
export const agregables = (config, modulosActivos = []) =>
  LISTA_CATALOGO.filter(
    (def) =>
      !config.some((m) => m.clave === def.clave) &&
      (!def.modulo || modulosActivos.includes(def.modulo))
  );

// Poner un módulo en un lugar. Lo que estaba ahí baja.
export function colocar(layout, clave, x, y) {
  const item = layout.find((m) => m.clave === clave);
  if (!item) return layout;

  const puesto = {
    ...item,
    x: entre(x, 0, COLUMNAS - item.ancho),
    y: Math.max(0, y),
  };

  return resolver(
    layout.map((m) => (m.clave === clave ? puesto : m)),
    clave
  );
}

// Cambiarle el tamaño. Nunca se pasa del ancho de la grilla, y si crece sobre
// otro módulo, ese otro baja.
export function redimensionar(layout, clave, ancho, alto) {
  const item = layout.find((m) => m.clave === clave);
  if (!item) return layout;

  const puesto = {
    ...item,
    ancho: entre(ancho, 1, COLUMNAS - item.x),
    alto: entre(alto, 1, MAX_ALTO),
  };

  return resolver(
    layout.map((m) => (m.clave === clave ? puesto : m)),
    clave
  );
}

// Subir o bajar un módulo en el orden de lectura. Es lo que se usa en celular,
// donde no hay grilla de dos dimensiones para arrastrar nada: intercambia el
// lugar con el vecino.
export function intercambiar(layout, clave, pasos) {
  const orden = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const desde = orden.findIndex((m) => m.clave === clave);
  const hasta = desde + pasos;
  if (desde < 0 || hasta < 0 || hasta >= orden.length) return layout;

  const uno = orden[desde];
  const otro = orden[hasta];

  // Cada uno se lleva el lugar del otro, pero recortado a su propio ancho:
  // si el que sube es más ancho, no puede quedar colgando fuera de la grilla.
  return resolver(
    layout.map((m) => {
      if (m.clave === uno.clave)
        return { ...m, x: entre(otro.x, 0, COLUMNAS - m.ancho), y: otro.y };
      if (m.clave === otro.clave)
        return { ...m, x: entre(uno.x, 0, COLUMNAS - m.ancho), y: uno.y };
      return m;
    })
  );
}

// Un módulo nuevo entra abajo de todo, a la izquierda, con el tamaño que
// dice su catálogo: nunca tapando lo que el usuario ya acomodó.
export function agregar(layout, clave) {
  const def = CATALOGO[clave];
  if (!def || layout.some((m) => m.clave === clave)) return layout;

  const abajo = layout.reduce((max, m) => Math.max(max, m.y + m.alto), 0);

  return resolver([
    ...layout.map((m) => ({ ...m })),
    {
      clave,
      x: 0,
      y: abajo,
      ancho: def.ancho,
      alto: def.alto,
      filtro: filtroPorDefecto(clave),
    },
  ]);
}

export const quitar = (layout, clave) => layout.filter((m) => m.clave !== clave);

export const cambiarFiltro = (layout, clave, filtro) =>
  layout.map((m) => (m.clave === clave ? { ...m, filtro } : m));

// Cuántas filas de alto tiene la grilla, para saber hasta dónde se puede
// arrastrar sin irse al infinito.
export const filasDeLaGrilla = (layout) =>
  layout.reduce((max, m) => Math.max(max, m.y + m.alto), 0);
