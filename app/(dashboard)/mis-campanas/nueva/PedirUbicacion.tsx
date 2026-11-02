"use client";

// Ubicación al crear una campaña (2026-11-02, a pedido del usuario). Dos formas de llegar aquí:
//  1. Sola (`activo`), cuando la persona llega al paso "Vigencia y lugar" (el elemento con `idDelPaso`
//     entra en pantalla), una vez por formulario abierto:
//      - Si todavía no decide sobre su ubicación (la misma preferencia que "Usar mi ubicación" de /campanas,
//        lib/ubicacion/en-el-navegador.ts), sale una ventana para pedírsela. "Usar mi ubicación" hace que el
//        navegador pida el permiso, guarda su zona y la pasa a `onZona`; "Ahora no" lo recuerda y ya no sale.
//      - Si ya la activó antes, no pregunta: lee su última zona (GET /api/ubicacion) y la pasa a `onZona`.
//      - Si dijo que no, o el navegador no tiene GPS, no hace nada.
//  2. Con el botón "Usar mi estado y municipio" del formulario (ref.pedir()), cuando su perfil no tiene estado:
//      - Si ya la activó: su última zona, o se vuelve a detectar si no hay una guardada (sin ventana).
//      - Si no: sale la misma ventana aunque antes haya dicho "Ahora no" (ahora la pidió él).
//      - Si la rechaza (en la ventana o en el permiso del navegador), `onSinUbicacion` con el motivo: el
//        formulario le dice que elija estado y municipio a mano.

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { BASE_PATH } from "@/lib/base-path";
import {
  detectarYEnviarZona,
  guardarPreferenciaDeUbicacion,
  hayGeolocalizacion,
  preferenciaDeUbicacion,
  type ZonaDetectada,
} from "@/lib/ubicacion/en-el-navegador";

export type ControlDeUbicacion = { pedir: () => void };

async function ultimaZona(): Promise<ZonaDetectada | null> {
  const body = await fetch(`${BASE_PATH}/api/ubicacion`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return body?.zona?.estado ? { estado: body.zona.estado, municipio: body.zona.municipio ?? "" } : null;
}

export default function PedirUbicacion({
  ref,
  activo,
  idDelPaso,
  onZona,
  onSinUbicacion,
  onOcupado,
}: {
  ref?: Ref<ControlDeUbicacion>;
  /** false al editar una campaña: solo se pide sola al crearla (el botón funciona siempre). */
  activo: boolean;
  idDelPaso: string;
  /** porBoton: la pidió con el botón (se usa aunque ya haya estado y municipio elegidos). */
  onZona: (zona: ZonaDetectada, porBoton: boolean) => void;
  /** Con el botón: no se pudo o no quiso compartirla. */
  onSinUbicacion?: (motivo: string) => void;
  /** Con el botón y la ubicación ya activada: buscando su zona (sin ventana). */
  onOcupado?: (ocupado: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yaLlego = useRef(false);
  // La ventana se abrió por el botón (cambia qué pasa al cerrarla).
  const [porBoton, setPorBoton] = useState(false);
  // Las últimas funciones sin volver a montar el observador en cada render.
  const avisos = useRef({ onZona, onSinUbicacion, onOcupado });
  useEffect(() => {
    avisos.current = { onZona, onSinUbicacion, onOcupado };
  }, [onZona, onSinUbicacion, onOcupado]);

  useEffect(() => {
    if (!activo || !hayGeolocalizacion()) return;
    const paso = document.getElementById(idDelPaso);
    if (!paso) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (yaLlego.current || !entradas.some((e) => e.isIntersecting)) return;
        yaLlego.current = true;
        observador.disconnect();
        const preferencia = preferenciaDeUbicacion();
        if (preferencia === null) {
          setPorBoton(false);
          setAbierto(true);
        } else if (preferencia === "si") {
          void ultimaZona().then((zona) => {
            if (zona) avisos.current.onZona(zona, false);
          });
        }
      },
      // Cuenta como "llegó" cuando se ve al menos un tercio del paso.
      { threshold: 0.35 }
    );
    observador.observe(paso);
    return () => observador.disconnect();
  }, [activo, idDelPaso]);

  useImperativeHandle(ref, () => ({
    pedir() {
      // Ya la pidió con el botón: la ventana sola ya no hace falta en este formulario.
      yaLlego.current = true;
      if (!hayGeolocalizacion()) {
        avisos.current.onSinUbicacion?.("Este navegador no permite compartir la ubicación.");
        return;
      }
      if (preferenciaDeUbicacion() !== "si") {
        setPorBoton(true);
        setError(null);
        setAbierto(true);
        return;
      }
      avisos.current.onOcupado?.(true);
      void (async () => {
        try {
          const zona = (await ultimaZona()) ?? (await detectarYEnviarZona()).zona;
          if (zona) avisos.current.onZona(zona, true);
          else avisos.current.onSinUbicacion?.("Tu ubicación no está en México.");
        } catch (causa) {
          avisos.current.onSinUbicacion?.(causa instanceof Error ? causa.message : "No pudimos saber dónde estás.");
        } finally {
          avisos.current.onOcupado?.(false);
        }
      })();
    },
  }));

  function ahoraNo() {
    guardarPreferenciaDeUbicacion("no");
    setAbierto(false);
    if (porBoton) avisos.current.onSinUbicacion?.(error ?? "No compartiste tu ubicación.");
  }

  async function usarUbicacion() {
    setOcupado(true);
    setError(null);
    try {
      const { zona } = await detectarYEnviarZona();
      guardarPreferenciaDeUbicacion("si");
      setAbierto(false);
      if (zona) avisos.current.onZona(zona, porBoton);
      else if (porBoton) avisos.current.onSinUbicacion?.("Tu ubicación no está en México.");
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
      textoCancelar={porBoton ? "Elegir a mano" : "Ahora no"}
      ocupado={ocupado}
      onCancelar={ahoraNo}
      onConfirmar={() => void usarUbicacion()}
    >
      {porBoton && <p className="mb-2">Tu perfil no tiene estado ni municipio.</p>}
      <p>
        Con tu ubicación llenamos el estado y el municipio de la campaña por ti (puedes cambiarlos) y en Explorar
        campañas te mostramos las que están cerca. Tu navegador te pedirá permiso; solo guardamos tu estado y
        municipio, nunca tus coordenadas.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-error-700">
          {error}
        </p>
      )}
    </VentanaDeConfirmacion>
  );
}
