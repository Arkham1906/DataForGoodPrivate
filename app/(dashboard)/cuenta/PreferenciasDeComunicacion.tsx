"use client";

// Fila "Preferencias" de la tarjeta de seguridad en /cuenta. "Ver" abre una ventana
// (<dialog> nativo, como ui/SelectorDeTemas) con las cuatro opciones de comunicación y
// notificaciones (lib/usuarios/preferencias-opciones.ts). Cada interruptor se guarda al tocarlo
// con PATCH /api/usuarios/[id]/preferencias; si falla, vuelve a como estaba (2026-10-14).
// Abajo, "Privacidad" (la movió aquí Gerard el 2026-10-14): aún sin función.

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";
import { OPCIONES_DE_PREFERENCIAS, type ClaveDePreferencia, type Preferencias } from "@/lib/usuarios/preferencias-opciones";

export default function PreferenciasDeComunicacion({ usuarioId, iniciales }: { usuarioId: string | number; iniciales: Preferencias }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [valores, setValores] = useState<Preferencias>(iniciales);
  const [guardando, setGuardando] = useState<ClaveDePreferencia | null>(null);
  const [error, setError] = useState<{ clave: ClaveDePreferencia; texto: string } | null>(null);

  function cerrar() {
    dialogo.current?.close();
  }

  async function alternar(clave: ClaveDePreferencia) {
    const nuevo = !valores[clave];
    setValores((v) => ({ ...v, [clave]: nuevo }));
    setGuardando(clave);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/usuarios/${usuarioId}/preferencias`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [clave]: nuevo }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setValores((v) => ({ ...v, [clave]: !nuevo }));
      setError({ clave, texto: "No se pudo guardar. Intenta de nuevo." });
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="rounded border border-system-200 bg-system-100 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-system-900">Preferencias</p>
          <p className="text-[12.5px] text-system-600">Comunicación y notificaciones</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => dialogo.current?.showModal()}>
          Ver
        </Button>
      </div>

      <dialog
        ref={dialogo}
        aria-labelledby="preferencias-titulo"
        // Clic en el fondo (fuera de la caja): se cierra.
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="border-b border-system-200 p-5">
            <h2 id="preferencias-titulo" className="text-lg font-extrabold text-system-900">
              Comunicación y notificaciones
            </h2>
            <p className="mt-1 text-[12.5px] text-system-600">
              Llegan a la campana, a Notificaciones y, si los activaste, como avisos del teléfono. Se guardan al tocarlos.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {OPCIONES_DE_PREFERENCIAS.map((opcion) => {
                const activa = valores[opcion.clave];
                const etiqueta = `pref-${opcion.clave}`;
                return (
                  <div key={opcion.clave} className="rounded border border-system-300 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span id={etiqueta} className="text-sm font-semibold text-system-900">
                        {opcion.titulo}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activa}
                        aria-labelledby={etiqueta}
                        aria-describedby={`${etiqueta}-detalle`}
                        disabled={guardando === opcion.clave}
                        onClick={() => void alternar(opcion.clave)}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60 ${activa ? "bg-success-700" : "bg-system-300"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${activa ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    <p id={`${etiqueta}-detalle`} className="mt-2 text-[12px] text-system-600">
                      {activa ? opcion.encendida : opcion.apagada}
                    </p>
                    {error?.clave === opcion.clave && (
                      <p role="alert" className="mt-1 text-[11.5px] text-error-700">
                        {error.texto}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded border border-system-300 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-system-900">Privacidad</p>
                  <p className="text-[12.5px] text-system-600">
                    Participación visible en comunidad
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked="true"
                  aria-label="Participación visible en comunidad"
                  className="relative h-6 w-11 shrink-0 rounded-pill bg-brand-600"
                >
                  <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-system-200 p-4">
            <Button type="button" variant="primary" size="sm" onClick={cerrar}>
              Cerrar
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
