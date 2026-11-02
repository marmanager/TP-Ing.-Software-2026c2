// Biblioteca de ecuaciones: las fórmulas que vienen con la app.
//
// Es un catálogo de sólo lectura. La persona lo recorre por categoría, mira
// cada fórmula con sus variables y elige las que le sirven; las elegidas se
// guardan en el negocio por el mismo alta de siempre (datos.crearEcuacion →
// POST /ecuaciones), con sus validaciones y permisos. Una vez guardada es una
// ecuación más: se edita, se duplica o se borra sin tocar la biblioteca.
//
// Los textos van en los dos idiomas acá mismo, como los presets: son contenido
// y no interfaz. Las fórmulas y los nombres de las variables no se traducen,
// igual que en el resto del módulo (sqrt, raiz y ^ son parte del lenguaje).
//
// Todas son autónomas, sin dependencias: una dependencia apunta al id de otra
// ecuación del negocio, y la biblioteca no sabe cuáles tiene guardadas.
//
// Sumar una ecuación es agregarla en su categoría; sumar una categoría es
// agregarla a CATEGORIAS. pruebas/biblioteca-ecuaciones.test.js comprueba que
// todas se puedan guardar y resolver.

import { mismaExpresion, nuevaEcuacion } from "./ecuaciones.js";

const PI = { tipo: "constante", nombre: "pi", valor: 3.14159265, unidad: "", descripcion: { es: "El número π.", en: "The number π." } };
const v = (nombre, unidad, es, en) => ({ tipo: "variable", nombre, unidad, descripcion: { es, en } });
const c = (nombre, valor, unidad, es, en) => ({ tipo: "constante", nombre, valor, unidad, descripcion: { es, en } });

