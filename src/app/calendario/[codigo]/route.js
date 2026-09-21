// La dirección a la que se suscribe el calendario del dueño (SCRUM-20, fase 2).
//
// Es el único route handler del proyecto, y tiene que serlo: lo que lee esto
// no es un navegador con React adentro, es el servidor de Google o el de Apple
// pidiendo un archivo. Una pantalla no sirve; hace falta devolver texto plano
// con su tipo de contenido.
//
// Corre en el servidor, así que usa la clave anónima igual que el navegador y
// la única puerta sigue siendo ver_agenda_ics(), que es "security definer".
// No hay ninguna clave de servicio acá: si la hubiera, este archivo pasaría a
// ser capaz de leer cualquier negocio, y no tiene por qué.

import { createClient } from "@supabase/supabase-js";
import { armarIcs } from "@/lib/ics";
import { normalizarHorarios } from "@/lib/horarios";

// Cada pedido lee la base. Sin esto Next serviría una copia guardada y el
// calendario mostraría los turnos de la primera vez que alguien entró.
export const dynamic = "force-dynamic";

const vacio = (texto) =>
  new Response(texto, {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

export async function GET(_pedido, { params }) {
  const { codigo: crudo } = await params;

  // La dirección termina en ".ics" porque hay clientes de calendario que miran
  // la extensión antes que el tipo de contenido. El código es lo de antes.
  const codigo = String(crudo ?? "").replace(/\.ics$/i, "");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) {
    // En el modo de ejemplo los turnos viven en el navegador de cada uno y no
    // hay ninguna base que este servidor pueda leer. La pantalla de horarios
    // lo explica y ofrece bajar el archivo de una vez.
    return vacio("Esta copia no tiene base de datos conectada.");
  }

  const supabase = createClient(url, clave, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("ver_agenda_ics", { p_codigo: codigo });

  // El mismo "no" para un código que nunca existió, uno revocado y un error de
  // la base: un "no" distinto sería la confirmación de que ese código alguna
  // vez sirvió.
  if (error || !data?.sirve) return vacio("Este link no sirve.");

  const horarios = normalizarHorarios(data.horarios);
  const ics = armarIcs({
    negocio: { nombre: data.negocio_nombre },
    turnos: data.turnos ?? [],
    minutosPorDefecto: horarios?.minutos ?? 30,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      // Google y Apple releen cuando quieren y no respetan esto, pero un
      // proxy en el medio sí, y guardarlo una hora dejaría la agenda vieja.
      "cache-control": "no-store",
      // Si alguien abre la dirección en el navegador en vez de suscribirse,
      // que le baje un archivo con nombre en vez de mostrarle texto crudo.
      "content-disposition": 'inline; filename="agenda.ics"',
    },
  });
}
