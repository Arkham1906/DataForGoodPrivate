"use client";

// Selector del periodo de las gráficas (2026-11-22, a pedido del usuario: búsquedas por históricos). Reemplaza al
// selector de rango de /usuarios/dashboard y /aportes/dashboard y lo usan todas las pantallas con gráfica de
// tiempo (components/ui/GraficaDeTiempo). Primero Hoy, Esta semana, Este mes y Este año (calendario), luego "Todo el
// histórico" y "Fechas específicas", que abre Desde / Hasta (ui/CampoDeFecha, DD/MM/AAAA) con "Aplicar".
// El periodo vive en la URL (?periodo= o ?desde=&hasta=; lib/periodo.ts), no en estado: la vista se puede
// recargar o compartir y el servidor recalcula. El periodo por defecto de la pantalla no se escribe.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import CampoDeFecha from "@/components/ui/CampoDeFecha";
import { hoyEnTepic } from "@/lib/fecha-de-tepic";
import { OPCIONES_DE_PERIODO, type ClaveDePeriodo, type Periodo } from "@/lib/periodo";

const CLASE_SELECT =
  "min-h-[38px] rounded border border-system-300 bg-white px-3 py-2 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 disabled:opacity-60";

function haceDias(dias: number): string {
  const [anio, mes, dia] = hoyEnTepic().split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia - dias)).toISOString().slice(0, 10);
}

export default function SelectorDePeriodo({
  periodo,
  defecto,
  opciones,
}: {
  periodo: Periodo;
  /** El de la pantalla: elegirlo deja la URL sin ?periodo=. */
  defecto: ClaveDePeriodo;
  /** Para dejar fuera algún atajo; por defecto, todos. */
  opciones?: ClaveDePeriodo[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const id = useId();
  const [clave, setClave] = useState<ClaveDePeriodo>(periodo.clave);
  const [desde, setDesde] = useState(periodo.desde ?? haceDias(29));
  const [hasta, setHasta] = useState(periodo.hasta ?? hoyEnTepic());
  const [error, setError] = useState("");

  const lista = OPCIONES_DE_PERIODO.filter((o) => !opciones || opciones.includes(o.clave) || o.clave === "personalizado");

  function ir(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const nombre of ["periodo", "desde", "hasta", "rango"]) params.delete(nombre);
    for (const [nombre, valor] of Object.entries(cambios)) if (valor) params.set(nombre, valor);
    const qs = params.toString();
    iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function elegir(nueva: ClaveDePeriodo) {
    setClave(nueva);
    setError("");
    if (nueva === "personalizado") return;
    ir({ periodo: nueva === defecto ? null : nueva });
  }

  function aplicar() {
    if (!desde || !hasta) {
      setError("Escribe las dos fechas.");
      return;
    }
    if (desde > hasta) {
      setError("La fecha inicial va antes de la final.");
      return;
    }
    setError("");
    ir({ desde, hasta });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="sr-only" htmlFor={id}>
          Periodo
        </label>
        <select
          id={id}
          value={clave}
          disabled={pendiente}
          onChange={(e) => elegir(e.target.value as ClaveDePeriodo)}
          className={CLASE_SELECT}
        >
          {lista.map((o) => (
            <option key={o.clave} value={o.clave}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {clave === "personalizado" && (
        <>
          <div className="w-36">
            <CampoDeFecha value={desde} onChange={setDesde} aria-label="Desde" />
          </div>
          <span className="pb-2.5 text-[12px] text-system-500" aria-hidden="true">
            a
          </span>
          <div className="w-36">
            <CampoDeFecha value={hasta} onChange={setHasta} min={desde || undefined} aria-label="Hasta" />
          </div>
          <Button type="button" size="sm" variant="secondary" disabled={pendiente} onClick={aplicar}>
            {pendiente ? "Buscando…" : "Aplicar"}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="w-full text-[12px] text-error-700">
          {error}
        </p>
      )}
    </div>
  );
}
