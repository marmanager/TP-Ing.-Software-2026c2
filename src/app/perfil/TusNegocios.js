"use client";

// "Tus negocios", en Mi perfil (docs/multinegocio.md): los negocios de la
// cuenta con su rol, en cuál está ahora, cuál es el predeterminado y si al
// iniciar sesión entra directo a él.
//
// Sin la 038 corrida no hay lista: se muestra el negocio activo, como antes,
// sin interruptores ni "Nuevo negocio" (la base no dejaría crear otro).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import FilaNegocio, { FilaNuevoNegocio } from "@/componentes/FilaNegocio";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Interruptor, Tarjeta } from "@/componentes/ui";

export default function TusNegocios() {
  const router = useRouter();
  const { usuario, misNegocios, entrarAlNegocio, guardarPreferenciasDeEntrada } = useAuth();
  const { negocio, avisarExito } = useDatos();

  const [negocios, setNegocios] = useState(null);
  const [sinLista, setSinLista] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    misNegocios().then((r) => {
      if (!vivo) return;
      if (r.ok) setNegocios(r.negocios);
      else setSinLista(true);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const predeterminado = usuario?.negocio_predeterminado ?? null;
  const inicioRapido = Boolean(usuario?.inicio_rapido);

  async function entrar(n) {
    setError(null);
    setOcupado(true);
    const r = await entrarAlNegocio(n.id);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    avisarExito(`Listo, estás en ${n.nombre}.`);
    router.push("/");
  }

  // Uno solo a la vez: es una sola columna en la base. Apagar el
  // predeterminado apaga también el Inicio rápido, que sin él no tiene a
  // dónde entrar.
  async function guardar(nuevoPredeterminado, nuevoInicioRapido) {
    setError(null);
    setOcupado(true);
    const r = await guardarPreferenciasDeEntrada({
      predeterminado: nuevoPredeterminado,
      inicioRapido: nuevoPredeterminado ? nuevoInicioRapido : false,
    });
    setOcupado(false);
    if (!r.ok) setError(r.error);
  }

  if (sinLista) {
    if (!negocio) return null;
    return (
      <Link href="/negocio" className="mb-12 block">
        <Tarjeta className="flex items-center gap-3 hover:bg-superficie">
          <FilaNegocio negocio={negocio} rol={usuario?.rol} />
          <span className="font-bold text-azul">Ir a Mi negocio</span>
        </Tarjeta>
      </Link>
    );
  }

  if (!negocios) return <Cargando filas={2} />;

  return (
    <div className="mb-12">
      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      <ul className="grid gap-3">
        {negocios.map((n) => (
          <li key={n.id}>
            <Tarjeta className="flex flex-wrap items-center gap-3">
              <FilaNegocio negocio={n} rol={n.rol} />
              {n.id === usuario?.negocio_id ? (
                <span className="flex min-h-12 items-center gap-2 font-bold text-completo">
                  <Icono nombre="listo" className="size-6" />
                  Estás acá
                </span>
              ) : (
                <Boton disabled={ocupado} onClick={() => entrar(n)}>
                  Entrar
                </Boton>
              )}
              <div className="basis-full">
                <Interruptor
                  prendido={predeterminado === n.id}
                  palabras={["No", "Sí"]}
                  disabled={ocupado}
                  onChange={(v) => guardar(v ? n.id : null, inicioRapido)}
                >
                  Predeterminado
                </Interruptor>
              </div>
            </Tarjeta>
          </li>
        ))}
        <li>
          <FilaNuevoNegocio />
        </li>
      </ul>

      <Tarjeta className="mt-3">
        <Interruptor
          prendido={inicioRapido}
          ayuda="Al iniciar sesión, entrar directo al predeterminado."
          motivo={predeterminado ? null : "primero elegí uno predeterminado"}
          disabled={ocupado}
          onChange={(v) => guardar(predeterminado, v)}
        >
          Inicio rápido
        </Interruptor>
      </Tarjeta>
    </div>
  );
}
