// A dónde va una cuenta real al iniciar sesión (docs/multinegocio.md).
//
//   { ir: "crear" }                  no está en ningún negocio
//   { ir: "entrar", negocio: id }    Inicio rápido, con un predeterminado que
//                                    sigue siendo suyo
//   { ir: "elegir" }                 todo lo demás: el selector
//
// El predeterminado se busca entre sus negocios y no se cree a ciegas: si lo
// sacaron de ese equipo, entrar directo fallaría, y es mejor que elija.
export function alEntrar({ negocios = [], predeterminado = null, inicioRapido = false } = {}) {
  if (negocios.length === 0) return { ir: "crear" };
  if (inicioRapido && negocios.some((n) => n.id === predeterminado)) {
    return { ir: "entrar", negocio: predeterminado };
  }
  return { ir: "elegir" };
}
