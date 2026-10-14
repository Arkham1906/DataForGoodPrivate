"use client";

// Pantalla /campanas/[id]/aportar: formulario para enviar un aporte (archivo, descripción, checklists).
// Componente cliente. Datos: GET /api/campanas?id= y GET /api/aportes?campaignId=&mine=true (cuota usada).
// El archivo sigue los tipos de la campaña (components/ui/SelectorDeArchivo); con "texto" es opcional.
// Acción: POST /api/aportes (multipart/form-data). El servidor valida cuota, baneo, tipo, tamaño
// y las dos casillas de la ventana "Antes de enviar" (components/ui/AvisosDeAporte), que se abre
// al dar "Enviar aporte" y es la que envía.
// Con ?enlace=<token> (viene de /c/[token]) lo reenvía para atribuir el aporte a ese enlace.

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Field, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { etiquetaDeRespuesta } from "@/lib/campanas/checklist";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import AvisosDeAporte, { agregarAvisos, type Avisos } from "@/components/ui/AvisosDeAporte";
import SelectorDeArchivo from "@/components/ui/SelectorDeArchivo";
import { archivoEsOpcional, tiposAceptados } from "@/lib/aportes/archivo";

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
  // "Enviar aporte" abre la ventana de avisos; el envío sale de ahí.
  const [confirmando, setConfirmando] = useState(false);
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

  if (loadError) return <p className="text-sm text-error-700">{loadError}</p>;
  if (!campaign) return <PantallaEsqueleto tipo="formulario" etiqueta="Cargando campaña…" />;
  if (isCreator) return <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">No puedes aportar en una campaña que creaste.</p>;
  // El servidor también lo rechaza (POST /api/aportes); esto evita llenar el formulario en balde.
  if (baneado) {
    return (
      <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">
        Quien creó esta campaña te retiró la posibilidad de aportar en ella.
        {motivoDeBaneo && <span className="mt-1 block font-semibold">Motivo: {motivoDeBaneo}</span>}
      </p>
    );
  }

  const quotaReached = submittedCount >= campaign.quotaPerUser;
  // La API ya convierte las campañas viejas (lista plana) en un checklist sin título.
  const checklists = campaign.checklistSecciones ?? [];

  // Tipos que acepta la campaña; con "texto", el archivo es opcional.
  const tipos = tiposAceptados(campaign.dataTypes);

  function toggleCaracteristica(value: string) {
    setCaracteristicas((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSubmit) setConfirmando(true);
  }

  async function enviar(avisos: Avisos) {
    if (!campaign) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.set("campaignId", campaign.id);
      formData.set("description", description);
      if (file) formData.set("file", file);
      caracteristicas.forEach((item) => formData.append("caracteristicas", item));
      if (enlace) formData.set("enlace", enlace);
      agregarAvisos(formData, avisos);

      const response = await fetch(`${BASE_PATH}/api/aportes`, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo enviar el aporte");

      router.push(`/mis-aportes/${campaign.id}`);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "No se pudo enviar el aporte");
      setSubmitting(false);
      setConfirmando(false);
    }
  }

  const canSubmit = !quotaReached && (Boolean(file) || archivoEsOpcional(tipos)) && description.trim().length > 0 && description.length <= 1000 && !submitting;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-extrabold text-system-900">Nuevo aporte</h1>
      <p className="mb-6 text-[13px] text-system-600">
        {campaign.name} · aporte {Math.min(submittedCount + 1, campaign.quotaPerUser)}{" "}
        de tu cuota de {campaign.quotaPerUser}
      </p>

      {quotaReached && <p className="mb-5 rounded-lg border border-success-700 bg-success-50 p-3 text-[13px] text-success-700">Alcanzaste tu cuota en esta campaña. La campaña sigue abierta para otras personas, pero ya no puedes enviar más aportes.</p>}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SelectorDeArchivo
          tipos={tipos}
          archivo={file}
          error={fileError}
          onCambio={(elegido, problema) => {
            setFile(elegido);
            setFileError(problema);
          }}
        />

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
          <p className="mb-4 text-right text-[11px] font-mono text-system-500">
            {description.length} / 1000
          </p>

          {checklists.map((checklist, i) => (
            <fieldset key={checklist.titulo || i} className="mb-4 rounded-lg border border-system-200 bg-white p-3.5">
              <legend className="px-1 text-[13px] font-medium text-system-900">
                {checklist.titulo || "Marca lo que aplique"}
              </legend>
              {checklist.opciones.map((opcion) => {
                // Se guarda como "Título: opción" para saber a qué checklist pertenece.
                const valor = etiquetaDeRespuesta(checklist.titulo, opcion);
                return (
                  <label key={opcion} className="mb-2 flex items-center gap-2 text-[12.5px] text-system-600 last:mb-0">
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

          {submitError && <p className="mb-3 rounded border border-error-700 bg-error-50 p-2 text-[12px] text-error-700">{submitError}</p>}

          <Button variant="primary" type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <IndicadorDeCarga />
                Enviando…
              </span>
            ) : "Enviar aporte"}
          </Button>
          <p className="mt-2 text-center text-[11.5px] text-system-500">
            Quedará pendiente de revisión
          </p>
        </div>
      </form>

      <AvisosDeAporte
        abierto={confirmando}
        enviando={submitting}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={(avisos) => void enviar(avisos)}
      />
    </div>
  );
}
