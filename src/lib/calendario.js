// El calendario del mes: agrupar turnos por día y moverse entre meses.
//
// No tiene React ni Supabase adentro, igual que horarios.js: lo corre
// `npm run test:unit` y no depende de en qué pantalla se dibuje.
//
// La grilla del mes NO se arma acá: eso ya lo hace semanasDelMes() en
// horarios.js, que la pantalla pública de turnos usa desde la 024. Acá sólo
// está lo que esa pantalla no necesitaba, que es mirar para atrás y elegir
// un mes cualquiera en vez de sólo los que tienen lugar.

// Los nombres de los meses y de los días vivían sueltos adentro de la
// pantalla de pedir turno. Ahora los usan dos pantallas, así que viven acá.
export const DIAS_DE_LA_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const MES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// La clave con la que se agrupa un día.
//
// Se arma con getFullYear/getMonth/getDate y NO con toISOString(), que pasa a
// UTC: un turno de las 21 de un martes en Buenos Aires sale como miércoles y
// se dibujaría en la casilla equivocada. Es el mismo cuidado que ya tiene
// paraInput() en fechas.js.
export const claveDia = (fecha) => {
  const d = new Date(fecha);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
};

// De "2026-09-21" a la fecha local de ese día a las 00:00. new Date("2026-09-21")
// sola la leería como UTC y en Argentina daría el día anterior a las 21.
export function deClaveDia(clave) {
  const [anio, mes, dia] = String(clave).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

// Los turnos agrupados por día, cada día ordenado por hora.
export function turnosPorDia(turnos = []) {
  const mapa = new Map();
  for (const t of turnos) {
    const clave = claveDia(t.empieza_en);
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(t);
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => new Date(a.empieza_en) - new Date(b.empieza_en));
  }
  return mapa;
}

// Moverse de mes, con el año siguiéndolo. Diciembre + 1 es enero del que
// viene, y enero − 1 es diciembre del pasado.
export const mesAnterior = ({ anio, mes }) =>
  mes === 0 ? { anio: anio - 1, mes: 11 } : { anio, mes: mes - 1 };

export const mesSiguiente = ({ anio, mes }) =>
  mes === 11 ? { anio: anio + 1, mes: 0 } : { anio, mes: mes + 1 };

// Los años que ofrece el selector.
//
// Siempre entran el año en curso y el que viene —se planifica para adelante—
// y además cualquier año donde haya un turno cargado, para atrás o para
// adelante. Un negocio que arrancó en 2024 tiene que poder ir a mirar 2024;
// uno que anotó algo para 2028 tiene que poder llegar.
export function aniosOfrecidos(turnos = [], hoy = new Date()) {
  const deLosTurnos = turnos.map((t) => new Date(t.empieza_en).getFullYear());
  const desde = Math.min(hoy.getFullYear(), ...deLosTurnos);
  const hasta = Math.max(hoy.getFullYear() + 1, ...deLosTurnos);
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
}

// Sumar (o restar) días a una fecha, sin tocar la original. Los meses y los
// años los resuelve Date solo: 31 de enero + 1 es 1 de febrero.
export function sumarDias(fecha, cuantos) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + cuantos);
  return d;
}

// ------------------------------------------------------------
// La semana
// ------------------------------------------------------------

