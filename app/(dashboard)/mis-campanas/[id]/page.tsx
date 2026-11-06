"use client";

// Detalle de una campaña propia en /mis-campanas/[id].
// Datos: GET /api/campanas?mine=true; solo el creador ve esta página.
// Presenta la información que antes aparecía en una ventana y conserva los accesos de gestión.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import ProgressBar from "@/components/ui/ProgressBar";
import RutaDeTematica from "@/components/ui/RutaDeTematica";
import Tag from "@/components/ui/Tag";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import { AvisoNoEncontrado } from "@/components/ui/AvisoNoEncontrado";
import { BASE_PATH } from "@/lib/base-path";
import { MAX_CAMPANAS_EN_REVISION } from "@/lib/campanas/cola-de-revision";
import { textoDeDatosAbiertos } from "@/lib/campanas/datos-abiertos";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { textoDelProposito } from "@/lib/campanas/proposito";
import { ETIQUETA_DE_CAMPANA, NOMBRE_DE_TIPO, type TipoDeDato } from "@/lib/campanas/sistema-opciones";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { resumenDeIncentivos, textoDelPeriodo } from "@/lib/campanas/especial-reglas";
import { fechaDDMMAAAA, ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import type { Campaign, CampaignStatus } from "@/types";

type CampanaPropia = Campaign & { canDelete?: boolean };

const nf = new Intl.NumberFormat("es-MX");
const fechaDeRechazo = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: ZONA_DE_CAMPANAS,
});

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-system-500">{titulo}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-system-900">{children}</dd>
    </div>
  );
}

function sinAportesTodavia(estado: CampaignStatus) {
  return estado === "en_revision" || estado === "rechazada";
}

function fechaYHora(fecha: string | null | undefined, hora: string | null | undefined) {
  if (!fecha) return "Sin fecha";
  return `${fechaDDMMAAAA(fecha)}${hora ? ` a las ${hora.slice(0, 5)}` : ""}`;
}

export default function DetalleDeMisCampanasPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campana, setCampana] = useState<CampanaPropia | null>(null);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDeEdicion, setErrorDeEdicion] = useState<string | null>(null);
  const [confirmarEdicion, setConfirmarEdicion] = useState(false);
  const [editando, setEditando] = useState(false);
  // Con la cola de revisión llena no se pausa para editar: no podría enviar los cambios (2026-11-04).
  const [colaLlena, setColaLlena] = useState(false);
  const recarga = useRecargaEnVivo();

  useEffect(() => {
    let activa = true;

    async function cargarCampana() {
      try {
        const response = await fetch(`${BASE_PATH}/api/campanas?mine=true`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar la campaña");
        if (!activa) return;

        const propia = Array.isArray(payload.data)
          ? payload.data.find((item: unknown) =>
              typeof item === "object" && item !== null && "id" in item && String(item.id) === id
            )
          : undefined;
        if (!propia) {
          setNoEncontrada(true);
          return;
        }
        setCampana(propia as CampanaPropia);
        const enRevision = (payload.data as { status?: string }[]).filter((item) => item.status === "en_revision").length;
        setColaLlena(enRevision >= MAX_CAMPANAS_EN_REVISION);
        setError(null);
      } catch (cause) {
        if (activa) setError(cause instanceof Error ? cause.message : "No se pudo cargar la campaña");
      }
    }

    if (id) void cargarCampana();
    return () => {
      activa = false;
    };
  }, [id, recarga]);

  async function pausarYEditar() {
    if (!campana || editando) return;
    setEditando(true);
    setErrorDeEdicion(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${encodeURIComponent(campana.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pausada" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo pausar la campaña");
      router.push(`/mis-campanas/nueva?edit=${encodeURIComponent(campana.id)}&restaurar=activa`);
    } catch (cause) {
      setErrorDeEdicion(cause instanceof Error ? cause.message : "No se pudo pausar la campaña");
    } finally {
      setEditando(false);
    }
  }

  if (noEncontrada) return <AvisoNoEncontrado volverA="/mis-campanas" textoVolver="Volver a Mis campañas" />;
  if (error) return <p role="alert" className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p>;
  if (!campana) return <PantallaEsqueleto tipo="detalle" etiqueta="Cargando tu campaña…" />;

  const estado = ETIQUETA_DE_CAMPANA[campana.status];
  const pct = porcentajeDeMeta(campana.approvedContributions, campana.goalContributions);
  const lugar = textoDeUbicacion(
    {
      todoElPais: campana.todoElPais,
      estado: campana.locationState,
      municipio: campana.locationCity,
      colonia: campana.locationColonia,
    },
    "Sin definir",
  );
  const tipos = campana.dataTypes.map((tipo) => NOMBRE_DE_TIPO[tipo as TipoDeDato] ?? tipo).join(", ") || "Sin definir";
  const secciones = (campana.checklistSecciones ?? []).filter((seccion) => seccion.opciones.length > 0);
  const sinAportes = sinAportesTodavia(campana.status);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/mis-campanas" className="mb-4 inline-block text-[13px] text-system-600 hover:text-system-900">
        ← Volver a Mis campañas
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {estado && <Tag tone={estado.tono}>{estado.texto}</Tag>}
            {campana.especial && campana.especial.etapa !== "terminada" && (
              <Tag tone="warn">★ Especial ×{campana.especial.multiplicador}</Tag>
            )}
          </div>
          <h1 className="break-words text-2xl font-extrabold text-system-900">{campana.name}</h1>
          <RutaDeTematica tematica={campana.tematica || campana.tag} etiquetas={campana.etiquetas} className="mt-2" />
        </div>
      </div>

      {campana.status === "aceptada" && (
        <div className="mb-5 rounded-lg border border-success-700 bg-success-50 p-3 text-[12.5px] text-system-900">
          <p className="font-semibold">La supervisión aprobó tu campaña</p>
          <p className="mt-1 text-system-600">
            Se activará sola el {campana.startDate ? fechaDDMMAAAA(campana.startDate) : "día de inicio"}
            {campana.startTime ? ` a las ${campana.startTime.slice(0, 5)}` : ""}. Si quieres empezar antes, actívala ahora.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <section className="rounded-lg border border-system-200 bg-white p-5 max-md:p-4">
          <h2 className="mb-2 text-[15px] font-bold text-system-900">Descripción</h2>
          <p className="whitespace-pre-line break-words text-[13.5px] leading-relaxed text-system-600">
            {campana.description || "Sin descripción"}
          </p>
        </section>

        {!sinAportes && (
          <section className="rounded-lg border border-system-200 bg-white p-5 max-md:p-4">
            <h2 className="mb-3 text-[15px] font-bold text-system-900">Avance de la campaña</h2>
            <ProgressBar pct={pct} tone="ok" />
            <p className="mt-2 font-mono text-[12px] text-system-600">
              {nf.format(campana.approvedContributions)} de {nf.format(campana.goalContributions)} aportes aprobados · {pct}% de la meta
            </p>
          </section>
        )}

        <section className="rounded-lg border border-system-200 bg-white p-5 max-md:p-4">
          <h2 className="mb-4 text-[15px] font-bold text-system-900">Detalles de la campaña</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Dato titulo="Creador">{campana.creatorName || "Sin especificar"}</Dato>
            <Dato titulo="Organización">{campana.organizer || "Sin organización"}</Dato>
            <Dato titulo="Propósito">{textoDelProposito(campana.proposito, campana.propositoOtro) ?? "Sin definir"}</Dato>
            <Dato titulo="Lugar">{lugar}</Dato>
            <Dato titulo="Inicio">{fechaYHora(campana.startDate, campana.startTime)}</Dato>
            <Dato titulo="Cierre">
              {fechaYHora(campana.endDate, campana.endTime)}
              {campana.daysRemaining != null && campana.status === "activa" && (
                <span className="text-system-500">
                  {" "}· {campana.daysRemaining === 1 ? "queda 1 día" : `quedan ${campana.daysRemaining} días`}
                </span>
              )}
            </Dato>
            <Dato titulo="Tipos de dato">{tipos}</Dato>
            <Dato titulo="Cuota por persona">
              {campana.quotaPerUser > 0
                ? `${nf.format(campana.quotaPerUser)} ${campana.quotaPerUser === 1 ? "aporte" : "aportes"}`
                : "Sin definir"}
            </Dato>
            {!sinAportes && <Dato titulo="Participantes">{nf.format(campana.participants)}</Dato>}
            {campana.especial && (
              <Dato titulo="Campaña especial">
                ×{campana.especial.multiplicador} de XP
                {campana.especial.bono > 0 ? ` + ${nf.format(campana.especial.bono)} XP de bono` : ""}
                {campana.especial.insignia ? ` · insignia «${campana.especial.insignia}»` : ""}
              </Dato>
            )}
          </dl>
        </section>

        {secciones.length > 0 && (
          <section className="rounded-lg border border-system-200 bg-white p-5 max-md:p-4">
            <h2 className="mb-3 text-[15px] font-bold text-system-900">Qué se marca al aportar</h2>
            <div className="flex flex-col gap-3">
              {secciones.map((seccion, index) => (
                <div key={`${seccion.titulo}-${index}`}>
                  <p className="text-[12.5px] font-semibold text-system-900">
                    {seccion.titulo}
                    {seccion.tipo && (
                      <span className="font-normal text-system-500"> · {NOMBRE_DE_TIPO[seccion.tipo as TipoDeDato] ?? seccion.tipo}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-system-600">{seccion.opciones.join(" · ")}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {campana.status !== "en_revision" && (
          <section className="rounded-lg border border-system-200 bg-white p-5 max-md:p-4">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-system-500">Solo para ti, como creador</h2>
            {campana.status === "rechazada" && (
              <div className="mb-4 rounded-lg border border-error-200 bg-error-50 p-3 text-[12.5px]">
                <p className="font-semibold text-error-700">
                  {campana.rechazo?.porSuperUsuario ? "La supervisión" : "Un supervisor"} la rechazó
                  {campana.rechazo && <> el {fechaDeRechazo.format(new Date(campana.rechazo.fecha))}</>}
                  {campana.rechazo?.sancion && <> · se aplicó {campana.rechazo.sancion}</>}
                </p>
                <p className="mt-1 whitespace-pre-line break-words text-system-600">
                  Motivo: {campana.rechazo?.motivo ?? "sin motivo registrado"}
                </p>
              </div>
            )}
            {campana.status === "pausada" && (
              <div className="mb-4 rounded-lg border border-warning-200 bg-warning-50 p-3 text-[12.5px] text-system-900">
                <p className="font-semibold">
                  {campana.pausa?.por === "supervision" ? "La supervisión pausó esta campaña" : "La pausaste tú"}
                </p>
                {campana.pausa?.por === "supervision" && (
                  <>
                    <p className="mt-1 whitespace-pre-line break-words text-system-600">
                      Motivo: {campana.pausa.motivo || "sin motivo registrado"}
                    </p>
                    <p className="mt-1 text-system-600">
                      {campana.pausa.ajustesEn
                        ? "Guardaste ajustes: la supervisión decidirá si la reanuda."
                        : "Haz los ajustes en Editar: solo la supervisión puede reanudarla."}
                    </p>
                  </>
                )}
              </div>
            )}
            {campana.datosAbiertos && (
              <p className="mb-4 whitespace-pre-line break-words text-[12.5px] text-system-600">{textoDeDatosAbiertos(campana.datosAbiertos)}</p>
            )}
            {!sinAportes && (
              <>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { valor: campana.currentContributions, texto: "recibidos" },
                    { valor: campana.pendingContributions, texto: "por revisar" },
                    { valor: campana.approvedContributions, texto: "aprobados" },
                    { valor: campana.rejectedContributions, texto: "rechazados" },
                  ].map((cifra) => (
                    <div key={cifra.texto} className="rounded-lg bg-system-50 p-3 text-center">
                      <dt className="text-[11px] text-system-500">{cifra.texto}</dt>
                      <dd className="font-mono text-[16px] font-bold text-system-900">{nf.format(cifra.valor)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-[12.5px] text-system-600">
                  {campana.hasReviewerAssigned
                    ? "Tiene revisor de aportes asignado."
                    : "Todavía no tiene revisor de aportes: los revisas tú."}
                  {campana.especial && <> {resumenDeIncentivos(campana.especial)} ({textoDelPeriodo(campana.especial)}).</>}
                </p>
              </>
            )}
          </section>
        )}

        <nav
          className="flex flex-col gap-2 border-t border-system-200 pt-4 sm:flex-row sm:flex-wrap sm:justify-end"
          aria-label="Acciones de la campaña"
        >
          {["activa", "pausada", "finalizada"].includes(campana.status) && (
            <ButtonLink href={`/campanas/${campana.id}`} size="sm" className="w-full whitespace-normal text-center sm:w-auto">
              Verla como participante
            </ButtonLink>
          )}
          {campana.status === "activa" ? (
            <Button
              type="button"
              size="sm"
              className="w-full whitespace-normal text-center sm:w-auto"
              onClick={() => { setErrorDeEdicion(null); setConfirmarEdicion(true); }}
            >
              Editar
            </Button>
          ) : (
            <ButtonLink href={`/mis-campanas/nueva?edit=${campana.id}`} size="sm" className="w-full whitespace-normal text-center sm:w-auto">
              Editar
            </ButtonLink>
          )}
          {campana.status === "activa" && (
            <>
              <ButtonLink href={`/mis-campanas/${campana.id}/panel`} size="sm" className="w-full whitespace-normal text-center sm:w-auto">
                Panel
              </ButtonLink>
              <ButtonLink
                href={`/mis-campanas/${campana.id}/aportes`}
                variant="primary"
                size="sm"
                className="w-full whitespace-normal text-center sm:w-auto"
              >
                Revisar aportes{campana.pendingContributions > 0 && <span className="font-mono"> ({campana.pendingContributions})</span>}
              </ButtonLink>
            </>
          )}
          {campana.status === "rechazada" && (
            <ButtonLink
              href={`/mis-campanas/nueva?edit=${campana.id}`}
              variant="primary"
              size="sm"
              className="w-full whitespace-normal text-center sm:w-auto"
            >
              Corregir y reenviar
            </ButtonLink>
          )}
        </nav>
      </div>

      <VentanaDeConfirmacion
        abierto={confirmarEdicion}
        titulo="¿Pausar la campaña para editarla?"
        textoConfirmar="Pausar y editar"
        textoOcupado="Pausando…"
        ocupado={editando}
        confirmarDeshabilitado={colaLlena}
        onCancelar={() => setConfirmarEdicion(false)}
        onConfirmar={() => void pausarYEditar()}
      >
        <p className="mb-3 font-semibold text-system-900">{campana.name}</p>
        {colaLlena ? (
          <p role="alert" className="rounded-lg bg-warning-50 p-3 text-warning-800">
            Ya tienes {MAX_CAMPANAS_EN_REVISION} campañas en revisión: si la pausas ahora no podrás enviar los cambios. Espera a que la supervisión acepte o rechace alguna. Mientras tanto, la campaña sigue activa y recibiendo aportes.
          </p>
        ) : (
          <p>La campaña dejará de recibir aportes mientras haces los cambios. Al guardar, pasará a En revisión para que la supervisión revise la versión actualizada.</p>
        )}
        {errorDeEdicion && <p role="alert" className="mt-3 text-error-700">{errorDeEdicion}</p>}
      </VentanaDeConfirmacion>
    </div>
  );
}
