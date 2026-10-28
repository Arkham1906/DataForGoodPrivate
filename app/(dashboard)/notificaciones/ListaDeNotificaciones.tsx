"use client";

// Lista de /notificaciones con sus acciones. Abrir una notificación la marca como leída y lleva a su enlace;
// cada una se puede marcar como leída o no leída (PATCH /api/notificaciones/[id]) o borrar (DELETE).
// "Marcar todas como leídas": PATCH /api/notificaciones. "Limpiar leídas y viejas" (con confirmación): DELETE /api/notificaciones.
// Invitación de revisor: POST /api/notificaciones/[id]/aceptar.
// Tras cada cambio refresca la página y avisa a la campana (EVENTO_NOTIFICACIONES) para que actualice su contador.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import MenuDeAcciones from "@/components/ui/MenuDeAcciones";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { BASE_PATH } from "@/lib/base-path";
import {
  DIAS_PARA_NOTIFICACION_VIEJA,
  EVENTO_NOTIFICACIONES,
  fechaDeNotificacion,
  CATEGORIAS_DE_NOTIFICACION,
  ORDEN_DE_CATEGORIAS,
  categoriaDeNotificacion,
  claseDelPunto,
  type Notificacion,
} from "@/lib/notificaciones/tipos";


export default function ListaDeNotificaciones({
  items,
  noLeidas,
  limpiables,
  vacio,
}: {
  items: Notificacion[];
  noLeidas: number;
  /** Cuántas borraría "Limpiar" (de todas las páginas, no solo de esta). */
  limpiables: number;
  vacio: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoLimpieza, setConfirmandoLimpieza] = useState(false);

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

  async function limpiar() {
    const ok = await enviar("limpiar", "/api/notificaciones", { method: "DELETE" }, "No se pudieron limpiar las notificaciones");
    setConfirmandoLimpieza(false);
    // Puede que la página actual quede vacía: se regresa a la primera.
    if (ok) {
      router.push("/notificaciones");
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
      {/* Qué significa cada color (2026-10-27). */}
      <ul aria-label="Qué significa cada color" className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-system-600">
        {ORDEN_DE_CATEGORIAS.map((c) => (
          <li key={c} className="flex items-center gap-1.5">
            <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${CATEGORIAS_DE_NOTIFICACION[c].punto}`} />
            {CATEGORIAS_DE_NOTIFICACION[c].nombre}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-system-300" />
          Leída
        </li>
      </ul>
      {(noLeidas > 0 || limpiables > 0) && (
        <div className="flex flex-wrap justify-end gap-2">
          {noLeidas > 0 && (
            <Button size="sm" variant="ghost" onClick={() => void marcarTodas()} disabled={ocupado === "todas"}>
              Marcar todas como leídas
            </Button>
          )}
          {limpiables > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmandoLimpieza(true)} disabled={ocupado === "limpiar"}>
              Limpiar leídas y viejas ({limpiables})
            </Button>
          )}
        </div>
      )}

      <VentanaDeConfirmacion
        abierto={confirmandoLimpieza}
        titulo="Limpiar notificaciones"
        textoConfirmar={`Borrar ${limpiables}`}
        textoOcupado="Borrando…"
        ocupado={ocupado === "limpiar"}
        peligro
        onCancelar={() => setConfirmandoLimpieza(false)}
        onConfirmar={() => void limpiar()}
      >
        <p>
          Se borrarán {limpiables === 1 ? "1 notificación" : `${limpiables} notificaciones`}: las que ya leíste y las
          que tienen más de {DIAS_PARA_NOTIFICACION_VIEJA} días, aunque no las hayas leído. Una invitación de revisor sin
          aceptar se conserva. No se puede deshacer.
        </p>
      </VentanaDeConfirmacion>

      {error && (
        <p role="alert" className="rounded-lg border border-error-700 bg-error-50 px-4 py-2.5 text-[13px] text-error-700">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-system-200 bg-white px-4 py-10 text-center text-[13px] text-system-600">{vacio}</div>
      ) : (
        // Sin overflow-hidden: cortaría el menú "Más". Las esquinas redondeadas van en el primer y
        // el último renglón, para que el fondo de las no leídas no se salga del borde.
        <ul className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className={`flex gap-3 px-4 py-3.5 first:rounded-t-lg last:rounded-b-lg ${item.readAt ? "" : "bg-brand-50"}`}>
              <span
                aria-hidden
                title={CATEGORIAS_DE_NOTIFICACION[categoriaDeNotificacion(item.type)].nombre}
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${claseDelPunto(item.type, Boolean(item.readAt))}`}
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
                    <span className="sr-only">. {CATEGORIAS_DE_NOTIFICACION[categoriaDeNotificacion(item.type)].nombre}</span>
                  </button>
                  <time dateTime={item.createdAt} className="shrink-0 text-[11.5px] text-system-500">
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
                    <button type="button" onClick={() => void abrir(item)} className="inline-flex min-h-6 min-w-6 items-center text-brand-600 hover:underline">
                      Ver
                    </button>
                  )}
                  {/* Marcar y eliminar, en "Más" (Ley de Hick, 2026-10-07): a la vista solo lo principal. */}
                  <MenuDeAcciones
                    discreto
                    alinear="izquierda"
                    etiqueta={`Más acciones de «${item.title}»`}
                    opciones={[
                      {
                        etiqueta: item.readAt ? "Marcar como no leída" : "Marcar como leída",
                        alElegir: () => void marcar(item, !item.readAt),
                        deshabilitado: ocupado === item.id,
                      },
                      ...(item.invitationPending
                        ? []
                        : [{ etiqueta: "Eliminar", alElegir: () => void borrar(item), peligro: true, deshabilitado: ocupado === item.id }]),
                    ]}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
