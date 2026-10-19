// Cada producto guarda sus cambios en orden; productos distintos pueden
// guardarse en paralelo. esperar() permite consultar estadísticas después
// de que se hayan confirmado los cambios iniciados desde el inventario.
export function crearColaStock() {
  const pendientes = new Map();
  return {
    encolar(id, guardar) {
      const anterior = pendientes.get(id)?.promesa ?? Promise.resolve();
      const entrada = {};
      const promesa = anterior.catch(() => {}).then(() => guardar(() => pendientes.get(id) === entrada));
      entrada.promesa = promesa;
      pendientes.set(id, entrada);
      const limpiar = () => { if (pendientes.get(id) === entrada) pendientes.delete(id); };
      promesa.then(limpiar, limpiar);
      return promesa;
    },
    async esperar() {
      while (pendientes.size) await Promise.allSettled([...pendientes.values()].map((p) => p.promesa));
    },
  };
}
