// Bloque de rango del Resumen de /progreso (2026-11-04; diseño v10, RF-GAM-22, 78): el rango actual, el camino de
// rangos cercanos, la EXP y los demás requisitos del siguiente rango. Es la versión amplia de ResumenDeRango, que sigue
// en /inicio. Server Component; la parte con estado es CaminoDeRangos (la ficha de rango).
//
// Azul marino: brand-950, el mismo de la cabecera de FichaDeRango (el #0f1f3d del lienzo no es un token).

import Link from "next/link";
import ButtonLink from "@/components/ui/ButtonLink";
import { rutaDePantalla } from "@/lib/gamificacion/pantallas-de-progreso";
import type { DatosDeResumen } from "@/lib/gamificacion/mi-progreso-tipos";
import type { ResumenDeProgreso } from "@/lib/gamificacion/progreso-tipos";
import { ETIQUETAS_CORTAS, type FichaDeRangoSiguiente } from "@/lib/gamificacion/rangos";
import CaminoDeRangos from "./CaminoDeRangos";

const nf = new Intl.NumberFormat("es-MX");

function Barra({ porcentaje, cumplido, alto }: { porcentaje: number; cumplido: boolean; alto: string }) {
  return (
    <span aria-hidden="true" className={`block overflow-hidden rounded-pill bg-brand-800 ${alto}`}>
      <span
        className={`block h-full rounded-pill ${cumplido ? "bg-success-400" : "bg-brand-300"}`}
        style={{ width: `${porcentaje}%` }}
      />
    </span>
  );
}

export default function BloqueDeRango({ progreso, datos }: { progreso: ResumenDeProgreso; datos: DatosDeResumen }) {
  const { siguiente, totalDeRangos } = progreso;
  const fichaSiguiente = progreso.fichas.find((f): f is FichaDeRangoSiguiente => f.estado === "siguiente");
  const requisitos = fichaSiguiente?.requisitos ?? [];
  const exp = requisitos.find((r) => r.clave === "exp");
  const demas = requisitos.filter((r) => r.clave !== "exp");
  const trayectoria = rutaDePantalla("trayectoria");
  const historial = rutaDePantalla("historial");

  return (
    <section aria-labelledby="progreso-rango" className="flex flex-col gap-5 rounded-lg bg-brand-950 p-6 text-white max-md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-brand-300">
            Tu trayectoria · rango {progreso.rangoActual} de {totalDeRangos}
          </p>
          <h2 id="progreso-rango" className="mt-0.5 text-[26px] font-extrabold leading-tight">
            {progreso.nombreDelRango}
          </h2>
          <p className="mt-1.5 text-sm text-brand-100">
            {siguiente ? (
              <>
                Siguiente: <strong className="text-white">{siguiente.nombre}</strong>, {siguiente.cumplidos} de {siguiente.activos}{" "}
                requisitos.
              </>
            ) : (
              "Llegaste al último rango de la trayectoria. Es permanente."
            )}
          </p>
        </div>
        {trayectoria && (
          <ButtonLink href={trayectoria} variant="secondary" size="sm">
            Ver tu trayectoria
          </ButtonLink>
        )}
      </div>

      <CaminoDeRangos camino={datos.camino} fichas={datos.fichas} total={totalDeRangos} />

      <div className="flex flex-wrap gap-6 border-t border-brand-300/20 pt-4">
        <div className="flex min-w-0 max-w-sm flex-[1_1_260px] flex-col gap-2">
          <p className="flex flex-wrap justify-between gap-x-2.5 text-[13px]">
            <span className="text-brand-200">EXP</span>
            <span className="font-bold">
              {exp && siguiente
                ? `${nf.format(exp.actual)} de ${nf.format(exp.meta)} para el rango ${siguiente.numero}`
                : nf.format(datos.expTotal)}
            </span>
          </p>
          {exp && <Barra porcentaje={exp.porcentaje} cumplido={exp.cumplido} alto="h-2" />}
          {historial && (
            <Link href={historial} className="self-start py-1 text-[13px] font-bold text-brand-200 hover:underline">
              Ver tu historial de EXP
            </Link>
          )}
        </div>
        {demas.length > 0 && (
          <ul
            aria-label="Requisitos del siguiente rango"
            className="grid min-w-0 flex-[2_1_340px] grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-6 gap-y-2.5"
          >
            {demas.map((r) => (
              <li key={r.clave} className="flex flex-col gap-1.5 text-[12.5px]">
                <span className="flex justify-between gap-1.5">
                  <span className="text-brand-200">{ETIQUETAS_CORTAS[r.clave]}</span>
                  <span className={`font-bold ${r.cumplido ? "text-success-300" : "text-white"}`}>
                    {r.cumplido ? "Cumplido" : `${nf.format(r.actual)} de ${nf.format(r.meta)}`}
                  </span>
                </span>
                <Barra porcentaje={r.porcentaje} cumplido={r.cumplido} alto="h-[5px]" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
