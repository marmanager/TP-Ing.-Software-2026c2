"use client";

// "Abrir un caso nuevo" (cartilla, sección 08).
//
// La usa el mostrador, apurado, con el cliente enfrente.
// Objetivo: menos de un minuto.
//
// La cartilla pide cuatro campos: cliente, teléfono, qué necesita y quién lo
// va a atender. Acá van cinco, y el quinto es a propósito: el identificador
// del rubro —la patente, el DNI, el número de serie— es lo más certero que
// tenemos para reconocer el caso después. Un nombre se escribe de diez formas
// distintas; una patente, no. Y se lo tiene enfrente al abrirlo, así que no
// cuesta el minuto que la cartilla quiere cuidar.
//
// Sigue dentro de la regla general de la sección 05: nunca más de seis campos.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { preset, comoSeIdentifica, ejemplosDe } from "@/lib/presets";
import {
  alCambiarElNombre,
  alElegirCliente,
  clienteDelAlta,
  clientesConEseNombre,
  faltantesDelAlta,
  motivoDeFaltantes,
  sugerirClientes,
  telefonoValido,
} from "@/lib/validaciones";
import { horaYMinutos } from "@/lib/fechas";
import { Boton, BotonPrincipalFijo, Campo, Cargando, MarcaFalta } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

