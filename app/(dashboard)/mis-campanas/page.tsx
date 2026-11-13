"use client";

// Pantalla /mis-campanas: campañas que creaste, con filtros por estado.
// Componente cliente. Datos: GET /api/campanas?mine=true.
// Acciones secundarias en "Más", con PATCH /api/campanas/[id] { status }: "Pausar" (activa → pausada),
// "Reanudar" (pausada → activa; no si la pausó la supervisión, que se muestra con su motivo)
// y "Finalizar" (activa o pausada). Pausar y Finalizar se confirman en una ventana emergente
// (ui/VentanaDeConfirmacion). "Activar campaña" (2026-11-01): una aceptada por la supervisión se activa sola en su inicio y el
// creador puede activarla antes con PATCH { status: "activa" } (su inicio se adelanta a ahora).
// "Eliminar" (canDelete): sin aportes, siempre; con aportes (2026-10-31), en
// cualquier estado menos finalizada, diciendo cuántos se borran; siempre pide escribir el nombre de la campaña;
// llama DELETE /api/campanas/[id] { confirmacion } (lib/campanas/eliminar.ts). "Compartir" (activa, 2026-10-19) abre el mismo cuadro de
// /campanas/[id] (enlace, redes sociales y QR; campanas/[id]/compartir.tsx). Solo el creador las ve:
// la lista viene de mine=true y el servidor revisa creator_id.

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Tag from "@/components/ui/Tag";
import RutaDeTematica from "@/components/ui/RutaDeTematica";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Campaign, CampaignStatus } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { EsqueletoDeTarjetas } from "@/components/ui/Esqueletos";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import MenuDeAcciones from "@/components/ui/MenuDeAcciones";
import CompartirCampana from "@/app/(dashboard)/campanas/[id]/compartir";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { resumenDeIncentivos, textoDelPeriodo } from "@/lib/campanas/especial-reglas";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { fechaDDMMAAAA, inicioEnElFuturo, ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import { textoDeDatosAbiertos } from "@/lib/campanas/datos-abiertos";
import { MAX_CAMPANAS_EN_REVISION } from "@/lib/campanas/cola-de-revision";
import BotonCrearCampana from "@/components/campanas/BotonCrearCampana";

const fechaDeRechazo = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONA_DE_CAMPANAS });
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

const CLAVE_VISTA_MIS_CAMPANAS = "dfg:mis-campanas:vista";
const EVENTO_VISTA_MIS_CAMPANAS = "dfg:mis-campanas:vista-cambio";
let vistaMisCampanasEnMemoria = true;

function leerVistaDeMisCampanas(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_VISTA_MIS_CAMPANAS) !== "lista";
  } catch {
    return vistaMisCampanasEnMemoria;
  }
}

function suscribirVistaDeMisCampanas(alCambiar: () => void): () => void {
  const alCambiarVista = () => alCambiar();
  window.addEventListener("storage", alCambiarVista);
  window.addEventListener(EVENTO_VISTA_MIS_CAMPANAS, alCambiarVista);
  return () => {
    window.removeEventListener("storage", alCambiarVista);
    window.removeEventListener(EVENTO_VISTA_MIS_CAMPANAS, alCambiarVista);
  };
}

function guardarVistaDeMisCampanas(vistaCuadricula: boolean): void {
  vistaMisCampanasEnMemoria = vistaCuadricula;
  try {
    window.localStorage.setItem(CLAVE_VISTA_MIS_CAMPANAS, vistaCuadricula ? "cuadricula" : "lista");
  } catch {
    // Si el navegador bloquea el almacenamiento, la selección dura mientras la página siga abierta.
  }
  window.dispatchEvent(new Event(EVENTO_VISTA_MIS_CAMPANAS));
}

const labels: Record<CampaignStatus, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aceptada: "Aceptada",
  activa: "Activa",
  pausada: "Pausada",
  finalizada: "Finalizada",
  rechazada: "Rechazada",
};

type Filtro = "todas" | "proximas" | CampaignStatus;

const FILTROS: { valor: Filtro; etiqueta: string; fijo?: boolean }[] = [
  { valor: "todas", etiqueta: "Todas", fijo: true },
  { valor: "proximas", etiqueta: "Próximas a finalizar", fijo: true },
  { valor: "en_revision", etiqueta: "En revisión", fijo: true },
  { valor: "aceptada", etiqueta: "Aceptadas", fijo: true },
  { valor: "activa", etiqueta: "Activas", fijo: true },
  { valor: "pausada", etiqueta: "Pausadas" },
  { valor: "finalizada", etiqueta: "Finalizadas", fijo: true },
  { valor: "rechazada", etiqueta: "Rechazadas" },
  { valor: "borrador", etiqueta: "Borradores" },
];

type CampanaDeMisCampanas = Campaign & { canDelete: boolean };

