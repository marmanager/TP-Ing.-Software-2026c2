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
import { Boton, Campo, Tarjeta, TituloSeccion } from "@/componentes/ui";

const VACIO = { nombreCliente: "", telefono: "", motivo: "", empiezaEn: "" };

export default function AltaDeTurno({
  cuandoSugerido = "",
  alGuardar,
  alCancelar,
  className = "",
}) {
  const datos = useDatos();
  const { clientes, negocio } = datos;
  const [form, setForm] = useState({ ...VACIO, empiezaEn: cuandoSugerido });

  // Si el nombre coincide con alguien ya cargado, se le suma el turno a esa
  // ficha; si no, se da de alta el cliente junto con el turno.
  const yaEsCliente = clientes.find(
    (c) => c.nombre.toLowerCase() === form.nombreCliente.trim().toLowerCase()
  );

  const motivoApagado = !form.motivo.trim()
    ? "falta el motivo"
    : !form.empiezaEn
      ? "falta el día y la hora"
      : null;

  function guardar() {
    datos.agregarTurno({ ...form, clienteId: yaEsCliente?.id ?? null });
    datos.avisarExito(`Listo. El turno de ${form.motivo.trim()} quedó anotado.`);
    setForm({ ...VACIO, empiezaEn: cuandoSugerido });
    alGuardar?.();
  }

  return (
    <Tarjeta className={`max-w-[560px] ${className}`}>
      <TituloSeccion>Nuevo turno</TituloSeccion>

      <Campo
        id="turno-cliente"
        etiqueta="Para quién"
        ayuda="Si todavía no está cargado, escribí su nombre igual: lo damos de alta con el turno."
        exito={yaEsCliente ? `Ya es cliente. Le sumamos este turno a ${yaEsCliente.nombre}.` : null}
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
      {form.nombreCliente.trim() && !yaEsCliente && (
        <Campo
          id="turno-telefono"
          etiqueta="Su teléfono"
          ayuda="Opcional. Sirve para avisarle si hay que mover el turno."
          ejemplo="341 456 7890"
          type="tel"
          inputMode="tel"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />
      )}

      <Campo
        id="turno-motivo"
        etiqueta="Para qué viene"
        ayuda={`Con las palabras del cliente. Ejemplo: ${ejemplosDe(negocio?.rubro).turno}.`}
        value={form.motivo}
        onChange={(e) => setForm({ ...form, motivo: e.target.value })}
      />
      <Campo
        id="turno-cuando"
        etiqueta="Qué día y a qué hora"
        ayuda="Se puede cambiar después."
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
          Guardar el turno
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
            Cancelar
          </Boton>
        )}
      </div>
    </Tarjeta>
  );
}
