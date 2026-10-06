"use client";

// Pantalla /campanas/[id]/aportar: formulario para enviar un aporte (archivo, descripción, checklists).
// Componente cliente. Datos: GET /api/campanas?id= y GET /api/aportes?campaignId=&mine=true (cuota usada).
// Acción: POST /api/aportes (multipart/form-data). El servidor valida cuota, baneo, tipo y tamaño.
// Con ?enlace=<token> (viene de /c/[token]) lo reenvía para atribuir el aporte a ese enlace.

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Field, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { etiquetaDeRespuesta } from "@/lib/campanas/checklist";

export default function AportarPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  // Si se llegó desde un enlace público (/c/[token]), el aporte se atribuye a ese enlace.
  const enlace = useSearchParams().get("enlace");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [baneado, setBaneado] = useState(false);
  const [motivoDeBaneo, setMotivoDeBaneo] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [caracteristicas, setCaracteristicas] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadCampaign() {
      try {
        const [campaignRes, aportesRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas?id=${encodeURIComponent(params.id)}`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/aportes?campaignId=${encodeURIComponent(params.id)}&mine=true`, { cache: "no-store" }),
        ]);

        const campaignPayload = await campaignRes.json().catch(() => ({}));
        if (!campaignRes.ok) throw new Error(campaignPayload.error ?? "No se pudo cargar la campaña");
        setCampaign(campaignPayload.data as Campaign);
        setIsCreator(Boolean(campaignPayload.viewer?.isCreator));
        setBaneado(Boolean(campaignPayload.viewer?.baneado));
        setMotivoDeBaneo(campaignPayload.viewer?.motivoDeBaneo ?? null);

        const aportesPayload = await aportesRes.json().catch(() => ({}));
        if (aportesRes.ok) setSubmittedCount(Array.isArray(aportesPayload.data) ? aportesPayload.data.length : 0);
      } catch (cause) {
        setLoadError(cause instanceof Error ? cause.message : "No se pudo cargar la campaña");
      }
    }
    void loadCampaign();
  }, [params.id]);

  if (loadError) return <p className="text-sm text-danger">{loadError}</p>;
  if (!campaign) return <p className="text-sm text-ink-2">Cargando campaña...</p>;
  if (isCreator) return <p className="rounded-lg bg-sunken p-4 text-sm text-ink-2">No puedes aportar en una campaña que creaste.</p>;
  // El servidor también lo rechaza (POST /api/aportes); esto evita llenar el formulario en balde.
  if (baneado) {
    return (
      <p className="rounded-lg bg-danger-tint p-4 text-sm text-danger">
        Quien creó esta campaña te retiró la posibilidad de aportar en ella.
        {motivoDeBaneo && <span className="mt-1 block font-semibold">Motivo: {motivoDeBaneo}</span>}
      </p>
    );
  }

  const quotaReached = submittedCount >= campaign.quotaPerUser;
  // La API ya convierte las campañas viejas (lista plana) en un checklist sin título.
  const checklists = campaign.checklistSecciones ?? [];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(selected.type)) {
      setFile(null);
      setFileError("Formato no válido. Usa .jpg, .jpeg o .png.");
      return;
    }

    if (selected.size > 10_000_000) {
      setFile(null);
      setFileError("El archivo pesa más de 10 MB. Elige otro: no se comprime automáticamente.");
      return;
    }

    setFileError(null);
    setFile(selected);
  }

  function toggleCaracteristica(value: string) {
    setCaracteristicas((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !campaign) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.set("campaignId", campaign.id);
      formData.set("description", description);
      formData.set("file", file);
      caracteristicas.forEach((item) => formData.append("caracteristicas", item));
      if (enlace) formData.set("enlace", enlace);

      const response = await fetch(`${BASE_PATH}/api/aportes`, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo enviar el aporte");

      router.push(`/mis-aportes/${campaign.id}`);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "No se pudo enviar el aporte");
      setSubmitting(false);
    }
  }

  const canSubmit = !quotaReached && Boolean(file) && description.trim().length > 0 && description.length <= 1000 && !submitting;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-extrabold text-ink">Nuevo aporte</h1>
      <p className="mb-6 text-[13px] text-ink-2">
        {campaign.name} · aporte {Math.min(submittedCount + 1, campaign.quotaPerUser)}{" "}
        de tu cuota de {campaign.quotaPerUser}
      </p>

      {quotaReached && <p className="mb-5 rounded-lg border border-ok bg-ok-tint p-3 text-[13px] text-ok">Alcanzaste tu cuota en esta campaña. La campaña sigue abierta para otras personas, pero ya no puedes enviar más aportes.</p>}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink">
            Archivo <span className="text-danger">*</span>
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-line-2 bg-sunken p-6 text-center text-[13px] text-ink-2 hover:border-accent">
            <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" className="hidden" onChange={handleFileChange} />
            {file ? (
              <span className="font-medium text-ink">{file.name}</span>
            ) : (
              <>
                <span className="font-medium text-ink">Arrastra una imagen o haz clic para buscarla</span>
                <span className="font-mono text-[11px]">.jpg .jpeg .png · máximo 10 MB</span>
              </>
            )}
          </label>
          {fileError && <p className="mt-2 rounded border border-danger bg-danger-tint p-2 text-[12px] text-danger">{fileError}</p>}
        </div>

        <div>
          <Field label="Descripción" required>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe qué se ve en el contenido"
              maxLength={1000}
              required
            />
          </Field>
          <p className="mb-4 text-right text-[11px] font-mono text-ink-3">
            {description.length} / 1000
          </p>

          {checklists.map((checklist, i) => (
            <fieldset key={checklist.titulo || i} className="mb-4 rounded-lg border border-line bg-surface p-3.5">
              <legend className="px-1 text-[13px] font-medium text-ink">
                {checklist.titulo || "Marca lo que aplique"}
              </legend>
              {checklist.opciones.map((opcion) => {
                // Se guarda como "Título: opción" para saber a qué checklist pertenece.
                const valor = etiquetaDeRespuesta(checklist.titulo, opcion);
                return (
                  <label key={opcion} className="mb-2 flex items-center gap-2 text-[12.5px] text-ink-2 last:mb-0">
                    <input
                      type="checkbox"
                      checked={caracteristicas.includes(valor)}
                      onChange={() => toggleCaracteristica(valor)}
                    />
                    {opcion}
                  </label>
                );
              })}
            </fieldset>
          ))}

          {submitError && <p className="mb-3 rounded border border-danger bg-danger-tint p-2 text-[12px] text-danger">{submitError}</p>}

          <Button variant="primary" type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? "Enviando..." : "Enviar aporte"}
          </Button>
          <p className="mt-2 text-center text-[11.5px] text-ink-3">
            Quedará pendiente de revisión
          </p>
        </div>
      </form>
    </div>
  );
}
