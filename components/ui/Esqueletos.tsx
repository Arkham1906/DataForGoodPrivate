// Esqueletos de pantalla completa (2026-10-07, experimental): las formas típicas de las pantallas
// mientras llegan los datos del servidor, armadas con ui/Skeleton. Los usan:
//   - los loading.tsx de las páginas de servidor (Next los muestra mientras la página se arma), y
//   - las páginas cliente de (dashboard) en lugar de su "Cargando…".
// Cada variante lleva role="status" y un texto para lector de pantalla. Son aproximadas: imitan la
// estructura (encabezado, filtros, tarjetas, filas, métricas), no cada pantalla al píxel.

import type { ReactNode } from "react";
import Skeleton from "@/components/ui/Skeleton";

export type TipoDeEsqueleto = "tarjetas" | "tabla" | "detalle" | "tablero" | "formulario";

function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-system-200 bg-white p-4 shadow-sm max-md:p-3.5 ${className}`}>{children}</div>;
}

/** Título, subtítulo y (opcional) el botón de la derecha. */
export function EsqueletoDeEncabezado({ conBoton = false }: { conBoton?: boolean }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-7 w-56 max-w-full max-md:h-6" />
        <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
      </div>
      {conBoton && <Skeleton className="h-9 w-32 shrink-0 rounded-pill max-md:w-24" />}
    </div>
  );
}

/** Fila de botones de filtro (pastillas). */
export function EsqueletoDeFiltros({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div className="mb-6 flex gap-2 overflow-hidden max-md:mb-4">
      {Array.from({ length: cantidad }, (_, i) => (
        <Skeleton key={i} className={`h-[33px] shrink-0 rounded-pill max-md:h-[27px] ${i === 0 ? "w-20" : "w-28"}`} />
      ))}
    </div>
  );
}

/** Tarjetas genéricas (nombre, dos líneas, barra y botón) en rejilla. */
export function EsqueletoDeTarjetas({ cantidad = 6, columnas = 3 }: { cantidad?: number; columnas?: 2 | 3 }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${columnas === 3 ? "lg:grid-cols-3" : ""}`}>
      {Array.from({ length: cantidad }, (_, i) => (
        <Tarjeta key={i} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-[26px] w-28 rounded-pill" />
            <Skeleton className="h-[26px] w-16 rounded-pill" />
          </div>
          <div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-2 h-3.5 w-full" />
            <Skeleton className="mt-1.5 h-3.5 w-5/6" />
          </div>
          <Skeleton className="h-[7px] w-full rounded-pill" />
          <Skeleton className="h-9 w-full rounded-pill" />
        </Tarjeta>
      ))}
    </div>
  );
}

/** Lista o tabla: renglones con nombre, detalle y una etiqueta, dentro de una tarjeta. */
export function EsqueletoDeFilas({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-5 py-4 max-md:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-pill" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-1/2 max-w-64" />
              <Skeleton className="mt-1.5 h-3 w-3/4 max-w-96" />
            </div>
          </div>
          <Skeleton className="h-[26px] w-20 shrink-0 rounded-pill" />
        </div>
      ))}
    </div>
  );
}

/** Tarjetas de cifras (métricas) en rejilla. */
export function EsqueletoDeMetricas({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: cantidad }, (_, i) => (
        <Tarjeta key={i}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-20" />
        </Tarjeta>
      ))}
    </div>
  );
}

/** Bloque de texto: título de sección y renglones. */
function EsqueletoDeTexto({ renglones = 4 }: { renglones?: number }) {
  return (
    <Tarjeta>
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: renglones }, (_, i) => (
        <Skeleton key={i} className={`mt-3 h-3.5 ${i === renglones - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </Tarjeta>
  );
}

/** Campos de formulario: etiqueta y caja. */
function EsqueletoDeCampos({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <Tarjeta className="space-y-5">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i}>
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className={`mt-2 w-full ${i === cantidad - 1 ? "h-24" : "h-11"}`} />
        </div>
      ))}
      <div className="flex justify-end gap-2.5">
        <Skeleton className="h-10 w-28 rounded-pill" />
        <Skeleton className="h-10 w-36 rounded-pill" />
      </div>
    </Tarjeta>
  );
}

/**
 * Pantalla completa mientras carga, según su forma:
 *   - tarjetas: encabezado, filtros y rejilla de tarjetas (listas de campañas).
 *   - tabla: encabezado, filtros y renglones (directorios, bandejas, notificaciones).
 *   - detalle: regreso, título con etiquetas, texto y columna lateral (una campaña, un aporte).
 *   - tablero: encabezado, cifras y dos gráficas (dashboards y paneles).
 *   - formulario: encabezado y campos (perfil, aportar, invitar).
 * `etiqueta` es lo que oye el lector de pantalla. `className` ajusta el ancho del contenedor
 * cuando la pantalla real lo limita (p. ej. "mx-auto max-w-4xl").
 */
export default function PantallaEsqueleto({
  tipo,
  etiqueta = "Cargando…",
  className = "",
}: {
  tipo: TipoDeEsqueleto;
  etiqueta?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{etiqueta}</span>
      {tipo === "tarjetas" && (
        <>
          <EsqueletoDeEncabezado conBoton />
          <EsqueletoDeFiltros />
          <EsqueletoDeTarjetas />
        </>
      )}
      {tipo === "tabla" && (
        <>
          <EsqueletoDeEncabezado />
          <EsqueletoDeFiltros />
          <EsqueletoDeFilas />
        </>
      )}
      {tipo === "detalle" && (
        <>
          <Skeleton className="mb-4 h-3.5 w-24" />
          <div className="mb-5 flex gap-2">
            <Skeleton className="h-[26px] w-28 rounded-pill" />
            <Skeleton className="h-[26px] w-20 rounded-pill" />
          </div>
          <Skeleton className="h-7 w-2/3 max-w-md" />
          <Skeleton className="mb-6 mt-2 h-3.5 w-1/2 max-w-sm" />
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <EsqueletoDeTexto renglones={5} />
              <EsqueletoDeTexto renglones={3} />
            </div>
            <Tarjeta className="space-y-3 self-start">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-[7px] w-full rounded-pill" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="mt-2 h-10 w-full rounded-pill" />
            </Tarjeta>
          </div>
        </>
      )}
      {tipo === "tablero" && (
        <>
          <EsqueletoDeEncabezado />
          <EsqueletoDeMetricas />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <Tarjeta key={i}>
                <Skeleton className="h-4 w-40" />
                <div className="mt-4 flex h-40 items-end gap-2">
                  {[45, 70, 35, 85, 55, 65, 40].map((alto, j) => (
                    <Skeleton key={j} className="flex-1 rounded-t" style={{ height: `${alto}%` }} />
                  ))}
                </div>
              </Tarjeta>
            ))}
          </div>
        </>
      )}
      {tipo === "formulario" && (
        <>
          <EsqueletoDeEncabezado />
          <EsqueletoDeCampos />
        </>
      )}
    </div>
  );
}
