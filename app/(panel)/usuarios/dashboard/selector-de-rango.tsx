"use client";

// Selector del rango de fechas de /usuarios/dashboard y /aportes/dashboard; lo escribe en la URL.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";

const OPCIONES = [
  { valor: "30d", etiqueta: "Últimos 30 días" },
  { valor: "90d", etiqueta: "Últimos 90 días" },
  { valor: "12m", etiqueta: "Últimos 12 meses" },
];

/**
 * El rango vive en la URL, no en estado local: así la vista filtrada se puede
 * compartir o recargar, y el servidor recalcula los agregados.
 */
export default function SelectorDeRango({ valor }: { valor: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const id = useId();

  function cambiar(nuevo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nuevo === "30d") params.delete("rango");
    else params.set("rango", nuevo);

    const qs = params.toString();
    iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Rango de fechas
      </label>
      <select
        id={id}
        value={valor}
        disabled={pendiente}
        onChange={(e) => cambiar(e.target.value)}
        className="min-h-[38px] rounded border border-system-300 bg-white px-3 py-2 text-sm text-system-900 outline-none transition-colors focus:border-brand-600"
      >
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </>
  );
}