export const CATEGORIAS = [
  {
    clave: "costos",
    icono: "nota",
    nombre: { es: "Costos y precios", en: "Costs and pricing" },
    queEs: { es: "Para ponerle precio a un trabajo y saber cuánto queda.", en: "To price a job and know what you keep." },
    rubros: ["taller", "service", "personalizable", "medicina"],
    ecuaciones: [
      {
        clave: "precio-con-iva",
        nombre: { es: "Precio con IVA", en: "Price with VAT" },
        descripcion: { es: "Suma el IVA a un precio neto.", en: "Adds VAT to a net price." },
        formula: "neto * (1 + iva / 100)",
        unidad_resultado: "$",
        variables: [v("neto", "$", "Precio sin impuestos.", "Price before tax."), c("iva", 21, "%", "Alícuota de IVA.", "VAT rate.")],
      },
      {
        clave: "precio-sin-iva",
        nombre: { es: "Precio sin IVA", en: "Price without VAT" },
        descripcion: { es: "Saca el IVA de un precio final.", en: "Removes VAT from a final price." },
        formula: "final / (1 + iva / 100)",
        unidad_resultado: "$",
        variables: [v("final", "$", "Precio con impuestos.", "Price including tax."), c("iva", 21, "%", "Alícuota de IVA.", "VAT rate.")],
      },
      {
        clave: "precio-por-margen",
        nombre: { es: "Precio según el margen", en: "Price from margin" },
        descripcion: { es: "El precio de venta para ganar un porcentaje sobre el precio.", en: "The selling price to earn a percentage of the price." },
        formula: "costo / (1 - margen / 100)",
        unidad_resultado: "$",
        variables: [v("costo", "$", "Lo que te cuesta.", "What it costs you."), v("margen", "%", "Lo que querés ganar sobre el precio.", "What you want to keep from the price.")],
      },
      {
        clave: "margen-de-ganancia",
        nombre: { es: "Margen de ganancia", en: "Profit margin" },
        descripcion: { es: "Qué parte del precio es ganancia.", en: "Which share of the price is profit." },
        formula: "(precio - costo) / precio * 100",
        unidad_resultado: "%",
        variables: [v("precio", "$", "Precio de venta.", "Selling price."), v("costo", "$", "Lo que te cuesta.", "What it costs you.")],
      },
      {
        clave: "presupuesto-de-trabajo",
        nombre: { es: "Presupuesto de un trabajo", en: "Job quote" },
        descripcion: { es: "Mano de obra más materiales con su recargo.", en: "Labor plus materials with markup." },
        formula: "horas * valor_hora + materiales * (1 + recargo / 100)",
        unidad_resultado: "$",
        variables: [
          v("horas", "h", "Horas de trabajo.", "Hours of work."),
          v("valor_hora", "$/h", "Lo que cobrás por hora.", "Your hourly rate."),
          v("materiales", "$", "Costo de repuestos o insumos.", "Cost of parts or supplies."),
          v("recargo", "%", "Recargo sobre los materiales.", "Markup on materials."),
        ],
      },
      {
        clave: "descuento",
        nombre: { es: "Precio con descuento", en: "Discounted price" },
        descripcion: { es: "Aplica un porcentaje de descuento.", en: "Applies a percentage discount." },
        formula: "precio * (1 - descuento / 100)",
        unidad_resultado: "$",
        variables: [v("precio", "$", "Precio de lista.", "List price."), v("descuento", "%", "Porcentaje de descuento.", "Discount percentage.")],
      },
      {
        clave: "punto-de-equilibrio",
        nombre: { es: "Punto de equilibrio", en: "Break-even point" },
        descripcion: { es: "Cuántos trabajos hacen falta para cubrir los gastos fijos.", en: "How many jobs it takes to cover fixed costs." },
        formula: "fijos / (precio - variable_unitario)",
        unidad_resultado: "u.",
        variables: [
          v("fijos", "$", "Gastos fijos del mes.", "Monthly fixed costs."),
          v("precio", "$", "Precio de cada trabajo.", "Price per job."),
          v("variable_unitario", "$", "Costo variable de cada trabajo.", "Variable cost per job."),
        ],
      },
    ],
  },
  {
    clave: "finanzas",
    icono: "grafico",
    nombre: { es: "Finanzas", en: "Finance" },
    queEs: { es: "Intereses, cuotas y variaciones.", en: "Interest, installments and changes." },
    rubros: ["personalizable"],
    ecuaciones: [
      {
        clave: "interes-simple",
        nombre: { es: "Interés simple", en: "Simple interest" },
        descripcion: { es: "El interés que genera un capital sin reinvertir.", en: "Interest earned without compounding." },
        formula: "capital * tasa / 100 * periodos",
        unidad_resultado: "$",
        variables: [v("capital", "$", "Monto inicial.", "Initial amount."), v("tasa", "%", "Tasa por período.", "Rate per period."), v("periodos", "", "Cantidad de períodos.", "Number of periods.")],
      },
      {
        clave: "interes-compuesto",
        nombre: { es: "Interés compuesto", en: "Compound interest" },
        descripcion: { es: "El monto final reinvirtiendo los intereses.", en: "The final amount reinvesting the interest." },
        formula: "capital * (1 + tasa / 100) ^ periodos",
        unidad_resultado: "$",
        variables: [v("capital", "$", "Monto inicial.", "Initial amount."), v("tasa", "%", "Tasa por período.", "Rate per period."), v("periodos", "", "Cantidad de períodos.", "Number of periods.")],
      },
      {
        clave: "cuota-sistema-frances",
        nombre: { es: "Cuota de un préstamo", en: "Loan installment" },
        descripcion: { es: "La cuota fija de un préstamo (sistema francés).", en: "The fixed installment of a loan (amortized)." },
        formula: "monto * (tasa / 100) / (1 - (1 + tasa / 100) ^ (-cuotas))",
        unidad_resultado: "$",
        variables: [v("monto", "$", "Lo que se pide prestado.", "Amount borrowed."), v("tasa", "%", "Tasa mensual.", "Monthly rate."), v("cuotas", "", "Cantidad de cuotas.", "Number of installments.")],
      },
      {
        clave: "variacion-porcentual",
        nombre: { es: "Variación porcentual", en: "Percentage change" },
        descripcion: { es: "Cuánto subió o bajó un valor.", en: "How much a value went up or down." },
        formula: "(nuevo - anterior) / anterior * 100",
        unidad_resultado: "%",
        variables: [v("anterior", "", "Valor de antes.", "Previous value."), v("nuevo", "", "Valor de ahora.", "Current value.")],
      },
      {
        clave: "ajuste-por-inflacion",
        nombre: { es: "Ajuste por inflación", en: "Inflation adjustment" },
        descripcion: { es: "Actualiza un precio por la inflación acumulada.", en: "Updates a price by accumulated inflation." },
        formula: "precio * (1 + inflacion / 100)",
        unidad_resultado: "$",
        variables: [v("precio", "$", "Precio a actualizar.", "Price to update."), v("inflacion", "%", "Inflación acumulada.", "Accumulated inflation.")],
      },
    ],
  },
  {
    clave: "electricidad",
    icono: "diagnostico",
    nombre: { es: "Electricidad", en: "Electricity" },
    queEs: { es: "Ley de Ohm, potencia y consumo.", en: "Ohm's law, power and consumption." },
    rubros: ["service"],
    ecuaciones: [
      {
        clave: "ley-de-ohm",
        nombre: { es: "Tensión (ley de Ohm)", en: "Voltage (Ohm's law)" },
        descripcion: { es: "La tensión a partir de la corriente y la resistencia.", en: "Voltage from current and resistance." },
        formula: "corriente * resistencia",
        unidad_resultado: "V",
        variables: [v("corriente", "A", "Corriente.", "Current."), v("resistencia", "Ω", "Resistencia.", "Resistance.")],
      },
      {
        clave: "corriente-ohm",
        nombre: { es: "Corriente (ley de Ohm)", en: "Current (Ohm's law)" },
        descripcion: { es: "La corriente a partir de la tensión y la resistencia.", en: "Current from voltage and resistance." },
        formula: "tension / resistencia",
        unidad_resultado: "A",
        variables: [v("tension", "V", "Tensión.", "Voltage."), v("resistencia", "Ω", "Resistencia.", "Resistance.")],
      },
      {
        clave: "potencia-electrica",
        nombre: { es: "Potencia eléctrica", en: "Electric power" },
        descripcion: { es: "Lo que consume un equipo.", en: "What a device draws." },
        formula: "tension * corriente",
        unidad_resultado: "W",
        variables: [v("tension", "V", "Tensión.", "Voltage."), v("corriente", "A", "Corriente.", "Current.")],
      },
      {
        clave: "consumo-mensual",
        nombre: { es: "Consumo mensual", en: "Monthly consumption" },
        descripcion: { es: "La energía que gasta un equipo en un mes.", en: "The energy a device uses in a month." },
        formula: "potencia * horas_por_dia * dias / 1000",
        unidad_resultado: "kWh",
        variables: [v("potencia", "W", "Potencia del equipo.", "Device power."), v("horas_por_dia", "h", "Horas de uso por día.", "Hours of use per day."), c("dias", 30, "días", "Días del mes.", "Days in the month.")],
      },
      {
        clave: "costo-de-consumo",
        nombre: { es: "Costo de la energía", en: "Energy cost" },
        descripcion: { es: "Lo que cuesta un consumo según la tarifa.", en: "What a consumption costs at a given rate." },
        formula: "kwh * tarifa",
        unidad_resultado: "$",
        variables: [v("kwh", "kWh", "Energía consumida.", "Energy used."), v("tarifa", "$/kWh", "Precio del kWh.", "Price per kWh.")],
      },
      {
        clave: "resistencias-en-paralelo",
        nombre: { es: "Dos resistencias en paralelo", en: "Two resistors in parallel" },
        descripcion: { es: "La resistencia equivalente de dos en paralelo.", en: "Equivalent resistance of two in parallel." },
        formula: "(r1 * r2) / (r1 + r2)",
        unidad_resultado: "Ω",
        variables: [v("r1", "Ω", "Primera resistencia.", "First resistor."), v("r2", "Ω", "Segunda resistencia.", "Second resistor.")],
      },
    ],
  },
  {
    clave: "automotor",
    icono: "llave",
    nombre: { es: "Automotor", en: "Automotive" },
    queEs: { es: "Consumo, viajes y motor.", en: "Fuel, trips and engine." },
    rubros: ["taller"],
    ecuaciones: [
      {
        clave: "consumo-cada-100",
        nombre: { es: "Consumo cada 100 km", en: "Fuel per 100 km" },
        descripcion: { es: "Cuántos litros gasta el vehículo cada 100 km.", en: "How many liters the vehicle uses per 100 km." },
        formula: "litros / km * 100",
        unidad_resultado: "L/100 km",
        variables: [v("litros", "L", "Litros cargados.", "Liters refueled."), v("km", "km", "Kilómetros recorridos.", "Kilometers driven.")],
      },
      {
        clave: "costo-de-viaje",
        nombre: { es: "Costo de combustible de un viaje", en: "Trip fuel cost" },
        descripcion: { es: "Lo que se gasta en combustible para recorrer una distancia.", en: "Fuel cost to cover a distance." },
        formula: "km * consumo / 100 * precio_litro",
        unidad_resultado: "$",
        variables: [v("km", "km", "Distancia.", "Distance."), v("consumo", "L/100 km", "Consumo del vehículo.", "Vehicle consumption."), v("precio_litro", "$/L", "Precio del litro.", "Price per liter.")],
      },
      {
        clave: "potencia-por-torque",
        nombre: { es: "Potencia según el torque", en: "Power from torque" },
        descripcion: { es: "La potencia del motor a partir del torque y las vueltas.", en: "Engine power from torque and RPM." },
        formula: "torque * rpm / 9549",
        unidad_resultado: "kW",
        variables: [v("torque", "N·m", "Torque del motor.", "Engine torque."), v("rpm", "rpm", "Vueltas por minuto.", "Revolutions per minute.")],
      },
      {
        clave: "cilindrada",
        nombre: { es: "Cilindrada", en: "Engine displacement" },
        descripcion: { es: "El volumen total del motor.", en: "Total engine volume." },
        formula: "pi / 4 * diametro ^ 2 * carrera * cilindros / 1000",
        unidad_resultado: "cm³",
        variables: [PI, v("diametro", "mm", "Diámetro del cilindro.", "Bore."), v("carrera", "mm", "Carrera del pistón.", "Stroke."), v("cilindros", "", "Cantidad de cilindros.", "Number of cylinders.")],
      },
      {
        clave: "velocidad-promedio",
        nombre: { es: "Velocidad promedio", en: "Average speed" },
        descripcion: { es: "Distancia dividida el tiempo.", en: "Distance divided by time." },
        formula: "km / horas",
        unidad_resultado: "km/h",
        variables: [v("km", "km", "Distancia.", "Distance."), v("horas", "h", "Tiempo.", "Time.")],
      },
    ],
  },
  {
    clave: "salud",
    icono: "persona",
    nombre: { es: "Salud", en: "Health" },
    queEs: { es: "Índices y dosis de uso diario en consultorio.", en: "Everyday clinic indexes and doses." },
    rubros: ["medicina"],
    ecuaciones: [
      {
        clave: "imc",
        nombre: { es: "Índice de masa corporal", en: "Body mass index" },
        descripcion: { es: "El peso en relación con la altura.", en: "Weight relative to height." },
        formula: "peso / altura ^ 2",
        unidad_resultado: "kg/m²",
        variables: [v("peso", "kg", "Peso.", "Weight."), v("altura", "m", "Altura.", "Height.")],
      },
      {
        clave: "dosis-por-peso",
        nombre: { es: "Dosis según el peso", en: "Weight-based dose" },
        descripcion: { es: "La dosis total a partir de la dosis por kilo.", en: "Total dose from the per-kilo dose." },
        formula: "peso * dosis_por_kg",
        unidad_resultado: "mg",
        variables: [v("peso", "kg", "Peso del paciente.", "Patient weight."), v("dosis_por_kg", "mg/kg", "Dosis indicada por kilo.", "Prescribed dose per kilo.")],
      },
      {
        clave: "frecuencia-maxima",
        nombre: { es: "Frecuencia cardíaca máxima", en: "Maximum heart rate" },
        descripcion: { es: "Estimación por edad (fórmula de Tanaka).", en: "Age-based estimate (Tanaka formula)." },
        formula: "208 - 0.7 * edad",
        unidad_resultado: "lpm",
        variables: [v("edad", "años", "Edad.", "Age.")],
      },
      {
        clave: "superficie-corporal",
        nombre: { es: "Superficie corporal", en: "Body surface area" },
        descripcion: { es: "Fórmula de Mosteller.", en: "Mosteller formula." },
        formula: "sqrt(altura_cm * peso / 3600)",
        unidad_resultado: "m²",
        variables: [v("altura_cm", "cm", "Altura.", "Height."), v("peso", "kg", "Peso.", "Weight.")],
      },
      {
        clave: "goteo",
        nombre: { es: "Velocidad de goteo", en: "Drip rate" },
        descripcion: { es: "Gotas por minuto para pasar un volumen en un tiempo.", en: "Drops per minute to infuse a volume over time." },
        formula: "volumen * factor / minutos",
        unidad_resultado: "gotas/min",
        variables: [v("volumen", "ml", "Volumen a pasar.", "Volume to infuse."), c("factor", 20, "gotas/ml", "Factor de goteo del equipo.", "Set drop factor."), v("minutos", "min", "Tiempo de infusión.", "Infusion time.")],
      },
    ],
  },
  {
    clave: "obra",
    icono: "tienda",
    nombre: { es: "Obra y superficies", en: "Construction and areas" },
    queEs: { es: "Superficies, volúmenes y materiales.", en: "Areas, volumes and materials." },
    rubros: ["personalizable"],
    ecuaciones: [
      {
        clave: "superficie-rectangulo",
        nombre: { es: "Superficie de un rectángulo", en: "Rectangle area" },
        descripcion: { es: "Largo por ancho.", en: "Length times width." },
        formula: "largo * ancho",
        unidad_resultado: "m²",
        variables: [v("largo", "m", "Largo.", "Length."), v("ancho", "m", "Ancho.", "Width.")],
      },
      {
        clave: "superficie-circulo",
        nombre: { es: "Superficie de un círculo", en: "Circle area" },
        descripcion: { es: "π por el radio al cuadrado.", en: "π times radius squared." },
        formula: "pi * radio ^ 2",
        unidad_resultado: "m²",
        variables: [PI, v("radio", "m", "Radio.", "Radius.")],
      },
      {
        clave: "volumen-hormigon",
        nombre: { es: "Volumen de hormigón", en: "Concrete volume" },
        descripcion: { es: "Para una losa o un contrapiso.", en: "For a slab or subfloor." },
        formula: "largo * ancho * espesor / 100",
        unidad_resultado: "m³",
        variables: [v("largo", "m", "Largo.", "Length."), v("ancho", "m", "Ancho.", "Width."), v("espesor", "cm", "Espesor.", "Thickness.")],
      },
      {
        clave: "litros-de-pintura",
        nombre: { es: "Litros de pintura", en: "Liters of paint" },
        descripcion: { es: "Cuánta pintura hace falta para cubrir una superficie.", en: "How much paint it takes to cover an area." },
        formula: "superficie * manos / rendimiento",
        unidad_resultado: "L",
        variables: [v("superficie", "m²", "Superficie a pintar.", "Area to paint."), v("manos", "", "Cantidad de manos.", "Number of coats."), c("rendimiento", 10, "m²/L", "Lo que cubre un litro.", "Coverage per liter.")],
      },
      {
        clave: "material-con-desperdicio",
        nombre: { es: "Material con desperdicio", en: "Material with waste" },
        descripcion: { es: "Suma un porcentaje por cortes y roturas.", en: "Adds a percentage for cuts and breakage." },
        formula: "superficie * (1 + desperdicio / 100)",
        unidad_resultado: "m²",
        variables: [v("superficie", "m²", "Superficie a cubrir.", "Area to cover."), c("desperdicio", 10, "%", "Desperdicio estimado.", "Estimated waste.")],
      },
    ],
  },
  {
    clave: "conversiones",
    icono: "flecha",
    nombre: { es: "Conversiones", en: "Conversions" },
    queEs: { es: "Pasar de una unidad a otra.", en: "From one unit to another." },
    rubros: [],
    ecuaciones: [
      {
        clave: "celsius-a-fahrenheit",
        nombre: { es: "Celsius a Fahrenheit", en: "Celsius to Fahrenheit" },
        descripcion: { es: "Convierte una temperatura.", en: "Converts a temperature." },
        formula: "celsius * 9 / 5 + 32",
        unidad_resultado: "°F",
        variables: [v("celsius", "°C", "Temperatura en grados Celsius.", "Temperature in Celsius.")],
      },
      {
        clave: "pulgadas-a-cm",
        nombre: { es: "Pulgadas a centímetros", en: "Inches to centimeters" },
        descripcion: { es: "Convierte una medida.", en: "Converts a length." },
        formula: "pulgadas * 2.54",
        unidad_resultado: "cm",
        variables: [v("pulgadas", "in", "Medida en pulgadas.", "Length in inches.")],
      },
      {
        clave: "libras-a-kg",
        nombre: { es: "Libras a kilos", en: "Pounds to kilograms" },
        descripcion: { es: "Convierte un peso.", en: "Converts a weight." },
        formula: "libras * 0.45359237",
        unidad_resultado: "kg",
        variables: [v("libras", "lb", "Peso en libras.", "Weight in pounds.")],
      },
      {
        clave: "psi-a-bar",
        nombre: { es: "PSI a bar", en: "PSI to bar" },
        descripcion: { es: "Convierte una presión, por ejemplo la de un neumático.", en: "Converts a pressure, such as a tire's." },
        formula: "psi * 0.0689476",
        unidad_resultado: "bar",
        variables: [v("psi", "psi", "Presión en PSI.", "Pressure in PSI.")],
      },
      {
        clave: "a-dolares",
        nombre: { es: "Pesos a dólares", en: "Pesos to dollars" },
        descripcion: { es: "Convierte un monto según la cotización.", en: "Converts an amount at an exchange rate." },
        formula: "pesos / cotizacion",
        unidad_resultado: "US$",
        variables: [v("pesos", "$", "Monto en pesos.", "Amount in pesos."), v("cotizacion", "$/US$", "Cotización del dólar.", "Dollar exchange rate.")],
      },
    ],
  },
];

