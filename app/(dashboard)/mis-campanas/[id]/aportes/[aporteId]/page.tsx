"use client";

// Pantalla /mis-campanas/[id]/aportes/[aporteId]: detalle de un aporte para el creador.
// Componente cliente. Datos: GET /api/aportes/[id]; imagen desde GET /api/aportes/[id]/archivo.
// Acciones: aceptar/rechazar con PATCH /api/aportes/[id] { status, rejectionReason, inapropiado };
// banear o desbanear al participante con POST/DELETE /api/campanas/[id]/baneos.
// Aporte anónimo (sin cuenta): "Contenido inapropiado" al rechazar, bloquear su dispositivo
// en la campaña (misma API de baneos) y borrar el archivo (DELETE /api/aportes/[id]/archivo).
// Si un revisor lo reportó ("Reportar al creador"), se muestra su motivo arriba.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Field, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import type { Contribution } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { formatearTamano } from "@/lib/aportes/archivo";
import { MOTIVOS_DE_RECHAZO } from "@/lib/aportes/motivos-de-rechazo";


/**
 * Los formularios de rechazo y de bloqueo aparecen en la columna derecha, lejos de los
 * botones del final: al abrirse, se llevan a la vista. Función fuera del componente para
 * que React la llame solo al montar el formulario (no en cada tecla).
 */
