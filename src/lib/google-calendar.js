// Datos de un turno en Google. El ID estable evita duplicados al reintentar.
export const idEventoGoogle = (id) => `m${id.replaceAll("-", "").toLowerCase()}`;

export function eventoGoogle(turno, cliente, minutosPorDefecto = 30) {
  const empieza = new Date(turno.empieza_en);
  const minutos = Number(turno.minutos_reservados) > 0
    ? Number(turno.minutos_reservados) : minutosPorDefecto;
  return {
    id: idEventoGoogle(turno.id),
    summary: cliente?.nombre ? `${turno.motivo} · ${cliente.nombre}` : turno.motivo,
    description: [cliente?.nombre && `Para: ${cliente.nombre}`,
      cliente?.telefono && `Teléfono: ${cliente.telefono}`].filter(Boolean).join("\n"),
    start: { dateTime: empieza.toISOString() },
    end: { dateTime: new Date(empieza.getTime() + minutos * 60000).toISOString() },
  };
}
