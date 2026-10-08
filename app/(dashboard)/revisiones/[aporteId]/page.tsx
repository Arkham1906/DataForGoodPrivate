"use client";

// Pantalla /revisiones/[aporteId]: revisar un aporte como revisor.
// Componente cliente. Datos: GET /api/aportes/[id].
// Acciones: aceptar o rechazar (con motivo) con PATCH /api/aportes/[id] { status, rejectionReason, inapropiado? }.
// La decisión del revisor es final, igual que la del creador (dominio.md § 5).
// Aporte anónimo sin decisión: "Contenido inapropiado" al rechazar o "Marcar como inapropiado" sin decidir
// (POST /api/aportes/[id]/inapropiado). Banear, bloquear o borrar archivos es solo del creador.
// "Reportar al creador" (POST /api/aportes/[id]/reportar, con motivo): avisa al creador para que decida
// si banea a quien lo envió. Uno por aporte, antes o después de decidirlo.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Input";
import Tag from "@/components/ui/Tag";
import type { Contribution } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { formatearTamano } from "@/lib/aportes/archivo";
import { MAXIMO_MOTIVO_DE_REPORTE, MOTIVOS_DE_RECHAZO, MOTIVOS_DE_REPORTE } from "@/lib/aportes/motivos-de-rechazo";
import PantallaEsqueleto from "@/components/ui/Esqueletos";

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Sin revisar",
  espera_final: "Sin revisar",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};

