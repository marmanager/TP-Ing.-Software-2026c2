import Lienzo from "./Lienzo";
import Icono from "@/componentes/Icono";

// La landing en chico, con datos de ejemplo, para ver cómo queda mientras se
// edita. Es una imitación: los botones son de mentira (no se pueden tocar ni
// enfocar). Las secciones de la página pública (landing/secciones/) no la
// reemplazan: necesitan los datos del negocio y la llave de un cliente, y acá
// no hay ni una cosa ni la otra. Los títulos sí son los mismos.

function Seccion({ titulo, children }) {
  return (
    <section className="rounded-tarjeta border border-borde bg-tarjeta p-4">
      <h3 className="text-subtitulo font-extrabold">{titulo}</h3>
      <div className="mt-2 grid justify-items-start gap-2 text-tinta-media">{children}</div>
    </section>
  );
}

function BotonDeMentira({ icono, children }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-campo bg-azul px-4 font-bold text-white">
      {icono && <Icono nombre={icono} className="size-5" />}
      {children}
    </span>
  );
}

const CONTENIDO = {
  negocio: (negocio) => (
    <>
      <p>{negocio?.telefono || "341 555 1234"}</p>
      <p>Lunes a viernes, de 9 a 18.</p>
      <BotonDeMentira icono="whatsapp">Escribinos</BotonDeMentira>
    </>
  ),
  sacar_turno: () => (
    <>
      <div className="flex flex-wrap gap-2">
        {["Lun 20", "Mar 21", "Mié 22"].map((dia) => (
          <span key={dia} className="rounded-campo bg-azul-claro px-3 py-2 font-bold text-azul">
            {dia}
          </span>
        ))}
      </div>
      <BotonDeMentira>Pedir turno</BotonDeMentira>
    </>
  ),
  mis_casos: () => (
    <>
      <p className="flex flex-wrap items-center gap-2 text-tinta">
        Caso 248
        <span className="lienzo-acento rounded-full px-3 py-1 font-bold text-etiqueta">
          En proceso
        </span>
      </p>
      <span className="font-bold text-azul">Ver cómo viene</span>
    </>
  ),
  mis_turnos: () => <p>Martes 21, 10:00 · Cambio de aceite</p>,
};

export default function VistaPrevia({ landing, negocio, secciones }) {
  return (
    <figure>
      <figcaption className="mb-2 font-bold text-etiqueta text-tinta-media">
        Así la ve tu cliente
      </figcaption>
      <Lienzo landing={landing} className="mx-auto max-w-sm rounded-tarjeta border border-borde-fuerte p-4">
        <h2 className="text-seccion font-extrabold">{negocio?.nombre ?? "Tu negocio"}</h2>
        <div className="mt-4 grid gap-3">
          {secciones.map((s) => (
            <Seccion key={s.clave} titulo={s.nombre}>
              {CONTENIDO[s.clave](negocio)}
            </Seccion>
          ))}
        </div>
      </Lienzo>
    </figure>
  );
}
