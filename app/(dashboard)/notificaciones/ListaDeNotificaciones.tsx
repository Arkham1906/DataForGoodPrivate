"use client";

// Lista de /notificaciones con sus acciones. Abrir una notificación la marca como leída y lleva a su enlace;
// cada una se puede marcar como leída o no leída (PATCH /api/notificaciones/[id]) o borrar (DELETE).
// "Marcar todas como leídas": PATCH /api/notificaciones. Invitación de revisor: POST /api/notificaciones/[id]/aceptar.
// Tras cada cambio refresca la página y avisa a la campana (EVENTO_NOTIFICACIONES) para que actualice su contador.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";
import {
  EVENTO_NOTIFICACIONES,
  fechaDeNotificacion,
  tonoDeNotificacion,
  type Notificacion,
} from "@/lib/notificaciones/tipos";

const COLOR_DEL_PUNTO = { ok: "bg-success-700", warn: "bg-warning-500", danger: "bg-error-700", default: "bg-brand-600" } as const;

export default function ListaDeNotificaciones({
  items,
  noLeidas,
  vacio,
}: {
  items: Notificacion[];
  noLeidas: number;
  vacio: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar(clave: string, url: string, init: RequestInit, mensajeDeError: string): Promise<boolean> {
    setOcupado(clave);
    setError(null);
    const response = await fetch(`${BASE_PATH}${url}`, init).catch(() => null);
    setOcupado(null);
    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setError(payload?.error ?? mensajeDeError);
      return false;
    }
    window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES));
    return true;
  }

  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  async function marcar(item: Notificacion, leida: boolean) {
    if (await enviar(item.id, `/api/notificaciones/${item.id}`, json("PATCH", { leida }), "No se pudo actualizar la notificación")) {
      router.refresh();
    }
  }

  async function abrir(item: Notificacion) {
    if (!item.readAt) {
      await enviar(item.id, `/api/notificaciones/${item.id}`, json("PATCH", { leida: true }), "No se pudo actualizar la notificación");
    }
    if (item.href) router.push(item.href);
    else router.refresh();
  }

  async function borrar(item: Notificacion) {
    if (await enviar(item.id, `/api/notificaciones/${item.id}`, { method: "DELETE" }, "No se pudo borrar la notificación")) {
      router.refresh();
    }
  }

  async function marcarTodas() {
    if (await enviar("todas", "/api/notificaciones", json("PATCH", { leidas: "todas" }), "No se pudieron marcar las notificaciones")) {
      router.refresh();
    }
  }

  async function aceptar(item: Notificacion) {
    if (await enviar(item.id, `/api/notificaciones/${item.id}/aceptar`, { method: "POST" }, "No se pudo aceptar la invitación")) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {noLeidas > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => void marcarTodas()} disabled={ocupado === "todas"}>
            Marcar todas como leídas
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-error-700 bg-error-50 px-4 py-2.5 text-[13px] text-error-700">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-system-200 bg-white px-4 py-10 text-center text-[13px] text-system-600">{vacio}</div>
      ) : (
        <ul className="divide-y divide-system-200 overflow-hidden rounded-lg border border-system-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className={`flex gap-3 px-4 py-3.5 ${item.readAt ? "" : "bg-brand-50"}`}>
              <span
                aria-hidden
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "bg-system-300" : COLOR_DEL_PUNTO[tonoDeNotificacion(item.type)]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <button
                    type="button"
                    onClick={() => void abrir(item)}
                    disabled={ocupado === item.id}
                    className={`text-left text-[14px] text-system-900 hover:text-brand-600 ${item.readAt ? "font-semibold" : "font-bold"}`}
                  >
                    {item.title}
                    {!item.readAt && <span className="sr-only"> (sin leer)</span>}
                  </button>
                  <time dateTime={item.createdAt} className="shrink-0 text-[11.5px] text-system-400">
                    {fechaDeNotificacion(item.createdAt)}
                  </time>
                </div>
                <p className="mt-1 break-words text-[13px] leading-5 text-system-600">{item.message}</p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-semibold">
                  {item.invitationPending && (
                    <Button size="sm" variant="primary" onClick={() => void aceptar(item)} disabled={ocupado === item.id}>
                      {ocupado === item.id ? "Aceptando…" : "Aceptar invitación"}
                    </Button>
                  )}
                  {item.href && (
                    <button type="button" onClick={() => void abrir(item)} className="text-brand-600 hover:underline">
                      Ver
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void marcar(item, !item.readAt)}
                    disabled={ocupado === item.id}
                    className="text-system-600 hover:text-system-900 disabled:opacity-50"
                  >
                    {item.readAt ? "Marcar como no leída" : "Marcar como leída"}
                  </button>
                  {!item.invitationPending && (
                    <button
                      type="button"
                      onClick={() => void borrar(item)}
                      disabled={ocupado === item.id}
                      className="text-error-700 hover:underline disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
