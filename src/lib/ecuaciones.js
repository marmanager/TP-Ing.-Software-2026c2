const TOKEN = /\s*(\d+(?:\.\d+)?|[A-Za-zÁÉÍÓÚÜáéíóúüÑñ_][A-Za-zÁÉÍÓÚÜáéíóúüÑñ_0-9]*|[()+\-*/^])\s*/gy;

export function validarFormula(formula) {
  const texto = String(formula ?? '').trim();
  if (!texto) return 'La fórmula es obligatoria.';
  const tokens = [];
  let posicion = 0;
  while (posicion < texto.length) {
    TOKEN.lastIndex = posicion;
    const encontrado = TOKEN.exec(texto);
    if (!encontrado) {
      if (/^\s+$/.test(texto.slice(posicion))) break;
      return 'La fórmula contiene un símbolo no válido.';
    }
    tokens.push(encontrado[1]);
    posicion = TOKEN.lastIndex;
  }
  let profundidad = 0;
  let esperaValor = true;
  for (const token of tokens) {
    if (token === '(') { if (!esperaValor) return 'Falta un operador antes del paréntesis.'; profundidad++; continue; }
    if (token === ')') {
      if (esperaValor || profundidad === 0) return 'Los paréntesis no son válidos.';
      profundidad--; esperaValor = false; continue;
    }
    if (/^[+\-*/^]$/.test(token)) {
      if (esperaValor && token !== '-') return 'Falta un valor en la fórmula.';
      esperaValor = true; continue;
    }
    if (!esperaValor) return 'Falta un operador entre valores.';
    esperaValor = false;
  }
  if (esperaValor || profundidad) return 'La fórmula está incompleta.';
  return null;
}

export function nuevaEcuacion({ nombre, formula, descripcion = '', categoria = '' }) {
  const nombreLimpio = String(nombre ?? '').trim();
  const formulaLimpia = String(formula ?? '').trim();
  if (!nombreLimpio) return { error: 'El nombre es obligatorio.', campo: 'nombre' };
  const errorFormula = validarFormula(formulaLimpia);
  if (errorFormula) return { error: errorFormula, campo: 'formula' };
  return {
    ecuacion: {
      nombre: nombreLimpio,
      formula: formulaLimpia,
      descripcion: String(descripcion ?? '').trim(),
      categoria: String(categoria ?? '').trim(),
    },
  };
}

const expresionComparable = (valor) => String(valor ?? '').replace(/\s+/g, '');

export const mismaExpresion = (a, b) => expresionComparable(a) === expresionComparable(b);