function llevarALaVista(formulario: HTMLFormElement | null) {
  formulario?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export default function RevisionAportePage() {
  const params = useParams<{ id: string; aporteId: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Contribution | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showBanForm, setShowBanForm] = useState(false);
  const [inapropiado, setInapropiado] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  // Si el autor ya está baneado de la campaña se ofrece quitar el baneo en vez de banearlo otra vez.
  const [autorBaneado, setAutorBaneado] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [response, baneosRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/aportes/${params.aporteId}`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/campanas/${params.id}/baneos`, { cache: "no-store" }),
        ]);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar el aporte");
        const aporte = payload.data as Contribution;
        setItem(aporte);

        // Si la lista falla, la pantalla sigue sirviendo: solo no sabrá si ya está baneado.
        const baneos = await baneosRes.json().catch(() => ({}));
        if (baneosRes.ok && Array.isArray(baneos.data) && aporte.userId !== null) {
          setAutorBaneado(baneos.data.some((b: { usuarioId: string }) => b.usuarioId === String(aporte.userId)));
        }
      } catch (cause) {
        setLoadError(cause instanceof Error ? cause.message : "No se pudo cargar el aporte");
      }
    }
    void load();
  }, [params.aporteId, params.id]);

  if (loadError) return <p className="text-sm text-danger">{loadError}</p>;
  if (!item) return <p className="text-sm text-ink-2">Cargando...</p>;

  const contributionId = item.id;

  async function review(status: "aceptado" | "rechazado", rejectionReason?: string) {
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/aportes/${params.aporteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason, ...(status === "rechazado" && inapropiado ? { inapropiado: true } : {}) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar el aporte");
      // Si con este rechazo el dispositivo quedó bloqueado en toda la plataforma, se avisa antes de salir.
      if (payload.message && payload.message !== "Aporte actualizado") {
        setAviso(payload.message);
        setItem((actual) => (actual ? { ...actual, ...(payload.data as Contribution) } : actual));
        setShowRejectForm(false);
        setSubmitting(false);
        return;
      }
      router.push(`/mis-campanas/${params.id}/aportes`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "No se pudo actualizar el aporte");
      setSubmitting(false);
    }
  }

  function approve() {
    void review("aceptado");
  }

  function confirmReject(e: React.FormEvent) {
    e.preventDefault();
    void review("rechazado", customReason.trim() || reason);
  }

  async function banUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${params.id}/baneos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributionId, reason: banReason.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo banear al usuario");
      setShowBanForm(false);
      setBanReason("");
      if (item?.userId === null) {
        // El GET del aporte trae el id del bloqueo para poder quitarlo desde aquí.
        const recarga = await fetch(`${BASE_PATH}/api/aportes/${params.aporteId}`, { cache: "no-store" });
        const datos = await recarga.json().catch(() => ({}));
        if (recarga.ok) setItem(datos.data as Contribution);
      } else {
        setAutorBaneado(true);
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "No se pudo banear al usuario");
    } finally {
      setSubmitting(false);
    }
  }

  async function desbloquearDispositivo() {
    if (!item?.dispositivoBloqueadoId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${params.id}/baneos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloqueoId: item.dispositivoBloqueadoId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo desbloquear el dispositivo");
      setItem({ ...item, dispositivoBloqueadoId: null });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "No se pudo desbloquear el dispositivo");
    } finally {
      setSubmitting(false);
    }
  }

  async function borrarArchivo() {
    if (!item) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/aportes/${item.id}/archivo`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo borrar el archivo");
      setItem({ ...item, archivoBorrado: true });
      setConfirmarBorrado(false);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "No se pudo borrar el archivo");
    } finally {
      setSubmitting(false);
    }
  }

  async function unbanUser() {
    if (!item?.userId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${params.id}/baneos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: item.userId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo quitar el baneo");
      setAutorBaneado(false);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "No se pudo quitar el baneo");
    } finally {
      setSubmitting(false);
    }
  }

  const canReject = Boolean(reason) || customReason.trim().length > 0;
  const alreadyReviewed = item.status === "aceptado" || item.status === "rechazado";
  const esAnonimo = item.userId === null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/mis-campanas/${params.id}/aportes`}
        className="mb-4 inline-block text-[13px] text-ink-2 hover:text-ink"
      >
        ← Volver a aportes
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-ink">Aporte {item.id}</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {item.inapropiado && <Tag tone="danger">Contenido inapropiado</Tag>}
          <Tag tone={item.status === "aceptado" ? "ok" : item.status === "rechazado" ? "danger" : "warn"}>
            {item.status === "aceptado"
              ? "Aceptado"
              : item.status === "rechazado"
                ? "Rechazado"
                : item.firstPassBy
                  ? `Validado por ${item.firstPassBy} · falta tu decisión`
                  : "Sin revisar"}
          </Tag>
        </div>
      </div>

      {aviso && <p className="mb-4 rounded border border-warn bg-warn-tint p-3 text-[12.5px] text-warn">{aviso}</p>}

      {item.reporte && (
        <section role="note" className="mb-4 rounded-lg border border-warn bg-warn-tint p-4 text-[12.5px] text-ink">
          <p className="font-bold text-warn">Un revisor reportó este aporte</p>
          <p className="mt-1">
            <span className="font-semibold">{item.reporte.revisor}</span> ·{" "}
            {new Date(item.reporte.en).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
          </p>
          <p className="mt-1 text-ink-2">Motivo: {item.reporte.motivo}</p>
          <p className="mt-2 text-[11.5px] text-ink-3">
            Banear o bloquear a quien lo envió es decisión tuya: usa el botón de abajo si corresponde.
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {item.archivoBorrado ? (
          <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-line-2 bg-sunken text-[12.5px] text-ink-3">
            Archivo borrado
          </div>
        ) : item.fileType === "foto" ? (
          <img
            src={`${BASE_PATH}/api/aportes/${item.id}/archivo`}
            alt="Archivo del aporte"
            className="h-44 w-full rounded-lg border border-line-2 bg-sunken object-contain"
          />
        ) : (
          <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-line-2 bg-sunken text-[12.5px] text-ink-3">
            Vista previa del archivo · {item.fileType}
            {item.fileSizeBytes && ` · ${formatearTamano(item.fileSizeBytes)}`}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-ink">
            Descripción del participante
          </p>
          <p className="mb-4 text-[14px] leading-relaxed text-ink-2">{item.description}</p>

          {item.caracteristicas && item.caracteristicas.length > 0 && (
            <div className="mb-4">
              <p className="mb-1.5 text-[12.5px] font-medium text-ink">Marcó como aplicable</p>
              <div className="flex flex-wrap gap-1.5">
                {item.caracteristicas.map((c) => (
                  <Tag key={c}>{c}</Tag>
                ))}
              </div>
            </div>
          )}

          <dl className="mb-4 flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-2">Autor</dt>
              <dd className="font-medium text-ink">{item.participantName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Enviado</dt>
              <dd className="font-mono font-medium text-ink">
                {new Date(item.submittedAt).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                ·{" "}
                {new Date(item.submittedAt).toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
            {item.firstPassBy && (
              <div className="flex justify-between">
                <dt className="text-ink-2">Revisor</dt>
                <dd className="font-medium text-ink">{item.firstPassBy}</dd>
              </div>
            )}
            {item.status === "rechazado" && item.rejectionReason && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Motivo de rechazo</dt>
                <dd className="text-right font-medium text-danger">{item.rejectionReason}</dd>
              </div>
            )}
          </dl>

          {actionError && (
            <p className="mb-3 rounded border border-danger bg-danger-tint p-2 text-[12px] text-danger">{actionError}</p>
          )}

          {showRejectForm && (
            <form ref={llevarALaVista} onSubmit={confirmReject} className="mb-4 rounded-lg border border-danger p-4">
              <p className="mb-2 text-[13px] font-medium text-ink">
                Motivo del rechazo <span className="text-danger">*</span>
              </p>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mb-2.5 w-full rounded border border-line-2 bg-surface px-3 py-2.5 text-[13px] text-ink outline-none focus:border-accent"
              >
                <option value="">Selecciona un motivo ▾</option>
                {MOTIVOS_DE_RECHAZO.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <Field label="O redacta el motivo">
                <Textarea
                  rows={3}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Motivo técnico o de contenido"
                />
              </Field>
              {esAnonimo && (
                <label className="mb-3 flex items-start gap-2 text-[12.5px] text-ink">
                  <input
                    type="checkbox"
                    checked={inapropiado}
                    onChange={(e) => setInapropiado(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Contenido inapropiado</span>
                    <span className="block text-[11.5px] text-ink-3">
                      Úsalo solo si el contenido es ofensivo, ilegal o dañino. Si un mismo dispositivo junta varios, se
                      bloquea en toda la plataforma.
                    </span>
                  </span>
                </label>
              )}
              <p className="mb-3 text-[11.5px] text-ink-3">
                {item.userId === null
                  ? "Obligatorio al rechazar. Es un aporte anónimo: queda registrado, pero nadie lo recibe."
                  : "Obligatorio al rechazar. El participante lo verá en Mis aportes."}
              </p>
              <Button variant="danger" type="submit" disabled={!canReject || submitting}>
                Confirmar rechazo
              </Button>
            </form>
          )}

          {showBanForm && (
            <form ref={llevarALaVista} onSubmit={banUser} className="mb-4 rounded-lg border border-danger p-4">
              <p className="mb-2 text-[13px] font-medium text-ink">
                {esAnonimo ? "Bloquear este dispositivo en la campaña" : "Banear usuario de la campaña"}
              </p>
              <Textarea
                rows={3}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder={
                  esAnonimo
                    ? "Explica por qué este dispositivo ya no puede enviar aportes sin cuenta"
                    : "Explica por qué este usuario ya no puede participar en la campaña"
                }
                required
              />
              {!esAnonimo && (
                <p className="mt-2 text-[11.5px] text-ink-3">
                  La persona recibirá este motivo en una notificación y lo verá en la campaña.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" onClick={() => setShowBanForm(false)}>Cancelar</Button>
                <Button variant="danger" size="sm" type="submit" disabled={!banReason.trim() || submitting}>{esAnonimo ? "Confirmar bloqueo" : "Confirmar baneo"}</Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {esAnonimo && !item.archivoBorrado && !alreadyReviewed && (
        <div className="mt-6 rounded-lg border border-line p-4">
          <p className="text-[13px] font-medium text-ink">Borrar el archivo</p>
          <p className="mb-3 text-[12px] text-ink-2">
            Para contenido ilegal o dañino. Se borra del almacenamiento y no se puede recuperar; el registro del aporte se
            conserva.
          </p>
          {confirmarBorrado ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setConfirmarBorrado(false)} disabled={submitting}>Cancelar</Button>
              <Button variant="danger" size="sm" onClick={() => void borrarArchivo()} disabled={submitting}>
                Sí, borrar el archivo
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmarBorrado(true)} disabled={submitting}>
              Borrar archivo
            </Button>
          )}
        </div>
      )}

      {/* Banear o bloquear se puede antes o después de decidir (es sobre la persona). La decisión,
          en cambio, ya no se cambia (dominio.md § 5). */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {esAnonimo ? (
          // Aporte sin cuenta (enlace público): se bloquea el dispositivo, no una cuenta.
          item.dispositivoBloqueadoId ? (
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone="danger">Dispositivo bloqueado en esta campaña</Tag>
              <Button size="sm" onClick={() => void desbloquearDispositivo()} disabled={submitting}>
                Desbloquear
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setShowBanForm(true)} disabled={submitting}>
              Bloquear este dispositivo en la campaña
            </Button>
          )
        ) : autorBaneado ? (
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="danger">Baneado de esta campaña</Tag>
            <Button size="sm" onClick={() => void unbanUser()} disabled={submitting}>
              Quitar baneo
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setShowBanForm(true)} disabled={submitting}>
            Banear usuario de la campaña
          </Button>
        )}
        {alreadyReviewed ? (
          <p className="text-[12.5px] text-ink-2">Este aporte ya tiene una decisión y no se puede cambiar.</p>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => setShowRejectForm(true)} disabled={submitting}>Rechazar</Button>
            <Button variant="primary" onClick={approve} disabled={submitting}>
              Aprobar aporte
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
