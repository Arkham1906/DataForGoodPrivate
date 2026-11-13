"use client";
import { useState } from "react";
import type { DatosDeTrayectoria } from "@/lib/gamificacion/mi-progreso-tipos";
import type { FichaDeRangoAvistado, FichaDeRangoSiguiente } from "@/lib/gamificacion/rangos";
import FichaDeRango from "./FichaDeRango";
import SenderoDeRangos, { EncabezadoDeTrayectoria } from "./SenderoDeRangos";
import TablaDeRequisitosDeRangos from "./TablaDeRequisitosRango";
import { TarjetaDelSiguienteRango, TrayectoriaCompleta } from "./TarjetasDeLaTrayectoria";

export default function TrayectoriaDeRangos({
  actual,
  total,
  nombre,
  datos,
}: {
  actual: number;
  total: number;
  /** Nombre del rango actual. */
  nombre: string;
  datos: DatosDeTrayectoria;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const siguiente = datos.fichas.find((f): f is FichaDeRangoSiguiente => f.estado === "siguiente");
  const avistado = datos.fichas.find((f): f is FichaDeRangoAvistado => f.estado === "avistado");

  return (
    <div className="space-y-5">
      <EncabezadoDeTrayectoria actual={actual} total={total} nombre={nombre} />

      {/* En la tarjeta del siguiente, las clases flex no aplican dentro de la rejilla: ocupa su columna. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
        {/* key: tras un ascenso (router.refresh) el sendero se vuelve a montar y su trazo se dibuja de nuevo. */}
        <SenderoDeRangos
          key={actual}
          actual={actual}
          total={total}
          nombre={nombre}
          eslabones={datos.eslabones}
          recorrido={datos.recorrido}
          pista={avistado?.pista ?? null}
          onAbrir={setAbierta}
        />
        {siguiente ? <TarjetaDelSiguienteRango ficha={siguiente} total={total} onAbrir={setAbierta} /> : <TrayectoriaCompleta total={total} />}
      </div>

      <TablaDeRequisitosDeRangos tabla={datos.tabla} actual={actual} total={total} />

      <FichaDeRango fichas={datos.fichas} abierta={abierta} total={total} onIr={setAbierta} onCerrar={() => setAbierta(null)} />
    </div>
  );
}
