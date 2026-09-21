// Correr con: npm run test:unit
//
// Los huecos que se le ofrecen a un cliente para pedir turno.
//
// Es la cuenta más delicada del sistema después de la plata: lo que salga de
// acá se le muestra a gente de afuera, y un hueco ofrecido de más es alguien
// que llega al taller y se encuentra con que no hay lugar.
//
// Las fechas se arman con `new Date(2026, 8, 21, 9, 0)` —mes 8 es septiembre—
// y no con cadenas ISO, a propósito: el cálculo trabaja en hora local, y una
// cadena con Z se interpretaría en UTC y correría todo tres horas.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  enFranjas,
  mesesConLugar,
  semanasDelMes,
  DIAS,
  agendaPublica,
  HORARIOS_DE_FABRICA,
  HORIZONTE_DE_FABRICA,
  HORIZONTES,
  diaDe,
  huecoSigueLibre,
  huecosDelDia,
  huecosLibres,
  horariosListos,
  normalizarHorarios,
  problemasDeHorarios,
  tramosDelDia,
} from "../src/lib/horarios.js";

// Lunes 21 de septiembre de 2026.
const LUNES = new Date(2026, 8, 21, 0, 0, 0, 0);
const enElDia = (h, m = 0) => new Date(2026, 8, 21, h, m, 0, 0);

const config = (extra = {}) => ({ ...HORARIOS_DE_FABRICA, ...extra });
const turno = (fecha, estado = "agendado", minutos_reservados = 30) => ({
  empieza_en: fecha.toISOString(),
  estado,
  minutos_reservados,
});

// ------------------------------------------------------------
// Los días
// ------------------------------------------------------------

test("la semana arranca el lunes, como la dice la gente", () => {
  assert.deepEqual(
    DIAS.map((d) => d.clave),
    ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]
  );
});

test("traduce el día que devuelve JavaScript, que arranca el domingo", () => {
  assert.equal(diaDe(LUNES).clave, "lun");
  assert.equal(diaDe(new Date(2026, 8, 20)).clave, "dom");
  assert.equal(diaDe(new Date(2026, 8, 26)).clave, "sab");
});

// ------------------------------------------------------------
// La configuración
// ------------------------------------------------------------

test("sin nada configurado no inventa un horario", () => {
  // Nulo es "todavía no lo configuró", y no es lo mismo que "no atiende
  // ningún día": con nulo la página pública no puede abrir.
  assert.equal(normalizarHorarios(null), null);
  assert.equal(normalizarHorarios(undefined), null);
  assert.deepEqual(problemasDeHorarios(null), ["Todavía no configuraste tus horarios."]);
});

test("lo guardado a medias no rompe: se completa con lo de fábrica", () => {
  const h = normalizarHorarios({ dias: ["lun"] });
  assert.equal(h.desde, "09:00");
  assert.equal(h.minutos, 30);
});

test("descarta lo que no es una hora y lo que no es un día", () => {
  const h = normalizarHorarios({ dias: ["lun", "narnia"], desde: "9:5", hasta: "25:00" });
  assert.deepEqual(h.dias, ["lun"]);
  assert.equal(h.desde, "09:00", "«9:5» no es una hora");
  assert.equal(h.hasta, "18:00", "las 25 no existen");
});

test("«9:00» y «09:00» son la misma hora", () => {
  assert.equal(normalizarHorarios({ desde: "9:00" }).desde, "09:00");
});

test("avisa lo que falta, en vez de abrir una página vacía", () => {
  assert.deepEqual(problemasDeHorarios(config({ dias: [] })), ["Elegí al menos un día."]);
  assert.deepEqual(problemasDeHorarios(config({ desde: "18:00", hasta: "09:00" })), [
    "La hora de cierre tiene que ser posterior a la de apertura.",
  ]);
  assert.deepEqual(
    problemasDeHorarios(config({ corte: { desde: "16:00", hasta: "13:00" } })),
    ["El corte del mediodía termina antes de empezar."]
  );
  assert.deepEqual(
    problemasDeHorarios(config({ corte: { desde: "07:00", hasta: "08:00" } })),
    ["El corte tiene que caer adentro del horario."]
  );
});

