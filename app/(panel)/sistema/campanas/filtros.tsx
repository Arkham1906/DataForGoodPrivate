"use client";

// Filtros del listado /sistema/campanas: los escribe en la URL (searchParams).
// La barra (components/campanas/BarraDeFiltros.tsx) es la misma de /supervision y /supervisar.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import BarraDeFiltros from "@/components/campanas/BarraDeFiltros";

/**
 * Los filtros viven en la URL (igual que /usuarios): la vista filtrada se
 * puede compartir, el botón atrás funciona y el filtrado lo hace el servidor.
 */
export default function FiltrosDeCampanas({
  q,
  tematica,
  etiqueta,
  tipo,
  vigencia,
  orden,
  tematicas,
  etiquetasPorTematica,
}: {
  q: string;
  tematica: string;
  etiqueta: string;
  tipo: string;
  vigencia: string;
  orden: string;
  tematicas: string[];
  etiquetasPorTematica: Record<string, string[]>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, iniciar] = useTransition();

  function aplicar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    // Otra temática: la etiqueta (subtemática) ya no aplica.
    if (clave === "tematica") params.delete("etiqueta");
    // Cualquier cambio de filtro vuelve a la primera página.
    params.delete("pagina");
    const qs = params.toString();
    iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <BarraDeFiltros
      valores={{ q, tematica, etiqueta, tipo, vigencia, orden }}
      tematicas={tematicas}
      etiquetasPorTematica={etiquetasPorTematica}
      onCambiar={aplicar}
      conVigencia
      colapsableEnMovil
    />
  );
}