/** El nombre escrito para confirmar el borrado coincide con el de la campaña (sin mayúsculas ni espacios de más). */
function mismoNombre(escrito: string, nombre: string): boolean {
  const normalizar = (t: string) => t.split(" ").filter(Boolean).join(" ").toLowerCase();
  return normalizar(escrito) === normalizar(nombre);
}

type TipoDeIconoDeAccion = "compartir" | "editar" | "pausar" | "reanudar" | "finalizar" | "eliminar";

function IconoDeAccion({ tipo }: { tipo: TipoDeIconoDeAccion }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {tipo === "compartir" && (
        <>
          <circle cx="18" cy="5" r="2" />
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="19" r="2" />
          <path d="m7.8 11 8.4-5M7.8 13l8.4 5" />
        </>
      )}
      {tipo === "editar" && <path d="m4 16.5-.7 3.7 3.7-.7L18.6 8a2.1 2.1 0 0 0-3-3L4 16.5ZM14.5 6.5l3 3" />}
      {tipo === "pausar" && <path d="M8 5v14M16 5v14" />}
      {tipo === "reanudar" && <path d="m8 5 10 7-10 7V5Z" />}
      {tipo === "finalizar" && <path d="M6 6h12v12H6zM9 12h6" />}
      {tipo === "eliminar" && (
        <>
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
        </>
      )}
    </svg>
  );
}

function estaProximaAFinalizar(campaign: Campaign): boolean {
  return (
    (campaign.status === "activa" || campaign.status === "pausada") &&
    campaign.daysRemaining !== null &&
    campaign.daysRemaining >= 0 &&
    campaign.daysRemaining <= 5
  );
}

function mapCampaign(row: Record<string, unknown>): CampanaDeMisCampanas {
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
    // Horas, checklists, colonia, "todo el país" y organización: el detalle de campaña.
    // startTime también decide entre "Reanudar" y "Activar campaña" (antes no llegaba y se tomaba 00:00).
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
    datosAbiertos: (row.datosAbiertos as Campaign["datosAbiertos"]) ?? null,
    rechazo: (row.rechazo as Campaign["rechazo"]) ?? null,
    canDelete: row.canDelete === true,
    esperaActivacion: row.esperaActivacion === true,
  };
}

