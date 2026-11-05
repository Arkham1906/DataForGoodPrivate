"use client";

// Aviso de ubicación en /campanas (2026-10-31; lib/ubicacion/en-el-navegador.ts):
//  - Sin decidir: invita a "Usar mi ubicación" (el navegador pide permiso al pulsarlo) o "Ahora no".
//  - Activada o con zona guardada: "Estás en Tepic, Nayarit" con "Dejar de usar mi ubicación".
//  - Activada sin zona guardada (2026-11-04): con permiso busca de verdad, y si falla lo dice con "Intentar de
//    nuevo"; sin permiso vuelve a invitar. Antes se quedaba en "Buscando dónde estás…" sin buscar nada.
//  - Dijo que no: no sale (se puede activar otra vez desde el enlace pequeño "Usar mi ubicación").
// Si el navegador no tiene GPS, no sale nada.

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import {
  dejarDeUsarUbicacion,
  detectarYEnviarZona,
  guardarPreferenciaDeUbicacion,
  hayGeolocalizacion,
  permisoDeUbicacion,
  preferenciaDeUbicacion,
  type ZonaDetectada,
} from "@/lib/ubicacion/en-el-navegador";

export default function AvisoDeUbicacion({ zona }: { zona: ZonaDetectada | null }) {
  // null hasta montar: localStorage y navigator solo existen en el navegador.
  const [preferencia, setPreferencia] = useState<"si" | "no" | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fueraDeMexico, setFueraDeMexico] = useState(false);

  useEffect(() => {
    // Leer localStorage solo al montar (en el servidor no existe).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferencia(hayGeolocalizacion() ? preferenciaDeUbicacion() : "no");
  }, []);

  // Activada en este navegador, pero sin zona guardada (otra cuenta, o la borró): se busca o se vuelve a invitar.
  const faltaZona = preferencia === "si" && !zona;
  useEffect(() => {
    if (!faltaZona) return;
    let vivo = true;
    void permisoDeUbicacion().then((permiso) => {
      if (!vivo) return;
      if (permiso === "granted") void activar();
      else setPreferencia(null);
    });
    return () => {
      vivo = false;
    };
  }, [faltaZona]);

  async function activar() {
    setOcupado(true);
    setError(null);
    try {
      const { zona: detectada } = await detectarYEnviarZona();
      guardarPreferenciaDeUbicacion("si");
      setPreferencia("si");
      setFueraDeMexico(detectada === null);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo usar tu ubicación");
    } finally {
      setOcupado(false);
    }
  }

  async function quitar() {
    setOcupado(true);
    await dejarDeUsarUbicacion();
    setPreferencia("no");
    setOcupado(false);
  }

  if (preferencia === undefined) return null;

  // Con zona guardada (también si se detectó en otro dispositivo) se dice dónde está y cómo quitarla.
  if (preferencia === "si" || zona) {
    return (
      <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-system-600">
        <span>
          {zona ? (
            <>
              Estás en <b className="text-system-900">{zona.municipio}, {zona.estado}</b>: &quot;Cerca de ti&quot; muestra sus campañas,
              las de todo {zona.estado} y las de todo el país.
            </>
          ) : fueraDeMexico ? (
            "No estás en México o no pudimos ubicar tu municipio: te mostramos todas las campañas."
          ) : error ? (
            <span className="text-error-700">{error}</span>
          ) : (
            "Buscando dónde estás…"
          )}
        </span>
        {error && !zona && (
          <button type="button" onClick={() => void activar()} disabled={ocupado} className="font-semibold text-brand-600 hover:underline">
            Intentar de nuevo
          </button>
        )}
        <button type="button" onClick={() => void quitar()} disabled={ocupado} className="font-semibold text-brand-600 hover:underline">
          Dejar de usar mi ubicación
        </button>
      </p>
    );
  }

  if (preferencia === "no") {
    return (
      <p className="mb-4 text-[12px] text-system-500">
        <button type="button" onClick={() => void activar()} disabled={ocupado} className="font-semibold text-brand-600 hover:underline">
          {ocupado ? "Buscando dónde estás…" : "Usar mi ubicación"}
        </button>{" "}
        para ver las campañas de donde estés.
        {error && <span className="ml-1 text-error-700">{error}</span>}
      </p>
    );
  }

  return (
    <div className="mb-5 rounded-lg border-l-4 border-brand-600 bg-system-100 p-3.5 text-[12.5px] text-system-600">
      <p>
        Aún no compartes tu ubicación. Actívala para recomendarte las campañas más cercanas a ti.
      </p>
      {error && <p className="mt-1.5 text-error-700">{error}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => void activar()} disabled={ocupado}>
          {ocupado ? "Buscando dónde estás…" : "Usar mi ubicación"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            guardarPreferenciaDeUbicacion("no");
            setPreferencia("no");
          }}
          disabled={ocupado}
        >
          Ahora no
        </Button>
      </div>
    </div>
  );
}
