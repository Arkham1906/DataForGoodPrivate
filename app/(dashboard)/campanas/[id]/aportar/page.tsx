"use client";

// Pantalla /campanas/[id]/aportar: formulario para enviar un aporte (archivo, descripción, checklists).
// Componente cliente. Datos: GET /api/campanas?id= y GET /api/aportes?campaignId=&mine=true (cuota usada).
// El archivo sigue los tipos de la campaña (components/ui/SelectorDeArchivo); con "texto" es opcional.
// Acción: POST /api/aportes (multipart/form-data). El servidor valida cuota, baneo, tipo, tamaño y que
// la persona esté inscrita (aceptó los acuerdos una vez; antes salía una ventana en cada aporte). Si llega
// sin inscribirse (p. ej. desde /c/[token]), arriba del formulario van las casillas (ui/AcuerdosDeAporte).
// Con ?enlace=<token> (viene de /c/[token]) lo reenvía para atribuir el aporte a ese enlace.

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Field, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { respuestasValidas, seccionesParaElAporte } from "@/lib/campanas/checklist";
import ChecklistsDelAporte from "@/components/aportes/ChecklistsDelAporte";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import { AvisoNoEncontrado } from "@/components/ui/AvisoNoEncontrado";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import { InscripcionACampana } from "@/components/ui/AcuerdosDeAporte";
import { textoDelProposito } from "@/lib/campanas/proposito";
import SelectorDeArchivo from "@/components/ui/SelectorDeArchivo";
import { archivoEsOpcional, tiposAceptados } from "@/lib/aportes/archivo";
import { avisoDeTodoLleno, resumenDeLimites, tiposConLugar } from "@/lib/campanas/limite-por-tipo";
import { repartoSugerido } from "@/lib/campanas/reparto-sugerido";

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
  // Tipo de cada aporte ya enviado, para lo que queda de cada tipo (cuota por tipo).
  const [loadError, setLoadError] = useState<string | null>(null);
  // 404: no existe o no la puede ver (lib/campanas/visibilidad.ts).
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [caracteristicas, setCaracteristicas] = useState<string[]>([]);
  const [inscrito, setInscrito] = useState(false);
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
        if (campaignRes.status === 404) {
          setNoEncontrada(true);
          return;
        }
        if (!campaignRes.ok) throw new Error(campaignPayload.error ?? "No se pudo cargar la campaña");
        setCampaign(campaignPayload.data as Campaign);
        setIsCreator(Boolean(campaignPayload.viewer?.isCreator));
        setBaneado(Boolean(campaignPayload.viewer?.baneado));
        setMotivoDeBaneo(campaignPayload.viewer?.motivoDeBaneo ?? null);
        setInscrito(Boolean(campaignPayload.viewer?.inscrito));

        const aportesPayload = await aportesRes.json().catch(() => ({}));
        if (aportesRes.ok) {
          const enviados: unknown[] = Array.isArray(aportesPayload.data) ? aportesPayload.data : [];
          setSubmittedCount(enviados.length);
        }
      } catch (cause) {
        setLoadError(cause instanceof Error ? cause.message : "No se pudo cargar la campaña");
      }
    }
    void loadCampaign();
  }, [params.id]);

  if (noEncontrada) return <AvisoNoEncontrado volverA="/campanas" textoVolver="Volver a campañas" />;
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
  // Solo cuota general (2026-10-27): el reparto por tipo es una sugerencia, no un límite.
  const sugerencia = repartoSugerido(campaign.quotaPerUser, campaign.dataTypes);
  // Tipos que acepta la campaña; con "texto", el archivo es opcional. Desde el 2026-10-28 sin los
  // que ya llegaron a su límite total (lib/campanas/limite-por-tipo.ts); el servidor lo vuelve a revisar.
  const limitePorTipo = campaign.limitePorTipo ?? {};
  const enviadosPorTipo = campaign.enviadosPorTipo ?? {};
  const todosLosTipos = tiposAceptados(campaign.dataTypes);
  const tipos = tiposConLugar(todosLosTipos, limitePorTipo, enviadosPorTipo);
  const resumenLimites = resumenDeLimites(todosLosTipos, limitePorTipo, enviadosPorTipo);
  const todoLleno = avisoDeTodoLleno(todosLosTipos, limitePorTipo, enviadosPorTipo);
  // La API ya convierte las campañas viejas (lista plana) en un checklist sin título. Solo se
  // muestran los del tipo de lo que se manda (2026-10-28).
  const { visibles, faltaArchivo } = seccionesParaElAporte(campaign.checklistSecciones ?? [], tipos, file);

  function toggleCaracteristica(value: string) {
    setCaracteristicas((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaign || !canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.set("campaignId", campaign.id);
      formData.set("description", description);
      if (file) formData.set("file", file);
      // Solo lo marcado en los checklists que se ven (cambiar de archivo puede esconder alguno).
      respuestasValidas(caracteristicas, visibles).forEach((item) => formData.append("caracteristicas", item));
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

  const canSubmit = inscrito && !quotaReached && !todoLleno && (Boolean(file) || archivoEsOpcional(tipos)) && description.trim().length > 0 && description.length <= 1000 && !submitting;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-extrabold text-system-900">Nuevo aporte</h1>
      <p className="mb-6 text-[13px] text-system-600">
        {campaign.name} · aporte {Math.min(submittedCount + 1, campaign.quotaPerUser)}{" "}
        de tu cuota de {campaign.quotaPerUser}
      </p>
      {sugerencia && !quotaReached && (
        <p className="-mt-4 mb-6 text-[12.5px] text-system-600">
          Puedes mandar cualquier tipo. Para que los datos queden balanceados, te sugerimos{" "}
          <span className="font-semibold text-system-900">{sugerencia}</span>.
        </p>
      )}

      {resumenLimites && !quotaReached && (
        <p className="-mt-4 mb-6 text-[12.5px] text-system-600">
          Esta campaña recibe en total como máximo <span className="font-semibold text-system-900">{resumenLimites}</span>.
        </p>
      )}
      {todoLleno && !quotaReached && (
        <p className="mb-5 rounded-lg border border-system-300 bg-system-100 p-3 text-[13px] text-system-700">{todoLleno}</p>
      )}

      {quotaReached && <p className="mb-5 rounded-lg border border-success-700 bg-success-50 p-3 text-[13px] text-success-700">Alcanzaste tu cuota en esta campaña. La campaña sigue abierta para otras personas, pero ya no puedes enviar más aportes.</p>}

      {!inscrito && !quotaReached && (
        <div className="mb-6 rounded-lg border border-brand-200 bg-white p-4">
          <InscripcionACampana
            campanaId={campaign.id}
            onInscrito={() => setInscrito(true)}
            proposito={textoDelProposito(campaign.proposito, campaign.propositoOtro)}
          />
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

          <ChecklistsDelAporte
            visibles={visibles}
            faltaArchivo={faltaArchivo}
            marcadas={caracteristicas}
            onAlternar={toggleCaracteristica}
          />

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
    </div>
  );
}
