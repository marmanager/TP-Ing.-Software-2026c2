"use client";

// "Tus negocios", en Mi perfil (docs/multinegocio.md): los negocios de la
// cuenta con su rol, en cuál está ahora, cuál es el predeterminado y si al
// iniciar sesión entra directo a él.
//
// Sin la 038 corrida no hay lista: se muestra el negocio activo, como antes,
// sin interruptores ni "Nuevo negocio" (la base no dejaría crear otro).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { nombreDelRol } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { useDatos } from "@/lib/datos";
import FilaNegocio, { FilaNuevoNegocio } from "@/componentes/FilaNegocio";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Interruptor, Tarjeta } from "@/componentes/ui";

// La lista la pide Mi perfil (la comparte con el botón de vista maestra).
export default function TusNegocios({ negocios, sinLista }) {
  const router = useRouter();
  const { usuario, entrarAlNegocio, guardarPreferenciasDeEntrada } = useAuth();
  const { t } = useIdioma();
  const { negocio, avisarExito } = useDatos();

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  const predeterminado = usuario?.negocio_predeterminado ?? null;
  const inicioRapido = Boolean(usuario?.inicio_rapido);

  async function entrar(n) {
    setError(null);
    setOcupado(true);
    const r = await entrarAlNegocio(n.id);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    avisarExito(t("cuenta.negocios.estasEn", { nombre: n.nombre }));
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
          <FilaNegocio negocio={negocio} rol={nombreDelRol(usuario?.rol_nombre, t)} />
          <span className="font-bold text-azul">{t("cuenta.negocios.irAMiNegocio")}</span>
        </Tarjeta>
      </Link>
    );
  }

  if (!negocios) return <Cargando filas={2} />;

  return (
    <div className="mb-12">
      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

      <ul className="grid gap-3">
        {negocios.map((n) => (
          <li key={n.id}>
            <Tarjeta className="flex flex-wrap items-center gap-3">
              <FilaNegocio negocio={n} rol={nombreDelRol(n.rol_nombre, t)} />
              {n.id === usuario?.negocio_id ? (
                <span className="flex min-h-12 items-center gap-2 font-bold text-completo">
                  <Icono nombre="listo" className="size-6" />
                  {t("cuenta.negocios.estasAca")}
                </span>
              ) : (
                <Boton disabled={ocupado} onClick={() => entrar(n)}>
                  {t("cuenta.negocios.entrar")}
                </Boton>
              )}
              <div className="basis-full">
                <Interruptor
                  prendido={predeterminado === n.id}
                  palabras={[t("cuenta.negocios.no"), t("cuenta.negocios.si")]}
                  disabled={ocupado}
                  onChange={(v) => guardar(v ? n.id : null, inicioRapido)}
                >
                  {t("cuenta.negocios.predeterminado")}
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
          ayuda={t("cuenta.negocios.inicioRapidoAyuda")}
          motivo={predeterminado ? null : t("cuenta.negocios.primeroElegi")}
          disabled={ocupado}
          onChange={(v) => guardar(predeterminado, v)}
        >
          {t("cuenta.negocios.inicioRapido")}
        </Interruptor>
      </Tarjeta>
    </div>
  );
}
