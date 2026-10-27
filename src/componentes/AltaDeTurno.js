"use client";

// El alta de un turno, en una sola pieza.
//
// Estaba escrita adentro de la pantalla de Turnos. Ahora también se anota un
// turno desde el Calendario, parado en un día, y dos formularios que piden lo
// mismo se separan solos: el día que se agregue un campo, uno de los dos se
// queda sin él.
//
// La única diferencia entre los dos lugares es con qué llega cargado el día y
// la hora, y eso entra por "cuandoSugerido".

import { useState } from "react";
import { useDatos } from "@/lib/datos";
import { ejemplosDe } from "@/lib/presets";
import { paraInput } from "@/lib/fechas";
import { paisInicial } from "@/lib/telefono";
import { useIdioma } from "@/lib/useIdioma";
import { avisoAlAnotar } from "@/lib/recordatorios";
import { Boton, Campo, Tarjeta, TituloSeccion } from "@/componentes/ui";
import CampoTelefono, { useTelefono } from "@/componentes/CampoTelefono";

const VACIO = { nombreCliente: "", motivo: "", empiezaEn: "" };

export default function AltaDeTurno({
  cuandoSugerido = "",
  alGuardar,
  alCancelar,
  className = "",
}) {
  const datos = useDatos();
  const { idioma, locale, t } = useIdioma();
  const { clientes, negocio } = datos;
  const [form, setForm] = useState({ ...VACIO, empiezaEn: cuandoSugerido });
  // El teléfono, con el selector de país (B-1b). Sólo cuenta si es alguien
  // nuevo: al que ya está cargado no se le pide.
  const paisNegocio = paisInicial(negocio);
  const tel = useTelefono("", paisNegocio);

  // Si el nombre coincide con alguien ya cargado, se le suma el turno a esa
  // ficha; si no, se da de alta el cliente junto con el turno.
  const yaEsCliente = clientes.find(
    (c) => c.nombre.toLowerCase() === form.nombreCliente.trim().toLowerCase()
  );

  // Mientras se guarda, el botón no se puede volver a tocar: un segundo toque
  // anotaría otro turno.
  const [guardando, setGuardando] = useState(false);

  const pideTelefono = !!form.nombreCliente.trim() && !yaEsCliente;
  const errorTelefono = pideTelefono && !tel.vacio && !tel.armado.ok ? tel.armado.mensaje : null;

  const motivoApagado = guardando
    ? t("agenda.alta.guardando")
    : errorTelefono
    ? t("agenda.alta.telefonoNoSirve")
    : !form.motivo.trim()
    ? t("agenda.alta.faltaMotivo")
    : !form.empiezaEn
      ? t("agenda.alta.faltaCuando")
      : null;

  async function guardar() {
    setGuardando(true);
    const r = await datos.agregarTurno({
      ...form,
      telefono: pideTelefono && !tel.vacio ? tel.telefono : "",
      clienteId: yaEsCliente?.id ?? null,
    });
    setGuardando(false);
    // Si no se pudo (por ejemplo, ya hay un turno a esa hora), el aviso ya lo
    // dio datos.js y el formulario queda con lo escrito, para cambiar la hora.
    if (!r) return;
    datos.avisarExito(
      [t("agenda.alta.listo", { motivo: form.motivo.trim() }), avisoAlAnotar(r.recordatorio, { t, locale, idioma })].filter(Boolean).join(" ")
    );
    setForm({ ...VACIO, empiezaEn: cuandoSugerido });
    tel.cargar("");
    alGuardar?.();
  }

  return (
    <Tarjeta className={`max-w-[560px] ${className}`}>
      <TituloSeccion>{t("agenda.alta.titulo")}</TituloSeccion>

      <Campo
        id="turno-cliente"
        etiqueta={t("agenda.alta.paraQuien")}
        ayuda={t("agenda.alta.paraQuienAyuda")}
        exito={yaEsCliente ? t("agenda.alta.yaEsCliente", { nombre: yaEsCliente.nombre }) : null}
        value={form.nombreCliente}
        onChange={(e) => setForm({ ...form, nombreCliente: e.target.value })}
        list="clientes-de-la-agenda"
        autoComplete="off"
      />
      <datalist id="clientes-de-la-agenda">
        {clientes.map((c) => (
          <option key={c.id} value={c.nombre} />
        ))}
      </datalist>

      {/* El teléfono sólo si es alguien nuevo: al que ya está cargado no
          hay que volver a pedírselo. */}
      {pideTelefono && (
        <CampoTelefono
          id="turno-telefono"
          etiqueta={t("agenda.alta.telefono")}
          ayuda={t("agenda.alta.telefonoAyuda")}
          paisPorDefecto={paisNegocio}
          error={errorTelefono}
          valor={tel.valor}
          onChange={tel.setValor}
        />
      )}

      <Campo
        id="turno-motivo"
        etiqueta={t("agenda.alta.paraQue")}
        ayuda={t("agenda.alta.paraQueAyuda", { ejemplo: ejemplosDe(negocio?.rubro, idioma).turno })}
        value={form.motivo}
        onChange={(e) => setForm({ ...form, motivo: e.target.value })}
      />
      <Campo
        id="turno-cuando"
        etiqueta={t("agenda.alta.cuando")}
        ayuda={t("agenda.alta.cuandoAyuda")}
        type="datetime-local"
        min={paraInput()}
        value={form.empiezaEn}
        onChange={(e) => setForm({ ...form, empiezaEn: e.target.value })}
      />
      {/* Guardar y cancelar juntos, al pie del formulario y no arriba.
          Antes, salir del alta era el mismo botón de "Anotar un turno", en el
          mismo lugar, con otro texto: el dedo iba al lugar de siempre y hacía
          lo contrario de lo que esperaba.

          En celular van apilados y a todo el ancho, como el resto del sistema.
          Cancelar va segundo: lo que se hace casi siempre va primero. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton
          variante="principal"
          icono="check"
          motivo={motivoApagado}
          className="w-full sm:w-auto"
          onClick={guardar}
        >
          {t("agenda.alta.guardar")}
        </Boton>
        {alCancelar && (
          <Boton
            variante="peligro"
            icono="tacho"
            className="w-full sm:w-auto"
            onClick={() => {
              setForm({ ...VACIO, empiezaEn: cuandoSugerido });
              alCancelar();
            }}
          >
            {t("agenda.alta.cancelar")}
          </Boton>
        )}
      </div>
    </Tarjeta>
  );
}
