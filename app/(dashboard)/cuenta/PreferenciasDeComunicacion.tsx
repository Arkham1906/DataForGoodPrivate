"use client";

// Fila "Preferencias" de la tarjeta de seguridad en /cuenta. "Ver" abre una ventana
// (<dialog> nativo, como ui/SelectorDeTemas) con las opciones de comunicación, notificaciones
// y privacidad. Los indicadores aún son fijos: no se guardan en ningún lado.

import { useRef } from "react";
import Button from "@/components/ui/Button";

const OPCIONES = [
  { titulo: "Campañas nuevas", detalle: "Recibir alertas", activa: true },
  { titulo: "Aportes", detalle: "Estado actualizado", activa: true },
  { titulo: "Recordatorios", detalle: "Semanal", activa: false },
  { titulo: "Newsletter", detalle: "Resumen mensual", activa: true },
];

export default function PreferenciasDeComunicacion() {
  const dialogo = useRef<HTMLDialogElement>(null);

  function cerrar() {
    dialogo.current?.close();
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
              Los avisos que recibes de la plataforma.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {OPCIONES.map((opcion) => (
                <div key={opcion.titulo} className="rounded border border-system-300 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-system-900">{opcion.titulo}</span>
                    <span className={`h-4 w-4 rounded-full ${opcion.activa ? "bg-success-700" : "bg-system-300"}`} />
                  </div>
                  <p className="mt-2 text-[12px] text-system-600">{opcion.detalle}</p>
                </div>
              ))}
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
