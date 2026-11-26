"use client";

// Filtros del listado /sistema/campanas: los escribe en la URL (searchParams).
// La barra (components/campanas/BarraDeFiltros.tsx) es la misma de /supervision y /supervisar.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import { ESTADOS_DEL_LISTADO, ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";

const OPCIONES_DE_ESTADO = [
  { valor: "", etiqueta: "Estado: todos" },
  ...ESTADOS_DEL_LISTADO.map((valor) => ({ valor, etiqueta: ETIQUETA_DE_CAMPANA[valor].texto })),
];

/**
 * Los filtros viven en la URL (igual que /usuarios): la vista filtrada se
 * puede compartir, el botón atrás funciona y el filtrado lo hace el servidor.
 */
export default function FiltrosDeCampanas({
  estado,
  q,
  tematica,
  etiqueta,
  tipo,
  vigencia,
  orden,
  tematicas,
  etiquetasPorTematica,
}: {
  estado: string;
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
  const consulta = searchParams.toString();
  const consultaActual = useRef(consulta);
  const [, iniciar] = useTransition();

  useEffect(() => { consultaActual.current = consulta; }, [consulta]);

  function aplicar(cambios: Partial<ValoresDeFiltros>) {
    const params = new URLSearchParams(consultaActual.current);
    const estadoAnterior = params.get("estado") ?? "";
    for (const [clave, valor] of Object.entries(cambios)) {
      const parametro = clave === "vista" ? "estado" : clave;
      if (valor) params.set(parametro, valor);
      else params.delete(parametro);
    }
    params.delete("pagina");
    const qs = params.toString();
    if (qs === consultaActual.current) return;
    consultaActual.current = qs;
    const href = qs ? `${pathname}?${qs}` : pathname;
    iniciar(() => {
      if (cambios.vista !== undefined && cambios.vista !== estadoAnterior) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    });
  }

  return (
    <BarraDeFiltros
      ordenRedondeado
      valores={{ q, vista: estado, tematica, etiqueta, tipo, vigencia, orden }}
      vistas={OPCIONES_DE_ESTADO}
      textoSinTematica="Cualquier temática"
      tematicas={tematicas}
      etiquetasPorTematica={etiquetasPorTematica}
      onCambiar={(clave, valor) => aplicar(clave === "tematica" ? { tematica: valor, etiqueta: "" } : { [clave]: valor })}
      onAplicarPanel={aplicar}
      conVigencia
      colapsableEnMovil
    />
  );
}