test("un horario donde no entra ni un turno lo dice con todas las letras", () => {
  // Es válido y no produce nada. Sin este aviso, la página pública se vería
  // vacía y nadie entendería por qué.
  assert.deepEqual(
    problemasDeHorarios(config({ desde: "09:00", hasta: "09:20", corte: null, minutos: 30 })),
    ["No entra ningún turno de 30 minutos en ese horario."]
  );
});

test("la configuración de fábrica está lista para usar", () => {
  assert.equal(horariosListos(HORARIOS_DE_FABRICA), true);
});

// ------------------------------------------------------------
// Los tramos y los huecos de un día
// ------------------------------------------------------------

test("el corte del mediodía parte el día en dos tramos", () => {
  assert.deepEqual(tramosDelDia(config()), [
    [9 * 60, 13 * 60],
    [16 * 60, 18 * 60],
  ]);
});

test("sin corte, el día es un solo tramo", () => {
  assert.deepEqual(tramosDelDia(config({ corte: null })), [[9 * 60, 18 * 60]]);
});

test("un tramo donde no entra un turno entero no es un tramo", () => {
  // De 9 a 9:20 con turnos de media hora no hay nada que ofrecer.
  const h = config({ desde: "09:00", hasta: "09:20", corte: null });
  assert.deepEqual(tramosDelDia(h), []);
});

