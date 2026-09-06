"use client";

// "Iniciar sesión".
//
// En esta entrega (SCRUM-5) sólo está la vía de escape: entrar con los datos
// de ejemplo, sin contraseña. El formulario de mail y contraseña llega en
// SCRUM-9.

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Boton, Tarjeta, TituloPantalla } from "@/componentes/ui";

export default function IniciarSesion() {
  const router = useRouter();
  const { entrarComoDemo, haySupabase } = useAuth();

  function verEjemplo() {
    entrarComoDemo();
    router.replace("/");
  }

  return (
    <>
      <TituloPantalla apoyo="Entrá para ver los casos de tu negocio.">
        Iniciar sesión
      </TituloPantalla>

      <Tarjeta>
        <p className="text-tinta-media">
          {haySupabase
            ? "El ingreso con mail y contraseña se agrega en la próxima entrega."
            : "Todavía no hay una base de Supabase conectada. Podés recorrer todo el sistema con los datos de ejemplo."}
        </p>

        <div className="mt-6">
          <Boton icono="tienda" onClick={verEjemplo}>
            Entrar con los datos de ejemplo
          </Boton>
        </div>
      </Tarjeta>
    </>
  );
}
