// Tarjeta de aporte con su estado (Tag) y, si fue rechazado, el motivo que escribió quien revisó.
// Recibe un Contribution de types/index.ts.

import Tag from "@/components/ui/Tag";
import Card from "@/components/ui/Card";
import type { KeyboardEvent, MouseEvent } from "react";
import type { Contribution } from "@/types";
import { formatearTamano } from "@/lib/aportes/archivo";
import EstrellasDeCalificacion from "@/components/aportes/EstrellasDeCalificacion";
import ArchivoDelAporte from "@/components/ui/ArchivoDelAporte";
import TextoDelAporte from "@/components/ui/TextoDelAporte";
import { BASE_PATH } from "@/lib/base-path";

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

export default function ContributionCard({
  contribution,
  mostrarCampana = true,
  onAbrir,
}: {
  contribution: Contribution;
  mostrarCampana?: boolean;
  onAbrir?: () => void;
}) {
  const status = STATUS_TONE[contribution.status];

  function abrirConTeclado(event: KeyboardEvent<HTMLDivElement>) {
    if (onAbrir && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onAbrir();
    }
  }

  function abrirConClick(event: MouseEvent<HTMLDivElement>) {
    if (onAbrir && !(event.target as HTMLElement).closest("a,button,input,select,textarea,video,audio")) {
      onAbrir();
    }
  }

  return (
    <Card
      className={`grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)] ${onAbrir ? "cursor-pointer transition-colors hover:border-brand-600" : ""}`}
      onClick={abrirConClick}
      onKeyDown={abrirConTeclado}
      role={onAbrir ? "link" : undefined}
      tabIndex={onAbrir ? 0 : undefined}
      aria-label={onAbrir ? `Abrir aporte ${contribution.id}` : undefined}
    >
      <div className="min-w-0 lg:order-2">
        <div className="flex items-start justify-between gap-3">
          {mostrarCampana && <p className="text-[14px] font-bold text-system-900">{contribution.campaignName}</p>}
          <Tag tone={status.tone}>{status.label}</Tag>
        </div>
        <p className="mt-1 text-[13px] text-system-600">{contribution.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-system-500">
          <span>{formatDateTime(contribution.submittedAt)}</span>
          <span>{contribution.fileType}</span>
          <span>{formatearTamano(contribution.fileSizeBytes)}</span>
        </div>
        {contribution.calificacion != null && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-system-600">
            <span className="font-semibold">Calificación:</span> <EstrellasDeCalificacion valor={contribution.calificacion} className="text-[14px]" />
          </p>
        )}
        {contribution.status === "rechazado" && contribution.rejectionReason && (
          <p className="mt-2 rounded border border-error-700 bg-error-50 px-3 py-2 text-[12px] text-system-900">
            <span className="font-semibold">Motivo del rechazo:</span> {contribution.rejectionReason}
          </p>
        )}
      </div>
      <div className="min-w-0 lg:order-1 lg:self-center">
        <div>
          {contribution.archivoBorrado ? (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-[12.5px] text-system-500">
              El creador borró este archivo
            </div>
          ) : contribution.fileType === "foto" && !contribution.sinArchivo ? (
            <ArchivoDelAporte
              aporteId={contribution.id}
              tipo={contribution.fileType}
              alt={`Vista previa de tu aporte en ${contribution.campaignName}`}
              alto="aspect-video max-h-80"
            />
          ) : contribution.fileType === "video" && !contribution.sinArchivo ? (
            <video
              src={`${BASE_PATH}/api/aportes/${contribution.id}/archivo`}
              muted
              playsInline
              preload="metadata"
              controls={false}
              className="pointer-events-none aspect-video max-h-80 w-full rounded-lg border border-system-300 bg-system-900 object-contain"
              aria-label={`Vista previa del video de tu aporte en ${contribution.campaignName}`}
            />
          ) : contribution.fileType === "texto" && !contribution.sinArchivo ? (
            // Desde el 2026-11-11 el texto se guarda como .txt y se ve aquí mismo.
            <TextoDelAporte src={`${BASE_PATH}/api/aportes/${contribution.id}/archivo`} alto="aspect-video max-h-80" />
          ) : (
            <div className="flex aspect-video max-h-80 items-center justify-center rounded-lg border border-system-300 bg-system-100 text-sm font-semibold text-system-700">
              {contribution.sinArchivo ? "Aporte de texto" : contribution.fileType === "audio" ? "Audio" : "Archivo"}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
