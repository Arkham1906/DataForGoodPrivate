"use client";

// Pantalla /mis-campanas/[id]/panel: métricas de una campaña propia.
// Componente cliente. Datos: GET /api/campanas?id= y GET /api/campanas/[id]/recoleccion-diaria.
// Ojo: ni la página ni esos endpoints comprueban que seas el creador (docs/README.md § 8).

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Tag from "@/components/ui/Tag";
import MetricCard from "@/components/ui/MetricCard";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";

type DiaDeRecoleccion = { fecha: string; etiqueta: string; valor: number };
type TipoDeAporte = { tipo: string; etiqueta: string; valor: number; porcentaje: number };

export default function PanelCampanaPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recoleccionDiaria, setRecoleccionDiaria] = useState<DiaDeRecoleccion[]>([]);
  const [porTipo, setPorTipo] = useState<TipoDeAporte[]>([]);

  useEffect(() => {
    let activo = true;

    async function loadCampaign() {
      const [campaignResponse, recoleccionResponse] = await Promise.all([
        fetch(`${BASE_PATH}/api/campanas?id=${params.id}`, { cache: "no-store" }),
        fetch(`${BASE_PATH}/api/campanas/${params.id}/recoleccion-diaria`, { cache: "no-store" }),
      ]);
      if (!activo) return;

      if (campaignResponse.ok) {
        const body = await campaignResponse.json();
        setCampaign(body.data ?? null);
      }
      if (recoleccionResponse.ok) {
        const body = await recoleccionResponse.json();
        setRecoleccionDiaria(Array.isArray(body.data) ? body.data : []);
        setPorTipo(Array.isArray(body.porTipo) ? body.porTipo : []);
      }
    }

    if (!params.id) return;
    loadCampaign();

    // El badge dice "en vivo": mientras la campaña siga activa, se refresca
    // sola cada 3 s en vez de solo cargar una vez al entrar.
    const intervalo = setInterval(loadCampaign, 3000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [params.id]);

  if (!campaign) {
    return <p className="text-sm text-system-600">Cargando campaña…</p>;
  }

  const parseDateOnly = (date: string | null | undefined) => {
    if (!date) return null;
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const isFinished = campaign.status === "finalizada";
  const pct = campaign.goalContributions > 0 ? Math.round((campaign.currentContributions / campaign.goalContributions) * 100) : 0;
  const maxDaily = Math.max(...recoleccionDiaria.map((d) => d.valor), 1);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/mis-campanas"
        className="mb-4 inline-block text-[13px] text-system-600 hover:text-system-900"
      >
        ← Volver a mis campañas
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">{campaign.name}</h1>
          <p className="mt-1 font-mono text-[13px] text-system-600">
            {campaign.startDate && parseDateOnly(campaign.startDate)?.toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
            })}{" "}
            –{" "}
            {campaign.endDate && parseDateOnly(campaign.endDate)?.toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · {campaign.status}
          </p>
        </div>
        <Tag tone={isFinished ? "default" : "ok"}>
          {isFinished ? "Solo lectura" : "En vivo · actualiza cada 3 s"}
        </Tag>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Aportes aprobados" value={campaign.approvedContributions} />
        <MetricCard label="Participantes" value={campaign.participants} />
        {isFinished ? (
          <MetricCard label="Meta alcanzada" value="100%" />
        ) : (
          <MetricCard label="Pendientes" value={campaign.pendingContributions} />
        )}
        <MetricCard label="Meta" value={`${pct}%`} />
      </div>

      {!isFinished && (
        <>
          <p className="mb-3 text-[12.5px] font-medium text-system-900">
            Recolección diaria <span className="text-system-400">· últimos 14 días</span>
          </p>
          <div className="mb-1.5 flex h-32 items-end gap-1.5 border-b border-system-200">
            {recoleccionDiaria.map((dia) => (
              <div
                key={dia.fecha}
                title={`${dia.etiqueta}: ${dia.valor} aporte${dia.valor === 1 ? "" : "s"}`}
                aria-label={`${dia.etiqueta}: ${dia.valor} aporte${dia.valor === 1 ? "" : "s"}`}
                className="flex-1 rounded-t bg-brand-600"
                style={{ height: `${(dia.valor / maxDaily) * 100}%`, minHeight: dia.valor > 0 ? 2 : 0 }}
              />
            ))}
          </div>
          <div className="mb-8 flex gap-1.5">
            {recoleccionDiaria.map((dia) => (
              <span
                key={dia.fecha}
                className="flex-1 text-center font-mono text-[9px] text-system-400"
              >
                {dia.etiqueta}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-3 text-[12.5px] font-medium text-system-900">
            {isFinished ? "Resultado por tipo de dato" : "Por tipo de dato"}
          </p>
          {porTipo.length === 0 ? (
            <p className="text-[12.5px] text-system-600">Todavía no hay aportes aprobados.</p>
          ) : (
            porTipo.map((tipo, i) => (
              <div
                key={tipo.tipo}
                className={`flex items-center gap-2.5 text-[12.5px] ${i < porTipo.length - 1 ? "mb-2.5" : ""}`}
              >
                <span className="w-16 flex-none text-system-600">{tipo.etiqueta}</span>
                <div className="flex-1">
                  <ProgressBar pct={tipo.porcentaje} />
                </div>
                <span className="w-8 text-right font-mono">{tipo.valor}</span>
              </div>
            ))
          )}
        </div>

        <div>
          <p className="mb-3 text-[12.5px] font-medium text-system-900">
            {isFinished ? "Cierre" : "Progreso hacia la meta"}
          </p>
          {isFinished ? (
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-system-600">Meta</span>
                <span className="font-mono font-medium text-system-900">
                  {campaign.approvedContributions} de {campaign.goalContributions}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-system-600">Cerrada el</span>
                <span className="font-mono font-medium text-system-900">
                  {campaign.endDate && parseDateOnly(campaign.endDate)?.toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          ) : (
            <>
              <ProgressBar pct={pct} tone="ok" />
              <div className="my-3 flex justify-between font-mono text-[12.5px] text-system-600">
                <span>
                  {campaign.currentContributions} de {campaign.goalContributions} aportes
                </span>
                <span>{campaign.daysRemaining ?? 0} días restantes</span>
              </div>
              <div className="rounded-lg bg-system-100 p-3.5 text-[12px] leading-relaxed text-system-600">
                Al ritmo actual, la meta se alcanza antes de la fecha de cierre.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
