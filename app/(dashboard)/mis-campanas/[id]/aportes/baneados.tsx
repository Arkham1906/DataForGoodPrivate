"use client";

// Sección "Participantes baneados" de la bandeja: cuentas baneadas y dispositivos anónimos
// bloqueados en la campaña.
// Datos y acción: GET y DELETE /api/campanas/[id]/baneos (solo el creador).

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";
import type { BaneadoDeCampana } from "@/lib/campanas/baneos";
import type { DispositivoBloqueado } from "@/lib/aportes/sanciones-anonimas";

/**
 * Participantes que el creador baneó de esta campaña, con la opción de
 * quitar el baneo. No se muestra nada si no hay nadie baneado.
 */
export default function BaneadosDeCampana({ campaignId }: { campaignId: string }) {
  const [baneados, setBaneados] = useState<BaneadoDeCampana[]>([]);
  const [dispositivos, setDispositivos] = useState<DispositivoBloqueado[]>([]);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${BASE_PATH}/api/campanas/${campaignId}/baneos`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(payload.data)) setBaneados(payload.data as BaneadoDeCampana[]);
        if (response.ok && Array.isArray(payload.dispositivos)) setDispositivos(payload.dispositivos as DispositivoBloqueado[]);
      })
      .catch(() => {
        // Sin la lista, la bandeja sigue funcionando; solo no se muestra esta sección.
      });
  }, [campaignId]);

  async function quitarBaneo(usuarioId: string) {
    setQuitandoId(usuarioId);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaignId}/baneos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo quitar el baneo");
      setBaneados((prev) => prev.filter((b) => b.usuarioId !== usuarioId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo quitar el baneo");
    } finally {
      setQuitandoId(null);
    }
  }

  async function desbloquear(bloqueoId: string) {
    setQuitandoId(`d${bloqueoId}`);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaignId}/baneos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloqueoId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo desbloquear el dispositivo");
      setDispositivos((prev) => prev.filter((d) => d.bloqueoId !== bloqueoId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo desbloquear el dispositivo");
    } finally {
      setQuitandoId(null);
    }
  }

  if (baneados.length === 0 && dispositivos.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Participantes baneados">
      <h2 className="text-[15px] font-bold text-system-900">Participantes baneados</h2>
      <p className="mb-3 text-[12.5px] text-system-600">
        No pueden enviar aportes a esta campaña. Al quitar el baneo pueden volver a participar.
      </p>
      {error && <p className="mb-3 rounded border border-error-700 bg-error-50 p-2 text-[12px] text-error-700">{error}</p>}
      <ul className="divide-y divide-system-200 rounded-lg border border-system-200">
        {baneados.map((b) => (
          <li key={b.usuarioId} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-system-900">{b.nombre}</p>
              <p className="text-[12.5px] text-system-600">{b.motivo}</p>
              <p className="font-mono text-[11.5px] text-system-500">
                Baneado el{" "}
                {new Date(b.baneadoEn).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <Button size="sm" onClick={() => void quitarBaneo(b.usuarioId)} disabled={quitandoId === b.usuarioId}>
              {quitandoId === b.usuarioId ? "Quitando..." : "Quitar baneo"}
            </Button>
          </li>
        ))}
        {dispositivos.map((d) => (
          <li key={`d${d.bloqueoId}`} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-system-900">
                Dispositivo anónimo{d.aporteId ? ` (aporte ${d.aporteId})` : ""}
              </p>
              <p className="text-[12.5px] text-system-600">{d.motivo}</p>
              <p className="font-mono text-[11.5px] text-system-500">
                Bloqueado el{" "}
                {new Date(d.bloqueadoEn).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <Button size="sm" onClick={() => void desbloquear(d.bloqueoId)} disabled={quitandoId === `d${d.bloqueoId}`}>
              {quitandoId === `d${d.bloqueoId}` ? "Quitando..." : "Desbloquear"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
