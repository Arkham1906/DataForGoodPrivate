// EXP que dejó un aporte, para quien lo envió (2026-11-12; SRS v1.3: RF-GAM-15, 87, 88; fase 3 de las
// modificaciones previas a la v1.4). Va en Mis aportes, en la lista por campaña y en el detalle del aporte.
// Solo para aportes aceptados: pendientes y rechazados no dibujan nada (su estado ya lo dice la etiqueta).
// - expOtorgada > 0: «+N EXP».
// - expOtorgada = 0: «Sin EXP» (aceptado antes del lanzamiento o en una campaña que no otorga EXP; RF-GAM-67).
// - expOtorgada null: «EXP en camino» (recién aceptado; recompensas.ts lo procesa enseguida o en el barrido).
// La API solo manda expOtorgada a quien aportó (RF-GAM-77): con undefined tampoco dibuja nada.
// Sirve en componentes de servidor y cliente.

const nf = new Intl.NumberFormat("es-MX");

export default function ExpDelAporte({
  estado,
  expOtorgada,
  className = "",
}: {
  estado: string;
  expOtorgada: number | null | undefined;
  className?: string;
}) {
  if (estado !== "aceptado" || expOtorgada === undefined) return null;

  if (expOtorgada === null) {
    return (
      <span className={`inline-flex items-center text-[11px] font-medium text-system-500 ${className}`}>
        EXP en camino
      </span>
    );
  }
  if (expOtorgada <= 0) {
    return (
      <span
        className={`inline-flex items-center text-[11px] font-medium text-system-500 ${className}`}
        title="Este aporte no otorgó EXP"
      >
        Sin EXP
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full bg-success-50 px-1.5 py-0.5 font-mono text-[11px] leading-none font-bold text-success-700 tabular-nums ${className}`}
    >
      <span aria-hidden="true">+{nf.format(expOtorgada)} EXP</span>
      <span className="sr-only">Ganaste {nf.format(expOtorgada)} de EXP con este aporte</span>
    </span>
  );
}