const enIdioma = (texto, idioma) => (texto && typeof texto === "object" ? texto[idioma] ?? texto.es : texto ?? "");
const sinTildes = (texto) => String(texto ?? "").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "");

// La biblioteca en un idioma, con cada ecuación lista para mostrar: los textos
// ya elegidos y la categoría escrita como se va a guardar.
export function bibliotecaEn(idioma = "es") {
  return CATEGORIAS.map((categoria) => {
    const nombre = enIdioma(categoria.nombre, idioma);
    return {
      clave: categoria.clave,
      icono: categoria.icono,
      nombre,
      queEs: enIdioma(categoria.queEs, idioma),
      rubros: categoria.rubros,
      ecuaciones: categoria.ecuaciones.map((ecuacion) => ({
        clave: `${categoria.clave}/${ecuacion.clave}`,
        nombre: enIdioma(ecuacion.nombre, idioma),
        descripcion: enIdioma(ecuacion.descripcion, idioma),
        formula: ecuacion.formula,
        categoria: nombre,
        unidad_resultado: enIdioma(ecuacion.unidad_resultado, idioma),
        variables: ecuacion.variables.map((variable) => ({
          tipo: variable.tipo,
          nombre: variable.nombre,
          descripcion: enIdioma(variable.descripcion, idioma),
          valor: variable.valor ?? null,
          unidad: enIdioma(variable.unidad, idioma),
        })),
      })),
    };
  });
}

