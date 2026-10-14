// Las invitaciones con rol ya no existen: el equipo se suma con un solo link
// (docs/equipo-por-link.md). Quien tenía guardada esta dirección va al equipo.

import { redirect } from "next/navigation";

export default function Invitaciones() {
  redirect("/equipo");
}
