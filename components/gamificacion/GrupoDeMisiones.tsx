// Tarjeta de misiones de un periodo en /progreso/misiones (2026-11-04; diseño v10, RF-GAM-40, 41, 75): cuándo empieza y
// termina el periodo, cada misión con su avance y su recompensa. El estado se dice con texto, no solo con color.
// Sin estado: Server Component.

import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import type { GrupoDeMisiones as DatosDelGrupo, MisionVigente } from "@/lib/gamificacion/misiones";
import type { MedidaDeMision } from "@/lib/gamificacion/misiones-reglas";
import IconoDeMision from "./IconoDeMision";

/** Hasta cuántos pasos se dibujan como tramos; con más, una barra continua (igual que MisionesDeHoy). */
const MAXIMO_DE_TRAMOS = 5;

// Iconos de prueba de la tabla 4.5 (Lucide, como en el diseño).
const DOCUMENTO = "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2zM14 2v6h6M16 13H8M16 17H8";
const CALENDARIO = "M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 9h18";
const BRUJULA = "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM16.2 7.8l-2 6.4-6.4 2 2-6.4z";
const ICONOS: Record<MedidaDeMision, string> = {
  aportes: DOCUMENTO,
  dias_distintos: CALENDARIO,
  dias_seguidos: CALENDARIO,
  tipos_distintos: "M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3",
  campanas_distintas: BRUJULA,
  campanas_nuevas: BRUJULA,
  tematicas_distintas: BRUJULA,
  tematicas_nuevas: BRUJULA,
  inscripciones: DOCUMENTO,
  cuotas_completadas: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  campanas_guardadas: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z",
};

function Mision({ mision }: { mision: MisionVigente }) {
  const { completada, objetivo, progreso } = mision;
  return (
    <li className="grid grid-cols-[44px_1fr] items-start gap-3.5 border-t border-system-100 py-4 first:border-t-0">
      <IconoDeMision clave={mision.clave} completada= {completada} respaldo={ICONOS[mision.mide]} />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="flex flex-wrap items-baseline justify-between gap-x-2.5">
          <strong className="text-sm text-system-900">{mision.nombre}</strong>
          <span className={`whitespace-nowrap text-[13px] font-bold ${completada ? "text-success-800" : "text-system-900"}`}>
            {completada ? "Completada" : `${progreso} de ${objetivo}`}
          </span>
        </p>
        <div aria-hidden="true">
          {objetivo <= MAXIMO_DE_TRAMOS ? (
            <div className="flex gap-1">
              {Array.from({ length: objetivo }, (_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-pill ${i >= progreso ? "bg-system-200" : completada ? "bg-success-700" : "bg-brand-600"}`} />
              ))}
            </div>
          ) : (
            <ProgressBar pct={(progreso / objetivo) * 100} tone={completada ? "ok" : "accent"} />
          )}
        </div>
        {mision.recompensa && (
          <p className="flex flex-wrap items-center gap-2">
            <Tag tone="info">{mision.recompensa}</Tag>
            <span className={`text-[12.5px] font-semibold ${completada ? "text-success-800" : "text-system-600"}`}>
              {completada ? "Recompensa entregada" : "Se entrega sola al completarla"}
            </span>
          </p>
        )}
      </div>
    </li>
  );
}

export default function GrupoDeMisiones({ id, titulo, grupo }: { id: string; titulo: string; grupo: DatosDelGrupo }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-xl font-extrabold text-system-900">
            {titulo}
          </h2>
          {grupo.periodo && <p className="mt-0.5 text-[13px] text-system-700">Periodo: {grupo.periodo}</p>}
        </div>
        {grupo.seRenuevanEn && <Tag tone="info">Se renuevan en {grupo.seRenuevanEn}</Tag>}
      </div>
      {grupo.misiones.length === 0 ? (
        <p className="py-3 text-[13px] text-system-600">Por ahora no hay misiones en este periodo.</p>
      ) : (
        <ul>
          {grupo.misiones.map((m) => (
            <Mision key={m.id} mision={m} />
          ))}
        </ul>
      )}
    </section>
  );
}