export default function MisCampanasPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampanaDeMisCampanas[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [cambioError, setCambioError] = useState<Record<string, string>>({});
  // Campaña cuya ventana de "Pausar" está abierta.
  const [porPausar, setPorPausar] = useState<Campaign | null>(null);
  const [porEditar, setPorEditar] = useState<Campaign | null>(null);
  const [porCompartir, setPorCompartir] = useState<Campaign | null>(null);
  // Campaña cuya ventana de "Finalizar" está abierta (2026-10-16; antes window.confirm).
  const [porFinalizar, setPorFinalizar] = useState<Campaign | null>(null);
  const [porActivar, setPorActivar] = useState<Campaign | null>(null);
  const vistaCuadricula = useSyncExternalStore(suscribirVistaDeMisCampanas, leerVistaDeMisCampanas, () => true);
  const [porEliminar, setPorEliminar] = useState<CampanaDeMisCampanas | null>(null);
  // Nombre que escribe para confirmar que borra una campaña con aportes.
  const [nombreParaEliminar, setNombreParaEliminar] = useState("");
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  // Orden por avance de la meta (2026-11-04): "" = más recientes.
  const [ordenDeAvance, setOrdenDeAvance] = useState<"" | "mayor" | "menor">("");

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
  const proximasAFinalizar = campaigns.filter(estaProximaAFinalizar);
  // Los estados fijos siempre se ven; el resto solo si hay alguna campaña en él.
  const filtros = FILTROS.filter((f) => f.fijo || (f.valor !== "todas" && f.valor !== "proximas" && count(f.valor) > 0));
  const porEstado =
    filtro === "todas"
      ? campaigns
      : filtro === "proximas"
        ? proximasAFinalizar
        : campaigns.filter((campaign) => campaign.status === filtro);
  // En revisión y rechazada no tienen barra: van al final. El desempate es la más nueva.
  const avanceDe = (c: CampanaDeMisCampanas) => (c.goalContributions > 0 ? c.approvedContributions / c.goalContributions : 0);
  const visibles = ordenDeAvance
    ? [...porEstado].sort(
        (a, b) =>
          Number(sinAportesTodavia(a.status)) - Number(sinAportesTodavia(b.status)) ||
          (ordenDeAvance === "mayor" ? avanceDe(b) - avanceDe(a) : avanceDe(a) - avanceDe(b)) ||
          Number(b.id) - Number(a.id),
      )
    : porEstado;

  // Solo el creador ve esta pantalla (viene de mine=true): no hace falta
  // revisar rol ni dueño aparte, ya está filtrado por sesión.
  async function cambiarEstado(id: string, nuevo: "pausada" | "activa" | "aceptada" | "finalizada"): Promise<boolean> {
    // "Pausar" y "Finalizar" ya se confirmaron en su ventana emergente (VentanaDeConfirmacion).

    const fallo = {
      finalizada: "No se pudo finalizar la campaña",
      pausada: "No se pudo pausar la campaña",
      activa: "No se pudo reanudar la campaña",
      aceptada: "No se pudo programar la campaña", // pausada con inicio futuro que se deja programada
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
      const estadoNuevo: CampaignStatus = payload.data?.status ?? nuevo;
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: estadoNuevo } : c)));
      return true;
    } catch (cause) {
      setCambioError((prev) => ({ ...prev, [id]: cause instanceof Error ? cause.message : fallo }));
      return false;
    } finally {
      setCambiandoId(null);
    }
  }

  // Activa (o programa) la campaña que aprobó la supervisión; el servidor decide según su fecha de inicio.
  async function activarCampana(campaign: Campaign) {
    setCambiandoId(campaign.id);
    setCambioError((prev) => ({ ...prev, [campaign.id]: "" }));
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "activa" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo activar la campaña");
      const status = String(payload.data?.status ?? "aceptada") as CampaignStatus;
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, status, esperaActivacion: false, startDate: payload.data?.startDate ?? c.startDate, startTime: payload.data?.startTime ?? c.startTime } : c)));
      setPorActivar(null);
    } catch (cause) {
      setCambioError((prev) => ({ ...prev, [campaign.id]: cause instanceof Error ? cause.message : "No se pudo activar la campaña" }));
    } finally {
      setCambiandoId(null);
    }
  }

  async function eliminarCampana(campaign: CampanaDeMisCampanas) {
    setCambiandoId(campaign.id);
    setCambioError((prev) => ({ ...prev, [campaign.id]: "" }));
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaign.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacion: nombreParaEliminar }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo eliminar la campaña");
      setCampaigns((prev) => prev.filter((item) => item.id !== campaign.id));
      setPorEliminar(null);
    } catch (cause) {
      setCambioError((prev) => ({
        ...prev,
        [campaign.id]: cause instanceof Error ? cause.message : "No se pudo eliminar la campaña",
      }));
    } finally {
      setCambiandoId(null);
    }
  }

  // Con la cola de revisión llena no se pausa para editar: no podría enviar los cambios (2026-11-04).
  const colaDeRevisionLlena = campaigns.filter((c) => c.status === "en_revision").length >= MAX_CAMPANAS_EN_REVISION;

  async function pausarYEditar(campaign: Campaign) {
    setCambiandoId(campaign.id);
    setCambioError((prev) => ({ ...prev, [campaign.id]: "" }));
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pausada" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo pausar la campaña");
      router.push(`/mis-campanas/nueva?edit=${encodeURIComponent(campaign.id)}&restaurar=activa`);
    } catch (cause) {
      setCambioError((prev) => ({
        ...prev,
        [campaign.id]: cause instanceof Error ? cause.message : "No se pudo pausar la campaña",
      }));
    } finally {
      setCambiandoId(null);
    }
  }

  const botonCambiarVista = (className: string) => (
    <div role="group" aria-label="Cambiar vista de campañas" className="relative flex shrink-0 gap-0 overflow-hidden rounded-lg border border-system-300 bg-system-100 p-1">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-[3px] top-[3px] z-0 h-8 w-8 rounded-md bg-brand-600 shadow-inner transition-transform duration-200 ease-out motion-reduce:transition-none ${vistaCuadricula ? "translate-x-full" : "translate-x-0"}`}
      />
      <Button
        type="button"
        size="sm"
        className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${className} ${!vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`}
        onClick={() => guardarVistaDeMisCampanas(false)}
        aria-label="Vista de lista"
        aria-pressed={!vistaCuadricula}
        title="Vista de lista"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </Button>
      <Button
        type="button"
        size="sm"
        className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${className} ${vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`}
        onClick={() => guardarVistaDeMisCampanas(true)}
        aria-label="Vista cuadriculada"
        aria-pressed={vistaCuadricula}
        title="Vista cuadriculada"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl lg:mx-0 lg:max-w-none">
      <div className="mb-2 flex items-start justify-between gap-4 max-md:gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mis campañas</h1>
          <p className="mt-1 text-[13px] text-system-600 max-md:text-[12px] max-md:leading-5">Administra las campañas que has creado.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BotonCrearCampana
            variant="primary"
            size="sm"
            className="whitespace-nowrap max-md:max-w-[126px] max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px] max-md:leading-4"
          >
            Nueva campaña
          </BotonCrearCampana>
        </div>
      </div>

      <div className="mb-5 mt-4 flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:gap-3">
        <div
          className="dashboard-nav flex w-full min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:gap-1.5 md:flex-wrap md:overflow-visible md:pb-0"
          role="group"
          aria-label="Filtrar por estado"
        >
          {filtros.map((f) => {
            const activo = filtro === f.valor;
            const total = f.valor === "todas" ? campaigns.length : f.valor === "proximas" ? proximasAFinalizar.length : count(f.valor);
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
        {campaigns.length > 0 && (
          <div className="w-full shrink-0 sm:w-[220px] md:w-[220px]">
            <label className="sr-only" htmlFor="orden-de-avance">
              Ordenar campañas
            </label>
            <select
              id="orden-de-avance"
              value={ordenDeAvance}
              onChange={(e) => setOrdenDeAvance(e.target.value as "" | "mayor" | "menor")}
              className="min-h-[38px] w-full rounded border border-system-300 bg-white px-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600"
            >
              <option value="">Más recientes</option>
              <option value="mayor">Mayor avance</option>
              <option value="menor">Menor avance</option>
            </select>
          </div>
        )}
      </div>

      <div className="mb-3 flex justify-end">
        {botonCambiarVista("")}
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
        <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">
          {filtro === "proximas" ? "No tienes campañas próximas a finalizar." : "No tienes campañas en este estado."}
        </p>
      ) : (
        <div className={vistaCuadricula ? "grid grid-cols-2 gap-2 sm:gap-3" : "flex flex-col gap-2.5 sm:gap-3"}>
          {visibles.map((campaign) => {
            const pct = porcentajeDeMeta(campaign.approvedContributions, campaign.goalContributions);
            const puedeFinalizar = campaign.status === "activa" || campaign.status === "pausada";
            const puedeVerAportesYPanel = ["activa", "pausada", "finalizada"].includes(campaign.status);
            const cambiando = cambiandoId === campaign.id;

            return (
              // La lista compacta su altura al contenido en escritorio amplio; en móvil las
              // acciones se apilan para conservar el ancho y la cuadrícula mantiene su distribución.
              // Toda la tarjeta abre el detalle y las acciones quedan encima del enlace.
              <div
                key={campaign.id}
                className={
                  vistaCuadricula
                    ? "relative flex h-full min-w-0 cursor-pointer flex-col rounded-lg border border-system-200 bg-white p-3 transition-colors hover:border-brand-600 max-md:p-2.5"
                    : "relative flex min-w-0 cursor-pointer flex-col rounded-lg border border-system-200 bg-white p-4 transition-colors hover:border-brand-600 max-md:p-3 md:min-h-[190px] md:grid md:grid-cols-[minmax(0,1.35fr)_minmax(260px,1fr)_auto] md:grid-rows-[56px_minmax(0,1fr)] md:items-stretch md:gap-x-5 md:overflow-hidden lg:h-auto lg:min-h-0 lg:grid-rows-[auto_auto] lg:overflow-visible xl:min-h-[160px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-rows-[56px_minmax(0,1fr)] xl:gap-x-0"
                }
              >
                <Link
                  href={`/mis-campanas/${campaign.id}`}
                  aria-label={`Ver la información de ${campaign.name}`}
                  className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                />
                <div className={vistaCuadricula ? "mb-1 flex items-start justify-between gap-2 max-md:h-12 max-md:shrink-0 max-md:overflow-hidden" : "relative mb-1 flex min-w-0 items-center justify-between gap-2 max-md:min-h-8 max-md:shrink-0 md:col-start-1 md:row-start-1 md:mb-0 md:h-[56px] md:min-w-0 md:content-center md:overflow-hidden xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-x-3"}>
                  <div className={vistaCuadricula ? "contents" : "flex min-w-0 flex-1 items-center gap-2"}>
                    <p className={`line-clamp-2 min-w-0 break-words font-medium leading-4 text-system-900 ${vistaCuadricula ? "text-[12px] max-md:text-[11.5px]" : "text-[13.5px] max-md:flex-1 max-md:truncate max-md:whitespace-nowrap max-md:text-[13px] md:w-auto md:shrink xl:w-[140px] xl:shrink-0"}`} title={campaign.name}>
                      {campaign.name}
                    </p>
                    {campaign.especial && campaign.especial.etapa !== "terminada" && <Tag tone="warn">Especial ×{campaign.especial.multiplicador}</Tag>}
                  </div>
                  {/* Mismos colores que el panel (ETIQUETA_DE_CAMPANA, 2026-10-22): aceptada y activa en verde, rechazada en rojo, borrador en gris. */}
                  <span className={vistaCuadricula
                    ? "md:flex md:h-full md:w-[160px] md:shrink-0 md:items-center md:justify-center"
                    : "xl:absolute xl:inset-y-0 xl:left-[130px] xl:right-0 xl:flex xl:items-center xl:justify-center"
                  }>
                    <Tag tone={ETIQUETA_DE_CAMPANA[campaign.status]?.tono ?? "default"} className="whitespace-nowrap">
                      {campaign.status === "aceptada" ? "Campaña aceptada" : labels[campaign.status]}
                    </Tag>
                  </span>
                </div>
                <RutaDeTematica tematica={campaign.tematica || campaign.tag} className={vistaCuadricula ? "mb-1.5 text-[10.5px] max-md:mb-1 max-md:text-[10px]" : "mb-2 md:col-start-1 md:row-start-2 md:mb-0 md:max-h-full md:overflow-hidden"} />
                <div className={vistaCuadricula ? "min-w-0" : "min-h-0 min-w-0 md:col-start-2 md:row-span-2 md:row-start-1 md:max-h-full md:overflow-hidden md:border-l md:border-system-100 md:pl-5"}>
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
                    <p className={`${vistaCuadricula ? "mb-2 font-mono text-[10px] max-md:mb-1.5 max-md:text-[9px]" : "mb-2.5 font-mono text-[11.5px] max-md:text-[10.5px]"} max-md:truncate text-system-600`}>
                      {campaign.startDate ? fechaDDMMAAAA(campaign.startDate) : "Sin fecha"} al{" "}
                      {campaign.endDate ? fechaDDMMAAAA(campaign.endDate) : "Sin fecha"}
                    </p>
                    {/* En revisión no hay barra ni cifras (2026-11-01, a pedido del usuario): todavía no recibe aportes. */}
                    {!sinAportesTodavia(campaign.status) && (
                      <>
                        <ProgressBar pct={pct} tone={campaign.status === "finalizada" ? "ok" : "accent"} conPorcentaje />
                        <p className={`${vistaCuadricula ? "my-2 font-mono text-[10px] max-md:my-1.5 max-md:text-[9px]" : "my-2.5 font-mono text-[12px] max-md:text-[11px]"} text-system-600 max-md:line-clamp-2 max-md:overflow-hidden`}>
                          {campaign.approvedContributions} / {campaign.goalContributions} aprobados · {campaign.pendingContributions} aportes pendientes
                          {campaign.especial && <> · {textoDelPeriodo(campaign.especial)}</>}
                        </p>
                      </>
                    )}
                    {campaign.especial && (
                      <p className={`${vistaCuadricula ? "-mt-1 mb-2 text-[10px] max-md:text-[9px]" : "-mt-1 mb-2.5 line-clamp-2 text-[12px] max-md:text-[11px]"} text-system-600 max-md:line-clamp-1 max-md:overflow-hidden`}>{resumenDeIncentivos(campaign.especial)}</p>
                    )}
                  </>
                )}
                {campaign.status === "pausada" && campaign.pausa?.por === "supervision" ? (
                  <div className="mb-2.5 rounded-lg border border-warning-200 bg-warning-50 p-2.5 text-[11.5px] text-system-900 max-md:max-h-[76px] max-md:overflow-hidden">
                    <p className="font-semibold">La supervisión pausó esta campaña</p>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-line break-words text-system-600">Motivo: {campaign.pausa.motivo || "sin motivo registrado"}</p>
                    <p className="mt-0.5 text-system-600">{campaign.pausa.ajustesEn ? "Guardaste ajustes: la supervisión decidirá si la reanuda." : "Haz los ajustes en Editar: solo la supervisión puede reanudarla."}</p>
                  </div>
                ) : campaign.status === "pausada" && (
                  <p className="mb-2.5 line-clamp-2 text-[11.5px] text-system-600">Pausada: no recibe aportes ni aparece en Campañas hasta que la reanudes.</p>
                )}
                {campaign.datosAbiertos && (
                  <p className="mb-2.5 line-clamp-2 text-[11.5px] text-system-600">{textoDeDatosAbiertos(campaign.datosAbiertos)}</p>
                )}
                {/* Las campañas activas, pausadas y finalizadas conservan acceso
                    a sus aportes y panel para consultar la información recopilada. */}
                </div>
                <div className={vistaCuadricula ? "relative z-10 mt-auto flex flex-nowrap items-center justify-between gap-1 border-t border-system-100 pt-2.5 max-lg:mt-auto max-lg:flex-col max-lg:items-stretch max-lg:gap-2 max-lg:pt-2 lg:flex-row lg:items-center lg:gap-1" : "relative z-10 mt-4 flex flex-nowrap items-center gap-1.5 border-t border-system-100 pt-3 max-md:mt-2 max-md:shrink-0 max-md:flex-col max-md:items-stretch max-md:gap-2 max-md:pt-2 md:col-start-3 md:row-span-2 md:row-start-1 md:my-0 md:flex-col md:items-end md:gap-2 md:self-center md:border-l md:border-t-0 md:pl-5"}>
                  <div className={vistaCuadricula ? "flex min-w-0 flex-nowrap items-center gap-0.5 overflow-visible max-lg:w-full max-lg:flex-col max-lg:items-stretch max-lg:gap-1 lg:w-auto lg:flex-row lg:items-center lg:gap-0.5" : "flex items-center gap-1.5 md:order-2 max-md:w-full max-md:flex-col max-md:items-stretch max-md:gap-2"}>
                  {campaign.status === "rechazada" ? (
                    <ButtonLink href={`/mis-campanas/nueva?edit=${campaign.id}`} variant="primary" size="sm" className={vistaCuadricula ? "whitespace-nowrap max-md:px-1 max-md:py-1 max-md:text-[10px] max-lg:w-full lg:w-auto" : "max-md:w-full max-md:justify-center"}>
                      Corregir y reenviar
                    </ButtonLink>
                  ) : campaign.status === "aceptada" ? (
                    <Button variant="primary" size="sm" className={vistaCuadricula ? "min-w-0 whitespace-nowrap max-md:px-0.5 max-md:py-1 max-md:text-[8px] max-lg:w-full lg:w-auto" : "max-md:w-full max-md:justify-center"} onClick={() => setPorActivar(campaign)} disabled={cambiando}>
                      Activar campaña
                    </Button>
                  ) : puedeVerAportesYPanel ? (
                    <ButtonLink href={`/mis-campanas/${campaign.id}/aportes`} variant="primary" size="sm" aria-label={`Revisar aportes de ${campaign.name}`} className={vistaCuadricula ? "min-w-0 whitespace-nowrap max-md:px-0.5 max-md:py-1 max-md:text-[8px] max-lg:w-full lg:w-auto" : "md:w-[190px] md:whitespace-nowrap md:justify-center max-md:w-full max-md:justify-center"}>
                      {vistaCuadricula ? <><span className="max-md:hidden">Revisar aportes</span><span className="md:hidden">Aportes</span></> : "Revisar aportes"}
                      {campaign.pendingContributions > 0 && <span className="font-mono">({campaign.pendingContributions})</span>}
                    </ButtonLink>
                  ) : null}
                  {puedeVerAportesYPanel && (
                    <ButtonLink href={`/mis-campanas/${campaign.id}/panel`} size="sm" className={vistaCuadricula ? "min-w-0 whitespace-nowrap max-md:px-0.5 max-md:py-1 max-md:text-[8px] max-lg:w-full lg:w-auto" : "max-md:w-full max-md:justify-center"}>Panel</ButtonLink>
                  )}
                  </div>
                  <div className={`hidden w-fit items-center gap-1 rounded-lg border border-system-200 bg-system-50 p-1 md:flex ${vistaCuadricula ? "ml-auto md:w-full md:justify-end lg:w-fit lg:justify-start md:order-2" : "md:order-1"}`}>
                  {campaign.status === "activa" && (
                    <Button type="button" variant="secondary" size="sm" className="!size-9 !rounded-md !p-0" aria-label={`Compartir ${campaign.name}`} title="Compartir" onClick={() => setPorCompartir(campaign)}>
                      <IconoDeAccion tipo="compartir" />
                    </Button>
                  )}
                  {campaign.status === "activa" ? (
                    <Button type="button" variant="secondary" size="sm" className="!size-9 !rounded-md !p-0" aria-label={`Editar ${campaign.name}`} title="Editar y enviar a revisión" onClick={() => setPorEditar(campaign)} disabled={cambiando}>
                      <IconoDeAccion tipo="editar" />
                    </Button>
                  ) : (
                    <ButtonLink href={`/mis-campanas/nueva?edit=${campaign.id}`} variant="secondary" size="sm" className="!size-9 !rounded-md !p-0" aria-label={`Editar ${campaign.name}`} title={"Editar"}>
                      <IconoDeAccion tipo="editar" />
                    </ButtonLink>
                  )}
                  {campaign.status === "activa" && (
                    <Button type="button" variant="secondary" size="sm" className="!size-9 !rounded-md !p-0" aria-label={`Pausar ${campaign.name}`} title="Pausar campaña" onClick={() => setPorPausar(campaign)} disabled={cambiando}>
                      <IconoDeAccion tipo="pausar" />
                    </Button>
                  )}
                  {campaign.status === "pausada" && campaign.pausa?.por !== "supervision" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="!size-9 !rounded-md !p-0"
                      aria-label={inicioEnElFuturo(campaign.startDate, campaign.startTime) ? `Activar ${campaign.name}` : `Reanudar ${campaign.name}`}
                      title={inicioEnElFuturo(campaign.startDate, campaign.startTime) ? "Activar campaña" : "Reanudar campaña"}
                      // Con el inicio movido al futuro (2026-11-01): "Activar campaña" abre la misma ventana que la aceptada.
                      onClick={() => (inicioEnElFuturo(campaign.startDate, campaign.startTime) ? setPorActivar(campaign) : void cambiarEstado(campaign.id, "activa"))}
                      disabled={cambiando}
                    >
                      <IconoDeAccion tipo="reanudar" />
                    </Button>
                  )}
                  {puedeFinalizar && (
                    <Button type="button" variant="danger" size="sm" className="!size-9 !rounded-md !p-0" aria-label={`Finalizar ${campaign.name}`} title="Finalizar campaña" onClick={() => setPorFinalizar(campaign)} disabled={cambiando}>
                      <IconoDeAccion tipo="finalizar" />
                    </Button>
                  )}
                  {campaign.canDelete && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="!size-9 !rounded-md !p-0"
                      aria-label={`Eliminar campaña ${campaign.name}`}
                      title="Eliminar campaña"
                      onClick={() => {
                        setNombreParaEliminar("");
                        setPorEliminar(campaign);
                      }}
                      disabled={cambiando}
                    >
                      <IconoDeAccion tipo="eliminar" />
                    </Button>
                  )}
                  </div>
                  <div className="flex w-full shrink-0 justify-start md:hidden">
                    <MenuDeAcciones
                      className={`w-full [&>button]:w-full ${vistaCuadricula ? "" : "[&>button]:!px-3.5 [&>button]:!py-2 [&>button]:!text-[12.5px] [&>button]:!justify-center"}`}
                      compacto={vistaCuadricula}
                      texto="Más"
                      etiqueta={`Más acciones de ${campaign.name}`}
                      opciones={[
                        ...(campaign.status === "activa"
                          ? [{ etiqueta: "Compartir", alElegir: () => setPorCompartir(campaign) }]
                          : []),
                        campaign.status === "activa"
                          ? { etiqueta: "Editar", alElegir: () => setPorEditar(campaign), deshabilitado: cambiando }
                          : { etiqueta: "Editar", href: `/mis-campanas/nueva?edit=${campaign.id}` },
                        ...(campaign.status === "activa"
                          ? [{ etiqueta: "Pausar campaña", alElegir: () => setPorPausar(campaign), deshabilitado: cambiando }]
                          : []),
                        ...(campaign.status === "pausada" && campaign.pausa?.por !== "supervision"
                          ? [
                              {
                                etiqueta: inicioEnElFuturo(campaign.startDate, campaign.startTime) ? "Activar campaña" : "Reanudar campaña",
                                alElegir: () => (inicioEnElFuturo(campaign.startDate, campaign.startTime) ? setPorActivar(campaign) : void cambiarEstado(campaign.id, "activa")),
                                deshabilitado: cambiando,
                              },
                            ]
                          : []),
                        ...(puedeFinalizar
                          ? [{ etiqueta: "Finalizar campaña", alElegir: () => setPorFinalizar(campaign), peligro: true, deshabilitado: cambiando }]
                          : []),
                        ...(campaign.canDelete
                          ? [
                              {
                                etiqueta: "Eliminar",
                                alElegir: () => {
                                  setNombreParaEliminar("");
                                  setPorEliminar(campaign);
                                },
                                peligro: true,
                                deshabilitado: cambiando,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                  {/* <MenuDeAcciones className="hidden"
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
                              ? { etiqueta: "Activar campaña", alElegir: () => setPorActivar(campaign), deshabilitado: cambiando }
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
                  /> */}
                </div>
                {cambioError[campaign.id] && (
                  <p role="alert" className="mt-2 text-[11.5px] text-error-700 max-md:absolute max-md:bottom-1 max-md:left-3 max-md:right-3 max-md:z-20 max-md:line-clamp-1 max-md:bg-white md:absolute md:bottom-1 md:left-4 md:right-4 md:z-20 md:mt-0 md:truncate md:bg-white">{cambioError[campaign.id]}</p>
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
          lugar={textoDeUbicacion({ todoElPais: porCompartir.todoElPais, municipio: porCompartir.locationCity, estado: porCompartir.locationState })}
          fechaFin={porCompartir.endDate}
          banner={porCompartir.hasBanner ? `/api/campanas/${porCompartir.id}/banner/vista-previa?v=${encodeURIComponent(porCompartir.bannerVersion ?? "")}` : null}
          abierto
          onCerrar={() => setPorCompartir(null)}
        />
      )}

      <VentanaDeConfirmacion
        abierto={porEditar !== null}
        titulo="¿Pausar la campaña para editarla?"
        textoConfirmar="Pausar y editar"
        textoOcupado="Pausando…"
        ocupado={porEditar !== null && cambiandoId === porEditar.id}
        confirmarDeshabilitado={colaDeRevisionLlena}
        textoCancelar="Volver"
        onCancelar={() => setPorEditar(null)}
        onConfirmar={() => {
          if (porEditar) void pausarYEditar(porEditar);
        }}
      >
        {porEditar && <p className="mb-3 font-semibold text-system-900">{porEditar.name}</p>}
        {colaDeRevisionLlena ? (
          <p role="alert" className="rounded-lg bg-warning-50 p-3 text-warning-800">
            Ya tienes {MAX_CAMPANAS_EN_REVISION} campañas en revisión: si la pausas ahora no podrás enviar los cambios. Espera a que la supervisión acepte o rechace alguna. Mientras tanto, la campaña sigue activa y recibiendo aportes.
          </p>
        ) : (
          <p>La campaña dejará de recibir aportes mientras haces los cambios. Al guardar, pasará a En revisión para que la supervisión revise la versión actualizada.</p>
        )}
        {porEditar && cambioError[porEditar.id] && <p role="alert" className="mt-3 text-error-700">{cambioError[porEditar.id]}</p>}
      </VentanaDeConfirmacion>

      <VentanaDeConfirmacion
        abierto={porPausar !== null}
        titulo="¿Pausar esta campaña?"
        textoConfirmar="Pausar campaña"
        textoOcupado="Pausando…"
        ocupado={porPausar !== null && cambiandoId === porPausar.id}
        textoCancelar="Volver"
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
        abierto={porActivar !== null}
        titulo="¿Activar esta campaña?"
        textoConfirmar="Activar campaña"
        textoOcupado="Activando…"
        ocupado={porActivar !== null && cambiandoId === porActivar.id}
        onCancelar={() => setPorActivar(null)}
        onConfirmar={() => {
          if (porActivar) void activarCampana(porActivar);
        }}
      >
        {porActivar && <p className="mb-3 font-semibold text-system-900">{porActivar.name}</p>}
        <p>
          {porActivar && inicioEnElFuturo(porActivar.startDate, porActivar.startTime)
            ? `${porActivar.status === "pausada" ? "Está pausada y empieza" : "Iba a empezar"} el ${porActivar.startDate ? fechaDDMMAAAA(porActivar.startDate) : "día de inicio"}${porActivar.startTime ? ` a las ${porActivar.startTime.slice(0, 5)}` : ""}: si la activas ahora, empieza hoy y su fecha de inicio cambia a hoy. ${porActivar.status === "pausada" ? "Si prefieres esperar, déjala programada y se activará sola ese día." : "Si no haces nada, se activará sola ese día."}`
            : "Empezará a recibir aportes en cuanto la actives y aparecerá en Campañas para que la gente participe."}
        </p>
        {/* La pausada no se activa sola: aquí se programa para su fecha de inicio (vuelve a "aceptada"). */}
        {porActivar?.status === "pausada" && inicioEnElFuturo(porActivar.startDate, porActivar.startTime) && (
          <button
            type="button"
            className="mt-3 text-base font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-800 disabled:opacity-50"
            disabled={cambiandoId === porActivar.id}
            onClick={() => {
              const campana = porActivar;
              void cambiarEstado(campana.id, "aceptada").then((ok) => {
                if (ok) setPorActivar((actual) => (actual?.id === campana.id ? null : actual));
              });
            }}
          >
            Dejarla programada para el {porActivar.startDate ? fechaDDMMAAAA(porActivar.startDate) : "día de inicio"}
          </button>
        )}
        {porActivar && cambioError[porActivar.id] && (
          <p role="alert" className="mt-3 text-error-700">{cambioError[porActivar.id]}</p>
        )}
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
          <li>La supervisión decidirá si sus aportes aprobados se publican en Datos abiertos.</li>
        </ul>
        <p className="mt-3">Para volver a abrirla tendrás que editarla y ponerle una fecha de cierre nueva.</p>
      </VentanaDeConfirmacion>

      <VentanaDeConfirmacion
        abierto={porEliminar !== null}
        titulo="¿Eliminar esta campaña?"
        textoConfirmar="Eliminar campaña"
        textoOcupado="Eliminando…"
        peligro
        ocupado={porEliminar !== null && cambiandoId === porEliminar.id}
        confirmarDeshabilitado={porEliminar !== null && !mismoNombre(nombreParaEliminar, porEliminar.name)}
        onCancelar={() => setPorEliminar(null)}
        onConfirmar={() => {
          if (!porEliminar) return;
          void eliminarCampana(porEliminar);
        }}
      >
        {porEliminar && <p className="mb-3 font-semibold text-system-900">{porEliminar.name}</p>}
        <p>Advertencia: la campaña se eliminará permanentemente y no se podrá recuperar.</p>
        {porEliminar && porEliminar.currentContributions > 0 && (
          <p className="mt-2 rounded border border-error-700 bg-error-50 p-2.5 text-error-700">
            Tiene {porEliminar.currentContributions} {porEliminar.currentContributions === 1 ? "aporte" : "aportes"} en revisión: se
            borrarán junto con sus archivos y quienes aportaron recibirán un aviso.
          </p>
        )}
        {/* Siempre se escribe el nombre para confirmar, tenga aportes o no (2026-10-31, a pedido del usuario). */}
        <label className="mt-3 block text-[15px] text-system-600">
          Para confirmar, escribe el nombre de la campaña:
          <input
            type="text"
            value={nombreParaEliminar}
            onChange={(e) => setNombreParaEliminar(e.target.value)}
            autoComplete="off"
            className="mt-1.5 w-full rounded border border-system-300 bg-white px-3 py-2 text-[15px] text-system-900 outline-none focus:border-brand-600"
          />
        </label>
        {porEliminar && cambioError[porEliminar.id] && (
          <p role="alert" className="mt-3 text-error-700">{cambioError[porEliminar.id]}</p>
        )}
      </VentanaDeConfirmacion>

    </div>
  );
}

/** En revisión o rechazada todavía no recibe aportes: sin "Revisar aportes" ni "Panel" (2026-11-01). */
function sinAportesTodavia(estado: string) {
  return estado === "en_revision" || estado === "rechazada";
}
