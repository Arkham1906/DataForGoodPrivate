"use client";

// Pantalla /mis-campanas/[id]/especial: convertir la campaña en especial (multiplicador de XP).
// Componente cliente. Datos: GET /api/campanas?id=. La regla de XP especial aún no está implementada en el servidor.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import PantallaEsqueleto from "@/components/ui/Esqueletos";

const MAX_MULTIPLIER = 3;

export default function CampanaEspecialPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [multiplier, setMultiplier] = useState(2);
  const [startDate, setStartDate] = useState("2026-08-15");
  const [endDate, setEndDate] = useState("2026-08-22");

  useEffect(() => {
    async function loadCampaign() {
      const response = await fetch(`${BASE_PATH}/api/campanas?id=${params.id}`);
      if (!response.ok) return;
      const body = await response.json();
      setCampaign(body.data ?? null);
    }

    if (params.id) loadCampaign();
  }, [params.id]);

  if (!campaign) {
    return <PantallaEsqueleto tipo="formulario" etiqueta="Cargando campaña…" />;
  }

  function handlePublish() {
    router.push("/mis-campanas");
  }

  const baseXp = { texto: 10, foto: 25, audio: 50 };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">Campaña especial</h1>
          <p className="mt-1 text-[13px] text-system-600">{campaign.name}</p>
        </div>
        <Tag tone="warn">Sin publicar</Tag>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <Field label="Periodo especial">
            <div className="flex gap-3">
              <Input
                type="date"
                value={startDate}
                aria-label="Inicio del periodo especial"
                onChange={(e) => setStartDate(e.target.value)}
                className="font-mono"
              />
              <Input
                type="date"
                value={endDate}
                aria-label="Fin del periodo especial"
                onChange={(e) => setEndDate(e.target.value)}
                className="font-mono"
              />
            </div>
          </Field>

          <Field label="Multiplicador de experiencia" hint={`Tope máximo del sistema: ×${MAX_MULTIPLIER}`}>
            <select
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
              className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none focus:border-brand-600"
            >
              {Array.from({ length: MAX_MULTIPLIER }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  ×{m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Bonificación por cuota completa">
            <Input value="300 XP" disabled className="bg-system-100 font-mono" />
          </Field>

          <Field label="Insignia exclusiva">
            <div className="rounded border border-system-300 bg-white px-3.5 py-3">
              <p className="text-[13px] font-medium text-system-900">Guardián verde</p>
              <p className="text-[11.5px] text-system-500">Al completar la cuota</p>
            </div>
          </Field>
        </div>

        <div>
          <div className="mb-4 rounded-lg bg-system-100 p-4">
            <p className="mb-2.5 text-[12px] font-medium text-system-900">
              Con ×{multiplier}, cada aporte aprobado otorga
            </p>
            <div className="flex justify-between border-b border-system-300 py-1.5 text-[13px]">
              <span className="text-system-600">Texto</span>
              <span className="font-mono">
                {baseXp.texto} → {baseXp.texto * multiplier} XP
              </span>
            </div>
            <div className="flex justify-between border-b border-system-300 py-1.5 text-[13px]">
              <span className="text-system-600">Foto o documento</span>
              <span className="font-mono">
                {baseXp.foto} → {baseXp.foto * multiplier} XP
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-[13px]">
              <span className="text-system-600">Audio o video</span>
              <span className="font-mono">
                {baseXp.audio} → {baseXp.audio * multiplier} XP
              </span>
            </div>
          </div>

          <div className="mb-5 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">
            El tope diario de experiencia por usuario sigue vigente durante el periodo
            especial.
          </div>

          <Button variant="primary" className="w-full" onClick={handlePublish}>
            Publicar campaña especial
          </Button>
        </div>
      </div>
    </div>
  );
}
