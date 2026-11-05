"use client";

// Interruptor "Usar mi ubicación" de Preferencias en /cuenta (2026-11-04, a pedido del usuario). Hace lo mismo
// que components/campanas/AvisoDeUbicacion: encenderlo pide el permiso del navegador y guarda la zona; apagarlo
// borra la zona y deja de revisarla. Se recuerda por navegador (lib/ubicacion/en-el-navegador.ts) y, como en
// /campanas, cuenta como activada si hay una zona guardada desde otro dispositivo.

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  EVENTO_ZONA,
  dejarDeUsarUbicacion,
  detectarYEnviarZona,
  guardarPreferenciaDeUbicacion,
  hayGeolocalizacion,
  preferenciaDeUbicacion,
  suscribirAPreferenciaDeUbicacion,
  type ZonaDetectada,
} from "@/lib/ubicacion/en-el-navegador";

const sinSuscripcion = () => () => {};

export default function UbicacionEnPreferencias({ zonaInicial }: { zonaInicial: ZonaDetectada | null }) {
  // En el servidor no se sabe: "sin decidir" y con GPS, para que la hidratación coincida.
  const preferencia = useSyncExternalStore(suscribirAPreferenciaDeUbicacion, preferenciaDeUbicacion, () => null);
  const disponible = useSyncExternalStore(sinSuscripcion, hayGeolocalizacion, () => true);
  const [zona, setZona] = useState(zonaInicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const alCambiar = (evento: Event) => setZona((evento as CustomEvent<ZonaDetectada | null>).detail ?? null);
    window.addEventListener(EVENTO_ZONA, alCambiar);
    return () => window.removeEventListener(EVENTO_ZONA, alCambiar);
  }, []);

  const activa = preferencia === "si" || zona !== null;

  async function alternar() {
    setOcupado(true);
    setError(null);
    try {
      if (activa) {
        await dejarDeUsarUbicacion();
      } else {
        await detectarYEnviarZona();
        guardarPreferenciaDeUbicacion("si");
      }
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo usar tu ubicación");
    } finally {
      setOcupado(false);
    }
  }

  const detalle = !disponible && !activa
    ? "Este navegador no permite compartir la ubicación."
    : ocupado
      ? "Un momento…"
      : zona
        ? `Estás en ${zona.municipio}, ${zona.estado}. Te mostramos las campañas de esa zona y te avisamos si cambias de lugar.`
        : activa
          ? "Activada. Te mostramos las campañas de donde estés y te avisamos si cambias de lugar."
          : "Desactivada. Puedes escribir tu estado y municipio en tu perfil.";

  return (
    <div className="mt-3 rounded border border-system-300 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p id="pref-ubicacion" className="text-sm font-bold text-system-900">
            Usar mi ubicación
          </p>
          <p id="pref-ubicacion-detalle" aria-live="polite" className="text-[12.5px] text-system-600">
            {detalle}
          </p>
          <p className="mt-1 text-[11.5px] text-system-500">Se activa en cada navegador.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={activa}
          aria-labelledby="pref-ubicacion"
          aria-describedby="pref-ubicacion-detalle"
          disabled={ocupado || (!disponible && !activa)}
          onClick={() => void alternar()}
          className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-60 ${activa ? "bg-brand-600" : "bg-system-300"}`}
        >
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${activa ? "left-6" : "left-1"}`} />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[11.5px] text-error-700">
          {error}
        </p>
      )}
    </div>
  );
}
