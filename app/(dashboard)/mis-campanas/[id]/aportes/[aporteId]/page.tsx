"use client";

// Pantalla /mis-campanas/[id]/aportes/[aporteId]: detalle de un aporte para el creador.
// Componente cliente. Datos: GET /api/aportes/[id]; imagen desde GET /api/aportes/[id]/archivo.
// Acciones: aceptar/rechazar con PATCH /api/aportes/[id] { status, rejectionReason, inapropiado };
// banear o desbanear al participante con POST/DELETE /api/campanas/[id]/baneos.
// Aporte anónimo (sin cuenta): "Contenido inapropiado" al rechazar, bloquear su dispositivo
// en la campaña (misma API de baneos) y borrar el archivo (DELETE /api/aportes/[id]/archivo).
// Si un revisor lo reportó a supervisión, el creador no lo ve (2026-10-15): solo los supervisores.
// "Reportar a quien aportó" (2026-10-19) rechaza el aporte y avisa a los supervisores (lib/reportes/reportes.ts).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Field, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import type { Contribution } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import ArchivoDelAporte from "@/components/ui/ArchivoDelAporte";
import { MOTIVOS_DE_RECHAZO } from "@/lib/aportes/motivos-de-rechazo";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import ReportarAPlataforma from "@/components/ui/ReportarAPlataforma";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { MOTIVOS_DE_REPORTE_DE_APORTE } from "@/lib/reportes/motivos";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import SelectorDeCalificacion from "@/components/aportes/SelectorDeCalificacion";
import { etiquetaDeCalificacion, type CalificacionDeAporte } from "@/lib/aportes/calificacion";


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
  const [calificacion, setCalificacion] = useState<CalificacionDeAporte | "">("");

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
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
  }, [params.aporteId, params.id, recarga]);

  if (loadError) return <p className="text-sm text-error-700">{loadError}</p>;
  if (!item) return <PantallaEsqueleto tipo="detalle" etiqueta="Cargando aporte…" />;

  const contributionId = item.id;

  async function review(status: "aceptado" | "rechazado", rejectionReason?: string) {
    if (!calificacion) {
      setActionError("Selecciona una calificación antes de guardar la decisión");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/aportes/${params.aporteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason, calificacion, ...(status === "rechazado" && inapropiado ? { inapropiado: true } : {}) }),
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

  async function banUser() {
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
  const calificacionMostrada = etiquetaDeCalificacion(item.calificacion);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link
        href={`/mis-campanas/${params.id}/aportes`}
        className="mb-4 inline-block text-[13px] text-system-600 hover:text-system-900"
      >
        ← Volver a aportes
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">Aporte {item.id}</h1>
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

      {aviso && <p className="mb-4 rounded border border-warning-500 bg-warning-50 p-3 text-[12.5px] text-warning-800">{aviso}</p>}


      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
        {item.archivoBorrado ? (
          <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-[12.5px] text-system-500">
            Archivo borrado
          </div>
        ) : (
          <ArchivoDelAporte aporteId={item.id} tipo={item.fileType} sinArchivo={item.sinArchivo} alt="Archivo del aporte" alto="h-44 lg:h-72" />
        )}

        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-system-900">
            Descripción del participante
          </p>
          <p className="mb-4 text-[14px] leading-relaxed text-system-600">{item.description}</p>

          {item.caracteristicas && item.caracteristicas.length > 0 && (
            <div className="mb-4">
              <p className="mb-1.5 text-[12.5px] font-medium text-system-900">Marcó como aplicable</p>
              <div className="flex flex-wrap gap-1.5">
                {item.caracteristicas.map((c) => (
                  <Tag key={c}>{c}</Tag>
                ))}
              </div>
            </div>
          )}

          <dl className="mb-4 flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-system-600">Autor</dt>
              <dd className="font-medium text-system-900">{item.participantName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-system-600">Enviado</dt>
              <dd className="font-mono font-medium text-system-900">
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
                <dt className="text-system-600">Revisor</dt>
                <dd className="font-medium text-system-900">{item.firstPassBy}</dd>
              </div>
            )}
            {calificacionMostrada && (
              <div className="flex justify-between">
                <dt className="text-system-600">Calificación</dt>
                <dd className="font-semibold text-system-900">{calificacionMostrada}</dd>
              </div>
            )}
            {item.status === "rechazado" && item.rejectionReason && (
              <div className="flex justify-between gap-4">
                <dt className="text-system-600">Motivo de rechazo</dt>
                <dd className="text-right font-medium text-error-700">{item.rejectionReason}</dd>
              </div>
            )}
          </dl>

          {!alreadyReviewed && (
            <div className="border-t border-system-200 pt-4 text-center">
              <p className="mb-2 text-[12.5px] font-semibold text-system-900">
                Calificación del aporte <span className="text-error-700">*</span>
              </p>
              <div className="flex justify-center">
                <SelectorDeCalificacion value={calificacion} onChange={setCalificacion} disabled={submitting} />
              </div>
            </div>
          )}

          {actionError && (
            <p className="mb-3 rounded border border-error-700 bg-error-50 p-2 text-[12px] text-error-700">{actionError}</p>
          )}

          {showRejectForm && (
            <form ref={llevarALaVista} onSubmit={confirmReject} className="mb-4 rounded-lg border border-error-700 p-4">
              <p className="mb-2 text-[13px] font-medium text-system-900">
                Motivo del rechazo <span className="text-error-700">*</span>
              </p>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mb-2.5 w-full rounded border border-system-300 bg-white px-3 py-2.5 text-[13px] text-system-900 outline-none focus:border-brand-600"
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
                <label className="mb-3 flex items-start gap-2 text-[12.5px] text-system-900">
                  <input
                    type="checkbox"
                    checked={inapropiado}
                    onChange={(e) => setInapropiado(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Contenido inapropiado</span>
                    <span className="block text-[11.5px] text-system-500">
                      Úsalo solo si el contenido es ofensivo, ilegal o dañino. Si un mismo dispositivo junta varios, se
                      bloquea en toda la plataforma.
                    </span>
                  </span>
                </label>
              )}
              <p className="mb-3 text-[11.5px] text-system-500">
                {item.userId === null
                  ? "Obligatorio al rechazar. Es un aporte anónimo: queda registrado, pero nadie lo recibe."
                  : "Obligatorio al rechazar. El participante lo verá en Mis aportes."}
              </p>
              <Button variant="danger" type="submit" disabled={!canReject || !calificacion || submitting}>
                Confirmar rechazo
              </Button>
            </form>
          )}

          <VentanaDeConfirmacion
            abierto={showBanForm}
            titulo={esAnonimo ? "Bloquear este dispositivo en la campaña" : "Banear usuario de la campaña"}
            textoConfirmar={esAnonimo ? "Confirmar bloqueo" : "Confirmar baneo"}
            textoOcupado="Guardando…"
            ocupado={submitting}
            peligro
            confirmarDeshabilitado={!banReason.trim()}
            onCancelar={() => setShowBanForm(false)}
            onConfirmar={() => void banUser()}
          >
              <p className="mb-2 text-[13px] font-medium text-system-900">
                {esAnonimo ? "Explica el motivo del bloqueo" : "Explica el motivo del baneo"}
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
                <p className="mt-2 text-[11.5px] text-system-500">
                  La persona recibirá este motivo en una notificación y lo verá en la campaña.
                </p>
              )}
          </VentanaDeConfirmacion>
        </div>
      </div>

      {esAnonimo && !item.archivoBorrado && !item.sinArchivo && !alreadyReviewed && (
        <div className="mt-6 rounded-lg border border-system-200 p-4">
          <p className="text-[13px] font-medium text-system-900">Borrar el archivo</p>
          <p className="mb-3 text-[12px] text-system-600">
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
      <div className="mt-6 grid grid-cols-1 items-center gap-3 border-t border-system-200 pt-4 sm:grid-cols-3">
         <div className="order-3 flex w-full justify-center sm:order-3 sm:col-start-1 sm:row-start-2 sm:w-auto sm:justify-self-start">
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
         </div>
         {alreadyReviewed ? (
          <p className="text-[12.5px] text-system-600">Este aporte ya tiene una decisión y no se puede cambiar.</p>
        ) : (
           <div className="order-1 flex w-full justify-center gap-2 sm:order-1 sm:col-start-2 sm:row-start-1 sm:w-auto sm:justify-self-center">
            <Button size="sm" onClick={() => setShowRejectForm(true)} disabled={submitting}>Rechazar</Button>
            <Button size="sm" variant="primary" onClick={approve} disabled={submitting || !calificacion}>
              Aprobar aporte
            </Button>
          </div>
        )}
        {item.userId && (
          <div className="order-2 mt-4 flex w-full justify-center sm:order-2 sm:col-start-2 sm:row-start-2 sm:mt-0 sm:justify-self-center">
            <ReportarAPlataforma
              url={`/api/aportes/${item.id}/reportar-participante`}
              motivos={MOTIVOS_DE_REPORTE_DE_APORTE}
              titulo="Reportar a quien aportó"
              explicacion="Para contenido inapropiado o faltas de quien lo envió (acoso, contenido ilegal, abuso repetido). Al reportarlo, el aporte se rechaza (aunque ya estuviera aceptado) y la supervisión decide si da un aviso a la cuenta. Esa persona no sabrá quién la reportó. Para sacarla solo de tu campaña, banéala."
              placeholder="Qué hizo quien envió el aporte"
              yaReportado={Boolean(item.participanteReportado)}
              textoYaReportado="Ya reportaste a quien envió este aporte. La supervisión lo está revisando."
              enVentana
            />
          </div>
        )}
      </div>

    </div>
  );
}