// Primero las categorías del rubro del negocio, después las demás, cada grupo
// en el orden del catálogo.
export function ordenarParaElRubro(categorias, rubro) {
  const delRubro = (categoria) => Boolean(rubro) && categoria.rubros.includes(rubro);
  return [...categorias.filter(delRubro), ...categorias.filter((categoria) => !delRubro(categoria))]
    .map((categoria) => ({ ...categoria, delRubro: delRubro(categoria) }));
}

// Busca en el nombre, la descripción y la fórmula, sin importar tildes ni
// mayúsculas. Las categorías que se quedan sin ecuaciones no se devuelven.
export function filtrarBiblioteca(categorias, { busqueda = "", categoria = "" } = {}) {
  const texto = sinTildes(busqueda).trim();
  return categorias
    .filter((actual) => !categoria || actual.clave === categoria)
    .map((actual) => ({
      ...actual,
      ecuaciones: actual.ecuaciones.filter((ecuacion) => !texto
        || [ecuacion.nombre, ecuacion.descripcion, ecuacion.formula].some((campo) => sinTildes(campo).includes(texto))),
    }))
    .filter((actual) => actual.ecuaciones.length);
}

// La ecuación guardada del negocio que ya tiene la misma fórmula, si hay.
export const yaGuardada = (plantilla, ecuaciones = []) =>
  ecuaciones.find((ecuacion) => mismaExpresion(ecuacion.formula, plantilla.formula)) ?? null;

const idNuevo = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

// Lo que se manda a crearEcuacion: cada variable con un id propio, porque las
// variables de dos ecuaciones guardadas no pueden compartirlo.
export const paraGuardar = (plantilla) => ({
  nombre: plantilla.nombre,
  formula: plantilla.formula,
  descripcion: plantilla.descripcion,
  categoria: plantilla.categoria,
  unidad_resultado: plantilla.unidad_resultado,
  variables: plantilla.variables.map((variable) => ({ ...variable, id: idNuevo() })),
  dependencias: [],
});

// Comprobación de contenido para las pruebas: cada plantilla pasa las mismas
// validaciones que una ecuación escrita a mano.
export const errorDePlantilla = (plantilla) => nuevaEcuacion(paraGuardar(plantilla)).error ?? null;
