"use client";

// Campana de notificaciones del TopBar. Datos: GET /api/notificaciones (las 8 más nuevas y el total sin leer),
// que vuelve a consultar cada minuto mientras la pestaña está visible y al regresar a ella.
// Abrir una notificación la marca como leída (PATCH /api/notificaciones/[id]) y lleva a su enlace;
// "Marcar todas como leídas": PATCH /api/notificaciones. Aceptar una invitación de revisor:
// POST /api/notificaciones/[id]/aceptar. El historial completo está en /notificaciones.
// Si este navegador tiene los avisos push activos, al cargar reafirma la suscripción a nombre de esta
// sesión (sincronizarPush) y se actualiza en cuanto llega un push (mensaje de public/sw.js).

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";
import { sincronizarPush } from "@/lib/notificaciones/registro-push";
import {
  EVENTO_NOTIFICACIONES,
  haceCuanto,
  tonoDeNotificacion,
  type Notificacion,
  type PaginaDeNotificaciones,
} from "@/lib/notificaciones/tipos";

const CADA_CUANTO_MS = 60_000;
const EN_LA_CAMPANA = 8;

const COLOR_DEL_PUNTO = { ok: "bg-success-700", warn: "bg-warning-500", danger: "bg-error-700", default: "bg-brand-600" } as const;

export default function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const contenedor = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_PATH}/api/notificaciones?porPagina=${EN_LA_CAMPANA}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload: PaginaDeNotificaciones = await response.json();
      startTransition(() => {
        setItems(Array.isArray(payload.data) ? payload.data : []);
        setNoLeidas(Number(payload.noLeidas) || 0);
        setAhora(Date.now());
      });
    } catch {
      // Sin red: se reintenta en la siguiente vuelta.
    }
  }, []);

  // Primera carga, una consulta por minuto con la pestaña visible, otra al volver a ella,
  // y otra cuando /notificaciones avisa que cambió algo.
  useEffect(() => {
    void load();
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, CADA_CUANTO_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") void load();
    };
    const alCambiar = () => void load();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener(EVENTO_NOTIFICACIONES, alCambiar);
    const sw = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    sw?.addEventListener("message", alCambiar);
    void sincronizarPush();
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener(EVENTO_NOTIFICACIONES, alCambiar);
      sw?.removeEventListener("message", alCambiar);
    };
  }, [load]);

  // Se cierra con Esc o con un clic fuera del panel.
  useEffect(() => {
    if (!open) return;
    const alTeclear = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const alPulsar = (event: PointerEvent) => {
      if (contenedor.current && !contenedor.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alPulsar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alPulsar);
    };
  }, [open]);

  function alternar() {
    if (!open) void load();
    setOpen((current) => !current);
  }

  async function abrir(item: Notificacion) {
    if (!item.readAt) {
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setNoLeidas((n) => Math.max(0, n - 1));
      await fetch(`${BASE_PATH}/api/notificaciones/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leida: true }),
      }).catch(() => undefined);
    }
    if (item.href) {
      setOpen(false);
      router.push(item.href);
    }
  }

  async function marcarTodas() {
    const response = await fetch(`${BASE_PATH}/api/notificaciones`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leidas: "todas" }),
    }).catch(() => null);
    if (response?.ok) await load();
  }

  async function acceptInvitation(item: Notificacion) {
    setLoadingId(item.id);
    setError(null);
    const response = await fetch(`${BASE_PATH}/api/notificaciones/${item.id}/aceptar`, { method: "POST" }).catch(() => null);
    if (response?.ok) {
      await load();
      router.refresh();
    } else {
      const payload = await response?.json().catch(() => null);
      setError(payload?.error ?? "No se pudo aceptar la invitación");
      await load();
    }
    setLoadingId(null);
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={alternar}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-system-600 hover:bg-system-100"
      >
        <BellIcon />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 top-11 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-system-200 bg-white shadow-lg max-md:fixed max-md:left-3 max-md:right-3 max-md:top-[var(--dashboard-topbar-height,76px)] max-md:w-auto max-md:max-w-none"
        >
          <div className="flex items-center justify-between gap-2 border-b border-system-200 px-3 py-2.5">
            <p className="text-sm font-bold text-system-900">Notificaciones</p>
            {noLeidas > 0 && (
              <button type="button" onClick={() => void marcarTodas()} className="text-[11.5px] font-bold text-brand-600 hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>

          {error && <p className="mx-3 mt-2 rounded bg-error-50 px-2.5 py-1.5 text-[12px] text-error-700">{error}</p>}

          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-system-600">No tienes notificaciones.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-system-200 overflow-y-auto max-md:max-h-[calc(100dvh-var(--dashboard-topbar-height,76px)-7rem)]">
              {items.map((item) => (
                <li key={item.id} className={item.readAt ? "" : "bg-brand-50"}>
                  <button
                    type="button"
                    onClick={() => void abrir(item)}
                    className="flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-system-100"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-system-300" : COLOR_DEL_PUNTO[tonoDeNotificacion(item.type)]}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`min-w-0 flex-1 break-words text-[12.5px] text-system-900 ${item.readAt ? "font-semibold" : "font-bold"}`}>{item.title}</span>
                        <span className="shrink-0 text-[10.5px] text-system-500">{haceCuanto(item.createdAt, ahora)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-3 block text-[12px] leading-5 text-system-600">{item.message}</span>
                      {!item.readAt && <span className="sr-only">Sin leer</span>}
                    </span>
                  </button>
                  {item.invitationPending && (
                    <div className="px-3 pb-2.5 pl-[1.85rem]">
                      <button
                        type="button"
                        onClick={() => void acceptInvitation(item)}
                        disabled={loadingId === item.id}
                        className="rounded-pill bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-60"
                      >
                        {loadingId === item.id ? "Aceptando…" : "Aceptar invitación"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-system-200 px-3 py-2 text-center">
            <Link href="/notificaciones" onClick={() => setOpen(false)} className="text-[12px] font-bold text-brand-600 hover:underline">
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