export default function RevisionAportePage() {
  const { aporteId } = useParams<{ aporteId: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Contribution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [motivoPropio, setMotivoPropio] = useState("");
  const [reportando, setReportando] = useState(false);
  const [motivoDeReporte, setMotivoDeReporte] = useState("");
  const [detalleDeReporte, setDetalleDeReporte] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [inapropiado, setInapropiado] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${BASE_PATH}/api/aportes/${aporteId}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar el aporte");
        setItem(payload.data as Contribution);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el aporte");
      }
    }

    void load();
  }, [aporteId]);

  async function decidir(status: "aceptado" | "rechazado", rejectionReason?: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/aportes/${aporteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason, ...(status === "rechazado" && inapropiado ? { inapropiado: true } : {}) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar la decisión");
      router.push("/revisiones");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la decisión");
      setSubmitting(false);
    }
  }

  async function confirmarReporte(e: React.FormEvent) {
    e.preventDefault();
    // Motivo de la lista y, si se escribió, el detalle: "Contenido ofensivo... — Insultos en la descripción".
    const motivoCompleto = [motivoDeReporte, detalleDeReporte.trim()].filter(Boolean).join(" — ");
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/aportes/${aporteId}/reportar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoCompleto }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo enviar el reporte");
      setItem((actual) =>
        actual ? { ...actual, reporte: { motivo: motivoCompleto, revisor: "Tú", en: new Date().toISOString() } } : actual
      );
      setReportando(false);
      setAviso(payload.message ?? "Aviso enviado a quien creó la campaña");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el reporte");
    } finally {
      setSubmitting(false);
    }
  }

  async function marcarInapropiado() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/aportes/${aporteId}/inapropiado`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo marcar el aporte");
      setItem((actual) => (actual ? { ...actual, inapropiado: true } : actual));
      setAviso(payload.message ?? "Marcado como inapropiado");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo marcar el aporte");
    } finally {
      setSubmitting(false);
    }
  }

  function confirmarRechazo(e: React.FormEvent) {
    e.preventDefault();
    void decidir("rechazado", motivoPropio.trim() || motivo);
  }

  if (error && !item) {
    return <p className="mx-auto max-w-3xl text-sm text-error-700">{error}</p>;
  }

  if (!item) {
    return <PantallaEsqueleto tipo="detalle" etiqueta="Cargando aporte…" className="mx-auto max-w-3xl" />;
  }

  const yaDecidido = item.status === "aceptado" || item.status === "rechazado";
  const puedeRechazar = Boolean(motivo) || motivoPropio.trim().length > 0;
  const puedeReportar =
    (Boolean(motivoDeReporte) || detalleDeReporte.trim().length > 0) &&
    motivoDeReporte.length + detalleDeReporte.trim().length + 3 <= MAXIMO_MOTIVO_DE_REPORTE;
  const statusTone = item.status === "aceptado" ? "ok" : item.status === "rechazado" ? "danger" : "warn";
  const submittedAt = new Date(item.submittedAt);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/revisiones" className="mb-5 inline-block text-[13px] text-system-600 hover:text-system-900">
        ← Volver a revisiones
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Revisor de aportes</p>
          <h1 className="mt-2 text-2xl font-extrabold text-system-900">Vista previa del aporte</h1>
          <p className="mt-1 text-[13px] text-system-600">Revisa el contenido y decide si se acepta o se rechaza.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {item.inapropiado && <Tag tone="danger">Contenido inapropiado</Tag>}
          <Tag tone={statusTone}>{STATUS_LABELS[item.status] ?? item.status}</Tag>
        </div>
      </div>

      {error && <p className="mb-4 rounded border border-error-700 bg-error-50 p-3 text-[12.5px] text-error-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
        <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[12.5px] font-semibold text-system-900">Archivo enviado</p>
          {item.archivoBorrado ? (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-[12.5px] text-system-400">
              El creador borró este archivo
            </div>
          ) : item.fileType === "foto" ? (
            <img
              src={`${BASE_PATH}/api/aportes/${item.id}/archivo`}
              alt={`Vista previa del aporte de ${item.participantName}`}
              className="aspect-video w-full rounded-lg border border-system-300 bg-system-100 object-contain"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-[12.5px] text-system-400">
              Vista previa no disponible para {item.fileType}
            </div>
          )}
          <p className="mt-3 font-mono text-[11.5px] text-system-400">
            {item.fileType} {item.fileSizeBytes ? `· ${formatearTamano(item.fileSizeBytes)}` : ""}
          </p>
        </section>

        <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-system-900">Datos del aporte</h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-system-400">Participante</p>
              <p className="mt-1 text-sm font-semibold text-system-900">{item.participantName}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-system-400">Descripción</p>
              <p className="mt-1 text-sm leading-relaxed text-system-600">{item.description}</p>
            </div>
            {item.caracteristicas && item.caracteristicas.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-system-400">Características</p>
                <div className="flex flex-wrap gap-2">
                  {item.caracteristicas.map((feature) => <Tag key={feature}>{feature}</Tag>)}
                </div>
              </div>
            )}
            <dl className="space-y-2 border-t border-system-200 pt-4 text-[13px]">
              <div className="flex justify-between gap-4"><dt className="text-system-600">Enviado</dt><dd className="font-mono text-right text-system-900">{submittedAt.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · {submittedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-system-600">Tipo</dt><dd className="text-system-900">{item.fileType}</dd></div>
            </dl>
          </div>
        </section>
      </div>

      {item.status === "rechazado" && item.rejectionReason && (
        <p className="mt-6 rounded border border-error-700 bg-error-50 p-3 text-[12.5px] text-error-700">
          Motivo del rechazo: {item.rejectionReason}
        </p>
      )}

      {rechazando && !yaDecidido && (
        <form onSubmit={confirmarRechazo} className="mt-6 rounded-lg border border-error-700 bg-white p-4">
          <p className="mb-2 text-[13px] font-medium text-system-900">
            Motivo del rechazo <span className="text-error-700">*</span>
          </p>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="mb-2.5 w-full rounded border border-system-300 bg-white px-3 py-2.5 text-[13px] text-system-900 outline-none focus:border-brand-600"
          >
            <option value="">Selecciona un motivo ▾</option>
            {MOTIVOS_DE_RECHAZO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Field label="O redacta el motivo">
            <Textarea
              rows={3}
              value={motivoPropio}
              onChange={(e) => setMotivoPropio(e.target.value)}
              placeholder="Motivo técnico o de contenido"
            />
          </Field>
          {item.userId === null && !item.inapropiado && (
            <label className="mb-3 flex items-start gap-2 text-[12.5px] text-system-900">
              <input type="checkbox" checked={inapropiado} onChange={(e) => setInapropiado(e.target.checked)} className="mt-0.5" />
              <span>
                <span className="font-medium">Contenido inapropiado</span>
                <span className="block text-[11.5px] text-system-400">
                  Úsalo solo si el contenido es ofensivo, ilegal o dañino. Si un mismo dispositivo junta varios, se
                  bloquea en toda la plataforma.
                </span>
              </span>
            </label>
          )}
          <p className="mb-3 text-[11.5px] text-system-400">
            {item.userId === null
              ? "Obligatorio al rechazar. Es un aporte anónimo: queda registrado, pero nadie lo recibe."
              : "Obligatorio al rechazar. El participante lo recibirá en una notificación y lo verá en Mis aportes."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setRechazando(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="danger" type="submit" disabled={!puedeRechazar || submitting}>
              Confirmar rechazo
            </Button>
          </div>
        </form>
      )}

      {aviso && <p className="mt-6 rounded border border-success-700 bg-success-50 p-3 text-[12.5px] text-success-700">{aviso}</p>}

      {item.reporte ? (
        <p className="mt-6 rounded border border-warning-500 bg-warning-50 p-3 text-[12.5px] text-warning-800">
          Reportado a quien creó la campaña · {item.reporte.motivo}
        </p>
      ) : reportando ? (
        <form onSubmit={(e) => void confirmarReporte(e)} className="mt-6 rounded-lg border border-warning-500 bg-white p-4">
          <p className="text-[13px] font-medium text-system-900">
            Reportar al creador <span className="text-error-700">*</span>
          </p>
          <p className="mb-3 mt-1 text-[11.5px] text-system-400">
            Si el contenido es inapropiado o quien lo envió abusa de la campaña, avisa a quien la creó. Tú no
            baneas: banear o bloquear a esa persona es decisión suya.
          </p>
          <select
            value={motivoDeReporte}
            onChange={(e) => setMotivoDeReporte(e.target.value)}
            className="mb-2.5 w-full rounded border border-system-300 bg-white px-3 py-2.5 text-[13px] text-system-900 outline-none focus:border-brand-600"
          >
            <option value="">Selecciona un motivo ▾</option>
            {MOTIVOS_DE_REPORTE.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Field label="Describe lo que viste (opcional si elegiste un motivo)">
            <Textarea
              rows={3}
              maxLength={MAXIMO_MOTIVO_DE_REPORTE}
              value={detalleDeReporte}
              onChange={(e) => setDetalleDeReporte(e.target.value)}
              placeholder="Qué tiene de inapropiado el aporte o qué hace quien lo envió"
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setReportando(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="danger" type="submit" disabled={!puedeReportar || submitting}>
              Enviar reporte
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-system-200 pt-5">
        <p className="max-w-xl text-[12.5px] text-system-600">
          {yaDecidido
            ? "Este aporte ya tiene una decisión."
            : "Tu decisión es final: el aporte queda aceptado o rechazado, sin pasar por quien creó la campaña."}
        </p>
        <div className="flex flex-wrap gap-2">
          {item.userId === null && !item.inapropiado && !yaDecidido && (
            <Button variant="danger" disabled={submitting} onClick={() => void marcarInapropiado()}>
              Marcar como inapropiado
            </Button>
          )}
          {!item.reporte && (
            <Button variant="ghost" disabled={submitting || reportando} onClick={() => setReportando(true)}>
              Reportar al creador
            </Button>
          )}
          {!yaDecidido && (
            <>
              <Button disabled={submitting || rechazando} onClick={() => setRechazando(true)}>
                Rechazar
              </Button>
              <Button variant="primary" disabled={submitting} onClick={() => void decidir("aceptado")}>
                {submitting ? "Guardando..." : "Aceptar aporte"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