// Los siete días de la semana que contiene esa fecha, de lunes a domingo.
// El corrimiento es el mismo que usa semanasDelMes() en horarios.js: getDay()
// arranca el domingo con 0 y acá la semana arranca el lunes.
export function semanaDe(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const desdeElLunes = (d.getDay() + 6) % 7;
  const lunes = sumarDias(d, -desdeElLunes);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

// Minutos desde la medianoche, en hora local.
export const minutosDelDia = (fecha) => {
  const d = new Date(fecha);
  return d.getHours() * 60 + d.getMinutes();
};

// Cuánto ocupa un turno. Si no tiene reservado propio, ocupa lo que el
// negocio da por turno. Es la misma cuenta que ya hacen huecosLibres() y
// agendaPublica() en horarios.js.
export const duracionDe = (turno, porDefecto = 30) =>
  Number(turno?.minutos_reservados) > 0 ? Number(turno.minutos_reservados) : porDefecto;

// Desde qué hora y hasta qué hora se dibuja la grilla de la semana.
//
// Arranca en el horario del negocio, pero se estira para que entre cualquier
// turno que caiga afuera. Un turno de las 8 en un negocio que abre a las 9
// existe —lo cargó alguien a mano— y una grilla que empieza a las 9 lo
// escondería. Una agenda que esconde un turno es peor que no tener agenda.
//
// Redondea a la hora en punto para que las líneas caigan en horas enteras.
export function rangoDeHoras(turnos = [], { abre = 540, cierra = 1080, porDefecto = 30 } = {}) {
  let desde = abre;
  let hasta = cierra;

  for (const t of turnos) {
    const empieza = minutosDelDia(t.empieza_en);
    desde = Math.min(desde, empieza);
    hasta = Math.max(hasta, empieza + duracionDe(t, porDefecto));
  }

  desde = Math.max(0, Math.floor(desde / 60) * 60);
  hasta = Math.min(24 * 60, Math.ceil(hasta / 60) * 60);
  // Un negocio con los horarios mal cargados no puede dejar la grilla en cero
  // de alto: siempre queda al menos una hora.
  if (hasta <= desde) hasta = Math.min(24 * 60, desde + 60);
  return { desde, hasta };
}

// Acomoda los turnos de un día en carriles, como los pone Google Calendar:
// los que se pisan se parten el ancho, y los que no, ocupan todo.
//
// EL ÍNDICE ÚNICO DE LA BASE NO ALCANZA. "turno_horario_unico" (023) impide
// dos turnos que empiecen a la misma hora, pero no dos que se pisen: uno de
// una hora a las 9 y otro de media a las 9:30 conviven. Sin carriles, el
// segundo se dibujaría encima del primero y uno de los dos desaparecería.
//
// Los carriles se cuentan por grupo de turnos encadenados y no por día: si a
// las 9 hay dos pisados y a las 15 hay uno solo, el de las 15 ocupa todo el
// ancho. Contarlos por día dejaría media columna vacía toda la tarde.
export function acomodarEnCarriles(turnos = [], porDefecto = 30) {
  const bloques = turnos
    .map((t) => {
      const desde = minutosDelDia(t.empieza_en);
      return { turno: t, desde, hasta: desde + duracionDe(t, porDefecto) };
    })
    // Por hora de arranque; a igual arranque, primero el más largo, que es
    // el que conviene dejar en el carril de la izquierda.
    .sort((a, b) => a.desde - b.desde || b.hasta - a.hasta);

  const puestos = [];
  let grupo = [];
  let finDelGrupo = -Infinity;

  function cerrarGrupo() {
    if (grupo.length === 0) return;
    // En qué minuto termina lo último de cada carril.
    const carriles = [];
    for (const b of grupo) {
      let i = carriles.findIndex((fin) => fin <= b.desde);
      if (i === -1) {
        i = carriles.length;
        carriles.push(b.hasta);
      } else {
        carriles[i] = b.hasta;
      }
      b.carril = i;
    }
    for (const b of grupo) b.carriles = carriles.length;
    puestos.push(...grupo);
    grupo = [];
    finDelGrupo = -Infinity;
  }

  for (const b of bloques) {
    // Arranca después de que terminó todo lo anterior: empieza otro grupo.
    if (b.desde >= finDelGrupo) cerrarGrupo();
    grupo.push(b);
    finDelGrupo = Math.max(finDelGrupo, b.hasta);
  }
  cerrarGrupo();

  return puestos;
}

// Cómo se lee la semana que se está mirando: "21 al 27 de septiembre".
//
// Cuando la semana cruza el mes o el año hay que decirlo, o "28 al 4 de
// septiembre" queda al revés y sin sentido.
export function tituloDeSemana(dias = []) {
  if (dias.length === 0) return "";
  const a = dias[0];
  const b = dias[dias.length - 1];

  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${a.getDate()} al ${b.getDate()} de ${MES_LARGO[a.getMonth()]}`;
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} de ${MES_LARGO[a.getMonth()]} al ${b.getDate()} de ${MES_LARGO[b.getMonth()]}`;
  }
  return (
    `${a.getDate()} de ${MES_LARGO[a.getMonth()]} de ${a.getFullYear()}` +
    ` al ${b.getDate()} de ${MES_LARGO[b.getMonth()]} de ${b.getFullYear()}`
  );
}
