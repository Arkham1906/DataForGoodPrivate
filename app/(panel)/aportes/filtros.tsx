"use client";

// Filtros de la bandeja /aportes: búsqueda y campaña. Los escribe en la URL (searchParams).

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

const CLASE_SELECT =
  "min-h-[38px] max-w-full rounded border border-system-300 bg-white px-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600";

/** Igual que el directorio de usuarios: la vista filtrada se comparte y el filtrado lo hace el servidor. */
export default function FiltrosDeAportes({
  q,
  campana,
  campanas,
}: {
  q: string;
  campana: string;
  campanas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, iniciar] = useTransition();
  const idBusqueda = useId();
  const idCampana = useId();

  const [texto, setTexto] = useState(q);

  // La búsqueda se aplica sola tras una pausa al teclear, sin botón aparte.
  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => aplicar("q", texto), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  function aplicar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    // Cualquier cambio de filtro vuelve a la primera página.
    params.delete("pagina");

    const qs = params.toString();
    iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5">
      <div className="min-w-[220px] flex-1">
        <label className="sr-only" htmlFor={idBusqueda}>
          Buscar aportes
        </label>
        <input
          id={idBusqueda}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por participante o campaña"
          className="w-full rounded border border-system-300 bg-white px-3.5 py-2 text-sm text-system-900 outline-none transition-colors focus:border-brand-600"
        />
      </div>

      <div className="max-w-full">
        <label className="sr-only" htmlFor={idCampana}>
          Filtrar por campaña
        </label>
        <select
          id={idCampana}
          value={campana}
          onChange={(e) => aplicar("campana", e.target.value)}
          className={CLASE_SELECT}
        >
          <option value="">Campaña: todas</option>
          {campanas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
