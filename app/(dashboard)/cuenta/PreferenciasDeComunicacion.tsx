"use client";

// Fila "Preferencias" de la tarjeta de seguridad en /cuenta. "Ver" abre una ventana
// (<dialog> nativo, como ui/SelectorDeTemas) con las cuatro opciones de comunicación y
// notificaciones (lib/usuarios/preferencias-opciones.ts). Los cambios quedan en borrador hasta
// pulsar "Guardar cambios"; la ubicación conserva su flujo independiente.
// Arriba de todo (desde el 2026-10-20, a pedido del usuario; antes iba al final), el interruptor
// general "Notificaciones" (2026-10-19; antes ahí estaba "Privacidad", sin función): apagado, no
// llega ninguna notificación salvo las de la cuenta, y las cuatro de abajo se ven atenuadas.
// Al final, "Usar mi ubicación" (2026-11-04, ./UbicacionEnPreferencias) y "Aparecer en la clasificación" (RF-GAM-95,
// ./AparecerEnLideres): se guardan al momento y no dependen del interruptor general. Con ?abrir=preferencias en la
// dirección, la ventana se abre sola (lo usa el aviso de Líderes para quien se ocultó).

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";
import type { ZonaDetectada } from "@/lib/ubicacion/en-el-navegador";
import UbicacionEnPreferencias from "./UbicacionEnPreferencias";
import AparecerEnLideres from "./AparecerEnLideres";
import {
  OPCIONES_DE_PREFERENCIAS,
  PREFERENCIA_GENERAL,
  type Preferencias,
  TODAS_LAS_PREFERENCIAS,
} from "@/lib/usuarios/preferencias-opciones";
import { claseDeVentana } from "@/components/ui/ventana-emergente";

export default function PreferenciasDeComunicacion({
  usuarioId,
  iniciales,
  zona,
  apareceEnLideres,
}: {
  usuarioId: string | number;
  iniciales: Preferencias;
  zona: ZonaDetectada | null;
  apareceEnLideres: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("abrir") === "preferencias") dialogo.current?.showModal();
  }, []);
  const [valores, setValores] = useState<Preferencias>(iniciales);
  const [guardadas, setGuardadas] = useState<Preferencias>(iniciales);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generalActiva = valores.notificaciones;
  const hayCambios = TODAS_LAS_PREFERENCIAS.some(({ clave }) => valores[clave] !== guardadas[clave]);

  function cerrar() {
    if (guardando) return;
    setValores(guardadas);
    setError(null);
    dialogo.current?.close();
  }

  function alternar(clave: keyof Preferencias) {
    setValores((actuales) => ({ ...actuales, [clave]: !actuales[clave] }));
    setError(null);

  }

  async function guardar() {
    if (!hayCambios || guardando) return;
    const cambios = Object.fromEntries(
      TODAS_LAS_PREFERENCIAS
        .filter(({ clave }) => valores[clave] !== guardadas[clave])
        .map(({ clave }) => [clave, valores[clave]]),
    );
    setGuardando(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/usuarios/${usuarioId}/preferencias`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "No se pudieron guardar las preferencias.");
      }
      setGuardadas(valores);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudieron guardar las preferencias.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded border border-system-200 bg-system-100 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-system-900">Preferencias</p>
          <p className="text-[12.5px] text-system-600">Notificaciones, ubicación y clasificación</p>
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
        className={claseDeVentana("normal")}
      >
        <div className="flex max-h-[88vh] flex-col">
          <div className="border-b border-system-200 px-5 py-5 md:px-8 md:py-6">
            <h2 id="preferencias-titulo" className="text-xl font-extrabold md:text-2xl text-system-900">
              Notificaciones, ubicación y clasificación
            </h2>
            <p className="mt-1 text-[15px] text-system-600">
              Los avisos llegan a la campana, a Notificaciones y, si los activaste, al teléfono. Las preferencias de notificación se guardan con el botón; la ubicación y la clasificación se guardan al momento.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
            <div className="rounded border border-system-300 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p id="pref-notificaciones" className="text-base font-bold text-system-900">
                    {PREFERENCIA_GENERAL.titulo}
                  </p>
                  <p id="pref-notificaciones-detalle" className="text-[15px] text-system-600">
                    {generalActiva ? PREFERENCIA_GENERAL.encendida : PREFERENCIA_GENERAL.apagada}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={generalActiva}
                  aria-labelledby="pref-notificaciones"
                  aria-describedby="pref-notificaciones-detalle"
                  disabled={guardando}
                  onClick={() => alternar("notificaciones")}
                  className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-60 ${generalActiva ? "bg-brand-600" : "bg-system-300"}`}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${generalActiva ? "left-6" : "left-1"}`} />
                </button>
              </div>
            </div>

            <div className={`mt-3 grid gap-3 sm:grid-cols-2 transition-opacity ${generalActiva ? "" : "opacity-50"}`}>
              {OPCIONES_DE_PREFERENCIAS.map((opcion) => {
                const activa = valores[opcion.clave];
                const etiqueta = `pref-${opcion.clave}`;
                return (
                  <div key={opcion.clave} className="rounded border border-system-300 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span id={etiqueta} className="text-base font-semibold text-system-900">
                        {opcion.titulo}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activa}
                        aria-labelledby={etiqueta}
                        aria-describedby={`${etiqueta}-detalle`}
                        disabled={guardando || !generalActiva}
                        onClick={() => alternar(opcion.clave)}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60 ${activa ? "bg-success-700" : "bg-system-300"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${activa ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    <p id={`${etiqueta}-detalle`} className="mt-2 text-[14px] text-system-600">
                      {activa ? opcion.encendida : opcion.apagada}
                    </p>
                  </div>
                );
              })}
            </div>

            <UbicacionEnPreferencias zonaInicial={zona} />
            <AparecerEnLideres inicial={apareceEnLideres} />
          </div>

          <div className="flex justify-end border-t border-system-200 px-5 py-4 md:px-8 md:py-5">
            <div className="flex flex-wrap items-center justify-end gap-3">
              {error && <p role="alert" className="text-[12.5px] text-error-700">{error}</p>}
              {hayCambios ? (
                <>
                  <Button type="button" variant="secondary" onClick={cerrar} disabled={guardando}>
                    Descartar cambios
                  </Button>
                  <Button type="button" variant="primary" onClick={() => void guardar()} disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </>
              ) : (
                <Button type="button" variant="primary" onClick={cerrar}>
                  Cerrar
                </Button>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
