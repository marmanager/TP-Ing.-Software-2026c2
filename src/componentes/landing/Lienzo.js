import { FUENTES_LANDING } from "./fuentes";
import { variablesDeColor, variablesDeFuente } from "@/lib/landing";

// El contenedor de la landing: pisa en su style las variables de color y de
// fuente de globals.css con las del negocio. Así todo lo de adentro —también
// los componentes de siempre, como Boton y Tarjeta— se pinta con lo que
// eligió. Funciona porque el tema es "@theme" y no "@theme inline": las
// utilidades usan var(--color-…).
//
// Las reglas que lo completan ([data-lienzo]) están al final de globals.css.
// Es un atributo y no la clase "landing", que es de /bienvenida.
export default function Lienzo({ landing, className = "", children, ...props }) {
  return (
    <div
      data-lienzo=""
      className={[FUENTES_LANDING[landing.fuente]?.variable ?? "", className].join(" ")}
      style={{ ...variablesDeColor(landing), ...variablesDeFuente(landing) }}
      {...props}
    >
      {children}
    </div>
  );
}
