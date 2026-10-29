"use client";

// Pantalla /campanas/[id]: detalle de una campaña.
// Componente cliente. Datos: GET /api/campanas?id= (incluye viewer: creador, baneado, aportes propios).
// Acción: guardar/quitar de favoritos con POST/DELETE /api/campanas/[id]/guardar.
// Para aportar hay que inscribirse una vez (viewer.inscrito): las casillas de los acuerdos van aquí
// (ui/AcuerdosDeAporte, POST /api/campanas/[id]/inscripcion); ya inscrito, sale "Realizar un aporte".
// "Compartir" abre el cuadro de compartir.tsx (enlace público /c/[token] y QR).
// "Reportar campaña" (reportar.tsx) para quien no la creó: va a la bandeja del SuperUsuario.

import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import RutaDeTematica from "@/components/ui/RutaDeTematica";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { TIPO_DE_DATO } from "@/lib/aportes/archivo";
import { fechaCorta } from "@/lib/campanas/especial-reglas";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { avisoDePausa } from "@/lib/campanas/pausa";
import CompartirCampana from "./compartir";
import ReportarCampana from "./reportar";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import { AvisoNoEncontrado } from "@/components/ui/AvisoNoEncontrado";
import { InscripcionACampana } from "@/components/ui/AcuerdosDeAporte";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import { repartoSugerido } from "@/lib/campanas/reparto-sugerido";
import { resumenDeLimites } from "@/lib/campanas/limite-por-tipo";
import { quienOrganiza } from "@/lib/campanas/organizacion";
import { textoDelProposito } from "@/lib/campanas/proposito";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [baneado, setBaneado] = useState(false);
  const [motivoDeBaneo, setMotivoDeBaneo] = useState<string | null>(null);
  const [yaReportada, setYaReportada] = useState(false);
  const [inscrito, setInscrito] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 404: no existe o no la puede ver (lib/campanas/visibilidad.ts).
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [saved, setSaved] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function loadCampaign() {
      try {
        const response = await fetch(`${BASE_PATH}/api/campanas?id=${encodeURIComponent(params.id)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setNoEncontrada(true);
          return;
        }
        if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar la campaña");
        setCampaign(payload.data as Campaign);
        setIsCreator(Boolean(payload.viewer?.isCreator));
        setBaneado(Boolean(payload.viewer?.baneado));
        setMotivoDeBaneo(payload.viewer?.motivoDeBaneo ?? null);
        setYaReportada(Boolean(payload.viewer?.yaReportada));
        setInscrito(Boolean(payload.viewer?.inscrito));
        setSaved(Boolean((payload.data as Campaign)?.isSaved));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar la campaña");
      }
    }
    void loadCampaign();
  }, [params.id, recarga]);

  async function alternarGuardado() {
    if (guardando) return;
    setGuardando(true);
    const metodo = saved ? "DELETE" : "POST";
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${encodeURIComponent(params.id)}/guardar`, {
        method: metodo,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar");
      setSaved(Boolean(payload.data?.isSaved));
    } catch {
      // Si falla, el estado se queda como estaba: no hay nada que revertir.
    } finally {
      setGuardando(false);
    }
  }

  if (noEncontrada) return <AvisoNoEncontrado volverA="/campanas" textoVolver="Volver a campañas" />;
  if (error) return <p className="text-sm text-error-700">{error}</p>;
  if (!campaign) return <PantallaEsqueleto tipo="detalle" etiqueta="Cargando campaña…" />;

  const parseDateOnly = (date: string | null | undefined) => {
    if (!date) return null;
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const pct = porcentajeDeMeta(campaign.approvedContributions, campaign.goalContributions);
  const closeDate = campaign.endDate ? parseDateOnly(campaign.endDate)?.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) : "Sin fecha";
  const remainingDays = Number.isFinite(campaign.daysRemaining) ? Math.max(0, Number(campaign.daysRemaining)) : 0;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <Link href="/campanas" className="mb-4 inline-block text-[13px] text-system-600 hover:text-system-900">
          ← Volver a campañas
        </Link>

        <div className="mb-2 flex items-center justify-between">
          <RutaDeTematica tematica={campaign.tematica || campaign.tag} etiquetas={campaign.etiquetas} />
          <CompartirCampana campanaId={campaign.id} nombre={campaign.name} tematica={campaign.tematica || campaign.tag} />
        </div>

        <h1 className="mb-2 text-[26px] font-extrabold text-system-900">{campaign.name}</h1>

        <div className="mb-6 flex flex-wrap gap-5 text-[13px] text-system-600">
          <span>
            {textoDeUbicacion({ todoElPais: campaign.todoElPais, municipio: campaign.locationCity, estado: campaign.locationState })}
          </span>
          <span>
            {campaign.startDate && parseDateOnly(campaign.startDate)?.toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
            })}{" "}
            –{" "}
            {campaign.endDate && parseDateOnly(campaign.endDate)?.toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <p className="mb-4 font-mono text-[12px] text-system-600">
          Fecha de cierre: {closeDate} · Días restantes: {remainingDays}
        </p>

        {campaign.especial && campaign.especial.etapa !== "terminada" && (
          <div className="mb-4 rounded-lg border border-warning-200 bg-warning-50 p-4 text-[13px] text-warning-900">
            <p className="font-bold">
              ★ Campaña especial: experiencia ×{campaign.especial.multiplicador}
              {campaign.especial.etapa === "vigente"
                ? ` hasta el ${fechaCorta(campaign.especial.fin)}`
                : ` del ${fechaCorta(campaign.especial.inicio)} al ${fechaCorta(campaign.especial.fin)}`}
            </p>
            <p className="mt-1 text-[12.5px]">
              Cada aporte aprobado en ese periodo da {campaign.especial.multiplicador === 1 ? "la experiencia normal" : `${campaign.especial.multiplicador} veces la experiencia`}.
              {" "}Al completar tu cuota ganas {campaign.especial.bono} XP
              {campaign.especial.insignia ? <> y la insignia <b>“{campaign.especial.insignia}”</b></> : null}.
            </p>
          </div>
        )}

        <div className="mb-6 rounded-lg bg-brand-800 p-5 text-white">
          <p className="text-base font-bold">Tu observación suma conocimiento</p>
          <p className="mt-1 text-[13px] text-white/85">{campaign.description}</p>
        </div>

        <h2 className="mb-2 text-lg font-bold text-system-900">¿De qué trata esta campaña?</h2>
        <p className="text-[14px] leading-relaxed text-system-600">{campaign.description}</p>

        <h2 className="mb-2 mt-6 text-lg font-bold text-system-900">¿Qué puedes aportar?</h2>
        <p className="mb-3 text-[13px] text-system-600">
          Comparte la información que tengas. Cada aporte es valioso.
        </p>
        {/* Sale de la campaña: sus tipos de dato, la descripción (siempre obligatoria) y sus
            checklists. Antes eran dos tarjetas fijas del prototipo (árboles). */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {campaign.dataTypes
            .filter((tipo) => tipo !== "texto")
            .map((tipo) => (
              <div key={tipo} className="rounded-lg border border-system-200 bg-white p-4">
                <p className="text-[14px] font-bold text-system-900">{TIPO_DE_DATO[tipo]?.titulo ?? tipo}</p>
                <p className="mt-1 text-[12px] text-system-500">{TIPO_DE_DATO[tipo]?.detalle}</p>
              </div>
            ))}
          <div className="rounded-lg border border-system-200 bg-white p-4">
            <p className="text-[14px] font-bold text-system-900">Descripción</p>
            <p className="mt-1 text-[12px] text-system-500">
              Qué observaste y dónde, con tus palabras. Es obligatoria.
            </p>
          </div>
          {(campaign.checklistSecciones ?? []).map((seccion, i) => (
            <div key={`${seccion.tipo ?? ""}-${seccion.titulo || i}`} className="rounded-lg border border-system-200 bg-white p-4">
              <p className="text-[14px] font-bold text-system-900">{seccion.titulo || "Marca lo que aplique"}</p>
              {seccion.tipo && (
                <p className="text-[11.5px] font-medium text-brand-600">Al mandar {TIPO_DE_DATO[seccion.tipo]?.titulo.toLowerCase() ?? seccion.tipo}</p>
              )}
              <p className="mt-1 text-[12px] text-system-500">{seccion.opciones.join(" · ")}</p>
            </div>
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border border-system-200 bg-white p-5">
          <h3 className="mb-1 text-[15px] font-bold text-system-900">
            Tu participación hace la diferencia
          </h3>
          <p className="mb-4 text-[12.5px] text-system-600">
            Esta campaña no recibe dinero. Aquí se comparte conocimiento.
          </p>

          <ProgressBar pct={pct} />
          <p className="mt-2 mb-4 font-mono text-[12.5px] text-system-600">
            {campaign.approvedContributions} de {campaign.goalContributions} aportes aprobados · tu
            cuota: {campaign.quotaPerUser}
            {/* Solo sugerencia (2026-10-27): la cuota vale para cualquier tipo. */}
            {repartoSugerido(campaign.quotaPerUser, campaign.dataTypes) ? ` (sugerido: ${repartoSugerido(campaign.quotaPerUser, campaign.dataTypes)})` : ""}
            {/* Límite total por tipo de dato (2026-10-28). */}
            {resumenDeLimites(campaign.dataTypes, campaign.limitePorTipo ?? {}, campaign.enviadosPorTipo ?? {})
              ? ` · máximo ${resumenDeLimites(campaign.dataTypes, campaign.limitePorTipo ?? {}, campaign.enviadosPorTipo ?? {})}`
              : ""}
          </p>

          {isCreator ? (
            <p className="rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600">Creaste esta campaña, por lo que no puedes aportar en ella.</p>
          ) : baneado ? (
            <p className="rounded-lg bg-error-50 p-3 text-center text-[12.5px] text-error-700">
              Quien creó esta campaña te retiró la posibilidad de aportar en ella.
              {motivoDeBaneo && <span className="mt-1 block font-semibold">Motivo: {motivoDeBaneo}</span>}
            </p>
          ) : campaign.status === "activa" && !inscrito ? (
            <InscripcionACampana
              campanaId={campaign.id}
              onInscrito={() => setInscrito(true)}
              proposito={textoDelProposito(campaign.proposito, campaign.propositoOtro)}
            />
          ) : campaign.status === "activa" ? (
            <Link href={`/campanas/${campaign.id}/aportar`}>
              <Button variant="primary" className="w-full">Realizar un aporte</Button>
            </Link>
          ) : campaign.status === "pausada" ? (
            <p className="rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600">{avisoDePausa(campaign.pausa, "Podrás aportar cuando se reanude.")}</p>
          ) : (
            <p className="rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600">Esta campaña no está recibiendo aportes.</p>
          )}
          <Button variant="secondary" className="mt-2.5 w-full" disabled={guardando} onClick={alternarGuardado}>
            {saved ? "Campaña guardada" : "Guardar campaña"}
          </Button>
        </div>

        <div className="rounded-lg border border-system-200 bg-white p-5">
          <h3 className="mb-3 text-[15px] font-bold text-system-900">Detalles de la campaña</h3>
          <dl className="flex flex-col gap-2.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-system-600">Organiza</dt>
              {/* La organización que puso; si no puso ninguna, el nombre de quien la creó (2026-10-22). */}
              <dd className="min-w-0 break-words text-right font-medium text-system-900">
                {quienOrganiza(campaign)}
              </dd>
            </div>
            {/* Para qué se usarán los datos (2026-10-27). */}
            {textoDelProposito(campaign.proposito, campaign.propositoOtro) && (
              <div className="flex justify-between gap-4">
                <dt className="text-system-600">Propósito</dt>
                <dd className="min-w-0 break-words text-right font-medium text-system-900">
                  {textoDelProposito(campaign.proposito, campaign.propositoOtro)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-system-600">Tipo de dato</dt>
              <dd className="font-medium text-system-900">
                {campaign.dataTypes.map((t) => t[0].toUpperCase() + t.slice(1)).join(" y ")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-system-600">Meta</dt>
              <dd className="font-medium text-system-900">
                {campaign.goalContributions} aportes
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-system-600">Experiencia</dt>
              <dd className="font-medium text-system-900">
                {campaign.xpPerContribution} XP por aporte aprobado
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-success-700 bg-success-50 p-4">
          <p className="text-[13.5px] font-bold text-success-700">Tus datos están seguros</p>
          <p className="mt-1 text-[12.5px] text-success-700">Cada aporte se revisa antes de publicarse y tus archivos solo se usan dentro de esta campaña.</p>
        </div>

        {!isCreator && <ReportarCampana campanaId={campaign.id} yaReportada={yaReportada} />}
      </aside>
    </div>
  );
}
