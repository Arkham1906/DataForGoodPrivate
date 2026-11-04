// «Cómo calificaron tus aportes» del Resumen de /progreso (2026-11-04; diseño v10, RF-GAM-99): cuántos aportes
// aceptados hay en cada nivel, de 5★ a 1★. Muestra número y nombre del nivel; el nombre es solo de interfaz.
// Sin estado: Server Component.

import Link from "next/link";
import EstrellasDeCalificacion from "@/components/aportes/EstrellasDeCalificacion";
import type { ResumenDeCalificaciones } from "@/lib/gamificacion/mi-progreso-tipos";

const nf = new Intl.NumberFormat("es-MX");

function colorDeBarra(estrellas: number): string {
  if (estrellas === 5) return "bg-warning-500";
  if (estrellas === 4) return "bg-success-700";
  return "bg-brand-300";
}

function textoDeResumen({ calificados, altos, maximos }: ResumenDeCalificaciones): string {
  if (calificados === 0) return "Todavía no tienes aportes calificados. Cada uno recibirá de 1 a 5 estrellas al aceptarse.";
  return `${nf.format(calificados)} ${calificados === 1 ? "aporte aceptado" : "aportes aceptados"}: ${nf.format(altos)} de 4★ o más y ${nf.format(maximos)} de 5★.`;
}

export default function CalificacionesDeAportes({ calificaciones }: { calificaciones: ResumenDeCalificaciones }) {
  const { sinCalificacion } = calificaciones;
  return (
    <section aria-labelledby="progreso-calificaciones" className="flex min-w-0 flex-col gap-3 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-x-2.5 gap-y-1">
        <h2 id="progreso-calificaciones" className="text-lg font-extrabold text-system-900">
          Cómo calificaron tus aportes
        </h2>
        <Link href="/mis-aportes" className="text-[13px] font-semibold text-brand-600 hover:underline">
          Ver en Mis aportes →
        </Link>
      </div>
      <p className="text-[13px] text-system-600">{textoDeResumen(calificaciones)}</p>
      <ul aria-label="Aportes aceptados por calificación" className="flex flex-col gap-2">
        {calificaciones.filas.map((f) => (
          <li key={f.estrellas} className="grid grid-cols-[82px_minmax(0,108px)_1fr_28px] items-center gap-2.5 text-[13px] max-md:grid-cols-[82px_1fr_28px]">
            <EstrellasDeCalificacion valor={f.estrellas} className="text-sm" />
            <span aria-hidden="true" className="font-semibold text-system-900">
              {f.nombre}
            </span>
            <span aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-system-100 max-md:hidden">
              <span className={`block h-full rounded-pill ${colorDeBarra(f.estrellas)}`} style={{ width: `${f.porcentaje}%` }} />
            </span>
            <span className="text-right font-mono font-bold text-system-900">{nf.format(f.cuenta)}</span>
          </li>
        ))}
      </ul>
      {sinCalificacion > 0 && (
        <p className="text-[12.5px] text-system-600">
          Además, {nf.format(sinCalificacion)} {sinCalificacion === 1 ? "aporte aceptado" : "aportes aceptados"} sin calificación.
        </p>
      )}
      <p className="border-t border-system-100 pt-2.5 text-[12.5px] text-system-600">
        Para tus rangos cuentan los de 4★ o más (Sobresalientes o superiores) y los de 5★ (Excepcionales). Un aporte de 5★
        cuenta en los dos. La calificación la asigna quien revisa la campaña al aceptar y no cambia después.
      </p>
    </section>
  );
}
