// Barra de progreso de la zona de usuario (p. ej. avance de la meta de una campaña).

interface ProgressBarProps {
  pct: number;
  tone?: "accent" | "ok";
}

export default function ProgressBar({ pct, tone = "accent" }: ProgressBarProps) {
  const fill = tone === "ok" ? "bg-success-700" : "bg-brand-600";
  const clamped = Math.min(Math.max(pct, 0), 100);

  return (
    <div className="h-[7px] w-full overflow-hidden rounded-pill bg-system-100">
      <div
        className={`h-full rounded-pill ${fill}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
