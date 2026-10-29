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
import { paisInicial, telefonoLegible } from "@/lib/telefono";
import { useIdioma } from "@/lib/useIdioma";
import { avisoAlAnotar } from "@/lib/recordatorios";
import { Boton, Campo, Tarjeta, TituloSeccion, claseDeEntrada } from "@/componentes/ui";
import HorarioDeTurno from "@/componentes/HorarioDeTurno";
import CampoTelefono,{ useTelefono } from "@/componentes/CampoTelefono";

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
  //
  // Si hay dos con el mismo nombre no se adivina: se muestran con su teléfono
  // para elegir, y el turno va a la ficha tocada ("elegidoId").
  const escrito = form.nombreCliente.trim().toLowerCase();
  const [elegidoId, setElegidoId] = useState(null);
  const iguales = escrito ? clientes.filter((c) => c.nombre.toLowerCase() === escrito) : [];
  const elegido = iguales.find((c) => c.id === elegidoId);
  const yaEsCliente = elegido ?? (iguales.length === 1 ? iguales[0] : undefined);
  const hayQueElegir = iguales.length > 1 && !elegido;
  // La lista de clientes: la abre la flecha (todos) o escribir (los que
  // contienen lo escrito, que se van descartando letra a letra).
  const [lista, setLista] = useState(null); // null | "todos" | "filtrar"
  const ofrecer = !lista
    ? []
    : lista === "todos" || !escrito
      ? clientes
      : clientes.filter((c) => c.nombre.toLowerCase().includes(escrito));

  // Mientras se guarda, el botón no se puede volver a tocar: un segundo toque
  // anotaría otro turno.
  const [guardando, setGuardando] = useState(false);

  const pideTelefono = !!form.nombreCliente.trim() && !yaEsCliente && !hayQueElegir;
  const errorTelefono = pideTelefono && !tel.vacio && !tel.armado.ok ? tel.armado.mensaje : null;

  const motivoApagado = guardando
    ? t("agenda.alta.guardando")
    : errorTelefono
    ? t("agenda.alta.telefonoNoSirve")
    : hayQueElegir
    ? t("agenda.alta.faltaElegirCliente")
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
      >
        <div
          className="relative mt-2"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setLista(null);
          }}
          onKeyDown={(e) => e.key === "Escape" && setLista(null)}
        >
          <input
            id="turno-cliente"
            className={`${claseDeEntrada({ exito: !!yaEsCliente })} ${clientes.length > 0 ? "pr-14" : ""}`}
            value={form.nombreCliente}
            onChange={(e) => {
              setElegidoId(null);
              setLista("filtrar");
              setForm({ ...form, nombreCliente: e.target.value });
            }}
            autoComplete="off"
          />
          {clientes.length > 0 && (
            <button
              type="button"
              aria-label={t("agenda.alta.verClientes")}
              aria-expanded={ofrecer.length > 0}
              className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-tinta-media"
              onClick={() => setLista(lista ? null : "todos")}
            >
              <span aria-hidden="true">▾</span>
            </button>
          )}
          {ofrecer.length > 0 && (
            // El mousedown no le saca el foco al campo: si no, el blur cierra
            // la lista antes de que el click llegue.
            <ul
              role="listbox"
              onMouseDown={(e) => e.preventDefault()}
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-campo border border-borde bg-tarjeta shadow-lg"
            >
              {ofrecer.map((c) => (
                <li key={c.id} role="option" aria-selected={c.id === elegidoId} className="border-b border-borde last:border-b-0">
                  <button
                    type="button"
                    data-testid="turno-cliente-opcion"
                    className="block min-h-12 w-full cursor-pointer px-4 py-2 text-left hover:bg-superficie"
                    onClick={() => {
                      setElegidoId(c.id);
                      setLista(null);
                      setForm({ ...form, nombreCliente: c.nombre });
                    }}
                  >
                    <span className="block font-bold text-tinta">{c.nombre}</span>
                    <span className="block text-etiqueta text-tinta-media">
                      {telefonoLegible(c.telefono) || t("inicio.clientes.sinTelefono")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Campo>

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
      <HorarioDeTurno
        etiqueta={t("agenda.alta.cuando")}
        ayuda={t("agenda.alta.cuandoAyuda")}
        valor={form.empiezaEn}
        onChange={(empiezaEn) => setForm({ ...form, empiezaEn })}
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
          data-testid="turno-guardar"
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
