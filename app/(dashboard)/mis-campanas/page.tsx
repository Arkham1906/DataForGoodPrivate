"use client";

// Pantalla /mis-campanas: campañas que creaste, con filtros por estado.
// Componente cliente. Datos: GET /api/campanas?mine=true.
// Acciones en "Más", con PATCH /api/campanas/[id] { status }: "Pausar" (activa → pausada),
// "Reanudar" (pausada → activa; no si la pausó la supervisión, que se muestra con su motivo)
// y "Finalizar" (activa o pausada). Pausar y Finalizar se confirman en una ventana emergente
// (ui/VentanaDeConfirmacion). "Compartir" (activa, 2026-10-19) abre el mismo cuadro de
// /campanas/[id] (enlace, redes sociales y QR; campanas/[id]/compartir.tsx). Solo el creador las ve:
// la lista viene de mine=true y el servidor revisa creator_id.

import { useEffect, useState } from "react";
import ButtonLink from "@/components/ui/ButtonLink";
import MenuDeAcciones from "@/components/ui/MenuDeAcciones";
import Tag from "@/components/ui/Tag";
import RutaDeTematica from "@/components/ui/RutaDeTematica";
import ProgressBar from "@/components/ui/ProgressBar";
import VentanaDeCampana from "@/components/campanas/VentanaDeCampana";
import type { Campaign, CampaignStatus } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { EsqueletoDeTarjetas } from "@/components/ui/Esqueletos";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import CompartirCampana from "@/app/(dashboard)/campanas/[id]/compartir";
import { resumenDeIncentivos, textoDelPeriodo } from "@/lib/campanas/especial-reglas";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { fechaDDMMAAAA, inicioEnElFuturo, ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";

const fechaDeRechazo = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONA_DE_CAMPANAS });
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

const labels: Record<CampaignStatus, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aceptada: "Aceptada",
  activa: "Activa",
  pausada: "Pausada",
  finalizada: "Finalizada",
  rechazada: "Rechazada",
};

type Filtro = "todas" | CampaignStatus;

const FILTROS: { valor: Filtro; etiqueta: string; fijo?: boolean }[] = [
  { valor: "todas", etiqueta: "Todas", fijo: true },
  { valor: "en_revision", etiqueta: "En revisión", fijo: true },
  { valor: "aceptada", etiqueta: "Aceptadas", fijo: true },
  { valor: "activa", etiqueta: "Activas", fijo: true },
  { valor: "pausada", etiqueta: "Pausadas" },
  { valor: "finalizada", etiqueta: "Finalizadas", fijo: true },
  { valor: "rechazada", etiqueta: "Rechazadas" },
  { valor: "borrador", etiqueta: "Borradores" },
];