// useSearchParams necesita un límite de Suspense para que la pantalla se
// pueda seguir generando estática. Adentro no hay nada que esperar: el turno
// se lee del navegador y el formulario se dibuja igual.
export default function CasoNuevo() {
  return (
    <Suspense fallback={<Cargando />}>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  const router = useRouter();
  const { cargando, clientes, empleados, turnos, negocio, abrirCaso, avisarExito } =
    useDatos();
  useTitulo("Abrir un caso nuevo");

  // El caso puede salir de un turno: alguien pidió hora, vino, y esto es lo
  // que venía a hacer. En ese caso el nombre, el teléfono y el motivo ya
  // están anotados y no se vuelven a pedir (cartilla, sección 08: el alta
  // tiene que entrar en un minuto).
  const idTurno = useSearchParams().get("turno");
  const turno = turnos.find((t) => t.id === idTurno) ?? null;
  const delTurno = turno ? clientes.find((c) => c.id === turno.cliente_id) : null;

  const [nombre, setNombre] = useState(delTurno?.nombre ?? "");
  const [telefono, setTelefono] = useState(delTurno?.telefono ?? "");
  // El cliente elegido de la lista de sugerencias, que es a quien va el caso
  // (las reglas están en lib/validaciones.js). El del turno cuenta como
  // elegido: el turno ya dice de quién es.
  const [elegido, setElegido] = useState(delTurno ?? null);
  // La lista de sugerencias: si está abierta y cuál está marcada con las
  // flechas (-1 es ninguna).
  const [listaAbierta, setListaAbierta] = useState(false);
  const [marcada, setMarcada] = useState(-1);
  const [identificador, setIdentificador] = useState("");
  const [servicio, setServicio] = useState(turno?.motivo ?? "");
  const [responsable, setResponsable] = useState("");
  const [tocado, setTocado] = useState({});
  const [saliendo, setSaliendo] = useState(false);
  const guardandoRef = useRef(false);
  const [guardando, setGuardando] = useState(false);

  // Lo que había al entrar: si el caso sale de un turno, los datos del turno
  // no cuentan como "escrito", porque siguen estando en el turno.
  const [alEntrar] = useState({
    nombre: delTurno?.nombre ?? "",
    telefono: delTurno?.telefono ?? "",
    servicio: turno?.motivo ?? "",
  });
  const hayAlgoEscrito =
    nombre !== alEntrar.nombre ||
    telefono !== alEntrar.telefono ||
    servicio !== alEntrar.servicio ||
    identificador !== "" ||
    responsable !== "";

  // Cerrar la pestaña o recargar con algo escrito también pregunta. El texto
  // de esa pregunta lo pone el navegador; no se puede cambiar.
  useEffect(() => {
    if (!hayAlgoEscrito) return;
    const avisar = (e) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayAlgoEscrito]);

  if (cargando) return <Cargando />;

  const motivos = preset(negocio?.rubro).motivos;
  const comoIdent = comoSeIdentifica(negocio?.rubro);
  const yaEsCliente = clienteDelAlta({ nombre, telefono, clientes, elegido });
  const telefonoTraido = elegido && telefono === elegido.telefono;
  const hayHomonimos = clientesConEseNombre(nombre, clientes).length > 1;
  const sugeridos = sugerirClientes(nombre, clientes);
  const mostrarLista = listaAbierta && sugeridos.length > 0;

  function elegirCliente(cliente) {
    const r = alElegirCliente(cliente, telefono);
    setNombre(r.nombre);
    setTelefono(r.telefono);
    setElegido(r.elegido);
    setListaAbierta(false);
    setMarcada(-1);
  }

  // Las teclas de la lista, como las de cualquier lista de sugerencias:
  // flechas para moverse, Enter para elegir, Escape para cerrarla.
  function alTeclado(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!sugeridos.length) return;
      e.preventDefault();
      setListaAbierta(true);
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setMarcada((m) => (m + paso + sugeridos.length) % sugeridos.length);
    } else if (e.key === "Enter" && mostrarLista && marcada >= 0) {
      e.preventDefault();
      elegirCliente(sugeridos[marcada]);
    } else if (e.key === "Escape" && mostrarLista) {
      setListaAbierta(false);
      setMarcada(-1);
    }
  }

  const errorTelefono =
    tocado.telefono && telefono.trim() && !telefonoValido(telefono)
      ? "El teléfono no es válido. Escribilo con característica y sin el 0 ni el 15:"
      : null;

  // El botón apagado dice por qué está apagado, no sólo que lo está. Si
  // falta más de un dato dice cuántos, y los campos vacíos se marcan con un
  // punto: así se ven todos de una vez (auditoría, H9).
  const faltan = faltantesDelAlta({ nombre, telefono, identificador, servicio }, comoIdent.enFrase);
  const motivoApagado = motivoDeFaltantes(faltan);
  const marcar = (campo) => faltan.length > 1 && faltan.some((f) => f.campo === campo);

  async function guardar() {
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const caso = await abrirCaso({
        clienteId: yaEsCliente?.id ?? null,
        nombreCliente: nombre.trim(),
        telefono: telefono.trim(),
        servicio: servicio.trim(),
        identificador: identificador.trim(),
        responsableId: responsable || null,
        turnoId: turno?.id ?? null,
      });
      if (!caso) return;
      avisarExito(`Listo. El caso de ${nombre.trim()} ya está en la lista de hoy.`);
      router.push(`/casos/${caso.id}`);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  return (
    <>
      {/* Salir con algo escrito pregunta antes. El enlace está arriba de
          todo, donde el pulgar llega primero, y tocarlo sin querer con el
          cliente enfrente obligaba a empezar de nuevo (auditoría, H5). */}
      <Link
        href="/casos"
        onClick={(e) => {
          if (!hayAlgoEscrito) return;
          e.preventDefault();
          setSaliendo(true);
        }}
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        Volver a los casos
      </Link>

      {saliendo && (
        <div role="alertdialog" aria-labelledby="salir-titulo" className="mb-6 rounded-tarjeta bg-superficie p-4">
          <p id="salir-titulo" className="font-bold text-cuerpo">
            ¿Dejar el caso sin guardar?
          </p>
          <p className="mt-1 text-tinta-media">Se pierde lo que escribiste.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Boton variante="peligro" onClick={() => router.push("/casos")}>
              Salir sin guardar
            </Boton>
            <Boton variante="plano" onClick={() => setSaliendo(false)}>
              Seguir cargando
            </Boton>
          </div>
        </div>
      )}

      <h1 className="text-pantalla">Abrir un caso nuevo</h1>
      <p className="mt-1 max-w-[65ch] text-tinta-media">
        Con esto alcanza para empezar. El diagnóstico y el presupuesto se cargan después.
      </p>
      {turno && (
        <p className="mt-3 max-w-[65ch] rounded-tarjeta border border-borde bg-superficie p-4 text-tinta-media">
          Sale del turno de {horaYMinutos(turno.empieza_en)}. Lo que ya estaba
          anotado viene cargado; revisalo por si cambió algo. Al guardar, el
          turno queda marcado como que la persona vino.
        </p>
      )}
      <div className="mb-8" />

      <div className="max-w-[560px]">
        {/* Dos clientes pueden llamarse igual: el teléfono es lo que dice
            cuál es cuál. Va arriba del nombre, antes de seguir escribiendo. */}
        {hayHomonimos && (
          <p
            role="status"
            className="mb-3 flex items-start gap-2 rounded-campo border-l-4 border-l-espera bg-espera-fondo p-3 font-bold text-espera"
          >
            <Icono nombre="alerta" className="mt-0.5 size-5" />
            <span>
              Atención: existen varios clientes con este nombre. Revisá el teléfono para ver si
              es el correspondiente.
            </span>
          </p>
        )}

        {/* La lista de sugerencias es nuestra y no la del navegador (un
            <datalist>): ésa devuelve sólo el texto elegido, y con dos
            clientes del mismo nombre no hay forma de saber cuál se tocó.
            Ésta muestra nombre y teléfono, y elige al cliente, no al texto. */}
        <Campo
          id="cliente"
          etiqueta="Nombre del cliente"
          falta={marcar("cliente")}
          ayuda="Como lo vas a buscar después. Si ya vino antes, elegilo de la lista y se trae su teléfono."
          exito={yaEsCliente ? `Ya es cliente. Le vamos a sumar este caso a ${yaEsCliente.nombre}.` : null}
        >
          <input
            id="cliente"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={mostrarLista}
            aria-controls="clientes-sugeridos"
            aria-activedescendant={
              mostrarLista && marcada >= 0 ? `cliente-sugerido-${sugeridos[marcada].id}` : undefined
            }
            aria-describedby="cliente-ayuda"
            autoComplete="off"
            value={nombre}
            onChange={(e) => {
              const nuevo = e.target.value;
              setNombre(nuevo);
              const r = alCambiarElNombre({ nombre: nuevo, telefono, elegido });
              setTelefono(r.telefono);
              setElegido(r.elegido);
              setListaAbierta(true);
              setMarcada(-1);
            }}
            onFocus={() => setListaAbierta(true)}
            onBlur={() => setListaAbierta(false)}
            onKeyDown={alTeclado}
            className={[
              "mt-2 block w-full rounded-campo border-2 bg-tarjeta px-4 min-h-12 text-cuerpo",
              yaEsCliente ? "border-completo" : "border-borde-fuerte",
            ].join(" ")}
          />
          {mostrarLista && (
            <ul
              id="clientes-sugeridos"
              role="listbox"
              aria-label="Clientes que ya vinieron"
              className="mt-1 overflow-hidden rounded-campo border-2 border-borde-fuerte bg-tarjeta"
            >
              {sugeridos.map((c, i) => (
                <li
                  key={c.id}
                  id={`cliente-sugerido-${c.id}`}
                  role="option"
                  aria-selected={i === marcada}
                  // onMouseDown y no onClick: el clic le saca el foco al
                  // campo, y al perderlo la lista se cierra antes de elegir.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegirCliente(c);
                  }}
                  className={[
                    "flex min-h-12 cursor-pointer flex-wrap items-center gap-x-2 px-4",
                    i === marcada ? "bg-azul-claro text-azul" : "hover:bg-superficie",
                  ].join(" ")}
                >
                  <span className="font-bold">{c.nombre}</span>
                  <span className="text-tinta-media">· {c.telefono || "sin teléfono"}</span>
                </li>
              ))}
            </ul>
          )}
        </Campo>

        <Campo
          id="telefono"
          etiqueta="Teléfono del cliente"
          falta={marcar("telefono")}
          ayuda="Con característica, sin el 0 ni el 15."
          error={errorTelefono}
          ejemplo="341 456 7890"
          exito={
            telefonoTraido && yaEsCliente
              ? `Es el teléfono que tenemos de ${yaEsCliente.nombre}. Si cambió, corregilo acá.`
              : telefono.trim() && telefonoValido(telefono)
                ? "Listo. Le vamos a poder avisar por WhatsApp."
                : null
          }
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          onBlur={() => setTocado((t) => ({ ...t, telefono: true }))}
          inputMode="tel"
          autoComplete="tel"
        />

        {/* El identificador va acá y no "después": es lo más certero que
            tenemos para reconocer el caso, y se lo tiene enfrente. La
            sección 08 de la cartilla pide cuatro campos en el alta; este es
            un quinto, decidido a propósito. */}
        <Campo
          id="identificador"
          etiqueta={comoIdent.nombre}
          falta={marcar("identificador")}
          ayuda={`Con esto lo vas a encontrar después, sin depender de cómo se escriba el nombre. Ejemplo: ${comoIdent.ejemplo}.`}
          autoComplete="off"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
        />

        <Campo
          id="servicio"
          etiqueta="Qué necesita"
          falta={marcar("servicio")}
          ayuda="Con las palabras del cliente. Podés elegir uno de los de siempre."
          value={servicio}
          onChange={(e) => setServicio(e.target.value)}
          placeholder={ejemplosDe(negocio?.rubro).servicio}
        />
        <div className="-mt-3 mb-6">
          <ul className="flex flex-wrap gap-2">
            {motivos.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  onClick={() => setServicio(m)}
                  className={[
                    "min-h-12 cursor-pointer rounded-full border-2 px-4 text-etiqueta",
                    servicio === m
                      ? "border-azul bg-azul-claro font-bold text-azul"
                      : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
                  ].join(" ")}
                >
                  {m}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <Campo
          id="responsable"
          etiqueta="Quién lo va a atender"
          ayuda="Si todavía no sabés, dejalo sin asignar y lo elegís después."
        >
          <select
            id="responsable"
            aria-describedby="responsable-ayuda"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            className="mt-2 block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 text-cuerpo"
          >
            <option value="">Todavía no sé</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </Campo>

      </div>

      {/* Afuera del bloque del formulario a propósito. Un sticky no puede
          subir por encima de su contenedor: adentro del formulario, con la
          letra agrandada y la pantalla sin scrollear, el formulario empezaba
          tan abajo que el botón no llegaba a despegarse de la barra de
          secciones y quedaba tapado. Acá su contenedor es la página entera. */}
      <BotonPrincipalFijo icono="check" motivo={guardando ? "guardando" : motivoApagado} onClick={guardar}>
        Guardar el caso
      </BotonPrincipalFijo>
    </>
  );
}
