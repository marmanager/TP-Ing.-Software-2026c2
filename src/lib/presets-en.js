// Los textos de fábrica de cada rubro en inglés (docs/idiomas.md). Sólo los
// textos: los módulos, los estados y todo lo demás vienen de PRESETS, en
// presets.js, y preset(rubro, "en") superpone esto encima.
//
// "palabras" no llevan género; "an: true" pide "an" en vez de "a".

export const PRESETS_EN = {
  taller: {
    nombre: "Auto repair shop",
    queEs: "Cars that come in, get diagnosed, quoted and handed back.",
    etiquetas: {
      nuevo: "Appointment booked",
      en_proceso: "In the shop",
      esperando: "Waiting",
      revision_final: "Final check",
      completado: "Delivered",
    },
    explica: {
      esperando: "The part or the customer's go-ahead",
      revision_final: "Check before handing it over",
    },
    seguimiento: {
      nuevo: "We've logged your vehicle. We haven't started working on it yet.",
      en_proceso: "We're diagnosing your vehicle and looking into possible problems.",
      esperando: "We've paused work on your vehicle until we have what's missing, such as a part.",
      revision_final:
        "We've finished the work and are checking that your vehicle is in good shape before handing it back.",
      completado: "Your vehicle is ready and has been handed back.",
    },
    espera: { cliente: "your reply to the quote", negocio: "a part" },
    motivos: [
      "Strange noise",
      "Routine service",
      "Oil and filter change",
      "Brakes",
      "Won't start",
      "Dashboard warning light on",
      "Wheel alignment and balancing",
    ],
    identificador: { nombre: "License plate", enFrase: "the license plate", ejemplo: "AB 123 CD" },
    palabras: {
      articulo: { uno: "product", varios: "products" },
      cita: { uno: "appointment", varios: "appointments", an: true },
    },
    categorias: ["Parts", "Filters", "Lubricants", "Bolts", "Screws", "Tools", "Electrical"],
    ejemplos: {
      negocio: "South Garage",
      descripcion: "General mechanics and bodywork, south side",
      servicio: "A strange noise when braking",
      diagnostico: "The belt is loose and the brake pads are worn to the limit.",
      paso: "Brake pad replacement",
      turno: "oil change",
      insumo: "oil filter",
    },
  },

  medicina: {
    nombre: "Medicine",
    queEs: "Patients who book an appointment, get seen and are discharged.",
    etiquetas: {
      nuevo: "Appointment requested",
      en_proceso: "In consultation",
      esperando: "Waiting",
      revision_final: "Final check",
      completado: "Discharged",
    },
    explica: {
      esperando: "The test or the appointment with the specialist",
      revision_final: "Check before discharge",
    },
    seguimiento: {
      nuevo: "Your appointment has been booked. We haven't seen you yet.",
      en_proceso: "We're seeing you now and assessing what's going on.",
      esperando:
        "Your care is on hold until we have what's missing, such as a test or an appointment with the specialist.",
      revision_final: "We're reviewing the results before discharging you.",
      completado: "You've been discharged.",
    },
    espera: { cliente: "your reply", negocio: "a test or an appointment with the specialist" },
    motivos: [
      "First consultation",
      "Checkup",
      "Prescription renewal",
      "Test results",
      "Medical certificate",
      "Treatment follow-up",
    ],
    identificador: { nombre: "ID number", enFrase: "the ID number", ejemplo: "30123456" },
    palabras: {
      articulo: { uno: "supply", varios: "supplies" },
      cita: { uno: "consultation", varios: "consultations" },
    },
    categorias: ["Disposables", "Medication", "Wound care", "Instruments", "Cleaning"],
    ejemplos: {
      negocio: "Belgrano Clinic",
      descripcion: "General medicine, health insurance accepted",
      servicio: "A headache that hasn't gone away for a week",
      diagnostico: "Cervical muscle tension. No warning signs.",
      paso: "Cervical spine MRI",
      turno: "annual checkup",
      insumo: "disposable gloves",
    },
  },

  service: {
    nombre: "Repair service",
    queEs: "Devices that come in, get repaired, tested and returned.",
    etiquetas: {
      nuevo: "Device received",
      en_proceso: "Being repaired",
      esperando: "Waiting",
      revision_final: "Final test",
      completado: "Delivered",
    },
    explica: {
      esperando: "The part or the approved quote",
      revision_final: "Test before handing it back",
    },
    seguimiento: {
      nuevo: "We've received your device. We haven't started looking at it yet.",
      en_proceso: "We're inspecting your device and repairing what we find.",
      esperando: "We've paused the repair of your device until we have what's missing, such as a part.",
      revision_final:
        "We've repaired it and are testing that your device works properly before returning it.",
      completado: "Your device has been repaired and handed back.",
    },
    espera: { cliente: "your reply to the quote", negocio: "a part" },
    motivos: [
      "Won't turn on",
      "Broken screen",
      "Shuts off by itself",
      "Won't charge",
      "Repair quote",
      "Cleaning and maintenance",
    ],
    identificador: { nombre: "Serial number", enFrase: "the serial number", ejemplo: "SN-48219" },
    palabras: {
      articulo: { uno: "product", varios: "products" },
      cita: { uno: "appointment", varios: "appointments", an: true },
    },
    categorias: ["Parts", "Screens", "Batteries", "Cables and connectors", "Screws", "Tools"],
    ejemplos: {
      negocio: "Central Repairs",
      descripcion: "Laptops and phones, same-day repair",
      servicio: "The laptop shuts off by itself after ten minutes",
      diagnostico: "The fan is stuck and the processor is overheating.",
      paso: "Fan replacement and thermal paste",
      turno: "pick up the laptop",
      insumo: "thermal paste",
    },
  },

  // Sin "seguimiento" a propósito, igual que en castellano: le habla al
  // cliente con SEGUIMIENTO_GENERICO_EN.
  personalizable: {
    nombre: "Customizable",
    queEs: "Starts empty: you turn on only the sections your business uses.",
    etiquetas: {
      nuevo: "Logged",
      en_proceso: "In progress",
      esperando: "Waiting",
      revision_final: "Final review",
      completado: "Done",
    },
    explica: {
      esperando: "Something is missing or the customer's reply",
      revision_final: "Review before handing it over",
    },
    espera: { cliente: "your reply to the quote", negocio: "something that's missing" },
    motivos: [],
    identificador: { nombre: "Reference", enFrase: "the reference", ejemplo: "Order 1520" },
    palabras: {
      articulo: { uno: "product", varios: "products" },
      cita: { uno: "appointment", varios: "appointments", an: true },
    },
    categorias: [],
    ejemplos: {
      negocio: "My Business",
      descripcion: "What we do, in one line",
      servicio: "What the customer asked for",
      diagnostico: "What we found when we checked.",
      paso: "What needs to be done",
      turno: "a visit",
      insumo: "a product",
    },
  },
};

export const SEGUIMIENTO_GENERICO_EN = {
  nuevo: "It's been logged. We haven't started working on it yet.",
  en_proceso: "We're working on this right now.",
  esperando: "We've paused until we have what's needed to continue.",
  revision_final: "We're done and checking that everything is right before handing it over.",
  completado: "Finished and handed over.",
};
