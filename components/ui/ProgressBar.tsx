// Barra de progreso de la zona de usuario (p. ej. avance de la meta de una campaña).

interface ProgressBarProps {
  pct: number;
  tone?: "accent" | "ok";
  /** Muestra el porcentaje junto a la barra (2026-11-04). */
  conPorcentaje?: boolean;
}

export default function ProgressBar({ pct, tone = "accent", conPorcentaje = false }: ProgressBarProps) {
  const fill = tone === "ok" ? "bg-success-700" : "bg-brand-600";
  const clamped = Math.min(Math.max(pct, 0), 100);

  const barra = (
    <div className="h-[7px] w-full overflow-hidden rounded-pill bg-system-100">
      <div
        className={`h-full rounded-pill ${fill}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
  if (!conPorcentaje) return barra;
  return (
    <div className="flex items-center gap-2">
      {barra}
      <span className="shrink-0 font-mono text-[11px] font-semibold text-system-600">{Math.round(clamped)}%</span>
    </div>
  );
}
