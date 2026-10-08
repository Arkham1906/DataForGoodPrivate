// Tarjeta de aporte con su estado (Tag) y, si fue rechazado, el motivo que escribió quien revisó.
// Recibe un Contribution de types/index.ts.

import Tag from "@/components/ui/Tag";
import Card from "@/components/ui/Card";
import type { Contribution } from "@/types";
import { formatearTamano } from "@/lib/aportes/archivo";

const STATUS_TONE: Record<Contribution["status"], { label: string; tone: "ok" | "warn" | "danger" | "default" }> = {
  aceptado: { label: "Aceptado", tone: "ok" },
  pendiente: { label: "Pendiente", tone: "warn" },
  // "espera_final" es un estado interno (ya lo validó el revisor): para quien aportó sigue en revisión.
  espera_final: { label: "En revisión", tone: "warn" },
  rechazado: { label: "Rechazado", tone: "danger" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default function ContributionCard({ contribution }: { contribution: Contribution }) {
  const status = STATUS_TONE[contribution.status];

  return (
    <Card className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-system-900">{contribution.campaignName}</p>
        <p className="mt-1 text-[13px] text-system-600">{contribution.description}</p>
        <div className="mt-2 flex gap-4 text-[11.5px] text-system-400">
          <span>{formatDateTime(contribution.submittedAt)}</span>
          <span>{contribution.fileType}</span>
          <span>{formatearTamano(contribution.fileSizeBytes)}</span>
        </div>
        {contribution.status === "rechazado" && contribution.rejectionReason && (
          <p className="mt-2 rounded border border-error-700 bg-error-50 px-3 py-2 text-[12px] text-system-900">
            <span className="font-semibold">Motivo del rechazo:</span> {contribution.rejectionReason}
          </p>
        )}
      </div>
      <Tag tone={status.tone}>{status.label}</Tag>
    </Card>
  );
}
