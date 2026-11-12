"use client";

// Pantalla /campanas/[id]: detalle de una campaña.
// Componente cliente. Datos: GET /api/campanas?id= (incluye viewer: creador, baneado, aportes propios).
// Acción: guardar/quitar de favoritos con POST/DELETE /api/campanas/[id]/guardar.
// Para aportar hay que inscribirse una vez (viewer.inscrito): sin inscripción, "Realizar un aporte" abre la ventana
// de los acuerdos (ui/AcuerdosDeAporte, VentanaDeInscripcion; POST /api/campanas/[id]/inscripcion) y al aceptarlos
// lleva al formulario (2026-11-10, a pedido del usuario); ya inscrito, va directo.
// "Compartir" abre el cuadro de compartir.tsx (enlace público /c/[token] y QR).
// "Reportar campaña" (reportar.tsx) para quien no la creó: va a la bandeja del SuperUsuario.
// Compartir, Favorita (estrella) y Reportar (bandera) son íconos (ui/BotonDeIcono) en la fila de la temática
// (2026-11-10, a pedido del usuario).

import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button, { buttonClasses } from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import RutaDeTematica from "@/components/ui/RutaDeTematica";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { TIPO_DE_DATO, extensionesDe, nombresDeFormatos } from "@/lib/aportes/archivo";
import { fechaCorta } from "@/lib/campanas/especial-reglas";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { avisoDePausa } from "@/lib/campanas/pausa";
import CompartirCampana from "./compartir";
import ReportarCampana from "./reportar";
import BotonDeIcono, { IconoEstrella } from "@/components/ui/BotonDeIcono";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import { AvisoNoEncontrado } from "@/components/ui/AvisoNoEncontrado";
import { VentanaDeInscripcion } from "@/components/ui/AcuerdosDeAporte";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import { repartoSugerido } from "@/lib/campanas/reparto-sugerido";
import { resumenDeCuotaPorTipo } from "@/lib/campanas/cuota-por-tipo";
import { resumenDeLimites } from "@/lib/campanas/limite-por-tipo";
import { textoDelProposito } from "@/lib/campanas/proposito";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  // Ventana de los acuerdos para inscribirse (2026-11-10).
  const [aceptandoAcuerdos, setAceptandoAcuerdos] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [conSesion, setConSesion] = useState<boolean | null>(null);
  const [enlaceAnonimo, setEnlaceAnonimo] = useState<string | null>(null);
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
  // "Gracias…" tras reportar con la bandera (2026-11-10).
  const [avisoDeReporte, setAvisoDeReporte] = useState<string | null>(null);

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
        setConSesion(Boolean(payload.viewer?.conSesion));
        setEnlaceAnonimo(payload.viewer?.enlaceAnonimo ?? null);
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
    <div className="mx-auto w-full max-w-6xl">
      <div className="min-w-0">
        <Link href="/campanas" className="mb-4 inline-block text-[13px] text-system-600 hover:text-system-900">
          ← Volver a campañas
        </Link>

        {/* Compartir, Favorita y Reportar como íconos en la fila de la temática (2026-11-10, a pedido del usuario;
            antes, botones con texto: Compartir aquí, Favorita bajo "Realizar un aporte" y Reportar al final). */}
        <h1 className="mb-2 text-[26px] font-extrabold text-system-900">{campaign.name}</h1>

        <div className="mb-2 flex items-center justify-between gap-3">
          <RutaDeTematica tematica={campaign.tematica || campaign.tag} etiquetas={campaign.etiquetas} />
          <div className="flex shrink-0 items-center gap-2">
            <CompartirCampana campanaId={campaign.id} nombre={campaign.name} tematica={campaign.tematica || campaign.tag} />
            <BotonDeIcono
              etiqueta={saved ? "Quitar de favoritas" : "Marcar como favorita"}
              aria-pressed={saved}
              disabled={guardando}
              onClick={alternarGuardado}
              className={saved ? "!text-warning-500" : ""}
            >
              <IconoEstrella rellena={saved} />
            </BotonDeIcono>
            {!isCreator && (
              <ReportarCampana campanaId={campaign.id} yaReportada={yaReportada} onReportada={setAvisoDeReporte} />
            )}
          </div>
        </div>
        {avisoDeReporte && (
          <p role="status" className="mb-2 text-right text-[12.5px] text-system-600">
            {avisoDeReporte}
          </p>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="order-2 min-w-0 lg:order-2">

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

        <div className="mb-4 rounded-lg border border-system-200 bg-white p-3.5">
          <h2 className="text-[15px] font-bold text-system-900">¿De qué trata esta campaña?</h2>
          <p className="mt-1 text-[12px] leading-5 text-system-600">{campaign.description}</p>
        </div>
          <h2 className="mb-2 mt-5 text-lg font-bold text-system-900">¿Qué puedes aportar?</h2>
        <p className="mb-3 text-[13px] text-system-600">
          Comparte la información que tengas. Cada aporte es valioso.
        </p>
        {/* Sale de la campaña: sus tipos de dato y sus checklists. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {campaign.dataTypes
            .filter((tipo) => tipo !== "texto")
            .map((tipo) => (
              <div key={tipo} className="rounded-lg border border-system-200 bg-white p-4">
                <p className="text-[14px] font-bold text-system-900">{TIPO_DE_DATO[tipo]?.titulo ?? tipo}</p>
                <p className="mt-1 text-[12px] text-system-500">
                  {tipo === "documento" && (campaign.formatosDeDocumento ?? []).length > 0
                    ? `Solo ${nombresDeFormatos(campaign.formatosDeDocumento)} (${extensionesDe("documento", campaign.formatosDeDocumento).join(", ")}), un archivo por aporte, de hasta 20 MB.`
                    : TIPO_DE_DATO[tipo]?.detalle}
                </p>
              </div>
            ))}
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
          {campaign.hasBanner && (
            <div className="order-1 overflow-hidden rounded-xl border border-system-200 bg-system-50 p-2 lg:order-1 lg:mt-1">
              <img
                src={`${BASE_PATH}/api/campanas/${campaign.id}/banner?v=${encodeURIComponent(campaign.bannerVersion ?? "")}`}
                alt={`Banner de ${campaign.name}`}
                className="h-auto max-h-[460px] min-h-[260px] w-full rounded-lg bg-system-100 object-contain"
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <section className="rounded-lg border border-system-200 bg-white p-5">
            <h3 className="mb-3 text-[15px] font-bold text-system-900">Detalles de la campaña</h3>
            <dl className="grid grid-cols-1 gap-2.5 text-[13px] md:grid-cols-2 xl:grid-cols-3 xl:gap-x-8">
              <div className="flex justify-between gap-4">
                <dt className="text-system-600">Creador</dt>
                <dd className="min-w-0 break-words text-right font-medium text-system-900">
                  {campaign.creatorName || "Sin especificar"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-system-600">Organización</dt>
                <dd className="min-w-0 break-words text-right font-medium text-system-900">
                  {campaign.organizer || "Sin organización"}
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
          </section>

          {/* Tu participación (2026-11-10, a pedido del usuario): el texto a la izquierda y la acción en
              una columna fija a la derecha, centrada con el texto; la nota de los acuerdos va con el
              resto del texto para que el botón no quede desacomodado. Abajo de lg todo se apila. */}
          <section className="rounded-lg border border-system-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 text-[15px] font-bold text-system-900">Tu participación hace la diferencia</h3>
                <p className="mb-4 text-[12.5px] text-system-600">
                  Esta campaña no recibe dinero. Aquí se comparte conocimiento.
                </p>
                <ProgressBar pct={pct} />
                <p className="mt-2 font-mono text-[12.5px] text-system-600">
                  {campaign.approvedContributions} de {campaign.goalContributions} aportes aprobados · tu
                  cuota: {campaign.quotaPerUser}
                  {/* Solo sugerencia (2026-10-27): la cuota vale para cualquier tipo. */}
                  {resumenDeCuotaPorTipo(campaign.dataTypes, campaign.cuotaPorTipo ?? {})
                    ? ` (${resumenDeCuotaPorTipo(campaign.dataTypes, campaign.cuotaPorTipo ?? {})})`
                    : repartoSugerido(campaign.quotaPerUser, campaign.dataTypes) ? ` (sugerido: ${repartoSugerido(campaign.quotaPerUser, campaign.dataTypes)})` : ""}
                  {/* Límite total por tipo de dato (2026-10-28). */}
                  {resumenDeLimites(campaign.dataTypes, campaign.limitePorTipo ?? {}, campaign.enviadosPorTipo ?? {})
                    ? ` · máximo ${resumenDeLimites(campaign.dataTypes, campaign.limitePorTipo ?? {}, campaign.enviadosPorTipo ?? {})}`
                    : ""}
                </p>
                {!isCreator && !baneado && campaign.status === "activa" && !inscrito && (
                  <p className="mt-1 text-[12px] text-system-500">
                    Antes de aportar aceptas los acuerdos de la campaña; solo se piden una vez.
                  </p>
                )}
              </div>

              <div className="w-full shrink-0 sm:w-64">
                {!conSesion ? (
                  campaign.status === "activa" && !campaign.permiteAnonimos ? (
                    <p className="rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600">
                      Esta campaña solo recibe aportes con cuenta.
                    </p>
                  ) : campaign.status === "activa" && enlaceAnonimo ? (
                    <Link href={`/c/${enlaceAnonimo}`} className={buttonClasses("primary", "md", "w-full")}>
                      Aportar sin cuenta
                    </Link>
                  ) : campaign.status === "activa" ? (
                    <p className="rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600">
                      Los aportes sin cuenta no están disponibles en este momento.
                    </p>
                  ) : (
                    <p className="rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600">
                      Esta campaña no está recibiendo aportes.
                    </p>
                  )
                ) : isCreator ? (
                  <p className="rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600">Creaste esta campaña, por lo que no puedes aportar en ella.</p>
                ) : baneado ? (
                  <p className="rounded-lg bg-error-50 p-3 text-center text-[12.5px] text-error-700">
                    Quien creó esta campaña te retiró la posibilidad de aportar en ella.
                    {motivoDeBaneo && <span className="mt-1 block font-semibold">Motivo: {motivoDeBaneo}</span>}
                  </p>
                ) : campaign.status === "activa" && !inscrito ? (
                  // Sin inscribirse, "Realizar un aporte" abre la ventana de los acuerdos; al aceptarlos va al
                  // formulario (2026-11-10, a pedido del usuario; antes las casillas iban aquí mismo).
                  <>
                    <Button variant="primary" className="w-full" onClick={() => setAceptandoAcuerdos(true)} aria-haspopup="dialog">
                      Realizar un aporte
                    </Button>
                    <VentanaDeInscripcion
                      abierta={aceptandoAcuerdos}
                      onCerrar={() => setAceptandoAcuerdos(false)}
                      campanaId={campaign.id}
                      onInscrito={() => router.push(`/campanas/${campaign.id}/aportar`)}
                      proposito={textoDelProposito(campaign.proposito, campaign.propositoOtro)}
                    />
                  </>
                ) : campaign.status === "activa" ? (
                  <Link href={`/campanas/${campaign.id}/aportar`} className={buttonClasses("primary", "md", "w-full")}>
                    Realizar un aporte
                  </Link>
                ) : campaign.status === "pausada" ? (
                  <p className="rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600">{avisoDePausa(campaign.pausa, "Podrás aportar cuando se reanude.")}</p>
                ) : (
                  <p className="rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600">Esta campaña no está recibiendo aportes.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
