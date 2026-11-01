import { Tarjeta } from "@/componentes/ui";

export default function PanelAsistente({ titulo, apoyo, t, children, className = "" }) {
  return (
    <Tarjeta className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-titulo font-extrabold text-subtitulo">{titulo}</p>
          {apoyo && <p className="mt-1 max-w-[65ch] text-tinta-media">{apoyo}</p>}
        </div>
        <span className="rounded-full bg-superficie px-3 py-1 font-bold text-etiqueta text-tinta-media">
          {t("asistente.etiqueta")}
        </span>
      </div>
      {children}
      <p className="mt-4 text-apoyo text-tinta-suave">{t("asistente.privacidad")}</p>
    </Tarjeta>
  );
}