test("los huecos de un día salen cada media hora y no pisan el cierre", () => {
  const huecos = huecosDelDia(LUNES, config()).map((d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);

  assert.equal(huecos[0], "9:00");
  assert.equal(huecos[7], "12:30", "el último antes del corte");
  assert.equal(huecos[8], "16:00", "y después del corte arranca de nuevo");
  assert.equal(huecos[huecos.length - 1], "17:30", "nunca uno que termine después de cerrar");
  assert.equal(huecos.length, 12);
});

test("un día en el que no se atiende no tiene huecos", () => {
  const domingo = new Date(2026, 8, 20);
  assert.deepEqual(huecosDelDia(domingo, config()), []);
});

test("cambiar la duración cambia cuántos turnos entran", () => {
  assert.equal(huecosDelDia(LUNES, config({ minutos: 60 })).length, 6);
  assert.equal(huecosDelDia(LUNES, config({ minutos: 15 })).length, 24);
});

// ------------------------------------------------------------
// Qué se le ofrece a alguien
// ------------------------------------------------------------

const libresDelLunes = (extra = {}, turnos = []) => {
  const [dia] = huecosLibres({
    horarios: config(extra.horarios),
    turnos,
    desde: LUNES,
    dias: 1,
    ahora: extra.ahora ?? new Date(2026, 8, 18, 9, 0),
  });
  return (dia?.huecos ?? []).map((d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
};

test("ofrece los huecos del día cuando no hay nada tomado", () => {
  assert.equal(libresDelLunes().length, 12);
});

test("un turno ocupa su hueco", () => {
  const libres = libresDelLunes({}, [turno(enElDia(10, 0))]);
  assert.ok(!libres.includes("10:00"));
  assert.equal(libres.length, 11);
});

test("un turno cancelado devuelve el lugar", () => {
  // Queda en la agenda para que se sepa que estaba, pero no reserva nada.
  const libres = libresDelLunes({}, [turno(enElDia(10, 0), "cancelado")]);
  assert.ok(libres.includes("10:00"));
  assert.equal(libres.length, 12);
});

test("un turno ya atendido sigue ocupando su lugar", () => {
  const libres = libresDelLunes({}, [turno(enElDia(10, 0), "atendido")]);
  assert.ok(!libres.includes("10:00"));
});

test("un turno cargado a mano a una hora rara se lleva puesto el hueco que pisa", () => {
  // El mostrador puede anotar uno a las 10:15. No coincide con ningún hueco,
  // pero el de las 10:00 ya no se puede ofrecer.
  const libres = libresDelLunes({}, [turno(enElDia(10, 15))]);
  assert.ok(!libres.includes("10:00"));
  assert.ok(!libres.includes("10:30"), "también se come el siguiente");
});

test("un turno largo tapa todos los huecos que dura", () => {
  const libres = libresDelLunes({}, [turno(enElDia(10, 0), "agendado", 90)]);
  assert.ok(!libres.includes("10:00"));
  assert.ok(!libres.includes("10:30"));
  assert.ok(!libres.includes("11:00"));
  assert.ok(libres.includes("11:30"), "y suelta el de después");
});

test("un turno viejo sin duración ocupa un hueco y nada más", () => {
  // Los que se cargaron antes de que existiera la duración: no se les
  // inventa una hacia atrás.
  const viejo = { empieza_en: enElDia(10, 0).toISOString(), estado: "agendado" };
  const libres = libresDelLunes({}, [viejo]);
  assert.ok(!libres.includes("10:00"));
  assert.ok(libres.includes("10:30"));
});

test("los turnos de otro día no molestan", () => {
  const martes = new Date(2026, 8, 22, 10, 0);
  assert.equal(libresDelLunes({}, [turno(martes)]).length, 12);
});

// ------------------------------------------------------------
// El tiempo
// ------------------------------------------------------------

test("no ofrece horarios que ya pasaron", () => {
  const libres = libresDelLunes({ ahora: new Date(2026, 8, 21, 11, 0) });
  assert.ok(!libres.includes("9:00"));
  assert.ok(!libres.includes("10:30"));
  assert.ok(libres.includes("16:00"));
});

test("respeta la anticipación que pidió el negocio", () => {
  // A las 9 en punto, con dos horas de anticipación, el primero que se puede
  // ofrecer es el de las 11.
  const libres = libresDelLunes({ ahora: new Date(2026, 8, 21, 9, 0) });
  assert.ok(!libres.includes("10:30"));
  assert.equal(libres[0], "11:00");
});

test("sin mínimo de anticipación se puede pedir para dentro de un rato", () => {
  const libres = libresDelLunes({
    horarios: { anticipacionHoras: 0 },
    ahora: new Date(2026, 8, 21, 9, 0),
  });
  assert.equal(libres[0], "9:00");
});

test("con un día de anticipación, hoy ya no se puede pedir", () => {
  const libres = libresDelLunes({
    horarios: { anticipacionHoras: 24 },
    ahora: new Date(2026, 8, 21, 8, 0),
  });
  assert.deepEqual(libres, []);
});

test("los días sin ningún hueco no aparecen en la lista", () => {
  // El fin de semana no se atiende: no tiene que salir un día vacío que
  // alguien tenga que interpretar.
  const dias = huecosLibres({
    horarios: config(),
    desde: new Date(2026, 8, 19),
    dias: 4,
    ahora: new Date(2026, 8, 18),
  });
  assert.deepEqual(
    dias.map((d) => diaDe(d.fecha).clave),
    ["lun", "mar"]
  );
});

test("sin horarios configurados no se ofrece nada", () => {
  assert.deepEqual(huecosLibres({ horarios: null }), []);
  assert.deepEqual(huecosLibres({ horarios: config({ dias: [] }) }), []);
});

// ------------------------------------------------------------
// El último chequeo, el de antes de escribir
// ------------------------------------------------------------

test("un hueco libre sigue libre", () => {
  assert.equal(
    huecoSigueLibre({
      cuando: enElDia(10, 0),
      horarios: config(),
      turnos: [],
      ahora: new Date(2026, 8, 18),
    }),
    true
  );
});

test("entre que lo vio y lo tocó, alguien se lo llevó", () => {
  assert.equal(
    huecoSigueLibre({
      cuando: enElDia(10, 0),
      horarios: config(),
      turnos: [turno(enElDia(10, 0))],
      ahora: new Date(2026, 8, 18),
    }),
    false
  );
});

test("no se puede reservar una hora que el negocio no ofrece", () => {
  // Mandando el dato a mano se podría intentar pedir a las 3 de la mañana, o
  // a las 13:30, que cae justo en el corte del mediodía.
  const base = { horarios: config(), turnos: [], ahora: new Date(2026, 8, 18) };
  assert.equal(huecoSigueLibre({ ...base, cuando: enElDia(3, 0) }), false);
  assert.equal(huecoSigueLibre({ ...base, cuando: enElDia(13, 30) }), false);
  assert.equal(huecoSigueLibre({ ...base, cuando: enElDia(10, 7) }), false, "ni a una hora partida");
});

test("no se puede reservar un domingo si no se atiende los domingos", () => {
  assert.equal(
    huecoSigueLibre({
      cuando: new Date(2026, 8, 20, 10, 0),
      horarios: config(),
      turnos: [],
      ahora: new Date(2026, 8, 18),
    }),
    false
  );
});

test("no se puede reservar para atrás ni contra la anticipación", () => {
  const base = { cuando: enElDia(10, 0), horarios: config(), turnos: [] };
  assert.equal(huecoSigueLibre({ ...base, ahora: new Date(2026, 8, 21, 11, 0) }), false);
  assert.equal(huecoSigueLibre({ ...base, ahora: new Date(2026, 8, 21, 9, 30) }), false);
});

test("una fecha que no es una fecha no reserva nada", () => {
  assert.equal(
    huecoSigueLibre({ cuando: "cuando quieras", horarios: config(), turnos: [] }),
    false
  );
});

// ------------------------------------------------------------
// Lo que ve quien abre el link de la agenda
// ------------------------------------------------------------

const negocio = {
  id: "n1",
  nombre: "Taller Sur",
  rubro: "taller",
  telefono: "341 222 3333",
  agenda_codigo: "a".repeat(32),
  horarios: HORARIOS_DE_FABRICA,
};

test("publica los horarios y cuándo está ocupado", () => {
  const manana = new Date(Date.now() + 86400000);
  const a = agendaPublica({
    codigo: negocio.agenda_codigo,
    negocio,
    turnos: [{ empieza_en: manana.toISOString(), estado: "agendado", minutos_reservados: 30 }],
  });

  assert.equal(a.sirve, true);
  assert.equal(a.negocio_nombre, "Taller Sur");
  assert.deepEqual(a.horarios, HORARIOS_DE_FABRICA);
  assert.equal(a.ocupados.length, 1);
});

test("de los turnos tomados no viaja quién los tomó", () => {
  const manana = new Date(Date.now() + 86400000).toISOString();
  const a = agendaPublica({
    codigo: negocio.agenda_codigo,
    negocio,
    turnos: [
      {
        empieza_en: manana,
        estado: "agendado",
        minutos_reservados: 30,
        motivo: "Ruido raro en el motor",
        cliente_id: "c1",
        caso_id: "k1",
      },
    ],
  });

  const texto = JSON.stringify(a);
  assert.ok(!texto.includes("Ruido raro"), "ni por qué vino");
  assert.ok(!texto.includes("c1"), "ni quién es");
  assert.ok(!texto.includes("k1"), "ni de qué caso");
  assert.deepEqual(Object.keys(a.ocupados[0]).sort(), ["empieza_en", "minutos_reservados"]);
});

test("un turno cancelado no aparece como ocupado", () => {
  const manana = new Date(Date.now() + 86400000).toISOString();
  const a = agendaPublica({
    codigo: negocio.agenda_codigo,
    negocio,
    turnos: [{ empieza_en: manana, estado: "cancelado" }],
  });
  assert.deepEqual(a.ocupados, []);
});

test("los turnos viejos no se mandan: nadie puede pedir para atrás", () => {
  const hace3dias = new Date(Date.now() - 3 * 86400000).toISOString();
  const a = agendaPublica({
    codigo: negocio.agenda_codigo,
    negocio,
    turnos: [{ empieza_en: hace3dias, estado: "agendado" }],
  });
  assert.deepEqual(a.ocupados, []);
});

test("un código que no es el del negocio no abre nada", () => {
  assert.deepEqual(agendaPublica({ codigo: "b".repeat(32), negocio, turnos: [] }), { sirve: false });
  assert.deepEqual(agendaPublica({ codigo: null, negocio, turnos: [] }), { sirve: false });
  assert.deepEqual(
    agendaPublica({ codigo: "x", negocio: { ...negocio, agenda_codigo: null }, turnos: [] }),
    { sirve: false }
  );
});

// ------------------------------------------------------------
// La pantalla pública: el calendario y las franjas
// ------------------------------------------------------------

test("el calendario arranca el lunes y deja vacío lo que no es del mes", () => {
  // Octubre de 2026 empieza un jueves.
  const semanas = semanasDelMes(2026, 9);
  assert.equal(semanas.length, 5);
  assert.deepEqual(semanas[0].slice(0, 3), [null, null, null]);
  assert.equal(semanas[0][3].getDate(), 1);
  assert.equal(semanas[4][5].getDate(), 31); // sábado 31
  assert.equal(semanas[4][6], null);
});

test("todas las semanas tienen siete lugares", () => {
  for (let mes = 0; mes < 12; mes++) {
    for (const semana of semanasDelMes(2026, mes)) assert.equal(semana.length, 7);
  }
});

test("un febrero que empieza en lunes entra justo en cuatro semanas", () => {
  const semanas = semanasDelMes(2027, 1);
  assert.equal(semanas.length, 4);
  assert.equal(semanas[0][0].getDate(), 1);
  assert.equal(semanas[3][6].getDate(), 28);
});

test("los meses entre los que se puede ir y venir son los que tienen lugar", () => {
  const dias = [
    { fecha: new Date(2026, 8, 29) },
    { fecha: new Date(2026, 8, 30) },
    { fecha: new Date(2026, 9, 2) },
  ];
  assert.deepEqual(mesesConLugar(dias), [
    { anio: 2026, mes: 8 },
    { anio: 2026, mes: 9 },
  ]);
  assert.deepEqual(mesesConLugar([]), []);
});

test("diciembre y enero quedan en orden aunque cambie el año", () => {
  const dias = [{ fecha: new Date(2027, 0, 4) }, { fecha: new Date(2026, 11, 30) }];
  assert.deepEqual(mesesConLugar(dias), [
    { anio: 2026, mes: 11 },
    { anio: 2027, mes: 0 },
  ]);
});

test("los huecos se parten en mañana y tarde a la una", () => {
  const h = (hora, min = 0) => new Date(2026, 8, 22, hora, min);
  const franjas = enFranjas([h(9), h(12, 30), h(13), h(17, 30)]);
  assert.deepEqual(
    franjas.map((f) => [f.nombre, f.huecos.length]),
    [
      ["A la mañana", 2],
      ["A la tarde", 2],
    ]
  );
});

test("un día que sólo abre a la tarde no muestra una mañana vacía", () => {
  const franjas = enFranjas([new Date(2026, 8, 22, 16, 0)]);
  assert.deepEqual(franjas.map((f) => f.nombre), ["A la tarde"]);
  assert.deepEqual(enFranjas([]), []);
});

// ------------------------------------------------------------
// Hasta cuándo se puede pedir
// ------------------------------------------------------------

test("sin decir nada, se ofrecen los días que eligió el negocio", () => {
  const desde = new Date(2026, 8, 21, 0, 0);
  const ahora = new Date(2026, 8, 21, 0, 0);
  const todos = { ...HORARIOS_DE_FABRICA, dias: ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] };

  const unMes = huecosLibres({ horarios: { ...todos, horizonteDias: 30 }, desde, ahora });
  assert.equal(unMes.length, 30);
  assert.equal(unMes.at(-1).fecha.getDate(), 20); // 20 de octubre

  const tresMeses = huecosLibres({ horarios: { ...todos, horizonteDias: 90 }, desde, ahora });
  assert.equal(tresMeses.length, 90);
});

test("un negocio que guardó sus horarios antes del tope recibe el de fábrica", () => {
  const { horizonteDias, ...viejo } = HORARIOS_DE_FABRICA;
  assert.equal(normalizarHorarios(viejo).horizonteDias, HORIZONTE_DE_FABRICA);
  assert.equal(normalizarHorarios({ ...viejo, horizonteDias: 7 }).horizonteDias, HORIZONTE_DE_FABRICA);
  assert.ok(HORIZONTES.some((x) => x.dias === HORIZONTE_DE_FABRICA));
});

test("un horario más allá del tope no se puede reservar aunque esté libre", () => {
  const ahora = new Date(2026, 8, 21, 8, 0); // lunes
  const horarios = { ...HORARIOS_DE_FABRICA, horizonteDias: 14 };
  // Viernes 2 de octubre: día 12, adentro.
  assert.equal(huecoSigueLibre({ cuando: new Date(2026, 9, 2, 10, 0), horarios, ahora }), true);
  // Lunes 5 de octubre: día 15, afuera.
  assert.equal(huecoSigueLibre({ cuando: new Date(2026, 9, 5, 10, 0), horarios, ahora }), false);
});
