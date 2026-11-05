"use client";

// Ventana para pedir la ubicación. "Mi ubicación actual" del paso "Lugar" de una campaña llama a ref.pedir()
// (2026-11-03, a pedido del usuario; antes también se pedía sola al llegar al paso), y también
// ui/UbicacionDelPerfil en /bienvenida y /cuenta (2026-11-04).
//  - Si ya la activó (la misma preferencia que "Usar mi ubicación" de /campanas, lib/ubicacion/en-el-navegador.ts),
//    la detecta sin ventana.
//  - Si no, sale una ventana aunque antes haya dicho "Ahora no" (ahora la pidió él). "Usar mi ubicación" hace
//    que el navegador pida el permiso, guarda su zona y la pasa a `onZona`.
//  - Si la rechaza o no se puede, `onSinUbicacion` con el motivo: quien la usa ofrece elegirla a mano.

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import {
  detectarYEnviarZona,
  guardarPreferenciaDeUbicacion,
  hayGeolocalizacion,
  preferenciaDeUbicacion,
  type ZonaDetectada,
} from "@/lib/ubicacion/en-el-navegador";

export type ControlDeUbicacion = { pedir: () => void };

export default function PedirUbicacion({
  ref,
  explicacion,
  onZona,
  onSinUbicacion,
  onOcupado,
}: {
  ref?: Ref<ControlDeUbicacion>;
  /** Para qué se usa la ubicación en esa pantalla. */
  explicacion: string;
  onZona: (zona: ZonaDetectada) => void;
  /** No se pudo o no quiso compartirla. */
  onSinUbicacion: (motivo: string) => void;
  /** Buscando su zona sin ventana (con la ubicación ya activada). */
  onOcupado: (ocupado: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Las últimas funciones, para que una respuesta tardía no use las de un render anterior.
  const avisos = useRef({ onZona, onSinUbicacion, onOcupado });
  useEffect(() => {
    avisos.current = { onZona, onSinUbicacion, onOcupado };
  }, [onZona, onSinUbicacion, onOcupado]);

  useImperativeHandle(ref, () => ({
    pedir() {
      if (!hayGeolocalizacion()) {
        avisos.current.onSinUbicacion("Este navegador no permite compartir la ubicación.");
        return;
      }
      if (preferenciaDeUbicacion() !== "si") {
        setError(null);
        setAbierto(true);
        return;
      }
      avisos.current.onOcupado(true);
      void (async () => {
        try {
          const { zona } = await detectarYEnviarZona();
          if (zona) avisos.current.onZona(zona);
          else avisos.current.onSinUbicacion("Tu ubicación no está en México.");
        } catch (causa) {
          avisos.current.onSinUbicacion(causa instanceof Error ? causa.message : "No pudimos saber dónde estás.");
        } finally {
          avisos.current.onOcupado(false);
        }
      })();
    },
  }));

  function ahoraNo() {
    guardarPreferenciaDeUbicacion("no");
    setAbierto(false);
    avisos.current.onSinUbicacion(error ?? "No compartiste tu ubicación.");
  }

  async function usarUbicacion() {
    setOcupado(true);
    setError(null);
    try {
      const { zona } = await detectarYEnviarZona();
      guardarPreferenciaDeUbicacion("si");
      setAbierto(false);
      if (zona) avisos.current.onZona(zona);
      else avisos.current.onSinUbicacion("Tu ubicación no está en México.");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No pudimos saber dónde estás.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <VentanaDeConfirmacion
      abierto={abierto}
      titulo="¿Usamos tu ubicación?"
      textoConfirmar="Usar mi ubicación"
      textoOcupado="Buscando tu ubicación…"
      textoCancelar="Ahora no"
      ocupado={ocupado}
      onCancelar={ahoraNo}
      onConfirmar={() => void usarUbicacion()}
    >
      <p>{explicacion}</p>
      {error && (
        <p role="alert" className="mt-3 text-error-700">
          {error}
        </p>
      )}
    </VentanaDeConfirmacion>
  );
}
