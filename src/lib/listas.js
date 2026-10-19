// Las respuestas de una escritura se mezclan con lo que ya está en pantalla.
// Si una lista vieja quedó repetida, actualizar una fila también tiene que
// sanearla: React no puede distinguir dos elementos con el mismo id.
export function unicosPorId(lista = []) {
  const vistos = new Set();
  return lista.filter((item) => {
    if (!item?.id || vistos.has(item.id)) return false;
    vistos.add(item.id);
    return true;
  });
}

export function reemplazarUnicoPorId(lista = [], item) {
  if (!item?.id) return unicosPorId(lista);

  let reemplazado = false;
  const vistos = new Set();
  const resultado = [];
  for (const actual of lista) {
    if (actual?.id === item.id) {
      if (!reemplazado) {
        resultado.push(item);
        vistos.add(item.id);
        reemplazado = true;
      }
    } else if (actual?.id && !vistos.has(actual.id)) {
      resultado.push(actual);
      vistos.add(actual.id);
    }
  }
  return reemplazado ? resultado : [item, ...resultado];
}
