// Misiones diarias de «Hoy» (2026-11-02; SRS v1.1: RF-GAM-40, 41, 75): las instancias vigentes de la persona, con su
// avance y la hora a la que se renuevan (el periodo se cuenta desde su primer inicio de sesión, no por el día del
// servidor). Sin estado: sirve en servidor y cliente.
//
// Sin misiones activas en lib/datos/misiones.json, la lista queda vacía y lo dice.

import ProgressBar from "@/components/ui/ProgressBar";
import type { MisionDeHoy, ResumenDeMisiones } from "@/lib/gamificacion/progreso-tipos";

/** Hasta cuántos pasos se dibujan como tramos; con más, una barra continua. */
const MAXIMO_DE_TRAMOS = 5;

function textoDeEstado(m: MisionDeHoy): string {
  if (m.completada) return m.recompensa ? `Entregada: ${m.recompensa}` : "Completada";
  return m.recompensa ? `${m.progreso} de ${m.objetivo}, ${m.recompensa}` : `${m.progreso} de ${m.objetivo}`;
}

export default function MisionesDeHoy({ misiones }: { misiones: ResumenDeMisiones }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h2 className="text-lg font-extrabold text-system-900">Misiones de hoy</h2>
        {misiones.seRenuevanA && (
          <span className="text-[12.5px] text-brand-800">Se renuevan a las {misiones.seRenuevanA}</span>
        )}
      </div>
      {misiones.diarias.length === 0 ? (
        <p className="text-sm text-brand-800">Por ahora no tienes misiones diarias.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {misiones.diarias.map((m) => {
            const hechos = Math.min(m.progreso, m.objetivo);
            return (
              <li key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-system-900">{m.nombre}</span>
                <span className={`text-[12.5px] font-bold ${m.completada ? "text-success-800" : "text-brand-800"}`}>
                  {textoDeEstado(m)}
                </span>
                <div className="col-span-2" aria-hidden="true">
                  {m.objetivo <= MAXIMO_DE_TRAMOS ? (
                    <div className="flex gap-1">
                      {Array.from({ length: m.objetivo }, (_, i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-pill ${i < hechos ? "bg-brand-700" : "bg-white"}`} />
                      ))}
                    </div>
                  ) : (
                    <ProgressBar pct={(hechos / m.objetivo) * 100} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