function mapCampaign(row: Record<string, unknown>): Campaign {
  const status = String(row.status ?? "borrador") as CampaignStatus;
  return {
    id: String(row.id ?? ""),
    creatorId: String(row.creatorId ?? ""),
    creatorName: String(row.creatorName ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    tag: String(row.tag ?? ""),
    tematica: String(row.tematica ?? ""),
    // Subtemáticas (2026-10-27); las pendientes de aprobar se marcan.
    etiquetas: Array.isArray(row.etiquetas) ? (row.etiquetas as Campaign["etiquetas"]) : [],
    status: labels[status] ? status : "borrador",
    dataTypes: Array.isArray(row.dataTypes) ? (row.dataTypes as Campaign["dataTypes"]) : [],
    goalContributions: Number(row.goalContributions ?? 0),
    quotaPerUser: Number(row.quotaPerUser ?? 1),
    currentContributions: Number(row.currentContributions ?? 0),
    approvedContributions: Number(row.approvedContributions ?? 0),
    pendingContributions: Number(row.pendingContributions ?? 0),
    rejectedContributions: Number(row.rejectedContributions ?? 0),
    participants: Number(row.participants ?? 0),
    startDate: row.startDate as string | null,
    // Horas, checklists, colonia, "todo el país" y organización: la ventana de detalle (2026-10-27).
    // startTime también decide entre "Reanudar" y "Programar" (antes no llegaba y se tomaba 00:00).
    startTime: (row.startTime as string | null) ?? null,
    endDate: row.endDate as string | null,
    endTime: (row.endTime as string | null) ?? null,
    checklistSecciones: Array.isArray(row.checklistSecciones) ? (row.checklistSecciones as Campaign["checklistSecciones"]) : [],
    locationCity: String(row.locationCity ?? ""),
    locationState: String(row.locationState ?? ""),
    locationColonia: String(row.locationColonia ?? ""),
    todoElPais: row.todoElPais === true,
    organizer: String(row.organizer ?? ""),
    proposito: row.proposito ? String(row.proposito) : null,
    propositoOtro: row.propositoOtro ? String(row.propositoOtro) : null,
    xpPerContribution: Number(row.xpPerContribution ?? 0),
    daysRemaining: row.daysRemaining as number | null,
    hasReviewerAssigned: Boolean(row.hasReviewerAssigned),
    especial: (row.especial as Campaign["especial"]) ?? null,
    pausa: (row.pausa as Campaign["pausa"]) ?? null,
    rechazo: (row.rechazo as Campaign["rechazo"]) ?? null,
  };
}

export default function MisCampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [cambioError, setCambioError] = useState<Record<string, string>>({});
  // Campaña cuya ventana de "Pausar" está abierta.
  const [porPausar, setPorPausar] = useState<Campaign | null>(null);
  const [porCompartir, setPorCompartir] = useState<Campaign | null>(null);
  // Campaña cuya ventana de "Finalizar" está abierta (2026-10-16; antes window.confirm).
  const [porFinalizar, setPorFinalizar] = useState<Campaign | null>(null);
  // Campaña cuya ventana de detalle está abierta (2026-10-27): clic en su tarjeta.
  const [abierta, setAbierta] = useState<Campaign | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    void fetch(`${BASE_PATH}/api/campanas?mine=true`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        setCampaigns(
          (Array.isArray(payload.data) ? payload.data : []).map((item: unknown) =>
            mapCampaign(item as Record<string, unknown>)
          )
        );
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas"))
      .finally(() => setCargando(false));
  }, [recarga]);

  const count = (status: CampaignStatus) => campaigns.filter((campaign) => campaign.status === status).length;
  // Los estados fijos siempre se ven; el resto solo si hay alguna campaña en él.
  const filtros = FILTROS.filter((f) => f.fijo || (f.valor !== "todas" && count(f.valor) > 0));
  const visibles = filtro === "todas" ? campaigns : campaigns.filter((campaign) => campaign.status === filtro);

  // Solo el creador ve esta pantalla (viene de mine=true): no hace falta
  // revisar rol ni dueño aparte, ya está filtrado por sesión.
  async function cambiarEstado(id: string, nuevo: "pausada" | "activa" | "aceptada" | "finalizada") {
    // "Pausar" y "Finalizar" ya se confirmaron en su ventana emergente (VentanaDeConfirmacion).

    const fallo = {
      finalizada: "No se pudo finalizar la campaña",
      pausada: "No se pudo pausar la campaña",
      activa: "No se pudo reanudar la campaña",
      aceptada: "No se pudo programar la campaña",
    }[nuevo];
    setCambiandoId(id);
    setCambioError((prev) => ({ ...prev, [id]: "" }));
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nuevo }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? fallo);
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: nuevo } : c)));
    } catch (cause) {
      setCambioError((prev) => ({ ...prev, [id]: cause instanceof Error ? cause.message : fallo }));
    } finally {
      setCambiandoId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl lg:mx-0 lg:max-w-none">
      <div className="mb-2 flex items-start justify-between gap-4 max-md:gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mis campañas</h1>
          <p className="mt-1 text-[13px] text-system-600 max-md:text-[12px] max-md:leading-5">Administra las campañas que has creado.</p>
        </div>
        <ButtonLink
          href="/mis-campanas/nueva"
          variant="primary"
          size="sm"
          className="whitespace-nowrap max-md:max-w-[126px] max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px] max-md:leading-4"
        >
          Nueva campaña
        </ButtonLink>
      </div>

      <div
        className="dashboard-nav mb-5 mt-4 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:gap-1.5 md:flex-wrap md:overflow-visible md:pb-0"
        role="group"
        aria-label="Filtrar por estado"
      >
        {filtros.map((f) => {
          const activo = filtro === f.valor;
          const total = f.valor === "todas" ? campaigns.length : count(f.valor);
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => setFiltro(f.valor)}
              className={`shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${
                activo ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
              }`}
            >
              {f.etiqueta} <span className="font-mono text-[11.5px] opacity-80">{total}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p>
      ) : cargando ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando tus campañas…</span>
          <EsqueletoDeTarjetas cantidad={4} columnas={2} />
        </div>
      ) : campaigns.length === 0 ? (
        <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">Todavía no has creado campañas.</p>
      ) : visibles.length === 0 ? (
        <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">No tienes campañas en este estado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibles.map((campaign) => {
            const pct = porcentajeDeMeta(campaign.approvedContributions, campaign.goalContributions);
            const puedeFinalizar = campaign.status === "activa" || campaign.status === "pausada";
            const cambiando = cambiandoId === campaign.id;

            return (
              // Tarjeta en columna (2026-10-22): los botones van al fondo, así quedan a la misma altura
              // en las dos tarjetas de una fila, y el aviso de pausa va antes que ellos.
              // Toda la tarjeta abre el detalle (2026-10-27): un botón la cubre y los botones de abajo quedan encima.
              <div key={campaign.id} className="relative flex min-w-0 cursor-pointer flex-col rounded-lg border border-system-200 bg-white p-4 transition-colors hover:border-brand-600 max-md:p-3.5">
                <button
                  type="button"
                  onClick={() => setAbierta(campaign)}
                  aria-label={`Ver la información de ${campaign.name}`}
                  data-sin-respuesta
                  className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                />
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="line-clamp-2 min-w-0 break-words text-[13.5px] font-medium text-system-900 max-md:text-[13px]" title={campaign.name}>
                    {campaign.name}
                  </p>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {campaign.especial && campaign.especial.etapa !== "terminada" && <Tag tone="warn">Especial ×{campaign.especial.multiplicador}</Tag>}
                    {/* Mismos colores que el panel (ETIQUETA_DE_CAMPANA, 2026-10-22): aceptada y activa en verde, rechazada en rojo, borrador en gris. */}
                    <Tag tone={ETIQUETA_DE_CAMPANA[campaign.status]?.tono ?? "default"}>{labels[campaign.status]}</Tag>
                  </div>
                </div>
                <RutaDeTematica tematica={campaign.tematica || campaign.tag} etiquetas={campaign.etiquetas} className="mb-2" />
                {campaign.status === "rechazada" ? (
                  // Por qué se rechazó (2026-10-22, a pedido del usuario; antes solo en la notificación).
                  // Ocupa el lugar de fechas, barra y números con la misma altura (65 px + margen = los
                  // 75 px de ese bloque), así la tarjeta no crece ni mueve a la de al lado: una línea con
                  // quién, cuándo y la sanción, y el motivo en 2 (completo en el title y arriba del
                  // formulario al corregirla).
                  <div
                    className="mb-2.5 h-[65px] overflow-hidden rounded-lg border border-error-200 bg-error-50 px-2.5 py-2 text-[11px] leading-[15px] text-system-900"
                    title={campaign.rechazo?.motivo}
                  >
                    <p className="truncate font-semibold text-error-700">
                      {campaign.rechazo?.porSuperUsuario ? "La supervisión" : "Un supervisor"} la rechazó
                      {campaign.rechazo && (
                        <span className="font-normal text-system-600">
                          {" "}el {fechaDeRechazo.format(new Date(campaign.rechazo.fecha))}
                          {campaign.rechazo.sancion && <> · se aplicó {campaign.rechazo.sancion}</>}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 line-clamp-2 break-words text-system-600">
                      Motivo: {campaign.rechazo?.motivo ?? "sin motivo registrado"}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mb-2.5 font-mono text-[11.5px] text-system-600 max-md:text-[10.5px]">
                      {campaign.startDate ? fechaDDMMAAAA(campaign.startDate) : "Sin fecha"} al{" "}
                      {campaign.endDate ? fechaDDMMAAAA(campaign.endDate) : "Sin fecha"}
                    </p>
                    <ProgressBar pct={pct} tone={campaign.status === "finalizada" ? "ok" : "accent"} />
                    <p className="my-2.5 font-mono text-[12px] text-system-600 max-md:text-[11px]">
                      {campaign.approvedContributions} / {campaign.goalContributions} aprobados · {campaign.pendingContributions} aportes pendientes
                      {campaign.especial && <> · {textoDelPeriodo(campaign.especial)}</>}
                    </p>
                    {campaign.especial && (
                      <p className="-mt-1 mb-2.5 text-[12px] text-system-600 max-md:text-[11px]">{resumenDeIncentivos(campaign.especial)}</p>
                    )}
                  </>
                )}
                {campaign.status === "pausada" && campaign.pausa?.por === "supervision" ? (
                  <div className="mb-2.5 rounded-lg border border-warning-200 bg-warning-50 p-2.5 text-[11.5px] text-system-900">
                    <p className="font-semibold">La supervisión pausó esta campaña</p>
                    <p className="mt-0.5 whitespace-pre-line break-words text-system-600">Motivo: {campaign.pausa.motivo || "sin motivo registrado"}</p>
                    <p className="mt-0.5 text-system-600">No recibe aportes hasta que la supervisión la reanude.</p>
                  </div>
                ) : campaign.status === "pausada" && (
                  <p className="mb-2.5 text-[11.5px] text-system-600">Pausada: no recibe aportes ni aparece en Campañas hasta que la reanudes.</p>
                )}
                {/* Una acción principal y "Panel" a la vista; lo demás en "Más" (Ley de Hick, 2026-10-07).
                    Rechazada: la principal es corregirla (no tiene aportes que revisar). */}
                <div className="relative z-10 mt-auto flex flex-wrap items-center gap-1.5 max-md:gap-1">
                  {campaign.status === "rechazada" ? (
                    <ButtonLink href={`/mis-campanas/nueva?edit=${campaign.id}`} variant="primary" size="sm" className="max-md:px-2 max-md:py-1.5 max-md:text-[11px]">
                      Corregir y reenviar
                    </ButtonLink>
                  ) : (
                    <ButtonLink href={`/mis-campanas/${campaign.id}/aportes`} variant="primary" size="sm" className="max-md:px-2 max-md:py-1.5 max-md:text-[11px]">
                      Revisar aportes
                      {campaign.pendingContributions > 0 && <span className="font-mono">({campaign.pendingContributions})</span>}
                    </ButtonLink>
                  )}
                  <ButtonLink href={`/mis-campanas/${campaign.id}/panel`} size="sm" className="max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Panel</ButtonLink>
                  <MenuDeAcciones
                    etiqueta={`Más acciones de ${campaign.name}`}
                    opciones={[
                      ...(campaign.status === "activa"
                        ? [{ etiqueta: "Compartir", alElegir: () => setPorCompartir(campaign) }]
                        : []),
                      { etiqueta: "Editar", href: `/mis-campanas/nueva?edit=${campaign.id}` },
                      ...(puedeFinalizar
                        ? [{ etiqueta: campaign.especial ? "Editar incentivos" : "Hacer especial", href: `/mis-campanas/${campaign.id}/especial` }]
                        : []),
                      ...(campaign.status === "activa"
                        ? [{ etiqueta: "Pausar campaña", alElegir: () => setPorPausar(campaign), deshabilitado: cambiando }]
                        : []),
                      // La que pausó la supervisión solo la reanuda la supervisión (2026-10-15).
                      ...(campaign.status === "pausada" && campaign.pausa?.por !== "supervision"
                        ? [
                            // Con el inicio movido al futuro se programa en vez de reanudarse (2026-10-27).
                            inicioEnElFuturo(campaign.startDate, campaign.startTime)
                              ? { etiqueta: "Programar campaña", alElegir: () => void cambiarEstado(campaign.id, "aceptada"), deshabilitado: cambiando }
                              : { etiqueta: "Reanudar campaña", alElegir: () => void cambiarEstado(campaign.id, "activa"), deshabilitado: cambiando },
                          ]
                        : []),
                      ...(puedeFinalizar
                        ? [
                            {
                              etiqueta: "Finalizar campaña",
                              alElegir: () => setPorFinalizar(campaign),
                              peligro: true,
                              deshabilitado: cambiando,
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
                {cambioError[campaign.id] && (
                  <p role="alert" className="mt-2 text-[11.5px] text-error-700">{cambioError[campaign.id]}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {porCompartir && (
        <CompartirCampana
          key={porCompartir.id}
          campanaId={porCompartir.id}
          nombre={porCompartir.name}
          tematica={porCompartir.tematica || porCompartir.tag}
          abierto
          onCerrar={() => setPorCompartir(null)}
        />
      )}

      <VentanaDeConfirmacion
        abierto={porPausar !== null}
        titulo="¿Pausar esta campaña?"
        textoConfirmar="Pausar campaña"
        textoOcupado="Pausando…"
        ocupado={porPausar !== null && cambiandoId === porPausar.id}
        onCancelar={() => setPorPausar(null)}
        onConfirmar={() => {
          if (!porPausar) return;
          void cambiarEstado(porPausar.id, "pausada").finally(() => setPorPausar(null));
        }}
      >
        {porPausar && <p className="mb-3 font-semibold text-system-900">{porPausar.name}</p>}
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>No recibirá aportes nuevos, ni de personas con cuenta ni por su enlace público.</li>
          <li>Dejará de aparecer en Campañas y en Explorar.</li>
          <li>Los aportes que ya recibió se conservan y puedes seguir revisándolos.</li>
          <li>No se finaliza sola: si su fecha de cierre pasa mientras está pausada, tendrás que poner una nueva para reanudarla.</li>
        </ul>
        <p className="mt-3">Puedes reanudarla cuando quieras desde el menú «Más».</p>
      </VentanaDeConfirmacion>

      <VentanaDeConfirmacion
        abierto={porFinalizar !== null}
        titulo="¿Finalizar esta campaña?"
        textoConfirmar="Finalizar campaña"
        textoOcupado="Finalizando…"
        peligro
        ocupado={porFinalizar !== null && cambiandoId === porFinalizar.id}
        onCancelar={() => setPorFinalizar(null)}
        onConfirmar={() => {
          if (!porFinalizar) return;
          void cambiarEstado(porFinalizar.id, "finalizada").finally(() => setPorFinalizar(null));
        }}
      >
        {porFinalizar && <p className="mb-3 font-semibold text-system-900">{porFinalizar.name}</p>}
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Dejará de recibir aportes nuevos, ni de personas con cuenta ni por su enlace público.</li>
          <li>Dejará de aparecer en Campañas y en Explorar.</li>
          <li>Sus aportes aprobados se publicarán en Datos abiertos.</li>
        </ul>
        <p className="mt-3">Para volver a abrirla tendrás que editarla y ponerle una fecha de cierre nueva.</p>
      </VentanaDeConfirmacion>

      {abierta && (
        <VentanaDeCampana
          key={abierta.id}
          campana={abierta}
          onCerrar={() => setAbierta(null)}
          extra={<DatosDelCreador campana={abierta} />}
          acciones={
            <>
              {["activa", "pausada", "finalizada"].includes(abierta.status) && (
                <ButtonLink href={`/campanas/${abierta.id}`} size="sm">
                  Verla como participante
                </ButtonLink>
              )}
              <ButtonLink href={`/mis-campanas/nueva?edit=${abierta.id}`} size="sm">
                Editar
              </ButtonLink>
              <ButtonLink href={`/mis-campanas/${abierta.id}/panel`} size="sm">
                Panel
              </ButtonLink>
              {abierta.status === "rechazada" ? (
                <ButtonLink href={`/mis-campanas/nueva?edit=${abierta.id}`} variant="primary" size="sm">
                  Corregir y reenviar
                </ButtonLink>
              ) : (
                <ButtonLink href={`/mis-campanas/${abierta.id}/aportes`} variant="primary" size="sm">
                  Revisar aportes{abierta.pendingContributions > 0 && <span className="font-mono"> ({abierta.pendingContributions})</span>}
                </ButtonLink>
              )}
            </>
          }
        />
      )}
    </div>
  );
}

/** Lo que solo ve el creador en la ventana de detalle (2026-10-27): estado, motivos, aportes y revisión. */
function DatosDelCreador({ campana }: { campana: Campaign }) {
  const nf = new Intl.NumberFormat("es-MX");
  const cifras = [
    { valor: campana.currentContributions, texto: "recibidos" },
    { valor: campana.pendingContributions, texto: "por revisar" },
    { valor: campana.approvedContributions, texto: "aprobados" },
    { valor: campana.rejectedContributions, texto: "rechazados" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-system-500">Solo para ti, como creador</p>
      {campana.status === "rechazada" && (
        <div className="rounded-lg border border-error-200 bg-error-50 p-3 text-[12.5px]">
          <p className="font-semibold text-error-700">
            {campana.rechazo?.porSuperUsuario ? "La supervisión" : "Un supervisor"} la rechazó
            {campana.rechazo && <> el {fechaDeRechazo.format(new Date(campana.rechazo.fecha))}</>}
            {campana.rechazo?.sancion && <> · se aplicó {campana.rechazo.sancion}</>}
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-system-600">Motivo: {campana.rechazo?.motivo ?? "sin motivo registrado"}</p>
        </div>
      )}
      {campana.status === "pausada" && (
        <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-[12.5px] text-system-900">
          <p className="font-semibold">{campana.pausa?.por === "supervision" ? "La supervisión pausó esta campaña" : "La pausaste tú"}</p>
          {campana.pausa?.por === "supervision" && (
            <p className="mt-1 whitespace-pre-line break-words text-system-600">Motivo: {campana.pausa.motivo || "sin motivo registrado"}</p>
          )}
        </div>
      )}
      <dl className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
        {cifras.map((c) => (
          // Título primero (dt antes de dd); se ve debajo del número con flex-col-reverse.
          <div key={c.texto} className="flex flex-col-reverse rounded-lg bg-system-50 p-2.5 text-center">
            <dt className="text-[11px] text-system-500">{c.texto}</dt>
            <dd className="font-mono text-[16px] font-bold text-system-900">{nf.format(c.valor)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[12.5px] text-system-600">
        {campana.hasReviewerAssigned ? "Tiene revisor de aportes asignado." : "Todavía no tiene revisor de aportes: los revisas tú."}
        {campana.especial && <> {resumenDeIncentivos(campana.especial)} ({textoDelPeriodo(campana.especial)}).</>}
      </p>
    </div>
  );
}
